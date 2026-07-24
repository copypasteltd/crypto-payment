#!/usr/bin/env sh
set -eu

OUTPUT_DIR="${PLAYWRIGHT_MCP_OUTPUT_DIR:-/workspace/outputs/playwright}"
mkdir -p "${OUTPUT_DIR}"

if [ -z "${PLAYWRIGHT_MCP_EXECUTABLE_PATH:-}" ]; then
  if command -v chromium >/dev/null 2>&1; then
    PLAYWRIGHT_MCP_EXECUTABLE_PATH="$(command -v chromium)"
  elif command -v chromium-browser >/dev/null 2>&1; then
    PLAYWRIGHT_MCP_EXECUTABLE_PATH="$(command -v chromium-browser)"
  fi
fi

if [ -n "${PLAYWRIGHT_MCP_EXECUTABLE_PATH:-}" ]; then
  set -- --executable-path "${PLAYWRIGHT_MCP_EXECUTABLE_PATH}" "$@"
fi

exec playwright-mcp \
  --headless \
  --isolated \
  --no-sandbox \
  --image-responses omit \
  --output-dir "${OUTPUT_DIR}" \
  "$@"
