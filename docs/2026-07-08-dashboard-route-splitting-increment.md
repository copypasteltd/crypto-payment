# 2026-07-08 Dashboard Route Splitting Increment

## Scope

This increment productionizes the dashboard bundle output by splitting the three large route surfaces into independent lazy-loaded chunks:

- workshops
- instances
- creator

## Delivered

File:

- `C:/dev/copypaste/agent-workshop/app/dashboard/src/app/router/AppRouter.tsx`

Implemented:

- Replaced eager route imports with `React.lazy(...)`
- Added route-scoped `Suspense` boundaries
- Added a lightweight in-shell loading fallback for route modules
- Kept `DashboardShell` eagerly loaded so navigation, auth shell, workspace controls, and layout framing remain stable

## Why this change matters

Before this change, the dashboard production build emitted a single main JavaScript chunk above the warning threshold:

- previous main chunk: about `602.84 kB`

After route splitting:

- main chunk: about `445.71 kB`
- `WorkshopsPage` chunk: about `12.56 kB`
- `InstancesPage` chunk: about `35.00 kB`
- `CreatorPage` chunk: about `111.12 kB`

This removes the build-time large-chunk warning and makes the initial dashboard payload materially smaller.

## Verification

Validated successfully:

- `pnpm -C app/dashboard build`

Observed production output:

- `dist/assets/index-qBqMhdgr.js` about `445.71 kB`
- no Rollup large chunk warning emitted during build

## Current Assessment

The dashboard bundle is now in a better production state:

- route surfaces are split cleanly
- the largest entry chunk is below the warning threshold
- existing shell behavior is preserved

## Recommended Next Step

Continue with one of the next productionization slices:

- frontend regression and E2E coverage
- realtime/file-transfer interaction validation
- dashboard-level bundle governance for future chunk growth
