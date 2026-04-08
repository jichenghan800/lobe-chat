# Queue Mode 验证结果

日期：`2026-04-08`

分支：`upgrade/v2.1.47-custom-rebase`

## 当前结论

当前 dev 环境已成功切到：

- `v2.1.47`
- `AGENT_RUNTIME_MODE=queue`
- `Redis + 本地 QStash dev server`

应用启动正常，容器日志中已不再出现缺少 `QSTASH_TOKEN` 的启动报错。
`dev bypass` 也已恢复兼容当前 `magic-link-only` 认证策略。
此前 queue smoke 中暴露的 “任务完成但 assistant 正文为空” 回归，已在代码层修复并补齐定向回归测试。

## 已验证通过

### 1. 运行环境切换

- 容器环境变量已确认：
  - `AGENT_RUNTIME_MODE=queue`
  - `QSTASH_URL=http://host.docker.internal:8181`
  - `QSTASH_TOKEN=...`
  - `QSTASH_CURRENT_SIGNING_KEY=...`
  - `QSTASH_NEXT_SIGNING_KEY=...`
- `http://127.0.0.1:3210/api/version` 返回 `2.1.47`
- `docker logs lobehub --tail 80` 启动正常

### 2. Queue / Runtime 基础测试

已通过：

- `src/server/services/queue/__tests__/QueueService.test.ts`
- `src/server/modules/AgentRuntime/__tests__/factory.test.ts`

覆盖点：

- `enableQueueAgentRuntime=true` 时走 `QStashQueueServiceImpl`
- `enableQueueAgentRuntime=false` 时回退 `LocalQueueServiceImpl`
- queue 模式下 Redis 缺失会报错

### 3. Hook / Bot queue 分支测试

已通过：

- `src/server/services/agentRuntime/hooks/__tests__/HookDispatcher.test.ts`
- `src/server/services/bot/__tests__/AgentBridgeService.test.ts`

覆盖点：

- local 模式与 queue 模式的 hook dispatch 分支
- bot bridge 在 queue 模式下的 cleanup /callback handoff 分支

### 4. Integration 测试

已通过：

- `src/server/routers/lambda/__tests__/integration/aiAgent.task.integration.test.ts`
- `src/server/routers/lambda/__tests__/integration/aiAgent/execAgent.integration.test.ts`

说明：

- `aiAgent.task.integration` 更贴近 queue 相关状态查询与任务生命周期
- `execAgent.integration` 证明主执行链路未被当前 queue 改造破坏
- 其中部分 case 标题仍为 `Local Async Mode`，不能把它误当成 queue 专属覆盖

### 5. Dev Bypass + Magic Link 联调链路

已通过：

- `GET https://chatdev.cotticoffee.com/api/dev/login` 携带 `x-dev-auth-token` 后返回 `307`
- 重定向地址已正确指向 `https://chatdev.cotticoffee.com/api/auth/magic-link/verify?...`
- `GET /api/auth/magic-link/verify?...` 返回 `302` 并成功下发 Better Auth session cookie
- 携带 cookie 请求首页返回 `200`

覆盖点：

- `dev bypass` 在 `AUTH_ENABLE_MAGIC_LINK=1` 时不再错误走 email/password
- 本机直连 `127.0.0.1:3210` 与真实域名访问时，magic link redirect host 均已归一到 `APP_URL`
- 旁路登录链路已恢复，可继续用于浏览器态联调

### 6. Queue 文本落库回归修复

已通过：

- `src/server/modules/AgentRuntime/__tests__/RuntimeExecutors.test.ts`
- `packages/model-runtime/src/core/streams/protocol.test.ts`

覆盖点：

- Gemini / Vertex 以 `content_part` 返回纯文本时，agent runtime 仍能正确累计 `content`
- Gemini / Vertex 以 `reasoning_part` 返回推理文本时，agent runtime 仍能正确累计 `reasoning`
- `onCompletion` / `onFinal` 聚合结果不再遗漏 `content_part` / `reasoning_part`

## 当前仍未做的人工验证

以下项建议由人工在页面或 bot 入口实际操作：

- 普通 Agent 多步执行
- Group Agent / SubAgent 实时状态推进
- 飞书 /bot 回调链路

参考清单：

- `src/_custom/QUEUE_MODE_REGRESSION_CHECKLIST.md`

## 当前已知限制

- `src/server/services/taskScheduler/impls/index.ts` 的 QStash 调度实现仍未完整落地，当前 `queue` 模式不等于所有后台调度都已完全 queue 化
- 构建期 `next build` 仍会打印 `QSTASH_TOKEN` 缺失警告；该警告来自 build-time env，不影响当前容器运行态已注入的 queue 配置

## 回退确认

当前开关仍可回退：

1. 删除 `docker-compose/deploy/.env` 中的 `AGENT_RUNTIME_MODE=queue`
2. 执行：

```bash
docker compose -f docker-compose/deploy/docker-compose.yml up -d lobe
```

预期：

- 队列回退到 `LocalQueueServiceImpl`
- 应用可继续运行
