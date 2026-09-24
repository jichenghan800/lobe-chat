import { toast } from '@lobehub/ui/base-ui';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { emailOtp, signIn } from '@/libs/better-auth/auth-client';
import { sanitizeRedirectPath } from '@/utils/onboardingRedirect';

export const useEmailOtpSignIn = (callbackUrl: string) => {
  const { t } = useTranslation('auth');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const locked = useRef(false);
  const cooldownUntil = useRef(0);
  const lastEmail = useRef('');

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const send = async (email: string) => {
    if (locked.current) return false;
    if (Date.now() < cooldownUntil.current) {
      if (lastEmail.current === email) return true;
      toast.error(t('otp.rateLimit'));
      return false;
    }
    locked.current = true;
    setBusy(true);
    try {
      const result = await emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      if (result.error) {
        toast.error(t(result.error.status === 429 ? 'otp.rateLimit' : 'otp.sendError'));
        return false;
      }
      lastEmail.current = email;
      setCode('');
      setError('');
      cooldownUntil.current = Date.now() + 60_000;
      setRemaining(60);
      return true;
    } catch {
      toast.error(t('otp.sendError'));
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const verify = async (email: string) => {
    if (locked.current) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t('otp.format'));
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await signIn.emailOtp({ email, otp: code.trim() });
      if (result.error) {
        setError(t(result.error.status === 429 ? 'otp.rateLimit' : 'otp.invalid'));
        return;
      }
      window.location.href = sanitizeRedirectPath(callbackUrl);
    } catch {
      setError(t('otp.invalid'));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    setCode('');
    setError('');
    // Keep the cooldown across back navigation to avoid repeated dispatches.
  };

  return { busy, code, error, remaining, reset, send, setCode, verify };
};
