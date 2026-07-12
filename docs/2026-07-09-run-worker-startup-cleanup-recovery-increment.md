# 灵办词元 Run Worker 启动恢复补齐说明（2026-07-09）

## 1. 本次交付目标

补齐 `app/run-worker` 在 BullMQ daemon 启动恢复链路中的 `schedule-cleanup` 执行动作，使终态 run 在 worker 重启后不会只被识别而不被清理。

## 2. 本次实际交付

| 项目 | 交付内容 |
|---|---|
| 启动恢复动作 | `recoverBullmqRunWorkerState()` 已从仅处理 `enqueue-start` / `mark-orphan-failed` 扩展为同时处理 `schedule-cleanup` |
| 清理补投策略 | 对终态 run 计算剩余 TTL 后补投 `run.cleanup`；优先使用 `snapshot.runtime.finishedAt`，缺失时回退到 `snapshot.run.updatedAt` |
| 恢复摘要 | `WorkerRecoverySummary` 新增 `scheduledCleanups` |
| 运维指标 | `WorkerDaemonMetrics` 新增 `recoveryScheduledCleanupsTotal`，`/metrics` 已补齐 `lingban_run_worker_recovery_action_total{action=\"schedule-cleanup\"}` |

## 3. 新增验证

| 测试文件 | 覆盖点 |
|---|---|
| `app/run-worker/tests/daemon-processor.test.mjs` | worker 启动恢复对 `schedule-cleanup` 的处理、剩余 TTL 计算、`run.cleanup` 补投 |
| `app/run-worker/tests/ops-http.test.mjs` | 运维面 metrics 暴露 `schedule-cleanup` 恢复动作计数 |

## 4. 当前验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/run-worker build` | 通过 |
| `pnpm -C app/run-worker test` | 通过，`16/16` |

## 5. 仍未完成的能力

| 类别 | 当前缺口 |
|---|---|
| 平台化部署 | Redis 正式部署、跨节点治理、自动补偿与重试编排未完成 |
| 真容器验收 | Docker daemon 实机联调与长时间运行证据未闭环 |
| 更深恢复 | 跨宿主机迁移、checkpoint、长任务断点恢复未落地 |

## 6. 影响范围

- `app/run-worker/src/daemon.ts`
- `app/run-worker/src/observability.ts`
- `app/run-worker/tests/daemon-processor.test.mjs`
- `app/run-worker/tests/ops-http.test.mjs`
