# 2026-07-08 Increment: Creator Governance Dynamic Summary

## Scope

This increment continues the Creator-side real-data wiring work by reducing static explanatory copy inside the governance segment.

## Changes

| Area | File | Result |
|---|---|---|
| Governance section summary | `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` | The top summary note for `credentials` and `policy` now derives from live governance query results instead of always showing static product-spec copy. |
| Credential registry readability | same as above | MCP registry rows now resolve default credential display names when a credential id is available. |
| Binding readability | same as above | Binding rows now show MCP display names and credential display names alongside ids, making runtime policy tables readable without cross-referencing raw ids. |
| Policy metrics | same as above | The `approval / auto attach` metric now counts approval-required bindings from real binding records instead of inferring approval counts from registry entries only. |

## Why this matters

| Problem before | Change now |
|---|---|
| Governance summaries stayed static even after credentials, MCPs, and bindings were connected to backend APIs. | Creator governance now reflects the actual workspace governance posture in the summary layer. |
| MCP and binding tables exposed raw ids without enough operator context. | Registry and binding tables now surface display names and ids together. |
| Approval metrics mixed registry-level intent with binding-level runtime behavior. | Approval counts now come from the same binding records that control run boot behavior. |

## Verification

| Command | Result |
|---|---|
| `pnpm build` in `app/dashboard` | Passed |

## Remaining follow-up

| Area | Remaining work |
|---|---|
| Audit / Cost sections | Replace product-spec fallback with formal audit, billing, and quota backends once those API domains exist. |
| Governance actions | Add mutation-side refresh for future audit export, quota override, and policy snapshot actions when backend endpoints are introduced. |
