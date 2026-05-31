const normalizeValue = (value?: string) => {
  if (!value) return '';

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const BRAND_NAME = normalizeValue(process.env.NEXT_PUBLIC_BRAND_NAME);
const BRAND_ASSISTANT_NAME = normalizeValue(process.env.NEXT_PUBLIC_BRAND_ASSISTANT_NAME);
const BRAND_LOGO_URL = normalizeValue(process.env.NEXT_PUBLIC_BRAND_LOGO_URL);
const DEFAULT_CUSTOM_ASSISTANT_NAME = '灵枢AI';
const UPSTREAM_ASSISTANT_NAMES = new Set(['Lobe AI', 'LobeAI']);
const UPSTREAM_ASSISTANT_AVATARS = new Set(['/avatars/lobe-ai.png', '/avatars/agent-default.png']);

export const getBrandName = () => BRAND_NAME;

export const getBrandAssistantName = () => BRAND_ASSISTANT_NAME || BRAND_NAME;

export const getBrandLogoUrl = () => BRAND_LOGO_URL;

export const getBrandCopyrightFull = (fallback: string) => {
  if (!BRAND_NAME) return fallback;

  return `© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`;
};

export const getBrandAssistantAvatar = (avatar?: string | null, forceBranding = false) => {
  const displayAvatar = normalizeValue(avatar || undefined);

  if (
    forceBranding &&
    BRAND_LOGO_URL &&
    (!displayAvatar || UPSTREAM_ASSISTANT_AVATARS.has(displayAvatar))
  )
    return BRAND_LOGO_URL;

  return displayAvatar;
};

export const getBrandAssistantDisplayName = (name?: string | null) => {
  const displayName = normalizeValue(name || undefined);
  const brandAssistantName = getBrandAssistantName();

  if (brandAssistantName && (!displayName || UPSTREAM_ASSISTANT_NAMES.has(displayName)))
    return brandAssistantName;

  return displayName;
};

export const getDefaultAssistantDisplayName = () =>
  getBrandAssistantName() || DEFAULT_CUSTOM_ASSISTANT_NAME;
