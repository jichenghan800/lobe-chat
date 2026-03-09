# Vertex PDF Native Input Handoff

Last updated: 2026-03-09

## Goal

Current deployment only uses `vertexai`.

Need to evaluate and then implement native PDF reading for Vertex AI, while keeping current injection-style customization discipline.

The business requirement is:

- User-uploaded files in the current chat must be readable by the model
- Agent selected "关联文件" must be readable by the model
- Agent selected "支持库 / 知识库" must still work

Important: these three paths are not the same in current code.

## What has already been fixed

### 1. Chat upload race condition

Problem:

- Non-image/video files could be uploaded and then sent to the model before `parseFileContent` finished
- In that case the model only saw URL / metadata, not parsed content

Fix already implemented:

- File: `src/store/file/slices/chat/action.ts`
- Non-image/video chat files now remain in `processing` until `ragService.parseFileContent(fileId)` resolves
- Parse failure is surfaced as explicit task error instead of silently proceeding

Tests added and passed:

- `src/store/file/slices/chat/action.test.ts`
- `src/store/file/slices/chat/selectors.test.ts`

### 2. Docker PDF parsing failure

Problem found in logs:

- `document.parseFileContent` failed with `ReferenceError: DOMMatrix is not defined`
- Root cause was broken `@napi-rs/canvas` native binding resolution in the Docker runtime

Fix already implemented:

- File: `Dockerfile`
- Added symlink logic so `@napi-rs/canvas` can resolve its platform binding in the app image

Recorded in:

- `src/_custom/CHANGELOG.md`

User already verified that after the runtime fix, actual PDF parse succeeded.

## Current architecture: three different document paths

### A. User-uploaded file in current chat

Path:

1. Upload file
2. `parseFileContent`
3. Parsed text stored in `documents` table
4. Message query attaches it into `fileList[].content`
5. Context engine injects it into prompt as `<file ...>content</file>`

Key files:

- `src/store/file/slices/chat/action.ts`
- `packages/database/src/models/message.ts`
- `packages/context-engine/src/processors/MessageContent.ts`
- `packages/prompts/src/prompts/files/file.ts`

Conclusion:

- This path is text extraction + prompt injection
- It is not native Vertex PDF input

### B. Agent selected "关联文件"

Path:

1. Agent config contains enabled files
2. Runtime maps them to `knowledge.fileContents`
3. Context engine injects them as agent knowledge

Key files:

- `src/server/modules/AgentRuntime/RuntimeExecutors.ts`
- `src/server/modules/Mecha/ContextEngineering/index.ts`
- `packages/prompts/src/prompts/files/knowledgeBase.ts`

Conclusion:

- This path is also text injection
- It is not native Vertex PDF input

### C. Agent selected "知识库 / 支持库"

Path:

1. Runtime injects knowledge base metadata only
2. Model is expected to use `searchKnowledgeBase` tool for retrieval

Key files:

- `packages/prompts/src/prompts/files/knowledgeBase.ts`
- `packages/context-engine/src/providers/KnowledgeInjector.ts`

Conclusion:

- This path is retrieval, not full-file direct reading
- Do not confuse it with file full-text reading

## Current Vertex AI integration status

Current local implementation does use `@google/genai` with `vertexai: true`, but it does not support native file parts in the message builder.

Verified code facts:

- `packages/model-runtime/src/providers/vertexai/index.ts` creates `GoogleGenAI({ vertexai: true })`
- `packages/model-runtime/src/types/chat.ts` only supports:
  - `text`
  - `image_url`
  - `video_url`
  - `thinking`
- `packages/model-runtime/src/core/contextBuilders/google.ts` only converts:
  - `text`
  - `image_url`
  - `video_url`

There is no `fileData` / PDF part path right now.

Conclusion:

- Even though Gemini / Vertex models are multimodal, current project integration is not using native PDF input
- Current PDF capability relies on parsing text first, then injecting prompt text

## Official SDK / product conclusion

Based on official Google / Vertex material:

- Vertex AI supports native document understanding with PDF
- In Node examples, this is passed as `fileData` with `fileUri`
- Vertex AI path uses `gs://...` style URIs
- `ai.files.upload()` is not the Vertex AI path

Implication:

- To use native PDF input on Vertex AI here, likely need a GCS-backed file URI flow
- Current private app URL / S3 URL flow is not enough for native Vertex PDF input

## GCS verification already completed

Using current `.env` credentials, the following was verified successfully:

- Vertex project available
- Service account auth works
- Bucket `lobechat-cotti` exists
- Bucket location is `US`
- Service account can list objects
- Service account can upload a test object
- Service account can read the object back
- Service account can delete the object

Verified service account:

- `comfyui-vertex-agent@cotti-coffee-462402.iam.gserviceaccount.com`

Verified bucket:

- `gs://lobechat-cotti`

Important:

- GCS connectivity is no longer the blocker

## What still needs to be done

### Phase 1. Prove native Vertex PDF input works end-to-end

Create a minimal standalone script that:

1. Reads current Vertex config from `.env`
2. Uses `@google/genai` with `vertexai: true`
3. Sends a test request with:
   - one text prompt
   - one PDF `fileData` part using a `gs://lobechat-cotti/...pdf` URI
4. Confirms model can answer based on PDF content

Reason:

- This removes product uncertainty before touching main business code

Suggested output of this step:

- A small script under `src/_custom/` or `scripts/`
- A short test report in `src/_custom/CHANGELOG.md` or a nearby note

### Phase 2. Decide integration scope

Need a product/engineering decision:

Option A:

- Only native-handle current chat uploaded PDFs

Option B:

- Native-handle current chat uploaded PDFs + agent selected files

Option C:

- Also redesign knowledge base path

Recommended:

- Start with A + B
- Keep knowledge base retrieval as-is for now

Reason:

- Knowledge base is a retrieval system, not a direct file transport system
- Mixing them now will increase scope too much

### Phase 3. Extend runtime message schema

Need to add a file part type into model runtime shared message schema.

Current gap:

- `UserMessageContentPart` has no file/PDF part

Likely work:

- Update `packages/model-runtime/src/types/chat.ts`
- Add a new content part, likely something like:
  - `type: 'file_url'`
  - or a provider-specific normalized file part

Design caution:

- Do not hardcode only PDF unless intentionally scoping it that way
- But for the first delivery, PDF-only may be acceptable if business target is clear

### Phase 4. Add Google/Vertex file part builder

Need to extend:

- `packages/model-runtime/src/core/contextBuilders/google.ts`

New behavior:

- When provider is Vertex and part is native file input, build Google `Part.fileData`
- Use `mimeType: application/pdf`
- Use `fileUri: gs://...`

Need to decide:

- Whether this path should be gated by provider only
- Whether to fall back to current text injection if native file URI is unavailable

Recommended:

- Use fallback

Reason:

- Safer rollout
- Prevent regression if GCS sync fails

### Phase 5. Build GCS sync path for files

Need a custom flow to turn existing app files into GCS objects usable by Vertex.

Current system stores user files in app file storage / S3-compatible storage, not GCS.

Need to implement:

1. For target PDFs, create or reuse a GCS object path
2. Upload/copy file bytes into `gs://lobechat-cotti/...`
3. Persist mapping if needed to avoid repeated uploads
4. Generate native file content part from that GCS URI

Likely design choices:

- Store mapping in metadata or a custom table
- Or start with on-demand upload without persistence for first version

Recommended first version:

- On-demand upload with deterministic object key
- Reuse if object already exists

### Phase 6. Wire the two business paths

#### 6A. Current chat uploaded files

When message includes uploaded PDF:

- If provider is `vertexai`
- And file is PDF
- And GCS sync succeeds

Then:

- send native `fileData` part

Else:

- keep existing parsed-text injection path

#### 6B. Agent selected "关联文件"

When runtime builds agent file knowledge:

- For Vertex + PDF files, consider native file part path
- For others, keep current `knowledge.fileContents`

Important:

- Avoid breaking existing non-PDF files
- Avoid removing current text-injection fallback until native path is proven stable

### Phase 7. Keep knowledge base path unchanged for now

Do not rewrite knowledge base path in the first iteration.

Reason:

- Knowledge base currently means retrieval/chunk search
- Native PDF transport does not replace semantic retrieval
- This is a different product behavior

## Recommended implementation order

1. Add a minimal standalone Vertex PDF proof script
2. Verify one real PDF can be answered from `gs://lobechat-cotti/...`
3. Add normalized file part type to model runtime schema
4. Add Google/Vertex `fileData` builder
5. Add GCS sync utility
6. Wire current chat uploaded PDFs
7. Verify no regression
8. Wire agent selected PDFs
9. Verify again
10. Leave knowledge base retrieval unchanged

## Exact files that likely need changes next

Very likely:

- `packages/model-runtime/src/types/chat.ts`
- `packages/model-runtime/src/core/contextBuilders/google.ts`
- `packages/model-runtime/src/providers/google/index.ts`
- `packages/model-runtime/src/providers/vertexai/index.ts`

Likely custom/business-side files:

- `src/server/modules/AgentRuntime/RuntimeExecutors.ts`
- `src/server/modules/Mecha/ContextEngineering/index.ts`
- `src/store/file/slices/chat/action.ts` only if UI state or flow gating must change

Possibly new helper/service files:

- a custom GCS upload helper under `src/_custom/` or suitable server service path
- a temporary proof script under `src/_custom/` or `scripts/`

## Constraints and rules for future work

- This repo is being developed in an injection-style/custom manner
- Prefer minimal invasive changes
- Record exceptions in `src/_custom/CHANGELOG.md`
- Do not remove existing text parsing fallback too early
- Do not treat knowledge base retrieval as equivalent to file direct reading

## Suggested prompt for the next session

Use this file as the working context and continue from here.

High-priority task:

- Implement and run a minimal proof-of-concept that uses current Vertex credentials and bucket `gs://lobechat-cotti` to send one PDF to Gemini through native `fileData` input, without changing main business flow yet.

After that:

- Propose the smallest-change production integration plan for:
  - current chat uploaded PDF files
  - agent selected related files
- Keep knowledge base retrieval unchanged in v1
