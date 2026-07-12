# 2026-07-08 Frontend Billing Surfaces Increment

## Scope

This increment adds production-oriented billing visibility to the two active frontend surfaces:

- `app/dashboard`
- `app/mobile`

The goal of this slice is to expose metering totals and recent billable actions directly where operators and end users already manage runs, governance, and workspace state.

## Delivered

### Dashboard

#### 1. Run-level billing in Instances

File:

- `C:/dev/copypaste/agent-workshop/app/dashboard/src/pages/instances/InstancesPage.tsx`

Implemented:

- Added run-scoped billing summary query through `dashboardBillingApi.getSummary({ runId })`
- Added run-scoped recent ledger query through `dashboardBillingApi.listEntries({ runId, limit })`
- Added overview cards for:
  - metered amount
  - billing event count
  - top metric
  - latest metering timestamp
- Added recent metering event list in the run overview
- Added billing query invalidation after message send

#### 2. Package/workspace-context billing in Creator cost governance

File:

- `C:/dev/copypaste/agent-workshop/app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx`

Implemented:

- Added package + workspace-context scoped billing summary query
- Added package + workspace-context recent ledger query
- Added billing ledger summary card in `section === "cost"`
- Added recent metering events card in `section === "cost"`
- Expanded cost refresh invalidation to include billing queries
- Added billing refresh after audit export, because audit export itself is billable
- Updated cost refresh action text to align with the broader cost surface

### Mobile

#### 3. Workspace billing in Me page

Files:

- `C:/dev/copypaste/agent-workshop/app/mobile/src/pages/me/index.tsx`
- `C:/dev/copypaste/agent-workshop/app/mobile/src/lib/billing.ts`

Implemented:

- Added workspace-scoped billing summary query
- Added workspace-scoped recent ledger query
- Added billing helper module for:
  - USD formatting
  - quantity formatting
  - source labels
  - source tone mapping
- Added workspace billing card in the authorization/governance section
- Added summary metrics for:
  - amount
  - entries
  - top metric
  - latest metering
- Added recent billing activity list

#### 4. Run billing in task detail conversation

File:

- `C:/dev/copypaste/agent-workshop/app/mobile/src/pages/tasks/detail.tsx`

Implemented:

- Added run-scoped billing summary query
- Added run-scoped recent ledger query
- Added billing module card inside the live task conversation page
- Added billing query invalidation after:
  - run message send
  - approval submission

## Verification

Validated successfully:

- `pnpm -C app/dashboard build`
- `pnpm -C app/mobile exec tsc --noEmit --pretty false`
- `pnpm -C app/mobile build:h5`
  - completed successfully
  - observed build duration: about `1m 38s`

## Current Assessment

The billing UI slice is now wired into both frontend surfaces and backed by the live billing API.

The billing UI slice is validated across dashboard build, mobile TypeScript checks, and mobile H5 production packaging.

## Recommended Next Step

Focus next on broader frontend productionization, including:

- automated UI regression coverage
- bundle-size governance
- dashboard code-splitting
- end-to-end file upload, download, and realtime verification
