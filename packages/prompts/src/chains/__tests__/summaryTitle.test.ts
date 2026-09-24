import type { OpenAIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  chainSummaryTitle,
  TOPIC_METADATA_JSON_SCHEMA,
  TOPIC_TITLE_JSON_SCHEMA,
  TOPIC_TITLE_PROMPT_VERSION,
} from '../summaryTitle';

describe('chainSummaryTitle', () => {
  it('bounds naming input and adds description without another conversation payload', () => {
    const messages: OpenAIChatMessage[] = Array.from({ length: 100 }, () => ({
      role: 'user',
      content: 'x'.repeat(5000),
    }));
    const payload = chainSummaryTitle(messages, 'zh-CN', true);
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[1].content.length).toBeLessThan(8300);
    expect(payload.messages[0].content).toContain('title and description');
    expect(TOPIC_METADATA_JSON_SCHEMA.schema.required).toEqual(['title', 'description']);
  });

  it('should use the default model if the token count is below the GPT-3.5 limit', async () => {
    // Arrange
    const messages: OpenAIChatMessage[] = [
      { content: 'Hello, how can I assist you?', role: 'assistant' },
      { content: 'I need help with my account.', role: 'user' },
    ];
    const currentLanguage = 'en-US';

    // Act
    const result = chainSummaryTitle(messages, currentLanguage);

    // Assert
    expect(result).toMatchSnapshot();
    expect(TOPIC_TITLE_PROMPT_VERSION).toBe('v1');
    expect(TOPIC_TITLE_JSON_SCHEMA.name).toBe('topic_title');
  });
});
