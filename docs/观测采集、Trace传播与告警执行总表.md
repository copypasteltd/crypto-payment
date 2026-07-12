# 灵办词元 观测采集、Trace传播与告警执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 观测采集、Trace传播与告警执行总表 |
| 适用范围 | `app/api`、`app/run-worker`、`app/container-bridge`、`app/dashboard`、`app/mobile`、后续 observability 平台 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 API `logger: false`、event jsonl、bridge stdout/stderr、双端运行态状态和观测指标总表为准，细化日志、trace、指标、告警和落盘执行层 |
| 直接证据 | `app/api/src/app/create-server.ts`、`app/api/src/app/errors.ts`、`app/api/src/modules/realtime/event-bus.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/transports/api-connector.ts`、`docs/观测指标与日志字段总表.md` |
| 输出目标 | 将从用户动作到 API、worker、bridge、事件总线、前端回显的观测采集链、trace 传播链和告警出口细化为执行表 |

## 2. 当前观测事实矩阵

| 证据 | 当前实现 | 当前含义 | 当前缺口 |
|---|---|---|---|
| API `logger: false` | Fastify 未启结构化 logger | HTTP 主链缺正式日志 | 无法统一检索 |
| `event-bus.jsonl` | 每个 run 独立 `.jsonl` | 至少有事件级可回放证据 | 不是正式 observability 平台 |
| bridge stdout/stderr log | `<runRoot>/logs/*.log` | runtime 本地诊断可追 | 无集中检索 |
| `ApiConnector` | internal 调用会抛文本错误 | 错误可返回给 bridge | 无 trace id 贯通 |
| 双端实时状态 | Query cache 与连接状态仅在内存 | 可辅助 UI 提示 | 无埋点与上报 |

## 3. 日志采集执行矩阵

| 层 | 当前载体 | 正式采集动作 | 目标输出 |
|---|---|---|---|
| API | stdout/stderr、error handler、event bus | 接入结构化 logger | 中央日志系统 |
| Worker | 进程日志、runtime 物料 | 记录 job 生命周期日志 | 中央日志系统 |
| Bridge | stdout/stderr 文件、control 事件 | 结构化写 session/control/file/artifact 事件 | 中央日志系统 |
| Dashboard | 浏览器事件与错误 | 埋点 SDK + error reporter | 前端分析平台 |
| Mobile | H5/小程序事件与错误 | 埋点 SDK + error reporter | 前端分析平台 |

## 4. Trace 传播执行矩阵

| 阶段 | 当前状态 | 正式建议 |
|---|---|---|
| 用户点击启动服务 | 无 trace id | 前端生成 `trace_id/request_id` |
| 前端请求 API | 无统一 header | 注入 `X-Trace-Id`、`X-Request-Id` |
| API 创建 run | 无 trace 写入 run 聚合 | 在 run/audit/event 中保留 trace |
| API -> Worker | 当前内存调用 | payload 中带 `trace_id` |
| Worker -> Bridge | 当前 runtime 文件不带 trace 字段 | `runtime-config.json` 中带 trace |
| Bridge -> API ingest | 当前仅 event payload | internal 请求头或 payload 带 `trace_id/span_id` |
| API -> 前端 WS/SSE | 当前不带 trace | `runs.event` envelope 扩展 trace 元数据 |

## 5. API 日志事件执行矩阵

| 事件 | 当前触发点 | 正式日志字段 |
|---|---|---|
| `api.request.received` | 进入路由 | `request_id,trace_id,route,method,user_id,workspace_id` |
| `api.request.completed` | reply send 前 | `status_code,duration_ms` |
| `api.request.failed` | `setErrorHandler()` | `error_code,error_message,status_code` |
| `api.run.created` | `runsService.createRun()` | `run_id,task_version_id,session_version_id` |
| `api.run.message_sent` | `runsService.sendMessage()` | `run_id,message_id,attachment_count` |
| `api.run.approval_decided` | `runsService.approve()` | `run_id,approval_id,decision` |
| `api.bridge.events_ingested` | internal ingest | `run_id,event_count,event_types` |
| `api.realtime.connected` | WS/SSE 建连 | `run_id,transport` |

## 6. Worker / Bridge 日志事件执行矩阵

| 事件 | 当前触发点 | 正式日志字段 |
|---|---|---|
| `worker.run.accepted` | `startRunJob()` | `run_id,workspace_id,trace_id` |
| `worker.workspace.prepared` | `prepareRunWorkspace()` | `run_root,target_path` |
| `worker.runtime.materialized` | `materializeRunRuntime()` | `runtime_dir,mcp_count,secret_count` |
| `worker.bridge.starting` | `startLocalBridgeProcess()` | `control_port,cli_path` |
| `bridge.session.start` | `CodexSession.start()` | `command,args,cwd` |
| `bridge.session.exit` | session 退出 | `exit_code,signal,final_status` |
| `bridge.file.changed` | file watcher 事件 | `file_path,file_kind` |
| `bridge.artifact.ready` | artifact publisher | `artifact_id,file_path` |
| `bridge.ingest.failed` | `ApiConnector` throw | `http_status,error_message` |

## 7. 指标采样执行矩阵

| 指标 | 当前采样点 | 正式采集方式 |
|---|---|---|
| API 请求总量 | 路由入口 | middleware counter |
| API 请求耗时 | 路由入口/出口 | histogram |
| WS 活跃连接数 | socket open/close | gauge |
| SSE 活跃连接数 | stream open/close | gauge |
| run 创建量 | `createRun()` | counter |
| run 失败率 | `run.failed` / terminal status | counter + ratio |
| bridge 会话数 | `CodexSession.start/stop` | gauge |
| 文件变化量 | `file.changed` | counter |
| artifact 完成量 | `artifact.ready` | counter |
| 前端建连成功率 | SDK open/error | counter + ratio |

## 8. 告警判定执行矩阵

| 告警 | 数据来源 | 判定方式 | 当前动作 |
|---|---|---|---|
| API 5xx 升高 | API request metrics | 5 分钟窗口超阈值 | 当前无自动动作 |
| WS/SSE 建连失败升高 | 前端埋点 + API 连接日志 | 比例超阈值 | 当前无自动动作 |
| run 失败率升高 | run status metrics | `FAILED / CREATED` 比值超阈值 | 当前无自动动作 |
| bridge 心跳缺失 | `heartbeat` 事件 | 运行中超时无心跳 | 当前无自动动作 |
| 文件读取异常升高 | error logs | `FILE_NOT_FOUND / FILE_PATH_INVALID` 异常激增 | 当前无自动动作 |
| 容器启动超时 | worker/bridge startup log | 健康检查超时比率升高 | 当前无自动动作 |

## 9. 前端埋点执行矩阵

| 事件 | Dashboard | Mobile H5 / 小程序 | 正式字段 |
|---|---|---|---|
| 页面访问 | 是 | 是 | `route,workspace_id,lang,theme` |
| 服务启动点击 | 是 | 是 | `service_id,workspace_id` |
| run 创建成功/失败 | 是 | 是 | `service_id,run_id,error_code?` |
| 实时连接成功/失败 | 是 | 是 | `run_id,transport` |
| 消息发送 | 是 | 是 | `run_id,message_length,attachment_count` |
| 文件预览 | 是 | 是 | `run_id,file_id,file_kind` |
| 文件下载 | 是 | 是 | `run_id,file_id,delivery_mode` |
| 工作区切换 | 是 | 是 | `from_workspace,to_workspace` |

## 10. 告警后的运行手册执行矩阵

| 告警类型 | 第一动作 | 第二动作 | 第三动作 |
|---|---|---|---|
| API 5xx | 看最近 error log | 对照 request_id/trace_id | 判断是否回滚 |
| run 失败率升高 | 看 run.failed reason 分布 | 抽样看 bridge stdout/stderr | 判定 runtime / MCP / secret 问题 |
| WS/SSE 异常 | 看 WS/SSE active 与 error log | 看前端连接埋点 | 判定网关或客户端问题 |
| bridge 启动超时 | 看 worker startup log | 看 bridge control log | 判定 CLI / runtime / port 问题 |
| 文件链异常 | 看 file read/download error | 看对象存储或本地路径 | 判定索引或权限问题 |

## 11. 保留与脱敏执行矩阵

| 载体 | 当前状态 | 正式要求 |
|---|---|---|
| run event jsonl | 本地保留 | 上传冷存储并按 retention 清理 |
| bridge stdout/stderr | 本地保留 | 脱敏后集中采集 |
| API 请求日志 | 当前缺失 | 结构化采集，避免记录敏感正文 |
| 前端埋点 | 当前缺失 | 禁止上传 secret、全文消息、原始附件内容 |
| 审计导出日志 | 仅设计态 | 与审计域统一 retention |

## 12. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| API 无结构化 logger | `logger: false` | 主链请求难检索 | P0 |
| 无 trace 传播 | 各层日志不能串起来 | 故障排查成本高 | P0 |
| 前端埋点缺失 | 体验侧数据不可见 | 无法衡量真实可用性 | P1 |
| 无自动告警 | 只能人肉发现 | 反应慢 | P1 |

## 13. 当前已验证采集起点表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| API 启动形态 | 当前有启动成功/失败 console 输出，但无结构化 logger | `app/api/src/index.ts`、`create-server.ts` |
| event jsonl | 当前是最接近事件级观测的持久化载体 | `app/api/src/modules/realtime/event-bus.ts` |
| bridge logs | 当前 stdout/stderr 会写入 `<runRoot>/logs/*.log` | `app/run-worker/src/services/bridge-runner.ts` |
| internal connector errors | `ApiConnector` 当前只抛文本错误 | `app/container-bridge/src/transports/api-connector.ts` |
| 前端运行状态 | 当前只有本地内存连接状态与 query 缓存 | `app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts` |

## 14. 当前不可宣称完成的采集/告警能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| 中央日志采集 | 未实现 | 当前日志仍分散在本地 stdout/stderr/file |
| metrics exporter | 未实现 | 当前没有 Prometheus/OTel 接入 |
| trace 传播 | 未实现 | 当前没有统一 trace header/payload 字段 |
| 自动告警链路 | 未实现 | 当前没有规则执行与通知出口 |
| 前端埋点上报 | 未实现 | 当前只有本地 UI 状态，没有埋点 SDK |

## 15. 采集/告警收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 接 logger 与 request/error 基础日志 | API/worker/bridge 主链可检索 |
| Phase 2 | 接 metrics exporter 与核心系统指标 | 运行健康可量化 |
| Phase 3 | 接 trace 传播与 internal request 关联 | 故障路径可串联 |
| Phase 4 | 接前端埋点与自动告警 | 体验与系统两侧都可预警 |
