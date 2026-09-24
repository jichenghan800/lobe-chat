import { useSWRConfig } from 'swr';

/** Invalidate the same provider that owns the overview subscriptions. */
export const useRefreshTopicOverview = () => {
  const { mutate } = useSWRConfig();
  return () =>
    mutate((key) => Array.isArray(key) && key[0] === 'cotti' && key[1] === 'topic-overview');
};
