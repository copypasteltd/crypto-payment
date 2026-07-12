import assert from "node:assert/strict";
import test from "node:test";
import { createSessionRefreshFetch } from "../dist/index.js";

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function buildSessionResponse(accessToken, refreshToken) {
  const timestamp = "2026-07-08T12:00:00.000Z";
  return {
    user: {
      userId: "usr_test_user",
      email: "owner@example.com",
      displayName: "Owner",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    session: {
      sessionId: "ses_test_session",
      userId: "usr_test_user",
      currentWorkspaceId: "wsp_brand_content",
      accessTokenExpiresAt: "2026-07-09T12:00:00.000Z",
      refreshTokenExpiresAt: "2026-07-10T12:00:00.000Z",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    currentWorkspace: {
      workspaceId: "wsp_brand_content",
      slug: "brand-content",
      name: "Brand Content",
      type: "enterprise",
      contextKey: "brand-lab",
      root: "/workspace/poster-batch-17/",
      role: "owner",
      membershipStatus: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    workspaces: [
      {
        workspaceId: "wsp_brand_content",
        slug: "brand-content",
        name: "Brand Content",
        type: "enterprise",
        contextKey: "brand-lab",
        root: "/workspace/poster-batch-17/",
        role: "owner",
        membershipStatus: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    tokens: {
      tokenType: "Bearer",
      accessToken,
      refreshToken,
      expiresInSeconds: 3600,
    },
  };
}

test("createSessionRefreshFetch refreshes once and replays concurrent 401 requests", async () => {
  let accessToken = "expired-access";
  let refreshToken = "refresh-token-1";
  let refreshCalls = 0;
  let applyCalls = 0;
  let failureCalls = 0;

  const fetcher = async (input, init) => {
    const url = String(input);
    const authorization = new Headers(init?.headers ?? undefined).get("authorization");

    if (url.endsWith("/v1/auth/refresh")) {
      refreshCalls += 1;
      assert.equal(authorization, null);
      assert.deepEqual(JSON.parse(String(init?.body ?? "{}")), {
        refreshToken: "refresh-token-1",
      });
      return jsonResponse(200, buildSessionResponse("fresh-access", "refresh-token-2"));
    }

    assert.equal(url, "http://example.test/v1/runs");

    if (authorization === "Bearer expired-access") {
      return new Response("expired", { status: 401 });
    }

    assert.equal(authorization, "Bearer fresh-access");
    return jsonResponse(200, { ok: true });
  };

  const authFetch = createSessionRefreshFetch({
    baseUrl: "http://example.test",
    fetcher,
    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,
    applySessionResponse(response) {
      applyCalls += 1;
      accessToken = response.tokens.accessToken;
      refreshToken = response.tokens.refreshToken;
    },
    onAuthFailure() {
      failureCalls += 1;
    },
  });

  const [first, second] = await Promise.all([
    authFetch("http://example.test/v1/runs"),
    authFetch("http://example.test/v1/runs"),
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(await first.json(), { ok: true });
  assert.deepEqual(await second.json(), { ok: true });
  assert.equal(refreshCalls, 1);
  assert.equal(applyCalls, 1);
  assert.equal(failureCalls, 0);
  assert.equal(accessToken, "fresh-access");
  assert.equal(refreshToken, "refresh-token-2");
});

test("createSessionRefreshFetch reports auth failure when refresh token is unavailable", async () => {
  let failureCalls = 0;

  const authFetch = createSessionRefreshFetch({
    baseUrl: "http://example.test",
    fetcher: async () => new Response("expired", { status: 401 }),
    getAccessToken: () => "expired-access",
    getRefreshToken: () => undefined,
    onAuthFailure(error) {
      failureCalls += 1;
      assert.ok(error instanceof Error);
    },
  });

  const response = await authFetch("http://example.test/v1/services");
  assert.equal(response.status, 401);
  assert.equal(failureCalls, 1);
});
