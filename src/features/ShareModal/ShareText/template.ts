import { resolveAssistantGroupFinalContent } from '@lobechat/conversation-flow';
import { type UIChatMessage } from '@lobechat/types';

import { LOADING_FLAT } from '@/const/message';
import { normalizeThinkTags, processWithArtifact } from '@/features/Conversation/utils/markdown';
import { type FieldType } from '@/features/ShareModal/ShareText/type';

interface MarkdownParams extends FieldType {
  messages: UIChatMessage[];
  systemRole: string;
  title: string;
  withTitle?: boolean;
}

export const generateMarkdown = ({
  messages,
  title,
  includeTool,
  includeUser,
  withSystemRole,
  withRole,
  withTitle = true,
  systemRole,
}: MarkdownParams): string => {
  const parts: string[] = withTitle ? [`# ${title}`, ''] : [];

  if (withSystemRole && systemRole) {
    parts.push('````md', systemRole, '````', '');
  }

  const filteredMessages = messages
    .filter((m) => m.content !== LOADING_FLAT)
    .filter((m) => (!includeUser ? m.role !== 'user' : true))
    .filter((m) => (!includeTool ? m.role !== 'tool' : true))
    .map((message) => ({
      ...message,
      content: normalizeThinkTags(
        processWithArtifact(resolveAssistantGroupFinalContent(message) ?? message.content),
      ),
    }));

  for (const chat of filteredMessages) {
    parts.push('');

    if (withRole) {
      if (chat.role === 'user') {
        parts.push('##### User:', '');
      } else if (
        chat.role === 'assistant' ||
        chat.role === 'assistantGroup' ||
        chat.role === 'supervisor'
      ) {
        parts.push('##### Assistant:', '');
      } else if (chat.role === 'tool') {
        parts.push('##### Tools Calling:', '');
      }
    }

    if (chat.role === 'tool') {
      parts.push('```json', String(chat.content), '```');
    } else {
      parts.push(String(chat.content));

      if (includeTool && chat.tools && chat.tools.length > 0) {
        parts.push('', '```json', JSON.stringify(chat.tools, null, 2), '```');
      }
    }
  }

  return parts.join('\n');
};
