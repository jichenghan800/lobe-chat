import { useState } from 'react';

import { useChatInputStore } from '../../store';
import { hasExplicitTopicSwitch } from './topicSwitchSuggestion';

export const useTopicSwitchSuggestion = (topicId?: string | null) => {
  // Subscribe to the boolean only: ordinary keystrokes do not rerender the action bar.
  const detected = useChatInputStore((s) => hasExplicitTopicSwitch(s.markdownContent || ''));
  const [dismissedTopics, setDismissedTopics] = useState<Set<string>>(() => new Set());
  return {
    dismiss: () => {
      if (topicId) setDismissedTopics((previous) => new Set(previous).add(topicId));
    },
    visible: !!topicId && detected && !dismissedTopics.has(topicId),
  };
};
