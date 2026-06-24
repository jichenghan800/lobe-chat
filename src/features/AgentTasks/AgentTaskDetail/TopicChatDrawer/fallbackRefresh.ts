import type { UIChatMessage } from '@lobechat/types';

export const FALLBACK_REFRESH_DELAYS = [1500, 3000, 5000, 8000, 13_000, 21_000, 34_000, 55_000];

const isSettledAssistantContent = (message: UIChatMessage) => {
  const content = message.content?.trim();

  return !!message.error || (!!content && content !== '...');
};

export const hasAssistantResultForUserMessage = (
  messages: UIChatMessage[],
  userContent: string,
  timestamp: number,
) => {
  const userMessage = messages.findLast(
    (message) =>
      message.role === 'user' &&
      message.content === userContent &&
      Math.max(message.createdAt, message.updatedAt) >= timestamp,
  );

  if (!userMessage) return false;

  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.parentId === userMessage.id &&
      isSettledAssistantContent(message),
  );
};
