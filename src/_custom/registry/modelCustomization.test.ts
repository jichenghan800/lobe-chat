import { describe, expect, it } from 'vitest';

import { getThinkingLevel3Default, resolveModelDetailDescription } from './modelCustomization';

describe('modelCustomization', () => {
  describe('getThinkingLevel3Default', () => {
    it('returns low as default thinking level', () => {
      expect(getThinkingLevel3Default()).toBe('low');
    });
  });

  describe('resolveModelDetailDescription', () => {
    it('keeps localized fallback description when available', () => {
      const result = resolveModelDetailDescription({
        fallbackDescription: '这是本地化描述',
        modelDescription: 'English runtime description',
        modelId: 'gemini-3.1-pro-preview',
      });

      expect(result).toBe('这是本地化描述');
    });

    it('falls back to runtime description when i18n key is unresolved', () => {
      const result = resolveModelDetailDescription({
        fallbackDescription: 'gemini-3.1-pro-preview.description',
        modelDescription: 'English runtime description',
        modelId: 'gemini-3.1-pro-preview',
      });

      expect(result).toBe('English runtime description');
    });
  });
});
