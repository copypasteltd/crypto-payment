import { test, expect } from "@playwright/test";

const now = "2026-07-15T08:00:00.000Z";
const bootstrap = {
  user: {
    userId: "usr_admin_e2e",
    email: "platform-admin@example.com",
    displayName: "Platform Admin",
  },
  role: "platform_admin",
  session: {
    sessionId: "ses_admin_e2e",
    accessTokenExpiresAt: "2026-07-15T09:00:00.000Z",
    refreshTokenExpiresAt: "2026-07-22T08:00:00.000Z",
  },
  csrfToken: "admin-e2e-csrf-token-value",
  system: { status: "ready", release: "e2e", checkedAt: now },
};

function pageResult(items = []) {
  return {
    items,
    pageInfo: {
      page: 1,
      pageSize: 50,
      total: items.length,
      pageCount: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };
}

function json(route, body, status = 200, headers = {}) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  });
}

async function installAdminApiMock(page) {
  const state = {
    providers: [],
    expiredSessionReturned: false,
  };

  await page.route("**/admin/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/admin\/v1/, "");
    const method = request.method();

    if (path === "/auth/session") {
      if (page.url().includes("expired-session=1") && !state.expiredSessionReturned) {
        state.expiredSessionReturned = true;
        return json(route, { error: { code: "AUTH_ACCESS_EXPIRED", message: "Access token expired" } }, 401);
      }
      return json(route, bootstrap);
    }
    if (path === "/auth/refresh") return json(route, { ...bootstrap, csrfToken: "admin-e2e-refreshed-csrf-token" });
    if (path === "/auth/logout") return json(route, { ok: true });
    if (path === "/search") return json(route, []);
    if (path === "/overview") {
      return json(route, {
        generatedAt: now,
        health: { api: { status: "ready" } },
        metrics: {
          users: 2,
          workspaces: 2,
          runs: 4,
          activeRuns: 1,
          failedRuns: 0,
          providers: state.providers.length,
          providerIssues: 0,
          mcps: 3,
          mcpIssues: 0,
          credentials: 2,
          expiringCredentials: 0,
          publishedWorkshops: 2,
          sessions: 3,
          quarantinedSessions: 0,
          suspendedWorkspaces: 0,
          monthlyCostUsd: 12.45,
        },
        anomalies: [],
        recentAdminEvents: [],
      });
    }
    if (path === "/users") {
      return json(
        route,
        pageResult([
          {
            userId: "usr_target_e2e",
            email: "target@example.com",
            displayName: "Target User",
            status: "active",
            workspaceCount: 1,
            activeSessionCount: 1,
            runCount: 2,
            monthlyCostUsd: 3.4,
            lastLoginAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ])
      );
    }
    if (path === "/workspaces") {
      return json(route, pageResult([{ workspaceId: "wsp_e2e", name: "QA Workspace", slug: "qa", type: "team", status: "active", memberCount: 4, activeRunCount: 1, totalRunCount: 6, costUsd: 8.4, createdAt: now, updatedAt: now }]));
    }
    if (path === "/workshops") {
      return json(route, pageResult([{ workshopId: "wsh_e2e", name: { zh: "财税工坊", en: "Tax Workshop" }, category: { zh: "财税", en: "Tax" }, status: "active", governanceStatus: "active", serviceCount: 2, packageCount: 1, runCount: 5, updatedAt: now }]));
    }
    if (path === "/sessions") {
      return json(route, pageResult([{ sessionVersionId: "sev_e2e", displayName: "Tax filing session", taskVersionId: "tsv_e2e", governanceStatus: "active", mcpRequirements: [], runCount: 2, createdAt: now, updatedAt: now }]));
    }
    if (path === "/runs") {
      return json(route, pageResult([{ run: { runId: "run_e2e", title: "Quarterly filing", workspaceId: "wsp_e2e", status: "RUNNING", updatedAt: now }, provider: { providerId: "prv_e2e", displayName: "Primary", model: "gpt-5" }, fileCount: 3, artifactCount: 1, approvalCount: 0 }]));
    }
    if (path === "/runtime") {
      return json(route, { readiness: { status: "ready" }, diagnostics: { status: "ready", activeRunsCount: 1 }, bridgeConnections: [], fileLifecycle: { sweeperActive: true } });
    }
    if (path === "/providers" && method === "GET") {
      if (page.url().includes("business-failure=1") && state.providers.length === 0) {
        state.providers = [{
          providerId: "prv_failure_e2e",
          displayName: "Failure Provider",
          baseUrl: "https://failure-provider.example.com/v1",
          healthcheckPath: "/models",
          defaultModel: "gpt-e2e-fail",
          models: [{ model: "gpt-e2e-fail", label: null, enabled: true, isDefault: true, capabilities: {} }],
          governanceStatus: "active",
          lastHealthcheck: null,
          bindingCount: 0,
          createdAt: now,
          updatedAt: now,
        }];
      }
      return json(route, pageResult(state.providers));
    }
    if (path === "/providers/fetch-models" && method === "POST") {
      return json(route, {
        modelListUrl: "https://e2e-provider.example.com/v1/models",
        fetchedModelIds: ["gpt-e2e", "gpt-e2e-fast"],
        addedModelIds: ["gpt-e2e", "gpt-e2e-fast"],
        existingModelIds: [],
        removedModelIds: [],
        fetchedAt: now,
      });
    }
    if (path === "/providers" && method === "POST") {
      const payload = request.postDataJSON();
      if (payload.input.displayName === "Rejected Provider") {
        return json(route, {
          error: {
            code: "PROVIDER_CONFIGURATION_REJECTED",
            message: "Provider authentication failed",
            details: { issues: ["The remote endpoint rejected this API Key"] },
          },
        }, 422, { "x-request-id": "req_provider_rejected_e2e" });
      }
      const provider = {
        providerId: "prv_created_e2e",
        ...payload.input,
        governanceStatus: payload.input.enabled === false ? "disabled" : "active",
        lastHealthcheck: null,
        bindingCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      state.providers = [provider];
      return json(route, provider);
    }
    if (/^\/providers\/[^/]+\/fetch-models$/.test(path) && method === "POST") {
      return json(route, {
        providerId: state.providers[0]?.providerId,
        modelListUrl: "https://e2e-provider.example.com/v1/models",
        fetchedModelIds: ["gpt-e2e", "gpt-e2e-fast"],
        addedModelIds: ["gpt-e2e-fast"],
        existingModelIds: ["gpt-e2e"],
        removedModelIds: [],
        fetchedAt: now,
      });
    }
    if (/^\/providers\/[^/]+\/models$/.test(path) && method === "PUT") {
      const payload = request.postDataJSON();
      const provider = state.providers[0];
      provider.defaultModel = payload.input.defaultModel;
      provider.models = payload.input.modelIds.map((model) => ({
        model,
        label: null,
        enabled: true,
        isDefault: model === payload.input.defaultModel,
        capabilities: {},
      }));
      return json(route, provider);
    }
    if (/^\/providers\/[^/]+\/test$/.test(path) && method === "POST") {
      const payload = request.postDataJSON();
      if (payload.input.model === "gpt-e2e-fail") {
        const provider = state.providers.find((item) => item.providerId === "prv_failure_e2e");
        if (provider) provider.lastHealthcheck = { status: "failed", responseTimeMs: 89, message: "Upstream API Key was rejected", checkedAt: now };
        return json(route, {
          success: false,
          model: payload.input.model,
          endpointType: "openai",
          stream: payload.input.stream,
          responseTimeMs: 89,
          httpStatus: 401,
          message: "Upstream API Key was rejected",
          testedAt: now,
        });
      }
      return json(route, {
        success: true,
        model: payload.input.model,
        endpointType: payload.input.endpointType === "auto" ? "openai" : payload.input.endpointType,
        stream: payload.input.stream,
        responseTimeMs: 126,
        httpStatus: 200,
        message: "",
        testedAt: now,
      });
    }
    if (path.startsWith("/providers/") && method === "GET") {
      const providerId = decodeURIComponent(path.slice("/providers/".length));
      const provider = state.providers.find((item) => item.providerId === providerId);
      if (provider) {
        return json(route, {
          provider,
          bindings: [{ bindingId: "wpb_e2e", workspaceId: "wsp_e2e", credentialId: "cred_e2e", enabled: true }],
          managementCredentialConfigured: true,
          runs: [],
          audit: [],
        });
      }
    }
    if (path === "/mcps") {
      return json(route, pageResult([{ mcpId: "mcp_e2e", displayName: "External MCP", source: "third-party", transport: "sse", riskLevel: "medium", governanceStatus: "active", latestHealth: { status: "healthy" }, bindingCount: 1, callCount: 20, updatedAt: now }]));
    }
    if (path === "/credentials") {
      return json(route, pageResult([{ credentialId: "cred_e2e", displayName: "Provider key", provider: "openai", secretKind: "api-key", scope: "workspace", governanceStatus: "active", brokerKind: "local-envelope", secretVersion: 1, rotationDueAt: null, materializationCount: 2 }]));
    }
    if (path === "/quotas") {
      return json(route, pageResult([{ policyId: "qpo_e2e", workspaceId: "wsp_e2e", scopeType: "workspace", scopeRefId: "wsp_e2e", metric: "daily_runs", windowType: "day", status: "active", limitValue: 100, counters: [{ currentValue: 12 }], overrides: [], updatedAt: now }]));
    }
    if (path === "/ledger") return json(route, { ...pageResult([]), summary: { currency: "USD", totalAmountUsd: 0 } });
    if (path === "/audit") return json(route, pageResult([]));
    if (path === "/system") {
      return json(route, {
        readiness: { status: "ready", dependencies: {} },
        runtime: { bridgeRegistry: { initialized: true } },
        configuration: { authMode: "required", authStore: "postgres" },
        settings: [],
        featureFlags: {},
        notifications: {},
        retention: {},
        adminAccounts: [{ email: "platform-admin@example.com", displayName: "Platform Admin", status: "active", mfa: "configured", lastLoginAt: now }],
        release: "e2e",
        checkedAt: now,
      });
    }
    if (path === "/actions/impact") {
      return json(route, {
        operationId: "aop_e2e",
        resourceType: "user",
        resourceId: "usr_target_e2e",
        action: "suspend",
        impactHash: "a".repeat(64),
        impact: { resourceName: "Target User", currentStatus: "active", targetStatus: "suspended", activeSessions: 1, version: 0 },
        confirmationPhrase: "SUSPEND usr_target_e2e",
        requestedByUserId: "usr_admin_e2e",
        createdAt: now,
        expiresAt: "2099-07-15T08:05:00.000Z",
        consumedAt: null,
      });
    }
    if (path === "/actions/execute") return json(route, { operationId: "aop_e2e", auditStatus: "persisted", result: { status: "suspended" } });

    return json(route, { error: { code: "E2E_ROUTE_UNHANDLED", message: `${method} ${path}` } }, 404);
  });
}

test.describe("independent admin console", () => {
  test.beforeEach(async ({ page }) => {
    await installAdminApiMock(page);
  });

  test("loads all eight management modules without overflow", async ({ page }) => {
    const routes = [
      ["/", "平台总览"],
      ["/accounts/users", "用户"],
      ["/accounts/workspaces", "工作区"],
      ["/catalog/workshops", "工坊"],
      ["/catalog/sessions", "Session 资产"],
      ["/runs", "运行实例"],
      ["/runtime", "运行时"],
      ["/providers", "Provider 与模型"],
      ["/integrations/mcps", "MCP 注册表"],
      ["/integrations/credentials", "私有凭证"],
      ["/billing/quotas", "套餐与配额"],
      ["/billing/ledger", "用量与账本"],
      ["/audit", "审计事件"],
      ["/settings", "审计与系统"],
    ];

    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });

  test("supports theme, drawer, provider creation, and impact review", async ({ page }) => {
    await page.goto("/providers");
    await page.getByRole("button", { name: "浅色主题" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "收起侧栏" }).click();
    await expect(page.locator(".admin-shell")).toHaveClass(/sidebar-collapsed/);

    await page.getByRole("button", { name: "新建 Provider" }).click();
    await page.getByLabel("显示名称").fill("E2E Provider");
    await page.getByLabel("Base URL").fill("https://e2e-provider.example.com/v1");
    await page.getByLabel("API Key", { exact: true }).fill("sk-e2e-provider-key");
    await page.getByRole("button", { name: "拉取模型" }).click();
    await expect(page.getByTestId("admin-toast-success").filter({ hasText: "远端模型已拉取" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "拉取模型" })).toBeVisible();
    const newModelOption = page.locator(".provider-model-option").filter({ hasText: "gpt-e2e" }).first();
    await newModelOption.getByRole("checkbox").check();
    await page.getByRole("button", { name: "填入模型" }).click();
    await expect(page.getByLabel("默认模型", { exact: true })).toHaveValue("gpt-e2e");
    await expect(page.getByLabel("已选模型", { exact: true })).toHaveValue("gpt-e2e");
    await page.getByLabel("变更原因").fill("Create provider from the independent Admin E2E flow");
    await page.getByRole("button", { name: "保存 Provider" }).click();
    await expect(page.getByTestId("admin-toast-success").filter({ hasText: "操作已完成" })).toBeVisible();
    await expect(page.getByText("E2E Provider", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "拉取模型" }).first().click();
    const fastModelOption = page.locator(".provider-model-option").filter({ hasText: "gpt-e2e-fast" });
    await fastModelOption.getByRole("checkbox").check();
    await page.getByRole("button", { name: "保存模型" }).click();
    await expect(page.getByRole("cell", { name: "gpt-e2e-fast" })).toBeVisible();

    await page.getByRole("button", { name: "测试模型" }).first().click();
    await page.getByRole("button", { name: "测试已选模型 (1)" }).click();
    await expect(page.getByRole("cell", { name: "126 ms" })).toBeVisible();
    await page.getByRole("button", { name: "关闭", exact: true }).click();

    await page.goto("/accounts/users");
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "暂停" })).toBeVisible();
    await expect(page.getByText("SUSPEND usr_target_e2e", { exact: true })).toBeVisible();
    await page.getByLabel("操作原因", { exact: false }).fill("Suspend account during Admin E2E governance verification");
    await page.getByLabel("确认词", { exact: false }).fill("SUSPEND usr_target_e2e");
    await page.getByRole("button", { name: "确认执行" }).click();
    await expect(page.getByText("操作已执行，审计记录已写入。")).toBeVisible();
    await expect(page.getByTestId("admin-toast-success").filter({ hasText: "操作已完成" })).toBeVisible();
  });

  test("reports provider validation and structured API failures", async ({ page }) => {
    await page.goto("/providers");
    await page.getByRole("button", { name: "新建 Provider" }).click();
    await page.getByRole("button", { name: "保存 Provider" }).click();

    const validationToast = page.getByTestId("admin-toast-warning").filter({ hasText: "表单未提交" });
    await expect(validationToast).toBeVisible();
    await expect(validationToast).toContainText("显示名称");
    await expect(validationToast).toContainText("Base URL");
    await expect(validationToast).toContainText("API Key");
    await expect(validationToast).toContainText("默认模型");
    await expect(page.locator(".form-error-summary")).toBeVisible();
    const layout = await page.evaluate(() => {
      const toast = document.querySelector('[data-testid="admin-toast-warning"]')?.getBoundingClientRect();
      const drawer = document.querySelector(".form-drawer")?.getBoundingClientRect();
      return toast && drawer ? { toastRight: toast.right, drawerLeft: drawer.left, overflow: document.documentElement.scrollWidth > innerWidth } : null;
    });
    expect(layout).not.toBeNull();
    expect(layout.toastRight).toBeLessThanOrEqual(layout.drawerLeft);
    expect(layout.overflow).toBe(false);

    await page.getByLabel("显示名称").fill("Rejected Provider");
    await page.getByLabel("Base URL").fill("https://rejected-provider.example.com/v1");
    await page.getByLabel("API Key", { exact: true }).fill("sk-rejected");
    await page.getByLabel("默认模型", { exact: true }).fill("gpt-rejected");
    await page.getByLabel("已选模型", { exact: true }).fill("gpt-rejected");
    await page.getByLabel("变更原因").fill("Verify structured Provider rejection toast");
    await page.getByRole("button", { name: "保存 Provider" }).click();

    const apiToast = page.getByTestId("admin-toast-error").filter({ hasText: "Provider authentication failed" });
    await expect(apiToast).toBeVisible();
    await expect(apiToast).toContainText("PROVIDER_CONFIGURATION_REJECTED");
    await expect(apiToast).toContainText("HTTP 422");
    await expect(apiToast).toContainText("POST /providers");
    await expect(apiToast).toContainText("req_provider_rejected_e2e");
    await expect(apiToast).toContainText("The remote endpoint rejected this API Key");
  });

  test("reports network failures with request metadata", async ({ page }) => {
    await page.route("**/admin/v1/runtime", (route) => route.abort("connectionfailed"));
    await page.goto("/runtime");

    const networkToast = page.getByTestId("admin-toast-error").filter({ hasText: "请求失败" });
    await expect(networkToast).toBeVisible();
    await expect(networkToast).toContainText("ADMIN_NETWORK_ERROR");
    await expect(networkToast).toContainText("GET /runtime");
    await expect(networkToast.locator(".toast-meta button")).toBeVisible();
  });

  test("reports Provider business-level test failures returned with HTTP 200", async ({ page }) => {
    await page.goto("/providers?business-failure=1");
    await expect(page.getByText("Failure Provider", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "快速测试默认模型" }).click();

    const failureToast = page.getByTestId("admin-toast-error").filter({ hasText: "测试失败" });
    await expect(failureToast).toBeVisible();
    await expect(failureToast).toContainText("Upstream API Key was rejected");
    await expect(page.getByRole("table").getByText("失败", { exact: true })).toBeVisible();
  });

  test("explains governance and settings boundary conditions", async ({ page }) => {
    await page.goto("/accounts/users");
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await page.getByRole("button", { name: "确认执行" }).click();
    await expect(page.getByTestId("admin-toast-warning").filter({ hasText: "请填写操作原因" })).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("button", { name: "策略与通知" }).click();
    const editor = page.locator(".config-editor").first();
    await editor.fill("{invalid json");
    await page.getByRole("button", { name: "保存变更" }).first().click();
    await expect(page.getByTestId("admin-toast-warning").filter({ hasText: "JSON 格式无效" })).toBeVisible();
  });

  test("blocks management controls below the supported viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 });
    await page.goto("/");
    await expect(page.getByText("Admin Console 需要至少 1024px 的可用宽度。")).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByRole("heading", { level: 1, name: "平台总览" })).toBeVisible();
  });

  test("switches all visible content to English without losing route state", async ({ page }) => {
    await page.goto("/accounts/users?q=Target&status=active");
    await expect(page.getByRole("heading", { level: 1, name: "用户" })).toBeVisible();
    await page.getByRole("button", { name: "切换语言" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page).toHaveURL(/\/accounts\/users\?q=Target&status=active/);
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Workspaces" })).toBeVisible();
    await expect(page.getByRole("table").getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Name, ID, email, or error code")).toHaveValue("Target");

    await page.getByRole("button", { name: "Switch language" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { level: 1, name: "用户" })).toBeVisible();
  });

  test("restores an expired access session with the refresh cookie", async ({ page }) => {
    let refreshRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/admin/v1/auth/refresh") refreshRequests += 1;
    });

    await page.goto("/?expired-session=1");
    await expect(page.getByRole("heading", { level: 1, name: "平台总览" })).toBeVisible();
    await expect.poll(() => refreshRequests).toBe(1);
    await expect(page.getByRole("heading", { level: 2, name: "总管理员登录" })).toHaveCount(0);
  });
});
