import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DecryptedConnector } from '@/database/models/connector';

import { callFeishuSheetTool } from './feishuSheets';

const connector = {
  credentials: {
    accessToken: 'per-user-sheet-token',
    scope: 'sheets:spreadsheet:readonly',
    type: 'oauth2',
  },
} as DecryptedConnector;

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callFeishuSheetTool', () => {
  it('resolves a Wiki sheet and returns a bounded first worksheet page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: {
            node: {
              obj_token: 'spreadsheet-token',
              obj_type: 'sheet',
              title: '备案资料汇总',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: {
            sheets: [
              {
                grid_properties: { column_count: 5, row_count: 300 },
                hidden: false,
                index: 0,
                sheet_id: 'summary-sheet',
                title: '汇总',
              },
              {
                grid_properties: { column_count: 3, row_count: 20 },
                hidden: false,
                index: 1,
                sheet_id: 'detail-sheet',
                title: '明细',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: {
            revision: 7,
            valueRanges: [
              {
                range: 'summary-sheet!A1:E2',
                values: [
                  ['名称', '数量'],
                  ['A', 12],
                ],
              },
            ],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuSheetTool(
      connector,
      'fetch-sheet',
      JSON.stringify({
        column_limit: 5,
        document_id: 'https://example.feishu.cn/wiki/wiki-token',
        row_limit: 2,
      }),
    );
    const payload = JSON.parse(result.content as string);

    expect(payload).toMatchObject({
      has_more_rows: true,
      next_start_row: 3,
      range: 'summary-sheet!A1:E2',
      sheet: { sheet_id: 'summary-sheet', title: '汇总' },
      spreadsheet: { title: '备案资料汇总', token: 'spreadsheet-token' },
      values: [
        ['名称', '数量'],
        ['A', 12],
      ],
    });
    expect(payload.sheets).toHaveLength(2);

    const [wikiUrl, wikiInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(wikiUrl.pathname).toBe('/open-apis/wiki/v2/spaces/get_node');
    expect(wikiUrl.searchParams.get('token')).toBe('wiki-token');
    expect(wikiInit.headers).toMatchObject({ Authorization: 'Bearer per-user-sheet-token' });

    const [valuesUrl] = fetchMock.mock.calls[2] as [URL, RequestInit];
    expect(valuesUrl.pathname).toBe(
      '/open-apis/sheets/v2/spreadsheets/spreadsheet-token/values_batch_get',
    );
    expect(valuesUrl.searchParams.get('ranges')).toBe('summary-sheet!A1:E2');
    expect(valuesUrl.searchParams.get('valueRenderOption')).toBe('UnformattedValue');
    expect(valuesUrl.searchParams.get('dateTimeRenderOption')).toBe('FormattedString');
  });

  it('uses the worksheet selected in a direct sheets URL without a Wiki lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: {
            sheets: [
              {
                grid_properties: { column_count: 2, row_count: 2 },
                hidden: false,
                index: 0,
                sheet_id: 'first',
                title: 'First',
              },
              {
                grid_properties: { column_count: 2, row_count: 2 },
                hidden: false,
                index: 1,
                sheet_id: 'selected',
                title: 'Selected',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: { valueRanges: [{ values: [['selected-value']] }] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuSheetTool(
      connector,
      'fetch-sheet',
      JSON.stringify({
        document_id: 'https://example.feishu.cn/sheets/spreadsheet-token?sheet=selected',
      }),
    );
    const payload = JSON.parse(result.content as string);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload.sheet).toMatchObject({ sheet_id: 'selected', title: 'Selected' });
    const [valuesUrl] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(valuesUrl.searchParams.get('ranges')).toBe('selected!A1:B2');
  });

  it('rejects a Wiki node that is not an electronic spreadsheet', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      response({
        code: 0,
        data: { node: { obj_token: 'doc-token', obj_type: 'docx', title: 'Document' } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callFeishuSheetTool(
        connector,
        'fetch-sheet',
        '{"document_id":"https://example.feishu.cn/wiki/wiki-token"}',
      ),
    ).rejects.toThrow('not an electronic spreadsheet');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized page before sending any user data to Feishu', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callFeishuSheetTool(
        connector,
        'fetch-sheet',
        JSON.stringify({
          column_limit: 50,
          document_id: 'spreadsheet-token',
          row_limit: 200,
        }),
      ),
    ).rejects.toThrow('at most 5000 cells');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('truncates extremely long cells and marks the response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: {
            sheets: [
              {
                grid_properties: { column_count: 1, row_count: 1 },
                hidden: false,
                index: 0,
                sheet_id: 'sheet-1',
                title: 'Sheet 1',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          code: 0,
          data: { valueRanges: [{ values: [['x'.repeat(3000)]] }] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuSheetTool(
      connector,
      'fetch-sheet',
      '{"document_id":"spreadsheet-token"}',
    );
    const payload = JSON.parse(result.content as string);

    expect(payload.response_truncated).toBe(true);
    expect(payload.values[0][0]).toHaveLength(2001);
  });
});
