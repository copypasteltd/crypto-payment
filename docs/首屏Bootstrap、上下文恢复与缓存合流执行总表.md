# 灵办词元 首屏Bootstrap、上下文恢复与缓存合流执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 首屏Bootstrap、上下文恢复与缓存合流执行总表 |
| 适用范围 | `app/dashboard`、`app/mobile`、`packages/api-sdk`、`app/api`、未来 `auth/workspace/preferences` 正式域 |
| 统计日期 | 2026-07-08 |
| 当前依据 | `AppProviders.tsx`、`app.tsx`、`dashboardUiStore.ts`、`mobileUiStore.ts`、`DashboardShell.tsx`、`pages/tasks/detail.tsx`、`docs/认证初始化、会话刷新与工作区切换执行总表.md`、`docs/页面路由、数据装载与守卫执行总表.md`、`docs/Query缓存、实时合流与失效执行总表.md`、`docs/账户偏好、主题语言与本地持久化执行总表.md` |
| 输出目标 | 统一首屏启动时本地恢复、会话探测、工作区确认、路由恢复、Query hydration、realtime 恢复与失败分支处理 |

## 2. 当前首屏事实表

| 终端 | 当前启动入口 | 当前动作 | 当前缺口 |
|---|---|---|---|
| Dashboard | `AppProviders` + `DashboardShell` | 创建 `QueryClient`、`BrowserRouter`、`I18nextProvider`，随后直接渲染页面 | 缺 `auth bootstrap`、缺 workspace context bootstrap、缺 cache hydrate |
| Mobile H5 | `app.tsx` | 创建 `QueryClient`，设置标题和主题 | 缺 `auth bootstrap`、缺 route restore、缺 workspace context hydrate |
| Dashboard Store | `dashboardUiStore.ts` | 从本地读取 theme/lang/workspace/instanceDrafts | 仅本地恢复，无法校验用户与工作区合法性 |
| Mobile Store | `mobileUiStore.ts` | 从 Taro/localStorage 读取 theme/workspace/taskDrafts | 仅本地恢复，无法校验会话与 workspace membership |
| Query 层 | 双端 `QueryClient` 默认内存缓存 | `retry:1`、`staleTime:30000` | 不持久化、不区分 bootstrap 阶段 |

## 3. Bootstrap 数据源清单表

| 数据源 | 当前可用性 | 当前载体 | 用途 |
|---|---|---|---|
| 本地 UI 偏好 | 已有 | `localStorage` / `Taro storage` | 首屏主题、语言、工作区候选恢复 |
| 本地草稿 | 已有 | `instanceDrafts` / `taskDrafts` | 输入框内容恢复 |
| 本地路由上下文 | 无 | 无 | 刷新后无法恢复最近页面 |
| 服务端当前用户 | 未实现 | 未来 `GET /v1/auth/me` | 会话、成员关系、默认工作区 |
| 服务端工作区上下文 | 未实现 | 未来 `/v1/me/workspace-context/:workspaceId` | 最近路由、最近任务、最近包 |
| 内存 Query 缓存 | 已有 | React Query | 同页刷新前的运行态缓存 |
| 实时通道 backlog | 部分有契约 | WS/SSE snapshot/event | run 详情与消息恢复 |

## 4. 字段级恢复优先级表

| 字段 | 本地值 | 服务端值 | 最终优先级 | 原因 |
|---|---|---|---|---|
| `theme` | 有 | 未来有 | 本地先渲染，服务端成功后按更新时间覆盖 | 首屏体验优先 |
| `lang` | Dashboard 有 | 未来有 | 本地先渲染，服务端覆盖 | 避免首屏语言闪烁 |
| `currentWorkspaceId` | 有 | 未来有 `default_workspace_id` / membership | 服务端合法 workspace 优先 | 避免进入无权限空间 |
| `lastRoute` | 当前无 | 未来有 | 服务端优先，本地可缓存副本 | 跨设备恢复需要服务端权威 |
| `lastRunId` | 当前无 | 未来有 | 服务端优先 | 需要校验当前 workspace 下仍可见 |
| `lastPackageId` | 当前无 | 未来有 | 服务端优先 | Creator 页面需权限校验 |
| 输入草稿 | 有 | 未来可选 | 高敏默认本地优先；低中敏可双向合并 | 降低敏感信息外泄面 |
| Query 缓存 | 有内存值 | 无正式服务端对象 | 仅作为性能层 | 不得覆盖权威业务状态 |

## 5. Dashboard 首屏Bootstrap执行表

| 步骤 | 当前状态 | 正式动作 | 输出 |
|---|---|---|---|
| Step 1 | 读取本地 store | 继续读取 theme/lang/workspace/drafts | 可立即渲染的本地 UI |
| Step 2 | 无 | 启动 `auth bootstrap query` | `currentUser`、`memberships`、`defaultWorkspace` |
| Step 3 | 无 | 拉 `workspace context` | `lastRoute`、`lastRunId`、`lastPackageId` |
| Step 4 | 无 | 合并本地偏好与服务端偏好 | 最终 `bootstrapState` |
| Step 5 | 路由已先渲染 | 在 bootstrap 完成前显示 loading shell | 首屏无越权闪烁 |
| Step 6 | 各页自行 query | 根据最终 workspace 预取目录、runs、profile summary | 首屏数据预热 |
| Step 7 | 进入实例页后再开 realtime | 若恢复目标是 run 详情，则在权限确认后重连 realtime | 对话上下文恢复 |

## 6. Mobile H5 首屏Bootstrap执行表

| 步骤 | 当前状态 | 正式动作 | 输出 |
|---|---|---|---|
| Step 1 | 读取 theme/workspace/taskDrafts | 保留 | 本地首屏可渲染 |
| Step 2 | 无 | 拉 `/v1/auth/me` | 当前用户与空间权限 |
| Step 3 | 无 | 拉 `/v1/me/preferences` 与 workspace context | 默认空间、最近任务、最近页签 |
| Step 4 | 当前直接展示工坊页 | 若登录态未知则显示 boot splash | 避免页面先显示错误空间内容 |
| Step 5 | 无 | 预取 `workshops/services/runs/me summary` | H5 首屏快速进入可用态 |
| Step 6 | 任务详情进入后才连 realtime | 若需恢复上次任务，则在 workspace 与 run 权限确认后重连 | 恢复完整对话 |

## 7. 路由恢复目标矩阵表

| Surface | 恢复目标 | 恢复前提 | 不满足时回退 |
|---|---|---|---|
| Dashboard 工坊 | `/workshops` 或最后浏览的 workshop/service | 当前 workspace 仍可见该目录对象 | 回退当前 workspace 工坊首页 |
| Dashboard 实例 | `/instances/:runId/:tab?` | `runId` 属于当前 workspace 且用户有可见权限 | 回退实例列表第一个可见 run |
| Dashboard Creator | `/creator/packages/:packageId/...` | 用户具备 Creator/Governance 权限 | 回退 Creator 总览或 403 |
| Mobile 工坊 | `/pages/workshops/index` | 默认入口永远可达 | 不恢复到敏感页 |
| Mobile 任务 | `/pages/tasks/detail?id=:runId` | `runId` 当前 workspace 可见 | 回退任务列表 |
| Mobile 文件页 | `/pages/tasks/files?id=:runId&path=...` | `runId` 可见且 `path` 在目标路径白名单内 | 回退任务详情 |

## 8. Query预取与Hydration表

| 阶段 | Dashboard | Mobile | 说明 |
|---|---|---|---|
| bootstrap 完成后 | 预取 `auth/workspace/workshops/services/runs/me summary` | 预取 `auth/workspace/workshops/services/runs/me summary` | 保证首屏主体数据一致 |
| 恢复到实例/任务详情 | 预取 `run detail/files` | 预取 `run detail/files` | 减少进入详情后的白屏等待 |
| 恢复到 Creator | 预取 `packages/releases/governance summary` | 不适用 | Creator 为 Dashboard 专属 |
| 恢复失败 | 清空目标详情 query，保留基础列表 query | 同左 | 防止旧详情污染 |

## 9. Bootstrap状态机表

| 状态 | 含义 | 进入条件 | 可流向 |
|---|---|---|---|
| `local_restored` | 本地 key 已读取 | App 启动 | `auth_loading` |
| `auth_loading` | 正在确认当前会话 | 发起 `/v1/auth/me` 或 refresh | `workspace_loading`、`auth_failed` |
| `workspace_loading` | 正在确认工作区与上下文 | 会话确认成功 | `cache_hydrating`、`workspace_failed` |
| `cache_hydrating` | 正在预取首屏关键 query | workspace context 可用 | `route_restoring`、`partial_ready` |
| `route_restoring` | 正在恢复最后页面 | 关键 query 已有结果 | `ready`、`partial_ready` |
| `partial_ready` | 局部数据不足但可继续使用 | query 部分失败 | `ready`、`error` |
| `ready` | 首屏恢复完成 | 页面可交互 | 终态 |
| `auth_failed` | 会话不可用 | `/auth/me`、refresh 均失败 | `login_redirect` |
| `workspace_failed` | workspace 无效或已失效 | membership 不匹配 | `workspace_picker` |

## 10. 失败分支与回退表

| 失败场景 | 当前行为 | 正式行为 |
|---|---|---|
| `/v1/auth/me` 401 | 当前无 | 清理仅需清理的会话缓存，跳登录页 |
| 本地 workspace 不属于 memberships | 当前仍会按本地值渲染 | 强制切换到服务端默认 workspace |
| 最近 run 不再可见 | 当前可能回退到静态任务 | 清空该 `lastRunId`，回退当前空间任务列表 |
| Creator package 无权限 | 当前路由可直接进入 | 403 或 Creator 总览空态 |
| bootstrap query 部分失败 | 当前页面各自 `catch null` | 进入 `partial_ready`，显示可重试 banner |

## 11. Realtime恢复门控表

| 场景 | 当前行为 | 正式门控条件 |
|---|---|---|
| Dashboard 实例页 | 只要 `isLiveRunId` 即尝试连接 | `bootstrap.ready` 且 `run scope granted` |
| Mobile 任务详情 | 只要 live run 即尝试连接 | `bootstrap.ready` 且 `workspace confirmed` |
| 工作区切换后 | 当前无统一重连编排 | 先断旧 run stream，再按新 workspace 允许范围恢复 |
| 会话刷新后 | 当前无统一处理 | 先刷新 token，再恢复 realtime |

## 12. 冲突合并规则表

| 冲突类型 | 示例 | 合并规则 |
|---|---|---|
| 本地 workspace 与服务端 default workspace 冲突 | 本地是 `personal`，服务端默认改为 `brand-lab` | 以服务端合法 workspace 为准，并记录一次 context rewrite |
| 本地主题与服务端主题冲突 | 本地 `dark`，服务端 `light` | 以更新时间较新的值为准 |
| 本地草稿与服务端草稿冲突 | 同一 run 两端均有修改 | 高敏仅保留本地；低中敏按 `updated_at` 合并 |
| 本地最近路由已失效 | 指向已下线 package | 清空失效 route，回退安全入口 |
| Query 缓存与实时 snapshot 冲突 | 旧缓存状态 `RUNNING`，新 snapshot `SUCCEEDED` | 以最新 snapshot/event 为准 |

## 13. 切流执行表

| 阶段 | 执行动作 | 影响模块 | 当前状态 |
|---|---|---|---|
| Phase 1 | 在双端引入 `bootstrap state` 与 loading shell | `app/dashboard`、`app/mobile` | 未开始 |
| Phase 2 | 新增 `/v1/auth/me`、`/v1/me/preferences`、`/v1/me/workspace-context/:workspaceId` 统一 bootstrap query | `app/api`、`packages/api-sdk` | 未开始 |
| Phase 3 | 把本地 `workspaceId` 从权威值降级为候选恢复值 | 双端 store | 未开始 |
| Phase 4 | 为 Dashboard/Mobile 增加 route restore 与失败回退策略 | 双端路由层 | 未开始 |
| Phase 5 | 为 run 详情恢复增加 `run detail/files` 预取与 realtime 恢复门控 | 双端 run 页面 | 未开始 |
| Phase 6 | 为 bootstrap 失败引入 `partial_ready`、`login_redirect`、`workspace_picker` 分支 | 双端 shell | 未开始 |

## 14. 验收判定表

| 验收项 | 判定标准 |
|---|---|
| 首屏恢复正确 | 同一用户刷新后恢复到合法的工作区与最近上下文 |
| 无越权闪烁 | bootstrap 未完成前不会先渲染无权限页面内容 |
| 路由恢复可控 | 失效 run、失效 package、失效 path 都会安全回退 |
| Realtime 恢复稳定 | 只有在权限和 workspace 确认后才重连实时通道 |
| 缓存一致性 | bootstrap 后 Query 缓存与最新 snapshot 不冲突 |

## 15. 当前阻塞表

| 阻塞项 | 影响 | 优先级 |
|---|---|---|
| 无 `/v1/auth/me` 与 workspace context 正式接口 | 无法形成权威 bootstrap 链 | P0 |
| 双端无 loading shell 与 bootstrap state | 首屏恢复无法受控 | P0 |
| Query 仍以页面局部装载为主 | 无法统一预取和恢复策略 | P1 |
| 最近路由、最近 run、最近 package 目前无正式持久化 | 无法形成稳定上下文恢复 | P1 |

## 16. 当前已验证 Bootstrap 基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| Dashboard 启动壳 | 已初始化 `QueryClient`、`BrowserRouter`、`I18nextProvider` | `app/dashboard/src/app/providers/AppProviders.tsx` |
| Mobile 启动壳 | 已初始化 `QueryClient`，并在 `app.tsx` 应用标题与主题 | `app/mobile/src/app.tsx` |
| Dashboard 本地恢复 | 已恢复 `theme/lang/workspace/instanceDrafts` | `app/dashboard/src/stores/dashboardUiStore.ts` |
| Mobile 本地恢复 | 已恢复 `theme/workspace/taskDrafts` | `app/mobile/src/stores/mobileUiStore.ts` |
| 首屏标题/主题应用 | Dashboard/Mobile 都会在副作用中更新 `document.title` 与主题变量 | `app/dashboard/src/app/DashboardShell.tsx`、`app/mobile/src/app.tsx` |
| Query 默认策略 | 双端都是 `retry:1`、`staleTime:30000` 的内存缓存 | `app/dashboard/src/app/providers/AppProviders.tsx`、`app/mobile/src/app.tsx` |

## 17. 当前不可宣称完成的 Bootstrap 能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| 认证启动链 | 未实现 | 没有 `/v1/auth/me`、refresh、login redirect |
| 工作区上下文恢复 | 未实现 | 没有服务端 `workspace context` 权威对象 |
| 最近路由恢复 | 未实现 | 当前没有 `lastRoute/lastRunId/lastPackageId` 正式持久化 |
| 首屏 loading shell | 未实现 | 应用会直接渲染页面，不等待 bootstrap 状态 |
| Query hydration/persist | 未实现 | 当前只有内存缓存，没有持久化与预取编排 |
