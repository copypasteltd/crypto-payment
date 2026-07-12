# 2026-07-09 Run Files Snapshot Authority Increment

## 1. 目标

把 `run_files` 从“可查询的附加索引”推进为 Run 读模型的正式事实源之一，解决以下问题：

| 问题 | 影响 |
|---|---|
| `RunSnapshot.files` 仍主要依赖聚合内的 `files` 数组 | 聚合与索引可能出现漂移，前端实时快照与文件查询口径不一致 |
| `GET /v1/runs/:id/files` 没有与 `run_files` 权威索引对齐 | 文件页、资产摘要、最近结果列表可能读到过时文件集 |
| upload finalize 已直接 upsert 索引，但 snapshot 不一定优先消费索引 | 新写入路径无法形成完整的索引优先闭环 |

## 2. 本次变更

| 文件 | 变更 |
|---|---|
| `app/api/src/modules/runs/service.ts` | 新增 `#resolveSnapshotFiles()` 与 `#buildSnapshot()`，统一让 `getRun / listRuns / listFiles`、运行恢复诊断与多处返回值优先读取 `runFileIndexService.list(runId)` |
| `app/api/tests/file-chain.smoke.test.mjs` | 新增断言：手动将聚合 `files` 置空后，`GET /v1/runs/:id` 与 `GET /v1/runs/:id/files` 仍能从 indexed catalog 恢复文件 |
| `app/api/tests/file-chain-postgres.scenario.mjs` | 为 postgres-backed 仓储补同类断言，验证索引优先读模型在数据库分支同样成立 |
| `app/api/tests/file-chain-postgres.smoke.test.mjs` | 新增 `indexedSnapshotFileCount` 校验 |

## 3. 新语义

| 接口 / 读模型 | 当前语义 |
|---|---|
| `GET /v1/runs/:id` | `files` 字段优先来自 `run_files` 索引；仅在索引为空时回退到聚合内 `files` |
| `GET /v1/runs/:id/files` | 与 `RunSnapshot.files` 共享同一索引优先口径 |
| `listRuns()` | 列表返回的每个 snapshot 均按索引优先组装 |
| `runtime recovery diagnostics` | 候选 snapshot 的文件视图与正式 RunSnapshot 保持一致 |

## 4. 工程意义

| 维度 | 收益 |
|---|---|
| 一致性 | `snapshot / files endpoint / indexed catalog` 三条读链口径收敛 |
| 演进空间 | 前端后续切到 indexed summary/source/kind 过滤时，不需要再补后端快照语义 |
| 容错 | 即使聚合里的 `files` 字段落后，正式读接口仍能从索引恢复 |
| 生产化 | 为后续对象生命周期治理、preview 扩展、文件读模型分页化打下统一出口 |

## 5. 验证

本次已实际执行并通过：

```bash
pnpm -C app/api build
node --test tests/file-chain.smoke.test.mjs tests/file-chain-postgres.smoke.test.mjs
pnpm -C app/api test:smoke
```

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test tests/file-chain.smoke.test.mjs tests/file-chain-postgres.smoke.test.mjs` | `2/2` 通过 |
| `pnpm -C app/api test:smoke` | `28/28` 通过 |

## 6. 当前剩余缺口

| 项 | 说明 |
|---|---|
| Office / richer binary preview | 当前仍以文本、图片、PDF 为主 |
| 对象生命周期治理 | 归档、回收、版本化、清理策略仍未闭环 |
| 文件读模型分页化 | indexed catalog 当前仍以 `limit<=1000` 返回扁平列表 |
| 双前端显式消费 indexed summary | 前端尚未全面展示 `bySource/byKind/objectBackedCount` 等统计 |
