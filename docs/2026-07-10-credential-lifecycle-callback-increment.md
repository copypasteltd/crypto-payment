# 灵办词元 2026-07-10 Credential Lifecycle Callback Increment

## 1. 目标

补齐凭证 `suspend / revoke` 之后的跨系统 provider callback 基线能力，形成可持久化、可审计、可重试、可诊断的正式后端链路。

## 2. 本次落地范围

| 项 | 落地内容 |
|---|---|
| callback 配置 | 新增 `LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACKS_JSON`、`LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_SWEEP_INTERVAL_MS`、`LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_MAX_ATTEMPTS`、`LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_BACKOFF_MS` |
| delivery ledger | 新增 `credential-lifecycle-callback-deliveries-state.json` 与 PostgreSQL `lingban_credential_lifecycle_callback_deliveries` |
| 生命周期编排 | suspend/revoke 后创建 callback delivery，立即投递，失败后按 backoff 重试 |
| 审计 | 新增 `lifecycle-callback-sent`、`lifecycle-callback-failed` 两类 credential audit event |
| 运维接口 | 新增 `GET /internal/credentials/callbacks` 与 `POST /internal/credentials/callbacks/sweep` |
| 迁移 | 新增 `0023_credential_lifecycle_callback_deliveries.sql` |

## 3. 关键实现文件

| 文件 | 作用 |
|---|---|
| `app/api/src/modules/credentials/callback-manager.ts` | callback delivery 创建、投递、失败重试、诊断聚合、审计回写 |
| `app/api/src/modules/credentials/callback-repository.ts` | file/postgres 双仓储 |
| `app/api/src/modules/credentials/service.ts` | 在 suspend/revoke 状态迁移后触发 callback manager |
| `app/api/src/modules/bridge/routes.ts` | internal diagnostics 与 sweep route |
| `app/api/src/modules/credentials/storage-schema.ts` | callback delivery schema 与 brokerKind 类型约束 |
| `packages/config/src/index.ts` | callback 配置解析 |
| `packages/contracts/src/credentials.ts` | callback 审计 action 契约 |
| `app/api/migrations/0023_credential_lifecycle_callback_deliveries.sql` | PostgreSQL 持久化表 |

## 4. 设计结论

| 设计点 | 最终策略 |
|---|---|
| 本地状态与外部 callback 的一致性 | 本地 credential 状态迁移先落库，callback 以 delivery ledger 形式异步投递 |
| 失败处理 | 失败不回滚本地 credential 状态，进入 `failed/exhausted` delivery 状态并保留审计 |
| 重试触发 | 启动时 background sweeper + internal 手动 sweep |
| payload 安全性 | 仅传递 `redactedSecretRef`，不回传明文 secret |

## 5. 验证结果

| 验证 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/credential-lifecycle-callback.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`50/50` |

## 6. 同步修正的 smoke 稳定性问题

| 用例 | 修正 |
|---|---|
| `credential-broker-vault.smoke.test.mjs` | 将 decrypt 次数校验改为不少于目标增量，避免共享进程下的非目标调用造成误报 |
| `file-chain.smoke.test.mjs` | 为 Windows 清理阶段新增 `rmWithRetry()`，消除 `EBUSY` 目录回收抖动 |
| `database-migrations.smoke.test.mjs` | 将 `0023_credential_lifecycle_callback_deliveries` 纳入 expected migrations 列表 |

## 7. 当前剩余缺口

| 缺口 | 说明 |
|---|---|
| 更多 provider adapter | 当前 callback 以 provider-configured HTTP POST 为基线，已支持 static headers、bearer、`hmac-sha256`、`oauth-client-credentials`、`private_key_jwt` 与 `mTLS`；provider-specific canonical signing 尚未闭环 |
| 云 KMS/HSM provider | 当前 broker 仍以 `local-envelope` 与 `vault-transit-http` 为主 |
| 更细粒度 stdio 隔离 | 本地进程型 MCP 的执行用户与目录权限仍需继续收紧 |
