import { describe, expect, it, vi } from 'vitest';

import { topicService } from '@/services/topic';

import { createTopicSwitchCheck } from './topicSwitchCheck';

vi.mock('@/services/topic', () => ({ topicService: { checkTopicSwitch: vi.fn() } }));

describe('topic switch check', () => {
  it.each(['请重试', '继续', '还是不对', '按照第二个方案', '把刚才的结果导出', '好的，请重试。'])(
    'sends dependent input without any classification request: %s',
    async (message) => {
      vi.mocked(topicService.checkTopicSwitch).mockClear();
      expect(await createTopicSwitchCheck()('t1', message)).toBe(false);
      expect(topicService.checkTopicSwitch).not.toHaveBeenCalled();
    },
  );
  it('does not bypass independence checking for an explicit change-of-topic opening', async () => {
    const model = vi.mocked(topicService.checkTopicSwitch).mockReset().mockResolvedValue(false);
    expect(await createTopicSwitchCheck()('t1', '换个话题，请继续上面的分析')).toBe(false);
    expect(model).toHaveBeenCalledOnce();
  });
  it('checks a mixed continuation plus a new task instead of matching its prefix', async () => {
    const model = vi.mocked(topicService.checkTopicSwitch).mockReset().mockResolvedValue(true);
    expect(await createTopicSwitchCheck()('t1', '继续，另外帮我查北京明天的天气')).toBe(true);
    expect(model).toHaveBeenCalledOnce();
  });
  it('reuses the same draft decision but isolates topics and edits', async () => {
    const model = vi.mocked(topicService.checkTopicSwitch).mockReset().mockResolvedValue(true);
    const check = createTopicSwitchCheck();
    expect(await check('prices', '查询北京天气')).toBe(true);
    expect(await check('prices', '查询北京天气')).toBe(true);
    expect(model).toHaveBeenCalledTimes(1);
    await check('weather', '查询北京天气');
    await check('weather', '查询上海天气');
    expect(model).toHaveBeenCalledTimes(3);
  });
  it('allows normal sending on classifier failure without caching the error', async () => {
    const model = vi
      .mocked(topicService.checkTopicSwitch)
      .mockReset()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(true);
    const check = createTopicSwitchCheck();
    expect(await check('t', 'weather')).toBe(false);
    expect(await check('t', 'weather')).toBe(true);
    expect(model).toHaveBeenCalledTimes(2);
  });
});
