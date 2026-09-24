# OnlyBoxes 相对路径导出修复（2026-09-23）

## 原因与最小改动

浏览器验收话题 `tpc_h5hbSx4zlQIx` 中，Python 在工作目录 `/tmp` 写入文件，独立读取成功；首次导出相对路径时，OnlyBoxes 的 docker cp 按容器根路径查找，因而失败。模型查询 pwd 后改为绝对路径才成功。

仅修改 `apps/server/src/services/sandbox/providers/onlyboxes.ts`：相对导出路径先在同用户、同话题终端会话内通过 Python `os.path.abspath` 解析，再交给 terminalResource。复用原本用于初始化会话的终端请求，无需新增一次模型调用。路径使用 Base64 编码作为数据传入，支持空格、中文和引号，不进行 shell 插值。绝对路径保持原流程；非零退出、截断或无效解析结果拒绝继续导出。

不硬编码 `/tmp`，不扫描其他目录、不修改 OnlyBoxes 官方 Worker、云端提供方或数据库结构。解析相对路径依照终端当前执行目录；单次命令内部 cd 到其他目录生成的文件，仍应使用该文件绝对路径。

## 回归

Provider 测试 23 项通过，新增相对路径成功与解析失败用例在旧实现上失败。类型检查通过。本轮仅发布 chatdev.cotticoffee.com 和 chat.cotti.ai，共享后端，生产不发布。

原浏览器轻量验收已证明执行 / 独立读写 / 下载可用，但导出发生一次路径错误后恢复；修复后需重新浏览器验收，不能以旧结果代替。

## 发布与浏览器复测结果

- 开发双入口镜像：`lobehub:lingshu-v2217-onlyboxes-export-dev-20260923-r1`；摘要 `sha256:4fc2515f2d3b2d934536e16a8eee604fcfe021bdc14a852ed5f9758e3b992da5`。
- 数据库备份 `/opt/backups/lingshu-onlyboxes-export-dev-20260923-r1/before-cutover.dump`；旧容器和镜像保留，生产未发布。
- 两个域名健康接口 200，共享后端一致，QStash 定时任务已恢复。
- Chrome MCP 在管理员测试话题 `tpc_h5hbSx4zlQIx` 继续轻量测试；数据库工具记录确认 `exportFile` 参数为 `{"path":"relative_export_check.txt"}`，首次返回成功，无模型改路径重试。页面 3 步约 13 秒。
- 浏览器读取实际下载链接 HTTP 200、28 字节，内容校验匹配，并点击下载；截图核对页面正常。文件 ID `file_X8Qb2A7ssEjU`。原用户话题未修改。
