import { expect, test } from "@playwright/test";

const runId = "run_tax_q2_0001";
const workspaceId = "wsp_harbor_finance";
const taskVersionId = "tsv_tax_q2_0001";
const sessionVersionId = "sev_tax_q2_0001";
const targetPath = `/workspace/${runId}`;
const entrySurface = "h5";
const approvalRunId = "run_tax_q2_approval";
const approvalTargetPath = `/workspace/${approvalRunId}`;
const reviewRunId = "run_tax_q2_review_answers";
const reviewAnswerId = "ans_tax_q2_review_0001";
const reviewTargetPath = `/workspace/${reviewRunId}`;
const fileBrowserRunId = "run_tax_q2_files_mobile";
const fileBrowserTargetPath = `/workspace/${fileBrowserRunId}`;
const inlinePreviewImageUrl = "/previews/mobile/poster.png";
const inlinePreviewPdfUrl = "/previews/mobile/receipt.pdf";
const disabledAuthBootstrap = {
  authMode: "disabled",
  currentWorkspace: {
    contextKey: "harbor-finance",
    runtimeWorkspaceId: workspaceId,
    displayName: { zh: "Harbor Finance Workspace", en: "Harbor Finance Workspace" },
    type: "enterprise",
    meta: { zh: "企业财税工作区", en: "Enterprise finance workspace" },
    root: "/workspace/harbor-finance/",
    allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
  },
  workspaces: [],
};
disabledAuthBootstrap.workspaces = [disabledAuthBootstrap.currentWorkspace];

function buildRunFilePreviewRecord({
  runId,
  workspaceId,
  targetPath,
  path,
  name,
  kind,
  sizeBytes,
  mimeType,
  previewMode,
}) {
  const logicalPath = path.replace(`${targetPath}/`, "");
  return {
    path,
    name,
    kind,
    sizeBytes,
    updatedAt: "2026-07-12T11:05:00.000Z",
    runId,
    workspaceId,
    logicalPath,
    source: "runtime-output",
    mimeType,
    objectKey: `runs/${runId}/indexed/runtime-output/${logicalPath}`,
    uploadId: null,
    checksum: "c".repeat(64),
    previewMode,
    previewable: previewMode === "text" || previewMode === "image" || previewMode === "pdf",
    downloadable: true,
    storageTier: "hot",
    archivedAt: null,
    archivedFromObjectKey: null,
    archiveReason: null,
    indexedAt: "2026-07-12T11:05:00.000Z",
  };
}

function createFileBrowserRunFiles() {
  return [
    {
      path: `${fileBrowserTargetPath}/output/`,
      name: "output/",
      kind: "output",
      sizeBytes: null,
      updatedAt: "2026-07-12T11:05:00.000Z",
    },
    {
      path: `${fileBrowserTargetPath}/output/checklist.txt`,
      name: "checklist.txt",
      kind: "output",
      sizeBytes: 88,
      updatedAt: "2026-07-12T11:05:00.000Z",
    },
    {
      path: `${fileBrowserTargetPath}/output/filing-brief.docx`,
      name: "filing-brief.docx",
      kind: "output",
      sizeBytes: 16384,
      updatedAt: "2026-07-12T11:05:05.000Z",
    },
    {
      path: `${fileBrowserTargetPath}/output/poster.png`,
      name: "poster.png",
      kind: "output",
      sizeBytes: 4096,
      updatedAt: "2026-07-12T11:05:10.000Z",
    },
    {
      path: `${fileBrowserTargetPath}/output/receipt.pdf`,
      name: "receipt.pdf",
      kind: "receipt",
      sizeBytes: 20480,
      updatedAt: "2026-07-12T11:05:00.000Z",
    },
    {
      path: `${fileBrowserTargetPath}/output/bundle.zip`,
      name: "bundle.zip",
      kind: "archive",
      sizeBytes: 65536,
      updatedAt: "2026-07-12T11:05:20.000Z",
    },
  ];
}

function createFileBrowserRunSnapshot() {
  return {
    run: {
      runId: fileBrowserRunId,
      workspaceId,
      taskVersionId: "tsv_tax_q2_files_mobile",
      sessionVersionId: "sev_tax_q2_files_mobile",
      requestedByUserId: "usr_mobile_file_browser",
      title: "2026 Q2 tax file browser",
      targetPath: fileBrowserTargetPath,
      entrySurface,
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "Harbor Finance Workspace",
          en: "Harbor Finance Workspace",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "Enterprise Tax Workshop",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "Hong Kong Quarterly Filing",
          en: "Hong Kong Quarterly Filing",
        },
      },
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-12T11:04:00.000Z",
      updatedAt: "2026-07-12T11:05:00.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2-files-mobile",
      startedAt: "2026-07-12T11:04:10.000Z",
      readyAt: "2026-07-12T11:04:18.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    messages: [
      {
        messageId: "msg_mobile_file_0001",
        runId: fileBrowserRunId,
        role: "agent",
        kind: "text",
        text: "The file bundle is ready for preview and download.",
        attachments: [],
        createdAt: "2026-07-12T11:05:00.000Z",
      },
    ],
    files: createFileBrowserRunFiles(),
    artifacts: [],
    approvals: [],
  };
}

function createRunMessages(extraMessages = []) {
  return [
    {
      messageId: "msg_system_0001",
      runId,
      role: "system",
      kind: "prompt",
      text: "请告诉我还需要哪些企业报税材料。",
      attachments: [],
      createdAt: "2026-07-10T10:30:00.000Z",
    },
    {
      messageId: "msg_agent_0001",
      runId,
      role: "agent",
      kind: "text",
      text: "我已经接管当前实例，请先补充公司名称和申报周期。",
      attachments: [],
      createdAt: "2026-07-10T10:31:00.000Z",
    },
    ...extraMessages,
  ];
}

function createRunFiles() {
  return [
    {
      path: `${targetPath}/output/`,
      name: "output/",
      kind: "output",
      sizeBytes: null,
      updatedAt: "2026-07-10T10:32:00.000Z",
    },
    {
      path: `${targetPath}/output/receipt.pdf`,
      name: "receipt.pdf",
      kind: "receipt",
      sizeBytes: 20480,
      updatedAt: "2026-07-10T10:32:00.000Z",
    },
  ];
}

function createRunSnapshot(extraMessages = []) {
  return {
    run: {
      runId,
      workspaceId,
      taskVersionId,
      sessionVersionId,
      requestedByUserId: "usr_demo_0001",
      title: "2026 Q2 企业报税",
      targetPath,
      entrySurface,
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "华港财务空间",
          en: "Harbor Finance Workspace",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "香港有限公司季度报税",
          en: "Hong Kong Quarterly Filing",
        },
      },
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-10T10:29:00.000Z",
      updatedAt: "2026-07-10T10:32:00.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2",
      startedAt: "2026-07-10T10:29:30.000Z",
      readyAt: "2026-07-10T10:29:40.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    messages: createRunMessages(extraMessages),
    files: createRunFiles(),
    artifacts: [],
    approvals: [],
  };
}

function createReleasedRunSnapshot(extraMessages = []) {
  const snapshot = createRunSnapshot(extraMessages);
  const releasedAt = "2026-07-21T10:27:49.009Z";
  return {
    ...snapshot,
    run: {
      ...snapshot.run,
      status: "CANCELLED",
      statusReason: "User stopped the run from Mobile H5.",
      updatedAt: releasedAt,
    },
    runtime: {
      ...snapshot.runtime,
      finishedAt: releasedAt,
      exitCode: 0,
      exitSignal: null,
    },
    lifecycle: {
      runtimeStatus: "RELEASED",
      recordStatus: "ACTIVE",
      stopMode: "graceful",
      stopReason: "User stopped the run from Mobile H5.",
      stopRequestedAt: releasedAt,
      releasedAt,
      billingStoppedAt: releasedAt,
      cleanupAttemptCount: 1,
    },
  };
}

function createApprovalRunFiles() {
  return [
    {
      path: `${approvalTargetPath}/output/`,
      name: "output/",
      kind: "output",
      sizeBytes: null,
      updatedAt: "2026-07-12T11:02:00.000Z",
    },
    {
      path: `${approvalTargetPath}/output/review-note.txt`,
      name: "review-note.txt",
      kind: "log",
      sizeBytes: 512,
      updatedAt: "2026-07-12T11:02:00.000Z",
    },
  ];
}

function createApprovalRunSnapshot() {
  return {
    run: {
      runId: approvalRunId,
      workspaceId,
      taskVersionId: "tsv_tax_q2_approval",
      sessionVersionId: "sev_tax_q2_approval",
      requestedByUserId: "usr_demo_approval",
      title: "2026 Q2 approval review",
      targetPath: approvalTargetPath,
      entrySurface,
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "华港财务空间",
          en: "Harbor Finance Workspace",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "报税复核",
          en: "Filing review",
        },
      },
      status: "WAITING_APPROVAL",
      statusReason: "Pending confirmation.",
      createdAt: "2026-07-12T10:58:00.000Z",
      updatedAt: "2026-07-12T11:02:00.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2-approval",
      startedAt: "2026-07-12T10:58:15.000Z",
      readyAt: "2026-07-12T10:58:28.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    messages: [
      {
        messageId: "msg_system_approval_0001",
        runId: approvalRunId,
        role: "system",
        kind: "prompt",
        text: "Please review the approval request before I continue.",
        attachments: [],
        createdAt: "2026-07-12T11:00:00.000Z",
      },
      {
        messageId: "msg_agent_approval_0001",
        runId: approvalRunId,
        role: "agent",
        kind: "text",
        text: "I need a confirmation before I can continue the filing flow.",
        attachments: [],
        createdAt: "2026-07-12T11:01:00.000Z",
      },
    ],
    files: createApprovalRunFiles(),
    artifacts: [],
    approvals: [
      {
        approvalId: "apr_tax_q2_mobile_0001",
        runId: approvalRunId,
        kind: "general",
        relatedResourceRef: "run://tax-q2/review",
        prompt: "Approve the next step so Codex can continue the filing review.",
        state: "pending",
        requestedAt: "2026-07-12T11:01:30.000Z",
        decidedAt: null,
        note: "This request was raised from the live conversation.",
      },
    ],
  };
}

function createReviewRunFiles() {
  return [
    {
      path: `${reviewTargetPath}/output/`,
      name: "output/",
      kind: "output",
      sizeBytes: null,
      updatedAt: "2026-07-12T11:36:00.000Z",
    },
    {
      path: `${reviewTargetPath}/output/review-digest.txt`,
      name: "review-digest.txt",
      kind: "log",
      sizeBytes: 768,
      updatedAt: "2026-07-12T11:36:00.000Z",
    },
  ];
}

function createReviewRunSnapshot(reviewState = "pending") {
  const isApproved = reviewState === "approved";
  const reviewNote = isApproved ? "Approved from mobile review panel." : null;

  return {
    run: {
      runId: reviewRunId,
      workspaceId,
      taskVersionId: "tsv_tax_q2_review_answers",
      sessionVersionId: "sev_tax_q2_review_answers",
      requestedByUserId: "usr_demo_review",
      title: "2026 Q2 slot answer review",
      targetPath: reviewTargetPath,
      entrySurface,
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "华港财务空间",
          en: "Harbor Finance Workspace",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "答案复核",
          en: "Answer review",
        },
      },
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-12T11:30:00.000Z",
      updatedAt: isApproved ? "2026-07-12T11:38:00.000Z" : "2026-07-12T11:36:00.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2-review-answers",
      startedAt: "2026-07-12T11:30:12.000Z",
      readyAt: "2026-07-12T11:30:25.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    informationCollection: {
      prompt: "请确认结构化答案是否准确，然后我继续生成材料。",
      slotSchemaVersion: "imported.v1",
      status: "completed",
      requiredCount: 1,
      satisfiedCount: 1,
      missingCount: 0,
      userMessageCount: 1,
      attachmentCount: 0,
      pendingReviewCount: isApproved ? 0 : 1,
      approvedReviewCount: isApproved ? 1 : 0,
      rejectedReviewCount: 0,
      lastUpdatedAt: isApproved ? "2026-07-12T11:38:00.000Z" : "2026-07-12T11:36:00.000Z",
      slots: [
        {
          key: "company_name",
          title: "Company legal name",
          type: "string",
          required: true,
          secret: false,
          repeatable: false,
          prompt: "Provide the legal entity name.",
          description: null,
          placeholder: null,
          choices: [],
          accepts: [],
          status: "satisfied",
          attachmentCount: 0,
          answerCount: 1,
          lastAnswerText: "Lingban Holdings Limited",
          lastSatisfiedAt: "2026-07-12T11:35:20.000Z",
        },
      ],
      answers: [
        {
          answerId: reviewAnswerId,
          slotKey: "company_name",
          slotType: "string",
          kind: "text",
          source: "user-message",
          sourceMessageId: "msg_user_review_0001",
          valueText: "Lingban Holdings Limited",
          attachmentPath: null,
          attachmentLabel: null,
          reviewStatus: isApproved ? "approved" : "pending",
          reviewedAt: isApproved ? "2026-07-12T11:38:00.000Z" : null,
          reviewedByUserId: isApproved ? "usr_demo_review" : null,
          reviewNote,
          supersedesAnswerId: null,
          supersededByAnswerId: null,
          createdAt: "2026-07-12T11:35:20.000Z",
        },
      ],
    },
    messages: [
      {
        messageId: "msg_system_review_0001",
        runId: reviewRunId,
        role: "system",
        kind: "prompt",
        text: "请确认结构化答案是否准确，然后我继续生成材料。",
        attachments: [],
        createdAt: "2026-07-12T11:34:00.000Z",
      },
      {
        messageId: "msg_user_review_0001",
        runId: reviewRunId,
        role: "user",
        kind: "text",
        text: "公司法定名称是 Lingban Holdings Limited。",
        attachments: [],
        createdAt: "2026-07-12T11:35:20.000Z",
      },
      {
        messageId: "msg_agent_review_0001",
        runId: reviewRunId,
        role: "agent",
        kind: "text",
        text: "我已经提取出公司法定名称，请复核后我继续执行。",
        attachments: [],
        createdAt: "2026-07-12T11:36:00.000Z",
      },
    ],
    files: createReviewRunFiles(),
    artifacts: [],
    approvals: [],
  };
}

function createRunsSummary() {
  return {
    total: 1,
    pendingApprovalsCount: 0,
    outputsReadyCount: 1,
    latestUpdatedAt: "2026-07-10T10:32:00.000Z",
    byStatus: {
      CREATED: 0,
      READY: 0,
      QUEUED: 0,
      STARTING: 0,
      RUNNING: 1,
      WAITING_APPROVAL: 0,
      SUCCEEDED: 0,
      FAILED: 0,
      CANCELLED: 0,
    },
    byViewStatus: {
      all: 1,
      running: 1,
      approval: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
    },
    byAttentionMode: {
      todo: 0,
      running: 1,
      done: 0,
    },
    byEntrySurface: [{ key: "h5", count: 1 }],
    byTag: [{ key: "#finance", count: 1 }],
    byWorkshop: [
      {
        workshopId: "enterprise-tax",
        title: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        count: 1,
      },
    ],
  };
}

function createApprovalRunsSummary(hasPendingApproval) {
  return {
    total: 1,
    pendingApprovalsCount: hasPendingApproval ? 1 : 0,
    outputsReadyCount: 1,
    latestUpdatedAt: hasPendingApproval
      ? "2026-07-12T11:02:00.000Z"
      : "2026-07-12T11:03:00.000Z",
    byStatus: {
      CREATED: 0,
      READY: 0,
      QUEUED: 0,
      STARTING: 0,
      RUNNING: hasPendingApproval ? 0 : 1,
      WAITING_APPROVAL: hasPendingApproval ? 1 : 0,
      SUCCEEDED: 0,
      FAILED: 0,
      CANCELLED: 0,
    },
    byViewStatus: {
      all: 1,
      running: hasPendingApproval ? 0 : 1,
      approval: hasPendingApproval ? 1 : 0,
      done: 0,
      failed: 0,
      cancelled: 0,
    },
    byAttentionMode: {
      todo: hasPendingApproval ? 1 : 0,
      running: hasPendingApproval ? 0 : 1,
      done: 0,
    },
    byEntrySurface: [{ key: "h5", count: 1 }],
    byTag: [{ key: "#finance", count: 1 }],
    byWorkshop: [
      {
        workshopId: "enterprise-tax",
        title: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        count: 1,
      },
    ],
  };
}

function createReviewRunsSummary(hasPendingReview) {
  return {
    total: 1,
    pendingApprovalsCount: 0,
    outputsReadyCount: 1,
    latestUpdatedAt: hasPendingReview
      ? "2026-07-12T11:36:00.000Z"
      : "2026-07-12T11:38:00.000Z",
    byStatus: {
      CREATED: 0,
      READY: 0,
      QUEUED: 0,
      STARTING: 0,
      RUNNING: 1,
      WAITING_APPROVAL: 0,
      SUCCEEDED: 0,
      FAILED: 0,
      CANCELLED: 0,
    },
    byViewStatus: {
      all: 1,
      running: 1,
      approval: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
    },
    byAttentionMode: {
      todo: hasPendingReview ? 1 : 0,
      running: hasPendingReview ? 0 : 1,
      done: 0,
    },
    byEntrySurface: [{ key: "h5", count: 1 }],
    byTag: [{ key: "#finance", count: 1 }],
    byWorkshop: [
      {
        workshopId: "enterprise-tax",
        title: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        count: 1,
      },
    ],
  };
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.beforeEach(async ({ page }) => {
  let messagePostAttempts = 0;
  let currentMessages = createRunMessages();
  let runReleased = false;

  await page.route("**/v1/auth/session", async (route) => {
    await fulfillJson(route, disabledAuthBootstrap);
  });

  await page.route("**/v1/runs**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/v1/runs") {
      await fulfillJson(route, [runReleased
        ? createReleasedRunSnapshot(currentMessages.slice(2))
        : createRunSnapshot(currentMessages.slice(2))]);
      return;
    }

    if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
      await fulfillJson(route, createRunsSummary());
      return;
    }

    if (request.method() === "GET" && url.pathname === `/v1/runs/${runId}`) {
      await fulfillJson(route, runReleased
        ? createReleasedRunSnapshot(currentMessages.slice(2))
        : createRunSnapshot(currentMessages.slice(2)));
      return;
    }

    if (request.method() === "POST" && url.pathname === `/v1/runs/${runId}/stop`) {
      runReleased = true;
      await fulfillJson(route, createReleasedRunSnapshot(currentMessages.slice(2)));
      return;
    }

    if (request.method() === "GET" && url.pathname === `/v1/runs/${runId}/files/tree`) {
      await fulfillJson(route, createRunFiles());
      return;
    }

    if (request.method() === "POST" && url.pathname === `/v1/runs/${runId}/messages`) {
      messagePostAttempts += 1;
      const payload = JSON.parse(request.postData() ?? "{}");

      if (messagePostAttempts === 1) {
        await fulfillJson(
          route,
          {
            error: {
              message: "Simulated send failure",
            },
          },
          500
        );
        return;
      }

      currentMessages = [
        ...currentMessages,
        {
          messageId: `msg_user_${messagePostAttempts}`,
          runId,
          role: "user",
          kind: "text",
          text: payload.text,
          attachments: payload.attachments ?? [],
          createdAt: "2026-07-10T10:33:00.000Z",
        },
      ];
      await fulfillJson(route, createRunSnapshot(currentMessages.slice(2)));
      return;
    }

    await fulfillJson(route, {
      error: {
        message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
      },
    }, 404);
  });
});

test.describe("mobile h5 smoke", () => {
  test("loads workshops landing route", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("mobile-workshops-page")).toBeVisible();
  });

  test("navigates through task list, task detail, and files", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await expect(page.getByTestId("mobile-tasks-page")).toBeVisible();

    await page.getByTestId(`mobile-task-open-${runId}`).click();
    await expect(page.getByTestId("mobile-task-detail-page")).toBeVisible();

    await page.getByTestId("mobile-task-detail-open-files").click();
    await expect(page.getByTestId("mobile-task-files-page")).toBeVisible();
  });

  test("stops and releases an active run from task detail", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${runId}`).click();
    await expect(page.getByTestId("mobile-task-detail-page")).toBeVisible();

    await page.getByTestId("mobile-task-lifecycle-menu").click();
    await page.getByText("立即停止并释放", { exact: true }).click();
    await expect(page.getByText("确认停止", { exact: true })).toBeVisible();

    const stopRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === `/v1/runs/${runId}/stop`;
    });
    await page.getByText("确认停止", { exact: true }).click();
    const request = await stopRequest;

    expect(JSON.parse(request.postData() ?? "{}")).toMatchObject({ mode: "graceful" });
    await expect(page.getByTestId("mobile-task-lifecycle-status")).toContainText("运行环境已释放");
    await expect(page.getByTestId("mobile-task-terminal-actions")).toBeVisible();
  });

  test("keeps the task conversation composer visually consistent on mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${runId}`).click();
    await page.getByTestId("mobile-task-composer-toggle").click();

    const detailPage = page.getByTestId("mobile-task-detail-page");
    const composer = page.getByTestId("mobile-task-composer");
    const composerInput = page.locator(
      '[data-testid="mobile-task-composer-input"] textarea'
    );
    const approvalControl = page.getByTestId("mobile-approval-mode-control");
    const sendButton = page.getByTestId("mobile-task-send-button");
    const summaryToggle = page.getByTestId("mobile-task-summary-toggle");
    const firstMessage = detailPage.locator(".thread .message-card").first();

    await expect(detailPage).toBeVisible();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "false");
    await expect(firstMessage).toBeVisible();
    await expect(detailPage.getByText("计费明细")).toHaveCount(0);

    await summaryToggle.click();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "true");
    await expect(detailPage.getByText("计费明细")).toBeVisible();
    await summaryToggle.click();
    await expect(summaryToggle).toHaveAttribute("aria-expanded", "false");

    await composer.scrollIntoViewIfNeeded();
    await expect(composer).toBeVisible();
    await expect(approvalControl).toBeVisible();

    const visualState = await page.evaluate(() => {
      const input = document.querySelector(
        '[data-testid="mobile-task-composer-input"] textarea'
      );
      const approval = document.querySelector(
        '[data-testid="mobile-approval-mode-control"]'
      );
      const send = document.querySelector('[data-testid="mobile-task-send-button"]');
      const inputStyle = input ? getComputedStyle(input) : null;
      const approvalRect = approval?.getBoundingClientRect();
      const inputRect = input?.getBoundingClientRect();
      const sendStyle = send ? getComputedStyle(send) : null;

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        inputBackground: inputStyle?.backgroundColor ?? null,
        inputColor: inputStyle?.color ?? null,
        sendFontSize: sendStyle ? Number.parseFloat(sendStyle.fontSize) : null,
        overlaps:
          approvalRect && inputRect
            ? approvalRect.top < inputRect.bottom && approvalRect.bottom > inputRect.top
            : true,
      };
    });

    expect(visualState.documentWidth).toBeLessThanOrEqual(visualState.viewportWidth);
    expect(visualState.inputBackground).not.toBe("rgb(255, 255, 255)");
    expect(visualState.inputColor).not.toBe("rgb(0, 0, 0)");
    expect(visualState.sendFontSize).not.toBeNull();
    expect(visualState.sendFontSize).toBeLessThanOrEqual(14);
    expect(visualState.overlaps).toBe(false);
    await expect(composerInput).toHaveCSS("font-size", /1[23](?:\.\d+)?px/);
    await expect(sendButton).toHaveCSS("border-radius", /6(?:\.\d+)?px/);

    await page.setViewportSize({ width: 360, height: 800 });
    await composer.scrollIntoViewIfNeeded();
    const compactLayout = await page.evaluate(() => {
      const composerElement = document.querySelector('[data-testid="mobile-task-composer"]');
      const actionRow = composerElement?.querySelector(".composer-row");
      const composerRect = composerElement?.getBoundingClientRect();
      const actionRect = actionRow?.getBoundingClientRect();

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        composerLeft: composerRect?.left ?? -1,
        composerRight: composerRect?.right ?? Number.POSITIVE_INFINITY,
        actionLeft: actionRect?.left ?? -1,
        actionRight: actionRect?.right ?? Number.POSITIVE_INFINITY,
      };
    });

    expect(compactLayout.documentWidth).toBeLessThanOrEqual(compactLayout.viewportWidth);
    expect(compactLayout.composerLeft).toBeGreaterThanOrEqual(0);
    expect(compactLayout.composerRight).toBeLessThanOrEqual(compactLayout.viewportWidth);
    expect(compactLayout.actionLeft).toBeGreaterThanOrEqual(compactLayout.composerLeft);
    expect(compactLayout.actionRight).toBeLessThanOrEqual(compactLayout.composerRight);
  });

  test("previews and downloads files from the h5 file page", async ({ page }) => {
    const fileSnapshot = createFileBrowserRunSnapshot();
    let previewRequests = 0;
    const downloadTicketPaths = [];

    await page.unroute("**/v1/runs**");
    await page.addInitScript(() => {
      globalThis.__openedUrls = [];
      globalThis.open = (...args) => {
        globalThis.__openedUrls.push(String(args[0] ?? ""));
        return null;
      };
      window.open = (...args) => {
        globalThis.__openedUrls.push(String(args[0] ?? ""));
        return null;
      };
    });

    await page.route("**/v1/runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/runs") {
        await fulfillJson(route, [fileSnapshot]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, createRunsSummary());
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileBrowserRunId}`) {
        await fulfillJson(route, fileSnapshot);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileBrowserRunId}/files/tree`) {
        await fulfillJson(route, fileSnapshot.files);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileBrowserRunId}/files/preview`) {
        previewRequests += 1;
        const requestedPath = url.searchParams.get("path") ?? "";

        if (requestedPath.endsWith("checklist.txt")) {
          await fulfillJson(route, {
            file: buildRunFilePreviewRecord({
              runId: fileBrowserRunId,
              workspaceId,
              targetPath: fileBrowserTargetPath,
              path: `${fileBrowserTargetPath}/output/checklist.txt`,
              name: "checklist.txt",
              kind: "output",
              sizeBytes: 88,
              mimeType: "text/plain",
              previewMode: "text",
            }),
            mode: "text",
            mimeType: "text/plain",
            content: "Checklist ready\n- upload tax forms\n- confirm receipt archive",
            encoding: "utf8",
            truncated: false,
            downloadUrl: null,
            downloadTicketId: null,
            downloadExpiresAt: null,
          });
          return;
        }

        if (requestedPath.endsWith("filing-brief.docx")) {
          await fulfillJson(route, {
            file: buildRunFilePreviewRecord({
              runId: fileBrowserRunId,
              workspaceId,
              targetPath: fileBrowserTargetPath,
              path: `${fileBrowserTargetPath}/output/filing-brief.docx`,
              name: "filing-brief.docx",
              kind: "output",
              sizeBytes: 16384,
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              previewMode: "text",
            }),
            mode: "text",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            content:
              "Filing brief\n- entity: Harbor Finance Holdings Ltd.\n- period: 2026 Q2\n- status: ready for operator review",
            encoding: "utf8",
            truncated: false,
            downloadUrl: null,
            downloadTicketId: null,
            downloadExpiresAt: null,
          });
          return;
        }

        if (requestedPath.endsWith("poster.png")) {
          await fulfillJson(route, {
            file: buildRunFilePreviewRecord({
              runId: fileBrowserRunId,
              workspaceId,
              targetPath: fileBrowserTargetPath,
              path: `${fileBrowserTargetPath}/output/poster.png`,
              name: "poster.png",
              kind: "output",
              sizeBytes: 4096,
              mimeType: "image/png",
              previewMode: "image",
            }),
            mode: "image",
            mimeType: "image/png",
            content: null,
            encoding: null,
            truncated: false,
            downloadUrl: inlinePreviewImageUrl,
            downloadTicketId: null,
            downloadExpiresAt: null,
          });
          return;
        }

        if (requestedPath.endsWith("receipt.pdf")) {
          await fulfillJson(route, {
            file: buildRunFilePreviewRecord({
              runId: fileBrowserRunId,
              workspaceId,
              targetPath: fileBrowserTargetPath,
              path: `${fileBrowserTargetPath}/output/receipt.pdf`,
              name: "receipt.pdf",
              kind: "receipt",
              sizeBytes: 20480,
              mimeType: "application/pdf",
              previewMode: "pdf",
            }),
            mode: "pdf",
            mimeType: "application/pdf",
            content: null,
            encoding: null,
            truncated: false,
            downloadUrl: inlinePreviewPdfUrl,
            downloadTicketId: null,
            downloadExpiresAt: null,
          });
          return;
        }

        if (requestedPath.endsWith("bundle.zip")) {
          await fulfillJson(route, {
            file: buildRunFilePreviewRecord({
              runId: fileBrowserRunId,
              workspaceId,
              targetPath: fileBrowserTargetPath,
              path: `${fileBrowserTargetPath}/output/bundle.zip`,
              name: "bundle.zip",
              kind: "archive",
              sizeBytes: 65536,
              mimeType: "application/zip",
              previewMode: "download",
            }),
            mode: "download",
            mimeType: "application/zip",
            content: null,
            encoding: null,
            truncated: false,
            downloadUrl: null,
            downloadTicketId: null,
            downloadExpiresAt: null,
          });
          return;
        }

        await fulfillJson(
          route,
          {
            error: {
              message: `Unhandled preview path: ${requestedPath}`,
            },
          },
          404
        );
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === `/v1/runs/${fileBrowserRunId}/download-tickets`
      ) {
        const payload = JSON.parse(request.postData() ?? "{}");
        const requestedPath = payload.path ?? `${fileBrowserTargetPath}/output/checklist.txt`;
        const fileName = requestedPath.split("/").at(-1) ?? "download.bin";
        downloadTicketPaths.push(requestedPath);
        await fulfillJson(route, {
          ticket: {
            ticketId: "dlt_mobile_files_0001",
            runId: fileBrowserRunId,
            workspaceId,
            path: requestedPath,
            fileName,
            mimeType: requestedPath.endsWith(".pdf")
              ? "application/pdf"
              : requestedPath.endsWith(".png")
                ? "image/png"
                : requestedPath.endsWith(".zip")
                  ? "application/zip"
                  : "text/plain",
            sourceKind: "run-target-path",
            objectKey: `runs/${fileBrowserRunId}/indexed/runtime-output/${requestedPath.replace(`${fileBrowserTargetPath}/`, "")}`,
            uploadId: null,
            checksum: "c".repeat(64),
            expiresAt: "2026-07-12T11:35:00.000Z",
            createdAt: "2026-07-12T11:05:00.000Z",
          },
          downloadUrl: `/downloads/mobile/${fileName}`,
        });
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileBrowserRunId}/mcp-calls`) {
        await fulfillJson(route, []);
        return;
      }

      await fulfillJson(
        route,
        {
          error: {
            message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
          },
        },
        404
      );
    });

    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${fileBrowserRunId}`).click();
    await page.getByTestId("mobile-task-detail-open-files").click();

    await expect(page.getByTestId("mobile-task-file-preview")).toContainText("Checklist ready");
    expect(previewRequests).toBeGreaterThan(0);

    await page.getByTestId("mobile-task-file-select-output-filing-brief-docx").click();
    await expect(page.getByTestId("mobile-task-file-preview")).toContainText("Filing brief");
    await expect(page.getByTestId("mobile-task-file-preview")).toContainText(
      "ready for operator review"
    );

    await page.getByTestId("mobile-task-file-select-output-poster-png").click();
    await expect(page.locator('[data-testid="mobile-task-file-preview"] img')).toHaveAttribute(
      "src",
      /\/previews\/mobile\/poster\.png$/
    );

    await page.getByTestId("mobile-task-file-select-output-receipt-pdf").click();
    await expect(page.getByText("打开 PDF 预览")).toBeVisible();
    await page.getByText("打开 PDF 预览").click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(globalThis.__openedUrls ?? []).some((url) =>
            String(url).endsWith("/previews/mobile/receipt.pdf")
          )
        )
      )
      .toBe(true);

    await page.getByTestId("mobile-task-file-select-output-bundle-zip").click();
    await expect(page.getByTestId("mobile-task-file-preview")).toContainText(
      "当前文件更适合直接下载查看"
    );

    await page.getByTestId("mobile-task-file-download").click();

    expect(downloadTicketPaths).toEqual([`${fileBrowserTargetPath}/output/bundle.zip`]);
  });

  test("uploads attachments and sends them in the task conversation", async ({ page }) => {
    const uploadedFileName = "supporting-ledger.pdf";
    const uploadedFilePath = `${targetPath}/uploads/upl_mobile_0001/${uploadedFileName}`;
    let currentExtraMessages = [];
    let currentFiles = createRunFiles();

    function buildSnapshot() {
      return {
        ...createRunSnapshot(currentExtraMessages),
        files: currentFiles,
      };
    }

    function buildUploadRecord(status) {
      return {
        uploadId: "upl_mobile_0001",
        runId,
        workspaceId,
        fileName: uploadedFileName,
        contentType: "application/pdf",
        declaredSizeBytes: 1536,
        storedSizeBytes: status === "created" ? null : 1536,
        sha256: status === "created" ? null : "e".repeat(64),
        objectKey: `runs/${runId}/uploads/upl_mobile_0001/${uploadedFileName}`,
        status,
        scanStatus: status === "attached" ? "clean" : "pending",
        scanEngine: status === "attached" ? "clamav" : null,
        scanReasonCode: null,
        scanDetail: null,
        scanSignature: null,
        scannedAt: status === "attached" ? "2026-07-12T10:33:08.000Z" : null,
        attachedPath: status === "attached" ? uploadedFilePath : null,
        attachedLabel: status === "attached" ? uploadedFileName : null,
        createdAt: "2026-07-12T10:33:00.000Z",
        updatedAt:
          status === "created"
            ? "2026-07-12T10:33:00.000Z"
            : status === "uploaded"
              ? "2026-07-12T10:33:05.000Z"
              : "2026-07-12T10:33:08.000Z",
      };
    }

    await page.addInitScript(() => {
      class DisabledRealtimeTransport {
        constructor() {
          throw new Error("Realtime transport disabled for this test.");
        }
      }

      globalThis.WebSocket = DisabledRealtimeTransport;
      globalThis.EventSource = DisabledRealtimeTransport;
      window.WebSocket = DisabledRealtimeTransport;
      window.EventSource = DisabledRealtimeTransport;
    });

    await page.unroute("**/v1/runs**");
    await page.route("**/v1/runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/runs") {
        await fulfillJson(route, [buildSnapshot()]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, createRunsSummary());
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${runId}`) {
        await fulfillJson(route, buildSnapshot());
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${runId}/files/tree`) {
        await fulfillJson(route, currentFiles);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${runId}/mcp-calls`) {
        await fulfillJson(route, []);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/runs/${runId}/uploads`) {
        await fulfillJson(route, {
          upload: buildUploadRecord("created"),
          uploadUrl: `/uploads/mock/${runId}/upl_mobile_0001`,
          method: "PUT",
          maxBytes: 5_000_000,
          contentType: "application/octet-stream",
        });
        return;
      }

      if (
        request.method() === "PUT" &&
        url.pathname.startsWith(`/v1/runs/${runId}/uploads/`) &&
        /\/content\/?$/.test(url.pathname)
      ) {
        await fulfillJson(route, buildUploadRecord("uploaded"));
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname.startsWith(`/v1/runs/${runId}/uploads/`) &&
        /\/finalize\/?$/.test(url.pathname)
      ) {
        const payload = JSON.parse(request.postData() ?? "{}");

        expect(payload.label).toBe(uploadedFileName);

        await fulfillJson(route, {
          upload: buildUploadRecord("attached"),
          attachment: {
            path: uploadedFilePath,
            label: uploadedFileName,
            slotKey: null,
          },
        });
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/runs/${runId}/messages`) {
        const payload = JSON.parse(request.postData() ?? "{}");

        expect(payload.text).toBe("Please review the attached ledger and continue.");
        expect(payload.attachments).toEqual([
          {
            path: uploadedFilePath,
            label: uploadedFileName,
            slotKey: null,
          },
        ]);

        currentExtraMessages = [
          ...currentExtraMessages,
          {
            messageId: "msg_mobile_upload_0001",
            runId,
            role: "user",
            kind: "text",
            text: payload.text,
            attachments: payload.attachments,
            createdAt: "2026-07-12T10:33:10.000Z",
          },
        ];
        currentFiles = [
          ...currentFiles,
          {
            path: uploadedFilePath,
            name: uploadedFileName,
            kind: "input",
            sizeBytes: 1536,
            updatedAt: "2026-07-12T10:33:08.000Z",
          },
        ];

        await fulfillJson(route, buildSnapshot());
        return;
      }

      await fulfillJson(
        route,
        {
          error: {
            message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
          },
        },
        404
      );
    });

    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${runId}`).click();
    await expect(page.getByTestId("mobile-task-detail-page")).toBeVisible();
    await page.getByTestId("mobile-task-composer-toggle").click();

    await page.locator('[data-testid="mobile-task-composer-input"] textarea').fill(
      "Please review the attached ledger and continue."
    );

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("mobile-task-add-attachments").click();
    const chooser = await chooserPromise;
    await chooser.setFiles([
      {
        name: uploadedFileName,
        mimeType: "application/pdf",
        buffer: Buffer.from("ledger sample pdf bytes"),
      },
    ]);

    await expect(page.getByTestId("mobile-task-attachment-drafts")).toContainText(uploadedFileName);

    const createUploadRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === `/v1/runs/${runId}/uploads`;
    });
    const sendMessageRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === `/v1/runs/${runId}/messages`;
    });

    await page.getByTestId("mobile-task-send-button").click();

    const [createUploadRequest, sendMessageRequest] = await Promise.all([
      createUploadRequestPromise,
      sendMessageRequestPromise,
    ]);

    expect(JSON.parse(createUploadRequest.postData() ?? "{}")).toMatchObject({
      fileName: uploadedFileName,
      contentType: "application/pdf",
    });
    expect(JSON.parse(sendMessageRequest.postData() ?? "{}")).toMatchObject({
      text: "Please review the attached ledger and continue.",
      attachments: [
        {
          path: uploadedFilePath,
          label: uploadedFileName,
          slotKey: null,
        },
      ],
    });

    await expect(page.getByText("Please review the attached ledger and continue.").last()).toBeVisible();
    await expect(page.getByText(uploadedFilePath).last()).toBeVisible();
  });

  test("shows failed outgoing message state and retries successfully", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${runId}`).click();
    await expect(page.getByTestId("mobile-task-detail-page")).toBeVisible();
    await page.getByTestId("mobile-task-composer-toggle").click();

    await page.locator("textarea").first().fill("请继续读取当前报税材料");
    await page.getByTestId("mobile-task-send-button").click();

    await expect(page.getByText("发送失败")).toBeVisible();
    await expect(page.getByText("Simulated send failure").first()).toBeVisible();

    const retryButton = page.locator('[data-testid^="mobile-task-retry-msg_local_"]').first();
    await retryButton.click();

    await expect(page.getByText("发送失败")).toHaveCount(0);
    await expect(page.getByText("请继续读取当前报税材料")).toHaveCount(1);
  });

  test("loads me page with workspace summary modules", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-me").click();
    const mePage = page.getByTestId("mobile-me-page");
    const themeToggle = page.getByTestId("mobile-theme-toggle");
    const pageShell = page.locator(".page-shell").filter({ has: mePage });

    await expect(mePage).toBeVisible();
    await expect(pageShell).toHaveClass(/theme-dark/);
    await themeToggle.click();
    await expect(pageShell).toHaveClass(/theme-light/);
    await expect(themeToggle).toContainText("切换深色");
    await expect(page.getByText("用量与支出")).toBeVisible();
  });

  test("launches a service into a live task with input collection guidance", async ({ page }) => {
    await page.unroute("**/v1/runs**");

    const launchRunId = "run_tax_q2_launch_mobile";
    const launchTargetPath = `/workspace/${launchRunId}`;
    let runCreated = false;

    const taxWorkshop = {
      workshopId: "enterprise-tax",
      scope: "enterprise",
      status: "active",
      visibility: "workspace",
      displayName: {
        zh: "企业财税工坊",
        en: "Enterprise Tax Workshop",
      },
      ownerLabel: {
        zh: "Harbor Finance Workspace",
        en: "Harbor Finance Workspace",
      },
      badge: {
        zh: "企业",
        en: "Enterprise",
      },
      audience: {
        zh: "财税与运营团队",
        en: "Finance and operations teams",
      },
      summary: {
        zh: "启动后先收集报税输入。",
        en: "Collect filing inputs before execution continues.",
      },
      nextStepSummary: {
        zh: "进入任务对话并补齐缺失信息。",
        en: "Enter the task conversation and provide the missing inputs.",
      },
      coverAssetUrl: "/assets/workshop-tax.svg",
      tagList: ["tax", "browser", "approval"],
      defaultServiceId: "tax-filing",
    };

    const taxService = {
      serviceId: "tax-filing",
      workshopId: "enterprise-tax",
      status: "active",
      displayName: {
        zh: "Hong Kong Quarterly Filing",
        en: "Hong Kong Quarterly Filing",
      },
      summary: {
        zh: "先补齐主体、周期和材料，再继续执行。",
        en: "Collect entity, period, and materials before continuing the run.",
      },
      authRequirementText: {
        zh: "Finance credentials required.",
        en: "Finance credentials required.",
      },
      estimatedDuration: "4-8 min",
      targetPathHint: "/workspace/tax-q2/runs/tax-filing",
      outputContractSummary: {
        zh: "Outputs filing receipts and summaries.",
        en: "Outputs filing receipts and summaries.",
      },
      launchMode: "instant-conversation",
      requiredBindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      linkedInstanceHint: launchRunId,
    };

    const launchSnapshot = {
      run: {
        runId: launchRunId,
        workspaceId,
        taskVersionId: "tsv_tax_q2_launch_mobile",
        sessionVersionId: "sev_tax_q2_launch_mobile",
        requestedByUserId: "usr_mobile_launch",
        title: "2026 Q2 tax filing kickoff",
        targetPath: launchTargetPath,
        entrySurface,
        catalogMetadata: {
          workspaceContextKey: "harbor-finance",
          workspaceContextName: {
            zh: "Harbor Finance Workspace",
            en: "Harbor Finance Workspace",
          },
          workshopId: "enterprise-tax",
          workshopName: {
            zh: "Enterprise Tax Workshop",
            en: "Enterprise Tax Workshop",
          },
          serviceId: "tax-filing",
          serviceName: {
            zh: "Hong Kong Quarterly Filing",
            en: "Hong Kong Quarterly Filing",
          },
        },
        status: "RUNNING",
        statusReason: null,
        createdAt: "2026-07-12T10:20:00.000Z",
        updatedAt: "2026-07-12T10:21:00.000Z",
      },
      runtime: {
        launchMode: "docker",
        containerName: "lingban-run-tax-q2-launch-mobile",
        startedAt: "2026-07-12T10:20:10.000Z",
        readyAt: "2026-07-12T10:20:18.000Z",
        finishedAt: null,
        exitCode: null,
        exitSignal: null,
      },
      informationCollection: {
        prompt: "Please tell me what information I need to provide to you.",
        slotSchemaVersion: "imported.v1",
        status: "pending",
        requiredCount: 2,
        satisfiedCount: 0,
        missingCount: 2,
        userMessageCount: 0,
        attachmentCount: 0,
        lastUpdatedAt: "2026-07-12T10:20:30.000Z",
        slots: [
          {
            key: "company_name",
            title: "Company legal name",
            type: "string",
            required: true,
            secret: false,
            repeatable: false,
            prompt: "Provide the legal entity name.",
            description: null,
            placeholder: null,
            choices: [],
            accepts: [],
            status: "missing",
            attachmentCount: 0,
            lastSatisfiedAt: null,
          },
          {
            key: "filing_materials",
            title: "Filing materials",
            type: "file",
            required: true,
            secret: false,
            repeatable: true,
            prompt: "Upload the filing materials.",
            description: null,
            placeholder: null,
            choices: [],
            accepts: ["pdf", "png"],
            status: "missing",
            attachmentCount: 0,
            lastSatisfiedAt: null,
          },
        ],
      },
      messages: [
        {
          messageId: "msg_mobile_launch_0001",
          runId: launchRunId,
          role: "system",
          kind: "prompt",
          text: "Please tell me what information I need to provide to you.",
          attachments: [],
          createdAt: "2026-07-12T10:20:30.000Z",
        },
        {
          messageId: "msg_mobile_launch_0002",
          runId: launchRunId,
          role: "agent",
          kind: "text",
          text: "I need the legal entity name and the filing materials before I continue.",
          attachments: [],
          createdAt: "2026-07-12T10:21:00.000Z",
        },
      ],
      files: [
        {
          path: `${launchTargetPath}/output/`,
          name: "output/",
          kind: "output",
          sizeBytes: null,
          updatedAt: "2026-07-12T10:21:10.000Z",
        },
      ],
      artifacts: [],
      approvals: [],
    };

    const launchTemplate = {
      serviceId: "tax-filing",
      workspaceContext: {
        contextKey: "harbor-finance",
        runtimeWorkspaceId: workspaceId,
        displayName: {
          zh: "Harbor Finance Workspace",
          en: "Harbor Finance Workspace",
        },
        type: "team",
        meta: {
          zh: "Finance workspace",
          en: "Finance workspace",
        },
        root: "/workspace/harbor-finance",
        allowedEntrySurfaces: ["dashboard", "h5"],
      },
      taskVersionId: "tsv_tax_q2_launch_mobile",
      sessionVersionId: "sev_tax_q2_launch_mobile",
      title: {
        zh: "Hong Kong Quarterly Filing",
        en: "Hong Kong Quarterly Filing",
      },
      targetRoot: "/workspace/tax-q2/runs/tax-filing",
      initialMessagePolicy: "system-collects-required-info",
      resolution: {
        source: "catalog-default",
        packageId: null,
        releaseId: null,
        activationId: null,
      },
      createRunInput: {
        workspaceId,
        taskVersionId: "tsv_tax_q2_launch_mobile",
        sessionVersionId: "sev_tax_q2_launch_mobile",
        requestedByUserId: "usr_mobile_launch",
        title: "2026 Q2 tax filing kickoff",
        targetPath: launchTargetPath,
        entrySurface,
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        catalogMetadata: launchSnapshot.run.catalogMetadata,
      },
    };

    await page.route("**/v1/workshops**", async (route) => {
      await fulfillJson(route, [taxWorkshop]);
    });

    await page.route("**/v1/services**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/services") {
        await fulfillJson(route, [taxService]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/services/tax-filing") {
        await fulfillJson(route, {
          ...taxService,
          workshop: taxWorkshop,
        });
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/v1/services/tax-filing/launch-template"
      ) {
        await fulfillJson(route, launchTemplate);
        return;
      }

      await fulfillJson(
        route,
        {
          error: {
            message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
          },
        },
        404
      );
    });

    await page.route("**/v1/runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/runs") {
        await fulfillJson(route, runCreated ? [launchSnapshot] : []);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, runCreated ? createRunsSummary() : { ...createRunsSummary(), total: 0 });
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${launchRunId}`) {
        await fulfillJson(route, launchSnapshot);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${launchRunId}/files/tree`) {
        await fulfillJson(route, launchSnapshot.files);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${launchRunId}/mcp-calls`) {
        await fulfillJson(route, []);
        return;
      }

      if (request.method() === "POST" && url.pathname === "/v1/runs") {
        runCreated = true;
        await fulfillJson(route, {
          run: launchSnapshot.run,
          nextPrompt: launchSnapshot.informationCollection.prompt,
          informationCollection: launchSnapshot.informationCollection,
        });
        return;
      }

      await fulfillJson(
        route,
        {
          error: {
            message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
          },
        },
        404
      );
    });

    await page.route("**/v1/quotas**", async (route) => {
      await fulfillJson(route, { error: { message: "No quota fixture for this test." } }, 404);
    });
    await page.route("**/v1/billing**", async (route) => {
      await fulfillJson(route, { error: { message: "No billing fixture for this test." } }, 404);
    });

    await page.goto("/");
    await page.getByTestId("mobile-service-open-tax-filing").click();
    await page.getByTestId("mobile-service-launch-button").click();

    await expect(page).toHaveURL(new RegExp(`pages/tasks/detail\\?id=${launchRunId}`));
    await expect(page.getByTestId("mobile-task-information-collection")).toBeVisible();
    await expect(
      page.getByText("Please tell me what information I need to provide to you.").first()
    ).toBeVisible();
    await expect(page.getByText("Company legal name").first()).toBeVisible();
  });

  test("approves a pending task directly from the conversation page", async ({ page }) => {
    await page.unroute("**/v1/runs**");

    let currentSnapshot = createApprovalRunSnapshot();
    let currentSummary = createApprovalRunsSummary(true);

    await page.route("**/v1/runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/runs") {
        await fulfillJson(route, [currentSnapshot]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, currentSummary);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${approvalRunId}`) {
        await fulfillJson(route, currentSnapshot);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${approvalRunId}/files/tree`) {
        await fulfillJson(route, currentSnapshot.files);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/runs/${approvalRunId}/approvals`) {
        currentSnapshot = {
          ...currentSnapshot,
          run: {
            ...currentSnapshot.run,
            status: "RUNNING",
            statusReason: null,
            updatedAt: "2026-07-12T11:03:00.000Z",
          },
          approvals: [],
        };
        currentSummary = createApprovalRunsSummary(false);
        await fulfillJson(route, currentSnapshot);
        return;
      }

      await fulfillJson(
        route,
        {
          error: {
            message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
          },
        },
        404
      );
    });

    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${approvalRunId}`).click();
    await expect(page.getByTestId("mobile-task-pending-approval")).toBeVisible();
    await page.getByTestId("mobile-task-approve-button").click();
    await expect(page.getByTestId("mobile-task-pending-approval")).toHaveCount(0);
  });

  test("reviews a structured information answer directly from the conversation page", async ({ page }) => {
    await page.unroute("**/v1/runs**");

    let currentSnapshot = createReviewRunSnapshot();
    let currentSummary = createReviewRunsSummary(true);

    await page.route("**/v1/runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/runs") {
        await fulfillJson(route, [currentSnapshot]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, currentSummary);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${reviewRunId}`) {
        await fulfillJson(route, currentSnapshot);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${reviewRunId}/files/tree`) {
        await fulfillJson(route, currentSnapshot.files);
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === `/v1/runs/${reviewRunId}/information-collection/reviews`
      ) {
        currentSnapshot = createReviewRunSnapshot("approved");
        currentSummary = createReviewRunsSummary(false);
        await fulfillJson(route, currentSnapshot);
        return;
      }

      await fulfillJson(
        route,
        {
          error: {
            message: `Unhandled mocked route: ${request.method()} ${url.pathname}`,
          },
        },
        404
      );
    });

    await page.goto("/");
    await page.getByTestId("mobile-workshops-to-tasks").click();
    await page.getByTestId(`mobile-task-open-${reviewRunId}`).click();

    await expect(page.getByTestId("mobile-task-information-collection")).toBeVisible();
    await expect(page.getByTestId("mobile-task-review-count-pending")).toContainText("1");
    await page.getByTestId(`mobile-task-review-approve-${reviewAnswerId}`).click();
    await expect(page.getByTestId("mobile-task-review-count-pending")).toContainText("0");
    await expect(page.getByTestId("mobile-task-review-count-approved")).toContainText("1");
  });
});
