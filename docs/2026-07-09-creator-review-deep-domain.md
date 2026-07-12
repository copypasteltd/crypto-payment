# 2026-07-09 Increment: Creator Review Deep Domain

## 1. 目标

把 Creator release gate 从简单状态切换提升为正式审核对象，补齐结构化 checklist、evidence、recommended actions 与失败约束，避免发布审核退化为弱约定按钮流。

## 2. 变更范围

| 层 | 文件 | 变更 |
|---|---|---|
| 契约 | `packages/contracts/src/creator.ts` | 新增 release gate checklist status / item schema，并扩展 decision input |
| 后端 | `app/api/src/modules/creator/service.ts` | gate 决策校验、checklist 归一化、evidence 必填约束、recommended actions 持久化 |
| Dashboard | `app/dashboard/src/pages/creator/CreatorReleasePanels.tsx` | 新增结构化审核面板、逐项 checklist 状态切换、evidence 输入、推荐动作编辑 |
| 烟测 | `app/api/tests/creator-release-replay.smoke.test.mjs`、`app/api/tests/creator-rbac.smoke.test.mjs` | 适配正式 gate payload，并验证 checklist / recommended actions 回写 |

## 3. 审核对象新增字段

| 字段 | 含义 |
|---|---|
| `checklist[]` | 每个 Gate 的正式审核条目 |
| `evidenceRef` | 审核证据引用 |
| `recommendedActions[]` | 后续修正或上线建议 |
| `note` | 审核说明，可覆盖或清空 |

## 4. 关键约束

| 场景 | 约束 |
|---|---|
| 非人工审批 Gate 标记 `passed` | 必须提供 `evidenceRef` |
| 任一 checklist 仍为 `pending/failed` | Gate 不允许标记为 `passed` |
| Gate 标记为 `failed` | 必须有失败 checklist 或显式失败说明 |
| Gate 标记为 `waived` | checklist 自动归一为 `waived` |

## 5. 验证

| 命令 | 结果 |
|---|---|
| `pnpm -C packages/contracts build` | 通过 |
| `pnpm -C packages/api-sdk build` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/dashboard build` | 通过 |
| `node --test app/api/tests/creator-release-replay.smoke.test.mjs` | 通过 |
| `node --test app/api/tests/creator-rbac.smoke.test.mjs` | 通过 |
