# 灵办词元 Run Worker Retry / DLQ 增量说明（2026-07-09）

## 1. 本次目标

补齐 `agent-workshop-run-worker` 在 BullMQ 生产调度侧的关键缺口：

- 队列级 retry / backoff 配置
- `run.start` / `run.cleanup` 独立 DLQ
- `run.start` 最终失败后的 API 终态回写
- 最终失败后的 workspace 延迟回收触发

## 2. 本次改动

| 类别 | 文件 | 改动内容 | 作用 |
|---|---|---|---|
| 配置扩展 | `packages/config/src/index.ts` | 为 worker runtime 新增 `runStartDlqQueueName / runCleanupDlqQueueName / runStartJobAttempts / runStartJobBackoffMs / runCleanupJobAttempts / runCleanupJobBackoffMs` | 让 retry / DLQ 从硬编码变成显式运行配置 |
| 队列层 | `app/run-worker/src/queue.ts` | 为 `run.start` / `run.cleanup` 默认注入 attempts + exponential backoff；新增 `run.start.dlq` / `run.cleanup.dlq` queue creator 与 dead-letter record 类型 | 形成正式的失败沉淀层 |
| 失败处理 | `app/run-worker/src/daemon.ts` | 新增最终失败判断、dead-letter record 构造、DLQ 入队、`postTerminalFailure()`、`syncRunRuntime(finishedAt)` 和 cleanup 调度 | 避免 start job 耗尽后 run 长时间悬空在非终态 |
| 包导出 | `app/run-worker/src/index.ts` | 导出 DLQ queue / record 能力 | 方便其他仓库与测试消费 |
| 环境示例 | `app/run-worker/.env.example`、根 `.env.example` | 补齐新配置项 | 让部署模板和本地运行模板可直接使用 |
| 验证 | `app/run-worker/tests/daemon-processor.test.mjs` | 新增 non-final retry、final start failure、final cleanup failure 三组测试 | 证明 retry / DLQ 行为已被自动化验证 |

## 3. 新增配置项

| 变量 | 默认值 | 含义 |
|---|---:|---|
| `LINGBAN_RUNTIME_START_DLQ_QUEUE_NAME` | `run.start.dlq` | start job 死信队列名 |
| `LINGBAN_RUNTIME_CLEANUP_DLQ_QUEUE_NAME` | `run.cleanup.dlq` | cleanup job 死信队列名 |
| `LINGBAN_RUNTIME_START_JOB_ATTEMPTS` | `3` | start job 最大尝试次数 |
| `LINGBAN_RUNTIME_START_JOB_BACKOFF_MS` | `2000` | start job 指数退避初始延迟 |
| `LINGBAN_RUNTIME_CLEANUP_JOB_ATTEMPTS` | `5` | cleanup job 最大尝试次数 |
| `LINGBAN_RUNTIME_CLEANUP_JOB_BACKOFF_MS` | `5000` | cleanup job 指数退避初始延迟 |

## 4. 当前行为

| 场景 | 当前行为 |
|---|---|
| `run.start` 中途失败，仍有剩余 attempts | BullMQ 自动按指数退避重试，不写 DLQ，不提前写终态 |
| `run.start` 耗尽全部 attempts | 写入 `run.start.dlq`；调用 API 将 run 标记为 `FAILED`；回写 `runtime.finishedAt`；调度 workspace cleanup |
| `run.cleanup` 中途失败，仍有剩余 attempts | BullMQ 自动按指数退避重试 |
| `run.cleanup` 耗尽全部 attempts | 写入 `run.cleanup.dlq`，保留现场供人工处理 |

## 5. 验证结果

| 验证项 | 结果 |
|---|---|
| `pnpm -C app/run-worker test` | 通过，`9/9` |
| `pnpm build:backend` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`17/17` |

## 6. 对仓库状态的影响

| 仓库 | 影响 |
|---|---|
| `agent-workshop-run-worker` | 生产调度能力明显提升，已不再只有基础队列消费 |
| `agent-workshop-backend` | 当外部 worker 模式下 `run.start` 最终失败时，API 能收到正式终态回写 |
| `agent-workshop-sdk` | 间接受益，bridge/runtime 失败不再只靠日志暴露，失败 run 会进入正式终态 |

## 7. 当前结论

| 维度 | 结论 |
|---|---|
| Retry 能力 | 已落地 |
| DLQ 能力 | 已落地 |
| 最终失败回写 | 已落地 |
| 生产交付度 | 明显提升 |

## 8. 仍未完成项

| 类别 | 未完成内容 |
|---|---|
| Redis 正式部署 | 当前仍是代码与本地配置层完成，未做生产 Redis 拓扑验证 |
| 真容器链 | Docker daemon 当前不可用，尚未做真实容器模式 E2E |
| 运行态恢复 | worker 进程重启后的 active runtime 重建与 orphan 处理仍需继续建设 |
