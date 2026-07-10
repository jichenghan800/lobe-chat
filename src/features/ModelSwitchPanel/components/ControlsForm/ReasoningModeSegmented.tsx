import { Segmented } from '@lobehub/ui';
import type { SegmentedOptions } from 'antd/es/segmented';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentId } from '@/features/ChatInput/hooks/useAgentId';
import { useUpdateAgentConfig } from '@/features/ChatInput/hooks/useUpdateAgentConfig';
import { useAgentStore } from '@/store/agent';
import { chatConfigByIdSelectors } from '@/store/agent/selectors';

const REASONING_MODES = ['standard', 'pro'] as const;
type ReasoningMode = (typeof REASONING_MODES)[number];

export interface ReasoningModeSegmentedProps {
  defaultValue?: ReasoningMode;
  disabled?: boolean;
  id?: string;
  onChange?: (value: ReasoningMode) => void;
  value?: ReasoningMode;
}

const ReasoningModeSegmentedInner = memo<{
  disabled?: boolean;
  id?: string;
  onChange: (value: ReasoningMode) => void;
  value: ReasoningMode;
}>(({ disabled, id, onChange, value }) => {
  const { t } = useTranslation('chat');
  const options = [
    { label: t('extendParams.reasoningMode.standard'), value: 'standard' },
    { label: t('extendParams.reasoningMode.pro'), value: 'pro' },
  ] satisfies SegmentedOptions<ReasoningMode>;

  return (
    <Segmented
      block
      disabled={disabled}
      id={id}
      options={options}
      size={'small'}
      style={{ maxWidth: 240 }}
      value={value}
      onChange={(nextValue) => onChange(nextValue as ReasoningMode)}
    />
  );
});

const ReasoningModeSegmentedWithStore = memo<{
  defaultValue: ReasoningMode;
  disabled?: boolean;
  id?: string;
}>(({ defaultValue, disabled, id }) => {
  const agentId = useAgentId();
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const config = useAgentStore((s) => chatConfigByIdSelectors.getChatConfigById(agentId)(s));
  const value = REASONING_MODES.includes(config.reasoningMode as ReasoningMode)
    ? (config.reasoningMode as ReasoningMode)
    : defaultValue;

  return (
    <ReasoningModeSegmentedInner
      disabled={disabled}
      id={id}
      value={value}
      onChange={(reasoningMode) => updateAgentChatConfig({ reasoningMode })}
    />
  );
});

const ReasoningModeSegmented = memo<ReasoningModeSegmentedProps>(
  ({ defaultValue = 'standard', disabled, id, onChange, value }) => {
    const isControlled = value !== undefined || onChange !== undefined;

    if (isControlled) {
      return (
        <ReasoningModeSegmentedInner
          disabled={disabled}
          id={id}
          value={value ?? defaultValue}
          onChange={onChange ?? (() => {})}
        />
      );
    }

    return (
      <ReasoningModeSegmentedWithStore defaultValue={defaultValue} disabled={disabled} id={id} />
    );
  },
);

export default ReasoningModeSegmented;
