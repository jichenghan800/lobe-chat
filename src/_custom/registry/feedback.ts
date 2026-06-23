const DEFAULT_FEEDBACK_EMAIL = 'jicheng.han@cotticoffee.com';

const normalizeEmail = (value?: string) => {
  const email = value?.split(',')[0]?.trim();
  return email || undefined;
};

export const getCottiFeedbackEmail = () =>
  normalizeEmail(process.env.NEXT_PUBLIC_COTTI_FEEDBACK_EMAIL) || DEFAULT_FEEDBACK_EMAIL;
