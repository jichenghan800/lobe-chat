# LobeChat 二次开发与注入规范（重构版）

本文件用于确保 Fork 的代码可以长期保持与上游 LobeChat 同步，并且能简单合并本地修改。请严格遵守 “最小侵入” 原则，将二次开发集中在 `src/_custom/`。

> 入口说明：本项目二次开发请参考 `src/_custom/SECONDARY_DEV_GUIDE.md`。

---

## 1. 核心目标

- 长期与上游（Upstream）保持一致
- 二次开发功能可持续维护、可快速回滚
- 本地修改可在 Rebase 时轻量合并

## 2. 最小侵入原则（Minimum Invasion）

**硬性规则**：

- **禁止**：直接改动 `src/` 下现有函数体、逻辑或业务流程（不含 `src/_custom/`）。
- **允许**：
  - 在 `src/_custom/` 完整实现所有自定义逻辑
  - 在上游文件中仅添加 “单行注入”：
    - 一个 import
    - 一个组件标签或 Hook 调用

当必须修改核心逻辑时，必须遵循 “深层逻辑修改” 流程（见第 7 节）。

---

## 3. 平衡策略（严苛 vs. 可优化）

为避免 “过于严苛导致无法优化” 或 “过于放松导致难以合并”，采用以下平衡规则：

- **默认最小侵入**：优先注入 / 包裹 / 注册表，保持上游结构不变。
- **允许有限例外**：当性能、稳定性或架构优化必须触及核心逻辑时，允许改动，但必须：
  1. 限定在最小变更范围；
  2. 记录到 `src/_custom/CHANGELOG.md`；
  3. 提供回滚方案；
  4. 补充最小验证（测试或手动验证点）。
- **优先 “替换入口” 而非 “改内部逻辑”**：能换 import 就不改函数体，能包裹就不改内部实现。
- **减少注入点数量**：集中到 1\~2 个入口，避免分散注入导致冲突率上升。

---

## 4. 目录规范

所有二次开发必须放在 `src/_custom/`：

```
src/_custom/
├── components/   # 自定义 UI 组件
├── hooks/        # 注入式业务逻辑
├── wrappers/     # 官方组件包装层
├── services/     # 新增服务调用
├── constants/    # 私有常量/配置
└── registry/     # 注入注册表（可选，推荐）
```

**推荐做法**：集中式注入注册表，例如 `src/_custom/registry/index.ts`，在上游入口只保留一个注入点，降低冲突概率。

---

## 5. 策略 A：UI 模块注入（Injected Components）

适用场景：在已有页面上添加 UI（Banner、侧边栏插件等）。

**步骤**：

1. 在 `src/_custom/components/` 中实现完整组件。
2. 在上游页面仅添加一行 import + 一行 JSX。

**示例**：

```ts
// src/app/[variants]/page.tsx
import { MyCustomBanner } from '@/_custom/components/MyCustomBanner';

export default async (props: DynamicLayoutProps) => {
  const isMobile = await RouteVariants.getIsMobile(props);

  if (isMobile) return <MobileRouter />;

  return (
    <>
      <MyCustomBanner />
      <DesktopRouter />
    </>
  );
};
```

---

## 6. 策略 B：逻辑包裹（Wrapper / HOC）

适用场景：需要改变组件行为或拦截事件（如头像点击弹出自定义菜单）。

**规则**：

- **禁止**：直接改 `src/` 里的组件逻辑文件。
- **推荐**：
  1. 在 `src/_custom/wrappers/` 创建包装组件
  2. 在业务层替换 import 指向

**示例**：

```ts
// 业务层替换
import Avatar from '@/_custom/wrappers/CustomAvatar';
```

---

## 7. 策略 C：深层逻辑修改（Deep Core Changes）

当必须修改核心 Hook/Service 时：

**最小切入点**：

- 上游文件只允许插入一个 Hook / 函数调用，如 `useCustomLogic()`。

**逻辑外置**：

- 复杂逻辑全部放入 `src/_custom/hooks/` 或 `src/_custom/services/`。

**例外记录（强制）**：

- 在 `src/_custom/CHANGELOG.md` 记录：
  - 修改原因
  - 修改位置
  - 回滚方案

---

## 8. 补丁管理（node_modules）

- 如需修改第三方依赖，必须使用 `patch-package`。
- 补丁文件提交到仓库 `patches/`。

---

## 9. Git 与同步策略（保持 Upstream 一致）

**分支策略**：

- `upstream/*` 仅用于跟踪上游
- 本地开发分支在其上 rebase

**同步流程（推荐）**：

```
git fetch upstream
git rebase upstream/main
```

**冲突处理**：

- 优先保留上游结构
- 自定义注入代码重新插入
- 可开启 `git rerere` 复用冲突解决

---

## 10. Commit 规范

- 二次开发提交请统一前缀：`🎨 custom:`
- 上游同步提交保持原样

---

## 11. AI Diff Audit Protocol（审计要求）

### 11.1 Redline Rule

- **禁止**：修改 `src/` 现有逻辑
- **允许**：`src/_custom/`
- **谨慎区**：只允许 “单行注入”

### 11.2 自检问题

1. 是否改动了 `src/` 核心逻辑？若是，重构到 `_custom`。
2. 是否能用 Wrapper/HOC 解决？若是，优先使用。
3. 是否用 `@/_custom/` 别名？若否，立即修正。

### 11.3 Diff 验证输出

当被要求验证 Diff 时，输出以下摘要：

- Core Files Touched: \[File List or None]
- Invasion Level: \[Zero / Minimum / High]
- Custom Path: \[Path list in src/\_custom/]

---

## 12. 变更清单（建议补充）

建议维护：`src/_custom/CHANGELOG.md`

- 记录每次二次开发变更
- 记录上游同步日期与冲突情况

---

## 13. 失败案例（反例提示）

以下行为会显著增加 merge 成本：

- 直接改 `src/` 内部业务逻辑
- 在多个上游入口到处插入自定义组件
- 在上游组件中扩展 props 或改接口签名

---

## 14. 快速检查清单

在提交前自检：

- [ ] 自定义逻辑是否全部在 `src/_custom/`？
- [ ] 上游文件是否仅一行注入？
- [ ] 是否可 rebase 而无需大范围冲突？
- [ ] 是否记录在 `src/_custom/CHANGELOG.md`？
