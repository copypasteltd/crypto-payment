# 灵办词元 2026-07-10 Credential Lifecycle Callback OAuth Client Credentials Increment

## 1. 目标

补齐 provider callback 的动态 token 获取能力，使 suspend / revoke 后的回调可以通过 OAuth 2.0 client credentials 与 `private_key_jwt` 进入外部 provider 正式接口。

## 2. 本次落地范围

| 项 | 落地内容 |
|---|---|
| callback auth | 新增 `oauth-client-credentials` |
| token endpoint client auth | 支持 `client_secret_post`、`client_secret_basic`、`private_key_jwt` |
| JWT assertion | 动态生成 `RS256` assertion，支持 `kid`、`iss`、`sub`、`aud` 与可配置 TTL |
| token cache | 按 auth config 级别缓存 access token，并基于 `expires_in` + refresh skew 提前刷新 |
| callback 头注入 | 将申请到的 access token 注入 callback header，默认 `authorization: Bearer <token>` |
| smoke 验证 | 新增 OAuth token endpoint + callback endpoint 联动 smoke，覆盖 basic、JWT assertion 与缓存复用 |

## 3. 关键实现文件

| 文件 | 作用 |
|---|---|
| `packages/config/src/index.ts` | `oauth-client-credentials` 与 `private_key_jwt` 配置 schema |
| `app/api/src/modules/credentials/callback-manager.ts` | token 请求、JWT assertion 生成、token cache 与 callback header 注入 |
| `app/api/tests/credential-lifecycle-callback-oauth.smoke.test.mjs` | client credentials / private_key_jwt 端到端 smoke |
| `app/api/package.json` | 将新 smoke 纳入 `test:smoke` 总集 |

## 4. 设计细节

| 设计点 | 最终策略 |
|---|---|
| token transport | 使用 `application/x-www-form-urlencoded` 调 token endpoint |
| JWT assertion | 固定 `RS256`，生成 `jti` 防重放，`aud` 默认回退 token endpoint URL |
| cache 粒度 | 以 auth config 对象为粒度缓存，避免同 provider 连续回调重复取 token |
| 刷新窗口 | 使用 `tokenRefreshSkewSeconds` 提前刷新，避免 token 在网络抖动窗口内刚好过期 |
| provider 扩展位 | 预留 `scope`、`audience`、`resource` 与 `additionalBody`，适配主流 token endpoint 方言 |

## 5. 验证结果

| 验证 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/credential-lifecycle-callback-oauth.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`50/50` |

## 6. 当前剩余缺口

| 缺口 | 说明 |
|---|---|
| provider canonical signing | 仍未抽象 provider-specific canonical request / detached signature profile |
| token endpoint HA | 当前未实现多 endpoint failover、熔断与更细粒度 token telemetry |
| Creator 治理 | 当前 callback OAuth 模板仍以 JSON 配置为主，尚未进入 Creator 可视化治理 |
