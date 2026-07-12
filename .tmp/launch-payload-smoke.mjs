import { buildApiApp } from "../app/api/dist/index.js";
import { runsService } from "../app/api/dist/modules/runs/service.js";
import { buildRunWorker } from "../app/run-worker/dist/index.js";

const app = await buildApiApp();
await app.ready();

const createResponse = await app.inject({
  method: "POST",
  url: "/v1/runs",
  payload: {
    workspaceId: "wsp_brand_content",
    taskVersionId: "tsv_drama_storyboard",
    sessionVersionId: "sev_creator_drama_suite",
    title: "短剧分镜生成与审校",
    targetPath: "/workspace/runs/drama-storyboard-smoke/",
    entrySurface: "dashboard",
    initialMessage: "我已经上传了第一版剧情梗概，请直接告诉我还缺什么。",
    bindings: {
      firstPartyMcpIds: ["mcp.image.gpt-image-2"],
      externalConnectorRefs: ["workspace:seedance-api", "third-party:figma-mcp"],
      credentialIds: ["cred_openai_image_api_key", "cred_seedance_api_key", "cred_figma_pat"],
    },
  },
});

const created = JSON.parse(createResponse.body);
const startJob = runsService.getStartRunJobPayload(created.run.runId);
const worker = buildRunWorker();
const bridgeContext = worker.buildBridgeSessionContext(startJob);

console.log(
  JSON.stringify(
    {
      runId: created.run.runId,
      createStatus: createResponse.statusCode,
      requestedInitialMessage: startJob.requestedInitialMessage,
      credentialMounts: startJob.credentialMounts,
      mcpBindings: startJob.mcpBindings.map((binding) => ({
        bindingId: binding.bindingId,
        source: binding.source,
        transport: binding.transport,
        authMode: binding.authMode,
        authRef: binding.authRef,
      })),
      bridgeContext: {
        initialPrompt: bridgeContext.initialPrompt.split("\n")[0],
        requestedInitialMessage: bridgeContext.requestedInitialMessage,
        credentialMountCount: bridgeContext.credentialMounts.length,
        mcpBindingCount: bridgeContext.mcpBindings.length,
      },
    },
    null,
    2
  )
);

await app.close();
