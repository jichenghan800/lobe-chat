import { describe, expect, it } from 'vitest';

import {
  filterAgentOnlyChatModels,
  isAgentModelRoute,
  isAgentOnlyChatModel,
} from './modelAvailability';

describe('modelAvailability', () => {
  it('marks GPT-5.5 and GLM-5.2 as agent-only chat models', () => {
    expect(isAgentOnlyChatModel('gpt-5.5')).toBe(true);
    expect(isAgentOnlyChatModel('GLM-5.2')).toBe(true);
    expect(isAgentOnlyChatModel('gemini-3.5-flash')).toBe(false);
  });

  it('removes agent-only models from provider lists while keeping other models', () => {
    const result = filterAgentOnlyChatModels([
      {
        children: [{ id: 'gpt-5.5' }, { id: 'gemini-3.5-flash' }],
        id: 'openai',
      },
      {
        children: [{ id: 'glm-5.2' }],
        id: 'zhipu',
      },
    ]);

    expect(result).toEqual([
      {
        children: [{ id: 'gemini-3.5-flash' }],
        id: 'openai',
      },
    ]);
  });

  it('detects agent model selector routes', () => {
    expect(isAgentModelRoute('/agent/agt_1')).toBe(true);
    expect(isAgentModelRoute('/agent/agt_1/tpc_1')).toBe(true);
    expect(isAgentModelRoute('/popup/agent/agt_1/tpc_1')).toBe(true);
    expect(isAgentModelRoute('/workspace-a/agent/agt_1')).toBe(true);
    expect(isAgentModelRoute('/')).toBe(false);
    expect(isAgentModelRoute('/chat')).toBe(false);
  });
});
