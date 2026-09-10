import { Flexbox } from '@lobehub/ui';
import { ActionIcon } from '@lobehub/ui/base-ui';
import { PlusIcon } from 'lucide-react';
import {
  memo,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  type ActionKeys,
  ChatInputProvider,
  DesktopChatInput,
  type SendButtonHandler,
} from '@/features/ChatInput';
import ActionBar from '@/features/ChatInput/ActionBar';
import { useEffectiveAgentMode } from '@/features/ChatInput/hooks/useEffectiveAgentMode';
import { useSwitchModelDisplayScope } from '@/features/ChatInput/hooks/useSwitchModelDisplayScope';
import { useToggleAgentMode } from '@/features/ChatInput/hooks/useToggleAgentMode';
import { useChatStore } from '@/store/chat';

import type { HomeMode } from '../types';
import { HOME_INPUT_BODY_HEIGHT } from './constants';
import ModeSelect from './ModeSelect';

const leftActions: ActionKeys[] = ['plus'];
const rightActions: ActionKeys[] = ['model'];

const CONTAINER_RADIUS = 20;
/** Clearance from the container edge to the round controls sitting in its corners. */
const ACTION_BAR_INSET = 8;

export interface HomeEditorInputProps {
  agentId?: string;
  contextSelectionKey: string;
  initialValue: string;
  isAgentConfigLoading: boolean;
  loading: boolean;
  mode: HomeMode;
  onModeChange: (mode: HomeMode) => void;
  onValueChange: (value: string) => void;
  placeholder?: ReactNode;
  send: SendButtonHandler;
}

interface HomeEditorContentProps extends HomeEditorInputProps {
  sendHandlerRef: MutableRefObject<SendButtonHandler>;
}

const HomeEditorContent = memo<HomeEditorContentProps>(
  ({
    agentId,
    initialValue,
    isAgentConfigLoading,
    mode,
    onModeChange,
    placeholder,
    send,
    sendHandlerRef,
  }) => {
    const toggleAgentMode = useToggleAgentMode();
    const switchModelDisplayScope = useSwitchModelDisplayScope();
    const modeSyncAgentRef = useRef<string | undefined>(undefined);
    const previousModeRef = useRef<HomeMode | undefined>(undefined);
    const { isPreferenceLoading, requestedAgentModeEnabled } = useEffectiveAgentMode(agentId ?? '');
    const desiredAgentMode = mode === 'agent';
    const isConversationMode = mode === 'chat' || mode === 'agent';
    const modelDisplayScope = mode === 'chat' ? 'chat' : 'agent';

    const handleSend = useCallback<SendButtonHandler>(
      async (params) => {
        if (mode === 'task') {
          const modelApplied = await switchModelDisplayScope('agent');
          if (!modelApplied) return;
        }
        if (isConversationMode && requestedAgentModeEnabled !== desiredAgentMode) {
          const applied = await toggleAgentMode(desiredAgentMode);
          if (!applied) return;
        }
        await send(params);
      },
      [
        desiredAgentMode,
        isConversationMode,
        mode,
        requestedAgentModeEnabled,
        send,
        switchModelDisplayScope,
        toggleAgentMode,
      ],
    );

    sendHandlerRef.current = handleSend;

    // Home exposes Chat and Agent as explicit conversation intents. Keep the
    // selected Agent in sync before the first send so the runtime and the page
    // users land on cannot disagree about the chosen mode.
    useEffect(() => {
      const syncKey = agentId ? `${agentId}:${desiredAgentMode ? 'agent' : 'chat'}` : undefined;
      if (
        !isConversationMode ||
        !agentId ||
        isAgentConfigLoading ||
        isPreferenceLoading ||
        requestedAgentModeEnabled === desiredAgentMode ||
        modeSyncAgentRef.current === syncKey
      )
        return;

      modeSyncAgentRef.current = syncKey;
      void toggleAgentMode(desiredAgentMode)
        .then((applied) => {
          if (!applied) modeSyncAgentRef.current = undefined;
        })
        .catch(() => {
          modeSyncAgentRef.current = undefined;
        });
    }, [
      agentId,
      desiredAgentMode,
      isAgentConfigLoading,
      isConversationMode,
      isPreferenceLoading,
      requestedAgentModeEnabled,
      toggleAgentMode,
    ]);

    // Task is an autonomous Agent-runtime surface but does not toggle the
    // user's Agent-mode preference. Resolve its model against the Agent pool,
    // then restore the Chat pool when returning to Chat. The send guard above
    // repeats the Task check so a fast submit cannot snapshot the old model.
    useEffect(() => {
      const previousMode = previousModeRef.current;
      previousModeRef.current = mode;
      const shouldSyncScope = mode === 'task' || (previousMode === 'task' && mode === 'chat');
      if (!shouldSyncScope || !agentId || isAgentConfigLoading) return;

      void switchModelDisplayScope(modelDisplayScope).catch((error) => {
        console.error('[HomeEditorInput] Failed to switch the model display scope', error);
      });
    }, [agentId, isAgentConfigLoading, mode, modelDisplayScope, switchModelDisplayScope]);

    const inputContainerProps = useMemo(
      () => ({
        minHeight: HOME_INPUT_BODY_HEIGHT,
        resize: false,
        style: {
          borderRadius: CONTAINER_RADIUS,
          boxShadow: '0 1px 2px rgba(0,0,0,.03), 0 12px 32px rgba(0,0,0,.04)',
        },
      }),
      [],
    );

    const actionBarStyle = useMemo(
      () => ({
        paddingBlockEnd: ACTION_BAR_INSET,
        paddingInline: ACTION_BAR_INSET,
      }),
      [],
    );

    return (
      <DesktopChatInput
        actionBarStyle={actionBarStyle}
        dropdownPlacement="bottomLeft"
        initialContent={initialValue}
        inputContainerProps={inputContainerProps}
        placeholder={placeholder}
        showControlBar={false}
        leftContent={
          <Flexbox horizontal align={'center'} gap={2}>
            <ModeSelect value={mode} onChange={onModeChange} />
            {mode === 'task' ? null : isAgentConfigLoading ? (
              <ActionIcon disabled icon={PlusIcon} size={'small'} />
            ) : (
              <ActionBar disableCollapse dropdownPlacement="bottomLeft" />
            )}
          </Flexbox>
        }
      />
    );
  },
);

HomeEditorContent.displayName = 'HomeEditorContent';

const HomeEditorInput = memo<HomeEditorInputProps>((props) => {
  const sendHandlerRef = useRef<SendButtonHandler>(props.send);
  const handleSend = useCallback<SendButtonHandler>((params) => sendHandlerRef.current(params), []);

  return (
    <ChatInputProvider
      agentId={props.agentId}
      allowExpand={false}
      contextSelectionKey={props.contextSelectionKey}
      leftActions={leftActions}
      modelDisplayScope={props.mode === 'chat' ? 'chat' : 'agent'}
      rightActions={rightActions}
      slashPlacement="bottom"
      topicModelScope={false}
      chatInputEditorRef={(instance) => {
        if (!instance) return;
        useChatStore.setState({ mainInputEditor: instance });
      }}
      sendButtonProps={{
        disabled: props.loading || props.isAgentConfigLoading,
        generating: props.loading,
        onStop: () => {},
        shape: 'round',
      }}
      onMarkdownContentChange={props.onValueChange}
      onSend={handleSend}
    >
      <HomeEditorContent {...props} sendHandlerRef={sendHandlerRef} />
    </ChatInputProvider>
  );
});

HomeEditorInput.displayName = 'HomeEditorInput';

export default HomeEditorInput;
