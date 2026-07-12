# 灵办词元 字段级响应投影、ViewModel与展示映射执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 字段级响应投影、ViewModel与展示映射执行总表 |
| 适用范围 | `app/dashboard`、`app/mobile`、`packages/api-sdk`、`packages/contracts`、未来统一 `view-model` 适配层 |
| 统计日期 | 2026-07-08 |
| 当前事实 | 当前已有 `RunSnapshot -> InstanceRecord/MobileTask` 适配器，目录页与 Creator 页仍主要依赖本地模型，字段展示逻辑分散在页面和 adapter 中 |
| 直接证据 | `app/dashboard/src/lib/liveRunAdapters.ts`、`app/mobile/src/lib/liveTaskAdapters.ts`、`app/dashboard/src/data/dashboardData.ts`、`app/mobile/src/data/mobileData.ts`、`app/dashboard/src/app/DashboardShell.tsx`、`app/dashboard/src/pages/workshops/WorkshopsPage.tsx`、`app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/tasks/index.tsx`、`app/mobile/src/pages/me/index.tsx`、`docs/前后端模型映射总表.md`、`docs/前端字段级接口对照总表.md` |
| 输出目标 | 统一资源响应字段、前端 ViewModel 字段、展示格式转换、适配器职责和收敛顺序 |

## 2. 当前资源到 ViewModel 总览表

| 资源 | 当前正式响应 | 当前前端 ViewModel | 当前适配位置 | 当前状态 |
|---|---|---|---|---|
| Workspace | 无正式接口 | `DashboardWorkspace` / `MobileWorkspaceEntry` | 本地数据 | 静态 |
| Workshop | 无正式接口 | `Workshop` / `MobileWorkshop` | 本地数据 | 静态 |
| Service | 无正式接口 | `DashboardService` / `MobileService` | 本地数据 | 静态 |
| Run List / Detail | `RunSnapshot` | `InstanceRecord` / `MobileTask` | `liveRunAdapters` / `liveTaskAdapters` | 半正式 |
| File Browser | `RunFileEntry[]` + `readRunFile()` | 文件页子模型 | 页面内拼装 | 半正式 |
| Package | 无正式接口 | `CreatorPackage` + 多组 meta | 本地数据 | 静态 |

## 3. 字段所有权分层表

| 字段类别 | 应由后端返回 | 应由前端投影 | 说明 |
|---|---|---|---|
| 资源身份字段 | 是 | 否 | `id/workspaceId/serviceId/runId/packageId` |
| 资源语义字段 | 是 | 否 | `name/summary/audience/auth/risk/owner_label` |
| 状态枚举字段 | 是 | 否 | `status/state/channel/visibility` |
| 展示样式字段 | 否 | 是 | `statusClass/tone/icon` |
| 文本格式字段 | 否 | 是 | `relative time/path breadcrumb` |
| 标签聚合字段 | 二选一 | 二选一 | 可由后端 facets 返回，也可前端局部投影 |
| 操作按钮字段 | 后端给能力边界，前端给文案呈现 | 是 | `canLaunch/canApprove/canDownload` + 前端文案 |

## 4. Workspace 响应投影表

| 后端建议字段 | Dashboard 展示 | Mobile 展示 | 前端转换 |
|---|---|---|---|
| `workspace_id` | 侧栏当前空间、账号面板 | 我的页当前空间 | 无 |
| `display_name` | 侧栏切换项 | 工作区 sheet 项 | 无 |
| `workspace_type` | 侧栏 meta | 我的页 badge | 枚举转文案 |
| `role_name` | account panel | 当前空间卡片 | 枚举转文案 |
| `meta_line` | 侧栏说明 | 我的页简介 | 可直接展示 |
| `root_path` | 侧栏/技术详情 | 我的页默认目录 | 无 |
| `summary.visible_workshops_count` | `workspaceStats.workshops` | `metrics.workshops` | 无 |
| `summary.visible_runs_count` | `workspaceStats.instances` | `metrics.tasks` / pending count | Mobile 可再拆分 |
| `summary.visible_packages_count` | `workspaceStats.packages` | Creator 入口暂不展示 | 无 |

## 5. Workshop 响应投影表

| 后端建议字段 | Dashboard 字段 | Mobile 字段 | 当前差距 |
|---|---|---|---|
| `workshop_id` | `Workshop.id` | `MobileWorkshop.id` | 无 |
| `display_name` | `title` | `name` | 需要统一为 i18n 字段 |
| `cover_asset_url` | `cover` | 当前无 | Mobile 可选补缩略图 |
| `badge` | `badge` | `badge` | 无 |
| `owner_label` | 当前缺失 | `owner` | Dashboard 缺字段 |
| `audience` | `audience` | workshop detail content | 来源不统一 |
| `summary` | `summary` | `description` | 命名不同 |
| `next_action_hint` | `next` | 当前无 | Mobile 可选补轻量提示 |
| `tag_list` | `tags` | 当前无 | Mobile 缺 tags |
| `default_service_id` | `linkedService` | 当前无 | Mobile 详情需依赖后端 |

## 6. Service 响应投影表

| 后端建议字段 | Dashboard 字段 | Mobile 字段 | 当前差距 |
|---|---|---|---|
| `service_id` | `id` | `id` | 无 |
| `display_name` | `name` | `name` | 无 |
| `summary` | `summary` | `summary` | 无 |
| `auth_requirement` | `auth` | `auth` | 当前只有纯文本 |
| `duration_hint` | `eta` | `eta` | 当前缺数值化时长 |
| `target_path_hint` | `targetPath` | 当前无 | Mobile 缺字段 |
| `creator_label` | 当前无 | `detailContent.creator` | Dashboard 缺字段 |
| `risk_text` | 当前无 | `detailContent.risk` | Dashboard 缺字段 |
| `connector_items[]` | 当前无 | `detailContent.connectors` | Dashboard 缺结构化块 |
| `output_items[]` | 当前无 | `detailContent.outputs` | 双端都应统一 |
| `launch_flow_steps[]` | 当前无 | `detailContent.launchFlow` | Dashboard 缺显式步骤 |

## 7. Run List 响应投影表

| 后端建议字段 | Dashboard 列表使用 | Mobile 列表使用 | 当前前端处理 |
|---|---|---|---|
| `run_id` | 列表 key、路由 | 列表 key、打开详情 | 直接使用 |
| `title` | 卡片标题 | 卡片标题 | 直接使用 |
| `workshop_name` | 卡片副标题 | 卡片副标题 | 当前由字符串推断 |
| `workspace_name` | 过滤和摘要 | 当前空间筛选外通常不显示 | 当前由本地推断 |
| `status` | pill 与分组 | pill 与筛选 | 当前前端做 `statusMeta()` |
| `pending_approval_count` | Needs action | `approval` 状态与角标 | 当前前端统计 |
| `latest_message_text` | 摘要 | 摘要 | 当前前端从最后消息取 |
| `updated_at` | 列表排序、卡片时间 | 卡片时间 | 当前前端格式化 |
| `entry_surface` | tag | tag | 当前前端生成 `#surface` |
| `target_path` | 搜索、文件页 | 搜索、文件页 | 直接使用 |
| `attention_mode` | 分组 | 可选分组 | 当前前端自行判定 |

## 8. Run Detail 响应投影表

| 子区块 | 后端建议字段 | Dashboard 使用 | Mobile 使用 |
|---|---|---|---|
| 概览 | `status/updated_at/next_action/status_reason` | `overview.cards` | 顶部状态与阶段 |
| 对话 | `messages[]` | 中间会话流 | 完整任务对话 |
| 审批 | `approvals[]` | audit/runtime 旁路 | 对话中的 approval module |
| 结果 | `artifacts[]` | 概览、文件、结果状态 | 对话 result module + 文件页 |
| 运行态 | `runtime_summary` | runtime tab | `mounted/container` |
| 审计 | `recent_events`、`boundaries` | audit tab | 我的页通知与详情说明 |

## 9. 文件浏览响应投影表

| 后端建议字段 | Dashboard 使用 | Mobile 使用 | 前端转换 |
|---|---|---|---|
| `current_path` | 文件页标题 | 文件页路径条 | 直接使用 |
| `breadcrumbs[]` | crumb row | 当前未显式展示，可补 | 路径分段 UI |
| `path_options[]` | path chips | 底部路径选择器 | 直接使用 |
| `entries[]` | 文件列表 | 文件列表 | `kind -> pill` |
| `entries[].preview_available` | 预览按钮与文本区 | 预览按钮与文本区 | 布尔决定交互 |
| `entries[].download_allowed` | 下载按钮 | 下载按钮 | 布尔决定交互 |
| `entries[].size_bytes` | meta | meta | 格式化大小 |

## 10. Creator Package 响应投影表

| 后端建议字段 | Creator 列表/详情使用 | 当前前端来源 |
|---|---|---|
| `package_id` | 包列表、路由 | `creatorPackages.id` |
| `display_name` | 标题 | `creatorPackages.title` |
| `source_label` | 来源 | `creatorPackages.source` |
| `status` | 状态 pill | `creatorPackages.status/statusClass` |
| `release_channel` | 详情与列表摘要 | `packageMeta.releaseChannel` |
| `version_line[]` | 详情 runtime/session/release 区 | `packageMeta.versionLine` |
| `dependency_summary[]` | connectors/runtime 区 | `packageMeta.dependencies` |
| `governance_metrics[]` | rail metrics | `creatorOperationMeta/governanceMeta` |

## 11. 本地格式转换表

| 原始字段 | 前端格式转换 | 当前位置 | 建议收敛位置 |
|---|---|---|---|
| `updated_at` | `formatClock()` / `更新于 hh:mm` | `liveRunAdapters`、`liveTaskAdapters` | 统一 `formatters/time.ts` |
| `target_path` | 相对路径裁剪 | `toRelativeFileName()` | 统一 `formatters/path.ts` |
| `status` | `status -> label/class/nextAction/stage` | 两个 adapter 各自维护 | 统一 `status-presentation.ts` |
| `size_bytes` | 文本 meta 拼装 | Mobile files | 统一 `formatters/file.ts` |
| `entry_surface` | `#dashboard/#h5` | Mobile tags | 可由后端直接给 `tag_facets` |

## 12. 本地文案投影表

| 文案类别 | 当前来源 | 应保留在前端还是后端 |
|---|---|---|
| 状态说明文案 | `statusMeta()` | 前端 |
| 边界说明文案 | runtime/audit notes 常量 | 后端治理域返回 |
| 启动后追问说明 | launchFlow / system prompt 说明 | 后端目录域返回 |
| 错误恢复建议 | module message 文案 | 前端可保留模板，后端给 error code/context |
| Creator 治理摘要 | `governanceMeta` | 后端 |

## 13. 统一适配器职责表

| 适配器层 | 应负责内容 | 不应负责内容 |
|---|---|---|
| Resource Adapter | 契约对象到 ViewModel 基础映射 | 业务策略判定 |
| Presentation Adapter | `statusClass`、时间、大小、path 裁剪 | 资源身份与权限决策 |
| Page-level Composer | 拼装页签所需块顺序 | 重新推断工坊、工作区等权威字段 |

## 14. 页面组件与字段依赖表

| 页面组件 | 关键字段 |
|---|---|
| `DashboardShell` 侧栏统计 | `workspace summary`、`visible packages`、`visible workshops` |
| `WorkshopsPage` 卡片 | `badge/summary/audience/tags/default_service` |
| `WorkshopsPage` 启动台 | `service summary/auth/target_path_hint/launch_mode` |
| `InstancesPage` 列表 | `status/summary/tags/updated_at/attention_mode` |
| `InstancesPage` runtime tab | `runtime_summary.image/container/mounts/notes` |
| `TasksPage` 列表 | `status/tags/summary/updated_at` |
| `ServiceDetailPage` | `creator/risk/connectors/outputs/launch_flow` |
| `MePage` | `workspace summary/recent assets/pending actions` |

## 15. 执行顺序表

| 阶段 | 动作 | 结果 |
|---|---|---|
| Phase 1 | 把 workspace/workshop/service/package 的正式响应字段定稿 | 目录域和 Creator 域有统一字段 |
| Phase 2 | 提炼统一 `status/path/time/file` formatter | 双端展示口径统一 |
| Phase 3 | 拆 `Resource Adapter` 与 `Presentation Adapter` | 减少页面内拼装 |
| Phase 4 | 用正式目录/读模型替换本地 ViewModel 来源 | 静态模型退出主链 |
| Phase 5 | 将治理、runtime、launchFlow 等块改读后端 | 页面只负责展示 |

## 16. 阻塞项表

| 阻塞项 | 当前原因 | 影响 | 优先级 |
|---|---|---|---|
| 资源响应字段未统一 | Dashboard/Mobile 同类资源字段结构不同 | 双端适配重复 | P0 |
| 目录与 Creator 无正式响应 | 本地模型仍是主来源 | 无法建立统一 ViewModel | P0 |
| formatter 重复 | 两套 adapter 各自维护状态和路径格式化 | 展示漂移 | P1 |
| 页面内拼装过多 | search/list/detail 页面各自二次组装 | 难维护 | P1 |

## 17. 完成判定表

| 判定项 | 满足条件 |
|---|---|
| 资源字段完成 | workspace/workshop/service/run/package 均有正式响应字段定义 |
| ViewModel 收敛完成 | 双端对同类资源使用统一 ViewModel 字段语义 |
| 展示映射完成 | 时间、路径、状态、文件大小等格式化逻辑有统一实现 |
| 页面解耦完成 | 页面组件只消费 ViewModel，不再反复推断权威字段 |

## 18. 当前已验证投影基线表

| 资源类型 | 当前真实投影状态 | 证据 |
|---|---|---|
| Run Detail | 已由 `RunSnapshot` 投影到 `InstanceRecord` / `MobileTask` | `app/dashboard/src/lib/liveRunAdapters.ts`、`app/mobile/src/lib/liveTaskAdapters.ts` |
| Message 展示 | 已由 adapter 把 `role/createdAt/text` 投影为页面消息项 | `app/dashboard/src/lib/liveRunAdapters.ts`、`app/mobile/src/lib/liveTaskAdapters.ts` |
| 文件展示 | 已由 `RunFileEntry[]` 投影出 `paths/items/files/pathOptions` | `app/dashboard/src/lib/liveRunAdapters.ts`、`app/mobile/src/lib/liveTaskAdapters.ts` |
| 状态展示 | 已有双端各自 `statusMeta()` 投影 | `app/dashboard/src/lib/liveRunAdapters.ts`、`app/mobile/src/lib/liveTaskAdapters.ts` |
| Workspace/Workshop/Service | 当前仍直接消费本地模型 | `app/dashboard/src/data/dashboardData.ts`、`app/mobile/src/data/mobileData.ts` |
| Creator Package | 当前仍直接消费本地模型 | `app/dashboard/src/data/dashboardData.ts`、`app/dashboard/src/pages/creator/CreatorPage.tsx` |

## 19. 当前不可宣称完成的展示映射表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| 统一 formatter 层 | 未完成 | 时间、路径、状态、文件 meta 仍分散在两个 adapter 和页面里 |
| 统一 Resource Adapter 层 | 未完成 | Dashboard 与 Mobile 仍各自维护投影逻辑 |
| Workspace/Workshop/Service ViewModel | 未完成 | 没有后端正式响应可投影 |
| Runtime Summary ViewModel | 未完成 | runtime tab 主要依赖前端静态文案 |
| Creator ViewModel | 未完成 | Creator 域没有正式接口对象 |
| 文件浏览展示模型 | 未完成 | 后端未返回 `breadcrumbs/pathOptions/previewAllowed/downloadAllowed` 正式字段 |

## 20. 展示映射收口顺序表

| 阶段 | 动作 | 结果 |
|---|---|---|
| Phase 1 | 抽统一 `status/time/path/file` formatter | 双端展示口径一致 |
| Phase 2 | 抽共享 Run adapter 层 | `InstanceRecord` / `MobileTask` 只保留端侧差异 |
| Phase 3 | 补目录域响应字段并建立 Workspace/Workshop/Service VM | 工坊与我的页脱离静态模型 |
| Phase 4 | 补 Creator / Runtime / Notification 响应对象 | 面板级静态说明退出主链 |
| Phase 5 | 页面仅消费 ViewModel | 页面内二次推断与拼装收敛 |
