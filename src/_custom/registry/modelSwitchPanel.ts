type ModelSwitchPanelGroupMode = 'byModel' | 'byProvider';

const isTruthy = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const normalizeGroupMode = (value?: string): ModelSwitchPanelGroupMode | undefined => {
  if (!value) return;
  const normalized = value.trim();
  if (normalized === 'byModel' || normalized === 'byProvider') return normalized;
};

const FORCED_GROUP_MODE = normalizeGroupMode(process.env.NEXT_PUBLIC_MODEL_SWITCH_GROUP_MODE);
const HIDE_MANAGE_PROVIDER = isTruthy(process.env.NEXT_PUBLIC_MODEL_SWITCH_HIDE_MANAGE_PROVIDER);

export const getForcedModelSwitchPanelGroupMode = () => FORCED_GROUP_MODE;

export const getDefaultModelSwitchPanelGroupMode = () => FORCED_GROUP_MODE || 'byProvider';

export const isModelSwitchPanelManageProviderHidden = () => HIDE_MANAGE_PROVIDER;
