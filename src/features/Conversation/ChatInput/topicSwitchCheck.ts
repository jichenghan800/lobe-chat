import { topicService } from '@/services/topic';

import { hasExplicitTopicSwitch } from '../../ChatInput/ActionBar/Token/topicSwitchSuggestion';

export const isSimpleContinuation = (message: string) =>
  /^(?:继续|好的?|可以|确认|同意|谢谢|continue|ok|yes|thanks)[。.!！\s]*$/iu.test(message.trim());

/** Cache only the last bounded decision, scoped to topic and exact draft. */
export const createTopicSwitchCheck = () => {
  let previous: { key: string; value: boolean } | undefined;
  return async (topicId: string, message: string): Promise<boolean> => {
    if (!message.trim() || isSimpleContinuation(message)) return false;
    if (hasExplicitTopicSwitch(message)) return true;
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
