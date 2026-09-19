import { ChatMessageErrorSchema } from '@lobechat/types';
import superjson from 'superjson';
import { describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';

import { MessageService } from './index';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    message: {
      update: { mutate: vi.fn() },
      createMessage: { mutate: vi.fn() },
      getMessages: { query: vi.fn() },
      removeMessagesByAssistant: { mutate: vi.fn() },
    },
  },
}));

describe('MessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMessages', () => {
    const service = new MessageService();

    it('passes read parameters through without applying client cache policy', async () => {
      vi.mocked(lambdaClient.message.getMessages.query).mockResolvedValue([]);
      const params = {
        agentId: 'agent-1',
        topicId: 'topic-1',
      };

      await service.getMessages(params);

      // The service opts in to file-type works; everything else passes through untouched.
      expect(lambdaClient.message.getMessages.query).toHaveBeenCalledWith({
        ...params,
        includeFileWorks: true,
      });
    });

    it('keeps independent service reads available to strong-consistency callers', async () => {
      vi.mocked(lambdaClient.message.getMessages.query).mockResolvedValue([]);
      const context = { agentId: 'agent-1', topicId: 'topic-1' };

      await Promise.all([service.getMessages(context), service.getMessages(context)]);

      expect(lambdaClient.message.getMessages.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('createMessage', () => {
    const service = new MessageService();

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should pass params directly to lambdaClient', async () => {
      vi.mocked(lambdaClient.message.createMessage.mutate).mockResolvedValue({
        id: 'msg-1',
        messages: [],
      });

      await service.createMessage({
        content: 'test',
        role: 'user',
        agentId: 'agent-123',
      });

      expect(lambdaClient.message.createMessage.mutate).toHaveBeenCalledWith({
        content: 'test',
        role: 'user',
        agentId: 'agent-123',
      });
    });
  });

  describe('removeMessagesByAssistant', () => {
    const service = new MessageService();

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should pass sessionId to lambdaClient', async () => {
      vi.mocked(lambdaClient.message.removeMessagesByAssistant.mutate).mockResolvedValue(
        undefined as any,
      );

      await service.removeMessagesByAssistant('session-123');

      expect(lambdaClient.message.removeMessagesByAssistant.mutate).toHaveBeenCalledWith({
        sessionId: 'session-123',
        topicId: undefined,
      });
    });

    it('should pass sessionId and topicId to lambdaClient', async () => {
      vi.mocked(lambdaClient.message.removeMessagesByAssistant.mutate).mockResolvedValue(
        undefined as any,
      );

      await service.removeMessagesByAssistant('session-123', 'topic-1');

      expect(lambdaClient.message.removeMessagesByAssistant.mutate).toHaveBeenCalledWith({
        sessionId: 'session-123',
        topicId: 'topic-1',
      });
    });
  });
});

describe('message error persistence across the tRPC transport', () => {
  it('preserves a frozen-topic Error instance after real SuperJSON serialization', async () => {
    const service = new MessageService();
    const detail = { code: 'TOPIC_COST_FROZEN', message: '此话题预算不足，已冻结。' };
    const error = Object.assign(new Error('Bad Request'), {
      type: 400 as const,
      body: { error: detail, provider: 'openai' },
    });
    const mutate = vi.mocked(lambdaClient.message.update.mutate);
    mutate.mockImplementationOnce(async (input) => {
      const received = superjson.parse<typeof input>(superjson.stringify(input));
      const persisted = ChatMessageErrorSchema.parse(received.value.error);
      expect(persisted).toMatchObject({
        type: 400,
        message: 'Bad Request',
        body: { error: detail },
      });
      return {} as never;
    });
    await service.updateMessageError('message', error, { topicId: 'topic' });
  });

  it('preserves ordinary error objects and their retry metadata', async () => {
    const service = new MessageService();
    const error = { type: 429 as const, message: 'Try later', retryable: true };
    await service.updateMessageError('message', error);
    const input = vi.mocked(lambdaClient.message.update.mutate).mock.lastCall![0];
    const received = superjson.parse<typeof input>(superjson.stringify(input));
    expect(ChatMessageErrorSchema.parse(received.value.error)).toEqual(error);
  });
});
