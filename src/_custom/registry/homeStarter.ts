import { SidebarTabKey } from '@/store/global/initialState';
import type { StarterMode } from '@/store/home';

import { isNavHidden } from './navigation';

type HomeStarterMode = Exclude<StarterMode, null>;

const isTruthy = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const HIDE_GROUP_STARTER = isTruthy(process.env.NEXT_PUBLIC_HOME_STARTER_HIDE_GROUP);
const HIDE_IMAGE_STARTER = isTruthy(process.env.NEXT_PUBLIC_HOME_STARTER_HIDE_IMAGE);
const HIDE_VIDEO_STARTER = isTruthy(process.env.NEXT_PUBLIC_HOME_STARTER_HIDE_VIDEO);

interface StarterItemLike {
  key: HomeStarterMode;
}

interface StarterVisibilityOptions {
  isAgentEditable?: boolean;
  showAiImage?: boolean;
}

export const filterHomeStarterItems = <T extends StarterItemLike>(
  items: T[],
  options: StarterVisibilityOptions,
) => {
  const hideAgent = options.isAgentEditable === false;
  const hideGroup = HIDE_GROUP_STARTER || options.isAgentEditable === false;
  const hideImage =
    HIDE_IMAGE_STARTER || options.showAiImage === false || isNavHidden(SidebarTabKey.Image);
  const hideVideo = HIDE_VIDEO_STARTER || isNavHidden(SidebarTabKey.Video);
  const hideWrite = isNavHidden(SidebarTabKey.Pages);

  if (!hideAgent && !hideGroup && !hideImage && !hideVideo && !hideWrite) return items;

  return items.filter((item) => {
    if (hideAgent && item.key === 'agent') return false;
    if (hideGroup && item.key === 'group') return false;
    if (hideImage && item.key === 'image') return false;
    if (hideVideo && item.key === 'video') return false;
    if (hideWrite && item.key === 'write') return false;
    return true;
  });
};

export const isHomeStarterModeVisible = (
  mode: HomeStarterMode | null | undefined,
  options: StarterVisibilityOptions,
) => {
  if (!mode) return false;
  if (mode === 'agent' && options.isAgentEditable === false) return false;
  if (mode === 'group' && (HIDE_GROUP_STARTER || options.isAgentEditable === false)) {
    return false;
  }
  if (
    mode === 'image' &&
    (HIDE_IMAGE_STARTER || options.showAiImage === false || isNavHidden(SidebarTabKey.Image))
  ) {
    return false;
  }
  if (mode === 'video' && (HIDE_VIDEO_STARTER || isNavHidden(SidebarTabKey.Video))) return false;
  if (mode === 'write' && isNavHidden(SidebarTabKey.Pages)) return false;
  return true;
};
