import assert from "node:assert/strict";
import test from "node:test";
import { createRunsApiClient } from "../dist/index.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("createRunsApiClient serializes indexed file query and parses indexed file response", async () => {
  const client = createRunsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "access-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);

      assert.equal(url.pathname, "/v1/runs/run_123/files/indexed");
      assert.equal(url.searchParams.get("prefix"), "/output");
      assert.equal(url.searchParams.get("search"), "report");
      assert.equal(url.searchParams.get("source"), "runtime-output");
      assert.equal(url.searchParams.get("kind"), "output");
      assert.equal(url.searchParams.get("previewable"), "true");
      assert.equal(url.searchParams.get("downloadable"), "true");
      assert.equal(url.searchParams.get("limit"), "20");
      assert.equal(headers.get("authorization"), "Bearer access-token");

      return jsonResponse({
        mode: "indexed",
        summary: {
          totalIndexedCount: 4,
          matchedCount: 1,
          returnedCount: 1,
          fileCount: 1,
          directoryCount: 0,
          previewableCount: 1,
          downloadableCount: 1,
          objectBackedCount: 1,
          uploadBackedCount: 0,
          latestUpdatedAt: "2026-07-09T12:00:00.000Z",
          latestIndexedAt: "2026-07-09T12:01:00.000Z",
          bySource: [{ key: "runtime-output", count: 1 }],
          byKind: [{ key: "output", count: 1 }],
        },
        items: [
          {
            runId: "run_123",
            workspaceId: "wsp_123",
            path: "C:/tmp/run_123/output/report.txt",
            logicalPath: "/output/report.txt",
            name: "report.txt",
            kind: "output",
            source: "runtime-output",
            sizeBytes: 128,
            updatedAt: "2026-07-09T12:00:00.000Z",
            mimeType: "text/plain; charset=utf-8",
            objectKey: "runs/run_123/indexed/runtime-output/output/report.txt",
            uploadId: null,
            checksum: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            previewMode: "text",
            previewable: true,
            downloadable: true,
            indexedAt: "2026-07-09T12:01:00.000Z",
          },
        ],
      });
    },
  });

  const response = await client.listRunIndexedFiles("run_123", {
    prefix: "/output",
    search: "report",
    source: "runtime-output",
    kind: "output",
    previewable: true,
    downloadable: true,
    limit: 20,
  });

  assert.equal(response.mode, "indexed");
  assert.equal(response.summary.matchedCount, 1);
  assert.equal(response.items[0].logicalPath, "/output/report.txt");
  assert.equal(response.items[0].source, "runtime-output");
});
