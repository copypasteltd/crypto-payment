# 灵办词元 2026-07-09 run_files 托管对象清理增量

## 1. 变更目标

| 项 | 说明 |
|---|---|
| 目标日期 | 2026-07-09 |
| 变更主题 | `run_files` 在索引重建时回收不再引用的 managed object，并避免 `source` 变化时复用旧 object key |
| 目标问题 | 旧实现只要 `sizeBytes + updatedAt` 相同，就会复用已有 object key；当 `source` 从 `target-scan` 修正为 `runtime-output` 时，旧错误前缀对象会被继续沿用，且历史脏对象不会自动清理 |

## 2. 本次修正

| 类别 | 已落地内容 | 具体文件 |
|---|---|---|
| Reuse 条件收紧 | managed object 只有在 `source`、`logicalPath`、`sizeBytes`、`updatedAt` 全部一致时才允许复用 | `app/api/src/modules/runs/file-index.ts` |
| Stale object cleanup | `replaceFromEntries()` 与 `upsertFromEntry()` 持久化成功后，会删除旧索引中不再被当前 `run_files` 引用的 managed object | `app/api/src/modules/runs/file-index.ts` |
| Object store 删除能力 | `ObjectStore` 新增 `deleteObject()`，filesystem 与 S3 两种 driver 均已实现 | `app/api/src/modules/uploads/object-store.ts` |
| 迁移级回归 | file-backed 与 postgres-backed 两条文件链 smoke 都新增“旧 `target-scan` objectKey 被替换并清理”断言 | `app/api/tests/file-chain.smoke.test.mjs`、`app/api/tests/file-chain-postgres.scenario.mjs` |

## 3. 修正后的行为

| 场景 | 当前行为 |
|---|---|
| `source` 修正但文件未变 | 生成新的 managed object key，并清理旧 key |
| `logicalPath` 变化 | 生成新的 managed object key，并清理旧 key |
| 文件内容或时间戳变化 | 重新物化对象，并清理旧 key |
| `user-upload` 对象 | 不参与 managed object cleanup |
| 目录项 | 不生成 object key，也不参与 cleanup |

## 4. 回归验证

| 检查项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test tests/file-chain.smoke.test.mjs tests/file-chain-postgres.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `38/38` 通过 |

## 5. 新增证据

| 证据 | 覆盖内容 |
|---|---|
| `app/api/tests/file-chain.smoke.test.mjs` | file-backed 链路下，手工种入 `target-scan` 前缀旧对象后，重扫会切到 `runtime-output`，并删除旧对象文件 |
| `app/api/tests/file-chain-postgres.scenario.mjs` | postgres-backed 索引链路下，同样验证旧对象前缀替换与删除 |

## 6. 剩余边界

| 维度 | 当前状态 |
|---|---|
| 单 run 索引重建清理 | 已落地 |
| 跨 run / 跨 workspace 全局 GC | 仍未开始 |
| 保留策略 / 分层归档 / 冷热分级 | 已在 `2026-07-09-run-file-lifecycle-cold-archive-increment.md` 落地 |
| upload object 与 download ticket 的长期 retention policy | 仍需独立设计与实现 |
