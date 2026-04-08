# v2.1.47 升级二开差异清单

最后更新：2026-04-07

---

## 1. 清单用途

本清单用于把当前运行分支 `rollback/pre-v2.1.44-merge-20260323` 相对本地 `upstream-sync` 的二开差异固化下来，供 `upgrade/v2.1.47-custom-rebase` 逐项回灌使用。

说明：

- `upstream-sync` 当前停留在 `v2.1.33`
- 因此本清单描述的是“现网二开改动集合”
- 升级目标底座不是 `upstream-sync`，而是 tag `v2.1.47`

---

## 2. 差异规模

- 总差异文件数：`256`
- 其中：
  - `src/_custom`：`21`
  - `.github`：`9`
  - `Dockerfile` + `docker-compose`：`7`
  - `packages/database`：`4`
  - `packages/model-runtime` + `packages/context-engine`：`18`
  - `src/app/(backend)` + `src/server` + `src/libs/better-auth`：`12`
  - `src/store` + `src/features`：`40`
  - `locales`：`72`

结论：

- 本次升级不是单点修补，而是中等规模二开迁移
- 但核心高风险区域相对集中，主要在数据库、鉴权、文件链路、Vertex / Google runtime、Docker 部署层

---

## 3. 第一优先级迁移块

这些模块先迁移，决定升级是否可落地。

### 3.1 鉴权与后端入口

- `src/app/(backend)/api/dev/login/route.ts`
- `src/app/(backend)/webapi/chat/[provider]/route.ts`
- `src/libs/better-auth/plugins/email-whitelist.ts`
- `src/libs/better-auth/sso/index.ts`
- `src/libs/better-auth/sso/providers/feishu.ts`

迁移重点：

- dev 登录旁路
- 企业登录 / 白名单策略
- provider chat 路由定制

### 3.2 文件 / 资源库 / 知识库链路

- `packages/database/src/models/file.ts`
- `src/server/routers/lambda/file.ts`
- `src/server/services/file/index.ts`
- `src/store/file/slices/chat/action.ts`
- `src/store/file/slices/upload/action.ts`
- `src/store/agent/slices/knowledge/action.ts`
- `packages/context-engine/src/providers/KnowledgeInjector.ts`
- `packages/prompts/src/prompts/knowledgeBaseQA/formatFileContents.ts`

迁移重点：

- 同目录同名文件覆盖策略
- 资源库与知识库联动
- Agent 关联文件状态一致性
- Vertex 下 PDF 与知识注入链路

### 3.3 Vertex / Google / 模型运行时

- `packages/model-runtime/src/_custom/googleQuotaRetry.ts`
- `packages/model-runtime/src/_custom/mergeGoogleFunctionResponses.ts`
- `packages/model-runtime/src/core/contextBuilders/google.ts`
- `packages/model-runtime/src/providers/google/index.ts`
- `packages/model-runtime/src/providers/google/thinkingResolver.ts`
- `src/services/chat/mecha/contextEngineering.ts`
- `src/services/chat/mecha/modelParamsResolver.ts`
- `src/_custom/services/vertexNativePdf.ts`

迁移重点：

- Google / Vertex quota retry
- function response merge
- Gemini thinking level 默认值
- Vertex 原生 PDF 输入

### 3.4 Docker 与部署

- `Dockerfile`
- `docker-compose/deploy/docker-compose.yml`
- `docker-compose/deploy/.env.example`
- `docker-compose/development/docker-compose.yml`

迁移重点：

- 运行镜像 native 依赖补丁
- 开发 / 部署 compose 差异
- 本地 ParadeDB 切换

---

## 4. 第二优先级迁移块

这些模块对业务体验重要，但不会先阻塞升级底座启动。

### 4.1 `src/_custom` 注入能力

当前已有 `21` 个二开文件：

- `src/_custom/CHANGELOG.md`
- `src/_custom/SECONDARY_DEV_GUIDE.md`
- `src/_custom/SESSION_HANDOFF_2026-03-09.md`
- `src/_custom/VERTEX_PDF_HANDOFF.md`
- `src/_custom/components/ModelDisplayNameTag.tsx`
- `src/_custom/hooks/useModelDisplayName.ts`
- `src/_custom/registry/branding.ts`
- `src/_custom/registry/homeSections.ts`
- `src/_custom/registry/homeStarter.ts`
- `src/_custom/registry/modelCustomization.test.ts`
- `src/_custom/registry/modelCustomization.ts`
- `src/_custom/registry/modelDisplayName.ts`
- `src/_custom/registry/modelSwitchPanel.ts`
- `src/_custom/registry/navigation.ts`
- `src/_custom/registry/providerName.ts`
- `src/_custom/registry/providerVisibility.ts`
- `src/_custom/routes/dev-login.ts`
- `src/_custom/services/vertexNativePdf.test.ts`
- `src/_custom/services/vertexNativePdf.ts`
- `src/_custom/types/vitest-canvas-mock.d.ts`
- `src/_custom/vertexPdfNativePoc.ts`

迁移原则：

- 优先恢复这些注入点
- 再反向补齐它们依赖的上游单行注入

### 4.2 前端 UI / 交互定制

涉及范围：

- 首页导航 / branding / starter
- Model switch panel
- 聊天消息 usage 展示
- 文件 / 资源库操作菜单
- 热键说明
- Agent welcome / profile / tag 展示

结论：

- 这些更适合在后端与运行时稳定后再整体回灌

---

## 5. 第三优先级迁移块

### 5.1 CI / 发布工作流

- `.github/workflows/backflow.yml`
- `.github/workflows/custom-hotfix-gate.yml`
- `.github/workflows/public-security-gate.yml`
- `.github/workflows/release-custom.yml`
- `.github/workflows/sync-upstream.yml`
- `.github/scripts/sync-upstream.sh`
- `scripts/checkCustomHotfixes.mts`
- `scripts/checkPublicRepoSafety.mts`

说明：

- 这些不影响本地开发环境升级演练
- 在应用功能与镜像流程稳定后再恢复到新版分支

### 5.2 多语言与静态资源

- `locales/*` 差异：`72`
- `public/*` 差异：`7`

说明：

- 需要最后统一做一次 diff 和校验
- 避免前期把大量翻译冲突混入核心逻辑升级

---

## 6. 工作树额外热修

以下热修目前仍在当前工作树，尚未进入正式升级分支：

- `src/app/(backend)/middleware/auth/index.ts`
- `packages/database/src/models/aiProvider.ts`
- `src/app/(backend)/middleware/auth/index.test.ts`
- `src/app/(backend)/webapi/models/[provider]/route.test.ts`
- `src/_custom/CHANGELOG.md`

内容：

- 修复 `webapi` 空 `userId` 触发 `ai_providers_user_id_users_id_fk`
- 将 builtin provider 初始化对齐为带 `onConflictDoNothing()` 的稳定写法

处理建议：

1. 单独提交为 hotfix
2. 后续优先 cherry-pick 到 `upgrade/v2.1.47-custom-rebase`

---

## 7. 升级实施顺序

建议按以下波次执行：

1. 波次一：热修基线、鉴权、数据库模型、Docker 运行层
2. 波次二：文件 / 资源库 / 知识库 / Vertex runtime
3. 波次三：`src/_custom` 注入恢复
4. 波次四：前端 UI 定制与多语言
5. 波次五：CI / 发布流程恢复

---

## 8. 下一步动作

1. 把当前热修与升级文档形成可追溯提交
2. 在 `upgrade/v2.1.47-custom-rebase` 先恢复第一优先级模块
3. 在 `upgrade/v2.1.47-db-rehearsal` 再进行本地 ParadeDB 切换和数据迁移演练
