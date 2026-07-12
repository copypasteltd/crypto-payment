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
pnpm install --frozen-lockfile
pnpm run build
pnpm -C app/api migrate
popd >/dev/null

pushd "${RELEASE_TARGET}/workspaces/run-worker" >/dev/null
pnpm install --frozen-lockfile
pnpm run build
popd >/dev/null

ln -sfn "${RELEASE_TARGET}" "${CURRENT_LINK}"
systemctl daemon-reload
systemctl restart lingban-api
systemctl restart lingban-run-worker

echo "release installed: ${RELEASE_TARGET}"
