# 2026-07-08 Increment: Creator Audit Export Chain

## Scope

This increment turns Creator audit export from a product placeholder into a formal cross-layer delivery chain.

## Changes

| Area | File | Result |
|---|---|---|
| Shared creator contract | `packages/contracts/src/creator.ts` | Added audit-export record, list/create schemas, response envelope, format/status enums, and export identifiers. |
| Creator repository state | `app/api/src/modules/creator/storage-schema.ts` | Added `auditExports` to persisted Creator state and added `packageId + exportId` route params. |
| Creator persistence | `app/api/src/modules/creator/repository.ts` | Added file/postgres persistence for audit exports and repository read/write methods. |
| Database migration | `app/api/src/app/database.ts` | Added `lingban_creator_audit_exports` table and package/workspace-context indexes. |
| Object storage output | `app/api/src/modules/creator/service.ts` | Added package-scoped audit export generation, JSON/CSV serialization, object-store upload, permission checks, and download resolution. |
| Creator API routes | `app/api/src/modules/creator/routes.ts` | Added authenticated list/create/download routes for package audit exports. |
| API SDK | `packages/api-sdk/src/index.ts` | Added `listAuditExports`, `createAuditExport`, and `downloadAuditExport`. |
| Dashboard governance UI | `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` | Audit tab now supports live JSON/CSV export, recent-export history, and authenticated browser download. |
| Backend smoke | `app/api/tests/creator-release-replay.smoke.test.mjs` | Added end-to-end assertions for audit-export creation, listing, download, and payload correctness. |
| Postgres test double | `app/api/tests/support/fake-postgres-pool.mjs` | Added audit-export table/query support for backend postgres-path tests. |

## Export payload shape

| Section | Included records |
|---|---|
| `package` | package id, title, workspace context, generated timestamp, version line |
| `counts` | release / replay / gate / activation / run totals |
| `releases` | scoped release records for the selected workspace context |
| `replays` | replay records under the current package |
| `gates` | release gates attached to scoped releases |
| `activations` | scoped activation records |
| `runs` | linked run samples with status, derived view status, approval count, and artifact count |

## API surface

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/v1/packages/:packageId/audit-exports` | List existing audit exports for a package and workspace context |
| `POST` | `/v1/packages/:packageId/audit-exports` | Generate a new JSON or CSV audit export and persist it to object storage |
| `GET` | `/v1/packages/:packageId/audit-exports/:exportId/content` | Download the stored export content through authenticated API access or signed redirect |

## Verification

| Command | Result |
|---|---|
| `pnpm build:shared` | Passed |
| `pnpm build:backend` | Passed |
| `pnpm -C app/dashboard build` | Passed |
| `pnpm -C app/api test:smoke` | Passed |

## Remaining follow-up

| Area | Remaining work |
|---|---|
| Audit retention | export retention, desensitization policy versioning, and archive lifecycle still need formal governance objects |
| Cost / quota | billing ledgers, quota policies, counters, and override approvals are still separate next-step domains |
| Review workflow | replay review decisions and audit export approval workflow are not yet linked to a dedicated review object |
