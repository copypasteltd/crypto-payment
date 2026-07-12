# 灵办词元 共享UI组件、设计Token与样式约束执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 共享UI组件、设计Token与样式约束执行总表 |
| 适用范围 | `packages/ui-tokens`、`app/dashboard`、`app/mobile`、双端组件分层与样式治理链 |
| 统计日期 | 2026-07-08 |
| 当前事实 | 当前共享层只有 `@lingban/ui-tokens`，导出基础色、圆角、间距和明暗主题变量；Dashboard 通过 `applyDashboardTheme()` 写入 CSS 变量，Mobile 通过 `applyMobileTheme()` 写入 CSS 变量。Dashboard 组件目录当前仅有 `IconSprite.tsx`；Mobile 侧还没有独立 `src/components` 目录，大量业务结构直接写在页面内，样式主要集中在 `prototype.css`。 |
| 直接证据 | `packages/ui-tokens/src/index.ts`、`app/dashboard/src/lib/theme.ts`、`app/mobile/src/lib/theme.ts`、`app/dashboard/src/components/IconSprite.tsx`、`app/dashboard/src/styles/tokens.css`、`app/dashboard/src/styles/prototype.css`、`app/mobile/src/styles/prototype.css`、`app/dashboard/src/pages/workshops/WorkshopsPage.tsx`、`app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/workshops/index.tsx`、`app/mobile/src/pages/tasks/detail.tsx`、`docs/前端需求.md` 第 18 节、`docs/dashboard开发文档.md` 第 15 节、`docs/共享包契约、领域投影与SDK执行总表.md` |
| 输出目标 | 把共享 token、双端组件分层、图标体系、样式边界、状态约束、目录结构和实施顺序系统化为执行表 |

## 2. 当前事实矩阵

| 主题 | 当前证据 | 当前结论 | 当前缺口 |
|---|---|---|---|
| 共享设计层 | `packages/ui-tokens/src/index.ts` | 只有 token 层，无组件层 | 缺语义 token、状态 token、图标/排版 token |
| Dashboard 主题接入 | `app/dashboard/src/lib/theme.ts` | 已能切换明暗主题变量 | 缺组件级状态统一 |
| Mobile 主题接入 | `app/mobile/src/lib/theme.ts` | 已能切换明暗主题变量 | 缺组件级状态统一 |
| Dashboard 组件目录 | `app/dashboard/src/components` 仅 `IconSprite.tsx` | 组件体系尚未成型 | 业务组件主要内嵌页面 |
| Mobile 组件目录 | `app/mobile/src/components` 不存在 | 组件体系尚未起目录 | 业务结构全部在页面内拼装 |
| 组件规范来源 | `docs/前端需求.md` 第 18 节、`docs/dashboard开发文档.md` 第 15 节 | 目标组件清单已经定义 | 代码与规范未对齐 |

## 3. 当前代码结构证据表

| 位置 | 当前内容 | 结论 |
|---|---|---|
| `packages/ui-tokens/src/index.ts` | 导出 `lingbanColorTokens`、`lingbanRadiusTokens`、`lingbanSpacingTokens`、`lingbanThemeVars` | 共享层停留在 token 常量 |
| `app/dashboard/src/lib/theme.ts` | `applyDashboardTheme(theme)` 将 token 写入 `document.body.style` | Dashboard 主题应用路径已固定 |
| `app/mobile/src/lib/theme.ts` | `applyMobileTheme(theme)` 将 token 写入 `document.body.style` | Mobile 主题应用路径已固定 |
| `app/dashboard/src/components/IconSprite.tsx` | 内置 `i-home`、`i-terminal`、`i-spark`、`i-search` 等 symbol | 仅有图标雪碧图，不构成组件体系 |
| `app/dashboard/src/styles/prototype.css` | 大量页面级卡片、栅格、按钮样式 | 样式仍偏原型态，复用粒度过粗 |
| `app/mobile/src/styles/prototype.css` | 承担页面、卡片、底部导航、对话、文件页样式 | 页面样式与组件样式未分层 |

## 4. 目标分层模型表

| 层级 | 位置 | 职责 | 约束 |
|---|---|---|---|
| L0 设计 Token 层 | `packages/ui-tokens` | 颜色、排版、间距、圆角、阴影、层级、状态变量 | 只放常量与纯函数，不放视图组件 |
| L1 Dashboard 基础组件层 | `app/dashboard/src/components/base` | `Button`、`IconButton`、`Tabs`、`Drawer`、`Skeleton` 等浏览器基础组件 | 不依赖业务对象 |
| L1 Mobile 基础组件层 | `app/mobile/src/components/base` | `Button`、`Chip`、`BottomSheet`、`PathInput`、`Skeleton` 等 Taro 基础组件 | 不依赖业务对象 |
| L2 Dashboard 业务组件层 | `app/dashboard/src/components/business` | `WorkshopCard`、`InstanceRow`、`MessageCard`、`FileTree` 等 | 允许依赖业务 ViewModel |
| L2 Mobile 业务组件层 | `app/mobile/src/components/business` | `WorkshopCard`、`TaskCard`、`MessageBubble`、`FileCard` 等 | 允许依赖业务 ViewModel |
| L3 页面编排层 | `src/pages/*` | 组合页面、接 Query、接 Store、接路由 | 不再手写重复的视觉原子 |

## 5. 共享边界约束表

| 主题 | 固定要求 |
|---|---|
| 跨端共享代码 | 只允许经 `packages/*` 共享 token、协议、纯函数、SDK，不在共享包中放 Web/Taro 视图组件 |
| Dashboard 组件 | 固定消费 `@lingban/ui-tokens`，使用浏览器 React 组件模型 |
| Mobile 组件 | 固定消费 `@lingban/ui-tokens`，使用 Taro + React 组件模型 |
| 页面职责 | 页面负责数据装载与编排，视觉原子和业务卡片必须下沉到组件层 |
| CSS 变量 | 所有端内组件都从 CSS 变量读取主题值，不直接硬编码颜色 |

## 6. 当前 Token 导出矩阵

| 导出对象 | 当前内容 | 当前覆盖度 | 主要缺口 |
|---|---|---|---|
| `lingbanColorTokens` | Dashboard/Mobile 基础色板 | 低 | 缺语义状态层、图表色、禁用色 |
| `lingbanRadiusTokens` | `panel/soft/pill` | 低 | 缺对话气泡、输入框、抽屉、底部弹层半径 |
| `lingbanSpacingTokens` | `xs/sm/md/lg/xl` | 低 | 缺密度层、列表节奏、响应式 spacing |
| `lingbanThemeVars.dashboard` | Dashboard 明暗主题变量 | 中 | 缺组件态变量与可访问性变量 |
| `lingbanThemeVars.mobile` | Mobile 明暗主题变量 | 中 | 缺组件态变量与可访问性变量 |

## 7. 正式 Token 分类矩阵

| Token 类 | 当前状态 | 正式要求 | 优先级 |
|---|---|---|---|
| 基础色板 | 已有 | 保留 | P0 |
| 语义颜色 | 部分已有 `accent/success/warn/danger` | 增加 `info/disabled/overlay/focus/selection` | P0 |
| 文本层级 | 部分通过 `text/muted` 表达 | 增加 `text-primary/secondary/tertiary/inverse` | P0 |
| Surface 层级 | 已有 `surface-*` | 增加 `panel/raised/overlay/sheet` 语义层 | P0 |
| Border / Divider | 已有 `line/line-strong` | 增加输入态、错误态、聚焦态边框 | P1 |
| 阴影 | Dashboard/Mobile 各有 `shadow-card` | 增加 `shadow-soft/overlay/focus-ring` | P1 |
| 圆角 | 已有 | 增加 `radius-input/radius-dialog/radius-bubble` | P1 |
| 间距 | 已有 | 增加 `2xs/2xl/3xl` 与列表密度档 | P1 |
| 排版 | 缺失 | 增加字号、行高、字重、标题层级 | P0 |
| 图标 | 缺失 | 增加 icon size、stroke、容器尺寸规范 | P1 |
| 动效 | 缺失 | 增加过渡时间、easing、骨架节奏变量 | P2 |

## 8. 基础组件清单总表

| 组件 | Dashboard | Mobile | 当前状态 | 正式要求 |
|---|---:|---:|---|---|
| `Icon` | 是 | 是 | Dashboard 仅 `IconSprite`，Mobile 无统一封装 | 统一图标接口 |
| `Button` | 是 | 是 | 页面内散写按钮样式 | 统一主/次/警告/幽灵态 |
| `IconButton` | 是 | 是 | 散落在页面 | 统一 32/36/40 容器规格 |
| `SearchField` | 是 | 是 | 页面内手写输入框 | 统一搜索框、清空、loading 态 |
| `FilterChips` | 是 | 是 | 页面内手写 pill/chip | 统一单选/多选/滚动筛选组件 |
| `Tabs` | 是 | 是 | 页面内手写 tab 按钮 | 统一激活态、滚动态、角标 |
| `Drawer/BottomSheet` | 是 | 是 | 页面级结构为主 | 统一授权说明、审批详情、工作区切换 |
| `Toast/Banner` | 是 | 是 | 当前无统一层 | 统一错误、离线、成功反馈 |
| `EmptyState` | 是 | 是 | 已有零散空态 | 抽成统一组件 |
| `Skeleton` | 是 | 是 | 当前无统一层 | 抽成统一组件 |
| `StatusPill` | 是 | 是 | 当前大量手写 `pill` | 统一 success/warn/danger/active/inactive 语义 |
| `PathInput` | 是 | 是 | 文件页路径输入各自手写 | 统一路径输入、校验、快捷目录 |

## 9. 业务组件清单总表

| 组件 | Dashboard | Mobile | 需求来源 | 当前状态 |
|---|---:|---:|---|---|
| `WorkshopCard` | 是 | 是 | `前端需求.md` 18.1 | 仅页面内结构 |
| `ServiceCard` | 是 | 是 | `前端需求.md` 18.1 | 仅页面内结构 |
| `TaskCard / InstanceRow` | 是 | 是 | `前端需求.md` 18.1、`dashboard开发文档.md` 15 节 | 仅页面内结构 |
| `MessageBubble / MessageCard` | 是 | 是 | `前端需求.md` 18.1、`dashboard开发文档.md` 15 节 | 仅页面内结构 |
| `ApprovalCard` | 是 | 是 | `前端需求.md` 18.1 | 仅消息模块内联 |
| `AttachmentCard` | 是 | 是 | `前端需求.md` 18.1 | 尚未正式实现 |
| `FileCard` | 是 | 是 | `前端需求.md` 18.1 | 文件页与消息模块内联 |
| `ResultCard` | 是 | 是 | `前端需求.md` 18.1 | 消息模块内联 |
| `TaskComposer` | 是 | 是 | `前端需求.md` 18.1 | 页面中重复实现 |
| `FileTree / FilePreviewPanel` | 是 | 是 | `前端需求.md` 18.1、`dashboard开发文档.md` 15 节 | 页面中重复实现 |
| `RuntimePanel` | 是 | 否 | `dashboard开发文档.md` 15 节 | 页面内结构 |
| `AuditPanel` | 是 | 否 | `dashboard开发文档.md` 15 节 | 页面内结构 |
| `WorkspaceSwitcher` | 是 | 是 | 产品分层与“我的”页要求 | 页面内结构 |
| `NotificationPanel` | 是 | 是 | 通知与异步交互需求 | Dashboard 局部存在，Mobile 未统一 |

## 10. 图标体系矩阵

| 主题 | 当前状态 | 问题 | 正式要求 |
|---|---|---|---|
| Dashboard 主图标 | `IconSprite.tsx` 自定义线框 icon | 图标数量少，状态图标不全 | 建立统一 `Icon` 组件，抽离名称映射 |
| Dashboard 旧资源 | `public/icons.svg` 存在历史图标资源 | 与当前业务图标体系割裂 | 收敛到单一图标源 |
| Mobile 图标 | tabbar 使用位图资源，其他大量用文字/样式代替 | 图标密度不足，交互 affordance 弱 | 建立 Taro 可消费的扁平图标体系 |
| 状态图标 | 成功/警告/错误/断连等不统一 | 页面依赖颜色和文字补语义 | 统一状态 icon + color token |

## 11. 状态组件约束表

| 组件 | 必须状态 |
|---|---|
| `Button` | `default/hover/pressed/disabled/loading` |
| `StatusPill` | `active/success/warn/danger/muted` |
| `MessageBubble` | `normal/streaming/failed/pending` |
| `ApprovalCard` | `pending/deciding/approved/rejected/expired` |
| `FileCard` | `ready/generating/downloading/failed` |
| `ResultCard` | `ready/archived/rerunnable/expired` |
| `SearchField` | `idle/focused/loading/error` |
| `PathInput` | `idle/invalid/applying/readonly` |

## 12. 样式与布局约束表

| 主题 | 固定要求 |
|---|---|
| 主题来源 | 所有业务颜色来自 CSS 变量，不在页面 JSX 内硬编码 |
| 页面样式拆分 | 页面仅保留布局编排样式，基础组件样式下沉到组件级 CSS |
| 双端分离 | Dashboard 与 Mobile 不共享视图组件实现，只共享 token 语义 |
| 原型迁移 | `prototype.css` 继续可用，但必须逐步拆到 `base/business/page` 三层 |
| 状态样式 | 加载、空态、错误、禁用、焦点态必须由统一 token 驱动 |

## 13. 目录结构目标表

| 终端 | 目标目录 | 作用 |
|---|---|---|
| Dashboard | `src/components/base` | 基础按钮、图标、输入、tab、drawer、banner、skeleton |
| Dashboard | `src/components/business` | `WorkshopCard`、`InstanceRow`、`MessageCard`、`FileTree` 等 |
| Dashboard | `src/components/composed` | 组合工作面，如 `ConversationPane`、`DetailDrawer` |
| Mobile | `src/components/base` | Taro 基础按钮、chip、sheet、toast、skeleton |
| Mobile | `src/components/business` | `WorkshopCard`、`TaskCard`、`MessageBubble`、`FileCard` 等 |
| Mobile | `src/components/composed` | 任务摘要区、文件预览区、我的页工作区切换区 |

## 14. 当前结构性缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 共享层只有 token 没有语义层 | 颜色、间距、圆角过于基础 | 组件状态难统一 | P0 |
| Dashboard 组件目录未成型 | 仅 `IconSprite.tsx` | 大量结构与样式重复 | P0 |
| Mobile 无组件目录 | 页面承担所有 UI 拼装 | 复用差，后续小程序化风险高 | P0 |
| 图标体系不统一 | Dashboard/ Mobile 各自散落 | 视觉一致性不足 | P1 |
| `prototype.css` 负担过重 | 页面改动容易互相污染 | 维护成本高 | P1 |
| 排版 token 缺失 | 标题、正文、说明字级靠页面手写 | 多语言与适配不稳定 | P1 |

## 15. 实施顺序表

| 顺序 | 动作 |
|---|---|
| 1 | 扩展 `@lingban/ui-tokens`，补齐排版、状态、阴影、图标尺寸和语义 token |
| 2 | 在 Dashboard 建立 `base/business/composed` 三级组件目录，优先抽 `Button`、`StatusPill`、`SearchField`、`Tabs`、`EmptyState`、`Skeleton` |
| 3 | 在 Mobile 建立对应组件目录，优先抽 `Button`、`TaskChip`、`MessageBubble`、`TaskComposer`、`FileCard`、`PathInput` |
| 4 | 把工坊页、任务页、文件页、实例页中重复结构迁移为业务组件 |
| 5 | 建立统一图标封装与状态 icon 体系，清理旧的分散 icon 写法 |
| 6 | 逐步把 `prototype.css` 拆分到组件级样式文件与页面布局文件 |
