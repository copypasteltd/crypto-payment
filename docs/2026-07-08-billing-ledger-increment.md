# 2026-07-08 Billing Ledger Increment

## 本轮目标

补齐后端 billing ledger 的基础可交付能力，覆盖以下范围：

| 项目 | 目标 |
|---|---|
| 存储层 | 让 PostgreSQL billing repository 支持增量写入，不再按整表重写作为主路径 |
| 测试桩 | 让 fake postgres pool 支持 `lingban_billing_entries` 相关查询 |
| API SDK | 对外暴露 billing entries / summary 客户端 |
| 后端验证 | 增加 billing ledger smoke，覆盖执行点记账、汇总、Creator cost 联动 |
| 前端接线 | 让 dashboard / mobile 均可直接拿到 billing client |

## 已完成项

### 1. PostgreSQL billing repository 改为主路径增量 upsert

文件：

- [app/api/src/modules/billing/repository.ts](C:/dev/copypaste/agent-workshop/app/api/src/modules/billing/repository.ts)

完成内容：

- `CachedBillingRepository` 暴露了受控的 cache 更新能力。
- `PostgresBillingRepository.saveEntry(...)` 改为单条 `INSERT ... ON CONFLICT DO UPDATE`。
- billing 主写路径不再依赖每次 `DELETE + 全量 INSERT`。

工程意义：

- 降低写放大。
- 降低并发记账时的整表冲突概率。
- 更符合后续账目持续增长后的生产运行特征。

### 2. fake postgres pool 补齐 billing 表行为

文件：

- [app/api/tests/support/fake-postgres-pool.mjs](C:/dev/copypaste/agent-workshop/app/api/tests/support/fake-postgres-pool.mjs)

完成内容：

- 新增 `lingban_billing_entries` 内存表。
- 支持 billing entry 列表查询。
- 支持 billing entry 删除。
- 支持 billing entry 插入 / upsert。

直接结果：

- `file-chain-postgres.smoke` 已恢复通过。

### 3. API SDK 暴露 billing client

文件：

- [packages/api-sdk/src/index.ts](C:/dev/copypaste/agent-workshop/packages/api-sdk/src/index.ts)
- [packages/api-sdk/tests/billing-client.test.mjs](C:/dev/copypaste/agent-workshop/packages/api-sdk/tests/billing-client.test.mjs)

完成内容：

- 新增 `createBillingApiClient(...)`
- 新增 `BillingApiClient` 类型导出
- 支持：
  - `listEntries(query)`
  - `getSummary(query)`

### 4. Dashboard / Mobile 接入 billing client

文件：

- [app/dashboard/src/lib/api.ts](C:/dev/copypaste/agent-workshop/app/dashboard/src/lib/api.ts)
- [app/mobile/src/lib/api.ts](C:/dev/copypaste/agent-workshop/app/mobile/src/lib/api.ts)

完成内容：

- `dashboardBillingApi`
- `mobileBillingApi`

当前状态：

- 已完成 API 层接线。
- UI 展示层尚未在本轮展开。

### 5. 新增 billing ledger smoke

文件：

- [app/api/tests/billing-ledger.smoke.test.mjs](C:/dev/copypaste/agent-workshop/app/api/tests/billing-ledger.smoke.test.mjs)
- [app/api/package.json](C:/dev/copypaste/agent-workshop/app/api/package.json)

覆盖内容：

| 覆盖项 | 是否覆盖 |
|---|---|
| run upload 记账 | 是 |
| run message 记账 | 是 |
| file preview 记账 | 是 |
| file read 记账 | 是 |
| direct file download 记账 | 是 |
| download ticket 记账 | 是 |
| audit export 记账 | 是 |
| runtime estimate 记账 | 是 |
| billing summary 汇总 | 是 |
| Creator cost 账目联动 | 是 |

## 本轮验证结果

### 构建与测试

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/api-sdk test:smoke` | 通过 |
| `pnpm -C app/api typecheck` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`16/16` |
| `pnpm -C app/dashboard build` | 通过 |
| `pnpm -C app/mobile exec tsc --noEmit` | 通过 |

### 关键回归点

| 回归点 | 结果 |
|---|---|
| 之前失败的 `file-chain-postgres.smoke` | 已转绿 |
| 新增 `billing-ledger.smoke` | 已通过 |
| 现有 quota execution smoke | 已通过 |
| Creator release/replay smoke | 已通过 |

## 当前阶段结论

本轮完成后，billing ledger 已具备以下交付条件：

1. 后端接口可用。
2. PostgreSQL / file 两条存储路径都可运行。
3. fake postgres 测试桩已跟上。
4. SDK 已可供 dashboard / mobile 调用。
5. 执行点记账、汇总、Creator cost 投影均有 smoke 覆盖。

## 后续未展开项

| 模块 | 后续工作 |
|---|---|
| Dashboard | billing 页面、账目筛选、metric drill-down、creator cost 细化展示 |
| Mobile | billing 轻量视图、任务账单摘要、Creator 端账目入口策略 |
| Backend | 实际成本回写模型、账期聚合、导出、账单对账、租户级成本告警 |
| Ops | metrics、告警、审计查询、冷数据归档策略 |
