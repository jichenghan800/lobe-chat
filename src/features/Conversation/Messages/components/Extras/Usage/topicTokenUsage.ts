import type { ChatTopic } from '@lobechat/types';
import { isRecord } from '@lobechat/utils/object';

/** Read the native rollup; never add cache/reasoning buckets a second time. */
export const getTopicTokenTotal = (
  topic?: Pick<ChatTopic, 'totalTokens' | 'totalInputTokens' | 'totalOutputTokens'> | null,
) => {
  if (!topic) return undefined;
  if (
    typeof topic.totalTokens === 'number' &&
    Number.isFinite(topic.totalTokens) &&
    topic.totalTokens >= 0
  )
    return topic.totalTokens;
  if (
    typeof topic.totalInputTokens === 'number' &&
    typeof topic.totalOutputTokens === 'number' &&
    Number.isFinite(topic.totalInputTokens) &&
    Number.isFinite(topic.totalOutputTokens) &&
    topic.totalInputTokens >= 0 &&
    topic.totalOutputTokens >= 0
  )
    return topic.totalInputTokens + topic.totalOutputTokens;
  return undefined;
};

/** Finalized UI usage can arrive just before the native topic rollup commits. */
export const readSettledTopicUsage = async (
  read: () => Promise<ChatTopic | null>,
  minimumTokens: number,
): Promise<ChatTopic | null> => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const topic = await read();
    if (!topic || (getTopicTokenTotal(topic) ?? 0) >= minimumTokens) return topic;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Topic token rollup is not synchronized yet');
};

/** Native streaming completion writes metadata before persistence promotes usage. */
export const getMessageTokenTotal = (message: { metadata?: unknown; usage?: unknown }) => {
  const metadata = isRecord(message.metadata) ? message.metadata : undefined;
  for (const candidate of [message.usage, metadata?.usage, metadata]) {
    if (!isRecord(candidate)) continue;
    const total = getTopicTokenTotal({
      totalTokens: typeof candidate.totalTokens === 'number' ? candidate.totalTokens : undefined,
      totalInputTokens:
        typeof candidate.totalInputTokens === 'number' ? candidate.totalInputTokens : undefined,
      totalOutputTokens:
        typeof candidate.totalOutputTokens === 'number' ? candidate.totalOutputTokens : undefined,
    });
    if (total !== undefined) return total;
  }
  return undefined;
};
