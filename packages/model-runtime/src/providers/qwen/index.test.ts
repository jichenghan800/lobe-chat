// @vitest-environment node
import { ModelProvider } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeOpenAICompatibleRuntime } from '../../core/BaseAI';
import { testProvider } from '../../providerTestUtils';
import { LobeQwenAI, params } from './index';

// Avoid pulling the real business model-config module (it may resolve to a
// server-only implementation under pnpm overrides)
vi.mock('@lobechat/business-model-bank/model-config', () => ({
  loadModels: vi.fn().mockResolvedValue([]),
}));

const provider = ModelProvider.Qwen;
const defaultBaseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

testProvider({
  Runtime: LobeQwenAI,
  provider,
  defaultBaseURL,
  chatDebugEnv: 'DEBUG_QWEN_CHAT_COMPLETION',
  chatModel: 'qwen-2.5',
  test: {
    skipAPICall: true,
  },
});

let instance: LobeOpenAICompatibleRuntime;

beforeEach(() => {
  instance = new LobeQwenAI({ apiKey: 'test' });

  vi.spyOn(instance['client'].chat.completions, 'create').mockResolvedValue(
    new ReadableStream() as any,
  );
});

describe('LobeQwenAI - custom features', () => {
  describe('Qwen3.8 Max Responses API', () => {
    it('uses Chat Completions native search with the Max strategy by default', () => {
      const result = params.chatCompletion!.handlePayload!({
        enabledSearch: true,
        messages: [{ content: 'What is new today?', role: 'user' }],
        model: 'qwen3.8-max-0902',
        thinking: { type: 'disabled' },
      } as any);

      expect(result).toMatchObject({
        enable_search: true,
        enable_thinking: true,
        search_options: { search_strategy: 'max' },
      });
      expect(result.apiMode).toBeUndefined();
    });

    it('maps the search switch to the Responses web_search tool and enables thinking', () => {
      const result = params.responses!.handlePayload!({
        enabledSearch: true,
        messages: [{ content: 'What is new today?', role: 'user' }],
        model: 'qwen3.8-max-0902',
        thinking: { type: 'disabled' },
        tools: [
          {
            function: { description: 'Get weather', name: 'get_weather', parameters: {} },
            type: 'function',
          },
        ],
      } as any);

      expect(result).toMatchObject({
        enable_thinking: true,
        model: 'qwen3.8-max-0902',
        tools: [expect.objectContaining({ type: 'function' }), { type: 'web_search' }],
      });
      expect(result.enabledSearch).toBeUndefined();
      expect(result.thinking).toBeUndefined();
    });
  });

  describe('prompt_cache_key', () => {
    it('should not inject Moonshot prompt_cache_key for Kimi model ids', async () => {
      await instance.chat(
        {
          messages: [{ content: 'Hello', role: 'user' }],
          model: 'kimi-k2.6',
        },
        { user: 'user-abc' },
      );

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.prompt_cache_key).toBeUndefined();
    });
  });

  describe('thinking payload mapping', () => {
    it('should forward enable_thinking and reasoning_effort for deepseek-v4 models', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'deepseek-v4-pro',
        reasoning_effort: 'high',
        thinking: {
          budget_tokens: 2048,
          type: 'enabled',
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBe(true);
      expect(calledPayload.reasoning_effort).toBe('high');
      expect(calledPayload.thinking_budget).toBeUndefined();
    });

    it('should remove reasoning_effort when deepseek-v4 thinking is disabled', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'deepseek-v4-flash',
        reasoning_effort: 'high',
        thinking: {
          budget_tokens: 2048,
          type: 'disabled',
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBe(false);
      expect(calledPayload.reasoning_effort).toBeUndefined();
      expect(calledPayload.thinking_budget).toBeUndefined();
    });

    it('should only send thinking_budget for budget-only non-thinking models', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'deepseek-r1-0528',
        thinking: {
          budget_tokens: 2048,
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBeUndefined();
      expect(calledPayload.thinking_budget).toBe(2048);
    });

    it('should force enable_thinking even when thinking is disabled for thinking-forced models', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'qwen3.8-max-preview',
        thinking: {
          budget_tokens: 0,
          type: 'disabled',
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBe(true);
      expect(calledPayload.thinking_budget).toBeUndefined();
    });

    it('should keep GLM-5.3 thinking enabled and forward its supported reasoning effort', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'ZHIPU/GLM-5.3',
        reasoning_effort: 'low',
        thinking: {
          budget_tokens: 0,
          type: 'disabled',
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBe(true);
      expect(calledPayload.reasoning_effort).toBe('low');
      expect(calledPayload.thinking_budget).toBeUndefined();
    });

    it('should keep thinking_budget for thinking-forced models when thinking is enabled', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'qwen3.8-max-preview',
        thinking: {
          budget_tokens: 4096,
          type: 'enabled',
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBe(true);
      expect(calledPayload.thinking_budget).toBe(4096);
    });

    it('should still force enable_thinking for dedicated thinking models', async () => {
      await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'qwen3-235b-a22b-thinking-2507',
        thinking: {
          budget_tokens: 4096,
        },
      });

      const calledPayload = (instance['client'].chat.completions.create as any).mock.calls[0][0];

      expect(calledPayload.enable_thinking).toBe(true);
      expect(calledPayload.thinking_budget).toBe(4096);
    });
  });

  describe('preserve thinking mapping', () => {
    it('should map preserveThinking to preserve_thinking for qwen3.6-plus', () => {
      const payload = {
        messages: [
          { content: 'hello', role: 'user' },
          {
            content: 'answer',
            reasoning: { content: 'reasoning content' },
            role: 'assistant',
          },
        ],
        model: 'qwen3.6-plus',
        preserveThinking: true,
      } as any;

      const result = params.chatCompletion!.handlePayload!(payload);

      expect(result.preserve_thinking).toBe(true);
      expect(result.messages).toEqual([
        { content: 'hello', role: 'user' },
        {
          content: 'answer',
          reasoning_content: 'reasoning content',
          role: 'assistant',
        },
      ]);
    });

    it('should set preserve_thinking=false when explicitly disabled on supported model', () => {
      const payload = {
        messages: [{ content: 'hello', role: 'user' }],
        model: 'qwen3.6-plus',
        preserveThinking: false,
      } as any;

      const result = params.chatCompletion!.handlePayload!(payload);

      expect(result.preserve_thinking).toBe(false);
    });

    it('should map preserveThinking for deployment-name aliases when caller provides the param', () => {
      const payload = {
        messages: [
          {
            content: 'answer',
            reasoning: { content: 'reasoning content' },
            role: 'assistant',
          },
        ],
        model: 'my-qwen3.6-plus-deployment',
        preserveThinking: true,
      } as any;

      const result = params.chatCompletion!.handlePayload!(payload);

      expect(result.preserve_thinking).toBe(true);
      expect(result.messages).toEqual([
        {
          content: 'answer',
          reasoning_content: 'reasoning content',
          role: 'assistant',
        },
      ]);
    });

    it('should not set preserve_thinking when preserveThinking is absent but still keep reasoning_content', () => {
      const payload = {
        messages: [
          {
            content: 'answer',
            reasoning: { content: 'reasoning content' },
            role: 'assistant',
          },
        ],
        model: 'qwen3.5-plus',
      } as any;

      const result = params.chatCompletion!.handlePayload!(payload);

      expect(result.preserve_thinking).toBeUndefined();
      expect(result.messages).toEqual([
        {
          content: 'answer',
          reasoning_content: 'reasoning content',
          role: 'assistant',
        },
      ]);
    });

    it('should keep caller-provided reasoning_content', () => {
      const payload = {
        messages: [
          {
            content: 'answer',
            reasoning_content: 'existing reasoning content',
            role: 'assistant',
          },
        ],
        model: 'qwen3.5-plus',
      } as any;

      const result = params.chatCompletion!.handlePayload!(payload);

      expect(result.messages).toEqual([
        {
          content: 'answer',
          reasoning_content: 'existing reasoning content',
          role: 'assistant',
        },
      ]);
    });
  });
});
