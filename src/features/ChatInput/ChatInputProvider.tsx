import { useEditor } from '@lobehub/editor/react';
import { type ReactNode } from 'react';
import { memo, useRef } from 'react';

import { createStore, Provider } from './store';
import { DEFAULT_CHAT_INPUT_FEATURE } from './store/initialState';
import { type StoreUpdaterProps } from './StoreUpdater';
import StoreUpdater from './StoreUpdater';

interface ChatInputProviderProps extends StoreUpdaterProps {
  children: ReactNode;
}

export const ChatInputProvider = memo<ChatInputProviderProps>(
  ({
    agentId,
    children,
    contextWindowMessages,
    draftKey,
    feature = DEFAULT_CHAT_INPUT_FEATURE,
    leftActions,
    modelDisplayScope,
    rightActions,
    mobile,
    sendButtonProps,
    onSend,
    sendMenu,
    chatInputEditorRef,
    onMarkdownContentChange,
    mentionItems,
    allowExpand = true,
    slashPlacement,
    topicModelScope = true,
    getMessages,
  }) => {
    const editor = useEditor();
    const slashMenuRef = useRef<HTMLDivElement>(null);

    return (
      <Provider
        createStore={() =>
          createStore({
            allowExpand,
            contextWindowMessages,
            draftKey,
            editor,
            feature,
            leftActions,
            mentionItems,
            modelDisplayScope,
            mobile,
            rightActions,
            sendButtonProps,
            sendMenu,
            slashMenuRef,
            slashPlacement,
            topicModelScope,
          })
        }
      >
        <StoreUpdater
          agentId={agentId}
          allowExpand={allowExpand}
          chatInputEditorRef={chatInputEditorRef}
          contextWindowMessages={contextWindowMessages}
          draftKey={draftKey}
          feature={feature}
          getMessages={getMessages}
          leftActions={leftActions}
          mentionItems={mentionItems}
          mobile={mobile}
          modelDisplayScope={modelDisplayScope}
          rightActions={rightActions}
          sendButtonProps={sendButtonProps}
          sendMenu={sendMenu}
          slashPlacement={slashPlacement}
          topicModelScope={topicModelScope}
          onMarkdownContentChange={onMarkdownContentChange}
          onSend={onSend}
        />
        {children}
      </Provider>
    );
  },
);
