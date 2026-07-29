import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { hasAssistantResultForUserMessage } from './fallbackRefresh';

const message = (overrides: Partial<UIChatMessage>): UIChatMessage =>
  ({
    agentId: 'agt_1',
    content: '',
    createdAt: 1000,
    error: null,
    extra: {},
    id: 'msg_1',
    parentId: null,
    role: 'user',
    topicId: 'tpc_1',
    updatedAt: 1000,
    ...overrides,
  }) as UIChatMessage;

describe('hasAssistantResultForUserMessage', () => {
  it('ignores the loading placeholder for the submitted user message', () => {
    expect(
      hasAssistantResultForUserMessage(
        [
          message({ content: 'follow up', id: 'user-1', role: 'user' }),
          message({ content: '...', id: 'assistant-1', parentId: 'user-1', role: 'assistant' }),
        ],
        'follow up',
        900,
      ),
    ).toBe(false);
  });

  it('ignores settled assistant messages for older user messages', () => {
    expect(
      hasAssistantResultForUserMessage(
        [
          message({ content: 'old', id: 'user-0', role: 'user' }),
          message({
            content: 'old answer',
            id: 'assistant-0',
            parentId: 'user-0',
            role: 'assistant',
          }),
          message({ content: 'follow up', id: 'user-1', role: 'user' }),
          message({ content: '...', id: 'assistant-1', parentId: 'user-1', role: 'assistant' }),
        ],
        'follow up',
        900,
      ),
    ).toBe(false);
  });

  it('returns true when the submitted user message has a settled assistant result', () => {
    expect(
      hasAssistantResultForUserMessage(
        [
          message({ content: 'follow up', id: 'user-1', role: 'user' }),
          message({
            content: 'final answer',
            id: 'assistant-1',
            parentId: 'user-1',
            role: 'assistant',
          }),
        ],
        'follow up',
        900,
      ),
    ).toBe(true);
  });

  it('returns true when the submitted user message has an assistant group result', () => {
    expect(
      hasAssistantResultForUserMessage(
        [
          message({ content: 'follow up', id: 'user-1', role: 'user' }),
          message({
            children: [{ content: 'agent answer', id: 'block-1' }] as any,
            content: '',
            id: 'assistant-group-1',
            parentId: 'user-1',
            role: 'assistantGroup',
          }),
        ],
        'follow up',
        900,
      ),
    ).toBe(true);
  });

  it('returns true for a later assistant-like message without parent id', () => {
    expect(
      hasAssistantResultForUserMessage(
        [
          message({ content: 'follow up', createdAt: 1000, id: 'user-1', role: 'user' }),
          message({
            content: 'supervisor answer',
            createdAt: 1200,
            id: 'supervisor-1',
            role: 'supervisor',
            updatedAt: 1200,
          }),
        ],
        'follow up',
        900,
      ),
    ).toBe(true);
  });
});
