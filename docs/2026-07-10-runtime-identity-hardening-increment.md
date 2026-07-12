# 灵办词元 2026-07-10 Runtime Identity Hardening 增量

## 1. 目标

补齐运行隔离链里最直接的生产缺口：让 Docker runtime 中的 bridge / Codex 进程默认以非 root 身份运行，并同步收紧 runtime 目录与 secret 文件权限。

## 2. 本次落地范围

| 模块 | 变更 |
|---|---|
| `packages/config` | 新增 `LINGBAN_RUNNER_DROP_ROOT_ENABLED`、`LINGBAN_RUNNER_UID`、`LINGBAN_RUNNER_GID` 解析 |
| `app/run-worker` | `container-runtime.ts` 新增 runtime user 解析与 Docker launch plan 编排；`bridge-runner.ts` 新增 `LINGBAN_RUNTIME_UMASK`、entrypoint 降权变量注入与 secret 文件 `0600` 落盘 |
| `app/run-worker` | `workspace-preparer.ts` 对 runRoot 下敏感目录执行权限收紧 |
| `app/container-bridge` | `cli.ts` 新增 `LINGBAN_RUNTIME_UMASK` 应用逻辑 |
| `infra/docker` | runner image 新增 `util-linux`；entrypoint 新增 `setpriv` 降权链 |

## 3. 运行时身份策略

| 场景 | 处理方式 |
|---|---|
| Docker runtime，且无 root-only 初始化需求 | `docker create` 直接追加 `--user uid:gid`，bridge / Codex 从主进程开始即以非 root 运行 |
| Docker runtime，且启用 container egress firewall | entrypoint 先以 root 执行 `iptables/ip6tables` 初始化，再通过 `setpriv --reuid/--regid --clear-groups` 降权 |
| local-process runtime | 当前仍运行在 host worker 身份下；本轮仅补齐 `umask=077` 和目录/secret 权限收口 |

## 4. 权限收口

| 对象 | 权限策略 |
|---|---|
| `runRoot/inputs/outputs/state/runtime/codex-home/home/tmp/browser-profile/mcp/secrets/logs` | `prepareRunWorkspace()` 创建后尝试收紧到 `0700` |
| file-mode secret mount | `materializeRuntimeSecrets()` 写入后强制 `0600` |
| bridge / Codex 进程默认文件掩码 | `LINGBAN_RUNTIME_UMASK=077`，由 bridge CLI 启动时调用 `process.umask()` 应用 |

## 5. 配置面

| 变量 | 含义 |
|---|---|
| `LINGBAN_RUNNER_DROP_ROOT_ENABLED` | 控制 Docker runtime 是否启用非 root 执行链 |
| `LINGBAN_RUNNER_UID` / `LINGBAN_RUNNER_GID` | 显式指定 Docker runtime 降权使用的 UID/GID；未设置时优先回落当前 worker 进程身份 |
| `LINGBAN_RUNTIME_DROP_ROOT` | 运行时注入，指示 entrypoint 在 root-only 初始化后执行降权 |
| `LINGBAN_RUNTIME_EXEC_UID` / `LINGBAN_RUNTIME_EXEC_GID` | 运行时注入，指定 entrypoint 降权目标身份 |
| `LINGBAN_RUNTIME_UMASK` | 运行时注入，默认 `077` |

## 6. 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm -C app/run-worker test` | `26/26` 通过 |
| `pnpm -C app/container-bridge test` | `22/22` 通过 |
| `pnpm build:backend` | 通过 |

## 7. 当前仍未闭环的点

| 项 | 状态 |
|---|---|
| local-process 模式的更细粒度用户隔离 | 未完成 |
| 真实 Docker daemon 现场验收 | 未完成 |
| bridge 进程级跨重启恢复 | 未完成 |
| 跨节点补偿与正式多节点调度 | 未完成 |
