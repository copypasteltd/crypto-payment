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

wait_for_readiness() {
  local service_name="$1"
  local url="$2"
  local attempts="${3:-60}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --max-time 2 "${url}" >/dev/null; then
      echo "${service_name} ready: ${url}"
      return 0
    fi
    sleep 1
  done

  echo "${service_name} failed readiness: ${url}" >&2
  journalctl -u "${service_name}" -n 80 --no-pager >&2 || true
  return 1
}

if [[ -f /etc/lingban/api.env ]]; then
  if grep -q '^LINGBAN_RELEASE=' /etc/lingban/api.env; then
    sed -i "s/^LINGBAN_RELEASE=.*/LINGBAN_RELEASE=${TIMESTAMP}/" /etc/lingban/api.env
  else
    printf 'LINGBAN_RELEASE=%s\n' "${TIMESTAMP}" >> /etc/lingban/api.env
  fi
fi

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

WORKER_UNIT_AVAILABLE=false
if systemctl cat lingban-run-worker.service >/dev/null 2>&1; then
  WORKER_UNIT_AVAILABLE=true
  systemctl stop lingban-run-worker
fi

if systemctl cat lingban-api.service >/dev/null 2>&1; then
  systemctl restart lingban-api
  wait_for_readiness lingban-api "http://127.0.0.1:${API_PORT:-38100}/health"
fi

if [[ "${WORKER_UNIT_AVAILABLE}" == "true" ]]; then
  systemctl start lingban-run-worker
  wait_for_readiness lingban-run-worker "http://127.0.0.1:${LINGBAN_WORKER_OPS_PORT:-38101}/readyz"
fi

if systemctl cat lingban-api.service >/dev/null 2>&1; then
  wait_for_readiness lingban-api "http://127.0.0.1:${API_PORT:-38100}/readyz"
fi

echo "release installed: ${RELEASE_TARGET}"
