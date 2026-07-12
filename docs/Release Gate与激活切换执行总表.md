# 灵办词元 Release Gate与激活切换执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Release Gate与激活切换执行总表 |
| 适用范围 | Creator 发布流程、工坊服务挂接、灰度切换、回滚链路、治理审核链路 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以 `CreatorPage.tsx` 中 release/governance 语义、现有发布文档、审核与配额文档为基础，向正式系统执行链路展开 |
| 直接证据 | `app/dashboard/src/pages/creator/CreatorPage.tsx`、`app/dashboard/src/data/dashboardData.ts`、`docs/Creator包版本与发布对象总表.md`、`docs/Release回放与审核状态流总表.md`、`docs/审批与治理执行矩阵总表.md` |
| 输出目标 | 将 Release Gate、激活、灰度、回滚、审计事件、责任边界表格化到可直接实施的粒度 |

## 2. 发布执行阶段总表

| 阶段 | 状态 | 输入 | 核心动作 | 输出 |
|---|---|---|---|---|
| 阶段 1 | `draft` | `package_version_id`、目标通道、目标范围 | 创建发布单、冻结待发布版本元数据 | `release_order` |
| 阶段 2 | `gating` | 发布单、策略快照、依赖清单 | 执行各类 Gate 检查 | `release_gate[]` |
| 阶段 3 | `approved` | 全部 Gate 通过 | 等待激活时间或人工确认 | 可激活发布单 |
| 阶段 4 | `staged` | 需要灰度/预览/私有投放 | 写入通道绑定、灰度比例和目标服务绑定 | 通道级生效记录 |
| 阶段 5 | `active` | 激活命令 | 切换目录可见版本、服务默认版本、实例模板版本 | 当前生效版本 |
| 阶段 6 | `rolled_back` | 回滚命令或严重告警 | 恢复前一稳定版本，保留失败发布审计 | 回滚记录 |
| 阶段 7 | `archived` | 下线或归档 | 锁定历史发布、保留审计导出与证据 | 历史发布记录 |

## 3. Gate 类型执行矩阵

| Gate 类型 | 输入对象 | 核心校验 | 通过条件 | 失败后动作 | 责任角色 |
|---|---|---|---|---|---|
| `desensitization` | Session 资产、路径引用、凭证引用 | 检查敏感路径、账号标识、凭证影子引用 | 无敏感泄漏项 | 回到 Creator 修订 | Creator、Auditor |
| `replay` | Source run、目标 package version | 运行回放并做消息/审批/文件差异判定 | 差异在阈值内 | 标记 `blocked`，附 replay diff | Creator、Runtime |
| `policy` | 运行策略、路径白名单、容器策略 | 校验运行配置与治理策略一致 | 策略引用完整且风险等级可接受 | 阻断发布 | Workspace Admin |
| `credential` | MCP 绑定、凭证挂载 | 校验 credential 存在、未过期、作用域正确 | 全部依赖可解析 | 阻断发布 | Workspace Admin |
| `quota` | 成本规则、资源配额、预估消耗 | 校验预估成本与租户配额 | 未超配额或已批准超额 | 触发超额审批 | Workspace Admin、Finance |
| `manual_approval` | 审批人列表、发布说明 | 人工签核 | 指定角色确认 | 阻断发布 | Approver |
| `audit_export` | Gate 结果、发布单、回放摘要 | 生成可归档审计包 | 导出成功 | 允许重试或阻断归档 | Auditor |

## 4. Gate 输入输出字段总表

| 字段 | 所属对象 | 用途 |
|---|---|---|
| `gate_id` | `release_gate` | Gate 主键 |
| `release_id` | `release_gate` | 所属发布单 |
| `gate_type` | `release_gate` | Gate 类型 |
| `status` | `release_gate` | `pending / running / passed / failed / waived` |
| `required_role` | `release_gate` | 指定审批角色 |
| `result_summary` | `release_gate` | 结果摘要 |
| `evidence_ref` | `release_gate` | 关联 replay / report / export |
| `decided_by_user_id` | `release_gate` | 决策人 |
| `decided_at` | `release_gate` | 决策时间 |

## 5. 激活切换模式矩阵

| 通道 | 目标对象 | 切换动作 | 回滚策略 | 适用场景 |
|---|---|---|---|---|
| `private` | 单工作区 / 单 Creator | 仅对指定工作区或指定成员可见 | 直接回切到空绑定或上版 | Creator 自测 |
| `preview` | 指定工作区 / 指定服务 | 在目录中可见，但默认不全量推荐 | 回切到上一预览版 | 业务侧验收 |
| `gray` | 指定服务 / 指定工坊 | 按 `rollout_percent` 部分用户生效 | 立即回切上版并记录灰度失败 | 受控放量 |
| `general` | 全量目录 | 更新默认生效版本 | 回切到最近稳定版 | 通用公开投放 |
| `enterprise` | 指定企业工作区 | 企业侧独享版本绑定 | 回切到企业上版 | 企业定制版 |

## 6. 激活作业执行矩阵

| 作业对象 | 输入 | 动作 | 成功输出 | 失败输出 |
|---|---|---|---|---|
| `release_activation_job` | `release_id`、目标绑定、激活时间 | 更新工坊目录版本指针、服务默认版本、实例模板版本 | `release.activated` 事件 | `release.activation_failed` 事件 |
| `release_rollout_job` | `release_id`、灰度比例 | 写入通道级灰度规则和命中范围 | `release.rollout_updated` | `release.rollout_failed` |
| `release_rollback_job` | `release_id`、目标回滚版本 | 恢复上版绑定和目录可见性 | `release.rolled_back` | `release.rollback_failed` |
| `release_archive_job` | `release_id` | 归档 Gate、导出、回放摘要 | `release.archived` | `release.archive_failed` |

## 7. 目标范围切换矩阵

| `target_scope_type` | `target_scope_id` 含义 | 需要更新的绑定对象 |
|---|---|---|
| `workspace` | 工作区主键 | `package_workspace_binding`、目录可见性 |
| `workshop` | 工坊主键 | 工坊默认版本、工坊可见版本列表 |
| `service` | 服务主键 | 服务默认版本、服务实例化模板 |

## 8. 审计事件总表

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `release.created` | 创建发布单 | `release_id`、`package_version_id`、`channel` |
| `release.gate.started` | 任一 Gate 开始 | `release_id`、`gate_id`、`gate_type` |
| `release.gate.passed` | Gate 通过 | `release_id`、`gate_id`、`evidence_ref` |
| `release.gate.failed` | Gate 失败 | `release_id`、`gate_id`、`reason` |
| `release.activated` | 激活成功 | `release_id`、`target_scope_type`、`target_scope_id` |
| `release.rollout_updated` | 灰度比例调整 | `release_id`、`rollout_percent` |
| `release.rolled_back` | 回滚成功 | `release_id`、`rollback_to_release_id` |
| `release.archived` | 归档完成 | `release_id`、`export_job_id` |

## 9. Release API 执行总表

| Method | Path | 主要请求字段 | 主要响应字段 | 用途 | 当前状态 |
|---|---|---|---|---|---|
| `POST` | `/v1/releases` | `package_version_id`、`channel`、`target_scope_type`、`target_scope_id` | `release_order` | 创建发布单 | 目标接口 |
| `GET` | `/v1/releases` | `workspace_id`、`status?`、`channel?` | `release_order[]` | 查询发布列表 | 目标接口 |
| `GET` | `/v1/releases/:releaseId` | `releaseId` | `release_detail` | 查看发布详情 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/gates/:gateId/approve` | `note?` | `release_gate` | 人工 Gate 通过 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/gates/:gateId/reject` | `note` | `release_gate` | 人工 Gate 驳回 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/activate` | `effective_at?` | `release_order` | 激活发布 | 目标接口 |
| `POST` | `/v1/releases/:releaseId/rollback` | `reason` | `release_order` | 回滚发布 | 目标接口 |
| `GET` | `/v1/releases/:releaseId/export` | `format` | `audit_export_job` 或下载地址 | 审计导出 | 目标接口 |

## 10. 角色责任矩阵

| 动作 | Creator | Approver | Auditor | Workspace Admin | Runtime/Worker |
|---|---|---|---|---|---|
| 创建发布单 | 负责 | 查看 | 查看 | 关注 | 无 |
| 提交 Gate 材料 | 负责 | 关注 | 查看 | 关注 | 无 |
| 人工签核 | 提交说明 | 负责 | 查看 | 可兼任 | 无 |
| 激活发布 | 发起 | 批准 | 查看 | 可发起 | 执行切换 |
| 调整灰度比例 | 发起建议 | 批准 | 查看 | 负责 | 执行切换 |
| 回滚发布 | 发起或建议 | 批准 | 查看 | 负责 | 执行回滚 |
| 审计导出 | 可发起 | 查看 | 负责 | 可发起 | 生成导出物 |

## 11. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| Release 对象未落库 | 当前只有前端语义和文档 | 无法形成正式发布链 | P0 |
| 激活切换无后端执行层 | 没有目录、服务、版本指针切换逻辑 | 无法真正投放 Creator 包 | P0 |
| Gate 证据对象未建模 | 缺少 desensitization/report/quota/replay 结构化结果 | 无法审计和回放 | P0 |
| 回滚作业未实现 | 只有文档层设计 | 无法保证发布可逆 | P0 |

## 12. 当前已验证 Gate/激活基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| release 通道语义 | 已在 Creator 页面表达 `private/preview/gray/general/enterprise` | `dashboardData.ts`、`CreatorPage.tsx` |
| Gate 语义 | 已在 Creator 发布页与治理文案中表达 | `CreatorPage.tsx` |
| 激活/回滚后端作业 | 未实现 | API / worker 当前无 release activation / rollback job |
| 目录版本切换逻辑 | 未实现 | 当前无 `workshop/service` 正式后端域 |
| rollout 百分比执行 | 未实现 | 当前只有前端文案与 rollout checkpoints |

## 13. 当前不可宣称完成的激活切换能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 激活切换 | 无目录指针、服务默认版本、模板版本切换逻辑 | 不可宣称发布可真正生效 |
| 灰度放量 | 无命中范围、无百分比执行器 | 不可宣称灰度投放已落地 |
| 回滚 | 无上一稳定版恢复链 | 不可宣称发布可逆已落地 |
| 发布审计 | 无结构化 Gate 证据对象 | 不可宣称发布审计闭环已完成 |
