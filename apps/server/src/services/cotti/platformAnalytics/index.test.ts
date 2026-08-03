// @vitest-environment node
import type { LobeChatDatabase } from '@lobechat/database';
import { messages, topics, users } from '@lobechat/database/schemas';
import { getTestDB } from '@lobechat/database/test-utils';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CottiPlatformAnalyticsService } from './index';

const userIds = [
  'cotti-analytics-user-a',
  'cotti-analytics-user-b',
  'cotti-analytics-user-after-range',
];

describe('CottiPlatformAnalyticsService', () => {
  let db: LobeChatDatabase;

  beforeAll(async () => {
    db = await getTestDB();

    await db.insert(users).values([
      {
        createdAt: new Date('2032-07-01T00:00:00.000Z'),
        email: 'alpha.cotti@example.com',
        fullName: 'Alpha 同事',
        id: userIds[0],
        username: 'alpha-cotti',
      },
      {
        createdAt: new Date('2032-07-31T16:00:00.000Z'),
        email: 'bravo.cotti@example.com',
        fullName: 'Bravo 同事',
        id: userIds[1],
        username: 'bravo-cotti',
      },
      { createdAt: new Date('2032-08-03T16:00:00.000Z'), id: userIds[2] },
    ]);
    await db.insert(topics).values([
      { id: 'cotti-analytics-topic-a', userId: userIds[0] },
      { id: 'cotti-analytics-topic-b', userId: userIds[1] },
    ]);
    await db.insert(messages).values([
      {
        content: 'excluded before range',
        createdAt: new Date('2032-07-31T15:59:59.999Z'),
        id: 'cotti-analytics-message-before',
        role: 'user',
        topicId: 'cotti-analytics-topic-a',
        userId: userIds[0],
      },
      {
        content: 'day one question',
        createdAt: new Date('2032-07-31T16:00:00.000Z'),
        id: 'cotti-analytics-message-user-day-one',
        role: 'user',
        topicId: 'cotti-analytics-topic-a',
        userId: userIds[0],
      },
      {
        content: 'new usage shape',
        createdAt: new Date('2032-07-31T16:01:00.000Z'),
        id: 'cotti-analytics-message-new-usage',
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
        role: 'assistant',
        topicId: 'cotti-analytics-topic-a',
        usage: { cost: 0.02, totalInputTokens: 10, totalOutputTokens: 5, totalTokens: 15 },
        userId: userIds[0],
      },
      {
        content: 'nested legacy usage shape',
        createdAt: new Date('2032-07-31T16:02:00.000Z'),
        id: 'cotti-analytics-message-nested-usage',
        metadata: {
          usage: { cost: 0.04, totalInputTokens: 20, totalOutputTokens: 10, totalTokens: 30 },
        },
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
        role: 'assistant',
        topicId: 'cotti-analytics-topic-a',
        userId: userIds[0],
      },
      {
        content: 'excluded internal tool message',
        createdAt: new Date('2032-08-01T01:00:00.000Z'),
        id: 'cotti-analytics-message-tool',
        role: 'tool',
        topicId: 'cotti-analytics-topic-a',
        userId: userIds[0],
      },
      {
        content: 'day three question',
        createdAt: new Date('2032-08-02T16:10:00.000Z'),
        id: 'cotti-analytics-message-user-day-three',
        role: 'user',
        topicId: 'cotti-analytics-topic-b',
        userId: userIds[1],
      },
      {
        content: 'flat legacy usage shape',
        createdAt: new Date('2032-08-02T16:11:00.000Z'),
        error: { message: 'provider error' },
        id: 'cotti-analytics-message-flat-usage',
        metadata: { cost: 0.06, totalInputTokens: 30, totalOutputTokens: 15 },
        role: 'assistant',
        topicId: 'cotti-analytics-topic-b',
        userId: userIds[1],
      },
      {
        content: 'excluded at end boundary',
        createdAt: new Date('2032-08-03T16:00:00.000Z'),
        id: 'cotti-analytics-message-after',
        role: 'user',
        topicId: 'cotti-analytics-topic-b',
        userId: userIds[1],
      },
    ]);
  });

  afterAll(async () => {
    if (db) await db.delete(users).where(inArray(users.id, userIds));
  });

  it('returns exact overview and Shanghai trends with legacy usage fallbacks', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getDashboard(
      { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' },
      new Date('2032-08-04T01:00:00.000Z'),
    );

    expect(result).toEqual({
      generatedAt: '2032-08-04T01:00:00.000Z',
      overview: {
        activeTopics: 2,
        activeUsers: 2,
        assistantMessages: 3,
        averageCostPerAssistantMessage: 0.04,
        errorMessages: 1,
        errorRate: 1 / 3,
        newUsers: 1,
        recordedCost: 0.12,
        totalInputTokens: 60,
        totalOutputTokens: 30,
        totalTokens: 90,
        totalUsers: 2,
        userMessages: 2,
      },
      period: {
        endAt: '2032-08-03T16:00:00.000Z',
        endDate: '2032-08-03',
        startAt: '2032-07-31T16:00:00.000Z',
        startDate: '2032-08-01',
        timezone: 'Asia/Shanghai',
        type: 'custom',
      },
      trends: [
        {
          activeUsers: 1,
          assistantMessages: 2,
          day: '2032-08-01',
          errorMessages: 0,
          errorRate: 0,
          recordedCost: 0.06,
          totalMessages: 3,
          totalTokens: 45,
          userMessages: 1,
        },
        {
          activeUsers: 0,
          assistantMessages: 0,
          day: '2032-08-02',
          errorMessages: 0,
          errorRate: 0,
          recordedCost: 0,
          totalMessages: 0,
          totalTokens: 0,
          userMessages: 0,
        },
        {
          activeUsers: 1,
          assistantMessages: 1,
          day: '2032-08-03',
          errorMessages: 1,
          errorRate: 1,
          recordedCost: 0.06,
          totalMessages: 2,
          totalTokens: 45,
          userMessages: 1,
        },
      ],
    });
  });

  it('returns Chat users aggregated by user with identity and activity semantics', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getChatUsers(
      {
        range: { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' },
      },
      new Date('2032-08-04T01:00:00.000Z'),
    );

    expect(result).toEqual({
      generatedAt: '2032-08-04T01:00:00.000Z',
      items: [
        {
          activeDays: 1,
          activeTopics: 1,
          assistantMessages: 2,
          avatar: null,
          email: 'alpha.cotti@example.com',
          errorMessages: 0,
          errorRate: 0,
          fullName: 'Alpha 同事',
          lastActiveAt: '2032-07-31T16:00:00.000Z',
          recordedCost: 0.06,
          totalInputTokens: 30,
          totalOutputTokens: 15,
          totalTokens: 45,
          userId: userIds[0],
          userMessages: 1,
          username: 'alpha-cotti',
        },
        {
          activeDays: 1,
          activeTopics: 1,
          assistantMessages: 1,
          avatar: null,
          email: 'bravo.cotti@example.com',
          errorMessages: 1,
          errorRate: 1,
          fullName: 'Bravo 同事',
          lastActiveAt: '2032-08-02T16:10:00.000Z',
          recordedCost: 0.06,
          totalInputTokens: 30,
          totalOutputTokens: 15,
          totalTokens: 45,
          userId: userIds[1],
          userMessages: 1,
          username: 'bravo-cotti',
        },
      ],
      page: 1,
      pageSize: 20,
      period: {
        endAt: '2032-08-03T16:00:00.000Z',
        endDate: '2032-08-03',
        startAt: '2032-07-31T16:00:00.000Z',
        startDate: '2032-08-01',
        timezone: 'Asia/Shanghai',
        type: 'custom',
      },
      total: 2,
    });
  });

  it('applies Chat user search, sorting, pagination, and out-of-range totals server-side', async () => {
    const service = new CottiPlatformAnalyticsService(db);
    const range = { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' as const };

    const searched = await service.getChatUsers({ q: 'ALPHA.COTTI', range });
    const firstPage = await service.getChatUsers({ pageSize: 1, range, sortBy: 'errorMessages' });
    const secondPage = await service.getChatUsers({
      page: 2,
      pageSize: 1,
      range,
      sortBy: 'errorMessages',
    });
    const outOfRange = await service.getChatUsers({ page: 3, pageSize: 1, range });

    expect(searched.items.map((item) => item.userId)).toEqual([userIds[0]]);
    expect(searched.total).toBe(1);
    expect(firstPage.items.map((item) => item.userId)).toEqual([userIds[1]]);
    expect(firstPage.total).toBe(2);
    expect(secondPage.items.map((item) => item.userId)).toEqual([userIds[0]]);
    expect(secondPage.total).toBe(2);
    expect(outOfRange.items).toEqual([]);
    expect(outOfRange.total).toBe(2);
  });

  it('returns Chat models grouped by nullable provider and model values', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getChatModels(
      {
        range: { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' },
      },
      new Date('2032-08-04T01:00:00.000Z'),
    );

    expect(result).toEqual({
      generatedAt: '2032-08-04T01:00:00.000Z',
      items: [
        {
          activeUsers: 1,
          assistantMessages: 2,
          errorMessages: 0,
          errorRate: 0,
          model: 'gemini-3.6-flash',
          provider: 'vertexai',
          recordedCost: 0.06,
          totalInputTokens: 30,
          totalOutputTokens: 15,
          totalTokens: 45,
        },
        {
          activeUsers: 1,
          assistantMessages: 1,
          errorMessages: 1,
          errorRate: 1,
          model: null,
          provider: null,
          recordedCost: 0.06,
          totalInputTokens: 30,
          totalOutputTokens: 15,
          totalTokens: 45,
        },
      ],
      page: 1,
      pageSize: 20,
      period: {
        endAt: '2032-08-03T16:00:00.000Z',
        endDate: '2032-08-03',
        startAt: '2032-07-31T16:00:00.000Z',
        startDate: '2032-08-01',
        timezone: 'Asia/Shanghai',
        type: 'custom',
      },
      total: 2,
    });
  });

  it('applies Chat model search, sorting, pagination, and out-of-range totals server-side', async () => {
    const service = new CottiPlatformAnalyticsService(db);
    const range = { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' as const };

    const searched = await service.getChatModels({ q: 'GEMINI-3.6', range });
    const firstPage = await service.getChatModels({ pageSize: 1, range, sortBy: 'errorMessages' });
    const secondPage = await service.getChatModels({
      page: 2,
      pageSize: 1,
      range,
      sortBy: 'errorMessages',
    });
    const outOfRange = await service.getChatModels({ page: 3, pageSize: 1, range });

    expect(searched.items.map((item) => [item.provider, item.model])).toEqual([
      ['vertexai', 'gemini-3.6-flash'],
    ]);
    expect(searched.total).toBe(1);
    expect(firstPage.items.map((item) => [item.provider, item.model])).toEqual([[null, null]]);
    expect(firstPage.total).toBe(2);
    expect(secondPage.items.map((item) => [item.provider, item.model])).toEqual([
      ['vertexai', 'gemini-3.6-flash'],
    ]);
    expect(secondPage.total).toBe(2);
    expect(outOfRange.items).toEqual([]);
    expect(outOfRange.total).toBe(2);
  });
});
