# 灵办词元 Repository接口、事务与切换执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Repository接口、事务与切换执行总表 |
| 适用范围 | `app/api`、未来 `packages/db`、未来 `packages/shared`、后续 PostgreSQL / object storage 正式数据层 |
| 统计日期 | 2026-07-10 |
| 统计口径 | 以当前 `FileBackedRunsRepository`、`InMemoryRunEventBus`、`RunsService`、`RunFileAccessService` 与 `packages/db` 已落地共享层代码行为为准，补齐到接口、事务、切换和一致性修复执行层 |
| 直接证据 | `app/api/src/modules/runs/repository.ts`、`app/api/src/modules/realtime/event-bus.ts`、`app/api/src/modules/runs/service.ts`、`app/api/src/modules/runs/file-access.ts`、`docs/Repository与正式数据访问替换总表.md` |
| 输出目标 | 将当前 file-backed 权威源的写入行为、正式 Repository 接口、事务边界、双写切换和一致性修复动作细化为执行表 |

## 2. 当前持久层事实矩阵

| 组件 | 当前实现 | 当前职责 | 当前限制 |
|---|---|---|---|
| `FileBackedRunsRepository` | `Map + <runId>.json` | 持久化 run 聚合权威源 | 单机、单文件、弱并发 |
| `InMemoryRunEventBus` | `Map + <runId>.jsonl` | 持久化事件 backlog 并广播订阅 | 仅进程内扩散 |
| `@lingban/db` | PostgreSQL manager + migration + transaction helper + runs/realtime 契约 + 共享 runs/event PostgreSQL 实现 | 共享数据访问基础、类型契约与正式实现起点 | 仍未承接 query 主链与多表事务主写 |
| `RunFileAccessService` | 运行时扫描 `targetPath` | 列目录、读文本、下文件 | 不带正式索引与权限域 |
| `RunsService` | 直接依赖 repo 单例 | 负责聚合写入与事件投递 | 业务层与持久层未解耦 |

## 3. 当前 `RunAggregate` 组成矩阵

| 字段 | 当前来源 | 当前含义 |
|---|---|---|
| `run` | `RunRecord` | 实例主记录 |
| `input` | `CreateRunInput` | 创建时的业务输入 |
| `startJob` | `StartRunJobPayload` | worker/runtime 启动材料 |
| `messages[]` | `RunConversationMessage[]` | 完整对话历史 |
| `files[]` | `RunFileEntry[]` | 目标路径文件快照 |
| `artifacts[]` | `RunArtifact[]` | 结果物与输出物记录 |
| `approvals[]` | `RunApproval[]` | 实例审批记录 |

## 4. 当前 file-backed 写入执行矩阵

| 动作 | 当前方法 | 当前行为 | 原子性水平 |
|---|---|---|---|
| 初次保存 | `save()` | `parse -> set Map -> persist json` | 单文件原子 rename |
| 更新保存 | `update()` | `get -> updater -> parse -> set Map -> persist json` | 单文件原子 rename |
| 落盘细节 | `#persist()` | 先写 `.tmp`，再 `renameSync()` 覆盖正式文件 | 单文件原子，跨文件非事务 |
| 进程启动恢复 | `#loadFromDisk()` | 扫描 runs 目录全部 JSON 并 parse | 可恢复单机场景 |
| 清空存储 | `clear()` | 删除所有 run JSON | 仅测试/开发用途 |

## 5. 当前事件层写入执行矩阵

| 动作 | 当前方法 | 当前行为 | 当前限制 |
|---|---|---|---|
| 事件追加 | `append()` | `parse -> inferRunId -> push memory -> append jsonl -> notify listeners` | 无跨进程广播 |
| 批量事件追加 | `appendMany()` | 顺序调用 `append()` | 无事务包裹 |
| backlog 查询 | `list(runId)` | 从内存复制返回 | 仅本进程可见 |
| 订阅 | `subscribe(runId, listener)` | 进程内 Set 监听器 | 无 cursor、无 backpressure |
| 磁盘恢复 | `#loadFromDisk()` | 重放 jsonl 恢复历史 | 无损坏修复与裁剪策略 |

## 6. 当前 Service 到持久层执行矩阵

| Service 动作 | Repository 写入 | Event Bus 写入 | 当前说明 |
|---|---|---|---|
| `createRun()` | 一次性写入 run 聚合 | 只发首条 `conversation.message` | 审批与文件种子都落在聚合内 |
| `sendMessage()` | 追加 `messages[]` | 广播 1 条 `conversation.message` | bridge 异步分发不入事务 |
| `approve()` | 更新 `run + approvals + messages` | 广播状态变更与系统消息 | 审批与事件不是统一事务 |
| `cancel()` | 更新 `run + messages` | 广播状态变更与系统消息 | 运行停止命令异步发出 |
| `syncRunStatus()` | 更新 `run.status` | 广播状态变更 | 与外部 runtime 时序耦合 |
| `syncArtifacts()` | upsert `artifacts[]` | 广播 `artifact.ready` | 文件索引未同步成独立表 |
| `ingestBridgeEvents()` | 逐条投影到聚合 | 逐条广播 parsed event | 事件持久化与投影混在 service 中 |

## 7. 正式 Repository 接口分层矩阵

| 层级 | 接口建议 | 主要职责 | 目标位置 |
|---|---|---|---|
| Core Repository | `RunsRepository` | run 聚合读写接口 | `packages/db` |
| Core Repository | `RunMessageRepository` | 消息追加、分页读取 | `packages/db` |
| Core Repository | `RunApprovalRepository` | 创建审批、决策审批、列待审批 | `packages/db` |
| Core Repository | `RunArtifactRepository` | 产物 upsert 与检索 | `packages/db` |
| Core Repository | `RunFileRepository` | 文件索引、路径 stat、树形读 | `packages/db` |
| Core Repository | `RunEventBus / RunEventRepository` | 原始事件入库、backlog 与 cursor 查询 | `packages/db` |
| Query Repository | `RunQueryRepository` | 实例列表、筛选、排序、看板摘要 | `packages/db` |
| Query Repository | `CreatorQueryRepository` | package/release/replay/governance 聚合视图 | `packages/db` |
| Infra Repository | `ObjectStorageIndexRepository` | 对象 key、版本、下载授权记录 | `packages/db` |

## 8. 正式事务单元矩阵

| 事务单元 | 需要包裹的对象 | 原因 |
|---|---|---|
| 创建 run | `runs + run_inputs + seed_message + seed_approval + run_seed_files` | 避免实例初始态残缺 |
| 发送消息 | `run_messages + runs.updated_at` | 保证消息时间线和实例更新时间一致 |
| 审批决策 | `approval_decision + approvals.state + runs.status + audit_event` | 决策必须可审计且不可半成功 |
| runtime 状态变更 | `run_events + runs.status projection` | 保证重放与当前状态一致 |
| 产物就绪 | `run_artifacts + run_files index + audit_event` | 前台可见文件与交付记录一致 |
| 上传完成 | `upload_session + input_material + message_attachment_binding` | 避免上传成功但消息引用丢失 |

## 9. 正式 Query 能力矩阵

| 查询场景 | 当前实现 | 正式 Query Repository |
|---|---|---|
| run 列表 | `runsRepository.list()` 全量读内存 | 按 workspace、状态、更新时间、标签筛选 |
| 待审批列表 | 无 | 按角色、风险级、超时状态查询 |
| Creator 包列表 | 前端本地数据 | package/version/release 联表视图 |
| 文件树 | 动态扫目录 | 文件索引 + 对象存储元数据 |
| 审计导出 | 无正式域 | 按 run、workspace、release 过滤导出 |

## 10. Repository 解耦执行矩阵

| 动作 | 当前状态 | 正式改造动作 |
|---|---|---|
| 业务层依赖注入 | `RunsService` 直接依赖单例 | 定义 repository interface 与 service constructor 注入 |
| 时间与 ID 生成 | service 内部局部计数器 | 抽到 shared infra，支持 DB/分布式环境 |
| 事件投影 | service 内部 `switch(event.type)` | 拆为 event projector / handler 组件 |
| 文件索引 | `RunFileAccessService` 扫描后写回聚合 | 独立 `RunFileRepository` + repair job |
| 审批写回 | service 直接改聚合 | 独立 approval repository + transaction unit |

## 11. 双写与切换执行矩阵

| 阶段 | 主读源 | 主写源 | 辅写源 | 验证动作 |
|---|---|---|---|---|
| Phase 1: 接口化 | JSON | JSON | 无 | service 全部经接口访问 |
| Phase 2: DB 实现接入 | JSON | JSON | DB | 比对 run/message/approval 计数 |
| Phase 3: 双写观测 | JSON | JSON + DB | 无 | 每批 run 做一致性校验 |
| Phase 4: 主读切换 | DB | JSON + DB | 无 | 双端读 DB 快照，与 JSON 对比 |
| Phase 5: DB 权威化 | DB | DB | JSON 备份只读 | 关闭 JSON 主写 |
| Phase 6: JSON 退场 | DB | DB | 无 | 仅保留迁移备份 |

## 12. 一致性修复作业矩阵

| 作业 | 触发时机 | 作用 |
|---|---|---|
| `run_snapshot_rebuild_job` | 事件重放、切流前后 | 从 `run_events` 重建当前快照 |
| `file_index_repair_job` | watcher 漏事件、对象存储回补 | 重扫 target/output 建索引 |
| `approval_consistency_check_job` | 审批系统升级、双写阶段 | 校验审批状态与 run 状态是否冲突 |
| `artifact_index_repair_job` | 输出目录重整、上传失败恢复 | 修复 artifact 与文件索引不一致 |
| `json_db_diff_job` | 双写阶段 | 输出 JSON 与 DB 差异报告 |

## 13. 切换前必须补齐的接口矩阵

| 接口/能力 | 当前状态 | 作用 |
|---|---|---|
| `Repository` interface | 部分实现 | `packages/db` 已提供 runs/realtime 契约，并承接共享 runs/event PostgreSQL 实现，仍需扩展到 service 注入层 |
| `TransactionManager` | 部分实现 | `packages/db` 已提供共享 transaction helper，仍需承接多表正式持久化 |
| `QueryRepository` | 缺失 | 让列表与治理视图可正式查询 |
| `Migration` runner | 部分实现 | `packages/db` 已提供 migration loader / executor，仍缺正式 CLI 与回滚剧本 |
| `Repair jobs` | 缺失 | 解决索引与事件投影不一致 |

## 14. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| `RunsService` 直接耦合单例 repo | 无法平滑切 PostgreSQL | 后端正式化受阻 | P0 |
| 无事务层 | 多对象写入无法保证一致性 | 审批、上传、产物链风险高 | P0 |
| 事件只在进程内广播 | 无法横向扩展 | 实时链规模受限 | P1 |
| 文件索引不是正式存储 | 大目录与对象存储无法稳定支撑 | 文件域能力受阻 | P1 |

## 15. 当前已验证接口/事务起点表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| File-backed save/update | 已存在 `save/get/list/update/clear` | `app/api/src/modules/runs/repository.ts` |
| 单文件原子写 | 当前通过 `.tmp` + `renameSync()` 覆盖 JSON | `app/api/src/modules/runs/repository.ts` |
| Shared transaction helper | 已存在 `withTransaction()` / `runPostgresTransaction()` | `packages/db/src/index.ts` |
| Shared run/event contracts | 已存在 `runAggregateSchema`、`RunsRepository`、`RunEventBus` | `packages/db/src/runs.ts` |
| Shared runs/event PostgreSQL impl | 已存在 `PostgresRunsRepository`、`PostgresRunEventBus` | `packages/db/src/runs-repository.ts`、`packages/db/src/run-event-bus.ts` |
| Event append | 当前 `append/appendMany/list/subscribe` 已存在 | `app/api/src/modules/realtime/event-bus.ts` |
| 事件持久化 | 当前每条事件 append 到 `<runId>.jsonl` | `app/api/src/modules/realtime/event-bus.ts` |
| 文件索引回写 | 当前 `listRunFiles()` 会扫描目录后回写 `aggregate.files` | `app/api/src/modules/runs/file-access.ts` |
| Service 耦合现状 | 当前 service 没有 interface/transaction 注入层 | `app/api/src/modules/runs/service.ts` |

## 16. 当前不可宣称完成的接口/事务能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| Repository 抽象层 | 部分实现 | `packages/db` 已存在共享接口层与部分共享实现，但 service 尚未通过注入层完全切换 |
| TransactionManager | 部分实现 | 共享 transaction helper 已存在，但没有跨 `runs/messages/approvals/artifacts/files/events` 的正式 DB 原子边界 |
| DB dual-write | 未实现 | 当前只有 JSON/JSONL 单写 |
| Repair jobs | 未实现 | `run_snapshot_rebuild_job/file_index_repair_job` 仅停留在文档 |
| Cursor-based event replay | 未实现 | event bus 当前只有内存 list，没有 cursor/offset |

## 17. 接口/事务收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 定义 repository interfaces 与 transaction unit | 已起盘，下一步是让 service 全量经共享接口访问 |
| Phase 2 | 把 `RunsService` 改为 constructor 注入 | 单例耦合解除 |
| Phase 3 | 落地 DB 实现与 dual-write | 事务能力开始成型 |
| Phase 4 | 落地 repair/diff/rebuild jobs | 切流期间一致性可修复 |
| Phase 5 | 切换主读主写 | JSON/JSONL 退化为冷备 |
