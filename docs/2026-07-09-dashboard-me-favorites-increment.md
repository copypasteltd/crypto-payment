# 灵办词元 2026-07-09 Dashboard 账户摘要与收藏工坊增量

## 1. 变更目标

补齐 Dashboard 侧对正式 me 域的复用，覆盖：

- 账户浮层复用 `/v1/me/summary`
- 账户浮层复用 `/v1/me/favorites/workshops`
- 工坊页收藏查询与收藏切换
- 收藏变更后对账户摘要与收藏列表的联动刷新

## 2. 代码变更

| 文件 | 变更 |
|---|---|
| `app/dashboard/src/app/DashboardShell.tsx` | 新增 `dashboardMeApi` 查询，账户浮层显示正式账户摘要与收藏工坊列表 |
| `app/dashboard/src/pages/workshops/WorkshopsPage.tsx` | 接入收藏查询、收藏切换、收藏计数、工坊详情/服务启动台/卡片三处收藏动作 |
| `app/dashboard/src/styles/prototype.css` | 补齐账户浮层摘要卡片、收藏列表、收藏按钮图标与禁用态样式 |

## 3. 数据联动

| 动作 | 失效 Query Key |
|---|---|
| 收藏或取消收藏工坊 | `["dashboard","me","favorites"]` |
| 收藏或取消收藏工坊 | `["dashboard","me","summary"]` |

## 4. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/dashboard lint` | 通过 |
| `pnpm -C app/dashboard build` | 通过 |

## 5. 当前收口状态

| 能力 | 当前状态 |
|---|---|
| Dashboard 账户摘要复用 | 已完成基础版 |
| Dashboard 收藏工坊浮层 | 已完成基础版 |
| Dashboard 工坊页收藏切换 | 已完成 |
| 统一搜索 / 最近使用正式域 | 未完成 |
