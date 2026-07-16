#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <uploaded-release-dir> [deploy-root]" >&2
  exit 1
fi

RELEASE_SOURCE="$1"
DEPLOY_ROOT="${2:-/srv/lingban}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_TARGET="${DEPLOY_ROOT}/releases/${TIMESTAMP}"
CURRENT_LINK="${DEPLOY_ROOT}/current"

mkdir -p "${DEPLOY_ROOT}/releases"
mkdir -p "${DEPLOY_ROOT}/shared"
rsync -a --delete "${RELEASE_SOURCE}/" "${RELEASE_TARGET}/"

pushd "${RELEASE_TARGET}/workspaces/backend" >/dev/null
if [[ -f /etc/lingban/api.env ]]; then
  set -a
  source /etc/lingban/api.env
  set +a
fi
pnpm install --no-frozen-lockfile
pnpm run build
pnpm -C app/api migrate
popd >/dev/null

pushd "${RELEASE_TARGET}/workspaces/run-worker" >/dev/null
if [[ -f /etc/lingban/run-worker.env ]]; then
  set -a
  source /etc/lingban/run-worker.env
  set +a
fi
pnpm install --no-frozen-lockfile
pnpm run build
popd >/dev/null

if [[ -d "${RELEASE_TARGET}/workspaces/dashboard" && ! -f "${RELEASE_TARGET}/static/dashboard/index.html" ]]; then
  pushd "${RELEASE_TARGET}/workspaces/dashboard" >/dev/null
  if [[ -f /etc/lingban/dashboard.env ]]; then
    set -a
    source /etc/lingban/dashboard.env
    set +a
  fi
  pnpm install --no-frozen-lockfile
  pnpm run build
  mkdir -p "${RELEASE_TARGET}/static/dashboard"
  rsync -a --delete app/dashboard/dist/ "${RELEASE_TARGET}/static/dashboard/"
  popd >/dev/null
fi

if [[ -d "${RELEASE_TARGET}/workspaces/app" && ! -f "${RELEASE_TARGET}/static/mobile-h5/index.html" ]]; then
  pushd "${RELEASE_TARGET}/workspaces/app" >/dev/null
  if [[ -f /etc/lingban/mobile.env ]]; then
    set -a
    source /etc/lingban/mobile.env
    set +a
  fi
  pnpm install --no-frozen-lockfile
  pnpm run build:h5
  mkdir -p "${RELEASE_TARGET}/static/mobile-h5"
  rsync -a --delete app/mobile/dist/ "${RELEASE_TARGET}/static/mobile-h5/"
  popd >/dev/null
fi

ln -sfn "${RELEASE_TARGET}" "${CURRENT_LINK}"
systemctl daemon-reload
if systemctl cat lingban-api.service >/dev/null 2>&1; then
  systemctl restart lingban-api
fi
if systemctl cat lingban-run-worker.service >/dev/null 2>&1; then
  systemctl restart lingban-run-worker
fi

echo "release installed: ${RELEASE_TARGET}"
