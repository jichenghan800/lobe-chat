# Session Handoff - 2026-03-09

最后更新: 2026-03-09

## 本次目标

围绕 `vertexai` 路径，把 PDF 能力从 “文本解析 fallback” 推进到 “Vertex 原生 PDF 输入可用”，并把用户感知上等价的两条路径打通：

- 当前聊天直接上传 PDF
- Agent 勾选 “关联文件” 里的 PDF

同时修掉 Docker 运行环境里 PDF 解析报错，并按产品要求调整默认 agent 的 “关联文件勾选” 行为。

## 今天已完成的修复

### 1. Vertex 当前聊天上传 PDF 原生输入可用

结果：

- 当前聊天上传的 PDF，已可走 Vertex native PDF 输入链路
- 不再只依赖旧的文本提取注入

关键点：

- 先用独立 PoC 脚本验证了 `@google/genai + vertexai: true + gs://...pdf` 可行
- 服务端会把可用的 PDF 资源准备成 Vertex 可接受的 `gs://` URI
- Vertex native 生效后，会移除误导模型的空文本 fallback

相关文件：

- `src/_custom/vertexPdfNativePoc.ts`
- `src/_custom/services/vertexNativePdf.ts`

对应提交：

- `a45c272b66` 之前的相关修复

### 2. 扫描版 PDF “明明成功了但仍回答看不到内容” 的问题已修

问题根因：

- Vertex native PDF 已经可读，但 prompt 里仍混入旧的 `<file>...</file>` 空文本 fallback
- 对扫描件 / 无文本层 PDF，这会把 “提取为空” 的错误暗示暴露给模型，导致模型错误回答 “无法分析附件”

结果：

- native PDF 成功时，会清理掉对应空 fallback
- 证照类扫描 PDF 已能基于视觉内容回答正文与边框样式

### 3. Agent “关联文件” 中的 PDF 已复用 Vertex 原生 PDF 链路

结果：

- 用户当前聊天上传 PDF
- 用户勾选 Agent 里的 “关联文件” PDF

这两条路径现在对 Vertex 来说已经基本等价，都会尽量走 native PDF 输入。

关键点：

- 运行时保留 Agent 文件的 `url/type/size`
- `KnowledgeInjector` 在 `vertexai` 下追加 `file_url` part
- 服务端复用同一套 GCS 改写与 fallback 清理逻辑

注意：

- 这里说的是 Agent 关联文件
- 不是知识库检索路径

### 4. Docker 环境下 PDF 上传失败 `DOMMatrix is not defined` 已修

问题根因：

- 容器内 `@napi-rs/canvas` 的 optional native binding 没有正确暴露
- 导致 `pdfjs-dist` 依赖的 `DOMMatrix` polyfill 失效

结果：

- Dockerfile 已补齐运行层链接逻辑
- 页面实测后，上传 PDF 不再因这个错误失败

### 5. 默认 agent `cotti ai` 的 “关联文件勾选” 行为已调整

当前最终行为：

- 刷新页面：不取消勾选
- 开启新话题：取消勾选

作用范围：

- 只对默认 agent，也就是首页的 `cotti ai` /inbox agent 生效
- 用户自定义的其他 agent，新话题时仍保留勾选

这是当前你确认满意的行为，后续不要误改。

## 当前未改动 / 保持原状

### 1. 知识库路径没有重做成原生 PDF 直读

当前知识库仍是检索式能力，不是把整份 PDF 直接作为 native document part 送给 Vertex。

### 2. 刷新页面不会自动清空默认 agent 的勾选

这个状态是当前确认后的最终要求，不是 bug。

### 3. 非 Vertex provider 没有跟进这套 native PDF 逻辑

本次只覆盖 `vertexai`。

## 关键提交

- `a45c272b66` `✨ feat: 接入 Vertex 原生 PDF 聊天与关联文件链路`
- `3ba3829ef7` `✨ feat: 默认 agent 新话题时清空关联文件勾选`

## 关键文件

- `src/_custom/VERTEX_PDF_HANDOFF.md`
- `src/_custom/vertexPdfNativePoc.ts`
- `src/_custom/services/vertexNativePdf.ts`
- `src/services/chat/mecha/contextEngineering.ts`
- `packages/context-engine/src/providers/KnowledgeInjector.ts`
- `packages/context-engine/src/engine/messages/MessagesEngine.ts`
- `Dockerfile`
- `src/app/[variants]/(main)/home/_layout/HomeAgentIdSync.tsx`
- `src/store/agent/slices/knowledge/action.ts`
- `src/store/chat/slices/topic/action.ts`

## 已验证项

- `bunx vitest run --silent='passed-only' 'src/_custom/services/vertexNativePdf.test.ts'`
- `cd packages/context-engine && bunx vitest run --silent='passed-only' 'src/providers/__tests__/KnowledgeInjector.test.ts'`
- `bunx vitest run --silent='passed-only' 'src/store/agent/slices/knowledge/action.test.ts'`
- `bunx vitest run --silent='passed-only' 'src/store/chat/slices/topic/action.test.ts'`
- Docker 已重建，`lobehub` 容器已成功启动

## 下个会话建议开场

如果下个会话要继续这条线，直接让模型先读这两个文件：

- `/opt/lobechat-main/src/_custom/SESSION_HANDOFF_2026-03-09.md`
- `/opt/lobechat-main/src/_custom/VERTEX_PDF_HANDOFF.md`

可直接使用这句话：

`先阅读 /opt/lobechat-main/src/_custom/SESSION_HANDOFF_2026-03-09.md 和 /opt/lobechat-main/src/_custom/VERTEX_PDF_HANDOFF.md，再继续。`
