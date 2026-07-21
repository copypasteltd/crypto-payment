import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
    server.once("error", reject);
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
    server.once("error", reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

test("WeChat Mini Program login exchanges code and reuses the bound Lingban account", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-wechat-auth-"));
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_AUTH_STORE",
    "LINGBAN_WECHAT_MINI_PROGRAM_APP_ID",
    "LINGBAN_WECHAT_MINI_PROGRAM_APP_SECRET",
    "LINGBAN_WECHAT_MINI_PROGRAM_API_BASE_URL",
    "LINGBAN_WECHAT_MINI_PROGRAM_REQUEST_TIMEOUT_MS",
  ];
  const envBackup = new Map(envKeys.map((key) => [key, process.env[key]]));
  const upstreamRequests = [];
  const wechatServer = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    upstreamRequests.push(url);
    response.setHeader("content-type", "application/json");

    if (url.searchParams.get("js_code") === "invalid-code") {
      response.end(JSON.stringify({ errcode: 40029, errmsg: "invalid code" }));
      return;
    }

    response.end(
      JSON.stringify({
        openid: "openid_test_stable",
        unionid: "unionid_test_stable",
        session_key: "session-key-must-not-be-persisted",
      })
    );
  });

  let app = null;
  try {
    const wechatAddress = await listen(wechatServer);
    assert.ok(wechatAddress && typeof wechatAddress !== "string");
    const apiPort = await allocatePort();
    const dataDir = path.join(smokeRoot, "api-data");
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(apiPort);
    process.env.LINGBAN_DATA_DIR = dataDir;
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_AUTH_STORE = "file";
    process.env.LINGBAN_WECHAT_MINI_PROGRAM_APP_ID = "wx-test-app-id";
    process.env.LINGBAN_WECHAT_MINI_PROGRAM_APP_SECRET = "wx-test-app-secret";
    process.env.LINGBAN_WECHAT_MINI_PROGRAM_API_BASE_URL =
      `http://127.0.0.1:${wechatAddress.port}`;
    process.env.LINGBAN_WECHAT_MINI_PROGRAM_REQUEST_TIMEOUT_MS = "2000";

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();
    const authUrl = `http://127.0.0.1:${apiPort}/v1/auth/wechat-mini-program`;

    const first = await postJson(authUrl, {
      code: "valid-code-1",
      displayName: "微信测试用户",
    });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.user.displayName, "微信测试用户");
    assert.equal(first.body.currentWorkspace.type, "personal");
    assert.equal(first.body.currentWorkspace.role, "owner");
    assert.match(first.body.user.email, /^wx-[a-f0-9]{32}@wechat\.copypaste\.hk$/);
    assert.ok(first.body.tokens.accessToken);
    assert.ok(first.body.tokens.refreshToken);

    const second = await postJson(authUrl, { code: "valid-code-2" });
    assert.equal(second.response.status, 200);
    assert.equal(second.body.user.userId, first.body.user.userId);
    assert.equal(
      second.body.currentWorkspace.workspaceId,
      first.body.currentWorkspace.workspaceId
    );
    assert.notEqual(second.body.tokens.accessToken, first.body.tokens.accessToken);

    assert.equal(upstreamRequests.length, 2);
    for (const url of upstreamRequests) {
      assert.equal(url.pathname, "/sns/jscode2session");
      assert.equal(url.searchParams.get("appid"), "wx-test-app-id");
      assert.equal(url.searchParams.get("secret"), "wx-test-app-secret");
      assert.equal(url.searchParams.get("grant_type"), "authorization_code");
    }

    const invalid = await postJson(authUrl, { code: "invalid-code" });
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.body.error.code, "AUTH_WECHAT_CODE_INVALID");

    const identityState = await readFile(
      path.join(dataDir, "auth", "wechat-identities.json"),
      "utf8"
    );
    assert.equal(identityState.includes("session-key-must-not-be-persisted"), false);
    assert.equal(identityState.includes("wx-test-app-secret"), false);
    const parsedIdentityState = JSON.parse(identityState);
    assert.equal(parsedIdentityState.identities.length, 1);
    assert.equal(parsedIdentityState.identities[0].userId, first.body.user.userId);
  } finally {
    if (app) await app.close();
    if (wechatServer.listening) await close(wechatServer);
    for (const [key, value] of envBackup) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true });
  }
});
