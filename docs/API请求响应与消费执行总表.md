# 灵办词元 API请求响应与消费执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | API请求响应与消费执行总表 |
| 适用范围 | `app/api`、`packages/contracts`、`packages/api-sdk`、`app/dashboard`、`app/mobile` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 `create-server.ts`、`runs/routes.ts`、`errors.ts`、`packages/api-sdk`、双端 API 门面代码为准，补齐到请求进入、校验、响应输出、前端消费的执行层 |
| 直接证据 | `app/api/src/app/create-server.ts`、`app/api/src/modules/runs/routes.ts`、`app/api/src/app/errors.ts`、`app/api/src/modules/runs/file-access.ts`、`packages/api-sdk/src/index.ts`、`app/dashboard/src/lib/api.ts`、`app/mobile/src/lib/api.ts` |
| 输出目标 | 将当前 API 的请求入口、参数解析、响应结构、SSE/WS 消费、错误归一化、SDK 覆盖缺口和正式补齐方向细化为执行表 |

## 2. 当前入口与注册事实矩阵

| 证据 | 当前行为 | 当前含义 | 当前缺口 |
|---|---|---|---|
| `createServer()` | 注册 `/health`、`/v1/runs`、`/ws/runs`、`/internal` | 当前服务入口高度聚焦在 run 主链 | 无 auth/workspace/workshop 等正式域 |
| `server.setErrorHandler()` | 统一走 `normalizeErrorPayload()` | 当前 HTTP 错误输出已具备统一壳 | 缺 request id、trace id、错误日志 |
| `registerRunRoutes()` | 将 HTTP + SSE 都挂在 `/v1/runs/*` | 当前 run 域承担了实例、消息、审批、文件、实时 fallback | 领域边界仍然偏厚 |
| `packages/api-sdk` | 只封装 runs 与 websocket realtime | 双端主链已有统一客户端门面 | 下载、SSE fallback、上传、auth 未统一 |
| 双端 `lib/api.ts` | 手工维护 `baseUrl` 与下载 URL 拼接 | 终端侧已经形成调用入口 | 仍需统一 header、token、重试策略 |

## 3. 当前 HTTP 请求进入执行矩阵

| Method | Path | 参数解析位置 | 业务执行位置 | 当前返回 | 当前消费方 |
|---|---|---|---|---|---|
| `GET` | `/health` | 无 | `create-server.ts` 内联处理 | `{ status, service }` | 探针、未来网关 |
| `GET` | `/v1/runs` | 无显式 query schema | `runsService.listRuns()` | `RunSnapshot[]` | Dashboard、Mobile |
| `POST` | `/v1/runs` | `createRunInputSchema.parse(request.body)` | `runsService.createRun()` | `CreateRunResponse` | Dashboard、Mobile |
| `GET` | `/v1/runs/:runId` | `runIdParamsSchema.parse(request.params)` | `runsService.getRun()` | `RunSnapshot` | Dashboard、Mobile |
| `GET` | `/v1/runs/:runId/files` | `runIdParamsSchema` | `runsService.listFiles()` | `RunFileEntry[]` | 预留 |
| `GET` | `/v1/runs/:runId/files/tree` | `runIdParamsSchema` | `runFileAccessService.listRunFiles()` | `RunFileEntry[]` | Dashboard、Mobile |
| `GET` | `/v1/runs/:runId/files/stat` | `runIdParamsSchema` + `runFileQuerySchema` | `runFileAccessService.statRunFile()` | `RunFileEntry` | 预留 |
| `GET` | `/v1/runs/:runId/files/read` | `runIdParamsSchema` + `runFileQuerySchema` | `runFileAccessService.readRunFile()` | `RunFileReadResponse` | Dashboard、Mobile |
| `GET` | `/v1/runs/:runId/files/download` | `runIdParamsSchema` + `runFileQuerySchema` | `runFileAccessService.createDownloadDescriptor()` | 文件流 | Dashboard、Mobile |
| `POST` | `/v1/runs/:runId/messages` | `runIdParamsSchema` + `sendRunMessageInputSchema` | `runsService.sendMessage()` | `RunSnapshot` | Dashboard、Mobile |
| `POST` | `/v1/runs/:runId/approvals` | `runIdParamsSchema` + `approveRunInputSchema` | `runsService.approve()` | `RunSnapshot` | SDK 已支持，UI 可接 |
| `POST` | `/v1/runs/:runId/approve` | 同上 | `runsService.approve()` | `RunSnapshot` | 兼容路径 |
| `POST` | `/v1/runs/:runId/cancel` | 内联 `z.object({ reason })` | `runsService.cancel()` | `RunSnapshot` | SDK 已支持，UI 可接 |
| `GET` | `/v1/runs/:runId/stream` | `runIdParamsSchema` | `runsService.getRun()` + `runEventBus` | `text/event-stream` | Dashboard、Mobile fallback |

## 4. 参数校验与拒绝执行矩阵

| 请求类型 | 当前校验点 | 当前拒绝条件 | 当前错误出口 |
|---|---|---|---|
| path `runId` | `runIdParamsSchema` | 空字符串、缺失 | `ZodError -> VALIDATION_ERROR` |
| query `path` | `runFileQuerySchema` | 非字符串、空字符串 | `ZodError -> VALIDATION_ERROR` |
| `CreateRunInput` | `createRunInputSchema` | 缺必要字段、字段格式不符 | `ZodError -> VALIDATION_ERROR` |
| `SendRunMessageInput` | `sendRunMessageInputSchema` | 文本与附件字段不合法 | `ZodError -> VALIDATION_ERROR` |
| `ApproveRunInput` | `approveRunInputSchema` | `approved`/`note` 不合法 | `ZodError -> VALIDATION_ERROR` |
| 文件访问边界 | `resolvePathWithinTarget()` | 请求路径越出 `targetPath` | `AppError(FILE_PATH_INVALID)` |
| 文件读取对象 | `readRunFile()` | 请求的是目录 | `AppError(FILE_PATH_INVALID)` |
| 文件下载对象 | `createDownloadDescriptor()` | 请求的是目录 | `AppError(FILE_PATH_INVALID)` |
| run 权威源 | `#requireAggregate()` / `getRunRoot()` | `runId` 不存在 | `AppError(RUN_NOT_FOUND)` |

## 5. 当前响应输出执行矩阵

| 场景 | 当前响应体 | 响应生成位置 | 前端当前消费方式 |
|---|---|---|---|
| 成功创建 run | `{ run, nextPrompt }` | `runsService.createRun()` | 双端据此进入 run 对话详情 |
| 成功拉取详情 | `RunSnapshot` | `runsService.getRun()` | 双端 adapter 投影为任务/实例视图 |
| 成功发送消息 | `RunSnapshot` | `runsService.sendMessage()` | HTTP 模式可直接替换本地快照 |
| 成功审批 | `RunSnapshot` | `runsService.approve()` | 双端可立即更新 run 状态与消息 |
| 成功取消 | `RunSnapshot` | `runsService.cancel()` | 双端可立即收口到终止态 |
| 文本文件读取 | `{ file, content, encoding, truncated }` | `runFileAccessService.readRunFile()` | 双端文件预览页直接展示 |
| 文件下载 | `download ticket -> /v1/downloads/:ticketId` 或 stream + header | `runUploadService.createDownloadTicket()`、`routes.ts` | 双端已通过 SDK helper 发起下载 |
| SSE 首帧 | `runs.snapshot` frame | `writeSseFrame()` | fallback 模式加载完整快照 |
| SSE 增量 | `runs.event` frame | `runEventBus.subscribe()` | fallback 模式投影事件 |

## 6. SSE 回退通道执行矩阵

| 步骤 | 执行方 | 当前动作 | 输出 |
|---|---|---|---|
| 1 | 前端 | 访问 `/v1/runs/:runId/stream` | 建立 HTTP 长连接 |
| 2 | API | `getRun()` + `runEventBus.list()` | 当前 run 快照与 backlog |
| 3 | API | `reply.raw.writeHead()` 设置 `text/event-stream` | SSE 通道准备完成 |
| 4 | API | 写入 `runs.snapshot` 帧 | 首帧完整快照 |
| 5 | API | 遍历 backlog 写入 `runs.event` | 历史事件回放 |
| 6 | API | `runEventBus.subscribe()` 订阅 run | 增量事件实时推送 |
| 7 | API | 连接关闭时 `unsubscribe()` + `end()` | 释放订阅 |

## 7. 当前错误归一化执行矩阵

| 错误来源 | 当前识别逻辑 | HTTP 状态码 | 返回体结构 |
|---|---|---|---|
| `ZodError` | `normalizeErrorPayload()` 第一分支 | `400` | `{ error: { code: "VALIDATION_ERROR", message, details } }` |
| `AppError` | `isAppError()` 分支 | `error.statusCode` | `{ error: { code, message, details } }` |
| 未知异常 | fallback 分支 | `500` | `{ error: { code: "INTERNAL_ERROR", message } }` |
| 文件越界 | `AppError(400, FILE_PATH_INVALID)` | `400` | 统一 error payload |
| run 不存在 | `AppError(404, RUN_NOT_FOUND)` | `404` | 统一 error payload |
| 文件不存在 | `AppError(404, FILE_NOT_FOUND)` | `404` | 统一 error payload |
| 状态流转非法 | `AppError(409, RUN_STATUS_INVALID)` | `409` | 统一 error payload |

## 8. SDK 与前端消费执行矩阵

| 能力 | `packages/api-sdk` 当前状态 | Dashboard 当前消费 | Mobile 当前消费 | 缺口 |
|---|---|---|---|---|
| list runs | 已封装 `listRuns()` | 已接入 | 已接入 | 无 |
| create run | 已封装 `createRun()` | 已接入 | 已接入 | 无 |
| get run | 已封装 `getRun()` | 已接入 | 已接入 | 无 |
| send message | 已封装 `sendRunMessage()` | 已接入 | 已接入 | 无 |
| approve run | 已封装 `approveRun()` | UI 可接 | UI 可接 | 交互按钮待继续正式化 |
| cancel run | 已封装 `cancelRun()` | UI 可接 | UI 可接 | 交互按钮待继续正式化 |
| list file tree | 已封装 `listRunFileTree()` | 已接入 | 已接入 | 无 |
| read file | 已封装 `readRunFile()` | 已接入 | 已接入 | 无 |
| file download | 已通过下载票据封装 | `getRunFileDownloadUrl()` | `getRunFileDownloadUrl()` | preview/export 等文件域 helper 仍有缺口 |
| SSE fallback | 无统一封装 | 页面本地处理 | 页面本地处理 | SDK 缺口 |
| auth header | 无 | 未接 token | 未接 token | 正式系统 P0 |
| 上传附件 | 无 | 无 | 无 | 正式系统 P0 |

## 9. 正式系统建议的请求头与消费约束矩阵

| 维度 | 正式建议 | 当前状态 |
|---|---|---|
| 身份头 | `Authorization: Bearer <access_token>` | 缺失 |
| 工作区头 | `X-Workspace-Id` 或 token 内嵌上下文 | 缺失 |
| 请求幂等 | `Idempotency-Key` 用于 run 创建、审批、上传完成 | 缺失 |
| Trace 传播 | `X-Request-Id`、`X-Trace-Id` | 缺失 |
| SDK 错误模型 | 统一解析 `{ error: { code, message, details } }` | 当前只按 HTTP 状态抛 `HTTP_xxx` |
| 下载授权 | 先拿 grant 再下载对象 | 当前仍直接拼 run 文件下载 URL |
| SSE / WS 统一门面 | SDK 暴露 `connectRunsStream()` | 缺失 |

## 10. 正式 API 消费闭环矩阵

| 阶段 | 调用方 | 当前已存在 | 正式补齐 |
|---|---|---|---|
| 入口鉴权 | Dashboard / H5 | 无 | 登录换 token，自动注入 header |
| 目录拉取 | 双端 | 本地数据为主 | `/v1/workshops`、`/v1/services` |
| 实例创建 | 双端 | `POST /v1/runs` 可用 | 加入权限、配额、审计 |
| 对话执行 | 双端 | `POST /messages` + WS/SSE 可用 | 加入附件上传、ack、重试 |
| 审批回流 | 双端 | `POST /approvals` 可用 | 加入作用域、风险级、审批角色 |
| 文件消费 | 双端 | tree/read/download 可用 | 接对象存储、预览与授权下载 |
| Creator 治理 | Dashboard | 纯前端语义 | `/v1/packages`、`/v1/releases`、`/v1/audit` |

## 11. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 无 auth/header 注入 | API 与 SDK 都无身份上下文 | 不能进入真实多用户环境 | P0 |
| 下载能力不在 SDK | 双端自行拼 URL | 接口升级时易失配 | P0 |
| SSE fallback 无统一抽象 | 双端各自维护 | 重复实现、行为不一致 | P1 |
| 错误模型未被 SDK 结构化消费 | 仅抛 `HTTP_xxx` | 前端难以细分提示 | P1 |
| 上传与对象存储域缺失 | 只能读不能传 | 材料补交链断裂 | P0 |

## 12. 当前已验证请求消费基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| API 错误统一出口 | 已由 `normalizeErrorPayload()` 统一封装 | `app/api/src/app/errors.ts` |
| SDK HTTP 客户端 | 已统一 runs 主链与文件主链 | `packages/api-sdk/src/index.ts` |
| SDK 错误行为 | 当前仅在 `ensureOk()` 中抛 `HTTP_<status>` 字符串错误 | `packages/api-sdk/src/index.ts` |
| SDK realtime 客户端 | 已统一 subscribe/sendMessage/approve/cancel | `packages/api-sdk/src/index.ts` |
| Dashboard API 门面 | 已通过 `createRunsApiClient()` 接入 | `app/dashboard/src/lib/api.ts` |
| Mobile API 门面 | 已通过 `createRunsApiClient()` 接入 | `app/mobile/src/lib/api.ts` |
| Dashboard realtime 门面 | 已通过 `createRunsRealtimeClient()` 接入 | `app/dashboard/src/lib/runStream.ts` |
| Mobile realtime 门面 | 已通过 `createRunsRealtimeClient()` 接入 | `app/mobile/src/lib/runStream.ts` |

## 13. 当前请求响应未闭环项表

| 闭环项 | 当前缺口 | 直接影响 |
|---|---|---|
| 认证请求头 | 无 `Authorization`、无工作区上下文 | 无法进入真实多用户环境 |
| 幂等键 | `createRun`、审批、消息发送均无幂等策略 | 重试时可能重复提交 |
| 结构化错误消费 | SDK 丢失 `code/message/details` | 前端提示无法精确区分 |
| 下载授权 | SDK 已有 `createRunDownloadTicket()` 与 `getRunFileDownloadUrl()` | 预览、bundle、导出等文件域 helper 仍待收口 |
| SSE 统一接入 | SDK 无 `connectRunsStream()` | fallback 行为分散在页面层 |
| 上传链 | 已有附件 upload create/put/finalize 基础链 | 缺 multipart、大文件策略与正式输入材料域 |

## 14. API 消费链最短收口顺序表

| 顺位 | 收口项 | 目标结果 |
|---|---|---|
| 1 | SDK 结构化错误 | 前端拿到 `status/code/message/details` |
| 2 | SDK 下载能力 | 双端不再手工拼接下载 URL |
| 3 | SDK SSE fallback | WebSocket 不可用时行为统一 |
| 4 | auth / workspace header | 所有请求具备正式身份与作用域 |
| 5 | 上传与对象存储 API | 对话附件与运行材料形成闭环 |
