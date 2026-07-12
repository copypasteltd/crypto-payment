# 灵办词元 2026-07-10 AWS KMS 凭证 Broker 增量

## 1. 目标

补齐后端凭证治理中的云 KMS provider 缺口，在现有 `local-envelope` 与 `vault-transit-http` 基线之上新增可生产接入的 `aws-kms-envelope` provider，并形成可验证的 build/smoke 证据。

## 2. 本次落地范围

| 模块 | 变更 |
|---|---|
| `packages/contracts` | 新增 `aws-kms-envelope` broker kind 与 discriminated `secretEnvelope` 契约 |
| `packages/config` | 新增 `LINGBAN_CREDENTIAL_BROKER_AWS_REGION`、`LINGBAN_CREDENTIAL_BROKER_AWS_KMS_KEY_ID`、`LINGBAN_CREDENTIAL_BROKER_AWS_ENDPOINT`、`LINGBAN_CREDENTIAL_BROKER_AWS_ACCESS_KEY_ID`、`LINGBAN_CREDENTIAL_BROKER_AWS_SECRET_ACCESS_KEY`、`LINGBAN_CREDENTIAL_BROKER_AWS_SESSION_TOKEN` 配置解析 |
| `app/api` broker | 新增 `AwsKmsEnvelopeCredentialBroker`，通过 `GenerateDataKey` 生成 data key，本地 `AES-256-GCM` seal secret，通过 `Decrypt` 解封 data key，并通过 `DescribeKey` 输出 readiness |
| 运行时链路 | 不改现有 materialize 协议，沿用 `/internal/runs/:id/credentials/materialize` 与短租约 secret map |
| 验证链路 | 新增 `tests/credential-broker-aws-kms.smoke.test.mjs`，并纳入 `pnpm -C app/api test:smoke` |

## 3. 实现说明

### 3.1 Envelope 结构

| 字段 | 用途 |
|---|---|
| `brokerKind=aws-kms-envelope` | 区分 provider |
| `keyId` | 逻辑上的 active broker key id |
| `kmsKeyId` | 实际调用的 AWS KMS key id / ARN / alias |
| `kmsRegion` | seal 时使用的 region，供后续 materialize 审计与配置一致性校验 |
| `encryptedDataKeyBase64` | KMS 托管加密后的 data key |
| `ivBase64/authTagBase64/ciphertextBase64` | 本地 `AES-256-GCM` envelope 密文 |

### 3.2 Seal/Open 逻辑

| 阶段 | 逻辑 |
|---|---|
| seal | `GenerateDataKey(KeySpec=AES_256)` 生成明文 data key 与加密 data key；明文 key 仅在进程内短暂存在，用于本地 `AES-256-GCM` 加密 secret，随后立即 `fill(0)` 清零 |
| open | 使用 `encryptedDataKeyBase64` 调用 `Decrypt` 还原明文 data key，再解开本地 `AES-256-GCM` envelope |
| 绑定上下文 | KMS `EncryptionContext` 使用 `lingbanBroker + lingbanKeyId + lingbanAadSha256`，避免 data key 脱离对应 credential AAD 被误解封 |
| readiness | `DescribeKey` 检查 KMS key `Enabled/KeyState`，并在 `/internal/credentials/broker/health` 暴露 `kmsKeyId/kmsRegion/keyArn/keyManager` |

## 4. 生产侧意义

| 点 | 意义 |
|---|---|
| 主密钥不再驻留应用配置 | 生产可由 KMS 托管 data key 生命周期与访问控制 |
| 凭证库仍保持统一 envelope 结构 | 不破坏现有 file/postgres-backed credentials repository、审计和 materialize 路由 |
| broker 可多 provider 并存 | 现有 `local-envelope`、`vault-transit-http`、`aws-kms-envelope` 共享同一 service/repository 主链 |
| smoke 可本地复现 | 通过伪 KMS JSON 协议服务器完成 API 级全链路验收，便于 CI 与 pre-prod 回归 |

## 5. 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/credential-broker-aws-kms.smoke.test.mjs tests/credential-broker-vault.smoke.test.mjs tests/mcp-credentials.smoke.test.mjs` | `3/3` 通过 |
| `pnpm -C app/api test:smoke` | `48/48` 通过 |

## 6. 仍未完成的后续项

| 项 | 当前状态 |
|---|---|
| GCP / Azure KMS provider | 未实现 |
| HSM adapter | 未实现 |
| richer provider callback auth/payload 策略 | 未实现 |
| stdio 执行用户隔离 | 未实现 |
| 目录级权限进一步细化 | 未实现 |
