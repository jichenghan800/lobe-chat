import { BRANDING_PROVIDER } from '@lobechat/business-const';
import { type ChatCompletionErrorPayload } from '@lobechat/model-runtime';
import { AGENT_RUNTIME_ERROR_SET } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { classifyLLMError } from '@/server/modules/AgentRuntime/llmErrorClassification';
import { createTraceOptions, initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { type ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

const CHAT_LLM_MAX_RETRIES = 2;
const CHAT_LLM_RETRY_BASE_DELAY_MS = 1000;
const CHAT_LLM_RETRY_MAX_DELAY_MS = 10_000;
const CHAT_LLM_RETRY_KEYWORDS = [
  '429',
  'connection',
  'econn',
  'network',
  'rate limit',
  'timeout',
  'timed out',
  'temporarily unavailable',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
};

const findString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
};

const getHeader = (headers: unknown, name: string): string | null => {
  if (!headers || typeof headers !== 'object') return null;

  const headersLike = headers as {
    get?: (key: string) => string | null | undefined;
    [key: string]: unknown;
  };
  const value = headersLike.get?.(name) ?? headersLike.get?.(name.toLowerCase());
  if (typeof value === 'string') return value;

  const direct = headersLike[name] ?? headersLike[name.toLowerCase()];
  return typeof direct === 'string' ? direct : null;
};

const getErrorSignal = (error: unknown) => {
  if (error instanceof Error) {
    const raw = error as Error & {
      code?: unknown;
      error?: { code?: unknown; message?: unknown; status?: number };
      status?: number;
      statusCode?: number;
    };

    return {
      code: findString(raw.code, raw.error?.code),
      message: findString(raw.message, raw.error?.message) || '',
      status: findNumber(raw.status, raw.statusCode, raw.error?.status, raw.code),
    };
  }

  if (error && typeof error === 'object') {
    const raw = error as {
      code?: unknown;
      error?: { code?: unknown; message?: unknown; status?: number };
      message?: unknown;
      status?: number;
      statusCode?: number;
    };

    return {
      code: findString(raw.code, raw.error?.code),
      message: findString(raw.message, raw.error?.message) || '',
      status: findNumber(raw.status, raw.statusCode, raw.error?.status, raw.code),
    };
  }

  return { message: typeof error === 'string' ? error : '' };
};

const hasExplicitChatRetrySignal = (error: unknown) => {
  const signal = getErrorSignal(error);
  const status = signal.status;

  if (status !== undefined) {
    if (status === 401 || status === 403) return false;
    if (status === 400 || status === 404 || status === 409 || status === 422) return false;
    if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  }

  const text = `${signal.code || ''} ${signal.message}`.toLowerCase();
  return CHAT_LLM_RETRY_KEYWORDS.some((keyword) => text.includes(keyword));
};

const resolveRetryAfterMs = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return;

  const raw = error as {
    error?: { response?: { headers?: unknown } };
    headers?: unknown;
    response?: { headers?: unknown };
  };

  const retryAfter =
    getHeader(raw.headers, 'Retry-After') ||
    getHeader(raw.response?.headers, 'Retry-After') ||
    getHeader(raw.error?.response?.headers, 'Retry-After');

  if (!retryAfter) return;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const dateMs = Date.parse(retryAfter);
  if (Number.isNaN(dateMs)) return;

  return Math.max(dateMs - Date.now(), 0);
};

const getChatRetryDelayMs = (attempt: number, error: unknown) => {
  const retryAfterMs = resolveRetryAfterMs(error);
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, CHAT_LLM_RETRY_MAX_DELAY_MS);

  const exponentialDelay = CHAT_LLM_RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exponentialDelay + jitter, CHAT_LLM_RETRY_MAX_DELAY_MS);
};

const chatWithRetry = async (
  execute: () => Promise<Response>,
  {
    model,
    provider,
    signal,
  }: {
    model?: string;
    provider: string;
    signal: AbortSignal;
  },
) => {
  const maxRetries = provider === BRANDING_PROVIDER ? 0 : CHAT_LLM_MAX_RETRIES;
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await execute();
    } catch (error) {
      const classified = classifyLLMError(error);

      if (
        signal.aborted ||
        classified.kind !== 'retry' ||
        !hasExplicitChatRetrySignal(error) ||
        attempt > maxRetries
      ) {
        throw error;
      }

      const delayMs = getChatRetryDelayMs(attempt, error);

      console.warn(
        `Route: [${provider}] chat retry ${attempt}/${maxAttempts - 1} for model=${model || 'unknown'} after ${delayMs}ms:`,
        classified.message,
      );

      await sleep(delayMs);
    }
  }

  throw new Error('Chat retry loop exited unexpectedly');
};

// If user don't use fluid compute, will build  failed
// this enforce user to enable fluid compute
export const maxDuration = 300;

export const POST = checkAuth(async (req: Request, { params, userId, serverDB }) => {
  const provider = (await params)!.provider!;

  try {
    // ============  1. init chat model   ============ //
    const modelRuntime = await initModelRuntimeFromDB(serverDB, userId, provider);

    // ============  2. create chat completion   ============ //

    const data = (await req.json()) as ChatStreamPayload;

    const tracePayload = getTracePayload(req);

    let traceOptions = {};
    // If user enable trace
    if (tracePayload?.enabled) {
      traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
    }

    return await chatWithRetry(
      () =>
        modelRuntime.chat(data, {
          user: userId,
          ...traceOptions,
          signal: req.signal,
        }),
      { model: data.model, provider, signal: req.signal },
    );
  } catch (e) {
    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;

    const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
    // track the error at server side
    // eslint-disable-next-line no-console
    console[logMethod](`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
