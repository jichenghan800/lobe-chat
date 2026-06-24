import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const sandboxService = {
    callTool: vi.fn(),
    capabilities: {
      backgroundCommands: true,
      exportFile: true,
      files: true,
      languages: ['python'],
      persistentSession: true,
      shell: true,
      skillScripts: true,
    },
    exportAndUploadFile: vi.fn(),
    kind: 'onlyboxes',
  };

  return {
    checkHash: vi.fn(),
    createSandboxService: vi.fn(() => sandboxService),
    fileService: {
      getFullFileUrl: vi.fn(),
    },
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    getAgentSkills: vi.fn(),
    getUserSettings: vi.fn(),
    marketService: {},
    readResource: vi.fn(),
    sandboxService,
  };
});

vi.mock('@lobechat/builtin-skills', () => ({
  LobeHubIdentifier: 'lobehub',
  builtinSkills: [
    {
      content: `| \`lh kb\` | Knowledge base management (create, upload, organize) |
| \`lh file\` | File management |
| \`lh doc\` | Document management (create, parse, organize) |
| \`lh agent\` | Agent management (create, configure, run) |
# List knowledge bases
lh kb list

# Create a document in a knowledge base
lh kb create-doc <kbId> -t "Meeting Notes" -c "..."

# Run an agent
lh agent run -a <agentId> -p "Summarize today's tasks"
`,
      description: 'LobeHub platform',
      identifier: 'lobehub',
      name: 'LobeHub',
      resources: {
        'references/agent': { content: 'agent reference', fileHash: 'agent', size: 15 },
        'references/doc': { content: 'doc reference', fileHash: 'doc', size: 13 },
        'references/file': { content: 'file reference', fileHash: 'file', size: 14 },
        'references/kb': { content: 'kb reference', fileHash: 'kb', size: 12 },
        'references/search': { content: 'search reference', fileHash: 'search', size: 16 },
      },
      source: 'builtin',
    },
  ],
}));

vi.mock('@/database/models/agentSkill', () => ({
  AgentSkillModel: vi.fn(() => ({
    findAll: mocks.findAll,
    findById: mocks.findById,
    findByName: mocks.findByName,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({
    checkHash: mocks.checkHash,
  })),
}));

vi.mock('@/database/models/user', () => ({
  UserModel: vi.fn(() => ({
    getUserSettings: mocks.getUserSettings,
  })),
}));

vi.mock('@/helpers/skillFilters', () => ({
  filterBuiltinSkills: vi.fn((skills: unknown) => skills),
}));

vi.mock('@/server/services/agentDocuments', () => ({
  AgentDocumentsService: vi.fn(() => ({
    getAgentSkills: mocks.getAgentSkills,
  })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => mocks.fileService),
}));

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn(() => mocks.marketService),
}));

vi.mock('@/server/services/sandbox', async () => {
  const actual = await vi.importActual('@/server/services/sandbox');

  return {
    ...(actual as Record<string, unknown>),
    createSandboxService: mocks.createSandboxService,
  };
});

vi.mock('@/server/services/skill/resource', () => ({
  SkillResourceService: vi.fn(() => ({
    readResource: mocks.readResource,
  })),
}));

vi.mock('@/server/services/toolExecution/preprocessLhCommand', () => ({
  preprocessLhCommand: vi.fn(async (command: string) => ({ command })),
}));

describe('skillsRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkHash.mockResolvedValue({ isExist: true, url: 'skills/user-skill.zip' });
    mocks.fileService.getFullFileUrl.mockResolvedValue('https://files.example.com/user-skill.zip');
    mocks.findAll.mockResolvedValue({ data: [], total: 0 });
    mocks.findById.mockResolvedValue(undefined);
    mocks.findByName.mockImplementation(async (name: string) => {
      if (name === 'user-skill') {
        return {
          id: 'user-skill-id',
          name: 'user-skill',
          zipFileHash: 'zip-hash-1',
        };
      }

      return undefined;
    });
    mocks.getAgentSkills.mockResolvedValue([]);
    mocks.getUserSettings.mockResolvedValue({ market: { accessToken: 'market-token' } });
    mocks.sandboxService.callTool.mockResolvedValue({
      result: {
        exitCode: 0,
        output: 'ok',
        stdout: 'ok',
        success: true,
      },
      success: true,
    });
  });

  it('executes scripts through the sandbox service and only attaches persisted skill zips', async () => {
    const { skillsRuntime } = await import('../skills');
    const runtime = await skillsRuntime.factory({
      serverDB: {} as never,
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await runtime.execScript({
      activatedSkills: [
        { id: 'user-skill-id', name: 'user-skill' },
        { id: 'builtin-skill-id', name: 'builtin-skill' },
      ],
      command: 'python scripts/run.py',
      description: 'Run skill script',
    });

    expect(result.success).toBe(true);
    expect(mocks.findByName).toHaveBeenCalledWith('user-skill');
    expect(mocks.findByName).toHaveBeenCalledWith('builtin-skill');
    expect(mocks.checkHash).toHaveBeenCalledWith('zip-hash-1');
    expect(mocks.sandboxService.callTool).toHaveBeenCalledWith(
      'execScript',
      expect.objectContaining({
        command: 'python scripts/run.py',
        description: 'Run skill script',
        skillZipUrls: {
          'user-skill': 'https://files.example.com/user-skill.zip',
        },
      }),
    );
  });

  it('blocks document skill resources and lh doc/kb commands when agent documents are disabled', async () => {
    const { skillsRuntime } = await import('../skills');
    const runtime = await skillsRuntime.factory({
      agentId: 'agent-1',
      disableAgentDocuments: true,
      serverDB: {} as never,
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const activation = await runtime.activateSkill({ name: 'LobeHub' });
    expect(activation.success).toBe(true);
    expect(activation.content).not.toContain('lh doc');
    expect(activation.content).not.toContain('lh kb');
    expect(activation.content).not.toContain('lh file');
    expect(activation.content).not.toContain('lh agent');

    const docReference = await runtime.readReference({
      id: 'LobeHub',
      path: 'references/doc',
    });
    expect(docReference.success).toBe(false);

    const fileReference = await runtime.readReference({
      id: 'LobeHub',
      path: 'references/file',
    });
    expect(fileReference.success).toBe(false);

    const searchReference = await runtime.readReference({
      id: 'LobeHub',
      path: 'references/search',
    });
    expect(searchReference.success).toBe(true);

    const commandResult = await runtime.runCommand({ command: 'lh doc list' });
    expect(commandResult.success).toBe(false);
    expect(commandResult.content).toContain('disabled for this task run');
    const fileCommandResult = await runtime.runCommand({ command: 'lh file list' });
    expect(fileCommandResult.success).toBe(false);
    const agentCommandResult = await runtime.runCommand({ command: 'lh agent space fs ls' });
    expect(agentCommandResult.success).toBe(false);
    const localSearchResult = await runtime.runCommand({ command: 'lh search -q "AI 生成 PPT"' });
    expect(localSearchResult.success).toBe(false);
    expect(localSearchResult.content).toContain('Local LobeHub resource search is disabled');
    const shellCommandResult = await runtime.runCommand({ command: 'python3 -c "print(1)"' });
    expect(shellCommandResult.success).toBe(false);
    expect(shellCommandResult.content).toContain('Only LobeHub `lh` CLI commands');
    expect(mocks.getAgentSkills).not.toHaveBeenCalled();
    expect(mocks.sandboxService.callTool).not.toHaveBeenCalled();
  });

  it('sanitizes task lh help output while keeping web search available', async () => {
    const helpOutput = `Usage: lh [options] [command]

Commands:
  doc                 Manage documents
  search [options]    Search across local resources or the web
  kb                  Manage knowledge bases, folders, documents, and files
  agent               Manage agents
  file                Manage files
  message             Manage messages
`;

    mocks.sandboxService.callTool.mockResolvedValueOnce({
      result: {
        exitCode: 0,
        output: helpOutput,
        stdout: helpOutput,
        success: true,
      },
      success: true,
    });

    const { skillsRuntime } = await import('../skills');
    const runtime = await skillsRuntime.factory({
      agentId: 'agent-1',
      disableAgentDocuments: true,
      serverDB: {} as never,
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const helpResult = await runtime.runCommand({ command: 'lh --help' });
    expect(helpResult.success).toBe(true);
    expect(helpResult.content).toContain('message');
    expect(helpResult.content).toContain('Search the web');
    expect(helpResult.content).not.toContain('doc');
    expect(helpResult.content).not.toContain('kb');
    expect(helpResult.content).not.toContain('agent');
    expect(helpResult.content).not.toContain('file');

    mocks.sandboxService.callTool.mockResolvedValueOnce({
      result: {
        exitCode: 0,
        output: 'web result',
        stdout: 'web result',
        success: true,
      },
      success: true,
    });

    const webSearchResult = await runtime.runCommand({
      command: 'lh search -q "AI 生成 PPT" --web',
    });
    expect(webSearchResult.success).toBe(true);
    expect(webSearchResult.content).toContain('web result');
  });

  it('sanitizes lh message list output when agent documents are disabled', async () => {
    const messageListOutput = JSON.stringify([
      {
        content: 'task request',
        createdAt: '2026-06-24T10:00:00.000Z',
        id: 'user-message',
        role: 'user',
        tools: null,
        topicId: 'topic-old',
      },
      {
        content: '',
        id: 'assistant-tool-call',
        role: 'assistant',
        tools: [
          {
            arguments: '{"command":"lh doc view doc-1"}',
            identifier: 'lobe-skills',
          },
        ],
      },
      {
        content:
          'Successfully activated tools: lobe-knowledge-base. Full content archived to the agent-document VFS. Agent Document ID: doc-1',
        id: 'tool-message',
        role: 'tool',
      },
      {
        content: 'final weekly report',
        id: 'assistant-final',
        role: 'assistant',
        tools: null,
      },
    ]);

    mocks.sandboxService.callTool.mockResolvedValueOnce({
      result: {
        exitCode: 0,
        output: messageListOutput,
        stdout: messageListOutput,
        success: true,
      },
      success: true,
    });

    const { skillsRuntime } = await import('../skills');
    const runtime = await skillsRuntime.factory({
      agentId: 'agent-1',
      disableAgentDocuments: true,
      serverDB: {} as never,
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await runtime.runCommand({
      command: 'lh message list --topic-id topic-old --json',
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('task request');
    expect(result.content).toContain('final weekly report');
    expect(result.content).not.toContain('lh doc');
    expect(result.content).not.toContain('lobe-knowledge-base');
    expect(result.content).not.toContain('agent-document VFS');
    expect(result.content).not.toContain('Agent Document ID');
    expect(result.content).not.toContain('tool-message');
  });
});
