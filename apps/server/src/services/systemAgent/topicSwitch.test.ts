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
    generateObject.mockResolvedValue({ standalone: true, unrelated: true });
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
  it.each([
    { standalone: true, unrelated: false },
    { standalone: false, unrelated: true },
    { standalone: false, unrelated: false },
    { unrelated: true },
    { standalone: 'true', unrelated: true },
    { standalone: true, unrelated: 'true' },
    {},
    null,
  ])('does not interpret uncertain or malformed results as a switch', async (result) => {
    generateObject.mockResolvedValue(result);
    expect(
      await new SystemAgentService({} as LobeChatDatabase, 'user').checkTopicSwitch(
        'prices',
        'add terra',
      ),
    ).toBe(false);
  });
  it.each(['请重试', '继续', '还是不对', '按照第二个方案', '把刚才的结果导出'])(
    'bypasses both model configuration and inference for dependent input: %s',
    async (message) => {
      expect(
        await new SystemAgentService({} as LobeChatDatabase, 'user').checkTopicSwitch(
          'prices',
          message,
        ),
      ).toBe(false);
      expect(initModelRuntimeFromDB).not.toHaveBeenCalled();
      expect(resolveSystemAgentModelConfig).not.toHaveBeenCalled();
      expect(generateObject).not.toHaveBeenCalled();
    },
  );
  it('keeps complex references in the existing topic even if unrelated was returned', async () => {
    generateObject.mockResolvedValue({ standalone: false, unrelated: true });
    expect(
      await new SystemAgentService({} as LobeChatDatabase, 'user').checkTopicSwitch(
        '模型价格对比',
        '换个话题，请把上面的表格导出',
      ),
    ).toBe(false);
    expect(generateObject).toHaveBeenCalledOnce();
  });
  it('permits a mixed opening when the full input is an independent new task', async () => {
    generateObject.mockResolvedValue({ standalone: true, unrelated: true });
    expect(
      await new SystemAgentService({} as LobeChatDatabase, 'user').checkTopicSwitch(
        '模型价格对比',
        '继续，另外帮我查北京明天的天气',
      ),
    ).toBe(true);
    expect(generateObject).toHaveBeenCalledOnce();
  });
});
