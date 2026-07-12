import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

async function requestWithStatus(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    body: text ? JSON.parse(text) : null,
  };
}

async function seedCatalogAndCreatorState(storageRoot) {
  const catalogState = {
    contexts: [
      {
        contextKey: "brand-lab",
        runtimeWorkspaceId: "wsp_brand_content",
        displayName: {
          zh: "品牌内容组",
          en: "Brand Content Team",
        },
        type: "enterprise",
        meta: {
          zh: "内容编辑 / 已连接 3 项能力",
          en: "Content editors / 3 mounted capabilities",
        },
        root: "/workspace/poster-batch-17/",
        allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
      },
    ],
    workshops: [
      {
        workshopId: "brand-poster-suite",
        scope: "creative",
        status: "active",
        visibility: "workspace",
        displayName: {
          zh: "品牌内容工坊",
          en: "Brand Content Workshop",
        },
        ownerLabel: {
          zh: "品牌内容组",
          en: "Brand Content Team",
        },
        badge: {
          zh: "创意线",
          en: "Creative",
        },
        audience: {
          zh: "适合品牌团队、内容策划与个人创作者。",
          en: "Built for brand teams, campaign planners, and independent creators.",
        },
        summary: {
          zh: "支持批量出图、版本筛选、结果回流和 Creator 侧的私有图像能力挂载。",
          en: "Supports batch image generation, version review, result callbacks, and creator-side private image capability mounts.",
        },
        nextStepSummary: {
          zh: "常见后续：批量选图、打包下载、回到 Creator 更新策略。",
          en: "Typical next steps: select variants, download bundles, and return to Creator to adjust policy.",
        },
        coverAssetUrl: "/assets/workshop-image.svg",
        tagList: ["/workspace/poster-batch-17/", "image key", "bundle", "callback"],
        defaultServiceId: "poster-batch",
        visibleInContexts: ["brand-lab"],
      },
    ],
    services: [
      {
        serviceId: "poster-batch",
        workshopId: "brand-poster-suite",
        status: "active",
        displayName: {
          zh: "品牌海报批量生成",
          en: "Brand Poster Batch",
        },
        summary: {
          zh: "围绕品牌约束批量生成海报、KV 和变体图，并将筛选结果同步回写到输出目录与归档目录。",
          en: "Generates posters, key visuals, and variants in bulk around brand constraints, then writes selection results back into output and archive paths.",
        },
        authRequirementText: {
          zh: "私有图像能力挂载 / 只读密钥 / 结果包回写",
          en: "Private image capability mount / readonly key / bundle callback",
        },
        estimatedDuration: "06-12 min",
        targetPathHint: "/workspace/poster-batch-17/",
        outputContractSummary: {
          zh: "精选图、候选图和提示词归档会写回 output 与 archive 目录。",
          en: "Final picks, candidate assets, and prompt archives are written back into output and archive paths.",
        },
        launchMode: "instant-conversation",
        requiredBindings: {
          firstPartyMcpIds: ["mcp.image.gpt-image-2"],
          externalConnectorRefs: ["third-party:asset-library"],
          credentialIds: ["cred_openai_image_api_key", "cred_asset_library_api_key"],
        },
        linkedInstanceHint: "poster-batch-17",
        visibleInContexts: ["brand-lab"],
      },
    ],
    launchTemplates: [],
  };

  const creatorState = {
    packages: [
      {
        packageId: "brand-poster-suite-20260708",
        title: {
          zh: "brand-poster-suite.session@2026.07.8",
          en: "brand-poster-suite.session@2026.07.8",
        },
        source: {
          zh: "来源：品牌内容组 / 实例：poster-batch-17",
          en: "Source: Brand Content Team / instance: poster-batch-17",
        },
        state: "ready",
        statusLabel: {
          zh: "已激活",
          en: "Activated",
        },
        tone: "active",
        ownerLabel: {
          zh: "品牌内容组",
          en: "Brand Content Team",
        },
        updatedAt: "2026-07-08T00:00:00.000Z",
        releaseChannel: {
          zh: "品牌内容工坊 / 正式发布",
          en: "Brand content workshop / production",
        },
        workspaceContextKeys: ["brand-lab"],
        linkedWorkshopIds: ["brand-poster-suite"],
        linkedServiceIds: ["poster-batch"],
        session: {
          summary: {
            zh: "保留批量出图与筛选回流的完整会话资产。",
            en: "Preserves the complete session asset for batch generation and selection callbacks.",
          },
          items: [],
        },
        runtime: {
          summary: {
            zh: "标准运行镜像，附带图像生成能力与结果回流。",
            en: "Standard runtime image with image-generation capability and result callbacks.",
          },
          items: [],
        },
        connectors: {
          summary: {
            zh: "按工作区绑定私有图像能力与资产库引用。",
            en: "Binds private image capability and asset-library references per workspace.",
          },
          items: [],
        },
        release: {
          summary: {
            zh: "当前版本已完成正式激活。",
            en: "The current version has completed formal activation.",
          },
          items: [],
        },
        versionLine: [
          "sev_brand_poster_suite_20260708@2026.07.8",
          "tsv_poster_batch_20260708@2026.07.8",
          "img: lingban-codex-runtime:2026.07",
        ],
        dependencies: [],
      },
    ],
    releases: [
      {
        releaseId: "rel_brand_poster_suite_20260708",
        packageId: "brand-poster-suite-20260708",
        targetWorkspaceContextKey: "brand-lab",
        state: "production",
        channelLabel: {
          zh: "品牌内容工坊 / 正式发布",
          en: "Brand content workshop / production",
        },
        gateSummary: [],
        updatedAt: "2026-07-08T00:00:00.000Z",
      },
    ],
    replays: [],
    releaseGates: [],
    activations: [
      {
        activationId: "rac_brand_poster_suite_20260708",
        releaseId: "rel_brand_poster_suite_20260708",
        packageId: "brand-poster-suite-20260708",
        targetWorkspaceContextKey: "brand-lab",
        state: "active",
        rolloutMode: "production",
        effectiveAt: "2026-07-08T00:00:00.000Z",
        note: {
          zh: "正式激活完成",
          en: "Production activation completed",
        },
        activatedByUserId: "usr_creator_owner",
        updatedAt: "2026-07-08T00:00:00.000Z",
      },
    ],
  };

  const creatorDir = path.join(storageRoot, "creator");
  const workshopsDir = path.join(storageRoot, "workshops");
  await mkdir(creatorDir, { recursive: true });
  await mkdir(workshopsDir, { recursive: true });
  await writeFile(
    path.join(creatorDir, "creator-state.json"),
    JSON.stringify(creatorState, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(workshopsDir, "catalog-state.json"),
    JSON.stringify(catalogState, null, 2),
    "utf8"
  );
}

test("creator activation resolves launch template versions even when catalog template rows are absent", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-creator-template-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "CODEX_BIN",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const storageRoot = path.join(smokeRoot, "api-data");

    await seedCatalogAndCreatorState(storageRoot);

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = storageRoot;
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const template = await requestJson(
      `${baseUrl}/v1/services/${encodeURIComponent("poster-batch")}/launch-template`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          entrySurface: "dashboard",
        }),
      }
    );

    assert.equal(template.taskVersionId, "tsv_poster_batch_20260708");
    assert.equal(template.sessionVersionId, "sev_brand_poster_suite_20260708");
    assert.equal(template.resolution.source, "creator-activation");
    assert.equal(template.resolution.packageId, "brand-poster-suite-20260708");
    assert.equal(
      template.targetRoot,
      "/workspace/poster-batch-17/runs/poster-batch"
    );
    assert.equal(
      template.createRunInput.targetPath.startsWith("/workspace/poster-batch-17/runs/poster-batch-"),
      true
    );
    assert.equal(template.createRunInput.taskVersionId, "tsv_poster_batch_20260708");
    assert.equal(template.createRunInput.sessionVersionId, "sev_brand_poster_suite_20260708");
    assert.deepEqual(template.createRunInput.bindings.firstPartyMcpIds, ["mcp.image.gpt-image-2"]);
    assert.equal(template.createRunInput.catalogMetadata.workspaceContextKey, "brand-lab");
    assert.equal(template.createRunInput.catalogMetadata.workshopId, "brand-poster-suite");
    assert.equal(template.createRunInput.catalogMetadata.serviceId, "poster-batch");
    assert.equal(template.createRunInput.catalogMetadata.workshopName.zh, "品牌内容工坊");
    assert.equal(template.createRunInput.catalogMetadata.serviceName.en, "Brand Poster Batch");

    const sessionPack = await requestJson(
      `${baseUrl}/v1/sessions/${encodeURIComponent("sev_brand_poster_suite_20260708")}`
    );
    assert.equal(sessionPack.sessionVersionId, "sev_brand_poster_suite_20260708");
    assert.equal(sessionPack.primaryPackageId, "brand-poster-suite-20260708");
    assert.deepEqual(sessionPack.linkedServiceIds, ["poster-batch"]);
    assert.deepEqual(sessionPack.workspaceContextKeys, ["brand-lab"]);
    assert.equal(sessionPack.runtimeProfile.profileId, "sev_brand_poster_suite_20260708");
    assert.equal(sessionPack.expectedRootFiles.includes("conversation.jsonl"), true);
    assert.equal(sessionPack.expectedRootFiles.includes("runtime-profile.json"), true);

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(template.createRunInput),
    });
    const expectedConsumerSessionVersionId = `sev_brand_poster_suite_20260708_consumer_${createdRun.run.runId.replace(/^run_/, "")}`;

    assert.equal(createdRun.run.catalogMetadata.workspaceContextKey, "brand-lab");
    assert.equal(createdRun.run.catalogMetadata.workspaceContextName.zh, "品牌内容组");
    assert.equal(createdRun.run.catalogMetadata.workshopName.zh, "品牌内容工坊");
    assert.equal(createdRun.run.catalogMetadata.serviceName.en, "Brand Poster Batch");
    assert.equal(createdRun.run.sessionVersionId, expectedConsumerSessionVersionId);
    assert.notEqual(createdRun.run.sessionVersionId, template.createRunInput.sessionVersionId);

    const consumerSessionPack = await requestJson(
      `${baseUrl}/v1/sessions/${encodeURIComponent(createdRun.run.sessionVersionId)}`
    );
    assert.equal(consumerSessionPack.sessionVersionId, expectedConsumerSessionVersionId);
    assert.equal(
      consumerSessionPack.lineageParentVersionId,
      "sev_brand_poster_suite_20260708"
    );
    assert.equal(consumerSessionPack.inheritMode, "consumer");
    assert.equal(consumerSessionPack.consumerRunId, createdRun.run.runId);
    assert.equal(consumerSessionPack.consumerWorkspaceId, createdRun.run.workspaceId);
    assert.equal(consumerSessionPack.consumerServiceId, "poster-batch");
    assert.equal(consumerSessionPack.consumerWorkshopId, "brand-poster-suite");
    assert.equal(consumerSessionPack.consumerEntrySurface, "dashboard");
    assert.equal(consumerSessionPack.consumerTargetPath, createdRun.run.targetPath);
    assert.equal(consumerSessionPack.persistedArchive, true);
    assert.equal(consumerSessionPack.archiveSource, "imported");
    assert.equal(consumerSessionPack.archiveRecordedAt != null, true);
    assert.equal(consumerSessionPack.runtimeSourceRunId, createdRun.run.runId);
    assert.equal(consumerSessionPack.runtimeSourceTargetPath, createdRun.run.targetPath);
    assert.equal(consumerSessionPack.workspaceContextKeys.includes("brand-lab"), true);
    assert.equal(consumerSessionPack.linkedServiceIds.includes("poster-batch"), true);

    const consumerLineage = await requestJson(
      `${baseUrl}/v1/sessions/${encodeURIComponent(createdRun.run.sessionVersionId)}/lineage`
    );
    assert.equal(consumerLineage.focus.sessionVersionId, expectedConsumerSessionVersionId);
    assert.equal(consumerLineage.ancestors.length, 1);
    assert.equal(consumerLineage.ancestors[0].relation, "lineage_parent");
    assert.equal(
      consumerLineage.ancestors[0].sessionVersionId,
      "sev_brand_poster_suite_20260708"
    );

    const invalidRun = await requestWithStatus(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...template.createRunInput,
        sessionVersionId: "sev_missing_session_pack",
      }),
    });
    assert.equal(invalidRun.status, 404);
    assert.equal(invalidRun.ok, false);
    assert.equal(invalidRun.body?.error?.code, "SESSION_PACK_NOT_FOUND");

    const snapshot = await requestJson(
      `${baseUrl}/v1/runs/${encodeURIComponent(createdRun.run.runId)}`
    );

    assert.equal(snapshot.run.catalogMetadata.workspaceContextKey, "brand-lab");
    assert.equal(snapshot.run.catalogMetadata.workshopId, "brand-poster-suite");
    assert.equal(snapshot.run.catalogMetadata.serviceId, "poster-batch");
    assert.equal(snapshot.run.sessionVersionId, expectedConsumerSessionVersionId);
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    for (const [key, value] of envBackup) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
