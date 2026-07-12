# 灵办词元 运行时物料生成、MCP物化与Bridge控制执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 运行时物料生成、MCP物化与Bridge控制执行总表 |
| 适用范围 | `app/run-worker`、`app/container-bridge`、`app/api` embedded orchestrator、`infra/docker` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 workspace 准备、runtime 文件生成、bridge 本地拉起、MCP/secret 物化与控制命令链为准 |
| 直接证据 | `app/run-worker/src/services/workspace-preparer.ts`、`run-lifecycle.ts`、`container-runtime.ts`、`bridge-runner.ts`、`app/container-bridge/src/index.ts`、`bridge/secret-loader.ts`、`bridge/mcp-materializer.ts`、`bridge/remote-mcp-proxy-server.ts`、`bridge/run-control-server.ts`、`bridge/codex-session.ts` |
| 输出目标 | 把 runtime 物料生成、Host/Container 改写、secret 与 MCP 物化、bridge 启停与控制链细化为执行表格 |

## 2. 运行主链当前事实矩阵

| 环节 | 当前实现 | 当前结论 | 当前缺口 |
|---|---|---|---|
| Workspace 准备 | `prepareRunWorkspace()` | 单 run 目录骨架已成型 | 未接正式回收策略 |
| Host/Container context 改写 | `buildHostBridgeSessionContext()` / `buildContainerBridgeSessionContext()` | 文件 secret 与 file authRef 的视角改写已存在 | trace / job 元数据未进入 context |
| Runtime 物料生成 | `materializeRunRuntime()` | 7 个核心 runtime 文件可落盘 | 无版本迁移机制 |
| Launch Plan 生成 | `buildContainerLaunchPlan()` | Docker 命令预览已可生成 | 未真正执行 docker |
| Bridge 本地拉起 | `startLocalBridgeProcess()` | 可用本地 Node 子进程模拟容器内 bridge | 非正式容器态 |
| Bridge 启动链 | `buildContainerBridge().start()` | 先启动 remote MCP proxy，再并行执行 secret + MCP 物化，随后启动 watcher 和 Codex | 无跨进程恢复与幂等 |

## 3. Workspace 准备执行矩阵

| 步骤 | 执行函数 | 输入 | 动作 | 输出 |
|---|---|---|---|---|
| 1 | `resolveWorkerRunsRoot()` | `LINGBAN_RUNS_DIR` 或默认值 | 解析 runs 根目录 | Worker runs 根路径 |
| 2 | `prepareRunWorkspace()` | `runId/workspaceId/targetPath` | 生成 `runRootPath` 与所有 host 子目录 | `hostPaths` |
| 3 | `buildContainerPaths()` | 常量 `/workspace` | 生成容器内统一路径结构 | `containerPaths` |
| 4 | `fs.mkdir(..., { recursive: true })` | 所有 host 子目录 | 批量创建目录 | 本地 run 工作区 |
| 5 | `preparedRunWorkspaceSchema.parse()` | `runId/workspaceId/hostPaths/containerPaths` | 校验结构 | `PreparedRunWorkspace` |

## 4. Host / Container 改写执行矩阵

| 对象 | Host 模式行为 | Container 模式行为 | 代码位置 |
|---|---|---|---|
| `targetPath` | 使用 `hostPaths.targetPath` | 使用 `containerPaths.targetPath` | `run-lifecycle.ts` |
| `CredentialMount.mode = env` | 直接透传 | 直接透传 | `run-lifecycle.ts` |
| `CredentialMount.mode = file` | 把容器 secrets 路径映射回宿主 secrets 路径 | 保留 posix 路径 | `rewriteCredentialMount()` |
| `McpBinding.authRef` 且 `authMode=file` | 改写为宿主路径 | 保留容器 posix 路径 | `rewriteMcpBinding()` |

## 5. Runtime 文件生成矩阵

| 文件 | 生成位置 | 当前作用 |
|---|---|---|
| `runtime-config.json` | Worker runtime 目录 | 运行时总配置入口 |
| `bridge-context.host.json` | Worker runtime 目录 | 本地 bridge 子进程读取的 host 视角 context |
| `bridge-context.container.json` | Worker runtime 目录 | 容器内 bridge 应读取的 container 视角 context |
| `mcp-config.json` | Worker runtime 目录 | 物化后的 MCP server 定义 |
| `mcp-bindings.json` | Worker runtime 目录 | MCP binding 元信息快照 |
| `secret-manifest.json` | Worker runtime 目录 | env/file 型 secret 物化清单 |
| `container-launch-plan.json` | Worker runtime 目录 | Docker 启动计划与命令预览 |

## 6. Runtime 环境变量生成矩阵

| 变量 | 当前来源 | 当前语义 |
|---|---|---|
| `HOME` | `containerPaths.homePath` | 容器用户 HOME |
| `CODEX_HOME` | `containerPaths.codexHomePath` | Codex HOME |
| `TMPDIR` | `containerPaths.tmpPath` | 临时目录 |
| `TARGET_PATH` | `containerPaths.targetPath` | 运行目标目录 |
| `PLAYWRIGHT_BROWSERS_PATH` | `LINGBAN_PLAYWRIGHT_BROWSERS_PATH` 或 `/ms-playwright` | Playwright 浏览器路径 |
| `RUN_ID` | `payload.run.runId` | 运行标识 |
| `WORKSPACE_ID` | `payload.run.workspaceId` | 工作区标识 |
| `MCP_CONFIG_PATH` | `runtimePath/mcp-config.json` 的容器路径 | MCP 配置入口 |
| `BRIDGE_CONTEXT_PATH` | `runtimePath/bridge-context.container.json` 的容器路径 | bridge context 入口 |
| `RUNTIME_CONFIG_PATH` | `runtimePath/runtime-config.json` 的容器路径 | runtime 配置入口 |
| `BRIDGE_PORT` | `LINGBAN_BRIDGE_PORT` 或 `3800` | bridge 控制端口 |

## 7. Secret 物化执行矩阵

| 场景 | 当前行为 | 代码位置 | 当前风险 |
|---|---|---|---|
| env 型 secret 且显式传入 `secretValues` | 写入 `env[envName] = value` | `SecretLoader.materialize()` | 缺审计 |
| env 型 secret 未显式传入 | 从 `process.env[envName]` 继承 | 同上 | 容易依赖宿主环境隐式状态 |
| file 型 secret 且显式传入 | `mkdir` 后直接写文件 | 同上 | 无权限收口、无清理 |
| file 型 secret 未显式传入 | 校验文件已存在后复用 | 同上 | 依赖外部预置文件 |
| 缺失 secret | 直接抛错 | 同上 | 当前失败语义为通用 `Error` |

## 8. MCP 物化执行矩阵

| 场景 | 当前规则 | 结果 |
|---|---|---|
| `transport = stdio` 且 `ref` 为 js/mjs/cjs | 包装成 `command=node args=[ref]` | `local-process` |
| `transport = stdio` 且 `ref` 非 js | 直接 `command=ref` | `local-process` |
| 非 `stdio` 且 `source = third-party` | 写成 `remote-unmanaged` | 第三方远程 MCP |
| 非 `stdio` 且 `source != third-party` | 写成 `remote-managed` | 平台或工作区可治理 MCP |
| 远程 `http/sse/websocket` MCP | 改写为 bridge 本地 `http://127.0.0.1:<port>/mcp-proxy/<bindingId>` 或 `ws://127.0.0.1:<port>/mcp-proxy/<bindingId>` | 运行时 remote MCP 请求统一经本地 proxy 与 policy 二次校验 |
| `authMode = env` | 写 `auth_env` | MCP 通过环境变量认证 |
| `authMode = file` | 写 `auth_file` | MCP 通过文件路径认证 |

## 9. `ContainerLaunchPlan` 生成矩阵

| 项 | 当前行为 |
|---|---|
| 镜像 | `LINGBAN_RUNNER_IMAGE` 或 `ghcr.io/lingban/runner:latest` |
| 容器名 | `lingban-run-<runId>` |
| Entrypoint | `node /opt/lingban/container-bridge/dist/cli.js` |
| 工作目录 | `containerPaths.targetPath` |
| 网络 | `LINGBAN_RUNNER_NETWORK` 或 `lingban-egress-default` |
| 资源 | `cpus=2`、`memory=4g`、`pidsLimit=512` 可被 env 覆盖 |
| 标签 | `lingban.run_id/workspace_id/task_version_id/session_version_id` |
| 挂载 | `target/inputs/outputs/state/runtime/codex-home/home/tmp/browser-profile/mcp/secrets/logs` |
| 输出 | `commandPreview` 生成 Docker `create` 预览；Worker 已在 `bridge-runner.ts` 执行真实 `create/start/inspect/stop/rm` 主链 |

## 10. 本地 Bridge 子进程执行矩阵

| 步骤 | 当前行为 | 输出 |
|---|---|---|
| 控制端口分配 | `allocatePort()` 在 `127.0.0.1` 随机端口监听 | `controlUrl` |
| CLI 定位 | 优先 `LINGBAN_CONTAINER_BRIDGE_CLI`，否则走相对 `dist/cli.js` | bridge CLI 路径 |
| 日志文件 | `logs/bridge.stdout.log`、`logs/bridge.stderr.log` | 原始桥接日志 |
| 子进程环境 | 注入 `BRIDGE_CONTEXT_PATH`、`RUNTIME_CONFIG_PATH`、`OUTPUTS_PATH`、`RUNTIME_DIR`、控制端口、API baseUrl、可选 `CODEX_BIN/CODEX_ARGS_JSON` | 本地 bridge 启动环境 |
| 健康探针 | `waitForHealth()` 轮询 `/health` | bridge ready |
| 停止动作 | `SIGTERM` + 等待退出 | 本地进程回收 |

## 11. Container Bridge 启动执行矩阵

| 阶段 | 当前行为 | 代码位置 |
|---|---|---|
| context 解析 | 有显式 context 就 parse；否则从环境变量 bootstrap | `resolveContext()` |
| workspaceRoot 推导 | 默认 `dirname(targetPath)` | `buildContainerBridge()` |
| watcher 初始化 | 监听 `targetPath` 与可选 `outputsPath` | `FileWatcher` |
| artifact publisher 初始化 | 指向 `outputsPath` | `ArtifactPublisher` |
| codex session 初始化 | 设定 command、args、cwd、基础 env | `CodexSession` |
| control server 初始化 | 绑定 `session/fileWatcher/artifactPublisher` | `RunControlServer` |
| start 阶段 | 先 `remoteMcpProxyServer.start()`，再并行 `McpMaterializer.materialize()` 与 `SecretLoader.materialize()`，随后 `setRuntimeEnv`、`fileWatcher.start()`、`codexSession.start()` | `start()` |

## 12. Bridge 控制命令执行矩阵

| 命令 | 当前动作 | 返回 |
|---|---|---|
| `sendMessage` | 写入 Codex PTY | `{ ok: true, command: "sendMessage" }` |
| `approve` | 写入审批文案到 PTY | `{ ok: true, command: "approve" }` |
| `cancel` | 杀掉 PTY，推送 `CANCELLED` | `{ ok: true, command: "cancel" }` |
| `ping` | 生成 heartbeat 事件并 emit | `{ ok: true, event }` |
| `syncFiles` | 扫描 target path 并 emit `files.synced` | `{ ok: true, files }` |
| `flushArtifacts` | 扫描 outputs 生成 `artifact.ready` | `{ ok: true, artifacts }` |

## 13. Codex PTY 会话执行矩阵

| 阶段 | 当前行为 |
|---|---|
| 启动前 | 先 emit `run.status.changed -> STARTING` |
| spawn | 用 `node-pty` 启动 `command + args` |
| 建连后 | 立即 emit `RUNNING` |
| 首次输入 | 先写 `initialPrompt`，再写 `requestedInitialMessage` |
| 发送消息 | 文本 + 附件清单拼成多行字符串 |
| 审批输入 | 生成英文批准/拒绝说明文本写入 |
| 退出 | exitCode=0 -> `SUCCEEDED`；非 0 -> `FAILED` |
| 取消 | 先杀 PTY，再 emit `CANCELLED` |

## 14. 当前结构性缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| Docker daemon 实机联调未完成 | 代码已执行 `create/start/inspect/stop/rm`，但当前机器未完成真容器联调 | 正式隔离执行仍缺现场证据 | P0 |
| 本地 bridge 代替容器内 bridge | 当前运行仍偏本地模拟 | 线上行为与正式容器态存在偏差 | P0 |
| secret 物化无清理与审计 | 文件写入后无统一回收策略 | 安全与合规风险 | P0 |
| context 不含 trace/job 元信息 | bridge 与 worker 排障链不完整 | 故障定位成本高 | P1 |
| control 命令无鉴权 | 当前只要拿到 control URL 即可控制 | 不适合生产 | P1 |
| 运行文件版本缺失 | `schemaVersion` 只有 runtimeConfig，其他文件无版本 | 兼容升级困难 | P1 |

## 15. 正式收敛建议矩阵

| 方向 | 建议 |
|---|---|
| 容器执行闭环 | 已在 Worker 中补 docker create/start/inspect/stop/rm 真执行层，下一步补 daemon 现场联调与 metadata 持久化 |
| runtime 元数据补齐 | 把 `trace_id/job_id/bridge_id/runtime_version` 带入所有 runtime 文件 |
| secret 治理 | secret 文件写入后做权限收缩、到期清理、审计记录 |
| 控制面安全 | `controlUrl` 改为容器内本地接口 + API 侧签名转发 |
| 物料版本化 | 所有 runtime 文件都带 `schemaVersion` 与生成时间 |

## 16. 当前已验证运行时物料基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| Workspace 准备 | 已创建 `runRoot/inputs/outputs/state/runtime/codex-home/home/tmp/browser-profile/mcp/secrets/logs` | `app/run-worker/src/services/workspace-preparer.ts` |
| 双视角 bridge context | 已生成 host/container 两份上下文，并改写 file mount/authRef 与 `stdio ref` | `app/run-worker/src/services/run-lifecycle.ts` |
| Runtime 文件集合 | 已落盘 `runtime-config.json`、`bridge-context.host.json`、`bridge-context.container.json`、`mcp-config.json`、`mcp-bindings.json`、`secret-manifest.json`、`container-launch-plan.json` | `app/run-worker/src/services/container-runtime.ts` |
| MCP 物化 | 已按 `stdio`/远程、`third-party`/非第三方生成 `local-process`、`remote-managed`、`remote-unmanaged`，并在 worker/bridge 双侧执行非第一方 `stdio` path-prefix allowlist 校验 | `app/run-worker/src/services/container-runtime.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts` |
| Remote MCP proxy | 已把远程 `http/sse/websocket` MCP 改写到 bridge 本地 proxy，并在每次 HTTP 请求、SSE 流与 websocket upgrade 时按 `networkPolicyRef` 二次校验目标 URL | `app/container-bridge/src/bridge/remote-mcp-proxy-server.ts`、`app/container-bridge/src/index.ts`、`app/container-bridge/tests/remote-mcp-proxy-server.test.mjs` |
| Runtime egress proxy hook | worker 已可按 `runtimeApiBaseUrl`、显式 allowlist 与 materialized `mcpNetworkPolicies` 启动本地 HTTP/HTTPS/CONNECT egress proxy，向 local-process / Docker runtime 注入 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY`，在 Docker launch plan 中自动补齐 `host.docker.internal:host-gateway`、`NET_ADMIN` 与 `egressFirewall`，runner entrypoint 会在容器内应用 `iptables/ip6tables` 规则，并把 proxy / firewall 诊断透传到 worker 运行态观测 | `app/run-worker/src/services/egress-proxy.ts`、`app/run-worker/src/services/egress-firewall.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/run-worker/src/daemon.ts`、`app/run-worker/src/observability.ts`、`app/run-worker/tests/egress-proxy.test.mjs`、`app/run-worker/tests/bridge-runner.test.mjs`、`app/run-worker/tests/ops-http.test.mjs`、`app/container-bridge/tests/runtime-egress-firewall.test.mjs` |
| stdio allowlist | 已在 API、worker、bridge 三侧执行 path-prefix allowlist，并在 local-process 模式下把容器路径前缀改写成 host 前缀注入 bridge 环境；当 `stdioPolicy.refSha256` 存在时，bridge 还会在物化前校验目标文件摘要 | `app/api/src/modules/mcp/service.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts`、`app/container-bridge/tests/mcp-materializer.test.mjs` |
| Secret 物化 | 已支持显式 secretValues 与宿主环境继承 | `app/container-bridge/src/bridge/secret-loader.ts` |
| 本地 bridge 控制面 | 已有 `/health` 与 `/control`，支持 `sendMessage/approve/cancel/ping/syncFiles/flushArtifacts` | `app/container-bridge/src/transports/control-http.ts`、`app/container-bridge/src/bridge/run-control-server.ts` |
| 本地 bridge 启动 | worker 当前通过 `startLocalBridgeProcess()` 拉起本地 Node 子进程并轮询健康检查 | `app/run-worker/src/services/bridge-runner.ts` |

## 17. 当前不可宣称完成的运行时能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| 真容器执行联调 | 未完成 | 当前已有 `container-launch-plan.json`、`commandPreview` 与 Docker 生命周期代码，但缺 daemon 现场验收 |
| stdio 执行用户与目录权限收缩 | 未完成 | 已有 path-prefix allowlist 与 `stdioPolicy.refSha256` 摘要校验，但执行用户、最小目录权限与签名来源审计仍未闭环 |
| control 鉴权 | 部分实现 | `/control` 已有 token 校验；mTLS、签名链与更强来源证明未闭环 |
| secret 清理与权限收缩 | 未实现 | 当前写入后不回收、不 chmod、不审计 |
| runtime trace 元数据 | 未实现 | `runtimeConfig` 只有 `schemaVersion=1`，无 trace/job/bridge id |
| restart/recovery | 部分实现 | 进程内自动恢复、历史输入回放与 detached command replay 已落地；bridge 进程级跨重启恢复与持久化 checkpoint 未闭环 |
| 物料兼容迁移 | 未完成 | 只有部分 schema 带版本概念，其他文件没有迁移协议 |

## 18. 最短收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 落地 docker 真执行与容器健康控制 | launch plan 从预览变为真实执行 |
| Phase 2 | 为 control、secret、runtime metadata 补安全与追踪字段 | 运行面可治理、可排障 |
| Phase 3 | 为 restart/retry/cleanup 补状态机 | 运行时稳定性成型 |
| Phase 4 | 统一所有 runtime 文件 schema/version 策略 | 运行物料可演进 |
