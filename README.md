# 灵办词元总管理后台 / Lingban Admin Console

灵办词元 Admin Console 是面向平台总管理员的独立控制面。它拥有独立登录、Cookie 会话、路由、构建产物、部署端口和审计边界，不承载用户工作区与 Creator 日常操作。

Lingban Admin Console is the independent platform control plane for the single platform administrator role. It has its own authentication session, routes, build artifact, deployment port, and audit boundary.

## 仓库信息 / Repository

| 项目 / Item | 内容 / Value |
|---|---|
| 本地路径 / Local path | `app/admin` |
| 推荐仓库 / Suggested repository | `git@github.com:copypasteltd/agent-workshop-admin.git` |
| 主分支 / Default branch | `main` |
| 技术栈 / Stack | React 18, Vite 5, TypeScript, React Router, TanStack Query/Table/Virtual, Zustand, i18next, Lucide |
| 生产端口 / Production port | `38140` |
| API 前缀 / API prefix | Same-origin `/admin/v1` |
| 国际化 / Internationalization | `zh-CN`, `en-US`; namespace-based i18next resources |

## 管理模块 / Management Modules

| 模块 / Module | 主要能力 / Capabilities |
|---|---|
| 平台总览 / Overview | 健康、核心指标、异常队列、最近管理操作 |
| 用户与工作区 / Accounts | 用户、登录会话、工作区、成员、使用量、暂停与恢复 |
| 工坊与 Session / Catalog | 工坊、服务、发布、Session 资产、血缘、隔离与上架治理 |
| 运行与运行时 / Runs | Run 查询、对话与文件快照、成本、MCP 调用、取消、重试、终止和运行时诊断 |
| Provider 与模型 / Providers | 新建与编辑 URL、Bearer API Key 加密写入、Credential Binding、鉴权测活、远端模型同步和启停治理 |
| MCP 与凭证 / Integrations | 第一方及第三方 MCP、网络与调用证据、私有凭证创建、轮换、冻结和吊销 |
| 配额与账务 / Billing | 配额策略、计数器、Override、用量和不可变账本 |
| 审计与系统 / System | 管理审计、系统健康、版本化配置、通知、保留策略和 Admin 账户状态 |

All high-impact governance actions use impact preflight, an explicit reason, a confirmation phrase, version validation, CSRF protection, and an immutable audit record. Credential values are accepted only by write forms and are never returned by read APIs.

## 本地开发 / Local Development

本地开发仅使用 Node.js、pnpm、Vite 和浏览器。项目脚本不会启动 Docker、WSL、Podman 或其他虚拟化环境。

Local development uses Node.js, pnpm, Vite, and a browser only. Project scripts do not start Docker, WSL, Podman, or any virtualization runtime.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm preview
```

Admin E2E 从工作区根目录执行，覆盖全部模块、Provider 创建、治理影响预检、主题、语言与最小宽度保护。

Run Admin E2E from the workspace root. It covers every module, provider creation, governance impact review, themes, languages, and minimum-width protection.

```bash
pnpm test:e2e:admin
```

开发服务器将 `/admin/v1` 转发到 `VITE_ADMIN_PROXY_TARGET`。生产静态资源始终调用同源 `/admin/v1`，由 Nginx 反向代理到 Backend。

The development server proxies `/admin/v1` to `VITE_ADMIN_PROXY_TARGET`. Production always uses same-origin `/admin/v1`, with Nginx forwarding requests to the Backend.

界面文案按 `common`、`navigation`、`accounts`、`catalog`、`runs`、`providers`、`integrations`、`billing`、`audit` 和 `overview` Namespace 管理。语言切换会同步更新 `html lang`，并保留当前路由、筛选与操作上下文。

UI copy is organized into `common`, `navigation`, `accounts`, `catalog`, `runs`, `providers`, `integrations`, `billing`, `audit`, and `overview` namespaces. Language changes update `html lang` while preserving route, filter, and operation state.

## 安全边界 / Security Boundary

- 唯一业务权限为 `platform_admin`。
- Access 与 Refresh Token 仅存于 `HttpOnly`、`SameSite=Strict` Cookie。
- 写请求携带签名双提交 CSRF Token；Token 只保存在页面内存。
- 凭证明文不会进入列表、详情、日志、审计或浏览器持久化存储。
- Provider 与 MCP 探测由 Backend 执行。
- 高影响操作完成前必须核对影响快照、确认词和资源版本。

- The only product role is `platform_admin`.
- Access and refresh tokens remain in `HttpOnly`, `SameSite=Strict` cookies.
- Mutations use a signed double-submit CSRF token held only in page memory.
- Secret values never appear in read models, logs, audit payloads, or browser persistence.
- Backend services perform Provider and MCP probes.
- High-impact actions validate the impact snapshot, confirmation phrase, and resource version.

## 发布 / Deployment

`pnpm build` 输出独立 `dist/`。生产站点需要 SPA fallback、`/healthz`、HTML 禁止长期缓存、哈希资源长期缓存，并将 `/admin/v1/` 同源代理到 API Server。

`pnpm build` produces an independent `dist/`. The production site requires SPA fallback, `/healthz`, no long-term caching for HTML, immutable caching for hashed assets, and a same-origin proxy from `/admin/v1/` to the API Server.

完整产品、接口、视觉和验收规范见 `docs/20260715admin重构细则.md`。后端数据链路见 `docs/后端设计文档.md`。

See `docs/20260715admin重构细则.md` for the complete product and acceptance specification, and `docs/后端设计文档.md` for backend data flows.
