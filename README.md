# 灵办词元 / Lingban Workshop

灵办词元是一套面向企业与个人的云端 Agent 工坊系统。平台将经过验证的 Codex CLI 会话与目标工作目录作为可继承资产交付，用户实例化后通过完整对话提供本次执行所需信息。

Lingban Workshop is a cloud agent-workshop platform for organizations and individuals. It delivers validated Codex CLI sessions and target workspaces as inheritable assets, then collects run-specific inputs through a full conversational workflow.

## 当前交付状态 / Current Delivery Status

| 项目 | 状态 |
| --- | --- |
| Mobile H5 | 已部署，`http://192.168.31.20:38120/` |
| Workspace Dashboard | 已部署，`http://192.168.31.20:38110/workspace/workshops` |
| Platform Admin | 已独立部署，`http://192.168.31.20:38140/` |
| Backend API | 已部署，`http://192.168.31.20:38130` |
| Session Control v2 | 已部署，Migration `0030_session_control` 已应用 |
| Frontend E2E | 32/32 通过 |
| Backend smoke | 62/62 通过 |
| Run Worker tests | 28/28 通过 |
| Runtime Bridge tests | 25/25 通过 |
| Session Pack tests | 24/24 通过 |
| Dashboard 视觉状态 | 1440×1000、1024×768、390×844 通过 |
| 最近验证日期 | 2026-07-17 |

当前地址属于 HZ01 验收环境。生产扩容仍需完成外部 PostgreSQL、Redis、对象存储、集中密钥管理、告警、备份和多节点容量验证。

These URLs point to the HZ01 acceptance environment. Production scale-out still requires external PostgreSQL, Redis, object storage, centralized secret management, alerting, backups, and multi-node capacity validation.

## 五个主仓库 / Primary Repositories

| 仓库 | 本地路径 | 远端 | 职责 |
| --- | --- | --- | --- |
| `agent-workshop-app` | `app/mobile` | `git@github.com:copypasteltd/agent-workshop-app.git` | Taro Mobile H5 与后续小程序 |
| `agent-workshop-dashboard` | `app/dashboard` | `git@github.com:copypasteltd/agent-workshop-dashboard.git` | Workspace 与 Creator 控制台 |
| `agent-workshop-backend` | `app/api` | `git@github.com:copypasteltd/agent-workshop-backend.git` | Fastify API、控制面与 Runtime 回调 |
| `agent-workshop-run-worker` | `app/run-worker` | `git@github.com:copypasteltd/agent-workshop-run-worker.git` | 队列消费、工作区物化与运行调度 |
| `agent-workshop-sdk` | `app/container-bridge` | `git@github.com:copypasteltd/agent-workshop-sdk.git` | Codex CLI Bridge、MCP、文件与控制面 |

## Monorepo 结构 / Workspace Layout

| 目录 | 内容 |
| --- | --- |
| `app/` | API、Run Worker、Runtime Bridge、Dashboard、Mobile、独立 Admin |
| `packages/` | contracts、db、session-pack、api-sdk、realtime、ui-tokens 等共享包 |
| `docs/` | 产品、前端、后端、治理、测试与上线文档 |
| `example/` | 三套单文件 H5/Dashboard 原型；方案 C 为定稿参照 |
| `infra/` | 部署配置、systemd、Nginx、发布与运维脚本 |
| `tests/` | Playwright E2E、静态服务与执行证据 |
| `standalone/` | 六个独立交付工作区的自动导出结果 |
| `release/` | 发布包快照与部署物料 |

## 系统架构 / Architecture

| 层 | 路径 | 作用 |
| --- | --- | --- |
| Mobile | `app/mobile` | 工坊发现、任务对话、文件、审批与账户工作区 |
| Dashboard | `app/dashboard` | 重度任务管理、Creator 治理、Provider 与平台管理 |
| Platform Admin | `app/admin` | 独立总管理入口、Provider、用户、工作区、运行与系统设置 |
| API | `app/api` | 鉴权、业务域、Realtime、文件、治理与内部回调 |
| Run Worker | `app/run-worker` | Preflight、Runtime 物化、队列、恢复、资源与清理 |
| Runtime Bridge | `app/container-bridge` | Codex App Server、MCP、凭证、文件、Artifact 与诊断 |
| Contracts | `packages/contracts` | API DTO、Zod Schema、事件与治理协议 |
| Persistence | `packages/db`, `packages/files` | Repository、PostgreSQL、文件与对象存储抽象 |
| Session Assets | `packages/session-pack` | Session 打包、脱敏、签名、继承与归档 |
| Client Integration | `packages/api-sdk`, `packages/realtime` | HTTP SDK、Token 刷新与 WebSocket/SSE |

## 运行链 / Runtime Flow

1. 用户从 Mobile 或 Dashboard 选择 Workshop 并实例化 Service。
2. API 校验工作区、Provider、MCP、Credential 与 Quota，创建 Run。
3. Run Worker 创建 target path 并物化 Session、Runtime、MCP 与 Secret 配置。
4. Runtime Bridge 启动 Codex CLI，系统先询问本次执行需要用户提供的信息。
5. 用户持续对话、上传附件、处理审批并查看实时状态。
6. Bridge 回传事件、文件、Artifact 和诊断；API 通过 WebSocket/SSE 分发。
7. 用户在任务内浏览 target path、预览或下载结果。

## 技术栈 / Technology

| 范围 | 技术 |
| --- | --- |
| Web Dashboard | React 18、Vite 5、TypeScript、React Router、TanStack Query、Zustand、i18next |
| Mobile | Taro 4.2、React 18、TypeScript、TanStack Query、Zustand |
| Backend | Node.js 22、Fastify 5、Zod、PostgreSQL adapters |
| Runtime | TypeScript、BullMQ、node-pty、chokidar |
| Realtime | WebSocket + SSE fallback |
| Test | Node test runner、Oxlint、TypeScript、Playwright |

## 常用命令 / Commands

```bash
pnpm install
pnpm build:shared
pnpm build:backend
pnpm build:frontend
pnpm typecheck:backend
pnpm typecheck:frontend
pnpm ci:backend
pnpm test:runtime:compiled
pnpm exec playwright test -c tests/e2e/playwright.config.mjs
pnpm standalone:export:all
```

本地开发与验证使用原生 Node.js/pnpm。当前工作约束禁止调用本地 Docker、WSL 或其他虚拟化环境；需要隔离 Runtime 的验收在指定服务器完成。

Local development and verification use native Node.js and pnpm. The current workspace policy prohibits local Docker, WSL, and other virtualization; isolated-runtime acceptance runs on the designated server.

## 拆分分支 / Snapshot Branches

完整工作区同时同步到 `git@github.com:copypasteltd/crypto-payment.git`：

| 分支 | 内容 |
| --- | --- |
| `agent-workshop-root` | 根配置与工程入口 |
| `agent-workshop-app` | `app/` 五个应用 |
| `agent-workshop-packages` | `packages/` 共享包 |
| `agent-workshop-docs` | `docs/` 文档 |
| `agent-workshop-example` | `example/` 原型 |
| `agent-workshop-infra` | `infra/` 部署资产 |
| `agent-workshop-tests` | `tests/` 自动化测试 |
| `agent-workshop-release` | 发布输出 |
| `agent-workshop-standalone` | 独立工作区导出 |
| `agent-workshop-monorepo` | 完整工程快照 |

## 阅读顺序 / Reading Order

- [全自动审批模式开发说明](docs/20260718全自动审批模式开发说明.md)

1. [产品需求草案](docs/产品需求草案.md)
2. [前端需求](docs/前端需求.md)
3. [后端设计文档](docs/后端设计文档.md)
4. [后端开发文档](docs/后端开发文档.md)
5. [Dashboard 开发文档](docs/dashboard开发文档.md)
6. [小程序开发文档](docs/小程序开发文档.md)
7. [系统实现差距审计](docs/系统实现差距审计-2026-07-12.md)

## 安全说明 / Security

- API Key、Provider Secret、内部 Token、服务器密码和用户凭证禁止提交到 Git。
- `.env.example` 仅保存字段定义和无效占位值。
- Runtime Secret 使用受控环境变量、Secret Manager 或 Credential Broker 注入。
- `.lingban-data`、`.smoke`、`.tmp` 与测试证据不作为生产数据源。

Secrets, infrastructure credentials, and user data must remain outside version control.
