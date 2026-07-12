# App Page Structure

This document describes the full page structure, layout, and UI sections implemented in the app.

## Global Structure

- Entry: `index.html` loads Tailwind CDN, fonts, and importmap, then mounts `index.tsx`.
- App shell: `App.tsx` sets up Wagmi/RainbowKit/React Query providers and `HashRouter` routes.
- Auth: `AuthContext` stored in localStorage; protected routes redirect to `/login`.
- Layout: `components/Layout.tsx` renders public layout vs. dashboard layout with sidebar/topbar.

## Routing Map

- `/` Home (public)
- `/login` Login (public)
- `/dashboard` Dashboard (protected)
- `/domains` Domain List (protected)
- `/domains/:name` Domain Detail (protected)
- `/domains/search` redirect to `/`
- `/sites` Site List (protected)
- `/sites/new` New Site (protected)
- `/sites/:id` Site Detail (protected)
- `/billing` Billing (protected)
- `/settings` Settings (protected)
- `*` fallback to `/`

## Layouts

### Public Layout

- Top bar with logo, Docs link, Sign In, Get Started
- Single-column layout, `children` in main

### Dashboard Layout

- Sidebar
  - Overview (/dashboard)
  - Domains (/domains)
  - Sites (/sites)
  - Billing (/billing)
  - Settings (/settings)
  - Support (link)
  - Sign Out
- Top bar
  - Breadcrumb (Dashboard / section)
  - Actions: Find Domain, New Site
- Main content area

## Pages

### Home (`/`)

- Hero
  - Title: "Deploy frontend. Manage domains."
  - Subtitle
- Domain Search
  - Search input
  - Search button
  - Search results list 
  - Status badges (available/premium/registered)
  - Buy button

### Login (`/login`)

- Auth Methods
  - Connect Wallet (RainbowKit)
  - Continue with Email
  - Continue with X (placeholder)
- Email Login
  - Email input
  - Send magic link 
- Onboarding
  - Success state
  - Username + Workspace name inputs
  - Enter Dashboard

### Dashboard (`/dashboard`)

- KPI cards
  - Active Sites
  - Domains
  - Current Balance
- Deployment Activity chart (7 days)
- Recent Events list

### Domains

#### Domain List (`/domains`)

- Header: "Domains"
- Actions: Buy Domain, Connect Existing
- List of domains with status

#### Domain Detail (`/domains/:name`)

- Header with domain and status
- Tabs
  - Overview
  - DNS Records
- Overview tab
  - Registration card
  - SSL/HTTPS card
- DNS Records tab
  - Table of records
  - Add record
  - Delete record
  - Pending changes banner

### Sites

#### Site List (`/sites`)

- Header: "Sites"
- Action: New Project
- Grid of site cards

#### New Site (`/sites/new`)

- Upload area (zip/tar)
- Project name
- Root / Output directories
- Deploy button
- Deploy logs 

#### Site Detail (`/sites/:id`)

- Header with project name + live URL
- Actions: Settings, Create Deployment
- Production deployment card
- Deployment history
- Side cards
  - Domains
  - Quick Actions

### Billing (`/billing`)

- Balance card with top-up options
- Current usage bars
- Payment method card
- Transactions table

### Settings (`/settings`)

- Profile
  - Display name
  - Email
  - Wallet status
- Plan & Usage summary
- Notifications toggles
- API Keys section
- Danger Zone (Delete workspace)

