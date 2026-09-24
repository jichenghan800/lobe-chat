import { MAX_PANEL_HEIGHT, TOOLBAR_HEIGHT } from './const';

export const getModelSwitchPanelHeightConstraints = () => {
  const maxPanelHeight = `min(${MAX_PANEL_HEIGHT}px, var(--available-height, ${MAX_PANEL_HEIGHT}px))`;

  return {
    contentHeight: 'auto' as const,
    maxListHeight: `max(0px, calc(${maxPanelHeight} - ${TOOLBAR_HEIGHT}px))`,
    maxPanelHeight,
  };
};
