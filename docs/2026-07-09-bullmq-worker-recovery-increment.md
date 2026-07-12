# 2026-07-09 BullMQ Worker 重启恢复增量说明

## 本次目标

补齐 `BullMQ + run-worker` 模式下的重启恢复链路，解决以下问题：

1. `run-worker` 进程重启后，缺少针对未完成 `run` 的恢复扫描入口。
2. `run.start` 作业因 worker 崩溃、stalled retry 或重复投递再次执行时，可能重复拉起 runtime。
3. API 侧虽然具备启动恢复与 orphan grace 逻辑，但 worker 侧缺少独立恢复能力，无法覆盖“API 未重启、worker 单独重启”的场景。

## 已落地内容

### 1. 内部恢复读模型

新增内部恢复候选契约：

- `runRuntimeRecoveryActionSchema`
- `runRuntimeRecoveryBridgeStateSchema`
- `runRuntimeRecoveryCandidateSchema`
- `runRuntimeRecoveryListSchema`

动作枚举：

- `enqueue-start`
- `await-bridge`
- `mark-orphan-failed`
- `schedule-cleanup`
- `ignore`

恢复候选对象包含：

- `snapshot`
- `bridge.registered / controllerAttached / connectedAt`
- `action`
- `reason`
- `startJob`

### 2. API 内部恢复接口

新增内部接口：

- `GET /internal/runs/recovery`
- `GET /internal/runs/:runId/recovery`

职责：

1. 将运行状态与 `bridgeRegistry` 状态统一投影为恢复候选。
2. 对 worker 暴露明确的恢复动作，避免 worker 自己拼接状态判断。
3. 为启动恢复与重复作业防重提供统一判定面。

### 3. RunsService 恢复判定逻辑

新增：

- `runsService.getRuntimeRecoveryCandidate(runId)`
- `runsService.listRuntimeRecoveryCandidates()`

当前判定规则：

| Run 状态 | Bridge 状态 | 恢复动作 |
|---|---|---|
| `CREATED / READY / QUEUED / STARTING` | 无活跃 bridge | `enqueue-start` |
| `CREATED / READY / QUEUED / STARTING` | 有活跃 bridge | `await-bridge` |
| `RUNNING / WAITING_APPROVAL` | 有活跃 bridge | `await-bridge` |
| `RUNNING / WAITING_APPROVAL` | 无活跃 bridge | `mark-orphan-failed` |
| `SUCCEEDED / FAILED / CANCELLED` | 任意 | `schedule-cleanup` |

### 4. Worker 启动恢复

在 `BullmqRunWorkerDaemon.start()` 中新增恢复扫描：

1. 创建 `run.start` queue handle。
2. 拉取 API 恢复候选列表。
3. 对 `enqueue-start` 候选重新入队。
4. 对 `mark-orphan-failed` 候选写回终态失败并安排清理。

恢复辅助函数：

- `recoverBullmqRunWorkerState()`
- `postRecoveryTerminalFailure()`

### 5. run.start 作业重复执行防重

在 `processBullmqRunStartPayload()` 中新增恢复感知逻辑：

1. 启动前先查询单 run 恢复候选。
2. `await-bridge` 时直接跳过，不重复拉起 runtime。
3. `mark-orphan-failed` 时直接写回失败，不继续启动。
4. `schedule-cleanup` 或终态时直接安排清理。
5. 在预处理完成、真正启动 runtime 前再次查询恢复候选，避免并发窗口内的重复启动。

这一步解决了 stalled retry / worker crash 后的重复 runtime 拉起风险。

## 涉及文件

### 契约层

- `packages/contracts/src/bridge.ts`

### API

- `app/api/src/modules/bridge/routes.ts`
- `app/api/src/modules/runs/service.ts`
- `app/api/tests/runtime-recovery-internal.smoke.test.mjs`
- `app/api/package.json`

### Worker / Bridge

- `app/container-bridge/src/transports/api-connector.ts`
- `app/container-bridge/tests/api-connector.test.mjs`
- `app/run-worker/src/daemon.ts`
- `app/run-worker/tests/daemon-processor.test.mjs`

## 验证结果

### run-worker

命令：

```bash
pnpm -C app/run-worker test
```

结果：

- `12/12` 通过

新增覆盖点：

- 重复恢复启动时跳过活跃 bridge
- orphan recovery 失败写回
- worker 启动恢复时重入队与 orphan 失败处理

### container-bridge

命令：

```bash
pnpm -C app/container-bridge test
```

结果：

- `6/6` 通过

新增覆盖点：

- `getRunRecoveryCandidate()`
- `listRunRecoveryCandidates()`

### backend smoke

命令：

```bash
pnpm -C app/api test:smoke
```

结果：

- `18/18` 通过

新增覆盖点：

- `internal runtime recovery endpoints expose startable, active-bridge, and orphaned runs`

## 当前收益

1. `run-worker` 已具备启动时主动恢复能力。
2. `run.start` 作业具备恢复感知，重复投递不会直接重复拉起 runtime。
3. API 与 worker 对恢复判定的输入面已标准化，可继续向多 worker / 真容器场景扩展。

## 仍未完成的后续项

1. Docker daemon 真机联调与容器存活态恢复。
2. 多 worker 并发恢复下的更强原子性控制。
3. 恢复动作的审计事件与观测指标。
4. DLQ 回放、人工干预与运维面板。
5. `bridgeRegistry` 从纯内存态向可恢复注册表演进。
