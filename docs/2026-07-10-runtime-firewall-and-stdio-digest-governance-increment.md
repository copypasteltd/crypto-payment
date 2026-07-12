# 灵办词元 2026-07-10 Runtime Firewall 与 stdio 摘要治理增量

## 1. 目标

本次增量补齐两条运行时治理链：

| 项 | 目标 |
|---|---|
| 容器级 egress firewall | 让 Docker runtime 具备进程级默认拒绝的基础出网封锁能力 |
| `stdio` 摘要治理 | 让非第一方 `stdio` MCP 在路径白名单之外再增加可验证的文件摘要约束 |

## 2. 已落地能力

| 能力 | 当前结果 |
|---|---|
| Worker firewall 编排 | `app/run-worker` 会为 Docker launch plan 生成 `capAdd=["NET_ADMIN"]` 与 `egressFirewall` 目标清单 |
| Firewall 目标推导 | 自动从 `runtimeApiBaseUrl`、远程 `McpBinding.ref` 与 runtime proxy 目标推导允许的 `host:port` |
| Runner entrypoint 应用 | `infra/docker/entrypoint.sh` 会在 bridge 启动前执行容器内 firewall 应用 |
| 容器规则执行 | `app/container-bridge/src/runtime-egress-firewall.ts` 会生成并执行 `iptables/ip6tables` 规则，包含 loopback、`ESTABLISHED,RELATED`、DNS 解析器、允许目标与默认拒绝 |
| `stdio` 摘要契约 | `packages/contracts/src/mcp.ts`、`packages/contracts/src/runtime.ts` 已新增 `stdioPolicy.refSha256` |
| API 侧准入 | `app/api/src/modules/mcp/service.ts` 对非第一方 `stdio` MCP 强制要求 `stdioPolicy.refSha256`，并拒绝把 `stdioPolicy` 用于远程 transport |
| Runtime 侧摘要校验 | `packages/mcp/src/index.ts` 与 `app/container-bridge/src/bridge/mcp-materializer.ts` 会在物化前校验目标文件 SHA-256 摘要 |

## 3. 代码落点

| 文件 | 变更 |
|---|---|
| `packages/contracts/src/mcp.ts` | 新增 `mcpStdioPolicySchema` 与 `stdioPolicy` 字段 |
| `packages/contracts/src/runtime.ts` | `McpBinding` 增加 `stdioPolicy` |
| `packages/config/src/index.ts` | 新增 `LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED`、`LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS`、`LINGBAN_MCP_STDIO_REQUIRE_REF_SHA256` |
| `packages/mcp/src/index.ts` | 新增 `evaluateMcpStdioIntegrity()` 与 `assertRuntimeMcpBindingStdioIntegrity()` |
| `app/api/src/modules/mcp/service.ts` | 新增 `stdioPolicy.refSha256` 准入校验 |
| `app/api/src/modules/runs/launch-plan.ts` | 把 `stdioPolicy` 带入 runtime binding |
| `app/run-worker/src/services/container-runtime.ts` | launch plan 输出 `egressFirewall` |
| `app/run-worker/src/services/bridge-runner.ts` | Docker env 注入 firewall 变量 |
| `app/container-bridge/src/bridge/mcp-materializer.ts` | `stdio` 摘要校验 |
| `app/container-bridge/src/runtime-egress-firewall.ts` | 容器内 firewall 规则规划与执行 |
| `infra/docker/entrypoint.sh` | 启动前应用 firewall |
| `infra/docker/runner.Dockerfile` | 补齐 `iptables` 依赖 |

## 4. 回归验证

| 命令 | 结果 |
|---|---|
| `pnpm -C app/container-bridge test` | 通过，`21/21` |
| `pnpm -C app/run-worker test` | 通过，`25/25` |
| `pnpm -C app/api test:smoke` | 通过，`45/45` |

关键覆盖点：

| 测试 | 覆盖 |
|---|---|
| `app/container-bridge/tests/mcp-materializer.test.mjs` | `stdio` allowlist、摘要匹配、摘要不匹配阻断 |
| `app/container-bridge/tests/runtime-egress-firewall.test.mjs` | firewall 配置解析、DNS 解析器放行、`iptables/ip6tables` 规则生成 |
| `app/run-worker/tests/bridge-runner.test.mjs` | Docker env 注入、`--cap-add NET_ADMIN`、firewall 目标 JSON |
| `app/run-worker/tests/container-runtime.test.mjs` | runtime 物料与 Docker launch plan 中的 firewall/`stdioPolicy` 编排 |
| `app/api/tests/mcp-credentials.smoke.test.mjs` | API 侧 `stdioPolicy.refSha256` 准入与 runtime binding 落盘 |

## 5. 当前仍未闭环的点

| 项 | 当前状态 |
|---|---|
| Docker daemon 现场验收 | 代码与测试已完成，实机 Docker 现场证据仍待补齐 |
| Credential Broker / Vault-KMS | 尚未正式落地 |
| `stdio` 执行用户隔离 | 摘要签名已补齐，执行用户与更细目录权限仍未闭环 |
| 多节点调度与平台观测 | BullMQ / worker 基线已具备，跨节点治理与统一观测仍待继续建设 |

## 6. 结论

本次增量把运行时治理从“路径白名单 + 代理重验”推进到“容器级出网封锁 + `stdio` 可验证执行指纹”的阶段。当前可以对外宣称：

1. Docker runtime 已具备基础的默认拒绝出网封锁链路。
2. 非第一方 `stdio` MCP 已具备 `path-prefix + SHA-256` 双重约束。
3. API、worker、bridge 三段口径已经统一，并已通过回归测试验证。
