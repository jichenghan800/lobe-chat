import type { ChatStreamPayload } from '@lobechat/model-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTopicToolTrace } from './topicToolTrace';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('topic tool diagnostics', () => {
  it('records names only for the explicitly selected topic', async () => {
    vi.stubEnv('COTTI_TOOL_TRACE_TOPIC_ID', 'target');
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const hook = createTopicToolTrace('test');
    const payload = {
      model: 'model',
      messages: [{ role: 'user', content: 'private-text' }],
      tools: [
        {
          type: 'function',
          function: { name: 'sandbox_execute', description: 'private-description', parameters: {} },
        },
      ],
    } as ChatStreamPayload;
    await hook.beforeChat!(payload, { metadata: { topicId: 'other' } });
    expect(log).not.toHaveBeenCalled();
    await hook.beforeChat!(payload, { metadata: { topicId: 'target' } });
    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain('sandbox_execute');
    expect(output).not.toContain('private-');
  });
});
