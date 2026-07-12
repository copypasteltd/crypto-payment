# 2026-07-08 Increment: Creator Audit / Cost Governance Read Model

## Scope

This increment turns the Creator `audit` and `cost` governance tabs from static product-spec fallback into authenticated backend read models.

## Changes

| Area | File | Result |
|---|---|---|
| Shared creator contract | `packages/contracts/src/creator.ts` | Added governance summary schemas for dynamic Creator sections, including metrics, headers, rows, and workspace-context scoping. |
| Creator SDK | `packages/api-sdk/src/index.ts` | Added `getGovernanceSectionSummary(packageId, section, query)` for `audit` and `cost`. |
| Creator backend routes | `app/api/src/modules/creator/routes.ts` | Added authenticated `GET /v1/packages/:packageId/governance/:section/summary`. |
| Creator backend service | `app/api/src/modules/creator/service.ts` | Added package-scoped audit and cost read-model builders using live `release / replay / activation / runs / credentials / mcp / bindings` data. |
| Dashboard governance UI | `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` | `audit` and `cost` now query backend summaries and render dynamic metrics, headers, rows, and summary copy. |
| Dashboard Creator page | `app/dashboard/src/pages/creator/CreatorPage.tsx` | Passed `packageId` and `workspaceContextKey` into the governance panel so dynamic summaries stay package-scoped and workspace-scoped. |
| Smoke test | `app/api/tests/creator-release-replay.smoke.test.mjs` | Added end-to-end assertions for the new audit and cost governance summary endpoints. |

## Read-model inputs

| Summary | Authoritative inputs |
|---|---|
| `audit` | Creator package detail, scoped releases, release gates, activations, replays, and linked run snapshots |
| `cost` | Linked services, scoped run samples, visible MCP registry entries, visible binding policies, and visible credential records |

## Why this matters

| Problem before | Change now |
|---|---|
| Creator `audit` and `cost` were still static product-spec blocks. | Both tabs now read authenticated backend summaries. |
| Governance detail could show rows disconnected from actual release/run state. | Summaries now derive from the same release, replay, activation, run, credential, and binding records used elsewhere in the system. |
| There was no API contract for package-scoped governance read models. | Contracts and SDK now carry a reusable summary shape for future governance sections. |

## Verification

| Command | Result |
|---|---|
| `pnpm build:shared` in workspace root | Passed |
| `pnpm build:backend` in workspace root | Passed |
| `pnpm build` in `app/dashboard` | Passed |
| `node --test tests/creator-release-replay.smoke.test.mjs` in `app/api` | Passed |

## Remaining follow-up

| Area | Remaining work |
|---|---|
| Cost domain depth | Current cost summary is based on run usage, MCP bindings, and credential coverage. Formal billing and quota domains still need dedicated backend objects. |
| Governance actions | `audit` export now has a formal write/download chain. Cost and quota actions still need formal backend mutations. |
