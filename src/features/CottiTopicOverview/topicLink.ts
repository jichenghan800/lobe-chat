/** Resolve a copied topic link locally; never fetch or navigate to its origin. */
export const getOverviewTopicId = (input: string): string | undefined => {
  const value = input.trim();
  if (/^tpc_[\w-]+$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return;

    return url.pathname.match(/\/agent\/[^/]+\/(tpc_[\w-]+)\/?$/)?.[1];
  } catch {
    return;
  }
};

/** A navigation link, not a public share or an impersonation grant. */
export const getOriginalTopicLink = (
  origin: string,
  topic: {
    agentId?: string | null;
    groupId?: string | null;
    id: string;
    workspaceId?: string | null;
  },
): string | undefined => {
  // Workspace/group routes need their own routing contract; never invent one.
  if (!topic.agentId || topic.groupId || topic.workspaceId) return;
  return new URL(
    `/agent/${encodeURIComponent(topic.agentId)}/${encodeURIComponent(topic.id)}`,
    origin,
  ).href;
};
