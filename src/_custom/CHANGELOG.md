# Cotti Custom Change Log

This file records Cotti-specific changes on top of the clean LobeHub upstream baseline. Keep
entries scoped so future upgrades can decide whether to keep, drop, or replace each customization.

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
- Runtime behavior: users outside the allowlist see Chat-only UI, cannot select Agent Mode, and
  receive server-side Chat-only agent configs.
- Runtime behavior: once the database setting row exists, Agent access is resolved from
  `cotti_agent_access_settings` and `cotti_agent_access_rules`; env vars remain the bootstrap
  fallback before the admin page saves a mode.
- Safety boundary: non-allowlisted users cannot persist `chatConfig.enableAgentMode=true`; existing
  Agent configs are downgraded at read/execution time, and heterogeneous Agent sandbox dispatch is
  rejected before sandbox spawn.
- Extension point: access checks are centralized under `src/_custom/registry/agentAccess*`, so a
  future Feishu department resolver can plug into the same boundary.

### Cotti Model Aliases

- Runtime/source defaults expose `COTTI-快速` on `vertexai/gemini-3.1-flash-lite`,
  `COTTI-专业` on `vertexai/gemini-3.5-flash`, and `豆包1.6-Flash` on
  `volcengine/doubao-seed-1.6-flash`.
- Runtime env defaults `DEFAULT_AGENT_CONFIG` to `vertexai/gemini-3.1-flash-lite` and removes
  the public `全能效率` chat entry from the model switch allow list.
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
- Home starter label now shows a lightweight safety reminder:
  `安全提醒：平台安全可控但非100%无风险，对话将用于合规审计；请勿处理公司机密或敏感信息。`
- Default reasoning controls now start at low intensity (`thinkingLevel=low`,
  `reasoningEffort=low`) and user memory defaults to disabled at both agent and global settings
  levels.

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
