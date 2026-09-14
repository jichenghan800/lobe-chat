# chat.cotti.ai 升级至 v2.2.17（2026-09-14）

按用户确认，同版本升级，保留该域名现有数据；不合并 chatdev 的开发数据库。

## 实际部署边界

- chat.cotti.ai → 本机 3231 → `cotti-v2216-native-app-cotti-1`。容器保留旧名称以维持内部任务回调地址，运行的是新版镜像。
- chatdev → 本机 3232 → `lingshu-v2217-app-dev`；两个应用使用相同镜像，数据库、存储和运行配置各自保留。
- chat.cotti.ai 继续使用 `cotti-v2216-native-postgresql-1 / lobehub_history` 和原 OSS；认证、模型连接、Redis、QStash 等环境变量不变。OnlyBoxes 启用属于环境配置，本轮未复制开发环境的启用配置。
- 保留认证网络与应用网络，应用网络默认路由优先级 100；Nginx 配置不变，不把域名重定向到 chatdev。
- chat.cotticoffee.com 生产服务器不在本次范围。

## 迁移与回退

- 数据库和应用配置备份在 `/opt/backups/chat-cotti-ai-v2217-20260914-185733/`，包含停应用后的 `before-cutover-final.dump`，备份通过 pg\_restore 列表校验。
- 隔离副本按迁移哈希补齐 0158—0164，保留旧二开迁移历史；重复执行两遍，业务表数量与管理策略哈希均未改变。
- 新镜像与旧镜像都在迁移后的副本通过启动和认证健康检查。演练 PG 已停止保留。
- 正式迁移前后核对用户、话题、消息、文档、附件和模型策略；原讲稿话题与 18,968 字符的正文保留。
- 2.2.16 回退容器 `cotti-app-before-v2217-20260914` 已停止且 restart=no。后续展示补丁还保留一次 v2.2.17 应用回退容器。
- 回退应复用现有数据库；不要直接恢复旧数据库备份覆盖上线后新增数据。
- 私有发布脚本、环境快照、迁移及验收记录：`.records/cotti-v2217-cutover-20260914/`。禁止输出凭据或提交私有记录。

本轮通过 Docker 重建应用，旧版 native-v2216/compose.yml 不再代表 app-cotti 当前镜像；后续发布需以本次运行配置快照为基础，不能直接执行旧 Compose 覆盖新版应用。

## 当前镜像及验收

- 两个域名均为 `lobehub:lingshu-v2217-overview-link-20260914-r1`，digest `sha256:61f9b6268746b2e9ddd3b0845be40c1b400b5af860567da8f18dd2b79e5ab244`。
- 全览补丁的回退容器分别为 `cotti-app-before-overview-link-20260914` 和 `lingshu-v2217-app-before-overview-link`，均停止保留。
- 两域运行、镜像一致性、chat.cotti.ai 全部环境变量一致性、原数据与 Nginx 不变、开发资源隔离检查通过。
- 全览粘贴链接复用管理员详情接口，未登录读取被拒绝。解析测试 13 项、lint、全仓类型检查与正式构建通过。
- 浏览器已打开 chat.cotti.ai 登录页，等待用户完成登录后验收粘贴链接。不能将源码和后台检查表述为已完成浏览器端到端验收。
