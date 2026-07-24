# 灵办词元后端 API / Lingban Backend API

灵办词元后端 API 提供平台接入层、业务控制面、运行编排入口和内部 Runtime 回调接口。服务使用 Fastify 5 与 TypeScript 实现。

The Lingban Backend API provides the public application API, platform control plane, runtime orchestration entry point, and internal runtime callbacks. It is implemented with Fastify 5 and TypeScript.

## 仓库信息 / Repository

| 项目 | 内容 |
| --- | --- |
| GitHub | `git@github.com:copypasteltd/agent-workshop-backend.git` |
| Monorepo 路径 | `app/api` |
| 主分支 | `main` |
| Runtime | Node.js 22、Fastify 5、TypeScript |
| 数据访问 | PostgreSQL 或文件存储适配器 |
| 对象存储 | 文件系统或 S3 兼容服务 |
| 实时通道 | WebSocket + SSE fallback |

This component depends on internal `workspace:*` packages. The standalone backend export includes the API and its complete internal dependency closure.

## 系统职责 / Responsibilities

- 邮箱认证、微信小程序认证、刷新会话、工作区、成员、邀请与角色权限。
- 工坊、服务、Creator Package、Session Pack、Release 与 Replay。
- Session Project、Blank Source Run、Capture 状态推进与 Creator 封装闭环。
- Draft Workshop/Service 写入、不可变 Task Version 和发布激活。
- Run 创建、消息、附件、审批、状态机、实时事件与恢复。
- target path 文件树、预览、下载票据、归档和生命周期管理。
- Provider、Credential、MCP、Quota、Billing 与审计治理。
- Bridge 注册、命令派发、幂等回调、诊断、指标与产物回流。
- Batch Run 导入、映射、校验、估算、启动、重试和取消。
- 独立 Admin 控制面、平台级查询、Provider/MCP/Credential/Quota 治理、影响预检和不可变管理审计。

## API 域 / API Domains

| Prefix | 主要能力 |
| --- | --- |
| `/health`, `/readyz` | 存活检查与依赖就绪报告 |
| `/v1/auth` | 注册、邮箱登录、微信小程序登录、刷新、退出与会话读取 |
| `/v1/workspaces` | 工作区切换、成员与邀请治理 |
| `/v1/me` | 用户摘要、资产、授权、最近使用、收藏与通知摘要 |
| `/v1/workshops`, `/v1/services` | 工坊目录、服务详情与启动模板 |
| `/v1/creator/session-projects`, `/v1/creator/source-runs` | Session Project 与空白 Source Run |
| `/v1/runs` | Run、对话、审批、文件、上传与下载票据 |
| `/v1/conversation-shares` | 活跃会话与固化边界的只读分享、访问范围和撤销 |
| `/v1/session-captures`, `/v1/session-drafts` | 检查点/终结固化、不可变对象、Draft Revision 与脱敏审查 |
| `/ws/runs` | Run WebSocket 订阅与控制消息 |
| `/v1/sessions` | Session 版本、继承、发布、回滚、脱敏与归档 |
| `/v1/packages`, `/v1/releases` | Creator Package、Release、Gate、Activation 与 Replay |
| `/v1/providers`, `/v1/provider-bindings` | 多 Provider 配置、API Key 加密创建、Credential Binding、运行时模型白名单与工作区路由 |
| `/v1/credentials` | 凭证元数据、Broker、生命周期和审计 |
| `/v1/mcps`, `/v1/mcp-*` | MCP 注册、绑定、探测、网络策略与调用审计 |
| `/v1/quotas`, `/v1/billing` | 配额策略、计数、超额审批、用量与成本账本 |
| `/v1/batch-runs` | 批量导入、估算、执行与重试 |
| `/admin/v1` | 独立 Admin 登录、平台总览、资源治理、Provider 真实模型测试、模型差异拉取与确认写入、MCP 工具同步、Credential 生命周期、配额、账本、审计和系统设置 |
| `/internal` | Bridge 注册、事件/状态/产物回调、Runtime 诊断与运维动作 |

## 模块结构 / Module Map

| 路径 | 职责 |
| --- | --- |
| `src/app/create-server.ts` | Fastify 装配、路由注册、CORS、错误处理与关闭钩子 |
| `src/app/database.ts` | 数据库连接、迁移与 repository 装配 |
| `src/app/runtime.ts` | Embedded/BullMQ 运行调度选择与生命周期 |
| `src/modules/auth/` | 邮箱与微信小程序身份认证、外部身份映射、工作区上下文、成员与邀请 |
| `src/modules/runs/` | Run 聚合、消息、审批、文件、状态与编排 |
| `src/modules/conversation-shares/` | 会话快照、访问策略、公开读取和撤销 |
| `src/modules/session-captures/` | Capture Job、租约、边界、水位、对象校验与重试 |
| `src/modules/session-drafts/` | Draft Revision、脱敏、Replay、密封与版本绑定 |
| `src/modules/uploads/` | 上传、对象存储、文件安全、保留与下载票据 |
| `src/modules/bridge/` | Runtime 注册、命令队列、回调账本和诊断 |
| `src/modules/providers/` | Provider 配置、密钥引用、真实模型测试、只读模型拉取、确认写入和默认路由 |
| `src/modules/credentials/` | 凭证 Broker、回调、轮换、吊销和审计 |
| `src/modules/mcp/` | MCP 注册、绑定、探测、网络策略和调用审计 |
| `src/modules/sessions/` | Session 版本线、脱敏审查、继承、发布与归档 |
| `src/modules/creator/` | Package、Release、Gate、Activation、Replay 与治理摘要 |
| `src/modules/session-projects/` | Source Run 聚合、Capture/Draft/Version/Package/Catalog 状态关联 |
| `src/modules/idempotency/` | 关键创建操作的标准幂等键、请求哈希与响应回放 |
| `src/modules/workshops/task-versions-repository.ts` | 正式不可变 Task Version 存储 |
| `src/modules/quotas/` | 配额策略、计数、事件与超额审批 |
| `src/modules/billing/` | 用量事件、账本、聚合与成本读取 |
| `src/modules/batch-runs/` | 批量文件解析、字段映射与执行控制 |
| `src/modules/realtime/` | WebSocket/SSE 事件分发 |
| `src/modules/admin/` | 独立 Admin 会话、平台读模型、治理状态、影响预检、操作执行、审计与系统设置 |
| `migrations/0031_creator_source_runs.sql` | Session Project、Task Version、幂等记录与 Run 身份字段 |
| `migrations/0033_wechat_mini_program_identities.sql` | 微信小程序外部身份与内部用户映射 |

## 数据与运行模式 / Data and Runtime Modes

| 维度 | 可选值 | 说明 |
| --- | --- | --- |
| 业务存储 | `file`, `postgres` | 各领域可通过环境变量切换 repository |
| 对象存储 | `filesystem`, S3 compatible | 上传内容、归档和下载对象 |
| Runtime dispatch | `embedded`, `bullmq` | API 内嵌调度或外部 Run Worker 队列 |
| Authentication | `required`, `disabled` | 生产环境使用 `required` |
| Provider | OpenAI-compatible profiles | 支持多 Provider、模型、凭证引用与工作区绑定 |

## 核心运行链 / Runtime Flow

1. 前端创建 Run，API 校验工作区、配额、Provider、MCP 与凭证绑定。
2. API 写入 Run 快照和初始事件，并通过 Embedded 调度器或 BullMQ 派发。
3. Run Worker 准备 target path 和 Runtime 物料，随后启动 Bridge。
4. Bridge 托管 Codex CLI 并通过 `/internal` 回传消息、状态、文件和诊断。
5. API 持久化事件并通过 WebSocket/SSE 推送给当前会话。

## Run 生命周期 / Run Lifecycle

| 接口 | 作用 |
| --- | --- |
| `GET /v1/runs/:runId/lifecycle` | 读取 Runtime 与记录生命周期状态 |
| `POST /v1/runs/:runId/stop` | 用户优雅停止并释放 Runtime |
| `POST /v1/runs/:runId/archive` | 归档已结束且已释放的实例 |
| `POST /v1/runs/:runId/restore` | 恢复归档记录 |
| `DELETE /v1/runs/:runId` | 永久销毁实例数据，要求 Owner/Admin 和 Run ID 确认词 |

Runtime 状态包括 `NOT_STARTED / ACTIVE / STOP_REQUESTED / STOPPING / RELEASED / RELEASE_FAILED / ORPHANED`；记录状态包括 `ACTIVE / ARCHIVED / DELETION_PENDING / DELETED`。同一 Run 的并发停止请求共享单次释放操作。API 启动时会重新协调处于终态且尚未确认释放的 Runtime。

永久销毁会清理工作目录、Run File 托管对象、Upload、Download Ticket、Agent Runtime 事件和 Realtime 事件，并将聚合压缩为最小脱敏墓碑。未完成的 Session Capture 返回 `RUN_DELETE_CAPTURE_PENDING`。Capture、Session Version、Billing、MCP Audit 和 Admin Audit 继续按资产与审计策略保留。

Run lifecycle operations are idempotent where applicable. Cleanup failures restore list visibility, persist `deletionFailure`, and allow a later retry.

Creator Source Run 使用 `runPurpose=creator_source`、`sessionBootstrapMode=blank` 和空 `sessionVersionId`。首个 Codex Turn 等待 Creator 第一条消息；Capture 完成后进入 Draft、Replay、Seal、Package、Catalog 和 Release 链。

Creator Source Runs use `runPurpose=creator_source`, `sessionBootstrapMode=blank`, and no inherited Session Version. The first Codex Turn waits for the Creator's first message, then the captured session proceeds through Draft, Replay, Seal, Package, Catalog, and Release.

## 配置 / Configuration

`.env.example` 列出完整开发配置。生产环境至少需要显式配置：

```env
API_HOST=0.0.0.0
API_PORT=3100
LINGBAN_AUTH_MODE=required
LINGBAN_INTERNAL_AUTH_TOKEN=<long-random-secret>
DATABASE_URL=postgres://...
LINGBAN_OBJECT_STORAGE_DRIVER=filesystem
LINGBAN_RUNTIME_DISPATCH_MODE=embedded
LINGBAN_REDIS_URL=redis://127.0.0.1:6379/0
LINGBAN_ADMIN_CSRF_SECRET=<long-random-secret>
LINGBAN_ADMIN_COOKIE_SECURE=true
LINGBAN_RELEASE=<immutable-release-id>
LINGBAN_WECHAT_MINI_PROGRAM_APP_ID=<wechat-app-id>
LINGBAN_WECHAT_MINI_PROGRAM_APP_SECRET=<wechat-app-secret>
LINGBAN_ENABLE_DEMO_DATA=0
```

`LINGBAN_ENABLE_DEMO_DATA` 默认关闭。仅在隔离的演示环境显式设置为 `1` 时，空目录库才会写入示例工坊、服务、Package、Release 和 Replay；生产环境必须保持 `0` 或不配置。

`LINGBAN_ENABLE_DEMO_DATA` is disabled by default. Set it to `1` only in an isolated demonstration environment to populate an empty catalog with sample workshops, services, packages, releases, and replays. Production must keep it unset or set to `0`.

Admin 账号使用统一认证存储；账户需要具备 `platform_admin` 标记。账号与密码不通过进程环境变量旁路配置。

Provider API Key、内部 Token 和对象存储密钥仅通过 Secret Manager、受控环境变量或凭证 Broker 注入，禁止写入仓库。

Provider API keys, internal tokens, and storage credentials must be injected through a secret manager, controlled environment variables, or the credential broker.

## 开发与验证 / Development

在 monorepo 根目录执行：

```bash
pnpm install
pnpm -C app/api typecheck
pnpm -C app/api build
pnpm -C app/api test:admin
pnpm -C app/api test:creator-source
pnpm -C app/api test:catalog-write
pnpm -C app/api test:wechat-auth
pnpm -C app/api test:run-lifecycle
pnpm -C app/api test:smoke:compiled
pnpm -C app/api migrate
pnpm -C app/api start
```

本地验证使用原生 Node.js 与 pnpm。需要 Runtime 隔离执行的集成验收在指定服务器环境完成。

Local verification uses native Node.js and pnpm. Runtime-isolation integration tests run on the designated server environment.

## 可观测性与安全 / Observability and Security

- `/readyz` 聚合数据库、对象存储、Worker 与 Bridge 就绪状态。
- `/internal/metrics` 输出运行链指标；内部接口使用共享 Token 守卫。
- Bridge 回调支持幂等键、重放防护和工作区边界校验。
- Project、Source Run 与 Catalog Bundle 创建要求 `Idempotency-Key`，相同键和请求体返回原响应。
- 文件链执行路径归一化、target path 边界、下载票据和安全扫描。
- Provider 管理接口要求平台管理员角色，工作区仅访问自身绑定。
- Credential 返回值仅包含元数据、引用和脱敏摘要。
- 微信 AppSecret 仅由后端读取；`jscode2session` 返回的 `session_key` 不持久化、不进入客户端响应。
- Admin Access 与 Refresh Token 仅存于 `HttpOnly`、`SameSite=Strict` Cookie，写请求执行签名双提交 CSRF 校验。
- 高影响治理操作执行影响预检、确认词、原因、资源版本和审计校验；Credential 明文只写入 Broker，不进入读模型。

## Session Control / Session Control

- `src/modules/agent-runtime` stores canonical Codex App Server thread and raw-event evidence.
- `src/modules/session-captures` owns Capture jobs, leases, barriers, retries, immutable objects, cleanup gates, and audited raw-object access.
- `src/modules/session-drafts` owns Draft revisions, redaction, review, Replay Gate, sealing, and explicit Package/Service bindings.
- `src/modules/session-migrations` imports signed v2 packs and migrates v1 archives with dry-run reports.
- Migration `0030_session_control.sql` creates the complete Session Control persistence model and immutability triggers.

Key rollout settings:

```text
SESSION_CAPTURE_V2_ENABLED=true
SESSION_PACK_V2_WRITE_ENABLED=true
SESSION_VERSION_IMMUTABILITY_ENFORCED=true
CREATOR_EXPLICIT_SESSION_BINDING_ENABLED=true
LINGBAN_SESSION_PACK_SIGNATURE_ENABLED=true
```

Legacy migration:

```bash
pnpm migrate:legacy-sessions -- --api http://127.0.0.1:38100 --token "$LINGBAN_ACCESS_TOKEN"
pnpm migrate:legacy-sessions -- --apply --ids sev_a,sev_b --api http://127.0.0.1:38100 --token "$LINGBAN_ACCESS_TOKEN"
```

Session Control verification: Session Pack `24/24`, DB `27/27`, Session Control E2E `2/2`, complete API smoke `62/62`.

## 当前状态 / Current Status

截至 2026-07-21，核心控制面、独立 Admin API、Provider 多路由、API Key 加密绑定、模型测试、邮箱与微信小程序认证、文件链、结构化 Agent 事件、Capture、Draft、Replay、签名密封、显式绑定、Run 生命周期、Realtime 与 Runtime 回调均已实现。当前 Admin 同源入口为 `http://192.168.31.20:38140/admin/v1`，线上版本由 `/admin/v1/system` 返回。

As of 2026-07-19, the API also includes WeChat Mini Program code exchange, external identity persistence, personal workspace provisioning, and reusable platform sessions.

生产扩展仍需要外部 PostgreSQL、Redis、对象存储、集中 Secret Manager、备份策略、告警通道和多节点容量验证。

Production scale-out requires external PostgreSQL, Redis, object storage, centralized secret management, backup policies, alert delivery, and multi-node capacity validation.

## 2026-07-20 Verification / 2026-07-20 验收

API Release Gates 已完成 `65/65`。真实 HZ01 链路已经覆盖第三方 OpenAI-compatible Provider、Codex App Server、Playwright MCP、文件写入、Source Capture、Replay、Seal、Package、Release、Activation、Consumer Run 与 Consumer Capture。Creator 和 Workshop Catalog 的 PostgreSQL 写入采用实体级 UPSERT 与事务边界，普通更新不会删除其他实体。

API Release Gates pass `65/65`. The HZ01 system test covers a real provider, Codex App Server, Playwright MCP, target files, source capture, sealing, publication, activation, consumer execution, and consumer capture.

## 2026-07-22 图片预览票据 / Inline Image Preview Tickets

Run 文件预览接口为图片和 PDF 签发短期下载票据，并在预览 URL 中声明 `disposition=inline`。下载票据路由按请求模式设置 `Content-Disposition`，文件下载继续使用 `attachment`，会话内图片使用 `inline`。本地对象流与 S3 签名 URL 使用相同语义。

预览响应附带 `Cache-Control: private, no-store` 与 `X-Content-Type-Options: nosniff`。票据有效期、Run 工作区权限、target path 校验和对象存储边界继续由既有文件链负责。

Run file previews now issue short-lived inline tickets for images and PDFs. Direct downloads retain attachment semantics, while local streams and S3 signed URLs preserve the same disposition and security headers.

## 2026-07-25 Capture Recovery Hardening / 2026-07-25 固化恢复加固

- API 启动恢复以 `runtime.finishedAt` 和 Bridge 心跳时间共同判定 Runtime 是否仍然有效，避免过期注册阻止恢复。
- Capture 调度失败会进入持久化 `RETRY_WAIT` 或 `FAILED`，调度与处理均设置 12 次尝试上限；人工重试会重置尝试次数。
- 固化边界校验同时读取 Thread 摘要水位和原始事件最大水位，防止摘要投影延迟造成永久 Barrier 失败。
- Runtime 恢复载荷包含 `resumeThreadId`、`resumeThroughTurnId` 和 Turn 状态，供 Worker 与 Bridge 精确恢复。
- 内部 Capture 对象上传路由使用 `LINGBAN_UPLOAD_MAX_BYTES` 独立限制，支持大型工作区归档上传。
- `packages/session-pack` 优先调用原生 `zstd` 完成压缩和解压，并对解压输出设置上限。
- Capture 完成后生成的 Draft Revision 已通过候选包尺寸、SHA-256 与 `zstd -t` 完整性验证。

The recovery path now distinguishes finished runtimes from active bridge registrations, resumes the original Codex thread and completed turn boundary, persists bounded capture retries, validates both projected and raw event watermarks, and accepts capture objects through a dedicated internal body limit. Large Session Pack archives use native zstd with bounded decompression output.

Focused verification:

```bash
node --experimental-test-isolation=process --test --test-concurrency=1 \
  tests/runtime-recovery-internal.smoke.test.mjs \
  tests/session-capture-upload-limit.smoke.test.mjs \
  tests/session-control.smoke.test.mjs
```

The four focused API scenarios and all 24 Session Pack tests pass. HZ01 release `20260724T114552Z` completed the online capture and Draft Revision recovery flow.

## 2026-07-23 视频预览票据 / Inline Video Preview Tickets

Run 文件索引新增 `video` 预览模式，支持 `video/mp4`、`video/webm`、`video/quicktime` 和 `video/ogg`。预览接口为视频签发短期 `inline` 下载票据，响应保留工作区鉴权、Run 文件边界、对象存储和计费审计链。

文件索引将视频标记为 `previewable=true`。下载票据返回准确 `Content-Type`、`Content-Disposition: inline`、`Cache-Control: private, no-store` 与 `X-Content-Type-Options: nosniff`。直接下载接口继续使用附件语义。

票据下载接口支持单区间 HTTP Range：标准区间、开放尾区间和后缀区间返回 `206`、`Content-Range`、`Content-Length` 与 `Accept-Ranges: bytes`；非法或越界区间返回 `416`。该能力用于大视频渐进播放和进度拖动。

Run video previews use the shared `video` mode and accurate media MIME types. Inline delivery retains the existing authorization, path confinement, object-storage, quota, and billing controls.

## 2026-07-24 会话只读分享 / Read-only Conversation Sharing

- `POST /v1/runs/:runId/conversation-shares` 将当前会话或指定 Capture 边界冻结为独立只读快照。
- 分享快照保存消息正文、消息顺序、角色、时间、边界标识和附件元数据；本地图片、视频及附件复制到对象存储，源实例释放后仍可访问。
- `public_link`、`workspace`、`invited_users` 三种范围分别覆盖公开链接、当前工作区和指定用户。
- `GET /v1/conversation-shares/public/:shareId` 提供只读展示数据；非公开范围继续执行登录和成员权限校验。
- `POST /v1/conversation-shares/:shareId/revoke` 立即撤销分享；过期时间由创建请求指定，最长 366 天。
- 文件访问使用短期 HMAC Grant，图片和视频支持内联展示及 HTTP Range；查看和文件访问写入审计记录。
- 分享表只记录源 `run_id` 和 `capture_id`，不建立删除外键。分享内容已经独立固化，源 Run 删除不会破坏已发布分享。

生产环境必须为所有 API 节点配置一致的 `LINGBAN_CONVERSATION_SHARE_GRANT_SECRET`。密钥轮换后，已经签发的短期文件地址会失效，刷新只读页即可获得新地址。

Verification:

```bash
pnpm -C app/api typecheck
pnpm -C app/api build:local
pnpm -C app/api test:conversation-shares
```

HZ01 已部署 Release `20260724T052050Z`，migration `0034_conversation_shares` 已应用，公网分享路由通过业务级 404 探测，API 与 Worker readiness 均通过。
