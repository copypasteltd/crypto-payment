# 2026-07-10 MCP Runtime Policy Enforcement And Windows Workspace Cleanup Increment

## 1. Summary

This increment closes the runtime-side gap between MCP governance at API validation time and MCP governance at actual execution time.

It also hardens the local-process file-chain smoke on Windows by aligning workspace deletion with active runtime semantics.

## 2. Delivered Changes

| Area | Change |
|---|---|
| Contracts | `StartRunJobPayload` and `BridgeSessionContext` now carry materialized `mcpNetworkPolicies` |
| API | Run launch resolution now collects visible remote MCP network policies and injects them into worker startup payloads |
| Worker | `buildMaterializedMcpConfig()` now rejects remote MCP bindings when the referenced runtime policy is missing, disabled, or does not allow the target |
| Bridge | `McpMaterializer` now enforces the same runtime policy checks before materializing MCP config inside the bridge process |
| Reliability | Detached bridge command dispatch failures and queued replay failures are now logged instead of surfacing as unhandled promise rejections |
| File-chain smoke | The Windows workspace-removal path now cancels the active local-process runtime before deleting `targetPath`, then verifies indexed/object-backed access still works after removal |

## 3. Code Touchpoints

| Scope | Files |
|---|---|
| Runtime contracts | `packages/contracts/src/runtime.ts`, `packages/contracts/src/runs.ts` |
| Shared MCP validation | `packages/mcp/src/index.ts` |
| API launch path | `app/api/src/modules/mcp/service.ts`, `app/api/src/modules/runs/launch-plan.ts`, `app/api/src/modules/runs/service.ts` |
| Worker runtime | `app/run-worker/src/services/run-lifecycle.ts`, `app/run-worker/src/services/container-runtime.ts` |
| Bridge runtime | `app/container-bridge/src/bridge/mcp-materializer.ts`, `app/container-bridge/src/index.ts` |
| Reliability hardening | `app/api/src/modules/bridge/registry.ts`, `app/api/src/modules/runs/service.ts` |
| Smoke alignment | `app/api/tests/file-chain.smoke.test.mjs` |

## 4. Verification

| Command | Result |
|---|---|
| `pnpm -C app/api build` | Passed |
| `pnpm -C app/api exec node --test tests/file-chain.smoke.test.mjs tests/runtime-local-process-system.smoke.test.mjs tests/bridge-registry-http-controller.smoke.test.mjs` | Passed `6/6` |
| `pnpm -C app/api test:smoke` | Passed `45/45` |

## 5. Engineering Outcome

1. Remote MCP governance is now enforced at execution time, not only at API precheck time.
2. Worker and bridge validate the same policy materialization payload, which removes the previous defense gap.
3. Local-process Windows workspace cleanup is now verified against realistic runtime lifecycle ordering.
4. Bridge control failures during detached dispatch no longer destabilize the process with unhandled rejections.
