# 生产 WARP 代理模式健康探测修复

2026-09-20，仅调整生产主机的运维脚本，不属于应用源码补丁，不发布应用镜像。

## 原因与边界

生产 WARP 使用 `WarpProxy` 模式，监听 `127.0.0.1:40000`；现有 Market 专用 iptables /redsocks 规则代理应用容器到 `market.lobehub.com` 的 HTTPS 请求。守护脚本原先直接请求 Cloudflare trace 并强制要求 `warp=on`，因此将代理模式正常的直连 `warp=off` 误判为故障，反复重启 WARP。日志证实当日多次误触发；此前某次 Market 403 的具体原因仍不能由此确定。

新增可选 `WARP_PROBE_PROXY`：设置后所有健康探测显式使用该代理，并覆盖 NO\_PROXY，避免探测走错路径。未设置时保留原行为。生产 `/etc/default/warp-egress-watchdog` 设置：

```sh
WARP_PROBE_PROXY=socks5h://127.0.0.1:40000
```

不修改 Market 路由、WAF、社区账号、重启阈值或应用配置。Vertex / OSS 探测原语义只是网络可达，404 / 403 不代表业务接口鉴权通过。

## 验证与回退

- `python src/_custom/deploy/warp-watchdog/test-proxy.py`：无代理、显式代理及 NO\_PROXY 覆盖三个离线用例通过；原脚本在代理用例失败。
- `bash -n` 通过；生产临时脚本 `--probe` 返回三项通过、`warp=on`，此模式不重启或写入故障状态。
- 原脚本、配置和计数状态备份：`/opt/backups/warp-watchdog-20260920/`。
- 替换脚本和配置期间暂停守护定时器，完成后恢复；未重启 WARP 或应用。首轮新探测健康、故障计数归零，WARP PID 未变。
- 回退仅需恢复备份的 `watchdog.sh` 到 `/usr/local/sbin/warp-egress-watchdog`、`watchdog.env` 到 `/etc/default/warp-egress-watchdog`；恢复旧配置会重新产生本次误判，不建议无原因回退。无需恢复旧失败计数。

网络实测：应用容器访问 Market 首页 200、无凭据 userinfo 401；NAT 计数确认规则命中。此结果不等于社区登录和云端沙箱业务验收已通过，后者仍需用户完成浏览器登录。
