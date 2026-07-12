# 2026-07-09 API Runtime Diagnostics Aggregation Increment

## 1. 目标

补齐 `app/api` 的平台级运行诊断聚合能力，使 API 不只暴露本地的 bridge registry / orchestrator / recovery 状态，还能拉取：

- worker daemon 的 `ops` 诊断面
- 已注册 bridge control endpoint 的远端运行诊断

同时把该能力接入：

- `/internal/runtime/diagnostics`
- `/readyz`
- `/internal/metrics`

## 2. 变更范围

| 文件 | 变更 |
|---|---|
| `packages/config/src/index.ts` | 为 API 增加 `LINGBAN_WORKER_OPS_BASE_URL`、`LINGBAN_WORKER_OPS_TOKEN`、`LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS`、`LINGBAN_BRIDGE_CONTROL_PROBE_TIMEOUT_MS` |
| `packages/contracts/src/bridge.ts` | 新增 `workerOpsRuntimeProbe`、`bridgeControlProbe`、`internalRuntimeDiagnosticsReport` 契约 |
| `app/api/src/app/runtime-diagnostics.ts` | 新增 API 侧运行诊断聚合器，负责 worker ops 与 bridge control 远端探测 |
| `app/api/src/app/ops.ts` | 将 worker ops 就绪性纳入 `/readyz` 依赖，并将平台级 probe 指标接入 `/internal/metrics` |
| `app/api/src/modules/bridge/routes.ts` | `/internal/runtime/diagnostics` 改为返回聚合后的诊断报告 |
| `app/api/.env.example` | 增加新的 probe 配置项 |
| `app/api/tests/internal-runtime-diagnostics.smoke.test.mjs` | 增补 fake worker ops / fake bridge control 远端诊断聚合覆盖 |
| `app/api/tests/readiness-metrics.smoke.test.mjs` | 增补 worker ops disabled 情况的 readiness / metrics 断言 |
| `app/api/tests/readiness-worker-ops.smoke.test.mjs` | 新增 worker ops 可达与不可达场景的就绪性退化测试 |
| `app/api/package.json` | 将新 smoke 测试纳入 `test:smoke` |

## 3. 新增能力

### 3.1 `/internal/runtime/diagnostics`

返回结构从本地诊断扩展为聚合诊断报告，新增：

| 字段 | 说明 |
|---|---|
| `workerOps` | API 对 worker 本地运维面的探测结果 |
| `bridgeControlProbes` | API 对已注册 bridge control endpoint 的远端诊断探测结果 |

### 3.2 `/readyz`

在原有 `database / objectStorage / bridgeRegistry / runtimeOrchestrator` 之外，新增：

| 依赖 | 语义 |
|---|---|
| `workerOps` | 当 `LINGBAN_WORKER_OPS_BASE_URL` 已配置时，API 会主动探测 worker `/diagnostics`；不可达或返回 `not_ready` 时，`/readyz` 返回 `503` |

### 3.3 `/internal/metrics`

新增：

| 指标 | 含义 |
|---|---|
| `lingban_worker_ops_configured` | API 是否已配置 worker ops 探测目标 |
| `lingban_worker_ops_ready` | 当前 worker ops 是否可用且返回 `ready` |
| `lingban_worker_ops_probe_duration_ms` | 最近一次 worker ops 探测耗时 |
| `lingban_bridge_control_configured_endpoints` | 当前 API 已知的 bridge control endpoint 数量 |

## 4. 设计说明

| 设计点 | 处理 |
|---|---|
| worker 探测入口 | 使用 API 显式配置的 `LINGBAN_WORKER_OPS_BASE_URL`，避免默认推断导致误报 |
| bridge 探测入口 | 直接消费 bridge register 时回写的 `control.baseUrl` 和 `authToken` |
| 指标开销控制 | `/internal/metrics` 只保留 worker probe 与 bridge endpoint 数量，不在 metrics 路径对所有 bridge 逐个 fan-out 远端探测 |
| 失败语义 | 远端超时、401、5xx、连接失败统一归为 `unreachable`，并保留错误消息 |

## 5. 验证证据

实际执行并通过：

```bash
pnpm -C packages/contracts build
pnpm -C app/api build
node --test app/api/tests/internal-runtime-diagnostics.smoke.test.mjs app/api/tests/readiness-metrics.smoke.test.mjs app/api/tests/readiness-worker-ops.smoke.test.mjs
pnpm -C app/run-worker test
pnpm -C app/container-bridge test
pnpm -C app/api test:smoke
```

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/contracts build` | 通过 |
| `pnpm -C app/api build` | 通过 |
| 定向 API smoke | `3/3` 通过 |
| `pnpm -C app/run-worker test` | `14/14` 通过 |
| `pnpm -C app/container-bridge test` | `7/7` 通过 |
| `pnpm -C app/api test:smoke` | `28/28` 通过 |

## 6. 当前仍未闭环事项

| 事项 | 说明 |
|---|---|
| Prometheus / OTel 平台接线 | 当前已输出文本指标，未接入正式采集与告警 |
| bridge remote probe 缓存 | 当前仍是按请求探测，尚未加入短 TTL 缓存与并发预算 |
| 跨节点聚合 | 当前为单 API 实例视角，未形成多实例聚合观测平面 |
