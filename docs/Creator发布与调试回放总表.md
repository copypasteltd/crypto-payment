# 灵办词元 Creator发布与调试回放总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Creator发布与调试回放总表 |
| 适用范围 | `app/dashboard`、后续正式 `packages/session-pack` / `packages/replay` / `app/api` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 Dashboard Creator 路由、页签、包元数据、治理元数据和调试回放界面语义为准 |
| 直接证据 | `app/dashboard/src/lib/routes.ts`、`app/dashboard/src/pages/creator/CreatorPage.tsx`、`app/dashboard/src/data/dashboardData.ts` |
| 输出目标 | 说明 Creator 工作台当前已表达的发布、审核、回放结构，以及正式系统需要如何承接 |

## 2. Creator 路由与页面结构总表

| 路由 | 当前页面职责 | 当前数据来源 | 当前状态 |
|---|---|---|---|
| `/dashboard/creator` | Creator 总览、包列表、过滤、工作区绑定概览 | 本地 `creatorPackages`、`dashboardWorkspaces`、组件内元数据 | 已实现 |
| `/dashboard/creator/packages/:packageId` | 包详情页，展示 Session、Runtime、Connectors、Release 四个页签 | 本地 `creatorPackages` + `packageMeta` + `creatorOperationMeta` | 已实现 |
| `/dashboard/creator/packages/:packageId/debug` | 调试回放页，表达真实 session 回放语义 | 本地 `creatorOperationMeta` + 组件内文案 | 已实现 |
| `/dashboard/creator/governance/:section` | 平台治理视图，分 `credentials / members / policy / audit / cost` | 组件内 `governanceMeta` | 已实现 |

## 3. Creator 页签结构总表

| 页签 | 当前语义 | 应沉淀的正式对象 | 当前状态 |
|---|---|---|---|
| `session` | 展示 session 包内容、边界、可复用资产 | `session_package`、`session_slot_schema`、`package_manifest` | 仅前端展示 |
| `runtime` | 展示标准运行镜像、运行目录、容器策略 | `runtime_image`、`launch_policy`、`mount_policy` | 仅前端展示 |
| `connectors` | 展示 MCP/凭证/外部能力接入说明 | `connector_binding`、`credential_binding`、`mcp_policy` | 仅前端展示 |
| `release` | 展示发布通道、审核门、交付包、灰度信息 | `package_release`、`release_gate`、`delivery_bundle` | 仅前端展示 |

## 4. 当前 Creator 包状态总表

| Package ID | 当前状态 | 当前发布通道 | 当前绑定工坊 | 当前关键信息 | 当前判断 |
|---|---|---|---|---|---|
| `chrome-tax-runner` | `已审计 / Audited` | `企业财税工坊 / 私有发布` | 企业财税工坊 | 企业复制、OTP 轮换、审批模板已稳定 | 最接近正式治理闭环 |
| `creator-drama-suite` | `待发布 / Pending release` | `Creator 工坊 / 灰度` | 短剧生产工坊 | 需补脱敏、预算策略、外部素材引用收口 | 当前发布门槛未通过 |
| `brand-poster-suite` | `可发布 / Ready` | `品牌内容工坊 / 正式发布` | 品牌内容工坊 | 已接近正式发布，需加强图像额度和批量轮次治理 | 可进入正式发布准备 |

## 5. 当前 Creator 包元数据总表

| Package ID | 版本线 | 关键依赖 | 当前作用 |
|---|---|---|---|
| `chrome-tax-runner` | `sev_chrome_tax_runner@2026.07.1`、`tsv_tax_filing@2026.07.3`、`img: lingban-codex-runtime:2026.07` | 浏览器自动化、OTP 凭证、审批节点 | 企业报税类受控运行包 |
| `creator-drama-suite` | `sev_creator_drama_suite@2026.07.2`、`tsv_drama_storyboard@2026.07.4`、`img: lingban-codex-runtime:2026.07` | 长对话上下文、版本回放、外部素材引用 | 短剧生产与审稿包 |
| `brand-poster-suite` | `sev_brand_poster_suite@2026.07.5`、`tsv_poster_batch@2026.07.6`、`img: lingban-codex-runtime:2026.07` | 图像额度治理、选择回流、结果归档 | 品牌图像与海报生产包 |

## 6. 当前发布动作与检查点矩阵

| Package ID | 当前 rollout/checkpoint 语义 | 当前风险点 | 正式系统承接对象 |
|---|---|---|---|
| `chrome-tax-runner` | 企业私有发布、真实回放校验、企业实例下载与审计 JSON 必须保留 | 凭证到期前必须完成真实回放；审批模板不能漂移 | `package_release`、`replay_manifest`、`audit_export` |
| `creator-drama-suite` | Creator 工坊灰度、预算策略补全、素材引用目录复核 | session 脱敏、预算阈值、外部素材 ref 仍未收口 | `release_gate`、`budget_policy`、`asset_reference_policy` |
| `brand-poster-suite` | 品牌团队正式发布、图像额度治理、批量轮次策略收紧 | 图像额度与批量生成节奏仍需治理 | `quota_policy`、`image_usage_ledger`、`batch_policy` |

## 7. 调试回放语义总表

| 回放维度 | 当前界面语义 | 正式系统需落地的对象 | 当前状态 |
|---|---|---|---|
| 原始消息顺序 | 回放需保留 message order | `replay_message_log` | 仅界面语义 |
| 审批节点 | 回放需保留 approval nodes | `replay_approval_trace` | 仅界面语义 |
| 路径写入差异 | 回放需核对 target path 写入与差异 | `path_diff_record` | 仅界面语义 |
| 工具调用摘要 | 回放需显示 tool calls summary | `tool_call_trace` | 仅界面语义 |
| 打包前后信息漂移 | 用回放定位 session 打包前后的信息偏移 | `package_drift_report` | 仅界面语义 |
| Debug 导出 | 导出审计 JSON、摘要、结果回执 | `replay_export_job` | 仅界面语义 |

## 8. Creator 工作台当前与正式系统的差距总表

| 模块 | 当前情况 | 正式系统要求 | 差距级别 |
|---|---|---|---|
| Package 列表 | 本地静态数组 | 真实 package 列表、版本、owner、workspace 绑定 | P0 |
| Release 通道 | 本地元数据 | 真实 release channel、灰度范围、审核门、审批人 | P0 |
| Debug Replay | 仅界面语义 | 可回放真实 session、事件、文件 diff、审批轨迹 | P0 |
| Governance 深链 | 仅界面语义 | 与运行策略、凭证策略、成员角色策略联动 | P0 |
| 版本依赖 | 组件内 `versionLine` 文案 | 可查询镜像、session、task 版本与兼容矩阵 | P1 |
| 依赖关系 | 组件内 `dependencies` 文案 | 可验证 connector、credential、runtime 依赖完整性 | P1 |

## 9. 正式系统建议的 Creator 后端对象总表

| 对象 | 最低字段集合 | 用途 |
|---|---|---|
| `package` | `package_id`、`workspace_id`、`title`、`owner`、`status`、`release_channel` | Creator 包主对象 |
| `package_version` | `version_id`、`package_id`、`session_version_id`、`task_version_id`、`runtime_image` | 管理可发布版本线 |
| `package_dependency` | `package_version_id`、`type`、`ref_id`、`scope` | 管理 MCP、凭证、镜像、外部能力依赖 |
| `release` | `release_id`、`package_version_id`、`target_workspace_id`、`channel`、`state` | 管理私有发布、灰度、正式发布 |
| `release_gate` | `release_id`、`gate_type`、`state`、`required_role` | 管理审核门 |
| `replay_session` | `replay_id`、`package_version_id`、`source_run_id`、`state` | 管理调试回放 |
| `replay_event` | `replay_id`、`sequence`、`event_type`、`payload` | 管理回放事件序列 |
| `desensitization_report` | `package_version_id`、`report_id`、`rule_hits`、`result` | 管理 session 脱敏检查 |

## 10. Creator 正式化开发顺序建议表

| 顺序 | 开发项 | 目标 |
|---|---|---|
| 1 | 建 `package / package_version / release` 正式模型与 API | 把 Creator 从纯前端静态页变成真实系统 |
| 2 | 建 `replay_session / replay_event` 存储与查询接口 | 让调试回放有真实数据源 |
| 3 | 建 `release_gate / desensitization_report` 审核门 | 把发布审核从文案变成执行约束 |
| 4 | 建 `credential / connector / quota` 与 Creator 绑定 | 让凭证、MCP、成本治理真正作用于包发布 |
| 5 | 把 Dashboard Creator 页改为全真实接口驱动 | 完成 Creator 工作台正式化 |

## 11. 当前已验证 Creator 发布/回放基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| Creator 页面结构 | 已实现列表、详情、debug、governance 四块 | `CreatorPage.tsx`、`routes.ts` |
| 发布语义 | 当前存在于 `release` 页签和 `creatorOperationMeta` | `CreatorPage.tsx` |
| 回放语义 | 当前存在于 `debug` 路由和页面文案 | `CreatorPage.tsx` |
| Governance 语义 | 当前存在于 `credentials / members / policy / audit / cost` 页面区块 | `CreatorPage.tsx` |
| 后端 Creator API | 已实现基础只读 | API 当前已有 `/v1/packages`、`/v1/packages/:packageId`、`/v1/packages/:packageId/releases`、`/v1/packages/:packageId/replays`；独立发布/回放写入域未补齐 |
| SDK Creator 客户端 | 已实现基础只读 | `packages/api-sdk/src/index.ts` 已提供 `createCreatorApiClient()` 的 list/get/releases/replays |

## 12. 当前不可宣称完成的 Creator 工作台能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 正式发布链 | 无 release 对象、无激活逻辑、无回滚逻辑 | 不可宣称 Creator 发布已落地 |
| 正式回放链 | 无 replay 对象、无 replay worker、无 diff 结果 | 不可宣称调试回放已落地 |
| 治理联动 | Governance 仅为页面语义 | 不可宣称治理策略已真正作用于 Creator 包 |
| 全真实接口驱动 | 当前完全依赖本地样例数据 | 不可宣称 Creator 工作台已正式化 |
