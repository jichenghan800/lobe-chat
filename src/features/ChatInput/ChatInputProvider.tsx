import { useEditor } from '@lobehub/editor/react';
import type { ReactNode } from 'react';
import { memo, useRef } from 'react';

import ReasoningConfigLoader from './ReasoningConfigLoader';
import { createStore, Provider } from './store';
import { DEFAULT_CHAT_INPUT_FEATURE } from './store/initialState';
import type { StoreUpdaterProps } from './StoreUpdater';
import StoreUpdater from './StoreUpdater';
import { TopicCostFreezeLoader } from './TopicCostFreezeLoader';
import { useEditorRootLifecycle } from './useEditorRootLifecycle';

interface ChatInputProviderProps extends StoreUpdaterProps {
  children: ReactNode;
}

export const ChatInputProvider = memo<ChatInputProviderProps>(
  ({
    modelDisplayScope,
    agentId,
    canRecordVoiceMessage,
    children,
    contextSelectionKey,
    contextWindowMessages,
    draftKey,
    feature = DEFAULT_CHAT_INPUT_FEATURE,
    leftActions,
    rightActions,
    mobile,
    sendButtonProps,
    onSend,
    onVoiceMessageSend,
    sendMenu,
    chatInputEditorRef,
    onMarkdownContentChange,
    mentionItems,
    allowExpand = true,
    topicModelScope = true,
    slashPlacement,
    getMessages,
    resolveSendBlocked,
  }) => {
    const editor = useEditor();
    const slashMenuRef = useRef<HTMLDivElement>(null);
    useEditorRootLifecycle(editor);

    return (
      <Provider
        createStore={() =>
          createStore({
            modelDisplayScope,
            allowExpand,
            topicModelScope,
            canRecordVoiceMessage,
            contextSelectionKey,
            contextWindowMessages,
            draftKey,
            editor,
            feature,
            leftActions,
            mentionItems,
            mobile,
            rightActions,
            onVoiceMessageSend,
            sendButtonProps,
            sendMenu,
            slashMenuRef,
            slashPlacement,
          })
        }
      >
        <StoreUpdater
          agentId={agentId}
          allowExpand={allowExpand}
          canRecordVoiceMessage={canRecordVoiceMessage}
          chatInputEditorRef={chatInputEditorRef}
          contextSelectionKey={contextSelectionKey}
          contextWindowMessages={contextWindowMessages}
          draftKey={draftKey}
          feature={feature}
          getMessages={getMessages}
          leftActions={leftActions}
          mentionItems={mentionItems}
          mobile={mobile}
          modelDisplayScope={modelDisplayScope}
          resolveSendBlocked={resolveSendBlocked}
          rightActions={rightActions}
          sendButtonProps={sendButtonProps}
          sendMenu={sendMenu}
          slashPlacement={slashPlacement}
          topicModelScope={topicModelScope}
          onMarkdownContentChange={onMarkdownContentChange}
          onSend={onSend}
          onVoiceMessageSend={onVoiceMessageSend}
        />
        <ReasoningConfigLoader />
        <TopicCostFreezeLoader />
        {children}
      </Provider>
    );
  },
);
