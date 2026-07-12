# 灵办词元 共享包契约、领域投影与SDK执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 共享包契约、领域投影与SDK执行总表 |
| 适用范围 | `packages/contracts`、`packages/domain-models`、`packages/api-sdk`、`packages/ui-tokens` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前四个共享包源码、构建脚本、被前后端消费的位置与正式共享层目标为准 |
| 直接证据 | `packages/contracts/src/*.ts`、`packages/domain-models/src/*.ts`、`packages/api-sdk/src/index.ts`、`packages/ui-tokens/src/index.ts`、根 `package.json`、`app/dashboard`/`app/mobile`/`app/api` 现有引用关系 |
| 输出目标 | 将共享包的对象边界、执行链、消费方、兼容缺口与正式化收敛路径细化到表格层 |

## 2. 共享包当前事实矩阵

| 共享包 | 当前脚本 | 当前输出 | 当前主要消费方 | 当前结论 |
|---|---|---|---|---|
| `@lingban/contracts` | `build`、`typecheck` | `dist/*.js`、`dist/*.d.ts` | API、Worker、Bridge、Dashboard、Mobile、SDK | 当前最核心的协议底座 |
| `@lingban/domain-models` | `build`、`typecheck` | `dist/index.js` 等 | Dashboard、Mobile、API | 当前承担状态迁移与快照投影 |
| `@lingban/api-sdk` | `build`、`typecheck` | `dist/index.js` | Dashboard、Mobile | 当前承担 runs HTTP + realtime 接入 |
| `@lingban/ui-tokens` | `build`、`typecheck` | `dist/index.js` | Dashboard、Mobile | 当前承担设计 token 输出 |

## 2.1 当前已验证共享包基线表

| 包 | 当前源码文件 | 当前验证 | 证据 |
|---|---|---|---|
| `contracts` | `common.ts`、`runs.ts`、`bridge.ts`、`realtime.ts`、`runtime.ts` | build / typecheck 已通过 | `packages/contracts/src/*`、`pnpm -C packages/contracts build` |
| `domain-models` | `runs.ts`、`search.ts` | build / typecheck 已通过 | `packages/domain-models/src/*`、`pnpm -C packages/domain-models build` |
| `api-sdk` | `index.ts` | build / typecheck 已通过 | `packages/api-sdk/src/index.ts`、`pnpm -C packages/api-sdk build` |
| `ui-tokens` | `index.ts` | build / typecheck 已通过 | `packages/ui-tokens/src/index.ts`、`pnpm -C packages/ui-tokens build` |

## 3. `contracts/common.ts` 执行矩阵

| 分类 | 当前对象 | 当前作用 | 下游依赖 |
|---|---|---|---|
| ID 前缀 | `usr_`、`wsp_`、`tsk_`、`tsv_`、`ses_`、`sev_`、`run_`、`art_`、`apr_`、`cred_`、`mbd_`、`brg_` | 给所有主对象提供最小格式约束 | 全栈 |
| 入口面 | `dashboard`、`h5`、`mini-program` | 标记 run 来源终端 | runs、前端统计、后续计费 |
| 消息角色 | `system`、`user`、`agent` | 统一消息发送与展示角色 | run message、UI 对话流 |
| 消息类型 | `prompt`、`status`、`approval`、`result`、`text` | 统一消息类型 | 对话卡片、审计与回放 |
| 文件类型 | `input`、`output`、`receipt`、`archive`、`log`、`screenshot` | 统一文件归类 | 文件页、产物、审计 |
| 连接器来源 | `first-party`、`workspace-managed`、`third-party` | 区分 MCP 治理责任 | runtime、治理、审批 |
| 连接器传输 | `stdio`、`http`、`sse`、`websocket` | 描述 MCP 连接方式 | Worker、Bridge、治理 |
| 凭证挂载模式 | `env`、`file` | 描述 secret 注入方式 | runtime、Bridge、审计 |

## 4. `contracts/runs.ts` 执行矩阵

| 对象 | 关键字段 | 当前用途 | 当前消费方 |
|---|---|---|---|
| `CreateRunInput` | `workspaceId`、`taskVersionId`、`sessionVersionId`、`requestedByUserId?`、`title`、`targetPath`、`entrySurface`、`initialMessage`、`bindings` | run 实例化输入 | Dashboard、Mobile、API |
| `RunRecord` | `runId`、`workspaceId`、`status`、`statusReason`、时间戳 | run 元数据主记录 | API、domain-models、前端 |
| `RunConversationMessage` | `messageId`、`role`、`kind`、`text`、`attachments[]` | 对话消息单元 | API、Bridge、前端 |
| `RunFileEntry` | `path`、`name`、`kind`、`sizeBytes`、`updatedAt` | 文件树、文件预览、产物挂钩 | API、Bridge、前端 |
| `RunArtifact` | `artifactId`、`label`、`file`、`status`、`downloadUrl?` | 结果产物单元 | API、Bridge、前端 |
| `RunApproval` | `approvalId`、`prompt`、`state`、`note` | 审批流程对象 | API、Bridge、前端 |
| `RunSnapshot` | `run + messages + files + artifacts + approvals` | 对外统一快照 | API、SDK、双端 |
| `StartRunJobPayload` | `run`、`initialPrompt`、`requestedInitialMessage`、`bindings`、`credentialMounts`、`mcpBindings` | API -> Worker / Bridge 的启动载荷 | API、Worker、Bridge |

## 5. `contracts/bridge.ts` 执行矩阵

| 对象 | 当前语义 | 当前用途 |
|---|---|---|
| `BridgeRegistration` | 描述一个运行中 bridge 的注册信息 | internal `/bridges/register` |
| `RunControlCommand` | `sendMessage/approve/cancel/ping/syncFiles/flushArtifacts` | API / Worker 控制 bridge |
| `BridgeEvent` | 状态、消息、审批、产物、文件、心跳、失败事件 | internal 回传、实时分发、快照投影 |
| `BridgeEventsIngest` | 事件批量回传包裹 | `/internal/runs/:id/events` |
| `RunStatusUpdate` | 单独同步状态 | `/internal/runs/:id/status` |
| `ArtifactSync` | 产物数组同步 | `/internal/runs/:id/artifacts` |

## 6. `contracts/realtime.ts` 执行矩阵

| 对象 | 当前语义 | 当前作用 |
|---|---|---|
| `ClientRealtimeMessage` | 订阅、发消息、审批、取消 | 前端 -> API WebSocket |
| `ServerRealtimeMessage` | `runs.snapshot`、`runs.event`、`runs.ack`、`runs.error` | API -> 前端 WebSocket / SSE |
| `runs.snapshot` | 完整 `RunSnapshot` | 建连初始化、重放 |
| `runs.event` | 单个 `BridgeEvent` | 增量更新 |
| `runs.ack` | `runId + ok` | 对客户端动作回执 |
| `runs.error` | `runId? + error` | 连接或消息级错误 |

## 7. `contracts/runtime.ts` 执行矩阵

| 对象 | 当前字段 | 当前作用 |
|---|---|---|
| `EnvCredentialMount` | `credentialId`、`envName`、`readOnly=true` | env 型 secret 注入 |
| `FileCredentialMount` | `credentialId`、`mountPath`、`readOnly=true` | file 型 secret 注入 |
| `CredentialMount` | `env | file` | 统一凭证挂载 |
| `McpBinding` | `bindingId/source/transport/ref/credentialId/authMode/authRef/networkPolicyRef/approvalRequired` | 统一 MCP 绑定 |
| `BridgeSessionContext` | `runId/workspaceId/targetPath/initialPrompt/requestedInitialMessage/credentialMounts/mcpBindings` | 给 bridge 启动时的最小上下文 |

## 8. `domain-models/runs.ts` 执行矩阵

| 能力 | 当前函数 | 当前作用 | 当前消费方 |
|---|---|---|---|
| 状态机定义 | `runStatusTransitions` | 约束合法状态迁移 | API、测试、后续治理 |
| 状态校验 | `canTransitionRunStatus()`、`assertRunStatusTransition()` | 防止非法迁移 | API、domain 层 |
| run 记录创建 | `createRunRecord()` | 由 `CreateRunInput` 生成 `RunRecord` | API |
| 状态推进 | `transitionRunStatus()` | 写入新状态与时间 | API、Worker |
| 宽松投影 | `projectRunStatus()` | 在事件回放时允许幂等/纠偏 | 快照投影 |
| 事件投影 | `applyBridgeEventToRunSnapshot()` | `BridgeEvent -> RunSnapshot` | API、Dashboard、Mobile |
| 事件序列投影 | `applyBridgeEventsToRunSnapshot()` | 批量事件重放 | API、后续 replay |
| 首轮追问 prompt | `createInformationCollectionPrompt()` | 生成“你需要我提供什么信息给你”提示 | API run 初始化 |

## 9. `domain-models/search.ts` 执行矩阵

| 函数 | 当前作用 | 当前消费方 |
|---|---|---|
| `normalizeSearchQuery()` | 去空白、转小写 | Dashboard、Mobile |
| `toSearchTerms()` | 切词 | Dashboard、Mobile |
| `joinSearchableText()` | 聚合可搜索文本 | Dashboard、Mobile |
| `matchesSearchQuery()` | 多词全包含匹配 | Dashboard 实例页、文件页、Mobile 列表筛选 |

## 10. `api-sdk` HTTP 执行矩阵

| 方法 | 对应接口 | 当前行为 | 当前缺口 |
|---|---|---|---|
| `listRuns()` | `GET /v1/runs` | 取列表并按 `RunSnapshot[]` 解析 | 无分页、无 auth |
| `createRun()` | `POST /v1/runs` | 请求前 parse 输入，请求后 parse 响应 | 无幂等头、无 auth |
| `getRun()` | `GET /v1/runs/:id` | 取详情并 parse | 无缓存标签 |
| `listRunFiles()` | `GET /files` | 取文件数组并 parse | 前端主流程使用较少 |
| `listRunFileTree()` | `GET /files/tree` | 取动态文件树并 parse | 无版本号 |
| `statRunFile()` | `GET /files/stat` | 取单文件元信息 | 无下载授权联动 |
| `readRunFile()` | `GET /files/read` | 取文本预览 | 无二进制预览策略 |
| `sendRunMessage()` | `POST /messages` | 发送消息并取新快照 | 无发送幂等键 |
| `approveRun()` | `POST /approvals` | 提交审批 | 无审批错误分级 |
| `cancelRun()` | `POST /cancel` | 取消 run | 无取消原因标准化 |

## 11. `api-sdk` Realtime 执行矩阵

| 能力 | 当前行为 | 当前问题 |
|---|---|---|
| `createRunsRealtimeClient()` | 基于 `baseUrl` 派生 WS URL | 无 auth 注入 |
| `connect()` | 建连后自动发 `runs.subscribe` | 无 `lastEventId` / resume token |
| `onSnapshot` | 收完整快照 | 正常 |
| `onEvent` | 收 `BridgeEvent` | 正常 |
| `onAck` | 收动作确认 | 页面侧消费不足 |
| `onError` | 只回字符串 | 丢失结构化错误信息 |
| `sendMessage/approve/cancel` | 直接 JSON 发包 | 无客户端序列号与重放保护 |

## 12. `ui-tokens` 执行矩阵

| 导出对象 | 当前内容 | 当前用途 |
|---|---|---|
| `lingbanColorTokens` | Dashboard/Mobile 基础色板 | 原型与样式层引用 |
| `lingbanRadiusTokens` | `panel/soft/pill` | 圆角统一 |
| `lingbanSpacingTokens` | `xs/sm/md/lg/xl` | 间距统一 |
| `lingbanThemeVars` | Dashboard/Mobile 明暗主题 CSS 变量值 | Dashboard 与 H5 主题切换 |

## 13. 共享包消费链矩阵

| 上游包 | 下游消费方 | 消费方式 |
|---|---|---|
| `contracts` | API、Worker、Bridge | schema parse + type import |
| `contracts` | `api-sdk` | request/response/realtime schema parse |
| `contracts` | Dashboard、Mobile | 通过 SDK 与 adapter 类型消费 |
| `domain-models` | API | run 状态迁移、prompt 生成、快照投影 |
| `domain-models` | Dashboard、Mobile | 列表搜索、实时快照投影 |
| `api-sdk` | Dashboard、Mobile | runs API 与 realtime 客户端 |
| `ui-tokens` | Dashboard、Mobile | 主题 token 与 CSS 变量值 |

## 14. 当前结构性缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 共享包未独立建仓 | 仍挂在根工作区 | 发布、版本管理、权限分工不清晰 | P1 |
| `contracts` 缺 auth/workspace/workshop/creator 域 | 当前主要覆盖 runs/runtime/realtime | 正式后端域对象不完整 | P0 |
| `domain-models` 领域深度不足 | 主要只有 run 与 search | release/replay/quota/governance 逻辑缺失 | P0 |
| `api-sdk` 缺下载/SSE/auth/upload/creator API | 双端仍手写部分行为 | SDK 无法成为完整接入层 | P0 |
| `api-sdk` 错误只保留 `HTTP_<status>` 或字符串 | 丢失业务 code/message/details | 错误治理与用户提示不足 | P1 |
| `ui-tokens` 只有 token，没有组件抽象 | 样式复用仍靠页面 CSS | 设计系统层尚未成型 | P1 |

## 15. 正式收敛建议矩阵

| 方向 | 建议 |
|---|---|
| 契约扩域 | 在 `contracts` 中补 `auth`、`workspace`、`workshop`、`package`、`release`、`credential`、`audit` 域 |
| 领域扩域 | 在 `domain-models` 中补 replay diff、配额判定、审批汇总、Creator 状态投影 |
| SDK 收敛 | 在 `api-sdk` 中补 auth/workspaces/workshops/packages/uploads/download sessions/SSE 统一抽象 |
| 错误治理 | SDK 抛出结构化错误对象，保留 `status/code/message/details/traceId` |
| 主题系统 | `ui-tokens` 继续上收为变量 + 组件语义 token，两端不再各自定义状态色 |

## 16. 共享包收口最短顺序表

| 顺位 | 包 | 先补内容 | 目标结果 |
|---|---|---|---|
| 1 | `contracts` | `auth / workspaces / workshops / creator / uploads / audit` 契约 | 正式后端域有统一 schema 底座 |
| 2 | `domain-models` | replay、quota、approval summary、Creator projection | 业务规则与读模型不再散落到应用层 |
| 3 | `api-sdk` | 下载、SSE、auth header、uploads、Creator API | 双端不再手写接入逻辑 |
| 4 | `ui-tokens` | 组件语义 token、状态色、密度 token | 双端样式口径继续统一 |

## 17. 当前不可宣称完成的共享层能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 全域契约体系 | `contracts` 当前主要覆盖 runs/runtime/realtime | 不可宣称正式全域 schema 已完成 |
| 完整领域层 | `domain-models` 当前只有 run 与 search | 不可宣称业务规则已全部上收 |
| 完整 SDK 接入层 | `api-sdk` 仅覆盖 runs 主链与 realtime | 不可宣称双端接入已完全 SDK 化 |
| 设计系统层 | `ui-tokens` 仅有 token，无共享组件抽象 | 不可宣称完整前端设计系统已完成 |
