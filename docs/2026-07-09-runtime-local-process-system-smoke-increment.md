# 灵办词元 运行链路增量说明（2026-07-09）

## 1. 本次目标

补齐 `agent-workshop-backend / agent-workshop-run-worker / agent-workshop-sdk` 在 Windows 本地 `local-process` 模式下的系统级联调闭环，验证如下链路：

`API -> EmbeddedRunOrchestrator -> run-worker -> container-bridge -> fake codex runtime`

## 2. 本次修复清单

| 类别 | 文件 | 修复内容 | 工程意义 |
|---|---|---|---|
| Windows PTY 输入兼容 | `app/container-bridge/src/bridge/codex-session.ts` | 新增 `normalizePtyInput()`，在 Windows 下将写入 PTY 的换行规范化为 `\r` | 修复 Windows pseudo console 下仅回显、不提交输入的问题，保障 `initialPrompt / sendMessage / approve / cancel` 真正送达子进程 |
| 运行态退出语义 | `app/run-worker/src/services/bridge-runner.ts` | 新增 `waitForCompletionGracefully()`，`stop()` 时先等待 bridge 进程自然退出，再决定是否 `SIGTERM` | 保留成功运行的真实退出码，避免 terminal run 被 orchestrator 抢先终止，导致 `runtime.exitCode` 丢失 |
| 系统烟测稳定性 | `app/api/tests/runtime-local-process-system.smoke.test.mjs` | 修正 ready 断言时机；增强超时诊断；按平台选择 fake codex helper；校正取消态断言 | 让烟测与实际运行语义一致，并在失败时输出足够的状态证据 |
| Windows smoke helper | `app/api/tests/support/fake-codex-local-process.ps1` | 新增 PowerShell 版 fake codex helper | 在 Windows 下用控制台兼容方式验证 PTY 输入、文件生成、artifact 输出与退出路径 |

## 3. 验证结果

### 3.1 关键验证

| 验证项 | 结果 |
|---|---|
| `node --test tests/runtime-local-process-system.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `17/17` 全部通过 |

### 3.2 系统烟测覆盖点

| 维度 | 覆盖内容 |
|---|---|
| 运行启动 | API 创建 run，embedded orchestrator 拉起本地 bridge runtime |
| 运行元数据 | `launchMode / startedAt / readyAt / finishedAt / exitCode` 回写 |
| 对话链路 | `/v1/runs/:id/messages` 可将用户消息送达子进程 |
| 文件链路 | `targetPath` 内输出文件同步到 `files` 快照 |
| artifact 链路 | `outputsPath` 产物发布为 `artifact.ready` |
| 预览下载 | `files/preview` 与 `download-tickets` 可回源读取运行输出 |
| 取消路径 | `/cancel` 可将运行态切到 `CANCELLED` 并完成收尾 |

## 4. 当前结论

| 仓库 | 结论 |
|---|---|
| `agent-workshop-backend` | 本地 `local-process` 系统级主链已通过 smoke 验证 |
| `agent-workshop-run-worker` | bridge 启停与退出码保留语义得到修正 |
| `agent-workshop-sdk` | Windows PTY 输入兼容性显著提升，消息真正进入 runtime 子进程 |

## 5. 仍未完成项

| 类别 | 未完成内容 |
|---|---|
| Docker 真实链路 | 当前环境 Docker daemon 未启动，尚未验证真实容器模式 E2E |
| 生产调度 | BullMQ + Redis 多进程生产部署、失败重试、DLQ、恢复策略仍需继续建设 |
| 观测 | bridge 原始 transcript 与更细粒度 runtime 日志仍可继续增强 |
