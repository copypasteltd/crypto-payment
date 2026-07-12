import assert from "node:assert/strict";
import test from "node:test";

import { createBatchRunsApiClient } from "../dist/index.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function sampleBatchDetail() {
  return {
    job: {
      batchJobId: "brj_demo_0001",
      workspaceId: "wsp_brand_content",
      workspaceContextKey: "brand-lab",
      workspaceContextName: {
        zh: "品牌内容组",
        en: "Brand Content Team",
      },
      workspaceRoot: "/workspace/poster-batch-17/",
      workshopId: "brand-poster-suite",
      workshopName: {
        zh: "品牌内容工坊",
        en: "Brand Content Workshop",
      },
      serviceId: "poster-batch",
      serviceName: {
        zh: "品牌海报批量生成",
        en: "Brand Poster Batch",
      },
      taskVersionId: "tsv_poster_batch_20260708",
      sessionVersionId: "sev_brand_poster_suite_20260708",
      entrySurface: "dashboard",
      title: "品牌海报批次 / 02 items",
      templateSource: "creator-activation",
      sourcePackageId: "pkg_brand_poster_suite",
      sourceReleaseId: "rel_brand_poster_suite",
      sourceActivationId: "rac_brand_poster_suite",
      bindings: {
        firstPartyMcpIds: ["mcp.image.gpt-image-2"],
        externalConnectorRefs: ["third-party:asset-library"],
        credentialIds: ["cred_openai_image_api_key"],
      },
      status: "running",
      maxParallelRuns: 3,
      budgetLimit: 120,
      retryLimit: 1,
      createdByUserId: "usr_creator_owner",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:02:00.000Z",
      validatedAt: "2026-07-11T00:00:30.000Z",
      startedAt: "2026-07-11T00:01:00.000Z",
      finishedAt: null,
      cancelledAt: null,
      cancellationReason: null,
    },
    summary: {
      totalCount: 2,
      draftCount: 0,
      validatedCount: 0,
      queuedCount: 0,
      startingCount: 0,
      runningCount: 1,
      waitingApprovalCount: 0,
      succeededCount: 1,
      failedCount: 0,
      cancelledCount: 0,
      latestUpdatedAt: "2026-07-11T00:02:00.000Z",
    },
    estimate: {
      currency: "USD",
      itemCount: 2,
      estimatedMinutesPerItemLow: 6,
      estimatedMinutesPerItemHigh: 12,
      estimatedTotalMinutesLow: 12,
      estimatedTotalMinutesHigh: 24,
      estimatedWallClockMinutesLow: 4,
      estimatedWallClockMinutesHigh: 8,
      estimatedTotalAmountUsdLow: 0.36,
      estimatedTotalAmountUsdHigh: 0.72,
      budgetLimit: 120,
      budgetRemainingUsdLow: 119.64,
      budgetRemainingUsdHigh: 119.28,
      withinBudget: true,
      metrics: [
        {
          metric: "browser_minutes",
          label: {
            zh: "浏览器分钟",
            en: "Browser minutes",
          },
          quantityLow: 12,
          quantityHigh: 24,
          unitPriceUsd: 0.03,
          amountUsdLow: 0.36,
          amountUsdHigh: 0.72,
          currency: "USD",
        },
      ],
      warnings: [],
    },
    itemsPreview: [
      {
        batchItemId: "bri_demo_0001",
        batchJobId: "brj_demo_0001",
        rowIndex: 0,
        rowKey: "poster-a",
        title: "Poster A",
        targetPath: "/workspace/poster-batch-17/runs/poster-batch/poster-a",
        pathSuffix: "poster-a",
        initialMessage: null,
        context: {
          region: "hk",
        },
        runId: "run_0001",
        previousRunIds: [],
        runStatus: "RUNNING",
        runStatusReason: null,
        status: "running",
        attemptCount: 1,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:02:00.000Z",
        startedAt: "2026-07-11T00:01:00.000Z",
        finishedAt: null,
      },
    ],
  };
}

test("createBatchRunsApiClient serializes list query and parses detail list", async () => {
  const client = createBatchRunsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "batch-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);

      assert.equal(url.pathname, "/v1/batch-runs");
      assert.equal(url.searchParams.get("workspaceContextKey"), "brand-lab");
      assert.equal(url.searchParams.get("serviceId"), "poster-batch");
      assert.equal(url.searchParams.get("status"), "running");
      assert.equal(url.searchParams.get("q"), "poster");
      assert.equal(headers.get("authorization"), "Bearer batch-token");

      return jsonResponse([sampleBatchDetail()]);
    },
  });

  const result = await client.listBatchRuns({
    workspaceContextKey: "brand-lab",
    serviceId: "poster-batch",
    status: "running",
    q: "poster",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].job.batchJobId, "brj_demo_0001");
  assert.equal(result[0].summary.runningCount, 1);
});

test("createBatchRunsApiClient posts actions and parses item responses", async () => {
  const client = createBatchRunsApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";

      if (method === "POST" && url.pathname === "/v1/batch-runs") {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.serviceId, "poster-batch");
        assert.equal(body.items.length, 2);
        return jsonResponse(sampleBatchDetail());
      }

      if (method === "POST" && url.pathname === "/v1/batch-runs/estimate") {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.serviceId, "poster-batch");
        assert.equal(body.governance.maxParallelRuns, 3);
        assert.equal(body.items.length, 2);
        return jsonResponse(sampleBatchDetail().estimate);
      }

      if (method === "POST" && url.pathname === "/v1/batch-runs/import-file") {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.workspaceContextKey, "brand-lab");
        assert.equal(body.fileName, "poster-batch.csv");
        assert.equal(typeof body.contentBase64, "string");
        return jsonResponse({
          sourceFormat: "csv",
          fileName: "poster-batch.csv",
          sheetNames: ["Sheet1"],
          activeSheetName: "Sheet1",
          detectedColumns: ["title", "path_suffix", "region"],
          effectiveMapping: {
            title: "title",
            pathSuffix: "path_suffix",
            targetPath: null,
            initialMessage: null,
            rowKey: null,
            ignoreColumns: [],
            contextColumns: ["region"],
          },
          items: [
            {
              title: "Poster A",
              pathSuffix: "poster-a",
              rowKey: null,
              targetPath: null,
              initialMessage: null,
              context: {
                region: "hk",
              },
            },
          ],
          importedRowCount: 1,
          skippedRowCount: 0,
          truncated: false,
          warnings: [],
        });
      }

      if (method === "GET" && url.pathname === "/v1/batch-runs/brj_demo_0001/items") {
        assert.equal(url.searchParams.get("status"), "running");
        return jsonResponse({
          job: sampleBatchDetail().job,
          summary: sampleBatchDetail().summary,
          items: sampleBatchDetail().itemsPreview,
        });
      }

      if (method === "POST" && url.pathname === "/v1/batch-runs/brj_demo_0001/start") {
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(body, {
          itemIds: ["bri_demo_0001"],
        });
        return jsonResponse(sampleBatchDetail());
      }

      if (method === "POST" && url.pathname === "/v1/batch-runs/brj_demo_0001/retry") {
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(body, {
          onlyFailed: false,
          itemIds: ["bri_demo_0002"],
        });
        return jsonResponse(sampleBatchDetail());
      }

      if (method === "POST" && url.pathname === "/v1/batch-runs/brj_demo_0001/cancel") {
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(body, {
          reason: "stop batch",
        });
        return jsonResponse(sampleBatchDetail());
      }

      throw new Error(`Unhandled request: ${method} ${url.pathname}`);
    },
  });

  const created = await client.createBatchRun({
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
      },
    ],
    governance: {
      maxParallelRuns: 3,
      budgetLimit: 120,
      retryLimit: 1,
    },
  });
  assert.equal(created.job.serviceId, "poster-batch");
  assert.equal(created.estimate?.withinBudget, true);

  const estimate = await client.estimateBatchRun({
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
      },
    ],
    governance: {
      maxParallelRuns: 3,
      budgetLimit: 120,
      retryLimit: 1,
    },
  });
  assert.equal(estimate.estimatedTotalAmountUsdHigh, 0.72);

  const imported = await client.importBatchRunFile({
    workspaceContextKey: "brand-lab",
    fileName: "poster-batch.csv",
    contentBase64: Buffer.from("title,path_suffix,region\nPoster A,poster-a,hk", "utf8").toString(
      "base64"
    ),
  });
  assert.equal(imported.sourceFormat, "csv");
  assert.equal(imported.items.length, 1);
  assert.equal(imported.items[0].context.region, "hk");

  const items = await client.listBatchItems("brj_demo_0001", {
    status: "running",
  });
  assert.equal(items.items.length, 1);
  assert.equal(items.items[0].status, "running");

  const started = await client.startBatchRun("brj_demo_0001", {
    itemIds: ["bri_demo_0001"],
  });
  assert.equal(started.job.status, "running");

  const retried = await client.retryBatchRun("brj_demo_0001", {
    onlyFailed: false,
    itemIds: ["bri_demo_0002"],
  });
  assert.equal(retried.job.batchJobId, "brj_demo_0001");

  const cancelled = await client.cancelBatchRun("brj_demo_0001", {
    reason: "stop batch",
  });
  assert.equal(cancelled.job.batchJobId, "brj_demo_0001");
});
