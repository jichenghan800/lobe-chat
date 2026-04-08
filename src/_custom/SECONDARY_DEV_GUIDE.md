# LobeChat 二次开发与注入规范

本分支用于在官方 `v2.1.47` 基础上承载当前项目的二开内容。目标不是把历史修改散落回上游源码，而是把定制能力尽量收敛到 `src/_custom/`，在上游文件里只保留必要的入口注入。

## 核心原则

1. 默认最小侵入。
2. 优先注册表、包裹层、注入点，不直接改核心函数体。
3. 必须改核心逻辑时，范围最小化，并记录到 `src/_custom/CHANGELOG.md`。
4. 能通过 `_custom` 文件实现的逻辑，不放回 `src/` 常规目录。

## 推荐目录

```text
src/_custom/
├── components/
├── hooks/
├── registry/
├── routes/
├── services/
├── types/
└── CHANGELOG.md
```

## 本分支已采用的注入模式

- 品牌与助手命名：
  - `src/_custom/registry/branding.ts`
- 首页入口/导航裁剪：
  - `src/_custom/registry/homeSections.ts`
  - `src/_custom/registry/homeStarter.ts`
  - `src/_custom/registry/navigation.ts`
- 模型展示与 provider 定制：
  - `src/_custom/registry/modelDisplayName.ts`
  - `src/_custom/components/ModelDisplayNameTag.tsx`
  - `src/_custom/hooks/useModelDisplayName.ts`
  - `src/_custom/registry/providerName.ts`
  - `src/_custom/registry/providerVisibility.ts`
- 模型参数与切换面板定制：
  - `src/_custom/registry/modelCustomization.ts`
  - `src/_custom/registry/modelSwitchPanel.ts`
- Vertex 原生 PDF：
  - `src/_custom/services/vertexNativePdf.ts`
  - `src/_custom/vertexPdfNativePoc.ts`
- 开发旁路登录：
  - `src/_custom/routes/dev-login.ts`

## 允许的上游改动类型

- 一个 `_custom` import
- 一个 `_custom` 函数调用
- 一个 `_custom` 组件标签

如果需要更多改动，必须在 `CHANGELOG.md` 记录：

- 修改原因
- 影响文件
- 回滚方式
- 最小验证方式

## 分支协作建议

- 官方稳定版本落点：`upgrade/v2.1.47-base`
- 二开重放分支：`upgrade/v2.1.47-custom-rebase`
- 本地数据库演练分支：`upgrade/v2.1.47-db-rehearsal`
- 预发布/生产候选分支：`release/v2.1.47-prod`

## 当前注意事项

- 本项目已有大量注入式二开，升级时优先保持旧行为一致，不盲目追随新 UI 交互。
- 本分支保留了空 `userId` 认证修复、同名文件原位覆盖、知识项本地状态即时收敛、Vertex native PDF、品牌/导航/模型展示层注入。
- 生产替换流程以本地 Docker + 本地 PostgreSQL/ParadeDB 演练成功为前提。

## 参考

- `src/_custom/CHANGELOG.md`
- `src/_custom/SESSION_HANDOFF_2026-03-09.md`
- `src/_custom/VERTEX_PDF_HANDOFF.md`
