# agent-workshop-sdk

This directory is a standalone workspace export for `app/container-bridge`.

## Included workspace entries

- `@lingban/container-bridge` -> `app/container-bridge`
- `@lingban/config` -> `packages/config`
- `@lingban/contracts` -> `packages/contracts`
- `@lingban/mcp` -> `packages/mcp`
- `@lingban/shared` -> `packages/shared`

## Commands

```bash
pnpm install
pnpm run validate
```

The generated root scripts forward to the original app package scripts while preserving the internal workspace closure required by `workspace:*` dependencies.
