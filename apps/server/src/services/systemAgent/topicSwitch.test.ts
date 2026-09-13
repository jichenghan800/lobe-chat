import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { SystemAgentService } from './index';
import { resolveSystemAgentModelConfig } from './modelConfig';

vi.mock('@/envs/app', () => ({ appEnv: { SYSTEM_AGENT: 'topic=vertexai/gemini-3.5-flash-lite' } }));

vi.mock('@/server/modules/ModelRuntime', () => ({ initModelRuntimeFromDB: vi.fn() }));
vi.mock('@/database/models/user', () => ({
  UserModel: class {
    async getUserSettings() {
      return {};
    }
  },
}));
vi.mock('./modelConfig', () => ({
  resolveSystemAgentModelConfig: vi.fn(async () => ({ model: 'test', provider: 'test' })),
}));
const generateObject = vi.fn();
describe('bounded topic relevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initModelRuntimeFromDB).mockResolvedValue({ generateObject } as unknown as Awaited<
      ReturnType<typeof initModelRuntimeFromDB>
    >);
  });
  it('sends only bounded scope and new input, without history or tools', async () => {
    generateObject.mockResolvedValue({ unrelated: true });
    const service = new SystemAgentService({} as LobeChatDatabase, 'user');
    const signal = new AbortController().signal;
    expect(await service.checkTopicSwitch('s'.repeat(500), 'm'.repeat(5000), signal)).toBe(true);
    const [payload, options] = generateObject.mock.calls[0];
    const input = JSON.parse(payload.messages[1].content);
    expect(input.scope.length).toBe(200);
    expect(input.message.length).toBe(1000);
    expect(payload.tools).toBeUndefined();
    expect(options.signal).toBe(signal);
    expect(options.metadata.trigger).toBe('topic_switch_check');
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(resolveSystemAgentModelConfig).toHaveBeenCalledWith({
      taskKey: 'topic',
      taskConfig: expect.objectContaining({ model: 'gemini-3.5-flash-lite', provider: 'vertexai' }),
    });
  });
  it.each([{ unrelated: false }, {}, { unrelated: 'true' }])(
    'does not interpret uncertain or malformed results as a switch',
    async (result) => {
      generateObject.mockResolvedValue(result);
      expect(
        await new SystemAgentService({} as LobeChatDatabase, 'user').checkTopicSwitch(
          'prices',
          'add terra',
        ),
      ).toBe(false);
    },
  );
});
