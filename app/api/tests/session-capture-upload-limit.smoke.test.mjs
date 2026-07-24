import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Failed to allocate port"));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
    server.once("error", reject);
  });
}

test("capture object route accepts an internal payload above Fastify's default body limit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lingban-capture-upload-limit-"));
  const keys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_UPLOAD_MAX_BYTES",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  let app = null;

  try {
    const port = await allocatePort();
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(root, "data");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "capture-upload-limit-token";
    process.env.LINGBAN_UPLOAD_MAX_BYTES = String(3 * 1024 * 1024);

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();
    const response = await fetch(
      `http://127.0.0.1:${port}/internal/runs/run_upload_limit/session-captures/` +
      "cap_upload_limit/objects/workspace?workerId=worker_upload_limit&leaseGeneration=1&" +
      `sha256=${"a".repeat(64)}&contentType=application%2Fzstd`,
      {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-lingban-internal-token": "capture-upload-limit-token",
        },
        body: Buffer.alloc(2 * 1024 * 1024, 0x5a),
      }
    );
    const payload = await response.json();
    assert.equal(response.status, 404);
    assert.equal(payload.error.code, "SESSION_CAPTURE_NOT_FOUND");
  } finally {
    if (app) await app.close();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
