import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
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

async function requestJson(url, init = {}, expectedStatus = 200) {
  const response = await fetch(url, init);
  const text = await response.text();
  assert.equal(response.status, expectedStatus, `${init.method ?? "GET"} ${url}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

test("conversation shares freeze run and capture boundaries, persist media, audit access, and revoke", async () => {
  const testRoot = path.join(process.cwd(), ".tmp-tests");
  await mkdir(testRoot, { recursive: true });
  const root = await mkdtemp(path.join(testRoot, "lingban-conversation-share-"));
  const keys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_RUNTIME_DISPATCH_MODE",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_RUNS_ROOT",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  let app = null;
  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(root, "data");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(root, "objects");
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_RUNS_ROOT = path.join(root, "runs");

    const [{ startApiServer }, contracts, db, { runsRepository }] = await Promise.all([
      import("../dist/index.js"),
      import("../../../packages/contracts/dist/index.js"),
      import("../../../packages/db/dist/index.js"),
      import("../dist/modules/runs/repository.js"),
    ]);
    app = await startApiServer();
    const [{ sessionCaptureRepository }, { conversationSharesService }] = await Promise.all([
      import("../dist/modules/session-captures/repository.js"),
      import("../dist/modules/conversation-shares/service.js"),
    ]);

    const targetPath = path.join(root, "runs", "run_share_test", "target");
    await mkdir(targetPath, { recursive: true });
    const imageBytes = Buffer.from("share-image-content", "utf8");
    await writeFile(path.join(targetPath, "result.png"), imageBytes);
    const at = "2026-07-24T01:00:00.000Z";
    const input = contracts.createRunInputSchema.parse({
      workspaceId: "wsp_share_test",
      taskVersionId: "tsv_share_test",
      sessionVersionId: "sev_share_test",
      title: "Read-only share test",
      targetPath,
      entrySurface: "mini-program",
      bindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
    });
    const run = contracts.runRecordSchema.parse({
      runId: "run_share_test",
      workspaceId: input.workspaceId,
      taskVersionId: input.taskVersionId,
      sessionVersionId: input.sessionVersionId,
      title: input.title,
      targetPath,
      entrySurface: input.entrySurface,
      status: "RUNNING",
      statusReason: null,
      createdAt: at,
      updatedAt: "2026-07-24T01:04:00.000Z",
    });
    const messages = [
      contracts.runConversationMessageSchema.parse({
        messageId: "msg_share_system",
        runId: run.runId,
        role: "system",
        kind: "status",
        text: `工作目录 ${targetPath} apiKey=sk-secret-value-123456789`,
        createdAt: "2026-07-24T01:01:00.000Z",
      }),
      contracts.runConversationMessageSchema.parse({
        messageId: "msg_share_user",
        runId: run.runId,
        role: "user",
        kind: "text",
        text: "生成结果图",
        threadId: "thread_share",
        turnId: "turn_share_1",
        createdAt: "2026-07-24T01:02:00.000Z",
      }),
      contracts.runConversationMessageSchema.parse({
        messageId: "msg_share_agent",
        runId: run.runId,
        role: "agent",
        kind: "result",
        text: "已完成\n![结果图](./result.png)",
        threadId: "thread_share",
        turnId: "turn_share_1",
        createdAt: "2026-07-24T01:03:00.000Z",
      }),
      contracts.runConversationMessageSchema.parse({
        messageId: "msg_share_later",
        runId: run.runId,
        role: "user",
        kind: "text",
        text: "这是检查点后的消息",
        threadId: "thread_share",
        turnId: "turn_share_2",
        createdAt: "2026-07-24T01:04:00.000Z",
      }),
    ];
    await runsRepository.save(db.runAggregateSchema.parse({
      run,
      lifecycle: { runtimeStatus: "ACTIVE" },
      input,
      startJob: {
        run,
        initialPrompt: "Share test",
        requestedInitialMessage: null,
        bindings: input.bindings,
      },
      messages,
      files: [],
      artifacts: [],
      approvals: [],
    }));

    const captureId = "cap_share_test";
    await sessionCaptureRepository.create({
      idempotencyKey: "conversation-share-capture",
      requestedTurnId: "turn_share_1",
      record: contracts.sessionCaptureRecordSchema.parse({
        captureId,
        runId: run.runId,
        workspaceId: run.workspaceId,
        requestedByUserId: null,
        mode: "checkpoint",
        requestedThroughTurnId: "turn_share_1",
        status: "CAPTURED",
        workspaceSelection: { targetPath },
        boundary: {
          threadId: "thread_share",
          throughTurnId: "turn_share_1",
          eventHighWatermark: 4,
          barrierReachedAt: "2026-07-24T01:03:10.000Z",
        },
        securityState: "clean",
        objects: [],
        messageCount: 3,
        requestedAt: "2026-07-24T01:03:10.000Z",
        updatedAt: "2026-07-24T01:03:20.000Z",
        capturedAt: "2026-07-24T01:03:20.000Z",
      }),
    });

    const created = await requestJson(`${baseUrl}/v1/runs/${run.runId}/conversation-shares`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "run",
        captureId: null,
        title: "Current conversation",
        accessScope: "public_link",
        invitedUserIds: [],
        expiresAt: "2026-07-30T01:00:00.000Z",
        includeSystemMessages: true,
        includeAttachments: true,
        idempotencyKey: "conversation-share-run-test",
      }),
    }, 201);
    assert.equal(created.view.messages.length, 4);
    assert.equal(created.view.files.length, 1);
    assert.equal(created.view.files[0].kind, "image");
    assert.match(created.view.messages[0].text, /\[工作区\]/);
    assert.doesNotMatch(created.view.messages[0].text, /sk-secret/);

    const publicView = await requestJson(
      `${baseUrl}/v1/conversation-shares/public/${created.share.shareId}`
    );
    assert.equal(publicView.share.status, "active");
    for (const internalField of [
      "runId",
      "workspaceId",
      "captureId",
      "invitedUserIds",
      "boundaryMessageId",
      "boundaryTurnId",
      "createdByUserId",
    ]) {
      assert.equal(internalField in publicView.share, false);
    }
    const fileResponse = await fetch(`${baseUrl}${publicView.files[0].contentPath}`);
    assert.equal(fileResponse.status, 200);
    assert.deepEqual(Buffer.from(await fileResponse.arrayBuffer()), imageBytes);

    const captureShare = await requestJson(`${baseUrl}/v1/runs/${run.runId}/conversation-shares`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "session_capture",
        captureId,
        title: "Checkpoint conversation",
        accessScope: "public_link",
        invitedUserIds: [],
        expiresAt: null,
        includeSystemMessages: true,
        includeAttachments: false,
        idempotencyKey: "conversation-share-capture-test",
      }),
    }, 201);
    assert.equal(captureShare.view.messages.length, 3);
    assert.equal(captureShare.view.messages.at(-1).messageId, "msg_share_agent");

    const workspaceShare = await requestJson(`${baseUrl}/v1/runs/${run.runId}/conversation-shares`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "run",
        captureId: null,
        title: "Workspace conversation",
        accessScope: "workspace",
        invitedUserIds: [],
        expiresAt: null,
        includeSystemMessages: false,
        includeAttachments: false,
        idempotencyKey: "conversation-share-workspace-test",
      }),
    }, 201);
    const workspaceDenied = await requestJson(
      `${baseUrl}/v1/conversation-shares/public/${workspaceShare.share.shareId}`,
      {},
      401
    );
    assert.equal(workspaceDenied.error.code, "CONVERSATION_SHARE_AUTH_REQUIRED");
    const workspaceView = await conversationSharesService.getSharedView(
      workspaceShare.share.shareId,
      {
        actor: { userId: "usr_share_member", workspaceIds: [run.workspaceId] },
        clientFingerprint: null,
      }
    );
    assert.equal(workspaceView.messages.some((message) => message.role === "system"), false);

    const invitedShare = await requestJson(`${baseUrl}/v1/runs/${run.runId}/conversation-shares`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: "run",
        captureId: null,
        title: "Invited conversation",
        accessScope: "invited_users",
        invitedUserIds: ["usr_share_invited"],
        expiresAt: null,
        includeSystemMessages: true,
        includeAttachments: false,
        idempotencyKey: "conversation-share-invited-test",
      }),
    }, 201);
    await assert.rejects(
      () => conversationSharesService.getSharedView(invitedShare.share.shareId, {
        actor: { userId: "usr_share_other", workspaceIds: [run.workspaceId] },
        clientFingerprint: null,
      }),
      (error) => error?.code === "CONVERSATION_SHARE_INVITEE_FORBIDDEN"
    );
    const invitedView = await conversationSharesService.getSharedView(
      invitedShare.share.shareId,
      {
        actor: { userId: "usr_share_invited", workspaceIds: [] },
        clientFingerprint: null,
      }
    );
    assert.equal(invitedView.share.accessScope, "invited_users");

    const audit = await requestJson(
      `${baseUrl}/v1/conversation-shares/${created.share.shareId}/access-audit`
    );
    assert.equal(audit.items.length, 2);
    assert.deepEqual(new Set(audit.items.map((item) => item.accessType)), new Set(["view", "file"]));

    await requestJson(
      `${baseUrl}/v1/conversation-shares/${created.share.shareId}/revoke`,
      { method: "POST" }
    );
    const revoked = await requestJson(
      `${baseUrl}/v1/conversation-shares/public/${created.share.shareId}`,
      {},
      410
    );
    assert.equal(revoked.error.code, "CONVERSATION_SHARE_REVOKED");
  } finally {
    if (app) await app.close();
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
