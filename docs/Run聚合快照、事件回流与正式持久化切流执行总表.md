# 灵办词元 Run聚合快照、事件回流与正式持久化切流执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Run聚合快照、事件回流与正式持久化切流执行总表 |
| 适用范围 | `app/api`、`packages/contracts`、`packages/domain-models`、未来 `packages/db`、`realtime/event-store` |
| 统计日期 | 2026-07-08 |
| 当前事实 | 当前 `RunsService` 以 `runAggregateSchema = runSnapshot + input + startJob` 为权威聚合，借助 `FileBackedRunsRepository` 保存 JSON，借助 `InMemoryRunEventBus` 保存内存 backlog 与 JSONL 事件日志 |
| 直接证据 | `app/api/src/modules/runs/service.ts`、`repository.ts`、`storage-schema.ts`、`launch-plan.ts`、`app/api/src/modules/realtime/event-bus.ts`、`packages/contracts/src/runs.ts`、`packages/contracts/src/bridge.ts`、`packages/contracts/src/realtime.ts`、`packages/contracts/src/runtime.ts`、`packages/domain-models/src/runs.ts` |
| 输出目标 | 统一说明当前 run 聚合的结构、事件进入和投影方式、正式 PostgreSQL 落库拆分、双写切流策略与完成判定 |

## 2. 当前 Run 聚合权威结构表

| 聚合字段 | 当前来源 | 当前用途 | 正式落点 |
|---|---|---|---|
| `run` | `createRunRecord()` | run 主记录、状态与路径 | `runs` |
| `input` | `CreateRunInput` | 保留实例化输入快照 | `run_inputs` + `run_create_request` |
| `startJob` | `buildStartRunJobPayload()` | 运行时物料与 Worker 启动输入 | `run_start_jobs` 或 `runtime_job_payloads` |
| `messages[]` | `createMessage()` + bridge events | 对话快照 | `run_messages` |
| `files[]` | seed files + `files.synced/file.changed` | 文件索引快照 | `run_files` |
| `artifacts[]` | seed artifacts + `artifact.ready` | 交付产物快照 | `run_artifacts` |
| `approvals[]` | seed approval + `approval.requested` + `approve()` | 审批快照 | `approvals` |

## 3. 当前 ID 与序列生成表

| 对象 | 当前生成方式 | 当前位置 | 风险 | 正式替换方案 |
|---|---|---|---|---|
| `runId` | 内存 `runSequence++` + `run_00000001` | `service.ts` | 多实例冲突 | DB sequence / ULID |
| `messageId` | 内存 `messageSequence++` | `service.ts` | 重启后需 bootstrap 扫描 | DB sequence / ULID |
| `artifactId` | 内存 `artifactSequence++` | `service.ts` | 无法横向扩展 | DB sequence / ULID |
| `approvalId` | 内存 `approvalSequence++` | `service.ts` | 无法跨实例一致 | DB sequence / ULID |
| `eventId` | `evt_${randomUUID()}` | `event-bus.ts` | 尚可，但无 cursor | 保留 UUID，补 event cursor |

## 4. `createRun` 当前执行链表

| 步骤 | 当前实现 | 副作用 | 正式化要求 |
|---|---|---|---|
| 1 | `createRunInputSchema.parse()` | 校验实例化输入 | 保留 |
| 2 | `createRunRecord()` | 生成 `run`，初始状态 `CREATED` | 保留 |
| 3 | `createInformationCollectionPrompt()` | 生成首轮“请问你需要我提供什么信息给你”系统追问 | 保留，结果需入 `run_messages` |
| 4 | `buildStartRunJobPayload()` | 解析 credentials、MCP bindings、launch payload | 保留，单独持久化 |
| 5 | `createSeedFiles()` | 预播 `receipts/output/archive` 目录项 | 改为 runtime prepare 完成后双向确认 |
| 6 | `createSeedArtifact()` | 为每个目录项生成 pending artifact | 正式表中改为真实产物再生成 |
| 7 | `createSeedApproval()` | 预播一个 pending approval | 应按策略播种，不默认一刀切 |
| 8 | `runsRepository.save()` | 写整份 JSON 聚合 | 改为事务写多表 |
| 9 | `runEventBus.append(conversation.message)` | 广播首条系统消息 | 事件先落库再广播 |
| 10 | `runOrchestrator.startRun()` | 异步启动运行 | 改为可靠作业派发 |

## 5. 当前写操作与投影矩阵表

| Service 方法 | 当前写入对象 | 当前事件输出 | 正式事务边界 |
|---|---|---|---|
| `createRun()` | `run/input/startJob/messages/files/artifacts/approvals` | `conversation.message` | `runs + run_inputs + run_messages + approvals + runtime_job_payloads` |
| `sendMessage()` | `messages[]` | `conversation.message` | `run_messages + runs.updated_at` |
| `approve()` | `approvals[] + run.status + messages[]` | `run.status.changed + conversation.message` | `approvals + runs + run_messages + audit_log` |
| `cancel()` | `run.status + messages[]` | `run.status.changed + conversation.message` | `runs + run_messages + audit_log` |
| `syncRunStatus()` | `run.status` | `run.status.changed` | `runs` |
| `syncArtifacts()` | `artifacts[]` | `artifact.ready[]` | `run_artifacts + run_files` |
| `ingestBridgeEvents()` | `run/messages/approvals/artifacts/files` | 原样转发所有 parsed events | 事件先入 `run_events` 再异步投影 |

## 6. Bridge 事件类型与投影表

| 事件类型 | 当前载荷 | 当前投影结果 | 正式表投影 |
|---|---|---|---|
| `run.status.changed` | `runId/status/occurredAt/reason` | 更新 `run.status` | `run_events` + `runs.status projection` |
| `conversation.message` | `message` | 追加 message | `run_events` + `run_messages` |
| `approval.requested` | `approval` | upsert approvals | `run_events` + `approvals` |
| `artifact.ready` | `artifact` | upsert artifacts | `run_events` + `run_artifacts` |
| `files.synced` | `files[]` | 全量替换 files | `run_events` + `run_files snapshot batch` |
| `file.changed` | `file` | 单文件 upsert | `run_events` + `run_files delta` |
| `heartbeat` | `runId/occurredAt` | 忽略投影 | `run_events` 或 `run_heartbeats` |
| `run.failed` | `runId/error` | 更新 `run.status=FAILED` | `run_events` + `runs.failure projection` |

## 7. 当前持久化组件能力边界表

| 组件 | 当前能力 | 当前限制 |
|---|---|---|
| `FileBackedRunsRepository` | 启动时加载全部 JSON、save/update 原子 rename | 单机单进程、无事务、无并发控制、无索引 |
| `InMemoryRunEventBus` | 进程内订阅、append JSONL、重启后回灌 backlog | 无 cursor、无消费组、跨实例不可用 |
| `runAggregateSchema` | 用 Zod 守住聚合结构 | 聚合过大，写放大严重 |

## 8. 正式 PostgreSQL 拆表表

| 当前聚合片段 | 正式表 | 权威写入方 | 备注 |
|---|---|---|---|
| `run` | `runs` | API service | 主记录 |
| `input` | `run_inputs` | API create run | 槽位、文件、密文字段可拆 |
| `startJob` | `runtime_job_payloads` | API create run | 只给 Worker/Bridge 消费 |
| `messages[]` | `run_messages` | API + bridge projector | 保持时序与 message_seq |
| `files[]` | `run_files` | bridge projector + file sync job | `unique(run_id, path)` |
| `artifacts[]` | `run_artifacts` | bridge projector + artifact publisher | 交付对象 |
| `approvals[]` | `approvals` | API + bridge projector | 审批状态机 |
| 无独立事件表 | `run_events` | bridge ingress + API 本地动作 | 事件权威源 |

## 9. `run_events` 正式事件表最小字段表

| 字段 | 说明 |
|---|---|
| `event_id` | 事件主键 |
| `run_id` | 所属 run |
| `event_seq` | 单 run 单调递增序号 |
| `event_type` | 事件类型 |
| `payload_json` | 原始事件载荷 |
| `source` | `api / bridge / worker / system` |
| `source_ref_id` | bridgeId、worker jobId 等 |
| `occurred_at` | 事件发生时间 |
| `ingested_at` | 事件入库时间 |

## 10. 读模型拆分表

| 读取场景 | 当前读取方式 | 正式读模型 |
|---|---|---|
| 实例列表 | 全量读取聚合 JSON | `runs list query` |
| 实例详情 | 读取单个聚合 JSON | `run_snapshot_view` 或 service 组装 |
| 对话流 | 聚合内 `messages[]` | `run_messages` 按 `message_seq` 读取 |
| 文件树 | 聚合 `files[]` + 目录扫描 | `run_files` + lazy filesystem sync |
| 审批列表 | 聚合 `approvals[]` | `approvals` query |
| 回放/审计 | JSONL backlog | `run_events` + object storage export |

## 11. 双写切流执行表

| 阶段 | 行为 | 权威源 | 校验方式 |
|---|---|---|---|
| Phase 1 | 定义 repository interface | JSON | service 依赖接口而非实现 |
| Phase 2 | 新增 PostgreSQL writer | JSON | 写后比对 DB 与 JSON 聚合摘要 |
| Phase 3 | 打开双写 | JSON | 每 run 校验 `run/messages/files/artifacts/approvals` 数量与 hash |
| Phase 4 | 列表主读切 DB | DB list / JSON detail | 列表 UI 与 JSON 结果比对 |
| Phase 5 | 详情主读切 DB | DB | snapshot 对比工具校验 |
| Phase 6 | JSON 退化为迁移备份 | DB | 仅保留导出与回滚窗口 |

## 12. 事件回流与实时链重构表

| 当前链路 | 当前问题 | 正式方案 |
|---|---|---|
| `bridge -> service.ingestBridgeEvents() -> repository.update() -> eventBus.appendMany()` | 事件先投影、后广播，缺正式 event store | `bridge -> run_events append -> projector -> websocket/sse` |
| `api 本地动作 -> eventBus.append()` | 本地事件与 bridge 事件无统一序号 | 本地动作也走 `run_events` |
| `socket-routes` 订阅内存 backlog | 多实例不可用 | 改为 `run_events` cursor replay |
| SSE fallback 依赖同进程事件 | 无跨节点一致性 | 走共享 event store / broker |

## 13. 审批与状态播种修正表

| 当前行为 | 当前问题 | 正式要求 |
|---|---|---|
| `createSeedApproval()` 默认创建一条 pending approval | 所有 run 启动即待审批，语义偏粗 | 按 `approval_policy` 与连接器风险动态播种 |
| `approve()` 默认取第一条 pending approval | 多审批节点时可能误操作 | 必须显式按 `approval_id` 决策 |
| `syncRunStatus()` 直接改 status | 缺审计与来源记录 | 先入 `run_events`，再投影 |

## 14. 文件与产物持久化收敛表

| 当前行为 | 当前问题 | 正式要求 |
|---|---|---|
| `createSeedFiles()` 预播目录项 | 目录存在与否未验证 | runtime prepare 完成后回传实际目录快照 |
| `files.synced` 全量替换 `files[]` | 无版本号，可能覆盖新变更 | 增加 `sync_cursor` 或 `occurred_at` 判定 |
| `artifact.ready` 与 `run_files` 分离 | 产物与文件可能不一致 | `artifact publish` 同事务 upsert `run_artifacts + run_files` |
| download URL 存在 artifact 上 | URL 可能过期 | 正式环境只存 `storage_key`，下载时临时签名 |

## 15. 运行启动载荷持久化表

| 当前字段 | 当前位置 | 正式落点 | 原因 |
|---|---|---|---|
| `initialPrompt` | `startJob` | `runtime_job_payloads.initial_prompt` | Worker/Bridge 需要权威读取 |
| `requestedInitialMessage` | `startJob` | 同上 | 保留用户首轮补充 |
| `bindings` | `startJob` | `runtime_job_payloads.bindings_json` | 保留实例化绑定快照 |
| `credentialMounts` | `startJob` | `runtime_job_payloads.credential_mounts_json` | 启动时挂载 |
| `mcpBindings` | `startJob` | `runtime_job_payloads.mcp_bindings_json` | bridge 物化与治理追踪 |

## 16. 阻塞项表

| 阻塞项 | 当前原因 | 影响 | 优先级 |
|---|---|---|---|
| `packages/db` 主链未完成 | 已有最小共享骨架与 migration 承载层，但正式 repository 与双写主链仍未建立 | 无法开始完整双写 | P0 |
| `run_events` 表与 projector 缺失 | 事件仍靠 JSONL + 内存 | 无法稳定横向扩展 | P0 |
| repository interface 缺失 | `RunsService` 直接绑死 file-backed 实现 | service 难以平滑替换 | P0 |
| approval policy 缺失 | 预播审批策略过粗 | 实例状态语义失真 | P1 |
| message/file/artifact sequence 缺失 | 无正式顺序号 | 回放与 cursor replay 困难 | P1 |

## 17. 完成判定表

| 判定项 | 满足条件 |
|---|---|
| 正式持久化完成 | `runs/run_messages/run_files/run_artifacts/approvals/run_events` 已成为权威源 |
| 双写切流完成 | JSON 与 DB 双写校验通过，并已切换主读 |
| 事件链完成 | WS/SSE backlog 与增量都来自正式 `run_events` |
| 启动链完成 | `startJob` 不再只存在聚合 JSON 中，Worker 可从正式存储读取 |
| 审批链完成 | 审批按显式 `approval_id` 决策，播种由策略驱动 |

## 18. 当前已验证 Run 聚合基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| 聚合权威结构 | 当前 `runAggregateSchema = runSnapshot + input + startJob` | `app/api/src/modules/runs/storage-schema.ts` |
| Run JSON 持久化 | 当前 `FileBackedRunsRepository` 负责加载/保存 `<runId>.json` | `app/api/src/modules/runs/repository.ts` |
| Event JSONL 持久化 | 当前 `InMemoryRunEventBus` 负责 append `<runId>.jsonl` 与内存 backlog | `app/api/src/modules/realtime/event-bus.ts` |
| 事件投影 | 当前 `RunsService` 直接把 bridge events 投影回聚合，再广播 | `app/api/src/modules/runs/service.ts` |
| 启动载荷嵌入 | 当前 `startJob` 只存在聚合 JSON 中 | `app/api/src/modules/runs/storage-schema.ts`、`service.ts` |
| seed 审批/目录项 | 当前 createRun 时即播种默认 approval、receipts/output/archive 目录项 | `app/api/src/modules/runs/service.ts` |

## 19. 当前不可宣称完成的正式持久化能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| `run_events` 正式事件表 | 未实现 | 当前仍依赖 JSONL + 内存 |
| projector 分离 | 未实现 | 事件投影仍直接耦合在 `RunsService` |
| 显式审批节点决策 | 未完成 | 当前 `approve()` 默认处理第一条 pending approval |
| 事件序号/cursor | 未实现 | 当前只有 `eventId` UUID，没有单 run 顺序 cursor |
| runtime payload 正式表 | 未实现 | `startJob` 当前未拆到正式存储表 |

## 20. 聚合切流收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 先拆 `run_events` 与 projector | 事件成为权威源 |
| Phase 2 | 再拆 `runs/messages/files/artifacts/approvals` 正式表 | 聚合 JSON 可退场 |
| Phase 3 | 再把 `startJob` 拆到 runtime payload 正式表 | Worker/Bridge 可脱离 JSON 聚合 |
| Phase 4 | 最后修正审批播种与按 `approval_id` 决策 | 审批语义收口 |
