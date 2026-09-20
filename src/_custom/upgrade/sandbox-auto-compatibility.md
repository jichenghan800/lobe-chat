# 网页端旧 auto 执行环境兼容

## 2026-09-20：最小补丁

基线：v2.2.17 二开分支。仅修改已有二开 hook
`src/features/ChatInput/hooks/useDefaultAgentSandbox.ts` 的兼容条件。

网页端原生 Agent 开启智能模式、有配置权限、配置加载完成且未绑定电脑时，
将旧 `auto` 和既有的空值、`none` 一样，通过原有配置保存动作设为 `sandbox`。
不只替换显示文字。桌面端、异构 Agent、明确绑定电脑以及明确的 local/device 选择保留。
不修改话题的 sandboxProvider，已有云端或 OnlyBoxes 话题继续使用原提供方。

测试：旧源码运行新增回归 2 项失败；修复后 13 项通过，覆盖旧 auto 保存、
配置加载等待、桌面 / 绑定设备保护。没有修改数据库结构或批量迁移用户配置。

## 委派链路核对结论与未解决项

原话题首次执行已激活业务 Skill，云端执行并导出成功。
用户要求重新调用 Skill 后，模型改为委派其他 Agent。该次服务端执行快照确认：

- 被委派 Agent 可发现业务 Skill，但只激活了通用 xlsx，未激活业务 Skill。
- 工具目录没有 cloud-sandbox，却包含 local-system；本地执行报无在线设备。
- 后续 skills.runCommand 返回 fetch failed，不能据此进一步断言网络故障类型。

官方子 Agent 执行链保留同一个 topicId，使用隔离 thread 和目标 Agent 配置，
并非自动继承主 Agent 的执行环境。现有沙箱附件初始化按 topicId 和 userId 查询，
不依赖模型自行下载登录网页 URL。
本补丁不改变官方委派路由：需要另行对无明确设备配置的委派执行设计受限沙箱默认值，
并补服务端回归，不能简单全局强制覆盖电脑 Agent。也不宣称已解决模型未激活 Skill 的行为。

## 后续升级

优先保留官方 executionTarget 解析器。本补丁只在二开 hook 补一个兼容条件。
若上游默认行为已覆盖网页端旧 auto，先运行该 hook 回归并检查两个沙箱选项，
再移除重叠分支。真实用户任务内容和执行快照只保存在忽略的私有记录目录。

## 2026-09-20：用户端冻结原因与金额提示

复用 getCostFreeze 原接口返回的 reason、spentCny、limitFen；
ChatInput 的二开冻结 loader 同时保存详情和禁发状态，切换或卸载时一起清理。
已有 NewTopicButton 使用独立 topicFreezeNotice helper 选择提示：
预算不足显示冻结时已用估算金额和额度（人民币）；人工冻结不归因于金额；
历史 context 冻结单独说明；未知金额不伪造为零。
弹框旧文案 “话题太长” 改为 “话题已冻结”。普通消息错误组件不修改，
限额判断、定价、管理员授权和解冻逻辑不修改。

验收：旧 loader 对新增详情传递回归失败；新版 loader 2 项、提示 helper 9 项、
旧 auto 13 项，共 24 项通过，完整 TypeScript 检查通过。
所有翻译仅更新 default/en-US/zh-CN。

### 同日交互调整（最终版本）

按用户要求改为自动弹框：原因与估算金额放在弹框，主按钮 “转到新话题”，
次按钮 “查看历史”；关闭后保留紧凑 “话题已冻结” 重开入口。关闭不会解除冻结，
后台重新拉取不重复打扰，导航 / 卸载会关闭旧弹框。点击新话题不触发摘要模型调用。
新增 useTopicFreezeModal 作为二开 hook，沿用 base-ui createModal；
3 项生命周期回归通过。合计相关测试 27 项通过。
