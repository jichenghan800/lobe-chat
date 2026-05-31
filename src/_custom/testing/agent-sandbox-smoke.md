# Agent Sandbox Smoke Test

Date: 2026-05-31

Environment:

- URL: `https://chatdev.cotticoffee.com/agent/agt_4qC5zJhhJIbi`
- Topic: `tpc_gYdAOvcE6WvO`
- Agent mode: `智能`
- Model during this run: `Claude` (`claude-opus-4-7`)
- Approval mode: `自动批准`

## Code Understanding

Relevant implementation points checked before the UI run:

- `src/server/modules/Mecha/AgentToolsEngine/index.ts`
  - Web runtime defaults to `none` when `chatConfig.runtimeEnv.runtimeMode.web` is not set.
  - In agent mode, `lobe-cloud-sandbox` is enabled only when `runtimeMode === 'cloud'`.
  - `lobe-skills`, `lobe-skill-store`, and `lobe-activator` are always-on agent tools.
- `packages/builtin-tool-skills/src/systemRole.ts`
  - `runCommand` and `execScript` are documented as Skill operations that execute in cloud sandbox.
- `src/server/services/toolExecution/serverRuntimes/skills.ts`
  - Skill `runCommand` and `execScript` call Market built-in tools through `market.plugins.runBuildInTool(...)`.

Interpretation:

- `运行环境 = 云端沙箱` exposes the direct `lobe-cloud-sandbox` tool path.
- `运行环境 = 关闭` disables the direct cloud sandbox tool path.
- `运行环境 = 关闭` does not disable Skill runtime execution; Skill `runCommand` can still call the sandbox backend through the Skill/Market route.

## Test Cases

| ID | Setup | Prompt | Expected | 2026-05-31 Result |
| --- | --- | --- | --- | --- |
| A | `智能` + `关闭` | `Agent 沙箱测试 A：当前运行环境应为关闭。请不要调用任何工具...最后只输出“基线完成”。` | No tool card. Normal assistant reply. | Pass. No tool card appeared. Reply included `基线完成`. Network created the topic through `POST /trpc/lambda/aiChat.sendMessageInServer` and later used normal chat completion. |
| B | `智能` + `云端沙箱` | `请调用云端沙箱执行... print('sandbox-cloud-ok', 21*2)` | Direct cloud sandbox tool card should appear and execute, or show a clear authorization failure. | Initial run blocked by Market authorization. After the user completed community profile authorization, pass. Tool card appeared as `执行代码: 执行最简 Python 验证沙箱`; Network `POST /trpc/tools/market.execInSandbox` returned 200 with `toolName: executeCode`; output was `sandbox-cloud-ok 42`. |
| C | `智能` + `关闭` | `请不要使用云端沙箱工具；请通过 Skill 能力执行... echo skill-sandbox-ok && pwd` | Direct cloud sandbox should remain off, but Skill command path may still attempt sandbox execution. | Initial run blocked by Market authorization, but path was verified. After the user completed community profile authorization, pass. Runtime stayed `关闭`; tool card appeared as `执行命令: 执行最简 shell 命令验证 Skill 运行环境`; Network `POST /trpc/tools/market.execInSandbox` returned 200 with `toolName: runCommand`; stdout was `skill-sandbox-ok` and `/workspace`. |

## Evidence Files

Temporary Chrome DevTools captures saved during the run:

- `/tmp/agent-sandbox-A-send.network-request`
- `/tmp/agent-sandbox-A-send.network-response`
- `/tmp/agent-sandbox-B-exec.network-request`
- `/tmp/agent-sandbox-B-exec.network-response`
- `/tmp/agent-sandbox-C-skill.network-request`
- `/tmp/agent-sandbox-C-skill.network-response`
- `/tmp/agent-sandbox-B-success.network-request`
- `/tmp/agent-sandbox-B-success.network-response`
- `/tmp/agent-sandbox-C-success.network-request`
- `/tmp/agent-sandbox-C-success.network-response`

Key request excerpts:

- Test B direct cloud sandbox:
  - `toolName: executeCode`
  - `params.code: print('sandbox-cloud-ok', 21*2)`
  - `path: market.execInSandbox`
  - `httpStatus: 401`
- Test C closed runtime + Skill sandbox:
  - `toolName: runCommand`
  - `params.command: echo skill-sandbox-ok && pwd`
  - `path: market.execInSandbox`
  - `httpStatus: 401`
- Test B post-authorization direct cloud sandbox:
  - `toolName: executeCode`
  - `params.code: print('sandbox-cloud-ok', 21*2)`
  - `path: market.execInSandbox`
  - `httpStatus: 200`
  - `output: sandbox-cloud-ok 42`
- Test C post-authorization closed runtime + Skill sandbox:
  - `toolName: runCommand`
  - `params.command: echo skill-sandbox-ok && pwd`
  - `path: market.execInSandbox`
  - `httpStatus: 200`
  - `stdout: skill-sandbox-ok\n/workspace`

## Current Conclusion

- The UI and code agree on the three sandbox behaviors.
- Closed runtime does not expose the direct cloud sandbox, but Skill command execution still routes to the sandbox backend.
- Market/community authorization is a required prerequisite for both direct cloud sandbox and Skill sandbox execution.
- After authorization, both direct cloud sandbox and closed-runtime Skill sandbox execution returned successful outputs.

## Re-run Checklist

1. Set `智能` + `云端沙箱`; run a Python `executeCode` prompt; expect stdout `sandbox-cloud-ok 42`.
2. Set `智能` + `关闭`; run a Skill `runCommand` prompt; expect stdout containing `skill-sandbox-ok` and `/workspace`.
3. Confirm both requests return 200 on `POST /trpc/tools/market.execInSandbox`.
