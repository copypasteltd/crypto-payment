# 2026-07-10 Credential Expiry Freeze and Audit Governance Increment

## 1. Summary

This increment closes the next credential-governance slice after usage graph and suspend/revoke delivery.

Implemented in this round:

| Area | Delivered |
|---|---|
| Contracts | Added credential audit-event schemas, audit query schema, and typed audit-event list support |
| Persistence | Added file/postgres-backed credential audit repository and `0022_credential_audit_events.sql` |
| Lifecycle governance | Added automatic expiry freeze and automatic rotation-due state promotion |
| Ops | Added background credential lifecycle sweeper and `/internal/credentials/lifecycle` diagnostics / manual sweep routes |
| Audit trail | Added structured `materialized` and `materialization-denied` credential events with run / lease / trace linkage |
| Verification | Added file-backed smoke coverage, postgres persistence coverage, and full backend smoke validation |

## 2. Code Paths

| Layer | Files |
|---|---|
| Contracts | `packages/contracts/src/credentials.ts` |
| API SDK | `packages/api-sdk/src/index.ts` |
| API credential service | `app/api/src/modules/credentials/service.ts` |
| API credential routes | `app/api/src/modules/credentials/routes.ts` |
| Lifecycle sweeper | `app/api/src/modules/credentials/lifecycle-manager.ts` |
| Audit repository | `app/api/src/modules/credentials/audit-repository.ts` |
| Storage schemas | `app/api/src/modules/credentials/storage-schema.ts` |
| Internal ops routes | `app/api/src/modules/bridge/routes.ts` |
| Migration | `app/api/migrations/0022_credential_audit_events.sql` |
| Smoke tests | `app/api/tests/mcp-credentials.smoke.test.mjs`, `app/api/tests/mcp-call-audit-postgres.scenario.mjs`, `app/api/tests/database-migrations.smoke.test.mjs` |

## 3. Runtime Behavior

| Step | Action |
|---|---|
| 1 | Public credential views derive effective status from `expiresAt` and `rotationDueAt` even before the next sweeper pass |
| 2 | Background sweeper periodically reconciles persisted credential status into `disabled` or `needs-rotation` when time thresholds are reached |
| 3 | Run resolution re-checks lifecycle state before launch so expired credentials are blocked with `RUN_CREDENTIAL_EXPIRED` |
| 4 | Internal materialization re-checks lifecycle state before secret release, then emits `materialized` or `materialization-denied` audit events |
| 5 | Audit events persist `runId`, `leaseId`, `traceId`, `secretVersion`, `mountMode`, and lifecycle reason codes |
| 6 | Governance callers can read the structured ledger from `GET /v1/credentials/:credentialId/audit-events` |

## 4. Audit Event Set

| Action | Meaning |
|---|---|
| `created` | Credential record was created |
| `updated` | Metadata or mounting policy changed |
| `rotated` | Secret version rotated and resealed |
| `status-changed` | Explicit suspend or revoke action |
| `auto-disabled-expired` | Credential hit `expiresAt` and was automatically frozen |
| `auto-needs-rotation` | Credential hit `rotationDueAt` and was promoted to `needs-rotation` |
| `materialized` | Secret was released into a short lease for runtime use |
| `materialization-denied` | Secret release was blocked by lifecycle or payload constraints |

## 5. Verification

| Check | Result |
|---|---|
| `pnpm -C packages/contracts build` | passed |
| `pnpm -C packages/config build` | passed |
| `pnpm -C packages/api-sdk build` | passed |
| `pnpm -C app/api build` | passed |
| `node --test --test-concurrency=1 tests/database-migrations.smoke.test.mjs tests/mcp-credentials.smoke.test.mjs tests/mcp-call-audit-postgres.smoke.test.mjs` | passed (`3/3`) |
| `pnpm -C app/api test:smoke` | passed (`45/45`) |

## 6. Closed Gaps

| Gap | Status after this increment |
|---|---|
| Automatic expiry freeze workflow | implemented |
| Automatic rotation-due promotion | implemented |
| Structured secret materialization audit events | implemented |
| Postgres-backed credential audit persistence | implemented |
| Internal lifecycle sweep diagnostics | implemented |

## 7. Remaining Gaps

| Gap | Status |
|---|---|
| External KMS / Vault provider | not implemented |
| Cross-system revoke callbacks for third-party providers | not implemented |
| Dynamic OAuth refresh / signature proxy broker | not implemented |
| Finer `stdio` execution user isolation | not implemented |
