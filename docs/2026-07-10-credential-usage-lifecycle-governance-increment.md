# 2026-07-10 Credential Usage and Lifecycle Governance Increment

## 1. Summary

This increment closes the next production-grade credential governance slice after broker materialization.

Implemented in this round:

| Area | Delivered |
|---|---|
| Contracts | Added credential usage graph schemas, lifecycle impact action schemas, and suspend/revoke result schemas |
| API | Added `GET /v1/credentials/:credentialId/usages`, `POST /v1/credentials/:credentialId/suspend`, and `POST /v1/credentials/:credentialId/revoke` |
| Runtime impact control | Added lifecycle impact actions: `block`, `allow-active-runs`, and `cancel-active-runs` |
| Governance UI | Added Dashboard credential usage visualization, active-run impact selection, and suspend/revoke actions |
| Smoke coverage | Added file-backed and postgres-backed credential usage / lifecycle assertions |

## 2. Code Paths

| Layer | Files |
|---|---|
| Contracts | `packages/contracts/src/credentials.ts` |
| API SDK | `packages/api-sdk/src/index.ts` |
| API credential routes | `app/api/src/modules/credentials/routes.ts` |
| API credential service | `app/api/src/modules/credentials/service.ts` |
| Dashboard | `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` |
| File-backed smoke | `app/api/tests/mcp-credentials.smoke.test.mjs` |
| Postgres-backed smoke | `app/api/tests/mcp-call-audit-postgres.scenario.mjs` |

## 3. Runtime Behavior

| Step | Action |
|---|---|
| 1 | Governance UI selects a credential and loads usage data from `/v1/credentials/:id/usages` |
| 2 | API derives the authoritative usage graph from `runsRepository.list()` and `mcpRepository.listBindings()` |
| 3 | Active runs are separated from recent terminal runs and returned together with direct binding references |
| 4 | Suspend/revoke requests declare one of three impact actions: `block`, `allow-active-runs`, or `cancel-active-runs` |
| 5 | `block` returns `409 CREDENTIAL_ACTIVE_USAGE_PRESENT` with the current usage graph in `error.details` |
| 6 | `allow-active-runs` changes credential status for future launches while leaving current runs untouched |
| 7 | `cancel-active-runs` changes credential status and then calls `runsService.cancel()` for every impacted active run |

## 4. Verification

| Check | Result |
|---|---|
| `pnpm -C packages/contracts build` | passed |
| `pnpm -C packages/api-sdk build` | passed |
| `pnpm -C app/dashboard build` | passed |
| `pnpm -C app/api test:smoke` | passed (`45/45`) |

## 5. Closed Gaps

| Gap | Status after this increment |
|---|---|
| Credential usage graph | implemented |
| Suspend/revoke governance API | implemented |
| Active-run impact strategy | implemented |
| Dashboard governance visibility | implemented |
| Postgres-backed lifecycle smoke evidence | implemented |

## 6. Remaining Gaps

| Gap | Status |
|---|---|
| External KMS / Vault provider | not implemented |
| Structured secret materialization audit events | implemented later in `2026-07-10-credential-expiry-freeze-and-audit-governance-increment.md` |
| Automatic expiry freeze workflow | implemented later in `2026-07-10-credential-expiry-freeze-and-audit-governance-increment.md` |
| Cross-system revoke callbacks for third-party providers | not implemented |
| Finer `stdio` execution user isolation | not implemented |
