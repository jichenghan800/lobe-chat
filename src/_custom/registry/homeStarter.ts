import type { StarterMode } from '@/store/home';

interface StarterItemLike {
  key: StarterMode;
}

interface StarterVisibilityOptions {
  showAiImage?: boolean;
}

export const filterHomeStarterItems = <T extends StarterItemLike>(
  items: T[],
  options: StarterVisibilityOptions,
) => {
  if (options.showAiImage === false) {
    return items.filter((item) => item.key !== 'image');
  }

  return items;
};

export const isHomeStarterModeVisible = (
  mode: StarterMode | null | undefined,
  options: StarterVisibilityOptions,
) => {
  if (!mode) return false;
  if (mode === 'image' && options.showAiImage === false) return false;
  return true;
};
