# 灵办词元 Container Bridge Codex 恢复增量说明（2026-07-09）

## 1. 本次交付目标

补齐 `app/container-bridge` 在 `CodexSession` 层的进程内恢复能力，使 bridge 在 Codex CLI 异常退出后具备可验证的自动恢复、自愈重启、输入回放与恢复态诊断能力。

## 2. 本次实际交付

| 项目 | 交付内容 |
|---|---|
| 恢复配置 | `packages/config` 新增 `LINGBAN_BRIDGE_CODEX_RESTART_MAX_ATTEMPTS`、`LINGBAN_BRIDGE_CODEX_RESTART_BACKOFF_MS`、`LINGBAN_BRIDGE_CODEX_RESTART_RESET_WINDOW_MS` 的正式解析入口，并支持 `0` 值语义 |
| PTY 会话恢复 | `app/container-bridge/src/bridge/codex-session.ts` 已支持 Codex CLI 非零退出后的有界自动恢复、恢复状态消息、恢复预算控制与历史输入回放 |
| 恢复期输入处理 | bridge 在 `recovering=true` 期间继续接受 `sendMessage` 与 `approve`，先进入 replay buffer，恢复成功后自动回放到 PTY |
| 诊断字段 | `app/container-bridge/src/observability.ts` 已暴露 `recovering`、`restartBudgetUsed`、`restartAttemptsTotal`、`restartSuccessTotal`、`restartFailuresTotal`、`replayHistoryCount`、`replayHistoryBytes` 等字段 |
| 指标导出 | `/metrics` 已导出 `lingban_bridge_session_recovering`、`lingban_bridge_session_restart_attempts_total`、`lingban_bridge_session_restart_success_total`、`lingban_bridge_session_restart_failures_total`、`lingban_bridge_session_replay_history_entries` |
| CLI 接线 | `app/container-bridge/src/cli.ts` 与 `src/index.ts` 已将恢复配置下发到 `CodexSession` |

## 3. 新增验证

| 测试文件 | 覆盖点 |
|---|---|
| `app/container-bridge/tests/cli-recovery-forwarding.test.mjs` | CLI 自动恢复、恢复期控制命令、历史输入回放、恢复态 diagnostics、`0` 值恢复配置解析 |

## 4. 当前验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/config build` | 通过 |
| `pnpm -C app/container-bridge test` | 通过，`9/9` |

## 5. 仍未完成的能力

| 类别 | 当前缺口 |
|---|---|
| 持久化恢复 | 仅覆盖 bridge 进程存活期间的自愈；bridge 进程或容器重启后的会话恢复未落地 |
| 第三方治理 | BYO-MCP 白名单、探活、签名、网络策略联动与更深治理能力未完成 |
| 长会话治理 | 长会话 checkpoint、资源上限、历史压缩与更强资源回收策略未完成 |

## 6. 影响范围

- `packages/config/src/index.ts`
- `app/container-bridge/src/bridge/codex-session.ts`
- `app/container-bridge/src/observability.ts`
- `app/container-bridge/src/index.ts`
- `app/container-bridge/src/cli.ts`
- `app/container-bridge/tests/cli-recovery-forwarding.test.mjs`
