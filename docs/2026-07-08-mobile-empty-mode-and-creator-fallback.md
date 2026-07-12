# 2026-07-08 Increment: Mobile Empty Mode and Creator Fallback Reduction

## Scope

This increment continues the real-data wiring work after runs summary and service-side run filtering were connected into both frontends.

## Changes

| Area | File | Result |
|---|---|---|
| Mobile task data mode | `app/mobile/src/lib/useMobileWorkspaceCatalog.ts` | Added a three-state task mode: `live`, `empty`, `static`. |
| Auth workspace behavior | same as above | Authenticated workspaces with `runs summary.total = 0` now stay in authoritative empty state instead of falling back to sample tasks. |
| Preview workspace behavior | same as above | Static preview workspaces still keep sample tasks for H5/demo walkthroughs. |
| Mobile task list | `app/mobile/src/pages/tasks/index.tsx` | Empty-state copy now distinguishes `no live runs yet` from `preview sample mode`. |
| Mobile task detail | `app/mobile/src/pages/tasks/detail.tsx` | Sample task fallback is restricted to static preview workspaces only. |
| Mobile file browser | `app/mobile/src/pages/tasks/files.tsx` | Sample file-browser fallback is restricted to static preview workspaces only. |
| Mobile workshop detail | `app/mobile/src/pages/workshops/detail.tsx` | Static fallback to the first visible workshop now happens only in preview workspaces. |
| Mobile service detail | `app/mobile/src/pages/services/detail.tsx` | Static fallback to the first visible service now happens only in preview workspaces. |
| Mobile profile/workspace counters | `app/mobile/src/pages/me/index.tsx` | Empty authenticated workspaces now show `0` task count instead of projecting sample task counts. |
| Mobile capability summary | `app/mobile/src/lib/catalog.ts`, `app/mobile/src/data/mobileData.ts`, `app/mobile/src/pages/me/index.tsx` | The `Me` page now derives preview capability rows from real service binding fields instead of hardcoded sample hints. |
| Dashboard Creator detail | `app/dashboard/src/pages/creator/CreatorPage.tsx` | Debug panel invocation no longer passes static fallback copy into the replay view. |
| Dashboard Creator panels | `app/dashboard/src/pages/creator/CreatorReleasePanels.tsx` | Release/replay panels now render dynamic summary text from live release/replay records instead of local fallback bullets. |
| Dashboard Creator legacy cleanup | `app/dashboard/src/pages/creator/CreatorPage.tsx` | Removed unused legacy detail/debug panel implementations that still encoded static package copy. |

## Why this matters

| Problem before | Change now |
|---|---|
| Authenticated workspaces without runs looked like they already had sample tasks. | Empty authenticated workspaces now present a true zero-state. |
| Sample task detail and sample file browser could appear inside real workspaces. | Sample fallbacks are limited to static preview workspaces. |
| Preview capability hints on the `Me` page were tied to specific sample service ids. | Capability rows are now derived from service auth, bindings, launch mode, and output summary fields. |
| Creator release/debug descriptions could drift from backend package detail. | Creator detail panels now summarize live release/replay records directly. |

## Verification

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` in `app/mobile` | Passed |
| `pnpm build:h5` in `app/mobile` | Passed |
| `pnpm build` in `app/dashboard` | Passed |

## Remaining follow-up

| Area | Remaining work |
|---|---|
| Dashboard Creator | Continue removing static fallback from governance/cost/audit summary surfaces. |
| Cross-frontend file UX | Promote server-side path/breadcrumb projection when file read-model endpoints are introduced. |
