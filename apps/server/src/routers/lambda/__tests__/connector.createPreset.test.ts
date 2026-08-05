// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectorPresetId, FEISHU_DOCUMENTS_CONNECTOR_PRESET } from '@/const/connectorPresets';
import { ConnectorModel } from '@/database/models/connector';
import { ConnectorToolModel } from '@/database/models/connectorTool';
import { buildFeishuAuthorizationUrl } from '@/server/services/connector/feishuOAuth';
import { registerDynamicClient } from '@/server/services/connector/oauth';

import { connectorRouter } from '../connector';

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_FEISHU_APP_ID: 'feishu-login-app-id',
    AUTH_FEISHU_APP_SECRET: 'feishu-login-app-secret',
  },
}));
vi.mock('@/database/models/agent', () => ({ AgentModel: vi.fn() }));
vi.mock('@/database/models/connector', () => ({ ConnectorModel: vi.fn() }));
vi.mock('@/database/models/connectorTool', () => ({ ConnectorToolModel: vi.fn() }));
vi.mock('@/database/models/plugin', () => ({ PluginModel: vi.fn() }));
vi.mock('@/server/services/connector/oauth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    discoverConnectorOAuth: vi.fn().mockResolvedValue({
      authorizationServerUrl: 'https://accounts.feishu.cn/mcp',
      metadata: {
        authorization_endpoint: 'https://accounts.feishu.cn/oauth/v2/mcp/authorize',
        issuer: 'https://accounts.feishu.cn/mcp',
        registration_endpoint: 'https://open.feishu.cn/open-apis/app/v1/dcr',
        token_endpoint: 'https://accounts.feishu.cn/oauth/v3/token',
        token_endpoint_auth_methods_supported: ['none'],
      },
    }),
    getConnectorRedirectUri: vi
      .fn()
      .mockReturnValue('https://chatdev.cotticoffee.com/oauth/connector/callback'),
    registerDynamicClient: vi.fn(),
  };
});
vi.mock('@/server/services/connector/feishuOAuth', () => ({
  buildFeishuAuthorizationUrl: vi.fn().mockResolvedValue({
    authorizationUrl: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?probe=1',
    codeVerifier: 'verifier',
  }),
  FEISHU_OAUTH_AUTHORIZE_ENDPOINT: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
  FEISHU_OAUTH_ISSUER: 'https://accounts.feishu.cn',
  FEISHU_OAUTH_TOKEN_ENDPOINT: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
}));
vi.mock('@/server/services/connector/stateStore', () => ({
  generateConnectorOAuthState: vi.fn().mockReturnValue('state'),
  saveConnectorOAuthState: vi.fn(),
}));
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: { initWithEnvKey: async () => ({}) },
}));
vi.mock('@/business/server/trpc-middlewares/workspaceAuth', async () => {
  const mod = await vi.importActual<{ trpc: any }>('@/libs/trpc/lambda/init');
  return {
    requireWorkspaceRoleWhenScoped: () => mod.trpc.middleware(async (opts: any) => opts.next()),
    wsCompatProcedure: mod.trpc.procedure,
  };
});
vi.mock('@/libs/trpc/lambda/middleware', () => ({
  serverDatabase: async (opts: any) =>
    opts.next({ ctx: { ...opts.ctx, serverDB: opts.ctx.serverDB ?? {} } }),
}));

describe('connectorRouter.createPreset', () => {
  let connectorModel: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findScopedByIdentifier: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let connectorToolModel: { deleteToolsNotIn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    connectorModel = {
      create: vi.fn().mockResolvedValue({ id: 'connector-user-a' }),
      findById: vi.fn(),
      findScopedByIdentifier: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };
    connectorToolModel = { deleteToolsNotIn: vi.fn() };
    vi.mocked(ConnectorModel).mockImplementation(() => connectorModel as any);
    vi.mocked(ConnectorToolModel).mockImplementation(() => connectorToolModel as any);
  });

  const caller = (userId: string, workspaceId: string | null = null) =>
    connectorRouter.createCaller({ serverDB: {}, userId, workspaceId } as any);

  it('creates an exact personal Feishu connector with read and create-document access', async () => {
    const result = await caller('user-a').createPreset({
      presetId: ConnectorPresetId.feishuDocuments,
    });

    expect(result).toEqual({ id: 'connector-user-a', isNew: true });
    expect(ConnectorModel).toHaveBeenCalledWith({}, 'user-a', undefined, expect.anything());
    expect(connectorModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
        mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
        name: '飞书资料',
        metadata: expect.objectContaining({
          presetId: ConnectorPresetId.feishuDocuments,
        }),
        oidcConfig: expect.objectContaining({
          clientId: 'feishu-login-app-id',
          scheme: 'pre_registration',
          scopes: [...FEISHU_DOCUMENTS_CONNECTOR_PRESET.scopes],
          usePKCE: true,
        }),
      }),
    );
  });

  it('canonicalizes an existing preset and removes tools outside the approved allowlist', async () => {
    connectorModel.findScopedByIdentifier.mockResolvedValue({
      id: 'connector-existing',
      metadata: { presetId: ConnectorPresetId.feishuDocuments },
      oidcConfig: { clientId: 'registered-client', scheme: 'dcr' },
      userId: 'user-a',
    });

    const result = await caller('user-a').createPreset({
      presetId: ConnectorPresetId.feishuDocuments,
    });

    expect(result).toEqual({ id: 'connector-existing', isNew: false });
    expect(connectorModel.update).toHaveBeenCalledWith(
      'connector-existing',
      expect.objectContaining({
        mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
        name: '飞书资料',
        oidcConfig: expect.objectContaining({
          clientId: 'feishu-login-app-id',
          scheme: 'pre_registration',
          scopes: [...FEISHU_DOCUMENTS_CONNECTOR_PRESET.scopes],
        }),
      }),
    );
    expect(connectorToolModel.deleteToolsNotIn).toHaveBeenCalledWith('connector-existing', [
      ...FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools,
    ]);
  });

  it('rejects workspace creation so every member must authorize personally', async () => {
    await expect(
      caller('user-a', 'workspace-1').createPreset({
        presetId: ConnectorPresetId.feishuDocuments,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(connectorModel.create).not.toHaveBeenCalled();
  });

  it('starts Feishu OAuth with the pre-registered login app instead of unsupported DCR', async () => {
    const connectorId = '841efbe1-1cd5-498f-8c29-2d28dc8b10fc';
    connectorModel.findById.mockResolvedValue({
      id: connectorId,
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      mcpServerUrl: FEISHU_DOCUMENTS_CONNECTOR_PRESET.mcpServerUrl,
      metadata: { presetId: ConnectorPresetId.feishuDocuments },
      oidcConfig: { clientId: 'stale-dcr-client', scheme: 'dcr' },
      userId: 'user-a',
    });

    const result = await caller('user-a').startOAuth({ id: connectorId });

    expect(result).toEqual({
      authorizationUrl: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize?probe=1',
    });
    expect(registerDynamicClient).not.toHaveBeenCalled();
    expect(buildFeishuAuthorizationUrl).toHaveBeenCalledWith({
      clientId: 'feishu-login-app-id',
      redirectUri: 'https://chatdev.cotticoffee.com/oauth/connector/callback',
      scopes: [...FEISHU_DOCUMENTS_CONNECTOR_PRESET.scopes],
      state: 'state',
    });
    expect(connectorModel.update).toHaveBeenCalledWith(
      connectorId,
      expect.objectContaining({
        oidcConfig: expect.objectContaining({
          clientId: 'feishu-login-app-id',
          scheme: 'pre_registration',
        }),
      }),
    );
  });
});
