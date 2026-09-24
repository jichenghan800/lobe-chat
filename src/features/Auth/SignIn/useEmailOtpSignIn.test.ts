import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEmailOtpSignIn } from './useEmailOtpSignIn';

const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), error: vi.fn() }));
vi.mock('@/libs/better-auth/auth-client', () => ({
  emailOtp: { sendVerificationOtp: mocks.send },
  signIn: { emailOtp: mocks.verify },
}));
vi.mock('@lobehub/ui/base-ui', () => ({ toast: { error: mocks.error } }));

describe('email code sign-in', () => {
  const location = window.location;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ data: { success: true } });
    mocks.verify.mockResolvedValue({ data: { user: { id: 'existing-user' } } });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '', origin: 'https://chatdev.cotticoffee.com' },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: location });
  });

  it('uses a typed code in the initiating browser without needing a link callback', async () => {
    const { result } = renderHook(() => useEmailOtpSignIn('/tasks'));
    await act(async () => {
      await result.current.send('user@example.com');
    });
    act(() => result.current.setCode('123456'));
    await act(async () => {
      await result.current.verify('user@example.com');
    });
    expect(mocks.send).toHaveBeenCalledWith({ email: 'user@example.com', type: 'sign-in' });
    expect(mocks.verify).toHaveBeenCalledWith({ email: 'user@example.com', otp: '123456' });
    expect(window.location.href).toBe('/tasks');
  });

  it('blocks overlapping sends and cools down repeated dispatches', async () => {
    let finish!: (value: { data: { success: boolean } }) => void;
    mocks.send.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useEmailOtpSignIn('/'));
    await act(async () => {
      const first = result.current.send('user@example.com');
      expect(await result.current.send('user@example.com')).toBe(false);
      finish({ data: { success: true } });
      await first;
    });
    await act(async () => {
      await result.current.send('user@example.com');
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(result.current.remaining).toBe(60);
  });

  it('keeps failed or expired codes on the same screen and permits retry', async () => {
    mocks.verify.mockResolvedValueOnce({ error: { status: 400 } });
    const { result } = renderHook(() => useEmailOtpSignIn('/'));
    act(() => result.current.setCode('123456'));
    await act(async () => {
      await result.current.verify('user@example.com');
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.busy).toBe(false);
    expect(window.location.href).toBe('');
    await act(async () => {
      await result.current.verify('user@example.com');
    });
    expect(window.location.href).toBe('/');
  });

  it('rejects malformed codes locally and external callback redirects', async () => {
    const { result } = renderHook(() => useEmailOtpSignIn('https://evil.example/'));
    act(() => result.current.setCode('123'));
    await act(async () => {
      await result.current.verify('user@example.com');
    });
    expect(mocks.verify).not.toHaveBeenCalled();
    act(() => result.current.setCode('123456'));
    await act(async () => {
      await result.current.verify('user@example.com');
    });
    expect(window.location.href).toBe('/');
  });

  it('does not advance or start cooldown when email delivery fails', async () => {
    mocks.send.mockResolvedValueOnce({ error: { status: 429 } });
    const { result } = renderHook(() => useEmailOtpSignIn('/'));
    await act(async () => {
      expect(await result.current.send('user@example.com')).toBe(false);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.busy).toBe(false);
    expect(mocks.error).toHaveBeenCalled();
  });
});
