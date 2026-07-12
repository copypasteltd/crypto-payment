# 灵办词元 2026-07-10 MCP探活与健康快照增量说明

## 1. 变更范围

| 项 | 内容 |
|---|---|
| 变更日期 | 2026-07-10 |
| 变更主题 | MCP probe / health snapshot 治理收口 |
| 影响仓库 | `packages/contracts`、`packages/mcp`、`app/api` |
| 关联模块 | `mcp contracts`、`mcp repository`、`mcp routes`、`mcp service`、`mcp probe executor`、`database migrations`、`smoke tests` |

## 2. 本次已落地内容

| 类别 | 已实现内容 |
|---|---|
| 契约 | 新增 `McpHealthStatus`、`McpHealthSnapshot`、`probeMcpInputSchema`、`listMcpHealthSnapshotsQuerySchema` |
| 健康状态 | 支持 `healthy / degraded / unhealthy / blocked / unsupported` |
| 探测执行 | `http / sse / websocket` 远程探测；`stdio` 返回 `PROBE_UNSUPPORTED_TRANSPORT` |
| 结果字段 | 持久化 `errorCode`、`httpStatus`、`latencyMs`、`toolCount`、`policyEnforced` |
| 治理前置 | 远程 MCP probe 会校验 entry 状态、binding 可见性和 `mcp-network-policy`；不满足时直接写入 `blocked` 快照 |
| 存储 | file-backed / postgres-backed 双存储持久化 `healthSnapshots` |
| 清理策略 | 按 `mcpId + bindingId` 仅保留最近 20 条快照 |
| 路由 | `POST /v1/mcps/:mcpId/probe`、`GET /v1/mcps/:mcpId/health`、`GET /v1/mcp-health-snapshots` |
| 数据迁移 | 新增 `app/api/migrations/0020_mcp_health_snapshots.sql` |

## 3. 关键实现文件

| 文件 | 作用 |
|---|---|
| `packages/contracts/src/common.ts` | 新增 `mcpHealthSnapshotIdSchema` |
| `packages/contracts/src/mcp.ts` | 健康快照契约、query schema、probe schema |
| `packages/config/src/index.ts` | 新增 `LINGBAN_MCP_PROBE_TIMEOUT_MS` |
| `app/api/src/modules/mcp/probe.ts` | 远程 probe 执行器 |
| `app/api/src/modules/mcp/repository.ts` | 健康快照存取、保留策略、postgres 持久化 |
| `app/api/src/modules/mcp/service.ts` | probe 编排、network policy 阻断、快照落库 |
| `app/api/src/modules/mcp/routes.ts` | probe / latest health / health list 路由 |
| `app/api/migrations/0020_mcp_health_snapshots.sql` | 健康快照表 |
| `app/api/tests/mcp-health-probe.smoke.test.mjs` | 健康快照与探活烟测 |

## 4. 已修正问题

| 问题 | 修正 |
|---|---|
| latest health 查询把未传 `bindingId` 误折叠成 `null` | 已修正为保留 `undefined` 语义，未传时返回该 MCP 任意绑定的最近快照 |
| `GET /v1/mcp-health-snapshots?limit=10` 会被 Zod 判为字符串 | 已将 MCP 健康快照与 MCP 调用审计的 `limit` 改为 `z.coerce.number()` |

## 5. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/contracts build` | 通过 |
| `pnpm -C packages/mcp build` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/database-migrations.smoke.test.mjs tests/mcp-health-probe.smoke.test.mjs tests/mcp-credentials.smoke.test.mjs tests/mcp-call-audit-postgres.smoke.test.mjs` | `4/4` 通过 |
| `pnpm -C app/api test:smoke` | `45/45` 通过 |

## 6. 当前仍未完成部分

| 能力 | 当前状态 |
|---|---|
| `stdio` MCP 真探活 | 未实现 |
| 异步周期性探活作业 | 未实现 |
| runtime 出网执行层强制治理 | 未闭环 |
| connector 级独立审计对象 | 未实现 |
| connector 注册/变更审批流 | 未实现 |
