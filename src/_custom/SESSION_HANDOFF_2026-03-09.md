# Session Handoff - 2026-03-09

本文件保留 Vertex PDF 与默认 inbox agent 行为调整的交接摘要，供升级分支继续维护时快速恢复上下文。

## 已确认保留的定制行为

- `vertexai` 当前聊天上传 PDF 走原生 PDF 输入链路
- Agent 勾选“关联文件”中的 PDF 也复用原生 PDF 输入链路
- Vertex native 成功时，去掉误导模型的空文本 fallback
- Docker 运行时 `DOMMatrix is not defined` 问题已修
- 默认 inbox agent：
  - 刷新页面不清空关联文件勾选
  - 新建话题时清空关联文件勾选

## 当前分支中的对应文件

- `src/_custom/services/vertexNativePdf.ts`
- `src/_custom/vertexPdfNativePoc.ts`
- `src/services/chat/mecha/contextEngineering.ts`
- `packages/context-engine/src/providers/KnowledgeInjector.ts`
- `packages/context-engine/src/engine/messages/MessagesEngine.ts`
- `src/store/agent/slices/knowledge/action.ts`
- `src/services/chat/mecha/modelParamsResolver.ts`

## 已知边界

- 本次只覆盖 `vertexai`
- 知识库仍然是检索路径，不是“整份 PDF 直送模型”
- inbox agent 品牌展示由 `src/_custom/registry/branding.ts` 统一控制

## 建议继续阅读

- `src/_custom/VERTEX_PDF_HANDOFF.md`
- `src/_custom/CHANGELOG.md`
