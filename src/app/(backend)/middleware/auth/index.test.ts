import { AgentRuntimeError } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { getXorPayload } from '@lobechat/utils/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '@/auth';
import type * as EnvsAuthModule from '@/envs/auth';
import { LOBE_CHAT_AUTH_HEADER } from '@/envs/auth';
import { createErrorResponse } from '@/utils/errorResponse';

import { type RequestHandler } from './index';
import { checkAuth } from './index';
import { checkAuthMethod } from './utils';

vi.mock('@/utils/errorResponse', () => ({
  createErrorResponse: vi.fn(),
}));

vi.mock('./utils', () => ({
  checkAuthMethod: vi.fn(),
}));

vi.mock('@lobechat/utils/server', () => ({
  getXorPayload: vi.fn(),
}));

vi.mock('@/envs/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvsAuthModule>();
  return {
    ...actual,
  };
});

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe('checkAuth', () => {
  const mockHandler: RequestHandler = vi.fn();
  const mockRequest = new Request('https://example.com');
  const mockOptions = { params: Promise.resolve({ provider: 'mock' }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return unauthorized error if no authorization header', async () => {
    await checkAuth(mockHandler)(mockRequest, mockOptions);

    expect(createErrorResponse).toHaveBeenCalledWith(ChatErrorType.Unauthorized, {
      error: AgentRuntimeError.createError(ChatErrorType.Unauthorized),
      provider: 'mock',
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return error response on getJWTPayload error', async () => {
    const mockError = AgentRuntimeError.createError(ChatErrorType.Unauthorized);
    mockRequest.headers.set(LOBE_CHAT_AUTH_HEADER, 'invalid');
    vi.mocked(getXorPayload).mockRejectedValueOnce(mockError);

    await checkAuth(mockHandler)(mockRequest, mockOptions);

    expect(createErrorResponse).toHaveBeenCalledWith(ChatErrorType.Unauthorized, {
      error: mockError,
      provider: 'mock',
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return error response on checkAuthMethod error', async () => {
    const mockError = AgentRuntimeError.createError(ChatErrorType.Unauthorized);
    mockRequest.headers.set(LOBE_CHAT_AUTH_HEADER, 'valid');
    vi.mocked(getXorPayload).mockResolvedValueOnce({});
    vi.mocked(checkAuthMethod).mockImplementationOnce(() => {
      throw mockError;
    });

    await checkAuth(mockHandler)(mockRequest, mockOptions);

    expect(createErrorResponse).toHaveBeenCalledWith(ChatErrorType.Unauthorized, {
      error: mockError,
      provider: 'mock',
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should prefer better-auth session userId when jwt payload userId is missing', async () => {
    const mockResponse = new Response(null, { status: 200 });
    const requestWithAuth = new Request('https://example.com', {
      headers: { [LOBE_CHAT_AUTH_HEADER]: 'valid-token' },
    });

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'session-user-id' },
    } as any);
    vi.mocked(getXorPayload).mockReturnValueOnce({
      apiKey: 'test-api-key',
    });
    vi.mocked(mockHandler).mockResolvedValueOnce(mockResponse);

    await checkAuth(mockHandler)(requestWithAuth, mockOptions);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ userId: 'session-user-id' }),
    );
  });

  it('should return unauthorized when neither session nor jwt payload contains userId', async () => {
    const requestWithAuth = new Request('https://example.com', {
      headers: { [LOBE_CHAT_AUTH_HEADER]: 'valid-token' },
    });

    vi.mocked(getXorPayload).mockReturnValueOnce({});

    await checkAuth(mockHandler)(requestWithAuth, mockOptions);

    expect(createErrorResponse).toHaveBeenCalledWith(ChatErrorType.Unauthorized, {
      error: AgentRuntimeError.createError(ChatErrorType.Unauthorized),
      provider: 'mock',
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
