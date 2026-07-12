# agent-workshop-backend

This directory is a standalone workspace export for `app/api`.

## Included workspace entries

- `@lingban/api` -> `app/api`
- `@lingban/container-bridge` -> `app/container-bridge`
- `@lingban/run-worker` -> `app/run-worker`
- `@lingban/config` -> `packages/config`
- `@lingban/contracts` -> `packages/contracts`
- `@lingban/credential` -> `packages/credential`
- `@lingban/db` -> `packages/db`
- `@lingban/domain-models` -> `packages/domain-models`
- `@lingban/files` -> `packages/files`
- `@lingban/mcp` -> `packages/mcp`
- `@lingban/session-pack` -> `packages/session-pack`
- `@lingban/shared` -> `packages/shared`

## Commands

```bash
pnpm install
pnpm run validate
```

The generated root scripts forward to the original app package scripts while preserving the internal workspace closure required by `workspace:*` dependencies.
