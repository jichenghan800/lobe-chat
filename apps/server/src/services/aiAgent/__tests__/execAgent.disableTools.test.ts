import { LobeHubIdentifier } from '@lobechat/builtin-skills';
import { AgentDocumentsManifest } from '@lobechat/builtin-tool-agent-documents';
import { KnowledgeBaseManifest } from '@lobechat/builtin-tool-knowledge-base';
import type * as ModelBankModule from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAgentService } from '../index';

const {
  mockCreateOperation,
  mockCreateServerAgentToolsEngine,
  mockGetAgentConfig,
  mockGetAgentSkills,
  mockHasAgentDocuments,
  mockGetComposioManifests,
  mockGetLobehubSkillManifests,
  mockSkillFindAll,
  mockMessageCreate,
  mockPluginQuery,
  mockResolveTask,
} = vi.hoisted(() => ({
  mockCreateOperation: vi.fn(),
  mockCreateServerAgentToolsEngine: vi.fn().mockReturnValue({
    generateToolsDetailed: vi.fn().mockReturnValue({ enabledToolIds: [], tools: [] }),
    getEnabledPluginManifests: vi.fn().mockReturnValue(new Map()),
  }),
  mockGetAgentConfig: vi.fn(),
  mockGetAgentSkills: vi.fn().mockResolvedValue([]),
  mockHasAgentDocuments: vi.fn().mockResolvedValue(true),
  mockGetComposioManifests: vi.fn().mockResolvedValue([]),
  mockGetLobehubSkillManifests: vi.fn().mockResolvedValue([]),
  mockSkillFindAll: vi.fn().mockResolvedValue({ data: [] }),
  mockMessageCreate: vi.fn(),
  mockPluginQuery: vi.fn().mockResolvedValue([]),
  mockResolveTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/libs/trusted-client', () => ({
  generateTrustedClientToken: vi.fn().mockReturnValue(undefined),
  getTrustedClientTokenForSession: vi.fn().mockResolvedValue(undefined),
  isTrustedClientEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn().mockImplementation(() => ({
    create: mockMessageCreate,
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn().mockImplementation(() => ({
    getAgentConfig: vi.fn(),
    queryAgents: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/server/services/agent', () => ({
  AgentService: vi.fn().mockImplementation(() => ({
    getAgentConfig: mockGetAgentConfig,
  })),
}));

vi.mock('@/server/services/agentDocuments', () => ({
  AgentDocumentsService: vi.fn().mockImplementation(() => ({
    getAgentSkills: mockGetAgentSkills,
    hasDocuments: mockHasAgentDocuments,
  })),
}));

vi.mock('@/database/models/agentSkill', () => ({
  AgentSkillModel: vi.fn().mockImplementation(() => ({
    findAll: mockSkillFindAll,
  })),
}));

vi.mock('@/database/models/plugin', () => ({
  PluginModel: vi.fn().mockImplementation(() => ({
    query: mockPluginQuery,
  })),
}));

vi.mock('@/database/models/connector', () => ({
  ConnectorModel: vi.fn().mockImplementation(() => ({
    queryByIdentifiers: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/database/models/connectorTool', () => ({
  ConnectorToolModel: vi.fn().mockImplementation(() => ({
    queryByConnector: vi.fn().mockResolvedValue([]),
    queryByConnectorIds: vi.fn().mockResolvedValue([]),
    queryAllByConnectorIds: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 'topic-1' }),
  })),
}));

vi.mock('@/database/models/thread', () => ({
  ThreadModel: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('@/database/models/task', () => ({
  TaskModel: vi.fn().mockImplementation(() => ({
    resolve: mockResolveTask,
  })),
}));

vi.mock('@/server/services/agentRuntime', () => ({
  AgentRuntimeService: vi.fn().mockImplementation(() => ({
    createOperation: mockCreateOperation,
  })),
}));

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn().mockImplementation(() => ({
    getLobehubSkillManifests: mockGetLobehubSkillManifests,
  })),
}));

vi.mock('@/server/services/composio', () => ({
  ComposioService: vi.fn().mockImplementation(() => ({
    getComposioManifests: mockGetComposioManifests,
  })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    uploadFromUrl: vi.fn(),
  })),
}));

vi.mock('@/server/modules/Mecha', () => ({
  createServerAgentToolsEngine: mockCreateServerAgentToolsEngine,
  serverMessagesEngine: vi.fn().mockResolvedValue([{ content: 'test', role: 'user' }]),
}));

vi.mock('@/server/services/deviceGateway', () => ({
  deviceGateway: {
    isConfigured: false,
    queryDeviceList: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));

vi.mock('model-bank', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelBankModule>();
  return {
    ...actual,
    LOBE_DEFAULT_MODEL_LIST: [
      {
        abilities: { functionCall: true },
        id: 'gpt-4',
        providerId: 'openai',
      },
    ],
  };
});

describe('AiAgentService.execAgent - disableTools', () => {
  let service: AiAgentService;
  const mockDb = {} as any;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    mockMessageCreate.mockResolvedValue({ id: 'msg-1' });
    mockResolveTask.mockResolvedValue(undefined);
    mockGetAgentSkills.mockResolvedValue([
      {
        description: 'agent document skill',
        identifier: 'agent-skills:doc-skill',
        name: 'agent-skills:doc-skill',
      },
    ]);
    mockSkillFindAll.mockResolvedValue({ data: [] });
    mockCreateOperation.mockResolvedValue({
      autoStarted: true,
      messageId: 'queue-msg-1',
      operationId: 'op-123',
      success: true,
    });
    mockGetAgentConfig.mockResolvedValue({
      chatConfig: {},
      id: 'agent-1',
      model: 'gpt-4',
      plugins: ['plugin-a'],
      provider: 'openai',
      systemRole: 'You are a helper',
    });
    service = new AiAgentService(mockDb, userId);
  });

  it('should skip all tool discovery when disableTools is true', async () => {
    await service.execAgent({
      agentId: 'agent-1',
      disableTools: true,
      prompt: 'Hello',
    } as any);

    // Plugin DB query should NOT be called
    expect(mockPluginQuery).not.toHaveBeenCalled();

    // Manifest fetches should NOT be called
    expect(mockGetLobehubSkillManifests).not.toHaveBeenCalled();
    expect(mockGetComposioManifests).not.toHaveBeenCalled();

    // ToolsEngine should NOT be created
    expect(mockCreateServerAgentToolsEngine).not.toHaveBeenCalled();

    // createOperation should still be called with tools=undefined
    expect(mockCreateOperation).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateOperation.mock.calls[0][0];
    expect(callArgs.tools).toBeUndefined();
  });

  it('should perform full tool discovery when disableTools is not set', async () => {
    await service.execAgent({
      agentId: 'agent-1',
      prompt: 'Hello',
    });

    // All tool discovery steps should be called
    expect(mockPluginQuery).toHaveBeenCalledTimes(1);
    expect(mockGetLobehubSkillManifests).toHaveBeenCalledTimes(1);
    expect(mockGetComposioManifests).toHaveBeenCalledTimes(1);
    expect(mockCreateServerAgentToolsEngine).toHaveBeenCalledTimes(1);
  });

  it('should skip agent document discovery for task runs', async () => {
    mockResolveTask.mockResolvedValueOnce({ id: 'task-1' });
    mockGetAgentConfig.mockResolvedValueOnce({
      chatConfig: {},
      id: 'agent-1',
      knowledgeBases: [{ enabled: true }],
      model: 'gpt-4',
      plugins: [KnowledgeBaseManifest.identifier],
      provider: 'openai',
      systemRole: 'You are a helper',
    });

    await service.execAgent({
      agentId: 'agent-1',
      prompt: 'Hello',
      taskId: 'T-1',
    } as any);

    expect(mockHasAgentDocuments).not.toHaveBeenCalled();
    expect(mockCreateServerAgentToolsEngine).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        disableAgentDocuments: true,
        hasAgentDocuments: false,
        hasEnabledKnowledgeBases: false,
      }),
    );

    const callArgs = mockCreateOperation.mock.calls[0][0];
    expect(callArgs.toolSet.manifestMap).not.toHaveProperty(AgentDocumentsManifest.identifier);
    expect(callArgs.toolSet.manifestMap).not.toHaveProperty(KnowledgeBaseManifest.identifier);
    expect(mockGetAgentSkills).not.toHaveBeenCalled();
    const skillIdentifiers = callArgs.operationSkillSet?.skills.map(
      (skill: any) => skill.identifier,
    );
    expect(skillIdentifiers).toContain(LobeHubIdentifier);
    expect(skillIdentifiers).not.toContain('agent-skills:doc-skill');

    const lobehubSkill = callArgs.operationSkillSet?.skills.find(
      (skill: any) => skill.identifier === LobeHubIdentifier,
    );
    expect(lobehubSkill?.content).not.toContain('lh doc');
    expect(lobehubSkill?.content).not.toContain('lh kb');
    expect(lobehubSkill?.content).not.toContain('lh file');
    expect(lobehubSkill?.content).not.toContain('lh agent');
  });
});
