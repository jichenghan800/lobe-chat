# Vertex PDF Native Input Handoff

本分支对 Vertex PDF 的定制目标是：在保持注入式二开边界的前提下，让用户上传 PDF 与 Agent 关联 PDF 在 `vertexai` 下尽量走原生 PDF 能力，而不是只依赖文本抽取 fallback。

## 当前结论

- `vertexai` 已接入原生 PDF 预处理服务：`src/_custom/services/vertexNativePdf.ts`
- 当前聊天上传 PDF：
  - 服务端会把可用文件准备成 `gs://...` URI
  - native 成功后移除误导性的空文本 fallback
- Agent 关联文件中的 PDF：
  - `contextEngineering -> MessagesEngine -> KnowledgeInjector` 已保留 `url/fileType/size`
  - `KnowledgeInjector` 在 `vertexai` 下会追加 `file_url` part
- `thinkingLevel3` 的 Gemini 3.1 默认值定制与 Vertex PDF 一并保留在 `_custom` 层

## 关键文件

- `src/_custom/services/vertexNativePdf.ts`
- `src/_custom/services/vertexNativePdf.test.ts`
- `src/_custom/vertexPdfNativePoc.ts`
- `src/app/(backend)/webapi/chat/[provider]/route.ts`
- `src/services/chat/mecha/contextEngineering.ts`
- `packages/context-engine/src/providers/KnowledgeInjector.ts`
- `packages/context-engine/src/engine/messages/MessagesEngine.ts`

## 设计边界

- 仅对 `vertexai` 做 native PDF 增强
- 仅覆盖：
  - 当前聊天上传 PDF
  - Agent 关联文件 PDF
- 不重做知识库检索链路

## 升级分支注意事项

- 如果后续继续升级官方版本，优先检查以下注入点是否仍存在：
  - `/webapi/chat/[provider]`
  - `contextEngineering`
  - `MessagesEngine`
  - `KnowledgeInjector`
- 如果上游再次调整消息 part schema，先验证 `file_url` part 是否仍可完整穿透到 provider 层
- 若 Vertex/GCS 凭证或 bucket 变更，先用 `src/_custom/vertexPdfNativePoc.ts` 做独立连通性验证
