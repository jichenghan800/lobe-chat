import { SidebarTabKey } from '@/store/global/initialState';
import type { StarterMode } from '@/store/home';

import { isNavHidden } from './navigation';

interface StarterItemLike {
  key: StarterMode;
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
  const hideGroup = options.isAgentEditable === false;
  const hideImage = options.showAiImage === false || isNavHidden(SidebarTabKey.Image);
  const hideWrite = isNavHidden(SidebarTabKey.Pages);

  if (!hideAgent && !hideGroup && !hideImage && !hideWrite) return items;

  return items.filter((item) => {
    if (hideAgent && item.key === 'agent') return false;
    if (hideGroup && item.key === 'group') return false;
    if (hideImage && item.key === 'image') return false;
    if (hideWrite && item.key === 'write') return false;
    return true;
  });
};

export const isHomeStarterModeVisible = (
  mode: StarterMode | null | undefined,
  options: StarterVisibilityOptions,
) => {
  if (!mode) return false;
  if (mode === 'agent' && options.isAgentEditable === false) return false;
  if (mode === 'group' && options.isAgentEditable === false) return false;
  if (mode === 'image' && (options.showAiImage === false || isNavHidden(SidebarTabKey.Image)))
    return false;
  if (mode === 'write' && isNavHidden(SidebarTabKey.Pages)) return false;
  return true;
};
