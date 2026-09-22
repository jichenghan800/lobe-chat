# OnlyBoxes 开发环境接入（2026-09-14）

仅 chatdev.cotticoffee.com；chat.cotti.ai 与生产不在本次发布范围。

## 架构与使用

- 官方云端继续默认。配置完整时，执行环境并列显示 “云端沙箱”“自建沙箱”。
- 选择随新话题 metadata.sandboxProvider 保存，现有话题不改路由。切换环境确认后新开话题，临时文件不跨沙箱复制。
- 所有命令、技能、附件同步和文件导出经过同一个异步 createSandboxService，按用户与话题查询路由。旧话题仍走官方云端。自建不可用或满额返回错误，不排队、不自动去官方云端。
- 首页任务直接保存所选沙箱；来源话题创建的任务及子任务保存沙箱快照，新一轮运行继承；继续已有话题尊重已有选择。
- 平台管理调整并发名额，即时限制新会话，现有会话保留。开发默认 5；名额记录采用租期加保护窗口，可能短暂晚于实际容器释放。

## 开发部署

- OnlyBoxes 0.11.0 原生 Console / Docker Worker；来源 d30fe74，不修改其源码。
- Runtime 固定摘要：coolfan1024/onlyboxes-runtime\@sha256:2771c7fde19184d42afcf9889da3d908276006cded873b7861964a3fcce4d3cc。
- 服务文件见同目录三份 systemd unit。二进制、Console SQLite、凭据在 /opt/onlyboxes-dev（0700），凭据文件 0600，不入库。
- HTTP 10.251.216.1:18489，gRPC 127.0.0.1:18551，不发布公网控制端口。
- 应用额外连接 lingshu-onlyboxes-control（默认路由优先级 0），保留原应用出口网络优先级 100。
- 应用配置：SANDBOX\_PROVIDER=market、ONLYBOXES\_ENABLED=1、ONLYBOXES\_BASE\_URL=<http://10.251.216.1:18489、ONLYBOXES_JIT_ISSUER=lingshu-chatdev-v2217、ONLYBOXES_LEASE_TTL_SEC=900。ONLYBOXES_JIT_SIGNING_KEY> 从 Console 私有配置安全注入，不输出到日志。
- Worker 原生会话上限 0，由平台数据库名额控制。每容器 2 CPU、2 GiB、1024 PID；无用户则不预建容器。Worker 租期下限 60、上限 1800 秒。

## 网络与租期

network.py 仅维护两个专用 bridge 和专用防火墙链。沙箱可访问公开互联网、安装依赖、读写应用的 HTTPS 签名文件；不能访问内网、其他沙箱、宿主 SSH、控制接口或云元数据。docker-wrapper.py 仅供 Worker PATH 使用，加入专用网络与 no-new-privileges，不改全局 Docker 行为、不挂载宿主目录。

闲置租期 15 分钟，每次命令执行或文件读写续期。前台命令按 timeout + 60 秒提高租期，避免默认短租期终止尚在超时范围内的命令；长时间没有工具调用仍会过期，不能把临时沙箱当长期磁盘。后台命令也需在租期内轮询，不能承诺无限运行。

更正：0.11.0 Worker 使用 PreserveOnClose，并可根据 Console 中未过期的租约恢复容器。实测重启后仍能读取原文件；“重启必然清空全部沙箱” 不适用于此版本。过期或孤立容器会清理，不能替代文件持久化备份。升级 Worker 前仍应检查活动会话。

OnlyBoxes 原生任务取消接口实测只改变 Console 记录，已派发进程可能继续执行。适配器为后台命令创建独立进程组并保存随机标识，取消时在同一用户话题容器内验证标识后终止该进程组；不依赖 Console 的取消状态，也不销毁整个工作目录。

## 验证与回滚

- 真实 factory / PG / OnlyBoxes：Python、文件写读、公共网络、pip 安装、跨用户隔离、内网和元数据阻断、65 秒命令跨越 60 秒默认租期、Worker 重启恢复均通过；后台输出与取消后不再写文件也已实测。
- 单元回归覆盖话题创建及只读绑定、用户隔离、满额与释放、路由不回退、首条消息及任务继承。
- 开发数据库发布前备份：/opt/backups/lingshu-v2217-before-onlyboxes-20260914/database.dump。
- 已发布镜像：lobehub:lingshu-v2217-onlyboxes-20260914-r3；摘要 sha256:7bb4c286e28f1a81a34cf0b3c1ff6006844c1530d99bcad667b6de46598d1134。
- 旧应用容器 lingshu-v2217-app-before-onlyboxes 停止保留，restart=no；开发应用重启次数 0。原 PG、队列、对象存储与旧域名隔离检查全部通过。
- Chrome DevTools MCP：双入口显示、选择自建、真实快速模型执行并导出、下载字节核对、刷新保留选择、切换确认后新开云端话题均通过。测试话题 tpc\_bIeIXnU3tsYx，文件 file\_GAKcIIwmeVyl，预估模型费用 ¥0.0685；真实容器内文件匹配，不以模型回答代替执行证据。
- 本轮基础验收不代表所有技能、复杂业务附件、异构 Agent 与长期高并发场景都已覆盖；生产尚未启用。
- 关闭入口使用 ONLYBOXES\_ENABLED=0 并重建应用；已绑定自建的话题会明确报不可用，不能改成云端静默续跑。

## 主要源码位置

- 路由与隔离：apps/server/src/services/sandbox/factory.ts、packages/database/src/models/cottiSandbox.ts。
- 选择与确认：src/features/ChatInput/hooks/useSandboxSelection.ts、ControlBar/HeteroDeviceSwitcher.tsx；待发送选择在 src/store/chat/pendingSandboxProvider.ts。
- 首条消息：conversationLifecycle.ts、gateway.ts、服务端 aiAgent/pipeline/turnSetup.ts；任务入口 Home/InputArea/useSend.ts、服务端 task /taskRunner。
- OnlyBoxes 适配：apps/server/src/services/sandbox/providers/onlyboxes.ts、onlyboxesBackground.ts。
- 启用状态与配置：apps/server/src/routers/lambda/cotti/sandbox.ts、packages/env/src/sandbox.ts。

## 2026-09-22 超时恢复与镜像保留

自建话题 tpc\_kFuDI4jvYGmu 的附件初始化与实际命令各等 120 秒后超时，连 `print('ready')` 也失败。检查发现固定摘要运行镜像缺失；Docker 日志显示拉取随任务超时取消。仅重启空闲 Worker 后独立探针仍失败，恢复原摘要镜像后 Python 返回 56、同会话写读文件返回 recovery-ready（约 0.527 / 0.125 秒）。未重放用户业务任务。

根用户 crontab 每周一 00:00 执行 `docker image prune -a -f && docker builder prune -a -f`；9 月 21 日 00:00 Docker 日志存在该镜像清理记录。沙箱闲置后无容器引用，因此运行镜像会进入清理范围。保留原清理任务，增加不启动的容器作为镜像引用：

```bash
docker create --name lingshu-onlyboxes-runtime-image-pin \
  --label cotti.purpose=retain-onlyboxes-runtime --network none \
  --entrypoint /bin/true \
  coolfan1024/onlyboxes-runtime@sha256:2771c7fde19184d42afcf9889da3d908276006cded873b7861964a3fcce4d3cc
```

该容器保持 created，无进程、无 CPU / 内存占用，不属于 Worker 会话，不占平台名额。不要对其执行启动；未来如引入 container/system prune，必须同步保留此引用。升级运行镜像时须更新引用，再移除旧引用。没有改动官方 OnlyBoxes 源码、平台应用代码或用户附件。恢复证据与 Console 备份在 `.records/onlyboxes-recovery-20260922/`（私有）。本次验证覆盖底层执行及文件读写，不代表用户整套业务技能已经验收。
