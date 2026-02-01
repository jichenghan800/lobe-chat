# Customization Changelog

本文件用于记录二次开发的例外修改与上游同步历史，便于长期维护与回滚。

---

### \[2026-02-01] 模型提供商名称映射与分组方式全局控制

- 类型: custom
- 涉及文件: src/\_custom/registry/providerName.ts; src/\_custom/registry/modelSwitchPanel.ts; src/store/aiInfra/slices/aiProvider/action.ts; src/store/global/initialState.ts; src/store/global/selectors/systemStatus.ts; .env
- 原因：需要统一隐藏或自定义模型提供商显示名，并全局默认按模型分组
- 方案：新增 `NEXT_PUBLIC_PROVIDER_NAME_MAP` 映射显示名；新增 `NEXT_PUBLIC_MODEL_SWITCH_GROUP_MODE` 强制分组模式
- 回滚：移除上述 env 与对应注入逻辑
- 影响：仅影响 UI 展示，不改变模型实际 providerId

---

### \[2026-01-31] Dev 免密登录调试入口

- 类型: custom
- 涉及文件: src/\_custom/routes/dev-login.ts; src/app/(backend)/api/dev/login/route.ts
- 原因：开发阶段需要为 Chrome Dev MCP 提供免密调试账号
- 方案：新增 /api/dev/login，使用环境变量 + token 校验后创建 / 更新调试用户并写入 Better Auth 会话
- 回滚：删除上述文件并移除 DEV_AUTH_BYPASS\_\* 环境变量
- 影响：仅在 DEV_AUTH_BYPASS_ENABLED=1 且 token 校验通过时生效

---

### \[2026-01-30] 仅保留聊天与助理的导航收敛

- 类型: custom
- 涉及文件: src/\_custom/registry/navigation.ts; src/app/\[variants]/(main)/home/\_layout/Header/components/Nav.tsx; src/app/\[variants]/(main)/home/\_layout/Body/BottomMenu/index.tsx; src/app/\[variants]/(mobile)/\_layout/NavBar.tsx
- 原因: FEATURE_FLAGS 无法隐藏搜索 / 文稿 / 资源 / 记忆 / 个人中心等导航入口
- 方案：在 `_custom` 定义导航 allowlist，并在 3 处导航组件最小注入过滤
- 回滚：删除上述 import/call，并移除 `src/_custom/registry/navigation.ts`
- 影响：仅收敛导航入口，直接访问 URL 仍可进入隐藏页面

---

### \[2026-01-30] 修复 Feishu OAuth 配置缺失 tokenUrl

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因: Better-Auth generic-oauth 要求 tokenUrl；缺失会导致 /api/auth/sign-in/oauth2 报 INVALID_OAUTH_CONFIGURATION
- 方案：为 Feishu provider 补充 tokenUrl 与 userInfoUrl
- 回滚：删除新增的 tokenUrl/userInfoUrl 字段
- 影响：仅影响 Feishu SSO，其他登录方式不受影响

---

### \[2026-01-30] 修复 Feishu OAuth redirect_uri 指向错误回调路径

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/index.ts
- 原因: generic OAuth redirectURI 被设置为 /api/auth/callback/{id}，导致飞书报 redirect_uri invalid
- 方案：将 generic OAuth redirectURI 修正为 /api/auth/oauth2/callback/{id}
- 回滚：还原 redirectURI 为 /api/auth/callback/{id}
- 影响：仅影响 generic OAuth 提供商（如 Feishu/Wechat）

---

### \[2026-01-30] 增强 Feishu OAuth token 错误日志

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因: token 交换失败时无法看到飞书返回的具体错误信息
- 方案：记录 token 响应 status/statusText/body（不含敏感信息）
- 回滚：删除新增的 console.error 日志
- 影响：仅增加错误日志，不影响功能

---

### \[2026-01-30] Feishu token 交换补充 client_id/client_secret

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因：飞书 token 接口返回缺少 client_id（20063）
- 方案：在 token 请求体中同时发送 client_id/client_secret（保留 app_id/app_secret 兼容）
- 回滚：删除 client_id/client_secret 字段
- 影响：仅影响 Feishu SSO

---

### \[2026-01-30] 记录 Feishu 未返回邮箱时的回退原因

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因：需确认为何生成 feishu.lobehub 回退邮箱
- 方案：当 email/enterprise_email 缺失时输出日志包含 union_id/open_id
- 回滚：删除新增 console.warn
- 影响：仅增加日志，不影响功能

---

### \[2026-01-30] 记录邮箱白名单命中信息

- 类型: hotfix
- 涉及文件: src/libs/better-auth/plugins/email-whitelist.ts
- 原因: EMAIL_NOT_ALLOWED 无法定位真实邮箱域名
- 方案：记录域名与是否命中白名单（不输出完整邮箱）
- 回滚：删除新增 console.warn
- 影响：仅增加日志，不影响功能

---

### \[2026-01-30] 修复 Feishu 回退邮箱被覆盖导致 email_is_missing

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因：合并 profile 时覆盖了已生成的回退邮箱
- 方案：调整合并顺序，确保 fallback email 生效
- 回滚：还原 profile merge 顺序
- 影响：仅影响 Feishu SSO

---

### \[2026-01-30] 修复 Feishu email 为空字符串导致 fallback 失效

- 类型: hotfix
- 涉及文件: src/libs/better-auth/sso/providers/feishu.ts
- 原因: email 为空字符串时 `??` 不生效，导致 email_is_missing
- 方案: trim 后用 `||` 选择 enterprise_email 或 fallback
- 回滚：还原 email 取值逻辑
- 影响：仅影响 Feishu SSO

---

### \[2026-01-30] Fork 操作自动触发 Market OIDC 登录

- 类型: custom
- 涉及文件: src/app/\[variants]/(main)/community/(detail)/agent/features/Sidebar/ActionButton/ForkAndChat.tsx; src/app/\[variants]/(main)/community/(detail)/group_agent/features/Sidebar/ActionButton/ForkGroupAndChat.tsx
- 原因: Market 由官方托管，无法配置 trusted client；无手动登录入口时 fork 直接 Unauthorized
- 方案: fork 前检测 Market 登录状态，未登录则调用 signIn () 触发 OIDC
- 回滚：删除 useMarketAuth 注入与 signIn 逻辑
- 影响: fork 操作会弹出授权确认与登录流程

---

### \[2026-01-30] Web 端启用 Market OIDC handoff 以适配官方 Market

- 类型: custom
- 涉及文件: src/layout/AuthProvider/MarketAuth/MarketAuthProvider.tsx; src/layout/AuthProvider/MarketAuth/oidc.ts; src/layout/AuthProvider/MarketAuth/types.ts
- 原因：官方 Market 的 web clientId 不允许自建域名作为 redirect_uri，导致授权回到官方站点无法闭环
- 方案：增加 `NEXT_PUBLIC_MARKET_OIDC_HANDOFF=1`，Web 端使用 desktop clientId + handoff 轮询完成授权
- 回滚：移除 handoff 开关逻辑，恢复原 web redirect 流程
- 影响：授权弹窗会停留在官方页面，但本地通过 handoff 闭环获取 token

---

### \[2026-01-30] Market OIDC 手动回调兜底（复制回调 URL 完成授权）

- 类型: custom
- 涉及文件: src/\_custom/components/marketAuth/ManualCallbackModal.tsx; src/layout/AuthProvider/MarketAuth/MarketAuthProvider.tsx; src/layout/AuthProvider/MarketAuth/oidc.ts; src/locales/default/marketAuth.ts; locales/zh-CN/marketAuth.json; .env
- 原因：办公网环境下官方 consent/callback 页面无法请求 app.lobehub.com，handoff 长期 pending
- 方案：handoff 失败 / 超时后弹出输入框，用户粘贴回调 URL 解析 code/state 完成本地 token 交换；保留授权弹窗便于复制；手动回调会同步更新 state；支持 `NEXT_PUBLIC_MARKET_OIDC_HANDOFF_TIMEOUT_MS` 缩短等待
- 回滚：移除 ManualCallbackModal 与 MarketAuthProvider 的手动兜底逻辑
- 影响：当自动回调失败时，用户可通过复制回调链接完成授权

---

### \[2026-01-30] Market token 代理失败日志增强

- 类型: hotfix
- 涉及文件: src/app/(backend)/market/oidc/\[\[...segments]]/route.ts
- 原因：token 交换 500 无法定位具体错误原因
- 方案：输出 Market SDK 错误的 status/statusText/body，返回 detail 便于排查
- 回滚：移除 extractProxyError 与 detail 透传
- 影响：仅增加日志与错误详情

---

### \[2026-01-30] Market token 代理改为直连 token endpoint

- 类型: hotfix
- 涉及文件: src/app/(backend)/market/oidc/\[\[...segments]]/route.ts
- 原因：Market SDK 返回 “Invalid token response payload”，无法获取实际响应
- 方案：token/refresh 走直连 `https://market.lobehub.com/token` 并透传原始响应
- 回滚：恢复使用 Market SDK `exchangeOAuthToken`
- 影响：仅影响 OIDC token 交换

---

### \[2026-01-31] 回退 agent fork 登录自动触发逻辑（等待官方修复）

- 类型: revert
- 涉及文件: src/app/\[variants]/(main)/community/(detail)/agent/features/Sidebar/ActionButton/ForkAndChat.tsx; src/app/\[variants]/(main)/community/(detail)/group_agent/features/Sidebar/ActionButton/ForkGroupAndChat.tsx
- 原因：官方 bug，fork 授权链路不稳定，先保持官方实现
- 方案：撤销 fork 前自动触发 Market OIDC 登录
- 回滚：重新引入 fork 前 signIn 逻辑
- 影响：fork 继续依赖官方 Market 侧修复

---

### \[2026-01-31] 回退 Market/OIDC 兜底逻辑（保持官方实现）

- 类型: revert
- 涉及文件: src/layout/AuthProvider/MarketAuth/MarketAuthProvider.tsx; src/layout/AuthProvider/MarketAuth/oidc.ts; src/layout/AuthProvider/MarketAuth/types.ts; src/app/(backend)/market/oidc/\[\[...segments]]/route.ts; src/locales/default/marketAuth.ts; locales/zh-CN/marketAuth.json; locales/en-US/marketAuth.json
- 原因：等待官方修复，保持与上游一致
- 方案：撤销 handoff / 手动回调 / 直连 token 代理相关改动
- 回滚：重新引入 Market/OIDC 兜底逻辑
- 影响：Market 登录链路回到官方默认实现

---

### \[2026-01-31] 模型显示名统一映射（非 Provider / 模型配置页）

- 类型: custom
- 涉及文件: src/\_custom/hooks/useModelDisplayName.ts; src/\_custom/components/ModelDisplayNameTag.tsx; src/app/\[variants]/(main)/agent/features/Conversation/Header/Tags/index.tsx; src/features/Conversation/Messages/components/Extras/Usage/index.tsx; src/features/Conversation/Messages/components/Extras/Usage/UsageDetail/ModelCard.tsx; src/features/Conversation/components/History/index.tsx; src/features/Conversation/components/ShareMessageModal/ShareImage/Preview\.tsx; src/features/ShareModal/ShareImage/Preview\.tsx; src/app/\[variants]/(mobile)/(home)/features/SessionListContent/List/Item/index.tsx; src/app/\[variants]/(main)/community/(detail)/provider/features/Sidebar/ActionButton/index.tsx; src/app/\[variants]/(main)/community/(list)/provider/features/List/Item.tsx; src/app/\[variants]/(main)/image/features/GenerationFeed/BatchItem.tsx
- 原因：需要在非 Provider / 模型配置页统一显示可配置的模型 displayName
- 方案：新增 displayName 解析 hook + Tag 组件，并替换多处 ModelTag / 模型文本显示
- 回滚：移除上述 hook / 组件并恢复各处 ModelTag / 模型文本显示
- 影响：模型名称展示优先显示自定义 displayName，模型 id 作为 fallback/tooltip

---

## 变更记录模板

```
### [YYYY-MM-DD] 变更标题
- 类型: custom / hotfix / upstream-sync
- 涉及文件: src/_custom/... 或 src/...（仅限例外）
- 原因: 为什么必须改（或为什么无法用注入/包裹解决）
- 方案: 采用的实现方式
- 回滚: 如何撤销（步骤或关键点）
- 影响: 可能影响的功能或风险点
```

---

## 上游同步记录模板

```
### [YYYY-MM-DD] 同步 upstream/main
- 上游提交范围: <from>.. <to>
- 冲突文件: 无 / 列表
- 处理方式: 说明冲突解决策略
- 回归验证: 跑了哪些测试或手动验证点
```
