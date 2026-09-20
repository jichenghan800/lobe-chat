# 双域名共享服务（2026-09-14）

chatdev.cotticoffee.com 和 chat.cotti.ai 是同一业务系统的两个入口，共享全部用户、话题、附件和管理配置。此前升级验收使用的独立数据库已完成合并，不再作为当前架构。

## 当前部署

- chatdev → 本机 3232 → `lingshu-v2217-app-dev`；chat.cotti.ai → 本机 3231 → `cotti-v2216-native-app-cotti-1`。保留两个同镜像应用实例以承接各自认证配置，业务后端统一。
- 两者共享 PostgreSQL `lingshu-v2217-pg / lobehub_v2217_acceptance`、OSS `sg-pre-lobechat`、Redis `lingshu-v2217-redis`、QStash `lingshu-v2217-qstash`。
- 内部任务回调统一到 `http://lingshu-v2217-app-dev:3210`；只有一组中心扫描计划，旧队列的两个 Lobe 调度均已暂停。
- OnlyBoxes 使用相同签发方、签名配置和数据库名额，上限 5；不是两个域名各 5 个。
- 两个域名保持自己的 URL、认证入口及登录回调；Nginx 不变，不互相重定向。应用网络默认路由优先级均为 100。
- 本次未改动 chat.cotticoffee.com 所在生产服务器。

## 数据合并与备份

- 私有备份 `/opt/backups/lingshu-shared-service-20260914/` 保留停应用后的 `final-dev.dump`、`final-cotti.dump` 和容器配置，备份通过 pg\_restore 列表校验。
- 使用分叉前基线对比 194 张公共表，在隔离副本演练并重复执行；正式导入 19 张表的 348 行新增或单侧修改记录。双方原有数据、冻结状态保留。
- 共同修改仅涉及用户最后活跃时间及一个话题的用量聚合；前者取较新值，后者复用官方用量重算，从消息计算，避免重复累加费用。受影响的 10 个话题已重算。
- 合并事务提交前校验所有公共表外键。演练合并后为 113 用户、1,976 话题、31,103 消息、2,319 文件、1,853 文档；这些是切换时统计，并非持续不变的运行数量。
- 开发新增的 53 个存储对象（20,810,721 字节）复制到原 OSS，逐一下载并以 SHA256 校验。原有不同内容对象不覆盖，旧存储保留。
- 旧应用停止并禁用自启，回退容器为 `lingshu-dev-before-shared-20260914`、`lingshu-cotti-before-shared-20260914`；遗留 3230 应用也已停止。原数据库和存储保留备查。
- 回退必须继续保护合并后新增数据，不能直接恢复旧数据库覆盖；重启旧容器前必须重新核对其数据库、队列和存储目标，避免重新形成两套系统。
- 私有脚本和验证证据位于 `.records/shared-service-20260914/`，禁止提交或输出凭据。旧 native-v2216 Compose 不代表当前部署，不能直接执行覆盖新应用。

## 镜像与验收

- 两个入口均为 `lobehub:lingshu-v2217-sandbox-auto-20260920-r3`，digest `sha256:8464e2504b917b5bf29ba33abb8d2b1e95297df697d5e64d010cd5f57dfdeb10`。
- 全览搜索框保留粘贴的完整 URL，提取话题 ID 查询共享数据库；回车打开管理员详情。新输入名称或链接时自动包含冻结话题，之后仍可手动调整筛选。
- 仍使用管理员接口和查看审计，不访问粘贴链接指向的外部网站，不增加非管理员权限。
- 回归测试确认修复前失败、修复后通过；相关检查 5 项、lint、全仓类型检查及正式构建通过。
- 后端验证 “比赛讲稿优化打磨” 可搜索，详情 18 条消息、冻结状态保留；另一讲稿话题和开发验收话题也可读取。
- 运行核对确认两应用在线、同镜像及共享后端；共享队列两项计划启用，旧队列同名计划暂停。
- Chrome 停在认证登录页，粘贴与搜索的浏览器端到端验收仍待登录；源码、数据库及部署检查不等同于浏览器验收完成。

当前补充能力见 [Astraflow 压测组](../v2217/astraflow-pressure-group.md)，压测组初始为空，两个入口共用成员分配。

## 双入口同步发布约束

- 两个域名作为一个发布单元，必须使用同一镜像 digest、数据库和业务渠道配置。仅认证入口、域名和登录回调可以不同。
- 本次智能默认沙箱修复在两个旧应用均停止后创建两个新应用，再统一启动；不允许一个域名运行新版、另一个继续运行旧版。
- 验收须同时核对两个入口的镜像、共享后端、模型目录与任务队列；失败时两入口一起回退，不能单边留在不同版本。

## 2026-09-15 用户组模型管理发布

- 两入口同步发布用户组模型页签、组内引用迁移、完整邮箱显示及全览默认全部 / 最近更新。保留 chat.cotti.ai 已有显式退出及认证路由逻辑。
- 回退容器 `lingshu-dev-before-group-tabs-20260915`、`lingshu-cotti-before-group-tabs-20260915` 均停止且禁用自启；原镜像不同，回退必须按两入口整体处理。
- 私有备份 `/opt/backups/lingshu-group-model-tabs-20260915/`，停写 dump 通过 pg\_restore 列表检查；无数据库 schema 迁移。
- chatdev Chrome 验收页签及 Astraflow 标识、组内即时保存并恢复原配置、全览默认全部 / 最近更新。两个入口健康及共享队列检查通过；chat.cotti.ai 登录后浏览器验收等待人工登录。

## 2026-09-15 历史额度复核与全览默认助理发布

- 两入口于 13:07（北京时间）同步发布以上镜像，共享数据库、存储、模型配置和队列核对均通过；两项 QStash 计划已恢复启用。
- 预算冻结按最新有效额度复核并写入审计，保留人工和上下文冻结。首次全览读取已解除 3 条符合条件的旧预算冻结；用户指定的话题此前已手动解冻，仍保持未冻结，当前有效额度为 50 元。
- Chrome DevTools MCP 在指定话题验收：发布前 5 处 “未命名助理”，发布后均为 “灵枢 AI”，显示费用 ¥8.66、未冻结；没有发送真实付费模型请求。chat.cotti.ai 运行健康与同镜像已核对，其浏览器登录验收仍需人工登录。
- 29 项相关回归、lint、全仓类型检查与镜像构建通过；无 schema 迁移。备份 `/opt/backups/lingshu-budget-recheck-identity-20260915/before-cutover.dump` 已通过 pg\_restore 列表检查。旧容器 `lingshu-dev-before-budget-recheck-20260915`、`lingshu-cotti-before-budget-recheck-20260915` 停止并禁用自启。
- 私有证据 `.records/freeze-identity-release/`；生产 chat.cotticoffee.com 未改。

## 2026-09-15 模型开关下线弹窗发布

- 两入口同步更新到上述镜像；关闭模型开关直接弹出下线迁移窗口，预选所点模型。确认前不变更模型状态，组内操作继续限制到本组渠道与成员。底部原有迁移入口保留。
- 默认组与用户组两个回归场景修复前失败、修复后通过；lint、全仓类型检查、镜像构建通过。Chrome DevTools MCP 已复现旧页面滚动行为，并验证新版压测组 GPT-5.6 Sol 关闭时弹窗预选正确、显示影响 1 个 Agent / 1 个话题 / 0 个未结束任务；Escape 取消后配置指纹未变，没有实际下线或迁移用户模型。截图已查看。
- 两应用同镜像、共享后端及两项 QStash 计划启用检查通过。chat.cotti.ai 浏览器验收仍受之前统一登录状态限制，未宣称通过；运行级检查通过。
- 备份 `/opt/backups/lingshu-model-switch-dialog-20260915/before-cutover.dump` 已经 pg\_restore 列表校验。回退容器 `lingshu-dev-before-model-switch-dialog-20260915`、`lingshu-cotti-before-model-switch-dialog-20260915` 停止并禁用自启。生产 chat.cotticoffee.com 未修改。
- 私有证据 `.records/group-model-switch-fix/`。历史费用补算独立保留在 `.records/unrecorded-cost-audit/preview.md`，尚未回填。

## 2026-09-15 管理员下载桌面端入口

- 两入口同步发布管理员执行环境菜单下载入口，复用 cotti.peopleManagement.access 的服务端管理员鉴权；权限缓存按用户 ID 隔离，加载中、普通用户、未登录及查询失败均隐藏。原生下载地址 <https://lobehub.com/downloads；不启用设备网关、不自动改动话题沙箱。>
- 6 项测试覆盖管理员、普通用户、未登录、加载、过期权限错误和切换账号；lint、全仓类型检查、镜像构建通过。Chrome DevTools MCP 在当前管理员话题的 “云端沙箱” 菜单实测显示 “下载桌面端”，截图已查看，没有点击下载或安装软件。普通用户隐藏通过组件权限测试验证。
- 两应用同镜像、共享后端和两项 QStash 计划启用检查通过；chat.cotti.ai 运行验证通过，未新增其浏览器登录验收。
- 备份 `/opt/backups/lingshu-admin-desktop-download-20260915/before-cutover.dump` 已通过 pg\_restore 列表校验；旧容器 `lingshu-dev-before-admin-download-20260915`、`lingshu-cotti-before-admin-download-20260915` 停止并禁用自启。无 schema 迁移，生产 chat.cotticoffee.com 未改。私有证据 `.records/admin-desktop-download/`。

## 2026-09-15 17:20：取消上下文长度冻结，保留金额控制

- 两个入口同步发布 `lobehub:lingshu-v2217-budget-only-20260915-r1`；共享数据库、OSS、Redis、QStash 和回调配置校验全部通过，两项队列计划恢复启用。未改动 chat.cotticoffee.com。
- 金额控制仍开启，平台默认 ¥15，用户 / 话题覆盖及发送前费用预留继续生效。移除自定义 Token 阈值；官方压缩和模型自身上下文限制不变。
- 停应用后备份 `/opt/backups/lingshu-budget-only-20260915/before-cutover.dump`，已通过 pg\_restore 列表校验。原子清理并审计 16 条上下文冻结，清理后上下文冻结为 0；12 条人工冻结、2 条预算冻结与发布前快照完全一致。
- 回退镜像容器 `lingshu-dev-before-budget-only-20260915`、`lingshu-cotti-before-budget-only-20260915` 均已停止且禁用自启。回退应用不能覆盖新增业务数据；旧镜像可能重新触发上下文冻结，已解除记录保留在审计中。
- 13 项回归、lint、全仓类型检查和完整构建通过。Chrome 全览确认 `tpc_SDb1iY2PjgmB`“评审” 显示 “¥3.49・未冻结”。未发送付费模型请求，未自动续跑该任务。私有发布证据位于 `.records/budget-only-20260915/`。
- 发布后 chatdev 公网会话接口返回 200；chat.cotti.ai 本机应用接口返回 200，可见 Chrome 正常进入该域名回调的统一登录页，登录后业务页面本轮未验收。服务器脚本直连其公网收到 Cloudflare 403，未更改网络或绕过规则。

## 2026-09-15：首页加载模型禁用误报

- 两域同步发布 `lobehub:lingshu-v2217-model-notice-loading-20260915-r1`。可用列表同时输出就绪状态，提示等待二开组模型配置与 VIP 权限返回；真实禁用提示和后端权限保留，不改模型开关。
- 回归旧代码 2 项失败、新代码 27 项通过，lint、全仓类型和构建通过。双入口同镜像、共享后端及健康检查通过；未发起付费模型请求，未宣称已完成浏览器冷启动闪烁录像验收。
- 备份 `/opt/backups/lingshu-model-notice-loading-20260915/before-cutover.dump` 已验证可列举；旧容器名称及镜像记录于 `.records/model-notice-loading-20260915/release.json`。本次无业务数据修改、无生产服务器发布，保留前一轮金额控制策略。

## 2026-09-15 18:15：飞书资料等选中工具的执行参数

- 同步发布 `lobehub:lingshu-v2217-selected-tool-ids-20260915-r1`，两域同镜像，应用健康及共享后端检查通过。修复浏览器端发送时只持久化工具提示、漏传实际工具 IDs 的问题；兼容已有上下文参数，权限校验不变。
- 149 项相关回归、lint、全仓类型与完整构建通过；旧代码上入口丢失工具 ID、生成工具遗漏两个用例失败。飞书读取接口在用户正常登录会话下真实返回 success=true、3973 字符正文。未自动续跑用户话题，模型端到端结果待刷新后重新选择工具发送验证。
- 已备份并校验 `/opt/backups/lingshu-selected-tool-ids-20260915/before-cutover.dump`；回退容器为 `lingshu-dev-before-selected-tool-ids-20260915`、`lingshu-cotti-before-selected-tool-ids-20260915`，均停止且禁用自启。无数据库 schema / 业务数据变更、无外部文档写入、未触及生产主机。
- 此版本包含此前首页禁用提示加载判断、金额控制等已发布修改。私有证据 `.records/feishu-topic-4pLuKrCTakI9/`；需要刷新网页加载新脚本，旧标签页不会自动替换执行函数。

## 2026-09-16 15:06：附件发送就绪校验

- 同步发布 `lobehub:lingshu-v2217-attachment-send-20260916-r1` 到 chatdev /chat.cotti.ai；两应用同镜像、共享后端、各自域名认证配置校验通过。
- 首页及会话页拦截未成功上传 / 已取消 / 上传失败的附件，保留草稿；服务端创建话题前校验当前用户 / 工作区可访问附件集合，缺失时拒绝，不产生此类空话题。正常附件及无附件发送保持原逻辑。
- 83 项相关回归、lint、全仓类型和构建通过；旧代码 7 个新增回归失败。Chrome 9222 本轮无法连接，浏览器端到端验收待恢复后补做；未发起付费模型请求。
- 备份 `/opt/backups/lingshu-attachment-send-20260916/before-cutover.dump` 通过 pg\_restore 列表校验，回退容器 `lingshu-dev-before-attachment-send-20260916` / `lingshu-cotti-before-attachment-send-20260916` 均停止并禁用自启。
- 生产 chat.cotticoffee.com 未发布；历史空话题未删除。无 schema 迁移、无存储配置修改；原附件上传失败的网络原因仍需原客户端证据。私有证据 `.records/attachment-send-20260916/`。

## 2026-09-18 16:20：未执行话题原地切换沙箱

- 双入口同步发布 `lobehub:lingshu-v2217-sandbox-switch-20260918-r1`，digest `sha256:bb866147d382efceacb44ad31c311bdabcc12307d517422b5fba97613f66ad1b`；共享后端、各自认证域名不变，未发布生产。
- 允许未执行或明确授权拒绝的话题原地切换。已执行、结果未知及运行中仍保护；服务端执行标记覆盖原始附件初始化。无数据库 schema 迁移。
- 回退容器 `lingshu-dev-before-sandbox-switch-20260918` / `lingshu-cotti-before-sandbox-switch-20260918`，均停止并关闭自动重启；数据库备份 `/opt/backups/lingshu-sandbox-switch-20260918/before-cutover.dump` 已通过列举校验。
- 临时配置 `COTTI_TOOL_TRACE_TOPIC_ID` 已在两个入口指定待排查话题。只记录请求工具名；问题定位后移除该环境变量以关闭。没有代发消息或自动续跑用户任务，浏览器切换与实际生成验收待用户操作。
- 证据 `.records/sandbox-switch-20260918/`；首轮 32 项、补充 107 项测试及全仓类型检查通过。不能用旧 runtimeEnv 字段推断当前有效执行环境。

## 2026-09-19 13:30：消息错误序列化最小补丁

- 双开发域同步发布 `lobehub:lingshu-v2217-freeze-error-20260919-r1`，digest `sha256:8464e2504b917b5bf29ba33abb8d2b1e95297df697d5e64d010cd5f57dfdeb10`。服务健康、共享后端和两项调度恢复校验通过。生产不变。
- 运行时代码仅一行，详情与移除条件见 `src/_custom/upgrade/message-error-serialization.md`。真实 SuperJSON 回归旧代码失败、新代码 7 项通过，全仓类型与构建通过。没有新增 schema / 金额配置，未额外调用模型。
- 153 MB 数据库备份 `/opt/backups/lingshu-freeze-error-20260919/before-cutover.dump` 已列举验证；回退容器 `lingshu-dev-before-freeze-error-20260919` / `lingshu-cotti-before-freeze-error-20260919` 停止且关闭自启。
- 为已确认的一条历史空白助手消息补回结构化预算冻结提示，条件更新并写入审计，额度和冻结状态未改。私有记录 `.records/freeze-error-20260919/`。
- 上轮指定话题工具名诊断已取得两次真实工具列表，本轮移除 `COTTI_TOOL_TRACE_TOPIC_ID` 关闭临时记录。原 15:58 请求未录制，不能由后续请求倒推。
- 浏览器视觉验收及该用户解冻后完整文件生成未执行，不等于已完成用户任务。

## 2026-09-20：沙箱旧配置与冻结弹框

- 双入口镜像：`lobehub:lingshu-v2217-sandbox-auto-20260920-r3`，
  digest `sha256:8658c951463806daec29cde99fe58ac3427112e24da2d257d99dd1db4f43e338`。
- 网页端旧 auto 未绑定电脑时按现有保存流程恢复沙箱；不更改话题提供方。
- 用户冻结提示改自动弹框，费用原因展示估算金额 / 额度，人工及历史上下文原因单独说明；
  关闭可查看历史，紧凑按钮可重新打开。不更改冻结规则或额度。
- 27 项相关回归、完整类型检查、镜像构建通过。Chrome 在当前登录用户的人工冻结话题实测自动弹出及关闭，
  费用金额由回归验证，未制造真实费用冻结或发送模型请求。
- 两入口健康接口 200，同镜像且 DB/OSS/Redis/QStash 配置一致；两个调度计划未暂停。
- 备份：`/opt/backups/lingshu-freeze-modal-20260920/before-cutover.dump`；
  上一批旧容器保留，最早本次修改前备份位于 `/opt/backups/lingshu-sandbox-auto-20260920/`。
- 私有证据：`.records/sandbox-auto-20260920/`、`.records/freeze-modal-20260920/`。
- 二开边界和后续委派链路待办：[sandbox-auto-compatibility.md](../../upgrade/sandbox-auto-compatibility.md)。
