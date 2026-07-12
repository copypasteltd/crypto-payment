# 灵办词元 Mobile Quota Approval Increment

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Mobile Quota Approval Increment |
| 日期 | 2026-07-08 |
| 适用范围 | `app/mobile` |
| 目的 | 记录移动端 quota 总览、run 内审批、realtime key 对齐与验证结果 |

## 2. 本轮完成项

| 模块 | 变更 | 结果 |
|---|---|---|
| `src/lib/api.ts` | 新增 `mobileQuotaApi` | 已完成 |
| `src/lib/quota.ts` | 新增 quota 标签、数值格式化、摘要辅助 | 已完成 |
| `src/lib/runQueryKeys.ts` | 统一 run 详情/文件 query key | 已完成 |
| `src/lib/runStream.ts` | 新增 realtime `approve()` 能力 | 已完成 |
| `src/pages/tasks/detail.tsx` | 新增 pending approval 实操 approve/reject；quota override 详情卡片；最近 quota 事件摘要 | 已完成 |
| `src/pages/tasks/files.tsx` | run 详情/文件 query key 对齐 realtime 写回 | 已完成 |
| `src/pages/me/index.tsx` | 新增 workspace quota policies/counters/events/overrides 摘要 | 已完成 |

## 3. 用户可见结果

| 页面 | 新能力 |
|---|---|
| 任务详情 | 在同一会话页内直接 approve / reject pending approval |
| 任务详情 | 若为 quota override，可看到 metric、usage、scope、required role、最近 quota 事件 |
| 我的 | 可看到当前 workspace 的 quota policies 数、pending overrides 数、alerts 数、最接近上限的 metric |

## 4. 工程修复

| 问题 | 处理 |
|---|---|
| 移动端 run 详情 query key 与 realtime 写回 key 不一致 | 抽出 `runQueryKeys.ts` 并对齐 detail/files 查询 |
| 移动端只能看到“待审批”，不能直接执行 | 在 `useMobileRunStream()` 暴露 `approve()` 并在任务详情页接入 |

## 5. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/mobile exec tsc --noEmit` | 通过 |
| `pnpm -C app/mobile build:h5` | 通过 |

## 6. 仍未完成

| 领域 | 剩余内容 |
|---|---|
| Mobile 渠道 | `wechat-miniapp` / `alipay` 特化尚未开始 |
| Mobile 治理 | 更多治理域接线仍待补齐，当前聚焦 quota |
| Mobile 验证 | 端侧 E2E 与真机回归尚未建立 |
