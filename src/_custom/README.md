# 灵枢 AI 当前二开

当前候选基于官方 v2.2.18，分支 `upgrade/v2.2.18-customizations`；开发双入口已切换候选，生产仍为 v2.2.17。整理日期：2026-09-24。

## 当前部署与最新变更

2026-09-24：chatdev.cotticoffee.com 与 chat.cotti.ai 同步切换 v2.2.18 完整二开候选，共享新的验收数据库，旧库与旧容器保留。生产不变。[发布与验收记录](deploy/v2218/acceptance-release-20260924.md)。

截至 2026-09-23 最后一次发布，三个入口均为 `lobehub:lingshu-v2217-image-fit-20260923-r1`（源码 `147592dd99`）。开发 `chatdev.cotticoffee.com` 与 `chat.cotti.ai` 共享开发后端；生产 `chat.cotticoffee.com` 保留独立生产数据。生产 OnlyBoxes 已启用，默认容量 2，Docker 未升级。

- [图片预览适应屏幕：最小改动、回归与三入口发布](upgrade/image-preview-fit.md)
- [跨发布静态资源兼容：旧页面动态模块 404 修复与发布检查](deploy/static-compat/README.md)
- [生产上传与沙箱发布、备份及验收](deploy/production-v2217/prepare-20260923.md)
- [生产自建沙箱部署与隔离](deploy/onlyboxes-production/README.md)
- [OnlyBoxes 相对路径导出](upgrade/onlyboxes-relative-export.md)
- [大 CSV 对话保护](upgrade/csv-chat-guard.md)
- [OSS 分片上传修复](upgrade/multipart-upload-oss.md)
- [全览模式与只读活动跟踪](upgrade/overview-live-session.md)
- [沙箱授权预检](upgrade/sandbox-access-preflight.md)

每个专项记录保留范围、源码隔离点、验证结果及部署状态；不将运行配置或临时排障脚本混入上游业务实现。上传校验 / 合并短暂阶段尚缺完整浏览器动态证据，不能把部分观察写成全部验收通过。

## v2.2.18 完整合并候选

- [本次合并与验证状态](upgrade/v2.2.18-merge-status.md)
- [完整二开核对清单](upgrade/v2.2.18-merge-audit.json)
- [隔离构建、备份与数据库迁移](deploy/v2218/README.md)
- [最初的源码差异评估](upgrade/v2.2.18-assessment.md)：历史评估，当前状态以上述合并记录为准。

## 合并核对与历史基线

- [本轮合并与验收状态](upgrade/v2.2.17-merge-status.md)
- [逐项源码核对与保留理由](upgrade/v2.2.17-pre-merge-audit.md)
- [机器可读核对清单](upgrade/v2.2.17-pre-merge-audit.json)
- [自建沙箱容量管理](deploy/onlyboxes-trial/capacity-settings-design.md)
- [部署隔离与最小阶段记录](deploy/v2217/README.md)

旧版完整二开文档保留于 v2.2.16 里程碑标签；不将已废弃的实现重复纳入当前指南。私有验收截图、数据库备份及凭据不提交。
