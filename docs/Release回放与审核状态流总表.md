# 灵办词元 Release回放与审核状态流总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Release回放与审核状态流总表 |
| 适用范围 | Creator 发布、调试回放、治理审计、后续 release/replay/audit 正式域 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 Creator 的 `release` / `debug` / `governance` 路由语义、治理 audit 文案、creatorOperationMeta rollout checkpoints 为准 |
| 直接证据 | `app/dashboard/src/pages/creator/CreatorPage.tsx`、`app/dashboard/src/lib/routes.ts`、`docs/Creator发布与调试回放总表.md`、`docs/审批与治理执行矩阵总表.md` |
| 输出目标 | 将发布单、回放单、审核门、状态机、API、审计事件和责任边界细化为正式表格 |

## 2. 当前页面语义证据总表

| 页面/区块 | 当前语义 | 说明 |
|---|---|---|
| `creator/packages/:packageId` `release` 页签 | 展示发布单元、审核清单、目标通道 | 当前表达 release 核心工作流 |
| `creator/packages/:packageId/debug` | 展示真实 session 回放、消息顺序、审批节点、路径差异 | 当前表达 replay 核心工作流 |
| `creator/governance/audit` | 展示脱敏、回放、导出、审计账本 | 当前表达 audit/gate 语义 |
| `creatorOperationMeta.rollout` | 展示每个包的 rollout checkpoints | 当前表达灰度、私有发布、正式发布的操作节点 |

## 3. 正式对象总表

| 对象 | 主键建议 | 当前职责 |
|---|---|---|
| `release_order` | `rel_*` | 单次发布单，绑定 package version 和目标通道 |
| `release_gate` | `rgt_*` | 发布门、脱敏门、回放门、成本门、审批门 |
| `release_target` | `rtg_*` | 目标工作区/工坊/服务/通道 |
| `replay_session` | `rpy_*` | 调试回放单，绑定 source run 或 source package version |
| `replay_event` | `rpe_*` | 回放事件序列 |
| `replay_diff` | `rpd_*` | 回放中的路径差异、消息差异、审批差异 |
| `desensitization_report` | `dsr_*` | 发布前脱敏检查结果 |
| `audit_export_job` | `aej_*` | 导出 audit JSON、摘要、回执的异步任务 |

## 4. `release_order` 字段总表

| 字段 | 类型 | 用途 |
|---|---|---|
| `release_id` | string | 发布单主键 |
| `package_id` | string | 包主键 |
| `package_version_id` | string | 目标包版本 |
| `workspace_id` | string | 发起工作区 |
| `channel` | `private / preview / gray / general / enterprise` | 发布通道 |
| `target_scope_type` | `workspace / workshop / service` | 发布目标范围 |
| `target_scope_id` | string | 目标对象 |
| `status` | `draft / gating / blocked / approved / staged / active / rolled_back / archived` | 发布状态 |
| `requested_by_user_id` | string | 发起人 |
| `approved_by_user_id` | string \| null | 发布批准人 |
| `replay_required` | boolean | 是否必须通过回放门 |
| `desensitization_required` | boolean | 是否必须通过脱敏门 |
| `cost_gate_required` | boolean | 是否必须通过成本门 |
| `published_at` | datetime \| null | 正式激活时间 |
| `rolled_back_at` | datetime \| null | 回滚时间 |

## 5. `release_gate` 字段总表

| 字段 | 类型 | 用途 |
|---|---|---|
| `gate_id` | string | 审核门主键 |
| `release_id` | string | 所属发布单 |
| `gate_type` | `desensitization / replay / policy / credential / quota / manual_approval / audit_export` | 门类型 |
| `status` | `pending / running / passed / failed / waived` | 审核门状态 |
| `required_role` | string | 需要什么角色签核 |
| `result_summary` | localized string \| null | 结果摘要 |
| `evidence_ref` | string \| null | 证据引用，如 replay_id / report_id |
| `decided_by_user_id` | string \| null | 决策人 |
| `decided_at` | datetime \| null | 决策时间 |

## 6. `replay_session` 字段总表

| 字段 | 类型 | 用途 |
|---|---|---|
| `replay_id` | string | 回放单主键 |
| `package_version_id` | string | 目标包版本 |
| `source_run_id` | string \| null | 来源运行实例 |
| `source_session_version_id` | string \| null | 来源 session version |
| `status` | `queued / rehydrating / replaying / diffing / passed / failed / exported` | 回放状态 |
| `replay_mode` | `run_replay / package_replay / release_gate_replay` | 回放模式 |
| `message_count` | number | 回放消息数 |
| `approval_count` | number | 审批节点数 |
| `file_change_count` | number | 文件变更数 |
| `started_by_user_id` | string | 发起人 |
| `started_at` | datetime | 开始时间 |
| `finished_at` | datetime \| null | 结束时间 |

## 7. 发布状态机总表

| 状态 | 含义 | 进入条件 | 可流向状态 |
|---|---|---|---|
| `draft` | 发布单初始草稿 | 新建发布单 | `gating`、`archived` |
| `gating` | 审核门执行中 | 提交发布审查 | `blocked`、`approved` |
| `blocked` | 某个 gate 未通过 | 审核门失败或缺证据 | `gating`、`archived` |
| `approved` | 所有 gate 通过，待真正投放 | 脱敏、回放、策略、成本门都通过 | `staged`、`active`、`rolled_back` |
| `staged` | 进入灰度或私有通道 | 目标通道为 `gray / preview / private` | `active`、`rolled_back` |
| `active` | 发布已生效 | 投放成功 | `rolled_back`、`archived` |
| `rolled_back` | 已回滚 | 从 `approved/staged/active` 回退 | `gating`、`archived` |
| `archived` | 历史发布单 | 下线或归档 | 终态 |

## 8. 回放状态机总表

| 状态 | 含义 | 进入条件 | 可流向状态 |
|---|---|---|---|
| `queued` | 等待回放执行 | 新建回放单 | `rehydrating`、`failed` |
| `rehydrating` | 恢复上下文和基础物料 | 开始准备回放环境 | `replaying`、`failed` |
| `replaying` | 按原始顺序执行消息/审批/工具调用回放 | 上下文恢复成功 | `diffing`、`failed` |
| `diffing` | 对比路径、审批、消息、工具摘要差异 | 回放执行完成 | `passed`、`failed` |
| `passed` | 差异在可接受范围内 | 通过回放门 | `exported` |
| `failed` | 回放失败或差异超阈值 | 任一环节失败 | `queued`、`archived` |
| `exported` | 结果已导出 | 审计导出或回放摘要已生成 | `archived` |

## 9. Release API 清单总表

| Method | Path | 主要请求字段 | 主要响应字段 | 当前用途 | 当前状态 |
|---|---|---|---|---|---|
| `POST` | `/v1/releases` | `package_version_id`、`channel`、`target_scope_type`、`target_scope_id` | `release_order` | 创建发布单 | 目标接口 |
| `GET` | `/v1/releases` | `workspace_id`、`status?`、`channel?` | `release_order[]` | 发布列表 | 目标接口 |
| `GET` | `/v1/releases/:releaseId` | `releaseId` | `release_detail` | 发布详情 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/gates/:gateId/approve` | `note?` | `release_gate` | 人工 gate 通过 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/gates/:gateId/reject` | `note` | `release_gate` | 人工 gate 拒绝 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/activate` | `effective_at?` | `release_order` | 使发布生效 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/rollback` | `reason` | `release_order` | 回滚发布 | 目标接口 |
| `GET` | `/v1/releases/:releaseId/export` | `format` | 导出任务或文件描述 | 审计导出 | 目标接口 |

## 10. Replay API 清单总表

| Method | Path | 主要请求字段 | 主要响应字段 | 当前用途 | 当前状态 |
|---|---|---|---|---|---|
| `POST` | `/v1/replays` | `package_version_id`、`source_run_id?`、`replay_mode` | `replay_session` | 创建回放单 | 目标接口 |
| `GET` | `/v1/replays` | `package_id?`、`status?`、分页 | `replay_session[]` | 回放列表 | 目标接口 |
| `GET` | `/v1/replays/:replayId` | `replayId` | `replay_detail` | 回放详情 | 目标接口 |
| `GET` | `/v1/replays/:replayId/events` | `replayId`、分页 | `replay_event[]` | 查看回放事件序列 | 目标接口 |
| `GET` | `/v1/replays/:replayId/diffs` | `replayId` | `replay_diff[]` | 查看路径/审批/消息差异 | 目标接口 |
| `POST` | `/v1/replays/:replayId/export` | `format` | `audit_export_job` | 导出摘要、JSON、回执 | 目标接口 |

## 11. 审核门与证据引用矩阵

| Gate 类型 | 需要的证据对象 | 当前页面语义来源 | 正式校验方式 |
|---|---|---|---|
| `desensitization` | `desensitization_report` | 治理 audit 文案中的“发布前脱敏” | 扫描 session pack / asset refs / secret refs |
| `replay` | `replay_session` + `replay_diff` | debug 回放页 | 运行回放并做 diff 校验 |
| `policy` | `policy_snapshot` | governance policy 文案 | 校验路径白名单、容器策略、提交前审批 |
| `credential` | `credential_binding_audit` | governance credentials 文案 | 校验 secret mount、connector ref、轮换状态 |
| `quota` | `quota_evaluation` | governance cost 文案 | 校验是否触发超额回流 |
| `manual_approval` | `approval_decision` | 发布审核页 | 指定角色人工签核 |
| `audit_export` | `audit_export_job` | governance audit 文案 | 生成可归档导出物 |

## 12. 审计事件总表

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `release.created` | 创建发布单 | `release_id`、`package_version_id`、`channel`、`requested_by` |
| `release.gate.started` | 某个 gate 开始执行 | `release_id`、`gate_id`、`gate_type` |
| `release.gate.passed` | gate 通过 | `release_id`、`gate_id`、`evidence_ref` |
| `release.gate.failed` | gate 失败 | `release_id`、`gate_id`、`reason` |
| `release.activated` | 发布生效 | `release_id`、`target_scope_id`、`channel` |
| `release.rolled_back` | 发布回滚 | `release_id`、`reason` |
| `replay.created` | 新建回放单 | `replay_id`、`package_version_id`、`source_run_id` |
| `replay.failed` | 回放失败 | `replay_id`、`phase`、`reason` |
| `replay.passed` | 回放通过 | `replay_id`、`diff_summary` |
| `audit.exported` | 导出审计材料 | `job_id`、`format`、`scope` |

## 13. 责任矩阵总表

| 对象/动作 | Creator | Approver | Auditor | Workspace Admin | Runtime/Worker |
|---|---|---|---|---|---|
| 创建 package version | 负责 | 关注 | 查看 | 关注 | 无 |
| 发起 release | 负责 | 关注 | 查看 | 关注 | 无 |
| 审核人工 gate | 提交材料 | 负责 | 查看 | 可兼任 | 无 |
| 运行 replay | 发起 | 可要求重跑 | 查看结果 | 关注 | 负责执行 |
| 导出审计材料 | 可发起 | 查看 | 负责复核 | 可发起 | 生成导出物 |
| 回滚 release | 可发起 | 负责批准 | 查看 | 可发起 | 负责执行切换 |

## 14. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| Release 对象缺失 | 当前只有前端文案和按钮语义 | 无法形成正式发布链 | P0 |
| Replay 对象缺失 | 当前 debug 页没有后端数据源 | 无法做真实 session 回放 | P0 |
| Gate 结果对象缺失 | 没有可追踪的 gate 审批链 | 无法实现企业审核闭环 | P0 |
| 审计导出对象缺失 | 只有文案，没有导出任务模型 | 无法形成合规交付物 | P1 |

## 15. 当前已验证 Release/Replay 基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| 发布状态语义 | 已在 Creator release 页签中表达 | `CreatorPage.tsx` |
| 回放状态语义 | 已在 Creator debug 路由中表达 | `CreatorPage.tsx` |
| rollout checkpoints | 已由 `creatorOperationMeta.rollout` 表达 | `CreatorPage.tsx` |
| 正式 Release API | 未实现 | API 无 `/v1/releases` |
| 正式 Replay API | 未实现 | API 无 `/v1/replays` |
| 正式 Gate 对象 | 未实现 | 当前无后端 `release_gate` 域 |

## 16. 当前不可宣称完成的发布审核能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 发布单状态机执行 | 状态机仅在文档和页面语义中存在 | 不可宣称正式发布链已执行化 |
| Replay Gate | 无回放执行器与差异判定对象 | 不可宣称回放门已落地 |
| 审计导出 Gate | 无导出作业对象与文件包 | 不可宣称审计交付链已完成 |
| 人工签核链 | 无持久化 gate 决策记录 | 不可宣称企业审核闭环已落地 |
