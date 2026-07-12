# 灵办词元 仓库 Backlog 编号表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 仓库 Backlog 编号表 |
| 文档类型 | Repo Backlog Index |
| 适用范围 | `agent-workshop` 全工作区 |
| 基准日期 | 2026-07-08 |
| 关联文档 | `docs/开发任务拆解总表.md`、`docs/联调与验收清单.md`、`docs/仓库完成度与模块状态表.md` |
| 使用目的 | 统一 backlog 编号、仓库任务索引、任务粒度与执行状态 |

## 2. 编号规则表

| 维度 | 规则 |
|---|---|
| 仓库前缀 | `API` / `RWR` / `BRG` / `DSH` / `MOB` / `DB` / `SDK` / `CTR` / `DOM` / `UIT` / `CRT` / `MCP` / `SES` / `INF` |
| 编号格式 | `<前缀>-<三位模块号>-<三位任务号>` |
| 状态值 | `未开始` / `部分实现` / `半成品` / `进行中` / `已阻塞` / `已完成` |
| 优先级 | `P0` / `P1` / `P2` |
| 估算口径 | `S` / `M` / `L` / `XL` |

## 3. 状态含义表

| 状态 | 含义 |
|---|---|
| 未开始 | 还未进入开发 |
| 部分实现 | 已有相关代码落位，但目标能力未闭环 |
| 半成品 | 已有可运行或可构建的基础骨架，但距离正式目标仍缺关键段落 |
| 进行中 | 已开始实现，但未形成验收证据 |
| 已阻塞 | 存在强依赖阻塞，无法继续推进 |
| 已完成 | 已有代码、文档、联调或运行证据支撑 |

## 4. 优先级含义表

| 优先级 | 含义 |
|---|---|
| P0 | 阻断主链或阻断多仓联调 |
| P1 | 影响完整交付但不阻断核心开发 |
| P2 | 优化、补强、收尾型事项 |

## 5. `packages/db` Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `DB-001-001` | Bootstrap | 建立 `packages/db` 目录、构建脚本、连接入口 | 无 | P0 | M | 部分实现 |
| `DB-001-002` | Bootstrap | 建立 migration 管理机制 | `DB-001-001` | P0 | M | 未开始 |
| `DB-002-001` | Runs Schema | 建立 runs 主表 | `DB-001-002` | P0 | M | 未开始 |
| `DB-002-002` | Runs Schema | 建立 messages 表 | `DB-002-001` | P0 | M | 未开始 |
| `DB-002-003` | Runs Schema | 建立 approvals 表 | `DB-002-001` | P0 | S | 未开始 |
| `DB-002-004` | Runs Schema | 建立 artifacts 表 | `DB-002-001` | P0 | S | 未开始 |
| `DB-002-005` | Runs Schema | 建立 file_index 表 | `DB-002-001` | P0 | M | 未开始 |
| `DB-003-001` | Workspace/Auth Seed | 建立 workspace 表 | `DB-001-002` | P0 | S | 未开始 |
| `DB-003-002` | Workspace/Auth Seed | 建立 user/member/role 表 | `DB-003-001` | P0 | M | 未开始 |
| `DB-004-001` | Repository Contracts | 建立 repository interface | `DB-002-*` | P0 | M | 未开始 |
| `DB-005-001` | Dev Tooling | 建立 seed/reset/dev bootstrap 脚本 | `DB-001-*` | P1 | M | 未开始 |

## 6. `app/api` Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `API-001-001` | Repository Replace | 接入 DB repository | `DB-004-001` | P0 | L | 未开始 |
| `API-001-002` | Repository Replace | 移除 file-backed runs 权威源路径 | `API-001-001` | P0 | M | 未开始 |
| `API-002-001` | Runs Domain | run 快照读写改为 DB 驱动 | `API-001-*` | P0 | L | 部分实现 |
| `API-002-002` | Files Domain | file index 查询接口落地 | `DB-002-005` | P0 | M | 部分实现 |
| `API-002-003` | Artifact Domain | artifact 持久化与返回 | `DB-002-004` | P1 | M | 部分实现 |
| `API-003-001` | Auth | 接入鉴权中间件 | auth/org 域 | P0 | L | 未开始 |
| `API-003-002` | Workspace | 接入 workspace 权限检查 | auth/org 域 | P0 | L | 未开始 |
| `API-004-001` | Credentials | 凭证 CRUD + 脱敏读取 | `CRT-*` | P0 | L | 未开始 |
| `API-004-002` | MCP Registry | MCP binding / test / policy API | `MCP-*` | P0 | L | 未开始 |
| `API-005-001` | Session Pack | pack import/export/publish/rollback/unpublish API | `SES-*` | P1 | L | 部分实现 |
| `API-006-001` | Audit | run/credential/mcp/creator 审计接口 | auth/org 域 | P1 | L | 未开始 |

## 7. `app/run-worker` Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `RWR-001-001` | Worker Bootstrap | 建立常驻 worker 入口 | Redis 环境 | P0 | M | 未开始 |
| `RWR-001-002` | Queue Consume | 建立 BullMQ start-run consumer | `RWR-001-001` | P0 | M | 未开始 |
| `RWR-002-001` | Docker Launch | 执行 `docker run` | `INF-001-*` | P0 | L | 半成品 |
| `RWR-002-002` | Docker Stop | 执行 `docker stop` / `rm` | `RWR-002-001` | P0 | M | 未开始 |
| `RWR-002-003` | Runtime Writeback | 回写 containerId / exitCode / lifecycle | `API-001-*` | P1 | M | 部分实现 |
| `RWR-003-001` | Retry | 重试策略与 DLQ | `RWR-001-002` | P1 | M | 未开始 |
| `RWR-003-002` | Cleanup | 目录与容器回收策略 | `RWR-002-*` | P1 | M | 未开始 |
| `RWR-004-001` | Secret Materialization | 接 credential broker | `CRT-*` | P0 | M | 部分实现 |

## 8. `app/container-bridge` Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `BRG-001-001` | CLI Harden | 稳定 bridge CLI 启停 | `INF-001-*` | P0 | M | 部分实现 |
| `BRG-001-002` | Health/Control | 完善 health/control 通道 | `BRG-001-001` | P1 | S | 部分实现 |
| `BRG-002-001` | Artifact Upload | outputs 上传对象存储 | Files/Object Storage | P1 | L | 部分实现 |
| `BRG-002-002` | Log Sink | stdout/stderr 持久化与检索钩子 | Audit/observability | P1 | M | 部分实现 |
| `BRG-003-001` | MCP Runtime | first-party / workspace / third-party runtime 分流 | `MCP-*` | P0 | L | 部分实现 |
| `BRG-003-002` | Credential Injection | 接 credential broker | `CRT-*` | P0 | M | 部分实现 |
| `BRG-004-001` | Error Recovery | bridge 启动失败、退出失败、写回失败处理 | `BRG-001-*` | P1 | M | 部分实现 |

## 9. `app/dashboard` Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `DSH-001-001` | Workshops | 工坊列表真数据接线 | Workshops API | P1 | M | 部分实现 |
| `DSH-001-002` | Workshops | 工坊详情/服务详情真数据接线 | Workshops API | P1 | M | 部分实现 |
| `DSH-002-001` | Instances | 实例列表真数据接线 | Runs API | P1 | M | 部分实现 |
| `DSH-002-002` | Instances | 实例详情 snapshot/realtime 接线 | Runs API + WS | P1 | L | 部分实现 |
| `DSH-002-003` | Files | 实例文件页接线 | Files API | P1 | M | 部分实现 |
| `DSH-003-001` | Creator | 包/版本/调试页真数据接线 | Creator API | P1 | L | 未开始 |
| `DSH-003-002` | Governance | 凭证/成员/策略/审计/成本页接线 | auth/org + API | P1 | L | 未开始 |
| `DSH-004-001` | Auth/Workspace | 登录、空间切换、路由守卫 | auth/org API | P0 | L | 未开始 |
| `DSH-005-001` | UX States | 错误/空态/加载态补齐 | 真实接线基础 | P1 | M | 部分实现 |

## 10. `app/mobile` Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `MOB-001-001` | Workshops | 工坊页真数据接线 | Workshops API | P1 | M | 部分实现 |
| `MOB-001-002` | Services | 服务详情真数据接线 | Workshops API | P1 | M | 部分实现 |
| `MOB-002-001` | Tasks | 任务列表真数据接线 | Runs API | P1 | M | 部分实现 |
| `MOB-002-002` | Task Detail | snapshot/realtime/messages 接线 | Runs API + WS/SSE | P1 | L | 部分实现 |
| `MOB-002-003` | Task Files | 路径切换、文件读取、下载接线 | Files API | P1 | M | 部分实现 |
| `MOB-002-004` | Task Approval | 审批 UI 与动作接线 | Runs API | P1 | M | 未开始 |
| `MOB-003-001` | Auth/Workspace | 登录、个人/企业空间切换 | auth/org API | P0 | L | 未开始 |
| `MOB-004-001` | Miniapp Prep | 为 wechat/alipay 保留适配层 | H5 真接线完成 | P1 | M | 部分实现 |

## 11. `packages/api-sdk` / `packages/contracts` / `packages/domain-models` Backlog 表

| 编号 | 仓库 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|---|
| `SDK-001-001` | `packages/api-sdk` | Files | 增加 download helper | Files API | P1 | S | 未开始 |
| `SDK-001-002` | `packages/api-sdk` | Realtime | 增加 SSE helper | 当前 stream API | P1 | S | 未开始 |
| `SDK-001-003` | `packages/api-sdk` | Auth | 增加 auth/workspace client | auth/org API | P0 | M | 未开始 |
| `SDK-001-004` | `packages/api-sdk` | Creator | 增加 workshop/creator SDK | 新后端域 | P1 | M | 未开始 |
| `CTR-001-001` | `packages/contracts` | DB DTO | 补齐正式 DB 相关 schema | DB 设计 | P0 | M | 未开始 |
| `CTR-001-002` | `packages/contracts` | Credential/MCP DTO | 补齐治理域 schema | `CRT-*`、`MCP-*` | P0 | M | 未开始 |
| `CTR-001-003` | `packages/contracts` | Session Pack DTO | 定义 pack manifest DTO | `SES-*` | P1 | M | 未开始 |
| `DOM-001-001` | `packages/domain-models` | Run Projection | 重构 run 投影模型 | DB + events | P0 | M | 部分实现 |
| `DOM-001-002` | `packages/domain-models` | Workshop/Session | 建立资产化领域模型 | `SES-*` | P1 | M | 未开始 |
| `DOM-001-003` | `packages/domain-models` | Search | 扩展搜索模型到多域 | 新后端域 | P1 | S | 部分实现 |

## 12. 新增缺失包 Backlog 表

| 编号 | 仓库/包 | 模块 | 任务 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `CRT-001-001` | `packages/credential` | Bootstrap | 建立包结构与接口边界 | P0 | M | 未开始 |
| `CRT-001-002` | `packages/credential` | Broker | secret 解密/短时注入 | P0 | L | 未开始 |
| `CRT-001-003` | `packages/credential` | Audit Hooks | 凭证操作审计 | P1 | M | 未开始 |
| `MCP-001-001` | `packages/mcp` | Bootstrap | 建立包结构与接口边界 | P0 | M | 未开始 |
| `MCP-001-002` | `packages/mcp` | Registry | MCP registry/binding/model | P0 | L | 未开始 |
| `MCP-001-003` | `packages/mcp` | Policy | 风险分级/审批/网络策略 | P0 | L | 未开始 |
| `SES-001-001` | `packages/session-pack` | Bootstrap | 建立包结构与 manifest 规范 | P1 | M | 部分实现 |
| `SES-001-002` | `packages/session-pack` | Import/Export | pack 导入导出 | P1 | L | 部分实现 |
| `SES-001-003` | `packages/session-pack` | Publish/Inheritance | 继承、发布、回滚、下线、版本化 | P1 | L | 部分实现 |

## 13. `infra/docker` / CI / 发布 Backlog 表

| 编号 | 模块 | 任务 | 依赖 | 优先级 | 估算 | 状态 |
|---|---|---|---|---|---|---|
| `INF-001-001` | Runner Image | 固化 Codex/Playwright/bridge 运行镜像 | 无 | P0 | M | 半成品 |
| `INF-001-002` | Compose | 本地 API/DB/Redis/Object Storage 联调环境 | `INF-001-001` | P0 | M | 未开始 |
| `INF-002-001` | CI | build/typecheck/test 流水线 | 无 | P1 | M | 未开始 |
| `INF-002-002` | Image Publish | API/worker/runner 镜像发布 | `INF-002-001` | P1 | M | 未开始 |
| `INF-002-003` | Deploy | staging/prod 部署脚本 | `INF-002-002` | P1 | L | 未开始 |
| `INF-002-004` | Rollback | 前后端与 DB 回滚方案 | `INF-002-003` | P1 | M | 未开始 |

## 14. 任务分发建议表

| 类别 | 建议归属 |
|---|---|
| DB / Repository / Auth / Audit | Backend |
| Worker / Docker / Bridge / Runtime | Runtime / Platform |
| Dashboard / Mobile / SDK | Frontend |
| Credential / MCP / Policy | Backend + Security/Platform |
| CI/CD / Deploy / Rollback | Platform |

## 15. Backlog 精排优先顺序表

| 顺位 | 编号 | 原因 |
|---|---|---|
| 1 | `DB-001-*`、`DB-002-*` | 正式权威源的起点 |
| 2 | `API-001-*`、`API-002-*` | API 主链必须先摆脱 JSON 仓储 |
| 3 | `INF-001-*`、`RWR-001-*`、`RWR-002-*` | 真运行闭环必须尽快建立 |
| 4 | `CRT-*`、`MCP-*`、`BRG-003-*` | 安全治理和第三方能力治理 |
| 5 | `SDK-*`、`DSH-*`、`MOB-*` | 前端真实联调 |
| 6 | `SES-*`、`API-005-*`、`DSH-003-*` | 资产化与 Creator 发布 |
| 7 | `INF-002-*`、`API-006-*`、auth/org 域 | 企业化上线阶段 |

## 16. Backlog 完成证据表

| 编号类型 | 最低需要证据 |
|---|---|
| `DB-*` | schema + migration + 查询结果 |
| `API-*` | route/service/repository 代码 + 请求响应 |
| `RWR-*` | worker 日志 + Docker 执行结果 |
| `BRG-*` | runtime 启动日志 + event 回传结果 |
| `DSH-*` | 页面截图 + 真接口联调结果 |
| `MOB-*` | H5 截图/录屏 + 真接口联调结果 |
| `SDK-*` | 类型通过 + 前端接线使用点 |
| `CRT-*` / `MCP-*` | 配置、策略、脱敏/审计证据 |
| `SES-*` | pack 文件、manifest、导入导出结果 |
| `INF-*` | pipeline 日志、镜像 tag、部署结果 |

## 17. 当前真实基线校准表

| 范围 | 当前已具备基线 | 对应 backlog 含义 |
|---|---|---|
| `app/api` | 已有 `runs / realtime / files / internal bridge` 主链 | 后续 API backlog 多数属于“替换权威源、补齐正式域”，不是从零起步 |
| `app/run-worker` | 已能生成 `runtime-config.json`、`bridge-context.*.json`、`mcp-config.json`、`secret-manifest.json`、`container-launch-plan.json` | runtime 物料链已存在，Docker 真执行与常驻消费仍缺 |
| `app/container-bridge` | 已有 CLI、PTY、health/control、artifact 事件、MCP/secret 物化基础 | bridge backlog 多数属于强化与正式治理 |
| `app/dashboard` | 已接入 `listRuns/getRun/readRunFile/listRunFileTree/sendRunMessage` 与 realtime | Dashboard backlog 重点在脱离静态目录、补 auth、补 Creator 正式域 |
| `app/mobile` | 已接入 run 列表、详情、消息、文件读取、下载 URL 与 realtime | Mobile backlog 重点在脱离静态目录、补 auth、补审批与小程序专项 |
| `packages/api-sdk` | 已有 runs HTTP client 与 websocket realtime client | SDK backlog 重点在下载、SSE、auth/workshop/creator 扩域 |
| `packages/domain-models` | 已有 run 状态机、event 投影、首轮追问 prompt | domain backlog 重点在正式 DB 投影与多域扩展 |
| `infra/docker` | 已有 runner image Dockerfile 与 entrypoint | infra backlog 重点在镜像固化、联调环境、CI/CD |

## 18. 当前已具备半成品的 Backlog 表

| 编号 | 当前状态 | 已具备内容 | 下一步收口点 |
|---|---|---|---|
| `INF-001-001` | 半成品 | runner Dockerfile、entrypoint、Playwright Chromium、bridge build 已存在 | 固化镜像构建脚本、版本策略、联调验证 |
| `RWR-002-001` | 半成品 | 已输出 container launch plan、docker 命令参数、资源限制与网络配置 | 真正执行 `docker run` 并返回 containerId |
| `BRG-001-001` | 部分实现 | bridge CLI、上下文加载、PTY 会话、退出处理已存在 | 补齐异常路径、自愈与正式生命周期日志 |
| `BRG-001-002` | 部分实现 | `/health` 与 `/control` 已存在 | 加入鉴权、回压、控制超时与错误语义 |
| `BRG-003-001` | 部分实现 | `mcp-config.json`、`mcp-bindings.json` 物化已存在 | 补 third-party runtime policy、白名单、出网限制 |
| `BRG-003-002` | 部分实现 | env/file 注入已存在 | 接正式 credential broker、轮换与吊销回流 |
| `DSH-002-002` | 部分实现 | 实例详情已接 snapshot/realtime/messages/files 主链 | 清退静态补充信息，接 Creator/governance 正式域 |
| `MOB-002-002` | 部分实现 | 任务对话页已接 snapshot/realtime/messages | 补审批、附件、认证与更稳的断连恢复 |
| `DOM-001-001` | 部分实现 | run 投影与状态机已存在 | 重构为正式事件与 DB 驱动的聚合投影 |

## 19. 当前可直接开工 Backlog 表

| 编号 | 原因 | 当前前置是否满足 |
|---|---|---|
| `INF-001-001` | 本地 Dockerfile 已存在，可直接固化 runner image | 是 |
| `BRG-001-001` | CLI 和 runtime 主链已存在，可直接加固 | 是 |
| `BRG-001-002` | health/control 已存在，可直接补协议与鉴权 | 是 |
| `SDK-001-001` | 前端仍手拼下载 URL，缺口清晰 | 是 |
| `SDK-001-002` | 双端已各自实现 SSE fallback，可直接抽回 SDK | 是 |
| `DSH-002-001` | 实例页已调用 `listRuns()`，可直接推进静态数据退场 | 是 |
| `DSH-002-002` | 实例详情已接 realtime，可继续收口 | 是 |
| `MOB-002-001` | 任务列表已调用 `listRuns()`，可继续清退静态层 | 是 |
| `MOB-002-002` | 任务详情已接 realtime，可继续补审批与空态 | 是 |
| `MOB-002-003` | 文件页已接 `listRunFileTree/readRunFile/download`，可继续收口 | 是 |

## 20. 当前需等待强前置依赖的 Backlog 表

| 编号 | 强前置依赖 | 当前原因 |
|---|---|---|
| `DB-001-*` / `DB-002-*` | 完善 `packages/db` | 当前已存在最小包骨架与迁移执行框架，主链仍待继续扩展 |
| `API-001-*` | `DB-004-001` | API 仍无正式 repository 替换入口 |
| `API-003-*` | auth/org 域 | 已有基础 auth/workspace 正式域，后续项聚焦前端接入、强化鉴权、组织治理与生产化 |
| `API-004-*` | `CRT-*` / `MCP-*` | credential 与 MCP 基础正式域已落地，后续项聚焦 broker、审计、策略、第三方联调与生产化 |
| `RWR-001-*` | Redis / BullMQ 环境 | 当前仅依赖 BullMQ，未形成常驻消费者 |
| `RWR-004-001` | `CRT-*` | 正式 secret broker 不存在 |
| `DSH-003-*` | Creator API | Creator 仍停留在前端骨架 |
| `MOB-003-001` | auth/workspace API | H5 无真实用户态接口 |
| `SES-*` | session-pack 包与 Creator 发布域 | 资产化基础对象已落地主链，剩余缺口转向策略自动执行治理、签名与远端隔离运行时消费证据 |
