import { useUnmount } from 'ahooks';
import isEqual from 'fast-deep-equal';
import { useEffect, useRef } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, builtinAgentSelectors } from '@/store/agent/selectors';

const HomeAgentIdSync = () => {
  const useAgentStoreUpdater = createStoreUpdater(useAgentStore);

  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const clearEnabledFiles = useAgentStore((s) => s.clearEnabledFiles);
  const inboxAgentFiles = useAgentStore(
    (s) => agentByIdSelectors.getAgentFilesById(inboxAgentId || '')(s),
    isEqual,
  );
  const isInboxAgentLoaded = useAgentStore((s) => !!(inboxAgentId && s.agentMap[inboxAgentId]));
  const clearedInboxFilesRef = useRef<string | undefined>(undefined);

  // Sync inbox agent id to activeAgentId when on home page
  useAgentStoreUpdater('activeAgentId', inboxAgentId);

  useEffect(() => {
    clearedInboxFilesRef.current = undefined;
  }, [inboxAgentId]);

  useEffect(() => {
    if (!inboxAgentId || !isInboxAgentLoaded) return;
    if (clearedInboxFilesRef.current === inboxAgentId) return;

    clearedInboxFilesRef.current = inboxAgentId;

    if (inboxAgentFiles.some((file) => file.enabled)) {
      void clearEnabledFiles(inboxAgentId);
    }
  }, [clearEnabledFiles, inboxAgentFiles, inboxAgentId, isInboxAgentLoaded]);

  // Clear activeAgentId when unmounting (leaving home page)
  useUnmount(() => {
    useAgentStore.setState({ activeAgentId: undefined });
  });

  return null;
};

export default HomeAgentIdSync;
