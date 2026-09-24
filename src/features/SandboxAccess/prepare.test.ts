import { describe, expect, it, vi } from 'vitest';

import { prepareSandboxSend, type SandboxAccessDependencies } from './prepare';

const create = () => ({
  choose: vi.fn<SandboxAccessDependencies['choose']>().mockResolvedValue('cancel'),
  isCurrent: vi.fn().mockReturnValue(true),
  preflight: vi.fn().mockResolvedValue({
    cloud: 'auth_required',
    selfHostedAvailable: true,
    selfHostedFull: false,
  }),
  signIn: vi.fn().mockResolvedValue(false),
  switchProvider: vi.fn().mockResolvedValue('switched'),
});
describe('sandbox send authorization', () => {
  it('does not change provider or send after dismissal', async () => {
    const d = create();
    expect(await prepareSandboxSend(d)).toBe('cancel');
    expect(d.switchProvider).not.toHaveBeenCalled();
    expect(d.signIn).not.toHaveBeenCalled();
  });
  it('continues only after successful authorization recheck', async () => {
    const d = create();
    d.choose.mockResolvedValueOnce('login');
    d.signIn.mockResolvedValue(true);
    d.preflight
      .mockResolvedValueOnce({ cloud: 'auth_required', selfHostedAvailable: true })
      .mockResolvedValueOnce({ cloud: 'ready' });
    expect(await prepareSandboxSend(d)).toBe('ready');
    expect(d.switchProvider).not.toHaveBeenCalled();
  });
  it('offers explicit fallback after canceled sign-in', async () => {
    const d = create();
    d.choose.mockResolvedValueOnce('login').mockResolvedValueOnce('selfHosted');
    expect(await prepareSandboxSend(d)).toBe('selfHosted');
    expect(d.choose).toHaveBeenNthCalledWith(2, 'auth_failed', true);
    expect(d.switchProvider).toHaveBeenCalledTimes(1);
  });
  it('does not mistake network failure for a login failure', async () => {
    const d = create();
    d.preflight.mockResolvedValue({ cloud: 'unavailable', selfHostedAvailable: true });
    await prepareSandboxSend(d);
    expect(d.choose).toHaveBeenCalledWith('unavailable', true);
    expect(d.signIn).not.toHaveBeenCalled();
  });
  it('does not switch if capacity fills while the modal is open', async () => {
    const d = create();
    d.choose.mockResolvedValueOnce('selfHosted');
    d.preflight
      .mockResolvedValueOnce({
        cloud: 'auth_required',
        selfHostedAvailable: true,
        selfHostedFull: false,
      })
      .mockResolvedValueOnce({
        cloud: 'auth_required',
        selfHostedAvailable: true,
        selfHostedFull: true,
      });
    expect(await prepareSandboxSend(d)).toBe('cancel');
    expect(d.choose).toHaveBeenLastCalledWith('full', false);
    expect(d.switchProvider).not.toHaveBeenCalled();
  });
  it('requires a separate new-topic choice for a used sandbox', async () => {
    const d = create();
    d.choose.mockResolvedValueOnce('selfHosted').mockResolvedValueOnce('new');
    d.switchProvider.mockResolvedValue('new_topic_required');
    expect(await prepareSandboxSend(d)).toBe('new');
    expect(d.choose).toHaveBeenLastCalledWith('new_topic', true);
  });
  it('does not continue after navigating or editing while authorizing', async () => {
    const d = create();
    d.choose.mockImplementationOnce(async () => {
      d.isCurrent.mockReturnValue(false);
      return 'selfHosted';
    });
    expect(await prepareSandboxSend(d)).toBe('cancel');
    expect(d.switchProvider).not.toHaveBeenCalled();
  });
  it('does not guess fallback availability when the platform check fails', async () => {
    const d = create();
    d.preflight.mockRejectedValue(new Error('offline'));
    expect(await prepareSandboxSend(d)).toBe('cancel');
    expect(d.choose).toHaveBeenCalledWith('unavailable', false);
  });
});
