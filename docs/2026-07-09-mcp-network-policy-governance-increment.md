# 2026-07-09 MCP Network Policy Governance Increment

## 1. 目标

补齐第三方远程 MCP 的正式 network policy 治理链，使 `networkPolicyRef` 从契约占位升级为可持久化、可查询、可校验、可在 run 创建前强制执行的生产级对象。

## 2. 本轮交付

| 交付项 | 说明 |
|---|---|
| MCP network policy 契约 | `packages/contracts/src/mcp.ts` 新增 `McpNetworkPolicy` 及 list/create/update schema |
| 共享策略校验工具 | `packages/mcp/src/index.ts` 新增 host pattern、private-network、TLS、port、path-prefix allowlist 校验 |
| API 持久化 | `app/api/src/modules/mcp/repository.ts` 新增 `networkPolicies` 存储、查询、写入与 seed/backfill |
| API 管理接口 | `GET/POST/PATCH /v1/mcp-network-policies` 与 `GET /v1/mcp-network-policies/:policyRef` |
| 执行前阻断 | 远程 MCP 在 create/update registry entry、create/update binding、create run 前都会校验 policy 存在性与目标 URL allowlist |
| 数据迁移 | `app/api/migrations/0019_mcp_network_policies.sql` |
| Postgres 测试桩 | `app/api/tests/support/fake-postgres-pool.mjs` 支持 `lingban_mcp_network_policies` 读写 |

## 3. 关键行为

| 场景 | 当前行为 |
|---|---|
| 引用不存在的 policy | 返回 `MCP_NETWORK_POLICY_NOT_FOUND` |
| policy 不允许目标 host/path/protocol/port | 返回 `MCP_NETWORK_POLICY_VIOLATION` |
| remote MCP 无 policy 启动 run | 返回 `RUN_MCP_NETWORK_POLICY_REQUIRED` |
| run 使用 disabled / 不可见 policy | 返回 `RUN_MCP_NETWORK_POLICY_DISABLED` / `RUN_MCP_NETWORK_POLICY_NOT_FOUND` |
| 老状态文件或旧 postgres state 无 policies | 初始化时自动 backfill seed policy |

## 4. 影响文件

| 路径 |
|---|
| `packages/contracts/src/mcp.ts` |
| `packages/mcp/src/index.ts` |
| `app/api/src/modules/mcp/storage-schema.ts` |
| `app/api/src/modules/mcp/seed-data.ts` |
| `app/api/src/modules/mcp/repository.ts` |
| `app/api/src/modules/mcp/service.ts` |
| `app/api/src/modules/mcp/routes.ts` |
| `app/api/migrations/0019_mcp_network_policies.sql` |
| `app/api/tests/mcp-credentials.smoke.test.mjs` |
| `app/api/tests/database-migrations.smoke.test.mjs` |
| `app/api/tests/support/fake-postgres-pool.mjs` |

## 5. 验证

```powershell
pnpm -C packages/contracts build
pnpm -C packages/mcp build
pnpm -C app/api build
node --test --test-concurrency=1 `
  tests/database-migrations.smoke.test.mjs `
  tests/mcp-credentials.smoke.test.mjs `
  tests/mcp-call-audit-postgres.smoke.test.mjs
```

结果：`3/3` 通过。

## 6. 剩余缺口

| 缺口 | 说明 |
|---|---|
| runtime 出网执行层 | 当前为 API 前置阻断，尚未把 allowlist 下沉到容器出网层 |
| stdio allowlist | 第三方本地进程型 MCP 仍未形成正式白名单执行层 |
| connector 探活 | 仍缺正式 health snapshot / capability probe |
| broker 化凭证 | env/file 注入仍未升级为 Vault/KMS/OAuth broker |
