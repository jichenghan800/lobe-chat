import type { LobeRuntimeAI } from '@lobechat/model-runtime';
import { ModelRuntime } from '@lobechat/model-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveRetiredModel } from '@/_custom/registry/modelRetirement';
import type { LobeChatDatabase } from '@/database/type';
import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { createModelRetirementGuard, withModelRetirement } from './modelRetirement';

const mocks = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock('@/database/models/cottiModelDisplay', () => ({
  CottiModelDisplayModel: class {
    getConfig = mocks.getConfig;
  },
}));
const source = { model: 'old', provider: 'azure' };
const target = { model: 'new', provider: 'other' };
const config = (): ModelDisplayConfig => ({
  agent: [
    { ...source, enabled: false },
    { ...target, enabled: true },
  ],
  chat: [
    { ...source, enabled: false },
    { ...target, enabled: true },
  ],
  retirements: [{ source, target, at: '2026-09-08', by: 'admin' }],
});
afterEach(() => vi.restoreAllMocks());

describe('global model retirement', () => {
  it('follows administrator-approved cross-provider replacements and chained retirements', () => {
    const policy = config();
    const final = { model: 'final', provider: 'third' };
    policy.retirements!.push({ source: target, target: final, at: '', by: 'admin' });
    expect(resolveRetiredModel(policy, { model: ' OLD ', provider: 'AZURE' })).toEqual(final);
  });
  it('fails closed for missing replacements, disabled replacements and cycles', () => {
    const policy = config();
    expect(() => resolveRetiredModel({ ...policy, retirements: [] }, source)).toThrow('已下线');
    policy.agent[1].enabled = false;
    policy.chat[1].enabled = false;
    expect(() => resolveRetiredModel(policy, source)).toThrow('已下线');
    policy.retirements!.push({ source: target, target: source, at: '', by: 'admin' });
    expect(() => resolveRetiredModel(policy, source)).toThrow('循环');
  });
  it('allows Agent-only models and replacements hidden in Chat', () => {
    const policy = config();
    policy.chat[1].enabled = false;
    expect(resolveRetiredModel(policy, target)).toEqual(target);
    expect(resolveRetiredModel(policy, source)).toEqual(target);
  });
  it('keeps explicit global retirements authoritative over stale enabled rows', () => {
    const policy = config();
    policy.agent[0].enabled = true;
    expect(resolveRetiredModel(policy, source)).toEqual(target);
  });
  it('leaves unrelated models unchanged', () => {
    const other = { model: 'embedding', provider: 'azure' };
    expect(resolveRetiredModel(config(), other)).toEqual(other);
  });
  it('switches stale clients and cached job runtimes before calling an upstream', async () => {
    const db = {} as LobeChatDatabase;
    let policy: ModelDisplayConfig = { agent: [], chat: [] };
    mocks.getConfig.mockImplementation(async () => policy);
    const oldChat = vi.fn(async () => new Response('old'));
    const newChat = vi.fn(async () => new Response('new'));
    const oldRuntime = new ModelRuntime(
      { chat: oldChat } as unknown as LobeRuntimeAI,
      createModelRetirementGuard(db, source.provider),
    );
    const newRuntime = new ModelRuntime(
      { chat: newChat } as unknown as LobeRuntimeAI,
      createModelRetirementGuard(db, target.provider),
    );
    const create = vi.fn(async () => newRuntime);
    const cached = withModelRetirement(oldRuntime, source.provider, db, create);
    await cached.chat({ model: source.model, messages: [] });
    policy = config();
    const response = await cached.chat({ model: source.model, messages: [] });
    expect(await response.text()).toBe('new');
    expect(oldChat).toHaveBeenCalledTimes(1);
    expect(newChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: target.model }),
      expect.anything(),
    );
    expect(create).toHaveBeenCalledWith(target.provider);
  });
  it('blocks an old model at the final guard if retirement occurs after resolution', async () => {
    const db = {} as LobeChatDatabase;
    mocks.getConfig.mockResolvedValue(config());
    const chat = vi.fn();
    const runtime = new ModelRuntime(
      { chat } as unknown as LobeRuntimeAI,
      createModelRetirementGuard(db, source.provider),
    );
    await expect(runtime.chat({ model: source.model, messages: [] })).rejects.toBeDefined();
    expect(chat).not.toHaveBeenCalled();
  });
});
