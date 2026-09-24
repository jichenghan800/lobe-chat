# GPT-6 Sol 官方定义回填

2026-09-24。在 v2.2.18 上最小回填官方 canary `38e99772870583fb0a773aa002077c56811dadd3` 的 GPT-6 Sol 定义；不合并整个开发分支。

## 源码范围

- `packages/model-bank/src/aiModels/openai.ts`、`azure.ts`：只增加 `gpt-6-sol` 原生模型卡，包含工具、视觉、搜索、推理、上下文和计费配置。保留官方 `gpt5_6ReasoningEffort` 参数键（支持 none/low/medium/high/xhigh/max），不能仅凭模型名称换成 Astra 的参数键。
- 现有模型 ID 解析和 OpenAI/Azure Responses 路由可识别 GPT-6 系列，本次不修改调用链。
- 不新增数据库迁移，不改默认模型、历史话题、用户组和可见列表；启用前需确认对应渠道已开通。
- 后续升级包含同等定义的官方版本时，直接采用官方实现，无需重复保留此回填。

来源：[LobeHub OpenAI 模型卡](https://github.com/lobehub/lobehub/blob/38e99772870583fb0a773aa002077c56811dadd3/packages/model-bank/src/aiModels/openai.ts)、[Azure 模型卡](https://github.com/lobehub/lobehub/blob/38e99772870583fb0a773aa002077c56811dadd3/packages/model-bank/src/aiModels/azure.ts)、[OpenAI 模型文档](https://developers.openai.com/api/docs/models/gpt-6-sol)。

## 平台估算价格

美元 / 百万 Token，标准处理价格；实际渠道报价另行核验。

| 输入上下文           | 普通输入 | 缓存读取 | 缓存写入 | 输出 |
| -------------------- | -------: | -------: | -------: | ---: |
| 不超过 272,000 Token |        2 |      0.2 |      2.5 |   10 |
| 超过 272,000 Token   |        4 |      0.4 |        5 |   15 |

阶梯按整次请求输入规模选择，非超出部分累进。现有计费公式不变，人民币费用继续遵循平台现有换算和预算逻辑。渠道模型卡内置价格不等于已核对 Azure/Astraflow 实际账单。

## 验证与部署

专项测试 `packages/model-runtime/src/providers/openai/gpt6Sol.test.ts` 覆盖两个渠道的模型查找、工具能力及 Responses 路由、六档推理参数、缓存读写计费，以及 272,000 / 272,001 边界，合计 22 项通过。没有发出真实模型请求，不能据此声称渠道连通或真实工具执行通过。

全量类型检查、lint、22 项专项测试及完整构建通过。已同步部署 `chatdev.cotticoffee.com` 和 `chat.cotti.ai`，镜像 `lobehub:lingshu-v2218-gpt6-sol-20260924-r1`，摘要 `sha256:d6cb4851ab262ef1a50c063c71620af89c8825343edb4263d00d20ee4b69fa14`。

部署后运行检查 8/8 通过；两个域名原管理员会话均可访问模型管理接口，配置响应 SHA256 与发布前一致，模型管理页面正常渲染并查看截图。保留原环境列表，GPT-6 Sol 尚未配置渠道启用或开放可见，也未发起真实模型调用。

停写备份与旧容器配置保存在 `/opt/backups/lingshu-v2218-gpt6-sol-20260924-r1`（0700），旧容器停止且禁用自启；共享数据库、任务调度保留。生产保持原版，不覆盖此前 r2 镜像归档。

## 2026-09-24 分组渠道启用

用户确认沿用既有分组设计，GPT-6 Sol 的路由如下（不改变其他模型的原渠道）：

| 分组                | 实际渠道  | 配置标识         | 使用范围              |
| ------------------- | --------- | ---------------- | --------------------- |
| 默认组 / 非压测用户 | Azure     | azure/gpt-6-sol  | Chat、Agent，普通权限 |
| 压测组              | Astraflow | openai/gpt-6-sol | Chat、Agent，普通权限 |

两渠道 `/models` 均列出该模型；分别用 Responses API 发起一次强制无副作用函数调用，均 HTTP 200，模型为 gpt-6-sol，函数名及参数正确。每次输入 63、输出 22、总计 85 Token，缓存读写均 0；两次合计 170 Token。按标准价合计约 USD 0.000692，约人民币 0.00493 元，非实际账单核对。这两次为接口探测，不归入用户话题或声称完整页面 Agent 测试通过。

双入口继续使用同一已验收镜像，只在 AZURE\_MODEL\_LIST、OPENAI\_MODEL\_LIST 分别追加 +gpt-6-sol；其他环境参数逐项一致。通过原管理员接口分别追加两组的 Chat/Agent 模型项，保存前后验证其他列表项、缺省模型及退役映射完整不变。没有移动用户或迁移旧话题。

权限回归 14 项通过。另使用当前数据库的真实默认组与压测组账号，只读调用现有 CottiUserGroupModel 和 CottiModelDisplayModel：各组两模式可见渠道正确，正确渠道允许、对方渠道拒绝。不注入登录会话或修改测试账号分组。

运行检查 8/8 通过，双应用重启次数 0。停写备份及旧环境存于 `/opt/backups/lingshu-v2218-gpt6-sol-channels-20260924`；旧容器停止且禁用自启。生产未修改。私有探测记录在 `.records/v2218-gpt6-sol-channels/`。
