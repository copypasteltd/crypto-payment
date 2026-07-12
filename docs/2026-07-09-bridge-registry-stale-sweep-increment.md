# 2026-07-09 Bridge Registry Stale Sweep Increment

## 本次增量目标

补齐 `bridge registry` 的陈旧注册清理闭环，解决以下问题：

| 问题 | 影响 |
|---|---|
| 陈旧 `bridge registration` 仅从内存移除，未同步删除持久层记录 | API 重启后可能重新加载已失效 bridge，导致恢复判断偏差 |
| 无后台周期性清理 | 长时间运行时，陈旧注册会在 file/postgres 持久层中累积 |
| API 关闭时未显式等待 registry 持久化链完成 | 进程退出时存在未刷盘风险 |

## 变更清单

### 1. Registry 生命周期补全

文件：`app/api/src/modules/bridge/registry.ts`

| 变更 | 说明 |
|---|---|
| 新增 `sweepIntervalMs` 配置项 | 支持 registry 后台清理周期配置 |
| 新增 `startSweeper()` / `stopSweeper()` | 为 API 进程提供显式启动与关闭控制 |
| 新增 `sweepExpired()` | 周期扫描并持久化删除陈旧 bridge 注册 |
| 增强 `#evictStaleRegistration()` | 支持 `persist: true`，在内存删除同时排队执行 repository delete |
| 增强 `init()` | reload 期间发现陈旧注册时，会在初始化阶段直接清理持久层残留 |
| 增强 `clearPersistedState()` | 先停止 sweeper，避免测试和清理阶段的后台竞争 |

### 2. API 进程接入 sweeper 生命周期

文件：`app/api/src/app/create-server.ts`

| 变更 | 说明 |
|---|---|
| API 启动后调用 `bridgeRegistry.startSweeper()` | 让后台清理与服务生命周期绑定 |
| `onClose` 中先 `stopSweeper()` 再 `flushPersistence()` | 避免未完成的删除/写入在进程关闭时丢失 |

### 3. 配置样例补全

文件：

- `app/api/.env.example`
- `.env.example`

新增：

```dotenv
LINGBAN_BRIDGE_REGISTRATION_SWEEP_INTERVAL_MS=5000
```

## 测试补强

文件：`app/api/tests/bridge-registry-persistence.smoke.test.mjs`

新增两条 smoke：

| 用例 | 验证点 |
|---|---|
| `bridge registry persists stale eviction triggered by lookup` | `get()` 触发的陈旧淘汰会落到持久层，重载后不会复活 |
| `bridge registry background sweeper removes stale persisted registrations` | 后台 sweeper 会定期清理陈旧注册，并同步删除 file-backed 持久层记录 |

## 当前验证结果

| 验证命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api test:smoke` | `24/24` 通过 |
| `pnpm -C app/container-bridge test` | `6/6` 通过 |
| `pnpm -C app/run-worker test` | `12/12` 通过 |

## 本次增量关闭的风险

| 风险 | 当前状态 |
|---|---|
| 陈旧 bridge 注册在 file/postgres 中残留 | 已关闭 |
| API 重启后误判 stale bridge 为 active bridge | 已关闭 |
| 关闭进程时 registry 删除未落盘 | 已显式补齐 |

## 仍未覆盖的后续项

| 项 | 说明 |
|---|---|
| bridge registry 观测指标 | 尚未输出 stale sweep 次数、删除量、失败量 |
| 持久层删除失败告警 | 当前仅保证链路执行，未接入 metrics / alerts |
| 多实例共享 registry 的跨节点一致性策略 | 当前仍以单 API 实例运行前提为主 |
