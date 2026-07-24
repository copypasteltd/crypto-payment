# 灵办词元独立工作区 / Lingban Standalone Workspaces

本分支保存六个可独立安装工作区快照。每个目录包含目标应用及其完整 `workspace:*` 传递依赖闭包。

This branch stores six independently installable workspace snapshots. Each directory includes the target application and its complete transitive `workspace:*` dependency closure.

## 工作区 / Workspaces

| 路径 | 目标 |
| --- | --- |
| `standalone/agent-workshop-admin` | Independent Platform Admin |
| `standalone/agent-workshop-app` | Taro Mobile H5 / Mini Program |
| `standalone/agent-workshop-dashboard` | React + Vite Dashboard |
| `standalone/agent-workshop-backend` | Fastify Backend API |
| `standalone/agent-workshop-run-worker` | BullMQ Run Worker |
| `standalone/agent-workshop-sdk` | Runtime Bridge |

## 使用 / Usage

```bash
cd standalone/agent-workshop-dashboard
pnpm install
pnpm run validate
```

每个工作区根目录的 `standalone-manifest.json` 记录源目录、包含包和验证命令。快照于 2026-07-25 从主工作区重新生成，包含完整实例生命周期、会话检查点、只读分享与中断恢复能力。

Each workspace includes a `standalone-manifest.json` with its source path, included packages, and validation command. Snapshots were regenerated from the primary workspace on 2026-07-25 with run lifecycle, session checkpoint, read-only sharing, and interrupted-capture recovery support.

API Key、Token 和服务器凭证未写入该分支。

API keys, tokens, and server credentials are excluded from this branch.
