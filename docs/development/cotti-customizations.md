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
- 2026-06-27 更新：开发环境 GLM-5.2 渠道切换为百炼 `qwen/glm-5.2`，使用百炼 OpenAI 兼容
  `/compatible-mode/v1` 调用链，不再通过 `openai/glm-5.2` 暴露。
- `vertexai/gemini-3.5-flash`（显示名：COTTI - 专业）走 Vertex AI 原生调用链，不走 OpenAI `/v1/responses`。

代码策略：

- 保持按模型分流，不全局切换 provider。
- `gpt-5.5` 由 OpenAI runtime 的 `isResponsesAPIModel` 规则进入 Responses API。
- `glm-5.2` 不纳入 Responses API 强制路由，避免工具调用失败。
- 百炼 `qwen/glm-5.2` 仍走 Chat Completions 兼容接口，并透传 GLM-5.2 的
  `reasoning_effort` 推理强度参数。

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

## 2026-06-24 自动任务运行时文档隔离

现象：

- Task：`T-10` / `task_q2yjC5Oa3LjZ`
- 用户触发 “立即运行” 后，任务 prompt 本身只包含 `T-10 行业研究周报` 的任务信息，但执行结果仍会围绕 `AI 生成 PPT / 演示文稿赛道` 展开。
- 页面右侧 “产物” 区域也保留了历史执行生成的 `AI 生成 PPT / 演示文稿赛道：2026年6月第5周行业研究简报（汇总版）`。

关键证据：

- 新运行的首条 user message 已无 `Workspace`、`Activities`、`AI生成PPT`、`lobe-agent-documents`、`lobe-knowledge-base`、`lobe-topic-reference`。
- 但 v15 运行中 `serverMessagesEngine` 之前仍会从 `AgentRuntime/RuntimeExecutors.ts` 注入 Agent 文档、知识库文件内容和 Topic 引用摘要。
- 因此污染点不在 `buildTaskPrompt`，而在最终 LLM 上下文拼装层。

源码二开：

- `apps/server/src/services/taskRunner/buildTaskPrompt.ts`
  - 自动任务运行 prompt 不再拉取 task topics、briefs、pinned workspace documents。
  - 只保留任务本体、依赖关系、父任务上下文和用户反馈。
- `packages/prompts/src/prompts/task/index.ts`
  - 增加 `includeActivityTimeline` 开关，任务执行场景关闭活动时间线。
- `apps/server/src/modules/AgentRuntime/RuntimeExecutors.ts`
  - 在 `call_llm` 最终上下文入口统一读取 `taskIsolationPolicy`。
  - 带 `taskId` 的任务运行隐藏：
    - Agent documents
    - Knowledge base / runtime file contents
    - Topic reference context
  - 这是集中式隔离点，目的是让文档对任务运行时的模型上下文不可见，减少对工具链和普通 Agent 能力的误伤。

测试：

- `apps/server/src/services/taskRunner/buildTaskPrompt.test.ts`
  - 覆盖任务 prompt 不包含历史 workspace/activity 文档标题。
- `apps/server/src/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts`
  - 覆盖带 `taskId` 的 `call_llm` 不向 `serverMessagesEngine` 传入 agent documents、knowledge file contents、knowledge bases、topic references。
- 已通过：
  - `bunx vitest run --silent='passed-only' apps/server/src/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts apps/server/src/services/taskRunner/buildTaskPrompt.test.ts apps/server/src/services/__tests__/taskIsolationPolicy.test.ts apps/server/src/modules/Mecha/AgentToolsEngine/__tests__/index.test.ts`
  - `bun run type-check`

chatdev 验证：

- 镜像：`lobehub:v2.2.8-cotti-task-isolation-policy-v16`
- 备份容器：`lobehub-v228-stage0-before-task-isolation-policy-v16-20260624200321`
- 新容器：`lobehub-v228-stage0`
- 触发 `T-10` “立即运行” 后最新 operation：
  - `op_1782302653550_agt_4qC5zJhhJIbi_tpc_FEQxrk9Eq6EB_2G8tKTFM`
  - 状态：`done`
  - topic：`tpc_FEQxrk9Eq6EB`
- 数据库检查新 topic：
  - `AI 生成 PPT` / `AI生成PPT`：未命中
  - `Workspace (`：未命中
  - `Activities:`：未命中
  - `lobe-agent-documents`：未命中
  - `lobe-knowledge-base`：未命中
  - `lobe-topic-reference`：未命中

注意：

- 页面 “产物” 区域里的 `AI 生成 PPT...` 是历史产物记录，不代表新一次执行仍被污染。
- 是否删除该历史产物属于数据清理操作，未自动执行。
- 容器日志里仍可见 `TaskLifecycle` 的 handoff/brief synthesis 偶发 `Premature close`，来源是 api-sg `/v1/responses` 尾部关闭问题；这是单独的渠道稳定性问题，不是本次文档污染根因。
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

## 2026-06-24 chatdev 历史 topic 慢加载 / OOM 复盘

现象：

- 重新打开历史 topic `tpc_cCkwJu5wpyuy` 时页面停在 “正在获取最新消息...”。
- Nginx 对 `/trpc/lambda/*` 多个请求出现 300s upstream timeout，包括
  `message.getMessages`、`agent.getAgentConfigById`、`device.listDevices`、`document.parseFileContent`。
- 浏览器侧表现为历史消息加载慢或 `Failed to fetch`。

排查结论：

- 该 topic 本身不大：
  - 22 条消息。
  - 消息行数据约 48KB，正文约 40KB。
  - 关联 1 个约 2.4MB 的 xlsx 文件。
  - 无 `file_chunks`、`unstructured_chunks`、chunk/embedding async task。
- 真正根因是 LobeChat Node 进程触发 V8 heap OOM：
  - `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
  - OOM 前容器内存约 4.25GiB。
- 因为 Node 进程卡住 / 异常，所有 topic 的 TRPC 请求都会被拖慢；这不是该历史 topic 的数据量问题。
- 重启后同一 topic 的 `message.getMessages` 相关批量请求恢复到约 0.6-1.6s。

处理：

- 重启 LobeChat 恢复服务。
- 保留旧容器：
  - `lobehub-v228-stage0-before-heap-20260624113332`
- 新 `lobehub-v228-stage0` 保留原镜像、端口、网络、restart policy 和环境变量，并将：
  - `NODE_OPTIONS=--dns-result-order=ipv4first --use-openssl-ca`
  - 调整为：
  - `NODE_OPTIONS=--max-old-space-size=8192 --dns-result-order=ipv4first --use-openssl-ca`

验证：

- `https://chatdev.cotticoffee.com/` 返回 `302`，约 10ms。
- `https://chatdev.cotticoffee.com/agent/agt_4qC5zJhhJIbi/tpc_cCkwJu5wpyuy` 返回 `302`，约 10ms。
- LobeChat 启动日志包含：
  - `QStash: Schedule created successfully.`
  - `Gateway: Started successfully.`
- 容器内访问 `http://qstash-local:8080/` 返回 `401 Unauthorized`，符合未带 token 的预期。
- 本地 QStash schedule 仍为：
  - `scheduleId=lobe-task-schedule-dispatch`
  - `cron=*/10 * * * *`
  - `destination=https://chatdev.cotticoffee.com/api/workflows/task/schedule-dispatch`

后续风险：

- `--max-old-space-size=8192` 是运行时保护，不是根治内存增长的代码修复。
- 如果再次出现内存持续上升，应重点继续查 `document.parseFileContent`、Excel 文件解析、Agent 文件绑定 / 解绑链路是否存在大对象驻留。

## 2026-06-24 普通 chat 大 Excel 上传保护

背景：

- 普通 chat 上传 xls/xlsx 会走源码内置的 `document.parseFileContent`。
- Excel loader 会全量读取工作簿、转 JSON，再转 Markdown 表格。
- chatdev 实测一个约 2.4MB 的 xlsx 会让 `document.parseFileContent` 运行约 66s，Node 内存峰值接近 7GiB，最后模型仍未获得可用的表格分析能力。

处理：

- 在普通 chat 模式下，拦截超过 128KB 的 xls/xlsx 文件。
- 在普通 chat 模式下，同一次上传包含多个 Excel 时也拦截。
- 在普通 chat 模式下，单个 Excel 如果包含多个有内容的 sheet，也拦截。
- 弹出提示：较大的 Excel 不适合普通对话，请开启 Agent 智能模式，让 Agent 使用工具分析文件。
- Agent 智能模式和异构 Agent 模式不拦截上传，因为这类文件应由沙箱 / Python / DuckDB
  等工具处理。
- Agent 模式发送模型请求时，Excel 附件只保留文件名、类型、大小和 URL，不再把解析后的
  Excel 正文注入 `<files_info>`。chatdev 实测约 999.8KB 的 `维修.xlsx` 会把请求体放大到
  3.39MB，已经超过上游 1,048,576 bytes 输入限制。

边界：

- 这是前置保护，不改变官方 Excel loader。
- 小 Excel 仍允许走普通 chat 的原解析链路。
- 超过 128KB 的 Excel 推荐路径是 Agent 智能模式 + 沙箱文件分析。

## 2026-06-24 资源库表格文件作为 Agent 附件

背景：

- 资源库勾选状态原本只服务于资源管理器批量操作，例如加入资料库、分块、删除。
- 该勾选状态不会自动进入聊天输入框，也不会自动关联到当前 topic 的消息附件。
- 沙箱文件同步只读取当前 topic 消息附件和 session 附件，因此资源库里勾选的 Excel/CSV 不会天然出现在 `/mnt/data`。

处理：

- 资源库选中文件后新增 “作为 Agent 附件使用” 动作。
- 该动作只接受 Excel/CSV 等表格文件，把已有资源库 fileId 包装成已上传完成的聊天附件。
- Agent 输入框 `+ -> 附件` 内联菜单，以及该菜单底部 “查看更多” 打开的资料库弹窗，
  都同步使用这条表格附件路线：
  - Excel/CSV 文件点击后加入当前输入框附件，而不是调用 `addFilesToAgent` 加入 Agent 知识。
  - 如果该表格文件之前已被误加为 Agent 文件资源，点击时会先移除旧的 Agent 文件关联，再加入当前输入框附件。
  - 这样顶部附件 tag 和后续沙箱 `/mnt/data` 文件同步使用同一条消息附件链路。
  - 内联菜单的 Excel/CSV 勾选状态以当前输入框附件为准，不再以 Agent 文件资源 `enabled`
    状态为准。
- 不重新上传二进制，不调用 `document.parseFileContent`，不触发 chunk /embedding。
- 输入框顶部按现有附件 tag 展示文件名，用户可移除。
- 移除这类附件时只从输入框移除，不删除资源库原文件。
- 发送后复用现有消息附件链路，后端再按 topic/session 附件把文件同步到沙箱 `/mnt/data`。
- 沙箱初始化 marker 改为按文件清单 fingerprint 区分，避免旧 topic 首次无文件初始化后，后续新增附件却不再同步。

边界：

- 普通文本、PDF、图片等资源库文件保持原有知识库 / 视觉 / 上下文处理逻辑，不默认改走沙箱附件。
- 该能力面向 Agent 智能模式的大表格分析；普通 chat 仍不建议处理大 Excel。

## 2026-06-24 自动任务对话追加回复空白占位排查

- 现象：任务 topic 抽屉内追加回复后，数据库已有 assistant 最终内容，但页面停留在空
  assistant 占位，用户误以为 Agent 没有回复。
- 对比官方 `v2.2.8` 后确认：官方 `FeedbackInput` 只负责调用
  `sendMessage({ forceRuntime: 'gateway' })`，实时更新依赖 Gateway 通道回推。
- 回退本地临时补丁：移除 `FeedbackInput` 中无条件 `refreshMessages` 和固定延迟刷新。
- 同时移除 gateway 启动后对已有 topic 立即 `messageService.getMessages + replaceMessages`
  的二开逻辑。该逻辑会在模型流式 / 最终写库完成前取回空 assistant 占位并覆盖前端状态，是更符合
  现象的根因。
- 当前开发环境未配置 `agentGatewayUrl`，任务 follow-up 只能收到 `aiAgent.execAgent` 的启动结果，
  收不到服务端运行完成后的实时消息回推。
- 因此只在 “任务抽屉 + 无 Gateway 实时通道” 场景增加局部轮询兜底：
  - 追加消息发送成功后，按短周期调用 `message.getMessages`
  - 直到本次提交时间之后出现有正文 / 错误的 assistant 为止
  - 中间工具调用阶段仍允许刷新展示，但不会把工具调用 assistant 当作最终回复
- v21 首轮验证发现不能用 `messageCount` 切片判断 “新消息”：任务抽屉的
  `ConversationStore` 在部分挂载路径下不持有完整初始计数，第一轮轮询会把历史 assistant
  正文误判为本次结果并提前停止。已改为基于 `createdAt / updatedAt >= submittedAt`
  判断本次提交后的 assistant。
- v22 验证发现只调用局部 `ConversationStore.replaceMessages` 不足以驱动任务抽屉父级重渲染：
  抽屉正文数据源来自 `useChatStore((s) => s.dbMessagesMap[chatKey])`，因此 fallback 取回消息后
  需要同时调用全局 `useChatStore.replaceMessages(messages, { context })`，与抽屉初始化的刷新路径保持一致。
- v23 验证发现首轮 `message.getMessages` 可能取回本次 assistant 的加载占位，内容为
  `"..."`，但最终正文尚未写库。停止条件不能只看 “提交时间之后出现 assistant 且 content
  非空”，否则会把 `"..."` 当成有效回复提前停止。
- 当前停止条件限定为：先匹配本次用户消息内容，再检查 `parentId` 指向该用户消息的 assistant；
  只有 assistant 内容不是 `"..."`，或存在错误信息时，才认为本次追加回复已经落库。
- v25 增加任务追加消息等待态：提交成功后、最终 assistant 回复落库前，抽屉底部展示
  “Agent 正在处理，回复会自动出现…”。这是无 Gateway 实时通道时的可见反馈，不改变发送链路。
- v25 将任务详情页 404 展示增加 1.2 秒确认窗口：新建任务或刚跳转时如果先收到一次
  `Task not found`，先保持加载态；若详情随后同步完成则不再闪错误页，真实不存在的任务仍会进入
  404 页面。

边界：

- 不改任务 topic 抽屉的官方发送方式；有 Gateway 实时通道时仍走官方回推链路，不启用轮询。
- 不影响普通 chat，也不影响主聊天页。
- 任务详情页刷新 404 闪烁修复保留，属于任务详情数据加载态问题，不参与消息流式链路。

## 2026-06-28 Agent 模型显示恢复官方语义与单次运行模型锁定

背景：

- chatdev 发现同一 Agent 的不同 topic 之间会互相影响模型显示：用户在 topic A 使用豆包后，
  topic B 选择 GLM 开始任务，任务失败后页面又显示为豆包。
- 对照官方 `v2.2.8` 后确认，官方模型按钮 / 文案只读取当前 Agent 配置，不读取
  `topics.model/provider` 或最新 assistant 消息模型。
- 本地二开曾新增 `useTopicAwareModelDisplay`，优先显示 topic 汇总模型 / 最新消息模型。
  但官方 `topics.model/provider` 是用量统计投影，按 assistant token 最大的模型汇总，不是 “当前选择模型”。
  这会把历史或续跑中的 dominant model 错当作当前下拉框选择。
- 进一步排查发现：模型选择是 Agent 级配置，不是 topic 级配置。同一个 Agent 在另一个 topic
  切到豆包会写回 Agent 全局配置。当前 topic 发送时虽然先创建了 GLM 的 assistant 占位消息，
  但如果 runtime 启动前 Agent 全局配置被旧 topic / SWR 刷新覆盖为豆包，后续工具续跑创建的
  assistant 会从豆包开始。

处理：

- 移除 `src/features/ChatInput/ActionBar/Model/useTopicAwareModelDisplay.ts`。
- `Model` 图标按钮和 `ModelLabel` 文案恢复官方语义：显示 / 切换都以当前 Agent 配置为准。
- 保留 COTTI 模型可见性二开：
  - chat/agent 模型范围过滤仍由 `shouldIncludeAgentOnlyChatModels` 控制。
  - COTTI 展示名仍由 `getModelDisplayName` 控制。
- 在发送服务端创建 user/assistant 消息后，从返回的 assistant 消息读取本次 `model/provider`，
  作为 `executeClientAgent` 的显式 runtime payload。
- `internal_createAgentState` 支持显式 runtime model/provider：
  - 后续 `modelRuntimeConfig`
  - compression model
  - 工具生成能力判断
  - 传给 LLM 的默认 payload
  - 传给 `createAgentExecutors` 的 resolved agent config
    都使用本次运行锁定的模型，而不是重新读取可能已被其他 topic 覆盖的 Agent 全局配置。

边界：

- 不改变官方 `topics.model/provider` 的用量统计设计。
- 不把 topic 汇总模型作为当前选择模型。
- 不引入 topic 级模型持久化；本次仅保证 “单次发送 / 单次 agent runtime” 模型固定。
- 如果用户在同一个 Agent 的另一个 topic 主动切模型，后续新发送仍会按 Agent 级配置生效，这是官方语义。

验证：

- `bunx vitest run --silent='passed-only' src/store/chat/slices/aiChat/actions/__tests__/streamingExecutor.test.ts`
  - 44 passed
- `bunx vitest run --silent='passed-only' src/store/chat/slices/aiChat/actions/__tests__/conversationLifecycle.test.ts`
  - 36 passed
- `git diff --check`
  - passed
- `bun run type-check`
  - 仍失败于既有无关错误：
    `src/features/AgentTasks/AgentTaskDetail/TopicChatDrawer/fallbackRefresh.test.ts(101,13):
Type 'null' is not assignable to type 'string | undefined'.`
