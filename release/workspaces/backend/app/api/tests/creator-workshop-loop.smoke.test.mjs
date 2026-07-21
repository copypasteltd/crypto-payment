import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function requestJson(url, init = {}, expectedStatus = null) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (expectedStatus == null) {
    assert.equal(response.ok, true, `${init.method ?? "GET"} ${url} failed: ${response.status} ${text}`);
  } else {
    assert.equal(response.status, expectedStatus, `${init.method ?? "GET"} ${url}: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function waitFor(load, predicate, label, timeoutMs = 45_000) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await load();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(lastValue)}`);
}

test("blank Source Run can be captured, sealed, published, consumed, and captured again", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-creator-loop-"));
  const fakeAppServerPath = fileURLToPath(new URL("./support/fake-codex-app-server.mjs", import.meta.url));
  const envKeys = [
    "API_HOST", "API_PORT", "LINGBAN_DATA_DIR", "LINGBAN_AUTH_MODE",
    "LINGBAN_RUNS_DIR", "LINGBAN_RUNTIME_LAUNCH_MODE", "LINGBAN_RUNTIME_DISPATCH_MODE",
    "LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS", "LINGBAN_TERMINAL_WORKSPACE_TTL_MS",
    "LINGBAN_API_BASE_URL", "LINGBAN_RUNTIME_API_BASE_URL", "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_OBJECT_STORAGE_DRIVER", "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_CREDENTIAL_BROKER_MASTER_KEY", "LINGBAN_PLATFORM_ADMIN_EMAILS",
    "LINGBAN_SESSION_PACK_SIGNATURE_ENABLED", "LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM",
    "LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID", "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET",
    "CODEX_BIN", "CODEX_RUNTIME_PROTOCOL", "CODEX_APP_SERVER_INCLUDE_DEFAULT_ARGS",
    "CODEX_APP_SERVER_REQUEST_TIMEOUT_MS", "LINGBAN_BRIDGE_ARGS",
  ];
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
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
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS = "15000";
    process.env.LINGBAN_TERMINAL_WORKSPACE_TTL_MS = "60000";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_RUNTIME_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "creator-loop-internal-token";
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_CREDENTIAL_BROKER_MASTER_KEY = "creator-loop-master-key";
    process.env.LINGBAN_PLATFORM_ADMIN_EMAILS = "creator-loop@example.com";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_ENABLED = "true";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM = "hmac-sha256";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID = "creator-loop-signing-key";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET = "creator-loop-signing-secret-at-least-32-bytes";
    process.env.CODEX_BIN = process.execPath;
    process.env.CODEX_RUNTIME_PROTOCOL = "app-server";
    process.env.CODEX_APP_SERVER_INCLUDE_DEFAULT_ARGS = "false";
    process.env.CODEX_APP_SERVER_REQUEST_TIMEOUT_MS = "10000";
    process.env.LINGBAN_BRIDGE_ARGS = JSON.stringify([fakeAppServerPath]);

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const auth = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "creator-loop@example.com",
        password: "TestPassword123!",
        displayName: "Creator Loop Owner",
        workspaceName: "Creator Loop Workspace",
      }),
    });
    const authHeader = { authorization: `Bearer ${auth.tokens.accessToken}` };
    const jsonHeaders = (idempotencyKey) => ({
      ...authHeader,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    });

    const provider = await requestJson(`${baseUrl}/v1/providers`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        displayName: "Creator Loop Provider",
        baseUrl: "https://provider.invalid/v1",
        defaultModel: "gpt-creator-loop",
      }),
    });
    const credential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Creator Loop Provider Key",
        provider: provider.providerId,
        secretKind: "api-key",
        mountMode: "env",
        envName: "OPENAI_API_KEY",
        secretValue: "creator-loop-provider-key",
      }),
    });
    await requestJson(`${baseUrl}/v1/provider-bindings`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        providerId: provider.providerId,
        credentialId: credential.credentialId,
        enabled: true,
        isDefault: true,
      }),
    });

    const project = await requestJson(`${baseUrl}/v1/creator/session-projects`, {
      method: "POST",
      headers: jsonHeaders("creator-loop-project"),
      body: JSON.stringify({
        name: "Creator full loop",
        description: "Continuous creator supply and consumption regression",
      }),
    });
    const source = await requestJson(`${baseUrl}/v1/creator/source-runs`, {
      method: "POST",
      headers: jsonHeaders("creator-loop-source-run"),
      body: JSON.stringify({
        sessionProjectId: project.sessionProjectId,
        title: project.name,
        approvalMode: "auto_all",
        entrySurface: "h5",
      }),
    });
    assert.equal(source.run.runPurpose, "creator_source");
    assert.equal(source.run.sessionBootstrapMode, "blank");
    assert.equal(source.run.sessionVersionId, null);
    assert.equal(source.run.approvalMode, "auto_all");

    await waitFor(
      () => requestJson(`${baseUrl}/v1/runs/${source.run.runId}`, { headers: authHeader }),
      (snapshot) => snapshot.run.status === "RUNNING" && snapshot.agentThread?.connectionState === "ready",
      "blank Source Run App Server readiness"
    );
    await requestJson(`${baseUrl}/v1/runs/${source.run.runId}/messages`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ text: "执行并记录这一条可复用工作流。", attachments: [] }),
    });
    const sourceConversation = await waitFor(
      () => requestJson(`${baseUrl}/v1/runs/${source.run.runId}`, { headers: authHeader }),
      (snapshot) =>
        snapshot.agentThread?.currentTurnState === "completed" &&
        snapshot.messages.some((message) => message.role === "agent" && message.text.includes("业务信息")),
      "Source Run completed conversation turn"
    );

    const sourceCapture = await requestJson(`${baseUrl}/v1/runs/${source.run.runId}/session-captures`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        mode: "checkpoint",
        throughTurnId: sourceConversation.agentThread.currentTurnId,
        workspaceSelection: {
          targetPath: source.run.targetPath,
          includeGlobs: ["**/*"],
          excludeGlobs: [".git/**", "**/node_modules/**", "**/.env*"],
          includeArtifacts: true,
          maxFiles: 1000,
          maxBytes: 10 * 1024 * 1024,
        },
        destinationSessionId: null,
        createDraft: true,
        idempotencyKey: `creator-loop:${source.run.runId}:${sourceConversation.agentThread.currentTurnId}`,
      }),
    }, 202);
    const captured = await waitFor(
      () => requestJson(`${baseUrl}${sourceCapture.statusUrl}`, { headers: authHeader }),
      (capture) => capture.status === "CAPTURED",
      "Source Run Capture"
    );
    assert.equal(captured.objects.length, 5);
    assert.equal(captured.fileCount >= 1, true);

    const projectWithDraft = await waitFor(
      () => requestJson(`${baseUrl}/v1/creator/session-projects/${project.sessionProjectId}`, { headers: authHeader }),
      (value) => Boolean(value.currentDraftId) && value.status === "EDITING",
      "automatic Draft creation"
    );
    const draftDetail = await waitFor(
      () => requestJson(`${baseUrl}/v1/session-drafts/${projectWithDraft.currentDraftId}`, { headers: authHeader }),
      (detail) => detail.revisions.length === 1 && detail.draft.status === "redaction_pending",
      "initial Draft Revision"
    );
    const revision = draftDetail.revisions[0];
    assert.equal(revision.securityReport.passed, true);

    const reviewed = await requestJson(`${baseUrl}/v1/session-drafts/${draftDetail.draft.draftId}/redaction-review`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        expectedVersion: draftDetail.draft.version,
        revisionId: revision.revisionId,
        decision: "approved",
        note: "Creator loop redaction review passed",
      }),
    });
    const replayed = await requestJson(`${baseUrl}/v1/session-drafts/${draftDetail.draft.draftId}/replay`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        expectedVersion: reviewed.draft.version,
        revisionId: revision.revisionId,
      }),
    });
    assert.equal(replayed.replay.status, "passed");
    const sealed = await requestJson(`${baseUrl}/v1/session-drafts/${draftDetail.draft.draftId}/seal`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        expectedVersion: replayed.draft.version,
        revisionId: revision.revisionId,
        replayId: replayed.replay.replayId,
        signingPolicyId: "creator-loop-signing-policy",
      }),
    });
    const sealedProject = await requestJson(
      `${baseUrl}/v1/creator/session-projects/${project.sessionProjectId}`,
      { headers: authHeader }
    );
    assert.equal(sealedProject.status, "SEALED");
    assert.equal(sealedProject.currentSessionVersionId, sealed.version.sessionVersionId);

    const bundle = await requestJson(`${baseUrl}/v1/workshops`, {
      method: "POST",
      headers: jsonHeaders(`mobile:${project.sessionProjectId}:catalog-bundle`),
      body: JSON.stringify({
        sessionProjectId: project.sessionProjectId,
        displayName: { zh: "Creator 全链工坊", en: "Creator Full Loop Workshop" },
        summary: { zh: "连续闭环验证", en: "Continuous loop verification" },
        audience: { zh: "工作区成员", en: "Workspace members" },
        nextStepSummary: { zh: "启动服务并进入对话", en: "Launch the service into conversation" },
        scope: "personal",
        visibility: "workspace",
        coverAssetUrl: "/assets/logo.svg",
        tagList: ["creator", "loop"],
        service: {
          displayName: { zh: "Creator 全链服务", en: "Creator Full Loop Service" },
          summary: { zh: "从密封 Session 启动", en: "Launches from a sealed Session" },
          authRequirementText: { zh: "工作区 Provider", en: "Workspace Provider" },
          estimatedDuration: "05-15 min",
          targetPathHint: source.run.targetPath,
          outputContractSummary: { zh: "输出到 Target Path", en: "Writes to Target Path" },
          requiredBindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
          linkedInstanceHint: source.run.runId,
        },
      }),
    });
    assert.equal(bundle.taskVersion.sessionVersionId, sealed.version.sessionVersionId);

    const packageId = "creator-full-loop-package";
    const creatorPackage = await requestJson(`${baseUrl}/v1/packages`, {
      method: "POST",
      headers: jsonHeaders("creator-loop-package"),
      body: JSON.stringify({
        packageId,
        title: { zh: "Creator 全链包", en: "Creator Full Loop Package" },
        description: { zh: "连续闭环包", en: "Continuous loop package" },
        workspaceContextKey: auth.currentWorkspace.contextKey,
        linkedWorkshopIds: [bundle.workshop.workshopId],
        linkedServiceIds: [bundle.service.serviceId],
        currentTaskVersionId: bundle.taskVersion.taskVersionId,
      }),
    });
    const replayedPackage = await requestJson(`${baseUrl}/v1/packages`, {
      method: "POST",
      headers: jsonHeaders("creator-loop-package"),
      body: JSON.stringify({
        packageId,
        title: { zh: "Creator 全链包", en: "Creator Full Loop Package" },
        description: { zh: "连续闭环包", en: "Continuous loop package" },
        workspaceContextKey: auth.currentWorkspace.contextKey,
        linkedWorkshopIds: [bundle.workshop.workshopId],
        linkedServiceIds: [bundle.service.serviceId],
        currentTaskVersionId: bundle.taskVersion.taskVersionId,
      }),
    });
    assert.equal(replayedPackage.packageId, creatorPackage.packageId);
    await requestJson(`${baseUrl}/v1/packages/${packageId}/session-binding`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionVersionId: sealed.version.sessionVersionId,
        state: "candidate",
        expectedVersion: 0,
      }),
    });
    const packagedProject = await requestJson(
      `${baseUrl}/v1/creator/session-projects/${project.sessionProjectId}`,
      { headers: authHeader }
    );
    assert.equal(packagedProject.status, "PACKAGED");
    assert.equal(packagedProject.packageId, packageId);

    const releaseBody = {
      targetWorkspaceContextKey: auth.currentWorkspace.contextKey,
      state: "production",
      channelLabel: { zh: "正式发布", en: "Production" },
      gateSummary: [{ zh: "全链发布检查", en: "Full loop release checks" }],
    };
    const release = await requestJson(`${baseUrl}/v1/packages/${packageId}/releases`, {
      method: "POST",
      headers: jsonHeaders("creator-loop-release"),
      body: JSON.stringify(releaseBody),
    });
    const replayedRelease = await requestJson(`${baseUrl}/v1/packages/${packageId}/releases`, {
      method: "POST",
      headers: jsonHeaders("creator-loop-release"),
      body: JSON.stringify(releaseBody),
    });
    assert.equal(replayedRelease.releaseId, release.releaseId);
    const gates = await requestJson(`${baseUrl}/v1/releases/${release.releaseId}/gates`, {
      headers: authHeader,
    });
    assert.equal(gates.length, 4);
    for (const gate of gates) {
      await requestJson(`${baseUrl}/v1/releases/${release.releaseId}/gates/${gate.gateId}/decide`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          status: "passed",
          evidenceRef: `creator-loop://${gate.gateType}/${sealed.version.sessionVersionId}`,
          note: { zh: `${gate.gateType} 已验证`, en: `${gate.gateType} verified` },
          checklist: gate.checklist.map((item) => ({ ...item, status: "passed" })),
        }),
      });
    }
    const activation = await requestJson(`${baseUrl}/v1/releases/${release.releaseId}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ note: { zh: "全链激活", en: "Full loop activation" } }),
    });
    assert.equal(activation.state, "active");

    const publishedProject = await requestJson(
      `${baseUrl}/v1/creator/session-projects/${project.sessionProjectId}`,
      { headers: authHeader }
    );
    assert.equal(publishedProject.status, "PUBLISHED");

    const attacker = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "creator-loop-attacker@example.com",
        password: "TestPassword123!",
        displayName: "Creator Loop Attacker",
        workspaceName: "Attacker Personal Workspace",
      }),
    });
    assert.equal(attacker.currentWorkspace.contextKey, auth.currentWorkspace.contextKey);
    assert.notEqual(attacker.currentWorkspace.workspaceId, auth.currentWorkspace.workspaceId);
    const attackerAuthHeader = {
      authorization: `Bearer ${attacker.tokens.accessToken}`,
    };
    const attackerJsonHeaders = {
      ...attackerAuthHeader,
      "content-type": "application/json",
    };
    const attackerCatalogQuery = new URLSearchParams({
      workspaceContextKey: attacker.currentWorkspace.contextKey,
      workspaceId: attacker.currentWorkspace.workspaceId,
      entrySurface: "h5",
    });

    const attackerPackages = await requestJson(`${baseUrl}/v1/packages`, {
      headers: attackerAuthHeader,
    });
    assert.equal(attackerPackages.some((item) => item.packageId === packageId), false);
    assert.equal(
      attackerPackages.every((item) => item.workspaceIds.includes(attacker.currentWorkspace.workspaceId)),
      true
    );
    await requestJson(`${baseUrl}/v1/packages/${packageId}`, {
      headers: attackerAuthHeader,
    }, 404);
    await requestJson(`${baseUrl}/v1/packages/${packageId}/session-binding`, {
      headers: attackerAuthHeader,
    }, 404);
    await requestJson(`${baseUrl}/v1/session-drafts/${draftDetail.draft.draftId}`, {
      headers: attackerAuthHeader,
    }, 403);

    const attackerWorkshops = await requestJson(
      `${baseUrl}/v1/workshops?${attackerCatalogQuery}`,
      { headers: attackerAuthHeader }
    );
    assert.equal(
      attackerWorkshops.some((item) => item.workshopId === bundle.workshop.workshopId),
      false
    );
    await requestJson(
      `${baseUrl}/v1/workshops/${bundle.workshop.workshopId}?${attackerCatalogQuery}`,
      { headers: attackerAuthHeader },
      404
    );
    await requestJson(
      `${baseUrl}/v1/services/${bundle.service.serviceId}?${attackerCatalogQuery}`,
      { headers: attackerAuthHeader },
      404
    );
    await requestJson(`${baseUrl}/v1/services/${bundle.service.serviceId}/launch-template`, {
      method: "POST",
      headers: attackerJsonHeaders,
      body: JSON.stringify({
        workspaceContextKey: attacker.currentWorkspace.contextKey,
        workspaceId: attacker.currentWorkspace.workspaceId,
        entrySurface: "h5",
      }),
    }, 404);

    const workshops = await requestJson(
      `${baseUrl}/v1/workshops?workspaceContextKey=${encodeURIComponent(auth.currentWorkspace.contextKey)}&workspaceId=${encodeURIComponent(auth.currentWorkspace.workspaceId)}&entrySurface=h5`,
      { headers: authHeader }
    );
    assert.equal(workshops.some((item) => item.workshopId === bundle.workshop.workshopId), true);

    const launchTemplate = await requestJson(`${baseUrl}/v1/services/${bundle.service.serviceId}/launch-template`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        workspaceContextKey: auth.currentWorkspace.contextKey,
        workspaceId: auth.currentWorkspace.workspaceId,
        entrySurface: "h5",
      }),
    });
    assert.equal(launchTemplate.sessionVersionId, sealed.version.sessionVersionId);
    const consumer = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(launchTemplate.createRunInput),
    });
    assert.equal(consumer.run.runPurpose, "service_consumer");
    assert.equal(consumer.run.sessionVersionId, sealed.version.sessionVersionId);
    const consumerConversation = await waitFor(
      () => requestJson(`${baseUrl}/v1/runs/${consumer.run.runId}`, { headers: authHeader }),
      (snapshot) =>
        snapshot.agentThread?.currentTurnState === "completed" &&
        snapshot.messages.some((message) => message.role === "agent" && message.text.includes("业务信息")),
      "Consumer Run inherited-session conversation"
    );

    const consumerCapture = await requestJson(`${baseUrl}/v1/runs/${consumer.run.runId}/session-captures`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        mode: "checkpoint",
        throughTurnId: consumerConversation.agentThread.currentTurnId,
        workspaceSelection: {
          targetPath: consumer.run.targetPath,
          includeGlobs: ["**/*"],
          excludeGlobs: [".git/**", "**/node_modules/**", "**/.env*"],
          includeArtifacts: true,
          maxFiles: 1000,
          maxBytes: 10 * 1024 * 1024,
        },
        destinationSessionId: null,
        createDraft: true,
        idempotencyKey: `consumer-loop:${consumer.run.runId}:${consumerConversation.agentThread.currentTurnId}`,
      }),
    }, 202);
    const completedConsumerCapture = await waitFor(
      () => requestJson(`${baseUrl}${consumerCapture.statusUrl}`, { headers: authHeader }),
      (capture) => capture.status === "CAPTURED",
      "Consumer Run Capture"
    );
    const consumerDraft = await waitFor(
      () => requestJson(`${baseUrl}/v1/session-drafts`, { headers: authHeader }),
      (result) => result.items.find((item) => item.sourceCaptureId === completedConsumerCapture.captureId),
      "Consumer Capture Draft"
    );
    const consumerDraftRecord = consumerDraft.items.find(
      (item) => item.sourceCaptureId === completedConsumerCapture.captureId
    );
    const consumerDraftDetail = await waitFor(
      () => requestJson(`${baseUrl}/v1/session-drafts/${consumerDraftRecord.draftId}`, { headers: authHeader }),
      (detail) => detail.revisions.length >= 1,
      "Consumer Draft Revision"
    );
    assert.equal(consumerDraftDetail.revisions[0].securityReport.passed, true);

    const originalVersion = await requestJson(
      `${baseUrl}/v1/session-versions/${sealed.version.sessionVersionId}`,
      { headers: authHeader }
    );
    assert.equal(originalVersion.packSha256, sealed.version.packSha256);
    assert.equal(originalVersion.contentState, "sealed");
  } finally {
    if (app) await app.close().catch(() => undefined);
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
