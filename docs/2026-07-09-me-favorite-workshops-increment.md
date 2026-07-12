# 灵办词元 2026-07-09 收藏工坊正式域增量

## 1. 本次目标

补齐 Mobile “收藏工坊”正式链路，使收藏不再停留在文案语义，而是进入可查询、可切换、可持久化、可统计的正式 `me` 域能力。

## 2. 落地范围

| 层 | 文件 / 模块 | 结果 |
|---|---|---|
| Config | `packages/config/src/index.ts` | 新增 `favoritesStore` 配置，支持 `file/postgres` 切换 |
| Contracts | `packages/contracts/src/me.ts` | 新增收藏工坊 query / response / mutation schema 与 `favoriteWorkshopsCount` |
| SDK | `packages/api-sdk/src/index.ts` | `createMeApiClient()` 新增 `listFavoriteWorkshops()`、`setFavoriteWorkshop()` |
| Backend | `app/api/src/modules/me/storage-schema.ts` | 建立收藏工坊 file-backed 存储 schema |
| Backend | `app/api/src/modules/me/repository.ts` | 建立收藏工坊 file/postgres 双仓储 |
| Backend | `app/api/src/modules/me/service.ts` | 新增收藏聚合、收藏切换、摘要计数回填 |
| Backend | `app/api/src/modules/me/routes.ts` | 暴露 `GET /v1/me/favorites/workshops` 与 `PUT /v1/me/favorites/workshops/:workshopId` |
| Backend | `app/api/migrations/0015_me_favorite_workshops.sql` | 建立 postgres 收藏表与索引 |
| Backend Test Support | `app/api/tests/support/fake-postgres-pool.mjs` | 补齐收藏工坊表的 fake postgres 行为 |
| Mobile | `app/mobile/src/pages/workshops/index.tsx` | 工坊页接真实收藏状态与收藏切换 |
| Mobile | `app/mobile/src/pages/me/index.tsx` | 我的页接真实收藏工坊列表、计数与深链 |
| Tests | `app/api/tests/me-profile-assets-authorizations.smoke.test.mjs` | 补齐收藏工坊 smoke 断言 |
| Docs | 多份总表 | 已回填当前状态 |

## 3. 正式接口

| Method | Path | 作用 |
|---|---|---|
| `GET` | `/v1/me/favorites/workshops` | 拉取当前工作区收藏工坊列表 |
| `PUT` | `/v1/me/favorites/workshops/:workshopId` | 收藏或取消收藏指定工坊 |

## 4. 当前实现口径

| 对象 | 当前来源 | 说明 |
|---|---|---|
| 收藏列表 | `meFavoritesRepository.listFavoriteWorkshops()` + `workshopCatalogRepository` | 收藏记录会再次校验工坊在当前工作区是否可见、是否 active |
| 收藏计数 | `profileMetrics.favoriteWorkshopsCount` | 与收藏列表同源聚合 |
| 收藏切换 | `setFavoriteWorkshop()` | `favorited=false` 删除；`favorited=true` 校验工坊后写入 |
| 持久化 | `favoritesStore=file/postgres` | file 模式落 `storageRoot/me/favorites-state.json`；postgres 模式落 `lingban_me_favorite_workshops` |

## 5. 前端接线结果

| 页面 | 当前结果 |
|---|---|
| `app/mobile/src/pages/workshops/index.tsx` | 已显示真实收藏态，支持收藏/取消收藏，并回刷我的页摘要与收藏列表 |
| `app/mobile/src/pages/me/index.tsx` | 已显示真实收藏工坊数量、收藏工坊列表与工坊详情深链 |

## 6. 验证结果

| 验证项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/mobile exec tsc --noEmit` | 通过 |
| `pnpm -C app/mobile build:h5` | 通过 |
| `pnpm -C app/api exec node --test tests/me-profile-assets-authorizations.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，当前 `35/35` |

## 7. 当前仍未完成

| 项目 | 状态 |
|---|---|
| Dashboard 收藏入口 | 未完成 |
| 收藏服务 / 收藏模板 | 未完成，当前仅覆盖工坊级收藏 |
| 搜索 / 最近使用 / 收藏统一域 | 未完成，favorites 已落地，search/recent 仍未建立正式域 |
| 偏好同步 | 未完成，收藏之外的个人偏好尚未统一进入 `me/preferences` |

