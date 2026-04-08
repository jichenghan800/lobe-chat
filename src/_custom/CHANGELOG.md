# Customization Changelog

本文件用于记录二次开发的例外修改与上游同步历史，便于长期维护与回滚。

---

### \[2026-04-08] 对齐首波升级必需项：邮箱登录、企业域名别名与外部 ParadeDB 部署基线

- 类型: custom
- 涉及文件: `Dockerfile`; `docker-compose/deploy/docker-compose.yml`; `src/_custom/services/emailAlias.ts`; `src/_custom/services/emailAlias.test.ts`; `src/libs/better-auth/define-config.ts`; `src/libs/better-auth/plugins/email-whitelist.ts`; `src/libs/better-auth/plugins/email-whitelist.test.ts`; `src/app/(backend)/api/auth/check-user/route.ts`; `src/app/[variants]/(auth)/signin/page.tsx`; `src/app/[variants]/(auth)/signin/useSignIn.ts`; `src/app/[variants]/(auth)/signin/SignInEmailStep.tsx`
- 原因：升级工作树虽然已进入 `v2.1.47`，但首波上线所需的已验收能力尚未完全回灌，包括 magic link 单路径登录、`abite.com` / `cotticoffee.com` 等价身份、白名单前置拦截、以及连接本地 ParadeDB 的部署基线
- 方案：恢复邮箱别名归一化工具并接入 Better Auth `emailHarmony`；让白名单与 `/api/auth/check-user` 同步走归一化身份；保留登录页现有交互的前提下补齐 magic link 错误翻译与单路径行为；同时将部署 compose 对齐为 “仅启动 LobeChat + 外部本地依赖” 的方案，并修复 Docker 构建期过短的占位 `AUTH_SECRET`
- 验证：后续通过定向 vitest、类型检查、以及 `docker compose` 构建和运行态接口校验完成
- 回滚：移除上述邮箱归一化与 compose/Docker 对齐改动，恢复官方 `v2.1.47` 的默认部署和邮箱匹配逻辑

### \[2026-04-08] 修复升级分支 Docker 构建链的依赖解析与内存上限问题

- 类型: hotfix
- 涉及文件: `package.json`
- 原因：升级分支的 Docker `vite build` 先后暴露出两个构建期问题：其一，`@lobechat/builtin-tool-calculator` 在 workspace 子包中声明了 `mathjs`，但容器内 Vite 以根级依赖图解析该子包源码时会报 `Rollup failed to resolve import "mathjs"`；其二，解析修复后，SPA 打包阶段仍在约 6GB 堆附近触发 `JavaScript heap out of memory`
- 方案：将 `mathjs` 显式提升到根依赖，消除 workspace 子包依赖在 Docker/Vite 构建环境下的解析漂移；同时把 `build:spa`、`build:spa:mobile`、`build:next` 的 Node 堆上限统一提升到 `12288MB`
- 验证：重新执行 `docker compose -f docker-compose/deploy/docker-compose.yml up -d --build lobe`
- 回滚：移除根 `package.json` 中新增的 `mathjs` 依赖，并恢复原有构建脚本的 Node 堆上限

### \[2026-04-07] 补齐 Vertex 原生 PDF 在消息处理与 Google/Vertex runtime 的透传链路

- 类型: custom
- 涉及文件: `packages/prompts/src/prompts/knowledgeBaseQA/formatFileContents.ts`; `packages/types/src/openai/chat.ts`; `packages/model-runtime/src/types/chat.ts`; `packages/model-runtime/src/core/contextBuilders/google.ts`; `packages/model-runtime/src/core/contextBuilders/google.test.ts`; `packages/model-runtime/src/providers/google/index.ts`; `packages/context-engine/src/processors/MessageContent.ts`; `packages/context-engine/src/processors/__tests__/MessageContent.test.ts`; `src/routes/(main)/home/features/InputArea/StarterList.tsx`
- 原因：上一轮只恢复了 `KnowledgeInjector` 与 `_custom/services/vertexNativePdf`，但升级分支仍缺少 `MessageContentProcessor` 的原生 PDF part 注入，以及 `Google/Vertex` builder 对 `file_url -> fileData` 的运行时支持；同时 `StarterList` 在接入首页裁剪注册表后出现类型推断回归
- 方案：补回 `FileContent.url/fileType/size` 扩展字段、`UserMessageContentPart.file_url` 类型、`MessageContentProcessor.processNativeFileParts(...)`、`buildGooglePart(..., { isVertexAi })` 的 `fileData` 映射，并在 Google provider 入口传入 `isVertexAi`；同时把首页 starter 的 `key` 收窄为非空模式，修复升级分支新增的类型错误
- 验证：`bunx vitest run --silent='passed-only' 'src/_custom/services/vertexNativePdf.test.ts'` 通过；`cd packages/context-engine && bunx vitest run --silent='passed-only' 'src/providers/__tests__/KnowledgeInjector.test.ts' 'src/processors/__tests__/MessageContent.test.ts'` 通过；`cd packages/model-runtime && bunx vitest run --silent='passed-only' 'src/core/contextBuilders/google.test.ts'` 通过；完整 `tsc` 仅剩 editor/lexical 依赖不一致相关错误，Vertex/PDF 与 starter 新增错误已消失
- 回滚：移除 `file_url` 类型扩展、删除 `processNativeFileParts(...)` 与 Google builder 的 `fileData` 分支，恢复 `buildGoogleMessages(payload.messages)` 的无选项调用

### \[2026-04-07] 恢复 Google/Vertex runtime 的 quota retry 与函数响应合并热修

- 类型: custom
- 涉及文件: `packages/model-runtime/src/_custom/googleQuotaRetry.ts`; `packages/model-runtime/src/_custom/mergeGoogleFunctionResponses.ts`; `packages/model-runtime/src/_custom/mergeGoogleFunctionResponses.test.ts`; `packages/model-runtime/src/core/contextBuilders/google.ts`; `packages/model-runtime/src/providers/google/index.ts`
- 原因：升级工作树虽然已经补回了 `file_url` 与 Vertex PDF 通路，但仍缺少主线二开里的 Google/Vertex 运行时热修，导致 429 限流重试能力缺失，且多工具调用的 functionResponse 合并逻辑仍散落在 builder 内，没有与当前二开主线对齐
- 方案：恢复 `requestWithQuotaRetry(...)` 与 `mergeGoogleFunctionResponses(...)` 两个 `_custom` 热修文件，并让 Google provider 在流式调用时按 Vertex/Google 分别打标签重试，同时对 Vertex 使用 `VertexAIStream`
- 验证：后续与 `packages/model-runtime` 定向测试一起执行
- 回滚：删除 `packages/model-runtime/src/_custom/*` 新增文件，恢复 `generateContentStream` 的直接调用与 `GoogleGenerativeAIStream` 的单一路径

### \[2026-04-07] 恢复 Docker 运行层的 @napi-rs/canvas native binding 暴露逻辑

- 类型: custom
- 涉及文件: `Dockerfile`
- 原因：升级工作树保留了官方 `build:docker` 流程，但丢失了主线分支里用于暴露 `@napi-rs/canvas-*` optional native package 的运行层链接逻辑；这会把之前已修过的 Docker PDF 解析问题重新带回来，表现为容器内 `DOMMatrix is not defined`
- 方案：在 Docker app stage 读取顶层 `@napi-rs/canvas/package.json` 的 `optionalDependencies`，为匹配平台包建立到 `/app/node_modules/@napi-rs/` 的符号链接；保留升级版现有的 `build:docker` 流程，不回退到旧构建路径
- 验证：代码级对齐已完成；容器级验证需在后续镜像构建演练时确认 PDF 上传 / 解析链路
- 回滚：删除 Dockerfile 中新增的 `@napi-rs/canvas-*` 链接逻辑

### \[2026-04-07] 对齐 Better Auth 的 whitelist 调试信息与 generic SSO 回调路径

- 类型: custom
- 涉及文件: `src/libs/better-auth/plugins/email-whitelist.ts`; `src/libs/better-auth/sso/index.ts`; `src/libs/better-auth/sso/providers/feishu.ts`
- 原因：升级工作树在 Better Auth 相关文件上与当前主线仍有小范围漂移，其中 generic SSO provider 的回调路径退回到了 `/api/auth/callback/...`，与 generic oauth2 provider 的实际回调约定不一致；同时白名单校验与 Feishu token 交换的调试日志也被丢失
- 方案：恢复 generic provider 的 `/api/auth/oauth2/callback/{providerId}` 重定向地址，并补回 email whitelist / Feishu token exchange 的排障日志
- 验证：后续走类型检查与登录链路实测；本次改动不引入新类型
- 回滚：恢复 `sso/index.ts` 中的 `/api/auth/callback/...` 地址，并移除新增日志

### \[2026-04-07] 恢复 dev-login 的后端路由注入入口

- 类型: custom
- 涉及文件: `src/app/(backend)/api/dev/login/route.ts`
- 原因：升级工作树虽然已经恢复了 `src/_custom/routes/dev-login.ts`，但 Next.js App Router 下真正的 `/api/dev/login` route 文件没有重新导出该实现，导致旁路登录能力在升级分支实际上不可达
- 方案：补回 `src/app/(backend)/api/dev/login/route.ts`，仅做一层 `_custom` re-export，保持最小侵入
- 验证：代码级路由入口已恢复；后续在 dev 环境通过 `DEV_AUTH_BYPASS_*` 环境变量做接口实测
- 回滚：删除 `src/app/(backend)/api/dev/login/route.ts`

### \[2026-04-07] 恢复品牌 / 导航 / 模型展示的注入式二开层到 v2.1.47 升级分支

- 类型: custom
- 涉及文件: `src/_custom/registry/branding.ts`; `src/_custom/registry/homeSections.ts`; `src/_custom/registry/homeStarter.ts`; `src/_custom/registry/modelDisplayName.ts`; `src/_custom/registry/modelSwitchPanel.ts`; `src/_custom/registry/navigation.ts`; `src/_custom/registry/providerName.ts`; `src/_custom/registry/providerVisibility.ts`; `src/_custom/hooks/useModelDisplayName.ts`; `src/_custom/components/ModelDisplayNameTag.tsx`; `src/components/PageTitle/index.tsx`; `src/app/[variants]/metadata.ts`; `src/helpers/parserPlaceholder/index.ts`; `src/store/aiInfra/slices/aiProvider/action.ts`; `src/store/global/initialState.ts`; `src/store/global/selectors/systemStatus.ts`; `src/features/CommandMenu/AskAgentCommands.tsx`; `src/features/CommandMenu/AskAIMenu.tsx`; `src/features/HotkeyHelperPanel/HotkeyContent.tsx`; `src/features/ShareModal/ShareImage/Preview.tsx`; `src/features/Conversation/components/ShareMessageModal/ShareImage/Preview.tsx`; `src/features/Conversation/components/History/index.tsx`; `src/features/Conversation/Messages/components/Extras/Usage/index.tsx`; `src/features/Conversation/Messages/components/Extras/Usage/UsageDetail/ModelCard.tsx`; `src/routes/(main)/home/features/index.tsx`; `src/routes/(main)/home/features/InputArea/StarterList.tsx`; `src/routes/(main)/home/features/InputArea/ModeTag.tsx`; `src/routes/(main)/home/_layout/Header/components/Nav.tsx`; `src/routes/(main)/home/_layout/Body/BottomMenu/index.tsx`; `src/routes/(mobile)/_layout/NavBar.tsx`; `src/routes/(main)/agent/features/Conversation/Header/Tags/index.tsx`; `src/routes/(main)/(create)/image/features/GenerationFeed/BatchItem.tsx`; `src/routes/(main)/(create)/video/features/GenerationFeed/BatchItem.tsx`; `src/routes/(mobile)/(home)/features/SessionListContent/List/Item/index.tsx`; `src/routes/(mobile)/(home)/features/SessionListContent/Inbox/index.tsx`; `src/routes/(main)/home/_layout/Body/Agent/List/InboxItem.tsx`; 以及相关品牌文案 locale 文件
- 原因：升级工作树最初只恢复了深层 hotfix 与 Vertex/PDF 能力，旧分支长期依赖的 `_custom` 品牌命名、provider 裁剪、导航过滤、首页 starter 控制、模型显示别名等轻量注入层仍缺失，导致升级后会出现品牌文案回退、隐藏入口失效、模型标签退回原始 id 的回归
- 方案：补齐 `_custom` registry /hook/ 组件文件，并在 `v2.1.47` 新路由结构下重新接入首页、导航、会话头部、分享图、provider 列表、图片 / 视频批次、hotkey 文案、metadata 等注入点；同时把默认 locale 改为支持 `{{assistant}}` 占位
- 验证：`bunx vitest run --silent='passed-only' 'src/services/chat/mecha/modelParamsResolver.test.ts'` 通过；`bunx vitest run --silent='passed-only' 'src/routes/(main)/settings/provider/features/ModelList/CreateNewModelModal/__tests__/ExtendParamsSelect.test.tsx'` 通过；`useAgentMeta.test.ts` 受当前依赖环境缺少 `@base-ui/react/tooltip` 子模块影响未完成，不属于本次逻辑回归
- 回滚：移除上述 `_custom` import / 调用点并删除新增 `_custom` registry / 组件文件，恢复官方默认品牌名、导航项与模型展示逻辑

### \[2026-04-07] 修复 webapi 认证链路空 userId 导致 ai_providers 外键报错

- 类型: hotfix
- 涉及文件: `src/app/(backend)/middleware/auth/index.ts`; `src/app/(backend)/middleware/auth/index.test.ts`; `src/app/(backend)/webapi/models/[provider]/route.test.ts`
- 原因：部分 `webapi` 请求在 Better Auth session 已有效但前端用户态尚未同步完成时，会把空 `userId` 编进认证头；服务端继续使用该空值初始化 runtime，会在后续 provider 初始化链路里触发外键风险
- 方案：服务端鉴权优先使用 Better Auth session 的真实 `userId`，并在 session 与 payload 都缺失 `userId` 时直接返回 `401`
- 验证：补充回归测试覆盖 “session userId 优先” 与 “缺失 userId 直接拒绝”
- 回滚：恢复 `jwtPayload.userId || ''` 的旧行为

### \[2026-04-07] 恢复同目录同名文件 “原位覆盖” 策略到 v2.1.47 升级分支

- 类型: custom
- 涉及文件: `packages/database/src/models/file.ts`; `packages/database/src/models/__tests__/file.test.ts`; `src/server/services/file/index.ts`; `src/server/services/file/__tests__/index.test.ts`; `src/server/routers/lambda/file.ts`; `src/server/routers/lambda/__tests__/file.test.ts`
- 原因：官方稳定版仍采用同名新增记录语义，不符合当前业务对 “同目录同名直接覆盖” 的既有行为；该差异会导致资源库再次出现重复文件堆积
- 方案：恢复 `findByName` + `overwrite` 数据层能力；上传入口命中同目录同名时不再新增记录，而是复用原 `file.id` 覆盖内容、重置 chunk/embedding 任务，并按需清理旧 `globalFiles` 与旧底层文件
- 验证：数据库模型、服务层、router 层定向测试通过
- 回滚：移除 `overwrite` / `overwriteFileRecord` 分支，恢复同名直接创建新记录

### \[2026-04-07] 恢复移除 Agent 文件 / 知识库后的本地状态即时收敛

- 类型: custom
- 涉及文件: `src/store/agent/slices/knowledge/action.ts`; `src/store/agent/slices/knowledge/action.test.ts`
- 原因：官方稳定版删除关联后仍主要依赖 revalidate 收敛，部分视图会短暂保留已删除的文件或知识库，造成 “看似没删掉” 的错觉
- 方案：删除接口成功后先同步剔除 `agentMap` 本地对应项，再保留原有刷新逻辑做最终一致性兜底
- 验证：store 定向测试覆盖 “删除后立即剔除” 与 “删除失败不误删本地状态”
- 回滚：移除删除成功后的本地 `agentMap` 同步剔除逻辑

### \[2026-04-07] 恢复 Vertex 原生 PDF 输入与 Agent 关联 PDF 的 file_url 注入

- 类型: custom
- 涉及文件: `src/_custom/services/vertexNativePdf.ts`; `src/_custom/services/vertexNativePdf.test.ts`; `src/_custom/registry/modelCustomization.ts`; `src/_custom/registry/modelCustomization.test.ts`; `src/app/(backend)/webapi/chat/[provider]/route.ts`; `src/services/chat/mecha/contextEngineering.ts`; `src/services/chat/mecha/modelParamsResolver.ts`; `src/services/chat/mecha/modelParamsResolver.test.ts`; `packages/context-engine/src/providers/KnowledgeInjector.ts`; `packages/context-engine/src/providers/__tests__/KnowledgeInjector.test.ts`; `packages/context-engine/src/engine/messages/MessagesEngine.ts`
- 原因：官方稳定版升级分支尚未包含 Vertex native PDF 的自定义接入，且 `thinkingLevel3` 的默认值定制依赖的 `_custom` 文件缺失，会导致 Vertex PDF 能力与 Gemini 3.1 定制行为丢失
- 方案：恢复 `_custom/services/vertexNativePdf` 工具链，在 `vertexai` chat 入口先把 PDF `file_url` 转为 `gs://`；同时让 `contextEngineering -> MessagesEngine -> KnowledgeInjector` 传递 Agent 关联 PDF 的 `url/fileType/size` 并追加 `file_url` part；补齐 `_custom/registry/modelCustomization` 以维持 `thinkingLevel3=low` 的默认规则
- 验证：`KnowledgeInjector`、`vertexNativePdf`、`modelCustomization`、`modelParamsResolver` 定向测试通过
- 回滚：移除 `/webapi/chat/[provider]` 中的 `prepareVertexNativePdfMessages(...)` 注入，恢复 `KnowledgeInjector` 的纯文本知识注入，并删除 `_custom/services/vertexNativePdf.ts` 与 `_custom/registry/modelCustomization.ts`
- 2026-04-08 | Dev infra | 删除误加的 `UPSTASH_REDIS_REST_*` 配置，改为接入本机 `QStash` development server（`QSTASH_URL/TOKEN/SIGNING_KEY`），用于本地 `workflow` 联调；暂未切换 `AGENT_RUNTIME_MODE=queue`，避免改变现有运行语义。
- 2026-04-08 | Dev infra | 当前 dev 环境显式开启 `AGENT_RUNTIME_MODE=queue`，接入本机 `QStash` + 现有 Redis，验证 `2.1.47` 下的队列运行模式；保留通过删除该环境变量回退到本地 `setTimeout` 模式的能力。
- 2026-04-08 | Docs | 新增 `src/_custom/QUEUE_MODE_REGRESSION_CHECKLIST.md`，梳理 `AGENT_RUNTIME_MODE=queue` 下实际受影响的功能点、必测项、已知限制与回退方式。
- 2026-04-08 | Docs | 新增 `src/_custom/QUEUE_MODE_VALIDATION_2026-04-08.md`，记录 queue 模式当前已通过的运行态 / 单测 /integration 验证，以及后续补齐的 dev bypass + magic-link 联调结果。
- 2026-04-08 | Auth hotfix | 调整 `src/_custom/routes/dev-login.ts`：在 `AUTH_ENABLE_MAGIC_LINK=1` 或禁用 email/password 时，dev bypass 直接签发 magic-link verify 跳转，不再依赖 `signInEmail`；同时将 verify redirect host 固定到运行时 `APP_URL`，修复真实域名下错误跳到 `0.0.0.0:3210` 的问题。已通过 `https://chatdev.cotticoffee.com/api/dev/login -> /api/auth/magic-link/verify -> /` 全链路验证。
- 2026-04-08 | Queue hotfix | 修复 `AGENT_RUNTIME_MODE=queue` 下 Vertex/Gemini 通过 `content_part` / `reasoning_part` 返回文本时，`RuntimeExecutors` 只监听 `onText` / `onThinking` 导致 assistant 正文与 reasoning 被写成空字符串的问题；同步补齐 `createCallbacksTransformer` 的聚合逻辑，避免其他依赖 `onCompletion/onFinal` 的链路继续拿到空文本。已通过 `RuntimeExecutors.test.ts` 与 `packages/model-runtime/src/core/streams/protocol.test.ts` 回归测试。
