import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("blank Source Run starts without materializing a Session Pack", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lingban-blank-bootstrap-"));
  const original = new Map();
  const keys = [
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_RUNTIME_API_BASE_URL",
    "LINGBAN_RUNNER_DROP_ROOT_ENABLED",
  ];
  for (const key of keys) original.set(key, process.env[key]);

  try {
    process.env.LINGBAN_RUNS_DIR = path.join(root, "runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "docker";
    process.env.LINGBAN_API_BASE_URL = "http://127.0.0.1:1";
    process.env.LINGBAN_RUNTIME_API_BASE_URL = "http://127.0.0.1:1";
    process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED = "false";

    const { startRunJob } = await import("../dist/jobs/start-run.js");
    const result = await startRunJob({
      run: {
        runId: "run_blank_bootstrap",
        workspaceId: "wsp_blank_bootstrap",
        runPurpose: "creator_source",
        sessionBootstrapMode: "blank",
        sessionProjectId: "spj_blank_bootstrap",
        taskVersionId: null,
        sessionVersionId: null,
        draftRevisionId: null,
        requestedByUserId: "usr_blank_bootstrap",
        title: "Blank bootstrap",
        targetPath: path.join(root, "target"),
        entrySurface: "dashboard",
        catalogMetadata: null,
        status: "CREATED",
        statusReason: null,
        createdAt: "2026-07-17T08:00:00.000Z",
        updatedAt: "2026-07-17T08:00:00.000Z",
      },
      initialPrompt: "Wait for the Creator instruction.",
      requestedInitialMessage: null,
      bindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
      credentialMounts: [],
      mcpBindings: [],
      mcpNetworkPolicies: [],
      provider: null,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.payload.run.sessionBootstrapMode, "blank");
    assert.equal(result.containerLaunchPlan.labels["lingban.run_purpose"], "creator_source");
    assert.equal(result.containerLaunchPlan.labels["lingban.session_version_id"], "none");
    await stat(result.preparedWorkspace.hostPaths.targetPath);
    await assert.rejects(
      stat(path.join(result.preparedWorkspace.hostPaths.runtimePath, "session-pack")),
      { code: "ENOENT" }
    );
  } finally {
    for (const [key, value] of original.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
