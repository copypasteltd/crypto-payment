import type { CreatorState } from "./storage-schema.js";

function l(zh: string, en: string) {
  return { zh, en } as const;
}

export const seedCreatorState: CreatorState = {
  packages: [
    {
      packageId: "chrome-tax-runner",
      workspaceIds: ["wsp_harbor_finance"],
      title: l("chrome-tax-runner.session", "chrome-tax-runner.session"),
      source: l("来源：华港财务组 / 实例：tax-q2", "Source: Harbor Finance Team / instance: tax-q2"),
      state: "audited",
      statusLabel: l("已审计", "Audited"),
      tone: "success",
      ownerLabel: l("华港财务组", "Harbor Finance Team"),
      updatedAt: "2026-07-07T09:54:00.000Z",
      releaseChannel: l("企业财税工坊 / 私有发布", "Enterprise tax workshop / private release"),
      workspaceContextKeys: ["harbor-finance"],
      linkedWorkshopIds: ["enterprise-tax"],
      linkedServiceIds: ["tax-filing"],
      session: {
        summary: l(
          "这份 package 保留了真实会话中的用户提问顺序、审批节点、路径结构和结果回流逻辑。",
          "This package preserves the real conversation order, approval nodes, path structure, and result callback logic from the original run."
        ),
        items: [
          l("完整对话流保留，不压缩成技能摘要。", "The full conversation flow is preserved instead of being collapsed into a skill summary."),
          l("审批节点与目标路径一并保存。", "Approval nodes are saved together with target paths."),
          l("脱敏后再进入发布通道。", "Desensitization happens before release."),
        ],
      },
      runtime: {
        summary: l(
          "标准镜像中包含 codex-cli、Node、Python、浏览器自动化与系统依赖。",
          "The standard image contains codex-cli, Node, Python, browser automation, and system dependencies."
        ),
        items: [
          l("基础镜像：ubuntu:24.04", "Base image: ubuntu:24.04"),
          l("核心运行层：codex-cli / node / python", "Core runtime: codex-cli / node / python"),
          l("浏览器层：playwright / browser bridge", "Browser layer: playwright / browser bridge"),
        ],
      },
      connectors: {
        summary: l(
          "能力注入优先采用第一方 MCP、第三方 connector ref 和只读 secret mount。",
          "Capability injection prioritizes first-party MCP, third-party connector refs, and readonly secret mounts."
        ),
        items: [
          l("第一方 MCP：实例启动即挂载。", "First-party MCP: mounted at boot."),
          l("第三方 MCP：只记录 connector ref。", "Third-party MCP: only the connector ref is stored."),
          l("图像 Key / OTP：会话级只读挂载。", "Image keys / OTP channels: session-level readonly mounts."),
        ],
      },
      release: {
        summary: l(
          "发布单元由 session 包、工作区模板、镜像依赖、MCP 策略和输出契约共同组成。",
          "The release unit is made of the session package, workspace template, image dependencies, MCP policy, and output contract."
        ),
        items: [
          l("企业财税工坊", "Enterprise tax workshop"),
          l("私有预览通道", "Private preview channel"),
          l("审计清单 A-01 ~ A-05 全部通过", "Audit checklist A-01 to A-05 passed"),
        ],
      },
      versionLine: [
        "sev_chrome_tax_runner@2026.07.1",
        "tsv_tax_filing@2026.07.3",
        "img: lingban-codex-runtime:2026.07",
      ],
      dependencies: [
        l("浏览器自动化 / OTP 凭证 / 审批节点", "Browser automation / OTP credentials / approval nodes"),
        l("受控目标路径写入：receipts / output / archive", "Controlled target-path writes: receipts / output / archive"),
      ],
      currentSessionVersionId: "sev_chrome_tax_runner",
      candidateSessionVersionId: null,
      currentTaskVersionId: "tsv_tax_filing",
    },
    {
      packageId: "creator-drama-suite",
      workspaceIds: ["wsp_personal", "wsp_brand_content"],
      title: l("creator-drama-suite.session", "creator-drama-suite.session"),
      source: l("来源：品牌内容组 / 实例：drama-ep08", "Source: Brand Content Team / instance: drama-ep08"),
      state: "pending_release",
      statusLabel: l("待发布", "Pending release"),
      tone: "warn",
      ownerLabel: l("内容导演组", "Content Director Group"),
      updatedAt: "2026-07-07T14:51:00.000Z",
      releaseChannel: l("Creator 工坊 / 灰度", "Creator workshop / staged rollout"),
      workspaceContextKeys: ["personal", "brand-lab"],
      linkedWorkshopIds: ["creator-drama"],
      linkedServiceIds: ["drama-storyboard"],
      session: {
        summary: l("适合保留分镜修订回路、导演意见回流和素材补录逻辑。", "Best suited to preserve storyboard revision loops, director feedback, and asset backfill logic."),
        items: [
          l("保留分镜与素材双线程对话。", "Preserves dual-thread conversation for storyboard and asset work."),
          l("待补一轮预算控制规则。", "Needs one more pass on budget control rules."),
        ],
      },
      runtime: {
        summary: l("以同一标准镜像扩展 Seedance 等内容能力。", "Extends the same standard image with content capabilities such as Seedance."),
        items: [l("增加外部内容能力挂载。", "Adds external content capability mounts.")],
      },
      connectors: {
        summary: l("以第三方 connector ref 为主。", "Primarily uses third-party connector refs."),
        items: [l("Seedance connector ref", "Seedance connector ref")],
      },
      release: {
        summary: l("优先进入 creator 工坊灰度。", "Prioritized for creator-studio limited rollout."),
        items: [l("目标通道：Creator 工坊内测", "Target channel: creator studio preview")],
      },
      versionLine: [
        "sev_creator_drama_suite@2026.07.2",
        "tsv_drama_storyboard@2026.07.4",
        "img: lingban-codex-runtime:2026.07",
      ],
      dependencies: [
        l("Seedance / 导演审稿回流 / 外部素材引用", "Seedance / director review callbacks / external asset references"),
        l("长对话上下文与版本回放", "Long-form conversation context and replay"),
      ],
      currentSessionVersionId: null,
      candidateSessionVersionId: "sev_creator_drama_suite",
      currentTaskVersionId: "tsv_drama_storyboard",
    },
    {
      packageId: "brand-poster-suite",
      workspaceIds: ["wsp_personal", "wsp_brand_content"],
      title: l("brand-poster-suite.session", "brand-poster-suite.session"),
      source: l("来源：品牌内容组 / 实例：poster-batch-17", "Source: Brand Content Team / instance: poster-batch-17"),
      state: "ready",
      statusLabel: l("可发布", "Ready"),
      tone: "active",
      ownerLabel: l("品牌内容组", "Brand Content Team"),
      updatedAt: "2026-07-07T19:12:00.000Z",
      releaseChannel: l("品牌内容工坊 / 正式发布", "Brand content workshop / production"),
      workspaceContextKeys: ["personal", "brand-lab"],
      linkedWorkshopIds: ["brand-poster-suite"],
      linkedServiceIds: ["poster-batch"],
      session: {
        summary: l("适合保留批量出图、选图回流和结果交付逻辑。", "Best suited to preserve batch generation, selection callbacks, and delivery logic."),
        items: [l("批量出图与选图逻辑稳定。", "Batch generation and selection logic are stable.")],
      },
      runtime: {
        summary: l("主要扩展图像生成能力挂载。", "Mainly extends image generation capability mounts."),
        items: [l("增加图像服务只读密钥挂载。", "Adds readonly image-service key mounts.")],
      },
      connectors: {
        summary: l("私有图像能力按用户或工作区绑定。", "Private image capabilities are bound per user or workspace."),
        items: [l("connector://imagegen/private-brand-key", "connector://imagegen/private-brand-key")],
      },
      release: {
        summary: l("适合面向品牌团队正式发布。", "Suitable for release to brand teams."),
        items: [l("目标通道：品牌内容工坊", "Target channel: brand content workshop")],
      },
      versionLine: [
        "sev_brand_poster_suite@2026.07.5",
        "tsv_poster_batch@2026.07.6",
        "img: lingban-codex-runtime:2026.07",
      ],
      dependencies: [
        l("GPT Image 2 / 资产库引用 / 结果包回写", "GPT Image 2 / asset-library refs / bundle callback writes"),
        l("私有图像 key 只读挂载", "Readonly private image-key mounts"),
      ],
      currentSessionVersionId: "sev_brand_poster_suite",
      candidateSessionVersionId: null,
      currentTaskVersionId: "tsv_poster_batch",
    },
  ],
  releases: [
    {
      releaseId: "rel_chrome_tax_runner_private",
      packageId: "chrome-tax-runner",
      targetWorkspaceContextKey: "harbor-finance",
      state: "private",
      channelLabel: l("企业财税工坊 / 私有发布", "Enterprise tax workshop / private release"),
      gateSummary: [
        l("审计清单 A-01 ~ A-05 全部通过", "Audit checklist A-01 to A-05 passed"),
        l("OTP 轮换计划 7 天内复核", "OTP rotation plan to be rechecked within 7 days"),
      ],
      updatedAt: "2026-07-07T09:54:00.000Z",
    },
    {
      releaseId: "rel_creator_drama_stage",
      packageId: "creator-drama-suite",
      targetWorkspaceContextKey: "brand-lab",
      state: "staged",
      channelLabel: l("Creator 工坊 / 灰度", "Creator workshop / staged rollout"),
      gateSummary: [
        l("剩余 1 项脱敏检查", "One desensitization check remains"),
        l("预算控制规则待补齐", "Budget control rules still need completion"),
      ],
      updatedAt: "2026-07-07T14:51:00.000Z",
    },
    {
      releaseId: "rel_brand_poster_prod",
      packageId: "brand-poster-suite",
      targetWorkspaceContextKey: "brand-lab",
      state: "production",
      channelLabel: l("品牌内容工坊 / 正式发布", "Brand content workshop / production"),
      gateSummary: [
        l("图像额度策略已接入", "Image quota policy is in place"),
        l("批量轮次策略待持续观测", "Batch-round policy remains under observation"),
      ],
      updatedAt: "2026-07-07T19:12:00.000Z",
    },
  ],
  replays: [
    {
      replayId: "rpl_tax_q2",
      packageId: "chrome-tax-runner",
      sourceRunId: "run_tax_q2",
      state: "ready",
      summary: l("可回放审批节点、浏览器写入路径与回执输出。", "Can replay approval nodes, browser path writes, and receipt outputs."),
      updatedAt: "2026-07-07T10:03:00.000Z",
    },
    {
      replayId: "rpl_drama_ep08",
      packageId: "creator-drama-suite",
      sourceRunId: "run_drama_ep08",
      state: "ready",
      summary: l("可回放导演意见回流与分镜修订差异。", "Can replay director-feedback callbacks and storyboard diff loops."),
      updatedAt: "2026-07-07T15:04:00.000Z",
    },
    {
      replayId: "rpl_poster_batch_17",
      packageId: "brand-poster-suite",
      sourceRunId: "run_poster_batch_17",
      state: "ready",
      summary: l("可回放批量出图、筛选结果与归档写入差异。", "Can replay batch generation, selection results, and archive write diffs."),
      updatedAt: "2026-07-07T19:24:00.000Z",
    },
  ],
  releaseGates: [],
  activations: [],
  auditExports: [],
};
