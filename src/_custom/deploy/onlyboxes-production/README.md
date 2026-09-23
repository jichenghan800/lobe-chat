# 生产 OnlyBoxes 启用（2026-09-23）

目标 chat.cotticoffee.com，生产机 10.82.70.138。12 核 / 约 46 GiB RAM。先独立启用自建沙箱配置，随后已发布 `lobehub:lingshu-v2217-onlyboxes-export-dev-20260923-r1`，见 ../production-v2217/prepare-20260923.md。

独立部署目录 `/opt/onlyboxes-prod`，Console / Worker 与开发相同原生二进制，独立随机凭据、SQLite 与 Worker 身份。凭据目录 0700，配置 0600。systemd 自启。固定运行镜像与开发相同摘要，并通过不启动的 `lingshu-onlyboxes-runtime-image-pin` 保留。

默认平台容量 2，每会话 2 CPU / 2 GiB / 1024 PID，15 分钟闲置租期。使用时创建，不预占两份资源。管理员可调整数量。官方云端仍为默认，不改已有话题提供方。

Docker Engine 27.5.1 / Compose 2.32.4，不支持 gw\_priority。控制网络 `lingshu-onlyboxes-control` 使用 internal bridge，不提供默认外网路由；应用保留原 `lobechat_prod` 网络。控制 HTTP 仅监听 10.251.216.1:18489，gRPC 仅监听 127.0.0.1:18551。生产 INPUT 策略额外放行专用控制桥到该精确内网地址 / 端口，不放行公网。沙箱公网 HTTPS 可用，内网、控制端口与元数据地址阻断。网络维护脚本见 network.py。

验证：Python 执行 56，跨调用文件读写成功，公网 HTTPS 200；控制地址 / 元数据 / 宿主 SSH 连接被拒。生产应用容器使用自身新配置签发测试 JIT，真实终端命令返回 HTTP 200 /exitCode 0 / 56。应用 healthy、公网会话接口 200。生产管理员 Chrome 新话题已通过执行 / 写入 / 读取 / 相对路径导出及真实下载验收，下载内容一致。

切换前应用备份 `/opt/onlyboxes-prod/before-enable.dump`，旧环境与回退 Compose 位于同目录私有文件。回退只恢复应用配置，不回灌数据库。已有自建话题关闭后不可静默转官方沙箱。不要删除运行沙箱或保留镜像容器。

生产整批候选发布包 `/opt/lobechat-releases/v2217-upload-sandbox-20260923` 已重新生成环境与容器快照，本次整批发布已保留 OnlyBoxes 配置，后续发布仍须保留。Docker 未升级，应另设维护窗口评估。
