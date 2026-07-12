# 灵办词元 2026-07-10 Credential Lifecycle Callback Auth/Signing Increment

## 1. 目标

在既有 provider callback delivery ledger 基线上补齐生产可用的鉴权、签名与 payload 版本策略，覆盖 bearer token 与 HMAC 签名场景，并形成可诊断、可回归的正式实现。

## 2. 本次落地范围

| 项 | 落地内容 |
|---|---|
| callback auth | 新增 `none`、`bearer`、`hmac-sha256` 三类 callback 鉴权策略 |
| callback payload | 新增 `eventType`、`eventVersion`、`includeAttemptMetadata` 配置 |
| callback headers | 新增 `x-lingban-delivery-id`、`x-lingban-event-type`、`x-lingban-event-version` 及 attempt metadata 头 |
| HMAC 签名 | 生成 payload SHA-256、签名时间戳、`sha256=` 前缀签名值与可选 key id |
| diagnostics | `/internal/credentials/callbacks` 新增 `authMode`、`authHeaderNames`、`payloadEventType`、`payloadEventVersion` 诊断输出 |
| smoke 验证 | 新增 bearer 校验、HMAC 校验、attempt metadata 与 event version 校验 |

## 3. 关键实现文件

| 文件 | 作用 |
|---|---|
| `packages/config/src/index.ts` | callback auth / payload 策略 schema、环境配置解析 |
| `app/api/src/modules/credentials/callback-manager.ts` | payload 组装、签名头构造、dispatch 投递与 diagnostics 暴露 |
| `app/api/tests/credential-lifecycle-callback.smoke.test.mjs` | bearer + HMAC + retry sweep 端到端 smoke 验证 |

## 4. 设计细节

| 设计点 | 最终策略 |
|---|---|
| bearer 注入 | 支持自定义 `headerName` 与 `scheme`，默认 `authorization: Bearer <token>` |
| HMAC 签名基线 | 使用 `${timestamp}.${payloadSha256}` 作为待签名原文，`sha256=` 作为默认签名前缀 |
| payload 兼容演进 | 通过 `eventType` 和 `eventVersion` 将 provider callback 契约外显，不把内部 action 名称硬编码成唯一消费语义 |
| attempt 可观测性 | 可选写入 payload 与 header，支持 provider 端幂等、排障与重试分析 |
| key rotation 兼容 | HMAC 支持 `keyId` 与自定义 `keyIdHeaderName`，便于 provider 端按 key ring 验签 |

## 5. 验证结果

| 验证 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/credential-lifecycle-callback.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`50/50` |

## 6. 当前剩余缺口

| 缺口 | 说明 |
|---|---|
| provider canonicalization | 当前 HMAC 以统一 `${timestamp}.${payloadSha256}` 规则为基线，尚未抽象 provider-specific canonical request profile |
| 回调模板治理 | 当前 payload/header 策略已配置化，尚未纳入 Creator 侧可视化治理与发布 gate |
