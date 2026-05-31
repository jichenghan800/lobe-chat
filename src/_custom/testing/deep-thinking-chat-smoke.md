# Deep Thinking Chat Smoke Test

Date: 2026-05-31

Environment:

- URL: `https://chatdev.cotticoffee.com/agent/agt_4qC5zJhhJIbi`
- Topic: `tpc_LjWc0hqv806y`
- Display entry: `Claude` / `深度思考`
- Runtime route observed in Network: `POST /webapi/chat/anthropic`
- Runtime model observed in request body: `claude-opus-4-7`

## Runbook

Use Chrome DevTools MCP against the logged-in `chatdev.cotticoffee.com` session.

1. Open the agent URL and select `Claude` / `深度思考` in the model dropdown.
2. Send each prompt below in the same topic.
3. After each response, verify that the send button becomes idle again and no blocking toast is shown.
4. Confirm Network shows `POST /webapi/chat/anthropic` returning 200 for each chat completion.
5. Check Console and Network for failed chat/message requests.

## Test Cases

| ID | Prompt | Expected | 2026-05-31 Result |
| --- | --- | --- | --- |
| T1 | `请用中文简短回答：本轮是深度思考模型基础自测。请完成三项：1）一句话确认你已收到；2）计算 37+58；3）给出一个 3 点清单，说明你适合处理什么类型的复杂任务。` | Basic response returns, arithmetic is correct, and the reply stays on the selected Claude model. | Pass. Returned receipt confirmation, `37 + 58 = 95`, and three suitable complex-task categories. Network `POST /webapi/chat/anthropic` returned 200. |
| T2 | `请只输出合法 JSON，不要解释：把三项商品整理成数组，每项包含 name、price、temperature。数据：咖啡/15/热；茶/12/冷；牛奶/10/冷。` | Valid JSON code block with three objects and correct fields. | Pass. Returned a JSON block containing `咖啡/15/热`, `茶/12/冷`, and `牛奶/10/冷`. Network `POST /webapi/chat/anthropic` returned 200. |
| T3 | `请生成一个极简单页 HTML 代码块，不要外链资源。要求：标题“深度思考测试页”，两张信息卡片，一个按钮，内联 CSS，整体不超过 80 行。` | HTML code block renders in the built-in preview area and includes the requested title, cards, button, and inline CSS. | Pass. Returned an HTML block, the page showed the built-in `Preview` / `Source` segmented control, and the rendered/source content included `深度思考测试页`, inline CSS, cards, and a button. Network `POST /webapi/chat/anthropic` returned 200. |
| T4 | `请联网查询今天北京天气预报，给出数据日期、温度范围、天气状况、风力，并列出你参考的信息来源。` | Search tool is triggered, search request returns 200, and the final answer includes date, weather, wind, and sources. | Pass. Page showed `搜索页面: 北京今天天气预报 2026年5月31日 温度 风力`; Network `GET /trpc/tools/search.webSearch` returned 200, followed by `POST /webapi/chat/anthropic` 200. Answer included `2026年5月31日`, `21℃ ~ 33℃`, weather/wind details, and cited sources such as 北京日报、搜狐、新浪财经、我的家天气网. |

## Observations

- The selected `深度思考` entry maps to Anthropic on the runtime route and uses model `claude-opus-4-7`.
- The chat request body for this run included `thinking: { type: "disabled" }`; this test therefore validates the configured Claude chat path, not an explicit extended-thinking mode.
- Network search behavior for T4 used the platform search tool route `GET /trpc/tools/search.webSearch`, then fed the result back into Anthropic for the final response. This validates the app-side search tool chain; it does not prove Anthropic native built-in web search was used.
- No Console errors or warnings were found after these chat tests.
- Network still contained earlier non-chat `market.connectListConnections` 500 entries from the current session, but no chat, message-send, or message-update failure was observed during this run.
