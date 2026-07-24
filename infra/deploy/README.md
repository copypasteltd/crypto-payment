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

The generated release bundle keeps backend and worker as standalone workspaces, includes prebuilt static artifacts for Dashboard, Mobile H5, and the independent Admin Console, and carries a self-contained `runner-build/` context for the target Linux host.

## Deployment defaults

- API process listens on `127.0.0.1:38100`
- Worker ops listens on `127.0.0.1:38101`
- Bridge control listens on `127.0.0.1:38102`
- Public Dashboard is served by Nginx on `:38110`
- Public Mobile H5 is served by Nginx on `:38120`
- Public API gateway is served by Nginx on `:38130`
- Public Admin Console is served by Nginx on `:38140`
- Worker launch mode defaults to `local-process`
- Codex host binary is expected at `CODEX_BIN=/home/lingban/.local/bin/codex`
- Codex structured runtime uses `CODEX_RUNTIME_PROTOCOL=app-server`

When `runner-build/infra/docker/runner.Dockerfile` is present, the installer builds a release-scoped `lingban/runner:<release>` image on the target host, verifies Codex and Playwright MCP executables, writes the image tag to `/etc/lingban/run-worker.env`, and then restarts the Worker. Runner image construction never occurs on the local Windows development host.

Hosts with an approved cached base image or a restricted registry mirror can set `LINGBAN_RUNNER_BASE_IMAGE` in `/etc/lingban/run-worker.env`. The installer passes that value as the Dockerfile base-image build argument while retaining the same package installation and executable verification gates.

API-only releases that do not change the Runner build context can invoke the installer with `LINGBAN_SKIP_RUNNER_BUILD=1`. The Worker keeps the currently configured immutable Runner image.

## Session Control production baseline

The API production environment must explicitly enable the four rollout gates:

- `SESSION_CAPTURE_V2_ENABLED=true`
- `SESSION_PACK_V2_WRITE_ENABLED=true`
- `SESSION_VERSION_IMMUTABILITY_ENFORCED=true`
- `CREATOR_EXPLICIT_SESSION_BINDING_ENABLED=true`

Production sealing also requires a stable signing key ID and secret. Keep
`LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET` outside Git, restrict the environment
file to mode `0600`, and preserve historical verification keys during rotation.
The installer applies database migrations before switching `/srv/lingban/current`.
It then restarts the API, waits for API readiness, restarts the Run Worker, and
waits for Worker readiness. A failed readiness gate terminates the deployment
with the related systemd journal. The installer also writes the release directory
ID to `LINGBAN_RELEASE`, keeping the Admin system version aligned with the active
process code.

## Optional frontend build fallback

If a release bundle does not contain ready-made static assets, `server/install-release.sh` can rebuild them on the Linux host:

- `/etc/lingban/dashboard.env` for `VITE_API_BASE_URL`
- `/etc/lingban/mobile.env` for `TARO_APP_API_BASE_URL`

When `static/dashboard/index.html` or `static/mobile-h5/index.html` is missing, the installer will build the matching standalone workspace and copy the generated `dist/` output into the release.
