import type { UIChatMessage } from '@lobechat/types';

/** Preserve actual reply model identities, including grouped agent steps. */
export const getOverviewMessageModels = (
  message: UIChatMessage,
  sourceMessages: UIChatMessage[] = [],
): string[] => {
  const models = new Set<string>();
  const sourceById = new Map(sourceMessages.map((item) => [item.id, item]));
  const visit = (item: UIChatMessage) => {
    if (item.role === 'assistant') {
      models.add(item.model ? [item.provider, item.model].filter(Boolean).join('/') : '');
    }
    for (const block of item.children ?? []) {
      const source = sourceById.get(block.id);
      if (source?.role === 'assistant') {
        models.add(source.model ? [source.provider, source.model].filter(Boolean).join('/') : '');
      }
      for (const member of block.council ?? []) visit(member);
    }
    for (const child of [
      ...(item.members ?? []),
      ...(item.compressedMessages ?? []),
      ...(item.tasks ?? []),
    ]) {
      visit(child);
    }
  };
  visit(message);
  return [...models];
};
