# Standalone README

本目录对应拆分分支 `agent-workshop-standalone`，保存六个独立交付工作区的镜像快照。

This directory maps to the `agent-workshop-standalone` branch and contains standalone snapshots for the independently deliverable repositories.

## 仓库镜像 / Repository Mirrors

| 路径 | 对应仓库 |
| --- | --- |
| `standalone/agent-workshop-admin` | 独立 Platform Admin 前端 |
| `standalone/agent-workshop-app` | 移动端前端仓库 |
| `standalone/agent-workshop-dashboard` | Dashboard 仓库 |
| `standalone/agent-workshop-backend` | Backend 仓库 |
| `standalone/agent-workshop-run-worker` | Run Worker 仓库 |
| `standalone/agent-workshop-sdk` | SDK / bridge 相关仓库 |

## 用途 / Purpose

- 用于独立仓库初始化
- 用于对照 monorepo 的拆分输出
- 用于单仓库交付与核验

快照于 2026-07-21 从主工作区重新导出，包含完整的实例生命周期契约、API、Worker 和客户端能力。

The snapshots were regenerated from the primary workspace on 2026-07-21 and include the complete run lifecycle contracts, API, worker, and client capabilities.
