import { act, renderHook } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useTopicFreezeModal } from './useTopicFreezeModal';

const { createModal } = vi.hoisted(() => ({ createModal: vi.fn() }));
vi.mock('@lobehub/ui/base-ui', () => ({ Button: () => null, createModal }));
vi.mock('@lobehub/ui', () => ({ Flexbox: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
const translate = (key: string) => key;

describe('topic freeze modal lifecycle', () => {
  it('opens automatically, dismisses without continuing, and can be reopened explicitly', () => {
    createModal.mockReset();
    createModal.mockImplementation(() => ({ close: vi.fn() }));
    const onContinue = vi.fn();
    const props = { enabled: true, topicId: 'topic', content: 'Budget exhausted', onContinue };
    const { result, rerender, unmount } = renderHook(useTopicFreezeModal, { initialProps: props });
    expect(createModal).toHaveBeenCalledTimes(1);
    expect(createModal.mock.calls[0][0].content).toBe('Budget exhausted');
    act(() => createModal.mock.calls[0][0].onOpenChange(false));
    rerender({ ...props });
    expect(createModal).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    act(() => result.current());
    expect(createModal).toHaveBeenCalledTimes(2);
    unmount();
  });
  it('closes on navigation and cannot continue the previous topic through a stale dialog', () => {
    createModal.mockReset();
    const close = vi.fn();
    createModal.mockImplementation(() => ({ close }));
    const onContinue = vi.fn();
    const { rerender, unmount } = renderHook(useTopicFreezeModal, {
      initialProps: { enabled: true, topicId: 'a', content: 'Manual freeze', onContinue },
    });
    rerender({ enabled: false, topicId: 'b', content: '', onContinue });
    expect(close).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    unmount();
  });
  it('makes new topic the primary action and continues exactly when clicked', () => {
    createModal.mockReset();
    const close = vi.fn();
    createModal.mockImplementation(() => ({ close }));
    const onContinue = vi.fn();
    const { unmount } = renderHook(useTopicFreezeModal, {
      initialProps: { enabled: true, topicId: 'a', content: 'Budget', onContinue },
    });
    const footer = createModal.mock.calls[0][0].footer as ReactElement<{
      children: ReactElement<ComponentProps<'button'> & { type: string }>[];
    }>;
    const primary = footer.props.children[1];
    expect(primary.props.type).toBe('primary');
    act(() => primary.props.onClick?.({} as never));
    expect(close).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
    act(() => primary.props.onClick?.({} as never));
    expect(onContinue).toHaveBeenCalledOnce();
    unmount();
  });
});
