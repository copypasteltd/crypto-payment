# 灵办词元 Creator包版本与发布对象总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Creator包版本与发布对象总表 |
| 适用范围 | `app/dashboard` Creator 工作区、后续 package/release/replay 正式域 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 Creator 页的 `creatorPackages`、`packageMeta`、`creatorOperationMeta`、深链路由与治理视图为准 |
| 直接证据 | `app/dashboard/src/data/dashboardData.ts`、`app/dashboard/src/pages/creator/CreatorPage.tsx`、`app/dashboard/src/lib/routes.ts` |
| 输出目标 | 把 package、package version、依赖、运行镜像、发布通道、工作区绑定等正式对象详细表格化 |

## 2. 当前 Creator 证据总表

| 证据位置 | 当前语义 | 说明 |
|---|---|---|
| `creatorPackages` | 包含 `session/runtime/connectors/release` 四组展示块 | 当前 package 主体卡片数据源 |
| `packageMeta` | 包含 `owner`、`updatedAt`、`releaseChannel`、`workshopIds`、`serviceIds`、`versionLine`、`dependencies` | 当前 package 扩展元数据 |
| `creatorOperationMeta` | 包含动作按钮、rollout checkpoints、提示语 | 当前发布与调试回放操作语义 |
| Creator 路由 | `creator`、`creatorPackage`、`creatorDebug`、`creatorGovernance` | 当前工作台的正式导航结构 |

## 3. Creator 正式对象分层总表

| 层级 | 正式对象 | 当前前端对应 | 职责 |
|---|---|---|---|
| L1 | `creator_package` | `CreatorPackage` | Creator 可维护的主对象 |
| L2 | `package_version` | `versionLine` 中的组合表达 | 真正可发布、可继承的版本单元 |
| L3 | `package_dependency` | `dependencies` | 描述 runtime、connector、credential、task/session 依赖 |
| L4 | `runtime_profile` | `runtime` 页签 + `img: ...` 版本线 | 描述运行镜像与执行策略 |
| L5 | `release_channel_binding` | `releaseChannel` | 描述该版本面向哪些工坊/工作区/环境发布 |
| L6 | `package_workspace_binding` | `workshopIds`、`serviceIds` | 描述 package 与工坊/服务/工作区的挂接关系 |

## 4. `creator_package` 字段总表

| 字段 | 类型 | 当前前端映射 | 用途 |
|---|---|---|---|
| `package_id` | string | `CreatorPackage.id` | 包主键 |
| `workspace_id` | string | 当前由 `currentWorkspaceId` 隐式承载 | 归属工作区 |
| `display_name` | localized string | `CreatorPackage.title` | 包展示名 |
| `source_label` | localized string | `CreatorPackage.source` | 源实例/源工作区摘要 |
| `status` | `draft / audited / pending_release / ready / disabled / archived` | `status` + `statusClass` | 顶层状态 |
| `owner_user_id` | string | `packageMeta.owner` 的正式化 | 所有人 |
| `latest_version_id` | string \| null | 当前无 | 当前最新版本 |
| `current_release_channel` | string \| null | `packageMeta.releaseChannel` | 当前默认发布通道 |
| `summary_session` | localized string | `session.summary` | 包的 session 摘要 |
| `summary_runtime` | localized string | `runtime.summary` | 运行镜像摘要 |
| `summary_connectors` | localized string | `connectors.summary` | 能力/凭证摘要 |
| `summary_release` | localized string | `release.summary` | 发布摘要 |

## 5. `package_version` 字段总表

| 字段 | 类型 | 当前前端映射 | 用途 |
|---|---|---|---|
| `package_version_id` | string | 当前无单独对象，可从 `versionLine` 拆出 | 包版本主键 |
| `package_id` | string | `CreatorPackage.id` | 所属包 |
| `semantic_version` | string | 当前无 | 包本身版本号 |
| `session_version_id` | string | `sev_*` | 绑定 session version |
| `task_version_id` | string | `tsv_*` | 绑定 task version |
| `runtime_image_ref` | string | `img: lingban-codex-runtime:*` | 绑定 runtime image |
| `desensitization_state` | string | 当前在治理/发布文案中表达 | 脱敏完成度 |
| `release_readiness` | string | `CreatorPackage.status` | 发布成熟度 |
| `created_by_user_id` | string | 当前无 | 版本创建者 |
| `published_at` | datetime \| null | 当前无 | 发布时间 |
| `archived_at` | datetime \| null | 当前无 | 归档时间 |

## 6. `package_dependency` 字段总表

| 字段 | 类型 | 当前前端映射 | 用途 |
|---|---|---|---|
| `dependency_id` | string | 当前无 | 依赖主键 |
| `package_version_id` | string | 当前无 | 所属版本 |
| `dependency_type` | `session_version / task_version / runtime_image / mcp / credential / asset_ref / browser_policy` | `dependencies[]` 语义拆分 | 依赖类型 |
| `dependency_ref` | string | `dependencies[]` 文案中的实体 | 依赖引用 |
| `scope` | `workspace / package / run` | 当前无 | 依赖作用域 |
| `required` | boolean | 当前无 | 是否必需 |
| `approval_required` | boolean | 当前在治理文案中表达 | 是否需要审批 |
| `risk_level` | string | 当前在治理文案中表达 | 风险等级 |
| `note` | localized string | `dependencies[]` 文案 | 备注 |

## 7. `runtime_profile` 字段总表

| 字段 | 类型 | 当前前端映射 | 用途 |
|---|---|---|---|
| `runtime_profile_id` | string | 当前无 | 运行配置主键 |
| `runtime_image_ref` | string | `img: ...` | 镜像版本 |
| `codex_cli_version` | string | 当前无 | Codex CLI 版本 |
| `node_version` | string | 当前 runtime 文案隐式表达 | Node 版本 |
| `python_version` | string | 当前 runtime 文案隐式表达 | Python 版本 |
| `browser_stack` | string[] | 当前 runtime 文案中 `playwright / browser bridge` | 浏览器自动化栈 |
| `workspace_mount_policy` | string | 当前 runtime 文案与治理 policy 文案 | 工作目录挂载策略 |
| `container_teardown_policy` | string | 当前治理 policy 文案 | 容器销毁策略 |
| `network_policy_ref` | string | 当前治理 policy 文案 | 网络白名单策略 |

## 8. `package_workspace_binding` 字段总表

| 字段 | 类型 | 当前前端映射 | 用途 |
|---|---|---|---|
| `binding_id` | string | 当前无 | 绑定关系主键 |
| `package_version_id` | string | 当前无 | 包版本 |
| `workspace_id` | string | `currentWorkspaceId` + `workshopIds` 的正式化 | 允许使用该包的工作区 |
| `workshop_id` | string | `packageMeta.workshopIds[]` | 挂接工坊 |
| `service_id` | string \| null | `packageMeta.serviceIds[]` | 挂接服务 |
| `channel` | `private / preview / gray / general / enterprise` | `releaseChannel` | 发布通道 |
| `enabled` | boolean | 当前无 | 是否生效 |
| `rollout_percent` | number \| null | 当前灰度语义只有文案 | 灰度比例 |

## 9. Creator 包接口清单总表

| Method | Path | 主要请求字段 | 主要响应字段 | 当前用途 | 当前状态 |
|---|---|---|---|---|---|
| `GET` | `/v1/packages` | `workspace_id`、`status?`、`q?`、`channel?` | `package_summary[]` | Creator 总览列表 | 目标接口 |
| `GET` | `/v1/packages/:packageId` | `packageId` | `package_detail` | Creator 详情页 | 目标接口 |
| `POST` | `/v1/packages` | `display_name`、`source_run_id?`、`workspace_id` | `creator_package` | 创建新包 | 目标接口 |
| `PATCH` | `/v1/packages/:packageId` | 名称、摘要、状态 | `creator_package` | 更新包元数据 | 目标接口 |
| `GET` | `/v1/packages/:packageId/versions` | `packageId`、分页 | `package_version[]` | 版本列表 | 目标接口 |
| `POST` | `/v1/packages/:packageId/versions` | `session_version_id`、`task_version_id`、`runtime_image_ref` 等 | `package_version` | 创建新版本 | 目标接口 |
| `GET` | `/v1/packages/:packageId/dependencies` | `packageId` | `package_dependency[]` | 查看依赖清单 | 目标接口 |
| `POST` | `/v1/packages/:packageId/bindings` | `workspace_id`、`workshop_id`、`service_id`、`channel` | `package_workspace_binding` | 挂接工坊与服务 | 目标接口 |

## 10. Creator 页面字段与正式对象映射总表

| 当前页面区块 | 当前字段 | 正式对象 | 说明 |
|---|---|---|---|
| 列表卡片 | `title`、`source`、`status` | `creator_package` | 对应 package 主对象摘要 |
| Session 页签 | `session.summary`、`session.items[]` | `package_version` + `session_version` | 对应版本的 session 说明 |
| Runtime 页签 | `runtime.summary`、`runtime.items[]` | `runtime_profile` | 对应运行镜像与目录策略 |
| Connectors 页签 | `connectors.summary`、`connectors.items[]` | `package_dependency` | 对应 MCP 与 credential 依赖 |
| Release 页签 | `release.summary`、`release.items[]` | `release_channel_binding` + `release_gate` | 对应发布目标与审核门 |
| 右侧 quick meta | `releaseChannel`、`versionLine`、`dependencies` | `package_version`、`package_dependency` | 当前是混合元数据，正式化后应拆分 |

## 11. 当前 Creator 正式化缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| `package_version` 缺失 | 当前只有 `versionLine` 文案数组 | 版本管理无法查询、回滚、对比 | P0 |
| 依赖对象缺失 | 当前 `dependencies` 只是文案 | 无法校验运行前依赖完整性 | P0 |
| 绑定对象缺失 | `workshopIds`、`serviceIds` 只是页面元数据 | 工坊目录无法由发布驱动 | P0 |
| runtime_profile 缺失 | 运行镜像、挂载、销毁策略没有正式对象 | 无法把治理策略作用到运行层 | P1 |
| package API 缺失 | Creator 页完全没有后端数据 | 当前只是展示型工作台 | P0 |

## 12. 当前已验证 Creator 包基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| Creator 路由结构 | 已实现 `/creator`、`/creator/packages/:packageId`、`/debug`、`/governance/:section` | `app/dashboard/src/app/router/AppRouter.tsx`、`src/lib/routes.ts` |
| Creator 列表数据源 | 当前完全来自本地 `creatorPackages` | `app/dashboard/src/data/dashboardData.ts` |
| Package 元数据 | 当前完全来自本地 `packageMeta` | `app/dashboard/src/pages/creator/CreatorPage.tsx` |
| 发布/回放动作元数据 | 当前完全来自本地 `creatorOperationMeta` | `app/dashboard/src/pages/creator/CreatorPage.tsx` |
| Creator API 接入 | 已实现基础接线 | `app/dashboard/src/lib/api.ts` 已接 `createCreatorApiClient()` |
| 后端 package/release/replay 接口 | 已实现基础只读 | 已命中 `/v1/packages`、`/v1/packages/:packageId/releases`、`/v1/packages/:packageId/replays`；写接口与独立正式域未补齐 |

## 13. 当前数据权威性判定表

| 数据块 | 当前权威性 | 说明 |
|---|---|---|
| `creatorPackages` | 前端样例数据 | 仅用于页面结构和交互表达 |
| `packageMeta.versionLine` | 前端样例数据 | 不是可查询的正式版本对象 |
| `dependencies` | 前端样例文案 | 不是结构化依赖记录 |
| `releaseChannel` | 前端样例文案 | 不是正式发布通道绑定 |
| `workshopIds / serviceIds` | 前端样例元数据 | 不是权威目录激活关系 |

## 14. 当前不可宣称完成的 Creator 包能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 正式 package 域 | 无后端 `package` 对象与 API | 不可宣称 Creator 包已正式化 |
| 正式 version 域 | `versionLine` 仅是字符串数组 | 不可宣称版本管理已落地 |
| 正式 dependency 域 | 依赖只存在前端文案 | 不可宣称依赖校验已落地 |
| 正式目录绑定 | 无权威 `workshop/service` 绑定对象 | 不可宣称发布驱动目录已落地 |
