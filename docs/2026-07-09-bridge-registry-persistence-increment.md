# 2026-07-09 Bridge Registry 持久化增量说明

## 本次目标

将 `bridge registry` 从纯内存态推进到“内存控制面 + 持久化注册元数据”结构，解决以下生产级缺口：

1. API 重启后会丢失全部 bridge 注册信息。
2. 多实例或同进程重启验证场景无法复用已注册的 HTTP control metadata。
3. `bridge registry` 新增 `postgres` 分支后缺少强验证。

## 已落地内容

### 1. Bridge 注册持久化仓储

新增：

- `app/api/src/modules/bridge/repository.ts`
- `app/api/src/modules/bridge/storage-schema.ts`

支持两种实现：

1. `FileBackedBridgeRegistrationRepository`
2. `PostgresBridgeRegistrationRepository`

持久化对象：

- `runId`
- `bridgeId`
- `workspaceId`
- `targetPath`
- `connectedAt`
- `lastSeenAt`
- `control.baseUrl / control.authToken`
- `supportedCommands`

### 2. API 配置项

新增配置：

- `LINGBAN_BRIDGE_REGISTRY_STORE`

配置类型：

- `file`
- `postgres`

默认回退：

- 跟随辅助内部状态存储层，默认保持 `file`

### 3. PostgreSQL migration

新增 migration：

- `0012_bridge_registry`

新增表：

- `lingban_bridge_registrations`

字段：

- `run_id`
- `bridge_id`
- `workspace_id`
- `target_path`
- `connected_at`
- `last_seen_at`
- `bridge_json`

新增索引：

- `idx_lingban_bridge_registrations_last_seen_at`
- `idx_lingban_bridge_registrations_workspace_last_seen`

### 4. bridgeRegistry 内存 + 持久化双层结构

`app/api/src/modules/bridge/registry.ts` 现在具备：

1. 内存中的 controller / pending command / dispatch chain
2. 持久化的 bridge registration 元数据
3. `init({ forceReload })` 启动重载能力
4. `flushPersistence()` 持久化 drain 能力

当前行为：

- `register()`：更新内存并异步持久化
- `register` 路由：显式 `await flushPersistence()`，确保成功响应前已经落盘
- `unregister()`：清理内存并异步删除持久化记录
- `init(forceReload)`：清空内存态后从仓储重新装载
- 已持久化的 HTTP control metadata 会在 reload 后重建 `HttpBridgeController`

### 5. API 启动联动

`initializeBridgeInfrastructure()` 现在会：

1. 初始化 internal callback ledger
2. 根据当前环境重新构建 `bridge registration repository`
3. `bridgeRegistry.init({ forceReload: true })`

这一步解决了同进程测试里 file/postgres 仓储切换污染的问题，也让 API 每次启动都能按当前环境装载 bridge 状态。

### 6. 测试辅助修复

新增：

- `resetApiRuntimeConfigForTests()`

用途：

- 在 `postgres` 持久化 smoke 中重置缓存配置，确保当前环境变量能生效

同时扩展了 fake postgres：

- `lingban_bridge_registrations` 表
- `select / insert / delete` 支持

## 涉及文件

### 配置 / 环境

- `packages/config/src/index.ts`
- `.env.example`
- `app/api/.env.example`

### API

- `app/api/src/app/database.ts`
- `app/api/src/app/runtime.ts`
- `app/api/src/modules/bridge/repository.ts`
- `app/api/src/modules/bridge/storage-schema.ts`
- `app/api/src/modules/bridge/registry.ts`
- `app/api/src/modules/bridge/internal-callback-ledger.ts`
- `app/api/src/modules/bridge/routes.ts`

### 测试

- `app/api/tests/support/fake-postgres-pool.mjs`
- `app/api/tests/bridge-registry-http-controller.smoke.test.mjs`
- `app/api/tests/bridge-registry-persistence.smoke.test.mjs`
- `app/api/tests/bridge-registry-persistence-postgres.smoke.test.mjs`
- `app/api/tests/runtime-orchestrator.smoke.test.mjs`
- `app/api/tests/runtime-recovery-internal.smoke.test.mjs`

## 新增验证

### file-backed registry persistence

用例：

- `bridge registry reloads persisted HTTP registrations and can dispatch after reload`

验证点：

1. 注册元数据写入文件仓储
2. 新 registry 实例 `forceReload` 后成功恢复
3. 恢复后仍可通过 persisted control metadata 分发命令
4. 删除后 reload 不再可见

### postgres-backed registry persistence

用例：

- `bridge registry persists and reloads HTTP registrations through postgres-backed storage`

验证点：

1. migration 与 fake-postgres 表结构可用
2. `postgres` 仓储写入成功
3. 新 registry 实例 `forceReload` 后成功恢复
4. 恢复后仍可 dispatch 到 HTTP control
5. 删除后 reload 不再可见

## 验证结果

命令：

```bash
pnpm -C app/api test:smoke
```

结果：

- `22/22` 通过

其中新增通过用例：

1. `bridge registry reloads persisted HTTP registrations and can dispatch after reload`
2. `bridge registry persists and reloads HTTP registrations through postgres-backed storage`

## 当前收益

1. API 重启后可恢复 bridge 注册元数据。
2. HTTP control metadata 可以跨 registry reload 继续工作。
3. `file` 与 `postgres` 两条持久化路径都具备回归证据。
4. bridge registry 已从“瞬时进程态”推进到“可恢复内部状态”。

## 仍未完成的后续项

1. controller 仍然不是跨实例共享对象，当前共享的是 HTTP control metadata。
2. registry 持久化仍缺后台 stale sweep 作业。
3. bridge registry 尚未进入正式观测指标和审计面。
4. 多 API 实例下的注册竞争、抢占和版本戳控制尚未加入。
5. 真 Docker daemon 场景下的 API 重启 + bridge reload 端到端恢复仍待实机验证。
