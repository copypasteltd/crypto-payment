# 灵办词元 2026-07-09 run file lifecycle cold archive 增量

## 1. 文档信息

| 项 | 内容 |
|---|---|
| 文档名称 | run file lifecycle cold archive 增量 |
| 日期 | 2026-07-09 |
| 变更主题 | 为终态 run 文件补齐跨 run 冷归档与 `hot/cold` 生命周期分级 |
| 目标问题 | 原有 `run_files` 已具备 indexed object、preview/download 回源、stale object cleanup 与 upload retention/file security，但缺少终态后对象冷热迁移与运维面 |

## 2. 本次落地范围

| 模块 | 变更 | 文件 |
|---|---|---|
| 契约层 | 为 `RunFileRecord` 新增 `storageTier / archivedAt / archivedFromObjectKey / archiveReason`，并在 indexed summary 中补齐 `byStorageTier` | `packages/contracts/src/runs.ts` |
| 索引服务 | `listIndexed()` 支持 `storageTier` 过滤；新增 `replaceRecords()` 以便 lifecycle 作业在不重扫目录的前提下直接替换索引记录 | `app/api/src/modules/runs/file-index.ts` |
| 对象存储 | 新增 `copyObject()`，支持 filesystem 与 S3 两种驱动 | `app/api/src/modules/uploads/object-store.ts` |
| 生命周期作业 | 新增 `RunFileLifecycleManager`，支持周期 sweep、手动 sweep、dry-run、指定 `runId`、冷归档对象 key 生成与累计指标 | `app/api/src/modules/runs/file-lifecycle.ts` |
| 内部运维面 | 新增 `GET /internal/run-file-lifecycle` 与 `POST /internal/run-file-lifecycle/sweep` | `app/api/src/modules/bridge/routes.ts` |
| 服务启动 | API 启动时自动拉起 lifecycle sweeper，关闭时优雅停止 | `app/api/src/app/create-server.ts` |
| 指标导出 | `/internal/metrics` 新增 lifecycle sweeper 活跃态、热层保留窗口与累计归档指标 | `app/api/src/app/ops.ts` |

## 3. 生命周期语义

| 阶段 | 语义 | 当前实现 |
|---|---|---|
| `hot` | run 仍处于近实时热层，indexed object 位于 `runs/<runId>/indexed/...` | `run_files.storageTier = hot` |
| 终态保留窗口 | run 进入 `SUCCEEDED / FAILED / CANCELLED` 后，等待 `LINGBAN_RUN_FILE_ARCHIVE_HOT_RETENTION_SECONDS` 到期 | `runtime.finishedAt` 优先，缺失时回退 `run.updatedAt` |
| `cold` | 保留窗口到期后，将非 upload 的 indexed object 迁移到冷层 archive prefix，并更新索引 | `run_files.storageTier = cold` |
| 清理后可读 | target path 被清理后，文件仍可通过 indexed object 回源预览与下载 | `preview/download/tree` 已回退到索引 + object store |

## 4. 冷层对象布局

| 对象 | key 规则 |
|---|---|
| 冷层 run 文件 | `archive/run-files/<yyyy>/<mm>/<workspaceId>/<runId>/<source>/<logicalPath>` |
| 保留原来源 | 旧热层 key 会写入 `archivedFromObjectKey` |
| 当前生效 key | `run_files.objectKey` 总是指向当前读链实际使用的对象 |

## 5. 过滤与查询能力

| 接口 | 新增能力 |
|---|---|
| `GET /v1/runs/:runId/files/indexed` | 支持 `storageTier=hot|cold` |
| `GET /internal/run-file-lifecycle` | 查看 sweeper active、热层保留窗口、archive prefix、最近一次 sweep 结果与累计指标 |
| `POST /internal/run-file-lifecycle/sweep` | 支持 `dryRun`、`runId`、`now` |

## 6. 环境变量

| 变量 | 作用 |
|---|---|
| `LINGBAN_RUN_FILE_LIFECYCLE_SWEEP_INTERVAL_MS` | lifecycle sweeper 周期 |
| `LINGBAN_RUN_FILE_ARCHIVE_HOT_RETENTION_SECONDS` | 终态 run 文件保留在热层的最长时长 |
| `LINGBAN_RUN_FILE_ARCHIVE_PREFIX` | 冷层对象前缀，默认 `archive/run-files` |
| `LINGBAN_RUN_FILE_ARCHIVE_SOURCES` | 允许进入冷层的 `run_files.source` 列表 |

## 7. 验证

| 命令 / 测试 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/run-file-lifecycle.smoke.test.mjs tests/run-file-lifecycle-postgres.smoke.test.mjs tests/readiness-metrics.smoke.test.mjs tests/file-chain.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `44/44` 通过 |

## 8. 关键结果

| 项 | 结果 |
|---|---|
| file-backed | 终态 run 文件会迁移到冷层，旧热层对象被删除，target path 删除后仍可 preview/download |
| postgres-backed | `run_files.file_json` 会持久化 `storageTier/cold archive` 元数据，并保持回源读链 |
| 运维面 | `internal metrics` 与 `internal run-file-lifecycle` 已能观察生命周期作业 |

## 9. 剩余非本次范围

| 项 | 说明 |
|---|---|
| 跨 workspace 资产中心 | 当前仅覆盖 run-scoped 冷归档，尚未升级为全局共享资产中心 |
| bundle 级结果中心 | 当前仍以 `run_files` 为细粒度对象索引，bundle 聚合层未建设 |
| 发布级生命周期编排 | 冷归档已落地，跨环境发布、归档 hold、法务冻结策略仍待后续治理域收口 |
