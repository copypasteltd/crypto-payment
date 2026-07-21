import type { CatalogState } from "./storage-schema.js";

function l(zh: string, en: string) {
  return { zh, en } as const;
}

const contexts: CatalogState["contexts"] = [
  {
    contextKey: "harbor-finance",
    runtimeWorkspaceId: "wsp_harbor_finance",
    displayName: l("华港财务组", "Harbor Finance Team"),
    type: "enterprise",
    meta: l("财务成员 / 已连接 4 项能力", "Finance members / 4 mounted capabilities"),
    root: "/workspace/tax-q2/",
    allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
  },
  {
    contextKey: "personal",
    runtimeWorkspaceId: "wsp_personal",
    displayName: l("个人空间", "Personal Workspace"),
    type: "personal",
    meta: l("个人项目 / 已连接 2 项能力", "Personal projects / 2 mounted capabilities"),
    root: "/workspace/personal/",
    allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
  },
  {
    contextKey: "brand-lab",
    runtimeWorkspaceId: "wsp_brand_content",
    displayName: l("品牌内容组", "Brand Content Team"),
    type: "enterprise",
    meta: l("内容编辑 / 已连接 3 项能力", "Content editors / 3 mounted capabilities"),
    root: "/workspace/poster-batch-17/",
    allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
  },
];

const workshops: CatalogState["workshops"] = [
  {
    workshopId: "enterprise-tax",
    scope: "enterprise",
    status: "active",
    visibility: "marketplace",
    ownerWorkspaceId: null,
    displayName: l("企业财税工坊", "Enterprise Tax Workshop"),
    ownerLabel: l("华港财务组", "Harbor Finance Team"),
    badge: l("企业线", "Enterprise"),
    audience: l(
      "适合财务团队、代账团队、企业运营人员。",
      "Built for finance teams, tax operators, and business admins."
    ),
    summary: l(
      "实例化后系统会先引导 Codex 向用户确认所需资料，再继续执行受控浏览器报税流程。",
      "After instantiation the system first asks Codex to collect required inputs, then continues into the controlled browser filing flow."
    ),
    nextStepSummary: l(
      "常见后续：进入实例对话、审批提交、下载回执。",
      "Typical next steps: enter the run conversation, approve submit, and download receipts."
    ),
    coverAssetUrl: "/assets/workshop-tax.svg",
    tagList: ["/workspace/tax-q2/", "Chrome", "OTP", "approval"],
    defaultServiceId: "tax-filing",
    visibleInContexts: ["harbor-finance"],
  },
  {
    workshopId: "creator-drama",
    scope: "content",
    status: "active",
    visibility: "marketplace",
    ownerWorkspaceId: null,
    displayName: l("短剧生产工坊", "Drama Production Workshop"),
    ownerLabel: l("品牌内容组", "Brand Content Team"),
    badge: l("内容线", "Content"),
    audience: l(
      "适合导演、编导、短剧工作室与内容运营。",
      "Built for directors, writers, studios, and content operators."
    ),
    summary: l(
      "围绕脚本、分镜、素材与审稿循环，以完整对话形态驱动创作流程。",
      "Drives script, storyboard, asset, and review loops through a full conversational production flow."
    ),
    nextStepSummary: l(
      "常见后续：补充导演意见、回收素材、导出分镜包。",
      "Typical next steps: collect director notes, gather assets, and export storyboard bundles."
    ),
    coverAssetUrl: "/assets/workshop-drama.svg",
    tagList: ["/workspace/drama-ep08/", "Seedance", "review", "assets"],
    defaultServiceId: "drama-storyboard",
    visibleInContexts: ["personal", "brand-lab"],
  },
  {
    workshopId: "brand-poster-suite",
    scope: "creative",
    status: "active",
    visibility: "marketplace",
    ownerWorkspaceId: null,
    displayName: l("品牌内容工坊", "Brand Content Workshop"),
    ownerLabel: l("品牌内容组", "Brand Content Team"),
    badge: l("创意线", "Creative"),
    audience: l(
      "适合品牌团队、内容策划与个人创作者。",
      "Built for brand teams, campaign planners, and independent creators."
    ),
    summary: l(
      "支持批量出图、版本筛选、结果回流和 Creator 侧的私有图像能力挂载。",
      "Supports batch image generation, version review, result callbacks, and creator-side private image capability mounts."
    ),
    nextStepSummary: l(
      "常见后续：批量选图、打包下载、回到 Creator 更新策略。",
      "Typical next steps: select variants, download bundles, and return to Creator to adjust policy."
    ),
    coverAssetUrl: "/assets/workshop-image.svg",
    tagList: ["/workspace/poster-batch-17/", "image key", "bundle", "callback"],
    defaultServiceId: "poster-batch",
    visibleInContexts: ["personal", "brand-lab"],
  },
];

const services: CatalogState["services"] = [
  {
    serviceId: "tax-filing",
    workshopId: "enterprise-tax",
    status: "active",
    ownerWorkspaceId: null,
    displayName: l("香港有限公司季度报税", "Hong Kong Quarterly Filing"),
    summary: l(
      "启动后先由系统插入询问信息消息，再由 Codex 收集报税主体、期间、材料和审批要求，随后接管浏览器完成申报。",
      "After launch, the system inserts the information-collection message and Codex gathers the filing entity, period, materials, and approval rules before taking over the browser."
    ),
    authRequirementText: l(
      "企业邮箱 OTP / 财务文件只读挂载 / 最终提交审批",
      "Enterprise OTP / readonly finance files / final-submit approval"
    ),
    estimatedDuration: "04-08 min",
    targetPathHint: "/workspace/tax-q2/",
    outputContractSummary: l(
      "回执、执行总结、截图与审计日志会回写到当前任务路径。",
      "Receipts, execution summaries, screenshots, and audit logs are written back into the task path."
    ),
    launchMode: "instant-conversation",
    requiredBindings: {
      firstPartyMcpIds: ["mcp.browser.playwright"],
      externalConnectorRefs: ["workspace:notion-sse"],
      credentialIds: ["cred_browser_storage_state", "cred_tax_notice_folder"],
    },
    linkedInstanceHint: "tax-q2",
    visibleInContexts: ["harbor-finance"],
  },
  {
    serviceId: "drama-storyboard",
    workshopId: "creator-drama",
    status: "active",
    ownerWorkspaceId: null,
    displayName: l("短剧分镜生成与审稿", "Drama Storyboard Generation"),
    summary: l(
      "实例化后保持完整对话模式，围绕剧情目标、风格参考、导演意见和素材回流持续推进分镜修订。",
      "The run stays in a full conversation mode and continues through plot goals, style references, director notes, and asset callbacks for storyboard revisions."
    ),
    authRequirementText: l(
      "Seedance API / 外部素材引用 / 审稿回流",
      "Seedance API / external asset refs / review callbacks"
    ),
    estimatedDuration: "08-15 min",
    targetPathHint: "/workspace/drama-ep08/",
    outputContractSummary: l(
      "分镜草案、镜头表和后续审稿回流结果会持续写回实例目录。",
      "Storyboard drafts, shot lists, and review callbacks keep writing back into the instance directory."
    ),
    launchMode: "instant-conversation",
    requiredBindings: {
      firstPartyMcpIds: ["mcp.image.gpt-image-2"],
      externalConnectorRefs: ["workspace:seedance-api", "third-party:figma-mcp"],
      credentialIds: ["cred_openai_image_api_key", "cred_seedance_api_key", "cred_figma_pat"],
    },
    linkedInstanceHint: "drama-ep08",
    visibleInContexts: ["personal", "brand-lab"],
  },
  {
    serviceId: "poster-batch",
    workshopId: "brand-poster-suite",
    status: "active",
    ownerWorkspaceId: null,
    displayName: l("品牌海报批量生成", "Brand Poster Batch"),
    summary: l(
      "围绕品牌约束批量生成海报、KV 和变体图，并将筛选结果同步回写到输出目录与归档目录。",
      "Generates posters, key visuals, and variants in bulk around brand constraints, then writes selection results back to output and archive paths."
    ),
    authRequirementText: l(
      "私有图像能力挂载 / 只读密钥 / 结果包回写",
      "Private image capability mount / readonly key / bundle callback"
    ),
    estimatedDuration: "06-12 min",
    targetPathHint: "/workspace/poster-batch-17/",
    outputContractSummary: l(
      "精选图、候选图和提示词归档会写回 output 与 archive 目录。",
      "Final picks, candidate assets, and prompt archives are written back into output and archive paths."
    ),
    launchMode: "instant-conversation",
    requiredBindings: {
      firstPartyMcpIds: ["mcp.image.gpt-image-2"],
      externalConnectorRefs: ["third-party:asset-library"],
      credentialIds: ["cred_openai_image_api_key", "cred_asset_library_api_key"],
    },
    linkedInstanceHint: "poster-batch-17",
    visibleInContexts: ["personal", "brand-lab"],
  },
];

const launchTemplates: CatalogState["launchTemplates"] = [
  ...[
    { serviceId: "tax-filing", workspaceContextKey: "harbor-finance", taskVersionId: "tsv_tax_filing", sessionVersionId: "sev_chrome_tax_runner", title: l("香港有限公司季度报税", "Hong Kong Quarterly Filing"), targetRoot: "/workspace/tax-q2/runs/tax-filing", bindings: services[0].requiredBindings },
    { serviceId: "drama-storyboard", workspaceContextKey: "personal", taskVersionId: "tsv_drama_storyboard", sessionVersionId: "sev_creator_drama_suite", title: l("个人短剧分镜生成与审校", "Personal Drama Storyboard"), targetRoot: "/workspace/personal/runs/drama-storyboard", bindings: services[1].requiredBindings },
    { serviceId: "drama-storyboard", workspaceContextKey: "brand-lab", taskVersionId: "tsv_drama_storyboard", sessionVersionId: "sev_creator_drama_suite", title: l("短剧分镜生成与审校", "Drama Storyboard Generation"), targetRoot: "/workspace/poster-batch-17/runs/drama-storyboard", bindings: services[1].requiredBindings },
    { serviceId: "poster-batch", workspaceContextKey: "personal", taskVersionId: "tsv_poster_batch", sessionVersionId: "sev_brand_poster_suite", title: l("个人品牌海报批量生成", "Personal Poster Batch"), targetRoot: "/workspace/personal/runs/poster-batch", bindings: services[2].requiredBindings },
    { serviceId: "poster-batch", workspaceContextKey: "brand-lab", taskVersionId: "tsv_poster_batch", sessionVersionId: "sev_brand_poster_suite", title: l("品牌海报批量生成", "Brand Poster Batch"), targetRoot: "/workspace/poster-batch-17/runs/poster-batch", bindings: services[2].requiredBindings },
  ].flatMap((item) =>
    (["dashboard", "h5", "mini-program"] as const).map((entrySurface) => ({
      templateKey: `${item.serviceId}:${item.workspaceContextKey}:${entrySurface}`,
      serviceId: item.serviceId,
      workspaceContextKey: item.workspaceContextKey,
      entrySurface,
      taskVersionId: item.taskVersionId,
      sessionVersionId: item.sessionVersionId,
      title: item.title,
      targetRoot: item.targetRoot,
      bindings: item.bindings,
    }))
  ),
];

export const seedCatalogState: CatalogState = {
  contexts,
  workshops,
  services,
  launchTemplates,
};
