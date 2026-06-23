# Gemini 3.5 Flash Chat Smoke Test

Date: 2026-05-30

Environment:

- URL: `https://chatdev.cotticoffee.com/agent/agt_4qC5zJhhJIbi`
- Topic: `tpc_NPjkfuT6N3EP`
- Display entry: `Gemini` / `灵感探索`
- Runtime route observed in Network: `POST /webapi/chat/vertexai`
- Model self-reported in test 1: `gemini-3.5-flash`

## Runbook

Use Chrome DevTools MCP against the logged-in `chatdev.cotticoffee.com` session.

1. Open the agent URL and select `Gemini` / `灵感探索` in the model dropdown.
2. Send each prompt below in the same topic unless isolation is required.
3. After each response, verify that the send button becomes idle again and no blocking toast is shown.
4. For search tests, confirm the page shows a search result card such as `找到 N 条结果`.
5. For artifact tests, confirm the right-side preview or modal renders, then reload the topic and confirm it persists.
6. Check Console for errors and Network for failed chat/TRPC requests.

## Test Cases

| ID  | Prompt                                                                                                                                                                                                                                                                    | Expected                                                                   | 2026-05-30 Result                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| T1  | `测试1：请只回复 OK，并在同一句中写出你当前使用的模型展示名。`                                                                                                                                                                                                            | Basic response returns quickly and stays on Gemini.                        | Pass. Returned `OK，当前使用的模型展示名是 gemini-3.5-flash。`                                  |
| T2  | `测试2：请查询今天北京天气预报，给出温度、天气、风力，并明确数据日期。`                                                                                                                                                                                                   | Search is triggered, date-specific weather is returned.                    | Pass. Showed `找到 2 条结果`; returned 2026-05-30 Beijing weather.                              |
| T3  | `测试3：请查询今天国际新闻，选3条不同地区的重要新闻，用中文列出标题、地区、1句摘要和信息来源。`                                                                                                                                                                           | Search is triggered, answer includes 3 items and sources.                  | Pass for search plumbing. Showed `找到 4 条结果`; factual quality still needs spot-checking.    |
| T4  | `测试4：不联网，帮我把这组数据做成简短表格并给出结论：A店 120杯/收入1800元，B店 95杯/收入1710元，C店 140杯/收入1960元。请计算各店客单价并排序。`                                                                                                                          | No search card required; calculations are correct.                         | Pass. Returned B=18.00, A=15.00, C=14.00 and sorted correctly.                                  |
| T5  | `测试5：创建一个可预览的 HTML Artifact：主题是“咖啡门店日销售看板”，包含3个指标卡、一个简单柱状图和一句运营建议。要求单文件 HTML/CSS/JS，不依赖外部 CDN。`                                                                                                                | Ideally creates previewable HTML artifact.                                 | Partial. Gemini emitted `<Artifact>` as ordinary XML/code, not a rendered artifact.             |
| T5b | `测试5补测：请重新生成为平台可预览的 artifact，必须使用小写标签 <lobeArtifact identifier="coffee-dashboard-v2" type="text/html" title="咖啡门店日销售看板"> 包裹完整 HTML，结尾使用 </lobeArtifact>。内容仍然是3个指标卡、简单柱状图和一句运营建议，单文件且不依赖 CDN。` | HTML artifact renders in preview and persists.                             | Pass. Rendered `HTML preview` iframe and right-side artifact panel.                             |
| T6  | `测试6：请生成一个 Mermaid 流程图，描述“用户提问 -> 判断是否需要联网 -> 搜索 -> 整理答案 -> 返回用户”的流程。要求可直接渲染，不要解释太多。`                                                                                                                              | Mermaid output can be opened/rendered.                                     | Pass. Generated `mermaid` block; clicking it opened the diagram preview modal.                  |
| T7  | Reload current topic after T1-T6.                                                                                                                                                                                                                                         | Messages and artifact preview persist.                                     | Pass. Topic reloaded with messages and `咖啡门店日销售看板` artifact restored.                  |
| T8  | `测试8：请只输出一个完整的 HTML 代码块，做一个极简网页，标题是“下载按钮测试”，正文只有一句“如果下载后这段回答仍可见，则测试通过”。不要使用 artifact 标签。`                                                                                                               | HTML preview opens, download button works, and the answer remains visible. | Pass. Opened HTML preview modal, clicked `下载`, closed modal, and the answer remained visible. |

## Observations

- Chat requests observed during the run used `POST /webapi/chat/vertexai`, matching the Gemini-only scope.
- Search plumbing works for weather and news prompts, with visible result cards.
- HTML artifact generation is prompt-sensitive for Gemini. The explicit `lobeArtifact` tag is reliable; a generic "HTML Artifact" instruction can produce a non-rendered XML/code block.
- Console after reload showed three 404 resource errors. No failed chat, message, topic, auth, or model-provider TRPC requests were observed.
- Current code does not automatically call image-generation models from Chat. Chat can produce visual artifacts; real raster image generation remains a separate `/image` workflow.

## Follow-Up Tests

- Repeat T2/T3 with factual spot checks against external sources.
- Run the same matrix for `深度思考` and `全能效率` only after Gemini single-model testing is accepted.
