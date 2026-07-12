# 灵办词元后端 API / Lingban Backend API

## 仓库定位 / Repository Role

本目录是灵办词元的接入后端与控制面，位于 `app/api`，属于拆分分支 `agent-workshop-app` 的一部分，也会被打包进 backend 相关 release / standalone 交付。

This directory contains the Lingban entry backend and control plane. It lives at `app/api`, is part of the `agent-workshop-app` split branch, and is also included in backend-oriented release and standalone deliverables.

## 主要职责 / Responsibilities

- run 创建、查询、会话消息与状态聚合
- workshop、creator、search、me、notifications 等前台数据面
- credential、MCP、quota、billing、upload 的治理入口
- bridge 注册、internal callback、runtime 诊断回写
- target path 文件树、预览、下载与归档读取
- 鉴权、工作区边界、权限与审计控制

## 模块结构 / Module Map

| 路径 | 作用 | 关键文件 |
| --- | --- | --- |
| `src/app/` | Server 装配、配置、错误、存储、诊断、运行时装配 | `create-server.ts`, `runtime.ts`, `storage.ts` |
| `src/modules/runs/` | run 主领域、状态流转、文件访问、runtime 编排 | `service.ts`, `routes.ts`, `runtime-orchestrator.ts` |
| `src/modules/bridge/` | bridge 注册、请求守卫、callback ledger | `routes.ts`, `registry.ts`, `request-guard.ts` |
| `src/modules/credentials/` | 凭证生命周期、broker、callback、审计 | `service.ts`, `broker.ts`, `lifecycle-manager.ts` |
| `src/modules/mcp/` | MCP 注册、探活、调用审计、治理审计 | `service.ts`, `probe.ts`, `call-audit-service.ts` |
| `src/modules/uploads/` | 上传、对象存储、保留策略、安全扫描 | `service.ts`, `object-store.ts`, `file-security.ts` |
| `src/modules/workshops/` | 工坊目录与服务详情 | `routes.ts`, `service.ts` |
| `src/modules/creator/` | Creator 数据域、发布与治理视图 | `routes.ts`, `service.ts` |
| `src/modules/auth/` | 登录态、请求鉴权与加密辅助 | `request-auth.ts`, `service.ts`, `crypto.ts` |
| `src/modules/realtime/` | WebSocket / SSE 事件分发 | `event-bus.ts`, `socket-routes.ts` |
| `src/modules/sessions/` | session 资产、版本线、归档视图 | `service.ts`, `version-line.ts` |
| `src/modules/search/` | 全局搜索与检索接口 | `routes.ts`, `service.ts` |
| `src/modules/quotas/` | 配额计数、审批与策略读取 | `routes.ts`, `service.ts` |
| `src/modules/billing/` | 用量账本与计费聚合 | `routes.ts`, `service.ts` |
| `src/modules/me/` | 我的页读模型、最近使用、收藏等摘要 | `read-model.ts`, `service.ts` |
| `src/modules/notifications/` | 通知中心与待办回流 | `routes.ts`, `service.ts` |
| `src/modules/batch-runs/` | 批量运行、导入与批次管理 | `routes.ts`, `service.ts`, `import-file.ts` |

## 关键依赖 / Key Dependencies

| 包 | 用途 |
| --- | --- |
| `@lingban/contracts` | 对外 API 与内部事件契约 |
| `@lingban/db` | repository、query repository、event bus |
| `@lingban/domain-models` | run、quota、search 等领域结构 |
| `@lingban/session-pack` | session 资产与脱敏打包能力 |
| `@lingban/run-worker` | run 启动编排接线 |
| `@lingban/container-bridge` | bridge 运行期协议与控制面接线 |

## 运行命令 / Commands

```bash
pnpm -C app/api build
pnpm -C app/api typecheck
pnpm -C app/api start
pnpm -C app/api migrate
pnpm -C app/api test:smoke
```

## 代码阅读入口 / Reading Entry

1. `src/index.ts`
2. `src/app/create-server.ts`
3. `src/modules/runs/routes.ts`
4. `src/modules/runs/service.ts`
5. `src/modules/bridge/routes.ts`
6. `src/modules/credentials/service.ts`

## 当前状态 / Current Status

当前代码已经具备 run、bridge、credential、MCP、upload、search、creator、quota、billing、notification 等核心接口与文件持久化路径。后续重点仍然是正式数据库切流、对象存储权威化、生产级审计闭环与更完整的治理策略。
