#!/usr/bin/env node

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const apiBaseUrl = (readArg("--api") ?? process.env.LINGBAN_API_BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const token = readArg("--token") ?? process.env.LINGBAN_ACCESS_TOKEN;
const ids = (readArg("--ids") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const dryRun = !process.argv.includes("--apply");

if (!token && process.env.LINGBAN_AUTH_MODE !== "disabled") {
  throw new Error("LINGBAN_ACCESS_TOKEN or --token is required when API authentication is enabled");
}

const response = await fetch(`${apiBaseUrl}/v1/session-migrations/legacy-archives`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ sessionVersionIds: ids, dryRun }),
});
const payload = await response.json().catch(() => null);
if (!response.ok) {
  throw new Error(`Legacy Session migration failed (${response.status}): ${JSON.stringify(payload)}`);
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
if (payload.failed > 0) process.exitCode = 2;
