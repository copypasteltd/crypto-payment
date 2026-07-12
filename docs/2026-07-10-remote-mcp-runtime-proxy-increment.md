# 灵办词元 2026-07-10 Remote MCP Runtime Proxy 增量说明

## 1. 增量目标

本次增量用于补齐第三方远程 MCP 在运行时的二次网络策略执行层。

在此之前，系统已具备：

- API 侧 `mcp-network-policy` 注册、查询与 allowlist 前置校验
- Worker 侧把 `mcpNetworkPolicies` 写入 `StartRunJobPayload` 与 `BridgeSessionContext`
- Bridge 侧在物化前校验 remote MCP binding 的 policy 完整性

缺口在于：

- 容器内实际发起的 remote MCP HTTP / SSE / websocket 请求仍然直接指向原始远端 URL
- API 前置校验无法证明运行时每次请求都仍受策略约束

## 2. 本次新增能力

| 能力 | 说明 |
|---|---|
| bridge 本地 remote MCP proxy | 新增 `RemoteMcpProxyServer`，在 bridge 内监听本地 HTTP 服务 |
| 远程 MCP URL 改写 | `McpMaterializer` 会把远程 `http/sse/websocket` MCP 改写为 `127.0.0.1` 本地 proxy URL |
| 逐请求策略重验 | proxy 会在每次 HTTP 请求、SSE 流和 websocket upgrade 前重验 `networkPolicyRef` |
| runtime 诊断输出 | bridge 诊断中新增 `remoteMcpProxy` 统计项，暴露请求数、阻断数、失败数、活跃 upgrade 数等 |

## 3. 代码落点

| 文件 | 变更 |
|---|---|
| `app/container-bridge/src/bridge/remote-mcp-proxy-server.ts` | 新增 remote MCP proxy 实现 |
| `app/container-bridge/src/bridge/mcp-materializer.ts` | 新增 remote proxy URL 改写能力 |
| `app/container-bridge/src/index.ts` | 启动/停止 proxy，并把 proxy base URL 注入 materializer |
| `app/container-bridge/src/cli.ts` | 诊断输出聚合 bridge runtime 诊断 |

## 4. 修复的具体缺陷

首次落地 remote proxy 后，HTTP 转发测试返回 `502`。

根因：

- 代理错误地把下游 `request.close` 视为客户端断开信号
- 在 POST 请求体读取完成时，该事件会触发
- 上游 `fetch()` 被提前 `abort()`
- 结果表现为 HTTP proxy 返回 `502`

修复方式：

- 改为监听 `request.aborted`
- 使用 `response.close` 判断下游连接是否在响应完成前关闭
- 通过 `finally` 块统一移除生命周期监听器

## 5. 回归结果

| 验证项 | 结果 | 说明 |
|---|---|---|
| `pnpm -C app/container-bridge build` | 通过 | bridge 编译通过 |
| `pnpm -C app/container-bridge test` | 通过 | `17/17` |
| `pnpm -C app/run-worker build` | 通过 | worker 依赖链编译通过 |
| `pnpm -C app/run-worker test` | 通过 | `21/21` |
| `pnpm -C app/api build` | 通过 | API 依赖链编译通过 |
| `pnpm -C app/api test:smoke` | 通过 | `45/45`，确认本次 bridge/worker 依赖链更新未破坏后端主链 |

## 6. 当前仍未完成的边界

本次增量不能宣称以下能力已经完成：

| 能力 | 当前状态 |
|---|---|
| 容器级统一 egress firewall | 未完成 |
| 非 MCP 外连统一封锁 | 未完成 |
| BYO `stdio` 命令签名与执行用户治理 | 未完成 |
| connector 独立生命周期域 | 未完成 |

## 7. 当前系统性结论

> 后续说明：本文件记录的是 remote MCP runtime proxy 增量本身。2026-07-10 后续增量已补齐容器级 egress firewall，并为非第一方 `stdio` MCP 增加 `stdioPolicy.refSha256` 摘要签名约束，因此当前未闭环重点已收敛为实机联调证据、credential broker 与更细粒度 stdio 执行用户隔离。

本次增量后，远程 MCP 治理链已经从“API 前置校验”推进为“API 前置校验 + worker 物料携带 + bridge 运行时逐请求重验”。

对外可以宣称的真实状态是：

- 远程 MCP 的 runtime 请求已不再直接使用原始远端 URL
- HTTP / SSE / websocket 三类远程 MCP 请求已进入本地代理与运行时策略重验
- 容器级统一出网封锁仍未闭环
