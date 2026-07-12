# 2026-07-09 Backend DB Migrations Increment

## 1. 目标

将 `app/api` 的 PostgreSQL 初始化从代码内嵌迁移数组推进为正式的文件化 schema migration 体系，形成可执行、可查询、可 dry-run、可回归验证的后端发布基线。

## 2. 本次落地内容

| 项 | 结果 |
|---|---|
| migration 目录 | 已新增 `app/api/migrations/*.sql` |
| 迁移版本数 | 14 个 |
| 版本范围 | `0001_runs_and_events` 到 `0013_auth_workspace_invitations` |
| 迁移执行器 | `app/api/src/app/database.ts` |
| CLI 入口 | `app/api/src/migrate.ts` |
| 仓库脚本 | `migrate`、`migrate:status`、`migrate:dry-run` |
| 状态表 | `lingban_schema_migrations` |
| 回归测试 | `app/api/tests/database-migrations.smoke.test.mjs` |

## 3. 关键实现

| 文件 | 作用 |
|---|---|
| `app/api/src/app/database.ts` | 从磁盘加载 SQL migration，维护 `lingban_schema_migrations`，暴露 status / dry-run / apply 能力 |
| `app/api/src/migrate.ts` | 命令行入口，支持 `up / status / dry-run` |
| `app/api/migrations/*.sql` | 正式 schema 版本权威源 |
| `app/api/tests/support/fake-postgres-pool.mjs` | 补齐 migration 状态查询和 `CREATE UNIQUE INDEX` 兼容 |
| `app/api/tests/database-migrations.smoke.test.mjs` | 验证发现、dry-run、首次执行与二次幂等 |

## 4. 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api exec node --test tests/database-migrations.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，当前 `32/32` |
| `pnpm -C app/api migrate:dry-run` | 通过，可输出 14 个 migration 的待执行状态 |

## 5. 仍未完成项

| 项 | 说明 |
|---|---|
| PostgreSQL 主读主写切流 | migration 体系已落地，多数 repository 仍以 file-backed 为主 |
| 跨环境回滚脚本 | 当前只有 schema version runner，没有发布级 rollback 编排 |
| 对象存储初始化/迁移 | 仍未形成与 DB 同步的发布级初始化流程 |
