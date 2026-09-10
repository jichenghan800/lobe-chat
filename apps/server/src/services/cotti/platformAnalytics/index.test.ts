// @vitest-environment node
import type { LobeChatDatabase } from '@lobechat/database';
import {
  agentOperations,
  agents,
  asyncTasks,
  files,
  generationBatches,
  generations,
  generationTopics,
  messagePlugins,
  messages,
  messagesFiles,
  tasks,
  taskTopics,
  topics,
  users,
} from '@lobechat/database/schemas';
import { getTestDB } from '@lobechat/database/test-utils';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CottiPlatformAnalyticsService } from './index';

const userIds = [
  'cotti-analytics-user-a',
  'cotti-analytics-user-b',
  'cotti-analytics-user-after-range',
  'cotti-analytics-user-auto-task',
];
const agentIds = ['cotti-analytics-agent-a', 'cotti-analytics-agent-b'];
const operationIds = [
  'cotti-analytics-operation-before',
  'cotti-analytics-operation-a-done',
  'cotti-analytics-operation-a-error',
  'cotti-analytics-operation-a-child',
  'cotti-analytics-operation-b-interrupted',
  'cotti-analytics-operation-b-running',
  'cotti-analytics-operation-at-end',
  'cotti-analytics-error-operation-network-a',
  'cotti-analytics-error-operation-network-b',
  'cotti-analytics-error-operation-legacy',
  'cotti-analytics-error-operation-unclassified',
  'cotti-analytics-error-operation-child',
  'cotti-analytics-error-operation-done',
  'cotti-analytics-error-operation-at-end',
];
const errorMessageIds = [
  'cotti-analytics-error-message-quota-a',
  'cotti-analytics-error-message-quota-b',
  'cotti-analytics-error-message-legacy',
  'cotti-analytics-error-message-unclassified',
  'cotti-analytics-error-message-at-end',
];
const featureMessageIds = [
  'cotti-analytics-feature-user-a',
  'cotti-analytics-feature-user-b',
  'cotti-analytics-feature-search',
  'cotti-analytics-feature-empty-search',
  'cotti-analytics-feature-web-tool',
  'cotti-analytics-feature-error-tool',
];
const featureFileIds = ['cotti-analytics-feature-file-a', 'cotti-analytics-feature-file-b'];
const featureTaskIds = [
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103',
];
const featureTopicIds = [
  'cotti-analytics-feature-generation-image',
  'cotti-analytics-feature-generation-video',
];
const featureBatchIds = [
  'cotti-analytics-feature-image-success',
  'cotti-analytics-feature-image-error',
  'cotti-analytics-feature-image-no-result',
  'cotti-analytics-feature-video-success',
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
      {
        createdAt: new Date('2032-11-01T00:00:00.000Z'),
        email: 'auto-task.cotti@example.com',
        id: userIds[3],
      },
    ]);
    await db.insert(agents).values([
      {
        avatar: 'https://example.com/agent-a.png',
        id: agentIds[0],
        title: '门店运营 Agent',
        userId: userIds[0],
      },
      { id: agentIds[1], title: '财务分析 Agent', userId: userIds[1] },
    ]);
    await db.insert(topics).values([
      { id: 'cotti-analytics-topic-a', userId: userIds[0] },
      { id: 'cotti-analytics-topic-b', userId: userIds[1] },
      { id: 'cotti-analytics-topic-auto-task', trigger: 'task', userId: userIds[3] },
    ]);
    await db.insert(tasks).values({
      automationMode: 'schedule',
      createdByUserId: userIds[3],
      id: 'cotti-analytics-task-auto',
      identifier: 'TASK-1',
      instruction: 'Generate the daily report',
      schedulePattern: '0 9 * * *',
      seq: 1,
      status: 'scheduled',
    });
    await db.insert(taskTopics).values({
      id: '00000000-0000-4000-8000-000000000201',
      seq: 1,
      status: 'completed',
      taskId: 'cotti-analytics-task-auto',
      topicId: 'cotti-analytics-topic-auto-task',
      trigger: 'schedule',
      userId: userIds[3],
    });
    await db.insert(messages).values([
      {
        content: 'automatically generated task prompt',
        createdAt: new Date('2032-11-01T01:00:00.000Z'),
        id: 'cotti-analytics-message-auto-task',
        role: 'user',
        topicId: 'cotti-analytics-topic-auto-task',
        userId: userIds[3],
      },
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
    await db.insert(agentOperations).values([
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-07-31T15:59:59.999Z'),
        id: operationIds[0],
        status: 'done',
        totalTokens: 999,
        userId: userIds[0],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-07-31T16:00:00.000Z'),
        id: operationIds[1],
        llmCalls: 2,
        processingTimeMs: 1000,
        status: 'done',
        toolCalls: 1,
        totalCost: 0.1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
        userId: userIds[0],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-08-01T02:00:00.000Z'),
        id: operationIds[2],
        llmCalls: 1,
        processingTimeMs: 3000,
        status: 'error',
        toolCalls: 2,
        totalInputTokens: 20,
        totalOutputTokens: 10,
        totalTokens: 30,
        userId: userIds[1],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-08-01T02:01:00.000Z'),
        id: operationIds[3],
        llmCalls: 99,
        parentOperationId: operationIds[2],
        processingTimeMs: 99_000,
        status: 'done',
        toolCalls: 99,
        totalCost: 99,
        totalInputTokens: 9900,
        totalOutputTokens: 9900,
        totalTokens: 19_800,
        userId: userIds[1],
      },
      {
        agentId: agentIds[1],
        createdAt: new Date('2032-08-02T12:00:00.000Z'),
        id: operationIds[4],
        processingTimeMs: 5000,
        status: 'interrupted',
        userId: userIds[1],
      },
      {
        agentId: agentIds[1],
        createdAt: new Date('2032-08-02T13:00:00.000Z'),
        id: operationIds[5],
        status: 'running',
        totalCost: 50,
        totalTokens: 5000,
        userId: userIds[0],
      },
      {
        agentId: agentIds[1],
        createdAt: new Date('2032-08-03T16:00:00.000Z'),
        id: operationIds[6],
        status: 'done',
        totalTokens: 7000,
        userId: userIds[0],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-09-02T01:00:00.000Z'),
        error: { category: 'network', message: 'private network detail' },
        id: operationIds[7],
        status: 'error',
        userId: userIds[0],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-09-02T01:01:00.000Z'),
        error: { category: 'network', message: 'another private detail' },
        id: operationIds[8],
        status: 'error',
        userId: userIds[1],
      },
      {
        agentId: agentIds[1],
        createdAt: new Date('2032-09-02T01:02:00.000Z'),
        error: { message: 'legacy private detail', type: 'LegacyAgentError' },
        id: operationIds[9],
        status: 'error',
        userId: userIds[1],
      },
      {
        agentId: agentIds[1],
        createdAt: new Date('2032-09-02T01:03:00.000Z'),
        error: { message: 'unclassified private detail' },
        id: operationIds[10],
        status: 'error',
        userId: userIds[1],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-09-02T01:04:00.000Z'),
        error: { category: 'child-only' },
        id: operationIds[11],
        parentOperationId: operationIds[7],
        status: 'error',
        userId: userIds[0],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-09-02T01:05:00.000Z'),
        error: { category: 'non-error-status' },
        id: operationIds[12],
        status: 'done',
        userId: userIds[0],
      },
      {
        agentId: agentIds[0],
        createdAt: new Date('2032-09-02T16:00:00.000Z'),
        error: { category: 'end-boundary' },
        id: operationIds[13],
        status: 'error',
        userId: userIds[0],
      },
    ]);
    await db.insert(messages).values([
      {
        content: 'feature file message a',
        createdAt: new Date('2032-09-01T01:00:00.000Z'),
        id: featureMessageIds[0],
        role: 'user',
        userId: userIds[0],
      },
      {
        content: 'feature file message b',
        createdAt: new Date('2032-09-01T01:01:00.000Z'),
        id: featureMessageIds[1],
        role: 'user',
        userId: userIds[1],
      },
      {
        content: 'feature built-in search',
        createdAt: new Date('2032-09-01T02:00:00.000Z'),
        id: featureMessageIds[2],
        role: 'assistant',
        search: {
          citations: [{ title: 'Result', url: 'https://example.com/result' }],
          searchQueries: ['cotti'],
        },
        userId: userIds[0],
      },
      {
        content: 'feature empty search',
        createdAt: new Date('2032-09-01T02:01:00.000Z'),
        id: featureMessageIds[3],
        role: 'assistant',
        search: {},
        userId: userIds[1],
      },
      {
        content: 'feature web search tool result',
        createdAt: new Date('2032-09-01T03:00:00.000Z'),
        id: featureMessageIds[4],
        role: 'tool',
        userId: userIds[0],
      },
      {
        content: 'feature failed tool result',
        createdAt: new Date('2032-09-01T03:01:00.000Z'),
        id: featureMessageIds[5],
        role: 'tool',
        userId: userIds[1],
      },
      {
        content: 'private chat content a',
        createdAt: new Date('2032-09-02T02:00:00.000Z'),
        error: { body: { secret: true }, category: 'quota', message: 'private quota detail' },
        id: errorMessageIds[0],
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
        role: 'assistant',
        userId: userIds[0],
      },
      {
        content: 'private chat content b',
        createdAt: new Date('2032-09-02T02:01:00.000Z'),
        error: { category: 'quota', message: 'another private quota detail' },
        id: errorMessageIds[1],
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
        role: 'assistant',
        userId: userIds[1],
      },
      {
        content: 'private legacy content',
        createdAt: new Date('2032-09-02T02:02:00.000Z'),
        error: { message: 'legacy private detail', type: 'LegacyProviderError' },
        id: errorMessageIds[2],
        model: 'qwen3.7-plus',
        provider: 'qwen',
        role: 'assistant',
        userId: userIds[0],
      },
      {
        content: 'private unclassified content',
        createdAt: new Date('2032-09-02T02:03:00.000Z'),
        error: { message: 'unclassified private detail' },
        id: errorMessageIds[3],
        role: 'assistant',
        userId: userIds[1],
      },
      {
        content: 'excluded error at end boundary',
        createdAt: new Date('2032-09-02T16:00:00.000Z'),
        error: { category: 'end-boundary' },
        id: errorMessageIds[4],
        model: 'excluded-model',
        provider: 'excluded-provider',
        role: 'assistant',
        userId: userIds[0],
      },
    ]);
    await db.insert(messagePlugins).values([
      {
        apiName: 'search',
        id: featureMessageIds[4],
        identifier: 'lobe-web-browsing',
        toolCallId: 'cotti-analytics-feature-tool-call-search',
        userId: userIds[0],
      },
      {
        apiName: 'executeCode',
        error: { message: 'tool failed', type: 'ToolError' },
        id: featureMessageIds[5],
        identifier: 'lobe-cloud-sandbox',
        intervention: { status: 'rejected' },
        toolCallId: 'cotti-analytics-feature-tool-call-error',
        userId: userIds[1],
      },
    ]);
    await db.insert(files).values([
      {
        fileType: 'image/png',
        id: featureFileIds[0],
        name: 'feature-a.png',
        size: 100,
        url: 'https://example.com/feature-a.png',
        userId: userIds[0],
      },
      {
        fileType: 'video/mp4',
        id: featureFileIds[1],
        name: 'feature-b.mp4',
        size: 200,
        url: 'https://example.com/feature-b.mp4',
        userId: userIds[1],
      },
    ]);
    await db.insert(messagesFiles).values([
      { fileId: featureFileIds[0], messageId: featureMessageIds[0], userId: userIds[0] },
      { fileId: featureFileIds[1], messageId: featureMessageIds[0], userId: userIds[0] },
      { fileId: featureFileIds[0], messageId: featureMessageIds[1], userId: userIds[1] },
    ]);
    await db.insert(generationTopics).values([
      { id: featureTopicIds[0], type: 'image', userId: userIds[0] },
      { id: featureTopicIds[1], type: 'video', userId: userIds[1] },
    ]);
    await db.insert(generationBatches).values([
      {
        createdAt: new Date('2032-09-01T04:00:00.000Z'),
        generationTopicId: featureTopicIds[0],
        id: featureBatchIds[0],
        model: 'image-model',
        prompt: 'image success',
        provider: 'test',
        userId: userIds[0],
      },
      {
        createdAt: new Date('2032-09-01T04:01:00.000Z'),
        generationTopicId: featureTopicIds[0],
        id: featureBatchIds[1],
        model: 'image-model',
        prompt: 'image error',
        provider: 'test',
        userId: userIds[0],
      },
      {
        createdAt: new Date('2032-09-01T04:02:00.000Z'),
        generationTopicId: featureTopicIds[0],
        id: featureBatchIds[2],
        model: 'image-model',
        prompt: 'image no result',
        provider: 'test',
        userId: userIds[1],
      },
      {
        createdAt: new Date('2032-09-01T04:03:00.000Z'),
        generationTopicId: featureTopicIds[1],
        id: featureBatchIds[3],
        model: 'video-model',
        prompt: 'video success',
        provider: 'test',
        userId: userIds[1],
      },
    ]);
    await db.insert(asyncTasks).values([
      { id: featureTaskIds[0], status: 'success', type: 'image_generation', userId: userIds[0] },
      {
        error: { message: 'generation failed', type: 'GenerationError' },
        id: featureTaskIds[1],
        status: 'error',
        type: 'image_generation',
        userId: userIds[0],
      },
      { id: featureTaskIds[2], status: 'success', type: 'video_generation', userId: userIds[1] },
    ]);
    await db.insert(generations).values([
      {
        asyncTaskId: featureTaskIds[0],
        fileId: featureFileIds[0],
        generationBatchId: featureBatchIds[0],
        id: 'cotti-analytics-feature-generation-image-success',
        userId: userIds[0],
      },
      {
        asyncTaskId: featureTaskIds[1],
        generationBatchId: featureBatchIds[1],
        id: 'cotti-analytics-feature-generation-image-error',
        userId: userIds[0],
      },
      {
        asyncTaskId: featureTaskIds[2],
        fileId: featureFileIds[1],
        generationBatchId: featureBatchIds[3],
        id: 'cotti-analytics-feature-generation-video-success',
        userId: userIds[1],
      },
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db.delete(agentOperations).where(inArray(agentOperations.id, operationIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }
  });

  it('returns Agent usage from terminal root executions without re-summing children', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getAgents(
      {
        range: { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' },
      },
      new Date('2032-08-04T01:00:00.000Z'),
    );

    expect(result).toEqual({
      generatedAt: '2032-08-04T01:00:00.000Z',
      items: [
        {
          activeUsers: 2,
          agentId: agentIds[0],
          avatar: 'https://example.com/agent-a.png',
          averageProcessingTimeMs: 2000,
          costRecordedExecutions: 1,
          errorExecutions: 1,
          errorRate: 0.5,
          executions: 2,
          interruptedExecutions: 0,
          interruptionRate: 0,
          lastExecutedAt: '2032-08-01T02:00:00.000Z',
          llmCalls: 3,
          recordedCost: 0.1,
          title: '门店运营 Agent',
          tokenRecordedExecutions: 2,
          toolCalls: 3,
          totalInputTokens: 120,
          totalOutputTokens: 60,
          totalTokens: 180,
        },
        {
          activeUsers: 1,
          agentId: agentIds[1],
          avatar: null,
          averageProcessingTimeMs: 5000,
          costRecordedExecutions: 0,
          errorExecutions: 0,
          errorRate: 0,
          executions: 1,
          interruptedExecutions: 1,
          interruptionRate: 1,
          lastExecutedAt: '2032-08-02T12:00:00.000Z',
          llmCalls: 0,
          recordedCost: 0,
          title: '财务分析 Agent',
          tokenRecordedExecutions: 0,
          toolCalls: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
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

  it('returns capability-specific feature adoption facts without flattening their semantics', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getFeatures(
      { endDate: '2032-09-02', startDate: '2032-09-01', type: 'custom' },
      new Date('2032-09-03T01:00:00.000Z'),
    );

    expect(result).toEqual({
      files: {
        activeUsers: 2,
        distinctFiles: 2,
        fileRelations: 3,
        messagesWithFiles: 2,
      },
      generatedAt: '2032-09-03T01:00:00.000Z',
      generations: [
        {
          activeUsers: 2,
          errorResults: 1,
          requests: 3,
          requestsWithoutResults: 1,
          resultRows: 2,
          successfulAssets: 1,
          type: 'image',
        },
        {
          activeUsers: 1,
          errorResults: 0,
          requests: 1,
          requestsWithoutResults: 0,
          resultRows: 1,
          successfulAssets: 1,
          type: 'video',
        },
      ],
      period: {
        endAt: '2032-09-02T16:00:00.000Z',
        endDate: '2032-09-02',
        startAt: '2032-08-31T16:00:00.000Z',
        startDate: '2032-09-01',
        timezone: 'Asia/Shanghai',
        type: 'custom',
      },
      search: {
        activeUsers: 1,
        builtinSearchMessages: 1,
        totalSearchEvents: 2,
        webSearchToolResults: 1,
      },
      tools: {
        activeUsers: 2,
        errorResults: 1,
        rejectedOrAbortedResults: 1,
        results: 2,
      },
    });
  });

  it('returns stable zero-valued feature facts when the selected range has no activity', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getFeatures({
      endDate: '2032-10-02',
      startDate: '2032-10-01',
      type: 'custom',
    });

    expect(result.files).toEqual({
      activeUsers: 0,
      distinctFiles: 0,
      fileRelations: 0,
      messagesWithFiles: 0,
    });
    expect(result.generations).toEqual([
      {
        activeUsers: 0,
        errorResults: 0,
        requests: 0,
        requestsWithoutResults: 0,
        resultRows: 0,
        successfulAssets: 0,
        type: 'image',
      },
      {
        activeUsers: 0,
        errorResults: 0,
        requests: 0,
        requestsWithoutResults: 0,
        resultRows: 0,
        successfulAssets: 0,
        type: 'video',
      },
    ]);
    expect(result.search).toEqual({
      activeUsers: 0,
      builtinSearchMessages: 0,
      totalSearchEvents: 0,
      webSearchToolResults: 0,
    });
    expect(result.tools).toEqual({
      activeUsers: 0,
      errorResults: 0,
      rejectedOrAbortedResults: 0,
      results: 0,
    });
  });

  it('returns Chat error distribution without raw error or message payloads', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getChatErrors(
      {
        range: { endDate: '2032-09-02', startDate: '2032-09-01', type: 'custom' },
      },
      new Date('2032-09-03T01:00:00.000Z'),
    );

    expect(result).toEqual({
      generatedAt: '2032-09-03T01:00:00.000Z',
      items: [
        {
          affectedUsers: 2,
          category: 'quota',
          errorMessages: 2,
          model: 'gemini-3.6-flash',
          provider: 'vertexai',
        },
        {
          affectedUsers: 1,
          category: 'LegacyProviderError',
          errorMessages: 1,
          model: 'qwen3.7-plus',
          provider: 'qwen',
        },
        {
          affectedUsers: 1,
          category: null,
          errorMessages: 1,
          model: null,
          provider: null,
        },
      ],
      page: 1,
      pageSize: 20,
      period: {
        endAt: '2032-09-02T16:00:00.000Z',
        endDate: '2032-09-02',
        startAt: '2032-08-31T16:00:00.000Z',
        startDate: '2032-09-01',
        timezone: 'Asia/Shanghai',
        type: 'custom',
      },
      total: 3,
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('end-boundary');
  });

  it('applies Chat error search, sorting, pagination, and out-of-range totals server-side', async () => {
    const service = new CottiPlatformAnalyticsService(db);
    const range = { endDate: '2032-09-02', startDate: '2032-09-01', type: 'custom' as const };

    const searched = await service.getChatErrors({ q: 'legacy', range });
    const firstPage = await service.getChatErrors({ pageSize: 1, range, sortBy: 'affectedUsers' });
    const secondPage = await service.getChatErrors({
      page: 2,
      pageSize: 1,
      range,
      sortBy: 'affectedUsers',
    });
    const outOfRange = await service.getChatErrors({ page: 4, pageSize: 1, range });

    expect(searched.items.map((item) => item.category)).toEqual(['LegacyProviderError']);
    expect(searched.total).toBe(1);
    expect(firstPage.items.map((item) => item.category)).toEqual(['quota']);
    expect(firstPage.total).toBe(3);
    expect(secondPage.items.map((item) => item.category)).toEqual(['LegacyProviderError']);
    expect(secondPage.total).toBe(3);
    expect(outOfRange.items).toEqual([]);
    expect(outOfRange.total).toBe(3);
  });

  it('returns root Agent error distribution without child executions or raw error payloads', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getAgentErrors(
      {
        range: { endDate: '2032-09-02', startDate: '2032-09-01', type: 'custom' },
      },
      new Date('2032-09-03T01:00:00.000Z'),
    );

    expect(result).toEqual({
      generatedAt: '2032-09-03T01:00:00.000Z',
      items: [
        {
          affectedUsers: 2,
          agentId: agentIds[0],
          avatar: 'https://example.com/agent-a.png',
          category: 'network',
          errorExecutions: 2,
          title: '门店运营 Agent',
        },
        {
          affectedUsers: 1,
          agentId: agentIds[1],
          avatar: null,
          category: 'LegacyAgentError',
          errorExecutions: 1,
          title: '财务分析 Agent',
        },
        {
          affectedUsers: 1,
          agentId: agentIds[1],
          avatar: null,
          category: null,
          errorExecutions: 1,
          title: '财务分析 Agent',
        },
      ],
      page: 1,
      pageSize: 20,
      period: {
        endAt: '2032-09-02T16:00:00.000Z',
        endDate: '2032-09-02',
        startAt: '2032-08-31T16:00:00.000Z',
        startDate: '2032-09-01',
        timezone: 'Asia/Shanghai',
        type: 'custom',
      },
      total: 3,
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('child-only');
    expect(JSON.stringify(result)).not.toContain('end-boundary');
    expect(JSON.stringify(result)).not.toContain('non-error-status');
  });

  it('applies Agent error search, sorting, pagination, and out-of-range totals server-side', async () => {
    const service = new CottiPlatformAnalyticsService(db);
    const range = { endDate: '2032-09-02', startDate: '2032-09-01', type: 'custom' as const };

    const searchedByAgent = await service.getAgentErrors({ q: '门店运营', range });
    const searchedByCategory = await service.getAgentErrors({ q: 'legacy', range });
    const firstPage = await service.getAgentErrors({ pageSize: 1, range, sortBy: 'affectedUsers' });
    const secondPage = await service.getAgentErrors({
      page: 2,
      pageSize: 1,
      range,
      sortBy: 'affectedUsers',
    });
    const outOfRange = await service.getAgentErrors({ page: 4, pageSize: 1, range });

    expect(searchedByAgent.items.map((item) => item.category)).toEqual(['network']);
    expect(searchedByAgent.total).toBe(1);
    expect(searchedByCategory.items.map((item) => item.category)).toEqual(['LegacyAgentError']);
    expect(searchedByCategory.total).toBe(1);
    expect(firstPage.items.map((item) => item.category)).toEqual(['network']);
    expect(firstPage.total).toBe(3);
    expect(secondPage.items.map((item) => item.category)).toEqual(['LegacyAgentError']);
    expect(secondPage.total).toBe(3);
    expect(outOfRange.items).toEqual([]);
    expect(outOfRange.total).toBe(3);
  });

  it('applies Agent search, sorting, pagination, and out-of-range totals server-side', async () => {
    const service = new CottiPlatformAnalyticsService(db);
    const range = { endDate: '2032-08-03', startDate: '2032-08-01', type: 'custom' as const };

    const searched = await service.getAgents({ q: '门店运营', range });
    const firstPage = await service.getAgents({
      pageSize: 1,
      range,
      sortBy: 'averageProcessingTimeMs',
    });
    const secondPage = await service.getAgents({
      page: 2,
      pageSize: 1,
      range,
      sortBy: 'averageProcessingTimeMs',
    });
    const outOfRange = await service.getAgents({ page: 3, pageSize: 1, range });

    expect(searched.items.map((item) => item.agentId)).toEqual([agentIds[0]]);
    expect(searched.total).toBe(1);
    expect(firstPage.items.map((item) => item.agentId)).toEqual([agentIds[1]]);
    expect(firstPage.total).toBe(2);
    expect(secondPage.items.map((item) => item.agentId)).toEqual([agentIds[0]]);
    expect(secondPage.total).toBe(2);
    expect(outOfRange.items).toEqual([]);
    expect(outOfRange.total).toBe(2);
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
        realActiveUsers: 2,
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
          realActiveUsers: 1,
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
          realActiveUsers: 0,
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
          realActiveUsers: 1,
          recordedCost: 0.06,
          totalMessages: 2,
          totalTokens: 45,
          userMessages: 1,
        },
      ],
    });
  });

  it('keeps automated Task owners in total activity but excludes them from real activity', async () => {
    const service = new CottiPlatformAnalyticsService(db);

    const result = await service.getDashboard({
      endDate: '2032-11-01',
      startDate: '2032-11-01',
      type: 'custom',
    });

    expect(result.overview).toMatchObject({ activeUsers: 1, realActiveUsers: 0 });
    expect(result.trends).toEqual([
      expect.objectContaining({
        activeUsers: 1,
        day: '2032-11-01',
        realActiveUsers: 0,
      }),
    ]);
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
