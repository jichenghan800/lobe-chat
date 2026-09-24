# OnlyBoxes 独立验证（2026-09-14）

本页记录首次独立试验，后续接入与当前运维说明见 [开发环境接入](../onlyboxes-dev/README.md)。

结论（首次试验时）：OnlyBoxes 0.11.0 的基础执行、文件及身份隔离契约与当前 LobeHub v2.2.17 兼容；尚未接入 chatdev 或生产，也没有实现两个沙箱入口并列。

## 部署范围

- 现有开发服务器，独立目录 `/opt/onlyboxes-trial-20260914`，仅 root 可访问。
- Console 和 Docker Worker 使用上游 0.11.0 发布二进制，压缩包与 GitHub release asset SHA256 核对；源码基线 `d30fe74`。
- Console HTTP/gRPC 仅监听 127.0.0.1:18489 / 18551；未增加域名、反向代理、开机自启动。
- Runtime：`coolfan1024/onlyboxes-runtime:lobehub`，拉取摘要 `sha256:2771c7fde19184d42afcf9889da3d908276006cded873b7861964a3fcce4d3cc`。
- 每会话 2 CPU / 2048 MiB / 1024 PID，最多 2 会话，测试租期 60 秒。
- 全部身份、文件、口令为本轮临时测试生成，不使用真实用户数据或模型 Key。

## 通过的实测

1. 无效认证拒绝。
2. 过期 JIT 认证拒绝。
3. Python / Node 命令均返回 42。
4. 写文件成功。
5. 同身份、同会话后续调用可读取文件。
6. 两个身份使用相同 session\_id 时不能读到另一身份的测试文件。
7. 两个会话存在时拒绝创建第三个会话。
8. Docker 实际 CPU、内存限制生效；容器不是 privileged，未挂载宿主目录。
9. terminalResource 经真实 HTTP PUT 导出文件，接收内容逐字节一致。接收端为本轮临时 Docker bridge 接口服务，不是生产 OSS。
10. 超时命令返回失败。
11. 租期结束后原会话容器自动删除。

另以 Bun 直接调用未修改的 `OnlyboxesSandboxProvider`，验证 runCommand、executeCode、writeLocalFile、readLocalFile 四项成功。没有通过 mock 伪造后端结果，没有经过 LobeHub 用户界面或模型规划。

官方安装页曾显示 0.7.1 示例；该版本不识别当前文档中的会话上限配置，本轮第三会话成功创建，因此未通过容量测试。停止旧测试进程后，改用 0.11.0 与独立新数据库重测通过。部署时应固定已验收版本及镜像摘要。

## 接入前待解决

- 当前 Docker 默认运行用户为 root、网络为 bridge，未额外指定 security-opt；测试只证明基本身份隔离，不能据此声称完成对恶意代码的安全隔离审计。
- 需要明确沙箱对宿主机、生产数据库、内网服务和云元数据接口的访问边界。Worker 本身能管理 Docker，应视为受信任组件。
- 当前主机无 `/dev/kvm`，未测试 Boxlite 虚拟机隔离方案。
- 待验证 LobeHub 附件导入、实际对象存储导出、后台命令与取消、并发 Agent 及社区授权界面行为。
- 当前 `SANDBOX_PROVIDER` 为全局二选一。若 “自建沙箱” 和 “云端沙箱” 并列，需要新增选择持久化及后端路由，核对切换后的工作目录、文件和后台命令归属；仅新增 UI 选项不够。

测试结束已停止本轮 Console、Worker 和临时文件接收服务；保留根目录私有证据及下载文件，不删除其他服务或数据。私有文件含临时凭据，不提交 Git 或对外上传。

参考：[OnlyBoxes 的 LobeHub 接入说明](https://onlybox.es/en/docs/lobehub/)、[上游 0.11.0](https://github.com/Coooolfan/onlyboxes/releases/tag/0.11.0)。
