import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FEISHU_DOCUMENTS_CONNECTOR_PRESET,
  FEISHU_DOCUMENTS_CREATE_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES,
  FEISHU_DOCUMENTS_SHEET_SCOPES,
} from '@/const/connectorPresets';
import { ConnectorToolPermission } from '@/database/schemas';
import { deviceGateway } from '@/server/services/deviceGateway';
import { mcpService } from '@/server/services/mcp';

import { callConnectorToolById } from './exec';
import { scheduleStaleConnectorToolsRefresh } from './refresh';
import { ensureFreshConnectorToken } from './tokens';

vi.mock('@/server/services/mcp', () => ({ mcpService: { callTool: vi.fn() } }));
vi.mock('@/server/services/deviceGateway', () => ({ deviceGateway: { isConfigured: false } }));
vi.mock('./tokens', () => ({ ensureFreshConnectorToken: vi.fn(async (c) => c) }));
// The background tool-list refresh is exercised in refresh.test.ts. Here we only
// verify the call site wires it up and stays isolated from it.
vi.mock('./refresh', () => ({
  buildLastSyncedAtMap: vi.fn(() => new Map()),
  scheduleStaleConnectorToolsRefresh: vi.fn(),
}));

const connector = {
  credentials: { accessToken: 'tok', type: 'oauth2' },
  id: 'c1',
  identifier: 'my-conn',
  isEnabled: true,
  mcpConnectionType: 'http',
  mcpServerUrl: 'https://mcp.example.com',
  mcpStdioConfig: null,
  name: 'My Connector',
  oidcConfig: null,
} as any;

const tool = (over: Record<string, unknown> = {}) => ({
  permission: ConnectorToolPermission.auto,
  toolName: 'do_thing',
  ...over,
});

const makeCtx = (connectors: any[], tools: any[]) =>
  ({
    connectorModel: { queryByIdentifiers: vi.fn().mockResolvedValue(connectors) },
    connectorToolModel: { queryByConnector: vi.fn().mockResolvedValue(tools) },
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureFreshConnectorToken).mockImplementation(async (c: any) => c);
  (deviceGateway as any).isConfigured = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callConnectorToolById', () => {
  it('rejects when the connector is not found', async () => {
    await expect(
      callConnectorToolById({ identifier: 'x', toolName: 'do_thing' }, makeCtx([], [])),
    ).rejects.toHaveProperty('code', 'NOT_FOUND');
  });

  it('rejects when the connector is disabled', async () => {
    const ctx = makeCtx([{ ...connector, isEnabled: false }], [tool()]);
    await expect(
      callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx),
    ).rejects.toHaveProperty('code', 'FORBIDDEN');
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('rejects an unknown tool name not in the synced list', async () => {
    const ctx = makeCtx([connector], [tool({ toolName: 'other' })]);
    await expect(
      callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx),
    ).rejects.toHaveProperty('code', 'BAD_REQUEST');
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('rejects a disabled tool', async () => {
    const ctx = makeCtx([connector], [tool({ permission: ConnectorToolPermission.disabled })]);
    await expect(
      callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx),
    ).rejects.toHaveProperty('code', 'FORBIDDEN');
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('hard-blocks a stale tool outside the Feishu preset allowlist', async () => {
    const feishuConnector = {
      ...connector,
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'update-doc' })]);

    await expect(
      callConnectorToolById(
        { identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier, toolName: 'update-doc' },
        ctx,
      ),
    ).rejects.toHaveProperty('code', 'FORBIDDEN');
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('requires reauthorization before calling create-doc with a legacy token', async () => {
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'legacy-token',
        scope: 'search:docs:read docx:document:readonly',
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'create-doc' })]);

    await expect(
      callConnectorToolById(
        { identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier, toolName: 'create-doc' },
        ctx,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Reauthorize Feishu Documents to enable document creation',
    });
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('allows create-doc after the user grants the write scopes', async () => {
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'upgraded-token',
        scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'create-doc' })]);
    vi.mocked(mcpService.callTool).mockResolvedValue({ success: true });

    await callConnectorToolById(
      { identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier, toolName: 'create-doc' },
      ctx,
    );

    expect(mcpService.callTool).toHaveBeenCalled();
  });

  it('requires reauthorization before exposing Feishu chat history tools', async () => {
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'legacy-token',
        scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'list-chat-messages' })]);

    await expect(
      callConnectorToolById(
        {
          args: '{"chat_id":"oc_private"}',
          identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
          toolName: 'list-chat-messages',
        },
        ctx,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Reauthorize Feishu Documents to enable chat history access',
    });
  });

  it('reads one bounded page of Feishu p2p or group messages with the user token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: { has_more: true, items: [{ message_id: 'om_1' }], page_token: 'next' },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'per-user-uat',
        scope: [...FEISHU_DOCUMENTS_CREATE_SCOPES, ...FEISHU_DOCUMENTS_MESSAGE_SCOPES].join(' '),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'list-chat-messages' })]);

    const result = await callConnectorToolById(
      {
        args: JSON.stringify({
          chat_id: 'oc_private',
          end_time: 1_786_000_000,
          page_size: 20,
          start_time: '1785000000',
        }),
        identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
        toolName: 'list-chat-messages',
      },
      ctx,
    );

    expect(result).toMatchObject({
      state: { structuredContent: { has_more: true, page_token: 'next' } },
      success: true,
    });
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      'https://open.feishu.cn/open-apis/im/v1/messages',
    );
    expect(requestUrl.searchParams.get('container_id')).toBe('oc_private');
    expect(requestUrl.searchParams.get('container_id_type')).toBe('chat');
    expect(requestUrl.searchParams.get('page_size')).toBe('20');
    expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer per-user-uat' });
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('routes authorized p2p message discovery through the user-scoped search API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { has_more: false, items: [] } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'search-user-uat',
        scope: [...FEISHU_DOCUMENTS_MESSAGE_SCOPES, ...FEISHU_DOCUMENTS_MESSAGE_SEARCH_SCOPES].join(
          ' ',
        ),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'search-chat-messages' })]);

    const result = await callConnectorToolById(
      {
        args: JSON.stringify({
          chat_type: 'p2p_chat',
          end_time: 1_786_118_399,
          query: '',
          start_time: 1_786_032_000,
        }),
        identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
        toolName: 'search-chat-messages',
      },
      ctx,
    );

    expect(result).toMatchObject({
      state: {
        structuredContent: {
          applied_filters: { chat_type: 'p2p_chat', query: '' },
          matched_count: 0,
        },
      },
      success: true,
    });
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(requestUrl.pathname).toBe('/open-apis/search/v2/message');
    expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer search-user-uat' });
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('rejects oversized Feishu message pages before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'per-user-uat',
        scope: [...FEISHU_DOCUMENTS_CREATE_SCOPES, ...FEISHU_DOCUMENTS_MESSAGE_SCOPES].join(' '),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'list-chat-messages' })]);

    await expect(
      callConnectorToolById(
        {
          args: '{"chat_id":"oc_private","page_size":21}',
          identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
          toolName: 'list-chat-messages',
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires reauthorization before exposing the Feishu spreadsheet tool', async () => {
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'legacy-token',
        scope: FEISHU_DOCUMENTS_CREATE_SCOPES.join(' '),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'fetch-sheet' })]);

    await expect(
      callConnectorToolById(
        {
          args: '{"document_id":"https://example.feishu.cn/wiki/wiki-token"}',
          identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
          toolName: 'fetch-sheet',
        },
        ctx,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Reauthorize Feishu Documents to enable spreadsheet reading',
    });
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('routes authorized Feishu spreadsheet reads through the local OpenAPI tool', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              node: { obj_token: 'spreadsheet-token', obj_type: 'sheet', title: 'Report' },
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              sheets: [
                {
                  grid_properties: { column_count: 2, row_count: 2 },
                  hidden: false,
                  index: 0,
                  sheet_id: 'sheet-1',
                  title: 'Summary',
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              valueRanges: [
                {
                  range: 'sheet-1!A1:B2',
                  values: [
                    ['Name', 'Amount'],
                    ['A', 5],
                  ],
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const feishuConnector = {
      ...connector,
      credentials: {
        accessToken: 'sheet-user-token',
        scope: [...FEISHU_DOCUMENTS_CREATE_SCOPES, ...FEISHU_DOCUMENTS_SHEET_SCOPES].join(' '),
        type: 'oauth2',
      },
      identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
      metadata: { presetId: FEISHU_DOCUMENTS_CONNECTOR_PRESET.presetId },
    };
    const ctx = makeCtx([feishuConnector], [tool({ toolName: 'fetch-sheet' })]);

    const result = await callConnectorToolById(
      {
        args: '{"document_id":"https://example.feishu.cn/wiki/wiki-token"}',
        identifier: FEISHU_DOCUMENTS_CONNECTOR_PRESET.identifier,
        toolName: 'fetch-sheet',
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true });
    expect(JSON.parse((result as { content: string }).content)).toMatchObject({
      sheet: { sheet_id: 'sheet-1', title: 'Summary' },
      spreadsheet: { title: 'Report', token: 'spreadsheet-token' },
      values: [
        ['Name', 'Amount'],
        ['A', 5],
      ],
    });
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('calls the remote MCP with the connector auth for an allowed tool', async () => {
    vi.mocked(mcpService.callTool).mockResolvedValue({ success: true });
    const ctx = makeCtx([connector], [tool()]);

    const res = await callConnectorToolById(
      { args: '{"a":1}', identifier: 'my-conn', toolName: 'do_thing' },
      ctx,
    );

    expect(res).toEqual({ success: true });
    expect(mcpService.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        argsStr: '{"a":1}',
        clientParams: expect.objectContaining({
          auth: expect.objectContaining({ accessToken: 'tok', type: 'oauth2' }),
          type: 'http',
          url: 'https://mcp.example.com',
        }),
        toolName: 'do_thing',
      }),
    );
  });

  it('uses the refreshed token when the connector token was refreshed', async () => {
    vi.mocked(ensureFreshConnectorToken).mockResolvedValueOnce({
      ...connector,
      credentials: { accessToken: 'refreshed', type: 'oauth2' },
    } as any);
    vi.mocked(mcpService.callTool).mockResolvedValue({ ok: true });
    const ctx = makeCtx([connector], [tool()]);

    await callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx);

    expect(mcpService.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        clientParams: expect.objectContaining({
          auth: expect.objectContaining({ accessToken: 'refreshed' }),
        }),
      }),
    );
  });

  it('schedules a background tool-list refresh for the connector', async () => {
    vi.mocked(mcpService.callTool).mockResolvedValue({ success: true });
    const ctx = makeCtx([connector], [tool()]);

    await callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx);

    expect(scheduleStaleConnectorToolsRefresh).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'c1',
          mcpConnectionType: 'http',
          mcpServerUrl: 'https://mcp.example.com',
        }),
      ],
      expect.anything(),
      ctx,
    );
  });

  // On a cloud deployment (device gateway configured) the server can never
  // reach a stdio binary or a localhost/LAN endpoint — those calls must fail
  // fast with an actionable message instead of a cryptic spawn/fetch error
  // (#16533). Self-hosted servers (no gateway) may share a LAN with the
  // endpoint, so the guard must NOT fire there.
  describe('device-only endpoints on a cloud deployment', () => {
    it('rejects a stdio connector when the device gateway is configured', async () => {
      (deviceGateway as any).isConfigured = true;
      const stdioConnector = {
        ...connector,
        mcpConnectionType: 'stdio',
        mcpServerUrl: null,
        mcpStdioConfig: { args: [], command: 'npx' },
      };
      const ctx = makeCtx([stdioConnector], [tool()]);

      await expect(
        callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx),
      ).rejects.toHaveProperty('code', 'BAD_REQUEST');
      expect(mcpService.callTool).not.toHaveBeenCalled();
    });

    it('rejects a local/private-network HTTP connector when the device gateway is configured', async () => {
      (deviceGateway as any).isConfigured = true;
      const localConnector = { ...connector, mcpServerUrl: 'http://192.168.1.10:8080/mcp' };
      const ctx = makeCtx([localConnector], [tool()]);

      await expect(
        callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx),
      ).rejects.toHaveProperty('code', 'BAD_REQUEST');
      expect(mcpService.callTool).not.toHaveBeenCalled();
    });

    it('still calls a local endpoint when no device gateway is configured (self-host)', async () => {
      vi.mocked(mcpService.callTool).mockResolvedValue({ success: true });
      const localConnector = { ...connector, mcpServerUrl: 'http://192.168.1.10:8080/mcp' };
      const ctx = makeCtx([localConnector], [tool()]);

      const res = await callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx);

      expect(res).toEqual({ success: true });
      expect(mcpService.callTool).toHaveBeenCalledTimes(1);
    });

    it('keeps calling public endpoints when the device gateway is configured', async () => {
      (deviceGateway as any).isConfigured = true;
      vi.mocked(mcpService.callTool).mockResolvedValue({ success: true });
      const ctx = makeCtx([connector], [tool()]);

      const res = await callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx);

      expect(res).toEqual({ success: true });
    });
  });

  it('still returns the tool result when the background refresh scheduler throws', async () => {
    // The refresh is a pure optimization; a failure in it must never break the
    // tool call the user actually asked for.
    vi.mocked(scheduleStaleConnectorToolsRefresh).mockImplementationOnce(() => {
      throw new Error('scheduler exploded');
    });
    vi.mocked(mcpService.callTool).mockResolvedValue({ success: true });
    const ctx = makeCtx([connector], [tool()]);

    const res = await callConnectorToolById({ identifier: 'my-conn', toolName: 'do_thing' }, ctx);

    expect(res).toEqual({ success: true });
    expect(mcpService.callTool).toHaveBeenCalledTimes(1);
  });
});
