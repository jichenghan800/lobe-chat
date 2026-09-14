import { Tooltip } from '@lobehub/ui';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/slices/topic/selectors';

import SelectorTrigger from '../../components/SelectorTrigger';
import { useAgentId } from '../../hooks/useAgentId';
import { useAgentModelSelection } from '../../hooks/useAgentModelSelection';
import { useEffectiveAgentMode } from '../../hooks/useEffectiveAgentMode';
import { useModelLockTooltip } from '../../hooks/useModelLockTooltip';
import { useReasoningEffortControl } from '../../hooks/useReasoningEffortControl';
import { useSwitchModelDisplayScope } from '../../hooks/useSwitchModelDisplayScope';
import { useChatInputStore } from '../../store';
import { useActionBarContext } from '../context';
import SelectorMenu from './SelectorMenu';

const ModelSwitch = memo(() => {
  const { t } = useTranslation('chat');
  const { dropdownPlacement } = useActionBarContext();
  const agentId = useAgentId();
  const effectiveAgentMode = useEffectiveAgentMode(agentId);
  const explicitScope = useChatInputStore((s) => s.modelDisplayScope);
  const modelDisplayScope = explicitScope ?? effectiveAgentMode.currentMode;
  const {
    canDisplayModel,
    canSelectModel,
    model: agentModel,
    provider: agentProvider,
    selectionLockReason,
    selectModel,
  } = useAgentModelSelection(agentId);
  // Topic-scoped model: a topic pins its own model (top-level `topics.model`
  // column). Display the topic's pinned model when present, else the agent
  // default; a switch pins to the active topic, otherwise updates the agent
  // (via selectModel, which honors workspace member overrides).
  // Home creates a new conversation even when the chat store retains the
  // previously visited topic. Keep model and effort reads/writes in this scope.
  const topicModelScope = useChatInputStore((s) => s.topicModelScope !== false);
  const storedTopicId = useChatStore((s) => s.activeTopicId);
  const storedTopicModel = useChatStore(topicSelectors.activeTopicModel);
  const storedTopicLoading = useChatStore(topicSelectors.isActiveTopicModelLoading);
  const activeTopicId = topicModelScope ? storedTopicId : undefined;
  const topicModel = topicModelScope ? storedTopicModel : undefined;
  const isTopicModelLoading = topicModelScope && storedTopicLoading;
  const updateTopicModel = useChatStore((s) => s.updateTopicModel);
  const model = topicModel?.model ?? agentModel;
  const provider = topicModel?.model ? topicModel.provider : agentProvider;

  const switchModelDisplayScope = useSwitchModelDisplayScope();
  const reconciledContext = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!canSelectModel || !agentId || isTopicModelLoading) return;
    // Mode belongs to the Agent, but each topic pins its own model. Reconcile
    // when entering a topic or changing mode, including an inherited mode.
    // Do not react to the intermediate model write of a manual mode change:
    // its mode flag is saved afterwards and the old pool must not undo it.
    const context = JSON.stringify([agentId, activeTopicId, modelDisplayScope]);
    if (!explicitScope && reconciledContext.current === context) return;
    reconciledContext.current = context;
    void switchModelDisplayScope(modelDisplayScope)
      .then((applied) => {
        if (!applied && reconciledContext.current === context)
          reconciledContext.current = undefined;
      })
      .catch((error) => {
        if (reconciledContext.current === context) reconciledContext.current = undefined;
        console.error('[ModelSwitch] Failed to reconcile the mode model', error);
      });
  }, [
    activeTopicId,
    agentId,
    canSelectModel,
    explicitScope,
    isTopicModelLoading,
    modelDisplayScope,
    switchModelDisplayScope,
  ]);

  const enabledModel = useAiInfraStore(aiModelSelectors.getEnabledModelById(model, provider));
  const displayName = enabledModel?.displayName || model;
  const lockTooltip = useModelLockTooltip(displayName, selectionLockReason);
  // Reasoning effort rides along with the model trigger instead of claiming a
  // second action slot. Like the model, it pins to the active topic when there
  // is one and edits the user's per-model default otherwise.
  const effort = useReasoningEffortControl(model, provider, activeTopicId ?? undefined);
  // A pinned model still opens the menu when there is an effort to pick there.
  const interactive = canSelectModel || effort.hasReasoningParams;

  const handleModelChange = useCallback(
    async (params: { model: string; provider: string }) => {
      if (!canSelectModel || isTopicModelLoading) return;

      if (activeTopicId) await updateTopicModel(activeTopicId, params);
      else await selectModel(params);
    },
    [activeTopicId, canSelectModel, isTopicModelLoading, selectModel, updateTopicModel],
  );

  // Both current values on one chip, the way the heterogeneous selector reads:
  // "GPT-5.6 Sol 中". The effort half is dropped for models without one; the
  // chip keeps the two halves apart so the effort is never ellipsised away.
  const effortLabel = effort.effortValue
    ? t(`reasoningEffort.levels.${effort.effortValue}`)
    : undefined;
  const triggerText = effortLabel ? `${displayName} ${effortLabel}` : displayName;

  const trigger = (
    <SelectorTrigger
      aria-disabled={!interactive}
      ariaLabel={triggerText}
      secondaryText={effortLabel}
      text={displayName}
      {...(interactive ? {} : { style: { cursor: 'default' } })}
    />
  );

  if (!canDisplayModel || isTopicModelLoading) return null;

  // Model + effort in one menu, so the two settings that decide how a turn runs
  // are picked in the same place (see SelectorMenu).
  if (effort.hasReasoningParams)
    return (
      <SelectorMenu
        canSelectModel={canSelectModel}
        displayName={displayName}
        effort={effort}
        model={model}
        modelDisplayScope={modelDisplayScope}
        placement={dropdownPlacement ?? 'topRight'}
        provider={provider}
        onModelChange={handleModelChange}
      >
        {trigger}
      </SelectorMenu>
    );

  // Locked: say which model is pinned AND why it can't be changed here — the
  // bare model name used to leave the inert chip unexplained.
  if (!canSelectModel) return <Tooltip title={lockTooltip ?? displayName}>{trigger}</Tooltip>;

  return (
    <ModelSwitchPanel
      model={model}
      modelDisplayScope={modelDisplayScope}
      openOnHover={false}
      placement={dropdownPlacement ?? 'topRight'}
      provider={provider}
      onModelChange={handleModelChange}
    >
      {trigger}
    </ModelSwitchPanel>
  );
});

ModelSwitch.displayName = 'ModelSwitch';

export default ModelSwitch;
