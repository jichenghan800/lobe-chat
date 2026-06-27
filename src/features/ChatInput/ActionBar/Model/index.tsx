import { ModelIcon } from '@lobehub/icons';
import { Center, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo, useCallback } from 'react';

import { shouldIncludeAgentOnlyChatModels } from '@/_custom/registry/modelAvailability';
import { useBusinessModelModeConfig } from '@/business/client/hooks/useBusinessAgentMode';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { usePermission } from '@/hooks/usePermission';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import { useActionBarContext } from '../context';
import { useTopicAwareModelDisplay } from './useTopicAwareModelDisplay';

const styles = createStaticStyles(({ css, cssVar }) => ({
  icon: css`
    transition: scale 400ms cubic-bezier(0.215, 0.61, 0.355, 1);
  `,
  modelDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;

    :hover {
      background: transparent;
    }

    :active {
      div {
        scale: 1;
      }
    }
  `,
  model: css`
    cursor: pointer;
    border-radius: 24px;

    :hover {
      background: ${cssVar.colorFillSecondary};
    }

    :active {
      div {
        scale: 0.8;
      }
    }
  `,
}));

const ModelSwitch = memo(() => {
  const { actionSize, dropdownPlacement } = useActionBarContext();
  const blockSize = actionSize?.blockSize ?? 32;
  const iconSize = actionSize?.size ?? 20;
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

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      if (!canCreateContent) return;

      await updateAgentConfigById(agentId, applyBusinessModelModeConfig(params));
    },
    [agentId, applyBusinessModelModeConfig, canCreateContent, updateAgentConfigById],
  );

  const trigger = (
    <Center
      className={cx(styles.model, !canCreateContent && styles.modelDisabled)}
      height={blockSize}
      width={blockSize}
    >
      <div className={styles.icon}>
        {isModelDisplayLoading ? (
          <div style={{ height: iconSize, width: iconSize }} />
        ) : (
          <ModelIcon model={model} size={iconSize} />
        )}
      </div>
    </Center>
  );

  if (isModelDisplayLoading) return trigger;

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
      placement={dropdownPlacement}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});

ModelSwitch.displayName = 'ModelSwitch';

export default ModelSwitch;
