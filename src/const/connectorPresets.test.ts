import { describe, expect, it } from 'vitest';

import {
  FEISHU_DOCUMENTS_ALLOWED_TOOLS_HEADER,
  FEISHU_DOCUMENTS_CONNECTOR_PRESET,
  getConnectorRuntimeName,
  isFeishuDocumentsToolAllowed,
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
      'docs:document.media:download',
      'docs:document.media:upload',
      'board:whiteboard:node:read',
      'board:whiteboard:node:create',
      'offline_access',
    ]);
  });

  it('allows create-doc without exposing update, comment, contact-search, or message tools', () => {
    expect(isFeishuDocumentsToolAllowed('create-doc')).toBe(true);

    for (const toolName of [
      'update-doc',
      'get-comments',
      'add-comments',
      'search-user',
      'search-message',
    ]) {
      expect(isFeishuDocumentsToolAllowed(toolName)).toBe(false);
    }
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
