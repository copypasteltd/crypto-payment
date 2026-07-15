import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
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
        reject(new Error("Failed to allocate port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
    server.once("error", reject);
  });
}

function applySetCookies(response, jar) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (response.headers.get("set-cookie") ?? "").split(/,(?=[^;,]+=)/);
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (cookieValue) jar.set(name, cookieValue);
    else jar.delete(name);
  }
}

async function request(baseUrl, jar, pathname, init = {}) {
  const headers = new Headers(init.headers);
  if (jar.size) {
    headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
  }
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
  applySetCookies(response, jar);
  const text = await response.text();
  return { response, text, json: text ? JSON.parse(text) : null };
}

test("admin control plane: cookie auth, CSRF, impact execution, audit, and secret redaction", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-admin-control-plane-"));
  const keys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_PLATFORM_ADMIN_EMAILS",
    "LINGBAN_ADMIN_COOKIE_SECURE",
    "LINGBAN_ADMIN_CSRF_SECRET",
    "LINGBAN_CREDENTIAL_BROKER_MASTER_KEY",
  ];
  const backup = new Map(keys.map((key) => [key, process.env[key]]));
  let app = null;
  let modelServer = null;

  try {
    const port = await allocatePort();
    const modelPort = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const secretValue = "sk-admin-smoke-secret-must-never-return";
    modelServer = createHttpServer((request, response) => {
      if (request.url !== "/v1/models") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "not found" }));
        return;
      }
      if (request.headers.authorization !== `Bearer ${secretValue}`) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "gpt-admin-smoke" }, { id: "gpt-admin-fast" }] }));
    });
    await new Promise((resolve, reject) => {
      modelServer.listen(modelPort, "127.0.0.1", (error) => error ? reject(error) : resolve());
    });
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "data");
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_PLATFORM_ADMIN_EMAILS = "platform-admin@example.com";
    process.env.LINGBAN_ADMIN_COOKIE_SECURE = "false";
    process.env.LINGBAN_ADMIN_CSRF_SECRET = "admin-smoke-csrf-secret-2026";
    process.env.LINGBAN_CREDENTIAL_BROKER_MASTER_KEY = "admin-smoke-credential-master-key-2026";

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();
    const anonymousJar = new Map();

    for (const account of [
      {
        email: "platform-admin@example.com",
        password: "PlatformAdmin123!",
        displayName: "Platform Admin",
        workspaceName: "Admin Workspace",
      },
      {
        email: "target-user@example.com",
        password: "TargetUserPass123!",
        displayName: "Target User",
        workspaceName: "Target Workspace",
      },
    ]) {
      const registered = await request(baseUrl, anonymousJar, "/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(account),
      });
      assert.equal(registered.response.status, 200, registered.text);
    }

    const jar = new Map();
    const login = await request(baseUrl, jar, "/admin/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "platform-admin@example.com",
        password: "PlatformAdmin123!",
      }),
    });
    assert.equal(login.response.status, 200, login.text);
    assert.equal(login.json.role, "platform_admin");
    assert.equal(login.text.includes('"accessToken":'), false);
    assert.equal(login.text.includes('"refreshToken":'), false);
    assert.ok(jar.get("lingban_admin_access"));
    assert.ok(jar.get("lingban_admin_refresh"));
    assert.ok(jar.get("lingban_admin_csrf"));
    const csrf = login.json.csrfToken;

    const session = await request(baseUrl, jar, "/admin/v1/auth/session");
    assert.equal(session.response.status, 200, session.text);
    assert.equal(session.json.user.email, "platform-admin@example.com");

    const workspaces = await request(baseUrl, jar, "/admin/v1/workspaces?page=1&pageSize=50");
    assert.equal(workspaces.response.status, 200, workspaces.text);
    const adminWorkspace = workspaces.json.items.find((item) => item.name === "Admin Workspace");
    assert.ok(adminWorkspace?.workspaceId);

    const quota = await request(baseUrl, jar, "/admin/v1/quotas", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({
        workspaceId: adminWorkspace.workspaceId,
        input: {
          scopeType: "workspace",
          scopeRefId: adminWorkspace.workspaceId,
          metric: "daily_runs",
          windowType: "daily",
          limitValue: 100,
          softLimitValue: 80,
          hardLimitValue: 100,
          actionOnSoftLimit: "warn",
          actionOnHardLimit: "block",
          status: "active",
          enabled: true,
          priority: 100,
          notes: "Admin smoke quota",
        },
        reason: "Create quota policy during Admin control-plane smoke verification",
      }),
    });
    assert.equal(quota.response.status, 200, quota.text);

    const updatedQuota = await request(baseUrl, jar, `/admin/v1/quotas/${quota.json.policyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({
        workspaceId: adminWorkspace.workspaceId,
        input: { limitValue: 120, hardLimitValue: 120 },
        reason: "Increase quota after reviewing the Admin smoke impact context",
      }),
    });
    assert.equal(updatedQuota.response.status, 200, updatedQuota.text);
    assert.equal(updatedQuota.json.limitValue, 120);

    const users = await request(baseUrl, jar, "/admin/v1/users?page=1&pageSize=50");
    assert.equal(users.response.status, 200, users.text);
    const target = users.json.items.find((item) => item.email === "target-user@example.com");
    assert.ok(target?.userId);

    const rejectedImpact = await request(baseUrl, jar, "/admin/v1/actions/impact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceType: "user", resourceId: target.userId, action: "suspend" }),
    });
    assert.equal(rejectedImpact.response.status, 403);
    assert.equal(rejectedImpact.json.error.code, "ADMIN_CSRF_INVALID");

    const impact = await request(baseUrl, jar, "/admin/v1/actions/impact", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({ resourceType: "user", resourceId: target.userId, action: "suspend" }),
    });
    assert.equal(impact.response.status, 200, impact.text);
    assert.equal(impact.json.impact.targetStatus, "suspended");

    const executed = await request(baseUrl, jar, "/admin/v1/actions/execute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({
        operationId: impact.json.operationId,
        impactHash: impact.json.impactHash,
        confirmation: impact.json.confirmationPhrase,
        reason: "Suspend target account for admin control-plane smoke verification",
        expectedVersion: null,
      }),
    });
    assert.equal(executed.response.status, 200, executed.text);
    assert.equal(executed.json.auditStatus, "persisted");

    const targetDetail = await request(baseUrl, jar, `/admin/v1/users/${target.userId}`);
    assert.equal(targetDetail.response.status, 200, targetDetail.text);
    assert.equal(targetDetail.json.user.status, "suspended");

    const credential = await request(baseUrl, jar, "/admin/v1/credentials", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({
        input: {
          scope: "workspace",
          displayName: "Admin Smoke Provider Key",
          provider: "openai-compatible",
          secretKind: "api-key",
          mountMode: "env",
          secretValue,
          secretRef: null,
          envName: "OPENAI_API_KEY",
          notes: "Admin smoke credential",
        },
        reason: "Verify credential creation and response redaction through Admin API",
      }),
    });
    assert.equal(credential.response.status, 200, credential.text);
    assert.equal(credential.text.includes(secretValue), false);
    assert.ok(credential.json.credentialId);

    const credentialList = await request(baseUrl, jar, "/admin/v1/credentials?page=1&pageSize=50");
    assert.equal(credentialList.response.status, 200, credentialList.text);
    assert.equal(credentialList.text.includes(secretValue), false);

    const provider = await request(baseUrl, jar, "/admin/v1/providers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({
        input: {
          displayName: "Admin Smoke Provider",
          baseUrl: `http://127.0.0.1:${modelPort}/v1`,
          defaultModel: "gpt-admin-smoke",
          models: [{ model: "gpt-admin-smoke", enabled: true, isDefault: true, capabilities: {} }],
          healthcheckPath: "/models",
          enabled: true,
        },
        reason: "Create an authenticated Provider for Admin model synchronization verification",
      }),
    });
    assert.equal(provider.response.status, 200, provider.text);

    const modelSync = await request(baseUrl, jar, `/admin/v1/providers/${provider.json.providerId}/model-sync`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-csrf": csrf },
      body: JSON.stringify({
        input: { credentialId: credential.json.credentialId },
        reason: "Synchronize model metadata through the encrypted Admin credential reference",
      }),
    });
    assert.equal(modelSync.response.status, 200, modelSync.text);
    assert.equal(modelSync.json.discoveredModelCount, 2);
    assert.equal(modelSync.json.provider.models.some((item) => item.model === "gpt-admin-fast"), true);
    assert.equal(modelSync.text.includes(secretValue), false);

    const audit = await request(baseUrl, jar, `/admin/v1/audit?q=${encodeURIComponent(target.userId)}`);
    assert.equal(audit.response.status, 200, audit.text);
    assert.equal(
      audit.json.items.some(
        (item) => item.resourceId === target.userId && item.action === "suspend" && item.outcome === "success"
      ),
      true
    );

    const auditAlias = await request(baseUrl, jar, `/admin/v1/audit/events?q=${encodeURIComponent(quota.json.policyId)}`);
    assert.equal(auditAlias.response.status, 200, auditAlias.text);
    const quotaAudit = auditAlias.json.items.find((item) => item.resourceId === quota.json.policyId);
    assert.ok(quotaAudit?.eventId);
    const auditDetail = await request(baseUrl, jar, `/admin/v1/audit/events/${quotaAudit.eventId}`);
    assert.equal(auditDetail.response.status, 200, auditDetail.text);
    assert.equal(auditDetail.json.resourceId, quota.json.policyId);

    const logout = await request(baseUrl, jar, "/admin/v1/auth/logout", {
      method: "POST",
      headers: { "x-admin-csrf": csrf },
    });
    assert.equal(logout.response.status, 200, logout.text);
    assert.equal(logout.json.ok, true);
  } finally {
    if (app) await app.close();
    if (modelServer) await new Promise((resolve) => modelServer.close(() => resolve()));
    for (const [key, value] of backup) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
