# 灵办词元 Dashboard 开发文档

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 灵办词元 Dashboard 开发文档 |
| 文档类型 | Frontend Engineering Spec |
| 当前版本 | v1.0 |
| 编写日期 | 2026-07-08 |
| 适用端 | Web Dashboard |
| 设计定稿 | `方案 C / Operator Dashboard` |
| 主参照原型 | `example/style-c-operator-dashboard.html` |
| 辅助参照 | `example/style-a-infra-dashboard.html`、`example/style-b-protocol-dashboard.html` |
| 工程路径 | `app/dashboard` |
| 关联文档 | `docs/产品需求草案.md`、`docs/前端需求.md`、`docs/前端布局草图说明.md`、`docs/后端设计文档.md` |

## 2. 开发定位

Dashboard 是重度用户、Creator、管理员共用的主工作台。它承担三类职责：

| 职责 | 说明 |
|---|---|
| 服务分发 | 浏览工坊、理解服务、启动实例、管理批量启动 |
| 实例协作 | 查看多实例、进入完整对话、消费文件、查看运行与审计 |
| Creator 生产与治理 | 管理包、服务、Session、版本、调试回放、凭证与权限 |

当前 Dashboard 不采用“概览首页 + 多孤立后台”的模式，固定围绕 `工坊 / 实例 / Creator` 三个一级工作区组织。

### 2.1 React + Vite 冻结结论

| 维度 | 固定要求 | 工程意义 |
|---|---|---|
| 唯一正式工程 | `app/dashboard` | 承接全部重度用户、Creator、治理与多语言后台页面 |
| 固定主栈 | `React 18.3.x + Vite 5.x + TypeScript 5.x` | 保持纯浏览器 SPA 架构，避免宿主混杂 |
| 业务路由 | `React Router 6+` | 工坊、实例、Creator 深链统一走一套路由机制 |
| 构建链 | `pnpm dev / build / lint / preview` | 本地开发、构建验收、代码检查、预览口径统一 |
| 包管理与运行时 | `pnpm workspace + Node.js 22 LTS` | 与仓库共享包、根级脚本和 CI 环境保持一致 |
| 组件模型 | `React 函数组件 + Hooks` | 新增页面与组件固定采用函数式实现 |
| H5 边界 | 不承接移动端 H5 页面 | 防止 Dashboard 与 H5 双轨演化 |
| 平台能力接入 | 统一经 `src/lib` 或 `src/services` | 页面层不直连浏览器底层对象与分散 SDK |
| 共享层边界 | 仅消费 `packages/*` | 不从 `app/mobile` 导入页面、组件、hooks、stores |
| 禁止项 | `Next.js`、`Umi`、`Remix`、`@tarojs/*` 页面运行时 | 保持 Web 主栈单一、边界明确 |

### 2.2 Dashboard 技术栈执行摘要

| 项目 | 冻结要求 | 说明 |
|---|---|---|
| 正式工程 | `app/dashboard` | Dashboard 是唯一正式 Web 前端工程 |
| 主框架 | `React 18.3.x` | 页面、组件、工作台交互全部基于 React |
| 构建器 | `Vite 5.x` | 开发、构建、预览统一走 Vite |
| 路由 | `React Router 6+` | 深链、工作区切换、详情直达统一使用 React Router |
| 语言 | `TypeScript 5.x` | 页面、hooks、stores、协议映射全部使用 TS |
| 组件模型 | `React 函数组件 + Hooks` | 不新增 class component、mixin、遗留式页面组织 |
| 正式脚本 | `dev / build / lint / preview` | `package.json` 必须直接表达 React + Vite 工程身份 |
| H5 边界 | 不承接移动端 H5 页面 | H5 固定归属 `app/mobile` |
| 共享边界 | 仅消费 `packages/*` | 不导入移动端页面、组件、store 实现 |
| 禁止项 | `Next.js`、`Umi`、`Remix`、`@tarojs/*` 页面运行时 | 防止 Web 主栈偏移 |

### 2.3 Dashboard 工程冻结条款

| 检查维度 | 固定要求 | 交付约束 |
|---|---|---|
| 唯一宿主 | `React 18.3.x + Vite 5.x + TypeScript 5.x` | Dashboard 必须完整运行在浏览器侧 `React SPA` 模型中 |
| 工程目录 | `app/dashboard` | 不拆分第二套后台 Web 工程，不承接移动端 H5 壳 |
| 启动链 | `src/main.tsx` -> `src/app/*` -> `React Router` | 新增 provider、主题、语言、路由守卫都必须挂在应用层 |
| 必选依赖 | `react`、`react-dom`、`vite`、`@vitejs/plugin-react`、`react-router-dom`、`@tanstack/react-query`、`zustand`、`i18next`、`react-i18next` | 缺失任一主依赖视为主栈漂移 |
| 正式脚本 | `dev / build / lint / preview` | `package.json` 必须直接表达 `React + Vite` 工程身份 |
| 路由归属 | `React Router 6+` | 所有 Dashboard 页面深链、筛选态、详情态统一收敛到 React Router |
| 状态主栈 | `TanStack Query 5 + Zustand 5` | 服务端状态与本地交互状态固定双栈，不引入额外全局状态库 |
| 样式主栈 | `@lingban/ui-tokens + CSS Variables + Scoped CSS` | 不引入第二套 UI 主框架，不并行维护第二套主题系统 |
| 国际化 | `zh-CN`、`en-US` 首发必做，统一由 `i18next + react-i18next` 承担 | 页面文案不得硬编码双语切换逻辑 |
| 环境变量 | `VITE_API_BASE_URL` | API 基址统一走 Vite 环境注入，不允许页面硬编码 |
| 构建产物 | `dist/` | 产物只包含 Dashboard 静态资源，不包含服务端逻辑 |
| CI 门禁 | `pnpm lint && pnpm build` | 任一环节失败都不得视为 Dashboard 可交付 |

### 2.4 Dashboard 技术栈硬约束表

| 维度 | 当前固定结论 | 仓库映射 | 约束说明 |
|---|---|---|---|
| 工程身份 | `React + Vite` Web SPA | `app/dashboard` | Dashboard 是唯一正式 Web 后台工程 |
| 应用入口 | `index.html` -> `src/main.tsx` -> `src/app/App.tsx` | `app/dashboard/index.html`、`app/dashboard/src/main.tsx`、`app/dashboard/src/app/App.tsx` | 全局 Provider、主题、语言、Router 必须从入口统一装配 |
| 路由入口 | `React Router 6+` | `app/dashboard/src/app/router/AppRouter.tsx` | 工坊、实例、Creator 深链只允许一套路由主栈 |
| 关键目录 | `src/app`、`src/pages`、`src/lib`、`src/stores`、`src/styles` | 当前仓库目录已落地 | 页面、业务适配、状态、样式边界固定 |
| 构建配置 | `vite.config.ts` + `tsconfig.app.json` + `tsconfig.node.json` | 当前仓库文件已存在 | 不引入第二套应用构建器或第二入口配置 |
| 正式脚本 | `dev / build / lint / preview` | `app/dashboard/package.json` | `build` 必须保持 `tsc -b && vite build` 口径 |
| 运行时依赖 | `react@18.3.1`、`react-dom@18.3.1`、`react-router-dom@6.30.1` | `app/dashboard/package.json` | 不替换为 SSR 框架或多宿主运行时 |
| 状态主栈 | `@tanstack/react-query@5.85.6` + `zustand@5.0.8` | `app/dashboard/package.json` | 服务端状态与本地 UI 状态职责固定 |
| 国际化主栈 | `i18next@26.3.4` + `react-i18next@17.0.8` | `app/dashboard/package.json`、`src/lib/i18n.ts` | `zh-CN / en-US` 首发由 Dashboard 正式承载 |
| 构建主链 | `vite@5.4.19` + `@vitejs/plugin-react@5.0.2` + `typescript@~5.8.3` | `app/dashboard/package.json`、`app/dashboard/vite.config.ts` | 不新增平行打包链或第二类型系统 |
| 质量门禁 | `oxlint@1.71.0` + `pnpm lint && pnpm build` | `app/dashboard/package.json` | 任何变更都必须走当前主链路验收 |
| 环境变量 | `VITE_API_BASE_URL` | `src/lib/api.ts` + Vite env | 页面层禁止硬编码 API 基址 |
| 共享包 | `@lingban/api-sdk`、`@lingban/contracts`、`@lingban/domain-models`、`@lingban/ui-tokens` | Workspace 依赖 | 共用能力只从 `packages/*` 注入 |
| 禁止事项 | `Next.js`、`Umi`、`Remix`、`@tarojs/*` 页面运行时、第二套 Web Dashboard 工程 | 架构评审门禁 | 保持 Dashboard 主栈单一、目录边界稳定 |

### 2.5 Dashboard 交付门禁

| 检查项 | 必须满足 | 不通过示例 |
|---|---|---|
| 工程身份 | `app/dashboard` 仍是唯一正式 Web 工程 | 新增第二个 Web 前端根目录 |
| 入口链 | `index.html`、`src/main.tsx`、`src/app/App.tsx` 仍为正式入口链 | 在页面层旁路挂起独立启动壳 |
| 构建链 | `vite.config.ts` 仍为唯一应用构建配置 | 引入额外 SSR/MPA 框架配置并进入正式链路 |
| 路由链 | 业务页面仍只走 `React Router` | 在页面内并行维护第二套路由系统 |
| 依赖边界 | 仅消费 `packages/*` 共用层 | 直接从 `app/mobile` 导入页面、hooks、store |
| 验收命令 | `pnpm lint && pnpm build` 通过 | lint 失败、构建失败、仅截图通过 |

### 2.6 当前工程现实基线表

| 项 | 当前事实 | 说明 |
|---|---|---|
| 工程路径 | `app/dashboard` | 与定稿文档一致 |
| 构建状态 | `pnpm -C app/dashboard build` 已通过 | 当前代码可产出正式静态构建物 |
| 路由主链 | `工坊 / 实例 / Creator` 已落地 | `src/app/router/AppRouter.tsx` 已存在 |
| 实时链路 | 已接入 `@lingban/api-sdk` runs realtime client | 断线恢复与 fallback 仍待增强 |
| 多语言 | `i18next` 中英文骨架已接入 | 全量词条与治理域词条仍待补齐 |
| 数据源现状 | 已混合真实 runs API、真实 catalog API、Creator package/release/replay/gate/activation/governance API 与预览态静态参考数据；DashboardShell、Workshops、Instances 在认证工作区内已停止静态工坊/服务/实例回退，Creator release review 已接入正式 checklist / evidence / recommended actions 审核对象，`members` 分段已直接消费 workspace members / invitations 正式接口并支持创建邀请、撤销邀请与成员角色状态调整；Creator `cost/quota` 已接入正式读写主链，残余静态层主要收敛在未登录预览模式与少量参考文案 | 工坊目录、服务详情与 launch template 主链已切到真实后端，剩余工作集中在多语言全量词条、实时断线恢复和预览态样例治理 |
| 当前最大缺口 | 多语言全量词条、实时断线恢复 / fallback 策略、前端 E2E 扩面、预览态样例数据治理 | 已进入正式工程壳持续收口阶段 |

## 3. 定稿基线与参照优先级

| 优先级 | 文件 | 作用 |
|---|---|---|
| P0 | `example/style-c-operator-dashboard.html` | 正式布局、导航、分栏、密度、明暗主题主基线 |
| P1 | `example/index.html` | 演示入口与多方案对照入口 |
| P2 | `example/style-a-infra-dashboard.html` | 平台结构感、系统信息表达补充参考 |
| P2 | `example/style-b-protocol-dashboard.html` | 流程节奏、会话组织补充参考 |

开发约束：

- 正式工程的页面结构、模块顺序、侧栏折叠关系、标签体系、对话工作面以方案 C 为准。
- 方案 A/B 只能补充局部表达，不得回退为一级导航方案。
- `文件 / 运行 / 审计` 只能存在于实例内部。
- 调试、治理、凭证、成员、策略能力只能挂在 `Creator` 工作区内。

## 4. 用户与权限模型

| 角色 | 主要目标 | 进入频率 | 关键页面 |
|---|---|---|---|
| 重度用户 | 找服务、开实例、追进度、拿结果 | 高 | 工坊、实例 |
| 运营人员 | 跟进大量实例、做异常处理、批量启动 | 高 | 实例、工坊 |
| Creator | 维护工坊包、服务描述、Session 版本、发布规则 | 高 | Creator |
| 管理员 | 管理凭证、成员、策略、审计与成本 | 中 | Creator |

权限分层建议：

| 层级 | 控制对象 | 说明 |
|---|---|---|
| 组织层 | 空间可见范围 | 控制用户可见哪些工坊包、实例、凭证域 |
| 包层 | Creator 包权限 | 控制谁可编辑、调试、发布某个包 |
| 服务层 | 启动权限 | 控制谁可使用某类服务 |
| 实例层 | 查看与接管权限 | 控制谁可进入实例、下载文件、查看审计 |
| 治理层 | 凭证与策略权限 | 控制谁可修改凭证、成员、网络策略、预算策略 |

## 5. 一级信息架构

### 5.1 一级工作区

| 工作区 | 目标 | 进入后默认内容 |
|---|---|---|
| 工坊 | 服务分发 | 推荐工坊、企业工坊、最近使用、服务筛选 |
| 实例 | 多实例协作 | 多实例列表、当前实例对话、详情抽屉 |
| Creator | 生产与治理 | Creator 包列表、版本状态、治理概览 |

### 5.2 二级结构

| 一级工作区 | 二级结构 | 说明 |
|---|---|---|
| 工坊 | 工坊首页 / 工坊详情 / 服务详情 / 批量启动面板 | 所有启动行为从服务详情发起 |
| 实例 | 实例列表 / 实例详情 / 文件 / 运行 / 审计 | 实例详情以完整对话为中心 |
| Creator | 包列表 / 包详情 / 调试回放 / 治理设置 | 所有专业能力收束在 Creator 内 |

### 5.3 路由建议

| 路由 | 页面 | 说明 |
|---|---|---|
| `/dashboard/workshops` | 工坊首页 | 默认落点 |
| `/dashboard/workshops/:workshopId` | 工坊详情 | 展示工坊内服务 |
| `/dashboard/services/:serviceId` | 服务详情 / 启动台 | 启动单实例或批量实例 |
| `/dashboard/instances` | 实例列表 | 多实例筛选与搜索 |
| `/dashboard/instances/:taskId` | 实例详情 | 完整对话页 |
| `/dashboard/instances/:taskId/files` | 文件页 | 文件树、路径切换、下载 |
| `/dashboard/instances/:taskId/runtime` | 运行页 | 状态、阶段、容器摘要 |
| `/dashboard/instances/:taskId/audit` | 审计页 | 授权、确认、异常记录 |
| `/dashboard/creator` | Creator 首页 | 包列表与统计 |
| `/dashboard/creator/packages/:packageId` | 包详情 | 工坊、服务、依赖、版本线 |
| `/dashboard/creator/packages/:packageId/debug` | 调试回放 | Trace 回放与差异对比 |
| `/dashboard/creator/governance/*` | 治理设置 | 凭证、成员、策略、审计、成本 |

## 6. App Shell 设计

### 6.1 外层结构

| 区域 | 内容 | 要求 |
|---|---|---|
| 顶栏 | 当前空间、全局搜索、语言切换、主题切换、通知、用户菜单 | 固定顶部，滚动不消失 |
| 左侧边栏 | 一级工作区导航、次级入口、收藏入口 | 抽屉式，可展开和折叠 |
| 主内容区 | 当前页面主工作面 | 保持稳定容器宽度和滚动规则 |
| 右侧上下文区 | 在实例页、Creator 页显示详情抽屉 | 支持按需展开、记忆上次状态 |

### 6.2 抽屉侧栏规则

| 状态 | 表现 | 行为 |
|---|---|---|
| 展开态 | 图标 + 文案 + 分组标题 | 默认桌面态 |
| 折叠态 | 图标列 + Tooltip | 用户可手动切换，记忆偏好 |
| Hover 展开 | 可选 | 仅在大屏启用 |
| 移动宽度下 | 变为覆盖式抽屉 | 平板断点以下自动切换 |

### 6.3 全局操作

| 操作 | 位置 | 说明 |
|---|---|---|
| 搜索服务 | 顶栏 / 工坊页 | 搜工坊、服务、标签 |
| 搜索实例 | 顶栏 / 实例页 | 搜任务名、标签、状态、发起人 |
| 语言切换 | 顶栏 | 至少支持 `zh-CN`、`en-US` |
| 主题切换 | 顶栏 | 明 / 暗主题即时切换 |
| 通知中心 | 顶栏 | 审批、失败、完成、提及 |

## 7. 页面布局与模块要求

### 7.1 工坊工作区

#### 页面目标

- 做真实服务分发
- 帮用户快速理解服务适用场景
- 承接单次启动与批量启动

#### 布局结构

| 区域 | 模块 |
|---|---|
| 头部 | 空间切换摘要、搜索、筛选、推荐标签 |
| 主体上半区 | 推荐工坊、企业工坊、最近使用 |
| 主体下半区 | 服务卡列表、分类筛选、排序、状态标签 |
| 侧边区 | 最近启动、收藏服务、批量启动入口 |

#### 服务详情页模块

| 模块 | 内容 |
|---|---|
| 服务头部 | 名称、所属工坊、Creator、使用量、成功率 |
| 服务说明 | 用途、边界、输入要求、结果类型 |
| 输出样例 | 文件样例、回执样例、媒体样例 |
| 授权与风险 | 需要的连接器、浏览器访问、审批说明 |
| 启动区 | 立即启动、批量启动、预算确认 |

### 7.2 实例工作区

#### 页面目标

- 支持用户管理多个实例
- 在单个实例中与 Codex 完整对话
- 同时查看文件、运行、审计信息

#### 标准布局

| 区域 | 内容 | 要求 |
|---|---|---|
| 顶部摘要栏 | 服务名、实例状态、负责人、最近更新时间、标签、快捷操作 | 可折叠 |
| 左栏实例列表 | 状态分组、自定义标签、搜索、排序、实例卡片 | 固定宽度，支持虚拟列表 |
| 中栏对话区 | 完整消息流、输入框、上传入口、审批卡片、结果卡片 | 唯一主工作面 |
| 右栏详情抽屉 | 详情 / 文件 / 运行 / 审计 四个分段 | 可切换、可收起 |

#### 左栏实例列表要求

| 维度 | 要求 |
|---|---|
| 列表来源 | 全部实例、我发起的、待我处理、运行中、失败、自定义标签 |
| 检索能力 | 关键字、标签、服务、工坊、负责人、时间 |
| 卡片字段 | 标题、服务名、状态、下一动作、更新时间、未读数 |
| 高亮规则 | 待审批、失败、产物已生成、有人提及时显著提示 |

#### 中栏对话工作面要求

| 编号 | 要求 |
|---|---|
| 1 | 用户与 Codex 进行持续完整对话 |
| 2 | 系统引导消息必须可见，并保留首轮收集上下文 |
| 3 | 审批卡片、文件卡片、结果卡片、错误卡片以内联方式进入消息流 |
| 4 | 输入区固定底部，支持文本、拖拽上传、粘贴上传、引用回复 |
| 5 | 多实例切换时保留滚动位置、未读位置、输入草稿 |
| 6 | 支持从通知、搜索、审计记录深链到特定消息 |
| 7 | 对话区需支持长时间滚动性能优化和增量渲染 |

#### 右栏详情抽屉要求

| 分段 | 内容 | 操作 |
|---|---|---|
| 详情 | 服务信息、负责人、最近事件、授权状态 | 查看、复制、跳转 |
| 文件 | 当前实例文件树、下载记录、最近目录、预览 | 下载、预览、切换路径 |
| 运行 | 阶段状态、容器摘要、MCP 摘要、耗时成本 | 查看阶段、导出摘要 |
| 审计 | 审批记录、授权记录、异常记录、确认记录 | 筛选、导出 |

### 7.3 Creator 工作区

#### 页面目标

- 以包为单位管理工坊能力
- 将业务表达、Session 资产、发布和治理串起来
- 承载专业调试和治理能力
- 当前正式工程已接通 package 详情、release/replay/gate/activation 查询与写入，以及 credentials / MCP governance 基础读写

#### Creator 首页结构

| 区域 | 内容 |
|---|---|
| 顶部概览 | 包数量、服务数量、最近发布、异常实例、待处理治理事项 |
| 左栏包列表 | 包名称、状态、最后发布时间、所有者 |
| 中栏包详情 | 工坊信息、服务列表、依赖摘要、版本线 |
| 右栏操作区 | 发布、回滚、灰度、停用、调试入口 |

#### 包详情的四个核心页签

| 页签 | 内容 |
|---|---|
| 服务 | 用户侧名称、封面、描述、输入说明、结果定义 |
| 依赖 | MCP 绑定、凭证域、网络权限、审批节点、运行策略 |
| 版本 | Session 版本、发布状态、灰度范围、回滚点 |
| 调试 | Trace 摘要、最近失败、回放入口、差异对比 |

### 7.4 Creator 治理设置

| 模块 | 内容 |
|---|---|
| 凭证管理 | 第一方和第三方凭证域、轮换、作用范围 |
| 成员管理 | 角色、空间、包权限、实例查看权限 |
| 策略管理 | 网络白名单、MCP 白名单、预算、审批策略 |
| 审计中心 | 操作审计、执行审计、MCP 调用审计、授权审计、导出；按 package 关联服务聚合真实 MCP 调用轨迹 |
| 成本中心 | 服务成本、实例成本、组织成本、预算预警；补齐 `mcp_calls` 账本摘要、最近计量事件与 MCP 调用审计联查 |

## 8. 多语言设计

Dashboard 必须支持多语言。

### 8.1 语言范围

| 语言 | 状态 |
|---|---|
| `zh-CN` | 首发必做 |
| `en-US` | 首发必做 |
| 其他语言 | 保留扩展能力 |

### 8.2 文案治理规则

| 规则 | 说明 |
|---|---|
| 文案来源统一 | 所有界面文案进入 i18n 字典，禁止硬编码 |
| 命名空间拆分 | `common`、`workshops`、`instances`、`creator`、`governance`、`errors` |
| 动态文案 | 状态标签、时间文案、金额文案通过格式化器生成 |
| 服务文案 | 服务描述字段允许后台按语言维度配置 |
| 日志内容 | Codex 对话内容不做机器翻译，按原文显示 |

### 8.3 工程实现建议

| 项目 | 方案 |
|---|---|
| i18n 库 | `i18next + react-i18next` |
| 时区与日期 | `Intl.DateTimeFormat` 封装统一工具 |
| 数字与金额 | `Intl.NumberFormat` |
| 语言持久化 | 用户设置 > 本地缓存 > 浏览器语言 |

## 9. 视觉与主题实现

### 9.1 主题要求

| 主题 | 要求 |
|---|---|
| 浅色主题 | 用于日常管理与白天环境 |
| 深色主题 | 用于长时间对话、监控式工作 |

### 9.2 Token 分类

| 类别 | 示例 |
|---|---|
| 颜色 | 背景、分割线、文本、强调色、状态色 |
| 阴影 | 抽屉、浮层、悬浮面板 |
| 圆角 | 按钮、卡片、输入框、面板 |
| 间距 | 页面边距、模块间距、列表密度 |
| 动效 | 抽屉开合、消息进入、状态切换 |

### 9.3 图标体系

| 项目 | 要求 |
|---|---|
| 图标风格 | 现代扁平线性图标 |
| 图标来源 | 统一图标库，禁止混搭多套视觉语言 |
| 状态反馈 | 成功、处理中、警告、失败图标语义清晰 |

## 10. 固定技术栈要求

### 10.1 主栈定稿

| 层级 | 固定选型 | 约束说明 |
|---|---|---|
| 工程模式 | `React SPA` | Dashboard 固定为单页应用 |
| 构建工具 | `Vite 5+` | 固定使用 Vite 构建与开发服务器 |
| 包管理 | `pnpm workspace` | 固定纳入仓库统一依赖与共享包管理 |
| 运行时基线 | `Node.js 22 LTS` | 本地开发、CI 构建、脚本执行统一版本族 |
| 主框架 | `React 18` | 页面、组件、状态订阅全部基于 React |
| 组件模型 | `React 函数组件 + Hooks` | 新增页面、组件、hooks 固定采用函数式实现 |
| 语言 | `TypeScript 5.x` | 全量页面、组件、hooks、状态层统一使用 TS |
| 代码质量 | `oxlint + TypeScript build` | 正式交付必须经过 lint 与类型构建门禁 |
| 路由 | `React Router 6+` | 固定采用层级路由与深链结构 |
| 服务端状态 | `TanStack Query 5` | 固定管理查询缓存、失效、重拉与乐观更新 |
| 客户端状态 | `Zustand` | 固定管理抽屉、筛选、草稿、选择态 |
| 样式方案 | `@lingban/ui-tokens + CSS Variables + Scoped CSS` | 固定承载方案 C 的主题、颜色变量与组件层样式 |
| 表单 | `React Hook Form` | Creator、治理、筛选等复杂表单阶段统一接入 |
| 国际化 | `i18next + react-i18next` | Dashboard 多语言能力固定接入 |
| 数据表格 | `TanStack Table` | 实例列表、审计、治理表格阶段统一使用 |

### 10.1.0 Dashboard 主栈包冻结清单

| 类别 | 必选包 | 说明 |
|---|---|---|
| React 运行时 | `react`、`react-dom` | 页面、组件、消息流、抽屉、路由容器 |
| 构建链 | `vite`、`@vitejs/plugin-react` | 本地开发、构建、预览 |
| 路由 | `react-router-dom` | 工坊 / 实例 / Creator 深链 |
| 数据与状态 | `@tanstack/react-query`、`zustand` | 服务端缓存与本地 UI 状态 |
| 多语言 | `i18next`、`react-i18next` | Dashboard 首发双语能力 |
| 共享层 | `@lingban/contracts`、`@lingban/domain-models`、`@lingban/api-sdk`、`@lingban/ui-tokens` | 协议、SDK、主题 token 统一来源 |

### 10.1.1 技术栈执行约束

| 类别 | 固定要求 | 作用 |
|---|---|---|
| 应用框架 | `React 18.3.x` | 承载全部页面、组件、消息流与工作台交互 |
| 构建器 | `Vite 5.x` | 本地开发、构建、预览统一收口 |
| 路由 | `React Router 6+` | 支持工坊、实例、Creator 深链直达 |
| 服务端状态 | `TanStack Query 5` | 管理查询缓存、失效、重拉与乐观更新 |
| 本地状态 | `Zustand 5` | 管理抽屉、筛选、草稿、选中态与 UI 协同状态 |
| 表单 | `React Hook Form` | 承载治理设置、发布配置、筛选表单，进入该阶段时强制启用 |
| 国际化 | `i18next + react-i18next` | 支撑 Dashboard 多语言切换 |
| 表格 | `TanStack Table` | 承载实例列表、审计账本、治理列表，进入该阶段时强制启用 |
| 样式 | `@lingban/ui-tokens + CSS Variables + Scoped CSS` | 统一方案 C 的颜色、间距、圆角与明暗主题 |
| 包管理 | `pnpm workspace` | 与共享包、根级脚本和统一 lockfile 对齐 |

### 10.1.2 当前仓库落地状态

| 类别 | 当前依赖 / 版本族 | 用途 | 状态 |
|---|---|---|---|
| 主框架 | `react@18.3.1`、`react-dom@18.3.1` | 承载页面与组件渲染 | 已落地 |
| 构建链 | `vite@5.4.x`、`@vitejs/plugin-react@5.x` | 本地开发、构建、预览 | 已落地 |
| 路由 | `react-router-dom@6.30.x` | 工坊 / 实例 / Creator 深链 | 已落地 |
| 服务端状态 | `@tanstack/react-query@5.85.x` | 列表、详情、实时快照缓存 | 已落地 |
| 本地状态 | `zustand@5.0.x` | 抽屉、筛选、草稿、本地 UI 态 | 已落地 |
| 语言与类型 | `typescript@5.8.x`、`@types/react`、`@types/node` | 类型检查与 IDE 约束 | 已落地 |
| 代码检查 | `oxlint@1.71.x` | 前端 lint 基线 | 已落地 |
| 工程脚本 | `dev=vite`、`build=tsc -b && vite build`、`lint=oxlint`、`preview=vite preview` | 工程身份与交付门禁 | 已落地 |
| API 接入 | `@lingban/api-sdk` | Runs API 统一请求入口 | 已落地 |
| 协议模型 | `@lingban/contracts`、`@lingban/domain-models` | 协议解析、领域投影 | 已落地 |
| 多语言 | `i18next@26.3.4`、`react-i18next@17.0.8` | Dashboard 双语切换 | 已落地 |
| 设计系统 | `@lingban/ui-tokens`、`CSS Variables` | 正式主题与 token 收口 | 已落地 |
| 复杂表单主栈 | `React Hook Form` | 治理表单、发布配置、复杂筛选 | 未接入，冻结选型 |
| 表格主栈 | `TanStack Table` | 实例治理表格与审计账本 | 未接入，冻结选型 |

### 10.1.3 React + Vite 工程实施细则

| 维度 | 固定要求 | 落地说明 |
|---|---|---|
| 前端主栈 | `React + Vite` | Dashboard 是唯一正式 Web 工程，固定运行在浏览器侧 SPA 模式 |
| 启动入口 | `src/main.tsx` | 应用挂载、全局 provider、路由容器统一从该入口启动 |
| App Shell | `src/app/*` | 主题、语言、Query Client、路由守卫、Shell 状态集中在应用层 |
| 工程身份判定 | `package.json` + `vite.config.*` + `src/main.tsx` | 通过正式脚本、Vite 配置、入口文件即可判定 Dashboard 主栈身份 |
| 路由组织 | `src/app/router` + `react-router-dom` | 一级工作区固定为 `workshops / instances / creator` |
| 页面域 | `src/pages/*` | 页面域与工作区一一对应，禁止跨域堆叠页面逻辑 |
| 业务模块 | `src/features/*` | 对话、文件、审计、治理等能力按 feature 收口 |
| API 接入 | `@lingban/api-sdk` | 页面与 hooks 不直接散落 `fetch` |
| 实时通信 | `src/lib` 或 `src/services` | WebSocket / SSE 封装统一管理断线重连、事件去重、增量写入 |
| 多语言 | `i18next + react-i18next` | `zh-CN`、`en-US` 为首发正式语言，文案进入字典域治理 |
| 主题 | `@lingban/ui-tokens + CSS Variables` | 明暗主题切换、品牌 token、状态色映射统一在主题层落地 |
| 构建产物 | `dist/` | Vite 产物仅包含 Dashboard 静态资源，不包含服务端逻辑 |
| 开发命令 | `pnpm dev / pnpm build / pnpm lint / pnpm preview` | 本地开发、构建验收、代码检查、预览链路固定走 Vite |
| 代码检查 | `pnpm lint` + `tsc -b` | lint 与类型构建同属正式交付门禁，不能以页面可打开替代 |
| 禁止项 | `Next.js`、`Umi`、`Remix`、`@tarojs/*` 页面运行时 | 防止 Dashboard 被改造成混合宿主工程 |

### 10.1.4 React + Vite 守门规则

| 检查项 | 固定要求 | 说明 |
|---|---|---|
| 工程身份 | `app/dashboard` 是唯一直接使用 `Vite` 作为应用构建器的前端工程 | 移动端虽然依赖 `@tarojs/vite-runner`，但不属于独立 Vite 应用 |
| `package.json` 脚本 | `dev` 固定为 `vite`，`build` 固定为 `tsc -b && vite build`，`preview` 固定为 `vite preview` | 脚本定义必须清楚表达 React + Vite 工程身份 |
| 必选依赖 | `react`、`react-dom`、`vite`、`@vitejs/plugin-react`、`react-router-dom`、`@tanstack/react-query`、`zustand` | 缺失任一主依赖视为主栈漂移 |
| 组件实现 | 新增页面、组件、布局与工作面固定采用 `React 函数组件 + Hooks` | 不接受 class component 或第二套页面抽象模型 |
| H5 边界 | Dashboard 不承载移动端 H5 页面，也不创建第二套移动 Web 壳 | H5 固定归属 `app/mobile` 的 `Taro H5 target` |
| 页面归属 | 工坊后台、实例治理、Creator、审计、多语言工作台页面全部归属 Dashboard | 不承接轻量移动端壳或小程序专属页面 |
| 路由归属 | 所有业务深链统一走 `React Router` | 不引入 Taro 页面配置或小程序式页面注册 |
| 平台边界 | 仅接入浏览器 Web 能力，统一经 `src/lib` 或 `src/services` 封装 | 不直接承接小程序平台 API |
| 架构审批 | 新增 SSR 框架、第二状态主栈、第二样式主栈需架构评审 | 默认保持当前 `React + Vite` 单主栈 |

### 10.1.5 React + Vite 交付门禁

| 检查项 | 必须满足 |
|---|---|
| 工程身份 | `app/dashboard` 仍是唯一正式 Web Dashboard 工程 |
| 构建脚本 | `dev` 为 `vite`，`build` 为 `tsc -b && vite build`，`preview` 为 `vite preview` |
| 代码检查 | `pnpm lint` 必须通过，且 `build` 内置 `tsc -b` 必须通过 |
| 主依赖形态 | 保留 `react`、`react-dom`、`vite`、`@vitejs/plugin-react`、`react-router-dom`、`@tanstack/react-query`、`zustand` |
| H5 边界 | 不新增移动端 H5 页面工程，不把移动端页面路由并入 Dashboard |
| 路由实现 | 业务深链全部走 `React Router`，不存在 Taro 页面注册 |
| 导入边界 | 不从 `app/mobile` 导入页面、组件、hooks、stores；共用逻辑必须经 `packages/*` 暴露 |
| 平台边界 | 文件下载、通知、WebSocket / SSE、剪贴板等能力统一经 Web 适配层封装 |
| 构建验收 | 合并前至少通过 `pnpm lint` 与 `pnpm build` |
| 文档同步 | 如变更工程脚本、主依赖、共享边界，必须同步更新 `docs/前端需求.md` 与本文件 |

### 10.2 工程约束

| 项目 | 固定要求 |
|---|---|
| 根目录 | 固定在 `app/dashboard` |
| 入口文件 | 使用 `src/main.tsx` 与 `src/app/*` 组织启动流程 |
| 路由组织 | 按 `workshops / instances / creator` 三大工作区拆分 |
| 工程边界 | 仅承担 Web Dashboard，禁止承载小程序/H5 页面产物 |
| 框架边界 | 不引入 `Next.js`、`Umi`、`Remix` 等替代性应用框架 |
| 明暗主题 | 通过 CSS Variables 切换，禁止维护双份样式代码 |
| 样式边界 | 固定使用 `@lingban/ui-tokens + CSS Variables + Scoped CSS`，未经评审不引入第二套样式主栈 |
| 类型约束 | 接口类型、页面 props、store state 必须显式声明 |
| UI 状态层 | 不引入第二套全局状态库 |
| 共享代码边界 | 与移动端仅共享类型、协议、纯函数、设计 token，不共享依赖 DOM 的页面实现 |
| 页面能力接入 | 文件下载、剪贴板、浏览器通知、WebSocket/SSE 必须经 `src/lib` 或 `src/services` 适配层收口 |
| 包边界 | 不在页面目录直接定义请求 SDK、协议类型或跨页通用常量 |

### 10.2.1 共享包与环境变量约束

| 项目 | 固定要求 | 说明 |
|---|---|---|
| 共享协议包 | `@lingban/contracts` | 所有请求响应、实时消息结构统一来源 |
| 共享领域包 | `@lingban/domain-models` | 快照投影、运行映射、纯函数适配统一来源 |
| 共享请求包 | `@lingban/api-sdk` | 页面与 hooks 一律通过 SDK 调 API |
| 共享设计包 | `@lingban/ui-tokens` | 设计 token 统一来源，禁止双份主题常量 |
| API 环境变量 | `VITE_API_BASE_URL` | Dashboard API 基址统一经 Vite 环境变量注入 |
| 页面导入边界 | 禁止从 `app/mobile` 导入页面、组件、stores、hooks | Dashboard 只消费 `packages/*` 共用层 |

### 10.3 依赖边界

| 类别 | 允许范围 |
|---|---|
| UI 组件 | React 原生组件、项目内组件、必要的表格/表单依赖 |
| 数据层 | `TanStack Query`、项目内 API SDK |
| 路由层 | `React Router` |
| 样式层 | 项目内样式文件、CSS Modules、`@lingban/ui-tokens`、CSS Variables |
| 实时层 | 项目内 WebSocket / SSE 封装 |

### 10.3.1 禁止引入项

| 类别 | 禁止项 | 原因 |
|---|---|---|
| 应用框架 | `Next.js`、`Umi`、`Remix` | 与固定 SPA 结构冲突 |
| 状态管理 | `Redux Toolkit`、`MobX`、`Recoil` | 状态栈分裂，提升维护成本 |
| 请求层 | 页面内直接 `fetch` 散落调用 | 破坏 API SDK 与缓存一致性 |
| 跨端运行时 | `@tarojs/*` 页面 API、页面生命周期、路由体系 | Dashboard 不承载 Taro 运行时 |
| 样式层 | 页面内大段行内 style 与双份主题样式 | 破坏主题与 token 一致性 |
| 样式主栈 | 未经评审引入新的 utility CSS 框架或整套 UI 框架 | 破坏当前样式边界与主题一致性 |
| 多语言 | 页面内硬编码语言切换逻辑 | 破坏 i18n 统一管理 |

### 10.4 开发命令与产物约束

| 项目 | 固定要求 |
|---|---|
| 本地开发 | 使用 `pnpm dev` 启动 `Vite` 开发服务器 |
| 生产构建 | 使用 `pnpm build` 输出静态前端产物 |
| 预览验证 | 使用 `pnpm preview` 或等价静态预览命令做构建验收 |
| 代码检查 | 使用 `pnpm lint` 执行 `oxlint`，使用 `pnpm build` 内置 `tsc -b` 作为类型闸门 |
| API 地址 | 本地默认读取 `VITE_API_BASE_URL`，未配置时回落到 `http://127.0.0.1:3100` |
| 产物定位 | 构建产物仅为 Dashboard 静态资源，不包含服务端执行逻辑 |
| CI 闸门 | 合并前至少通过 `pnpm lint` 与 `pnpm build` | 任何失败都视为未满足 Dashboard 交付基线 |
| 新依赖准入 | 新增依赖需说明作用域、替代关系、与 React + Vite 主栈的兼容性 | 防止无界膨胀 |

## 11. 推荐工程目录

```text
app/dashboard/
  src/
    app/
      router/
      providers/
    routes/
    pages/
      workshops/
      instances/
      creator/
    features/
      shell/
      search/
      notifications/
      workshops/
      services/
      instances/
      conversation/
      files/
      runtime/
      audit/
      creator/
      governance/
    components/
    stores/
    hooks/
    lib/
    locales/
    styles/
packages/ui-tokens/
packages/api-sdk/
packages/contracts/
packages/domain-models/
```

## 12. 状态管理模型

| Store / Query 域 | 内容 |
|---|---|
| shellStore | 侧栏折叠、当前主题、当前语言、通知抽屉状态 |
| workspaceQuery | 当前空间、可见范围、权限摘要 |
| workshopQuery | 工坊列表、服务列表、筛选条件 |
| instanceListStore | 当前筛选、自定义标签、排序、选中实例 |
| conversationStore | 当前实例消息、未读锚点、输入草稿、上传队列 |
| fileStore | 当前路径、展开目录、预览态、下载任务 |
| creatorStore | 当前包、当前页签、调试过滤器 |
| governanceQuery | 凭证、成员、策略、审计、成本 |

## 13. 实时通信与接口协作

### 13.1 通信模型

| 通道 | 用途 |
|---|---|
| HTTP | 页面查询、表单提交、下载、治理操作 |
| Realtime Gateway | 对话消息、实例状态、审批推送、文件变化推送 |

### 13.2 关键事件

| 事件名 | 说明 |
|---|---|
| `instance.message.created` | 新消息进入消息流 |
| `instance.status.changed` | 实例状态变更 |
| `instance.file.changed` | 文件生成、删除、更新 |
| `instance.approval.requested` | 审批到达 |
| `instance.result.ready` | 结果包可消费 |
| `governance.alert.created` | 成本、权限、策略告警 |

### 13.3 前端处理要求

| 场景 | 处理要求 |
|---|---|
| 当前实例在线 | 直接插入消息和文件卡片 |
| 非当前实例更新 | 更新左栏列表状态和未读数 |
| 断线重连 | 自动回补缺失事件并重算未读位置 |
| 重复事件 | 基于事件 ID 幂等去重 |

## 14. 文件与下载体验

| 场景 | 要求 |
|---|---|
| 文件列表 | 支持树形、列表、最近访问切换 |
| 路径切换 | 支持面包屑、快捷目录、直接路径输入 |
| 下载 | 支持单文件、多文件打包、失败重试 |
| 预览 | 文本、图片、PDF、视频、JSON 至少支持基础预览 |
| 权限 | 无权限时只展示文件元信息与申请入口 |

## 15. 组件清单

| 组件 | 用途 |
|---|---|
| `AppShell` | 顶栏 + 抽屉侧栏 + 内容区 |
| `WorkspaceSidebar` | 一级导航与空间上下文 |
| `WorkshopCard` | 工坊卡片 |
| `ServiceCard` | 服务卡片 |
| `InstanceRow` | 左栏实例卡片 |
| `ConversationPane` | 消息流与输入区 |
| `MessageCard` | 文本、系统、审批、文件、结果等消息类型 |
| `DetailDrawer` | 右侧详情抽屉 |
| `FileTree` | 文件树与路径切换 |
| `RuntimePanel` | 运行摘要面板 |
| `AuditPanel` | 审计记录面板 |
| `PackagePanel` | Creator 包详情 |
| `GovernanceTable` | 治理页通用表格 |

## 16. 验收清单

| 类别 | 验收点 |
|---|---|
| 结构 | 一级工作区固定为 `工坊 / 实例 / Creator` |
| 交互 | 左侧抽屉可折叠并记忆状态 |
| 对话 | 实例页可持续完整对话 |
| 文件 | 文件页支持路径切换与下载 |
| 治理 | Creator 内可进入凭证、成员、策略、审计、成本 |
| 国际化 | 中英文切换完整可用 |
| 主题 | 明暗主题完整可用 |
| 参照一致性 | 与 `style-c-operator-dashboard.html` 关键结构一致 |
