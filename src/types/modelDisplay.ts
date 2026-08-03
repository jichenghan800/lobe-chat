export interface ModelDisplayItem {
  displayName?: string;
  enabled: boolean;
  model: string;
  provider: string;
}

export interface ModelDisplayConfig {
  agent: ModelDisplayItem[];
  chat: ModelDisplayItem[];
}

export interface ModelDisplayOption {
  displayName?: string;
  label: string;
  model: string;
  provider: string;
}
