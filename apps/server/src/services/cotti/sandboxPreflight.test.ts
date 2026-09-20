import { describe, expect, it, vi } from 'vitest';

import { checkSandboxCloudAccess } from './sandboxPreflight';

describe('cloud sandbox preflight', () => {
  it('detects missing login without reaching Market', async () => {
    const get = vi.fn();
    expect(await checkSandboxCloudAccess(undefined, false, get)).toBe('auth_required');
    expect(get).not.toHaveBeenCalled();
  });
  it('accepts existing trusted authentication', async () => {
    const get = vi.fn();
    expect(await checkSandboxCloudAccess(undefined, true, get)).toBe('ready');
    expect(get).not.toHaveBeenCalled();
  });
  it('checks an existing user credential', async () => {
    expect(
      await checkSandboxCloudAccess('test', false, vi.fn().mockResolvedValue({ sub: 'u' })),
    ).toBe('ready');
  });
  it.each([
    [401, 'auth_required'],
    [403, 'unavailable'],
    [500, 'unavailable'],
  ])('classifies status %s without prompting login for a checkpoint', async (status, expected) => {
    expect(
      await checkSandboxCloudAccess(
        'test',
        false,
        vi.fn().mockRejectedValue(Object.assign(new Error('error'), { status })),
      ),
    ).toBe(expected);
  });
});
