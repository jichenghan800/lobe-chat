# LobeHub v2.1.33 -> v2.1.47 升级与本地 pg_search 数据库切换方案

最后更新：2026-04-07

---

## 1. 目标与边界

- 当前运行基线：`v2.1.33`
- 目标官方稳定版：`v2.1.47`
- 当前本地工作分支：`rollback/pre-v2.1.44-merge-20260323`
- 官方稳定基线来源：本地 tag `v2.1.47`（commit `11318f8ab9`）
- 二开差异提取基线：本地 `upstream-sync`（当前仍停留在 `v2.1.33`）
- 数据库目标：将当前阿里云 PostgreSQL 切换到本地 Docker ParadeDB（已具备 `pg_search` 与 `vector` 扩展）
- 升级原则：
  - 保留全部现有二开能力
  - 优先对齐官方稳定版，再回灌自定义功能
  - 开发环境先完整演练，验证通过后再镜像复制到生产
  - 生产切换必须走维护窗口与可回滚流程

---

## 2. 当前已确认事实

### 2.1 代码与分支

- 当前代码版本：`package.json` 为 `2.1.33`
- 官方稳定版：本地 tag `v2.1.47`
- 本地 `upstream-sync` 当前仍是 `v2.1.33`，因此它用于提取当前二开差异，不直接作为升级底座
- 当前实际运行基线应以 `rollback/pre-v2.1.44-merge-20260323` 为准
- `merge/v2.1.44` 与各类 `backup/*` 分支仅作为差异参考，不作为升级落地分支

### 2.2 本地数据库

- Docker 容器：`paradedb-pg17`
- 镜像：`paradedb/paradedb:0.22.3-pg17`
- DB：`lobehub`
- 用户名：`paradedb`
- 密码：`paradedb`
- 网络：与当前 `lobehub` 容器同处 `deploy_default`
- 已验证扩展：
  - `pg_search`
  - `vector`

### 2.3 当前部署方式

- 当前部署目录：`docker-compose/deploy/`
- 当前应用容器通过 `.env` 中的 `DATABASE_URL` 连接阿里云 PostgreSQL
- 目标连接方式：应用直接连接本地容器 `paradedb-pg17:5432`

---

## 3. 多分支安全升级策略

本次升级不直接在 `main`、`dev` 或当前回滚分支上硬做，采用 4 条升级分支链路。

### 3.1 分支设计

1. `upgrade/v2.1.47-base`
   - 来源：官方稳定 tag `v2.1.47`
   - 职责：作为纯净官方底座，不放任何本地二开代码

2. `upgrade/v2.1.47-custom-rebase`
   - 来源：`upgrade/v2.1.47-base`
   - 职责：把当前业务真正需要保留的二开能力，按模块重新移植到新版
   - 要求：优先按 `src/_custom` 注入规范迁移，减少对上游核心文件的直接改动

3. `upgrade/v2.1.47-db-rehearsal`
   - 来源：`upgrade/v2.1.47-custom-rebase`
   - 职责：仅用于开发环境数据库切换、全量数据迁移演练、镜像构建与联调验证

4. `release/v2.1.47-prod`
   - 来源：`upgrade/v2.1.47-db-rehearsal` 验证通过后的冻结快照
   - 职责：作为生产发布专用分支，只接受发布前必要修正

### 3.2 现有分支的使用方式

- `upstream-sync`
  - 当前视为 `v2.1.33` 官方源码镜像
  - 仅用于提取二开差异，不用于生成新版升级底座

- `rollback/pre-v2.1.44-merge-20260323`
  - 视为当前真实运行基线
  - 用于提取二开差异、排查业务依赖、补充 hotfix

- `merge/v2.1.44`
  - 仅用于回看上次升级合并痕迹
  - 不作为新一轮升级的起点

- `main` / `dev`
  - 在本轮升级完成前不直接承载升级中间态
  - 待 `release/v2.1.47-prod` 稳定后，再按团队流程回合到正式分支

### 3.3 为什么这样拆分

- 避免把“官方升级冲突”和“本地二开兼容问题”混在一起处理
- 避免数据库切换风险和代码升级风险同时进入生产
- 保留一个清晰的官方纯净底座，后续升级可重复使用同样流程

---

## 4. 升级实施总流程

1. 冻结当前运行基线，补齐热修与升级文档
2. 建立 `upgrade/v2.1.47-base`
3. 盘点 `rollback/pre-v2.1.44-merge-20260323` 相对官方基线的全部二开差异
4. 在 `upgrade/v2.1.47-custom-rebase` 按功能块逐项回灌二开能力
5. 在 `upgrade/v2.1.47-db-rehearsal` 完成本地 DB 切换与全量数据迁移演练
6. 在开发环境完成联调、构建、回归测试
7. 冻结为 `release/v2.1.47-prod`
8. 生产维护窗口内执行镜像复制、数据库切换、发布验证
9. 保留旧镜像与旧数据库回滚路径

---

## 5. 开发环境实施步骤

### 5.1 第一步：冻结与记录

- 保留当前热修工作树，不直接丢弃
- 把本次升级文档纳入仓库
- 对当前运行分支生成二开差异清单：
  - 相对 `upstream-sync` 的文件差异
  - 不在 `src/_custom` 内的核心例外修改
  - 数据库、鉴权、文件上传、模型配置等业务关键改动

### 5.2 第二步：创建升级分支

建议命令：

```bash
git branch upgrade/v2.1.47-base v2.1.47
git branch upgrade/v2.1.47-custom-rebase upgrade/v2.1.47-base
git branch upgrade/v2.1.47-db-rehearsal upgrade/v2.1.47-custom-rebase
git branch release/v2.1.47-prod upgrade/v2.1.47-db-rehearsal
```

注意：

- 当前工作树存在未提交 hotfix，不要直接 `checkout` 到新分支
- 先从显式 ref 创建分支，再视情况提交或临时保存当前热修

### 5.3 第三步：回灌二开能力

执行原则：

- 先迁移 `src/_custom` 内的能力
- 再处理 `src/`、`packages/` 中的例外修改
- 所有触碰核心逻辑的迁移，都要补充到 `src/_custom/CHANGELOG.md`

建议按以下模块分批迁移：

1. 鉴权与用户态链路
2. 文件上传 / 资源库 / 知识库
3. Vertex / 模型能力定制
4. Docker 运行层补丁
5. 其他 UI 注入与业务规则

### 5.4 第四步：切换开发环境数据库到本地 ParadeDB

目标连接串：

```env
DATABASE_URL=postgres://paradedb:paradedb@paradedb-pg17:5432/lobehub?sslmode=disable
```

建议做法：

1. 备份当前 `docker-compose/deploy/.env`
2. 将 `DATABASE_URL` 改为本地 ParadeDB
3. 保持其余 Redis、S3、鉴权等外部依赖不变
4. 重建应用容器并做连通性验证

### 5.5 第五步：执行全量数据迁移演练

本次不是空库初始化，而是从阿里云数据库迁移现有业务数据到本地库。

建议步骤：

1. 从阿里云库导出结构与数据
2. 导入本地 ParadeDB
3. 补齐扩展、索引、迁移状态校验
4. 启动升级后的应用对本地库做只读验证
5. 再执行必要的应用迁移脚本与写入验证

建议命令模板：

```bash
pg_dump \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file=backups/aliyun-prod-like.dump \
  "$ALIYUN_DATABASE_URL"

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="postgres://paradedb:paradedb@127.0.0.1:5432/lobehub" \
  backups/aliyun-prod-like.dump
```

仓库内已提供演练脚本：

```bash
ALLOW_DROP=1 \
SOURCE_DATABASE_URL="$ALIYUN_DATABASE_URL" \
TARGET_DATABASE_URL="postgres://paradedb:paradedb@127.0.0.1:5432/lobehub?sslmode=disable" \
bash scripts/rehearse_local_pg_migration.sh
```

导入后检查：

- `users`
- `ai_providers`
- `agents`
- `messages`
- `files`
- `knowledge_bases`
- drizzle 迁移记录表
- `pg_search` / `vector` 扩展可用性

### 5.6 第六步：开发环境验证

至少完成以下验证：

- 应用可启动，登录正常
- 历史用户、Agent、消息、文件可见
- 内建 provider 初始化正常，不再出现 `ai_providers_user_id_users_id_fk`
- 知识库检索正常
- 文件上传、覆盖、关联、删除链路正常
- Vertex / Gemini 定制能力正常
- Docker build 与运行镜像可成功启动

---

## 6. 生产发布策略

### 6.1 发布前提

- `upgrade/v2.1.47-db-rehearsal` 在本机 dev 环境验证通过
- 生成可运行镜像并完成本地验收
- 产出发布记录与回滚清单
- 从验证通过分支切出 `release/v2.1.47-prod`

### 6.2 生产切换方式

生产使用“镜像复制 + 本地数据库替换”的方式，不在生产机上临时拉代码构建。

步骤：

1. 在开发机构建最终镜像
2. `docker save` 导出镜像包
3. 将镜像包复制到生产机
4. 生产机 `docker load`
5. 维护窗口内停止旧容器
6. 将生产 `DATABASE_URL` 指向生产本地 ParadeDB
7. 启动新容器
8. 执行发布后冒烟验证

示例：

```bash
docker build -t lobehub:v2.1.47-custom .
docker save -o lobehub_v2.1.47_custom.tar lobehub:v2.1.47-custom

# 复制到生产机后
docker load -i lobehub_v2.1.47_custom.tar
docker compose up -d
```

### 6.3 生产维护窗口要求

- 发布前冻结写流量
- 在切换前做一次生产数据库最终备份
- 明确最大允许中断时间
- 安排回滚触发阈值：
  - 服务无法启动
  - 登录失败
  - 历史消息 / Agent / 文件不可用
  - 核心模型调用失败

### 6.4 回滚方案

若生产切换失败：

1. 停止新版本容器
2. 恢复旧版本镜像与旧 `DATABASE_URL`
3. 如已执行新库写入且不可接受，恢复到切换前备份快照
4. 使用维护窗口内的验证记录定位失败点后再重试

---

## 7. 本轮升级的执行清单

### 7.1 已完成

- 确认官方最新稳定版为 `v2.1.47`
- 确认当前版本为 `v2.1.33`
- 确认本地 ParadeDB 已具备 `pg_search` 与 `vector`
- 确认当前应用容器与本地 ParadeDB 处于同一 Docker 网络
- 识别当前运行分支与升级参考分支
- 修复一处 `webapi` 空 `userId` 导致 `ai_providers` 外键报错的 hotfix，并补充回归测试

### 7.2 正在执行

- 保存升级文档
- 创建升级分支骨架
- 盘点当前二开差异，形成升级迁移清单

### 7.3 待执行

- 将当前热修妥善提交到独立修复分支或 cherry-pick 到升级链路
- 在 `upgrade/v2.1.47-custom-rebase` 逐步回灌二开能力
- 切换 `docker-compose/deploy/.env` 到本地 ParadeDB
- 执行阿里云数据库全量迁移演练
- 完成本地镜像构建、验证与生产发布包输出

---

## 8. 操作纪律

- 不在脏工作树上直接切换升级分支
- 不把数据库切换与业务改造混成一个大提交
- 每迁移一块二开能力就做一次最小验证
- 所有非注入式核心修改必须同步记录到 `src/_custom/CHANGELOG.md`
- 生产切换前，必须确保旧镜像与旧库备份都可用

---

## 9. 推荐下一步

1. 在当前分支提交 hotfix 与本文档，形成可追溯基线
2. 从 `upstream-sync` 创建 3 条升级分支
3. 生成 `rollback/pre-v2.1.44-merge-20260323` 相对 `upstream-sync` 的差异清单
4. 先处理鉴权、数据库、Docker 这三类高风险改动
5. 完成开发环境 DB 切换与全量数据迁移演练
