# 2026-07-09 Run Worker Ops Observability Increment

## 1. 目标

补齐 `app/run-worker` 的本地运维面，使 BullMQ worker daemon 具备生产调试必需的探活、就绪性、诊断与指标导出能力。

| 目标 | 结果 |
|---|---|
| 暴露 daemon 存活探针 | 已新增 `/health` |
| 暴露队列组件就绪探针 | 已新增 `/readyz` |
| 暴露 worker 诊断快照 | 已新增 `/diagnostics` |
| 暴露 Prometheus 指标文本 | 已新增 `/metrics` |
| 记录 recovery / DLQ / active runs / queue component 状态 | 已落地 |
| 接入全局 BullMQ QueueEvents | 已落地 |

## 2. 变更范围

| 文件 | 变更 |
|---|---|
| `packages/config/src/index.ts` | 新增 `LINGBAN_WORKER_OPS_HOST`、`LINGBAN_WORKER_OPS_PORT`、`LINGBAN_WORKER_OPS_TOKEN`、`LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS` |
| `app/run-worker/src/observability.ts` | 新增 worker diagnostics/readiness 类型、Redis 地址脱敏、Prometheus 指标构建器 |
| `app/run-worker/src/ops-http.ts` | 新增 worker ops HTTP server |
| `app/run-worker/src/daemon.ts` | 新增 daemon 级 metrics、recovery summary、DLQ 写入计数、active runs 跟踪、就绪探测与 diagnostics 输出 |
| `app/run-worker/src/queue-event-telemetry.ts` | 新增 BullMQ 全局 queue event 计数与最近事件快照 |
| `app/run-worker/src/queue.ts` | 新增 start/cleanup QueueEvents 工厂 |
| `app/run-worker/src/index.ts` | 导出 ops server 与 observability helper |
| `app/run-worker/.env.example` | 新增 worker ops 配置示例 |
| `app/run-worker/tests/ops-http.test.mjs` | 新增 ops 面测试 |
| `app/run-worker/tests/queue-event-telemetry.test.mjs` | 新增 queue event telemetry 测试 |
| `app/run-worker/package.json` | 将新测试纳入 `pnpm test` |

## 3. 新增能力

### 3.1 本地运维接口

| 路径 | 说明 | 鉴权 |
|---|---|---|
| `GET /health` | 进程存活探针 | 无 |
| `GET /readyz` | 队列与 worker 组件 readiness 探针 | 无 |
| `GET /diagnostics` | daemon 运行态、active runs、recovery、DLQ 统计 | `x-lingban-worker-ops-token` |
| `GET /metrics` | Prometheus 0.0.4 文本指标 | `x-lingban-worker-ops-token` |

### 3.2 Diagnostics 覆盖面

`/diagnostics` 已覆盖：

| 维度 | 字段 |
|---|---|
| daemon 生命周期 | `started`、`startedAt`、`stopping`、`stoppedAt` |
| 调度模式 | `dispatchMode`、`launchMode`、`maxConcurrentRuns` |
| Redis | `redisConfigured`、脱敏后的 `redisEndpoint` |
| 队列组件 | start/cleanup/startDlq/cleanupDlq queue、QueueEvents 与 worker 初始化状态 |
| QueueEvents | start/cleanup 队列的 added/active/completed/failed/stalled/delayed/waiting/drained/error 计数与最近事件 |
| active runs | `activeRunsCount`、`activeRunIds` |
| recovery | `lastRecoverySummary`、最近 recovery 时间、最近 recovery 错误 |
| start/cleanup 作业 | 最近 runId、开始/结束时间、最近错误 |
| 累计指标 | start job / cleanup job / DLQ / recovery / runtime handle / cleanup schedule 计数 |

### 3.3 Readiness 语义

`/readyz` 会对以下组件逐个执行 `waitUntilReady()` 探测，并受 `LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS` 控制：

- `startQueue`
- `cleanupQueue`
- `startWorker`
- `cleanupWorker`
- `startDlqQueue`
- `cleanupDlqQueue`
- `startQueueEvents`
- `cleanupQueueEvents`

只要任一组件未初始化、超时或探测失败，状态即返回 `503 not_ready`。

### 3.4 指标覆盖面

当前已导出：

| 指标前缀 | 含义 |
|---|---|
| `lingban_run_worker_up` | daemon 是否已启动且未进入 stopping |
| `lingban_run_worker_ready` | readiness 状态 |
| `lingban_run_worker_active_runs` | 当前 active runtime handle 数 |
| `lingban_run_worker_start_jobs_*` | start job 处理计数 |
| `lingban_run_worker_cleanup_jobs_*` | cleanup job 处理计数 |
| `lingban_run_worker_dlq_writes_total` | DLQ 写入计数 |
| `lingban_run_worker_recovery_*` | recovery 执行与 action 计数 |
| `lingban_run_worker_runtime_handles_total` | runtime handle 启停计数 |
| `lingban_run_worker_workspace_cleanup_total` | cleanup schedule 结果计数 |
| `lingban_run_worker_component_started` | 组件是否初始化 |
| `lingban_run_worker_component_ready` | 组件 readiness |
| `lingban_run_worker_queue_events_total` | BullMQ 全局 queue events 计数 |

## 4. 验证证据

本次实际执行并通过：

```bash
pnpm -C app/run-worker build
pnpm -C app/run-worker test
pnpm -C app/api build
pnpm -C app/container-bridge test
```

| 命令 | 结果 |
|---|---|
| `pnpm -C app/run-worker build` | 通过 |
| `pnpm -C app/run-worker test` | `14/14` 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/container-bridge test` | `7/7` 通过 |

## 5. 当前仍未闭环事项

| 事项 | 说明 |
|---|---|
| Redis 正式部署 | 当前仍是配置与代码闭环，缺生产 Redis 运维 |
| Docker daemon 实机联调 | 仍需真实宿主机/容器联调 |
| worker 重启后的运行态恢复增强 | 目前已有 recovery summary、action 统计和 QueueEvents 观测，仍缺更完整补偿和跨节点语义 |
| 平台级监控接线 | 指标已生成，Prometheus / OTel / 告警平台未接入 |
