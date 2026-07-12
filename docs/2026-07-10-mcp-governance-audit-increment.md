# 2026-07-10 MCP 治理审计增量

## 范围

本次增量补齐了 MCP connector 治理审计域，覆盖 registry、binding、probe 和 run 解析阻断链，同时修复共享 `api-sdk` 在 indexed files 摘要解析上的契约漂移。

## 本次落地

| 项目 | 内容 |
|---|---|
| 新增契约 | `packages/contracts/src/mcp.ts` 增加 `mcpGovernanceEventSchema`、`listMcpGovernanceEventsQuerySchema`、`connector.registered / connector.updated / connector.tested / connector.bound / connector.binding_updated / connector.bound_to_run / external_call.blocked` |
| 新增持久化 | `app/api/src/modules/mcp/governance-audit-repository.ts`，支持 file/postgres 双存储 |
| 新增服务 | `app/api/src/modules/mcp/governance-audit-service.ts`，负责事件落库、过滤查询、endpoint hash 生成 |
| 新增 API | `GET /v1/mcp-governance-events` |
| 新增迁移 | `app/api/migrations/0024_mcp_governance_events.sql` |
| 新增写入点 | `createMcp`、`updateMcp`、`probeMcp`、`createBinding`、`updateBinding`、`resolveRunContext` |
| 新增治理事件 | 成功记录 `connector.registered`、`connector.updated`、`connector.tested`、`connector.bound`、`connector.binding_updated`、`connector.bound_to_run`；阻断记录 `external_call.blocked` |
| 契约兼容修复 | `packages/contracts/src/runs.ts` 将 `RunFileIndexSummary.byStorageTier` 兼容为默认空数组，恢复 `packages/api-sdk` smoke |

## 校验结果

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/api-sdk test:smoke` | 通过，`11/11` |
| `node --test --test-concurrency=1 tests/database-migrations.smoke.test.mjs` | 通过 |
| `node --test --test-concurrency=1 tests/mcp-credentials.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`47/47` |

## 当前效果

| 维度 | 状态 |
|---|---|
| connector 注册审计 | 已结构化落库 |
| connector bind 审计 | 已结构化落库 |
| run 解析 attach 审计 | 已结构化落库 |
| run 前置阻断审计 | 已结构化落库 |
| probe / health 治理审计 | 已结构化落库 |
| MCP 调用审计与治理审计分层 | 已完成，`mcp_call_audits` 继续负责 tool 级调用，`mcp_governance_events` 负责治理级状态迁移 |
