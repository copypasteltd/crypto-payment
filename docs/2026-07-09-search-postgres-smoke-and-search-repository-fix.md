# 2026-07-09 Search Postgres Smoke And Repository Fix

## 1. Scope

This increment closes two backend gaps in the search domain:

| Area | Change |
|---|---|
| Search repository | Fixed Postgres-backed click-event load query to use `occurred_at` instead of the nonexistent `updated_at` column |
| Fake Postgres smoke harness | Added `lingban_search_history_entries` and `lingban_search_click_events` support for load, upsert, append, prune, and full-rewrite paths |
| Migration smoke | Updated expected migration chain to include `0017_search_history_and_click_events` |
| Search smoke coverage | Added a dedicated postgres-backed smoke scenario for `/v1/search`, `/v1/search/suggestions`, `/v1/search/history`, and `/v1/search/clicks` |
| Seed data quality | Normalized creator seed `updatedAt` values to ISO datetimes so package search results satisfy response contracts |

## 2. Files Updated

| File | Purpose |
|---|---|
| `app/api/src/modules/search/repository.ts` | Corrected click-event load ordering column |
| `app/api/tests/support/fake-postgres-pool.mjs` | Added search history and click-event table behavior |
| `app/api/tests/database-migrations.smoke.test.mjs` | Added migration `0017_search_history_and_click_events` to expected versions |
| `app/api/tests/search-postgres.scenario.mjs` | New postgres-backed search scenario |
| `app/api/tests/search-postgres.smoke.test.mjs` | New smoke wrapper for CI/test gate |
| `app/api/package.json` | Registered the new smoke test in `test:smoke` |
| `app/api/src/modules/creator/seed-data.ts` | Converted creator seed timestamps to ISO datetimes |

## 3. Verification

| Command | Result |
|---|---|
| `pnpm -C app/api build` | Passed |
| `node --test app/api/tests/search-postgres.smoke.test.mjs` | Passed |
| `pnpm -C app/api test:smoke` | Passed, `36/36` |

## 4. Outcome

| Capability | Status |
|---|---|
| Postgres-backed search history persistence | Verified |
| Postgres-backed search click-event persistence | Verified |
| Search suggestions incorporating recorded history | Verified |
| Migration discovery/apply chain including search schema | Verified |
| Search response contract under creator package matches | Verified |
