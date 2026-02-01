const normalizeValue = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const BRAND_NAME = normalizeValue(process.env.NEXT_PUBLIC_BRAND_NAME);
const BRAND_ASSISTANT_NAME = normalizeValue(process.env.NEXT_PUBLIC_BRAND_ASSISTANT_NAME);

export const getBrandName = () => BRAND_NAME;

export const getBrandAssistantName = () => {
  if (BRAND_ASSISTANT_NAME) return BRAND_ASSISTANT_NAME;
  if (BRAND_NAME) return `${BRAND_NAME} AI`;
  return 'Lobe AI';
};
