export interface ModelDisplayItem {
  displayName?: string;
  enabled: boolean;
  model: string;
  provider: string;
}

export interface ModelDisplayModelRef {
  model: string;
  provider: string;
}

export type ModelDisplayScope = 'agent' | 'chat';

export interface ModelDisplayDefaults {
  agent?: ModelDisplayModelRef;
  chat?: ModelDisplayModelRef;
}

export interface ModelDisplayConfig {
  agent: ModelDisplayItem[];
  chat: ModelDisplayItem[];
  defaults?: ModelDisplayDefaults;
  /** Administrator-approved global retirements; never supplied by ordinary list edits. */
  retirements?: Array<{
    at: string;
    by: string;
    source: ModelDisplayModelRef;
    target: ModelDisplayModelRef;
  }>;
}

export interface ModelDisplayOption {
  displayName?: string;
  label: string;
  model: string;
  provider: string;
}

export interface CottiProfessionalModelStatus {
  affectedAgentCount: number;
  currentModel: ModelDisplayModelRef;
  options: ModelDisplayOption[];
}

export interface CottiProfessionalModelSwitchResult {
  affectedAgentCount: number;
  config: ModelDisplayConfig;
  previousModel: ModelDisplayModelRef;
  targetModel: ModelDisplayModelRef;
}
