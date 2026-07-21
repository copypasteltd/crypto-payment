import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreatorApiClient,
  createSessionProjectsApiClient,
  createWorkshopCatalogApiClient,
} from "../dist/index.js";

const project = {
  sessionProjectId: "spj_mobile_creator",
  workspaceId: "wsp_mobile_creator",
  workspaceContextKey: "personal-mobile-creator",
  name: "Mobile creator recording",
  description: "",
  status: "DRAFT",
  sourceRunId: null,
  currentCaptureId: null,
  currentDraftId: null,
  currentSessionVersionId: null,
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
  createdByUserId: "usr_mobile_creator",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

test("session project client preserves caller idempotency keys and source approval mode", async () => {
  const requests = [];
  const client = createSessionProjectsApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "mobile-token",
    fetcher: async (input, init) => {
      requests.push({ input: String(input), init });
      const url = new URL(String(input));
      if (url.pathname.endsWith("/session-projects")) {
        return new Response(JSON.stringify(project), { status: 200 });
      }

      return new Response(
        JSON.stringify({
          sessionProject: { ...project, status: "RECORDING", sourceRunId: "run_mobile_creator" },
          run: {
            runId: "run_mobile_creator",
            workspaceId: "wsp_mobile_creator",
            runPurpose: "creator_source",
            sessionBootstrapMode: "blank",
            sessionProjectId: "spj_mobile_creator",
            taskVersionId: null,
            sessionVersionId: null,
            draftRevisionId: null,
            requestedByUserId: "usr_mobile_creator",
            title: "Mobile creator recording",
            targetPath: "/workspace/run_mobile_creator/target",
            entrySurface: "mini-program",
            approvalMode: "auto_all",
            status: "CREATED",
            statusReason: null,
            initialMessage: null,
            bindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
            providerSelection: null,
            catalogMetadata: null,
            createdAt: "2026-07-20T00:00:00.000Z",
            updatedAt: "2026-07-20T00:00:00.000Z",
          },
          nextPrompt: "Start recording",
        }),
        { status: 200 }
      );
    },
  });

  await client.create(
    { name: "Mobile creator recording" },
    { idempotencyKey: "mobile-project-stable-key" }
  );
  await client.createSourceRun(
    {
      sessionProjectId: "spj_mobile_creator",
      entrySurface: "mini-program",
      approvalMode: "auto_all",
    },
    { idempotencyKey: "mobile-source-run-stable-key" }
  );

  assert.equal(new Headers(requests[0].init.headers).get("idempotency-key"), "mobile-project-stable-key");
  assert.equal(new Headers(requests[1].init.headers).get("idempotency-key"), "mobile-source-run-stable-key");
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    sessionProjectId: "spj_mobile_creator",
    entrySurface: "mini-program",
    approvalMode: "auto_all",
    providerSelection: null,
    bindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
  });
});

test("creator package and release clients preserve caller idempotency keys", async () => {
  const requests = [];
  const client = createCreatorApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(
        JSON.stringify({ error: { code: "EXPECTED_TEST_FAILURE", message: "Captured" } }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    },
  });

  await assert.rejects(() => client.createPackage({
    packageId: "mobile-creator-package",
    title: { zh: "移动封装", en: "Mobile package" },
    description: { zh: "移动封装", en: "Mobile package" },
    workspaceContextKey: "personal-mobile-creator",
    linkedWorkshopIds: [],
    linkedServiceIds: [],
    currentTaskVersionId: null,
  }, { idempotencyKey: "mobile-package-stable-key" }));
  await assert.rejects(() => client.createPackageRelease("mobile-creator-package", {
    targetWorkspaceContextKey: "personal-mobile-creator",
    state: "production",
    channelLabel: { zh: "正式", en: "Production" },
    gateSummary: [],
  }, { idempotencyKey: "mobile-release-stable-key" }));

  assert.equal(new Headers(requests[0].init.headers).get("idempotency-key"), "mobile-package-stable-key");
  assert.equal(new Headers(requests[1].init.headers).get("idempotency-key"), "mobile-release-stable-key");
});

test("catalog bundle client preserves caller idempotency key", async () => {
  let request = null;
  const client = createWorkshopCatalogApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async (input, init) => {
      request = { input: String(input), init };
      return new Response(
        JSON.stringify({
          error: { code: "EXPECTED_TEST_FAILURE", message: "Stop after request capture" },
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    },
  });

  await assert.rejects(() => client.createWorkshopServiceBundle({
    sessionProjectId: "spj_mobile_creator",
    displayName: { zh: "移动工作流", en: "Mobile workflow" },
    summary: { zh: "移动端封装", en: "Mobile package" },
    audience: { zh: "当前工作区", en: "Current workspace" },
    nextStepSummary: { zh: "进入对话", en: "Open conversation" },
    scope: "personal",
    visibility: "workspace",
    coverAssetUrl: "/assets/logo.svg",
    tagList: ["agent"],
    service: {
      displayName: { zh: "移动工作流", en: "Mobile workflow" },
      summary: { zh: "移动端封装", en: "Mobile package" },
      authRequirementText: { zh: "工作区授权", en: "Workspace authorization" },
      estimatedDuration: "05-15 min",
      targetPathHint: "/workspace/",
      outputContractSummary: { zh: "输出到目标目录", en: "Write to target path" },
      requiredBindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      linkedInstanceHint: "run_mobile_creator",
    },
  }, { idempotencyKey: "mobile-catalog-stable-key" }));

  assert.equal(new Headers(request.init.headers).get("idempotency-key"), "mobile-catalog-stable-key");
});
