import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FEISHU_DOCUMENTS_CONNECTOR_PRESET } from '@/const/connectorPresets';

import { refreshFeishuUserAccessToken } from './feishuOAuth';
import { ensureFreshConnectorToken } from './tokens';

vi.mock('@/envs/auth', () => ({
  authEnv: { AUTH_FEISHU_APP_ID: 'cli_app', AUTH_FEISHU_APP_SECRET: 'app-secret' },
}));
vi.mock('./feishuOAuth', () => ({ refreshFeishuUserAccessToken: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureFreshConnectorToken Feishu Documents', () => {
  it('refreshes the encrypted connector credential without reading login account tokens', async () => {
    vi.mocked(refreshFeishuUserAccessToken).mockResolvedValue({
      access_token: 'uat-new',
      expires_in: 7200,
      refresh_token: 'refresh-new',
      token_type: 'Bearer',
    });
    const connector = {
      credentials: {
        accessToken: 'uat-old',
        expiresAt: Date.now() - 1,
        refreshToken: 'refresh-old',
        type: 'oauth2',
      },
      id: 'connector-user-a',
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    } as any;
    const connectorModel = { update: vi.fn() } as any;

    const fresh = await ensureFreshConnectorToken(connector, connectorModel);

    expect(refreshFeishuUserAccessToken).toHaveBeenCalledWith({
      clientId: 'cli_app',
      clientSecret: 'app-secret',
      refreshToken: 'refresh-old',
    });
    expect(fresh.credentials).toMatchObject({
      accessToken: 'uat-new',
      refreshToken: 'refresh-new',
    });
    expect(connectorModel.update).toHaveBeenCalledWith(
      'connector-user-a',
      expect.objectContaining({ credentials: expect.stringContaining('uat-new') }),
    );
  });
});
