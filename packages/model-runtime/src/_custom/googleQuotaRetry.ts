import { AgentRuntimeErrorType } from '../types/error';
import { parseGoogleErrorMessage } from '../utils/googleErrorParser';

const QUOTA_RETRY_LIMIT = 3;
const QUOTA_RETRY_BASE_DELAY_MS = 1000;

type Logger = (message: string, ...args: unknown[]) => void;

interface QuotaRetryOptions {
  isAbortError?: (error: Error) => boolean;
  label?: string;
  logger?: Logger;
  signal?: AbortSignal;
}

const getBackoffDelay = (attempt: number) => {
  const baseDelay = QUOTA_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitterMultiplier = 0.5 + Math.random();
  return Math.round(baseDelay * jitterMultiplier);
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (!signal) {
      setTimeout(resolve, ms);
      return;
    }

    if (signal.aborted) {
      const abortError = new Error('Request was aborted');
      abortError.name = 'AbortError';
      reject(abortError);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      const abortError = new Error('Request was aborted');
      abortError.name = 'AbortError';
      reject(abortError);
    };

    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort);
  });

const isDefaultAbortError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return (
    message.includes('aborted') ||
    message.includes('cancelled') ||
    message.includes('abort') ||
    error.name === 'AbortError'
  );
};

const isQuotaLimitError = (error: Error): boolean => {
  const anyError = error as Error & {
    code?: number | string;
    response?: { status?: number };
    status?: number;
    statusCode?: number;
  };

  if (anyError.status === 429 || anyError.statusCode === 429) return true;
  if (anyError.response?.status === 429) return true;
  if (anyError.code === 429 || anyError.code === '429') return true;

  if (typeof error.message === 'string' && error.message) {
    const { errorType } = parseGoogleErrorMessage(error.message);
    return errorType === AgentRuntimeErrorType.QuotaLimitReached;
  }

  return false;
};

export const requestWithQuotaRetry = async <T>(
  action: () => Promise<T>,
  options: QuotaRetryOptions = {},
): Promise<T> => {
  const { isAbortError = isDefaultAbortError, label, logger, signal } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= QUOTA_RETRY_LIMIT; attempt++) {
    try {
      return await action();
    } catch (error) {
      const err = error as Error;
      lastError = err;

      if (isAbortError(err)) throw err;

      if (!isQuotaLimitError(err) || attempt === QUOTA_RETRY_LIMIT) {
        throw err;
      }

      const retryCount = attempt + 1;
      const delayMs = getBackoffDelay(retryCount);

      if (logger) {
        logger(
          '%s quota limit reached, retrying in %dms (attempt %d/%d)',
          label || 'request',
          delayMs,
          retryCount,
          QUOTA_RETRY_LIMIT,
        );
      }

      await sleep(delayMs, signal);
    }
  }

  throw lastError || new Error('Request failed after retries');
};
