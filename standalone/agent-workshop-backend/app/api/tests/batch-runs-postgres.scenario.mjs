import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

async function seedBatchState(storageRoot) {
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
          zh: "内容编辑 / 批量产出",
          en: "Content editors / batch output",
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
          zh: "适合品牌团队与内容策划。",
          en: "Built for brand teams and campaign planners.",
        },
        summary: {
          zh: "支持批量出图、筛选与结果回流。",
          en: "Supports batch generation, review, and result callbacks.",
        },
        nextStepSummary: {
          zh: "常见后续：筛选结果、打包下载、继续调优。",
          en: "Typical next steps: review, bundle, and tune again.",
        },
        coverAssetUrl: "/assets/workshop-image.svg",
        tagList: ["/workspace/poster-batch-17/", "batch"],
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
          zh: "围绕品牌约束批量生成海报与变体。",
          en: "Generates posters and variants around brand constraints.",
        },
        authRequirementText: {
          zh: "工作区可见即可运行",
          en: "Runnable inside the current workspace",
        },
        estimatedDuration: "06-12 min",
        targetPathHint: "/workspace/poster-batch-17/",
        outputContractSummary: {
          zh: "精选图和候选图回写 output 目录。",
          en: "Final and candidate assets are written back to output.",
        },
        launchMode: "instant-conversation",
        requiredBindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
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
        packageId: "brand-poster-suite-20260711",
        title: {
          zh: "brand-poster-suite.session@2026.07.11",
          en: "brand-poster-suite.session@2026.07.11",
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
        updatedAt: "2026-07-11T00:00:00.000Z",
        releaseChannel: {
          zh: "品牌内容工坊 / 正式发布",
          en: "Brand content workshop / production",
        },
        workspaceContextKeys: ["brand-lab"],
        linkedWorkshopIds: ["brand-poster-suite"],
        linkedServiceIds: ["poster-batch"],
        session: {
          summary: {
            zh: "保留批量出图会话资产。",
            en: "Preserves the batch generation session asset.",
          },
          items: [],
        },
        runtime: {
          summary: {
            zh: "标准运行镜像。",
            en: "Standard runtime image.",
          },
          items: [],
        },
        connectors: {
          summary: {
            zh: "此测试不挂接额外能力。",
            en: "No external capabilities are mounted in this test.",
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
          "sev_brand_poster_suite_20260711@2026.07.11",
          "tsv_poster_batch_20260711@2026.07.11",
          "img: lingban-codex-runtime:2026.07",
        ],
        dependencies: [],
      },
    ],
    releases: [
      {
        releaseId: "rel_brand_poster_suite_20260711",
        packageId: "brand-poster-suite-20260711",
        targetWorkspaceContextKey: "brand-lab",
        state: "production",
        channelLabel: {
          zh: "品牌内容工坊 / 正式发布",
          en: "Brand content workshop / production",
        },
        gateSummary: [],
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
    ],
    replays: [],
    releaseGates: [],
    activations: [
      {
        activationId: "rac_brand_poster_suite_20260711",
        releaseId: "rel_brand_poster_suite_20260711",
        packageId: "brand-poster-suite-20260711",
        targetWorkspaceContextKey: "brand-lab",
        state: "active",
        rolloutMode: "production",
        effectiveAt: "2026-07-11T00:00:00.000Z",
        note: {
          zh: "正式激活完成",
          en: "Production activation completed",
        },
        activatedByUserId: "usr_creator_owner",
        updatedAt: "2026-07-11T00:00:00.000Z",
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

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-batch-runs-pg-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_AUTH_MODE",
  "LINGBAN_BATCH_RUNS_STORE",
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
  const fakePool = createFakePostgresPool();
  await seedBatchState(storageRoot);

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = storageRoot;
  process.env.LINGBAN_AUTH_MODE = "disabled";
  process.env.LINGBAN_BATCH_RUNS_STORE = "postgres";
  process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
  process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
  process.env.LINGBAN_API_BASE_URL = baseUrl;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
  process.env.CODEX_BIN = process.execPath;

  const [
    { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
    { resetApiRuntimeConfigForTests },
    { buildBatchRunsRepository },
    { startApiServer },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
    import("../dist/modules/batch-runs/repository.js"),
    import("../dist/index.js"),
  ]);

  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();
  app = await startApiServer();

  const created = await requestJson(`${baseUrl}/v1/batch-runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      workspaceContextKey: "brand-lab",
      serviceId: "poster-batch",
      entrySurface: "dashboard",
      title: "Poster batch postgres persistence smoke",
      items: [
        {
          title: "Poster A",
          pathSuffix: "poster-a",
          context: {
            region: "hk",
          },
        },
        {
          title: "Poster B",
          pathSuffix: "poster-b",
          context: {
            region: "sg",
          },
        },
      ],
      governance: {
        maxParallelRuns: 2,
        budgetLimit: 120,
        retryLimit: 1,
      },
    }),
  });

  const validated = await requestJson(
    `${baseUrl}/v1/batch-runs/${encodeURIComponent(created.job.batchJobId)}/validate`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  const listed = await requestJson(
    `${baseUrl}/v1/batch-runs?workspaceContextKey=brand-lab&serviceId=poster-batch`
  );
  assert.equal(Array.isArray(listed), true);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].job.batchJobId, created.job.batchJobId);

  const itemsResponse = await requestJson(
    `${baseUrl}/v1/batch-runs/${encodeURIComponent(created.job.batchJobId)}/items`
  );
  assert.equal(itemsResponse.items.length, 2);
  assert.equal(itemsResponse.items.every((item) => item.status === "validated"), true);

  await app.close().catch(() => undefined);
  app = null;

  const freshRepository = buildBatchRunsRepository();
  await freshRepository.init();

  const persistedJob = freshRepository.getJob(created.job.batchJobId);
  const persistedItems = freshRepository.listItems(created.job.batchJobId);

  assert.ok(persistedJob);
  assert.equal(persistedJob.status, validated.job.status);
  assert.equal(persistedItems.length, 2);
  assert.equal(persistedItems.every((item) => item.status === "validated"), true);

  process.stdout.write(
    `${JSON.stringify({
      storage: "postgres",
      batchJobId: created.job.batchJobId,
      jobStatus: persistedJob.status,
      itemCount: persistedItems.length,
      itemStatus: persistedItems[0]?.status ?? null,
    })}\n`
  );

  await resetApiDatabaseForTests();
  resetApiRuntimeConfigForTests();
} finally {
  if (app) {
    await app.close().catch(() => undefined);
  }

  try {
    const [{ resetApiDatabaseForTests }, { resetApiRuntimeConfigForTests }] = await Promise.all([
      import("../dist/app/database.js"),
      import("../dist/app/runtime.js"),
    ]);
    await resetApiDatabaseForTests();
    resetApiRuntimeConfigForTests();
  } catch {
    // Ignore cleanup failures in smoke scenarios.
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
