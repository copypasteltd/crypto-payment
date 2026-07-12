# 灵办词元 Quota Governance 写链路落地与验证记录

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Quota Governance 写链路落地与验证记录 |
| 日期 | 2026-07-08 |
| 适用范围 | `packages/contracts`、`packages/domain-models`、`packages/api-sdk`、`app/api`、`app/dashboard`、`app/mobile` |
| 目的 | 记录本轮 quota / 成本治理正式写链路、Dashboard 接线、测试覆盖与验证结果 |

## 2. 本轮已完成能力

| 层级 | 已完成项 | 说明 |
|---|---|---|
| Contracts | quota policy / counter / event / override / preview 正式契约 | 新增 quota schema、query schema、mutation schema，并扩展 `RunApproval` 的 `kind` / `relatedResourceRef` |
| Domain Models | quota 窗口计算、阈值判定、决策优先级 | 新增 `resolveQuotaWindowRange()`、`evaluateQuotaPolicyValue()`、`quotaDecisionSeverity()` |
| API | quota 正式域、文件/PG repository、迁移、route、service | 落地 `/v1/quotas/policies|counters|events|overrides` 与 override approve/reject |
| Run 主链 | 创建前 quota 预检查、阻断、待审批、审批恢复执行 | `POST /v1/runs` 进入 quota preview；命中 soft-limit 可进入 `WAITING_APPROVAL`；approve 后恢复 run |
| Creator 成本治理 | Creator `governance/cost` 真实数据读写 | Dashboard 已接 quota policy ledger、override queue、event stream、策略创建、策略暂停/恢复、override 审批 |
| Mobile 治理回显 | H5 工作区 quota 总览与 run 内 quota 审批详情 | Mobile 已接 quota policies/counters/events/overrides，任务页可在同一会话内 approve/reject，且“我的”页可展示 workspace quota 摘要 |
| 审计联动 | audit export 消耗回写 quota usage | `creator.service.ts` 中 audit export 会写入 `audit_exports` usage |
| SDK | quota API client 正式接线 | Dashboard 与 Mobile 已可调用 quota list/query/approve/reject |
| 测试 | quota 独立 smoke 用例 | 新增 `tests/quota-governance.smoke.test.mjs`，覆盖策略创建、run 命中、override 创建、审批放行、event 回写 |

## 3. 本轮关键代码文件

| 文件 | 变更摘要 |
|---|---|
| `packages/contracts/src/quota.ts` | 新建 quota 正式契约 |
| `packages/contracts/src/runs.ts` | `RunApproval` 增加 `kind` / `relatedResourceRef` |
| `packages/domain-models/src/quota.ts` | 新建 quota 领域规则 |
| `packages/domain-models/src/runs.ts` | 状态机补齐 `CREATED -> WAITING_APPROVAL` |
| `packages/api-sdk/src/index.ts` | 新增 `createQuotaApiClient()` |
| `app/api/src/modules/quotas/*` | 新建 quota domain：repository / routes / service / storage / seed |
| `app/api/src/modules/runs/service.ts` | run 创建前 quota preview、quota approval、审批恢复执行 |
| `app/api/src/modules/creator/service.ts` | Creator `cost` summary 接 quota snapshot；audit export 写 usage |
| `app/dashboard/src/lib/api.ts` | 新增 `dashboardQuotaApi` |
| `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` | cost 分段接通 quota ledger / events / overrides / create policy / approve override |
| `app/mobile/src/lib/quota.ts` | 新增移动端 quota 标签、数值格式化与摘要辅助 |
| `app/mobile/src/lib/runQueryKeys.ts` | 统一移动端 run 详情/文件 query key，修复实时流写回与详情页读取错位 |
| `app/mobile/src/lib/runStream.ts` | 移动端 realtime 新增 approve 能力 |
| `app/mobile/src/pages/tasks/detail.tsx` | 任务会话页新增 quota 审批详情卡片与 approve/reject 闭环 |
| `app/mobile/src/pages/me/index.tsx` | “我的”页新增工作区 quota 概览、预警与 pending override 摘要 |
| `app/api/tests/quota-governance.smoke.test.mjs` | 新增 quota 独立烟测 |
| `app/api/package.json` | `test:smoke` 纳入 quota smoke |

## 4. 验证结果

| 命令 | 结果 | 说明 |
|---|---|---|
| `pnpm build:shared` | 通过 | 共享契约、领域模型、SDK 构建通过 |
| `pnpm build:backend` | 通过 | `container-bridge / run-worker / api` 全部编译通过 |
| `pnpm -C app/dashboard build` | 通过 | Dashboard 配额治理界面接线后仍可生产构建 |
| `pnpm -C app/mobile exec tsc --noEmit` | 通过 | Mobile quota 接线、实时审批与 query key 调整通过类型检查 |
| `pnpm -C app/mobile build:h5` | 通过 | Mobile quota UI 与 run 内审批闭环接线后仍可生产构建 |
| `pnpm -C app/api test:smoke` | 通过 | 14/14 全绿，含新增 quota smoke |

## 5. 本轮发现并修复的问题

| 问题 | 原因 | 处理 |
|---|---|---|
| quota seed `workspaceId` 前缀不合法 | 仍使用旧 `ws_` 命名 | 全部切换到正式 `wsp_` |
| pre-start quota approval 无法进入 `WAITING_APPROVAL` | run 状态机缺少 `CREATED -> WAITING_APPROVAL` | 在 `packages/domain-models/src/runs.ts` 补齐状态迁移 |
| `RunApproval` 契约升级后 API / Worker 类型不同步 | approval 结构新增字段后部分层未同步 | 补齐 contracts / api-sdk / backend 联动构建与用例 |
| quota smoke 初版读取了错误响应结构 | `createRun` 返回 `run record`，审批数组需从 `GET /v1/runs/:id` 获取 | 修正测试逻辑 |

## 6. 当前剩余缺口

| 域 | 仍未完成内容 | 优先级 |
|---|---|---|
| Billing | 正式 cost ledger、预算快照、对账对象仍未落地 | P0 |
| Quota 执行点 | upload / download / preview / message / MCP call 的正式 quota pre-check 仍未接入 | P0 |
| Mobile | 微信/支付宝特化、更多治理域接线、移动端 E2E 仍未完成 | P1 |
| Dashboard | 当前 bundle 仍偏大，需做路由级 code-splitting | P1 |
| Creator 治理 | review / billing / quota 的更细粒度操作仍可继续扩展 | P1 |

## 7. 后续建议顺序

| 顺序 | 工作项 | 目标 |
|---|---|---|
| 1 | 将 quota evaluator 接入 upload / download / preview / MCP 调用链 | 补齐多执行点阻断 |
| 2 | 落地 billing ledger 与预算汇总 | 让 Creator `cost` 从额度治理延伸到真实成本治理 |
| 3 | 扩展 Dashboard cost 面板的策略编辑与历史过滤 | 提升 Creator / admin 的治理操作深度 |
| 4 | 继续把 upload / download / preview / MCP call 的 quota 前置检查接入实际执行点 | 让 quota 从 run-create 进入全链路治理 |
