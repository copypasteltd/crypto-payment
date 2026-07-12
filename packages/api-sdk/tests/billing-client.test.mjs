import assert from "node:assert/strict";
import test from "node:test";
import { createBillingApiClient } from "../dist/index.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("createBillingApiClient serializes list query and parses billing entries", async () => {
  const client = createBillingApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "access-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);

      assert.equal(url.pathname, "/v1/billing/entries");
      assert.equal(url.searchParams.get("workspaceContextKey"), "brand-lab");
      assert.equal(url.searchParams.get("packageId"), "creator-drama-suite");
      assert.equal(url.searchParams.get("metric"), "model_tokens");
      assert.equal(url.searchParams.get("limit"), "50");
      assert.equal(headers.get("authorization"), "Bearer access-token");

      return jsonResponse([
        {
          entryId: "ble_run-message_model_tokens_run_1_msg_1",
          workspaceId: "wsp_test",
          workspaceContextKey: "brand-lab",
          packageId: "creator-drama-suite",
          serviceId: "drama-storyboard",
          taskVersionId: "tsv_drama_storyboard@2026.07.4",
          sessionVersionId: "sev_creator_drama_suite@2026.07.2",
          entrySurface: "dashboard",
          runId: "run_1",
          requestedByUserId: "usr_1",
          metric: "model_tokens",
          quantity: 42,
          unitPriceUsd: 0.000002,
          amountUsd: 0.000084,
          currency: "USD",
          source: "run-message",
          costBasis: "estimated",
          sourceRef: "run_1:msg_1",
          note: "Estimated billing entry",
          createdAt: "2026-07-08T12:00:00.000Z",
          updatedAt: "2026-07-08T12:00:00.000Z",
          occurredAt: "2026-07-08T12:00:00.000Z",
        },
      ]);
    },
  });

  const entries = await client.listEntries({
    workspaceContextKey: "brand-lab",
    packageId: "creator-drama-suite",
    metric: "model_tokens",
    limit: 50,
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "run-message");
  assert.equal(entries[0].amountUsd, 0.000084);
});

test("createBillingApiClient serializes summary query and parses ledger summary", async () => {
  const client = createBillingApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input) => {
      const url = new URL(String(input));

      assert.equal(url.pathname, "/v1/billing/summary");
      assert.equal(url.searchParams.get("workspaceContextKey"), "brand-lab");
      assert.equal(url.searchParams.get("packageId"), "creator-drama-suite");
      assert.equal(url.searchParams.get("runId"), "run_1");

      return jsonResponse({
        workspaceId: "wsp_test",
        workspaceContextKey: "brand-lab",
        packageId: "creator-drama-suite",
        serviceId: "drama-storyboard",
        runId: "run_1",
        currency: "USD",
        totalAmountUsd: 0.120084,
        totalEntriesCount: 4,
        metrics: [
          {
            metric: "model_tokens",
            quantity: 42,
            amountUsd: 0.000084,
            entriesCount: 1,
            currency: "USD",
            latestOccurredAt: "2026-07-08T12:00:00.000Z",
            label: {
              zh: "Model tokens",
              en: "Model tokens",
            },
          },
        ],
        updatedAt: "2026-07-08T12:05:00.000Z",
      });
    },
  });

  const summary = await client.getSummary({
    workspaceContextKey: "brand-lab",
    packageId: "creator-drama-suite",
    runId: "run_1",
  });

  assert.equal(summary.totalEntriesCount, 4);
  assert.equal(summary.metrics[0].metric, "model_tokens");
});
