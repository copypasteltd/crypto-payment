# 灵办词元 Creator正式数据域、发布对象与治理切流执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Creator正式数据域、发布对象与治理切流执行总表 |
| 适用范围 | `app/dashboard`、`app/api`、未来 `packages/db`、`release/replay/governance` 正式域 |
| 统计日期 | 2026-07-07 |
| 当前事实 | `CreatorPage` 已完整表达 package、runtime、connectors、release、governance、debug replay 的产品语义，但数据全部来自本地 `dashboardData` 与页面内元数据 |
| 直接证据 | `app/dashboard/src/pages/creator/CreatorPage.tsx`、`app/dashboard/src/data/dashboardData.ts`、`docs/Creator发布与调试回放总表.md`、`docs/Creator包版本与发布对象总表.md`、`docs/Creator包依赖与运行配置明细总表.md`、`docs/Release回放与审核状态流总表.md` |
| 输出目标 | 统一 Creator 正式数据域的对象边界、页面接线方式、发布与治理链路、切流顺序与完成判定 |

## 2. Creator 当前页面数据结构总表

| 区块 | 当前数据来源 | 当前承载语义 | 当前状态 |
|---|---|---|---|
| Creator 包列表 | `creatorPackages` | 包清单、状态、频道、空间可见性 | 静态 |
| 包详情四页签 | `creatorPackages` + `packageMeta` | Session、Runtime、Connectors、Release | 静态 |
| 调试操作区 | `creatorOperationMeta` | publish/stage/rollback/disable/debug 动作与提示 | 静态 |
| 治理总览与分区 | `governanceMeta` | credentials/members/policy/audit/cost | 静态 |
| 关联工坊 / 服务 | `workshops` + `dashboardServices` + `dashboardWorkspaces` | 包与工作区、工坊、服务的绑定关系 | 静态 |
| 发布与回放指标 | 页面内 metrics/rows | 发布门、回放保留、审计留痕 | 静态 |

## 3. Creator 页面到正式对象映射表

| 页面元素 | 当前语义 | 正式对象 | 说明 |
|---|---|---|---|
| Package 卡片 | 某个可发布工作流资产 | `package` | Creator 工作台主对象 |
| Version line | session/task/runtime 的组合 | `package_version` | 绑定发布所需版本线 |
| Bound workshops / services | 可被哪些工坊与服务消费 | `package_binding` | 控制分发范围 |
| Runtime 页签 | 镜像、挂载、容器策略 | `runtime_profile` | 运行策略快照 |
| Connectors 页签 | MCP、凭证、网络策略 | `package_dependency` + `connector_binding` | 能力接入依赖 |
| Release 页签 | 发布通道、状态、审计门 | `release` + `release_gate` | 正式发布链 |
| Debug 页 | 回放、差异、导出 | `replay_session` + `replay_event` + `replay_diff` | 调试与审计链 |
| Governance 分区 | 凭证、成员、策略、审计、成本 | `governance_policy`、`credential_binding`、`audit_export_job`、`quota_policy` | 平台治理域 |

## 4. Creator 正式核心对象目录表

| 对象 | 权威存储 | 主键建议 | 当前是否落地 | 说明 |
|---|---|---|---|---|
| `package` | PostgreSQL | `pkg_*` | 未落地 | Creator 包主对象 |
| `package_version` | PostgreSQL | `pkv_*` | 未落地 | 包版本线 |
| `package_dependency` | PostgreSQL | `pkd_*` | 未落地 | 依赖声明 |
| `package_binding` | PostgreSQL | `pkb_*` | 未落地 | 工坊、服务、工作区可见性绑定 |
| `release` | PostgreSQL | `rel_*` | 未落地 | 发布单 |
| `release_gate` | PostgreSQL | `rgt_*` | 未落地 | 发布门、审核门、灰度门 |
| `release_activation` | PostgreSQL | `rac_*` | 未落地 | 生效中的 workspace/service 激活记录 |
| `replay_session` | PostgreSQL | `rpl_*` | 未落地 | 一次调试回放会话 |
| `replay_event` | PostgreSQL | `rpe_*` | 未落地 | 回放事件流水 |
| `replay_diff` | PostgreSQL | `rpd_*` | 未落地 | 回放差异结果 |
| `desensitization_report` | PostgreSQL + object storage | `dsr_*` | 未落地 | 脱敏检查报告 |
| `audit_export_job` | PostgreSQL + object storage | `aex_*` | 未落地 | 审计导出任务 |
| `governance_policy` | PostgreSQL | `gpl_*` | 未落地 | 治理策略实体 |

## 5. `package` 与 `package_version` 字段最小集合表

| 对象 | 最小字段集合 | 用途 |
|---|---|---|
| `package` | `package_id`、`workspace_id`、`title`、`summary`、`owner_user_id`、`status`、`default_channel`、`created_at`、`updated_at` | 列表、可见性、Owner、状态 |
| `package_version` | `package_version_id`、`package_id`、`session_version_id`、`task_version_id`、`runtime_profile_id`、`version`、`status`、`published_at` | 可发布版本线 |
| `package_dependency` | `package_version_id`、`dependency_type`、`ref_id`、`scope`、`required`、`notes_json` | MCP、凭证、外部资源依赖 |
| `package_binding` | `package_version_id`、`workspace_id`、`workshop_id`、`service_id`、`visibility`、`priority` | 决定哪些入口可消费该包 |

## 6. Runtime / Connectors 正式对象拆分表

| Creator 页签内容 | 当前前端表达 | 建议后端对象 | 原因 |
|---|---|---|---|
| 运行镜像 | `versionLine` 中 `img:*` 文案 | `runtime_profile.runtime_image` | 镜像应单独治理 |
| 目录挂载 | 页面说明文案 | `runtime_profile.mount_policy_json` | 挂载是运行约束，不应散落在文案 |
| 容器生命周期 | 页面说明文案 | `runtime_profile.lifecycle_policy_json` | 关系到销毁、复用、审计 |
| 第一方 MCP | 依赖说明文案 | `connector_binding` | 需做版本、可见性、审批控制 |
| 第三方 MCP | 依赖说明文案 | `connector_binding` + `network_policy_ref` | 需做风险治理 |
| 凭证挂载 | 依赖说明文案 | `credential_binding` | 需记录 mount mode、scope、rotation |
| 审批要求 | 页面提示文案 | `approval_policy_attachment` | 需转为机器可执行策略 |

## 7. Release 正式对象拆分表

| 语义 | 建议对象 | 最小字段 | 说明 |
|---|---|---|---|
| 发布单 | `release` | `release_id/package_version_id/channel/state/requested_by/created_at` | 一次发布申请 |
| 发布门 | `release_gate` | `gate_id/release_id/gate_type/state/required_role/decided_by/decided_at` | 脱敏、回放、审批、预算等门 |
| 灰度激活 | `release_activation` | `activation_id/release_id/workspace_id/service_id/weight/status` | 控制灰度与正式切换 |
| 回滚 | `release_rollback` | `rollback_id/release_id/source_activation_id/reason/state` | 记录回滚动作 |
| 交付包 | `delivery_bundle` | `bundle_id/release_id/object_key/checksum/generated_at` | 给工坊消费的交付包 |

## 8. Replay 与差异对象拆分表

| 回放语义 | 建议对象 | 最小字段 | 说明 |
|---|---|---|---|
| 回放主记录 | `replay_session` | `replay_id/package_version_id/source_run_id/state/started_at/finished_at` | 一次回放任务 |
| 回放事件序列 | `replay_event` | `replay_id/sequence/event_type/payload_json/occurred_at` | 保留完整顺序 |
| 文件差异 | `replay_diff` | `replay_id/diff_type/path/baseline_hash/current_hash/result` | 对比目标路径输出 |
| 工具调用差异 | `tool_call_trace` | `replay_id/sequence/tool_name/args_digest/result_digest` | 回放对比工具侧变化 |
| 审批差异 | `replay_approval_trace` | `replay_id/approval_id/expected_state/actual_state/result` | 确认审批链不漂移 |
| 漂移报告 | `package_drift_report` | `replay_id/drift_level/findings_json/summary` | 判断 session 打包前后偏移 |

## 9. 治理域对象拆分表

| Governance 分区 | 建议对象 | 最小字段 | 说明 |
|---|---|---|---|
| Credentials | `credential_binding` | `binding_id/package_version_id/credential_id/mount_mode/scope/rotation_due_at` | 表达凭证绑定与轮换 |
| Members | `package_access_policy` | `policy_id/package_id/workspace_id/role/capabilities_json` | 控制谁可发布、回放、治理 |
| Policy | `governance_policy` | `policy_id/policy_type/scope_ref_id/policy_json/state` | 容器、路径、审批、出网策略 |
| Audit | `audit_export_job` | `job_id/source_type/source_ref_id/object_key/state` | 导出发布、回放、实例审计 |
| Cost | `package_quota_policy` | `policy_id/package_id/metric/threshold/action` | 包级额度与超限动作 |

## 10. Creator 页面与 API 接线矩阵表

| 页面区域 | 建议接口 | 返回对象 | 前端行为 |
|---|---|---|---|
| 包列表 | `GET /v1/packages` | `package[]` | 列表、搜索、筛选 |
| 包详情 | `GET /v1/packages/:id` | `package + bindings summary` | 顶部摘要、关联工坊、Owner |
| 版本页 | `GET /v1/packages/:id/versions/:versionId` | `package_version` | Session/Runtime/Connector/Release 分页数据源 |
| 依赖页 | `GET /v1/packages/:id/dependencies` | `package_dependency[]` | 展示依赖、风险、缺失 |
| 发布页 | `GET /v1/releases?packageId=` | `release[]` | 查看通道、状态、门禁 |
| 发起发布 | `POST /v1/releases` | `release` | 创建发布单 |
| Gate 决策 | `POST /v1/releases/:id/gates/:gateId/decide` | `release_gate` | 审批、拒绝、回退 |
| 回放页 | `GET /v1/replays?packageVersionId=` | `replay_session[]` | 列表、最近回放、状态 |
| 回放详情 | `GET /v1/replays/:id` | `replay + events + diffs` | 差异明细、导出 |
| 治理页 | `GET /v1/packages/:id/governance/:section` | 各 section 结构化对象 | 替代 `governanceMeta` |

## 11. Creator 切流顺序执行表

| 阶段 | 目标 | 后端动作 | 前端动作 | 完成判定 |
|---|---|---|---|---|
| Phase 1 | 包列表真数据化 | 建 `package/package_version/package_binding` 查询 API | Creator 列表改读真实接口 | `creatorPackages` 不再作为列表权威源 |
| Phase 2 | 详情四页签真数据化 | 建 package detail、dependency、runtime profile API | `packageMeta` 退场 | 详情页不再读取本地 meta |
| Phase 3 | 发布链真数据化 | 建 `release/release_gate/release_activation` API | release 页改为真实状态与动作 | 发布/灰度/回滚不再依赖本地文案 |
| Phase 4 | 回放真数据化 | 建 `replay_session/replay_event/replay_diff` API | debug 页改为真实回放结果 | 可查看真实 run 来源与差异 |
| Phase 5 | 治理真数据化 | 建 governance section API | `governanceMeta` 退场 | 凭证/成员/策略/审计/成本全真实 |
| Phase 6 | 发布门强执行 | API 拒绝未过 gate 的激活 | 前端仅消费 gate 结果 | 前端不再自行判断可发布状态 |

## 12. 发布门执行矩阵表

| Gate 类型 | 触发时机 | 数据来源 | 未通过时动作 | 优先级 |
|---|---|---|---|---|
| 脱敏报告 gate | 发起 release 前 | `desensitization_report` | 禁止进入激活 | P0 |
| 回放通过 gate | 灰度或正式发布前 | `replay_session/replay_diff` | 禁止正式发布 | P0 |
| 凭证可用性 gate | 激活前 | `credential_binding` + broker | 禁止激活 | P0 |
| 依赖完整性 gate | 激活前 | `package_dependency` | 禁止交付 | P0 |
| 配额预算 gate | 灰度扩容前 | `package_quota_policy` | 回流到审批 | P1 |
| 人工审核 gate | 企业正式发布前 | `release_gate` | 等待审核 | P1 |

## 13. Creator 与工坊目录联动表

| 联动点 | 当前状态 | 正式要求 |
|---|---|---|
| 包绑定工坊 | `packageMeta.workshopIds` 本地数组 + `package.linkedWorkshopIds` 真接口 | 由 `package_binding` 或等价正式对象决定 |
| 包绑定服务 | `packageMeta.serviceIds` 本地数组 + `package.linkedServiceIds` 真接口 | 由 `package_binding` 或等价正式对象决定 |
| 工作区可见包 | `dashboardWorkspaces.packageIds` 本地数组 + `workspaceContextKey` 过滤真接口 | 由 `release_activation` + access policy 决定 |
| 启动模板激活版本 | 主链已由服务端 `launch-template` 根据 active activation 解析，前端 fallback 仍保留 | 由服务端根据激活中的 `package_version` 计算 |

## 14. 风险与阻塞项表

| 阻塞项 | 当前原因 | 影响 | 优先级 |
|---|---|---|---|
| `package` 域缺深层读模型 | 已有主对象与基础投影，仍混有静态 meta | Creator 无法完全真数据化 | P0 |
| `release` 域缺 review/audit export | 已有发布、gate、activation 主链，仍缺更深治理对象 | 无法完成正式审计与回滚治理 | P0 |
| `replay` 域缺差异详情 | 已有回放主对象，仍缺差异结果与导出 | 无法验证打包漂移 | P0 |
| `governance` 域缺成本/配额/审计 | 凭证与 MCP 基础对象已有，成本与审计仍无法结构化 | 企业治理不可用 | P0 |
| `delivery bundle` 缺失 | 包交付物无正式对象 | 工坊无法消费稳定版本 | P1 |
| `package access policy` 缺失 | 角色和工作区范围无正式约束 | Creator 可见性不可控 | P1 |

## 15. 完成判定表

| 判定项 | 满足条件 |
|---|---|
| Creator 列表切流完成 | 列表、过滤、搜索、统计均来自 `/v1/packages` |
| Creator 详情切流完成 | Session/Runtime/Connectors/Release 四页签均有真实后端对象 |
| 发布链完成 | 发起发布、Gate 决策、激活、回滚均有正式接口与持久化 |
| 回放链完成 | 可查看真实 replay 事件、文件差异、审批差异与导出 |
| 治理链完成 | 凭证、成员、策略、审计、成本均可按包维度查询与治理 |
