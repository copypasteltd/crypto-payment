# 2026-07-13 Multi-Provider Control Plane Increment

## Summary

This increment formalizes the multi-provider control plane for third-party OpenAI-compatible upstreams. The system can now:

1. Register multiple provider profiles from the platform dashboard/API.
2. Bind workspace-scoped credentials to a provider route.
3. Persist provider health snapshots after each probe.
4. Resolve the final provider route at run creation time through default binding, explicit selection, or priority ordering.
5. Let dashboard and mobile launch surfaces explicitly choose a workspace-bound provider and optional model override.
6. Persist the resolved provider snapshot onto each run.
7. Inject `OPENAI_BASE_URL`, `OPENAI_MODEL`, and the bound API key into the Codex runtime.
8. Extend runtime egress allowlists/firewall targets with provider base URLs.

## Scope

| Area | Status | Notes |
|---|---|---|
| Provider contracts | Done | Added provider profile, provider health summary, workspace binding priority, run selection, and resolved snapshot schemas |
| API provider module | Done | Added provider health persistence, duplicate-binding guard, and priority-aware binding ordering |
| Run resolution | Done | `createRun` resolves explicit provider selection, default route, or lowest-priority alternate route before launch |
| Worker runtime env | Done | Local-process and container env injection include provider runtime env |
| Runtime egress | Done | Provider base URL is added to proxy allowlists and firewall targets |
| Dashboard control page | Done | `/dashboard/providers` supports create/edit/enable/disable, health probing, and binding priority management |
| Dashboard launch routing | Done | Workshop launchpad supports explicit provider route selection and model override |
| Mobile H5 launch routing | Done | Service detail supports explicit provider route selection and model override |
| Runtime presentation | Done | Dashboard runtime tab and mobile task summary show the resolved provider route |
| End-to-end smoke | Done | Added platform-access, health-persistence, default-priority routing, and runtime-selection smoke coverage |

## API additions

| Route | Method | Purpose |
|---|---|---|
| `/v1/providers` | `GET` | List provider profiles, including the latest persisted health snapshot |
| `/v1/providers` | `POST` | Create provider profile |
| `/v1/providers/:providerId` | `PATCH` | Update provider profile |
| `/v1/providers/:providerId/healthcheck` | `POST` | Probe provider reachability and persist the latest health snapshot |
| `/v1/provider-bindings` | `GET` | List workspace bindings in effective route order |
| `/v1/provider-bindings` | `POST` | Create workspace binding |
| `/v1/provider-bindings/:bindingId` | `PATCH` | Update workspace binding |

## Runtime resolution chain

| Step | Module | Result |
|---|---|---|
| Provider registry lookup | `app/api/src/modules/providers/service.ts` | Select provider + workspace binding through explicit choice, default binding, or priority order |
| Run credential validation | `app/api/src/modules/runs/service.ts` | Provider credential joins normal run credential resolution |
| Start job materialization | `app/api/src/modules/runs/launch-plan.ts` | Provider auth env mount is added to `credentialMounts` |
| Run snapshot persistence | `packages/contracts/src/runs.ts`, `packages/db/src/runs.ts` | Run snapshot stores `provider` |
| Worker env injection | `app/run-worker/src/services/container-runtime.ts`, `bridge-runner.ts` | `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY` reach the Codex runtime |
| Egress allowlist expansion | `app/run-worker/src/services/egress-proxy.ts`, `egress-firewall.ts` | Provider base URL becomes reachable by runtime policy |

## Dashboard additions

| Route | Purpose |
|---|---|
| `/dashboard/providers` | Provider registry and workspace binding control page |
| `/dashboard/workshops/:workshopId/:serviceId` | Single-run launch routing with explicit provider selection |
| `/dashboard/instances/:instanceId/runtime` | Runtime provider presentation |

The dashboard provider page now supports:

1. Listing registered providers.
2. Listing current workspace provider bindings.
3. Creating provider profiles.
4. Creating workspace bindings with workspace credentials.
5. Editing existing provider profiles.
6. Editing existing workspace bindings.
7. Enabling or disabling a provider without leaving the page.
8. Enabling or disabling a workspace binding without leaving the page.
9. Persisting and displaying the latest provider health snapshot.
10. Probing one provider or all providers from the page.
11. Editing workspace binding priority to define non-default route order.

## Mobile additions

| Route | Purpose |
|---|---|
| `/pages/services/detail` | H5/mobile service launch supports provider route selection and model override |
| `/pages/tasks/detail` | H5/mobile task summary shows the resolved provider route |

## Verification

| Check | Evidence |
|---|---|
| Contracts compile | `pnpm.cmd build:contracts` |
| API compile | `pnpm.cmd -C app/api build:local` |
| Dashboard production build | `pnpm.cmd -C app/dashboard build` |
| Mobile typecheck | `pnpm.cmd -C app/mobile typecheck` |
| Mobile H5 production build | `pnpm.cmd -C app/mobile build:h5` |
| Platform provider access smoke | `node --experimental-test-isolation=process --test --test-concurrency=1 tests/provider-platform-access.smoke.test.mjs` |
| Provider health persistence smoke | `node --experimental-test-isolation=process --test --test-concurrency=1 tests/provider-healthcheck.smoke.test.mjs` |
| Provider default-priority routing smoke | `node --experimental-test-isolation=process --test --test-concurrency=1 tests/provider-default-routing.smoke.test.mjs` |
| Provider runtime smoke | `node --experimental-test-isolation=process --test --test-concurrency=1 tests/provider-runtime-selection.smoke.test.mjs` |
| HZ01 dashboard static rollout | `http://192.168.31.20:38110/` returns `index-CA16xZhD.js` |
| HZ01 mobile H5 static rollout | `http://192.168.31.20:38120/` returns `index.c7bc61ff.js` |
| HZ01 provider healthcheck rollout | Public `POST /v1/providers/:providerId/healthcheck` returns nested `healthcheck` payload and persists `lastHealthcheck` |

## Current limits

| Gap | Current state |
|---|---|
| Automatic failover after upstream runtime failure | Not implemented; priority ordering applies to launch-time route selection only |
| Gateway adapter translation | Schema reserved through `adapterMode`, request translation layer still pending |
| Provider-specific custom headers/signing | Not implemented |
| Mobile/H5 provider management console | Mobile can select launch routes but does not expose the full provider-management console |
| Provider usage/accounting reconciliation | Not implemented |

## Files touched

| File group | Purpose |
|---|---|
| `packages/contracts/src/providers.ts` | Provider contracts and persisted health summary |
| `app/api/src/modules/providers/service.ts` | Provider health persistence, duplicate guard, and priority resolution |
| `app/dashboard/src/pages/providers/ProvidersPage.tsx` | Dashboard provider control surface |
| `app/dashboard/src/pages/workshops/WorkshopsPage.tsx` | Dashboard launch route selection |
| `app/dashboard/src/pages/instances/InstancesPage.tsx` | Dashboard runtime provider presentation |
| `app/mobile/src/lib/api.ts` | Mobile provider client |
| `app/mobile/src/pages/services/detail.tsx` | Mobile launch route selection |
| `app/mobile/src/pages/tasks/detail.tsx` | Mobile runtime provider presentation |
| `app/api/tests/provider-healthcheck.smoke.test.mjs` | Provider health persistence smoke |
| `app/api/tests/provider-default-routing.smoke.test.mjs` | Default-priority route smoke |
| `app/api/tests/provider-runtime-selection.smoke.test.mjs` | Explicit provider selection smoke |
