import type { UIChatMessage } from '@lobechat/types';

export const isTemporaryMessageId = (id: string | null | undefined): id is string =>
  typeof id === 'string' && id.startsWith('tmp_');

export const resolvePersistableParentId = (
  parentId: string | null | undefined,
  messages: UIChatMessage[],
) => {
  if (!isTemporaryMessageId(parentId)) return parentId ?? undefined;

  const parentIndex = messages.findIndex((message) => message.id === parentId);
  const searchEnd = parentIndex === -1 ? messages.length : parentIndex;

  for (let index = searchEnd - 1; index >= 0; index -= 1) {
    const messageId = messages[index]?.id;
    if (messageId && !isTemporaryMessageId(messageId)) return messageId;
  }

  return undefined;
};
