# 灵办词元 RBAC授权判定、角色绑定与资源范围执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | RBAC授权判定、角色绑定与资源范围执行总表 |
| 适用范围 | `app/api`、`app/dashboard`、`app/mobile`、未来 `packages/auth`、未来治理域 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以 `docs/租户权限与治理对象总表.md`、`docs/工作区会话与授权判定总表.md`、`docs/认证会话与工作区切换执行总表.md`、`app/mobile/src/data/workspaceCatalog.ts`、当前 API 路由行为为准，细化到正式 RBAC 判定执行层 |
| 直接证据 | `app/api/src/modules/runs/routes.ts`、`app/api/src/modules/runs/file-access.ts`、`app/mobile/src/data/workspaceCatalog.ts`、`docs/租户权限与治理对象总表.md` |
| 输出目标 | 将工作区成员、角色、资源范围、运行时动作、前端可见性、内部桥接和审计要求细化为执行表 |

## 2. 当前授权事实矩阵

| 证据 | 当前实现 | 当前限制 |
|---|---|---|
| `runIdParamsSchema` | 仅校验 `runId` 非空 | 无用户身份和资源归属校验 |
| `file-access.ts` | 仅做 `targetPath` 路径边界校验 | 无工作区、用户、角色判断 |
| `workspaceCatalog.ts` | 前端本地维护工坊/服务/任务可见范围 | 仅演示级可见性，不是权威授权 |
| `docs/租户权限与治理对象总表.md` | 已定义角色与动作词汇 | 代码层尚未落地 |
| `bridge` internal routes | 仅 parse body/params | 无正式服务间鉴权 |

## 3. 授权主体与上下文矩阵

| 上下文对象 | 关键字段 | 作用 |
|---|---|---|
| `AuthSession` | `user_id/session_id/issued_at/expires_at` | 标识当前登录用户 |
| `WorkspaceMembership` | `workspace_id/user_id/role/status` | 形成空间内 RBAC 主依据 |
| `ResourceScope` | `resource_type/resource_id/workspace_id/owner_user_id/visibility` | 资源归属与可见范围 |
| `RunContext` | `run_id/workspace_id/requested_by_user_id/status` | 对话、审批、下载判定 |
| `DecisionContext` | `action/policy_hit/risk_level` | 叠加审批、配额、治理策略 |

## 4. 角色来源与绑定矩阵

| 角色 | 绑定位置 | 当前来源 | 正式落点 |
|---|---|---|---|
| `workspace_member` | `workspace_members.role` | 文档定义 | PostgreSQL |
| `workspace_operator` | `workspace_members.role` | 文档定义 | PostgreSQL |
| `workspace_creator` | `workspace_members.role` | 文档定义 | PostgreSQL |
| `workspace_admin` | `workspace_members.role` | 文档定义 | PostgreSQL |
| `platform_admin` | 平台级策略或独立表 | 文档定义 | 平台身份域 |

## 5. 授权资源范围矩阵

| 资源 | 资源主键 | 范围基准 | 说明 |
|---|---|---|---|
| 工坊 | `workshop_id` | `workspace/public` | 控制前台展示和进入服务页 |
| 服务 | `task_id/task_version_id` | `workspace/public` | 控制是否可启动 |
| Session 版本 | `session_version_id` | `creator/workspace` | 控制 Creator 可见与继承 |
| Run | `run_id` | `workspace + requested_by_user_id` | 控制对话、审批、取消、下载 |
| 文件/产物 | `run_file_id/artifact_id/path` | `run` | 控制浏览、下载、预览 |
| 凭证 | `credential_id` | `user/workspace` | 控制绑定、轮换、停用 |
| MCP 绑定 | `mcp_binding_id` | `user/workspace/session/run` | 控制启用、调试、出网 |
| 审计/成本 | `audit_id/cost_id` | `workspace/platform` | 控制导出和运营可见性 |

## 6. 授权判定执行顺序矩阵

| 顺序 | 判定项 | 当前状态 | 正式动作 |
|---|---|---|---|
| 1 | 会话是否有效 | 未实现 | 校验 access token / session cookie |
| 2 | 用户是否属于目标 workspace | 未实现 | 读取 `workspace_members` |
| 3 | 角色是否允许当前动作 | 未实现 | RBAC 粗粒度判定 |
| 4 | 资源是否在角色授权范围内 | 未实现 | ABAC / owner / visibility 判定 |
| 5 | 资源状态是否允许动作 | 局部存在于业务状态机 | 结合 `status` 与 `release_channel` |
| 6 | 是否命中审批/配额/网络策略 | 未实现 | 调用治理策略引擎 |
| 7 | 是否需要写审计 | 未实现 | 关键动作落 `audit_logs` |

## 7. 角色到动作矩阵

| 动作 | Member | Operator | Creator | Admin | Platform Admin |
|---|---:|---:|---:|---:|---:|
| 浏览工坊/服务 | 是 | 是 | 是 | 是 | 是 |
| 启动实例 | 是 | 是 | 是 | 是 | 是 |
| 发送实例消息 | 本人或授权范围内 | 授权范围内 | 调试与授权范围内 | 全部 | 全部 |
| 处理审批 | 本人实例 | 授权范围内 | 调试实例与自有服务 | 全部 | 全部 |
| 取消实例 | 本人实例 | 授权范围内 | 调试实例与自有服务 | 全部 | 全部 |
| 下载文件 | 本人实例 | 授权范围内 | 调试实例与自有服务 | 全部 | 全部 |
| 查看 Trace | 否 | 摘要可见 | 是 | 是 | 是 |
| 编辑工坊/服务 | 否 | 否 | 自有 | 全部 | 全部 |
| 发布版本 | 否 | 否 | 自有 | 全部 | 全部 |
| 管理成员 | 否 | 否 | 否 | 是 | 是 |
| 管理凭证/MCP | 否 | 否 | 受限 | 是 | 是 |
| 导出审计/成本 | 否 | 否 | 受限 | 是 | 是 |

## 8. Run 相关接口授权执行矩阵

| 接口 | 资源 | 最低角色 | 正式授权规则 |
|---|---|---|---|
| `GET /v1/runs` | `workspace runs` | Member | 仅返回当前 workspace 且用户有权可见的 run |
| `POST /v1/runs` | `task_version + workspace` | Member | 用户需在目标 workspace 激活，服务版本可见，配额允许 |
| `GET /v1/runs/:runId` | `run` | Member | `run.workspace_id` 属于当前空间，且用户在 scope 内 |
| `POST /messages` | `run` | Member | run 未结束，用户可操作当前 run |
| `POST /approvals` | `approval` | Member/Operator | 当前用户是发起人、被授权审批人或管理员 |
| `POST /cancel` | `run` | Member/Operator | 发起人或管理员可取消，结束态不可再次取消 |
| `GET /files/*` | `run_file` | Member | 先过 run 可见性，再过文件 path 白名单与下载策略 |
| `GET /stream` / `WS /ws/runs/:runId` | `run` | Member | 建连前校验 run 范围，断连重连复用同一授权 |

## 9. 文件与产物授权执行矩阵

| 场景 | 正式判定键 | 处理规则 |
|---|---|---|
| 浏览目录树 | `run_id + workspace_id + role` | 仅暴露当前 target path 白名单 |
| 读取文本预览 | `run_file.kind + preview_policy` | 仅允许可预览文件类型 |
| 下载二进制文件 | `artifact visibility + download grant` | 生成一次性授权 |
| 查看归档目录 | `role + retention policy` | 普通用户默认只看可交付子集 |
| 查看截图/日志 | `role + audit policy` | Creator/Admin 可见粒度更高 |

## 10. 凭证与 MCP 治理授权矩阵

| 动作 | Member | Creator | Admin | 说明 |
|---|---:|---:|---:|---|
| 查看本人凭证绑定状态 | 是 | 是 | 是 | 仅状态，不透出明文 |
| 新增用户私有凭证 | 是 | 是 | 是 | 限本人 scope |
| 新增工作区共享凭证 | 否 | 否 | 是 | 空间级敏感治理 |
| 绑定第三方 MCP 到 run | 受限 | 是 | 是 | 命中风险策略时需审批 |
| 停用共享 MCP | 否 | 否 | 是 | 影响全空间运行 |
| 查看凭证审计 | 否 | 受限 | 是 | 审计级权限 |

## 11. Creator 与治理域授权矩阵

| 资源 | Creator | Admin | Platform Admin | 说明 |
|---|---:|---:|---:|---|
| `workshop` 编辑 | 自有 | 全部 | 全部 | 由 `workspace_id + owner_user_id` 决定 |
| `task_version` 发布 | 自有 | 全部 | 全部 | 需命中 release policy |
| `session_version` 继承/回放 | 自有 | 全部 | 全部 | 需保留 lineage 审计 |
| `audit_logs` 导出 | 受限 | 是 | 是 | 企业合规能力 |
| `cost_ledgers` 查看 | 受限 | 是 | 是 | 默认不对普通成员开放 |

## 12. 前端路由守卫执行矩阵

| 端 | 页面/区域 | 正式守卫规则 |
|---|---|---|
| H5 / 小程序 | 工坊页 | 依据当前 workspace 可见工坊返回 |
| H5 / 小程序 | 任务详情 | 任务需属于当前用户可见范围 |
| H5 / 小程序 | 文件页 | 跟随 run 授权，不独立放宽 |
| Dashboard | Instances | 当前 workspace + run scope |
| Dashboard | Creator | `workspace_creator` 及以上 |
| Dashboard | Governance | `workspace_admin` 及以上 |
| Dashboard | Platform Ops | `platform_admin` |

## 13. 拒绝与审计执行矩阵

| 场景 | 返回码 | 正式审计字段 |
|---|---|---|
| 未登录 | `401` | `actor=anonymous, action, resource_type` |
| 非当前 workspace 成员 | `403` 或隐藏为 `404` | `user_id, workspace_id, deny_reason=not_member` |
| 资源不在授权范围内 | `403` 或 `404` | `resource_scope, deny_reason=out_of_scope` |
| 角色不足 | `403` | `role, required_role, action` |
| 状态不允许 | `409` | `resource_status, action` |
| 命中配额/治理阻断 | `429` 或 `403` | `policy_id, metric, decision` |

## 14. 内部桥接授权执行矩阵

| 接口 | 当前状态 | 正式要求 |
|---|---|---|
| `/internal/bridges/register` | 仅 parse | 需校验内部 token、run 所属 workspace、bridge image/source |
| `/internal/runs/:runId/events` | 仅 parse | 需校验 bridge 与 run 绑定关系 |
| `/internal/runs/:runId/status` | 仅 parse | 需校验状态来源与时间序 |
| `/internal/runs/:runId/artifacts` | 仅 parse | 需校验 artifact path 仍在 target path 白名单 |

## 15. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 无 auth/session 域 | 所有业务接口缺少身份基础 | 无法形成真实授权 | P0 |
| 无 `workspace_members` 权威表 | 角色与成员关系无法判定 | 多租户不可上线 | P0 |
| 文件接口仅校验路径边界 | 无用户范围与下载授权 | 文件安全不足 | P0 |
| 前端可见性仍是本地静态映射 | 不能代表真实授权 | 联调口径不成立 | P1 |

## 16. 当前已验证 RBAC 起点表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| `runId` 参数校验 | 已实现 | `runIdParamsSchema` |
| 文件路径边界校验 | 已实现 | `app/api/src/modules/runs/file-access.ts` |
| 角色词汇体系 | 已在文档层定义 | 当前系列治理文档 |
| 权威角色绑定 | 未实现 | 当前无 `workspace_members` 表与代码 |
| API 鉴权中间件 | 未实现 | 当前 runs/internal 路由直接注册 |
| 前端可见性控制 | 仅本地样例态 | `workspaceCatalog.ts`、`dashboardData.ts` |

## 17. RBAC 落地最短顺序表

| 顺位 | 动作 | 目标结果 |
|---|---|---|
| 1 | 建 `workspace_members` 与角色枚举 | 形成权威角色来源 |
| 2 | 建 API auth middleware | 所有资源动作先拿到 actor |
| 3 | 建 ACL evaluator | `run / file / approval / creator` 资源统一判定 |
| 4 | 给文件下载与 internal 路由补专用 guard | 收紧高风险链路 |
| 5 | 前端接入路由守卫与资源不可见处理 | UI 与后端授权口径统一 |
