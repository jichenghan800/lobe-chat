# 消息错误序列化：临时兼容补丁

日期：2026-09-19。基线：官方 v2.2.17（787e3d20aa）。

## 修改边界

- 唯一运行时代码锚点：`src/services/message/index.ts` 的 `MessageService.updateMessageError`。
- 将有类型的错误从直接传递 `value` 改为普通对象 `{ ...value, message: value.message, type: value.type }`，执行代码仅改一行。
- 官方 `ClientLLMTransport.createStreamExecutionError` 会生成带自定义字段的 `Error`。SuperJSON 对 Error 的特殊序列化不保留这些自定义字段，导致消息接口缺少必填 `error.type`，预算拦截后产生空白回复。
- 不修改预算公式、冻结条件、官方错误 schema、模型重试策略、UI 错误渲染或数据库 schema。原生链路保持不变，不另建错误处理系统，不全局修改 SuperJSON 配置。

## 回归与升级移除条件

- `src/services/message/server.test.ts` 中使用真实 `superjson.stringify/parse` 和 `ChatMessageErrorSchema` 校验：预算 Error 的 type/body.code/message 跨传输保留；普通错误的重试字段不变。
- 旧代码 1 项回归失败；修复后 7 项通过，lint / 全仓类型通过。
- 升级时先检查上述官方保存入口和 Error 构造链。若上游已把 Error 正规化为消息对象，或官方传输已可靠保留 type/body，先仅撤销本补丁的一行代码，保留回归测试运行；全部通过后移除兼容说明，并在本轮合并清单标记 “上游覆盖”。不把整份旧 message service 回填到新版。
- 单次历史空白消息修复仅在私有运维记录中保存；不将用户标识、授权令牌、导出附件、日志放入源码。
