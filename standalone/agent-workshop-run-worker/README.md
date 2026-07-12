# agent-workshop-run-worker

This directory is a standalone workspace export for `app/run-worker`.

## Included workspace entries

- `@lingban/container-bridge` -> `app/container-bridge`
- `@lingban/run-worker` -> `app/run-worker`
- `@lingban/config` -> `packages/config`
- `@lingban/contracts` -> `packages/contracts`
- `@lingban/domain-models` -> `packages/domain-models`
- `@lingban/mcp` -> `packages/mcp`
- `@lingban/session-pack` -> `packages/session-pack`
- `@lingban/shared` -> `packages/shared`

## Commands

```bash
pnpm install
pnpm run validate
```

The generated root scripts forward to the original app package scripts while preserving the internal workspace closure required by `workspace:*` dependencies.
