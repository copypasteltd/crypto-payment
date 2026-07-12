# 灵办词元 Repository 与正式数据访问替换总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Repository 与正式数据访问替换总表 |
| 适用范围 | `app/api`、未来 `packages/db`、后续正式数据访问层 |
| 统计日期 | 2026-07-10 |
| 当前事实 | 当前 API 运行时主链仍保留 `FileBackedRunsRepository` 与 `InMemoryRunEventBus` 作为 fallback；但 `packages/db` 已落地 PostgreSQL manager、migration、transaction helper，以及 `RunAggregate / RunsRepository / RunEventBus / RunFilesIndexRepository` 等共享契约，并已下沉 `PostgresRunsRepository / PostgresRunEventBus / PostgresRunFilesIndexRepository` 共享实现，`app/api` 已开始消费共享实现 |
| 文档目标 | 统一说明当前读写边界、目标 Repository 拆分、服务替换路径、事务边界、切换顺序与缺口 |

## 2. 证据来源总表

| 类型 | 路径 |
|---|---|
| 当前 Run Repository | `app/api/src/modules/runs/repository.ts` |
| 当前 Event Store | `app/api/src/modules/realtime/event-bus.ts` |
| 当前 Run File Index | `app/api/src/modules/runs/file-index.ts` |
| 当前 Service 层 | `app/api/src/modules/runs/service.ts` |
| 当前存储入口 | `app/api/src/app/storage.ts` |
| 正式化设计依据 | `docs/数据库与正式数据模型总表.md`、`docs/后端开发文档.md`、`docs/数据迁移与切换总表.md` |

## 3. 当前数据访问组件总表

| 组件 | 位置 | 当前职责 |
|---|---|---|
| `FileBackedRunsRepository` | `modules/runs/repository.ts` | 维护 run 聚合 JSON 权威源 |
| `InMemoryRunEventBus` | `modules/realtime/event-bus.ts` | 维护内存事件 backlog 并落 JSONL |
| `@lingban/db` | `packages/db` | 提供 PostgreSQL manager、migration、transaction helper、runs/realtime/file-index 共享契约，以及共享 `PostgresRunsRepository / PostgresRunEventBus / PostgresRunFilesIndexRepository` |
| `FileBackedRunFilesIndexRepository` | `modules/runs/file-index.ts` | 维护 run file index 的本地 JSON fallback |
| `RunFileAccessService` | `modules/runs/file-access.ts` | 扫描 targetPath、读取与下载本地文件 |
| `RunsService` | `modules/runs/service.ts` | 组合 repository、event bus、orchestrator 完成业务流程 |

## 4. 当前 Repository 读写矩阵表

| 对象 | 当前写入方 | 当前读取方 | 当前载体 |
|---|---|---|---|
| run 聚合 | `RunsService` | `RunsService`、文件访问服务 | JSON 文件 |
| event backlog | `RunsService`、WS/SSE、Bridge ingest | `socket-routes`、SSE、重放逻辑 | 内存 + JSONL |
| 文件列表 | `RunFileAccessService` 扫描后回写 repository | 前端文件页 | run 聚合内 `files[]` |
| 审批记录 | `RunsService` | 前端实例页 | run 聚合内 `approvals[]` |
| 产物记录 | `RunsService` | 前端实例页 | run 聚合内 `artifacts[]` |

## 5. 当前技术债总表

| 问题 | 当前表现 |
|---|---|
| 单文件聚合过大 | run 元数据、消息、审批、产物全部塞在单个 JSON |
| 无事务边界 | JSON 文件更新无法提供正式事务能力 |
| 无并发控制 | 多进程 / 多实例写入无法保证一致性 |
| 检索能力弱 | 复杂筛选只能靠全量读取或前端样例数据 |
| 事件扩展性弱 | JSONL + 内存总线适合单机场景 |

## 6. 目标正式 Repository 分层总表

| 层级 | 建议内容 | 目标位置 |
|---|---|---|
| Core Repository | 单表读写，如 `RunRepository`、`MessageRepository` | `packages/db` |
| Query Repository | 聚合查询、列表检索、Creator 视图查询 | `packages/db` |
| Transaction Unit | 统一事务封装 | `packages/db` |
| Storage Repository | 对象存储索引、文件元数据 | `packages/db` + object storage client |
| Audit Repository | 审计、成本、配额读写 | `packages/db` |

## 7. 建议核心 Repository 接口总表

| 接口 | 职责 |
|---|---|
| `RunRepository` | `create/get/updateStatus/list` |
| `RunMessageRepository` | `append/listByRunId` |
| `RunFileRepository` | `upsert/listTree/statByPath` |
| `RunArtifactRepository` | `upsert/listByRunId` |
| `ApprovalRepository` | `create/update/listPending` |
| `RunEventRepository` | `append/listBacklog/listSinceCursor` |
| `WorkspaceRepository` | `getById/listByUser` |
| `CredentialBindingRepository` | `listForRunCreation` |

## 8. 建议 Service 到 Repository 映射表

| 当前 Service 动作 | 当前实现 | 正式目标 |
|---|---|---|
| `createRun` | 写单个 run JSON | 事务写 `runs / run_inputs / approvals / messages` |
| `sendMessage` | 修改聚合 JSON | 事务追加消息，并投影更新时间 |
| `approve` | 修改聚合 JSON + run status | 事务更新 `approvals` 与 `runs.status` |
| `cancel` | 修改聚合 JSON | 事务更新 `runs.status` 并追加状态消息 |
| `syncArtifacts` | 更新聚合 JSON | Upsert `run_artifacts` |
| `ingestBridgeEvents` | 修改聚合 JSON + event bus | 持久化事件，再投影到各表 |

## 9. 当前 Event Store 与正式事件层对照表

| 维度 | 当前实现 | 正式目标 |
|---|---|---|
| 存储 | 内存 + JSONL | PostgreSQL 事件表或 Kafka + 冷存储 |
| 订阅 | 进程内监听器 | 独立 realtime gateway / 消费组 |
| 重放 | 从 JSONL 读回 | 基于 cursor 的正式重放 |
| 容错 | 进程级 | 可横向扩展 |

## 10. 事务边界建议总表

| 场景 | 建议事务边界 |
|---|---|
| 创建 run | `runs + run_inputs + approvals + first system message` 同事务 |
| 用户发消息 | `run_messages + runs.updated_at` 同事务 |
| 审批 | `approvals + runs.status + audit log` 同事务 |
| 产物就绪 | `run_artifacts + run_files` 同事务 |
| 事件入库 | `run_events` 与投影更新应具备可重试语义 |

## 11. Repository 替换阶段总表

| 阶段 | 目标 | 说明 |
|---|---|---|
| Phase 1 | 定义 repository interface | 已部分完成，`packages/db` 已提供 `RunsRepository / RunEventBus / RunMessageRepository / RunArtifactRepository / RunApprovalRepository / RunFileRepository / RunQueryRepository` 契约 |
| Phase 2 | 接入 PostgreSQL repository | 新增正式实现 |
| Phase 3 | 双写 | JSON 与 DB 同步写 |
| Phase 4 | 切换主读 | `get/list` 改读 DB |
| Phase 5 | 移除 file-backed 权威源 | JSON 退化为迁移备份 |

## 12. 与前端能力的关联矩阵表

| 前端能力 | 当前受限点 | 正式 Repository 带来的变化 |
|---|---|---|
| 实例列表筛选 | 当前主要依赖本地样例数据 | 可正式支持按状态、工作区、更新时间筛选 |
| Creator 列表 | 当前纯本地数据 | 可正式读取 package / version / rollout 数据 |
| 文件树与结果页 | 当前依赖本地扫描 | 可正式读取文件索引 |
| 审批视图 | 当前仅快照态 | 可正式支持待审批列表与历史检索 |

## 13. 需要新增的共享包总表

| 包 | 作用 |
|---|---|
| `packages/db` | DB schema、migrations、repositories、transactions |
| `packages/shared` | logger、config、errors、time、ids |
| `packages/auth` | current-user context、RBAC helper |
| `packages/files` | object storage client、path policy、upload/download helper |

## 14. 风险与兼容性矩阵表

| 风险点 | 说明 |
|---|---|
| 状态投影差异 | DB 与 JSON 投影逻辑若不一致，会导致前后端快照差异 |
| 事件顺序 | Bridge 事件顺序与写入顺序需要保证 |
| 回滚复杂度 | 双写阶段需要明确以谁为权威源 |
| 文件索引一致性 | 文件系统扫描与 DB 索引需有修复机制 |

## 15. 当前阻塞项总表

| 阻塞项 | 当前原因 | 优先级 |
|---|---|---|
| `packages/db` 主链未完成 | 已有 manager / migration / transaction helper、共享 runs/event/run-files/query PostgreSQL 实现与部分共享契约，但深度 query repository / seed-reset CLI / 更多正式仓储仍未补齐 | P0 |
| Repository Interface 未完整收口 | runs / realtime 契约已抽到 `packages/db`，但 `RunsService` 仍直接依赖 file-backed 实现 | P0 |
| 事务层未完成切流 | 共享 transaction helper 已存在，但多对象正式持久化事务边界尚未落入 DB repository | P0 |
| Query Repository 缺失 | 列表与聚合检索无法正式落地 | P1 |
| 事件正式存储缺失 | 实时链无法稳定横向扩展 | P1 |

## 16. 实施顺序总表

| 顺序 | 动作 |
|---|---|
| 1 | 继续扩展 `packages/db` 与核心 schema |
| 2 | 完整收口 repository interface 与 transaction interface |
| 3 | 实现 `RunRepository`、`MessageRepository`、`EventRepository` 等 |
| 4 | `RunsService` 切换为依赖接口 |
| 5 | 打开双写并执行一致性比对 |
| 6 | 切换主读并逐步退场 file-backed 权威源 |

## 17. 当前已验证 Repository 基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| Run 权威源 | 当前为 `FileBackedRunsRepository` 的 `Map + <runId>.json` | `app/api/src/modules/runs/repository.ts` |
| Event backlog | 当前为 `InMemoryRunEventBus` 的 `Map + <runId>.jsonl` | `app/api/src/modules/realtime/event-bus.ts` |
| 存储根目录 | 当前由 `LINGBAN_DATA_DIR` 或 `./.lingban-data/api` 解析 | `app/api/src/app/storage.ts` |
| Run 聚合 schema | 当前聚合已迁入 `packages/db/src/runs.ts`，为 `runSnapshot + input + startJob` | `packages/db/src/runs.ts` |
| 文件访问 | 当前由 `RunFileAccessService` 动态扫目录并可回写 `aggregate.files` | `app/api/src/modules/runs/file-access.ts` |
| Service 依赖形态 | `RunsService` 已切为 dependency object；`approval-feedback`、`file-access`、`file-lifecycle` 已支持 constructor/injection，默认单例仅作为组装层保留 | `app/api/src/modules/runs/service.ts` |

## 18. 当前不可宣称完成的 Repository 能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| Repository interface 层 | 部分实现 | `packages/db` 已提供 runs / event / run-files / run-query 共享接口层，`RunsService` 与部分辅助模块已完成 constructor/injection 收口；深度 query repository、更多正式仓储与 file-backed 退场仍未完成 |
| PostgreSQL repository | 部分实现 | `packages/db` 已提供共享 `PostgresRunsRepository / PostgresRunEventBus / PostgresRunFilesIndexRepository / PostgresRunQueryRepository`，但深度 query repository 与更多正式仓储仍缺失 |
| Query repository | 部分实现 | 当前已具备共享 `RunQueryRepository` 与 postgres-backed run snapshot 列表/摘要读路径，但 faceted search、聚合读模型与更深的 query repo 仍未抽齐 |
| Transaction manager | 部分实现 | `packages/db` 已有共享 transaction helper，且多个正式仓储已切到共享事务辅助；更多跨域写链仍待继续收敛 |
| Object storage repository | 部分实现 | `app/api` 已具备对象存储、下载 ticket、预览回源、冷归档与 retention 主链，但尚未抽成共享 `packages/files` repository 层 |
| Audit/cost/quota repository | 部分实现 | billing、quota、MCP audit、credential audit 等正式域已在 `app/api` 落地 repository；共享抽包与统一接口层仍未完成 |

## 19. Repository 收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 先定义 repository / query / transaction 接口 | service 与具体存储解耦 |
| Phase 2 | 落地 PostgreSQL core repositories | 主写链具备正式承载层 |
| Phase 3 | 落地 QueryRepository 与 file/object index | 前台列表、文件域可正式查询 |
| Phase 4 | 打开双写与 diff job | 切流风险可控 |
| Phase 5 | 切主读并退场 file-backed 权威源 | 正式持久化闭环形成 |
