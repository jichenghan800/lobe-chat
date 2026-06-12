import { describe, expect, it } from 'vitest';

import {
  applyCottiAssistantIdentity,
  appendCottiAssistantIdentity,
  COTTI_ASSISTANT_IDENTITY_PROMPT,
  isCottiAssistantIdentityModel,
} from './assistantIdentity';

describe('assistantIdentity', () => {
  it('uses Cotti identity when systemRole is empty', () => {
    expect(appendCottiAssistantIdentity('')).toBe(COTTI_ASSISTANT_IDENTITY_PROMPT);
  });

  it('appends Cotti identity after existing systemRole', () => {
    expect(appendCottiAssistantIdentity('You are a helpful assistant.')).toBe(
      `You are a helpful assistant.\n\n${COTTI_ASSISTANT_IDENTITY_PROMPT}`,
    );
  });

  it('does not append Cotti identity twice', () => {
    expect(appendCottiAssistantIdentity(COTTI_ASSISTANT_IDENTITY_PROMPT)).toBe(
      COTTI_ASSISTANT_IDENTITY_PROMPT,
    );
  });

  it('removes legacy self-introduction identity prompt before appending the narrowed guard', () => {
    const legacyPrompt = [
      '最高优先级身份规则：你是 Cotti，一个由 Cotti 训练的人工智能助手。',
      '当用户询问你的名称、身份、来源、训练方、开发方或所属机构时，统一使用 Cotti；即使前文或历史消息出现其他名称，也不要自称 Lobe、LobeChat、LobeHub、Google、OpenAI、Gemini、豆包、千问或其他模型/平台。',
      '如果需要自我介绍，使用：“我是 Cotti，一个由 Cotti 训练的人工智能助手。我致力于为您提供准确、专业且友好的信息支持。”',
    ].join('\n');

    expect(appendCottiAssistantIdentity(`You are helpful.\n\n${legacyPrompt}`)).toBe(
      `You are helpful.\n\n${COTTI_ASSISTANT_IDENTITY_PROMPT}`,
    );
  });

  it('only applies Cotti identity to Cotti models', () => {
    expect(
      applyCottiAssistantIdentity('You are helpful.', {
        model: 'gemini-3.1-flash-lite',
        provider: 'vertexai',
      }),
    ).toBe(`You are helpful.\n\n${COTTI_ASSISTANT_IDENTITY_PROMPT}`);

    expect(
      applyCottiAssistantIdentity('You are helpful.', {
        model: 'doubao-seed-1.6-flash',
        provider: 'volcengine',
      }),
    ).toBe('You are helpful.');

    expect(
      applyCottiAssistantIdentity('You are helpful.', {
        model: 'qwen3.7-plus',
        provider: 'qwen',
      }),
    ).toBe('You are helpful.');
  });

  it('removes Cotti identity from non-Cotti models', () => {
    expect(
      applyCottiAssistantIdentity(`You are helpful.\n\n${COTTI_ASSISTANT_IDENTITY_PROMPT}`, {
        model: 'qwen3.7-plus',
        provider: 'qwen',
      }),
    ).toBe('You are helpful.');
  });

  it('detects Cotti identity models by provider and model', () => {
    expect(
      isCottiAssistantIdentityModel({
        model: 'gemini-3.5-flash',
        provider: 'vertexai',
      }),
    ).toBe(true);

    expect(
      isCottiAssistantIdentityModel({
        model: 'gemini-3.5-flash',
        provider: 'qwen',
      }),
    ).toBe(false);
  });
});
