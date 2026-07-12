# Project Overview

This document summarizes the project, its intent, current implementation, and expected functionality based on the UI.

## Project Description

LastPush is a developer-first platform platform that unifies domain search/registration, DNS management, and frontend deployment in a single console. The current codebase is a frontend-only implementation that uses  data and  flows to demonstrate user journeys.

## Current Implementation State

- Frontend SPA built with React + Vite.
- Routing and layout structure for public vs. authenticated areas.
-  authentication using localStorage, with optional wallet connect flow.
-  data for domains, deployments, and billing.
- UI components and pages cover all primary user flows.

## Functional Scope (Expected Behavior)

### Authentication

- Email login with challenge/verify flow.
- Wallet login with nonce/signature flow.
- Onboarding step to set username/workspace.
- Token-based session storage to protect routes.

### Dashboard

- Summary cards for site count, domains, balance.
- Activity chart based on deployment data.
- Recent events timeline.

### Domains

- Search availability and pricing for a query.
- Purchase domain flow with payment step.
- Domain list with status.
- Domain detail view with registration/SSL info.
- DNS records CRUD with publish/apply changes.

### Sites

- Create new site by uploading build artifact.
- Deployment pipeline visualization (queued/building/ready).
- Site list with status and last deploy time.
- Site detail with deployment history and rollback.
- Domain bindings for site (default/primary/custom).

### Billing

- Current balance and top-up actions.
- Usage tracking for bandwidth/build minutes.
- Payment methods management.
- Transactions list with invoices.

### Settings

- Profile update (display name, email).
- Notification preferences.
- API key management (create/rotate/delete).
- Workspace deletion workflow.

## Non-Functional Expectations

- Consistent auth gating for protected routes.
- Responsive layout for desktop and mobile.
- Clear loading, error, and empty states for all lists.
- Secure handling of auth tokens and wallet login.
- API integration ready: all flows mapped to endpoint contracts.

## Gaps vs. Production

- No backend implementation in this repo.
- All data is currently ed in UI.
- File uploads and payment flows are .
- No persistence beyond localStorage.

## Integration Notes

- API contracts are defined in `docs/api.md`.
- Page map and UI structure are defined in `docs/app.md`.
- When backend is available, replace  data with real API calls and add error handling.

