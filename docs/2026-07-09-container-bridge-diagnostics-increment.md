# 2026-07-09 Container Bridge Diagnostics Increment

## 1. 目标

补齐 `app/container-bridge` 的生产级基础观测面，使容器内 Bridge 具备以下能力：

| 目标 | 结果 |
|---|---|
| 暴露运行态诊断 | 已新增 `/diagnostics` |
| 暴露 Prometheus 指标文本 | 已新增 `/metrics` |
| 记录控制命令执行统计 | 已在 `RunControlServer` 落地 |
| 记录 Codex 会话 / 文件同步 / artifact flush 状态 | 已在 session、watcher、publisher 落地 |
| 验证控制面鉴权与输出 | 已新增独立测试并通过 |

## 2. 变更范围

| 文件 | 变更 |
|---|---|
| `app/container-bridge/src/observability.ts` | 新增 bridge 运行诊断类型、计数器工具、Prometheus 指标构建器 |
| `app/container-bridge/src/bridge/codex-session.ts` | 新增会话状态、最近输出、最近消息/审批/取消/心跳、退出信息诊断 |
| `app/container-bridge/src/bridge/file-watcher.ts` | 新增同步次数、最近同步文件数、最近变更路径、最近同步错误诊断 |
| `app/container-bridge/src/bridge/artifact-publisher.ts` | 新增 flush 次数、累计发布数量、最近 artifact 路径、最近错误诊断 |
| `app/container-bridge/src/bridge/run-control-server.ts` | 新增控制命令计数、失败计数、最近命令与失败信息、聚合 `getDiagnostics()` |
| `app/container-bridge/src/transports/control-http.ts` | 新增 `/diagnostics`、`/metrics`、token 保护、请求路由统计、4xx/5xx 计数、动态端口 URL 解析 |
| `app/container-bridge/src/cli.ts` | 聚合 bridge runtime 诊断对象，记录注册/事件转发指标，并将诊断与指标提供给控制面 |
| `app/container-bridge/tests/control-http-observability.test.mjs` | 新增控制面鉴权、诊断与指标测试 |
| `app/container-bridge/package.json` | 将新测试纳入 `pnpm test` |

## 3. 新增控制面能力

### 3.1 诊断接口

`GET /diagnostics`

返回内容已覆盖：

| 维度 | 字段 |
|---|---|
| Bridge 基本上下文 | `bridgeId`、`runId`、`workspaceId`、`targetPath`、`runtimeDir`、`outputsPath` |
| 生命周期 | `startedAt`、`shuttingDown`、`shutdownAt`、`shutdownExitCode` |
| 注册与回传 | `lastRegistrationAt`、`lastRegistrationFailureAt`、`lastObservedEventAt`、`lastForwardedEventAt` |
| 指标聚合 | 注册成功/失败、事件观察/转发、终态失败上报、按事件类型统计 |
| Codex 会话 | running、status、cwd、args、最近 stdout、最近消息/审批/取消/心跳、退出信息 |
| 文件监听 | watchTargets、syncCount、lastSyncAt、lastChangedPath、lastSyncError* |
| Artifact 发布 | flushCount、publishedArtifactsTotal、lastPublishedArtifactPath、lastFlushError* |
| 控制面 | authRequired、requestsTotal、route 级请求/错误/未授权统计 |

### 3.2 指标接口

`GET /metrics`

当前已导出指标包括：

| 指标前缀 | 含义 |
|---|---|
| `lingban_bridge_runtime_*` | bridge runtime 是否存活、注册次数、事件转发、终态失败上报、event queue 等 |
| `lingban_bridge_session_*` | Codex session 运行态 |
| `lingban_bridge_file_*` | 文件同步与文件变更事件 |
| `lingban_bridge_artifact_*` | artifact flush 与发布计数 |
| `lingban_bridge_control_*` | 控制命令统计与控制面 HTTP 请求统计 |

### 3.3 鉴权行为

| 路径 | 鉴权策略 |
|---|---|
| `/health` | 不要求 token |
| `/control` | `x-lingban-control-token` |
| `/diagnostics` | `x-lingban-control-token` |
| `/metrics` | `x-lingban-control-token` |

## 4. 工程结果

| 项 | 结果 |
|---|---|
| 控制面从单一命令入口提升为基础运维面 | 已完成 |
| Bridge CLI 对 API 注册与事件回传主链保持兼容 | 已验证 |
| 下游 `run-worker` 依赖 `container-bridge` 的构建与测试未受破坏 | 已验证 |

## 5. 验证证据

本次实际执行并通过：

```bash
pnpm -C app/container-bridge build
pnpm -C app/container-bridge test
pnpm -C app/api build
pnpm -C app/run-worker test
```

结果：

| 命令 | 结果 |
|---|---|
| `pnpm -C app/container-bridge build` | 通过 |
| `pnpm -C app/container-bridge test` | `7/7` 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/run-worker test` | `12/12` 通过 |

## 6. 仍未闭环事项

| 事项 | 说明 |
|---|---|
| BYO-MCP 治理 | 第三方 MCP 白名单、签名、网络策略、探活未落地 |
| 自愈与恢复 | 会话恢复、Bridge 自愈、跨重启恢复未落地 |
| 租户级隔离验证 | 仍需与正式 Docker 运行与销毁闭环一起验证 |
| 平台级观测接线 | 指标已生成，Prometheus / OTel / 告警平台接入未落地 |
