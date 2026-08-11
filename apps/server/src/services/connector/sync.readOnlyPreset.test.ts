import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
  FEISHU_DOCUMENTS_CONNECTOR_PRESET,
  FEISHU_DOCUMENTS_CREATE_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES,
  FEISHU_DOCUMENTS_SHEET_SCOPES,
} from '@/const/connectorPresets';
import { ConnectorStatus, ConnectorToolPermission } from '@/database/schemas';
import { mcpService } from '@/server/services/mcp';

import { syncConnectorToolsById } from './sync';

vi.mock('@/server/services/mcp', () => ({ mcpService: { listRawTools: vi.fn() } }));
vi.mock('./tokens', () => ({ ensureFreshConnectorToken: vi.fn(async (connector) => connector) }));

const connector = {
  credentials: {
    accessToken: 'user-a-token',
    scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '),
    type: 'oauth2',
  },
  id: 'connector-a',
  identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
  isEnabled: true,
  mcpConnectionType: 'http',
  mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
  metadata: {
    customHeaders: {
      'X-Lark-MCP-Allowed-Tools': FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
    },
    presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId,
  },
  name: FEISHU_DOCUMENTS_CONNECTOR_PRESET.name,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncConnectorToolsById Feishu preset', () => {
  it('stores the allowlisted read and create tools while removing broader write tools', async () => {
    vi.mocked(mcpService.listRawTools).mockResolvedValue([
      { description: 'read', inputSchema: {}, name: 'fetch-doc' },
      { description: 'create', inputSchema: {}, name: 'create-doc' },
      { description: 'update', inputSchema: {}, name: 'update-doc' },
      { description: 'comments', inputSchema: {}, name: 'add-comments' },
    ] as any);
    const connectorModel = {
      findById: vi.fn().mockResolvedValue(connector),
      updateStatus: vi.fn(),
    };
    const connectorToolModel = {
      deleteToolsNotIn: vi.fn(),
      upsertMany: vi.fn(),
    };

    const result = await syncConnectorToolsById('connector-a', {
      connectorModel,
      connectorToolModel,
    } as any);

    expect(result).toEqual({ toolCount: 2 });
    expect(mcpService.listRawTools).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: undefined,
        headers: {
          'X-Lark-MCP-Allowed-Tools': FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
          'X-Lark-MCP-UAT': 'user-a-token',
        },
      }),
    );
    expect(connectorToolModel.upsertMany).toHaveBeenCalledWith('connector-a', [
      expect.objectContaining({ toolName: 'fetch-doc' }),
      expect.objectContaining({ toolName: 'create-doc' }),
    ]);
    expect(connectorToolModel.deleteToolsNotIn).toHaveBeenCalledWith('connector-a', [
      'fetch-doc',
      'create-doc',
    ]);
    expect(connectorModel.updateStatus).toHaveBeenCalledWith(
      'connector-a',
      ConnectorStatus.connected,
    );
  });

  it('keeps create-doc out of a legacy read-only user grant', async () => {
    vi.mocked(mcpService.listRawTools).mockResolvedValue([
      { description: 'read', inputSchema: {}, name: 'fetch-doc' },
      { description: 'create', inputSchema: {}, name: 'create-doc' },
    ] as any);
    const legacyConnector = {
      ...connector,
      credentials: {
        accessToken: 'legacy-token',
        scope: 'search:docs:read docx:document:readonly',
        type: 'oauth2',
      },
    };
    const connectorModel = {
      findById: vi.fn().mockResolvedValue(legacyConnector),
      updateStatus: vi.fn(),
    };
    const connectorToolModel = {
      deleteToolsNotIn: vi.fn(),
      upsertMany: vi.fn(),
    };

    const result = await syncConnectorToolsById('connector-a', {
      connectorModel,
      connectorToolModel,
    } as any);

    expect(result).toEqual({ toolCount: 1 });
    expect(mcpService.listRawTools).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Lark-MCP-Allowed-Tools': expect.not.stringContaining('create-doc'),
        }),
      }),
    );
    expect(connectorToolModel.deleteToolsNotIn).toHaveBeenCalledWith('connector-a', ['fetch-doc']);
  });

  it('merges guarded OpenAPI message tools without sending their names to the document MCP', async () => {
    vi.mocked(mcpService.listRawTools).mockResolvedValue([
      { description: 'read', inputSchema: {}, name: 'fetch-doc' },
      { description: 'create', inputSchema: {}, name: 'create-doc' },
    ] as any);
    const messagingConnector = {
      ...connector,
      credentials: {
        accessToken: 'messaging-token',
        scope: [...FEISHU_DOCUMENTS_CREATE_SCOPES, ...FEISHU_DOCUMENTS_MESSAGE_SCOPES].join(' '),
        type: 'oauth2',
      },
    };
    const connectorModel = {
      findById: vi.fn().mockResolvedValue(messagingConnector),
      updateStatus: vi.fn(),
    };
    const connectorToolModel = {
      deleteToolsNotIn: vi.fn(),
      upsertMany: vi.fn(),
    };

    const result = await syncConnectorToolsById('connector-a', {
      connectorModel,
      connectorToolModel,
    } as any);

    expect(result).toEqual({ toolCount: 5 });
    expect(mcpService.listRawTools).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Lark-MCP-Allowed-Tools': FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
        }),
      }),
    );
    expect(connectorToolModel.upsertMany).toHaveBeenCalledWith(
      'connector-a',
      expect.arrayContaining([
        expect.objectContaining({
          defaultPermission: ConnectorToolPermission.needs_approval,
          toolName: 'list-group-chats',
        }),
        expect.objectContaining({
          defaultPermission: ConnectorToolPermission.needs_approval,
          toolName: 'list-chat-messages',
        }),
        expect.objectContaining({
          defaultPermission: ConnectorToolPermission.needs_approval,
          toolName: 'get-chat-message',
        }),
      ]),
    );
    expect(connectorToolModel.deleteToolsNotIn).toHaveBeenCalledWith(
      'connector-a',
      expect.arrayContaining([
        'fetch-doc',
        'create-doc',
        'list-group-chats',
        'list-chat-messages',
        'get-chat-message',
      ]),
    );
  });

  it('adds message search only after the per-user search grant is present', async () => {
    vi.mocked(mcpService.listRawTools).mockResolvedValue([
      { description: 'read', inputSchema: {}, name: 'fetch-doc' },
    ] as any);
    const searchableConnector = {
      ...connector,
      credentials: {
        accessToken: 'search-token',
        scope: [
          ...FEISHU_DOCUMENTS_CREATE_SCOPES,
          ...FEISHU_DOCUMENTS_MESSAGE_SCOPES,
          ...FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES,
        ].join(' '),
        type: 'oauth2',
      },
    };
    const connectorModel = {
      findById: vi.fn().mockResolvedValue(searchableConnector),
      updateStatus: vi.fn(),
    };
    const connectorToolModel = {
      deleteToolsNotIn: vi.fn(),
      upsertMany: vi.fn(),
    };

    const result = await syncConnectorToolsById('connector-a', {
      connectorModel,
      connectorToolModel,
    } as any);

    expect(result).toEqual({ toolCount: 6 });
    expect(connectorToolModel.upsertMany).toHaveBeenCalledWith(
      'connector-a',
      expect.arrayContaining([
        expect.objectContaining({
          defaultPermission: ConnectorToolPermission.needs_approval,
          toolName: 'search-chat-messages',
        }),
      ]),
    );
  });

  it('merges the local read-only sheet tool only after spreadsheet authorization', async () => {
    vi.mocked(mcpService.listRawTools).mockResolvedValue([
      { description: 'read', inputSchema: {}, name: 'fetch-doc' },
      { description: 'create', inputSchema: {}, name: 'create-doc' },
    ] as any);
    const sheetConnector = {
      ...connector,
      credentials: {
        accessToken: 'sheet-token',
        scope: [...FEISHU_DOCUMENTS_CREATE_SCOPES, ...FEISHU_DOCUMENTS_SHEET_SCOPES].join(' '),
        type: 'oauth2',
      },
    };
    const connectorModel = {
      findById: vi.fn().mockResolvedValue(sheetConnector),
      updateStatus: vi.fn(),
    };
    const connectorToolModel = {
      deleteToolsNotIn: vi.fn(),
      upsertMany: vi.fn(),
    };

    const result = await syncConnectorToolsById('connector-a', {
      connectorModel,
      connectorToolModel,
    } as any);

    expect(result).toEqual({ toolCount: 3 });
    expect(connectorToolModel.upsertMany).toHaveBeenCalledWith(
      'connector-a',
      expect.arrayContaining([
        expect.objectContaining({
          defaultPermission: ConnectorToolPermission.auto,
          toolName: 'fetch-sheet',
        }),
        expect.objectContaining({
          description: expect.stringContaining('use fetch-sheet instead'),
          toolName: 'fetch-doc',
        }),
      ]),
    );
    expect(connectorToolModel.deleteToolsNotIn).toHaveBeenCalledWith(
      'connector-a',
      expect.arrayContaining(['fetch-doc', 'create-doc', 'fetch-sheet']),
    );
    expect(FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER).not.toContain('fetch-sheet');
  });
});
