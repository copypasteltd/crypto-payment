# 灵办词元 2026-07-09 我的页正式读模型增量

## 1. 本次目标

将 Mobile 我的页从页面内派生汇总，推进到正式 `/v1/me/*` 读模型：

- `/v1/me/summary`
- `/v1/me/assets`
- `/v1/me/authorizations`

并同步补齐 SDK、前端接线、smoke 覆盖与状态文档。

## 2. 本次落地范围

| 层 | 文件 / 模块 | 结果 |
|---|---|---|
| Contracts | `packages/contracts/src/me.ts` | 新增 profile metrics、资产列表、授权摘要正式契约 |
| API SDK | `packages/api-sdk/src/index.ts` | `createMeApiClient()` 新增 `getSummary()`、`listAssets()`、`getAuthorizationSummary()` |
| Backend | `app/api/src/modules/me/service.ts` | 建立 me 正式读模型聚合层 |
| Backend | `app/api/src/modules/me/routes.ts` | 暴露 `/v1/me/summary`、`/v1/me/assets`、`/v1/me/authorizations` |
| Mobile | `app/mobile/src/pages/me/index.tsx` | 我的页切到正式 me 读模型，资产支持深链回文件页 |
| Tests | `app/api/tests/me-profile-assets-authorizations.smoke.test.mjs` | 新增正式 smoke |
| Docs | `docs/仓库完成度与模块状态表.md` 等 | 已回填当前状态 |

## 3. 后端对象化结果

| 接口 | 返回对象 | 说明 |
|---|---|---|
| `GET /v1/me/summary` | `MeProfileSummary` | 当前账号、当前工作区、workspace metrics、profile metrics |
| `GET /v1/me/assets` | `MeAssetListResponse` | 最近资产、按资产类型统计、深链目标 |
| `GET /v1/me/authorizations` | `MeAuthorizationSummary` | 账号、工作区角色、credential、MCP、quota、billing 聚合摘要 |

## 4. 当前实现口径

| 对象 | 当前来源 | 备注 |
|---|---|---|
| `summary.metrics` | `authService.getWorkspaceProfileSummary()` | 复用现有工作区权威指标 |
| `summary.profileMetrics` | run 列表 + 资产聚合 | 展示文件、回执、待处理统计 |
| `assets.items` | `run_files` 索引优先，回退 run snapshot.files | 当前仍是 run 文件读模型，不是独立资产账本 |
| `authorizations.entries` | credentials / mcps / quota / billing 聚合 | 当前是摘要对象，不是完整明细域 |

## 5. 前端接线结果

| 页面区域 | 旧来源 | 新来源 |
|---|---|---|
| Hero / Profile Stats | `listRuns()` + 本地派生 | `/v1/me/summary` |
| 当前工作区卡片 | 本地 `currentWorkspace` + `metrics` | `/v1/me/summary.currentWorkspace + metrics` |
| 我的资产 | 任务文件扁平化 | `/v1/me/assets` |
| 授权中心摘要 | credentials / MCP 页面内拼装 | `/v1/me/authorizations` |

## 6. 测试与验证

| 验证项 | 结果 |
|---|---|
| `pnpm -C app/mobile exec tsc --noEmit` | 通过 |
| `pnpm -C app/mobile build:h5` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api exec node --test tests/me-profile-assets-authorizations.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，当前 `35/35` |

## 7. 仍未完成

| 项目 | 当前状态 |
|---|---|
| 独立资产持久化域 | 未完成，当前仍以 run 文件读模型聚合 |
| 授权明细页 / 授权对象明细域 | 未完成 |
| Dashboard 复用 `/v1/me/*` | 未完成 |
| 收藏工坊 / 偏好同步 | 工坊收藏已在后续增量补齐；偏好同步仍未完成 |
