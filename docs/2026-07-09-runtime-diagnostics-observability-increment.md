# 2026-07-09 Runtime Diagnostics Observability Increment

## 1. 本次增量目标

补齐 `API / bridge registry / runtime orchestrator` 的正式诊断面，关闭此前多个增量中反复保留的观测缺口：

| 缺口 | 影响 |
|---|---|
| bridge registry 缺少正式指标与状态查询 | 无法判断当前注册量、挂起命令、stale sweep 是否生效 |
| runtime orchestrator 缺少运行态快照 | 无法快速排查 active / launching / queued / cleanup 状态 |
| recovery 只有明细接口，没有聚合摘要 | 运维视角无法快速知道当前待恢复 run 的分布 |
| `app/api build` 不会先构建 workspace 依赖 | 单仓构建容易出现假失败 |

## 2. 代码变更

### 2.1 Contracts

文件：`packages/contracts/src/bridge.ts`

新增内部诊断契约：

| Schema | 作用 |
|---|---|
| `bridgeRegistryConnectionDiagnosticsSchema` | 单 bridge 连接诊断视图 |
| `bridgeRegistryPersistenceErrorSchema` | 最近一次持久化错误快照 |
| `bridgeRegistryLastSweepSchema` | 最近一次 sweep 执行结果 |
| `bridgeRegistryMetricsSchema` | registry 累积指标 |
| `bridgeRegistryDiagnosticsSchema` | registry 总体诊断对象 |
| `runtimeOrchestratorDiagnosticsSchema` | orchestrator 运行态对象 |
| `runtimeRecoveryDiagnosticsSchema` | recovery 聚合摘要 |
| `internalRuntimeDiagnosticsSchema` | internal API 最终返回结构 |

### 2.2 Bridge Registry

文件：`app/api/src/modules/bridge/registry.ts`

新增正式诊断能力：

| 项 | 说明 |
|---|---|
| `getDiagnostics()` | 输出 registry 当前连接、挂起命令、stale candidate、持久化状态与 sweep 状态 |
| 累积指标计数 | `registrationsTotal`、`queuedCommandsTotal`、`staleEvictionsTotal`、`sweepRunsTotal` 等 |
| 持久化错误记录 | 记录最近一次 `save/delete` 错误的时间、操作与消息 |
| persistence pending 统计 | 可见当前是否仍有未刷盘任务 |

### 2.3 Runtime Orchestrator

文件：`app/api/src/modules/runs/runtime-orchestrator.ts`

新增：

| 方法 | 作用 |
|---|---|
| `getDiagnostics()` | 输出 dispatch mode、active/launching/scheduled/queued run 状态，以及 cleanup/orphan timer 计数 |

### 2.4 Runs Service 与 Internal Route

文件：

- `app/api/src/modules/runs/service.ts`
- `app/api/src/modules/bridge/routes.ts`

新增：

| 能力 | 说明 |
|---|---|
| `runsService.getInternalRuntimeDiagnostics()` | 聚合 bridge registry、orchestrator、recovery action summary |
| `GET /internal/runtime/diagnostics` | 正式 internal 诊断入口，受 `x-lingban-internal-token` 保护 |

### 2.5 API Build 脚本修正

文件：`app/api/package.json`

将 `build` 改为先构建依赖 workspace 包，再编译 API 本身。这样单独执行 `pnpm -C app/api build` 不再依赖外部预编译状态。

## 3. 诊断接口返回内容

`GET /internal/runtime/diagnostics`

| 顶层字段 | 内容 |
|---|---|
| `bridgeRegistry` | 当前 bridge registry 状态、连接列表、累积指标、最近 sweep、最近持久化错误 |
| `runtimeOrchestrator` | 当前 orchestrator 运行态、队列深度、active/launching/scheduled run 列表 |
| `recovery` | 当前 recovery candidate 总数，以及按 action 聚合的摘要 |

## 4. 测试补强

### 4.1 新增 smoke

文件：`app/api/tests/internal-runtime-diagnostics.smoke.test.mjs`

验证：

| 验证点 | 说明 |
|---|---|
| internal token 生效 | `/internal/runtime/diagnostics` 走 internal 鉴权链 |
| bridge registry 诊断对象可读 | registry 初始化状态、挂起命令、当前连接与指标均可读取 |
| orchestrator 诊断对象可读 | dispatch mode、queue state、timer state 可读取 |
| recovery 聚合摘要可读 | `enqueue-start` / `await-bridge` 等 action 计数可读取 |

### 4.2 增强现有 registry smoke

文件：`app/api/tests/bridge-registry-http-controller.smoke.test.mjs`

新增：

| 用例 | 说明 |
|---|---|
| `bridge registry diagnostics summarize pending commands and sweep state` | 验证 registry 诊断指标、sweep 状态与 pending command 摘要 |

## 5. 当前验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api test:smoke` | `26/26` 通过 |
| `pnpm -C app/container-bridge test` | `6/6` 通过 |
| `pnpm -C app/run-worker test` | `12/12` 通过 |

## 6. 本次关闭的具体问题

| 问题 | 当前状态 |
|---|---|
| bridge registry 无正式诊断对象 | 已关闭 |
| runtime orchestrator 无正式运行态查询 | 已关闭 |
| recovery 仅能逐 run 查询，无法聚合观察 | 已关闭 |
| `app/api build` 依赖预编译产物导致假失败 | 已关闭 |

## 7. 仍未完成项

| 类别 | 未完成内容 |
|---|---|
| 观测输出 | 当前为 internal diagnostics API，尚未接入 Prometheus/OpenTelemetry |
| 告警 | 持久化错误与 sweep 失败尚未接入告警通道 |
| Bridge 进程本地诊断 | container-bridge 自身仍缺更细颗粒 `/diagnostics` 输出 |
| 多实例聚合 | 当前 diagnostics 仍以单 API 实例视角为主 |
