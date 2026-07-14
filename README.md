# 灵办词元独立工作区 / Lingban Standalone Workspaces

本分支保存五个主仓库的可独立安装工作区快照。每个目录包含目标应用及其完整 `workspace:*` 传递依赖闭包。

This branch stores independently installable workspace snapshots for the five primary repositories. Each directory includes the target application and its complete transitive `workspace:*` dependency closure.

## 工作区 / Workspaces

| 路径 | 目标 |
| --- | --- |
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

每个工作区根目录的 `standalone-manifest.json` 记录源目录、包含包和验证命令。快照于 2026-07-14 从主工作区重新生成。

Each workspace includes a `standalone-manifest.json` with its source path, included packages, and validation command. Snapshots were regenerated from the primary workspace on 2026-07-14.

API Key、Token 和服务器凭证未写入该分支。

API keys, tokens, and server credentials are excluded from this branch.
