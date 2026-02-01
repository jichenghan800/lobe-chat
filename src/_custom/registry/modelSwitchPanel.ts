type ModelSwitchPanelGroupMode = 'byModel' | 'byProvider';

const normalizeGroupMode = (value?: string): ModelSwitchPanelGroupMode | undefined => {
  if (!value) return;
  const normalized = value.trim();
  if (normalized === 'byModel' || normalized === 'byProvider') return normalized;
};

const FORCED_GROUP_MODE = normalizeGroupMode(process.env.NEXT_PUBLIC_MODEL_SWITCH_GROUP_MODE);

export const getForcedModelSwitchPanelGroupMode = () => FORCED_GROUP_MODE;

export const getDefaultModelSwitchPanelGroupMode = () => FORCED_GROUP_MODE || 'byProvider';
