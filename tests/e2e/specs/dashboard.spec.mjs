import { expect, test } from "@playwright/test";

const workshop = {
  workshopId: "brand-poster-suite",
  scope: "creative",
  status: "active",
  visibility: "workspace",
  displayName: {
    zh: "品牌海报工坊",
    en: "Brand Poster Workshop",
  },
  ownerLabel: {
    zh: "品牌内容组",
    en: "Brand Content Team",
  },
  badge: {
    zh: "品牌内容",
    en: "Brand Content",
  },
  audience: {
    zh: "市场与创意团队",
    en: "Marketing and creative teams",
  },
  summary: {
    zh: "用于批量生成品牌海报与素材包。",
    en: "Generate branded posters and delivery bundles in batches.",
  },
  nextStepSummary: {
    zh: "启动后进入实例或批次看板。",
    en: "Launch into the instance or batch board.",
  },
  coverAssetUrl: "/assets/workshop-image.svg",
  tagList: ["image", "poster", "bundle"],
  defaultServiceId: "poster-batch",
};

const service = {
  serviceId: "poster-batch",
  workshopId: "brand-poster-suite",
  status: "active",
  displayName: {
    zh: "品牌海报批量生成",
    en: "Poster Batch",
  },
  summary: {
    zh: "按批次行生成品牌海报与打包结果。",
    en: "Generate branded posters and package outputs by batch row.",
  },
  authRequirementText: {
    zh: "需要图像生成凭证。",
    en: "Requires image-generation credentials.",
  },
  estimatedDuration: "5-8 min",
  targetPathHint: "/workspace/poster-batch-17/runs/poster-batch",
  outputContractSummary: {
    zh: "输出海报图片与打包压缩包。",
    en: "Outputs poster images and a zipped bundle.",
  },
  launchMode: "instant-conversation",
  requiredBindings: {
    firstPartyMcpIds: [],
    externalConnectorRefs: [],
    credentialIds: [],
  },
  linkedInstanceHint: "poster-batch-17",
};

const batchEstimate = {
  currency: "USD",
  itemCount: 2,
  estimatedMinutesPerItemLow: 4,
  estimatedMinutesPerItemHigh: 6,
  estimatedTotalMinutesLow: 8,
  estimatedTotalMinutesHigh: 12,
  estimatedWallClockMinutesLow: 2,
  estimatedWallClockMinutesHigh: 3,
  estimatedTotalAmountUsdLow: 8,
  estimatedTotalAmountUsdHigh: 12,
  budgetLimit: 25,
  budgetRemainingUsdLow: 17,
  budgetRemainingUsdHigh: 13,
  withinBudget: true,
  metrics: [
    {
      metric: "browser_minutes",
      label: {
        zh: "浏览器分钟",
        en: "Browser minutes",
      },
      quantityLow: 8,
      quantityHigh: 12,
      unitPriceUsd: 1,
      amountUsdLow: 8,
      amountUsdHigh: 12,
      currency: "USD",
    },
  ],
  warnings: [],
};

const batchWorkspaceId = "wsp_brand_lab";
const batchWorkspaceContextKey = "brand-lab";
const batchWorkspaceRoot = "/workspace/brand-lab";
const batchJobId = "brj_demo_batch_0001";
const batchTargetRoot = "/workspace/poster-batch-17/runs/poster-batch";

function buildBatchItem({
  batchItemId,
  rowIndex,
  title,
  pathSuffix,
  status,
  updatedAt,
  runId = null,
  previousRunIds = [],
  runStatus = null,
  runStatusReason = null,
  attemptCount = 0,
  errorCode = null,
  errorMessage = null,
  startedAt = null,
  finishedAt = null,
}) {
  return {
    batchItemId,
    batchJobId,
    rowIndex,
    rowKey: `row-${rowIndex + 1}`,
    title,
    targetPath: `${batchTargetRoot}/${pathSuffix}`,
    pathSuffix,
    initialMessage: null,
    context: rowIndex === 0 ? { region: "hk", format: "portrait" } : { region: "sg", format: "square" },
    runId,
    previousRunIds,
    runStatus,
    runStatusReason,
    status,
    attemptCount,
    errorCode,
    errorMessage,
    createdAt: "2026-07-12T08:00:00.000Z",
    updatedAt,
    startedAt,
    finishedAt,
  };
}

function summarizeBatchItems(items) {
  const summary = {
    totalCount: items.length,
    draftCount: 0,
    validatedCount: 0,
    queuedCount: 0,
    startingCount: 0,
    runningCount: 0,
    waitingApprovalCount: 0,
    succeededCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    latestUpdatedAt: items.length > 0 ? items[items.length - 1].updatedAt : null,
  };

  for (const item of items) {
    switch (item.status) {
      case "draft":
        summary.draftCount += 1;
        break;
      case "validated":
        summary.validatedCount += 1;
        break;
      case "queued":
        summary.queuedCount += 1;
        break;
      case "starting":
        summary.startingCount += 1;
        break;
      case "running":
        summary.runningCount += 1;
        break;
      case "waiting_approval":
        summary.waitingApprovalCount += 1;
        break;
      case "succeeded":
        summary.succeededCount += 1;
        break;
      case "failed":
        summary.failedCount += 1;
        break;
      case "cancelled":
        summary.cancelledCount += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

function buildBatchJob({
  status,
  updatedAt,
  validatedAt = null,
  startedAt = null,
  finishedAt = null,
  cancelledAt = null,
  cancellationReason = null,
}) {
  return {
    batchJobId,
    workspaceId: batchWorkspaceId,
    workspaceContextKey: batchWorkspaceContextKey,
    workspaceContextName: {
      zh: "Brand Lab",
      en: "Brand Lab",
    },
    workspaceRoot: batchWorkspaceRoot,
    workshopId: workshop.workshopId,
    workshopName: workshop.displayName,
    serviceId: service.serviceId,
    serviceName: service.displayName,
    taskVersionId: "tsv_poster_batch_0001",
    sessionVersionId: "sev_poster_batch_0001",
    entrySurface: "dashboard",
    title: "July poster wave 1",
    templateSource: "catalog-default",
    sourcePackageId: null,
    sourceReleaseId: null,
    sourceActivationId: null,
    bindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
    status,
    maxParallelRuns: 2,
    budgetLimit: 25,
    retryLimit: 1,
    createdByUserId: "usr_creator_admin",
    createdAt: "2026-07-12T08:00:00.000Z",
    updatedAt,
    validatedAt,
    startedAt,
    finishedAt,
    cancelledAt,
    cancellationReason,
  };
}

function buildBatchDetail({
  status,
  items,
  updatedAt,
  validatedAt = null,
  startedAt = null,
  finishedAt = null,
  cancelledAt = null,
  cancellationReason = null,
}) {
  return {
    job: buildBatchJob({
      status,
      updatedAt,
      validatedAt,
      startedAt,
      finishedAt,
      cancelledAt,
      cancellationReason,
    }),
    summary: summarizeBatchItems(items),
    estimate: batchEstimate,
    itemsPreview: items.slice(0, 5),
  };
}

function buildBatchItemsResponse(detail, items) {
  return {
    job: detail.job,
    summary: detail.summary,
    estimate: detail.estimate,
    items,
  };
}

const approvalRunId = "run_tax_q2_approval";
const approvalWorkspaceId = "wsp_harbor_finance";
const approvalTargetPath = `/workspace/tax-q2/${approvalRunId}`;
const reviewRunId = "run_tax_q2_review";
const reviewAnswerId = "ans_tax_q2_review_company_name";
const reviewTargetPath = `/workspace/tax-q2/${reviewRunId}`;
const fileRunId = "run_tax_q2_files";
const fileTargetPath = `/workspace/tax-q2/${fileRunId}`;
const inlinePreviewImageUrl = "/previews/dashboard/poster.png";
const inlinePreviewPdfUrl = "/previews/dashboard/receipt.pdf";

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
    updatedAt: "2026-07-12T09:45:00.000Z",
    runId,
    workspaceId,
    logicalPath,
    source: "runtime-output",
    mimeType,
    objectKey: `runs/${runId}/indexed/runtime-output/${logicalPath}`,
    uploadId: null,
    checksum: "b".repeat(64),
    previewMode,
    previewable: previewMode === "text" || previewMode === "image" || previewMode === "pdf",
    downloadable: true,
    storageTier: "hot",
    archivedAt: null,
    archivedFromObjectKey: null,
    archiveReason: null,
    indexedAt: "2026-07-12T09:45:00.000Z",
  };
}

function createFileBrowserFiles() {
  return [
    {
      path: `${fileTargetPath}/output/`,
      name: "output/",
      kind: "output",
      sizeBytes: null,
      updatedAt: "2026-07-12T09:45:00.000Z",
    },
    {
      path: `${fileTargetPath}/output/checklist.txt`,
      name: "checklist.txt",
      kind: "output",
      sizeBytes: 96,
      updatedAt: "2026-07-12T09:45:00.000Z",
    },
    {
      path: `${fileTargetPath}/output/filing-brief.docx`,
      name: "filing-brief.docx",
      kind: "output",
      sizeBytes: 16384,
      updatedAt: "2026-07-12T09:45:05.000Z",
    },
    {
      path: `${fileTargetPath}/output/poster.png`,
      name: "poster.png",
      kind: "output",
      sizeBytes: 4096,
      updatedAt: "2026-07-12T09:45:10.000Z",
    },
    {
      path: `${fileTargetPath}/output/receipt.pdf`,
      name: "receipt.pdf",
      kind: "receipt",
      sizeBytes: 20480,
      updatedAt: "2026-07-12T09:45:00.000Z",
    },
    {
      path: `${fileTargetPath}/output/bundle.zip`,
      name: "bundle.zip",
      kind: "archive",
      sizeBytes: 65536,
      updatedAt: "2026-07-12T09:45:20.000Z",
    },
  ];
}

function createFileBrowserSnapshot() {
  return {
    run: {
      runId: fileRunId,
      workspaceId: approvalWorkspaceId,
      taskVersionId: "tsv_tax_q2_files",
      sessionVersionId: "sev_tax_q2_files",
      requestedByUserId: "usr_dashboard_file_browser",
      title: "2026 Q2 tax file browser",
      targetPath: fileTargetPath,
      entrySurface: "dashboard",
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "Harbor Finance Team",
          en: "Harbor Finance Team",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "Enterprise Tax Workshop",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "Quarterly filing",
          en: "Quarterly filing",
        },
      },
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-12T09:44:00.000Z",
      updatedAt: "2026-07-12T09:45:00.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2-files",
      startedAt: "2026-07-12T09:44:10.000Z",
      readyAt: "2026-07-12T09:44:18.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    messages: [
      {
        messageId: "msg_dashboard_file_0001",
        runId: fileRunId,
        role: "agent",
        kind: "text",
        text: "The file bundle is ready for inspection and download.",
        attachments: [],
        createdAt: "2026-07-12T09:45:00.000Z",
      },
    ],
    files: createFileBrowserFiles(),
    artifacts: [],
    approvals: [],
  };
}

function createApprovalMessages(extraMessages = []) {
  return [
    {
      messageId: "msg_system_approval_0001",
      runId: approvalRunId,
      role: "system",
      kind: "prompt",
      text: "Please confirm the submission scope before I continue.",
      attachments: [],
      createdAt: "2026-07-12T09:30:00.000Z",
    },
    {
      messageId: "msg_agent_approval_0001",
      runId: approvalRunId,
      role: "agent",
      kind: "text",
      text: "I am ready to continue after the pending approval is resolved.",
      attachments: [],
      createdAt: "2026-07-12T09:31:00.000Z",
    },
    ...extraMessages,
  ];
}

function createApprovalFiles() {
  return [
    {
      path: `${approvalTargetPath}/output/`,
      name: "output/",
      kind: "output",
      sizeBytes: null,
      updatedAt: "2026-07-12T09:31:30.000Z",
    },
    {
      path: `${approvalTargetPath}/output/receipt.pdf`,
      name: "receipt.pdf",
      kind: "receipt",
      sizeBytes: 20480,
      updatedAt: "2026-07-12T09:31:30.000Z",
    },
  ];
}

function createApprovalSnapshot(state = "pending") {
  const isPending = state === "pending";

  return {
    run: {
      runId: approvalRunId,
      workspaceId: approvalWorkspaceId,
      taskVersionId: "tsv_tax_q2_approval",
      sessionVersionId: "sev_tax_q2_approval",
      requestedByUserId: "usr_dashboard_approval",
      title: "2026 Q2 tax filing review",
      targetPath: approvalTargetPath,
      entrySurface: "dashboard",
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "华港财务组",
          en: "Harbor Finance Team",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "企业财税工坊",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "季度报税",
          en: "Quarterly filing",
        },
      },
      status: isPending ? "WAITING_APPROVAL" : "RUNNING",
      statusReason: isPending ? "Pending operator confirmation." : null,
      createdAt: "2026-07-12T09:29:00.000Z",
      updatedAt: isPending ? "2026-07-12T09:31:30.000Z" : "2026-07-12T09:33:00.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2-approval",
      startedAt: "2026-07-12T09:29:10.000Z",
      readyAt: "2026-07-12T09:29:18.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    messages: createApprovalMessages(),
    files: createApprovalFiles(),
    artifacts: [],
    approvals: isPending
      ? [
          {
            approvalId: "apr_tax_q2_approval_0001",
            runId: approvalRunId,
            kind: "quota-override",
            relatedResourceRef: "quota://workspace/harbor-finance/browser-minutes",
            prompt: "Approve an extra 10 browser minutes so the filing can continue.",
            state: "pending",
            requestedAt: "2026-07-12T09:31:20.000Z",
            decidedAt: null,
            note: "Codex needs more browser time to complete the tax portal flow.",
          },
        ]
      : [],
  };
}

function createApprovalRunsSummary(hasPendingApproval) {
  return {
    total: 1,
    pendingApprovalsCount: hasPendingApproval ? 1 : 0,
    outputsReadyCount: 1,
    latestUpdatedAt: hasPendingApproval
      ? "2026-07-12T09:31:30.000Z"
      : "2026-07-12T09:33:00.000Z",
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
    byEntrySurface: [{ key: "dashboard", count: 1 }],
    byTag: [{ key: "#tax", count: 1 }],
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

function createReviewSnapshot(state = "pending") {
  const isApproved = state === "approved";

  return {
    run: {
      runId: reviewRunId,
      workspaceId: approvalWorkspaceId,
      taskVersionId: "tsv_tax_q2_review",
      sessionVersionId: "sev_tax_q2_review",
      requestedByUserId: "usr_dashboard_review",
      title: "2026 Q2 tax input review",
      targetPath: reviewTargetPath,
      entrySurface: "dashboard",
      catalogMetadata: {
        workspaceContextKey: "harbor-finance",
        workspaceContextName: {
          zh: "Harbor Finance Team",
          en: "Harbor Finance Team",
        },
        workshopId: "enterprise-tax",
        workshopName: {
          zh: "Enterprise Tax Workshop",
          en: "Enterprise Tax Workshop",
        },
        serviceId: "tax-filing",
        serviceName: {
          zh: "Quarterly filing",
          en: "Quarterly filing",
        },
      },
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-12T10:40:00.000Z",
      updatedAt: isApproved ? "2026-07-12T10:43:30.000Z" : "2026-07-12T10:42:30.000Z",
    },
    runtime: {
      launchMode: "docker",
      containerName: "lingban-run-tax-q2-review",
      startedAt: "2026-07-12T10:40:10.000Z",
      readyAt: "2026-07-12T10:40:18.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    informationCollection: {
      prompt: "Please tell me what information I need to provide to you.",
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
      lastUpdatedAt: isApproved ? "2026-07-12T10:43:30.000Z" : "2026-07-12T10:42:00.000Z",
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
          lastAnswerText: "Harbor Finance Holdings Ltd.",
          lastSatisfiedAt: "2026-07-12T10:42:00.000Z",
        },
      ],
      answers: [
        {
          answerId: reviewAnswerId,
          slotKey: "company_name",
          slotType: "string",
          kind: "text",
          source: "user-message",
          sourceMessageId: "msg_tax_review_user_0001",
          valueText: "Harbor Finance Holdings Ltd.",
          attachmentPath: null,
          attachmentLabel: null,
          reviewStatus: isApproved ? "approved" : "pending",
          reviewedAt: isApproved ? "2026-07-12T10:43:30.000Z" : null,
          reviewedByUserId: isApproved ? "usr_dashboard_review_operator" : null,
          reviewNote: isApproved ? "Approved from the dashboard review panel." : null,
          supersedesAnswerId: null,
          supersededByAnswerId: null,
          createdAt: "2026-07-12T10:42:00.000Z",
        },
      ],
    },
    messages: [
      {
        messageId: "msg_tax_review_system_0001",
        runId: reviewRunId,
        role: "system",
        kind: "prompt",
        text: "Please tell me what information I need to provide to you.",
        attachments: [],
        slotValues: [],
        createdAt: "2026-07-12T10:40:30.000Z",
      },
      {
        messageId: "msg_tax_review_user_0001",
        runId: reviewRunId,
        role: "user",
        kind: "text",
        text: "Harbor Finance Holdings Ltd.",
        attachments: [],
        slotValues: [{ slotKey: "company_name", valueText: "Harbor Finance Holdings Ltd." }],
        createdAt: "2026-07-12T10:42:00.000Z",
      },
    ],
    files: [
      {
        path: `${reviewTargetPath}/output/`,
        name: "output/",
        kind: "output",
        sizeBytes: null,
        updatedAt: "2026-07-12T10:43:00.000Z",
      },
    ],
    artifacts: [],
    approvals: [],
  };
}

function createReviewRunsSummary(isPendingReview) {
  return {
    total: 1,
    pendingApprovalsCount: 0,
    outputsReadyCount: 1,
    latestUpdatedAt: isPendingReview
      ? "2026-07-12T10:42:30.000Z"
      : "2026-07-12T10:43:30.000Z",
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
      todo: isPendingReview ? 1 : 0,
      running: isPendingReview ? 0 : 1,
      done: 0,
    },
    byEntrySurface: [{ key: "dashboard", count: 1 }],
    byTag: [{ key: "#tax", count: 1 }],
    byWorkshop: [
      {
        workshopId: "enterprise-tax",
        title: {
          zh: "Enterprise Tax Workshop",
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

function createCreatorAuthEnvelope() {
  return {
    user: {
      userId: "usr_creator_admin",
      email: "creator-admin@example.com",
      displayName: "Creator Admin",
      createdAt: "2026-07-12T09:00:00.000Z",
      updatedAt: "2026-07-12T09:00:00.000Z",
    },
    session: {
      sessionId: "ses_creator_admin",
      userId: "usr_creator_admin",
      currentWorkspaceId: "wsp_brand_lab",
      accessTokenExpiresAt: "2026-07-12T13:00:00.000Z",
      refreshTokenExpiresAt: "2026-07-19T09:00:00.000Z",
      createdAt: "2026-07-12T09:00:00.000Z",
      updatedAt: "2026-07-12T09:00:00.000Z",
    },
    currentWorkspace: {
      workspaceId: "wsp_brand_lab",
      slug: "brand-lab",
      name: "Brand Content Team",
      type: "enterprise",
      contextKey: "brand-lab",
      root: "/workspace/brand-lab/",
      role: "admin",
      membershipStatus: "active",
      createdAt: "2026-07-12T09:00:00.000Z",
      updatedAt: "2026-07-12T09:00:00.000Z",
    },
    workspaces: [
      {
        workspaceId: "wsp_brand_lab",
        slug: "brand-lab",
        name: "Brand Content Team",
        type: "enterprise",
        contextKey: "brand-lab",
        root: "/workspace/brand-lab/",
        role: "admin",
        membershipStatus: "active",
        createdAt: "2026-07-12T09:00:00.000Z",
        updatedAt: "2026-07-12T09:00:00.000Z",
      },
    ],
  };
}

function createCreatorPackageSummary() {
  return {
    packageId: "brand-poster-suite",
    title: {
      zh: "Brand Poster Suite",
      en: "Brand Poster Suite",
    },
    source: {
      zh: "Imported workshop session",
      en: "Imported workshop session",
    },
    state: "ready",
    statusLabel: {
      zh: "Ready",
      en: "Ready",
    },
    tone: "active",
    ownerLabel: {
      zh: "Brand Content Team",
      en: "Brand Content Team",
    },
    updatedAt: "2026-07-12T10:30:00.000Z",
    releaseChannel: {
      zh: "Production",
      en: "Production",
    },
    workspaceContextKeys: ["brand-lab"],
    linkedWorkshopIds: ["brand-poster-suite"],
    linkedServiceIds: ["poster-batch"],
  };
}

function createCreatorPackageDetail() {
  const summary = createCreatorPackageSummary();
  return {
    ...summary,
    session: {
      summary: {
        zh: "Session pack stays aligned with the package release.",
        en: "Session pack stays aligned with the package release.",
      },
      items: [
        {
          zh: "Review redaction coverage before release.",
          en: "Review redaction coverage before release.",
        },
      ],
    },
    runtime: {
      summary: {
        zh: "Runner image and browser policy.",
        en: "Runner image and browser policy.",
      },
      items: [
        {
          zh: "Playwright is enabled.",
          en: "Playwright is enabled.",
        },
      ],
    },
    connectors: {
      summary: {
        zh: "External connectors stay policy-bound.",
        en: "External connectors stay policy-bound.",
      },
      items: [
        {
          zh: "Seedance and image connectors are isolated.",
          en: "Seedance and image connectors are isolated.",
        },
      ],
    },
    release: {
      summary: {
        zh: "Release records and audit remain visible here.",
        en: "Release records and audit remain visible here.",
      },
      items: [
        {
          zh: "Audit trail is ready.",
          en: "Audit trail is ready.",
        },
      ],
    },
    versionLine: [
      "sev_brand_poster_suite",
      "tsv_poster_batch",
      "img:lingban/runner:2026.07",
    ],
    dependencies: [
      {
        zh: "Playwright browser runtime",
        en: "Playwright browser runtime",
      },
    ],
  };
}

function createCreatorSessionPackDetail(options = {}) {
  const approvedReview = options.approvedReview === true;
  const redactionReview = approvedReview
    ? {
        decision: "approved",
        reviewedAt: "2026-07-12T10:22:00.000Z",
        reviewedByUserId: "usr_creator_admin",
        note: "Approved for controlled release.",
        mapVersion: "curated.v2",
        totalRules: 2,
        previewMatchedRuleCount: 2,
        secretCoverageComplete: true,
      }
    : null;
  return {
    sessionVersionId: "sev_brand_poster_suite",
    sessionId: "ses_brand_poster_suite",
    displayName: {
      zh: "Brand Poster Session",
      en: "Brand Poster Session",
    },
    summary: {
      zh: "Creator session package for branded poster generation.",
      en: "Creator session package for branded poster generation.",
    },
    manifestVersion: "lingban.session-pack/v1",
    primaryPackageId: "brand-poster-suite",
    sourcePackageIds: ["brand-poster-suite"],
    primaryTaskVersionId: "tsv_poster_batch",
    linkedServiceIds: ["poster-batch"],
    linkedWorkshopIds: ["brand-poster-suite"],
    workspaceContextKeys: ["brand-lab"],
    sourcePackageState: "ready",
    releaseChannel: {
      zh: "Production",
      en: "Production",
    },
    runtimeProfile: {
      profileId: "brand-poster-suite",
      runnerImage: "lingban/runner:2026.07",
      browserRequired: true,
      playwrightRequired: true,
    },
    requiredBindings: {
      firstPartyMcpIds: ["browser-core"],
      externalConnectorRefs: ["connector://seedance/private"],
      credentialIds: ["cred_image_brand"],
    },
    expectedRootFiles: ["manifest.json", "conversation.jsonl", "slot-schema.json"],
    publishedTargetCount: 1,
    persistedArchive: true,
    archiveSource: "imported",
    archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
    archiveSizeBytes: 4096,
    archiveRecordedAt: "2026-07-12T10:20:00.000Z",
    runtimeSourceRunId: "run_brand_poster_suite",
    runtimeSourceTargetPath: "/workspace/brand-lab/runs/poster-batch",
    runtimeSourceUpdatedAt: "2026-07-12T10:24:00.000Z",
    updatedAt: "2026-07-12T10:30:00.000Z",
    sourceReleaseIds: ["rel_brand_poster_prod"],
    activeActivationIds: ["act_brand_poster_prod"],
    runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
    optionalRootFiles: ["redaction-map.json", "tool-events.jsonl"],
    sourcePackages: [],
    publishedTargets: [
      {
        templateKey: "poster-batch:brand-lab:dashboard",
        serviceId: "poster-batch",
        workspaceContextKey: "brand-lab",
        entrySurface: "dashboard",
        taskVersionId: "tsv_poster_batch",
        sessionVersionId: "sev_brand_poster_suite",
        title: {
          zh: "Brand Poster Batch",
          en: "Brand Poster Batch",
        },
        targetRoot: "/workspace/brand-lab/runs/poster-batch",
        bindings: {
          firstPartyMcpIds: ["browser-core"],
          externalConnectorRefs: ["connector://seedance/private"],
          credentialIds: ["cred_image_brand"],
        },
      },
    ],
    informationCollectionReview: {
      slotSchemaVersion: "curated.v2",
      totalSlots: 2,
      requiredSlots: 2,
      satisfiedSlots: 2,
      totalAnswers: 2,
      pendingReviewCount: 0,
      approvedReviewCount: 2,
      rejectedReviewCount: 0,
      supersededReviewCount: 0,
      latestAnsweredAt: "2026-07-12T10:05:00.000Z",
      latestReviewedAt: "2026-07-12T10:08:00.000Z",
      slots: [
        {
          key: "brand_name",
          title: "Brand name",
          type: "string",
          required: true,
          secret: false,
          status: "satisfied",
          answerCount: 1,
          pendingReviewCount: 0,
          approvedReviewCount: 1,
          rejectedReviewCount: 0,
          supersededReviewCount: 0,
          lastAnsweredAt: "2026-07-12T10:04:00.000Z",
          lastReviewedAt: "2026-07-12T10:07:00.000Z",
        },
        {
          key: "tax_secret",
          title: "Tax secret",
          type: "string",
          required: true,
          secret: true,
          status: "satisfied",
          answerCount: 1,
          pendingReviewCount: 0,
          approvedReviewCount: 1,
          rejectedReviewCount: 0,
          supersededReviewCount: 0,
          lastAnsweredAt: "2026-07-12T10:05:00.000Z",
          lastReviewedAt: "2026-07-12T10:08:00.000Z",
        },
      ],
    },
    redactionSummary: {
      mapVersion: "curated.v2",
      slotSchemaVersion: "curated.v2",
      totalRules: 2,
      linkedSlotRuleCount: 1,
      linkedSecretSlotRuleCount: 1,
      unlinkedRuleCount: 1,
      orphanSlotKeyCount: 0,
      secretSlotCount: 1,
      coveredSecretSlotCount: 1,
      uncoveredSecretSlotCount: 0,
      secretCoverageComplete: true,
      targetKinds: ["json-path", "file-path"],
      strategies: ["replace", "remove"],
      schemaSecretSlotKeys: ["tax_secret"],
      curatedSecretSlotKeys: [],
      secretSlotKeys: ["tax_secret"],
      coveredSecretSlotKeys: ["tax_secret"],
      uncoveredSecretSlotKeys: [],
      orphanSlotKeys: [],
      previewMatchedRuleCount: 2,
      previewTotalMatches: 2,
      previewMutatedEntries: ["runtime-config.json", "runtime-profile.json"],
      previewUnmatchedRuleIds: [],
      previewError: null,
      rules: [
        {
          ruleId: "replace-tax-secret",
          slotKey: "tax_secret",
          targetKind: "json-path",
          selector: "runtime-config.json#$.env.TAX_SECRET",
          strategy: "replace",
          replacement: "[MASKED-TAX]",
          rationale: "Replace tax secret before export",
          linkedSlotExists: true,
          linkedSecretSlot: true,
          previewMatched: true,
          previewMatchCount: 1,
          previewMutatedEntries: ["runtime-config.json"],
        },
        {
          ruleId: "remove-runtime-profile-file",
          slotKey: null,
          targetKind: "file-path",
          selector: "runtime-profile.json",
          strategy: "remove",
          replacement: null,
          rationale: "Remove runtime profile from redacted exports",
          linkedSlotExists: false,
          linkedSecretSlot: false,
          previewMatched: true,
          previewMatchCount: 1,
          previewMutatedEntries: ["runtime-profile.json"],
        },
      ],
    },
    redactionReview,
    archiveExportAudit: {
      totalExports: 1,
      redactedExportCount: 0,
      plainExportCount: 1,
      latestExportedAt: "2026-07-12T10:21:00.000Z",
      latestRedactedExportedAt: null,
      entries: [
        {
          exportId: "sex_brand_poster_suite_plain_0001",
          exportedAt: "2026-07-12T10:21:00.000Z",
          exportedByUserId: "usr_creator_admin",
          workspaceContextKey: "brand-lab",
          redacted: false,
          archiveSource: "imported",
          archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
          archiveSizeBytes: 4096,
          archiveSha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    },
    governanceSummary: {
      state: "published",
      riskLevel: "low",
      flags: ["published_targets_attached", "runtime_evidence_present"],
      baselineSessionVersionId: "sev_brand_poster_suite",
      liveConsumerCount: 0,
      publishedConsumerCount: 0,
      unpublishedConsumerCount: 0,
      totalDescendantCount: 0,
      draftDescendantCount: 0,
      consumerDescendantCount: 0,
      rollbackDescendantCount: 0,
      runtimeEvidenceCount: 1,
      hasCurrentRuntimeEvidence: true,
      latestConsumerUpdatedAt: null,
      latestRuntimeEvidenceUpdatedAt: "2026-07-12T10:24:00.000Z",
      driftCount: 0,
      driftFieldKeys: [],
    },
    runtimeEvidenceSummary: {
      totalRecords: 1,
      latestCapturedAt: "2026-07-12T10:24:00.000Z",
      latestRunId: "run_brand_poster_suite",
      latestLaunchMode: "local-process",
      containerizedRecordCount: 0,
      currentRunId: "run_brand_poster_suite",
      hasCurrentRunRecord: true,
      items: [
        {
          evidenceId: "sev_brand_poster_suite:run_brand_poster_suite:2026-07-12T10:24:00.000Z",
          capturedAt: "2026-07-12T10:24:00.000Z",
          archiveSource: "runtime-derived",
          runId: "run_brand_poster_suite",
          workspaceId: "wsp_brand_lab",
          requestedByUserId: "usr_creator_admin",
          targetPath: "/workspace/brand-lab/runs/poster-batch",
          launchMode: "local-process",
          containerName: null,
          startedAt: "2026-07-12T10:22:00.000Z",
          readyAt: "2026-07-12T10:23:00.000Z",
          finishedAt: "2026-07-12T10:24:00.000Z",
          exitCode: 0,
          exitSignal: null,
          runtimeProfileId: "brand-poster-suite",
          runnerImage: "lingban/runner:2026.07",
          manifestRuntimeDerived: true,
          runtimeSourceUpdatedAt: "2026-07-12T10:24:00.000Z",
          archiveSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
          workspaceBaseCaptured: true,
          workspaceBaseCaptureError: null,
        },
      ],
    },
    signatureSummary: {
      present: true,
      algorithm: "hmac-sha256",
      keyId: "brand-poster-key",
      verificationRequired: true,
      status: "verified",
      verified: true,
      reason: null,
      signingEnabled: true,
      activeSigningReady: true,
      activeSigningError: null,
      activeSigningAlgorithm: "hmac-sha256",
      activeSigningKeyId: "brand-poster-key",
      acceptedVerificationKeyIds: ["brand-poster-key"],
      acceptsDefaultVerificationKey: false,
      signatureKeyAcceptedByKeyring: true,
      distributionState: "ready",
      distributionTargetCount: 1,
      freshDistributionTargetCount: 1,
      staleDistributionTargetCount: 0,
      manifestKeyDistributedTargetCount: 1,
      manifestKeyMissingTargetCount: 0,
      manifestKeyDistributedToAllTargets: true,
      activeSigningKeyDistributedTargetCount: 1,
      activeSigningKeyMissingTargetCount: 0,
      activeSigningKeyDistributedToAllTargets: true,
      distributionTargets: [
        {
          targetId: "worker-prod-a",
          displayName: {
            zh: "Worker Prod A",
            en: "Worker Prod A",
          },
          channel: "worker",
          acceptedKeyIds: ["brand-poster-key"],
          activeKeyId: "brand-poster-key",
          acceptsManifestKey: true,
          acceptsActiveSigningKey: true,
          reportFresh: true,
          lastReportedAt: "2026-07-12T10:28:00.000Z",
        },
      ],
      matchesActiveSigningAlgorithm: true,
      matchesActiveSigningKey: true,
    },
    policySummary: approvedReview
      ? {
          evaluatedAt: "2026-07-12T10:30:00.000Z",
          requireApprovedRedactionReviewForRedactedExport: true,
          requireApprovedRedactionReviewForPublish: true,
          requireSuccessfulRedactionPreviewForRedactedExport: true,
          requireSuccessfulRedactionPreviewForPublish: true,
          requireCompleteSecretCoverageForRedactedExport: true,
          requireCompleteSecretCoverageForPublish: true,
          requireVerifiedSignatureForInherit: true,
          requireVerifiedSignatureForPublish: true,
          requireVerifiedSignatureForRollback: true,
          requireSignatureKeyAcceptedForPublish: true,
          requireSignatureKeyAcceptedForRollback: true,
          requireSignatureKeyDistributionForPublish: true,
          requireSignatureKeyDistributionForRollback: true,
          warnOnActiveSigningKeyDistributionDrift: true,
          warnOnUnpublishWithLiveConsumers: true,
          checks: [],
          actions: [
            {
              action: "archive-redacted",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "inherit",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "publish",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "rollback",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "unpublish",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
          ],
        }
      : {
          evaluatedAt: "2026-07-12T10:30:00.000Z",
          requireApprovedRedactionReviewForRedactedExport: true,
          requireApprovedRedactionReviewForPublish: true,
          requireSuccessfulRedactionPreviewForRedactedExport: true,
          requireSuccessfulRedactionPreviewForPublish: true,
          requireCompleteSecretCoverageForRedactedExport: true,
          requireCompleteSecretCoverageForPublish: true,
          requireVerifiedSignatureForInherit: true,
          requireVerifiedSignatureForPublish: true,
          requireVerifiedSignatureForRollback: true,
          requireSignatureKeyAcceptedForPublish: true,
          requireSignatureKeyAcceptedForRollback: true,
          requireSignatureKeyDistributionForPublish: true,
          requireSignatureKeyDistributionForRollback: true,
          warnOnActiveSigningKeyDistributionDrift: true,
          warnOnUnpublishWithLiveConsumers: true,
          checks: [
            {
              code: "approved_redaction_review_required",
              decision: "block",
              appliesToActions: ["archive-redacted", "publish"],
              title: {
                zh: "需要脱敏复核批准",
                en: "Approved redaction review required",
              },
              detail: {
                zh: "当前 session-pack 已定义脱敏规则或敏感槽位，但还没有完成正式的脱敏复核批准，不能继续执行对应动作。",
                en: "This session-pack already defines redaction rules or secret slots, but no approved redaction review exists yet, so the affected actions are blocked.",
              },
            },
          ],
          actions: [
            {
              action: "archive-redacted",
              decision: "block",
              blockingCheckCount: 1,
              warningCheckCount: 0,
              checkCodes: ["approved_redaction_review_required"],
            },
            {
              action: "inherit",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "publish",
              decision: "block",
              blockingCheckCount: 1,
              warningCheckCount: 0,
              checkCodes: ["approved_redaction_review_required"],
            },
            {
              action: "rollback",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "unpublish",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
          ],
        },
    consumerGovernance: null,
  };
}

function createCreatorSessionLineage(sessionPack) {
  return {
    focus: sessionPack,
    ancestors: [],
    descendants: [],
  };
}

test.describe("dashboard smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, { authMode: "disabled" });
    });
  });

  test("loads workshops route and shell navigation", async ({ page }) => {
    await page.goto("/dashboard/workshops");
    await expect(page.getByTestId("dashboard-workshops-page")).toBeVisible();
    await expect(page.locator('a[href="/dashboard/instances"]').first()).toBeVisible();
    await expect(page.locator('a[href="/dashboard/creator"]').first()).toBeVisible();
  });

  test("navigates between core dashboard routes", async ({ page }) => {
    await page.goto("/dashboard/workshops");

    await page.locator('a[href="/dashboard/instances"]').first().click();
    await expect(page).toHaveURL(/\/dashboard\/instances$/);
    await expect(page.getByTestId("dashboard-instances-page")).toBeVisible();

    await page.locator('a[href="/dashboard/creator"]').first().click();
    await expect(page).toHaveURL(/\/dashboard\/creator$/);
    await expect(page.getByTestId("dashboard-creator-page")).toBeVisible();
  });

  test("opens deep instance route directly", async ({ page }) => {
    await page.goto("/dashboard/instances/tax-q2/files");
    await expect(page.getByTestId("dashboard-instances-page")).toBeVisible();
  });

  test("previews and downloads files from the instance file tab", async ({ page }) => {
    const fileSnapshot = createFileBrowserSnapshot();
    let previewRequests = 0;
    const downloadTicketPaths = [];

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
        await fulfillJson(route, createApprovalRunsSummary(false));
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}`) {
        await fulfillJson(route, fileSnapshot);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}/files/tree`) {
        await fulfillJson(route, fileSnapshot.files);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}/files/preview`) {
        previewRequests += 1;
        const requestedPath = url.searchParams.get("path") ?? "";

        if (requestedPath.endsWith("checklist.txt")) {
          await fulfillJson(route, {
            file: buildRunFilePreviewRecord({
              runId: fileRunId,
              workspaceId: approvalWorkspaceId,
              targetPath: fileTargetPath,
              path: `${fileTargetPath}/output/checklist.txt`,
              name: "checklist.txt",
              kind: "output",
              sizeBytes: 96,
              mimeType: "text/plain",
              previewMode: "text",
            }),
            mode: "text",
            mimeType: "text/plain",
            content: "Checklist ready\n- confirm tax period\n- confirm receipt archive",
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
              runId: fileRunId,
              workspaceId: approvalWorkspaceId,
              targetPath: fileTargetPath,
              path: `${fileTargetPath}/output/filing-brief.docx`,
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
              runId: fileRunId,
              workspaceId: approvalWorkspaceId,
              targetPath: fileTargetPath,
              path: `${fileTargetPath}/output/poster.png`,
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
              runId: fileRunId,
              workspaceId: approvalWorkspaceId,
              targetPath: fileTargetPath,
              path: `${fileTargetPath}/output/receipt.pdf`,
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
              runId: fileRunId,
              workspaceId: approvalWorkspaceId,
              targetPath: fileTargetPath,
              path: `${fileTargetPath}/output/bundle.zip`,
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

      if (request.method() === "POST" && url.pathname === `/v1/runs/${fileRunId}/download-tickets`) {
        const payload = JSON.parse(request.postData() ?? "{}");
        const requestedPath = payload.path ?? `${fileTargetPath}/output/checklist.txt`;
        const fileName = requestedPath.split("/").at(-1) ?? "download.bin";
        downloadTicketPaths.push(requestedPath);
        await fulfillJson(route, {
          ticket: {
            ticketId: "dlt_dashboard_files_0001",
            runId: fileRunId,
            workspaceId: approvalWorkspaceId,
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
            objectKey: `runs/${fileRunId}/indexed/runtime-output/${requestedPath.replace(`${fileTargetPath}/`, "")}`,
            uploadId: null,
            checksum: "b".repeat(64),
            expiresAt: "2026-07-12T10:15:00.000Z",
            createdAt: "2026-07-12T09:45:00.000Z",
          },
          downloadUrl: `/downloads/dashboard/${fileName}`,
        });
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}/mcp-calls`) {
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

    await page.goto(`/dashboard/instances/${fileRunId}/files`);

    await expect(page.getByTestId("dashboard-instance-file-preview")).toContainText("Checklist ready");
    expect(previewRequests).toBeGreaterThan(0);

    await page.locator("button").filter({ hasText: "/output/filing-brief.docx" }).click();
    await expect(page.getByTestId("dashboard-instance-file-preview")).toContainText(
      "Filing brief"
    );
    await expect(page.getByTestId("dashboard-instance-file-preview")).toContainText(
      "ready for operator review"
    );

    await page.locator("button").filter({ hasText: "/output/poster.png" }).click();
    await expect(
      page.locator('[data-testid="dashboard-instance-file-preview"] img.preview-media')
    ).toHaveAttribute("src", /\/previews\/dashboard\/poster\.png$/);

    await page.locator("button").filter({ hasText: "/output/receipt.pdf" }).click();
    await expect(
      page.locator('[data-testid="dashboard-instance-file-preview"] iframe.preview-embed')
    ).toHaveAttribute("src", /\/previews\/dashboard\/receipt\.pdf$/);

    await page.locator("button").filter({ hasText: "/output/bundle.zip" }).click();
    await expect(page.getByTestId("dashboard-instance-file-preview")).toContainText(
      "当前文件更适合直接下载查看"
    );

    await page.getByTestId("dashboard-instance-file-download").click();

    expect(downloadTicketPaths).toEqual([`${fileTargetPath}/output/bundle.zip`]);
  });

  test("uploads attachments and sends them in the instance conversation", async ({ page }) => {
    const uploadedFileName = "supporting-ledger.pdf";
    const uploadedFilePath = `${fileTargetPath}/uploads/upl_dashboard_0001/${uploadedFileName}`;
    let currentSnapshot = createFileBrowserSnapshot();

    function buildUploadRecord(status) {
      return {
        uploadId: "upl_dashboard_0001",
        runId: fileRunId,
        workspaceId: approvalWorkspaceId,
        fileName: uploadedFileName,
        contentType: "application/pdf",
        declaredSizeBytes: 1536,
        storedSizeBytes: status === "created" ? null : 1536,
        sha256: status === "created" ? null : "d".repeat(64),
        objectKey: `runs/${fileRunId}/uploads/upl_dashboard_0001/${uploadedFileName}`,
        status,
        scanStatus: status === "attached" ? "clean" : "pending",
        scanEngine: status === "attached" ? "clamav" : null,
        scanReasonCode: null,
        scanDetail: null,
        scanSignature: null,
        scannedAt: status === "attached" ? "2026-07-12T09:46:08.000Z" : null,
        attachedPath: status === "attached" ? uploadedFilePath : null,
        attachedLabel: status === "attached" ? uploadedFileName : null,
        createdAt: "2026-07-12T09:46:00.000Z",
        updatedAt:
          status === "created"
            ? "2026-07-12T09:46:00.000Z"
            : status === "uploaded"
              ? "2026-07-12T09:46:05.000Z"
              : "2026-07-12T09:46:08.000Z",
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

    await page.route("**/v1/runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/runs") {
        await fulfillJson(route, [currentSnapshot]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, createApprovalRunsSummary(false));
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}`) {
        await fulfillJson(route, currentSnapshot);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}/files/tree`) {
        await fulfillJson(route, currentSnapshot.files);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/runs/${fileRunId}/mcp-calls`) {
        await fulfillJson(route, []);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/runs/${fileRunId}/uploads`) {
        await fulfillJson(route, {
          upload: buildUploadRecord("created"),
          uploadUrl: `/uploads/mock/${fileRunId}/upl_dashboard_0001`,
          method: "PUT",
          maxBytes: 5_000_000,
          contentType: "application/octet-stream",
        });
        return;
      }

      if (
        request.method() === "PUT" &&
        url.pathname.startsWith(`/v1/runs/${fileRunId}/uploads/`) &&
        /\/content\/?$/.test(url.pathname)
      ) {
        await fulfillJson(route, buildUploadRecord("uploaded"));
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname.startsWith(`/v1/runs/${fileRunId}/uploads/`) &&
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

      if (request.method() === "POST" && url.pathname === `/v1/runs/${fileRunId}/messages`) {
        const payload = JSON.parse(request.postData() ?? "{}");

        expect(payload.text).toBe("Please review the attached ledger and continue.");
        expect(payload.attachments).toEqual([
          {
            path: uploadedFilePath,
            label: uploadedFileName,
            slotKey: null,
          },
        ]);

        currentSnapshot = {
          ...currentSnapshot,
          messages: [
            ...currentSnapshot.messages,
            {
              messageId: "msg_dashboard_upload_0001",
              runId: fileRunId,
              role: "user",
              kind: "text",
              text: payload.text,
              attachments: payload.attachments,
              createdAt: "2026-07-12T09:46:10.000Z",
            },
          ],
          files: [
            ...currentSnapshot.files,
            {
              path: uploadedFilePath,
              name: uploadedFileName,
              kind: "input",
              sizeBytes: 1536,
              updatedAt: "2026-07-12T09:46:08.000Z",
            },
          ],
        };

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

    await page.goto(`/dashboard/instances/${fileRunId}`);

    await page
      .getByTestId("dashboard-instance-composer-input")
      .fill("Please review the attached ledger and continue.");

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("dashboard-instance-add-attachments").click();
    const chooser = await chooserPromise;
    await chooser.setFiles([
      {
        name: uploadedFileName,
        mimeType: "application/pdf",
        buffer: Buffer.from("ledger sample pdf bytes"),
      },
    ]);

    await expect(page.getByTestId("dashboard-instance-attachment-drafts")).toContainText(uploadedFileName);

    const createUploadRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === `/v1/runs/${fileRunId}/uploads`;
    });
    const sendMessageRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname === `/v1/runs/${fileRunId}/messages`;
    });

    await page.getByTestId("dashboard-instance-send-button").click();

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

  test("opens deep batch route directly under the service launchpad", async ({ page }) => {
    await page.goto("/dashboard/services/poster-batch/batches/brj_demo_0001");
    await expect(page.getByTestId("dashboard-workshops-page")).toBeVisible();
  });

  test("estimates batch budget from the launchpad governance form", async ({ page }) => {
    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, { authMode: "disabled" });
    });
    await page.route("**/v1/workshops**", async (route) => {
      await fulfillJson(route, [workshop]);
    });
    await page.route("**/v1/services**", async (route) => {
      await fulfillJson(route, [service]);
    });
    await page.route("**/v1/runs**", async (route) => {
      await fulfillJson(route, []);
    });
    await page.route("**/v1/batch-runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/batch-runs") {
        await fulfillJson(route, []);
        return;
      }

      if (request.method() === "POST" && url.pathname === "/v1/batch-runs/estimate") {
        await fulfillJson(route, batchEstimate);
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

    await page.goto("/dashboard/services/poster-batch");

    await expect(page.getByTestId("dashboard-batch-governance")).toBeVisible();
    await page.getByTestId("dashboard-batch-max-parallel-runs").fill("4");
    await page.getByTestId("dashboard-batch-retry-limit").fill("1");
    await page.getByTestId("dashboard-batch-budget-limit").fill("25");
    await page.getByTestId("dashboard-batch-estimate-refresh").click();

    const estimateResult = page.getByTestId("dashboard-batch-estimate-result");
    await expect(estimateResult).toBeVisible();
    await expect(estimateResult).toContainText("$");
    await expect(estimateResult).toContainText("min");
  });

  test("creates a batch draft and manages the batch board lifecycle", async ({ page }) => {
    const draftItems = [
      buildBatchItem({
        batchItemId: "bat_item_demo_0001",
        rowIndex: 0,
        title: "Poster A",
        pathSuffix: "poster-a",
        status: "draft",
        updatedAt: "2026-07-12T08:00:00.000Z",
      }),
      buildBatchItem({
        batchItemId: "bat_item_demo_0002",
        rowIndex: 1,
        title: "Poster B",
        pathSuffix: "poster-b",
        status: "draft",
        updatedAt: "2026-07-12T08:00:00.000Z",
      }),
    ];
    const validatedItems = [
      buildBatchItem({
        batchItemId: "bat_item_demo_0001",
        rowIndex: 0,
        title: "Poster A",
        pathSuffix: "poster-a",
        status: "validated",
        updatedAt: "2026-07-12T08:02:00.000Z",
      }),
      buildBatchItem({
        batchItemId: "bat_item_demo_0002",
        rowIndex: 1,
        title: "Poster B",
        pathSuffix: "poster-b",
        status: "validated",
        updatedAt: "2026-07-12T08:02:00.000Z",
      }),
    ];
    const startedItems = [
      buildBatchItem({
        batchItemId: "bat_item_demo_0001",
        rowIndex: 0,
        title: "Poster A",
        pathSuffix: "poster-a",
        status: "failed",
        updatedAt: "2026-07-12T08:06:00.000Z",
        runId: "run_poster_a_0001",
        runStatus: "FAILED",
        runStatusReason: "Seedance quota timeout",
        attemptCount: 1,
        errorCode: "SEEDANCE_TIMEOUT",
        errorMessage: "Seedance quota timeout",
        startedAt: "2026-07-12T08:05:00.000Z",
        finishedAt: "2026-07-12T08:06:00.000Z",
      }),
      buildBatchItem({
        batchItemId: "bat_item_demo_0002",
        rowIndex: 1,
        title: "Poster B",
        pathSuffix: "poster-b",
        status: "queued",
        updatedAt: "2026-07-12T08:05:30.000Z",
      }),
    ];
    const retriedItems = [
      buildBatchItem({
        batchItemId: "bat_item_demo_0001",
        rowIndex: 0,
        title: "Poster A",
        pathSuffix: "poster-a",
        status: "validated",
        updatedAt: "2026-07-12T08:07:00.000Z",
        previousRunIds: ["run_poster_a_0001"],
        attemptCount: 1,
      }),
      buildBatchItem({
        batchItemId: "bat_item_demo_0002",
        rowIndex: 1,
        title: "Poster B",
        pathSuffix: "poster-b",
        status: "queued",
        updatedAt: "2026-07-12T08:07:00.000Z",
      }),
    ];
    const cancelledItems = [
      buildBatchItem({
        batchItemId: "bat_item_demo_0001",
        rowIndex: 0,
        title: "Poster A",
        pathSuffix: "poster-a",
        status: "cancelled",
        updatedAt: "2026-07-12T08:08:00.000Z",
        previousRunIds: ["run_poster_a_0001"],
        attemptCount: 1,
        finishedAt: "2026-07-12T08:08:00.000Z",
      }),
      buildBatchItem({
        batchItemId: "bat_item_demo_0002",
        rowIndex: 1,
        title: "Poster B",
        pathSuffix: "poster-b",
        status: "cancelled",
        updatedAt: "2026-07-12T08:08:00.000Z",
        finishedAt: "2026-07-12T08:08:00.000Z",
      }),
    ];

    let currentItems = [];
    let currentBatch = null;
    let createBatchPayload = null;
    let validateCallCount = 0;
    let startBatchPayload = null;
    let retryBatchPayload = null;
    let cancelBatchPayload = null;

    await page.route("**/v1/workshops**", async (route) => {
      await fulfillJson(route, [workshop]);
    });
    await page.route("**/v1/services**", async (route) => {
      await fulfillJson(route, [service]);
    });
    await page.route("**/v1/runs**", async (route) => {
      await fulfillJson(route, []);
    });
    await page.route("**/v1/batch-runs**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/batch-runs") {
        await fulfillJson(route, currentBatch ? [currentBatch] : []);
        return;
      }

      if (request.method() === "POST" && url.pathname === "/v1/batch-runs") {
        const payload = JSON.parse(request.postData() ?? "{}");
        createBatchPayload = payload;

        expect(payload.serviceId).toBe(service.serviceId);
        expect(payload.governance).toEqual({
          maxParallelRuns: 2,
          budgetLimit: 25,
          retryLimit: 1,
        });
        expect(payload.items).toHaveLength(2);
        expect(payload.items[0]).toMatchObject({
          title: "Poster A",
          pathSuffix: "poster-a",
        });
        expect(payload.items[1]).toMatchObject({
          title: "Poster B",
          pathSuffix: "poster-b",
        });

        currentItems = draftItems;
        currentBatch = buildBatchDetail({
          status: "draft",
          items: currentItems,
          updatedAt: "2026-07-12T08:00:00.000Z",
        });
        await fulfillJson(route, currentBatch);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/batch-runs/${batchJobId}`) {
        await fulfillJson(route, currentBatch);
        return;
      }

      if (request.method() === "GET" && url.pathname === `/v1/batch-runs/${batchJobId}/items`) {
        await fulfillJson(route, buildBatchItemsResponse(currentBatch, currentItems));
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/batch-runs/${batchJobId}/validate`) {
        validateCallCount += 1;
        currentItems = validatedItems;
        currentBatch = buildBatchDetail({
          status: "validated",
          items: currentItems,
          updatedAt: "2026-07-12T08:02:00.000Z",
          validatedAt: "2026-07-12T08:02:00.000Z",
        });
        await fulfillJson(route, currentBatch);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/batch-runs/${batchJobId}/start`) {
        startBatchPayload = JSON.parse(request.postData() ?? "{}");
        expect(startBatchPayload).toEqual({});

        currentItems = startedItems;
        currentBatch = buildBatchDetail({
          status: "partial_failed",
          items: currentItems,
          updatedAt: "2026-07-12T08:06:00.000Z",
          validatedAt: "2026-07-12T08:02:00.000Z",
          startedAt: "2026-07-12T08:05:00.000Z",
        });
        await fulfillJson(route, currentBatch);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/batch-runs/${batchJobId}/retry`) {
        retryBatchPayload = JSON.parse(request.postData() ?? "{}");
        expect(retryBatchPayload).toEqual({
          onlyFailed: true,
        });

        currentItems = retriedItems;
        currentBatch = buildBatchDetail({
          status: "queued",
          items: currentItems,
          updatedAt: "2026-07-12T08:07:00.000Z",
          validatedAt: "2026-07-12T08:02:00.000Z",
          startedAt: "2026-07-12T08:05:00.000Z",
        });
        await fulfillJson(route, currentBatch);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/batch-runs/${batchJobId}/cancel`) {
        cancelBatchPayload = JSON.parse(request.postData() ?? "{}");
        expect(cancelBatchPayload).toEqual({
          reason: "dashboard operator cancelled remaining items",
        });

        currentItems = cancelledItems;
        currentBatch = buildBatchDetail({
          status: "cancelled",
          items: currentItems,
          updatedAt: "2026-07-12T08:08:00.000Z",
          validatedAt: "2026-07-12T08:02:00.000Z",
          startedAt: "2026-07-12T08:05:00.000Z",
          finishedAt: "2026-07-12T08:08:00.000Z",
          cancelledAt: "2026-07-12T08:08:00.000Z",
          cancellationReason: "dashboard operator cancelled remaining items",
        });
        await fulfillJson(route, currentBatch);
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

    await page.goto("/dashboard/services/poster-batch");
    await expect(page.getByTestId("dashboard-batch-governance")).toBeVisible();

    await page.getByTestId("dashboard-batch-max-parallel-runs").fill("2");
    await page.getByTestId("dashboard-batch-retry-limit").fill("1");
    await page.getByTestId("dashboard-batch-budget-limit").fill("25");

    await page.getByTestId("dashboard-batch-create-draft").click();
    await expect.poll(() => createBatchPayload?.serviceId ?? null).toBe(service.serviceId);
    await expect.poll(() => currentBatch?.job.status ?? null).toBe("draft");
    await expect(page).toHaveURL(new RegExp(`/dashboard/services/${service.serviceId}/batches/${batchJobId}$`));
    await expect(page.getByTestId("dashboard-batch-board")).toBeVisible();
    await expect(page.getByTestId("dashboard-batch-board-status")).toContainText("draft");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0001")).toContainText("draft");

    await page.getByTestId("dashboard-batch-validate").click();
    await expect.poll(() => validateCallCount).toBe(1);
    await expect.poll(() => currentBatch?.job.status ?? null).toBe("validated");
    await expect(page.getByTestId("dashboard-batch-board-status")).toContainText("validated");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0001")).toContainText("validated");

    await page.getByTestId("dashboard-batch-start").click();
    await expect.poll(() => startBatchPayload).toEqual({});
    await expect.poll(() => currentBatch?.job.status ?? null).toBe("partial_failed");
    await expect(page.getByTestId("dashboard-batch-board-status")).toContainText("partial_failed");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0001")).toContainText("failed");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0002")).toContainText("queued");

    await page.getByTestId("dashboard-batch-retry").click();
    await expect.poll(() => retryBatchPayload).toEqual({ onlyFailed: true });
    await expect.poll(() => currentBatch?.job.status ?? null).toBe("queued");
    await expect(page.getByTestId("dashboard-batch-board-status")).toContainText("queued");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0001")).toContainText("validated");

    await page.getByTestId("dashboard-batch-cancel").click();
    await expect.poll(() => cancelBatchPayload).toEqual({
      reason: "dashboard operator cancelled remaining items",
    });
    await expect.poll(() => currentBatch?.job.status ?? null).toBe("cancelled");
    await expect(page.getByTestId("dashboard-batch-board-status")).toContainText("cancelled");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0001")).toContainText("cancelled");
    await expect(page.getByTestId("dashboard-batch-item-status-bat_item_demo_0002")).toContainText("cancelled");
  });

  test("launches a service into a live conversation with input collection guidance", async ({ page }) => {
    const launchRunId = "run_tax_q2_launch";
    const launchTargetPath = `/workspace/tax-q2/${launchRunId}`;
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
        zh: "Harbor Finance Team",
        en: "Harbor Finance Team",
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
        zh: "启动后先由 Codex 收集报税所需输入。",
        en: "Codex collects the filing inputs before execution continues.",
      },
      nextStepSummary: {
        zh: "进入实例对话并补齐缺失信息。",
        en: "Enter the run conversation and provide the missing inputs.",
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
        zh: "Quarterly filing",
        en: "Quarterly filing",
      },
      summary: {
        zh: "先补齐主体、周期和材料，再继续受控执行。",
        en: "Collect entity, period, and materials before continuing the controlled flow.",
      },
      authRequirementText: {
        zh: "Requires finance credentials.",
        en: "Requires finance credentials.",
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
        workspaceId: approvalWorkspaceId,
        taskVersionId: "tsv_tax_q2_launch",
        sessionVersionId: "sev_tax_q2_launch",
        requestedByUserId: "usr_dashboard_launch",
        title: "2026 Q2 tax filing kickoff",
        targetPath: launchTargetPath,
        entrySurface: "dashboard",
        catalogMetadata: {
          workspaceContextKey: "harbor-finance",
          workspaceContextName: {
            zh: "Harbor Finance Team",
            en: "Harbor Finance Team",
          },
          workshopId: "enterprise-tax",
          workshopName: {
            zh: "Enterprise Tax Workshop",
            en: "Enterprise Tax Workshop",
          },
          serviceId: "tax-filing",
          serviceName: {
            zh: "Quarterly filing",
            en: "Quarterly filing",
          },
        },
        status: "RUNNING",
        statusReason: null,
        createdAt: "2026-07-12T10:10:00.000Z",
        updatedAt: "2026-07-12T10:11:00.000Z",
      },
      runtime: {
        launchMode: "docker",
        containerName: "lingban-run-tax-q2-launch",
        startedAt: "2026-07-12T10:10:10.000Z",
        readyAt: "2026-07-12T10:10:20.000Z",
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
        lastUpdatedAt: "2026-07-12T10:10:30.000Z",
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
          messageId: "msg_tax_launch_0001",
          runId: launchRunId,
          role: "system",
          kind: "prompt",
          text: "Please tell me what information I need to provide to you.",
          attachments: [],
          createdAt: "2026-07-12T10:10:30.000Z",
        },
        {
          messageId: "msg_tax_launch_0002",
          runId: launchRunId,
          role: "agent",
          kind: "text",
          text: "I need the legal entity name and the filing materials before I continue.",
          attachments: [],
          createdAt: "2026-07-12T10:11:00.000Z",
        },
      ],
      files: [
        {
          path: `${launchTargetPath}/output/`,
          name: "output/",
          kind: "output",
          sizeBytes: null,
          updatedAt: "2026-07-12T10:11:10.000Z",
        },
      ],
      artifacts: [],
      approvals: [],
    };
    const launchTemplate = {
      serviceId: "tax-filing",
      workspaceContext: {
        contextKey: "harbor-finance",
        runtimeWorkspaceId: approvalWorkspaceId,
        displayName: {
          zh: "Harbor Finance Team",
          en: "Harbor Finance Team",
        },
        type: "team",
        meta: {
          zh: "Finance workspace",
          en: "Finance workspace",
        },
        root: "/workspace/harbor-finance",
        allowedEntrySurfaces: ["dashboard", "h5"],
      },
      taskVersionId: "tsv_tax_q2_launch",
      sessionVersionId: "sev_tax_q2_launch",
      title: {
        zh: "Quarterly filing",
        en: "Quarterly filing",
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
        workspaceId: approvalWorkspaceId,
        taskVersionId: "tsv_tax_q2_launch",
        sessionVersionId: "sev_tax_q2_launch",
        requestedByUserId: "usr_dashboard_launch",
        title: "2026 Q2 tax filing kickoff",
        targetPath: launchTargetPath,
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        catalogMetadata: launchSnapshot.run.catalogMetadata,
      },
    };

    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, { authMode: "disabled" });
    });
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
        await fulfillJson(route, [launchSnapshot]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/runs/summary") {
        await fulfillJson(route, createApprovalRunsSummary(false));
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
    await page.route("**/v1/billing**", async (route) => {
      await fulfillJson(
        route,
        {
          error: {
            message: "No billing fixture for this test.",
          },
        },
        404
      );
    });

    await page.goto("/dashboard/services/tax-filing");

    await page.getByTestId("dashboard-launch-run-button").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/instances/${launchRunId}$`));
    await expect(page.getByTestId("dashboard-instance-information-collection")).toBeVisible();
    await expect(
      page.getByText("Please tell me what information I need to provide to you.").first()
    ).toBeVisible();
    await expect(page.getByText("Company legal name").first()).toBeVisible();
  });

  test("approves a pending run directly from the conversation thread", async ({ page }) => {
    let currentSnapshot = createApprovalSnapshot("pending");
    let currentSummary = createApprovalRunsSummary(true);

    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, { authMode: "disabled" });
    });

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

      if (request.method() === "GET" && url.pathname === `/v1/runs/${approvalRunId}/mcp-calls`) {
        await fulfillJson(route, []);
        return;
      }

      if (request.method() === "POST" && url.pathname === `/v1/runs/${approvalRunId}/approvals`) {
        currentSnapshot = createApprovalSnapshot("approved");
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

    await page.goto(`/dashboard/instances/${approvalRunId}`);

    await expect(page.getByTestId("dashboard-instance-pending-approval")).toBeVisible();
    await page.getByTestId("dashboard-instance-approve-button").click();
    await expect(page.getByTestId("dashboard-instance-pending-approval")).toHaveCount(0);
  });

  test("reviews a structured information answer directly from the conversation thread", async ({
    page,
  }) => {
    let currentSnapshot = createReviewSnapshot("pending");
    let currentSummary = createReviewRunsSummary(true);
    let reviewRequests = 0;

    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, { authMode: "disabled" });
    });

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

      if (request.method() === "GET" && url.pathname === `/v1/runs/${reviewRunId}/mcp-calls`) {
        await fulfillJson(route, []);
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === `/v1/runs/${reviewRunId}/information-collection/reviews`
      ) {
        reviewRequests += 1;
        currentSnapshot = createReviewSnapshot("approved");
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

    await page.goto(`/dashboard/instances/${reviewRunId}`);

    await expect(page.getByTestId(`dashboard-instance-review-answer-${reviewAnswerId}`)).toBeVisible();
    await expect(page.getByTestId("dashboard-instance-review-count-pending")).toContainText("1");
    await page.getByTestId(`dashboard-instance-review-approve-${reviewAnswerId}`).click();
    await expect(page.getByTestId("dashboard-instance-review-count-pending")).toContainText("0");
    await expect(page.getByTestId("dashboard-instance-review-count-approved")).toContainText("1");
    expect(reviewRequests).toBe(1);
  });

  test("records session-pack redaction review decisions and archive export audit in creator", async ({
    page,
  }) => {
    const authEnvelope = createCreatorAuthEnvelope();
    const packageSummary = createCreatorPackageSummary();
    const packageDetail = createCreatorPackageDetail();
    let currentSessionPack = createCreatorSessionPackDetail();
    let reviewRequests = 0;
    let redactedArchiveDownloads = 0;

    await page.addInitScript((input) => {
      window.localStorage.setItem("lingban.dashboard.auth", JSON.stringify(input.authState));
      window.localStorage.setItem("lingban.dashboard.workspace", input.workspaceId);
      window.localStorage.setItem("lingban.dashboard.lang", "en");
    }, {
      authState: {
        tokens: {
          tokenType: "Bearer",
          accessToken: "dashboard-access-token",
          refreshToken: "dashboard-refresh-token",
          expiresInSeconds: 3600,
        },
        user: authEnvelope.user,
        session: authEnvelope.session,
        currentWorkspace: authEnvelope.currentWorkspace,
        workspaces: authEnvelope.workspaces,
      },
      workspaceId: authEnvelope.currentWorkspace.workspaceId,
    });

    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, authEnvelope);
    });
    await page.route("**/v1/workshops**", async (route) => {
      await fulfillJson(route, [workshop]);
    });
    await page.route("**/v1/services**", async (route) => {
      await fulfillJson(route, [service]);
    });
    await page.route("**/v1/packages**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/packages") {
        await fulfillJson(route, [packageSummary]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/packages/brand-poster-suite") {
        await fulfillJson(route, packageDetail);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/packages/brand-poster-suite/releases"
      ) {
        await fulfillJson(route, []);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/packages/brand-poster-suite/replays"
      ) {
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
    await page.route("**/v1/sessions/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/sessions/sev_brand_poster_suite") {
        await fulfillJson(route, currentSessionPack);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/sessions/sev_brand_poster_suite/lineage"
      ) {
        await fulfillJson(route, createCreatorSessionLineage(currentSessionPack));
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/v1/sessions/sev_brand_poster_suite/redaction-review"
      ) {
        reviewRequests += 1;
        const payload = JSON.parse(request.postData() ?? "{}");
        const reviewedAt = "2026-07-12T10:32:00.000Z";
        const approvedPolicySummary =
          payload.decision === "approved"
            ? createCreatorSessionPackDetail({ approvedReview: true }).policySummary
            : createCreatorSessionPackDetail().policySummary;
        currentSessionPack = {
          ...currentSessionPack,
          updatedAt: reviewedAt,
          redactionReview: {
            decision: payload.decision,
            reviewedAt,
            reviewedByUserId: "usr_creator_admin",
            note: payload.note ?? null,
            mapVersion: currentSessionPack.redactionSummary.mapVersion,
            totalRules: currentSessionPack.redactionSummary.totalRules,
            previewMatchedRuleCount:
              currentSessionPack.redactionSummary.previewMatchedRuleCount,
            secretCoverageComplete:
              currentSessionPack.redactionSummary.secretCoverageComplete,
          },
          policySummary: approvedPolicySummary,
        };
        await fulfillJson(route, {
          sessionPack: currentSessionPack,
          reviewedAt,
          reviewedByUserId: "usr_creator_admin",
          decision: payload.decision,
          persistedArchive: true,
        });
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/sessions/sev_brand_poster_suite/archive"
      ) {
        const redacted = url.searchParams.get("redact") === "true";
        if (redacted) {
          redactedArchiveDownloads += 1;
          currentSessionPack = {
            ...currentSessionPack,
            updatedAt: "2026-07-12T10:33:00.000Z",
            archiveExportAudit: {
              totalExports: 2,
              redactedExportCount: 1,
              plainExportCount: 1,
              latestExportedAt: "2026-07-12T10:33:00.000Z",
              latestRedactedExportedAt: "2026-07-12T10:33:00.000Z",
              entries: [
                {
                  exportId: "sex_brand_poster_suite_redacted_0002",
                  exportedAt: "2026-07-12T10:33:00.000Z",
                  exportedByUserId: "usr_creator_admin",
                  workspaceContextKey: "brand-lab",
                  redacted: true,
                  archiveSource: "imported",
                  archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
                  archiveSizeBytes: 2048,
                  archiveSha256:
                    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                },
                ...currentSessionPack.archiveExportAudit.entries,
              ],
            },
          };
        }

        await route.fulfill({
          status: 200,
          contentType: "application/gzip",
          headers: {
            "content-disposition":
              "attachment; filename=\"sev_brand_poster_suite.session-pack.json.gz\"; filename*=UTF-8''sev_brand_poster_suite.session-pack.json.gz",
            "x-lingban-session-pack-source": "imported",
            "x-lingban-session-pack-redacted": redacted ? "true" : "false",
          },
          body: Buffer.from(redacted ? [9, 8, 7, 6] : [1, 2, 3, 4]),
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

    await page.goto("/dashboard/creator/packages/brand-poster-suite");

    await expect(page.getByTestId("dashboard-creator-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-governance-summary-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-governance-summary-card")).toContainText(
      "Published"
    );
    await expect(page.getByTestId("dashboard-session-runtime-evidence-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-runtime-evidence-card")).toContainText(
      "run_brand_poster_suite"
    );
    await expect(page.getByTestId("dashboard-session-runtime-evidence-card")).toContainText(
      "Local process"
    );
    await expect(page.getByTestId("dashboard-session-signature-summary-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-signature-summary-card")).toContainText(
      "Verified"
    );
    await expect(page.getByTestId("dashboard-session-signature-summary-card")).toContainText(
      "Distribution ready"
    );
    await expect(page.getByTestId("dashboard-session-policy-summary-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-policy-summary-card")).toContainText(
      "Blocking checks"
    );
    await expect(page.getByTestId("dashboard-session-redaction-review-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-export-audit-card")).toContainText(
      "sex_brand_poster_suite_plain_0001"
    );

    await page
      .getByTestId("dashboard-session-redaction-review-note")
      .fill("Secret coverage verified for release.");
    await page.getByTestId("dashboard-session-redaction-review-approve").click();

    await expect(page.getByTestId("dashboard-session-redaction-review-card")).toContainText(
      "Secret coverage verified for release."
    );
    await expect(page.getByTestId("dashboard-session-redaction-review-card")).toContainText(
      "Approved"
    );
    await expect(page.getByTestId("dashboard-session-policy-summary-card")).toContainText(
      "All actions allowed"
    );

    const archiveRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        request.method() === "GET" &&
        url.pathname === "/v1/sessions/sev_brand_poster_suite/archive" &&
        url.searchParams.get("redact") === "true"
      );
    });
    await page.getByTestId("dashboard-session-download-redacted-archive").click();
    await archiveRequestPromise;

    await expect(page.getByTestId("dashboard-session-export-audit-card")).toContainText(
      "sex_brand_poster_suite_redacted_0002"
    );
    await expect(page.getByTestId("dashboard-session-export-audit-card")).toContainText(
      "Redacted"
    );

    expect(reviewRequests).toBe(1);
    expect(redactedArchiveDownloads).toBe(1);
  });

  test("curates secret slots in creator session redaction workflow", async ({ page }) => {
    const authEnvelope = createCreatorAuthEnvelope();
    const packageSummary = createCreatorPackageSummary();
    const packageDetail = createCreatorPackageDetail();
    let currentSessionPack = createCreatorSessionPackDetail();
    let redactionMapRequests = 0;

    await page.addInitScript((input) => {
      window.localStorage.setItem("lingban.dashboard.auth", JSON.stringify(input.authState));
      window.localStorage.setItem("lingban.dashboard.workspace", input.workspaceId);
      window.localStorage.setItem("lingban.dashboard.lang", "en");
    }, {
      authState: {
        tokens: {
          tokenType: "Bearer",
          accessToken: "dashboard-access-token",
          refreshToken: "dashboard-refresh-token",
          expiresInSeconds: 3600,
        },
        user: authEnvelope.user,
        session: authEnvelope.session,
        currentWorkspace: authEnvelope.currentWorkspace,
        workspaces: authEnvelope.workspaces,
      },
      workspaceId: authEnvelope.currentWorkspace.workspaceId,
    });

    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, authEnvelope);
    });
    await page.route("**/v1/workshops**", async (route) => {
      await fulfillJson(route, [workshop]);
    });
    await page.route("**/v1/services**", async (route) => {
      await fulfillJson(route, [service]);
    });
    await page.route("**/v1/packages**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/packages") {
        await fulfillJson(route, [packageSummary]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/packages/brand-poster-suite") {
        await fulfillJson(route, packageDetail);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/packages/brand-poster-suite/releases"
      ) {
        await fulfillJson(route, []);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/packages/brand-poster-suite/replays"
      ) {
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
    await page.route("**/v1/sessions/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/sessions/sev_brand_poster_suite") {
        await fulfillJson(route, currentSessionPack);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/sessions/sev_brand_poster_suite/lineage"
      ) {
        await fulfillJson(route, createCreatorSessionLineage(currentSessionPack));
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/v1/sessions/sev_brand_poster_suite/redaction-map"
      ) {
        redactionMapRequests += 1;
        const payload = JSON.parse(request.postData() ?? "{}");
        expect(payload.curatedSecretSlotKeys).toEqual(["brand_name"]);

        currentSessionPack = {
          ...currentSessionPack,
          updatedAt: "2026-07-12T10:31:00.000Z",
          redactionSummary: {
            ...currentSessionPack.redactionSummary,
            mapVersion: payload.mapVersion,
            secretSlotCount: 2,
            coveredSecretSlotCount: 1,
            uncoveredSecretSlotCount: 1,
            secretCoverageComplete: false,
            schemaSecretSlotKeys: ["tax_secret"],
            curatedSecretSlotKeys: ["brand_name"],
            secretSlotKeys: ["tax_secret", "brand_name"],
            coveredSecretSlotKeys: ["tax_secret"],
            uncoveredSecretSlotKeys: ["brand_name"],
          },
        };

        await fulfillJson(route, {
          sessionPack: currentSessionPack,
          updatedAt: currentSessionPack.updatedAt,
          updatedByUserId: "usr_creator_admin",
          totalRules: currentSessionPack.redactionSummary.totalRules,
          persistedArchive: true,
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

    await page.goto("/dashboard/creator/packages/brand-poster-suite");

    await expect(page.getByTestId("dashboard-creator-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-redaction-secret-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-redaction-secret-toggle-tax_secret")).toBeDisabled();

    await page.getByTestId("dashboard-session-redaction-secret-toggle-brand_name").click();
    await expect(page.getByTestId("dashboard-session-redaction-secret-card")).toContainText("Curated");
    await expect(page.getByTestId("dashboard-session-redaction-secret-card")).toContainText(
      "Needs rule"
    );

    await page.getByRole("button", { name: "Save redaction map" }).click();

    await expect(page.getByTestId("dashboard-session-operation-notice")).toContainText(
      "synchronized 1 curated secret-slot marks"
    );
    await expect(page.getByTestId("dashboard-session-redaction-secret-card")).toContainText(
      "brand_name"
    );
    await expect(page.getByTestId("dashboard-session-redaction-secret-card")).toContainText(
      "Remove mark"
    );
    expect(redactionMapRequests).toBe(1);
  });

  test("manages session-pack publish, inherit, and rollback flows in creator", async ({
    page,
  }) => {
    const authEnvelope = createCreatorAuthEnvelope();
    const packageSummary = createCreatorPackageSummary();
    const packageDetail = createCreatorPackageDetail();
    const sessionPacks = new Map();
    const baseSessionVersionId = "sev_brand_poster_suite";
    const inheritedDraftVersionId = "sev_brand_poster_suite_draft_0002";
    const baseSessionPack = {
      ...createCreatorSessionPackDetail({ approvedReview: true }),
      lineageParentVersionId: null,
      rollbackFromVersionId: null,
      inheritMode: null,
    };
    sessionPacks.set(baseSessionVersionId, baseSessionPack);

    let publishRequests = 0;
    let inheritRequests = 0;
    let rollbackRequests = 0;

    const buildPublishedTarget = (sessionVersionId, entrySurface) => ({
      templateKey: `poster-batch:brand-lab:${entrySurface}`,
      serviceId: "poster-batch",
      workspaceContextKey: "brand-lab",
      entrySurface,
      taskVersionId: "tsv_poster_batch",
      sessionVersionId,
      title: {
        zh: "Brand Poster Batch",
        en: "Brand Poster Batch",
      },
      targetRoot: "/workspace/brand-lab/runs/poster-batch",
      bindings: {
        firstPartyMcpIds: ["browser-core"],
        externalConnectorRefs: ["connector://seedance/private"],
        credentialIds: ["cred_image_brand"],
      },
    });

    const buildLineageEntry = (sessionPack, relation, depth, viaSessionVersionId, overrides = {}) => ({
      ...sessionPack,
      relation,
      depth,
      viaSessionVersionId,
      ...overrides,
    });

    const buildLineage = (sessionVersionId) => {
      const focus = sessionPacks.get(sessionVersionId);
      if (!focus) {
        return null;
      }

      if (sessionVersionId === baseSessionVersionId) {
        return {
          focus,
          ancestors: [],
          descendants: sessionPacks.has(inheritedDraftVersionId)
            ? [
                buildLineageEntry(
                  sessionPacks.get(inheritedDraftVersionId),
                  "lineage_child",
                  1,
                  baseSessionVersionId
                ),
              ]
            : [],
        };
      }

      return {
        focus,
        ancestors: [
          buildLineageEntry(baseSessionPack, "lineage_parent", 1, sessionVersionId),
        ],
        descendants: [],
      };
    };

    await page.addInitScript((input) => {
      window.localStorage.setItem("lingban.dashboard.auth", JSON.stringify(input.authState));
      window.localStorage.setItem("lingban.dashboard.workspace", input.workspaceId);
      window.localStorage.setItem("lingban.dashboard.lang", "en");
    }, {
      authState: {
        tokens: {
          tokenType: "Bearer",
          accessToken: "dashboard-access-token",
          refreshToken: "dashboard-refresh-token",
          expiresInSeconds: 3600,
        },
        user: authEnvelope.user,
        session: authEnvelope.session,
        currentWorkspace: authEnvelope.currentWorkspace,
        workspaces: authEnvelope.workspaces,
      },
      workspaceId: authEnvelope.currentWorkspace.workspaceId,
    });

    await page.route("**/v1/auth/session", async (route) => {
      await fulfillJson(route, authEnvelope);
    });
    await page.route("**/v1/workshops**", async (route) => {
      await fulfillJson(route, [workshop]);
    });
    await page.route("**/v1/services**", async (route) => {
      await fulfillJson(route, [service]);
    });
    await page.route("**/v1/packages**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.pathname === "/v1/packages") {
        await fulfillJson(route, [packageSummary]);
        return;
      }

      if (request.method() === "GET" && url.pathname === "/v1/packages/brand-poster-suite") {
        await fulfillJson(route, packageDetail);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/packages/brand-poster-suite/releases"
      ) {
        await fulfillJson(route, []);
        return;
      }

      if (
        request.method() === "GET" &&
        url.pathname === "/v1/packages/brand-poster-suite/replays"
      ) {
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
    await page.route("**/v1/sessions/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const detailMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)$/);
      const lineageMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/lineage$/);
      const inheritMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/inherit$/);
      const publishMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/publish$/);
      const rollbackMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/rollback$/);

      if (request.method() === "GET" && detailMatch) {
        const sessionPack = sessionPacks.get(detailMatch[1]);
        if (sessionPack) {
          await fulfillJson(route, sessionPack);
          return;
        }
      }

      if (request.method() === "GET" && lineageMatch) {
        const lineage = buildLineage(lineageMatch[1]);
        if (lineage) {
          await fulfillJson(route, lineage);
          return;
        }
      }

      if (request.method() === "POST" && publishMatch) {
        publishRequests += 1;
        const sessionVersionId = publishMatch[1];
        const currentSessionPack = sessionPacks.get(sessionVersionId);
        if (!currentSessionPack) {
          await fulfillJson(route, { error: { message: "Session pack not found" } }, 404);
          return;
        }

        const payload = JSON.parse(request.postData() ?? "{}");
        const publishedTargets = [
          buildPublishedTarget(sessionVersionId, "dashboard"),
          buildPublishedTarget(sessionVersionId, "h5"),
        ];
        const updatedSessionPack = {
          ...currentSessionPack,
          updatedAt: "2026-07-12T10:41:00.000Z",
          workspaceContextKeys: [payload.workspaceContextKey ?? "brand-lab"],
          linkedServiceIds: [payload.serviceId ?? "poster-batch"],
          publishedTargetCount: publishedTargets.length,
          publishedTargets,
        };
        sessionPacks.set(sessionVersionId, updatedSessionPack);

        await fulfillJson(route, {
          sessionPack: updatedSessionPack,
          publishedTargets,
          publishedAt: "2026-07-12T10:41:00.000Z",
          publishedByUserId: "usr_creator_admin",
          publishedSessionVersionId: sessionVersionId,
          replacedSessionVersionIds: ["sev_brand_poster_suite_previous"],
        });
        return;
      }

      if (request.method() === "POST" && inheritMatch) {
        inheritRequests += 1;
        const sessionVersionId = inheritMatch[1];
        const currentSessionPack = sessionPacks.get(sessionVersionId);
        if (!currentSessionPack) {
          await fulfillJson(route, { error: { message: "Session pack not found" } }, 404);
          return;
        }

        const payload = JSON.parse(request.postData() ?? "{}");
        const nextSessionPack = {
          ...currentSessionPack,
          sessionId: payload.newSessionId ?? currentSessionPack.sessionId,
          sessionVersionId: payload.newSessionVersionId ?? inheritedDraftVersionId,
          displayName: {
            zh: "Brand Poster Session Draft",
            en: "Brand Poster Session Draft",
          },
          updatedAt: "2026-07-12T10:42:00.000Z",
          sourceReleaseIds: [],
          activeActivationIds: [],
          lineageParentVersionId: sessionVersionId,
          rollbackFromVersionId: null,
          inheritMode: payload.inheritMode ?? "draft",
        };
        sessionPacks.set(nextSessionPack.sessionVersionId, nextSessionPack);

        await fulfillJson(route, {
          sessionPack: nextSessionPack,
          archiveDownloadPath: `/downloads/${nextSessionPack.sessionVersionId}.session-pack.json.gz`,
          archiveFileName: `${nextSessionPack.sessionVersionId}.session-pack.json.gz`,
          archiveSizeBytes: 5120,
          inheritedAt: "2026-07-12T10:42:00.000Z",
          inheritedByUserId: "usr_creator_admin",
          inheritedFromSessionVersionId: sessionVersionId,
          inheritMode: payload.inheritMode ?? "draft",
          createdDraft: payload.inheritMode !== "consumer",
        });
        return;
      }

      if (request.method() === "POST" && rollbackMatch) {
        rollbackRequests += 1;
        const sessionVersionId = rollbackMatch[1];
        const currentSessionPack = sessionPacks.get(sessionVersionId);
        if (!currentSessionPack) {
          await fulfillJson(route, { error: { message: "Session pack not found" } }, 404);
          return;
        }

        const payload = JSON.parse(request.postData() ?? "{}");
        const rollbackSourceTargets =
          sessionPacks.get(payload.rollbackToSessionVersionId)?.publishedTargets ??
          currentSessionPack.publishedTargets;
        const updatedSessionPack = {
          ...currentSessionPack,
          updatedAt: "2026-07-12T10:43:00.000Z",
          rollbackFromVersionId: sessionVersionId,
          publishedTargetCount: rollbackSourceTargets.length,
          publishedTargets: rollbackSourceTargets,
        };
        sessionPacks.set(sessionVersionId, updatedSessionPack);

        await fulfillJson(route, {
          sessionPack: updatedSessionPack,
          publishedTargets: rollbackSourceTargets,
          rolledBackAt: "2026-07-12T10:43:00.000Z",
          rolledBackByUserId: "usr_creator_admin",
          rolledBackFromSessionVersionId: sessionVersionId,
          rolledBackToSessionVersionId: payload.rollbackToSessionVersionId,
          replacedSessionVersionIds: [sessionVersionId],
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

    await page.goto("/dashboard/creator/packages/brand-poster-suite");

    await expect(page.getByTestId("dashboard-creator-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-session-pack-identity")).toContainText(
      baseSessionVersionId
    );
    await expect(page.getByTestId("dashboard-session-published-target-count")).toContainText("1");

    await page.getByTestId("dashboard-session-publish-submit").click();
    await expect(page.getByTestId("dashboard-session-published-target-count")).toContainText("2");
    await expect(page.getByTestId("dashboard-session-operation-notice")).toContainText(
      "Published to 2 launch template targets"
    );

    await page
      .getByTestId("dashboard-session-inherit-version-input")
      .fill(inheritedDraftVersionId);
    await page.getByTestId("dashboard-session-inherit-submit").click();

    await expect(page.getByTestId("dashboard-session-pack-identity")).toContainText(
      inheritedDraftVersionId
    );
    await expect(page.getByTestId("dashboard-session-rollback-target-input")).toHaveValue(
      baseSessionVersionId
    );

    await page.getByTestId("dashboard-session-rollback-submit").click();
    await expect(page.getByTestId("dashboard-session-operation-notice")).toContainText(
      `Rolled back to ${baseSessionVersionId}`
    );

    expect(publishRequests).toBe(1);
    expect(inheritRequests).toBe(1);
    expect(rollbackRequests).toBe(1);
  });
});
