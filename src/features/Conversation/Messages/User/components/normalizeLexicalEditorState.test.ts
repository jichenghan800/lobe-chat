import { describe, expect, it } from 'vitest';

import { normalizeLexicalEditorState } from './normalizeLexicalEditorState';

describe('normalizeLexicalEditorState', () => {
  it('should return null for invalid editor state', () => {
    expect(normalizeLexicalEditorState(null)).toBeNull();
    expect(normalizeLexicalEditorState({})).toBeNull();
    expect(normalizeLexicalEditorState([])).toBeNull();
  });

  it('should convert action-tag nodes into plain text nodes', () => {
    const result = normalizeLexicalEditorState({
      root: {
        children: [
          {
            children: [
              {
                actionCategory: 'skill',
                actionLabel: 'Translate',
                actionType: 'translate',
                type: 'action-tag',
              },
            ],
            type: 'paragraph',
          },
        ],
        type: 'root',
      },
    });

    expect(result?.root.children[0].children[0]).toEqual({
      text: 'Translate',
      type: 'text',
    });
  });

  it('should convert refer-topic nodes into plain text nodes', () => {
    const result = normalizeLexicalEditorState({
      root: {
        children: [
          {
            children: [
              {
                topicId: 'topic-1',
                topicTitle: 'Weekly Sync',
                type: 'refer-topic',
              },
            ],
            type: 'paragraph',
          },
        ],
        type: 'root',
      },
    });

    expect(result?.root.children[0].children[0]).toEqual({
      text: 'Weekly Sync',
      type: 'text',
    });
  });

  it('should keep built-in lexical nodes unchanged', () => {
    const source = {
      root: {
        children: [
          {
            children: [{ text: 'hello', type: 'text' }],
            type: 'paragraph',
          },
        ],
        type: 'root',
      },
    };

    expect(normalizeLexicalEditorState(source)).toEqual(source);
  });
});
