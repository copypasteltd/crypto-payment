# 2026-07-10 Vault Transit Credential Broker Increment

## 1. Summary

This increment extends the credential broker from a single local envelope mode to a dual-provider model with production-oriented Vault Transit HTTP support.

## 2. Delivered Scope

| Area | Delivered |
|---|---|
| Broker providers | Added `vault-transit-http` alongside `local-envelope` |
| Secret envelope | Introduced discriminated `secretEnvelope` persistence by `brokerKind` |
| Runtime materialization | Materialization now opens secrets through the provider recorded on each credential envelope |
| Lease model | Added `brokerKindByCredentialId` and nullable aggregate `brokerKind` for mixed-provider runs |
| Broker health | Added `/internal/credentials/broker/health` |
| Config | Added Vault Transit base URL, token, namespace, mount, key type, and timeout env handling |
| Smoke coverage | Added `tests/credential-broker-vault.smoke.test.mjs` and folded it into `app/api` smoke gate |

## 3. Design Notes

| Topic | Decision | Reason |
|---|---|---|
| Provider dispatch | Open secrets by stored envelope `brokerKind`, not by current active provider | Existing credentials must remain decryptable after provider switching |
| Lease shape | Keep `brokerKind` nullable summary and add `brokerKindByCredentialId` | One run may materialize credentials sealed by different providers |
| Vault API | Use Transit `encrypt` / `decrypt` with base64 plaintext and AAD | Matches Vault primary contract and preserves AAD binding semantics |
| Health probe | Probe `GET /v1/sys/health?standbyok=true&perfstandbyok=true` | Gives a simple operational readiness signal for the active provider |

## 4. Files

| File | Change |
|---|---|
| `packages/contracts/src/credentials.ts` | Added provider enum expansion, discriminated envelope schemas, mixed-provider lease fields |
| `packages/config/src/index.ts` | Added Vault broker config parsing and validation |
| `app/api/src/modules/credentials/broker.ts` | Reworked broker into provider adapters with Vault Transit HTTP implementation |
| `app/api/src/modules/credentials/service.ts` | Added per-envelope provider dispatch for materialization and broker failure handling |
| `app/api/src/modules/bridge/routes.ts` | Added broker health endpoint |
| `app/api/tests/credential-broker-vault.smoke.test.mjs` | Added end-to-end Vault smoke |
| `app/api/package.json` | Added Vault smoke to `test:smoke` |

## 5. Verification

| Command | Result |
|---|---|
| `pnpm -C packages/contracts build` | passed |
| `pnpm -C packages/config build` | passed |
| `pnpm -C app/api build` | passed |
| `node --test --test-concurrency=1 tests/credential-broker-vault.smoke.test.mjs` | passed |
| `pnpm -C app/api test:smoke` | passed `46/46` |

## 6. Remaining Gaps

| Gap | Status |
|---|---|
| Cloud KMS / HSM adapters | pending |
| Cross-system revoke callback adapters | pending |
| Dynamic OAuth / signature proxy broker mode | pending |
| Finer stdio execution-user isolation | pending |
