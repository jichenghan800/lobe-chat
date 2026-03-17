# Customization Changelog

本文件用于记录二次开发的例外修改与上游同步历史，便于长期维护与回滚。

---

### \[2026-03-17] 修复 Agent 元数据更新后左侧助手列表未同步刷新

- 类型: custom
- 涉及文件: src/store/agent/slices/agent/action.ts; src/features/EditingPopover/AgentContent.tsx; src/store/agent/slices/agent/action.test.ts
- 原因：官方实现中，Agent 标题 / 头像等元数据更新会写入 `agentStore`，但左侧助手列表读取的是 `homeStore` 的 sidebar 数据；保存元数据后未统一触发 `refreshAgentList()`，导致 Agent Builder、资料页编辑等场景下左侧列表可能仍显示旧标题 / 旧头像
- 方案：在 `optimisticUpdateAgentMeta(...)` 成功后统一触发 `homeStore.refreshAgentList()`，将 sidebar 刷新下沉到公共元数据保存路径；同时移除 `EditingPopover/AgentContent` 中重复的手动刷新，避免一次编辑触发两次 revalidate；补充单测覆盖 “成功刷新 / 失败不刷新”
- 验证：`bunx vitest run --silent='passed-only' 'src/store/agent/slices/agent/action.test.ts'` 通过
- 回滚：移除 `optimisticUpdateAgentMeta(...)` 中的 `refreshAgentList()` 调用，恢复 `EditingPopover/AgentContent` 的手动刷新逻辑，并删除对应测试
- 影响：仅影响 Agent 元数据保存后的左侧助手列表同步时机，不改变 Agent 配置、会话路由、数据库结构或接口协议

### \[2026-03-09] 对齐上游 Vertex 400 修复：去重重复 function declaration

- 类型: custom
- 涉及文件: packages/model-runtime/src/core/contextBuilders/google.ts; packages/model-runtime/src/core/contextBuilders/google.test.ts; packages/model-runtime/src/providers/google/thinkingResolver.ts; packages/model-runtime/src/providers/google/thinkingResolver.test.ts; packages/model-runtime/src/providers/google/index.test.ts; scripts/checkCustomHotfixes.mts
- 原因：合并上游稳定版时发现当前分支缺少 PR #12604 的关键修复，`buildGoogleTools` 会原样透传重复函数声明，可能触发 Vertex `400 Duplicate function declaration found`
- 方案：按上游实现在 `buildGoogleTools` 内按 `tool.function.name` 去重，并将 Google `thoughtSignature` 回退到 `skip_thought_signature_validator`；同时补回 `UNSUPPORTED_SCHEMA_KEYS` 过滤（`examples/default`）与 `thinkingResolver` 中 `includeThoughts` 安全判断（避免未启用 thinking 时仍传 `includeThoughts: true`）；补充 `[HOTFIX-P0]` 回归用例覆盖重复函数名场景；热修复门禁脚本新增相关检查
- 验证：`cd packages/model-runtime && bunx vitest run --silent='passed-only' 'src/core/contextBuilders/google.test.ts'` 通过；`cd packages/model-runtime && bunx vitest run --silent='passed-only' 'src/_custom/mergeGoogleFunctionResponses.test.ts'` 通过；`cd packages/model-runtime && bunx vitest run --silent='passed-only' 'src/providers/google/thinkingResolver.test.ts'` 通过；`cd packages/model-runtime && bunx vitest run --silent='passed-only' 'src/providers/google/index.test.ts'` 通过；`bun run custom:verify-hotfixes` 通过
- 回滚：移除 `buildGoogleTools` 去重逻辑、对应测试与 `checkCustomHotfixes` 中的 dedupe guard 检查
- 影响：仅影响 Google/Vertex 的 tool 声明构建；无重复函数名时行为不变

### \[2026-03-09] 修复模型别名描述与 thinkingLevel3 默认值的回归风险

- 类型: custom
- 涉及文件: src/\_custom/registry/modelCustomization.ts; src/\_custom/registry/modelCustomization.test.ts; src/features/ModelSwitchPanel/components/ModelDetailPanel.tsx; src/services/chat/mecha/modelParamsResolver.ts; src/services/chat/mecha/modelParamsResolver.test.ts
- 原因：模型详情描述优先使用 runtime description 会覆盖本地化文案；`thinkingLevel3` 默认值在混合扩展参数场景下会覆盖用户已设置的 `thinkingLevel`
- 方案：`resolveModelDetailDescription` 改为 “有本地化文案则优先本地化，无本地化才回退 runtime description”；`resolveModelExtendParams` 改为仅在未设置其他 thinkingLevel 时才应用 `thinkingLevel3` 默认值，且显式 `thinkingLevel3` 仍优先
- 验证：`bunx vitest run --silent='passed-only' 'src/_custom/registry/modelCustomization.test.ts'` 通过；`bunx vitest run --silent='passed-only' 'src/services/chat/mecha/modelParamsResolver.test.ts'` 通过
- 回滚：恢复 `resolveModelDetailDescription` 直接优先 `modelDescription`，并恢复 `thinkingLevel3` 分支无条件写默认值逻辑
- 影响：仅影响模型详情描述展示优先级与 thinkingLevel 参数合并策略；不改变单一 `thinkingLevel3` 模型的默认 `low` 行为

### \[2026-03-09] 默认 inbox agent 新话题时清空 “关联文件” 勾选

- 类型: custom
- 涉及文件: src/app/\[variants]/(main)/home/\_layout/HomeAgentIdSync.tsx; src/store/agent/slices/knowledge/action.ts; src/store/agent/slices/knowledge/action.test.ts; src/store/chat/slices/topic/action.ts; src/store/chat/slices/topic/action.test.ts
- 原因：默认 `cotti ai` /inbox agent 更接近 “临时聊天” 心智，用户开启新话题时，预期之前勾选的 “关联文件” 不应自动延续；但用户自定义 agent 仍需要保留该配置
- 方案：新增 agent store `clearEnabledFiles` 动作，仅在 `switchTopic(null)` 且当前 agent 为 inbox agent 时批量关闭已启用的关联文件；首页 `HomeAgentIdSync` 仅负责在默认 agent 初始化后同步可用状态，不再额外改变已确认的刷新行为
- 验证：`bunx vitest run --silent='passed-only' 'src/store/agent/slices/knowledge/action.test.ts'` 通过；`bunx vitest run --silent='passed-only' 'src/store/chat/slices/topic/action.test.ts'` 通过；页面实测当前行为为 “刷新不清空，新话题清空”
- 回滚：删除 `clearEnabledFiles` 动作及 `switchTopic` 中对 inbox agent 的调用，恢复所有 agent 新话题时均保留关联文件勾选
- 影响：仅影响默认 inbox agent 的 “新话题” 行为；刷新页面不清空；自定义 agent 保持原行为

### \[2026-03-09] Vertex 当前聊天上传 PDF 原生输入接线（v1）

- 类型: custom
- 涉及文件: src/\_custom/services/vertexNativePdf.ts; src/app/(backend)/webapi/chat/\[provider]/route.ts; packages/context-engine/src/processors/MessageContent.ts; packages/context-engine/src/processors/**tests**/MessageContent.test.ts; packages/model-runtime/src/types/chat.ts; packages/model-runtime/src/core/contextBuilders/google.ts; packages/model-runtime/src/core/contextBuilders/google.test.ts; packages/model-runtime/src/providers/google/index.ts; packages/types/src/openai/chat.ts
- 原因：v1 决定只覆盖 “当前聊天上传 PDF” 路径，需要在不改 Agent 关联文件 / 知识库流程的前提下，为 Vertex 增加原生 PDF `fileData` 输入，并保留现有文本解析注入作为 fallback
- 方案：聊天上下文工程阶段仅对 `vertexai + application/pdf` 追加 `file_url` content part，继续保留原有 `<file>...</file>` 文本注入；服务端 `/webapi/chat/[provider]` 在进入 model-runtime 前对这些 PDF part 按需同步到 GCS 并改写成 `gs://...`；Google/Vertex context builder 仅在 `vertexai` 且 URI 为 `gs://` 时生成 `Part.fileData`
- 验证：`cd packages/context-engine && bunx vitest run --silent='passed-only' 'src/processors/__tests__/MessageContent.test.ts'` 通过；`cd packages/model-runtime && bunx vitest run --silent='passed-only' 'src/core/contextBuilders/google.test.ts'` 通过；`bunx tsx src/_custom/vertexPdfNativePoc.ts` 仍返回 `123` 且 `promptTokensDetails` 含 `DOCUMENT`
- 回滚：删除 `src/_custom/services/vertexNativePdf.ts` 与 `/webapi/chat/[provider]` 注入；移除 `file_url` schema 扩展与 `MessageContentProcessor` / `google` builder 对应分支
- 影响：仅对 Vertex 当前聊天上传的 PDF 增加原生输入尝试；若 GCS 同步失败会退回现有文本注入；Agent 关联文件、知识库检索路径保持不变

### \[2026-03-09] Vertex native PDF 成功后移除误导性的空文本 `<file>` 注入

- 类型: custom
- 涉及文件: src/\_custom/services/vertexNativePdf.ts; src/\_custom/services/vertexNativePdf.test.ts
- 原因：页面实测发现扫描版 PDF 虽已通过 Vertex native `fileData` 能力可被正确识别，但聊天链路仍同时注入旧的 `<file ...></file>` 文本 fallback。对无文本层 PDF，这段 fallback 会把 “提取内容为空” 显式暴露给模型，导致回答错误地退回 “无法分析附件”
- 方案：在 `/webapi/chat/[provider]` 的 `prepareVertexNativePdfMessages(...)` 中，仅当 native PDF part 成功转换为 `gs://` 时，移除同条消息里对应 PDF 的文本 `<file>` fallback；若 native 准备失败，则继续保留旧 fallback
- 验证：`bunx vitest run --silent='passed-only' 'src/_custom/services/vertexNativePdf.test.ts'` 通过；使用根目录 `增值电信业务经营许可证-正文及附页-20250418.pdf` 运行 `bunx tsx src/_custom/vertexPdfNativePoc.ts --file ... --prompt '帮我分析附件内容和实际的边框样式情况。请直接基于PDF视觉内容回答。'`，`gemini-2.5-flash` 已正确识别许可证正文与边框花纹，且 `usageMetadata.promptTokensDetails` 含 `DOCUMENT`
- 回滚：删除 `stripNativePdfFallbackPrompt(...)` 清理逻辑与对应测试
- 影响：仅在 Vertex native PDF 成功生效时清掉误导性的空文本 fallback；不改变 native 失败时的兼容行为

### \[2026-03-09] Vertex Agent 关联文件 PDF 复用原生输入链路

- 类型: custom
- 涉及文件: src/services/chat/mecha/contextEngineering.ts; packages/context-engine/src/providers/KnowledgeInjector.ts; packages/context-engine/src/engine/messages/MessagesEngine.ts; packages/context-engine/src/providers/**tests**/KnowledgeInjector.test.ts; src/\_custom/services/vertexNativePdf.ts; src/\_custom/services/vertexNativePdf.test.ts; packages/prompts/src/prompts/knowledgeBaseQA/formatFileContents.ts
- 原因：用户侧会把 “当前聊天上传 PDF” 和 “勾选关联文件中的 PDF” 视为同一能力，但现状只有前者会进入 Vertex native `fileData` 链路；Agent 关联文件仍只有文本注入，扫描件 / 无文本层 PDF 体感上等于未生效
- 方案：上下文工程阶段为已启用的 Agent 关联 PDF 保留 `url/type/size` 元数据；`KnowledgeInjector` 在 `vertexai` 下除了原有文本知识注入外，额外向 system injection message 追加 `file_url` part；服务端继续复用既有 GCS 改写与 native fallback 清理逻辑
- 验证：补充 `KnowledgeInjector` 与 `vertexNativePdf` 单测，验证关联 PDF 会生成 `file_url` part，且 native 成功后可清理关联文件 XML fallback
- 回滚：移除 `KnowledgeInjector` 中的 `file_url` 追加逻辑，并恢复 `contextEngineering` 对 agent files 的旧过滤条件
- 影响：仅对 Vertex 下 Agent 关联文件中的 PDF 增加原生输入尝试；知识库检索与非 PDF 文件保持原行为

### \[2026-03-09] Docker 运行层补齐 @napi-rs/canvas optional native package 暴露

- 涉及文件: Dockerfile
- 原因：页面实测上传 PDF 时，运行容器仍报 `DOMMatrix is not defined`。进一步确认 `@napi-rs/canvas` 主包已在 `/app/node_modules/@napi-rs/canvas`，但与其版本匹配的 optional native package `@napi-rs/canvas-linux-x64-gnu` 没有暴露到 `/app/node_modules/@napi-rs/`，导致 Node 解析 `require('@napi-rs/canvas-linux-x64-gnu')` 失败
- 方案：在 Docker app stage 不再遍历目录名猜测链接，而是读取顶层 `@napi-rs/canvas/package.json` 的 `optionalDependencies`，按声明版本为每个 `@napi-rs/canvas-*` 平台包建立符号链接
- 影响：修复 Docker 部署环境下 `pdfjs-dist` 对 `DOMMatrix` polyfill 的 native binding 解析，恢复 PDF 解析链路

---

### \[2026-03-09] Vertex 原生 PDF 输入 PoC（独立脚本验证）

- 类型: custom
- 涉及文件: src/\_custom/vertexPdfNativePoc.ts; src/\_custom/CHANGELOG.md
- 原因：在接入主流程前，需要先确认当前 Vertex 配置 + `gs://lobechat-cotti` 能否通过 `@google/genai` 的原生 `fileData` 路径稳定读取 PDF，而不是继续依赖现有文本解析注入
- 方案：新增独立脚本 `src/_custom/vertexPdfNativePoc.ts`，按 `.env` 读取 `VERTEXAI_CREDENTIALS` / `VERTEXAI_PROJECT` / `VERTEXAI_LOCATION`，将本地 PDF 上传或复用到 GCS，再以 `vertexai: true` + PDF `fileData.fileUri=gs://...` 发起一次 `generateContent`
- 验证：2026-03-09 本地执行 `bunx tsx src/_custom/vertexPdfNativePoc.ts`，使用仓库测试文件 `packages/file-loaders/test/fixtures/test.pdf` 上传到 `gs://lobechat-cotti/vertex-pdf-poc/67e85b9398030030-test.pdf`；`gemini-2.5-flash` 返回 `123`，脚本输出 `Verification: PASS`，且 `usageMetadata.promptTokensDetails` 中出现 `DOCUMENT` token 计数
- 回滚：删除 `src/_custom/vertexPdfNativePoc.ts` 与本条记录
- 影响：仅新增 Phase 1 验证工具，不改聊天上传、Agent 关联文件、知识库或 `packages/model-runtime` 主流程

---

### \[2026-03-09] Docker 运行镜像补齐 @napi-rs/canvas 平台绑定

- 类型: custom
- 涉及文件: Dockerfile; src/store/file/slices/chat/action.ts; src/store/file/slices/chat/action.test.ts
- 原因：聊天上传 PDF 后，`document.parseFileContent` 在容器内失败，日志显示 `DOMMatrix is not defined`。进一步定位为运行镜像中的 `@napi-rs/canvas` 顶层包存在，但其 optional native binding `@napi-rs/canvas-linux-x64-gnu` 未暴露到 Node 可解析路径，导致 `pdfjs-dist` 的 DOMMatrix polyfill 失效
- 方案：在 Docker app stage 为 `.pnpm` 中的 `@napi-rs/canvas-*` 平台包建立到 `/app/node_modules/@napi-rs/` 的符号链接，确保 `require('@napi-rs/canvas')` 可加载 native binding；聊天侧继续保留 `parseFileContent` 完成前阻塞发送的修复，避免只有 URL 无正文的竞态
- 回滚：删除 Dockerfile 中新增的 `@napi-rs/canvas-*` 链接逻辑，并回退聊天文件上传状态流转改动
- 影响：修复 Docker 部署环境下的 PDF 解析能力；仅影响文件解析与聊天附件注入时序，不改变其他业务流程

---

### \[2026-02-22] Gemini 3.1 别名描述与默认思考等级（注入式改造）

- 类型: custom
- 涉及文件: src/\_custom/registry/modelCustomization.ts; src/store/aiInfra/slices/aiProvider/action.ts; src/features/ModelSwitchPanel/components/ModelDetailPanel.tsx; src/features/ChatInput/ActionBar/Model/ThinkingLevel3Slider.tsx; src/services/chat/mecha/modelParamsResolver.ts; src/app/\[variants]/(main)/settings/provider/features/ModelList/CreateNewModelModal/ExtendParamsSelect.tsx; src/store/aiInfra/slices/aiProvider/**tests**/action.test.ts; src/services/chat/mecha/modelParamsResolver.test.ts
- 原因：`gemini-3.1-pro-preview` 在重命名为 `Cotti-Pro` 后，模型详情描述仍显示官方名（含 `Gemini 3 Pro` / `Gemini 3 Flash` 变体）；且 `thinkingLevel3` 期望默认 `low`
- 方案：将别名描述替换与 thinkingLevel3 默认值逻辑收敛到 `src/_custom/registry/modelCustomization.ts`；上游文件仅做 import + 调用注入。`ModelDetailPanel` 优先使用运行时模型描述（支持别名替换），并新增 `NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE` 开关（默认开启，`0` 可关闭扩展替换）
- 回滚：移除上述注入 import/call，并删除 `modelCustomization.ts`
- 影响：仅影响模型展示文案与 Gemini 3.1 的默认思考等级，不改变其他模型能力

---

### \[2026-02-16] Docker 构建 type-check 修复（slash/menu key 与 OTel 类型）

- 类型: custom
- 涉及文件: src/app/\[variants]/(main)/agent/profile/features/EditorCanvas/useSlashItems.tsx; src/features/ChatInput/InputEditor/useSlashItems.tsx; src/features/PageEditor/EditorCanvas/useSlashItems.tsx; src/features/Conversation/Messages/Assistant/Actions/index.tsx; src/features/Conversation/Messages/AssistantGroup/Actions/index.tsx; src/features/Conversation/Messages/Supervisor/Actions/index.tsx; src/features/Conversation/Messages/Task/Actions/index.tsx; src/features/Conversation/Messages/User/Actions/index.tsx; packages/observability-otel/src/node.ts
- 原因：Docker build 阶段 tsgo 因 symbol key 拼接与 `@opentelemetry/auto-instrumentations-node` 类型解析失败而中断
- 方案：slash items 展示 key 使用 `String()` 显式转换；Actions 子项 key 拼接统一 `String()`；在 OTel import 上添加 `@ts-expect-error` 以避免 Docker 构建中 tsgo 解析失败
- 回滚：恢复 key 直接使用并移除 `@ts-expect-error`
- 影响：仅影响类型检查与 UI 中 key 的字符串展示，运行时逻辑不变

---

### \[2026-02-10] 公开仓库安全门禁（方案 B）

- 类型: custom
- 涉及文件: .github/workflows/public-security-gate.yml; scripts/checkPublicRepoSafety.mts; package.json; .env.desktop; src/\_custom/routes/dev-login.ts; src/\_custom/SECONDARY_DEV_GUIDE.md
- 原因：仓库公开后需要降低凭据误提交与 dev bypass 配置误放开的风险
- 方案：新增 `custom:verify-public-safety` 与 `Public Security Gate` workflow；将 `.env.desktop` 脱敏；`/api/dev/login` 默认仅接受请求头 token，关闭 query token（需显式开启 `DEV_AUTH_BYPASS_ALLOW_QUERY_TOKEN=1`）
- 回滚：删除 public-security-gate workflow 与校验脚本，恢复 `.env.desktop` 与 dev-login token 读取逻辑
- 影响：仅影响配置安全门禁与 dev-login 默认安全策略，不影响主业务流程

---

### \[2026-02-09] Google/Vertex 400 Hotfix 回归门禁（P0 自动增长）

- 类型: custom
- 涉及文件: .github/workflows/custom-hotfix-gate.yml; scripts/checkCustomHotfixes.mts; package.json; packages/model-runtime/src/core/contextBuilders/google.test.ts; packages/model-runtime/src/\_custom/mergeGoogleFunctionResponses.test.ts; src/\_custom/SECONDARY_DEV_GUIDE.md
- 原因：upstream-sync/dev 合并到 main 时，关键 400 hotfix 容易被冲掉或行为回归，需要强制门禁与快速定位
- 方案：新增 `Custom Hotfix Gate` 工作流，仅对 `upstream-sync -> main` 与 `dev -> main` PR 强制执行；失败输出 `Hotfix Regression Failed`；P0 回归用例采用 `[HOTFIX-P0]` 前缀并由脚本自动识别，实现守卫自动增长
- 回滚：删除 `custom-hotfix-gate.yml` 与新增脚本命令，并移除测试标题前缀与脚本前缀扫描逻辑
- 影响：仅影响 CI 发布门禁与测试守卫，不影响运行时逻辑

---

### \[2026-02-09] 支持通过环境变量自定义浏览器 Tab 品牌名称

- 类型: custom
- 涉及文件: src/components/PageTitle/index.tsx; src/app/\[variants]/metadata.ts
- 原因：默认 Tab 标题使用 business const 中的 BRANDING_NAME（OneAI），与部署环境中的 `NEXT_PUBLIC_BRAND_NAME` 不一致
- 方案：标题计算优先读取 `getBrandName()`（来自 `NEXT_PUBLIC_BRAND_NAME`），为空时回退到 BRANDING_NAME
- 回滚：移除 `@/_custom/registry/branding` 注入并恢复 BRANDING_NAME 直读
- 影响：仅影响浏览器标题与 metadata 标题展示，不影响运行时业务逻辑

---

### \[2026-02-09] Fork 未授权时提示重新登录社区

- 类型: custom
- 涉及文件: src/app/\[variants]/(main)/community/(detail)/agent/features/Sidebar/ActionButton/ForkAndChat.tsx; src/app/\[variants]/(main)/community/(detail)/group_agent/features/Sidebar/ActionButton/ForkGroupAndChat.tsx; src/locales/default/discover.ts
- 原因：Market 访问令牌失效 / 缺失时 fork 会返回 Unauthorized，原逻辑只显示通用失败提示
- 方案：捕获 Unauthorized 文案并提示用户先登录社区后重试
- 回滚：移除 Unauthorized 分支提示逻辑与对应文案
- 影响：仅影响 fork 失败提示，不改变后端调用逻辑

---

### \[2026-02-08] 增加关键 Hotfix 防回归校验脚本

- 类型: custom
- 涉及文件: scripts/checkCustomHotfixes.mts; package.json; src/\_custom/SECONDARY_DEV_GUIDE.md
- 原因：reset/rebase/upstream-sync 后关键 hotfix 可能被历史重写导致丢失，发布时难以及时发现
- 方案：新增 `custom:verify-hotfixes` 校验命令，支持检查 HEAD 或指定 refs（如 origin/dev、origin/main）中的关键补丁标记
- 回滚：删除脚本与 package.json 对应命令，并移除文档说明
- 影响：仅新增发布前校验能力，不影响运行时

---

### \[2026-02-08] 修复 Vertex/Gemini 并行工具调用 400（functionResponse 对齐）

- 类型: hotfix
- 涉及文件: packages/model-runtime/src/\_custom/mergeGoogleFunctionResponses.ts; packages/model-runtime/src/\_custom/mergeGoogleFunctionResponses.test.ts; packages/model-runtime/src/core/contextBuilders/google.ts; packages/model-runtime/src/core/contextBuilders/google.test.ts
- 原因：Google/Vertex 在单轮并行 functionCall 后要求下一轮为同一条 user 消息且 functionResponse parts 数量严格对齐；分成多条 tool 回包会触发 400 INVALID_ARGUMENT
- 方案：在 Google context builder 中合并连续的 functionResponse user turn，确保并行工具结果以单条 user + 多 parts 回传
- 回滚：删除 mergeGoogleFunctionResponses 注入与相关测试
- 影响：仅影响 Google/Vertex 工具调用消息拼装；普通文本与单工具调用行为不变

---

### \[2026-02-06] 上游同步至 v2.1.20

- 类型: sync
- 涉及文件: n/a
- 原因：对齐官方最新 Release 版本，作为后续二次开发基线
- 方案：upstream-sync 重置到 v2.1.20，dev 基于该基线 rebase 并更新 main
- 回滚：回退到上一次基线版本（如 v2.1.18）并重新同步
- 影响：基线版本变化，功能以官方 Release 为准

---

### \[2026-02-06] 升级 @google/genai 至 1.40.0 并锁定相关依赖

- 类型: custom
- 涉及文件: package.json; packages/model-runtime/package.json; pnpm-lock.yaml
- 原因：升级 GenAI SDK 版本，并规避 @lobehub/editor 多实例导致的类型冲突
- 方案：将 @google/genai 固定到 1.40.0；在 pnpm overrides 中锁定 @lobehub/editor/@lobehub/ui/@types/react/@types/react-dom/antd/motion 版本
- 回滚：恢复 @google/genai 旧版本并移除 overrides
- 影响：仅影响依赖解析与构建类型检查，不改变运行时逻辑

---

### \[2026-02-03] Google GenAI 配额限流指数退避重试

- 类型: custom
- 涉及文件: packages/model-runtime/src/\_custom/googleQuotaRetry.ts; packages/model-runtime/src/providers/google/index.ts
- 原因：Google/Vertex AI 遇到 429 配额限流时，提升稳定性与成功率
- 方案：为 generateContentStream 增加指数退避 + 抖动重试，仅对 429 类错误生效，支持 AbortSignal 中断
- 回滚：移除 quota retry helper 与调用
- 影响：仅在配额限流时重试，不改变其他错误行为

---

### \[2026-02-03] Docker 构建 type-check 兼容 vitest-canvas-mock

- 类型: custom
- 涉及文件: src/\_custom/types/vitest-canvas-mock.d.ts
- 原因：Docker 构建 type-check 引用 `vitest-canvas-mock` 时缺少类型声明导致失败
- 方案：添加全局模块声明以避免 type-check 阻塞
- 回滚：删除该 d.ts
- 影响：仅影响类型检查，不影响运行时

---

### \[2026-02-02] 隐藏指定模型提供商（不影响服务端能力）

- 类型: custom
- 涉及文件: src/\_custom/registry/providerVisibility.ts; src/store/aiInfra/slices/aiProvider/action.ts; .env
- 原因：在保留 Azure embedding 的前提下，全局隐藏 Azure 模型展示
- 方案：新增 `NEXT_PUBLIC_PROVIDER_HIDE` 支持按 providerId 过滤 UI 列表（默认不影响后端能力）
- 回滚：删除 providerVisibility 注入与 `NEXT_PUBLIC_PROVIDER_HIDE`
- 影响：仅影响 UI 模型列表 / 提供商显示

---

### \[2026-02-02] 首页 Starter “绘画” 按特性开关隐藏

- 类型: custom
- 涉及文件: src/\_custom/registry/homeStarter.ts; src/app/\[variants]/(main)/home/features/InputArea/StarterList.tsx; src/app/\[variants]/(main)/home/features/InputArea/ModeHeader.tsx
- 原因：与 FEATURE_FLAGS `-ai_image` 联动，隐藏首页 “绘画” 入口
- 方案：在 `_custom` 新增 starter 过滤器，并在首页列表 / 模式头部注入
- 回滚：删除上述文件与调用
- 影响：仅影响 UI 展示，不改变路由与服务能力

---

### \[2026-02-01] 品牌名称自定义与模型显示名占位符

- 类型: custom
- 涉及文件: src/\_custom/registry/branding.ts; src/\_custom/registry/modelDisplayName.ts; src/helpers/parserPlaceholder/index.ts; packages/builtin-agents/src/agents/inbox/systemRole.ts; src/features/CommandMenu/AskAgentCommands.tsx; src/features/CommandMenu/AskAIMenu.tsx; src/app/\[variants]/(mobile)/(home)/features/SessionListContent/Inbox/index.tsx; src/app/\[variants]/onboarding/features/TelemetryStep.tsx; src/app/\[variants]/(desktop)/desktop-onboarding/features/WelcomeStep.tsx; src/app/\[variants]/(main)/settings/stats/features/rankings/AssistantsRank.tsx; src/app/\[variants]/(main)/memory/features/MemoryAnalysis/DateRangeModal.tsx; src/features/PageEditor/EditorCanvas/useAskCopilotItem.tsx; src/features/HotkeyHelperPanel/HotkeyContent.tsx; src/app/\[variants]/(main)/settings/hotkey/features/Essential.tsx; src/app/\[variants]/(main)/settings/hotkey/features/Conversation.tsx; src/app/\[variants]/(main)/settings/hotkey/features/Desktop.tsx; src/locales/default/_; locales/_/\*.json
- 原因：需要可配置的品牌展示名，并在默认系统提示中显示模型 displayName
- 方案：新增 `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_BRAND_ASSISTANT_NAME` 读取入口；`{{assistant_name}}`/`{{brand}}` 占位符；`{{model}}` 使用 displayName；UI 关键入口统一使用品牌名；相关文案改为插值
- 回滚：移除 branding/modelDisplayName registry 与相关调用，恢复默认文案
- 影响：仅影响 UI 展示与默认系统提示，不改变模型选择逻辑

---

### \[2026-02-01] 模型提供商名称映射与分组方式全局控制

- 类型: custom
- 涉及文件: src/\_custom/registry/providerName.ts; src/\_custom/registry/modelSwitchPanel.ts; src/features/ModelSwitchPanel/components/Footer.tsx; src/store/aiInfra/slices/aiProvider/action.ts; src/store/global/initialState.ts; src/store/global/selectors/systemStatus.ts; .env
- 原因：需要统一隐藏或自定义模型提供商显示名，并全局默认按模型分组，同时可隐藏 “管理提供商” 入口
- 方案：新增 `NEXT_PUBLIC_PROVIDER_NAME_MAP` 映射显示名；新增 `NEXT_PUBLIC_MODEL_SWITCH_GROUP_MODE` 强制分组模式；新增 `NEXT_PUBLIC_MODEL_SWITCH_HIDE_MANAGE_PROVIDER` 隐藏底部入口
- 回滚：移除上述 env 与对应注入逻辑
- 影响：仅影响 UI 展示，不改变模型实际 providerId

---

### \[2026-01-31] Dev 免密登录调试入口

- 类型: custom
- 涉及文件: src/\_custom/routes/dev-login.ts; src/app/(backend)/api/dev/login/route.ts
- 原因：开发阶段需要为 Chrome Dev MCP 提供免密调试账号
- 方案：新增 /api/dev/login，使用环境变量 + token 校验后创建 / 更新调试用户并写入 Better Auth 会话
- 回滚：删除上述文件并移除 DEV_AUTH_BYPASS\_\* 环境变量
- 影响：仅在 DEV_AUTH_BYPASS_ENABLED=1 且 token 校验通过时生效

---

### \[2026-01-30] 仅保留聊天与助理的导航收敛

- 类型: custom
- 涉及文件: src/\_custom/registry/navigation.ts; src/app/\[variants]/(main)/home/\_layout/Header/components/Nav.tsx; src/app/\[variants]/(main)/home/\_layout/Body/BottomMenu/index.tsx; src/app/\[variants]/(mobile)/\_layout/NavBar.tsx
- 原因: FEATURE_FLAGS 无法隐藏搜索 / 文稿 / 资源 / 记忆 / 个人中心等导航入口
- 方案：在 `_custom` 定义导航 allowlist，并在 3 处导航组件最小注入过滤
- 回滚：删除上述 import/call，并移除 `src/_custom/registry/navigation.ts`
- 影响：仅收敛导航入口，直接访问 URL 仍可进入隐藏页面

---

### \[2026-01-30] 修复 Feishu OAuth 配置缺失 tokenUrl

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因: Better-Auth generic-oauth 要求 tokenUrl；缺失会导致 /api/auth/sign-in/oauth2 报 INVALID_OAUTH_CONFIGURATION
- 方案：为 Feishu provider 补充 tokenUrl 与 userInfoUrl
- 回滚：删除新增的 tokenUrl/userInfoUrl 字段
- 影响：仅影响 Feishu SSO，其他登录方式不受影响

---

### \[2026-01-30] 修复 Feishu OAuth redirect_uri 指向错误回调路径

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/index.ts
- 原因: generic OAuth redirectURI 被设置为 /api/auth/callback/{id}，导致飞书报 redirect_uri invalid
- 方案：将 generic OAuth redirectURI 修正为 /api/auth/oauth2/callback/{id}
- 回滚：还原 redirectURI 为 /api/auth/callback/{id}
- 影响：仅影响 generic OAuth 提供商（如 Feishu/Wechat）

---

### \[2026-01-30] 增强 Feishu OAuth token 错误日志

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因: token 交换失败时无法看到飞书返回的具体错误信息
- 方案：记录 token 响应 status/statusText/body（不含敏感信息）
- 回滚：删除新增的 console.error 日志
- 影响：仅增加错误日志，不影响功能

---

### \[2026-01-30] Feishu token 交换补充 client_id/client_secret

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因：飞书 token 接口返回缺少 client_id（20063）
- 方案：在 token 请求体中同时发送 client_id/client_secret（保留 app_id/app_secret 兼容）
- 回滚：删除 client_id/client_secret 字段
- 影响：仅影响 Feishu SSO

---

### \[2026-01-30] 记录 Feishu 未返回邮箱时的回退原因

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因：需确认为何生成 feishu.lobehub 回退邮箱
- 方案：当 email/enterprise_email 缺失时输出日志包含 union_id/open_id
- 回滚：删除新增 console.warn
- 影响：仅增加日志，不影响功能

---

### \[2026-01-30] 记录邮箱白名单命中信息

- 类型: hotfix
- 涉及文件: src/libs/better-auth/plugins/email-whitelist.ts
- 原因: EMAIL_NOT_ALLOWED 无法定位真实邮箱域名
- 方案：记录域名与是否命中白名单（不输出完整邮箱）
- 回滚：删除新增 console.warn
- 影响：仅增加日志，不影响功能

---

### \[2026-01-30] 修复 Feishu 回退邮箱被覆盖导致 email_is_missing

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因：合并 profile 时覆盖了已生成的回退邮箱
- 方案：调整合并顺序，确保 fallback email 生效
- 回滚：还原 profile merge 顺序
- 影响：仅影响 Feishu SSO

---

### \[2026-01-30] 修复 Feishu email 为空字符串导致 fallback 失效

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因: email 为空字符串时 `??` 不生效，导致 email_is_missing
- 方案: trim 后用 `||` 选择 enterprise_email 或 fallback
- 回滚：还原 email 取值逻辑
- 影响：仅影响 Feishu SSO

---

### \[2026-01-30] Fork 操作自动触发 Market OIDC 登录

- 类型: custom
- 涉及文件: src/app/\[variants]/(main)/community/(detail)/agent/features/Sidebar/ActionButton/ForkAndChat.tsx; src/app/\[variants]/(main)/community/(detail)/group_agent/features/Sidebar/ActionButton/ForkGroupAndChat.tsx
- 原因: Market 由官方托管，无法配置 trusted client；无手动登录入口时 fork 直接 Unauthorized
- 方案: fork 前检测 Market 登录状态，未登录则调用 signIn () 触发 OIDC
- 回滚：删除 useMarketAuth 注入与 signIn 逻辑
- 影响: fork 操作会弹出授权确认与登录流程

---

### \[2026-01-30] Web 端启用 Market OIDC handoff 以适配官方 Market

- 类型: custom
- 涉及文件: src/layout/AuthProvider/MarketAuth/MarketAuthProvider.tsx; src/layout/AuthProvider/MarketAuth/oidc.ts; src/layout/AuthProvider/MarketAuth/types.ts
- 原因：官方 Market 的 web clientId 不允许自建域名作为 redirect_uri，导致授权回到官方站点无法闭环
- 方案：增加 `NEXT_PUBLIC_MARKET_OIDC_HANDOFF=1`，Web 端使用 desktop clientId + handoff 轮询完成授权
- 回滚：移除 handoff 开关逻辑，恢复原 web redirect 流程
- 影响：授权弹窗会停留在官方页面，但本地通过 handoff 闭环获取 token

---

### \[2026-01-30] Market OIDC 手动回调兜底（复制回调 URL 完成授权）

- 类型: custom
- 涉及文件: src/\_custom/components/marketAuth/ManualCallbackModal.tsx; src/layout/AuthProvider/MarketAuth/MarketAuthProvider.tsx; src/layout/AuthProvider/MarketAuth/oidc.ts; src/locales/default/marketAuth.ts; locales/zh-CN/marketAuth.json; .env
- 原因：办公网环境下官方 consent/callback 页面无法请求 app.lobehub.com，handoff 长期 pending
- 方案：handoff 失败 / 超时后弹出输入框，用户粘贴回调 URL 解析 code/state 完成本地 token 交换；保留授权弹窗便于复制；手动回调会同步更新 state；支持 `NEXT_PUBLIC_MARKET_OIDC_HANDOFF_TIMEOUT_MS` 缩短等待
- 回滚：移除 ManualCallbackModal 与 MarketAuthProvider 的手动兜底逻辑
- 影响：当自动回调失败时，用户可通过复制回调链接完成授权

---

### \[2026-01-30] Market token 代理失败日志增强

- 类型: hotfix
- 涉及文件: src/app/(backend)/market/oidc/\[\[...segments]]/route.ts
- 原因：token 交换 500 无法定位具体错误原因
- 方案：输出 Market SDK 错误的 status/statusText/body，返回 detail 便于排查
- 回滚：移除 extractProxyError 与 detail 透传
- 影响：仅增加日志与错误详情

---

### \[2026-01-30] Market token 代理改为直连 token endpoint

- 类型: hotfix
- 涉及文件: src/app/(backend)/market/oidc/\[\[...segments]]/route.ts
- 原因：Market SDK 返回 “Invalid token response payload”，无法获取实际响应
- 方案：token/refresh 走直连 `https://market.lobehub.com/token` 并透传原始响应
- 回滚：恢复使用 Market SDK `exchangeOAuthToken`
- 影响：仅影响 OIDC token 交换

---

### \[2026-01-31] 回退 agent fork 登录自动触发逻辑（等待官方修复）

- 类型: revert
- 涉及文件: src/app/\[variants]/(main)/community/(detail)/agent/features/Sidebar/ActionButton/ForkAndChat.tsx; src/app/\[variants]/(main)/community/(detail)/group_agent/features/Sidebar/ActionButton/ForkGroupAndChat.tsx
- 原因：官方 bug，fork 授权链路不稳定，先保持官方实现
- 方案：撤销 fork 前自动触发 Market OIDC 登录
- 回滚：重新引入 fork 前 signIn 逻辑
- 影响：fork 继续依赖官方 Market 侧修复

---

### \[2026-01-31] 回退 Market/OIDC 兜底逻辑（保持官方实现）

- 类型: revert
- 涉及文件: src/layout/AuthProvider/MarketAuth/MarketAuthProvider.tsx; src/layout/AuthProvider/MarketAuth/oidc.ts; src/layout/AuthProvider/MarketAuth/types.ts; src/app/(backend)/market/oidc/\[\[...segments]]/route.ts; src/locales/default/marketAuth.ts; locales/zh-CN/marketAuth.json; locales/en-US/marketAuth.json
- 原因：等待官方修复，保持与上游一致
- 方案：撤销 handoff / 手动回调 / 直连 token 代理相关改动
- 回滚：重新引入 Market/OIDC 兜底逻辑
- 影响：Market 登录链路回到官方默认实现

---

### \[2026-02-02] Docker Compose 部署调整（外部依赖）

- 类型: custom
- 涉及文件: docker-compose/deploy/docker-compose.yml; docker-compose/deploy/.env.example; docker-compose/deploy/.env.zh-CN.example; .gitignore; package.json
- 原因：使用外部数据库 / Redis / 对象存储（B 方案）
- 方案: deploy compose 仅启动 LobeChat，依赖改为从 .env 读取 DATABASE_URL / REDIS_URL / S3\_\*；模板更新为外部连接示例；compose 改为本地 build 使用二开镜像；为保证 docker build 通过，将 @aws-sdk/client-bedrock-runtime 提升到根依赖；.gitignore 增加 Dockerfile 和 compose 文件忽略规则
- 回滚：恢复 deploy compose 中内置 postgresql/redis/rustfs 服务与原始 env 模板
- 影响：使用 deploy 方案时需要提前准备外部依赖并正确填写 .env

---

### \[2026-02-02] 首页模块与 Starter 入口按导航 / 权限隐藏

- 类型: custom
- 涉及文件: src/\_custom/registry/homeSections.ts; src/\_custom/registry/homeStarter.ts; src/\_custom/registry/navigation.ts; src/app/\[variants]/(main)/home/features/index.tsx; src/app/\[variants]/(main)/home/features/InputArea/StarterList.tsx; src/app/\[variants]/(main)/home/features/InputArea/ModeHeader.tsx
- 原因：需要在首页联动导航隐藏与权限开关，避免仍展示不可达入口
- 方案: Community/RecentPage/RecentResource 根据导航隐藏与 market flag 控制；Starter 入口根据导航隐藏与 edit_agent 控制
- 回滚：移除 homeSections/homeStarter 增强逻辑并恢复原始 Home 组件渲染
- 影响：仅影响首页展示，不改变路由与功能权限

---

### \[2026-01-31] 模型显示名统一映射（非 Provider / 模型配置页）

- 类型: custom
- 涉及文件: src/\_custom/hooks/useModelDisplayName.ts; src/\_custom/components/ModelDisplayNameTag.tsx; src/app/\[variants]/(main)/agent/features/Conversation/Header/Tags/index.tsx; src/features/Conversation/Messages/components/Extras/Usage/index.tsx; src/features/Conversation/Messages/components/Extras/Usage/UsageDetail/ModelCard.tsx; src/features/Conversation/components/History/index.tsx; src/features/Conversation/components/ShareMessageModal/ShareImage/Preview\.tsx; src/features/ShareModal/ShareImage/Preview\.tsx; src/app/\[variants]/(mobile)/(home)/features/SessionListContent/List/Item/index.tsx; src/app/\[variants]/(main)/community/(detail)/provider/features/Sidebar/ActionButton/index.tsx; src/app/\[variants]/(main)/community/(list)/provider/features/List/Item.tsx; src/app/\[variants]/(main)/image/features/GenerationFeed/BatchItem.tsx
- 原因：需要在非 Provider / 模型配置页统一显示可配置的模型 displayName
- 方案：新增 displayName 解析 hook + Tag 组件，并替换多处 ModelTag / 模型文本显示
- 回滚：移除上述 hook / 组件并恢复各处 ModelTag / 模型文本显示
- 影响：模型名称展示优先显示自定义 displayName，模型 id 作为 fallback/tooltip

---

## 变更记录模板

```
### [YYYY-MM-DD] 变更标题
- 类型: custom / hotfix / upstream-sync
- 涉及文件: src/_custom/... 或 src/...（仅限例外）
- 原因: 为什么必须改（或为什么无法用注入/包裹解决）
- 方案: 采用的实现方式
- 回滚: 如何撤销（步骤或关键点）
- 影响: 可能影响的功能或风险点
```

---

## 上游同步记录模板

```
### [YYYY-MM-DD] 同步 upstream/main
- 上游提交范围: <from>.. <to>
- 冲突文件: 无 / 列表
- 处理方式: 说明冲突解决策略
- 回归验证: 跑了哪些测试或手动验证点
```
