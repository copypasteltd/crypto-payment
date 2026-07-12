# 灵办词元 Run Worker / Lingban Run Worker

## 仓库定位 / Repository Role

本目录是灵办词元的运行调度层，位于 `app/run-worker`。它负责把 API 侧创建的 run 变成可执行的 runtime 工作区与启动计划。

This directory contains the Lingban runtime scheduling layer at `app/run-worker`. It turns API-created runs into executable runtime workspaces and launch plans.

## 主要职责 / Responsibilities

- run preflight 校验与状态推进
- host / runtime workspace 准备
- runtime-config、MCP、secret、session-pack 物化
- bridge 启动、容器启动计划生成与执行
- `run.start` / `run.cleanup` 队列消费
- 生命周期遥测、故障回写、恢复与清理

## 代码结构 / Code Structure

| 路径 | 作用 | 关键文件 |
| --- | --- | --- |
| `src/jobs/` | 任务入口 | `start-run.ts` |
| `src/services/workspace-preparer.ts` | 工作区准备与目录生成 | `workspace-preparer.ts` |
| `src/services/session-pack-materializer.ts` | session 包与 runtime 资产物化 | `session-pack-materializer.ts` |
| `src/services/specs.ts` | 运行规格、目录与路径规则 | `specs.ts` |
| `src/services/run-lifecycle.ts` | 状态推进、失败终态与清理流程 | `run-lifecycle.ts` |
| `src/services/bridge-runner.ts` | bridge 进程或容器的启动协调 | `bridge-runner.ts` |
| `src/services/container-runtime.ts` | 容器启动计划与执行 | `container-runtime.ts` |
| `src/services/egress-firewall.ts` | 出网约束治理 | `egress-firewall.ts` |
| `src/services/egress-proxy.ts` | 出网代理接线 | `egress-proxy.ts` |
| `src/queue.ts` | 队列定义 | `queue.ts` |
| `src/daemon.ts` | worker daemon 入口 | `daemon.ts` |
| `src/ops-http.ts` | 运维观察与控制接口 | `ops-http.ts` |

## 生成产物 / Generated Artifacts

- `runtime-config.json`
- `bridge-context.host.json`
- `bridge-context.container.json`
- `mcp-config.json`
- `mcp-bindings.json`
- `secret-manifest.json`
- `container-launch-plan.json`

## 开发命令 / Commands

```bash
pnpm -C app/run-worker build
pnpm -C app/run-worker typecheck
pnpm -C app/run-worker start:daemon
pnpm -C app/run-worker test
```

## 当前状态 / Current Status

当前已经具备 run workspace 物化、BullMQ 队列消费、bridge 启动协调、容器计划生成与失败回写能力。后续仍需加强正式环境的恢复策略、出网治理、实时观测与生产部署联调。
