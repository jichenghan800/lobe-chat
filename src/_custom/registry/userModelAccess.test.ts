import { describe, expect, it } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { filterModelsForVip, isVipModel, setModelVip } from './userModelAccess';

const premium = { provider: 'azure', model: 'premium', enabled: true, vip: true };
const ordinary = { provider: 'vertexai', model: 'ordinary', enabled: true };
const config: ModelDisplayConfig = {
  chat: [premium, ordinary],
  agent: [{ ...premium, vip: false }],
  defaults: { chat: premium, agent: premium },
};
describe('VIP model permission', () => {
  it('uses provider + model identity across both pools', () => {
    expect(isVipModel(config, premium)).toBe(true);
    expect(isVipModel(config, { provider: 'other', model: premium.model })).toBe(false);
    const filtered = filterModelsForVip(config, false);
    expect(filtered.chat).toEqual([ordinary]);
    expect(filtered.agent).toEqual([]);
    expect(filtered.defaults).toEqual({
      chat: { provider: ordinary.provider, model: ordinary.model },
      agent: undefined,
    });
    expect(config.chat).toHaveLength(2);
  });
  it('preserves all models for VIP and changes tier consistently across pools', () => {
    expect(filterModelsForVip(config, true)).toBe(config);
    const changed = setModelVip(config, premium, false);
    expect(isVipModel(changed, premium)).toBe(false);
    expect(changed.agent[0].vip).toBe(false);
  });
});
