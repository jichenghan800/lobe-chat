import { describe, expect, it, vi } from 'vitest';

import { topicService } from '@/services/topic';

import { createTopicSwitchCheck } from './topicSwitchCheck';

vi.mock('@/services/topic', () => ({ topicService: { checkTopicSwitch: vi.fn() } }));

describe('topic switch check', () => {
  it('does not call a model for simple continuation or an explicit topic change', async () => {
    vi.mocked(topicService.checkTopicSwitch).mockClear();
    const check = createTopicSwitchCheck();
    expect(await check('t1', '继续')).toBe(false);
    expect(await check('t1', '换个话题，查询北京天气')).toBe(true);
    expect(topicService.checkTopicSwitch).not.toHaveBeenCalled();
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
