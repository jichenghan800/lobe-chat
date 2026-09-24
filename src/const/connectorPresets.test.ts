import { describe, expect, it } from 'vitest';

import {
  FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
  FEISHU_DOCUMENTS_CHAT_MEMBER_SCOPES,
  FEISHU_DOCUMENTS_CONNECTOR_PRESET,
  FEISHU_DOCUMENTS_CREATE_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES,
  FEISHU_DOCUMENTS_SHEET_SCOPES,
  getConnectorRuntimeName,
  getFeishuDocumentsAuthorizedToolsHeader,
  hasFeishuDocumentsChatMemberAuthorization,
  hasFeishuDocumentsCreateAuthorization,
  hasFeishuDocumentsCurrentAuthorization,
  hasFeishuDocumentsMessageAuthorization,
  hasFeishuDocumentsMessageSearchAuthorization,
  hasFeishuDocumentsSheetAuthorization,
  isFeishuDocumentsToolAllowed,
  isFeishuDocumentsToolAuthorized,
} from './connectorPresets';

describe('Feishu Documents connector preset', () => {
  it('requests and exposes the approved read and create-document capabilities', () => {
    expect(FEISHU_DOCUMENTS_CONNECTOR_PRESET.allowedTools).toEqual([
      'search-doc',
      'create-doc',
      'fetch-doc',
      'list-docs',
      'fetch-file',
    ]);
    expect(FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER).toBe(
      'search-doc,create-doc,fetch-doc,list-docs,fetch-file',
    );
    expect(FEISHU_DOCUMENTS_CONNECTOR_PRESET.scopes).toEqual([
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
    ]);
  });

  it('allows the guarded document and message tools without exposing mutations', () => {
    expect(isFeishuDocumentsToolAllowed('create-doc')).toBe(true);
    expect(isFeishuDocumentsToolAllowed('list-group-chats')).toBe(true);
    expect(isFeishuDocumentsToolAllowed('search-chat-messages')).toBe(true);
    expect(isFeishuDocumentsToolAllowed('list-chat-messages')).toBe(true);
    expect(isFeishuDocumentsToolAllowed('get-chat-message')).toBe(true);
    expect(isFeishuDocumentsToolAllowed('fetch-sheet')).toBe(true);

    for (const toolName of [
      'update-doc',
      'get-comments',
      'add-comments',
      'search-user',
      'send-message',
    ]) {
      expect(isFeishuDocumentsToolAllowed(toolName)).toBe(false);
    }
  });

  it('requires the per-user read-only sheet grant for spreadsheet tools', () => {
    const baseConnector = {
      credentials: { scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '), type: 'oauth2' },
      identifier: 'feishu-documents',
      metadata: { presetId: 'feishu_documents' },
    };
    const upgradedConnector = {
      ...baseConnector,
      credentials: {
        scope: [...FEISHU_DOCUMENTS_CREATE_SCOPES, ...FEISHU_DOCUMENTS_SHEET_SCOPES].join(' '),
        type: 'oauth2',
      },
    };

    expect(hasFeishuDocumentsSheetAuthorization(baseConnector)).toBe(false);
    expect(isFeishuDocumentsToolAuthorized(baseConnector, 'fetch-sheet')).toBe(false);

    expect(hasFeishuDocumentsSheetAuthorization(upgradedConnector)).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(upgradedConnector, 'fetch-sheet')).toBe(true);
    expect(getFeishuDocumentsAuthorizedToolsHeader(upgradedConnector)).not.toContain('fetch-sheet');
  });

  it('requires the per-user p2p and group message grants for chat tools', () => {
    const baseConnector = {
      credentials: { scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '), type: 'oauth2' },
      identifier: 'feishu-documents',
      metadata: { presetId: 'feishu_documents' },
    };
    const upgradedConnector = {
      ...baseConnector,
      credentials: {
        scope: [
          ...FEISHU_DOCUMENTS_CREATE_SCOPES,
          ...FEISHU_DOCUMENTS_MESSAGE_SCOPES,
          ...FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES,
          ...FEISHU_DOCUMENTS_CHAT_MEMBER_SCOPES,
          ...FEISHU_DOCUMENTS_SHEET_SCOPES,
        ].join(' '),
        type: 'oauth2',
      },
    };

    expect(hasFeishuDocumentsMessageAuthorization(baseConnector)).toBe(false);
    expect(hasFeishuDocumentsMessageSearchAuthorization(baseConnector)).toBe(false);
    expect(hasFeishuDocumentsCurrentAuthorization(baseConnector)).toBe(false);
    expect(isFeishuDocumentsToolAuthorized(baseConnector, 'list-chat-messages')).toBe(false);

    expect(hasFeishuDocumentsMessageAuthorization(upgradedConnector)).toBe(true);
    expect(hasFeishuDocumentsMessageSearchAuthorization(upgradedConnector)).toBe(true);
    expect(hasFeishuDocumentsChatMemberAuthorization(upgradedConnector)).toBe(true);
    expect(hasFeishuDocumentsCurrentAuthorization(upgradedConnector)).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(upgradedConnector, 'list-group-chats')).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(upgradedConnector, 'search-chat-messages')).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(upgradedConnector, 'list-chat-messages')).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(upgradedConnector, 'get-chat-message')).toBe(true);
    expect(getFeishuDocumentsAuthorizedToolsHeader(upgradedConnector)).toBe(
      FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
    );
    expect(getFeishuDocumentsAuthorizedToolsHeader(upgradedConnector)).not.toContain(
      'list-chat-messages',
    );
  });

  it('keeps message history reads available when only the newer search grant is missing', () => {
    const legacyMessageConnector = {
      credentials: { scope: FEISHU_DOCUMENTS_MESSAGE_SCOPES.join(' '), type: 'oauth2' },
      identifier: 'feishu-documents',
      metadata: { presetId: 'feishu_documents' },
    };

    expect(hasFeishuDocumentsMessageAuthorization(legacyMessageConnector)).toBe(true);
    expect(hasFeishuDocumentsMessageSearchAuthorization(legacyMessageConnector)).toBe(false);
    expect(isFeishuDocumentsToolAuthorized(legacyMessageConnector, 'list-chat-messages')).toBe(
      true,
    );
    expect(isFeishuDocumentsToolAuthorized(legacyMessageConnector, 'search-chat-messages')).toBe(
      false,
    );
  });

  it('keeps message reads available without optional sender-name resolution', () => {
    const messageConnector = {
      credentials: { scope: FEISHU_DOCUMENTS_MESSAGE_SCOPES.join(' '), type: 'oauth2' },
      identifier: 'feishu-documents',
      metadata: { presetId: 'feishu_documents' },
    };

    expect(hasFeishuDocumentsChatMemberAuthorization(messageConnector)).toBe(false);
    expect(isFeishuDocumentsToolAuthorized(messageConnector, 'list-chat-messages')).toBe(true);
  });

  it('requires the new user grant before exposing create-doc', () => {
    const legacyConnector = {
      credentials: { scope: 'search:docs:read docx:document:readonly', type: 'oauth2' },
      identifier: 'feishu-documents',
      metadata: { presetId: 'feishu_documents' },
    };
    const upgradedConnector = {
      ...legacyConnector,
      credentials: { scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '), type: 'oauth2' },
    };

    expect(hasFeishuDocumentsCreateAuthorization(legacyConnector)).toBe(false);
    expect(isFeishuDocumentsToolAuthorized(legacyConnector, 'fetch-doc')).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(legacyConnector, 'create-doc')).toBe(false);
    expect(getFeishuDocumentsAuthorizedToolsHeader(legacyConnector)).not.toContain('create-doc');

    expect(hasFeishuDocumentsCreateAuthorization(upgradedConnector)).toBe(true);
    expect(isFeishuDocumentsToolAuthorized(upgradedConnector, 'create-doc')).toBe(true);
    expect(getFeishuDocumentsAuthorizedToolsHeader(upgradedConnector)).toBe(
      FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
    );
  });

  it('uses the Chinese COTTI name without changing the stable identifier', () => {
    expect(FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier).toBe('feishu-documents');
    expect(FEISHU_DOCUMENTS_CONNECTOR_PRESET.name).toBe('飞书资料');
    expect(
      getConnectorRuntimeName({
        identifier: 'feishu-documents',
        metadata: { presetId: 'feishu_documents' },
        name: 'Feishu Documents',
      }),
    ).toBe('飞书资料');
  });
});
