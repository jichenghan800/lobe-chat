import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Token from './TokenTag';

const state = vi.hoisted(() => ({ dev: false, tokens: 100 }));
vi.mock('@/store/user', () => ({ useUserStore: () => state.dev }));
vi.mock('./useTokenBreakdown', () => ({
  useTokenBreakdown: () => ({
    chatsToken: state.tokens,
    historySummaryToken: 0,
    maxTokens: 1_000_000,
    systemRoleToken: 0,
    toolsToken: 0,
    totalToken: state.tokens,
  }),
}));
vi.mock('./NewTopicButton', () => ({
  NewTopicButton: () => <button>New question</button>,
}));
vi.mock('./TokenDetails', () => ({ default: () => null }));
vi.mock('../components/ActionPopover', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@lobehub/ui/chat', () => ({ TokenTag: () => null }));

describe('topic entry availability', () => {
  it.each([
    [false, 100],
    [true, 100],
    [false, 150_000],
    [true, 150_000],
  ])('keeps one topic entry with developer mode %s and context %s', (dev, tokens) => {
    state.dev = dev as boolean;
    state.tokens = tokens as number;
    render(<Token />);
    expect(screen.getAllByRole('button', { name: 'New question' })).toHaveLength(1);
  });
});
