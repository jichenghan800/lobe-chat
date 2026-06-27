import { Center, Flexbox, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import { shouldIncludeAgentOnlyChatModels } from '@/_custom/registry/modelAvailability';
import { getModelDisplayName } from '@/_custom/registry/modelDisplayName';
import { useBusinessModelModeConfig } from '@/business/client/hooks/useBusinessAgentMode';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { usePermission } from '@/hooks/usePermission';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import { useActionBarContext } from '../context';
import { useTopicAwareModelDisplay } from '../Model/useTopicAwareModelDisplay';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  name: css`
    overflow: hidden;

    min-width: 48px;
    max-width: 160px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;
    border-radius: 6px;

    :hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  triggerDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;

    :hover {
      background: transparent;
    }
  `,
}));

const ModelLabel = memo(() => {
  const { dropdownPlacement } = useActionBarContext();
  const { allowed: canCreateContent, reason } = usePermission('create_content');

  const {
    agentId,
    enableAgentMode,
    isModelDisplayLoading,
    model,
    provider,
    updateAgentConfigById,
  } = useTopicAwareModelDisplay();
  const enableCottiAgentAccess = useServerConfigStore(serverConfigSelectors.enableCottiAgentAccess);
  const applyBusinessModelModeConfig = useBusinessModelModeConfig();
  const includeAgentOnlyModels = shouldIncludeAgentOnlyChatModels({
    enableAgentMode,
    enableCottiAgentAccess,
  });

  const enabledModel = useAiInfraStore(aiModelSelectors.getEnabledModelById(model, provider));
  const displayName = isModelDisplayLoading
    ? ''
    : getModelDisplayName(provider, model, enabledModel?.displayName);

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      if (!canCreateContent) return;

      await updateAgentConfigById(agentId, applyBusinessModelModeConfig(params));
    },
    [agentId, applyBusinessModelModeConfig, canCreateContent, updateAgentConfigById],
  );

  const trigger = (
    <Center
      horizontal
      className={cx(styles.trigger, !canCreateContent && styles.triggerDisabled)}
      height={28}
      paddingInline={6}
    >
      <Flexbox horizontal align={'center'} gap={2}>
        <span className={styles.name}>{displayName}</span>
        <ChevronDownIcon className={styles.chevron} size={12} />
      </Flexbox>
    </Center>
  );

  if (!canCreateContent)
    return (
      <Tooltip title={reason}>
        <div>{trigger}</div>
      </Tooltip>
    );

  return (
    <ModelSwitchPanel
      includeAgentOnlyModels={includeAgentOnlyModels}
      model={model}
      openOnHover={false}
      placement={dropdownPlacement}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});

ModelLabel.displayName = 'ModelLabel';

export default ModelLabel;
