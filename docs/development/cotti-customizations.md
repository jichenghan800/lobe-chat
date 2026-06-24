# COTTI 二开记录

## 2026-06-23 Agent 模型通道分流

背景：

- 开发环境域名：`https://chatdev.cotticoffee.com/`
- 目标 Agent：`agt_4qC5zJhhJIbi`
- GLM5.2 在长 Excel Agent 任务中出现过 `Premature close` 和 `network error`。

确认结果：

- `openai/gpt-5.5`（显示名：全能效率）在统一渠道支持 `/v1/responses`。
- `openai/gpt-5.5` 在 `/v1/responses` 下支持 function tool 调用，非流式和流式 SSE 均验证通过。
- `openai/glm-5.2`（显示名：智谱 - GLM5.2）普通 `/v1/responses` 文本请求可用，但 `/v1/responses` + function tools 当前不稳定 / 不兼容；Agent 工具调用继续走 `/v1/chat/completions`。
- `vertexai/gemini-3.5-flash`（显示名：COTTI - 专业）走 Vertex AI 原生调用链，不走 OpenAI `/v1/responses`。

代码策略：

- 保持按模型分流，不全局切换 provider。
- `gpt-5.5` 由 OpenAI runtime 的 `isResponsesAPIModel` 规则进入 Responses API。
- `glm-5.2` 不纳入 Responses API 强制路由，避免工具调用失败。

开发库临时配置：

- 已将 `agt_4qC5zJhhJIbi` 的模型从 `vertexai/gemini-3.5-flash` 切到 `openai/gpt-5.5`。
- Agent mode 保持开启。
- Streaming 保持开启。

测试建议：

- 用新 topic 测试 Excel 任务，避免旧 topic 中已有的 GLM 错误消息和工具结果继续污染上下文。
- 若仍出现错误，优先看最新 assistant 消息外层 `model/provider`，再看错误 body；二者不一致时通常代表旧运行状态或历史错误污染。

## 2026-06-23 GPT-5.5 Responses 流式工具调用 Premature close

现象：

- Topic：`tpc_BW0tUYjq30tY`
- 模型：`openai/gpt-5.5`
- 错误：`ProviderBizError: Premature close`
- DB 中 assistant 消息已经包含 `executeCode` 工具调用和 usage，但没有进入后续工具执行。

关键证据：

- 这次不是 GLM5.2，也不是 Gemini 上下文窗口问题；消息外层模型已是 `gpt-5.5/openai`。
- usage 显示输入约 17k tokens，远低于 `gpt-5.5` 配置的 1050k 上下文。
- assistant 消息已经落库了完整 `executeCode` 工具调用，说明模型侧已经成功生成 function call。
- 裸 `/v1/responses`、OpenAI SDK 直接读取、Lobe runtime synthetic 测试均可正常读到 `response.completed`；问题在真实请求中表现为上游流在工具调用完成后异常关闭。

根因判断：

- `Premature close` 对应 Node.js 的 `ERR_STREAM_PREMATURE_CLOSE`，来源是后端读取上游 SSE/HTTP 响应体时，底层 stream 在未按预期完成前被关闭。
- 该错误不是模型返回的业务 JSON，也不是浏览器端自己生成的 `Failed to fetch`。
- Lobe 真实链路是：OpenAI SDK stream iterator -> `convertIterableToStream` -> `OpenAIStream` / `OpenAIResponsesStream` -> SSE `event:error` -> 前端 `fetchSSE` -> 消息失败。
- GitHub issue `lobehub/lobehub#16165` 与当前现象一致：多个 provider 在 `usage` / `speed` 已发出后，又收到 late `event:error: Premature close`。
- 当前开发环境的 Nginx 对 `/webapi/chat/*` 返回 200，且模型侧日志也是 200；因此更像是 Lobe 后端消费上游 SDK stream 时的 late close，而不是浏览器到 Nginx 到 Lobe 的请求直接中断。
- 上游已经返回了可执行工具调用，但连接尾部异常被当前 `fetchSSE` 当作致命错误保存，导致 Agent 没有继续进入 `call_tool`。

本地修复：

- `packages/fetch-sse/src/fetchSSE.ts` 对 “已收到 `tool_calls` 后又收到 `Premature close`” 做降级处理：
  - 不触发 `onErrorHandle`
  - 以 `tool_calls` finish
  - 让 Agent 继续进入工具执行
- 保留其它场景的错误处理不变；如果没有拿到工具调用，`Premature close` 仍然是错误。
- 重新构建本地镜像复测后，进一步确认还有第二类 late close：
  - 工具执行成功，`market.execInSandbox` 返回 200
  - 第二段 `gpt-5.5/azure` Responses 流已经输出正文、`response.output_text.done`、`usage`、`speed`
  - 随后 `convertIterableToStream` 又把上游 SDK 抛出的 `ERR_STREAM_PREMATURE_CLOSE` 转成 `event:error`
  - 这类错误发生在 `response.completed` 之后，已经不是有效的业务失败
- `packages/model-runtime/src/core/streams/protocol.ts` 增加终止事件后错误忽略钩子，默认不启用。
- `packages/model-runtime/src/core/streams/openai/responsesStream.ts` 仅对 OpenAI Responses 流启用：
  - 收到 `response.completed` 后标记流已逻辑完成
  - 如果下一次读取只抛 `Premature close` / `ERR_STREAM_PREMATURE_CLOSE`，静默关闭
  - 如果错误发生在 `response.completed` 之前，仍继续生成 `event:error`

后续风险：

- 修复该流式尾部错误后，Excel 任务可能继续暴露 “上传附件未进入 `/mnt/data`” 的问题。
- 大 Excel 正确路径仍应是：附件 / 资源库文件进入沙箱，由 Python/pandas 处理，不直接塞进模型上下文。

## 2026-06-23 Agent 历史消息加载大响应

现象：

- Topic：`tpc_O70Bx9lnqah4`
- 页面停在 “Fetching latest messages...”
- 浏览器报错：`message.getMessages` 所在 TRPC batch `net::ERR_INCOMPLETE_CHUNKED_ENCODING 200 (OK)`。
- Nginx access log 显示对应请求上游返回 200，响应体约 680KB，应用日志没有服务端异常。

根因判断：

- 这不是模型流式 `Premature close`，而是历史消息接口响应过大后，经 gzip + chunked + CDN / 代理传输时被浏览器判定为不完整。
- 数据库统计显示该 topic 只有 2 条消息；用户消息正文约 841 bytes，但关联 4 个文件的 `documents.content` 合计约 3.37MB。
- `MessageModel.queryWithWhere` 默认 `includeFileContent = true`，历史列表会把附件解析正文塞进 `fileList[].content` 返回。
- 发送消息后的 `aiChat` 路径已有类似保护：Agent mode 带文件时会用 `includeFileContent: false`；但刷新 / 进入 topic 的 `message.getMessages` 没有同步该逻辑。

本地修复：

- `apps/server/src/routers/lambda/message.ts` 在 `message.getMessages` 中解析 Agent 配置。
- 当 `chatConfig.enableAgentMode !== false` 时，调用 `MessageModel.query` 传入 `includeFileContent: false`。
- 文件元数据、文件 ID、文件 URL 仍返回；仅不在历史列表返回 `documents.content`。
- 普通 Chat 或明确关闭 Agent mode 的场景保留原默认行为，避免影响小附件直接由模型读取的旧流程。
- `src/store/file/slices/chat/action.ts` 在 Agent mode /heterogeneous agent 上传附件后不再调用 `document.parseFileContent`；这些文件应由 Agent 工具在沙箱中读取。
- `src/services/rag.ts` 调用 `document.parseFileContent` 时传 `returnContent: false`，用于普通 Chat 解析落库但不把正文塞回 TRPC 响应。
- `apps/server/src/routers/lambda/document.ts` 支持 `returnContent: false`，返回轻量 document metadata。
- `apps/server/src/services/message/index.ts` 对 agent 范围内的 mutation 后消息列表返回统一使用 `includeFileContent: false`，覆盖 `message.update`、tool message update、metadata update 等收尾路径。

验证：

- 针对 `tpc_O70Bx9lnqah4` 的数据库统计：去掉 `documents.content` 后，历史消息有效业务数据从 MB 级降到 KB 级。
- 新增集成测试覆盖 “Agent mode 历史加载不返回文件正文”。该用例通过；完整集成测试当前被已有 PGlite migration 多语句 prepared statement 问题阻塞。
- 追加单元测试：
  - Agent mode /heterogeneous agent 上传不触发 `parseFileContent`
  - `message.update` 返回 agent 消息列表时传入 `includeFileContent: false`

## 2026-06-23 GPT-5.5 Responses API 前端模式标记

现象：

- Topic：`tpc_CaV3Rr0jvBbC`
- 模型：`azure/gpt-5.5`
- 浏览器请求 `/webapi/chat/azure` 的 payload 中仍包含：
  - `model: gpt-5.5`
  - `stream: true`
  - `apiMode: chatCompletion`
- 前端错误上下文显示 `apiMode: chatCompletion`，容易误判为模型 runtime 没有走 Responses API。

根因判断：

- `src/services/chat/index.ts` 原逻辑只根据 provider 的 `supportResponsesApi` 设置决定前端 payload 的 `apiMode`。
- 对 Azure 这类 provider，如果配置层没有开启 Responses API 开关，前端会把 `gpt-5.5` 标成 `chatCompletion`。
- Azure runtime 内部虽然会根据 `isResponsesAPIModel(model)` 强制转 Responses API，但前端错误上下文和请求 payload 仍显示 `chatCompletion`，并可能影响部分链路判断。

本地修复：

- `src/services/chat/index.ts` 中，`isResponsesAPIModel(model)` 优先于 provider 配置开关。
- 对 `gpt-5.5`、`gpt-5.4`、`gpt-5.2` 等 Responses-only 模型，进入 `/webapi/chat/*` 前即标记 `apiMode: responses`。
- 更新 `src/services/chat/chat.test.ts` 中 Azure Responses-only 模型测试，确认 Azure + GPT-5.x payload 使用 `responses`，并继续保留 `deploymentName` 分离逻辑。

## 2026-06-23 开发环境 TRPC 代理传输修正

现象：

- Topic：`tpc_yIae7XMAYOll`
- Agent 工具执行过程中，前端控制台出现：
  - `POST /trpc/lambda/message.createMessage?batch=1 net::ERR_INCOMPLETE_CHUNKED_ENCODING 200 (OK)`
  - `TRPCClientError: Failed to fetch`
- 任务本身没有中断，后续 `market.execInSandbox`、`aiChat.archiveToolResult`、`message.updateToolMessage` 继续成功。

关键证据：

- Nginx access log 显示同一 topic 的 `message.createMessage` 都是 200，响应体只有 2-4KB。
- Chrome DevTools 中失败请求状态码为 200，但 response body 读取失败。
- 失败响应头来自 ESA，且原先是 `content-encoding: gzip` + `transfer-encoding: chunked`。
- 这不是应用层 `message.createMessage` 返回大 payload；代码侧 agent 场景已经使用 `includeFileContent: false`。

根因判断：

- `/webapi/chat/` 已单独关闭 gzip/buffering，用于 LLM 流式响应。
- `/trpc/*` 原先走通用 `/` location，通用 location 关闭了 `proxy_buffering`，而全局 Nginx gzip 开启。
- 普通 TRPC JSON 响应被 gzip + chunked 传输，经 ESA/CDN 后浏览器偶发判定 chunk 编码不完整。
- 因服务端已经完成写入，所以该错误更多表现为前端 fetch 读取失败，而不是任务执行失败。

开发环境配置修正：

- `/etc/nginx/conf.d/chatdev.conf` 备份为：
  - `/etc/nginx/conf.d/chatdev.conf.bak.20260623234539-trpc-buffering`
- 新增 `location ^~ /trpc/`：
  - `proxy_set_header Accept-Encoding "";`
  - `gzip off;`
  - `chunked_transfer_encoding off;`
  - `proxy_buffering on;`
  - `proxy_request_buffering on;`
  - `add_header Cache-Control "no-cache, no-transform" always;`
- `/webapi/chat/` 保持流式配置不变。

验证：

- `nginx -t` 通过，随后执行 `nginx -s reload`。
- 源站直连 `/trpc/lambda/config.getGlobalConfig` 不再返回 `Content-Encoding: gzip`，且不再由源站使用 chunked framing。
- 公网经 ESA 后仍可能显示 `Transfer-Encoding: chunked`，但 `Content-Encoding` 已为空。
- 浏览器同源 fetch 验证通过：TRPC 返回 200，约 53KB，`contentEncoding: null`，未再触发 `ERR_INCOMPLETE_CHUNKED_ENCODING`。

## 2026-06-24 开发环境任务调度兜底

现象：

- Task：`T-8` / `task_HDzW5d7P2IXF`
- 配置：`automation_mode=schedule`，`schedule_pattern=0 10 * * *`，`schedule_timezone=Asia/Shanghai`
- 2026-06-24 10:00 CST 应触发一次，但任务未自动运行。

关键证据：

- 10 点后数据库中 `T-8` 仍为 `scheduled`，`last_heartbeat_at` 为空，`task_topics` 无运行记录。
- 09:50-10:06 期间 Nginx access log 无 `/api/workflows/task/schedule-dispatch` 或 `/schedule-execute` 请求。
- 开发容器环境中 `QSTASH_TOKEN` 未设置，启动日志也提示跳过 QStash schedule 创建。
- 代码路径依赖外部 cron/QStash 调用 `/api/workflows/task/schedule-dispatch`，Next 进程本身不会自带常驻定时扫描。

处理：

- 单独补触发 `T-8`：
  - POST `http://127.0.0.1:3210/api/workflows/task/schedule-execute`
  - body：`{"taskId":"task_HDzW5d7P2IXF","userId":"user_dYvjtNqQU2PONweL5GrTuV3Cf2F"}`
- 返回：`{"success":true,"ran":true,"taskIdentifier":"T-8"}`
- 生成 topic：`tpc_UAEegzIk7F0T`
- `task_topics` 最终状态：`completed`

开发环境兜底配置：

- 新增机器级 cron 文件：`/etc/cron.d/lobechat-task-scheduler`
- 每 5 分钟调用一次：
  - POST `http://127.0.0.1:3210/api/workflows/task/schedule-dispatch`
  - body：`{}`
- 使用 `flock` 防止重叠执行。
- 日志输出到：`/var/log/lobechat-task-scheduler.log`

注意：

- 这是开发环境替代 QStash 的机器级配置，不是源码二开。
- 如果后续启用 QStash，应删除该 cron 兜底，避免双重调度。
- 本次补跑后 TaskLifecycle 的 handoff/brief synthesis 曾出现 `Premature close`，但任务 topic 主体已完成；这是收尾摘要失败，不等同于 schedule 未触发。

## 2026-06-24 开发环境本地 QStash 接入

目标：

- 用本地 QStash dev server 替代机器 cron fallback。
- 让 chatdev 的 scheduled task 走正式 QStash 签名链路，靠近官方部署方式。
- 支持 Upstash Console Local Mode 查看本地 QStash schedule/log。

运行状态：

- QStash 容器：`qstash-local`
- 镜像：`node:22-alpine`
- 命令：`npx -y @upstash/qstash-cli@latest dev -port 8080 -log-port 8081`
- Host 端口：
  - `18088 -> 8080`：QStash API
  - `18089 -> 8081`：QStash log server
- Docker 网络：
  - `bridge`
  - `lobehub_default`
- Upstash Console Local Mode 地址：
  - `http://localhost:18088`

LobeChat 容器处理：

- 原 `lobehub-v228-stage0` 已重命名保留为：
  - `lobehub-v228-stage0-before-qstash-20260624102310`
- 新 `lobehub-v228-stage0` 保留原镜像、端口、网络、restart policy 和运行时环境变量，并追加：
  - `APP_URL=https://chatdev.cotticoffee.com`
  - `INTERNAL_APP_URL=http://lobehub-v228-stage0:3210`
  - `QSTASH_URL=http://qstash-local:8080`
  - `QSTASH_TOKEN=<from docker logs qstash-local>`
  - `QSTASH_CURRENT_SIGNING_KEY=<from docker logs qstash-local>`
  - `QSTASH_NEXT_SIGNING_KEY=<from docker logs qstash-local>`
  - `AGENT_RUNTIME_MODE=queue`

验证：

- `docker exec lobehub-v228-stage0` 检查上述 5 个变量均为 `<set>`。
- LobeChat 容器内访问 `http://qstash-local:8080/` 返回 `401 Unauthorized`，符合未带 token 的预期，证明网络连通。
- LobeChat 启动日志出现：
  - `QStash: Schedule created successfully.`
- 本地 QStash schedule 列表出现：
  - `scheduleId=lobe-task-schedule-dispatch`
  - `cron=*/10 * * * *`
  - `destination=https://chatdev.cotticoffee.com/api/workflows/task/schedule-dispatch`
- 手动通过本地 QStash publish 到 `https://chatdev.cotticoffee.com/api/workflows/task/schedule-dispatch` 后，Nginx access log 显示 `Upstash-QStash` 请求返回 `200`。

2026-06-24 追加修正：

- 发现 task completion hook 会按 `INTERNAL_APP_URL` 拼出相对 webhook URL。
- 原 `INTERNAL_APP_URL=http://127.0.0.1:3210` 对 LobeChat 容器自己可用，但对 `qstash-local` 容器不成立；QStash 投递时 `127.0.0.1` 指向 QStash 容器自身。
- 表现：
  - `T-8` 在 10:30 被 schedule 正常触发。
  - Agent operation 已 `done`，消息无错误。
  - `task_topics` 和 `tasks` 仍停在 `running`。
  - QStash events 显示 `/api/workflows/task/on-topic-complete` 目标为 `http://127.0.0.1:3210/...` 且进入 retry。
- 修正：
  - 将 LobeChat 容器内 `INTERNAL_APP_URL` 改为 `http://lobehub-v228-stage0:3210`。
  - 通过本地 QStash 补发当前 topic 的 `on-topic-complete` 到 `http://lobehub-v228-stage0:3210/api/workflows/task/on-topic-complete`。
- 验证：
  - `T-8` 回到 `scheduled`。
  - `task_topics` 两条记录均为 `completed`。
  - `messages.error` 为 0。
  - 两次 `agent_operations` 均为 `done`。

清理：

- 已停用机器 cron fallback：
  - `/etc/cron.d/lobechat-task-scheduler.disabled-20260624102407`
- 原因：开启 QStash signing key 后，机器 cron 直调 `/schedule-dispatch` 不带 QStash signature，会被中间件拒绝；同时保留 cron 和 QStash 也可能导致重复调度。

注意：

- 本地 QStash token 和 signing key 只从 `docker logs qstash-local` 查看，不写入 Git。
- 如果重建 `qstash-local`，token/signing key 会变化，需要同步重启 LobeChat 容器。
- 生产环境建议使用托管 Upstash/QStash 或同等级高可用调度，不建议把 dev server 当生产队列。
