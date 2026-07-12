# 2026-07-09 Bridge 心跳时效与过期剔除增量说明

## 本次目标

补齐 `bridge registry` 的活跃性判断，解决以下生产级缺口：

1. bridge 注册只记录“注册过”，不判断注册是否已经过期。
2. worker / API 恢复链路可能将失活 bridge 误判为活跃，导致 orphan run 不被正确失败回写。
3. 在 bridge 尚未完成注册之前下发的控制命令会进入 pending 队列，但 HTTP 注册到达后不会自动冲刷。
4. `container-bridge` 单仓构建不会先编译共享契约包，可能读取到过期类型产物。

## 已落地内容

### 1. BridgeRegistration 心跳字段

新增契约字段：

- `BridgeRegistration.lastSeenAt?: string`

语义：

- `bridgeId`: 单个 bridge 进程的稳定标识
- `connectedAt`: 本次 bridge 进程首次建立注册时刻
- `lastSeenAt`: 周期性刷新心跳时刻

### 2. container-bridge 注册刷新改造

`app/container-bridge/src/cli.ts` 已改为：

1. bridge 进程启动时生成稳定 `bridgeId`
2. 记录稳定 `connectedAt`
3. 每次 refresh register 时仅刷新 `lastSeenAt`

这样 API 侧可以区分“连接建立时间”和“最近心跳时间”。

### 3. bridge registry 过期判定

`app/api/src/modules/bridge/registry.ts` 新增：

- 可配置 `staleAfterMs`
- `lastSeenAt` 优先于 `connectedAt` 参与时效判断
- `get()` / `dispatch()` 之前先执行 stale eviction
- 过期后移除 connection 与 controller

新增配置：

- `LINGBAN_BRIDGE_REGISTRATION_STALE_AFTER_MS`
- 默认值：`20000`

### 4. pending command 冲刷

修复行为：

- 之前：命令在 bridge 注册前进入 pending queue，HTTP registration 到达后不会自动转发
- 现在：`register()` 与 `attachController()` 共用冲刷逻辑，注册成功后立即顺序转发 pending commands

这一步直接修复了“late register 后用户消息悬挂不发”的生产隐患。

### 5. 恢复链路联动

`runsService.listRuntimeRecoveryCandidates()` 现已消费时效化后的 registry 结果：

- 活跃且未过期的 bridge -> `await-bridge`
- 注册已过期的 bridge -> 视为不存在，进入 `mark-orphan-failed`

恢复视图中的 bridge 状态新增：

- `connectedAt`
- `lastSeenAt`

### 6. 单仓构建修复

`app/container-bridge/package.json` 的 `build` 脚本已改为先构建：

- `@lingban/config`
- `@lingban/contracts`

解决单独在该仓库运行 `pnpm test` 时拿到旧版共享类型的问题。

## 涉及文件

### 契约 / 配置

- `packages/contracts/src/bridge.ts`
- `packages/config/src/index.ts`

### API

- `app/api/src/modules/bridge/registry.ts`
- `app/api/src/modules/runs/service.ts`
- `app/api/tests/bridge-registry-http-controller.smoke.test.mjs`
- `app/api/tests/runtime-recovery-internal.smoke.test.mjs`
- `app/api/.env.example`

### Bridge

- `app/container-bridge/src/cli.ts`
- `app/container-bridge/package.json`

### 根配置

- `.env.example`

## 新增验证

### bridge registry smoke

新增覆盖：

1. HTTP control metadata 正常转发
2. pending command 在 late register 后自动冲刷
3. 基于 `lastSeenAt` 的 stale eviction

### recovery internal smoke

新增覆盖：

1. `enqueue-start`
2. `await-bridge`
3. `mark-orphan-failed`
4. stale bridge 被识别为 orphan

### container-bridge

新增验证：

1. 共享契约预编译后单仓测试可独立通过
2. 注册刷新改造未破坏 `register/status/events/artifacts` 转发主链

## 验证结果

### container-bridge

```bash
pnpm -C app/container-bridge test
```

结果：

- `6/6` 通过

### run-worker

```bash
pnpm -C app/run-worker test
```

结果：

- `12/12` 通过

### api smoke

```bash
pnpm -C app/api test:smoke
```

结果：

- `20/20` 通过

## 当前收益

1. bridge 活跃性判定从“是否注册过”提升到“是否仍然在有效心跳窗口内”。
2. worker / API 恢复链路不再被过期注册误导。
3. 注册前积压的控制命令会在 bridge HTTP 注册完成后立即发出。
4. `container-bridge` 的单仓构建与测试路径更加可靠。

## 仍未完成的后续项

1. bridge registry 仍然是内存态，API 重启后不会保留心跳历史。
2. 过期剔除目前只在访问路径上触发，尚未增加后台清扫任务。
3. stale / heartbeat 指标尚未进入正式观测面。
4. bridge 自愈与自动重连策略尚未建立。
5. 多 API 实例下的共享 bridge 注册表尚未落到正式存储或分布式协调层。
