# 灵办词元 Runtime Egress Proxy Hook Increment

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 2026-07-10 runtime egress proxy hook increment |
| 编写日期 | 2026-07-10 |
| 影响仓库 | `app/run-worker`、`packages/config` |
| 关联链路 | runtime 物料生成、Docker/local-process bridge 启动、BYO-MCP 出网治理 |
| 验证范围 | `run-worker build/test`、`container-bridge test`、`api build/test:smoke` |

## 2. 本次增量目标

| 目标 | 说明 |
|---|---|
| 恢复 `run-worker` 构建绿色 | 修复 `egress-proxy.ts` 的类型边界错误 |
| 落地 runtime egress proxy hook | 让 worker 能为 runtime 注入本地 HTTP/HTTPS/CONNECT 出网代理 |
| 复用现有治理口径 | 基于 `runtimeApiBaseUrl`、显式 allowlist 与 materialized `mcpNetworkPolicies` 统一决定可访问目标 |
| 保持 Docker 与 local-process 口径一致 | Docker 追加 `host.docker.internal:host-gateway`，local-process 走 `127.0.0.1` |

## 3. 已实现能力

| 能力 | 当前结果 |
|---|---|
| Worker 配置项 | 新增 `LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED`、`LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS`、`LINGBAN_RUNTIME_EGRESS_NO_PROXY_HOSTS` |
| Runtime egress policy 组装 | 会合并 `runtimeApiBaseUrl`、显式 allowlist 与 `mcpNetworkPolicies` 形成运行时 allowlist |
| HTTP 转发 | proxy 可转发 allowlisted HTTP 请求，阻断非 allowlisted 目标 |
| CONNECT 隧道 | proxy 可建立 allowlisted `CONNECT host:port` 隧道，拒绝越界 authority |
| 认证 | proxy 使用 Basic auth，runtime 注入的代理 URL 自带凭证 |
| Runtime 环境注入 | local-process / Docker runtime 均会收到 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY` |
| Docker host-gateway 编排 | 启用代理或 runtime API 使用 `host.docker.internal` 时，launch plan 自动加入 `host.docker.internal:host-gateway` |
| 诊断 | proxy 暴露 requests/connect/block/auth failure/failure 等诊断计数 |
| 运行态观测 | egress proxy 诊断已透传到 runtime handle、worker `/diagnostics` 与 worker metrics 文本导出 |

## 4. 代码变更清单

| 文件 | 变更 |
|---|---|
| `packages/config/src/index.ts` | 新增 runtime egress 相关环境变量解析 |
| `app/run-worker/src/services/specs.ts` | 为 `containerLaunchPlan` 新增 `extraHosts` |
| `app/run-worker/src/services/container-runtime.ts` | 生成 `extraHosts`，并把 `--add-host` 写入 Docker command preview |
| `app/run-worker/src/services/egress-proxy.ts` | 新增 runtime egress policy、HTTP proxy、CONNECT tunnel 与诊断实现 |
| `app/run-worker/src/services/bridge-runner.ts` | 在 local-process / Docker 启动前拉起 egress proxy，注入 runtime env，并在退出链路停止 proxy |
| `app/run-worker/src/daemon.ts` / `src/observability.ts` | 把 egress proxy 诊断挂到 active runtime 视图，并导出 worker 级观测字段 |
| `app/run-worker/tests/egress-proxy.test.mjs` | 新增 HTTP 转发与 CONNECT 隧道测试 |
| `app/run-worker/tests/bridge-runner.test.mjs` / `tests/ops-http.test.mjs` | 新增 local-process / Docker env 注入、`NO_PROXY`、`--add-host`、egress proxy 诊断与 metrics 断言，并把端口夹具改成真实临时端口分配 |

## 5. 修复记录

| 问题 | 原因 | 处理 |
|---|---|---|
| `TS2345: Duplex is not assignable to Socket` | `writeConnectDenied()` 把 `CONNECT` socket 错误约束成 `net.Socket` | 将函数签名收敛到真实调用面使用的 `Duplex` |
| Docker bridge runner 测试端口冲突 | 新增 egress proxy 后，同一测试不再只占用一个端口；原用例仍写死固定端口 | 改为基于 `net.createServer().listen(0)` 的临时端口分配夹具 |
| Docker env 断言过时 | 测试仍沿用旧的代理占位口径 | 断言改为真实的代理 URL、`NO_PROXY` 与 `--add-host` 证据 |

## 6. 回归验证

| 命令 | 结果 |
|---|---|
| `pnpm -C app/run-worker build` | 通过 |
| `pnpm -C app/run-worker test` | 通过，`24/24` |
| `pnpm -C app/container-bridge test` | 通过，`17/17` |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`45/45` |

## 7. 当前边界

| 项 | 当前状态 |
|---|---|
| Runtime egress proxy hook | 已落地 |
| Remote MCP bridge-side proxy | 已落地 |
| 容器级统一 egress firewall | 未完成 |
| 所有进程强制经代理 | 未完成 |
| DNS/TLS 级更强出网证据 | 未完成 |

## 8. 结论

> 后续说明：本文件记录的是 proxy hook 增量本身。2026-07-10 后续增量已补齐 Docker launch plan `NET_ADMIN + egressFirewall` 编排、runner entrypoint `iptables/ip6tables` 应用，以及对应的 worker / bridge / API 回归验证，容器级 egress firewall 已完成基础闭环。

本次增量已经把运行时基础出网治理从“仅有 API 前置校验 + bridge 侧 remote MCP proxy”推进到“worker 可为 runtime 注入统一 egress proxy”的阶段。当前可以证明：

1. 运行时基础外连可复用 allowlist 与 `mcpNetworkPolicies`。
2. local-process 与 Docker 两种启动方式都能拿到一致的代理注入语义。
3. Docker mode 已具备 `host.docker.internal` 到宿主代理的连通性编排。

仍不能宣称容器内所有外连都被平台硬性封锁，因此 `container-level egress firewall` 仍保持未完成状态。
