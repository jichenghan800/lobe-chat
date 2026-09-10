import type { ChatFileItem, FileItem, UIChatMessage } from '@lobechat/types';
import { isSpreadsheetFileNameOrType } from '@lobechat/utils/spreadsheet';

import { agentService } from '@/services/agent';
import { messageService } from '@/services/message';

/** Keep parsed bodies out of UI stores. Only the local model-input snapshot is hydrated. */
export const hydrateRuntimeFileContent = async ({
  agentFiles,
  agentId,
  groupId,
  isAgentMode,
  messages,
  topicId,
}: {
  agentFiles: (FileItem & { fileType?: string })[];
  agentId?: string;
  groupId?: string;
  isAgentMode: boolean;
  messages: UIChatMessage[];
  topicId?: string;
}): Promise<{ agentFiles: FileItem[]; messages: UIChatMessage[] }> => {
  const needsBody = (file: { content?: string; id: string; name: string }, type?: string) =>
    file.id &&
    file.name &&
    file.content === undefined &&
    !(isAgentMode && isSpreadsheetFileNameOrType(file.name, type));
  const agentIds = agentFiles
    .filter((file) => file.enabled && needsBody(file, file.type ?? file.fileType))
    .map((file) => file.id);
  const groups = new Map<
    string,
    { groupId?: string; ids: Set<string>; threadId?: string | null; topicId: string }
  >();
  const walk = (
    items: UIChatMessage[],
    visit: (files: ChatFileItem[], message: UIChatMessage) => ChatFileItem[],
  ): UIChatMessage[] =>
    items.map((message) => ({
      ...message,
      ...(message.fileList ? { fileList: visit(message.fileList, message) } : {}),
      ...(message.children
        ? {
            children: message.children.map((child) => ({
              ...child,
              ...(child.fileList ? { fileList: visit(child.fileList, message) } : {}),
              ...(child.council ? { council: walk(child.council, visit) } : {}),
            })),
          }
        : {}),
    }));
  walk(messages, (files, message) => {
    const targetTopic = message.topicId ?? topicId;
    if (!targetTopic) return files;
    const ids = files
      .filter((file) => !file.inaccessible && needsBody(file, file.fileType))
      .map((file) => file.id);
    if (!ids.length) return files;
    const targetGroup = message.groupId ?? groupId;
    const key = JSON.stringify([targetTopic, message.threadId, targetGroup]);
    const group = groups.get(key) ?? {
      groupId: targetGroup,
      ids: new Set<string>(),
      threadId: message.threadId,
      topicId: targetTopic,
    };
    ids.forEach((id) => group.ids.add(id));
    groups.set(key, group);
    return files;
  });

  const contents = new Map<string, string>();
  let hydratedAgentFiles = agentFiles;
  const jobs: Promise<void>[] = [];
  if (agentId && agentIds.length)
    jobs.push(
      (async () => {
        const resolved = new Map<string, string>();
        for (let i = 0; i < agentIds.length; i += 100) {
          const files = await agentService.getAgentFileContents(
            agentId,
            agentIds.slice(i, i + 100),
          );
          for (const file of files)
            if (file.id && file.enabled && typeof file.content === 'string')
              resolved.set(file.id, file.content);
        }
        hydratedAgentFiles = agentFiles.map((file) =>
          resolved.has(file.id) ? { ...file, content: resolved.get(file.id) } : file,
        );
      })(),
    );
  for (const group of groups.values())
    jobs.push(
      (async () => {
        const ids = [...group.ids];
        for (let i = 0; i < ids.length; i += 100) {
          const loaded = await messageService.getMessages({
            fileContentIds: ids.slice(i, i + 100),
            includeFileContent: true,
            groupId: group.groupId,
            skipWorks: true,
            threadId: group.threadId,
            topicId: group.topicId,
          });
          walk(loaded, (files) => {
            for (const file of files)
              if (!file.inaccessible && typeof file.content === 'string')
                contents.set(file.id, file.content);
            return files;
          });
        }
      })(),
    );
  await Promise.all(jobs);
  return {
    agentFiles: hydratedAgentFiles,
    messages: walk(messages, (files) =>
      files.map((file) =>
        !file.inaccessible && contents.has(file.id)
          ? { ...file, content: contents.get(file.id) }
          : file,
      ),
    ),
  };
};
