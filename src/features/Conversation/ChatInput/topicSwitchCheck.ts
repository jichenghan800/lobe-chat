import { isContextDependentContinuation } from '@/_custom/topicSwitchPolicy';
import { topicService } from '@/services/topic';

/** Cache only the last bounded decision, scoped to topic and exact draft. */
export const createTopicSwitchCheck = () => {
  let previous: { key: string; value: boolean } | undefined;
  return async (topicId: string, message: string): Promise<boolean> => {
    if (!message.trim() || isContextDependentContinuation(message)) return false;
    const key = JSON.stringify([topicId, message]);
    if (previous?.key === key) return previous.value;
    try {
      const value = await topicService.checkTopicSwitch(
        topicId,
        message,
        AbortSignal.timeout(4500),
      );
      previous = { key, value };
      return value;
    } catch {
      // Advisory only. The independent server cost guard remains authoritative.
      return false;
    }
  };
};
