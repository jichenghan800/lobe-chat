# Cotti Custom Change Log

This file records Cotti-specific changes on top of the clean LobeHub upstream baseline. Keep
entries scoped so future upgrades can decide whether to keep, drop, or replace each customization.

## 2026-07-10

### Home Agent-to-Chat First Run Tool Isolation

- Incident: after switching from Agent mode to Chat mode on the home page, the UI displayed Chat but
  the first submitted message could still receive Agent-only tools and execute them. A second message
  in the same Chat topic behaved correctly.
- Root cause: home submission starts the asynchronous run and immediately navigates to the topic.
  During that transition `HomeAgentIdSync` clears the global `activeAgentId`; the client tools engine
  previously derived mode, plugins, knowledge, and execution target from that route-global state
  instead of the target Agent config already resolved for the run. The missing current config fell
  back to Agent semantics.
- Fix: build the client tools engine from the explicit target Agent ID and runtime-resolved Agent/chat
  config. Search, plugin, knowledge, memory, and execution-target gates now follow that target even
  while route state is changing.
- Defense in depth: after normal and injected manifests are composed, Chat mode applies the shared
  `chatModeAllowedToolIds` allow-list as a final capability wall. Agent-only injected manifests cannot
  reach the outbound model request if an earlier layer regresses.
- Verification: focused tools-engine, tool-composer, and streaming-executor regressions cover an
  undefined global `activeAgentId`, explicit `toolMode: chat` precedence, injected Agent-tool removal,
  and the first Home-to-Chat run. All 81 targeted tests pass.
- Rollback baseline: annotated tag
  `checkpoint-gpt56-before-chat-mode-alignment-20260710` points to commit `710ff9db5b` before this fix.
- Chatdev deployment: image `lobehub:v2.2.8-cotti-chat-mode-fix-20260710-31975c8bb4` is running
  as `lobehub-v228-stage0` on port 3210. The previous GPT-5.6 display image is retained in the stopped
  rollback container `lobehub-v228-stage0-before-chat-mode-fix-20260710154539`.
- Deployment verification: the candidate passed `/api/version` on port 3211 before cutover; after
  cutover, both local port 3210 and `https://chatdev.cotticoffee.com/api/version` returned `2.2.8`,
  and the external root kept the expected sign-in redirect.

## 2026-06-30

### Docker Build Dependency Pin

- Pin `@lobehub/editor` to `4.18.0` because fresh Docker installs can resolve `4.19.2`, whose React
  entry no longer exports `FloatMenu` and fails the SPA build.

### Blue Feishu Auth Allowlist

- Add `mail.cotticoffee.com` to the dev auth email allowlist so Blue Feishu users whose enterprise
  email is returned under that domain can create accounts successfully.
- Root cause: the Better Auth email whitelist runs on user creation; existing users may still log in
  because no new user record is created, while first-time Blue Feishu users are rejected with
  `EMAIL_NOT_ALLOWED` if their email domain is missing from `AUTH_ALLOWED_EMAILS`.

## 2026-06-28

### Global Config AI Provider Pruning

- Trim `/trpc/lambda/config.getGlobalConfig` for Cotti enterprise deployments by applying
  `NEXT_PUBLIC_MODEL_VISIBLE_ALLOW` to `serverConfig.aiProvider` before returning it to the SPA.
- Only providers and `serverModelLists` / `enabledModels` entries referenced by the visible model
  allow-list are returned. This drops unused provider metadata such as Ollama from the first global
  config payload while keeping server-side `getServerGlobalConfig()` untouched for runtime internals.
- Dev deployment: dev container image
  `lobehub:v2.2.8-cotti-global-config-ai-provider-prune-v42` is running on `chatdev`; previous dev
  container is retained as
  `lobehub-v228-stage0-before-global-config-ai-provider-prune-20260628163829`.
- Verification: `chatdev` `/trpc/lambda/config.getGlobalConfig` now returns about 10.6KB and only
  `azure`, `qwen`, `vertexai`, and `volcengine` provider config. `ollama` is no longer present in
  the SPA global config response.

### Agent Topic Model Display Hydration

- Avoid showing the agent's later model config during the first frames of an `/agent/:agentId/:topicId`
  route while the topic summary is still hydrating.
- The chat input model icon and label now keep an empty loading state for topic URLs until a topic or
  message model snapshot arrives, prefer that snapshot when present, and only then fall back to the
  agent config. This prevents GLM task runs from briefly flashing GPT5.5 in the model selector.
- Dev deployment: dev container image `lobehub:v2.2.8-cotti-topic-model-display-v41` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-topic-model-display-20260628014807`.

### Home Agent Model Selection Send Race

- Incident: selecting an Agent-only model such as `智谱-GLM5.2` on the home input could briefly show
  the selected model, then flip back to the previous server-side model (for example Doubao) after the
  task page opened and execution started.
- Root cause: home model switching updates the client store optimistically, while the task page and
  gateway read the persisted agent config during startup. A fast select-and-send path could create
  the topic before the selected `model/provider` was saved, so the next page rehydrated stale config.
- Fix: before the home default send creates the isolated topic, persist the current runtime
  `model/provider` and Agent-mode flag for the selected home agent. The routed page and gateway now
  start from the same model the user selected on the home page.
- Follow-up fix: agent config saves are now awaitable by agent id, and `useFetchAgentConfig` skips
  applying stale server config while a save is in flight. This prevents a fast home select-and-send
  path from aborting the model selection save or rehydrating an older server-side model over the
  optimistic selection.
- Verification: added a focused home input regression test that asserts `glm-5.2/qwen` is saved
  before `sendMessage` is called, plus agent-store tests for waiting on a pending config save and
  blocking stale fetch overwrite while the save is in flight.
- Dev deployment: dev container image `lobehub:v2.2.8-cotti-home-model-save-guard-v40` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-home-model-save-guard-20260628013154`. The earlier `v39` container is
  also retained as `lobehub-v228-stage0-before-home-model-send-race-20260628010424`.

### Chat and Agent Cotti Model Pools

- Change: split the Cotti visible chat model list by input mode. Normal Chat hides
  `volcengine/doubao-seed-2-1-pro-260628`, `qwen/glm-5.2`, and `azure/gpt-5.5`; Agent intelligent
  mode hides `vertexai/gemini-3.1-flash-lite` (`COTTI-快速`).
- Defaults: normal Chat keeps `COTTI-快速` (`vertexai/gemini-3.1-flash-lite`) as the default model.
  Switching into Agent mode from a Chat-only model falls back to `COTTI-专业`
  (`vertexai/gemini-3.5-flash`); switching back to Chat from an Agent-only model falls back to
  `COTTI-快速`.
- Doubao boundary: keep the upstream/source Doubao Seed 2.1 Pro model capabilities and Volcengine
  Responses API support intact, including its source `search` metadata. Cotti runtime env removes
  Doubao from `NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW`, so the enterprise UI does not expose
  builtin 联网 for Doubao by default.
- Deployment: production update script now writes the same model visibility/display/search allow-list
  policy and includes Bailian `qwen/glm-5.2` for Agent-mode-only exposure.
- Dev deployment: dev container image `lobehub:v2.2.8-cotti-chat-agent-pools-v38` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-chat-agent-pools-20260628003644`.

## 2026-06-27

### Bailian GLM-5.2 Channel Switch

- Change: switch the dev GLM-5.2 exposure from `openai/glm-5.2` to Bailian `qwen/glm-5.2`,
  keeping the user-facing display name as `智谱-GLM5.2`.
- Runtime: keep GLM-5.2 on the Qwen/Bailian OpenAI-compatible Chat Completions path and forward the
  GLM-specific `reasoning_effort` value so the existing GLM-5.2 reasoning control remains effective.
- Model parsing: mark Qwen-provider `glm-5` models as function-call and reasoning capable when they
  are discovered from Bailian model metadata.
- Boundary: no Bailian API key is added or changed in source; environments continue to provide
  `QWEN_API_KEY` through deployment/runtime config.
- Dev deployment: dev container image `lobehub:v2.2.8-cotti-bailian-glm52-v37` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-bailian-glm52-20260628000430`.

### Volcengine Doubao 2.1 Pro Replacement

- Change: replace the Cotti-visible Volcengine chat model from `豆包1.6-Flash`
  (`volcengine/doubao-seed-1.6-flash`) to `豆包2.1-Pro`
  (`volcengine/doubao-seed-2-1-pro-260628`).
- Runtime: add the Seed 2.1 Pro model card with 256k context, reasoning, vision, video, function
  calling, and builtin-search capability metadata, and force this model through the Volcengine
  Responses API path so image/multimodal requests match the Ark `/responses` contract.
- Deployment: update Cotti default visibility/display/search allow-list values, local Docker env
  model exposure, and production app update scripts. Seedream image model exposure is unchanged.
- Boundary: no Ark API key is added or changed in source; environments continue to provide
  `VOLCENGINE_API_KEY` through deployment/runtime config.
- Dev deployment: dev container image `lobehub:v2.2.8-cotti-doubao-2-1-pro-v36` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-doubao-2-1-pro-20260627234819`.

### Model Switch Panel Height

- Scope: make the chat input model switch dropdown height follow the current visible model rows
  instead of always using the 460px maximum panel height.
- Fix: remove the unused footer height reservation from the model list area so small Cotti model
  sets no longer leave a large blank area below the options.
- Boundary: model visibility, provider runtime state, pricing/detail popovers, and selected-model
  behavior are unchanged.

### Doubao Streaming Undefined SSE Guard

- Incident: Doubao / Volcengine chat streaming could fail in the browser with
  `"undefined" is not valid JSON`; the client error context showed the raw stream chunk as
  `undefined`.
- Root cause: the shared model-runtime SSE formatter wrote
  `data: ${JSON.stringify(data)}`. When an upstream-compatible stream transformer produced a
  protocol chunk whose `data` was `undefined`, `JSON.stringify(undefined)` returned `undefined`,
  which the template string serialized onto the wire as `data: undefined`. The browser-side
  `fetchSSE` parser expects every SSE `data` field to be valid JSON, so `JSON.parse('undefined')`
  failed before the response could continue.
- Fix: serialize undefined-like protocol data as JSON `null` before emitting SSE, and ignore
  undefined transformer results. This is intentionally implemented in the shared SSE protocol layer
  instead of the Volcengine adapter so any OpenAI-compatible provider that emits sparse chunks gets
  the same wire-format guard.
- Boundary: normal empty-string text chunks, explicit `null` chunks, usage chunks, stop chunks, and
  provider error chunks keep their existing semantics. This change only prevents invalid
  `data: undefined` frames from leaving the server.
- Verification: `bunx vitest run --silent='passed-only' src/core/streams/protocol.test.ts` passed
  from `packages/model-runtime`; `bun run type-check` passed.
- Deployment: dev container image `lobehub:v2.2.8-cotti-doubao-stream-null-v32` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-doubao-stream-null-20260627114741`.

### Home New Model Cotti Replacement

- Change: replace the home `上新` chat shortcuts from `GLM-5.2` and `Kimi K2.7 Code` to
  `COTTI-快速` and `COTTI-专业`.
- Runtime mapping: `COTTI-快速` uses `vertexai/gemini-3.1-flash-lite`; `COTTI-专业` uses
  `vertexai/gemini-3.5-flash`. The business-mode shortcut keeps the existing `lobehub` provider
  branch while using the same model ids.
- Icon behavior: the shortcut buttons now render model icons from the Cotti/Gemini model ids instead
  of the previous GLM and Kimi model ids.
- Verification: `bunx vitest run --silent='passed-only'
'src/routes/(main)/home/features/InputArea/useStarterModelDefaults.test.ts'` passed.
- Deployment: dev container image `lobehub:v2.2.8-cotti-home-new-cotti-models-v33` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-home-new-cotti-models-20260627130749`.

### Chatdev SPA Static Asset Cache Header

- Incident: after the dev image switch, opening `https://chatdev.cotticoffee.com/` could feel
  abnormally slow because the SPA build emits many hashed JS/CSS chunks while the `chatdev` reverse
  proxy was serving `/_spa/` assets with `Cache-Control: public, max-age=0`.
- Fix: update the host Nginx `chatdev` config to override only `/_spa/` and `/_spa-auth/`
  `assets` / `i18n` / `vendor` static build files with
  `Cache-Control: public, max-age=31536000, immutable`. HTML, tRPC, streaming chat endpoints, and
  non-matching files remain uncached.
- Rollback: Nginx config backup is
  `/etc/nginx/conf.d/chatdev.conf.bak.20260627134915-spa-cache`.
- Verification: `nginx -t` passed; `nginx -s reload` completed; sampled SPA asset responses now
  include the immutable cache header while `/spa/desktop` and `/trpc/` still return `no-cache`, and
  a missing root-level `/_spa/sw.js` response does not get immutable caching.

### AI Provider Runtime State Model Pruning

- Incident: the home initialization request
  `/trpc/lambda/aiProvider.getAiProviderRuntimeState` returned the enabled model state after loading
  the full upstream model bank, while Cotti only exposes a fixed enterprise model set. Under ESA,
  the browser waterfall showed the dynamic JSON response spending time in content download even
  though the source server response was fast.
- Fix: prune `enabledAiModels` on the server before returning runtime state. Models in
  `NEXT_PUBLIC_MODEL_VISIBLE_ALLOW` are kept, and non-chat models are kept only when they come from
  explicit Docker/runtime `*_MODEL_LIST` server model configuration. Chat providers, image
  providers, and video providers are now derived from the pruned model list so provider/model state
  stays consistent.
- Boundary: this does not add public caching for `/trpc`; runtime config and login-aware provider
  state remain dynamic. Future enterprise model changes continue to be controlled by Docker env,
  restart, or rebuild.
- Verification: `cd packages/database && bunx vitest run --silent='passed-only'
src/repositories/aiInfra/__tests__/getAiProviderRuntimeState.test.ts` passed; `bun run
type-check` passed.
- Deployment: dev container image `lobehub:v2.2.8-cotti-runtime-state-pruned-v34` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-runtime-state-pruned-20260627174821`.

### Chatdev SPA Route Preload Reduction

- Incident: the web SPA shell was injecting route-level `modulepreload` links for the large desktop
  route preload manifest and a post-load idle route warmup queue. On refresh, this made the browser
  request many chunks for routes that were not needed by the current page.
- Fix: expose `LOBE_ROUTE_CHUNK_PRELOAD` as a Docker build argument so self-hosted Cotti builds can
  disable the Vite route preload plugin without source edits. The dev image was built with
  `--build-arg LOBE_ROUTE_CHUNK_PRELOAD=false`.
- Boundary: this only changes SPA asset preloading. Route code splitting, runtime dynamic imports,
  tRPC behavior, and static asset cache headers are unchanged.
- Verification: local `/spa/desktop` HTML from the dev container now has 66 `modulepreload` links
  and no `idleRoutePreload` script. The previous v34 build had roughly 247 static `modulepreload`
  links plus an idle route warmup queue.
- Deployment: dev container image `lobehub:v2.2.8-cotti-route-preload-off-v35` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-route-preload-off-20260627190858`.

### Production App Update Package for v35

- Release target: prepare immutable production image tag
  `sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.8-cotti-20260627-10d70f5ecd`
  from the chatdev-validated local image `lobehub:v2.2.8-cotti-route-preload-off-v35`;
  pushed registry digest is
  `sha256:c0612e18793e18c63d15263757213b71f52d54259a30ab67978b11736c9c1c16`.
- Package: generated production app-update package
  `src/_custom/deploy/dist/lobechat-prod-app-update-v2.2.8-cotti-20260627-10d70f5ecd.tar.gz`.
  The package contains `release.env`, the tracked production compose file, and the three production
  update scripts. It contains no secrets.
- Scope: this package carries the 2026-06-27 dev-validated fixes for Doubao SSE undefined chunks,
  home Cotti starter models, runtime-state model pruning, and SPA route preload reduction.
- Boundary: only the image and update package have been prepared. The production server has not run
  `02-confirm-and-update-app.sh`, so the running production container is unchanged until the package
  is copied to production and the update script is confirmed there.

### Agent Task Follow-Up Waiting Hint

- Change: make the task drawer follow-up waiting hint more visible by increasing the text size,
  using the theme primary color, matching the loading dots to that color, and adding a little more
  vertical space above the reply editor.
- Fix: hide the waiting hint as soon as the submitted follow-up receives a visible Agent reply in
  the current drawer conversation. The detection now covers normal assistant messages plus
  Agent-style `assistantGroup` and `supervisor` replies, including replies that arrive through the
  realtime message store before the fallback polling finishes.
- Boundary: this only changes the right-side task topic drawer follow-up input. It does not change
  task execution, gateway scheduling, QStash, or message persistence.
- Verification: `bunx vitest run --silent='passed-only'
src/features/AgentTasks/AgentTaskDetail/TopicChatDrawer/fallbackRefresh.test.ts` passed; targeted
  eslint passed for the changed task drawer files.

### Chatdev Static 404 Cache Guard

- Change: update host Nginx `chatdev.cotticoffee.com` static SPA location to intercept missing
  `/_spa/` and `/_spa-auth/` static resources and return 404 with
  `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`,
  `CDN-Cache-Control: no-store`, and `Vercel-CDN-Cache-Control: no-store`.
- Scope: the guard only applies to static build-file extensions under `assets`, `i18n`, and
  `vendor`. Real hashed static resources continue to return
  `Cache-Control: public, max-age=31536000, immutable`.
- Boundary: this is a source Nginx safeguard only. ESA still needs its static-resource browser cache
  policy changed from custom one-year override to following origin headers; otherwise ESA can still
  rewrite a 404 response to browser `Cache-Control: max-age=31536000`.
- Verification: `nginx -t` passed and Nginx was reloaded. Direct-origin checks with
  `--resolve chatdev.cotticoffee.com:443:127.0.0.1` confirmed static 404 responses are now
  `no-store`, while existing i18n static resources still return one-year immutable cache headers.

## 2026-06-26

### Production App Update Package Preparation

- Change: add a tracked production Compose source at `src/_custom/deploy/docker-compose.prod.yml`
  and make the app-update package generator use it when no root `docker-compose.prod.yml` exists.
- Release target: prepare immutable production image tag
  `sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.8-cotti-20260626-b2976351ad`
  from the chatdev-validated local image `lobehub:v2.2.8-cotti-chat-agent-model-split-v31`;
  pushed registry digest is
  `sha256:6040b94fa65519f4cd7b31a7f63257727329e1f909ae3f6180e74853317a9b32`.
- Boundary: no secrets are committed. The generated update package still relies on the production
  server's existing `.env` and only updates `LOBECHAT_IMAGE` plus the known model exposure env keys.
- QStash: production Compose now includes the self-hosted `lobechat-qstash` service, matching the
  chatdev local-server pattern. The update script starts QStash, reads its token/signing keys from
  startup logs, writes them into the server `.env`, sets `AGENT_RUNTIME_MODE=queue`, and points
  `QSTASH_URL` to the Compose service URL `http://qstash:8080`.
- Model access: production env keeps `gpt-5.5` (`全能效率`) available for Agent mode while hiding it
  from normal Chat mode. `glm-5.2` (`智谱-GLM5.2`) is removed from the production visible model allow
  list, display-name mapping, and OpenAI model list. The app update script also writes
  `COTTI_AGENT_ACCESS_MODE=open` so Agent-mode model access is not blocked by the env allowlist.
- Rollback: production script keeps a timestamped `.env` backup before changing runtime config; image
  rollback is done by restoring the previous `LOBECHAT_IMAGE` and restarting the Compose `app`
  service.

## 2026-06-25

### Chat and Agent Model Visibility Split

- Change: hide `gpt-5.5` (`全能效率`) and `glm-5.2` (`智谱-GLM5.2`) from the normal Chat model
  switcher, while keeping both models available when the input is actively in Agent mode.
- Boundary: runtime provider configuration and existing Agent configs are not rewritten. Other model
  selectors keep the full enabled model list unless they explicitly opt into the Chat-only filter.
- Reason: both models are intended for Agent/tool workloads in the current Cotti deployment; normal
  Chat should steer users toward the lighter Cotti models.
- Verification: unit coverage for the Cotti model availability filter passed; `bun run type-check`
  passed; targeted eslint passed. Browser verification on `chatdev` confirmed active Agent mode still
  shows both models, while Chat mode hides both.
- Follow-up: keep the boundary mode-based, not route-based. Home and Agent-route `对话` mode hide
  these two models; switching the same input to `智能` mode includes them.
- Deployment: dev container image `lobehub:v2.2.8-cotti-chat-agent-model-split-v31` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-home-agent-mode-model-split-fix-20260625175417`.

### Marketplace Agent Model Normalization

- Incident: agents imported or forked from the LobeHub community can keep the marketplace author's
  original model provider, for example `newapi/gemini-2.5-pro`. In the Cotti deployment that provider
  is not enabled, so the first chat request can fail and prompt the user to enter a custom New API key.
- Fix: normalize Cotti marketplace imports to `vertexai/gemini-3.1-flash-lite` (`COTTI-快速`) at the
  local creation boundary. This applies to direct community add, fork-and-chat, onboarding/batch
  marketplace installs, and community group-agent member creation.
- Boundary: this only affects newly imported/forked marketplace agents. Existing agents and manual
  user model switches are not rewritten.
- Verification: `bunx vitest run --silent='passed-only' src/services/installMarketplaceAgents.test.ts`
  passed; `bun run type-check` passed.
- Deployment: dev container image `lobehub:v2.2.8-cotti-marketplace-cotti-fast-v26` is running on
  `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-before-marketplace-cotti-fast-20260625105437`.

## 2026-06-23

### Composio Server Configuration

- Change: enable Composio integrations through the server-only `COMPOSIO_API_KEY`
  environment variable in deployment env files.
- Boundary: the real API key must stay in ignored runtime env files such as `.env` and
  `docker-compose/deploy/.env`; do not commit the secret value to source control or docs.
- Runtime behavior: `enableComposio` is derived from whether `COMPOSIO_API_KEY` exists, so changing
  the value requires recreating the server container, not just restarting it.

### Resource Page List Payload Performance

- Incident: `https://chatdev.cotticoffee.com/resource` loaded slowly and sometimes surfaced
  `ERR_INCOMPLETE_CHUNKED_ENCODING 200 (OK)` on the batched TRPC request
  `file.getKnowledgeItems,knowledgeBase.getKnowledgeBases`.
- Root cause: the resource list query returned `documents.content` and `documents.editor_data` for
  every list row. After Excel parsing support was enabled, uploaded Excel files created large mirror
  document bodies. The first resource page requested only 50 rows, but the old response still carried
  about 5.5 MB of document text plus editor JSON, including `维修.xlsx` at about 1.79 MB by itself.
- Fix: keep resource list responses lightweight by returning `content: null` and `editorData: null`
  from `KnowledgeRepo.query`, `KnowledgeRepo.queryRecent`, and `file.getKnowledgeItems`.
- Boundary: detail/edit paths still fetch full document bodies through `fileService.getKnowledgeItem`
  and `document.getDocumentById`; only list-style resource responses are trimmed.
- Verification: the same resource-page TRPC request now returns 200 without chunked-encoding errors,
  response body is about 34 KB for 49 items, and no returned list item contains `content` or
  `editorData`.
- Tests: `bunx vitest run --silent='passed-only' apps/server/src/routers/lambda/__tests__/file.test.ts`
  passed; `bun run type-check` passed. The database repository test did not run because the local
  PGLite migration harness currently fails on a preexisting multi-statement migration.
- Deployment: dev container image
  `sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.8-cotti-20260623-af45efa975`
  is running on `chatdev`; previous dev container is retained as
  `lobehub-v228-stage0-prev-before-resource-trim-194404`.

### Agent Config Payload Performance

- Incident: `agent.getAgentConfigById` and `agent.updateAgentConfig` could fail in the browser with
  `ERR_INCOMPLETE_CHUNKED_ENCODING 200 (OK)` after large Excel-backed files were attached to an
  agent.
- Root cause: `AgentModel.enrichAgentWithKnowledge` embedded full `documents.content` into
  `agent.files[].content` for enabled files. The agent config API and the update mutation both
  returned that full payload to the browser, so saving a small slider value could still transfer
  megabytes of file text.
- Fix: agent config reads omit file content by default. Runtime context construction explicitly
  resolves enabled file content server-side from `documents` when building model context.
- Boundary: file metadata and enabled states remain available to the UI; full file text is reserved
  for server-side model-context construction.
- Verification: `bun run type-check` passed. The focused database test is blocked by the existing
  local PGLite multi-statement migration issue; existing agent service/route tests need Cotti access
  mocks before they can be used as regression coverage.
- Deployment: dev container image
  `sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.8-cotti-20260623-33ee730e0d`
  is running on `chatdev` and pushed to Aliyun with digest
  `sha256:fd756b08cb260a6abc3ab824420fa168e3287902b1f0ec16c31fa2f846e763a5`; previous dev
  container is retained as `lobehub-v228-stage0-prev-before-agent-trim-200017`.

### Cloud Sandbox File Visibility

- Finding: enabling Cloud Sandbox does not make Resource, Knowledge Base, or Agent document files
  automatically visible to shell commands. The sandbox has an isolated filesystem, and command/file
  tools can only see files that were explicitly synced into the sandbox.
- Current behavior: sandbox bootstrap syncs files attached to messages in the current
  topic and files attached to the topic's session, placing them under `/mnt/data`.
- Boundary: files uploaded through Resource/Knowledge Base/Agent document management remain in
  database/object storage and may be available to model context or knowledge search, but they are not
  raw files in `/mnt/data` for Python, shell, `find`, or `pandas` unless separately attached/synced.
- Cotti extension: Resource Excel/CSV selections can be explicitly attached to the current Agent
  chat input. This reuses the uploaded-attachment path, does not trigger chunking/embedding, and
  lets the sandbox preload the raw workbook under `/mnt/data` after the message is sent.
- Cotti fix: sandbox file-init markers include a fingerprint of the attachment list so newly
  attached files can be synced even if the topic had initialized a sandbox earlier.
- Limits: sandbox init skips files larger than 100 MB and syncs at most 50 files, so large Excel
  workbooks can still be absent even when they are associated with the conversation.
- Product direction: large Excel analysis should use a dedicated table-analysis flow that copies or
  mounts the selected workbook into the sandbox, then runs Python/DuckDB/Pandas over that file. Plain
  document chunking remains suitable only for semantic lookup, not exact spreadsheet analysis.

### Agent Mode Attachment Response Payload

- Incident: sending a direct-uploaded large Excel file from an Agent page could fail in the browser
  with `Failed to fetch` / `ERR_INCOMPLETE_CHUNKED_ENCODING` before chunking or embedding started.
- Root cause: after creating the user/assistant message pair, `sendMessageInServer` queried and
  returned the latest message list. Message queries included parsed document bodies in
  `fileList[].content`, so a large Excel attachment was serialized back to the browser in the TRPC
  response.
- Fix: add an `includeFileContent` switch to `MessageModel.query`. For Agent Mode sends with file
  attachments, `sendMessageInServer` returns metadata-only file entries; ordinary Chat remains
  unchanged so small direct attachments can still be read by the model through the existing direct
  content path.
- Boundary: this does not replace the large-Excel analysis flow. Agent Mode should still use sandbox
  file sync plus Python/DuckDB/Pandas for exact spreadsheet analysis.

## 2026-06-22

### GPT-5.5 and Public Model Exposure

- Runtime/source behavior: switch public `全能效率` from Azure exposure to the OpenAI provider key
  `openai/gpt-5.5`, while keeping the display name unchanged as `全能效率`.
- Runtime env: `OPENAI_PROXY_URL` points to the Singapore ModelVerse channel
  `https://api-sg.umodelverse.ai/v1`; deployment packages copy this value into `.env` instead of
  relying on an external `/opt/pptone/.env` reference.
- Runtime env: keep the public model allow list aligned across source registry and production
  scripts:
  `vertexai/gemini-3.1-flash-lite`, `vertexai/gemini-3.5-flash`,
  `volcengine/doubao-seed-1.6-flash`, `qwen/qwen3.7-plus`, and `openai/gpt-5.5`.
- Boundary: Azure remains enabled for `gpt-image-2` image generation only; `gpt-5.5` is no longer
  exposed through `AZURE_MODEL_LIST`.

### Cotti Builtin Agent Identity

- Replaced the official builtin inbox agent persona from `You are Lobe` to `You are Cotti`.
- Replaced the official Agent Builder persona from `You are Lobe, an Agent Builder integrated into
LobeHub` to `You are Cotti, an Agent Builder integrated into CottiAI`.
- Removed the runtime `applyCottiAssistantIdentity` system-role injection from normal chat context
  engineering and server-side agent execution.
- Boundary: this follows the upstream pattern of defining identity in builtin agent prompts instead
  of appending an extra per-model identity guard; user-customized agent `systemRole` values are still
  not overwritten by builtin runtime defaults.

### Production Deployment and Runtime Guards

- Added/updated production scripts under `src/_custom/deploy/` so the release package performs
  explicit preflight, confirmation, image update, and acceptance checks.
- Preflight now validates required deployment files, provider credentials, Redis URL scheme,
  SearXNG JSON search support, registry manifest readability, compose render output, and database
  readiness before mutating production.
- Runtime env: production Redis URL must include `redis://` or `rediss://`; missing schemes fail
  preflight because Node URL parsing otherwise treats the value ambiguously.
- Runtime behavior: production compose explicitly mounts `./searxng-settings.yml` into
  `/etc/searxng/settings.yml:ro`, preventing SearXNG from silently using an old anonymous-volume
  config.
- Runtime behavior: SearXNG search formats now include both `html` and `json`; LobeChat search
  requests to `/search?format=json` are expected to return 200 instead of 403.
- Operational boundary: production CPU/memory/PID limits can be removed at compose level, but the
  2026-06-22 incident showed app CPU saturation was caused by request/data/config behavior rather
  than Docker resource limits.
- Known noise: Upstash/QStash startup warnings remain expected when `QSTASH_TOKEN` is not provided;
  this release does not enable Upstash Workflow.

### Production Diagnostics for Market, Skills, Documents, and Temp Files

- Added targeted `debug` namespaces for production diagnosis:
  `lobe-server:market-user-info`, `lobe-server:market:skill-router`,
  `lobe-server:agent-skills-router`, `lobe-server:agent-document-router`, and
  `lobe-server:temp-file-manager`.
- Scope: logs include route duration/count/status metadata needed to distinguish slow backend
  handlers from request storms, while avoiding secret values.
- Incident finding: production app stalls around `agt_Nqi7UDs5vet3` / `T-10` correlated with
  repeated SearchService 403 failures from SearXNG JSON being disabled in the running container,
  not with PostgreSQL saturation.
- Incident finding: `market.skill.* invalid_token` and Klavis-not-configured errors were noisy but
  not sufficient alone to explain the final search-related CPU storm.

### File Upload, Excel, and OSS Deletion

- Image generation upload UI now validates oversized image files before submit so large images do
  not silently fail without an error.
- Excel loader capacity was raised and tested for larger `.xlsx` input handling.
- Fixed Aliyun OSS delete behavior by supplying the required `Content-MD5` header for delete
  payloads, resolving `MissingArgument: Content-MD5` from OSS.
- File deletion flow now tolerates object-store delete misses and cleans local file records without
  surfacing stale `File not found` errors after a partial remote delete.
- Verification: S3 module and lambda file router tests pass after the OSS delete fix.

### Agent Runtime Task Output

- Fixed task output handling so agent-runtime generated content is persisted instead of leaving
  completed automatic tasks without visible results.
- Boundary: the broader AgentRuntime test suite still has a preexisting
  `@lobechat/tool-runtime` import resolution blocker; targeted runtime executor tests were updated
  with this change.

### Task Detail Page Performance

- Desktop task workspace now avoids mounting the right-side `AgentTaskManager` conversation while
  the task agent panel is collapsed.
- Runtime behavior: this prevents hidden `ChatInput`, agent config, tool, Search, and Klavis-related
  initialization from slowing every task detail page load.
- Fixed task-agent context detection for `/agent/:aid/task/:taskId`; previously only
  `/task/:taskId` was recognized, causing agent task detail pages such as
  `/agent/agt_4qC5zJhhJIbi/task/T-3` to fall back to task-list context.
- Runtime behavior: task run drawers now render chat messages without prefetching full agent
  resources. This avoids pulling every agent document body (for example 29 knowledge documents) when
  opening a read-only run result such as `/agent/agt_4qC5zJhhJIbi/task/T-6`.
- Boundary: normal chat pages keep the default resource fetch path, so continuing a conversation
  with an agent still loads agent documents, notebook documents, and topic memories as before.
- Verification: `TaskAgentProvider` and `TaskWorkspaceLayout` tests cover the collapsed-panel and
  agent-task-route behavior.

## 2026-06-12

### Cotti Assistant Identity

- Scope: append a Cotti-only assistant identity guard to server-side agent `systemRole` before
  model execution and to normal chat context engineering before message assembly.
- Runtime behavior: when users ask the assistant name, identity, source, training party, developer,
  or affiliated organization, the assistant is instructed to answer as `Cotti` instead of Lobe,
  Google, or the underlying model/provider.
- Boundary: existing user/system prompts are preserved and the identity guard is appended centrally
  in `AiAgentService.execAgent` and `services/chat/mecha/contextEngineering`.

### Agent Access Allowlist

- Scope: add Cotti-only Agent access control with `COTTI_AGENT_ACCESS_MODE`,
  `COTTI_AGENT_ALLOWED_EMAILS`, and `COTTI_AGENT_ALLOWED_USER_IDS`.
- Scope: add database-backed Agent access settings and a settings page under System, allowing
  admins to switch mode and manage allowlist rules without restarting containers.
- Scope: add local platform-user autocomplete on the Agent allowlist page, backed by the existing
  `users` table and restricted to platform admins.
- Runtime behavior: users outside the allowlist see Chat-only UI, cannot select Agent Mode, and
  receive server-side Chat-only agent configs.
- Runtime behavior: once the database setting row exists, Agent access is resolved from
  `cotti_agent_access_settings` and `cotti_agent_access_rules`; env vars remain the bootstrap
  fallback before the admin page saves a mode.
- Runtime behavior: allowlist email matching is by mailbox prefix, so `name@cotticoffee.com` can
  also authorize the same mailbox prefix on another login domain.
- Safety boundary: non-allowlisted users cannot persist `chatConfig.enableAgentMode=true`; existing
  Agent configs are downgraded at read/execution time, and heterogeneous Agent sandbox dispatch is
  rejected before sandbox spawn.
- Extension point: access checks are centralized under `src/_custom/registry/agentAccess*`, so a
  future Feishu department resolver can plug into the same boundary.

### Platform Management

- Scope: move platform usage analytics, feedback analytics, Agent access, and compliance audit into
  a dedicated `平台管理` settings group visible under the same platform-admin gate.
- Scope: add first-version compliance audit under settings, backed by existing message/session/user
  data plus a `cotti_audit_view_logs` table for administrator message-view traceability.
- Runtime behavior: audit listing supports time range, user email, feature type, and risk-level
  filters; message detail viewing records who viewed which message without duplicating message
  content into the audit table.
- Boundary: risk tags are deterministic rules in the server service for credentials, company
  confidential terms, personal information, sensitive operations, attachments, and tool calls.

### Cotti Model Aliases

- Runtime/source defaults expose `COTTI-快速` on `vertexai/gemini-3.1-flash-lite`,
  `COTTI-专业` on `vertexai/gemini-3.5-flash`, and `豆包1.6-Flash` on
  `volcengine/doubao-seed-1.6-flash`.
- Runtime env defaults `DEFAULT_AGENT_CONFIG` to `vertexai/gemini-3.1-flash-lite` and exposes five
  public chat models in order: `COTTI-快速`, `COTTI-专业`, `豆包1.6-Flash`, `千问3.7-Plus`, and
  `全能效率`.
- Runtime/source defaults add `豆包1.6-Flash` on `volcengine/doubao-seed-1.6-flash`, backed by the
  existing OpenAI-compatible Volcengine runtime and the built-in deployment mapping to
  `doubao-seed-1-6-flash-250828`.
- Runtime env copies the Ark API key into local `VOLCENGINE_API_KEY`; production template keeps a
  `CHANGE_ME` placeholder.
- Production env template includes both Vertex AI models in `VERTEXAI_MODEL_LIST` and public model
  visibility/display-name envs, and enables
  `VOLCENGINE_MODEL_LIST=-all,+doubao-seed-1.6-flash=豆包1.6-Flash`.
- Added Aliyun Bailian Qwen via the existing `qwen` OpenAI-compatible runtime:
  `qwen/qwen3.7-plus` is visible as `千问3.7-Plus`, with `QWEN_MODEL_LIST` restricted to that
  model and provider calls handled by the existing Qwen Chat Completions payload mapping.
- Qwen env model declaration explicitly exposes reasoning, vision, function calling, and search
  capabilities; detailed thinking/search behavior remains on the upstream provider path.
- Production update scripts synchronize `VERTEXAI_MODEL_LIST`, `QWEN_MODEL_LIST`,
  `AZURE_MODEL_LIST`, and `VOLCENGINE_MODEL_LIST` with the public allow list so all five chat models
  are available after deployment when provider credentials are present.
- Runtime behavior: Cotti public model allow-list entries stay enabled even if a database model
  override has `enabled=false`, keeping development and production model switchers aligned at five
  chat models when provider credentials are present.
- Settings UI: the `平台管理` group is expanded by default in the settings sidebar.
- Home starter label now shows a lightweight safety reminder:
  `安全提醒：平台安全可控但非100%无风险，对话将用于合规审计；请勿处理公司机密或敏感信息。`
- Default reasoning controls now start at low intensity (`thinkingLevel=low`,
  `reasoningEffort=low`) and user memory defaults to disabled at both agent and global settings
  levels.

### Image Generation Exposure

- Runtime env: expose only `doubao-seedream-5-0-260128=Seedream 5.0 Lite` as the Volcengine image
  model, alongside the existing `豆包1.6-Flash` chat model.
- Runtime env: expose Azure `gpt-image-2=GPT Image 2` again through `AZURE_MODEL_LIST`, using the
  existing dedicated `AZURE_IMAGE_*` runtime override.
- Runtime env: set `NEXT_PUBLIC_NAV_HIDE_IMAGE=0` and `NEXT_PUBLIC_HOME_STARTER_HIDE_IMAGE=0` so the
  image generation entry is visible.
- Runtime env: set `FEATURE_FLAGS=+ai_image` and remove `starterList` from
  `NEXT_PUBLIC_COTTI_HOME_HIDDEN_BLOCKS` so the home `New` shortcut row is visible.
- Runtime env: keep `image` and `image2` hidden from `NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS`
  so the home `New` shortcut row does not show duplicate image shortcuts.
- Runtime behavior: when the hidden starter is enabled, home image starter opens
  `/image?model=doubao-seedream-5-0-260128&provider=volcengine`.
- Runtime behavior: when the hidden starter is enabled, home `New` shortcuts include a GPT Image 2
  button that opens
  `/image?model=gpt-image-2&provider=azure`.
- Runtime behavior: keep the home recommendation block visible.
- Runtime behavior: render the home security reminder as two explicit lines.
- Boundary: image generation count remains fixed at one output through the existing
  `COTTI_FIXED_IMAGE_GENERATION_COUNT` customization.
- Runtime behavior: hide video generation from the image/video mode switch when
  `NEXT_PUBLIC_NAV_HIDE_VIDEO=1`, and redirect direct `/video` access back to `/image`.

## 2026-06-01

### Platform Analytics

- Scope: add a Cotti-only platform usage analytics settings page for aggregate traffic, user,
  feature, model, token, cost, and error visibility.
- Scope: add a read-only TRPC analytics endpoint backed by existing `messages`, `users`,
  `generation_*`, and related tables; no new tracking table or model-call interception is added.
- Runtime env: show the page with `NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS=1` and restrict server
  access with `COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS` or Better Auth `users.role='admin'`.
- Boundary: first version is operational reporting only. It does not expose prompt content, enforce
  quotas, or add billing controls.

## 2026-05-31

### Production Compose Preparation

- Added root `docker-compose.prod.yml` for the production LobeChat stack.
- The production stack manages the app, ParadeDB/PostgreSQL, and SearXNG together.
- Kept the old production container name `lobehub` free for rollback; the new app
  container is `lobechat-app`.
- Added same-host resource isolation defaults for app, PostgreSQL, and SearXNG: CPU, memory, pids,
  PostgreSQL shared memory, and JSON log rotation limits.
- Added `src/_custom/deploy/production-compose-runbook.md` with migration,
  rollback, and cleanup commands for moving data from Aliyun RDS to the
  Compose-managed database.
- Added `src/_custom/deploy/generate-production-package.sh` to build a local ignored production
  package from dev `.env`, preserving real secrets while forcing production domain, database,
  Redis prefix, image tag, and dev-bypass safety overrides.
- Added `PG_CLIENT_IMAGE=postgres:18-alpine` for migration tooling because the old Aliyun RDS
  server reported PostgreSQL 18.3, while `pg_dump` 17 refuses to dump newer servers.
- Ensured migration scripts create both `vector` and `pg_search` extensions immediately after
  recreating the target database and before `pg_restore`, because restored tables use
  `public.vector(...)` columns.
- Pinned `vector` extension creation to `WITH SCHEMA public` so restored dumps that reference
  `public.vector(...)` and `public.vector_cosine_ops` can create vector tables and indexes.
- Also run `ALTER EXTENSION vector SET SCHEMA public` before restore to handle images/databases
  where the `vector` extension is already preinstalled outside the `public` schema.
- Set the production database and role `search_path` to `public, paradedb` after `createdb`, matching
  the working dev database and ensuring unqualified official migration tables are created in
  `public`.

### Deep Thinking Temporary Disable

- Runtime env removes `anthropic/claude-opus-4-7` from `NEXT_PUBLIC_MODEL_VISIBLE_ALLOW` and
  `NEXT_PUBLIC_MODEL_DISPLAY_NAMES`, so the public model switch only shows `灵感探索` and `全能效率`.
- Runtime env sets `ENABLED_ANTHROPIC=0` and `ANTHROPIC_MODEL_LIST=-all`.
- Boundary: Anthropic credentials are preserved in `.env` for quick rollback; no source defaults or
  historical test records are changed.

### Production Image Build

- Built dev-verified image `lobehub-cotti:v2.2.1-cotti-market-auth-recovery` after temporarily
  disabling `深度思考`.
- Tagged and pushed production image
  `sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-20260531-212414-ea0b6997f2-eef7f94`.
- Registry digest:
  `sha256:d69b5f1d1f9e2ba156e68cb70addc003945ff9f0e2521a5f382a2be04c36ef9d`.
- Added `.dockerignore` entries for local release artifacts so screenshots/backups do not enter
  future Docker build contexts.

### Production Env Template

- Added `.env.production.example` as the sanitized production runtime template for
  `chat.cotticoffee.com`.
- Scope: records the production image tag, compose database/search settings, public model exposure,
  temporary `深度思考` disablement, branding, image/video policy, platform-management visibility,
  and required secret placeholders.
- Boundary: real secrets remain server-local and are not committed.

### Default Chat Mode

- Runtime env now appends `chatConfig.enableAgentMode=false` to `DEFAULT_AGENT_CONFIG`, so new
  default inbox conversations start in Chat mode instead of Agent mode.
- Dev database backfill set existing `slug='inbox'` agents to `chat_config.enableAgentMode=false`.
- Boundary: existing user-created agents are not changed, and users can still explicitly switch a
  conversation back to Agent mode from the UI.

## 2026-05-30

### Blue Feishu SSO

- Source: migrated the working `feishu-blue` provider approach from the Cotti v2.2.0 branch to
  the clean official v2.2.1 baseline.
- Scope: reusable `createFeishuProvider`, `feishu-blue` provider registration, Blue Feishu env
  recognition, login label, and login icon color.
- Runtime config: set `AUTH_SSO_PROVIDERS=feishu,feishu-blue` after deployment, with
  `AUTH_FEISHU_BLUE_APP_ID` and `AUTH_FEISHU_BLUE_APP_SECRET` provided by the runtime environment.
- Callback requirement: the Blue Feishu app must allow
  `${APP_URL}/api/auth/callback/feishu-blue`.
- Boundary: existing `feishu` behavior is preserved, and the Better Auth route handler is unchanged.

### Chat Model Visibility

- Scope: chat model dropdown is filtered to the three public Cotti model aliases.
- Boundary: provider runtime lists and service-model configuration are intentionally not filtered by
  this display-layer customization.

### Platform Management UI Visibility

- Scope: add `src/_custom/registry/platformManagement.ts` and hide ordinary frontend access to
  model provider settings, service-model settings, messenger settings, API key settings, and
  per-agent message channels.
- Scope: hide home banners that route users to message-channel or messenger setup pages.
- Boundary: this is UI-only. Server-side TRPC permissions, database rows, and direct API behavior
  are intentionally unchanged.

### Brand Env

- Runtime env sets `NEXT_PUBLIC_BRAND_NAME` and `NEXT_PUBLIC_BRAND_ASSISTANT_NAME` to `灵枢AI`.
- Runtime env sets SMTP sender display name to `灵枢AI`.
- Boundary: this entry records env-level branding only; no source branding hook was changed here.

### Brand Source Hooks

- Scope: add `src/_custom/registry/branding.ts` and route selected product logo, auth metadata,
  SPA metadata, document title, manifest, watermark, and auth copyright through it.
- Runtime env: reads `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_ASSISTANT_NAME`, and
  `NEXT_PUBLIC_BRAND_LOGO_URL`.
- Boundary: this does not globally rewrite all upstream community/docs/about copy containing
  `LobeHub`.

### Assistant Brand Text

- Scope: replace the default assistant display text `Lobe AI` / `LobeAI` with `灵枢AI` in web UI
  fallbacks, command-menu entries, share surfaces, onboarding text, messenger picker fallbacks,
  and related default locale strings.
- Runtime env: keep `NEXT_PUBLIC_BRAND_ASSISTANT_NAME=灵枢AI`; clear
  `NEXT_PUBLIC_BRAND_LOGO_URL` so this patch does not replace product logos.
- Boundary: logo/image assets, package names, protocol names, Docker identifiers, and the broader
  `LobeHub` product/community naming are intentionally unchanged.

### Home Starter Visibility

- Scope: add `src/_custom/registry/homeVisibility.ts` and hide the home starter models
  `deepseek-v4-pro` and `image` by default.
- Boundary: `Seedance 2.0` visibility is controlled by the later temporary video toggle.

### Azure GPT Image 2

- Scope: add Azure `gpt-image-2` image model metadata and route the home `GPT Image 2` starter
  through `/image?model=gpt-image-2&provider=azure`.
- Scope: add a narrow `AZURE_IMAGE_*` runtime override for Azure `gpt-image-2`, matching the
  dedicated Azure image channel shape used by `/opt/gemini_Refactoring`.
- Runtime env: optional `AZURE_IMAGE_API_KEY`, `AZURE_IMAGE_BASE_URL`,
  `AZURE_IMAGE_API_VERSION`, and `AZURE_IMAGE_MODEL_ID`.
- Boundary: only Azure `gpt-image-2` image generation/editing uses this override. Azure chat and
  other image providers remain on the upstream runtime path.

### Azure GPT-5.5 Chat

- Runtime env: switch the public `全能效率` chat alias from `openai/gpt-5.5` to
  `azure/gpt-5.5`, backed by the Azure OpenAI resource configured in `AZURE_ENDPOINT` and
  `AZURE_API_KEY`.
- Runtime env: expose `gpt-5.5` in `AZURE_MODEL_LIST` with reasoning, vision, and
  function-calling capability flags.
- Runtime env: do not expose Azure GPT-5.5 as model-builtin search; keep chat search on the
  application web-browsing path backed by `SEARCH_PROVIDERS=searxng` and
  `SEARXNG_URL=http://lobe-searxng:8080`.
- Scope: add `src/_custom/registry/modelBuiltinSearch.ts` and apply
  `NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW` while reading enabled model metadata, so Gemini and
  Qwen can keep provider search and Azure GPT-5.5 falls back to application search.
- Boundary: Volcengine Doubao builtin `web_search` is supported through the Responses API and is in
  the default allow list once the 火山方舟联网内容插件 is activated for the account.
- Boundary: existing agents stored as `openai/gpt-5.5` are not migrated by this config step; migrate
  them only after the Azure channel passes live testing.

### Vertex AI Nano Banana 2 Image

- Scope: add Vertex AI `gemini-3.1-flash-image-preview:image` image model metadata, reusing the
  existing Nano Banana 2 parameter schema.
- Runtime env: add `gemini-3.1-flash-image-preview:image=Nano Banana 2` to `VERTEXAI_MODEL_LIST`.
- Boundary: no new icon asset or custom runtime path is added; this uses the upstream Google/Vertex
  image generation runtime.

### Image Generation Controls

- Runtime env: set `AZURE_MODEL_LIST=-all` so Azure image models are not exposed by provider
  fallback lists.
- Runtime env: set `ENABLED_FAL=0` and `ENABLED_COMFYUI=0` because upstream defaults these
  providers to enabled unless explicitly disabled.
- Runtime env: set `NEXT_PUBLIC_NAV_HIDE_IMAGE=1` and `NEXT_PUBLIC_HOME_STARTER_HIDE_IMAGE=1` to
  hide the image generation entry.
- Runtime env: set `AI_IMAGE_DEFAULT_IMAGE_NUM=1`.
- Scope: hide the image count control and force image generation requests to use one output.
- Boundary: model provider availability is still controlled by provider env/model-list config.

### Temporary GPT Image 2 Disable

- Runtime env: keep `AZURE_MODEL_LIST=-all` to remove the configured Azure `gpt-image-2` image
  model from the server model list.
- Runtime env: set `NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS=deepseek-v4-pro,image,video` to
  hide the home GPT Image 2 starter entry.
- Boundary: this is a low-intrusion access-entry disable. Azure GPT Image 2 runtime code and model
  metadata remain in place for a later config-only restore.

### Volcengine Seedance 2.0 Video

- Runtime env: set `VOLCENGINE_API_KEY` from the existing Ark channel credential and expose only
  `doubao-seedance-2-0-260128=Seedance 2.0` through `VOLCENGINE_MODEL_LIST`.
- Runtime env: keep `APP_URL=https://chatdev.cotticoffee.com` so Volcengine video webhooks target
  the current dev domain.
- Runtime env: set `NEXT_PUBLIC_NAV_HIDE_VIDEO=0` and `NEXT_PUBLIC_HOME_STARTER_HIDE_VIDEO=0`
  to expose the video generation entry for testing.
- Boundary: no Jimeng sidecar and no custom video runtime path are added; this uses the upstream
  LobeHub Volcengine video integration.

### Temporary Video Generation Disable

- Runtime env: set `VOLCENGINE_MODEL_LIST=-all` to remove the configured Seedance 2.0 video model
  from the server model list.
- Runtime env: set `NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS=deepseek-v4-pro,image,video` to
  hide the home image and video starter entries.
- Boundary: this is env-only. The `/video` route is not removed by source code; direct access shows
  the video page without an enabled video model.

### Docker Build Dependencies

- Root app declares workspace runtime dependencies needed by Docker/Vite while compiling package
  source from the clean image build.
- Covered packages: `packages/utils`, `packages/builtin-tool-calculator`,
  `packages/file-loaders`, and `packages/openapi`.
- Boundary: no runtime behavior changed.

### Market Community Auth Recovery

- Scope: persist Market token clearing with `market: null` instead of `market: undefined`, because
  the settings merge helper ignores `undefined` and left stale Market refresh tokens in
  `user_settings.market`.
- Scope: add a community avatar dropdown with "My Profile" and "Logout"; logout calls the existing
  MarketAuth `signOut()` action so users can clear Market login records without administrator DB
  intervention.
- Boundary: this only affects LobeHub Market/community authorization state. Primary app login,
  Better Auth SSO, chat model access, and server-side Market APIs are unchanged.

### Agent Dynamic Tool Activation

- Incident: in Agent mode, Gemini/Vertex AI could stream an `activateTools` tool call for
  `lobe-cloud-sandbox`, persist it on the assistant message, then stop without creating the
  corresponding tool message or executing the activator.
- Root cause: the streaming handler only persisted transformed tool calls for UI updates during
  `tool_calls` chunks. If the provider omitted `toolCalls` from the final finish payload, the agent
  runtime saw `toolsCalling=[]` and never entered the `call_tool` step.
- Scope: preserve transformed tool calls on every streamed `tool_calls` chunk so the agent loop can
  execute activator/tool calls even when the finish payload does not repeat them.
- Follow-up: store transformed tool calls synchronously when the stream chunk arrives; keep only the
  UI repaint throttled. This avoids a race where the assistant card shows a tool call but the
  runtime advances before `toolsCalling` is available.
- Boundary: this is separate from Market/community login and sandbox authorization. If sandbox auth
  is expired, the tool execution path should still create a tool message and return an explicit
  authorization error.

### Chatdev Node Heap Guard

- Incident: reopening historical topic `tpc_cCkwJu5wpyuy` showed "fetching latest messages" because
  the LobeChat Node process had hit V8 heap OOM; Nginx then timed out unrelated `/trpc/lambda/*`
  requests after 300s.
- Finding: the topic itself was small, with 22 messages and one 2.4MB xlsx attachment; no
  chunk/embedding task or file chunks were involved.
- Runtime env: set
  `NODE_OPTIONS=--max-old-space-size=8192 --dns-result-order=ipv4first --use-openssl-ca` for the
  chatdev container.
- Boundary: this is an operational guard, not a parser leak fix. If memory climbs again, inspect
  `document.parseFileContent`, Excel parsing, and Agent file attach/detach paths.

### Large Excel Guard In Regular Chat

- Scope: regular chat now rejects xls/xlsx files larger than 128KB before upload and shows a prompt
  to use Agent mode for tool-based analysis. It also rejects multiple Excel files in one upload, and
  a single Excel file with multiple non-empty sheets.
- Reason: upstream regular chat parses Excel through `document.parseFileContent`; a 2.4MB workbook
  took about 66s and peaked near 7GiB RSS on chatdev.
- Boundary: Agent mode and heterogeneous agents remain unrestricted for upload so sandbox / Python /
  DuckDB workflows can handle spreadsheets. In Agent mode, Excel attachment prompts keep only file
  references and omit parsed Excel body content from `<files_info>`.

### Resource Spreadsheet Attachments For Agent

- Scope: resource-manager spreadsheet files can be added to the current Agent input as completed
  attachments without re-uploading, parsing, chunking, or embedding.
- Scope: the Agent input `+ -> Attachments` inline submenu and its `View more` library modal now
  route Excel/CSV files to the same current input attachment path instead of `addFilesToAgent`. If a
  spreadsheet was already enabled as an Agent file relation, clicking it removes that stale relation
  first and then attaches it to the input. The inline submenu checkbox state for spreadsheets follows
  the current input attachment list, not the Agent file-resource `enabled` state.
- Runtime: sandbox file initialization fingerprints the selected file list, so adding files after an
  earlier no-file sandbox initialization downloads them into `/mnt/data` on the next run.
- Boundary: non-spreadsheet resource files keep the upstream knowledge-base / Agent-resource flow.

### Production Model Channel Alignment

- Scope: production deployment env now matches the working dev channel for "全能效率":
  `gpt-5.5` is exposed as `azure/gpt-5.5`, not `openai/gpt-5.5`.
- Scope: production model allow/display defaults remove `glm-5.2`; GLM remains excluded from the
  production visible model list.
- Boundary: chat/agent visibility rules are unchanged. `gpt-5.5` remains an Agent-only model when
  Cotti Agent access is enabled.
