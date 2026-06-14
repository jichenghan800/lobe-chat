const readHideFlag = (raw: string | undefined, defaultValue = false) => {
  if (raw === undefined) return defaultValue;

  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
};

export const isVideoGenerationHidden = () => readHideFlag(process.env.NEXT_PUBLIC_NAV_HIDE_VIDEO);
