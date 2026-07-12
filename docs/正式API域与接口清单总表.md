# 灵办词元 正式API域与接口清单总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 正式API域与接口清单总表 |
| 适用范围 | `app/api`、`packages/contracts`、`packages/api-sdk`、`app/dashboard`、`app/mobile` |
| 统计日期 | 2026-07-09 |
| 统计口径 | 以当前代码已实现接口、当前前端实际调用接口、以及正式系统目标接口域为准 |
| 直接证据 | `app/api/src/app/create-server.ts`、`app/api/src/modules/runs/routes.ts`、`app/api/src/modules/bridge/routes.ts`、`app/api/src/modules/realtime/socket-routes.ts`、`packages/contracts/src/runs.ts`、`packages/contracts/src/bridge.ts`、`packages/contracts/src/realtime.ts`、`packages/api-sdk/src/index.ts` |
| 输出目标 | 统一说明当前已实现接口、协议边界、SDK覆盖情况、正式系统仍需补齐的接口域 |

## 2. 当前已实现 HTTP 接口总表

### 2.1 公共 HTTP 接口

| 域 | Method | Path | 请求模型 | 响应模型 | 当前用途 | 当前消费方 | 实现位置 | 当前状态 |
|---|---|---|---|---|---|---|---|---|
| 健康检查 | `GET` | `/health` | 无 | `{ status: "ok", service: "api" }` | 存活探针 | 运行环境、未来反向代理/监控 | `app/api/src/app/create-server.ts` | 已实现 |
| 我的摘要 | `GET` | `/v1/me/summary` | 无 | `MeProfileSummary` | 拉取当前账号、当前工作区与 profile metrics | Mobile 我的页 | `app/api/src/modules/me/routes.ts` | 已实现 |
| 我的资产 | `GET` | `/v1/me/assets` | `ListMeAssetsQuery` | `MeAssetListResponse` | 拉取当前工作区最近资产与分类统计 | Mobile 我的页 | `app/api/src/modules/me/routes.ts` | 已实现 |
| 我的授权摘要 | `GET` | `/v1/me/authorizations` | `ListMeAuthorizationsQuery` | `MeAuthorizationSummary` | 拉取凭证、MCP、quota、billing 摘要 | Mobile 我的页 | `app/api/src/modules/me/routes.ts` | 已实现 |
| 我的收藏工坊 | `GET` | `/v1/me/favorites/workshops` | `ListMeFavoriteWorkshopsQuery` | `MeFavoriteWorkshopListResponse` | 拉取当前工作区收藏工坊列表 | Mobile 工坊页、我的页 | `app/api/src/modules/me/routes.ts` | 已实现 |
| 收藏工坊切换 | `PUT` | `/v1/me/favorites/workshops/:workshopId` | `SetMeFavoriteWorkshopInput` | `SetMeFavoriteWorkshopResult` | 收藏或取消收藏当前可见工坊 | Mobile 工坊页、我的页 | `app/api/src/modules/me/routes.ts` | 已实现 |
| 通知列表 | `GET` | `/v1/notifications` | `ListNotificationsQuery` | `NotificationRecord[]` | 拉取当前工作区通知中心 | Dashboard 顶栏、Mobile 我的页 | `app/api/src/modules/notifications/routes.ts` | 已实现 |
| 通知摘要 | `GET` | `/v1/notifications/summary` | 无 | `NotificationSummary` | 拉取当前工作区未读统计 | Dashboard 顶栏、Mobile 我的页 | `app/api/src/modules/notifications/routes.ts` | 已实现 |
| 通知单条已读 | `POST` | `/v1/notifications/:notificationId/read` | `notificationId` path | `NotificationRecord` | 标记单条通知已读 | Dashboard 顶栏、Mobile 我的页 | `app/api/src/modules/notifications/routes.ts` | 已实现 |
| 通知全部已读 | `POST` | `/v1/notifications/read-all` | 无 | `NotificationSummary` | 一次性清空当前工作区未读 | Dashboard 顶栏 | `app/api/src/modules/notifications/routes.ts` | 已实现 |
| Run 列表 | `GET` | `/v1/runs` | 无 | `RunSnapshot[]` | 拉取实例列表 | Dashboard 实例页、Mobile 任务页、Mobile 我的页 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 创建 | `POST` | `/v1/runs` | `CreateRunInput` | `CreateRunResponse` | 实例化运行 | Dashboard 工坊页、Mobile 服务详情页 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 详情 | `GET` | `/v1/runs/:runId` | `runId` path | `RunSnapshot` | 拉取单实例详情 | Dashboard 实例详情、Mobile 任务详情、Mobile 文件页 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 文件列表 | `GET` | `/v1/runs/:runId/files` | `runId` path | `RunFileEntry[]` | 读取聚合快照中的文件数组 | 预留；当前主界面更常用 tree 版 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 文件树 | `GET` | `/v1/runs/:runId/files/tree` | `runId` path | `RunFileEntry[]` | 动态扫描 `targetPath` 下文件树 | Dashboard 文件页、Mobile 文件页 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 文件状态 | `GET` | `/v1/runs/:runId/files/stat` | `runId` path + `?path=` | `RunFileEntry` | 查询单文件元数据 | 预留正式前端细化能力 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 文件读取 | `GET` | `/v1/runs/:runId/files/read` | `runId` path + `?path=` | `RunFileReadResponse` | 读取文本文件内容 | Dashboard 文件预览、Mobile 文件预览 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 文件下载 | `GET` | `/v1/runs/:runId/files/download` | `runId` path + `?path=` | 文件流 | 下载目标路径下文件 | Dashboard、Mobile 手工拼接 URL 下载 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 消息发送 | `POST` | `/v1/runs/:runId/messages` | `SendRunMessageInput` | `RunSnapshot` | 向运行中的 Codex 会话追加用户消息 | Dashboard 实例对话、Mobile 任务对话 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 审批 | `POST` | `/v1/runs/:runId/approvals` | `ApproveRunInput` | `RunSnapshot` | 提交审批结果 | SDK 已封装；UI 侧可接入 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 审批兼容别名 | `POST` | `/v1/runs/:runId/approve` | `ApproveRunInput` | `RunSnapshot` | 兼容旧调用路径 | 预留兼容层 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run 取消 | `POST` | `/v1/runs/:runId/cancel` | `{ reason?: string }` | `RunSnapshot` | 停止实例 | SDK 已封装；UI 侧可接入 | `app/api/src/modules/runs/routes.ts` | 已实现 |
| Run SSE 流 | `GET` | `/v1/runs/:runId/stream` | `runId` path | `text/event-stream` | WebSocket 不可用时的回退实时通道 | Dashboard、Mobile 运行流 fallback | `app/api/src/modules/runs/routes.ts` | 已实现 |

### 2.2 WebSocket 实时接口

| 通道 | 方向 | 消息类型 | 请求/载荷 | 返回/载荷 | 当前用途 | 当前消费方 | 契约位置 | 当前状态 |
|---|---|---|---|---|---|---|---|---|
| `/ws/runs/:runId` | Client -> Server | `runs.subscribe` | `{ runId }` | `runs.snapshot` + `runs.ack` | 首次订阅 run | Dashboard、Mobile | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Client -> Server | `runs.sendMessage` | `{ runId, payload: SendRunMessageInput }` | `runs.ack`，后续通过 `runs.event` 推送消息事件 | 对话消息实时发送 | Dashboard、Mobile | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Client -> Server | `runs.approve` | `{ runId, payload: ApproveRunInput }` | `runs.ack`，后续通过 `runs.event` 推送状态/消息事件 | 审批动作实时提交 | 预留正式 UI | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Client -> Server | `runs.cancel` | `{ runId, reason? }` | `runs.ack`，后续通过 `runs.event` 推送状态变化 | 取消实例 | 预留正式 UI | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Server -> Client | `runs.snapshot` | 无 | `RunSnapshot` | 建立连接时推送完整快照 | Dashboard、Mobile | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Server -> Client | `runs.event` | 无 | `BridgeEvent` | 事件增量推送 | Dashboard、Mobile | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Server -> Client | `runs.ack` | 无 | `{ runId, ok }` | 对订阅/消息/审批/取消动作确认 | Dashboard、Mobile | `packages/contracts/src/realtime.ts` | 已实现 |
| `/ws/runs/:runId` | Server -> Client | `runs.error` | 无 | `{ runId?, error }` | 返回解析/权限/路径错误 | Dashboard、Mobile | `packages/contracts/src/realtime.ts` | 已实现 |

### 2.3 Bridge 内部接口

| 域 | Method | Path | 请求模型 | 响应/副作用 | 当前用途 | 当前调用方 | 实现位置 | 当前状态 |
|---|---|---|---|---|---|---|---|---|
| Bridge 注册 | `POST` | `/internal/bridges/register` | `BridgeRegistration` | 注册连接并刷新待发命令 | 运行容器内 bridge 接入 API | `app/container-bridge` | `app/api/src/modules/bridge/routes.ts` | 已实现 |
| Bridge 事件批量回传 | `POST` | `/internal/runs/:runId/events` | `{ events: BridgeEvent[] }` | 聚合写入 run 快照并广播事件 | 容器侧批量同步状态、消息、文件事件 | `app/container-bridge` | `app/api/src/modules/bridge/routes.ts` | 已实现 |
| Bridge 状态同步 | `POST` | `/internal/runs/:runId/status` | `RunStatusUpdate` | 直接同步 run 状态 | 运行时单点更新状态 | `app/container-bridge`、未来 worker | `app/api/src/modules/bridge/routes.ts` | 已实现 |
| Bridge 产物同步 | `POST` | `/internal/runs/:runId/artifacts` | `{ artifacts: RunArtifact[] }` | Upsert 产物数组并广播 `artifact.ready` | 结果包与回执同步 | `app/container-bridge` | `app/api/src/modules/bridge/routes.ts` | 已实现 |

## 3. 当前协议对象与接口域绑定总表

| 契约对象 | 当前位置 | 被哪些接口使用 | 当前作用 |
|---|---|---|---|
| `CreateRunInput` | `packages/contracts/src/runs.ts` | `POST /v1/runs`、`createRun()` SDK | 定义实例化时的 workspace、task、session、入口面和 bindings |
| `RunRecord` | `packages/contracts/src/runs.ts` | 所有 `RunSnapshot.run`、内部持久化 | 定义运行实例元数据 |
| `RunSnapshot` | `packages/contracts/src/runs.ts` | `GET /v1/runs*`、WS `runs.snapshot` | 对外统一运行快照 |
| `RunConversationMessage` | `packages/contracts/src/runs.ts` | `conversation.message`、`sendRunMessage` | 定义完整对话消息单元 |
| `RunFileEntry` | `packages/contracts/src/runs.ts` | 文件树、文件 stat、文件 read、artifact/file events | 定义文件元信息 |
| `RunArtifact` | `packages/contracts/src/runs.ts` | 产物同步、artifact 事件 | 定义交付产物单元 |
| `RunApproval` | `packages/contracts/src/runs.ts` | 审批数组、`approval.requested`、审批写回 | 定义审批对象 |
| `BridgeRegistration` | `packages/contracts/src/bridge.ts` | `/internal/bridges/register` | 定义运行中 bridge 的注册元信息 |
| `RunControlCommand` | `packages/contracts/src/bridge.ts` | API -> bridge 的控制通道 | 定义 sendMessage/approve/cancel/ping/syncFiles/flushArtifacts |
| `BridgeEvent` | `packages/contracts/src/bridge.ts` | `/internal/runs/:runId/events`、WS/SSE 增量事件 | 定义运行中状态、文件、产物、消息、失败事件 |
| `ClientRealtimeMessage` | `packages/contracts/src/realtime.ts` | `/ws/runs/:runId` | 定义前端向实时通道发送的动作 |
| `ServerRealtimeMessage` | `packages/contracts/src/realtime.ts` | `/ws/runs/:runId`、`/v1/runs/:runId/stream` | 定义服务端向前端推送的统一消息 |
| `NotificationRecord` | `packages/contracts/src/notifications.ts` | `/v1/notifications*` | 定义正式通知对象、深链目标与已读状态 |
| `NotificationSummary` | `packages/contracts/src/notifications.ts` | `/v1/notifications/summary` | 定义未读计数与类型汇总 |
| `MeProfileSummary` | `packages/contracts/src/me.ts` | `/v1/me/summary` | 定义当前账号、当前工作区、workspace metrics 与 profile metrics |
| `MeAssetListResponse` | `packages/contracts/src/me.ts` | `/v1/me/assets` | 定义我的资产列表、分类统计与深链目标 |
| `MeAuthorizationSummary` | `packages/contracts/src/me.ts` | `/v1/me/authorizations` | 定义凭证、MCP、quota、billing 聚合摘要 |
| `MeFavoriteWorkshopListResponse` | `packages/contracts/src/me.ts` | `/v1/me/favorites/workshops` | 定义收藏工坊列表、深链目标与统计 |
| `SetMeFavoriteWorkshopResult` | `packages/contracts/src/me.ts` | `PUT /v1/me/favorites/workshops/:workshopId` | 定义收藏切换结果与回填对象 |

## 4. 当前 SDK 覆盖情况总表

| 能力 | 后端接口 | SDK 方法 | 前端当前使用情况 | 当前结论 |
|---|---|---|---|---|
| Run 列表 | `GET /v1/runs` | `listRuns()` | Dashboard、Mobile 已用 | 已对齐 |
| Run 创建 | `POST /v1/runs` | `createRun()` | Dashboard、Mobile 已用 | 已对齐 |
| Run 详情 | `GET /v1/runs/:runId` | `getRun()` | Dashboard、Mobile 已用 | 已对齐 |
| 文件列表 | `GET /v1/runs/:runId/files` | `listRunFiles()` | 当前主界面未主用 | 已封装但前端主流程较少使用 |
| 文件树 | `GET /v1/runs/:runId/files/tree` | `listRunFileTree()` | Dashboard、Mobile 已用 | 已对齐 |
| 文件状态 | `GET /v1/runs/:runId/files/stat` | `statRunFile()` | 预留正式文件中心 | 已对齐 |
| 文件读取 | `GET /v1/runs/:runId/files/read` | `readRunFile()` | Dashboard、Mobile 已用 | 已对齐 |
| 文件下载 | `GET /v1/runs/:runId/files/download` | 无 | Dashboard、Mobile 手工拼接 URL | SDK 缺口 |
| 消息发送 | `POST /v1/runs/:runId/messages` | `sendRunMessage()` | Dashboard、Mobile 已用 | 已对齐 |
| 审批提交 | `POST /v1/runs/:runId/approvals` | `approveRun()` | UI 接入位已具备 | 已对齐 |
| Run 取消 | `POST /v1/runs/:runId/cancel` | `cancelRun()` | UI 接入位已具备 | 已对齐 |
| WebSocket 实时 | `/ws/runs/:runId` | `createRunsRealtimeClient()` | Dashboard、Mobile 已用 | 已对齐 |
| SSE 回退 | `GET /v1/runs/:runId/stream` | 无统一 SDK 抽象 | Dashboard、Mobile 各自维护 fallback | SDK 缺口 |
| 通知列表 | `GET /v1/notifications` | `listNotifications()` | Dashboard、Mobile 已用 | 已对齐 |
| 通知摘要 | `GET /v1/notifications/summary` | `getNotificationSummary()` | Dashboard、Mobile 已用 | 已对齐 |
| 通知已读 | `POST /v1/notifications/:notificationId/read` | `markNotificationRead()` | Dashboard、Mobile 已用 | 已对齐 |
| 全部已读 | `POST /v1/notifications/read-all` | `markAllNotificationsRead()` | Dashboard 已用 | 已对齐 |
| 我的摘要 | `GET /v1/me/summary` | `getSummary()` | Mobile 已用 | 已对齐 |
| 我的资产 | `GET /v1/me/assets` | `listAssets()` | Mobile 已用 | 已对齐 |
| 我的授权摘要 | `GET /v1/me/authorizations` | `getAuthorizationSummary()` | Mobile 已用 | 已对齐 |
| 我的收藏工坊 | `GET /v1/me/favorites/workshops` | `listFavoriteWorkshops()` | Mobile 已用 | 已对齐 |
| 收藏工坊切换 | `PUT /v1/me/favorites/workshops/:workshopId` | `setFavoriteWorkshop()` | Mobile 已用 | 已对齐 |

## 4.1 当前已验证 API 基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| HTTP 注册入口 | 当前已注册 `/health`、`/readyz`、`/v1/auth/*`、`/v1/workspaces*`、`/v1/me/*`、`/v1/notifications*`、`/v1/runs*`、`/v1/workshops*`、`/v1/services*`、`/v1/packages*`、`/v1/downloads*` 与 `/internal/*`，其中 `/v1/me/favorites/workshops` 已进入正式 me 域 | `app/api/src/app/create-server.ts` |
| WebSocket 注册入口 | 当前只注册 `/ws/runs/:runId` | `app/api/src/modules/realtime/socket-routes.ts` |
| 已实现业务域 | `runs / files / realtime / internal bridge` | `app/api/src/modules/*` 当前目录结构 |
| SDK HTTP 覆盖 | 已覆盖 runs 主链与文件 tree/read/stat | `packages/api-sdk/src/index.ts` |
| SDK Realtime 覆盖 | 已覆盖 subscribe/sendMessage/approve/cancel + snapshot/event/ack/error | `packages/api-sdk/src/index.ts` |
| Dashboard 当前消费 | 已消费 runs list/create/get/file tree/read + realtime | `app/dashboard/src/lib/api.ts`、`src/lib/runStream.ts`、`src/pages/instances/*` |
| Mobile 当前消费 | 已消费 runs list/create/get/file tree/read + realtime | `app/mobile/src/lib/api.ts`、`src/lib/runStream.ts`、`src/pages/tasks/*`、`src/pages/services/detail.tsx` |
| 构建验证 | API、SDK、Dashboard、Mobile 当前均可构建 | 本轮 `pnpm build:backend`、`pnpm -C app/dashboard build`、`pnpm -C app/mobile build:h5` |

## 5. 正式系统目标 API 域补齐总表

| API 域 | 建议主路径 | 核心资源 | 目标作用 | 当前现状 | 优先级 |
|---|---|---|---|---|---|
| 认证与会话 | `/v1/auth/*` | 注册、登录、刷新、登出、当前 session、我的邀请 | 支撑多用户、移动端、小程序、Dashboard 登录态 | 已实现基础闭环；SSO / miniapp 登录、session revoke 与细粒度审计未补齐 | P0 |
| 工作区与成员 | `/v1/workspaces/*` | 工作区、成员、角色、切换、邀请治理 | 支撑个人/企业空间、Creator 权限边界 | 已实现列表、summary、切换、成员与邀请治理；偏好与更深治理未补齐 | P0 |
| 工坊目录 | `/v1/workshops/*` | Workshop、Service、入口元数据 | 替换前端本地工坊目录和服务列表 | 已实现只读目录与 launch-template；正式治理与写入未补齐 | P0 |
| Session Package / Creator 包 | `/v1/packages/*` | Package、版本、依赖、发布单 | 支撑 creator 工作台正式化 | 已实现只读列表/详情/release/replay 基础接口；写入、发布、治理未补齐 | P0 |
| Release / Replay | `/v1/releases/*`、`/v1/replays/*` | 发布单、回放摘要、diff | 支撑发布审核、调试回放、审计回溯 | 仅存在包内嵌套只读摘要，独立正式域仍缺失 | P0 |
| 凭证管理 | `/v1/credentials/*` | Workspace credential、provider ref、rotation | 支撑 MCP、image key、第三方连接器私钥治理 | 已实现基础 CRUD 与 rotation；broker/KMS/review 未补齐 | P0 |
| MCP 注册治理 | `/v1/connectors/*`、`/v1/mcps/*` | 第一方/托管/第三方 MCP、策略、白名单 | 支撑不受控第三方 MCP 接入与治理 | 已实现 `mcps / mcp-bindings` 基础治理；BYO-MCP 出网治理、review、探活未补齐 | P0 |
| 文件上传与对象存储 | `/v1/uploads/*`、`/v1/files/*` | 上传、分片、预签名、归档 | 支撑材料上传、结果归档、跨端下载 | 已实现 run-scoped 上传、preview、download ticket 与对象存储回源；全局文件域未补齐 | P0 |
| 审计与账本 | `/v1/audit/*` | 审计事件、审批记录、执行账本 | 满足企业可追溯要求 | 完全缺失 | P0 |
| 配额与计费 | `/v1/quotas/*`、`/v1/billing/*` | workspace quota、package quota、usage ledger | 支撑重度用户、creator 和企业计费 | 已实现基础 policy/counter/event/override 与 billing ledger；更深审计、结算和运营域未补齐 | P1 |
| 运维控制 | `/v1/admin/*`、`/v1/runtime/*` | 运行实例查询、容器策略、事件重放 | 支撑运维和平台治理 | 完全缺失 | P1 |

## 6. 当前接口域与正式系统之间的生产阻塞表

| 阻塞项 | 具体表现 | 直接影响 | 建议处理顺序 |
|---|---|---|---|
| 认证/RBAC 仍未全域闭环 | 核心接口已具备用户身份与工作区边界，但前端守卫、审计与更细权限仍未收口 | 影响正式多用户开放 | 1 |
| 工坊目录前端仍有静态回退 | `workshops/services` API 已存在，但双前端尚未完全退出本地静态模型 | Creator 与用户入口仍有混合态 | 2 |
| Creator 深域仍未完整 | release/replay/gate/activation 已落地，review/cost/audit 更深域仍待继续 | session package 治理未完全闭环 | 3 |
| 全局文件域与 richer preview 缺失 | run-scoped 上传/下载/preview 已有，跨 run 文件中心和 Office/binary 深预览仍未完成 | 文件交付能力不完整 | 4 |
| 下载与 SSE SDK 缺口 | 文件下载已进入 SDK，SSE fallback 仍分散在页面层 | SDK 尚未成为完整统一接入层 | 5 |
| 内部 Bridge 接口缺乏更强鉴权 | `/internal/*` 当前以 internal token 为主，mTLS/签名与平台审计仍未补齐 | 生产环境治理仍不足 | 6 |
| 审批治理接口域未拆出 | 当前审批能力仍以 run 聚合为主，治理视图无独立域 | 企业治理闭环不完整 | 7 |

## 7. 推荐的正式 API 分层

| 层级 | API 域 | 说明 |
|---|---|---|
| 入口层 | `/v1/auth`、`/v1/workspaces`、`/v1/workshops` | 面向终端用户与 Creator 的主入口域 |
| 执行层 | `/v1/runs`、`/ws/runs`、`/v1/runs/:id/stream` | 面向运行实例的实时与会话域 |
| 资产层 | `/v1/packages`、`/v1/releases`、`/v1/replays`、`/v1/files` | 面向 workshop、session 包、文件、回放和交付产物 |
| 治理层 | `/v1/credentials`、`/v1/connectors`、`/v1/audit`、`/v1/quotas` | 面向凭证、MCP、审计、成本治理 |
| 内部控制层 | `/internal/*` | 仅供 worker、bridge、runtime 使用，正式化后需单独鉴权 |

## 8. 当前不可宣称已完成的 API 域表

| API 域 | 当前原因 | 当前结论 |
|---|---|---|
| `auth` | 已具备 register/login/refresh/logout/session/invitations/accept | 仍不可宣称具备 SSO、miniapp 登录与安全中心能力 |
| `workspaces` | 已具备列表、summary、切换、成员列表、成员变更、邀请、撤销 | 已具备企业工作区基础能力，偏好与更细治理仍未补齐 |
| `workshops` | 前端仍以静态目录为主 | 不可宣称工坊目录已后台驱动 |
| `packages / releases / replays` | 已具备 package、release、replay、gate、activation 基础接口 | 不可宣称 Creator 发布治理与 review/cost/audit 全链已落地 |
| `credentials / connectors / mcps` | 已具备基础 CRUD 与治理接口 | 不可宣称 BYO-MCP 出网治理、review 与 broker/KMS 已落地 |
| `uploads / object storage` | 已具备 run-scoped 上传、download ticket 与对象存储回源 | 不可宣称全局文件中心、对象生命周期与 richer preview 已完成 |
| `audit / quotas / billing` | 已具备 quota / billing 基础接口与账本 | 不可宣称企业治理、结算与审计全链已完成 |

## 9. API 补齐最短实施顺序表

| 顺位 | 补齐项 | 目标结果 | 依赖 |
|---|---|---|---|
| 1 | `auth + workspaces` | 给所有现有 runs 接口补身份与作用域 | 正式数据层、token 策略 |
| 2 | `workshops` | 替换前端静态目录与启动模板 | 工坊/服务正式数据模型 |
| 3 | `uploads + object storage` | 打通材料上传、下载授权、结果归档 | 对象存储、签名链 |
| 4 | `packages / releases / replays` | 让 Creator 页接真实后端 | Creator 正式数据域 |
| 5 | `credentials / connectors` | 打通私有凭证与第三方 MCP 治理 | secret broker、策略模型 |
| 6 | `audit / quotas / billing` | 形成企业治理闭环 | ledger、审计存储、配额策略 |
