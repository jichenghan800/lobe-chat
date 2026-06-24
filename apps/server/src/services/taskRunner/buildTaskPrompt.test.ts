// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { buildTaskPrompt } from './buildTaskPrompt';

const { mockExtractFileIdsFromEditorData, mockResolveAttachmentMetadata } = vi.hoisted(() => ({
  mockExtractFileIdsFromEditorData: vi.fn(),
  mockResolveAttachmentMetadata: vi.fn(),
}));

vi.mock('@/server/services/file/extractFileIdsFromEditorData', () => ({
  extractFileIdsFromEditorData: mockExtractFileIdsFromEditorData,
}));

vi.mock('@/server/services/file/resolveAttachments', () => ({
  resolveAttachmentMetadata: mockResolveAttachmentMetadata,
}));

describe('buildTaskPrompt', () => {
  it('keeps task run prompts free from workspace documents and historical activities', async () => {
    mockExtractFileIdsFromEditorData.mockResolvedValue([]);
    mockResolveAttachmentMetadata.mockResolvedValue([]);

    const findWithHandoff = vi.fn().mockResolvedValue([
      {
        createdAt: '2026-06-24T10:00:00.000Z',
        handoff: { title: 'AI 生成 PPT 历史 topic' },
        id: 'topic-1',
        seq: 1,
        status: 'completed',
        title: 'AI 生成 PPT 历史 topic',
        topicId: 'tpc_1',
      },
    ]);
    const findByTaskId = vi.fn().mockResolvedValue([
      {
        createdAt: '2026-06-24T10:00:00.000Z',
        id: 'brief-1',
        summary: 'AI 生成 PPT 历史 brief',
        title: 'AI 生成 PPT 历史 brief',
        type: 'insight',
      },
    ]);
    const getTreePinnedDocuments = vi.fn().mockResolvedValue({
      nodeMap: {
        doc_ai_ppt: {
          charCount: 100,
          createdAt: '2026-06-24T10:00:00.000Z',
          title: 'AI 生成 PPT 工作区文档',
        },
      },
      tree: [{ children: [], id: 'doc_ai_ppt' }],
    });

    const result = await buildTaskPrompt(
      {
        assigneeAgentId: 'agt_1',
        editorData: undefined,
        id: 'task_1',
        identifier: 'T-10',
        instruction: '请先确认研究赛道',
        name: '行业研究周报',
        status: 'running',
        totalTopics: 1,
      } as any,
      {
        briefModel: { findByTaskId } as any,
        db: {} as LobeChatDatabase,
        taskModel: {
          findByIds: vi.fn().mockResolvedValue([]),
          findSubtasks: vi.fn().mockResolvedValue([]),
          getComments: vi.fn().mockResolvedValue([
            {
              authorAgentId: null,
              content: '立刻执行一次，看下效果',
              createdAt: '2026-06-24T10:01:00.000Z',
              editorData: undefined,
              id: 'comment-1',
            },
          ]),
          getDependencies: vi.fn().mockResolvedValue([]),
          getReviewConfig: vi.fn().mockReturnValue(undefined),
          getTreePinnedDocuments,
        } as any,
        taskTopicModel: { findWithHandoff } as any,
        userId: 'user-1',
      },
    );

    expect(findWithHandoff).not.toHaveBeenCalled();
    expect(findByTaskId).not.toHaveBeenCalled();
    expect(getTreePinnedDocuments).not.toHaveBeenCalled();
    expect(result.prompt).toContain('立刻执行一次，看下效果');
    expect(result.prompt).not.toContain('Workspace');
    expect(result.prompt).not.toContain('Activities');
    expect(result.prompt).not.toContain('AI 生成 PPT');
  });
});
