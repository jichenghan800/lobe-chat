import { LexicalRenderer } from '@lobehub/editor/renderer';
import type { CSSProperties } from 'react';
import { memo, useMemo } from 'react';

import { normalizeLexicalEditorState } from './normalizeLexicalEditorState';

interface RichTextMessageProps {
  editorState: unknown;
}

const LINE_HEIGHT = 1.6;
const style: CSSProperties = { '--common-line-height': LINE_HEIGHT } as CSSProperties;

const RichTextMessage = memo<RichTextMessageProps>(({ editorState }) => {
  const value = useMemo(() => {
    // Chat message rendering uses @lobehub/editor's Lexical runtime, which may be a
    // different Lexical instance than the app-side custom nodes used by the input editor.
    // Normalize injected custom nodes to plain text here to avoid cross-version crashes.
    return normalizeLexicalEditorState(editorState);
  }, [editorState]);

  if (!value) return null;

  return <LexicalRenderer style={style} value={value} variant="chat" />;
});

RichTextMessage.displayName = 'RichTextMessage';

export default RichTextMessage;
