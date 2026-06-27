export const STORAGE_KEY = 'MODEL_SWITCH_PANEL_WIDTH';
export const STORAGE_KEY_MODE = 'MODEL_SWITCH_PANEL_MODE';
export const DEFAULT_WIDTH = 320;
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 600;
export const MAX_PANEL_HEIGHT = 460;
export const TOOLBAR_HEIGHT = 40;
export const PANEL_VERTICAL_PADDING = 8;

export const ITEM_HEIGHT = {
  'empty-model': 38,
  'group-header': 32,
  'model-item': 38,
  'no-provider': 38,
} as const;

export const ENABLE_RESIZING = {
  bottom: false,
  bottomLeft: false,
  bottomRight: false,
  left: false,
  right: true,
  top: false,
  topLeft: false,
  topRight: false,
} as const;
