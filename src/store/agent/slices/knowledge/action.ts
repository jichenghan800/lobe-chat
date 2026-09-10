import { type KnowledgeItem } from '@lobechat/types';
import { type SWRResponse } from 'swr';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { agentKnowledgeKeys } from '@/libs/swr/keys';
import { agentService } from '@/services/agent';
import { ragService } from '@/services/rag';
import { type StoreSetter } from '@/store/types';

import { type AgentStore } from '../../store';

/**
 * Knowledge Slice Actions
 * Handles knowledge base and file operations
 */

type Setter = StoreSetter<AgentStore>;
export const createKnowledgeSlice = (set: Setter, get: () => AgentStore, _api?: unknown) =>
  new KnowledgeSliceActionImpl(set, get, _api);

export class KnowledgeSliceActionImpl {
  readonly #get: () => AgentStore;

  constructor(set: Setter, get: () => AgentStore, _api?: unknown) {
    void _api;
    void set;
    this.#get = get;
  }

  addFilesToAgent = async (fileIds: string[], enabled?: boolean): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentKnowledge } =
      this.#get();
    if (!activeAgentId) return;
    if (fileIds.length === 0) return;

    await agentService.createAgentFiles(activeAgentId, fileIds, enabled);

    try {
      // Chat attachments share the same file inventory but are intentionally
      // not chunked. Once the user explicitly adds a file as Agent knowledge,
      // start the official chunk pipeline (and embedding when the server's
      // CHUNKS_AUTO_EMBEDDING switch is enabled). `skipExist` keeps this
      // idempotent for resources that were already prepared in the library.
      if (enabled !== false) {
        await Promise.all(fileIds.map((id) => ragService.createParseFileTask(id, true)));
      }
    } finally {
      await internal_refreshAgentConfig(activeAgentId);
      await internal_refreshAgentKnowledge();
    }
  };

  addKnowledgeBaseToAgent = async (knowledgeBaseId: string): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentKnowledge } =
      this.#get();
    if (!activeAgentId) return;

    await agentService.createAgentKnowledgeBase(activeAgentId, knowledgeBaseId, true);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentKnowledge();
  };

  internal_refreshAgentKnowledge = async (): Promise<void> => {
    const agentId = this.#get().activeAgentId;
    // The picker keys its cache per visibility (unscoped/private/workspace)
    // so a mutation needs to invalidate all three surfaces at once, otherwise
    // switching tab after add/remove still shows the stale list.
    await Promise.all([
      mutate(agentKnowledgeKeys.list(agentId)),
      mutate(agentKnowledgeKeys.list(agentId, 'private')),
      mutate(agentKnowledgeKeys.list(agentId, 'public')),
    ]);
  };

  removeFileFromAgent = async (fileId: string): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentKnowledge } =
      this.#get();
    if (!activeAgentId) return;

    await agentService.deleteAgentFile(activeAgentId, fileId);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentKnowledge();
  };

  removeKnowledgeBaseFromAgent = async (knowledgeBaseId: string): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig, internal_refreshAgentKnowledge } =
      this.#get();
    if (!activeAgentId) return;

    await agentService.deleteAgentKnowledgeBase(activeAgentId, knowledgeBaseId);
    await internal_refreshAgentConfig(activeAgentId);
    await internal_refreshAgentKnowledge();
  };

  toggleFile = async (id: string, open?: boolean): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig } = this.#get();
    if (!activeAgentId) return;

    await agentService.toggleFile(activeAgentId, id, open);

    try {
      if (open === true) await ragService.createParseFileTask(id, true);
    } finally {
      await internal_refreshAgentConfig(activeAgentId);
    }
  };

  toggleKnowledgeBase = async (id: string, open?: boolean): Promise<void> => {
    const { activeAgentId, internal_refreshAgentConfig } = this.#get();
    if (!activeAgentId) return;

    await agentService.toggleKnowledgeBase(activeAgentId, id, open);
    await internal_refreshAgentConfig(activeAgentId);
  };

  useFetchFilesAndKnowledgeBases = (
    agentId?: string,
    visibility?: 'private' | 'public',
  ): SWRResponse<KnowledgeItem[]> => {
    return useClientDataSWR<KnowledgeItem[]>(
      agentId ? agentKnowledgeKeys.list(agentId, visibility) : null,
      () => agentService.getFilesAndKnowledgeBases(agentId!, visibility),
      {
        fallbackData: [],
      },
    );
  };
}

export type KnowledgeSliceAction = Pick<KnowledgeSliceActionImpl, keyof KnowledgeSliceActionImpl>;
