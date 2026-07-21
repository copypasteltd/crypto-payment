import test from "node:test";
import assert from "node:assert/strict";

import { mcpStateSchema } from "@lingban/db";
import { reconcileMcpSeedState } from "../dist/modules/mcp/repository.js";

test("managed first-party MCP entries are reconciled without replacing workspace connectors", () => {
  const currentState = mcpStateSchema.parse({
    registry: [
      {
        mcpId: "mcp.browser.playwright",
        workspaceId: null,
        displayName: "Stale Playwright Helper",
        description: null,
        source: "first-party",
        transport: "stdio",
        ref: "/workspace/mcp/playwright-browser-helper.js",
        status: "active",
        riskLevel: "high",
        defaultCredentialId: "cred_browser_storage_state",
        defaultNetworkPolicyRef: "np_browser_playwright",
        approvalRequired: true,
        tags: ["stale"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        mcpId: "workspace:custom-connector",
        workspaceId: "wsp_custom",
        displayName: "Custom Connector",
        description: null,
        source: "workspace-managed",
        transport: "http",
        ref: "https://mcp.customer.example/connect",
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_custom",
        approvalRequired: true,
        tags: ["custom"],
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ],
    bindings: [],
    networkPolicies: [],
    healthSnapshots: [],
  });

  const reconciled = reconcileMcpSeedState(currentState);
  const playwright = reconciled.registry.find(
    (entry) => entry.mcpId === "mcp.browser.playwright"
  );
  const image = reconciled.registry.find(
    (entry) => entry.mcpId === "mcp.image.gpt-image-2"
  );
  const custom = reconciled.registry.find(
    (entry) => entry.mcpId === "workspace:custom-connector"
  );

  assert.equal(playwright?.ref, "/usr/local/bin/lingban-playwright-mcp");
  assert.equal(playwright?.defaultCredentialId, null);
  assert.equal(playwright?.defaultNetworkPolicyRef, null);
  assert.equal(playwright?.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(image?.status, "disabled");
  assert.deepEqual(custom, currentState.registry[1]);
});
