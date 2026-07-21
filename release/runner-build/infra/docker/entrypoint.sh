#!/usr/bin/env bash
set -euo pipefail

RUNTIME_CONFIG_PATH="${RUNTIME_CONFIG_PATH:-/workspace/runtime/runtime-config.json}"
BRIDGE_CONTEXT_PATH="${BRIDGE_CONTEXT_PATH:-/workspace/runtime/bridge-context.container.json}"
CODEX_BIN="${CODEX_BIN:-codex}"

if [[ ! -f "${RUNTIME_CONFIG_PATH}" ]]; then
  echo "missing runtime config: ${RUNTIME_CONFIG_PATH}" >&2
  exit 1
fi

if [[ ! -f "${BRIDGE_CONTEXT_PATH}" ]]; then
  echo "missing bridge context: ${BRIDGE_CONTEXT_PATH}" >&2
  exit 1
fi

if ! command -v "${CODEX_BIN}" >/dev/null 2>&1; then
  echo "missing Codex CLI binary: ${CODEX_BIN}" >&2
  exit 1
fi

if [[ "${LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED:-false}" == "true" ]]; then
  node /opt/lingban/app/container-bridge/dist/runtime-egress-firewall.js apply
fi

if [[ -n "${LINGBAN_RUNTIME_UMASK:-}" ]]; then
  umask "${LINGBAN_RUNTIME_UMASK}"
fi

if [[ "${LINGBAN_RUNTIME_DROP_ROOT:-false}" == "true" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "runtime root drop requested but entrypoint is not running as root" >&2
    exit 1
  fi

  if [[ -z "${LINGBAN_RUNTIME_EXEC_UID:-}" || -z "${LINGBAN_RUNTIME_EXEC_GID:-}" ]]; then
    echo "runtime root drop requested but LINGBAN_RUNTIME_EXEC_UID/GID are missing" >&2
    exit 1
  fi

  if ! command -v setpriv >/dev/null 2>&1; then
    echo "runtime root drop requested but setpriv is unavailable" >&2
    exit 1
  fi

  exec setpriv \
    --reuid "${LINGBAN_RUNTIME_EXEC_UID}" \
    --regid "${LINGBAN_RUNTIME_EXEC_GID}" \
    --clear-groups \
    node /opt/lingban/app/container-bridge/dist/cli.js "${BRIDGE_CONTEXT_PATH}"
fi

exec node /opt/lingban/app/container-bridge/dist/cli.js "${BRIDGE_CONTEXT_PATH}"
