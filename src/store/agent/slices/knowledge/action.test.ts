import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { agentService } from '@/services/agent';
import { KnowledgeType } from '@/types/knowledgeBase';
import { withSWR } from '~test-utils';

import { useAgentStore } from '../../store';

// Mock zustand/traditional for store testing
vi.mock('zustand/traditional');

// Mock agentService
vi.mock('@/services/agent', () => ({
  agentService: {
    createAgentFiles: vi.fn(),
    createAgentKnowledgeBase: vi.fn(),
    deleteAgentFile: vi.fn(),
    deleteAgentKnowledgeBase: vi.fn(),
    getFilesAndKnowledgeBases: vi.fn(),
    toggleFile: vi.fn(),
    toggleKnowledgeBase: vi.fn(),
  },
}));

// Mock SWR mutate
vi.mock('swr', async () => {
  const actual = await vi.importActual('swr');
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  useAgentStore.setState({
    activeAgentId: undefined,
    agentMap: {},
    builtinAgentIdMap: {},
    updateAgentConfigSignal: undefined,
    updateAgentMetaSignal: undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KnowledgeSlice Actions', () => {
  describe('addFilesToAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.addFilesToAgent(['file-1', 'file-2']);
      });

      expect(agentService.createAgentFiles).not.toHaveBeenCalled();
    });

    it('should not call service if fileIds is empty', async () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.addFilesToAgent([]);
      });

      expect(agentService.createAgentFiles).not.toHaveBeenCalled();
    });

    it('should call createAgentFiles with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.createAgentFiles).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.addFilesToAgent(['file-1', 'file-2'], true);
      });

      expect(agentService.createAgentFiles).toHaveBeenCalledWith(
        'agent-1',
        ['file-1', 'file-2'],
        true,
      );
    });
  });

  describe('addKnowledgeBaseToAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.addKnowledgeBaseToAgent('kb-1');
      });

      expect(agentService.createAgentKnowledgeBase).not.toHaveBeenCalled();
    });

    it('should call createAgentKnowledgeBase with enabled=true', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.createAgentKnowledgeBase).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.addKnowledgeBaseToAgent('kb-1');
      });

      expect(agentService.createAgentKnowledgeBase).toHaveBeenCalledWith('agent-1', 'kb-1', true);
    });
  });

  describe('removeFileFromAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.removeFileFromAgent('file-1');
      });

      expect(agentService.deleteAgentFile).not.toHaveBeenCalled();
    });

    it('should call deleteAgentFile with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.deleteAgentFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.removeFileFromAgent('file-1');
      });

      expect(agentService.deleteAgentFile).toHaveBeenCalledWith('agent-1', 'file-1');
    });
  });

  describe('removeKnowledgeBaseFromAgent', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.removeKnowledgeBaseFromAgent('kb-1');
      });

      expect(agentService.deleteAgentKnowledgeBase).not.toHaveBeenCalled();
    });

    it('should call deleteAgentKnowledgeBase with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.deleteAgentKnowledgeBase).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.removeKnowledgeBaseFromAgent('kb-1');
      });

      expect(agentService.deleteAgentKnowledgeBase).toHaveBeenCalledWith('agent-1', 'kb-1');
    });
  });

  describe('toggleFile', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.toggleFile('file-1', true);
      });

      expect(agentService.toggleFile).not.toHaveBeenCalled();
    });

    it('should call toggleFile with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.toggleFile('file-1', true);
      });

      expect(agentService.toggleFile).toHaveBeenCalledWith('agent-1', 'file-1', true);
    });

    it('should call toggleFile with open=false', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.toggleFile('file-1', false);
      });

      expect(agentService.toggleFile).toHaveBeenCalledWith('agent-1', 'file-1', false);
    });
  });

  describe('toggleKnowledgeBase', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.toggleKnowledgeBase('kb-1', true);
      });

      expect(agentService.toggleKnowledgeBase).not.toHaveBeenCalled();
    });

    it('should call toggleKnowledgeBase with correct params', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleKnowledgeBase).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.toggleKnowledgeBase('kb-1', true);
      });

      expect(agentService.toggleKnowledgeBase).toHaveBeenCalledWith('agent-1', 'kb-1', true);
    });

    it('should call toggleKnowledgeBase with open=false', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleKnowledgeBase).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      await act(async () => {
        await result.current.toggleKnowledgeBase('kb-1', false);
      });

      expect(agentService.toggleKnowledgeBase).toHaveBeenCalledWith('agent-1', 'kb-1', false);
    });
  });

  describe('clearEnabledFiles', () => {
    it('should not call service if no activeAgentId', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.clearEnabledFiles();
      });

      expect(agentService.toggleFile).not.toHaveBeenCalled();
    });

    it('should not call service if there are no enabled files', async () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        useAgentStore.setState({
          activeAgentId: 'agent-1',
          agentMap: {
            'agent-1': {
              files: [{ enabled: false, id: 'file-1', name: 'file-1.pdf' }],
            } as any,
          },
        });
      });

      await act(async () => {
        await result.current.clearEnabledFiles();
      });

      expect(agentService.toggleFile).not.toHaveBeenCalled();
    });

    it('should disable all enabled files and refresh config once', async () => {
      const { result } = renderHook(() => useAgentStore());

      vi.mocked(agentService.toggleFile).mockResolvedValue(undefined as any);

      act(() => {
        useAgentStore.setState({
          activeAgentId: 'agent-1',
          agentMap: {
            'agent-1': {
              files: [
                { enabled: true, id: 'file-1', name: 'file-1.pdf' },
                { enabled: false, id: 'file-2', name: 'file-2.pdf' },
                { enabled: true, id: 'file-3', name: 'file-3.pdf' },
              ],
            } as any,
          },
        });
      });

      const refreshSpy = vi
        .spyOn(result.current, 'internal_refreshAgentConfig')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.clearEnabledFiles();
      });

      expect(agentService.toggleFile).toHaveBeenCalledTimes(2);
      expect(agentService.toggleFile).toHaveBeenCalledWith('agent-1', 'file-1', false);
      expect(agentService.toggleFile).toHaveBeenCalledWith('agent-1', 'file-3', false);
      expect(refreshSpy).toHaveBeenCalledWith('agent-1');
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('useFetchFilesAndKnowledgeBases', () => {
    it('should fetch files and knowledge bases for active agent', async () => {
      const mockData = [
        { enabled: true, id: 'file-1', name: 'file1.txt', type: KnowledgeType.File },
        { enabled: true, id: 'kb-1', name: 'KB 1', type: KnowledgeType.KnowledgeBase },
      ];

      vi.mocked(agentService.getFilesAndKnowledgeBases).mockResolvedValueOnce(mockData);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      const { result } = renderHook(
        () => useAgentStore().useFetchFilesAndKnowledgeBases('agent-1'),
        {
          wrapper: withSWR,
        },
      );

      await waitFor(() => expect(result.current.data).toEqual(mockData));

      expect(agentService.getFilesAndKnowledgeBases).toHaveBeenCalledWith('agent-1');
    });

    it('should return empty array as fallback', async () => {
      vi.mocked(agentService.getFilesAndKnowledgeBases).mockResolvedValueOnce([]);

      act(() => {
        useAgentStore.setState({ activeAgentId: 'agent-1' });
      });

      const { result } = renderHook(
        () => useAgentStore().useFetchFilesAndKnowledgeBases('agent-1'),
        {
          wrapper: withSWR,
        },
      );

      await waitFor(() => expect(result.current.data).toEqual([]));
    });
  });
});
