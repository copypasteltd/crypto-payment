# 2026-07-09 Readiness Metrics Exporter Increment

## 1. 本次增量目标

在上一轮 `internal runtime diagnostics` 的基础上，补齐面向生产运维的两个正式出口：

| 能力 | 目标 |
|---|---|
| `readiness` 探针 | 给部署平台、反向代理和运维脚本一个可编排的就绪信号 |
| `metrics exporter` | 给 Prometheus / OTel Collector / 自研采集器提供稳定抓取入口 |

本次增量重点解决以下缺口：

| 缺口 | 影响 |
|---|---|
| API 只有最小 `/health` | 无法区分“进程活着”和“依赖已就绪” |
| bridge/runtime 诊断只有 JSON 接口 | 监控系统无法直接抓取为 gauge / counter |
| object store 与 database 无统一 readiness 检查 | 运维侧无法知道依赖是否真正可用 |
| `app/api build` 单仓执行仍依赖外部预编译顺序 | 本地与 CI 容易出现假失败 |

## 2. 代码变更

### 2.1 数据库 readiness 探测

文件：`app/api/src/app/database.ts`

新增：

| 方法 | 作用 |
|---|---|
| `isApiDatabaseEnabled()` | 判断当前是否启用 PostgreSQL-backed storage |
| `probeApiDatabaseReadiness()` | 在启用 PostgreSQL 时执行 `SELECT 1 AS ready` 探测 |

### 2.2 对象存储 readiness 探测

文件：`app/api/src/modules/uploads/object-store.ts`

新增 `ObjectStore.checkReadiness()`：

| 驱动 | 探测方式 |
|---|---|
| `filesystem` | `mkdir + access(R/W)` |
| `s3` | `HeadBucketCommand` |

### 2.3 统一运维聚合层

文件：`app/api/src/app/ops.ts`

新增：

| 方法 | 作用 |
|---|---|
| `buildApiReadinessReport()` | 聚合 database、object storage、bridge registry、runtime orchestrator 就绪状态 |
| `buildApiMetricsText()` | 输出 Prometheus 0.0.4 文本格式指标 |
| `isApiReady()` | readiness 快捷判断 |

### 2.4 新增路由

文件：

- `app/api/src/app/create-server.ts`
- `app/api/src/modules/bridge/routes.ts`

新增：

| 路由 | 类型 | 说明 |
|---|---|---|
| `GET /readyz` | public | JSON readiness 报告；ready=`200`，not_ready=`503` |
| `GET /internal/metrics` | internal token protected | Prometheus 文本导出 |

## 3. readiness 报告结构

`GET /readyz`

返回：

| 字段 | 含义 |
|---|---|
| `service` | 固定为 `api` |
| `status` | `ready` / `not_ready` |
| `checkedAt` | 本次探测时间 |
| `dependencies.database` | PostgreSQL 探测结果或 disabled |
| `dependencies.objectStorage` | object store 探测结果 |
| `dependencies.bridgeRegistry` | registry 初始化与 sweeper 状态 |
| `dependencies.runtimeOrchestrator` | runtime dispatch/queue 初始化状态 |

当前判定规则：

| 依赖 | ready 条件 |
|---|---|
| `database` | 若启用 PostgreSQL，`SELECT 1` 成功 |
| `objectStorage` | filesystem 可读写，或 S3 `HeadBucket` 成功 |
| `bridgeRegistry` | `initialized=true` 且 `sweeperActive=true` |
| `runtimeOrchestrator` | `embedded` 模式恒为 ready；`bullmq` 模式要求 queue handle 存在且 `LINGBAN_REDIS_URL` 已配置 |

## 4. metrics exporter

`GET /internal/metrics`

当前导出指标：

| 指标 | 类型 | 含义 |
|---|---|---|
| `lingban_api_ready` | gauge | API 实例整体 readiness |
| `lingban_api_dependency_enabled` | gauge | 依赖是否启用 |
| `lingban_api_dependency_ready` | gauge | 依赖是否就绪 |
| `lingban_bridge_registry_registered_connections` | gauge | 当前 bridge 注册数 |
| `lingban_bridge_registry_controller_attached` | gauge | 当前已附着 controller 的 bridge 数 |
| `lingban_bridge_registry_pending_commands` | gauge | 当前等待 controller 的命令数 |
| `lingban_bridge_registry_stale_candidates` | gauge | 当前 stale candidate 数 |
| `lingban_bridge_registry_persistence_pending` | gauge | 当前待刷盘操作数 |
| `lingban_bridge_registry_events_total` | counter | registry 累积事件计数 |
| `lingban_runtime_orchestrator_runs` | gauge | orchestrator 各类 run 计数 |
| `lingban_runtime_orchestrator_timers` | gauge | cleanup/orphan timer 数 |
| `lingban_runtime_recovery_candidates` | gauge | 当前 recovery candidate 总数 |
| `lingban_runtime_recovery_action_count` | gauge | 各 recovery action 当前数量 |
| `lingban_runtime_dispatch_mode` | gauge | 当前实例 dispatch mode |

## 5. 测试补强

### 5.1 新增 smoke

文件：`app/api/tests/readiness-metrics.smoke.test.mjs`

覆盖：

| 验证点 | 说明 |
|---|---|
| `/readyz` ready 状态 | object store / bridge registry / orchestrator ready 时返回 `200` |
| `/internal/metrics` 抓取成功 | 返回 `text/plain` Prometheus 文本 |
| metrics 内容正确 | 包含 readiness gauge、dependency gauge、bridge/runtime gauge |
| readiness 退化可见 | 手动停止 bridge sweeper 后 `/readyz` 返回 `503`，metrics 中 `lingban_api_ready 0` |

### 5.2 测试支持补充

文件：`app/api/tests/support/fake-postgres-pool.mjs`

新增 `SELECT 1 AS ready` 支持，保证 PostgreSQL readiness 探测在 fake pool 下可回归。

## 6. 构建链修正

文件：`app/api/package.json`

将 `build` 改为先构建所依赖的 workspace 包，再编译 API 自身。这样单独执行：

```bash
pnpm -C app/api build
```

不再依赖手工预编译顺序。

## 7. 当前验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api test:smoke` | `27/27` 通过 |
| `pnpm -C app/container-bridge test` | `6/6` 通过 |
| `pnpm -C app/run-worker test` | `12/12` 通过 |

## 8. 本次关闭的具体问题

| 问题 | 当前状态 |
|---|---|
| API 无 readiness 探针 | 已关闭 |
| 无 metrics exporter | 已关闭 |
| object store 无统一 readiness 检查 | 已关闭 |
| database 无统一 readiness 探测接口 | 已关闭 |
| `app/api build` 单仓构建存在假失败 | 已关闭 |

## 9. 仍未完成项

| 类别 | 未完成内容 |
|---|---|
| 指标平台接入 | 当前仅导出文本，还未接 Prometheus/OTel Collector 部署链 |
| 告警 | 仍未形成规则执行与通知出口 |
| Histogram / latency | 当前以 readiness 和 counters/gauges 为主，尚未输出耗时类指标 |
| Worker / Bridge 原生 exporter | 仍未给 `run-worker` 和 `container-bridge` 增加独立 metrics endpoint |
