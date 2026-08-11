export const ConnectorPresetId = {
  feishuDocuments: 'feishu_documents',
} as const;

export type ConnectorPresetId = (typeof ConnectorPresetId)[keyof typeof ConnectorPresetId];

export const FEISHU_DOCUMENTS_MESSAGE_TOOLS = [
  'query-chat-history',
  'list-group-chats',
  'search-chat-messages',
  'list-chat-messages',
  'get-chat-message',
] as const;

export const FEISHU_DOCUMENTS_SHEET_TOOLS = ['fetch-sheet'] as const;

export const FEISHU_DOCUMENTS_CONNECTOR_PRESET = {
  allowedTools: ['search-doc', 'create-doc', 'fetch-doc', 'list-docs', 'fetch-file'],
  description:
    'Search, list, read, and create Feishu documents, and search authorized private or group chat history.',
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
    'im:message:readonly',
    'im:message.p2p_msg:get_as_user',
    'im:message.group_msg:get_as_user',
    'im:chat.members:read',
    'search:message',
    'docs:document.media:download',
    'docs:document.media:upload',
    'board:whiteboard:node:read',
    'board:whiteboard:node:create',
    'sheets:spreadsheet:readonly',
    'offline_access',
  ],
  /**
   * COTTI server-side OpenAPI tools. These are intentionally NOT sent to the
   * official document MCP in X-Lark-MCP-Allowed-Tools because that remote MCP
   * currently only implements document tools.
   */
  virtualTools: [...FEISHU_DOCUMENTS_MESSAGE_TOOLS, ...FEISHU_DOCUMENTS_SHEET_TOOLS],
} as const;

export const FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER =
  FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools.join(',');

/** Minimum user OAuth scopes required by the default create-doc flow. */
export const FEISHU_DOCUMENTS_CREATE_SCOPES = [
  'docx:document:create',
  'docx:document:write_only',
] as const;

/** User OAuth scopes required to read the user's own p2p/group chat history. */
export const FEISHU_DOCUMENTS_MESSAGE_SCOPES = [
  'im:chat:read',
  'im:message:readonly',
  'im:message.p2p_msg:get_as_user',
  'im:message.group_msg:get_as_user',
] as const;

/** User OAuth scope required to discover visible p2p/group messages by keyword or time. */
export const FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES = ['search:message'] as const;

/** Optional user OAuth scope used to resolve group-message sender IDs to verified names. */
export const FEISHU_DOCUMENTS_CHAT_MEMBER_SCOPES = ['im:chat.members:read'] as const;

/** User OAuth scope required to read electronic spreadsheet values. */
export const FEISHU_DOCUMENTS_SHEET_SCOPES = ['sheets:spreadsheet:readonly'] as const;

export const FEISHU_DOCUMENTS_VIRTUAL_TOOLS = FEISHU_DOCUMENTS_CONNECTOR_PRESET.virtualTools;

interface PresetConnectorLike {
  identifier: string;
  metadata?: Record<string, unknown> | null;
}

interface NamedPresetConnectorLike extends PresetConnectorLike {
  name: string;
}

interface AuthorizedPresetConnectorLike extends PresetConnectorLike {
  credentials?: { scope?: string; type?: string } | null;
}

export const isFeishuDocumentsConnector = (connector: PresetConnectorLike): boolean =>
  connector.identifier === FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier &&
  connector.metadata?.presetId === FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId;

export const isFeishuDocumentsToolAllowed = (toolName: string): boolean =>
  (
    [
      ...FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools,
      ...FEISHU_DOCUMENTS_CONNECTOR_PRESET.virtualTools,
    ] as readonly string[]
  ).includes(toolName);

export const hasFeishuDocumentsCreateAuthorization = (
  connector: AuthorizedPresetConnectorLike,
): boolean => {
  if (!isFeishuDocumentsConnector(connector) || connector.credentials?.type !== 'oauth2') {
    return false;
  }

  const grantedScopes = new Set(connector.credentials.scope?.split(/[\s,]+/).filter(Boolean) ?? []);
  return FEISHU_DOCUMENTS_CREATE_SCOPES.every((scope) => grantedScopes.has(scope));
};

export const hasFeishuDocumentsMessageAuthorization = (
  connector: AuthorizedPresetConnectorLike,
): boolean => {
  if (!isFeishuDocumentsConnector(connector) || connector.credentials?.type !== 'oauth2') {
    return false;
  }

  const grantedScopes = new Set(connector.credentials.scope?.split(/[\s,]+/).filter(Boolean) ?? []);
  return FEISHU_DOCUMENTS_MESSAGE_SCOPES.every((scope) => grantedScopes.has(scope));
};

export const hasFeishuDocumentsMessageSearchAuthorization = (
  connector: AuthorizedPresetConnectorLike,
): boolean => {
  if (!isFeishuDocumentsConnector(connector) || connector.credentials?.type !== 'oauth2') {
    return false;
  }

  const grantedScopes = new Set(connector.credentials.scope?.split(/[\s,]+/).filter(Boolean) ?? []);
  return FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES.every((scope) => grantedScopes.has(scope));
};

export const hasFeishuDocumentsChatMemberAuthorization = (
  connector: AuthorizedPresetConnectorLike,
): boolean => {
  if (!isFeishuDocumentsConnector(connector) || connector.credentials?.type !== 'oauth2') {
    return false;
  }

  const grantedScopes = new Set(connector.credentials.scope?.split(/[\s,]+/).filter(Boolean) ?? []);
  return FEISHU_DOCUMENTS_CHAT_MEMBER_SCOPES.every((scope) => grantedScopes.has(scope));
};

export const hasFeishuDocumentsSheetAuthorization = (
  connector: AuthorizedPresetConnectorLike,
): boolean => {
  if (!isFeishuDocumentsConnector(connector) || connector.credentials?.type !== 'oauth2') {
    return false;
  }

  const grantedScopes = new Set(connector.credentials.scope?.split(/[\s,]+/).filter(Boolean) ?? []);
  return FEISHU_DOCUMENTS_SHEET_SCOPES.every((scope) => grantedScopes.has(scope));
};

export const hasFeishuDocumentsCurrentAuthorization = (
  connector: AuthorizedPresetConnectorLike,
): boolean =>
  hasFeishuDocumentsCreateAuthorization(connector) &&
  hasFeishuDocumentsMessageAuthorization(connector) &&
  hasFeishuDocumentsMessageSearchAuthorization(connector) &&
  hasFeishuDocumentsChatMemberAuthorization(connector) &&
  hasFeishuDocumentsSheetAuthorization(connector);

/**
 * Keep newly introduced write tools out of stale read-only OAuth grants. The
 * remote MCP can advertise create-doc even when the user's existing token was
 * issued before those scopes were added.
 */
export const isFeishuDocumentsToolAuthorized = (
  connector: AuthorizedPresetConnectorLike,
  toolName: string,
): boolean => {
  if (!isFeishuDocumentsToolAllowed(toolName)) return false;
  if (toolName === 'create-doc') return hasFeishuDocumentsCreateAuthorization(connector);
  if (toolName === 'search-chat-messages') {
    return (
      hasFeishuDocumentsMessageAuthorization(connector) &&
      hasFeishuDocumentsMessageSearchAuthorization(connector)
    );
  }
  if (toolName === 'query-chat-history') {
    return (
      hasFeishuDocumentsMessageAuthorization(connector) &&
      hasFeishuDocumentsMessageSearchAuthorization(connector)
    );
  }
  if ((FEISHU_DOCUMENTS_MESSAGE_TOOLS as readonly string[]).includes(toolName)) {
    return hasFeishuDocumentsMessageAuthorization(connector);
  }
  if ((FEISHU_DOCUMENTS_SHEET_TOOLS as readonly string[]).includes(toolName)) {
    return hasFeishuDocumentsSheetAuthorization(connector);
  }

  return true;
};

export const getFeishuDocumentsAuthorizedToolsHeader = (
  connector: AuthorizedPresetConnectorLike,
): string =>
  FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools
    .filter((toolName) => isFeishuDocumentsToolAuthorized(connector, toolName))
    .join(',');

/**
 * Normalize user-visible/runtime connector titles without changing the stable
 * identifier used by OAuth, stored agent configs and MCP tool routing.
 */
export const getConnectorRuntimeName = (connector: NamedPresetConnectorLike): string =>
  isFeishuDocumentsConnector(connector) ? FEISHU_DOCUMENTS_CONNECTOR_PRESET.name : connector.name;
