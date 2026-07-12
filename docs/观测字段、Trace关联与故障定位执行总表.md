# 灵办词元 观测字段、Trace关联与故障定位执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 观测字段、Trace关联与故障定位执行总表 |
| 适用范围 | `app/api`、`app/run-worker`、`app/container-bridge`、`app/dashboard`、`app/mobile` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 API logger 配置、event bus JSONL、bridge stdout/stderr、前端 realtime 接线与正式排障目标为准 |
| 直接证据 | `app/api/src/app/create-server.ts`、`app/api/src/modules/realtime/event-bus.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/transports/api-connector.ts`、`app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts` |
| 输出目标 | 把日志字段、trace 传播、run 级排障、告警收敛、前端故障可视化补到执行层表格 |

## 2. 当前观测载体矩阵

| 载体 | 当前状态 | 证据 | 当前问题 |
|---|---|---|---|
| API 框架 logger | 关闭 | `create-server.ts` 中 `logger: false` | 请求级日志未结构化采集 |
| API 事件存档 | 已有 | `event-bus.ts` 追加 `*.jsonl` | 仅限单机文件，缺索引与检索 |
| Run 元数据存档 | 已有 | `repository.ts` file-backed `*.json` | 与日志未统一关联 |
| Worker/Bridge 运行日志 | 已有 | `bridge-runner.ts` 写 `bridge.stdout.log`、`bridge.stderr.log` | 缺结构化字段与 trace 关联 |
| Bridge -> API 错误 | 已有文本错误 | `api-connector.ts` 文本拼接错误 | 不利于程序化聚合 |
| 前端实时状态 | 有基础连接状态 | `runStream.ts` 中 `connected/transport` | 无埋点、无错误分级 |

## 3. 统一字段规范矩阵

| 字段 | 适用范围 | 作用 |
|---|---|---|
| `trace_id` | 全链路 | 串联一次用户动作到 API/Worker/Bridge |
| `span_id` | 全链路 | 串联分段处理 |
| `run_id` | 全链路 | 运行实例唯一主键 |
| `workspace_id` | 全链路 | 租户与隔离定位 |
| `user_id` | 前端/API | 触发者定位 |
| `bridge_id` | Bridge/API | 定位具体 bridge 会话 |
| `job_id` | Worker/API | 定位启动与调度作业 |
| `event_id` | Realtime/API | 定位事件投递与重放 |
| `message_id` | 对话链 | 定位一次消息发送与回流 |
| `artifact_id` | 文件/产物链 | 定位结果文件与同步动作 |
| `surface` | 前端/API | 标记 Dashboard/H5/WeChat/Alipay |
| `transport` | Realtime | 标记 `ws` / `sse` / `http` |

## 4. Trace 传播执行矩阵

| 链路 | 当前状态 | 正式要求 |
|---|---|---|
| Dashboard/H5 -> API | 当前无显式 trace 字段 | 每次 HTTP/WS/SSE 建连都注入 `trace_id` / `surface` |
| API -> Worker | 当前进程内模块调用，无独立 trace | 在 job payload 中写入 `trace_id`、`job_id` |
| Worker -> Bridge | 当前 runtime context 未见 trace 字段 | `bridge-context.*.json` 应带 `trace_id` |
| Bridge -> API internal | 当前只发业务 payload | 所有 internal 请求带 `trace_id`、`bridge_id`、`run_id` |
| Event Bus -> 前端 | 当前只有 `eventId` 和业务事件 | snapshot / event envelope 增加 trace/causation 字段 |

## 5. API 关键日志字段矩阵

| 场景 | 至少要打的字段 |
|---|---|
| `POST /v1/runs` | `trace_id`、`workspace_id`、`user_id`、`task_version_id`、`session_version_id`、`run_id` |
| `POST /v1/runs/:id/messages` | `trace_id`、`run_id`、`user_id`、`message_length`、`attachment_count` |
| `POST /v1/runs/:id/approvals` | `trace_id`、`run_id`、`approval_id`、`decision`、`user_id` |
| `GET /v1/runs/:id/files/*` | `trace_id`、`run_id`、`path`、`workspace_id`、`user_id` |
| SSE/WS 建连 | `trace_id`、`run_id`、`transport`、`workspace_id`、`user_id` |
| internal ingest | `trace_id`、`run_id`、`bridge_id`、`event_count`、`service_name` |

## 6. Worker / Bridge 关键日志字段矩阵

| 场景 | 至少要打的字段 |
|---|---|
| `startRunJob` 接收 | `trace_id`、`job_id`、`run_id`、`workspace_id`、`target_path` |
| workspace 准备 | `trace_id`、`run_id`、`run_root`、`runtime_path` |
| runtime 物料生成 | `trace_id`、`run_id`、`mcp_binding_count`、`secret_mount_count` |
| bridge 启动 | `trace_id`、`run_id`、`bridge_id`、`command`、`args_hash` |
| PTY 发送消息 | `trace_id`、`run_id`、`message_id`、`input_length` |
| 文件同步 | `trace_id`、`run_id`、`artifact_count`、`file_count` |
| bridge 退出 | `trace_id`、`run_id`、`bridge_id`、`exit_code`、`signal` |

## 7. 前端埋点字段矩阵

| 动作 | 建议字段 |
|---|---|
| 打开工坊页 | `trace_id`、`surface`、`workspace_id`、`route` |
| 启动 run | `trace_id`、`surface`、`workspace_id`、`service_id` |
| 进入任务/实例详情 | `trace_id`、`run_id`、`workspace_id`、`surface` |
| 发送消息 | `trace_id`、`run_id`、`transport`、`message_length` |
| 查看文件/切换路径 | `trace_id`、`run_id`、`path`、`surface` |
| 文件下载 | `trace_id`、`run_id`、`path`、`download_mode` |
| 工作区切换 | `trace_id`、`from_workspace_id`、`to_workspace_id` |

## 8. Run 级故障定位执行矩阵

| 故障类型 | 先看哪里 | 再看哪里 | 最终定位依据 |
|---|---|---|---|
| run 无法创建 | API 请求日志 | `repository` 写入记录 | `run_id` 是否生成、状态是否进入 `CREATED` |
| run 卡在 `QUEUED` | Worker 启动作业日志 | runtime 物料目录 | `job_id`、`runtime-config.json`、launch plan |
| bridge 启动失败 | `bridge.stderr.log` | API internal `run.failed` 事件 | `bridge_id`、exit code、错误文本 |
| 消息发送无回流 | 前端 transport 状态 | WS/SSE 日志、API message route、bridge PTY 日志 | `message_id`、`run_id` |
| 文件页无内容 | API `/files/*` 请求日志 | target path、bridge 文件监听日志 | `run_id`、`path`、文件同步事件 |

## 9. 告警到排障路径矩阵

| 告警类型 | 触发条件 | 一线处理动作 |
|---|---|---|
| API 5xx 激增 | 单位时间 5xx 超阈值 | 先按 `route + trace_id + workspace_id` 聚类 |
| run 启动失败率升高 | `run.failed` / `STARTING` 超时升高 | 检查 runner image、bridge 启动、secret/mcp 注入 |
| realtime 断连率升高 | WS close / SSE reconnect 过高 | 检查 API、网关、前端回退策略 |
| 文件同步失败 | `file.changed/files.synced` 缺失或失败 | 查 bridge watcher 与 target path |
| 单工作区异常集中 | 某 `workspace_id` 告警集中 | 排查该空间凭证、MCP、目录、权限 |

## 10. JSONL / 文件日志收敛矩阵

| 当前文件 | 当前作用 | 正式建议 |
|---|---|---|
| `api/events/<runId>.jsonl` | 保存 run event backlog | 进入正式日志平台前保留为本地 fallback |
| `api/runs/<runId>.json` | 保存 run snapshot | 与 `jsonl` 建立版本戳与时间线关联 |
| `runs/<runId>/logs/bridge.stdout.log` | 保存 PTY/bridge 标准输出 | 改为结构化解析 + 原始文件双保留 |
| `runs/<runId>/logs/bridge.stderr.log` | 保存标准错误 | 与 `run.failed` 自动关联 |

## 11. Dashboard / H5 故障可视化矩阵

| 页面区域 | 当前状态 | 正式建议 |
|---|---|---|
| 实时连接状态 | 只有 `connected/transport` 能力 | 顶部状态条显示连接、重连、最近错误 |
| 文件预览失败 | 常回落为 `null` 文案 | 显示错误码、失败原因、下载替代动作 |
| 发送消息失败 | 主要体现在按钮 pending | 增加发送失败提示、重试动作、transport 来源 |
| run 启动失败 | 当前多靠状态文案 | 展示 `run.failed` 摘要、时间点、查看日志入口 |
| 审批/治理失败 | 当前未成型 | 统一错误卡片与审计链接 |

## 12. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| API logger 关闭 | `logger: false` | 缺统一请求级日志 | P0 |
| 缺 trace 字段 | 各层没有统一 trace 传递 | 难以做端到端故障关联 | P0 |
| 错误多为文本拼接 | `HTTP_500`、connector 文本错误 | 不利于告警聚类与自动排障 | P1 |
| 前端无正式埋点 | run 交互无法按用户动作回放 | 线上问题定位成本高 | P1 |

## 13. 当前已验证 Trace 起点表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| API 请求日志 | 当前无结构化 logger | `app/api/src/app/create-server.ts` |
| Event backlog | 当前每条事件已有 `eventId/runId/event`，但无 trace | `app/api/src/modules/realtime/event-bus.ts` |
| Worker/Bridge 日志文件 | 当前可按 runRoot 找到 stdout/stderr 文件 | `app/run-worker/src/services/bridge-runner.ts` |
| Bridge internal 请求 | 当前 `ApiConnector` 只发业务 payload 与可选内部 token header | `app/container-bridge/src/transports/api-connector.ts` |
| 前端连接状态 | 当前只能看到 `connected/transport`，没有 trace 维度 | `app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts` |

## 14. 当前不可宣称完成的 Trace/故障定位能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| trace_id 贯通 | 未实现 | 各层 payload/log/header 当前都没有 trace 字段 |
| request_id 贯通 | 未实现 | API 错误响应与日志不带 request id |
| span/causation 链 | 未实现 | 事件 envelope 当前只有 eventId |
| 前端故障回放 | 未实现 | 没有前端埋点与错误上报 |
| 聚合检索 | 未实现 | Bridge/API 日志仍分散在本地文件 |

## 15. Trace 收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 先加 request_id/trace_id 到 API/前端请求头 | 用户动作可跨层串联 |
| Phase 2 | 再把 trace 带入 job payload、runtime config、bridge internal 请求 | worker/bridge 故障可追 |
| Phase 3 | 再把 error/event/log 聚合到统一检索面 | run 级排障可收口 |
| Phase 4 | 最后补前端错误埋点与回放链接 | 体验问题可闭环复盘 |
