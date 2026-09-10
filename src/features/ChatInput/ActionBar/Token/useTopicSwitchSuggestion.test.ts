import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTopicSwitchSuggestion } from './useTopicSwitchSuggestion';

const draft = vi.hoisted(() => ({ markdownContent: '' }));
vi.mock('../../store', () => ({
  useChatInputStore: (selector: (s: typeof draft) => unknown) => selector(draft),
}));

describe('dismissible topic suggestions', () => {
  beforeEach(() => {
    draft.markdownContent = '换个话题，写一封邮件';
  });
  it('dismisses for this topic throughout editing and navigation without changing the draft', () => {
    const { result, rerender } = renderHook(({ id }) => useTopicSwitchSuggestion(id), {
      initialProps: { id: 'one' },
    });
    expect(result.current.visible).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
    expect(draft.markdownContent).toBe('换个话题，写一封邮件');
    draft.markdownContent = '换个话题，安排会议';
    rerender({ id: 'one' });
    expect(result.current.visible).toBe(false);
    rerender({ id: 'two' });
    expect(result.current.visible).toBe(true);
    rerender({ id: 'one' });
    expect(result.current.visible).toBe(false);
  });
  it('does not suggest switching before a topic exists or when the signal is removed', () => {
    const { result, rerender } = renderHook(({ id }) => useTopicSwitchSuggestion(id), {
      initialProps: { id: undefined as string | undefined },
    });
    expect(result.current.visible).toBe(false);
    rerender({ id: 'one' });
    expect(result.current.visible).toBe(true);
    draft.markdownContent = '继续刚才的分析';
    rerender({ id: 'one' });
    expect(result.current.visible).toBe(false);
  });
});
