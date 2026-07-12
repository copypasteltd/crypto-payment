import assert from "node:assert/strict";
import test from "node:test";
import { createSearchApiClient } from "../dist/index.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("createSearchApiClient serializes unified search query and parses results", async () => {
  const client = createSearchApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "search-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);

      assert.equal(url.pathname, "/v1/search");
      assert.equal(url.searchParams.get("q"), "brand");
      assert.deepEqual(url.searchParams.getAll("types"), ["workshop", "run"]);
      assert.equal(url.searchParams.get("limit"), "8");
      assert.equal(url.searchParams.get("entrySurface"), "dashboard");
      assert.equal(headers.get("authorization"), "Bearer search-token");

      return jsonResponse({
        totalCount: 1,
        updatedAt: "2026-07-09T01:00:00.000Z",
        items: [
          {
            documentId: "search:workshop:brand-poster-suite",
            workspaceId: "wsp_test",
            workspaceContextKey: "brand-lab",
            resourceType: "workshop",
            resourceId: "brand-poster-suite",
            title: {
              zh: "Brand Content Workshop",
              en: "Brand Content Workshop",
            },
            subtitle: {
              zh: "Brand Content Team",
              en: "Brand Content Team",
            },
            summary: {
              zh: "Poster workflows",
              en: "Poster workflows",
            },
            badge: {
              zh: "Recommended",
              en: "Recommended",
            },
            tone: "success",
            matchedFields: ["title", "summary"],
            recent: false,
            favorited: true,
            updatedAt: null,
            target: {
              resource: "workshop",
              workshopId: "brand-poster-suite",
              view: "detail",
            },
          },
        ],
      });
    },
  });

  const results = await client.listSearchResults({
    q: "brand",
    types: ["workshop", "run"],
    limit: 8,
    entrySurface: "dashboard",
  });

  assert.equal(results.totalCount, 1);
  assert.equal(results.items[0].resourceType, "workshop");
  assert.equal(results.items[0].favorited, true);
});

test("createSearchApiClient serializes suggestion query and parses suggestions", async () => {
  const client = createSearchApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input) => {
      const url = new URL(String(input));

      assert.equal(url.pathname, "/v1/search/suggestions");
      assert.equal(url.searchParams.get("q"), "brand");
      assert.deepEqual(url.searchParams.getAll("types"), ["workshop"]);
      assert.equal(url.searchParams.get("limit"), "4");

      return jsonResponse({
        items: [
          {
            suggestionId: "search:workshop:brand-poster-suite",
            resourceTypes: ["workshop"],
            text: {
              zh: "Brand Content Workshop",
              en: "Brand Content Workshop",
            },
          },
        ],
      });
    },
  });

  const suggestions = await client.listSearchSuggestions({
    q: "brand",
    types: ["workshop"],
    limit: 4,
  });

  assert.equal(suggestions.items.length, 1);
  assert.equal(suggestions.items[0].text.en, "Brand Content Workshop");
});

test("createSearchApiClient serializes history query and parses history entries", async () => {
  const client = createSearchApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input) => {
      const url = new URL(String(input));

      assert.equal(url.pathname, "/v1/search/history");
      assert.equal(url.searchParams.get("q"), "brand");
      assert.equal(url.searchParams.get("limit"), "6");

      return jsonResponse({
        totalCount: 1,
        updatedAt: "2026-07-09T02:00:00.000Z",
        items: [
          {
            historyId: "history_brand",
            workspaceId: "wsp_test",
            workspaceContextKey: "brand-lab",
            query: "brand",
            resourceTypes: ["workshop", "service"],
            lastUsedAt: "2026-07-09T02:00:00.000Z",
          },
        ],
      });
    },
  });

  const history = await client.listSearchHistory({
    q: "brand",
    limit: 6,
  });

  assert.equal(history.totalCount, 1);
  assert.equal(history.items[0].query, "brand");
  assert.deepEqual(history.items[0].resourceTypes, ["workshop", "service"]);
});

test("createSearchApiClient records search clicks", async () => {
  const client = createSearchApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const body = JSON.parse(init?.body ? String(init.body) : "{}");

      assert.equal(url.pathname, "/v1/search/clicks");
      assert.equal(init?.method, "POST");
      assert.equal(body.query, "brand");
      assert.equal(body.documentId, "search:workshop:brand-poster-suite");
      assert.equal(body.entrySurface, "h5");

      return jsonResponse({
        eventId: "evt_brand_click",
        documentId: "search:workshop:brand-poster-suite",
        resourceType: "workshop",
        resourceId: "brand-poster-suite",
        rank: 0,
        acceptedAt: "2026-07-09T02:10:00.000Z",
        history: {
          historyId: "history_brand",
          workspaceId: "wsp_test",
          workspaceContextKey: "brand-lab",
          query: "brand",
          resourceTypes: ["workshop"],
          lastUsedAt: "2026-07-09T02:10:00.000Z",
        },
      });
    },
  });

  const result = await client.recordSearchClick({
    query: "brand",
    documentId: "search:workshop:brand-poster-suite",
    entrySurface: "h5",
  });

  assert.equal(result.eventId, "evt_brand_click");
  assert.equal(result.history.query, "brand");
  assert.equal(result.rank, 0);
});
