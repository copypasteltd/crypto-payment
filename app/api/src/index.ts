import { pathToFileURL } from "node:url";
import { loadApiRuntimeConfig } from "@lingban/config";
import { createServer } from "./app/create-server.js";
import { recoverRunsRuntimeAfterStartup } from "./modules/runs/service.js";

export async function buildApiApp() {
  return createServer();
}

export async function startApiServer(options?: { host?: string; port?: number }) {
  const app = await buildApiApp();
  const config = loadApiRuntimeConfig();
  const host = options?.host ?? config.host;
  const port = options?.port ?? config.port;

  await app.listen({
    host,
    port,
  });

  void recoverRunsRuntimeAfterStartup().catch((error) => {
    console.error("[lingban-api] failed to recover runtime queue", error);
  });

  return app;
}

function isDirectExecution() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}

async function main() {
  const app = await startApiServer();
  const address = app.server.address();
  const printableAddress =
    typeof address === "string"
      ? address
      : address
        ? `http://${address.address}:${address.port}`
        : "unknown";

  console.log(`[lingban-api] listening on ${printableAddress}`);
}

if (isDirectExecution()) {
  void main().catch((error) => {
    console.error("[lingban-api] failed to start", error);
    process.exitCode = 1;
  });
}
