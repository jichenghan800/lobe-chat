# 跨发布静态资源兼容

2026-09-23 生产整批发布后，尚未刷新的页面继续请求旧版 `/_spa/assets/catalog-DIAYzrHW.js`，新版镜像不含该文件，返回 404。新页面验收无法覆盖此场景。不是模型或话题执行错误。

## 生产修复

从发布前的固定镜像提取 public，归档四个 SPA shell（`_spa`、`_spa-auth`、`_spa-share`、`_spa-workbench`）下 assets /i18n /vendor 静态文件，共 2713 个。未启动旧应用。归档位于宿主 `/opt/dify/docker/volumes/certbot/www/lingshu-static-archive`，经现有挂载映射为 Nginx 的 `/var/www/html/lingshu-static-archive`。不归档或暴露 HTML、运行环境、认证配置。

生产 `/opt/dify/docker/nginx/conf.d/lobechat-custom.conf` 的静态资源 location：优先代理当前应用；404 才进入 `@lobechat_previous_static`，从归档按 URI 读取。归档仍不存在时进入原有 `@lobechat_static_404`，返回 404/no-store。成功文件保留正确 MIME、immutable，增加 nosniff。应用 API 路由不进入归档。仅 nginx -t 和平滑 reload，应用未重启。

私有证据及配置备份：`/opt/lobechat-releases/static-compat-20260923`。原 JS SHA256 `28919cbfe237a1f61c2ce8c8034c845c081153c917bad5abefdf82403ad54051`；修复前 404，修复后 200 且逐字节一致，23 个直接依赖全部 200。不存在文件仍 404/no-store。Chrome 重开受影响话题通过；不替用户重新提交对话。

## 后续发布必须执行

1. 切换前从当前运行镜像提取上述公开静态目录，合并入持久归档；禁止覆盖同路径不同内容，禁止符号链接及越界路径。保留已有归档，不随应用容器重建删除。
2. 新应用优先、归档仅作为静态 404 后备；禁止将旧 index.html 作为缺失 JS 的响应。
3. 切换后运行 verify.py，参数为发布前确实存在的动态 chunk 路径及其 SHA256。同时验证当前版页面和 JS。
4. 检查旧页面延迟加载及刷新恢复，不以全新登录页面成功替代跨发布验收。
5. 归档不自动清理；另行约定保留窗口后再清理，不删除仍需支持的版本资源。

已失败的动态导入可能被浏览器保存在当前页面内存中；用户保留未发送文字后刷新一次即可重新加载。服务端兼容修复用于其他仍打开的旧页面后续加载，不伪称可以撤销浏览器已发生的错误。

开发两个域名亦使用同样策略：宿主 `/opt/lingshu-static-archive`，两个 Nginx server 各有静态 404 fallback。2026-09-23 图片预览发布前已归档当前生产镜像静态资源，生产新增 1902 个文件，无同路径内容冲突。
