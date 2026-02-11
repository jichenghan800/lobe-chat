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

## 9. Lobe Chat 二次开发分支管理约定

本文档描述本项目采用的 **“三分支自动闭环”** 开发模型（单人维护，无 feature 分支）。

### 9.1 核心分支架构

| 分支名              | 对应环境        | 职责                                              | 维护方式                          |
| :------------------ | :-------------- | :------------------------------------------------ | :-------------------------------- |
| **`upstream-sync`** | 官方镜像        | 永远保持与 LobeChat 官方仓库 100% 一致。          | 🤖 **纯自动**（Daily Action）     |
| **`main`**          | 生产环境 (Prod) | 稳定发布版，包含官方代码 + 自定义功能。           | 🤖 **自动同步** + 👨‍💻 **手动合并** |
| **`dev`**           | 开发环境 (Dev)  | 日常开发主战场，包含最新官方代码 + 开发中的功能。 | 🤖 **自动回流** + 👨‍💻 **人工提交** |

### 9.2 自动化工作流 (GitHub Actions)

项目配置 3 个核心自动化脚本，形成闭环：

#### 🔄 1. 上游同步 (Sync Upstream)

- **触发时机**：每天 UTC 0 点。
- **行为**：
  1. 拉取官方最新 Tag。
  2. 强制重置 `upstream-sync` 分支。
  3. 提一个 PR（`upstream-sync` -> `main`）。
- **你需要做**：收到 PR 通知后 Review 并点击 **Merge**。

#### 🚀 2. 自动发版 (Release Custom)

- **触发时机**：代码合入 `main` 且 `package.json` 版本号变更。
- **行为**：
  1. 检查 Tag 是否已存在。
  2. 自动打 Tag（如 `v1.20.5`）。
  3. 发布 GitHub Release。
- **你需要做**：在合并代码前确保版本号已更新。

#### 🌊 3. 自动回流 (Backflow)

- **触发时机**：`main` 分支有更新（无论是上游同步还是手动发版）。
- **行为**：
  1. 尝试将 `main` 的新代码自动合并回 `dev`。
  2. **若无冲突**：静默成功，`dev` 自动更新。
  3. **若有冲突**：停止合并，提 Issue 报警。
- **你需要做**：收到冲突报警后按 Issue 提示手动解决。

### 9.3 日常开发 SOP（单人，无 feature 分支）

#### ✅ 开发新功能

1. **准备环境**：

   ```bash
   git checkout dev
   git pull origin dev
   # 如果刚合过 upstream，记得装依赖
   pnpm install
   ```

2. **编码 & 提交**：

   ```bash
   # 开发...
   git add .
   git commit -m "🎨 custom: add super cool feature"
   git push origin dev
   ```

3. **准备发布 (Release)**：
   - 修改 `package.json` 版本号（如 `1.0.0` -> `1.0.1`）。
   - 提交版本号修改。
   - 在 GitHub 提 PR：**`dev` -> `main`**（单人场景也可本地 `merge` 后直接 `push`）。
   - 合并 PR 或本地 `merge` 后等待 Action 自动发版。

#### 🚨 处理冲突（自动回流失败）

1. **拉取最新现场**：
   ```bash
   git checkout dev
   git pull origin dev
   ```
2. **手动合并**：
   ```bash
   git fetch origin main
   git merge origin/main
   ```
3. **解决冲突并提交**：
   - 在编辑器中修复冲突文件。
   - 必要时执行 `pnpm install`（lockfile 冲突场景）。
   - `git add .`
   - `git commit -m "chore: resolve conflict from main"`
   - `git push origin dev`

### 9.4 冲突处理原则

- 优先保留上游结构
- 自定义注入代码重新插入
- 可开启 `git rerere` 复用冲突解决
- `dev` 分支需允许 direct push（否则需改为 PR 回流模式）

---

### 9.5 关键 Hotfix 防回归校验（建议发布前执行）

针对容易在 reset/rebase/sync 过程中丢失的修复（例如 Vertex/Gemini 并行 tool response 合并），在发布前执行：

```bash
bun run custom:verify-hotfixes
bun run custom:test-hotfix-regressions
# 或一键执行
bun run custom:verify-hotfix-gate
```

可选：显式检查多个 ref（便于对比分支是否丢补丁）

```bash
bun scripts/checkCustomHotfixes.mts HEAD origin/dev origin/main
```

若命令返回非 0，说明关键补丁在某个分支/引用中缺失，需要先补回再发布。

**P0 用例自动增长约定**：

- 与关键 hotfix 相关的回归测试标题统一加前缀：`[HOTFIX-P0]`。
- `scripts/checkCustomHotfixes.mts` 会自动扫描该前缀并进行数量守卫；新增 P0 用例只要带该前缀即可自动纳入守卫，无需逐条改脚本。
- CI Merge Gate（`upstream-sync -> main`、`dev -> main`）会强制执行上述校验，并在失败时输出 `Hotfix Regression Failed`。

### 9.6 公开仓库发布前安全门禁（方案 B）

若仓库将改为公开，同步启用以下检查：

```bash
bun run custom:verify-public-safety
```

校验内容：

- 禁止跟踪运行时 `.env` 文件（仅允许 `.env.example*` / `.env.desktop` 模板）。
- 禁止在跟踪模板中出现真实密钥（如 `.env.desktop`）。
- 禁止在跟踪模板中默认开启 `DEV_AUTH_BYPASS_ENABLED=1` 或 `DEV_AUTH_BYPASS_ALLOW_PROD=1`。

CI 会在失败时输出 `Public Security Gate Failed`，用于快速定位高风险配置。


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
