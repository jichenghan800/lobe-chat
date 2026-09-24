# 灵枢 AI 当前二开

当前基于官方 v2.2.17，分支 `upgrade/v2.2.17-customizations`。整理日期：2026-09-24。

## 当前部署与最新变更

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

## 下一版本评估

- [v2.2.18 源码差异、二开覆盖与升级阻碍](upgrade/v2.2.18-assessment.md)：仅评估，未切换服务。

## 合并核对与历史基线

- [本轮合并与验收状态](upgrade/v2.2.17-merge-status.md)
- [逐项源码核对与保留理由](upgrade/v2.2.17-pre-merge-audit.md)
- [机器可读核对清单](upgrade/v2.2.17-pre-merge-audit.json)
- [自建沙箱容量管理](deploy/onlyboxes-trial/capacity-settings-design.md)
- [部署隔离与最小阶段记录](deploy/v2217/README.md)

旧版完整二开文档保留于 v2.2.16 里程碑标签；不将已废弃的实现重复纳入当前指南。私有验收截图、数据库备份及凭据不提交。
