// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiSandboxModel } from '@/database/models/cottiSandbox';
import type { LobeChatDatabase } from '@/database/type';

import { SandboxCapacityService } from './capacity';

const model = new CottiSandboxModel({} as LobeChatDatabase);
const service = new SandboxCapacityService(async () => model);
const request = { sessionKey: 'a', leaseTtlMs: 900_000, timeoutMs: 120_000 };
beforeEach(() => vi.restoreAllMocks());
describe('capacity guard', () => {
  it('fails closed before any remote execution when full or database unavailable', async () => {
    const execute = vi.fn();
    const reserve = vi.spyOn(model, 'reserve').mockResolvedValue({ allowed: false });
    await expect(service.run(request, execute)).rejects.toMatchObject({
      name: 'SandboxCapacityFull',
    });
    reserve.mockRejectedValue(new Error('database unavailable'));
    await expect(service.run(request, execute)).rejects.toThrow('database unavailable');
    expect(execute).not.toHaveBeenCalled();
  });
  it('keeps uncertain network outcomes reserved', async () => {
    vi.spyOn(model, 'reserve').mockResolvedValue({
      allowed: true,
      newlyReserved: true,
      revision: '00000000-0000-4000-8000-000000000001',
    });
    const release = vi.spyOn(model, 'releaseRejected').mockResolvedValue();
    await expect(
      service.run(request, async () => {
        throw new Error('network timeout');
      }),
    ).rejects.toThrow();
    expect(release).not.toHaveBeenCalled();
  });
  it('releases a definite rejection only for a newly reserved session', async () => {
    const reserve = vi.spyOn(model, 'reserve').mockResolvedValue({
      allowed: true,
      newlyReserved: true,
      revision: '00000000-0000-4000-8000-000000000001',
    });
    const release = vi.spyOn(model, 'releaseRejected').mockResolvedValue();
    await service.run(request, async () => new Response('', { status: 429 }));
    expect(release).toHaveBeenCalledOnce();
    release.mockClear();
    reserve.mockResolvedValue({
      allowed: true,
      newlyReserved: false,
      revision: '00000000-0000-4000-8000-000000000002',
    });
    await service.run(request, async () => new Response('', { status: 429 }));
    expect(release).not.toHaveBeenCalled();
  });
});
