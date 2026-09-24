import { describe, expect, it } from 'vitest';

import {
  classifyLLMError,
  createLLMErrorClassifier,
  type LLMErrorCodeSpecLike,
} from './llmErrorClassifier';

const specsByCode: Record<string, LLMErrorCodeSpecLike> = {
  AgentRuntimeError: { code: 'AgentRuntimeError', retryable: false },
  ExceededToolLimit: { code: 'ExceededToolLimit', retryable: false },
  InvalidProviderAPIKey: { code: 'InvalidProviderAPIKey', retryable: false },
  ProviderContentPolicyViolation: {
    code: 'ProviderContentPolicyViolation',
    retryable: false,
  },
  RateLimitExceeded: { code: 'RateLimitExceeded', retryable: true },
};

const classifyWithSpecs = createLLMErrorClassifier({
  errorCodeSpecs: Object.values(specsByCode),
  getErrorCodeSpec: (code) =>
    code === 'QuotaLimitReached' ? specsByCode.RateLimitExceeded : specsByCode[code],
});

describe('llmErrorClassifier', () => {
  it('classifies error types from an injected spec table', () => {
    expect(
      classifyWithSpecs({ errorType: 'RateLimitExceeded', message: 'tokens per minute' }).kind,
    ).toBe('retry');
    expect(
      classifyWithSpecs({ errorType: 'ExceededToolLimit', message: 'tools exceeded' }).kind,
    ).toBe('stop');
    expect(
      classifyWithSpecs({ errorType: 'InvalidProviderAPIKey', message: 'key rejected' }).kind,
    ).toBe('stop');
  });

  it('resolves deprecated aliases through the injected spec lookup', () => {
    expect(
      classifyWithSpecs({ errorType: 'QuotaLimitReached', message: 'legacy rate limit' }).kind,
    ).toBe('retry');
  });

  it('keeps runtime retry overrides ahead of non-retryable specs', () => {
    expect(
      classifyWithSpecs({ errorType: 'AgentRuntimeError', message: 'fallback runtime error' }).kind,
    ).toBe('retry');
  });

  it('stops ProviderBizError invalid request shapes but retries transient ones', () => {
    expect(
      classifyWithSpecs({
        error: {
          error: {
            message: 'tools.0.custom.input_schema: Field required',
            type: 'invalid_request_error',
          },
          errorType: 'ProviderBizError',
        },
        errorType: 'ProviderBizError',
      }).kind,
    ).toBe('stop');

    expect(
      classifyWithSpecs({
        error: { message: '429 rate limit exceeded' },
        errorType: 'ProviderBizError',
      }).kind,
    ).toBe('retry');
  });

  it('stops ProviderContentPolicyViolation instead of retrying content blocks', () => {
    expect(
      classifyWithSpecs({
        body: {
          context: { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } },
          message: 'The content may contain prohibited content. Please adjust it and try again.',
          provider: 'google',
        },
        errorType: 'ProviderContentPolicyViolation',
        message: 'The content may contain prohibited content. Please adjust it and try again.',
        type: 'ProviderContentPolicyViolation',
      }).kind,
    ).toBe('stop');
  });

  it('falls back to numeric status and keyword classification without injected specs', () => {
    expect(classifyLLMError({ code: 401, message: 'upstream refused' }).kind).toBe('stop');
    expect(classifyLLMError({ code: 429, message: 'upstream refused' }).kind).toBe('retry');
    expect(classifyLLMError(new Error('unexpected upstream issue')).kind).toBe('retry');
  });

  it('preserves a valid result when provider error shapes contain non-string fields', () => {
    expect(
      classifyWithSpecs({ errorType: { nested: 'structured' }, message: 'structured type' }),
    ).toEqual({
      kind: 'retry',
      message: 'structured type',
    });

    expect(
      classifyWithSpecs({
        error: { error: { code: 401, message: 'proxy refused upstream' } },
      }).kind,
    ).toBe('stop');
  });
});

describe('numeric runtime HTTP error types', () => {
  it.each([400, 403])('stops a local policy rejection with errorType %s', (errorType) => {
    const error = { errorType, error: { code: 'TOPIC_COST_FROZEN', message: '话题已冻结' } };
    expect(classifyLLMError(error).kind).toBe('stop');
    // Browser fetch errors carry the HTTP number as `type`, rather than `errorType`.
    expect(classifyLLMError({ type: errorType, body: error.error }).kind).toBe('stop');
    expect(classifyLLMError({ error }).kind).toBe('stop');
    expect(classifyLLMError(Object.assign(new Error('话题已冻结'), { errorType })).kind).toBe(
      'stop',
    );
  });

  it('still retries numeric rate limits', () => {
    expect(classifyLLMError({ errorType: 429, error: { message: '稍后重试' } }).kind).toBe('retry');
  });
});
