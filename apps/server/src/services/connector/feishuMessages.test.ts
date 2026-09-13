import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  callFeishuMessageTool,
  FEISHU_MESSAGE_TOOL_DEFINITIONS,
  FeishuMessageToolError,
} from './feishuMessages';

const connector = {
  credentials: { accessToken: 'per-user-token', type: 'oauth2' },
} as any;

const connectorWithMemberScope = {
  credentials: {
    accessToken: 'per-user-token',
    scope: 'im:chat.members:read',
    type: 'oauth2',
  },
} as any;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callFeishuMessageTool', () => {
  it('offers one direct tool for all, named-person, or named-group history', () => {
    expect(FEISHU_MESSAGE_TOOL_DEFINITIONS[0]).toMatchObject({
      defaultPermission: 'auto',
      displayName: '查询飞书聊天记录',
      toolName: 'query-chat-history',
    });
    expect(FEISHU_MESSAGE_TOOL_DEFINITIONS[0]).toMatchObject({
      inputSchema: {
        properties: {
          target_type: { default: 'all', enum: ['all', 'person', 'group'] },
        },
      },
    });
    expect(FEISHU_MESSAGE_TOOL_DEFINITIONS[0].description).toContain(
      'Always use this first for a daily report',
    );
  });

  it('reads every search page for a complete all-chat daily history', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              has_more: true,
              items: [{ message_id: 'om_1' }, { message_id: 'om_2' }],
              page_token: 'search-page-2',
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
              items: [
                {
                  body: { content: JSON.stringify({ text: '第一条' }) },
                  chat_id: 'oc_p2p',
                  create_time: '1786986000000',
                  message_id: 'om_1',
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
              items: [
                {
                  body: { content: JSON.stringify({ text: '第二条' }) },
                  chat_id: 'oc_group',
                  create_time: '1786989600000',
                  message_id: 'om_2',
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { has_more: false, items: ['om_3'] } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              items: [
                {
                  body: { content: JSON.stringify({ text: '第三条' }) },
                  chat_id: 'oc_p2p',
                  create_time: '1786993200000',
                  message_id: 'om_3',
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'query-chat-history',
      JSON.stringify({ date: '2026-08-18' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      complete: true,
      has_more: false,
      items: [{ text: '第一条' }, { text: '第二条' }, { text: '第三条' }],
      message_count: 3,
      pages_read: 2,
      status: 'found',
      target_type: 'all',
      time_zone: 'Asia/Shanghai',
    });
    const [secondSearchUrl, secondSearchInit] = fetchMock.mock.calls[3] as [URL, RequestInit];
    expect(secondSearchUrl.searchParams.get('page_token')).toBe('search-page-2');
    expect(JSON.parse(secondSearchInit.body as string)).not.toHaveProperty('chat_type');
    expect(result.content).not.toContain('search-page-2');
    expect(result.content).not.toContain('oc_p2p');
  });

  it('treats a blank named target as an all-chat daily history', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 0, data: { has_more: false, items: ['om_private'] } }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              items: [
                {
                  body: { content: JSON.stringify({ text: '单聊日报内容' }) },
                  chat_id: 'oc_private',
                  create_time: '1786986000000',
                  message_id: 'om_private',
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'query-chat-history',
      JSON.stringify({ date: '2026-08-18', target_name: '', target_type: 'person' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      complete: true,
      items: [{ text: '单聊日报内容' }],
      message_count: 1,
      status: 'found',
      target_type: 'all',
    });
    const [, searchInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(searchInit.body as string)).not.toHaveProperty('chat_type');
  });

  it('does not report a complete day when a matched message detail cannot be read', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 0, data: { has_more: false, items: ['om_unavailable'] } }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 230001, msg: 'message unavailable' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'query-chat-history',
      JSON.stringify({ date: '2026-08-18', target_type: 'all' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      complete: false,
      failed_message_count: 1,
      has_more: false,
      incomplete_reason: 'message_detail_errors',
      message_count: 0,
      pages_read: 1,
    });
    expect(result.content).toContain('do not call it a complete daily report');
  });

  it('resolves an exact mentioned person and returns the complete p2p day in one call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { items: [{ message_id: 'om_mention' }] } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              items: [
                {
                  body: { content: JSON.stringify({ text: '@_user_1 中午吃饭么？' }) },
                  chat_id: 'oc_group',
                  mentions: [{ id: 'ou_feng', key: '@_user_1', name: '冯鑫' }],
                  message_id: 'om_mention',
                  sender: { id: 'ou_someone' },
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { items: ['om_p2p'] } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              items: [
                {
                  body: { content: JSON.stringify({ text: '我开了' }) },
                  chat_id: 'oc_p2p',
                  message_id: 'om_p2p',
                  sender: { id: 'ou_feng' },
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
              items: [
                {
                  body: { content: JSON.stringify({ text: '我开了' }) },
                  chat_id: 'oc_p2p',
                  create_time: '1786156809000',
                  message_id: 'om_1',
                  sender: { id: 'ou_feng' },
                },
                {
                  body: { content: JSON.stringify({ text: '抽烟遇到的同事是 @闫亚军' }) },
                  chat_id: 'oc_p2p',
                  create_time: '1786164823000',
                  message_id: 'om_2',
                  sender: { id: 'ou_me' },
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'query-chat-history',
      JSON.stringify({ date: '2026-08-08', target_name: '冯鑫', target_type: 'person' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      date: '2026-08-08',
      items: [
        { sender_name: '冯鑫', text: '我开了' },
        { sender_name: '我', text: '抽烟遇到的同事是 @闫亚军' },
      ],
      message_count: 2,
      status: 'found',
      target_name: '冯鑫',
      target_type: 'person',
      time_zone: 'Asia/Shanghai',
    });
    const [, p2pSearchInit] = fetchMock.mock.calls[2] as [URL, RequestInit];
    expect(JSON.parse(p2pSearchInit.body as string)).toMatchObject({
      chat_type: 'p2p_chat',
      from_ids: ['ou_feng'],
      query: '',
    });
    const [historyUrl] = fetchMock.mock.calls[4] as [URL];
    expect(historyUrl.searchParams.get('container_id')).toBe('oc_p2p');
    expect(historyUrl.searchParams.get('start_time')).toBe('1786118400');
    expect(historyUrl.searchParams.get('end_time')).toBe('1786204799');
    expect(result.content).not.toContain('ou_feng');
    expect(result.content).not.toContain('oc_p2p');
  });

  it('resolves an exact group name and returns its day without asking for a link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { has_more: false, items: [{ chat_id: 'oc_people', name: '人' }] },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              has_more: true,
              items: [
                {
                  body: { content: JSON.stringify({ text: '中午吃饭么？' }) },
                  chat_id: 'oc_people',
                  create_time: '1786152815000',
                  message_id: 'om_group',
                  sender: { id: 'ou_liu' },
                },
              ],
              page_token: 'group-page-2',
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { has_more: false, items: [{ member_id: 'ou_liu', name: '刘悦祥' }] },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              has_more: false,
              items: [
                {
                  body: { content: JSON.stringify({ text: '第二页消息' }) },
                  chat_id: 'oc_people',
                  create_time: '1786152875000',
                  message_id: 'om_group_2',
                  sender: { id: 'ou_liu' },
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
            data: { has_more: false, items: [{ member_id: 'ou_liu', name: '刘悦祥' }] },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connectorWithMemberScope,
      'query-chat-history',
      JSON.stringify({ date: '2026-08-08', target_name: '人', target_type: 'group' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      complete: true,
      items: [
        { sender_name: '刘悦祥', text: '中午吃饭么？' },
        { sender_name: '刘悦祥', text: '第二页消息' },
      ],
      message_count: 2,
      pages_read: 2,
      status: 'found',
      target_name: '人',
      target_type: 'group',
    });
    const [secondHistoryUrl] = fetchMock.mock.calls[3] as [URL];
    expect(secondHistoryUrl.searchParams.get('page_token')).toBe('group-page-2');
    expect(result.content).not.toContain('oc_people');
    expect(result.content).not.toContain('ou_liu');
  });

  it('returns an explicit continuation instead of overflowing a daily history result', async () => {
    const createItems = (prefix: string) =>
      Array.from({ length: 10 }, (_, index) => ({
        body: { content: JSON.stringify({ text: `${prefix}-${index}-${'字'.repeat(1000)}` }) },
        chat_id: 'oc_large_group',
        message_id: `${prefix}-${index}`,
      }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { has_more: false, items: [{ chat_id: 'oc_large_group', name: '大群' }] },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { has_more: true, items: createItems('first'), page_token: 'large-page-2' },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 0, data: { has_more: false, items: createItems('second') } }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'query-chat-history',
      JSON.stringify({
        date: '2026-08-08',
        page_size: 10,
        target_name: '大群',
        target_type: 'group',
      }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      complete: false,
      continuation_page_token: 'large-page-2',
      has_more: true,
      incomplete_reason: 'result_size_limit',
      message_count: 10,
      pages_read: 1,
    });
    expect(result.content).toContain('do not call it a complete daily report');
    expect(result.content.length).toBeLessThan(25_000);
  });

  it('orders group discovery by recent activity and explains the p2p search boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { items: [] } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(connector, 'list-group-chats', '{}');

    const [requestUrl] = fetchMock.mock.calls[0] as [URL];
    expect(requestUrl.searchParams.get('sort_type')).toBe('ByActiveTimeDesc');
    expect(result.state?.structuredContent).toMatchObject({
      capability: {
        p2p_discovery: false,
        p2p_read_by_known_chat_id: true,
        p2p_search_tool: 'search-chat-messages',
      },
    });
  });

  it('searches the current user p2p messages by time and hydrates matched message ids', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              has_more: true,
              items: [{ message_id: 'om_1' }, 'om_2'],
              page_token: 'next-page',
            },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 0, data: { items: [{ body: { content: 'hello' } }] } }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 230001, msg: 'message unavailable' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'search-chat-messages',
      JSON.stringify({
        chat_type: 'p2p_chat',
        end_time: 1_786_118_399,
        page_size: 2,
        query: '',
        start_time: '1786032000',
      }),
    );

    const [searchUrl, searchInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(searchUrl.origin + searchUrl.pathname).toBe(
      'https://open.feishu.cn/open-apis/search/v2/message',
    );
    expect(searchUrl.searchParams.get('page_size')).toBe('2');
    expect(searchUrl.searchParams.get('user_id_type')).toBe('open_id');
    expect(searchInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(searchInit.body as string)).toMatchObject({
      chat_type: 'p2p_chat',
      end_time: '1786118399',
      query: '',
      start_time: '1786032000',
    });
    expect(result.state?.structuredContent).toMatchObject({
      applied_filters: {
        chat_type: 'p2p_chat',
        end_time: 1_786_118_399,
        query: '',
        start_time: '1786032000',
        time_zone: 'Asia/Shanghai',
      },
      has_more: true,
      identity_resolution_warning: expect.stringContaining('im:chat.members:read'),
      items: [
        {
          content: { text: 'hello', truncated: false },
          sender: { name_verified: false },
          text_for_analysis: 'hello',
        },
      ],
      matched_count: 2,
      errors: [{ error: 'Feishu OpenAPI error 230001: message unavailable', message_id: 'om_2' }],
      page_token: 'next-page',
      time_zone: 'Asia/Shanghai',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [detailUrl] = fetchMock.mock.calls[1] as [URL];
    expect(detailUrl.searchParams.get('card_msg_content_type')).toBe('user_card_content');
  });

  it('converts a calendar date in the requested timezone into an exact API range', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { items: [] } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'search-chat-messages',
      JSON.stringify({ date: '2026-08-08', query: '冯鑫', time_zone: 'Asia/Shanghai' }),
    );

    const [searchUrl, searchInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(searchUrl.searchParams.get('page_size')).toBe('10');
    expect(JSON.parse(searchInit.body as string)).toMatchObject({
      end_time: '1786204799',
      query: '冯鑫',
      start_time: '1786118400',
    });
    expect(result.state?.structuredContent).toMatchObject({
      applied_filters: {
        date: '2026-08-08',
        end_time: 1_786_204_799,
        start_time: 1_786_118_400,
        time_zone: 'Asia/Shanghai',
      },
    });
  });

  it('rejects an invalid message search time range before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callFeishuMessageTool(
        connector,
        'search-chat-messages',
        JSON.stringify({ end_time: 100, start_time: 101 }),
      ),
    ).rejects.toBeInstanceOf(FeishuMessageToolError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns deterministic local time and never infers a sender name from mentions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            items: [
              {
                body: { content: JSON.stringify({ text: '@_user_1 中午吃饭么？' }) },
                chat_id: 'oc_people',
                create_time: '1786152815000',
                mentions: [{ id: 'ou_feng', key: '@_user_1', name: '冯鑫' }],
                message_id: 'om_mention',
                sender: { id: 'ou_sender', id_type: 'open_id', sender_type: 'user' },
              },
            ],
          },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'list-chat-messages',
      JSON.stringify({ chat_id: 'oc_people' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      applied_filters: { range_filter_applied: false },
      identity_resolution_warning: expect.stringContaining('sender.id'),
      items: [
        {
          content: { text: '@冯鑫 中午吃饭么？', truncated: false },
          create_time_local: '2026-08-08 09:33:35',
          create_time_ms: '1786152815000',
          sender: { id: 'ou_sender', name_verified: false },
          text_for_analysis: '@冯鑫 中午吃饭么？',
        },
      ],
      range_warning: expect.stringContaining('No time range was applied'),
      time_zone: 'Asia/Shanghai',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchMock.mock.calls[0] as [URL];
    expect(requestUrl.searchParams.get('card_msg_content_type')).toBe('user_card_content');
  });

  it('flattens a rich post into one plain-text record for reporting', async () => {
    const richPost = {
      content: [
        [{ height: 1634, image_key: 'img_v3_example', tag: 'img', width: 2646 }],
        [
          { tag: 'at', user_id: '@_user_1', user_name: '冯鑫' },
          { tag: 'text', text: ' 这里点进去的' },
        ],
      ],
      content_v2: [
        [{ height: 1634, image_key: 'img_v3_example', tag: 'img', width: 2646 }],
        [
          { tag: 'at', user_id: '@_user_1', user_name: '冯鑫' },
          { tag: 'text', text: ' 这里点进去的' },
        ],
      ],
      title: '',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            items: [
              {
                body: { content: JSON.stringify(richPost) },
                chat_id: 'oc_people',
                create_time: '1786176404000',
                message_id: 'om_rich_post',
                msg_type: 'post',
              },
            ],
          },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'list-chat-messages',
      JSON.stringify({ chat_id: 'oc_people' }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      format: 'plain_text',
      items: [
        {
          content: {
            links: [],
            resources: [{ height: 1634, key: 'img_v3_example', type: 'image', width: 2646 }],
            text: '@冯鑫 这里点进去的',
            truncated: false,
          },
          text_for_analysis: '@冯鑫 这里点进去的\n[图片 2646x1634]',
        },
      ],
    });
    expect(result.state?.content).toEqual([expect.objectContaining({ type: 'text' })]);
    const payload = result.state?.structuredContent as {
      items: Array<{ text_for_analysis: string }>;
    };
    expect(payload.items[0]?.text_for_analysis.match(/这里点进去的/g)).toHaveLength(1);
    expect(result.content).not.toContain('applink.feishu.cn');
  });

  it('uses the group member endpoint to resolve a verified sender name', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              items: [
                {
                  body: { content: JSON.stringify({ text: 'go go go' }) },
                  chat_id: 'oc_people',
                  create_time: '1786159562000',
                  message_id: 'om_go',
                  sender: { id: 'ou_fu', id_type: 'open_id', sender_type: 'user' },
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
            data: { has_more: false, items: [{ member_id: 'ou_fu', name: '富伟' }] },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connectorWithMemberScope,
      'list-chat-messages',
      JSON.stringify({
        chat_id: 'oc_people',
        end_time: '1786204799',
        start_time: '1786118400',
      }),
    );

    expect(result.state?.structuredContent).toMatchObject({
      applied_filters: { range_filter_applied: true },
      items: [
        {
          content: { text: 'go go go' },
          create_time_local: '2026-08-08 11:26:02',
          sender: { id: 'ou_fu', name: '富伟', name_verified: true },
        },
      ],
    });
    const [memberUrl] = fetchMock.mock.calls[1] as [URL];
    expect(memberUrl.pathname).toBe('/open-apis/im/v1/chats/oc_people/members');
  });

  it('caps rich message content and always returns valid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            items: [
              {
                body: {
                  content: JSON.stringify({
                    elements: [{ tag: 'markdown', text: '很长的卡片内容'.repeat(1000) }],
                  }),
                },
                message_id: 'om_large',
              },
            ],
          },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'list-chat-messages',
      JSON.stringify({ chat_id: 'oc_people' }),
    );
    const parsed = JSON.parse(result.content) as {
      items: Array<{ content: { text: string; truncated: boolean } }>;
    };

    expect(parsed.items[0]?.content.text.length).toBeLessThanOrEqual(1000);
    expect(parsed.items[0]?.content.truncated).toBe(true);
  });

  it('always uses Asia/Shanghai even when the model supplies another time zone', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: { items: [{ create_time: '1786152815000', message_id: 'om_1' }] },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callFeishuMessageTool(
      connector,
      'list-chat-messages',
      JSON.stringify({
        chat_id: 'oc_people',
        date: '2026-08-08',
        time_zone: 'America/Los_Angeles',
      }),
    );
    const [requestUrl] = fetchMock.mock.calls[0] as [URL];

    expect(requestUrl.searchParams.get('start_time')).toBe('1786118400');
    expect(requestUrl.searchParams.get('end_time')).toBe('1786204799');
    expect(result.state?.structuredContent).toMatchObject({
      time_zone: 'Asia/Shanghai',
    });
  });
});
