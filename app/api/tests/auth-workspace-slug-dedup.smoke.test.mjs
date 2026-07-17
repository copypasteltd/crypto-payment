import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
    server.once("error", reject);
  });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );

  return text ? JSON.parse(text) : null;
}

test("auth registration auto-deduplicates workspace slug for repeated workspace names", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-auth-slug-dedup-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_AUTH_MODE = "required";

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const first = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "slug-dedup-1@example.com",
        password: "TestPassword123!",
        displayName: "Slug Dedup One",
        workspaceName: "Repeated Workspace",
      }),
    });

    const second = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "slug-dedup-2@example.com",
        password: "TestPassword123!",
        displayName: "Slug Dedup Two",
        workspaceName: "Repeated Workspace",
      }),
    });

    assert.equal(first.currentWorkspace.name, "Repeated Workspace");
    assert.equal(second.currentWorkspace.name, "Repeated Workspace");
    assert.equal(first.currentWorkspace.slug, "repeated-workspace");
    assert.equal(second.currentWorkspace.slug, "repeated-workspace-2");
    assert.notEqual(first.currentWorkspace.workspaceId, second.currentWorkspace.workspaceId);

    const unicode = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        email: "unicode-registration@example.com",
        password: "TestPassword123!",
        displayName: "灵办体验账户",
        workspaceName: "灵办体验空间",
      }),
    });

    assert.equal(unicode.user.displayName, "灵办体验账户");
    assert.equal(unicode.currentWorkspace.name, "灵办体验空间");

    const unicodeSession = await requestJson(`${baseUrl}/v1/auth/session`, {
      headers: {
        authorization: `Bearer ${unicode.tokens.accessToken}`,
      },
    });

    assert.equal(unicodeSession.user.displayName, "灵办体验账户");
    assert.equal(unicodeSession.currentWorkspace.name, "灵办体验空间");
  } finally {
    if (app) {
      await app.close();
    }

    for (const [key, value] of envBackup.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await rm(smokeRoot, { recursive: true, force: true });
  }
});
