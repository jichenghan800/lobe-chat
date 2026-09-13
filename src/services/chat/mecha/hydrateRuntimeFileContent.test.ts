import type { FileItem, UIChatMessage } from '@lobechat/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { agentService } from '@/services/agent';
import { messageService } from '@/services/message';

import { hydrateRuntimeFileContent } from './hydrateRuntimeFileContent';

const file = (id: string, name = 'notes.txt'): FileItem => ({
  id,
  name,
  enabled: true,
  type: 'text/plain',
  size: 100,
  url: '/file',
  createdAt: new Date(),
  updatedAt: new Date(),
});
const message = (id: string, name = 'notes.txt'): UIChatMessage =>
  ({
    id: 'm1',
    content: 'read file',
    role: 'user',
    createdAt: 1,
    updatedAt: 1,
    topicId: 'topic-1',
    fileList: [{ id, name, fileType: 'text/plain', size: 100, url: '/file' }],
  }) as UIChatMessage;
afterEach(() => vi.restoreAllMocks());

describe('runtime-only file hydration', () => {
  it('hydrates Chat attachments without mutating the displayed messages', async () => {
    const input = [message('file-1')];
    vi.spyOn(messageService, 'getMessages').mockResolvedValue([
      { ...input[0], fileList: [{ ...input[0].fileList![0], content: 'CHAT_SECRET_MARKER' }] },
    ]);
    const result = await hydrateRuntimeFileContent({
      agentFiles: [],
      messages: input,
      isAgentMode: false,
    });
    expect(result.messages[0].fileList?.[0].content).toBe('CHAT_SECRET_MARKER');
    expect(input[0].fileList?.[0].content).toBeUndefined();
  });

  it('does not request spreadsheet bodies or disabled agent files in Agent mode', async () => {
    const agentRead = vi.spyOn(agentService, 'getAgentFileContents');
    const messageRead = vi.spyOn(messageService, 'getMessages');
    const result = await hydrateRuntimeFileContent({
      agentId: 'target',
      agentFiles: [file('sheet', 'large.xlsx'), { ...file('disabled'), enabled: false }],
      messages: [message('sheet', 'large.xlsx')],
      isAgentMode: true,
    });
    expect(agentRead).not.toHaveBeenCalled();
    expect(messageRead).not.toHaveBeenCalled();
    expect(result.messages[0].fileList?.[0].url).toBe('/file');
  });

  it('hydrates enabled files for the explicit target agent and keeps them out of the UI config', async () => {
    const input = [file('agent-file')];
    const read = vi
      .spyOn(agentService, 'getAgentFileContents')
      .mockResolvedValue([{ ...input[0], content: 'AGENT_KNOWLEDGE_MARKER' }] as Awaited<
        ReturnType<typeof agentService.getAgentFileContents>
      >);
    const result = await hydrateRuntimeFileContent({
      agentId: 'target-agent',
      agentFiles: input,
      messages: [],
      isAgentMode: false,
    });
    expect(read).toHaveBeenCalledWith('target-agent', ['agent-file']);
    expect(result.agentFiles[0].content).toBe('AGENT_KNOWLEDGE_MARKER');
    expect(input[0].content).toBeUndefined();
  });

  it('does not silently continue a model request after denied hydration', async () => {
    vi.spyOn(messageService, 'getMessages').mockRejectedValue(new Error('FORBIDDEN'));
    await expect(
      hydrateRuntimeFileContent({
        agentFiles: [],
        messages: [message('private')],
        isAgentMode: false,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('does not refetch already available content or inaccessible file tombstones', async () => {
    const input = message('loaded');
    input.fileList![0].content = 'already loaded';
    input.fileList!.push({
      ...input.fileList![0],
      id: 'denied',
      content: undefined,
      inaccessible: true,
    });
    const read = vi.spyOn(messageService, 'getMessages');
    const result = await hydrateRuntimeFileContent({
      agentFiles: [],
      messages: [input],
      isAgentMode: false,
    });
    expect(read).not.toHaveBeenCalled();
    expect(result.messages[0].fileList?.[0].content).toBe('already loaded');
  });
  it('retains group scope and ignores render-only compressed history', async () => {
    const input = message('current');
    input.groupId = 'group-1';
    input.compressedMessages = [message('old-huge-file')];
    const read = vi
      .spyOn(messageService, 'getMessages')
      .mockResolvedValue([
        { ...input, fileList: [{ ...input.fileList![0], content: 'GROUP_FILE_MARKER' }] },
      ]);
    const result = await hydrateRuntimeFileContent({
      agentFiles: [],
      messages: [input],
      isAgentMode: false,
    });
    expect(read).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ groupId: 'group-1', fileContentIds: ['current'], skipWorks: true }),
    );
    expect(result.messages[0].fileList?.[0].content).toBe('GROUP_FILE_MARKER');
    expect(result.messages[0].compressedMessages?.[0].fileList?.[0].content).toBeUndefined();
  });
  it('never restores a tombstoned attachment from another visible reference to the same file', async () => {
    const visible = message('shared-file');
    const hidden = { ...message('shared-file'), id: 'hidden-message' };
    hidden.fileList![0].inaccessible = true;
    vi.spyOn(messageService, 'getMessages').mockResolvedValue([
      { ...visible, fileList: [{ ...visible.fileList![0], content: 'VISIBLE_BODY' }] },
    ]);
    const result = await hydrateRuntimeFileContent({
      agentFiles: [],
      messages: [visible, hidden],
      isAgentMode: false,
    });
    expect(result.messages[0].fileList?.[0].content).toBe('VISIBLE_BODY');
    expect(result.messages[1].fileList?.[0].content).toBeUndefined();
    expect(result.messages[1].fileList?.[0].inaccessible).toBe(true);
  });
});
