import type { UIChatMessage } from '@lobechat/types';

export const FALLBACK_REFRESH_DELAYS = [1500, 3000, 5000, 8000, 13_000, 21_000, 34_000, 55_000];

const assistantLikeRoles = new Set(['assistant', 'assistantGroup', 'supervisor']);

const hasVisibleContent = (content: string | undefined | null) => {
  const text = content?.trim();

  return !!text && text !== '...';
};

const isSettledAssistantContent = (message: UIChatMessage) => {
  if (message.error || hasVisibleContent(message.content)) return true;

  return (
    message.children?.some((child) => hasVisibleContent(child.content)) ||
    (message as { taskCompletions?: Array<{ content?: string | null }> }).taskCompletions?.some(
      (child) => hasVisibleContent(child.content),
    ) ||
    false
  );
};

const getMessageTime = (message: UIChatMessage) => Math.max(message.createdAt, message.updatedAt);

const isAssistantLikeMessage = (message: UIChatMessage) => assistantLikeRoles.has(message.role);

const isReplyForUserMessage = (message: UIChatMessage, userMessage: UIChatMessage) => {
  if (!isAssistantLikeMessage(message)) return false;
  if (message.parentId) return message.parentId === userMessage.id;

  return getMessageTime(message) >= getMessageTime(userMessage);
};

export const hasAssistantResultForUserMessage = (
  messages: UIChatMessage[],
  userContent: string,
  timestamp: number,
) => {
  const userMessage = messages.findLast(
    (message) =>
      message.role === 'user' &&
      message.content === userContent &&
      Math.max(message.createdAt, message.updatedAt) >= timestamp,
  );

  if (!userMessage) return false;

  const userMessageIndex = messages.findIndex((message) => message.id === userMessage.id);

  return messages.some(
    (message, index) =>
      index > userMessageIndex &&
      isReplyForUserMessage(message, userMessage) &&
      isSettledAssistantContent(message),
  );
};
