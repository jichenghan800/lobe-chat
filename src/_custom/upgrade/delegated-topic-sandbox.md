# 委派 Agent 使用话题已选沙箱（2026-09-20）

## 问题与证据

真实执行快照显示：主 Agent 已在云端处理附件并导出成功，随后 callAgent
创建隔离 thread。目标 Agent 没有 agencyConfig，服务器按自己的默认环境解析，
工具目录出现电脑工具而没有 cloud-sandbox，导致 “无在线设备”。

官方 execSubAgent 的 isSubAgent=false，因此不能只用 isSubAgent 判断：
本修复使用已有 isolationThread 标记，并受下列条件共同限制。

## 当前最小二开

独立策略：apps/server/src/services/cotti/delegatedSandbox.ts。
唯一官方接入：apps/server/src/services/aiAgent/pipeline/toolDiscovery.ts。

仅当隔离委派、原生 Agent、智能工具模式、非分享访客、无明确设备 / 绑定，
且 target 为空或旧 none/auto 时，读取当前用户拥有的话题沙箱选择。
只有话题已有 market/onlyboxes 才在本次执行计划中设为 sandbox；
保留官方 resolveExecutionPlan，原 Agent 配置不写回，话题提供方不修改。

同一受限分支即便没有设备网关，也清除遗留电脑工具目录条目；
沿用原工具权限、禁用列表和激活机制，不强制启用用户禁用的工具。
明确 local/device、绑定电脑、异构 Agent、Chat/custom 工具模式均保持原行为。
无沙箱选择的话题沿用原行为，不猜测云端 / 自建提供方。

CottiSandboxModel.getTopicProvider 继续执行用户归属和软删除检查。
委派沿用原 topicId；既有沙箱工厂选择同一提供方，附件按同一 topicId/userId 初始化。
不新增数据库结构，不复制附件，不修改认证、容量、费用或沙箱切换规则。

## 验证与限制

47 项回归通过，包括云端 / OnlyBoxes × 有 / 无网关的执行计划与工具目录、
遗留电脑目录条目清理、显式设备保留、无沙箱选择及分享 / Chat 等边界。
同一新增测试对旧 pipeline 运行有 4 项失败。完整类型检查通过。
未代替用户重跑真实业务任务；本修复保证相关条件下沙箱工具可发现，
不保证模型一定激活指定 Skill 或完整执行业务规则。需后续真实任务快照验证实际调用。

## 后续升级

优先核对官方是否已支持委派的明确沙箱上下文。若已覆盖，删除独立策略及两个接入点，
运行 delegatedSandbox.test.ts 和 execAgent.device.test.ts 后验收同一话题附件。
不得通过全局修改 executionTarget 默认值覆盖所有电脑 Agent。
