# 灵办词元 2026-07-10 Credential Lifecycle Callback mTLS Increment

## 1. 目标

补齐 provider callback 与 OAuth token endpoint 的双向证书传输能力，使 suspend / revoke 后的回调可以进入要求 `mTLS` 的外部正式接口。

## 2. 本次落地范围

| 项 | 落地内容 |
|---|---|
| transport 配置 | 新增 `transport.callbackTls` 与 `transport.tokenTls` |
| TLS 字段 | 支持 `caPem`、`certPem`、`keyPem`、`passphrase`、`rejectUnauthorized`、`serverName` |
| transport 继承 | token endpoint 若未单独配置 `tokenTls`，会回退 `callbackTls` |
| 运维诊断 | `/internal/credentials/callbacks` 新增 `callbackMtlsEnabled` 与 `tokenMtlsEnabled` |
| smoke 验证 | 新增 mTLS token endpoint + callback endpoint 端到端 smoke |

## 3. 关键实现文件

| 文件 | 作用 |
|---|---|
| `packages/config/src/index.ts` | callback transport TLS schema 与 key/cert 配对校验 |
| `app/api/src/modules/credentials/callback-manager.ts` | 通用 HTTP/HTTPS request helper、TLS request options 组装、diagnostics 扩展 |
| `app/api/tests/support/mtls-fixtures.mjs` | 自包含测试证书夹具 |
| `app/api/tests/credential-lifecycle-callback-mtls.smoke.test.mjs` | mTLS callback/token endpoint 端到端 smoke |
| `app/api/package.json` | 将 mTLS smoke 纳入 `test:smoke` |

## 4. 设计细节

| 设计点 | 最终策略 |
|---|---|
| callback / token 证书边界 | callback 与 token endpoint 分开配置，便于 provider 采用不同 trust domain |
| 传输实现 | callback manager 内部使用 `node:http` / `node:https` request helper，避免把 TLS 需求散落到 `fetch` 特殊分支 |
| 证书最小校验 | 配置解析阶段要求 `certPem` 与 `keyPem` 成对提供 |
| 信任链控制 | `caPem` 与 `rejectUnauthorized` 由 provider 级配置控制，支持私有 CA 与预发环境 |
| 诊断暴露 | 仅暴露 mTLS 是否启用，不直接回显证书材料 |

## 5. 验证结果

| 验证 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/credential-lifecycle-callback-mtls.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`50/50` |

## 6. 当前剩余缺口

| 缺口 | 说明 |
|---|---|
| provider canonical signing | 仍未抽象 provider-specific canonical request / detached signature profile |
| token endpoint HA | 当前未实现多 endpoint failover、熔断与更细粒度 token telemetry |
| Creator 治理 | 当前 callback transport 模板仍以 JSON 配置为主，尚未进入 Creator 可视化治理 |
