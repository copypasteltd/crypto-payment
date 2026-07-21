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
        workspaceIds: ["wsp_brand_content"],
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
        currentSessionVersionId: "sev_brand_poster_suite_20260711",
        candidateSessionVersionId: null,
        currentTaskVersionId: "tsv_poster_batch_20260711",
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

test("batch runs create, validate, start, list items, and cancel remaining work", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-batch-runs-"));
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
    await seedBatchState(storageRoot);

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

    const created = await requestJson(`${baseUrl}/v1/batch-runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        serviceId: "poster-batch",
        entrySurface: "dashboard",
        title: "品牌海报 7 月首轮批次",
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

    assert.equal(created.job.status, "draft");
    assert.equal(created.summary.totalCount, 2);
    assert.equal(created.itemsPreview.length, 2);
    assert.equal(created.estimate.withinBudget, true);
    assert.equal(created.estimate.estimatedTotalAmountUsdHigh, 0.72);

    const estimated = await requestJson(`${baseUrl}/v1/batch-runs/estimate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        serviceId: "poster-batch",
        entrySurface: "dashboard",
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
          budgetLimit: 0.5,
          retryLimit: 1,
        },
      }),
    });
    assert.equal(estimated.withinBudget, false);
    assert.equal(estimated.metrics[0].metric, "browser_minutes");
    assert.equal(estimated.estimatedTotalAmountUsdHigh, 0.72);
    assert.equal(estimated.warnings.length > 0, true);

    const importedCsv = await requestJson(`${baseUrl}/v1/batch-runs/import-file`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        fileName: "poster-batch.csv",
        contentBase64: Buffer.from(
          "title,path_suffix,region,initial_message\nPoster C,poster-c,tw,Need hero product shot",
          "utf8"
        ).toString("base64"),
      }),
    });
    assert.equal(importedCsv.sourceFormat, "csv");
    assert.equal(importedCsv.items.length, 1);
    assert.equal(importedCsv.items[0].title, "Poster C");
    assert.equal(importedCsv.items[0].pathSuffix, "poster-c");
    assert.equal(importedCsv.items[0].context.region, "tw");
    assert.equal(importedCsv.items[0].initialMessage, "Need hero product shot");

    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["title", "path_suffix", "market", "notes"],
      ["Poster D", "poster-d", "jp", "Night scene"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Batch");
    const importedXlsx = await requestJson(`${baseUrl}/v1/batch-runs/import-file`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        fileName: "poster-batch.xlsx",
        contentBase64: Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })).toString(
          "base64"
        ),
        format: "xlsx",
        sheetName: "Batch",
      }),
    });
    assert.equal(importedXlsx.sourceFormat, "xlsx");
    assert.equal(importedXlsx.activeSheetName, "Batch");
    assert.equal(importedXlsx.items.length, 1);
    assert.equal(importedXlsx.items[0].title, "Poster D");
    assert.equal(importedXlsx.items[0].context.market, "jp");

    const overBudgetDraft = await requestJson(`${baseUrl}/v1/batch-runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        serviceId: "poster-batch",
        entrySurface: "dashboard",
        title: "low-budget-batch",
        items: [
          {
            title: "Poster E",
            pathSuffix: "poster-e",
          },
          {
            title: "Poster F",
            pathSuffix: "poster-f",
          },
        ],
        governance: {
          maxParallelRuns: 2,
          budgetLimit: 0.5,
          retryLimit: 1,
        },
      }),
    });
    assert.equal(overBudgetDraft.estimate.withinBudget, false);

    const overBudgetValidationResponse = await fetch(
      `${baseUrl}/v1/batch-runs/${encodeURIComponent(overBudgetDraft.job.batchJobId)}/validate`,
      {
        method: "POST",
      }
    );
    const overBudgetValidationText = await overBudgetValidationResponse.text();
    assert.equal(overBudgetValidationResponse.status, 409);
    assert.match(overBudgetValidationText, /BATCH_RUN_BUDGET_LIMIT_EXCEEDED/);

    const validated = await requestJson(
      `${baseUrl}/v1/batch-runs/${encodeURIComponent(created.job.batchJobId)}/validate`,
      {
        method: "POST",
      }
    );
    assert.equal(validated.job.status, "validated");

    const started = await requestJson(
      `${baseUrl}/v1/batch-runs/${encodeURIComponent(created.job.batchJobId)}/start`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    assert.equal(started.summary.totalCount, 2);

    const items = await requestJson(
      `${baseUrl}/v1/batch-runs/${encodeURIComponent(created.job.batchJobId)}/items`
    );
    assert.equal(items.items.length, 2);
    assert.equal(
      items.items.every((item) => typeof item.runId === "string" && item.runId.length > 0),
      true
    );
    assert.equal(
      items.items.every((item) =>
        item.targetPath.startsWith("/workspace/poster-batch-17/runs/poster-batch/")
      ),
      true
    );

    const cancelled = await requestJson(
      `${baseUrl}/v1/batch-runs/${encodeURIComponent(created.job.batchJobId)}/cancel`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "stop remaining batch items",
        }),
      }
    );
    assert.equal(cancelled.job.status, "cancelled");
    assert.equal(cancelled.job.cancellationReason, "stop remaining batch items");
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
