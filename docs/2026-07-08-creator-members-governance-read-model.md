# 2026-07-08 Increment: Creator Members Governance Read Model

## Scope

This increment turns the Creator `members` governance tab from static product-spec fallback into an authenticated backend read model.

## Changes

| Area | File | Result |
|---|---|---|
| Shared creator contract | `packages/contracts/src/creator.ts` | Extended dynamic governance sections to include `members`. |
| Creator backend service | `app/api/src/modules/creator/service.ts` | Added package-scoped member-matrix summary generation based on auth users, workspace memberships, linked package contexts, and role-derived runtime/package permissions. |
| Creator backend route | `app/api/src/modules/creator/routes.ts` | Existing governance summary route now serves `members` in addition to `audit` and `cost`. |
| Dashboard governance UI | `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` | `members` now reads backend summary data instead of local static rows. |
| Smoke test | `app/api/tests/creator-release-replay.smoke.test.mjs` | Added end-to-end verification for `members` governance summary. |

## Read-model inputs

| Summary | Authoritative inputs |
|---|---|
| `members` | Auth users, active workspace memberships, package-linked workspace-context keys, and role-derived permission mapping |

## Why this matters

| Problem before | Change now |
|---|---|
| Creator `members` only showed a product-spec matrix with fictional operators. | The matrix now derives from authenticated users and active memberships. |
| Workspace boundary display could drift away from actual package-linked contexts. | Visible scope now comes from real memberships intersected with the package's linked workspace contexts. |
| Run access and package access were explanatory copy, not system-derived permissions. | Rows now derive those two columns from real membership roles. |

## Verification

| Command | Result |
|---|---|
| `pnpm build:backend` in workspace root | Passed |
| `node --test tests/creator-release-replay.smoke.test.mjs` in `app/api` | Passed |

## Remaining follow-up

| Area | Remaining work |
|---|---|
| Member actions | `Export member matrix` and deeper membership-management actions still remain UI placeholders until formal member-management APIs exist. |
| Role depth | Current permission text is derived from role tiers. Formal per-action RBAC projection can later replace the role-to-copy mapping when the backend exposes action-level grants. |
