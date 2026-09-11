# GPT Image 2.5 Flare 升级

2026-09-11。沿用当前 Azure 资源、地址和 Key，部署名为 `gpt-image-2.5-flare`。

## 实际改动

- 在原生 OpenAI 模型目录新增 Flare 的图片类型、参数及 Token 价表，Azure 自定义模型继续通过既有 fallback 获取元信息。
- 首页 GPT Image 2 快捷入口改为 GPT Image 2.5 Flare。
- Azure 模型环境列表将 `+gpt-image-2=GPT Image 2` 替换为 `+gpt-image-2.5-flare=GPT Image 2.5 Flare,-gpt-image-2`。
- 同步遗留 `AZURE_IMAGE_MODEL_ID` 配置值；当前源码实际请求模型仍由用户选择传入，此遗留变量不作为升级生效证据。
- 保留旧模型目录定义与历史图片记录。Nano Banana 2 继续在生成页供选择，单张生成限制和官方图片适配不改。
- 老浏览器若记住旧模型，需刷新后重新选择 Flare，或从首页新入口进入；不覆盖用户的其他模型偏好。

开发与生产均未发现 `ai_models` 中旧 / 新模型的覆盖记录，不需要 SQL 或 schema 迁移。不会修改历史生成记录中的模型名称。

## 验证

通过仓库 `LobeAzureOpenAI.createImage` 沿用现有凭据，生成和编辑均 HTTP 200：

| 调用               | 参数                | 耗时      | 用量       | 预估美元费用 |
| ------------------ | ------------------- | --------- | ---------- | ------------ |
| images/generations | n=1, low, 1024×1024 | 15.138 秒 | 225 Token  | $0.006025    |
| images/edits       | n=1, low, 1024×1024 | 16.698 秒 | 1261 Token | $0.014277    |

实际打开图片确认蓝色圆形生成成功，编辑后为红色圆形。接口返回完整 usage，两次合计按平台汇率 7.12 估算约 ¥0.14455。此处是接口估算，不代表 Azure 图片费用已在平台完整入库。

模型目录 / 首页回归 23 项、Azure/OpenAI 适配回归 134 项通过，完整类型检查通过。API 返回图像、图片编辑参数和单张请求均沿用既有实现，未另写一套调用逻辑。

官方价表：[GPT Image 2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare)。

## 发布与回滚

已发布镜像：`lobehub:lingshu-v2216-image25-flare-20260911`。运行配置只调整上述模型列表与遗留模型 ID；生产 QStash 的 1 GiB 上限继续保留。已按 chatdev → chat.cotti.ai → 独立生产 chat.cotticoffee.com 顺序发布。

私有备份与发布记录在 `.records/image25-flare-release/`，接口原始记录在 `.records/image25-flare-api/`。若回滚，恢复对应原 Compose 和两份开发环境文件，仅重建应用。不要重建数据库或覆盖历史生成数据。

## 2026-09-11 上线验收

三个应用容器均运行镜像 `sha256:3bd5e47bbb92084540af4318649534b2ecc96e6a883075f4804cbe22c13602eb`，检查时重启次数均为 0。代码提交 `836a55c5e8`。两个开发入口保留独立域名与认证配置，生产仍使用自己的数据库。

- chatdev：从首页 Flare 入口进入，真实生成蓝色圆形；Azure 异步任务 success，图片资产落库，Chrome 实际显示成功。
- chat.cotti.ai：已登录 Chrome 验证本域首页显示 Flare，没有跳到 chatdev。服务器无浏览器请求被边缘返回 403，未将此作为应用不可用的证据，也未修改出站或边缘规则。
- chat.cotticoffee.com：从首页进入并真实生成绿色圆形；任务 success，资产落库且 Chrome 显示成功。开发模型菜单确认 Nano Banana 2 与 Flare 可选，旧 GPT Image 2 不再出现在新选择列表。
- 生产 QStash 保留 1 GiB；此前 OOM 后重启次数仍为 1，当前 OOMKilled=false，两条 schedule-dispatch /goal-sweep 调度均在。本次仅重建应用。

健康检查使用 `/api/auth/get-session`；旧 `/api/auth/session` 返回 404。发布期间发现临时脚本误用旧路径，在其健康等待阶段终止脚本，改用正确接口与镜像 SHA 核验并刷新 nginx 上游。未执行数据库回滚，未实际切回旧应用。临时错误检查不作为最终验收依据。

生产配置备份和候选位于 `/opt/lobechat-releases/image25-flare-20260911/`（仅 root 可读），应用配置只变更镜像与两个 Azure 模型环境字段。后续观察真实生成失败率和供应商账单；本次不扩展图片计费持久化。
