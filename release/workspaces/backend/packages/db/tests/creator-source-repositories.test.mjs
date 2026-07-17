import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemorySessionProjectsRepository,
  InMemoryTaskVersionsRepository,
} from "../dist/index.js";

const at = "2026-07-17T10:00:00.000Z";

function createProject() {
  return {
    sessionProjectId: "spj_repository_test",
    workspaceId: "wsp_repository_test",
    workspaceContextKey: "personal",
    name: "Repository test",
    description: "",
    status: "SEALED",
    sourceRunId: "run_repository_test",
    currentCaptureId: "cap_repository_test",
    currentDraftId: "sdf_repository_test",
    currentSessionVersionId: "sev_repository_test",
    packageId: null,
    workshopId: null,
    serviceId: null,
    sourceProviderSelection: null,
    sourceBindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
    version: 1,
    createdByUserId: "usr_repository_test",
    createdAt: at,
    updatedAt: at,
  };
}

function createTaskVersion(overrides = {}) {
  return {
    taskVersionId: "tsv_repository_test",
    serviceId: "svc_repository_test",
    workshopId: "wks_repository_test",
    workspaceId: "wsp_repository_test",
    workspaceContextKey: "personal",
    sessionProjectId: "spj_repository_test",
    sessionVersionId: "sev_repository_test",
    versionNumber: 1,
    title: { zh: "测试", en: "Test" },
    targetRoot: "/workspace/test/",
    requiredBindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
    allowedEntrySurfaces: ["dashboard", "h5"],
    contentSha256: "a".repeat(64),
    createdByUserId: "usr_repository_test",
    createdAt: at,
    ...overrides,
  };
}

test("Session Project repository enforces optimistic updates and version lookup", async () => {
  const repository = new InMemorySessionProjectsRepository();
  const created = await repository.create(createProject());
  assert.equal((await repository.findBySessionVersionId("sev_repository_test"))?.sessionProjectId, created.sessionProjectId);

  const updated = await repository.update({
    ...created,
    packageId: "pkg_repository_test",
    status: "PACKAGED",
    version: 2,
  }, 1);
  assert.equal(updated?.status, "PACKAGED");
  assert.equal(await repository.update({ ...updated, version: 3 }, 1), null);
});

test("Task Version repository preserves immutable IDs, version numbers, and content", async () => {
  const repository = new InMemoryTaskVersionsRepository();
  const created = await repository.create(createTaskVersion());
  assert.equal((await repository.get(created.taskVersionId))?.contentSha256, "a".repeat(64));
  assert.equal((await repository.create(createTaskVersion())).taskVersionId, created.taskVersionId);
  await assert.rejects(
    repository.create(createTaskVersion({ contentSha256: "b".repeat(64) })),
    /immutable conflict/
  );
  await assert.rejects(
    repository.create(createTaskVersion({ taskVersionId: "tsv_repository_second", contentSha256: "c".repeat(64) })),
    /Version number already exists/
  );
});
