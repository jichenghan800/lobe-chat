'use client';

import DevSeedSignIn from './DevSeedSignIn';
import { SignInEmailSentStep } from './SignInEmailSentStep';
import { SignInEmailStep } from './SignInEmailStep';
import { SignInPasswordStep } from './SignInPasswordStep';
import { useSignIn } from './useSignIn';

const SignIn = () => {
  const {
    disableEmailPassword,
    email,
    enableEmailOtp,
    form,
    handleBackFromSent,
    handleBackToEmail,
    handleCheckUser,
    handleForgotPassword,
    handleGoToSignup,
    handleResendEmail,
    handleSignIn,
    handleSocialSignIn,
    isSocialOnly,
    lastAuthProvider,
    loading,
    oAuthSSOProviders,
    otp,
    sending,
    sessionExpired,
    sentInfo,
    serverConfigInit,
    socialLoading,
    step,
  } = useSignIn();

  if (step === 'emailSent' && sentInfo)
    return (
      <SignInEmailSentStep
        email={sentInfo.email}
        sending={sending}
        type={sentInfo.type}
        onBack={handleBackFromSent}
        onResend={handleResendEmail}
      />
    );

  if (step === 'password')
    return (
      <SignInPasswordStep
        email={email}
        forgotLoading={sending}
        form={form as any}
        loading={loading}
        onBackToEmail={handleBackToEmail}
        onForgotPassword={handleForgotPassword}
        onSubmit={handleSignIn}
      />
    );

  return (
    <>
      <SignInEmailStep
        disableEmailPassword={disableEmailPassword}
        form={form as any}
        isSocialOnly={isSocialOnly}
        lastAuthProvider={lastAuthProvider}
        loading={loading}
        oAuthSSOProviders={oAuthSSOProviders}
        otp={enableEmailOtp ? otp : undefined}
        otpEmail={email}
        otpSent={step === 'emailOtp'}
        serverConfigInit={serverConfigInit}
        sessionExpired={sessionExpired}
        socialLoading={socialLoading}
        onCheckUser={handleCheckUser}
        onGoToSignup={handleGoToSignup}
        onResetEmail={handleBackToEmail}
        onSetPassword={handleForgotPassword}
        onSocialSignIn={handleSocialSignIn}
      />
      <DevSeedSignIn />
    </>
  );
};

export default SignIn;
