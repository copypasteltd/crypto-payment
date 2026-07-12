# Production Deploy Assets

This directory contains the minimum deployment assets required to move the current workspace into a Linux server environment without relying on local Docker or WSL.

## Included assets

- `env/api.production.env.example`
- `env/run-worker.production.env.example`
- `env/dashboard.production.env.example`
- `env/mobile.production.env.example`
- `systemd/lingban-api.service`
- `systemd/lingban-run-worker.service`
- `nginx/lingban.conf`
- `server/install-release.sh`

## Recommended flow

1. Run `pnpm release:prepare` from the workspace root.
2. Upload the generated `release/` directory to the target Linux host.
3. Copy the environment templates and fill in production secrets.
4. Install the systemd unit files and the Nginx config on the host.
5. Run `server/install-release.sh` on the host to build, migrate, and switch the active release.

The generated release bundle keeps backend and worker as standalone workspaces, and it includes prebuilt static artifacts for Dashboard and Mobile H5.
