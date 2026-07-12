# LastPush

LastPush is a developer-first platform UI for domain search/registration, DNS management, and frontend deployment. The repository contains a React + Vite SPA that integrates with a backend API (running at `http://127.0.0.1:4000`) and implements the full product flows.

## Highlights

- Domain search and purchase entry
- Auth with email challenge/verify and wallet signature
- Console dashboard with metrics and activity
- Domain list + detail + DNS management
- Site creation (upload bundle) + deployment history
- Billing and usage
- Settings (profile, notifications, API keys)

## Tech Stack

- React 18 + TypeScript
- Vite
- React Router
- Tailwind CSS (CDN)
- RainbowKit + Wagmi
- TanStack Query
- Recharts
- Lucide Icons

## Directory Structure

```
.
components/
  Layout.tsx
  ui/
    Common.tsx
docs/
  api.md
  app.md
  overview.md
pages/
  Billing.tsx
  Dashboard.tsx
  DomainManager.tsx
  Home.tsx
  Login.tsx
  OrderDetail.tsx
  OrderNew.tsx
  Orders.tsx
  Settings.tsx
  SiteManager.tsx
api.ts
App.tsx
i18n.tsx
index.css
index.html
index.tsx
metadata.json
package.json
tsconfig.json
vite.config.ts
```

## App Architecture

- `index.html`: loads Tailwind CDN, fonts, and importmap; mounts `index.tsx`.
- `index.tsx`: React root and app bootstrap.
- `App.tsx`: providers (Wagmi/RainbowKit/React Query) + `HashRouter` + auth context.
- `components/Layout.tsx`: public layout vs. dashboard layout with sidebar/topbar.
- `api.ts`: unified API client, default base `http://127.0.0.1:4000/api/v1`.

## Routing

Public
- `/` Home (domain search)
- `/login` Login

Protected
- `/dashboard` Dashboard
- `/domains` Domain list
- `/domains/:name` Domain detail + DNS
- `/sites` Site list
- `/sites/new` New site deployment
- `/sites/:id` Site detail
- `/billing` Billing & usage
- `/settings` Settings

## Key Pages

- Home: domain search results, purchase entry
- Login: email + wallet auth, onboarding
- Dashboard: metrics, activity chart, recent events
- Domains: list, detail, DNS record edit/publish
- Sites: create by upload, deployment history, domains
- Billing: balance, usage, transactions
- Settings: profile, notifications, API keys

## API Integration

The frontend expects a backend compatible with the API spec in `docs/api.md`.
Default API base: `http://127.0.0.1:4000/api/v1`.
Override with `VITE_API_BASE` in `.env.local` if needed.

## Local Development

Prerequisites: Node.js, pnpm

```bash
pnpm install
pnpm run dev
```

## Notes

- Auth token is stored in localStorage and used in `Authorization` headers.
- Domain and Site lists show empty-state guidance when no data is returned.
- RainbowKit styles are imported via `App.tsx`.

## Docs

- `docs/app.md`: full page structure and layout
- `docs/api.md`: backend API contract
- `docs/overview.md`: project overview and expectations
