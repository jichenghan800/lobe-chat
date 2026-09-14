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
