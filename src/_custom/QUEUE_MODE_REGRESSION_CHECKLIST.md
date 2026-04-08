# Queue Mode 回归清单

适用分支：`upgrade/v2.1.47-custom-rebase`

当前 dev 环境已开启：

```env
AGENT_RUNTIME_MODE=queue
QSTASH_URL=http://host.docker.internal:8181
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
REDIS_URL=...
```

## 这次开关实际影响的功能

### 1. Agent Runtime 队列执行

- 开启后，异步 step 调度从本地 `setTimeout` 切到 `QStashQueueServiceImpl`
- 关键代码：
  - `src/server/services/queue/impls/index.ts`
  - `src/server/services/queue/impls/local.ts`
  - `src/server/services/queue/impls/qstash.ts`

### 2. Agent Runtime 状态与事件总线

- 开启后，`AgentStateManager` 强制依赖 Redis
- `StreamEventManager` 也要求 Redis 可用
- 关键代码：
  - `src/server/modules/AgentRuntime/factory.ts`
  - `src/server/modules/AgentRuntime/redis.ts`

### 3. Hook / Webhook 派发

- local 模式：内存 handler 直接调用
- queue 模式：改成 webhook 交付，可走 `fetch` 或 `qstash`
- 关键代码：
  - `src/server/services/agentRuntime/hooks/HookDispatcher.ts`

### 4. Bot / 飞书类桥接消息

- queue 模式下，bot 首次回复与最终完成消息不再完全依赖单进程内存回调
- cleanup、typing、reaction 的归属时机会变化
- 关键代码：
  - `src/server/services/bot/AgentBridgeService.ts`
  - `src/app/(backend)/api/agent/webhooks/bot-callback/route.ts`

### 5. Group Agent / SubAgent 状态查询

- queue 模式下，step callbacks 无法像 local 模式那样驻留在同一个服务实例
- 当前代码通过轮询 Redis 状态补 Thread metadata
- 关键代码：
  - `src/server/routers/lambda/aiAgent.ts`

## 不要误判成 queue 影响的功能

- 普通登录流程
- 普通聊天首 token 速度
- 数据库 schema / migration
- memory workflow 的基础 QStash 能力

说明：

- `memory-user-memory` 这类 workflow 本来就直接依赖 `QSTASH_*`
- 它不是这次 `AGENT_RUNTIME_MODE=queue` 才新增的

## 建议必测项

### A. 普通 Agent 多步执行

目标：

- 能正常创建会话
- SSE 还能收到过程事件
- 最终消息能正常落库

操作：

1. 创建一个会触发多轮思考或工具调用的 Agent
2. 发送一条明确需要多步执行的请求
3. 观察是否出现“启动失败”“一直转圈”“消息停在 loading”

关注点：

- 前端不能出现 `Agent operation failed to start`
- 后端不能出现 `QSTASH_TOKEN is required`
- Redis 不应报连接错误

### B. Group Agent / SubAgent

目标：

- 子任务状态能正常推进
- 轮询状态不会一直卡在 processing

操作：

1. 进入 Group Agent 场景
2. 触发一个会产生子任务的请求
3. 观察线程状态是否能从 processing 收敛到 completed / failed

关注点：

- Thread metadata 是否更新
- 不应长期停留在“处理中但无输出”

### C. Bot / 飞书会话

目标：

- mention 能触发
- follow-up message 能继续沿用 thread / topic
- 最终回复与 typing cleanup 正常

操作：

1. 通过飞书或 bot 桥接入口触发一次新对话
2. 再发一条 follow-up
3. 观察 reaction、typing、最终消息、topic 续写是否正常

关注点：

- 不应只出现开始提示而没有最终回复
- 不应出现 callback 鉴权失败
- 不应出现 APP_URL / INTERNAL_APP_URL 配置错误

### D. Hook / Webhook

目标：

- queue 模式下 hook 改走 webhook 交付仍能执行

操作：

1. 触发带 step/completion webhook 的 Agent 执行
2. 观察 webhook 接收端是否拿到回调

关注点：

- `bot-callback` / `api/agent` / `api/agent/run` 不应返回 401
- 签名校验不应失败

### E. 异常回退

目标：

- 当 QStash 不可用时，前端与数据库错误表现可理解

操作：

1. 临时停掉本地 QStash
2. 发起一次新的 Agent 执行
3. 观察前端错误和 assistant message 的 error 落库

关注点：

- 应出现“failed to start”一类明确错误
- 不应直接吞错

## 当前已验证的代码级测试

已通过：

- `src/server/services/queue/__tests__/QueueService.test.ts`
- `src/server/modules/AgentRuntime/__tests__/factory.test.ts`
- `src/server/services/agentRuntime/hooks/__tests__/HookDispatcher.test.ts`
- `src/server/services/bot/__tests__/AgentBridgeService.test.ts`

## 当前已知限制

### 1. TaskScheduler 还没有完整 QStash 实现

- `src/server/services/taskScheduler/impls/index.ts` 里仍是 `TODO`
- 所以这次开启 queue，不等于全站所有异步调度都完全改成 QStash

### 2. 本地 QStash 是开发态

- 仅适合 dev 联调
- 生产仍应切正式 Upstash QStash 凭据

## 回退方式

如果要关闭 queue 模式：

1. 删除或注释 `docker-compose/deploy/.env` 中的 `AGENT_RUNTIME_MODE=queue`
2. 重建容器：

```bash
docker compose -f docker-compose/deploy/docker-compose.yml up -d lobe
```

关闭后预期行为：

- 队列执行回退到 `LocalQueueServiceImpl`
- Hook 回到本地内存 callback 模式
- 代码仍可运行，但运行语义不再接近生产
