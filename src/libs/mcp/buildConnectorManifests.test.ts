import { describe, expect, it } from 'vitest';

import {
  FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
  FEISHU_DOCUMENTS_CONNECTOR_PRESET,
  FEISHU_DOCUMENTS_CREATE_SCOPES,
} from '@/const/connectorPresets';
import type { DecryptedConnector } from '@/database/models/connector';
import type { ConnectorCredentials, UserConnectorToolItem } from '@/database/schemas';

import { buildConnectorManifests } from './buildConnectorManifests';

const httpConnector = (
  credentials: ConnectorCredentials | null,
  metadata?: Record<string, unknown>,
): DecryptedConnector =>
  ({
    credentials,
    id: 'c1',
    identifier: 'my-conn',
    isEnabled: true,
    mcpConnectionType: 'http',
    mcpServerUrl: 'https://mcp.example.com',
    mcpStdioConfig: null,
    metadata: metadata ?? null,
    name: 'My Connector',
    oidcConfig: null,
  }) as any;

const tool = (overrides: Partial<UserConnectorToolItem> = {}): UserConnectorToolItem =>
  ({
    crudType: 'read',
    id: 't1',
    inputSchema: { properties: {}, type: 'object' },
    permission: 'auto',
    toolName: 'doThing',
    userConnectorId: 'c1',
    ...overrides,
  }) as any;

const mcpParamsOf = (connector: DecryptedConnector) => {
  const connectorTool =
    connector.identifier === FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier
      ? tool({ toolName: 'fetch-doc' })
      : tool();
  const [manifest] = buildConnectorManifests([connector], [connectorTool]);
  // mcpParams is a runtime-only field not in the public ToolManifest type.
  return (manifest as any).mcpParams as { auth?: unknown; headers?: Record<string, string> };
};

describe('buildConnectorManifests mcpParams headers', () => {
  it('merges metadata.customHeaders alongside bearer auth', () => {
    const params = mcpParamsOf(
      httpConnector({ token: 'tok', type: 'bearer' }, { customHeaders: { 'X-Tenant': 't1' } }),
    );

    expect(params.auth).toEqual({ token: 'tok', type: 'bearer' });
    expect(params.headers).toEqual({ 'X-Tenant': 't1' });
  });

  it('applies metadata.customHeaders with no auth credential', () => {
    const params = mcpParamsOf(httpConnector(null, { customHeaders: { 'X-Api-Key': 'abc' } }));

    expect(params.auth).toBeUndefined();
    expect(params.headers).toEqual({ 'X-Api-Key': 'abc' });
  });

  it('lets metadata.customHeaders override legacy header-credential keys', () => {
    const params = mcpParamsOf(
      httpConnector(
        { headers: { Authorization: 'Token old' }, type: 'header' },
        { customHeaders: { Authorization: 'Token new' } },
      ),
    );

    expect(params.headers).toEqual({ Authorization: 'Token new' });
  });

  it('leaves headers undefined when there are none (unchanged behavior)', () => {
    const params = mcpParamsOf(httpConnector({ token: 'tok', type: 'bearer' }));

    expect(params.auth).toEqual({ token: 'tok', type: 'bearer' });
    expect(params.headers).toBeUndefined();
  });

  it('uses the per-user Feishu token only as the official UAT header', () => {
    const params = mcpParamsOf({
      ...httpConnector({
        accessToken: 'user-a-uat',
        scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '),
        type: 'oauth2',
      }),
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    });

    expect(params.auth).toBeUndefined();
    expect(params.headers).toEqual({
      'X-Lark-MCP-Allowed-Tools': FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
      'X-Lark-MCP-UAT': 'user-a-uat',
    });
  });

  it('normalizes a legacy English Feishu row to the Chinese runtime title', () => {
    const [manifest] = buildConnectorManifests(
      [
        {
          ...httpConnector({ accessToken: 'user-a-uat', type: 'oauth2' }),
          identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
          mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
          metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
          name: 'Feishu Documents',
        },
      ],
      [tool({ toolName: 'fetch-doc' })],
    );

    expect(manifest.identifier).toBe('feishu-documents');
    expect(manifest.meta?.title).toBe('飞书资料');
  });

  it('omits a stale create-doc row until the user grants the write scopes', () => {
    const connector = {
      ...httpConnector({
        accessToken: 'legacy-user-uat',
        scope: 'search:docs:read docx:document:readonly',
        type: 'oauth2',
      }),
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };

    const [manifest] = buildConnectorManifests(
      [connector],
      [tool({ toolName: 'fetch-doc' }), tool({ id: 't2', toolName: 'create-doc' })],
    );

    expect(manifest.api.map((item) => item.name)).toEqual(['fetch-doc']);
  });
});
