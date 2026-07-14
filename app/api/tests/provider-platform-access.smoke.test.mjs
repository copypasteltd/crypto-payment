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
  return {
    status: response.status,
    ok: response.ok,
    json: text ? JSON.parse(text) : null,
    text,
  };
}

test("provider platform access smoke: only platform admin can mutate provider catalog", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-provider-platform-access-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_PLATFORM_ADMIN_EMAILS",
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
    process.env.LINGBAN_PLATFORM_ADMIN_EMAILS = "platform-admin@example.com";

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const platformAdmin = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "platform-admin@example.com",
        password: "PlatformAdmin123!",
        displayName: "Platform Admin",
        workspaceName: "Platform Admin Workspace",
      }),
    });
    assert.equal(platformAdmin.ok, true);

    const workspaceOwner = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "workspace-owner@example.com",
        password: "WorkspaceOwner123!",
        displayName: "Workspace Owner",
        workspaceName: "Workspace Owner Workspace",
      }),
    });
    assert.equal(workspaceOwner.ok, true);

    const ownerHeaders = {
      authorization: `Bearer ${workspaceOwner.json.tokens.accessToken}`,
      "content-type": "application/json",
    };
    const adminHeaders = {
      authorization: `Bearer ${platformAdmin.json.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const forbiddenCreate = await requestJson(`${baseUrl}/v1/providers`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        displayName: "Workspace Scoped Attempt",
        baseUrl: "https://workspace-owner.example.com/v1",
        defaultModel: "gpt-4.1-mini",
      }),
    });
    assert.equal(forbiddenCreate.status, 403);
    assert.equal(forbiddenCreate.json?.error?.code, "PLATFORM_ADMIN_REQUIRED");

    const providerCreate = await requestJson(`${baseUrl}/v1/providers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        displayName: "Platform Catalog Provider",
        description: "platform provider smoke",
        baseUrl: "https://platform-catalog.example.com/v1",
        defaultModel: "gpt-4.1-mini",
      }),
    });
    assert.equal(providerCreate.ok, true, providerCreate.text);
    assert.equal(providerCreate.json.displayName, "Platform Catalog Provider");
    assert.equal(providerCreate.json.providerId.startsWith("prv_"), true);

    const providerList = await requestJson(`${baseUrl}/v1/providers`, {
      headers: ownerHeaders,
    });
    assert.equal(providerList.ok, true, providerList.text);
    assert.equal(providerList.json.some((item) => item.providerId === providerCreate.json.providerId), true);
  } finally {
    if (app) {
      await app.close();
    }

    for (const [key, value] of envBackup) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
