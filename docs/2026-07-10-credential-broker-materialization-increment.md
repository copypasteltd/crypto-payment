# 2026-07-10 Credential Broker Materialization Increment

## 1. Summary

This increment closes the first production-grade credential broker slice across API, worker, bridge, dashboard, and smoke coverage.

Implemented in this round:

| Area | Delivered |
|---|---|
| Contracts | Added encrypted secret envelope schema, broker metadata, materialization lease schema, and materialize response schema |
| API | Added `local-envelope` credential broker, encrypted secret persistence, `secretVersion` rotation, materialization lease persistence, and `/internal/runs/:runId/credentials/materialize` |
| Worker | Prefer internal credential materialization over legacy env-only injection when internal auth is present |
| Bridge SDK | Added `ApiConnector.materializeRunCredentials()` |
| Dashboard | Synced Creator credential/MCP forms with `secretValue`, optional `secretRef`, and `stdioPolicy.refSha256` |
| Tests | Added connector test coverage, materialization smoke coverage, migration version coverage, and fake-postgres support for lease persistence |

## 2. Code Paths

| Layer | Files |
|---|---|
| Contracts | `packages/contracts/src/credentials.ts` |
| Config | `packages/config/src/index.ts` |
| API credential domain | `app/api/src/modules/credentials/broker.ts`, `service.ts`, `storage-schema.ts`, `materialization-repository.ts`, `repository.ts` |
| API internal bridge route | `app/api/src/modules/bridge/routes.ts` |
| API migration | `app/api/migrations/0021_credential_materializations.sql` |
| Worker | `app/run-worker/src/services/bridge-runner.ts` |
| Bridge SDK | `app/container-bridge/src/transports/api-connector.ts` |
| Dashboard | `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` |

## 3. Runtime Flow

| Step | Action |
|---|---|
| 1 | User or admin creates a credential with `secretValue` through `/v1/credentials` |
| 2 | API broker seals the raw secret into an AES-256-GCM envelope and stores broker metadata |
| 3 | Run creation resolves `credentialMounts` and writes runtime payloads without raw secret values |
| 4 | Worker or bridge calls `/internal/runs/:runId/credentials/materialize` before runtime injection |
| 5 | API validates workspace/scope/status, decrypts only the required credentials, records a short lease, and returns `secrets` keyed by `credentialId` |
| 6 | Bridge `SecretLoader` injects env/file mounts from the returned secret map |

## 4. Verification

| Check | Result |
|---|---|
| `pnpm -C app/dashboard build` | passed |
| `pnpm -C app/api build` | passed |
| `pnpm -C app/api test:smoke` | passed (`45/45`) |
| `pnpm -C app/run-worker test` | passed (`25/25`) |
| `pnpm -C app/container-bridge test` | passed (`22/22`) |

## 5. Remaining Gaps

| Gap | Status |
|---|---|
| External KMS / Vault provider | not implemented |
| Credential usage graph and impact query | not implemented |
| Revoke propagation into active runs | not implemented |
| Structured secret materialization audit events | not implemented |
| Finer `stdio` execution user isolation | not implemented |

## 6. Current Position

The system no longer relies on plaintext credential values being stored in run aggregates or frontend governance payloads. The current production baseline is:

- encrypted credential persistence
- per-run least-secret materialization
- versioned rotation
- lease persistence
- worker/bridge runtime consumption
- dashboard governance contract alignment

The next credential-security milestone is external key management plus revoke/usage propagation.
