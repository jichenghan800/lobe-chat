import {
  getFeishuDocumentsAuthorizedToolsHeader,
  isFeishuDocumentsConnector,
} from '@/const/connectorPresets';
import type { DecryptedConnector } from '@/database/models/connector';
import type { ConnectorCredentials } from '@/database/schemas';
import type { AuthConfig } from '@/libs/mcp';

export const buildHttpAuthFromCredentials = (
  credentials: ConnectorCredentials | null,
): { auth?: AuthConfig; headers?: Record<string, string> } => {
  if (!credentials) return {};

  switch (credentials.type) {
    case 'oauth2': {
      return {
        auth: {
          accessToken: credentials.accessToken,
          clientId: undefined,
          clientSecret: credentials.clientSecret,
          refreshToken: credentials.refreshToken,
          tokenExpiresAt: credentials.expiresAt,
          type: 'oauth2',
        },
      };
    }
    case 'bearer': {
      return { auth: { token: credentials.token, type: 'bearer' } };
    }
    case 'apikey': {
      return { auth: { token: credentials.apiKey, type: 'bearer' } };
    }
    case 'header': {
      return { headers: credentials.headers };
    }
    default: {
      return {};
    }
  }
};

export const buildConnectorHttpTransport = (
  connector: DecryptedConnector,
): { auth?: AuthConfig; headers?: Record<string, string> } => {
  if (isFeishuDocumentsConnector(connector)) {
    const credentials = connector.credentials;
    return {
      headers: {
        'X-Lark-MCP-Allowed-Tools': getFeishuDocumentsAuthorizedToolsHeader(connector),
        ...(credentials?.type === 'oauth2' && credentials.accessToken
          ? { 'X-Lark-MCP-UAT': credentials.accessToken }
          : {}),
      },
    };
  }

  const { auth, headers } = buildHttpAuthFromCredentials(connector.credentials);
  const customHeaders = connector.metadata?.customHeaders as Record<string, string> | undefined;
  return {
    auth,
    headers: headers || customHeaders ? { ...headers, ...customHeaders } : undefined,
  };
};
