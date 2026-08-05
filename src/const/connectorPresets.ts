export const ConnectorPresetId = {
  feishuDocuments: 'feishu_documents',
} as const;

export type ConnectorPresetId = (typeof ConnectorPresetId)[keyof typeof ConnectorPresetId];

export const FEISHU_DOCUMENTS_CONNECTOR_PRESET = {
  allowedTools: ['search-doc', 'create-doc', 'fetch-doc', 'list-docs', 'fetch-file'],
  description:
    'Search, list, read, and create documents and files available to your Feishu account.',
  identifier: 'feishu-documents',
  mcpServerUrl: 'https://mcp.feishu.cn/mcp',
  // COTTI's canonical runtime/display name. Keep `identifier` stable for OAuth,
  // database relations and tool routing; only user-visible labels are Chinese.
  name: '飞书资料',
  presetId: ConnectorPresetId.feishuDocuments,
  scopes: [
    'search:docs:read',
    'wiki:wiki:readonly',
    'wiki:node:read',
    'wiki:node:create',
    'docx:document:create',
    'docx:document:write_only',
    'docx:document:readonly',
    'task:task:read',
    'im:chat:read',
    'docs:document.media:download',
    'docs:document.media:upload',
    'board:whiteboard:node:read',
    'board:whiteboard:node:create',
    'offline_access',
  ],
} as const;

export const FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER =
  FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools.join(',');

interface PresetConnectorLike {
  identifier: string;
  metadata?: Record<string, unknown> | null;
}

interface NamedPresetConnectorLike extends PresetConnectorLike {
  name: string;
}

export const isFeishuDocumentsConnector = (connector: PresetConnectorLike): boolean =>
  connector.identifier === FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier &&
  connector.metadata?.presetId === FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId;

export const isFeishuDocumentsToolAllowed = (toolName: string): boolean =>
  (FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools as readonly string[]).includes(toolName);

/**
 * Normalize user-visible/runtime connector titles without changing the stable
 * identifier used by OAuth, stored agent configs and MCP tool routing.
 */
export const getConnectorRuntimeName = (connector: NamedPresetConnectorLike): string =>
  isFeishuDocumentsConnector(connector) ? FEISHU_DOCUMENTS_CONNECTOR_PRESET.name : connector.name;
