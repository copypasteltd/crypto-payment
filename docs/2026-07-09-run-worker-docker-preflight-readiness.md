# 2026-07-09 Run Worker Docker Preflight & Readiness Increment

## 1. 目标

补齐 `app/run-worker` 在 Docker 启动链路中的 daemon 可用性预探测，并把 runtime backend 状态正式纳入 worker 的 readiness、diagnostics 与 metrics。

| 目标 | 结果 |
|---|---|
| run 启动前先验证 Docker daemon 可用性 | 已完成 |
| `/readyz` 纳入 runtime backend 健康判断 | 已完成 |
| `/diagnostics` 输出 Docker backend 诊断 | 已完成 |
| `/metrics` 输出 runtime backend 指标 | 已完成 |
| 为预探测和健康输出补齐自动化测试 | 已完成 |

## 2. 变更范围

| 文件 | 变更 |
|---|---|
| `app/run-worker/src/services/bridge-runner.ts` | 新增 `probeDockerDaemon()`，并在 `startDockerBridgeProcess()` 中于 `docker create` 前执行预探测 |
| `app/run-worker/src/daemon.ts` | 新增 runtime backend 探测缓存、readiness 接线、diagnostics 接线 |
| `app/run-worker/src/observability.ts` | 新增 `WorkerRuntimeBackendDiagnostics` 与 runtime backend 指标导出 |
| `app/run-worker/tests/bridge-runner.test.mjs` | 新增 daemon probe 成功与 fail-fast 用例，并更新 Docker 启动链测试 |
| `app/run-worker/tests/ops-http.test.mjs` | 新增 runtime backend diagnostics/metrics 断言 |

## 3. 行为变化

### 3.1 Docker 启动前置校验

当 `runtimeLaunchMode=docker` 时，worker 在创建容器前会先执行：

```bash
docker version --format "{{json .Server}}"
```

若 daemon 不可用，直接中止启动，并返回：

```text
Docker daemon is unavailable: <具体错误>
```

### 3.2 Readiness 语义扩展

`GET /readyz` 当前会同时检查：

1. `runtimeBackend`
2. `startQueue`
3. `cleanupQueue`
4. `startWorker`
5. `cleanupWorker`
6. `startDlqQueue`
7. `cleanupDlqQueue`
8. `startQueueEvents`
9. `cleanupQueueEvents`

只要 `runtimeBackend` 或任一队列组件未就绪，整体 readiness 即为 `503 not_ready`。

### 3.3 Diagnostics / Metrics 输出

新增 runtime backend 诊断字段：

| 字段 | 含义 |
|---|---|
| `backend` | 当前 backend 类型，`docker` 或 `local-process` |
| `ready` | backend 当前是否可用 |
| `checkedAt` | 最近探测时间 |
| `detail` | 人类可读诊断摘要 |
| `serverVersion` | Docker Server 版本 |
| `apiVersion` | Docker API 版本 |
| `os` | Docker Server OS |
| `experimental` | Docker experimental 标记 |

新增指标：

| 指标 | 含义 |
|---|---|
| `lingban_run_worker_runtime_backend_ready{backend=...}` | runtime backend 是否可用 |
| `lingban_run_worker_readiness_component_ready{component="runtimeBackend"}` | runtime backend 是否通过 readiness |

## 4. 验证证据

本次实际执行并通过：

```bash
pnpm -C app/run-worker test
```

| 命令 | 结果 |
|---|---|
| `pnpm -C app/run-worker test` | `16/16` 通过 |

新增覆盖点：

| 测试 | 覆盖内容 |
|---|---|
| `probeDockerDaemon parses server metadata from docker version` | probe 成功路径 |
| `startDockerBridgeProcess fails fast when docker daemon is unavailable` | daemon 不可用时阻断容器创建 |
| `WorkerOpsHttpServer exposes ... diagnostics, and metrics` | runtime backend diagnostics 与 metrics 输出 |

## 5. 当前仍未闭环事项

| 事项 | 说明 |
|---|---|
| 真机 Docker daemon 联调 | 代码侧已具备 preflight 与诊断，仍需真实宿主机证据 |
| Redis 正式部署 | worker 分布式运行仍依赖正式 Redis 环境 |
| 长时间运行观测 | 仍需补齐长稳压测、告警阈值与自动恢复证据 |
