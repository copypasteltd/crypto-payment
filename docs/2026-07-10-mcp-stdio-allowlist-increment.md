# 灵办词元 2026-07-10 MCP stdio allowlist 增量说明

## 1. 本次目标

| 项 | 内容 |
|---|---|
| 主题 | 非第一方 `stdio` MCP 的治理闭环 |
| 范围 | `app/api`、`app/run-worker`、`app/container-bridge`、`packages/mcp`、相关测试与状态文档 |
| 目标 | 允许受控的非第一方 `stdio` MCP 注册与运行，同时在 API、worker、bridge 三侧保持一致的 allowlist 校验与路径映射语义 |

## 2. 本次落地内容

| 层 | 变更 |
|---|---|
| `packages/mcp` | 新增 `evaluateMcpStdioPathAllowlist()`；`validateRuntimeMcpBindings()` 与 `assertRuntimeMcpBindings()` 支持 `stdioAllowedPathPrefixes` |
| `app/api` | `mcp service` 允许非第一方 `stdio` MCP 注册；create/update MCP、create/update binding、create run 前统一执行 path-prefix allowlist 校验；`stdio` MCP 不再接受 network policy |
| `app/run-worker` | runtime 物料生成前执行非第一方 `stdio` allowlist 校验；`run-lifecycle` 改写 host/container 双视角 `stdio ref`；`bridge-runner` 按 local-process / docker 两种模式注入正确的 allowlist 前缀 |
| `app/container-bridge` | `McpMaterializer` 在写 `mcp-config.json` 前执行非第一方 `stdio` allowlist 校验；CLI 已透传配置 |

## 3. 关键语义

| 规则 | 当前行为 |
|---|---|
| 第一方 MCP | 仍固定为 `transport=stdio`，且沿用系统管理路径 |
| 非第一方远程 MCP | 继续使用 `mcp-network-policy` 做 host/protocol/port/path allowlist |
| 非第一方 `stdio` MCP | 必须命中 `LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES` |
| `stdio` + network policy | 明确拒绝，不允许 default policy 或 binding override |
| local-process bridge | worker 会把容器路径前缀改写成 host 前缀后再注入 bridge 环境 |
| docker bridge | 直接注入容器风格 allowlist 前缀 |

## 4. 新增与更新测试

| 测试 | 覆盖点 | 结果 |
|---|---|---|
| `app/api/tests/mcp-credentials.smoke.test.mjs` | 非第一方 `stdio` MCP 的 allowlist、network-policy 拒绝、run 审批链 | 通过 |
| `app/run-worker/tests/container-runtime.test.mjs` | runtime 物料层 `stdio` allowlist 接受/拒绝 | 通过 |
| `app/run-worker/tests/bridge-runner.test.mjs` | local-process allowlist 前缀 host 映射注入 | 通过 |
| `app/container-bridge/tests/mcp-materializer.test.mjs` | bridge 物化层 `stdio` allowlist 接受/拒绝 | 通过 |

## 5. 构建与回归证据

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/config build` | 通过 |
| `pnpm -C packages/mcp build` | 通过 |
| `pnpm -C app/container-bridge build` | 通过 |
| `pnpm -C app/run-worker build` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/container-bridge test` | 通过 |
| `pnpm -C app/run-worker test` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`45/45` |

## 6. 当前仍未完成项

| 项 | 说明 |
|---|---|
| runtime egress 强制层 | 远程 MCP 的容器级出网限制仍未闭环 |
| `stdio` 更细粒度执行治理 | 尚未做到命令签名、执行用户、权限收缩与更细目录策略 |
| 独立 connector registry / lifecycle 域 | 当前仍以通用 MCP registry/binding 为主 |
| Vault/KMS broker | 凭证 broker 与轮换吊销链未闭环 |
