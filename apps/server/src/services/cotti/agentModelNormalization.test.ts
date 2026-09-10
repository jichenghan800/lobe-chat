import { describe, expect, it, vi } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { createAgentModelNormalizer, resolveImportedAgentModel } from './agentModelNormalization';

const fallback = { model: 'default', provider: 'vertexai' };
const available = { model: 'terra', provider: 'azure' };
const config: ModelDisplayConfig = {
  agent: [fallback, available].map((r) => ({ ...r, enabled: true })),
  chat: [],
  defaults: { agent: fallback },
};
const mocks = vi.hoisted(() => ({ getConfig: vi.fn(), getDeployed: vi.fn() }));
vi.mock('@/database/models/cottiModelDisplay', () => ({
  CottiModelDisplayModel: vi.fn(() => ({ getConfig: mocks.getConfig })),
}));
vi.mock('./deployedModels', () => ({ getDeployedModelOptions: mocks.getDeployed }));

describe('imported Agent model normalization', () => {
  it.each([
    {},
    { model: 'missing', provider: 'openai' },
    { model: 'terra' },
    { provider: 'azure' },
  ])('uses the platform default for an unavailable/incomplete model %j', (requested) => {
    expect(resolveImportedAgentModel(config, [fallback, available], requested)).toEqual(fallback);
  });
  it('preserves an available model regardless of the default', () => {
    expect(resolveImportedAgentModel(config, [fallback, available], available)).toEqual(available);
  });
  it('does not retain a visible model absent from deployment', () => {
    expect(resolveImportedAgentModel(config, [fallback], available)).toEqual(fallback);
  });
  it('honors a disable in the other display scope', () => {
    expect(
      resolveImportedAgentModel(
        { ...config, chat: [{ ...available, enabled: false }] },
        [fallback, available],
        available,
      ),
    ).toEqual(fallback);
  });
  it('uses an explicit retirement mapping before the generic default', () => {
    const source = { model: 'sol', provider: 'azure' };
    expect(
      resolveImportedAgentModel(
        { ...config, retirements: [{ source, target: available, at: 'now', by: 'admin' }] },
        [fallback, available],
        source,
      ),
    ).toEqual(available);
  });
  it('fails closed if the configured retirement target is unavailable', () => {
    const source = { model: 'sol', provider: 'azure' };
    expect(() =>
      resolveImportedAgentModel(
        { ...config, retirements: [{ source, target: available, at: 'now', by: 'admin' }] },
        [fallback],
        source,
      ),
    ).toThrow('替代模型不可用');
  });
  it('fails before creating agents if the default is not deployed', () => {
    expect(() => resolveImportedAgentModel(config, [], {})).toThrow('默认模型不可用');
  });
  it('shares one snapshot across a batch and preserves unrelated config', async () => {
    mocks.getConfig.mockResolvedValue(config);
    mocks.getDeployed.mockResolvedValue([fallback, available]);
    const normalize = await createAgentModelNormalizer({} as never);
    const input = { model: 'unknown', provider: 'other', systemRole: 'Keep', plugins: ['tool'] };
    expect(normalize(input)).toEqual({ ...input, ...fallback });
    expect(normalize({ ...input, ...available })).toEqual({ ...input, ...available });
    expect(input.model).toBe('unknown');
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getDeployed).toHaveBeenCalledTimes(1);
  });
});
