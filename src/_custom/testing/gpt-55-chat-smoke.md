# GPT-5.5 Chat Smoke Test

Date: 2026-05-30

Environment:

- URL: `https://chatdev.cotticoffee.com/agent/agt_4qC5zJhhJIbi`
- Topic: `tpc_VDUKPUkIg4gQ`
- Display entry: `OpenAI` / `全能效率`
- Runtime route observed in Network: `POST /webapi/chat/azure`
- Model self-reported in test 1: `gpt-5.5`

## Runbook

Use Chrome DevTools MCP against the logged-in `chatdev.cotticoffee.com` session.

1. Open the agent URL and select `OpenAI` / `全能效率` in the model dropdown.
2. Send each prompt below in the same topic.
3. After each response, verify that the send button becomes idle again and no blocking toast is shown.
4. For search tests, confirm the page shows `搜索页面` tool calls and the related `search.webSearch` TRPC requests.
5. For artifact and diagram tests, confirm the right-side preview or modal renders, then reload the topic and confirm content persists.
6. Check Console and Network for failed chat/search/message requests.

## Test Cases

| ID | Prompt | Expected | 2026-05-30 Result |
| --- | --- | --- | --- |
| T1 | `测试1：请只回复 OK，并在同一句中写出你当前使用的模型展示名。` | Basic response returns quickly and stays on GPT-5.5. | Pass. Returned `OK，gpt-5.5`. |
| T2 | `测试2：请查询今天北京天气预报，给出温度、天气、风力，并明确数据日期。` | Application search is triggered and date-specific weather is returned. | Pass. Showed `搜索页面`; returned 2026-05-30 Beijing weather with source link. |
| T3 | `测试3：请查询今天国际新闻，选3条不同地区的重要新闻，用中文列出标题、地区、1句摘要和信息来源。` | Application search is triggered, answer includes 3 items and sources, and does not refuse. | Pass. Showed 4 search calls, returned 3 sourced international news items, and did not return `I'm sorry, but I cannot assist...`. |
| T4 | `测试4：不要联网。请根据这组数据计算 ROI 并按从高到低排序：A 成本200 收入230；B 成本500 收入590；C 成本80 收入91.2。输出表格。` | No search card required; calculations are correct. | Pass. Returned B=18%, A=15%, C=14% sorted correctly. |
| T5 | `测试5：请输出一个可预览的 lobeArtifact，类型为 text/html，标题为 gpt55-artifact-test，内容是一个完整 HTML 页面，页面中显示“GPT-5.5 Artifact 预览成功”和一个蓝色按钮。` | HTML artifact renders in the right-side preview. | Pass. Rendered `HTML preview` iframe with heading `GPT-5.5 Artifact 预览成功` and button `蓝色按钮`. |
| T6 | `测试6：请用 mermaid 画一个三步流程图：输入需求 -> 生成方案 -> 验证结果。只输出 mermaid 代码块。` | Mermaid output can be opened/rendered. | Pass. Generated `mermaid` block; clicking it opened the diagram preview modal. |
| T7 | Reload current topic after T1-T6. | Messages, artifact, and Mermaid content persist. | Pass. Reloaded topic and confirmed `GPT-5.5 Artifact 预览成功`, `mermaid`, `ROI`, and international-news content were still present. |

## Observations

- GPT-5.5 chat completions during this run used `POST /webapi/chat/azure`.
- Weather and international-news tests used application-side `search.webSearch` calls, not a model-builtin search-only path.
- The previous international-news refusal was not reproduced in this run.
- Artifact preview works with an explicit `lobeArtifact` request.
- Console after reload showed `market.oidc.refreshToken` 500 with `Invalid token response payload`. Chat, search, message, and reload requests still returned 200, so this is recorded as a non-blocking MarketAuth issue for this chat smoke test.
