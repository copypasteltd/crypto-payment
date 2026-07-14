# 灵办词元 Run Worker / Lingban Run Worker

Run Worker 将 API 创建的 Run 转换为可执行工作区、Runtime 配置和 Bridge 启动过程，并负责队列消费、恢复、资源治理与清理。

The Run Worker turns API-created runs into executable workspaces, runtime material, and bridge processes. It also owns queue consumption, recovery, resource governance, and cleanup.

## 仓库信息 / Repository

| 项目 | 内容 |
| --- | --- |
| GitHub | `git@github.com:copypasteltd/agent-workshop-run-worker.git` |
| Monorepo 路径 | `app/run-worker` |
| 主分支 | `main` |
| Runtime | Node.js 22、TypeScript、BullMQ、Zod |
| 队列 | Redis + BullMQ |
| 执行模式 | Managed process、isolated runtime launcher |

The standalone worker export includes all internal workspace packages required by its `workspace:*` dependencies.

## 主要职责 / Responsibilities

- 消费 `run.start` 与 `run.cleanup` 队列。
- 执行 preflight、幂等检查、配额和 Runtime 先决条件校验。
- 创建 host/runtime/target/output 目录并应用路径边界。
- 物化 Session Pack、MCP Binding、Secret Manifest 与 Provider Runtime 配置。
- 生成 Bridge Context 和 Runtime Launch Plan。
- 启动 Bridge，采集心跳、状态、诊断与退出原因。
- 执行重试、退避、DLQ、孤儿 Run 恢复、终态清理与 TTL 回收。
- 暴露 Worker 运维 HTTP、健康信息和 Prometheus 指标。

## 工程结构 / Code Structure

| 路径 | 职责 |
| --- | --- |
| `src/daemon.ts` | 常驻 Worker 入口、处理器注册和关闭流程 |
| `src/queue.ts` | BullMQ 连接、队列名、重试与 DLQ 配置 |
| `src/jobs/start-run.ts` | Run 启动任务入口 |
| `src/services/workspace-preparer.ts` | 工作区和目录物化 |
| `src/services/session-pack-materializer.ts` | Session Pack 校验与落盘 |
| `src/services/run-lifecycle.ts` | 状态推进、失败回写、恢复与清理 |
| `src/services/bridge-runner.ts` | Bridge 进程/Runtime 启动协调 |
| `src/services/container-runtime.ts` | 隔离运行启动计划与执行器适配 |
| `src/services/egress-proxy.ts` | HTTP/HTTPS/CONNECT 出网代理与授权 |
| `src/services/egress-firewall.ts` | Runtime 出网策略生成与诊断 |
| `src/ops-http.ts` | Health、readiness、diagnostics、metrics 与运维动作 |
| `src/observability.ts` | 日志字段、计数器与 Prometheus 指标 |

## 生成物料 / Generated Material

| 文件 | 用途 |
| --- | --- |
| `runtime-config.json` | Run、Provider、资源和目标路径配置 |
| `bridge-context.host.json` | Managed process 模式 Bridge 上下文 |
| `bridge-context.container.json` | 隔离 Runtime 模式 Bridge 上下文 |
| `mcp-config.json` | Codex CLI 可消费的 MCP 配置 |
| `mcp-bindings.json` | MCP 来源、凭证、网络和 stdio 策略 |
| `secret-manifest.json` | Secret 引用、目标载体与注入要求 |
| `container-launch-plan.json` | 镜像、挂载、资源、网络和入口计划 |

## 队列语义 / Queue Semantics

| 队列 | 作用 | 默认策略 |
| --- | --- | --- |
| `run.start` | 启动并接管 Run | 3 次尝试，指数/固定退避由环境配置 |
| `run.cleanup` | 终态清理与资源回收 | 5 次尝试 |
| `run.start.dlq` | 启动失败留档 | 保留原任务与失败上下文 |
| `run.cleanup.dlq` | 清理失败留档 | 供运维重放与审计 |

## 配置 / Configuration

关键变量：

```env
LINGBAN_API_BASE_URL=http://127.0.0.1:3100
LINGBAN_INTERNAL_AUTH_TOKEN=<long-random-secret>
LINGBAN_RUNTIME_DISPATCH_MODE=bullmq
LINGBAN_REDIS_URL=redis://127.0.0.1:6379/0
LINGBAN_RUNTIME_MAX_CONCURRENT_RUNS=2
LINGBAN_RUNS_DIR=.lingban-data/worker/runs
LINGBAN_RUNNER_IMAGE=ghcr.io/lingban/runner:latest
LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED=false
LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES=[]
```

完整配置参见 `.env.example`。

## 开发与验证 / Development

```bash
pnpm -C app/run-worker typecheck
pnpm -C app/run-worker build
pnpm -C app/run-worker test
pnpm -C app/run-worker start:daemon
```

本地测试使用原生 Node.js，覆盖启动计划、队列、Workspace、Session Pack、Egress、Ops HTTP 与恢复逻辑。隔离 Runtime 真链验收在指定服务器执行。

Native Node.js tests cover launch plans, queues, workspaces, session packs, egress controls, operations HTTP, and recovery. Full isolated-runtime validation runs on the designated server.

## 当前状态 / Current Status

截至 2026-07-14，Worker 已实现 BullMQ 常驻消费、Runtime 物料生成、Provider 环境注入、Bridge 启动、Egress 治理、诊断指标、恢复、DLQ 与清理主链。

As of 2026-07-14, the worker implements persistent BullMQ consumption, runtime materialization, provider environment injection, bridge startup, egress governance, diagnostics, recovery, dead-letter queues, and cleanup.

最新原生测试结果：27/27 通过。

Latest native test result: 27/27 passed.

生产运行需要 Redis 高可用、Worker 多副本抢占验证、Runner 版本固定、容量上限、告警规则和资源回收演练。

Production operation requires Redis high availability, multi-worker contention tests, pinned runner versions, capacity limits, alert rules, and resource-reclamation drills.
