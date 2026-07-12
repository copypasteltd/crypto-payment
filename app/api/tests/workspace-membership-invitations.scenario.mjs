import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createFakePostgresPool } from "./support/fake-postgres-pool.mjs";

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

function buildAuthHeaders(accessToken, includeJson = false) {
  return {
    authorization: `Bearer ${accessToken}`,
    ...(includeJson ? { "content-type": "application/json" } : {}),
  };
}

async function main() {
  const storage = process.argv.includes("--storage=postgres") ? "postgres" : "file";
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), `lingban-workspace-invitations-${storage}-`));
  let app = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

    if (storage === "postgres") {
      process.env.DATABASE_URL = "postgres://fake/lingban";
      process.env.LINGBAN_AUTH_STORE = "postgres";
      const { setApiDatabasePoolFactoryForTests } = await import("../dist/app/database.js");
      setApiDatabasePoolFactoryForTests(() => createFakePostgresPool());
    } else {
      delete process.env.DATABASE_URL;
      process.env.LINGBAN_AUTH_STORE = "file";
    }

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const owner = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: `owner-${storage}@example.com`,
        password: "OwnerPass#2026!",
        displayName: `Owner ${storage}`,
        workspaceName: `Governance ${storage}`,
      }),
    });

    const workspaceId = owner.currentWorkspace.workspaceId;
    const ownerHeaders = buildAuthHeaders(owner.tokens.accessToken);
    const ownerJsonHeaders = buildAuthHeaders(owner.tokens.accessToken, true);

    const initialMembers = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
      {
        headers: ownerHeaders,
      }
    );
    assert.equal(initialMembers.length, 1);
    assert.equal(initialMembers[0].membership.role, "owner");

    const firstInvitation = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      {
        method: "POST",
        headers: ownerJsonHeaders,
        body: JSON.stringify({
          email: `invited-${storage}@example.com`,
          role: "creator",
          note: "Creator onboarding",
          expiresInDays: 14,
        }),
      }
    );
    assert.equal(firstInvitation.invitation.invitation.status, "pending");
    assert.equal(typeof firstInvitation.acceptToken, "string");
    const firstInvitationId = firstInvitation.invitation.invitation.invitationId;

    const revokeCandidate = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      {
        method: "POST",
        headers: ownerJsonHeaders,
        body: JSON.stringify({
          email: `revoked-${storage}@example.com`,
          role: "viewer",
          note: "Temporary invite",
        }),
      }
    );
    const revokeCandidateId = revokeCandidate.invitation.invitation.invitationId;

    const invitationsBeforeAccept = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      {
        headers: ownerHeaders,
      }
    );
    assert.equal(invitationsBeforeAccept.length, 2);

    const revokedInvitation = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(revokeCandidateId)}/revoke`,
      {
        method: "POST",
        headers: ownerHeaders,
      }
    );
    assert.equal(revokedInvitation.invitation.status, "revoked");

    const invited = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: `invited-${storage}@example.com`,
        password: "InvitedPass#2026!",
        displayName: `Invited ${storage}`,
        workspaceName: `Invited ${storage} Personal`,
      }),
    });

    const invitedHeaders = buildAuthHeaders(invited.tokens.accessToken);
    const invitedJsonHeaders = buildAuthHeaders(invited.tokens.accessToken, true);

    const myInvitations = await requestJson(`${baseUrl}/v1/auth/invitations`, {
      headers: invitedHeaders,
    });
    assert.equal(
      myInvitations.some(
        (item) =>
          item.invitation.invitationId === firstInvitationId &&
          item.invitation.status === "pending"
      ),
      true
    );

    const accepted = await requestJson(
      `${baseUrl}/v1/auth/invitations/${encodeURIComponent(firstInvitationId)}/accept`,
      {
        method: "POST",
        headers: invitedJsonHeaders,
        body: JSON.stringify({
          acceptToken: firstInvitation.acceptToken,
        }),
      }
    );
    assert.equal(accepted.invitation.invitation.status, "accepted");
    assert.equal(
      accepted.session.workspaces.some((workspace) => workspace.workspaceId === workspaceId),
      true
    );

    const membersAfterAccept = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
      {
        headers: ownerHeaders,
      }
    );
    const invitedMembership = membersAfterAccept.find(
      (item) => item.user.userId === invited.user.userId
    );
    assert.ok(invitedMembership);
    assert.equal(invitedMembership.membership.role, "creator");

    const updatedMembership = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(invited.user.userId)}`,
      {
        method: "PATCH",
        headers: ownerJsonHeaders,
        body: JSON.stringify({
          role: "viewer",
        }),
      }
    );
    assert.equal(updatedMembership.membership.role, "viewer");

    const invitedWorkspaceMembers = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
      {
        headers: invitedHeaders,
      }
    );
    assert.equal(invitedWorkspaceMembers.length, 2);

    const finalInvitations = await requestJson(
      `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      {
        headers: ownerHeaders,
      }
    );
    const invitationStatusById = Object.fromEntries(
      finalInvitations.map((item) => [item.invitation.invitationId, item.invitation.status])
    );

    console.log(
      JSON.stringify({
        storage,
        workspaceId,
        memberCount: invitedWorkspaceMembers.length,
        invitedRole: updatedMembership.membership.role,
        acceptedInvitationStatus: invitationStatusById[firstInvitationId],
        revokedInvitationStatus: invitationStatusById[revokeCandidateId],
        myInvitationCount: myInvitations.length,
      })
    );
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    if (storage === "postgres") {
      const { resetApiDatabaseForTests } = await import("../dist/app/database.js");
      await resetApiDatabaseForTests();
    }

    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

await main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
