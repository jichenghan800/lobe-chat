import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import useSWR, { SWRConfig } from 'swr';
import { expect, it } from 'vitest';

import { useRefreshTopicOverview } from './useRefreshTopicOverview';

it('refreshes frozen list state in the application cache, including workspace keys', async () => {
  const cache = new Map();
  let frozen = true;
  const wrapper = ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>
  );
  const { result } = renderHook(
    () => ({
      list: useSWR(['cotti', 'topic-overview', 'list', 'workspace-1'], async () => ({ frozen })),
      refresh: useRefreshTopicOverview(),
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.list.data?.frozen).toBe(true));
  frozen = false;
  await act(async () => {
    await result.current.refresh();
  });
  await waitFor(() => expect(result.current.list.data?.frozen).toBe(false));
});
