# v2.1.47 + 二开 发布就绪说明

最后更新：2026-04-08

---

## 1. 当前落点

- 当前工作分支：`upgrade/v2.1.47-custom-rebase`
- 当前提交：`bd43c8aac2`
- 官方基线：`v2.1.47`（`11318f8ab9`）
- 当前运行版本：`/api/version -> 2.1.47`
- 当前运行方式：Docker 容器 `lobehub`
- 当前数据库：本机 ParadeDB（`pg_search` 已启用）
- 当前 agent runtime：`AGENT_RUNTIME_MODE=queue`
- 当前 QStash：本机 development server

结论：

- 当前这版已经不是 “`v2.1.33 + 局部修补`”
- 而是 “官方 `v2.1.47` 底座 + 已回灌并验证的一组二开能力”

---

## 2. 已纳入当前版本的关键二开能力

### 2.1 鉴权与登录

- 邮箱登录保持 magic link 单路径
- 邮箱白名单仍生效
- `abite.com` / `cotticoffee.com` 归一为同一用户身份
- Feishu SSO 注入入口已保留
- dev bypass 已适配 magic link 模式

### 2.2 数据与文件链路

- 本地 ParadeDB 替代阿里云 PostgreSQL 作为当前 dev 数据库
- 修复空 `userId` 导致的 `ai_providers_user_id_users_id_fk`
- 恢复同目录同名文件 “原位覆盖”
- Agent 文件 / 知识库删除后本地状态即时收敛

### 2.3 Google / Vertex / Queue

- 恢复 Google / Vertex quota retry
- 恢复 Google function response merge
- 恢复 Vertex 原生 PDF 通路
- `queue` 模式下 Vertex / Gemini 文本持久化已修复
- 当前本机 `queue + local QStash` 已完成 smoke 验证

### 2.4 注入式二开入口

- `src/_custom/` 注入层已回灌
- branding /navigation/home starter /model display 定制已在当前分支
- 二开例外修改已登记到 `src/_custom/CHANGELOG.md`

---

## 3. 当前已完成验证

### 3.1 运行态

- `curl http://127.0.0.1:3210/api/version` 返回 `2.1.47`
- Docker 容器启动正常，数据库迁移通过
- 当前容器连接的是本机 ParadeDB，而不是阿里云数据库
- `queue` 模式下实际任务 smoke 已通过，assistant content 可正常入库

### 3.2 定向测试

- `src/server/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts`
- `packages/model-runtime/src/core/streams/protocol.test.ts`

两组回归测试当前均通过。

---

## 4. 仍需区分的两类事项

### 4.1 已经可以视为完成的

- 开发环境已切到真正的 `v2.1.47 + 二开`
- 本地数据库切换方案已落地
- queue 开关已经可开可关，不会绑定死在代码里

### 4.2 还不应假装已经完成的

- 生产环境不能继续使用本机 QStash development server
- 生产如果要保留 `queue/workflow`，需要换成正式 QStash 凭据
- 生产 ParadeDB 还需要单独做数据迁移、备份和回滚演练
- 当前快照提交是工作结果冻结，不代表所有历史 lint /hook 问题已全部清零

---

## 5. 分支收口建议

建议把以下分支都对齐到当前提交 `bd43c8aac2`：

- `upgrade/v2.1.47-custom-rebase`
- `upgrade/v2.1.47-db-rehearsal`
- `release/v2.1.47-prod`

含义：

- `custom-rebase`：二开集成主线
- `db-rehearsal`：本地 ParadeDB 演练结果冻结点
- `release/v2.1.47-prod`：当前生产候选代码基线

---

## 6. 生产前最后动作

1. 准备正式 QStash 凭据，替换本机 local mode 配置
2. 对生产 ParadeDB 做一次迁移前全量备份
3. 用当前 `release/v2.1.47-prod` 构建最终镜像
4. `docker save` 导出镜像并复制到生产机
5. 生产机 `docker load` 后按维护窗口切换
6. 发布后验证登录、历史消息、Feishu、邮箱 magic link、文件上传、知识库、Vertex/Gemini、queue 任务

---

## 7. 回滚锚点

- 代码回滚锚点：原生产分支 / 原生产镜像
- 数据库回滚锚点：生产切换前的全量备份
- 运行模式回滚锚点：
  - 移除 `AGENT_RUNTIME_MODE=queue` 可回退为非 queue 模式
  - 若保留 queue，则必须保证正式 QStash 可用
