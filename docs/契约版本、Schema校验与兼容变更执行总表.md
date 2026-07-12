# 灵办词元 契约版本、Schema校验与兼容变更执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 契约版本、Schema校验与兼容变更执行总表 |
| 适用范围 | `packages/contracts`、`packages/api-sdk`、`app/api`、`app/run-worker`、`app/container-bridge`、双端接入层 |
| 统计日期 | 2026-07-07 |
| 统计口径 | 以当前 `packages/contracts/src/*.ts`、API route parse 点、SDK parse 点、runtime/bridge parse 点为准，补齐到契约版本治理、兼容变更和发布 gate 执行层 |
| 直接证据 | `packages/contracts/src/common.ts`、`runs.ts`、`realtime.ts`、`bridge.ts`、`runtime.ts`、`packages/api-sdk/src/index.ts`、`app/api/src/modules/runs/routes.ts`、`app/api/src/modules/bridge/routes.ts`、`app/container-bridge/src/cli.ts`、`app/run-worker/src/jobs/start-run.ts` |
| 输出目标 | 将 schema 归属、parse 入口、版本演进规则、兼容路径和发布约束细化为执行表 |

## 2. 当前契约层事实矩阵

| 组件 | 当前职责 | 当前特点 |
|---|---|---|
| `packages/contracts` | Zod schema + TS type 权威源 | 当前是全栈唯一契约基线 |
| `packages/api-sdk` | 请求前 parse、响应后 parse、WS parse | 客户端已具备强校验 |
| `app/api` | route/body/query/params parse | 服务端入站已较完整 |
| `app/run-worker` | runtime config 和 start job parse | worker 入口已有强校验 |
| `app/container-bridge` | context、control command、event parse | bridge 链已有强校验 |

## 3. Schema 归属矩阵

| 文件 | 核心 schema | 归属职责 |
|---|---|---|
| `common.ts` | ID 前缀、通用枚举、时间格式 | 基础类型层 |
| `runs.ts` | `CreateRunInput`、`RunRecord`、`RunSnapshot`、审批/消息/文件/产物 | 运行域主契约 |
| `runtime.ts` | `CredentialMount`、`McpBinding`、`BridgeSessionContext` | 运行时注入契约 |
| `bridge.ts` | `BridgeRegistration`、`RunControlCommand`、`BridgeEvent` | API <-> Bridge 内部协议 |
| `realtime.ts` | `ClientRealtimeMessage`、`ServerRealtimeMessage` | 双端实时协议 |

## 4. ID 与枚举基线矩阵

| 类型 | 当前规则 | 当前来源 | 版本要求 |
|---|---|---|---|
| 主键前缀 | `usr_/wsp_/tsk_/tsv_/ses_/sev_/run_/art_/apr_/cred_/mbd_/brg_` | `common.ts` | 新增对象需补前缀与迁移策略 |
| `EntrySurface` | `dashboard/h5/mini-program` | `common.ts` | 新端接入需兼容旧端解析 |
| `RunStatus` | 9 态状态机 | `runs.ts` | 新状态需评估双端展示与回放兼容 |
| `BridgeCommandType` | 6 种控制命令 | `bridge.ts` | 新命令需同步 API、Worker、Bridge |
| `ConnectorSource/Transport` | 来源与传输枚举 | `common.ts` | 影响 MCP materializer 和治理策略 |

## 5. 服务端入站校验执行矩阵

| 入口 | 当前 parse 点 | 校验对象 |
|---|---|---|
| `POST /v1/runs` | `createRunInputSchema.parse(request.body)` | 创建实例输入 |
| `POST /v1/runs/:runId/messages` | `sendRunMessageInputSchema.parse(request.body)` | 用户消息输入 |
| `POST /v1/runs/:runId/approvals` | `approveRunInputSchema.parse(request.body)` | 审批输入 |
| `POST /v1/runs/:runId/approve` | `approveRunInputSchema.parse(request.body)` | 兼容审批路径 |
| 文件查询 | `runIdParamsSchema` + `runFileQuerySchema` | 路径和 run 参数 |
| internal bridge register | `bridgeRegistrationSchema.parse(request.body)` | bridge 注册 |
| internal event ingest | `bridgeEventsIngestSchema.parse(request.body)` | 事件批 |
| internal status/artifacts | `runStatusUpdateSchema`、`artifactSyncSchema` | 状态与产物 |

## 6. 业务层与持久层校验执行矩阵

| 位置 | 当前 parse 点 | 作用 |
|---|---|---|
| `RunsService.createRun()` | `createRunInputSchema.parse(input)` | 防止业务层直接传脏对象 |
| `RunsService.getRun()/listRuns()` | `runSnapshotSchema.parse(...)` | 保证对外快照一致 |
| `RunsService.syncArtifacts()` | `runArtifactSchema.parse` | 保证 bridge 回传 artifact 合法 |
| `FileBackedRunsRepository.save/update/load` | `runAggregateSchema.parse(...)` | 保证落盘聚合结构不漂移 |
| `runEventBus.append/load` | `bridgeEventSchema.parse(...)` | 保证 backlog 事件有效 |

## 7. 客户端 SDK 校验执行矩阵

| 能力 | 当前 parse 点 | 当前价值 |
|---|---|---|
| `createRun()` | 请求前 `createRunInputSchema.parse` | 防止前端发送脏 payload |
| `listRuns()/getRun()` | `runSnapshotSchema.parse` | 保证页面收到合法快照 |
| `listRunFiles()/listRunFileTree()` | `runFileEntrySchema.array().parse` | 保证文件列表结构一致 |
| `sendRunMessage()` | `sendRunMessageInputSchema.parse` | 保证消息输入一致 |
| `approveRun()` | `approveRunInputSchema.parse` | 保证审批输入一致 |
| realtime subscribe | `clientRealtimeMessageSchema.parse` | 保证出站 WS 命令一致 |
| realtime receive | `serverRealtimeMessageSchema.parse` | 保证入站 WS 消息一致 |

## 8. Worker / Bridge 校验执行矩阵

| 位置 | 当前 parse 点 | 说明 |
|---|---|---|
| `start-run.ts` | `startRunJobPayloadSchema.parse(payload)` | worker 入口校验 |
| `container-runtime.ts` | `runSecretMaterializationSchema`、`materializedMcpConfigSchema`、`containerLaunchPlanSchema`、`workerRuntimeConfigSchema` | 运行时物料校验 |
| `workspace-preparer.ts` | `preparedRunWorkspaceSchema.parse(...)` | 路径对象校验 |
| `container-bridge/cli.ts` | `bridgeSessionContextSchema.parse(...)` | 容器内 context 校验 |
| `run-control-server.ts` | `runControlCommandSchema.parse(command)` | 控制命令校验 |
| `event-parser.ts` / `artifact-publisher.ts` / `file-watcher.ts` | `bridgeEventSchema` 及子 schema parse | 事件出站校验 |

## 9. 当前兼容行为矩阵

| 场景 | 当前兼容策略 | 说明 |
|---|---|---|
| 审批路径 | `/approvals` 与 `/approve` 并存 | 兼容旧调用路径 |
| `initialMessage` | `nullable().default(null)` | 允许先创建 run 再收集信息 |
| `bindings` | default 空数组 | 允许最小输入启动 |
| `requestedByUserId` | optional | 兼容当前未接 auth 场景 |
| `downloadUrl` | `nullable().optional()` | 兼容本地文件直读与未来签名下载 |

## 10. 破坏性与非破坏性变更矩阵

| 变更类型 | 示例 | 版本要求 |
|---|---|---|
| 非破坏性 | 新增可选字段、新增默认值、新增兼容路径 | 可在同一大版本内推进 |
| 半破坏性 | 新增枚举值、状态值、事件类型 | 需同步双端适配器与治理逻辑 |
| 破坏性 | 字段重命名、必填收紧、枚举删除、消息结构改变 | 需新契约版本与迁移窗口 |
| 内部协议破坏性 | `RunControlCommand`、`BridgeEvent` 结构改变 | 需锁定 API/Worker/Bridge 联动发布 |

## 11. 契约版本治理执行矩阵

| 对象 | 建议版本位 | 管理方式 |
|---|---|---|
| 公共 HTTP/WS 契约 | `packages/contracts` semver | 通过 workspace package version 管理 |
| internal bridge 契约 | `bridge protocol version` | 写入 `BridgeRegistration` 或 runtime config |
| session pack manifest | `manifest.schemaVersion` | 写入 pack 文件 |
| worker runtime config | `workerRuntimeConfig.schemaVersion` | 已存在 `schemaVersion: 1` 入口 |

## 12. 契约发布 Gate 矩阵

| Gate | 检查项 | 当前状态 |
|---|---|---|
| G1 | `contracts` 构建通过 | 已满足 |
| G2 | `api-sdk` 使用新 schema 构建通过 | 已满足当前链路 |
| G3 | API route / service / worker / bridge 全量类型通过 | 已满足当前链路 |
| G4 | 双端适配器覆盖新增字段或状态 | 当前缺正式门禁 |
| G5 | 兼容路径保留周期明确 | 当前缺正式规范 |
| G6 | 变更记录写入 changelog / migration note | 当前缺失 |

## 13. 兼容变更执行矩阵

| 变更场景 | 执行动作 | 回收动作 |
|---|---|---|
| 新增 `RunStatus` | 先补 `contracts`，再补双端 `statusMeta()`，再补审计与治理规则 | 所有终端升级后可清理 fallback |
| 新增 `BridgeEvent` 类型 | 先补 `bridge.ts`，再补 API projector，再补 SDK/前端消费 | 旧事件逻辑确认无人使用后回收 |
| 调整文件对象 | 保留 `RunFileEntry` 向后兼容字段，新加结构化字段 | 完成双端迁移后再移除旧字段 |
| 调整审批对象 | 保留旧路径 `/approve`，新增正式对象字段 | 完成 SDK 升级后评估移除兼容路径 |

## 14. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 无正式契约版本规范 | 目前靠工作区同步更新 | 多仓升级不可控 | P0 |
| 无 changelog / migration note | 兼容窗口无法追踪 | 联调风险高 | P0 |
| 双端适配器未设状态兜底门禁 | 新枚举值容易前端漂移 | 展示风险高 | P1 |
| internal bridge 无独立 protocol version | API/Worker/Bridge 升级时序不可见 | 运行时兼容风险 | P1 |

