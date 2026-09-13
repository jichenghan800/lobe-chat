import { describe, expect, it } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import {
  addModelDisplayItem,
  moveModelDisplayItem,
  setModelDisplayItemEnabled,
} from './modelDisplayDraft';

const config: ModelDisplayConfig = {
  agent: [
    { enabled: true, model: 'agent-primary', provider: 'test' },
    { enabled: true, model: 'agent-secondary', provider: 'test' },
  ],
  chat: [{ enabled: true, model: 'chat-primary', provider: 'test' }],
  defaults: {
    agent: { model: 'agent-primary', provider: 'test' },
    chat: { model: 'chat-primary', provider: 'test' },
  },
};

describe('platform model display draft', () => {
  it('uses the first added model as the default of an empty scope', () => {
    const next = addModelDisplayItem(
      { ...config, chat: [], defaults: { ...config.defaults, chat: undefined } },
      'chat',
      { label: 'New model', model: 'new', provider: 'test' },
    );

    expect(next.chat).toEqual([
      { displayName: undefined, enabled: true, model: 'new', provider: 'test' },
    ]);
    expect(next.defaults?.chat).toEqual({ model: 'new', provider: 'test' });
  });

  it('moves the default when the current default is disabled', () => {
    const next = setModelDisplayItemEnabled(config, 'agent', config.agent[0], false);

    expect(next?.agent[0].enabled).toBe(false);
    expect(next?.defaults?.agent).toEqual({ model: 'agent-secondary', provider: 'test' });
  });

  it('refuses to disable the only enabled model in a scope', () => {
    expect(setModelDisplayItemEnabled(config, 'chat', config.chat[0], false)).toBeUndefined();
  });

  it('changes visible order without changing the default', () => {
    const next = moveModelDisplayItem(config, 'agent', 1, -1);

    expect(next.agent.map((item) => item.model)).toEqual(['agent-secondary', 'agent-primary']);
    expect(next.defaults?.agent).toEqual(config.defaults?.agent);
  });
});
