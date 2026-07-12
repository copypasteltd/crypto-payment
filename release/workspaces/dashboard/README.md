# agent-workshop-dashboard

This directory is a standalone workspace export for `app/dashboard`.

## Included workspace entries

- `dashboard` -> `app/dashboard`
- `@lingban/api-sdk` -> `packages/api-sdk`
- `@lingban/contracts` -> `packages/contracts`
- `@lingban/domain-models` -> `packages/domain-models`
- `@lingban/realtime` -> `packages/realtime`
- `@lingban/ui-tokens` -> `packages/ui-tokens`

## Commands

```bash
pnpm install
pnpm run validate
```

The generated root scripts forward to the original app package scripts while preserving the internal workspace closure required by `workspace:*` dependencies.
