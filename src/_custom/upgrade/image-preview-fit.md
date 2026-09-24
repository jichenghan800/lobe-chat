# 图片预览默认适应屏幕（2026-09-23）

范围：会话 Markdown 生成图、用户及助手附件图片预览。通过 @lobehub/ui 公开参数 `preview.defaultZoom: fit`，默认显示完整图片；保留原始 src、下载、100% 原尺寸缩放、拖动和显式调用方配置。没有修改组件库或压缩图片。

原因：UI 5.48.2 默认 auto，仅当原尺寸与适屏尺寸比例超过 2 才选择适屏。768×1376 的长图在 1510×818 视口比例约 1.787，因而默认 100% 溢出。fit 不改变 100% 的含义，手动选择原尺寸仍可能需要拖动查看。

隔离点：Conversation/Markdown 的 img 配置和两个 ImageFileListViewer 的 PreviewGroup 配置；未来升级若原生默认满足需求可移除。调用方 preview=false 与显式 preview 参数继续生效。

回归：真实 Markdown/Image 组件点击长图打开预览，断言适屏初始缩放、图片高度不超过视口、src 不变；旧代码此例失败，修复后三项测试通过，lint 和类型检查通过。

发布状态：2026-09-23 已同步发布开发两域名和生产。镜像 `lobehub:lingshu-v2217-image-fit-20260923-r1`，摘要 `sha256:bfe30e63717fbcb96d03f166e538c44f50d44d6acdcee8c3a6304a270b1d75c4`，源码提交 `147592dd99`。

开发 Chrome：896×1200 海报在 1510×818 视口内显示高 770，top=24、bottom=794；双击放大至 scale=2，再双击返回 scale=1。生产原故障话题：768×1376 图片显示约 429.8×770，top=24、bottom=794，默认约 56%，目视完整。三入口镜像一致，生产 healthy /restart=0。

生产发布备份 `/opt/lobechat-releases/v2217-image-fit-20260923/cutover-backup-20260923-190956`；开发备份 `/opt/backups/lingshu-image-fit-20260923-r1`。无数据库迁移变化；模型、认证、沙箱、QStash 配置保留。旧静态资源已在切换前持久归档；跨两版的 catalog-DIAYzrHW\.js 仍 200、SHA256 一致，缺失静态文件仍 404/no-store。
