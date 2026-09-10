import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LambdaContext } from '../lambda/context';
import { trpc } from '../lambda/init';
import { productionDiagnostics } from './productionDiagnostics';

const mocks = vi.hoisted(() => ({ enabled: true, events: [] as unknown[][] }));
vi.mock('debug', () => ({
  default: (namespace: string) =>
    Object.defineProperty(
      (...args: unknown[]) => mocks.events.push([namespace, ...args]),
      'enabled',
      { get: () => mocks.enabled },
    ),
}));
const procedure = trpc.procedure.use(productionDiagnostics);
const payload = [{ content: 'private-result' }];
const router = trpc.router({
  agentSkills: trpc.router({
    list: procedure.query(() => payload),
    fail: procedure.query(() => {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'private-error' });
    }),
  }),
  unrelated: procedure.query(() => payload),
});
const caller = router.createCaller({} as LambdaContext);
beforeEach(() => {
  mocks.enabled = true;
  mocks.events.length = 0;
});

describe('targeted production diagnostics', () => {
  it('records route, status, duration and count without logging response contents', async () => {
    expect(await caller.agentSkills.list()).toEqual(payload);
    expect(mocks.events).toHaveLength(2);
    expect(mocks.events[1]).toEqual([
      'lobe-server:agent-skills-router',
      expect.any(String),
      'agentSkills.list',
      'OK',
      expect.any(Number),
      1,
    ]);
    expect(JSON.stringify(mocks.events)).not.toContain('private-result');
  });
  it('preserves the original error and logs only its code', async () => {
    await expect(caller.agentSkills.fail()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'private-error',
    });
    expect(JSON.stringify(mocks.events)).toContain('FORBIDDEN');
    expect(JSON.stringify(mocks.events)).not.toContain('private-error');
  });
  it('does not log when the namespace is disabled', async () => {
    mocks.enabled = false;
    expect(await caller.agentSkills.list()).toEqual(payload);
    expect(mocks.events).toEqual([]);
  });
  it('does not instrument unrelated routes', async () => {
    expect(await caller.unrelated()).toEqual(payload);
    expect(mocks.events).toEqual([]);
  });
});
