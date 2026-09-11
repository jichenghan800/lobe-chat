# v2.2.16 当前部署与维护

当前仅使用根目录`compose.yml`部署两个应用入口。[交付清单](../../upgrade/v2.2.16-final-handover.md) · [源码清单](../../upgrade/v2.2.16-customization-code-matrix.md)。

## 发布规则

两个服务的 image 必须引用同一个`cotti_app_image`。发布必须覆盖 app 和 app-cotti 两个服务，不能只更换 chatdev。各自 APP\_URL 与认证配置保持独立；数据库、Redis 和 QStash 共用。

```bash
docker compose -f src/_custom/deploy/native-v2216/compose.yml config --quiet
docker compose -f src/_custom/deploy/native-v2216/compose.yml up -d --no-deps app app-cotti
```

当前镜像：`lobehub:lingshu-v2216-image25-flare-20260911`。通用构建脚本见[build.sh](build.sh)，以独立标签构建，不覆盖现有镜像标签：

```bash
COTTI_IMAGE_TAG=lobehub:your-new-release-tag bash src/_custom/deploy/native-v2216/build.sh
```

构建成功后，更新 compose.yml 中的统一镜像锚点，再执行上述双入口发布。

## 网络与调度

app-cotti 保留 default 和 cotti-auth-shared 两张网络；应用网关优先级 100，认证网络 0。确保 /proc/net/route 默认网关为应用网络，社区请求命中既有 Market 专用 WARP 规则。相关运行脚本在 market-warp 目录，由现有 systemd 服务使用，不应因文档整理删除。

QStash 只有一个正式调度。不要随应用发布重建或重启 qstash-local；当前 dev 模式内存队列需要独立恢复流程。仅在明确授权且备份核对后使用[调度恢复工具](shared-qstash/recovery/restore-schedules.py)。

## 验证与回退

发布后检查两个容器的镜像 SHA、默认网关、首页 / 会话接口（`/api/auth/get-session`，旧 `/api/auth/session` 返回 404）、两个容器的 Market 推荐接口，以及 OIDC 发现文档。用户登录态结果另见验收清单。

回退使用发布前记录的镜像 SHA / 标签，两个应用统一切换；保留各自环境和 gw\_priority。不回退数据库，不以旧库覆盖新数据。回退镜像属于运维备份，不在主文档维护历代版本表。

## 文档与源码备份

整理前完整二开目录备份：`/opt/lobechat-v2.2.16/.records/native-v2216/custom-docs-backup-20260909-181420`；包含可浏览副本、压缩包和 SHA-256 清单。私有运行环境和用户数据不放入公开文档。

当前源码差异快照保存在`.records/native-v2216/current-source-otp-baseline/`，包含基于官方提交`906b10e03029648655e0257bda4f785a9e0973f0`的补丁、当前变更文件压缩包和 SHA-256 清单。它记录本次整理后的源码，不代表重新构建或发布了运行镜像；当前二开基线已提交并打 Tag：`0f6aa492ff` / `v2.2.16-lingshu-customization-complete-20260910`；后续功能独立提交。
