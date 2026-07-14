# 灵办词元应用层 / Lingban Application Layer

`app/` 包含五个可部署应用。各应用拥有独立 GitHub 仓库，同时保留在统一 pnpm workspace 中进行跨层类型检查、契约联动和系统测试。

The `app/` directory contains five deployable applications. Each application has its own GitHub repository and remains part of the shared pnpm workspace for contract integration and system verification.

## 应用清单 / Applications

| 路径 | 仓库 | 技术 | 职责 |
| --- | --- | --- | --- |
| `app/mobile` | `agent-workshop-app` | Taro + React | H5 首发端、任务对话、文件与个人工作区 |
| `app/dashboard` | `agent-workshop-dashboard` | React + Vite | Workspace、Creator 与 Platform Admin 控制台 |
| `app/api` | `agent-workshop-backend` | Fastify + TypeScript | 公共 API、控制面、Realtime 与 Runtime 回调 |
| `app/run-worker` | `agent-workshop-run-worker` | BullMQ + TypeScript | 队列、工作区物化、运行调度、恢复与清理 |
| `app/container-bridge` | `agent-workshop-sdk` | node-pty + TypeScript | Codex CLI、MCP、Secret、文件、Artifact 与控制面 |

## 调用关系 / Dependency Flow

```text
Mobile / Dashboard
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
| Mobile | `mobile/src/app.tsx`, `mobile/src/app.config.ts` |

## 验证命令 / Validation

```bash
pnpm build:backend
pnpm typecheck:backend
pnpm typecheck:frontend
pnpm -C app/dashboard lint
pnpm -C app/mobile build:h5
pnpm test:runtime:compiled
```

截至 2026-07-14，五个应用均已具备正式代码主链；HZ01 已部署 API、Dashboard 与 Mobile H5 供验收。

As of 2026-07-14, all five applications have implemented production-oriented main paths; API, Dashboard, and Mobile H5 are deployed on HZ01 for acceptance testing.
