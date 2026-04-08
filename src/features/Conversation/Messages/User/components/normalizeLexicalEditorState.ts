import type { SerializedEditorState } from 'lexical';

type SerializedNodeLike = {
  actionLabel?: unknown;
  children?: unknown;
  text?: unknown;
  topicTitle?: unknown;
  type?: unknown;
} & Record<string, unknown>;

const CUSTOM_INLINE_TEXT_NODE_TYPES = new Set(['action-tag', 'refer-topic']);

const toPlainTextNode = (text: string): SerializedNodeLike => ({
  text,
  type: 'text',
});

const normalizeNode = (value: unknown): SerializedNodeLike | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const node = value as SerializedNodeLike;
  const type = typeof node.type === 'string' ? node.type : undefined;

  if (!type) return null;

  if (CUSTOM_INLINE_TEXT_NODE_TYPES.has(type)) {
    const fallbackText =
      type === 'action-tag'
        ? typeof node.actionLabel === 'string'
          ? node.actionLabel
          : ''
        : typeof node.topicTitle === 'string'
          ? node.topicTitle
          : '';

    return toPlainTextNode(fallbackText);
  }

  const normalizedNode: SerializedNodeLike = { ...node, type };

  if (Array.isArray(node.children)) {
    normalizedNode.children = node.children
      .map((child) => normalizeNode(child))
      .filter((child): child is SerializedNodeLike => child !== null);
  }

  return normalizedNode;
};

export const normalizeLexicalEditorState = (
  editorState: unknown,
): SerializedEditorState | null => {
  if (!editorState || typeof editorState !== 'object' || Array.isArray(editorState)) return null;
  if (Object.keys(editorState as Record<string, unknown>).length === 0) return null;

  const state = editorState as Record<string, unknown>;
  const root = normalizeNode(state.root);

  if (!root || root.type !== 'root') return null;

  return {
    ...state,
    root,
  } as SerializedEditorState;
};
