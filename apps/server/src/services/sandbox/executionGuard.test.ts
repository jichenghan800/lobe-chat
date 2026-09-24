import { describe, expect, it, vi } from 'vitest';

import { CottiSandboxModel } from '@/database/models/cottiSandbox';
import type { LobeChatDatabase } from '@/database/type';

import { guardSandboxExecution } from './executionGuard';
import type { SandboxProvider } from './types';

describe('sandbox execution guard', () => {
  it.each([
    [{ success: true }, false],
    [{ success: false, error: { message: 'MARKET_AUTH_REQUIRED' } }, true],
    [{ success: false, error: { name: 'unauthorized', message: 'Missing bearer token' } }, true],
    [{ success: false, error: { message: 'timeout' } }, false],
  ])('records whether remote execution was definitely rejected', async (response, authOnly) => {
    const model = new CottiSandboxModel({} as LobeChatDatabase);
    vi.spyOn(model, 'beginExecution').mockResolvedValue('00000000-0000-0000-0000-000000000001');
    const end = vi.spyOn(model, 'finishExecution').mockResolvedValue(undefined);
    const provider = {
      kind: 'market',
      callTool: vi.fn().mockResolvedValue(response),
    } as unknown as SandboxProvider;
    const service = guardSandboxExecution(provider, model, { userId: 'u', topicId: 't' });
    await service.callTool('executeCode', {});
    expect(end).toHaveBeenCalledWith('u', 't', '00000000-0000-0000-0000-000000000001', authOnly);
  });
  it('never executes after the topic has switched provider', async () => {
    const model = new CottiSandboxModel({} as LobeChatDatabase);
    vi.spyOn(model, 'beginExecution').mockRejectedValue(new Error('Sandbox changed'));
    const callTool = vi.fn();
    const provider = { kind: 'market', callTool } as unknown as SandboxProvider;
    await expect(
      guardSandboxExecution(provider, model, { userId: 'u', topicId: 't' }).callTool(
        'executeCode',
        {},
      ),
    ).rejects.toThrow('Sandbox changed');
    expect(callTool).not.toHaveBeenCalled();
  });
});
