import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
  FEISHU_DOCUMENTS_CONNECTOR_PRESET,
} from '@/const/connectorPresets';
import { ConnectorStatus } from '@/database/schemas';
import { mcpService } from '@/server/services/mcp';

import { syncConnectorToolsById } from './sync';

vi.mock('@/server/services/mcp', () => ({ mcpService: { listRawTools: vi.fn() } }));
vi.mock('./tokens', () => ({ ensureFreshConnectorToken: vi.fn(async (connector) => connector) }));

const connector = {
  credentials: { accessToken: 'user-a-token', type: 'oauth2' },
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
});
