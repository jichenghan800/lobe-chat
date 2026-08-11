import { z } from 'zod';

import { FEISHU_DOCUMENTS_SHEET_TOOLS } from '@/const/connectorPresets';
import type { DecryptedConnector } from '@/database/models/connector';
import { ConnectorToolPermission, ToolCRUDType } from '@/database/schemas';
import type { MCPToolCallResult } from '@/libs/mcp';

const FEISHU_OPEN_API_ORIGIN = 'https://open.feishu.cn';
const FEISHU_OPEN_API_TIMEOUT_MS = 20_000;
const DEFAULT_ROW_LIMIT = 100;
const DEFAULT_COLUMN_LIMIT = 30;
const MAX_ROW_LIMIT = 200;
const MAX_COLUMN_LIMIT = 50;
const MAX_CELL_COUNT = 5000;
const MAX_CELL_TEXT_LENGTH = 2000;
const MAX_RESULT_TEXT_LENGTH = 120_000;

const fetchSheetArgsSchema = z
  .object({
    column_limit: z.number().int().min(1).max(MAX_COLUMN_LIMIT).optional(),
    document_id: z.string().trim().min(1),
    row_limit: z.number().int().min(1).max(MAX_ROW_LIMIT).optional(),
    sheet_id: z.string().trim().min(1).optional(),
    start_row: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const rowLimit = value.row_limit ?? DEFAULT_ROW_LIMIT;
    const columnLimit = value.column_limit ?? DEFAULT_COLUMN_LIMIT;
    if (rowLimit * columnLimit > MAX_CELL_COUNT) {
      ctx.addIssue({
        code: 'custom',
        message: `The requested page must contain at most ${MAX_CELL_COUNT} cells`,
      });
    }
  });

export const FEISHU_SHEET_TOOL_DEFINITIONS = [
  {
    crudType: ToolCRUDType.read,
    defaultPermission: ConnectorToolPermission.auto,
    description:
      'Read one bounded page from a Feishu electronic spreadsheet using the current user authorization. Accepts a Feishu wiki URL, sheets URL, or spreadsheet token. If sheet_id is omitted, reads the first visible worksheet and returns all worksheet metadata. Use next_start_row and repeat for additional pages; use sheet_id to read other worksheets. Use this tool instead of fetch-doc for electronic spreadsheets.',
    displayName: '读取飞书电子表格',
    inputSchema: {
      additionalProperties: false,
      properties: {
        column_limit: {
          default: DEFAULT_COLUMN_LIMIT,
          description: `Maximum columns to return, from 1 to ${MAX_COLUMN_LIMIT}. row_limit × column_limit must not exceed ${MAX_CELL_COUNT}.`,
          maximum: MAX_COLUMN_LIMIT,
          minimum: 1,
          type: 'integer',
        },
        document_id: {
          description:
            'Feishu wiki URL, sheets URL, or spreadsheet token. Pass the exact user-provided link; do not guess a token.',
          type: 'string',
        },
        row_limit: {
          default: DEFAULT_ROW_LIMIT,
          description: `Maximum rows to return, from 1 to ${MAX_ROW_LIMIT}.`,
          maximum: MAX_ROW_LIMIT,
          minimum: 1,
          type: 'integer',
        },
        sheet_id: {
          description:
            'Worksheet ID returned by a previous call. Omit to read the first visible worksheet.',
          type: 'string',
        },
        start_row: {
          default: 1,
          description: 'One-based first row to read. Use next_start_row to continue.',
          minimum: 1,
          type: 'integer',
        },
      },
      required: ['document_id'],
      type: 'object',
    },
    toolName: 'fetch-sheet',
  },
] as const;

export class FeishuSheetToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeishuSheetToolError';
  }
}

interface FeishuApiResponse<T> {
  code?: number;
  data?: T;
  msg?: string;
}

interface FeishuSheet {
  grid_properties?: {
    column_count?: number;
    row_count?: number;
  };
  hidden?: boolean;
  index?: number;
  sheet_id: string;
  title?: string;
}

interface FeishuSheetListData {
  sheets?: FeishuSheet[];
}

interface FeishuWikiNodeData {
  node?: {
    obj_token?: string;
    obj_type?: string;
    title?: string;
  };
}

interface FeishuValueRange {
  range?: string;
  values?: unknown[][];
}

interface FeishuValuesData {
  revision?: number;
  totalCells?: number;
  valueRanges?: FeishuValueRange[];
}

interface DocumentReference {
  requestedSheetId?: string;
  spreadsheetToken?: string;
  wikiToken?: string;
}

const parseArgs = (args?: string) => {
  let value: unknown;
  try {
    value = JSON.parse(args || '{}');
  } catch {
    throw new FeishuSheetToolError('Tool arguments must be valid JSON');
  }

  const result = fetchSheetArgsSchema.safeParse(value);
  if (!result.success) {
    throw new FeishuSheetToolError(`Invalid tool arguments: ${result.error.issues[0]?.message}`);
  }

  return result.data;
};

const getUserAccessToken = (connector: DecryptedConnector): string => {
  if (connector.credentials?.type !== 'oauth2' || !connector.credentials.accessToken) {
    throw new FeishuSheetToolError('Feishu user authorization is missing');
  }

  return connector.credentials.accessToken;
};

const callFeishuApi = async <T>(
  connector: DecryptedConnector,
  path: string,
  query: Record<string, number | string | undefined> = {},
): Promise<T> => {
  const url = new URL(path, FEISHU_OPEN_API_ORIGIN);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${getUserAccessToken(connector)}`,
      },
      signal: AbortSignal.timeout(FEISHU_OPEN_API_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network request failed';
    throw new FeishuSheetToolError(`Feishu OpenAPI request failed: ${message}`);
  }

  let payload: FeishuApiResponse<T>;
  try {
    payload = (await response.json()) as FeishuApiResponse<T>;
  } catch {
    throw new FeishuSheetToolError(`Feishu OpenAPI returned HTTP ${response.status}`);
  }

  if (!response.ok || (payload.code !== undefined && payload.code !== 0)) {
    const code = payload.code ?? response.status;
    const reason = payload.msg || response.statusText || 'request rejected';
    throw new FeishuSheetToolError(`Feishu OpenAPI error ${code}: ${reason}`);
  }

  if (payload.data === undefined) {
    throw new FeishuSheetToolError('Feishu OpenAPI returned no data');
  }

  return payload.data;
};

const parseDocumentReference = (documentId: string): DocumentReference => {
  let url: URL;
  try {
    url = new URL(documentId);
  } catch {
    return { spreadsheetToken: documentId };
  }

  const wikiMatch = url.pathname.match(/\/wiki\/([^/?#]+)/);
  if (wikiMatch?.[1]) return { wikiToken: wikiMatch[1] };

  const sheetMatch = url.pathname.match(/\/sheets\/([^/?#]+)/);
  if (sheetMatch?.[1]) {
    return {
      requestedSheetId: url.searchParams.get('sheet') || undefined,
      spreadsheetToken: sheetMatch[1],
    };
  }

  throw new FeishuSheetToolError(
    'Unsupported Feishu link. Provide a wiki URL, sheets URL, or spreadsheet token',
  );
};

const resolveSpreadsheet = async (
  connector: DecryptedConnector,
  documentId: string,
): Promise<{ spreadsheetToken: string; title?: string; requestedSheetId?: string }> => {
  const reference = parseDocumentReference(documentId);
  if (reference.spreadsheetToken) {
    return {
      requestedSheetId: reference.requestedSheetId,
      spreadsheetToken: reference.spreadsheetToken,
    };
  }

  const data = await callFeishuApi<FeishuWikiNodeData>(
    connector,
    '/open-apis/wiki/v2/spaces/get_node',
    { token: reference.wikiToken },
  );
  const node = data.node;
  if (!node?.obj_token) {
    throw new FeishuSheetToolError('Feishu Wiki node did not return a document token');
  }
  if (node.obj_type !== 'sheet') {
    throw new FeishuSheetToolError(
      `The Feishu Wiki node is ${node.obj_type || 'an unknown type'}, not an electronic spreadsheet`,
    );
  }

  return { spreadsheetToken: node.obj_token, title: node.title };
};

const toColumnName = (columnNumber: number): string => {
  let current = columnNumber;
  let result = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
};

const normalizeCell = (
  value: unknown,
): { truncated: boolean; value: boolean | null | number | string } => {
  if (value === undefined) return { truncated: false, value: null };
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return { truncated: false, value };
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value) || String(value);
  if (text.length <= MAX_CELL_TEXT_LENGTH) return { truncated: false, value: text };

  return { truncated: true, value: `${text.slice(0, MAX_CELL_TEXT_LENGTH)}…` };
};

const toToolResult = (payload: Record<string, unknown>): MCPToolCallResult => {
  const content = JSON.stringify(payload, null, 2);
  return {
    content,
    state: {
      content: [{ text: content, type: 'text' }],
      structuredContent: payload,
    },
    success: true,
  };
};

export const isFeishuSheetTool = (toolName: string): boolean =>
  (FEISHU_DOCUMENTS_SHEET_TOOLS as readonly string[]).includes(toolName);

export const callFeishuSheetTool = async (
  connector: DecryptedConnector,
  toolName: string,
  args?: string,
): Promise<MCPToolCallResult> => {
  if (!isFeishuSheetTool(toolName)) {
    throw new FeishuSheetToolError(`Unsupported Feishu sheet tool: ${toolName}`);
  }

  const input = parseArgs(args);
  const spreadsheet = await resolveSpreadsheet(connector, input.document_id);
  const sheetList = await callFeishuApi<FeishuSheetListData>(
    connector,
    `/open-apis/sheets/v3/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetToken)}/sheets/query`,
  );
  const sheets = [...(sheetList.sheets || [])].sort(
    (first, second) => (first.index ?? 0) - (second.index ?? 0),
  );
  if (sheets.length === 0) {
    throw new FeishuSheetToolError('The Feishu spreadsheet contains no worksheets');
  }

  const requestedSheetId = input.sheet_id || spreadsheet.requestedSheetId;
  const selectedSheet = requestedSheetId
    ? sheets.find((sheet) => sheet.sheet_id === requestedSheetId)
    : sheets.find((sheet) => !sheet.hidden) || sheets[0];
  if (!selectedSheet) {
    throw new FeishuSheetToolError(`Worksheet '${requestedSheetId}' was not found`);
  }

  const startRow = input.start_row ?? 1;
  const rowLimit = input.row_limit ?? DEFAULT_ROW_LIMIT;
  const columnLimit = Math.min(
    input.column_limit ?? DEFAULT_COLUMN_LIMIT,
    selectedSheet.grid_properties?.column_count || MAX_COLUMN_LIMIT,
  );
  const rowCount = selectedSheet.grid_properties?.row_count;
  const requestedRowCount = rowCount
    ? Math.max(0, Math.min(rowLimit, rowCount - startRow + 1))
    : rowLimit;
  const publicSheets = sheets.map((sheet) => ({
    column_count: sheet.grid_properties?.column_count,
    hidden: sheet.hidden ?? false,
    row_count: sheet.grid_properties?.row_count,
    sheet_id: sheet.sheet_id,
    title: sheet.title,
  }));

  if (requestedRowCount === 0) {
    return toToolResult({
      has_more_rows: false,
      sheet: publicSheets.find((sheet) => sheet.sheet_id === selectedSheet.sheet_id),
      sheets: publicSheets,
      spreadsheet: { title: spreadsheet.title, token: spreadsheet.spreadsheetToken },
      start_row: startRow,
      values: [],
    });
  }

  const endRow = startRow + requestedRowCount - 1;
  const range = `${selectedSheet.sheet_id}!A${startRow}:${toColumnName(columnLimit)}${endRow}`;
  const valuesData = await callFeishuApi<FeishuValuesData>(
    connector,
    `/open-apis/sheets/v2/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetToken)}/values_batch_get`,
    {
      dateTimeRenderOption: 'FormattedString',
      ranges: range,
      user_id_type: 'open_id',
      valueRenderOption: 'UnformattedValue',
    },
  );

  let cellWasTruncated = false;
  const sourceRows = valuesData.valueRanges?.[0]?.values || [];
  const normalizedRows = sourceRows.map((row) =>
    row.slice(0, columnLimit).map((cell) => {
      const normalized = normalizeCell(cell);
      cellWasTruncated ||= normalized.truncated;
      return normalized.value;
    }),
  );
  const rows = [...normalizedRows];
  let resultWasTruncated = false;
  const buildPayload = () => {
    const wasShortenedForOutput = rows.length < normalizedRows.length;
    const filledRequestedPage = normalizedRows.length === requestedRowCount;
    const hasMoreRows =
      wasShortenedForOutput || (filledRequestedPage && rowCount !== undefined && endRow < rowCount);
    const consumedRows = wasShortenedForOutput ? rows.length : requestedRowCount;

    return {
      has_more_rows: hasMoreRows,
      next_start_row: hasMoreRows ? startRow + Math.max(consumedRows, 1) : undefined,
      range,
      response_truncated: resultWasTruncated || cellWasTruncated,
      revision: valuesData.revision,
      sheet: publicSheets.find((sheet) => sheet.sheet_id === selectedSheet.sheet_id),
      sheets: publicSheets,
      spreadsheet: { title: spreadsheet.title, token: spreadsheet.spreadsheetToken },
      start_row: startRow,
      values: rows,
    };
  };

  while (rows.length > 1 && JSON.stringify(buildPayload()).length > MAX_RESULT_TEXT_LENGTH) {
    rows.pop();
    resultWasTruncated = true;
  }

  return toToolResult(buildPayload());
};
