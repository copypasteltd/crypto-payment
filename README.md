# 灵办词元应用层 / Lingban Application Layer

`app/` 包含六个可部署应用。各应用拥有独立 Git 仓库边界，同时保留在统一 pnpm workspace 中进行跨层类型检查、契约联动和系统测试。

The `app/` directory contains six deployable applications. Each application has an independent Git repository boundary and remains part of the shared pnpm workspace for contract integration and system verification.

## 应用清单 / Applications

| 路径 | 仓库 | 技术 | 职责 |
| --- | --- | --- | --- |
| `app/mobile` | `agent-workshop-app` | Taro + React | H5 与微信小程序、任务对话、文件与个人工作区 |
| `app/dashboard` | `agent-workshop-dashboard` | React + Vite | Workspace 与 Creator 用户控制台 |
| `app/admin` | `agent-workshop-admin` | React + Vite | 独立 Platform Admin 控制面、治理与审计 |
| `app/api` | `agent-workshop-backend` | Fastify + TypeScript | 公共 API、控制面、Realtime 与 Runtime 回调 |
| `app/run-worker` | `agent-workshop-run-worker` | BullMQ + TypeScript | 队列、工作区物化、运行调度、恢复与清理 |
| `app/container-bridge` | `agent-workshop-sdk` | node-pty + TypeScript | Codex CLI、MCP、Secret、文件、Artifact 与控制面 |

## 调用关系 / Dependency Flow

```text
Mobile / Dashboard / Admin
        |
        v
       API <---- WebSocket / SSE ---->
        |
        v
   Run Worker
        |
        v
 Runtime Bridge ---- Codex CLI / MCP / target path
```

## 关键入口 / Entry Files

| 应用 | 入口 |
| --- | --- |
| API | `api/src/index.ts`, `api/src/app/create-server.ts` |
| Run Worker | `run-worker/src/daemon.ts`, `run-worker/src/jobs/start-run.ts` |
| Runtime Bridge | `container-bridge/src/cli.ts`, `container-bridge/src/bridge/codex-session.ts` |
| Dashboard | `dashboard/src/main.tsx`, `dashboard/src/app/router/AppRouter.tsx` |
| Admin | `admin/src/main.tsx`, `admin/src/app/App.tsx` |
| Mobile | `mobile/src/app.tsx`, `mobile/src/app.config.ts` |

## 验证命令 / Validation

```bash
pnpm build:backend
pnpm typecheck:backend
pnpm typecheck:frontend
pnpm -C app/dashboard lint
pnpm -C app/admin lint
pnpm -C app/mobile build:h5
pnpm -C app/mobile build:weapp
pnpm test:runtime:compiled
```

截至 2026-07-21，六个应用均已具备正式代码主链；移动端已完成微信小程序构建与登录主链，Admin 已完成独立工程、后端控制面、Dashboard 拆离和发布接入。Mobile、Dashboard 与 Admin 已接入实例停止、释放、归档、恢复和永久销毁生命周期。

As of 2026-07-21, all six applications have production-oriented main paths. Mobile includes the WeChat Mini Program build and login flow, Admin remains independently deployed from Dashboard, and every client surface exposes the run lifecycle actions allowed by its permission boundary.
