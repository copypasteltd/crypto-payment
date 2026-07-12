# 灵办词元 前端 E2E 基线增量说明（2026-07-08）

## 1. 变更目标

本次增量用于补齐双前端仓库在“自动化回归门禁”上的关键缺口，建立可重复执行的本地 Playwright 冒烟基线，覆盖：

| 端 | 目标 |
|---|---|
| Dashboard | 验证路由壳、主导航、深链实例页可用 |
| Mobile H5 | 验证首页、任务列表、任务详情、文件页、我的页主链可用 |

## 2. 本次落地内容

| 类别 | 落地内容 | 主要文件 |
|---|---|---|
| 测试构建编排 | 新增前端 E2E 专用构建脚本，统一构建 dashboard 与 mobile H5 产物 | `tests/e2e/build-frontends.mjs`、`package.json` |
| Dashboard 测试旁路 | 新增本地 E2E 鉴权禁用开关，避免静态冒烟被登录门阻断 | `app/dashboard/src/app/providers/DashboardAuthBootstrap.tsx` |
| Mobile 测试旁路 | 新增 H5 端本地 E2E 鉴权禁用开关，并在 Taro config 中显式注入测试环境变量 | `app/mobile/src/components/MobileAuthGate.tsx`、`app/mobile/config/index.ts` |
| H5 稳定锚点 | 为工坊页、任务页、任务详情页补充测试锚点，避免依赖脆弱文案或 DOM 结构 | `app/mobile/src/pages/workshops/index.tsx`、`app/mobile/src/pages/tasks/index.tsx`、`app/mobile/src/pages/tasks/detail.tsx` |
| Playwright 用例 | Mobile 用例改为真实点击导航，不再依赖直接深链；并对 `auth/session` 做路由拦截，稳定 bootstrap | `tests/e2e/specs/mobile.spec.mjs` |

## 3. 关键实现说明

### 3.1 Dashboard

| 项 | 说明 |
|---|---|
| 鉴权策略 | 通过 `VITE_E2E_AUTH_MODE=disabled` 直接短路 bootstrap |
| 数据策略 | 保持现有 sample/fallback 机制，不引入测试专用静态页面 |
| 覆盖范围 | `workshops`、`instances`、`creator`、实例深链文件页 |

### 3.2 Mobile H5

| 项 | 说明 |
|---|---|
| 鉴权策略 | 代码支持 `TARO_APP_E2E_AUTH_MODE=disabled`；同时在 Playwright 中拦截 `**/v1/auth/session` 返回 `{ authMode: "disabled" }`，确保冒烟稳定 |
| 路由策略 | 从首页点击进入 `任务`，再进入指定任务详情与文件页，不再假设 Taro H5 深链可直接等价于页面路由 |
| 稳定选择器 | 新增 `mobile-workshops-to-tasks`、`mobile-workshops-to-me`、`mobile-task-open-*`、`mobile-task-detail-open-files` |

## 4. 验证结果

### 4.1 执行命令

```bash
pnpm test:e2e:mobile
pnpm test:e2e
```

### 4.2 最终结果

| 命令 | 结果 |
|---|---|
| `pnpm test:e2e:mobile` | 3 passed |
| `pnpm test:e2e` | 6 passed |

### 4.3 最终通过用例

| Project | 用例 |
|---|---|
| `dashboard` | `loads workshops route and shell navigation` |
| `dashboard` | `navigates between core dashboard routes` |
| `dashboard` | `opens deep instance route directly` |
| `mobile-h5` | `loads workshops landing route` |
| `mobile-h5` | `navigates through task list, task detail, and files` |
| `mobile-h5` | `loads me page with workspace summary modules` |

## 5. 对仓库状态判断的影响

| 仓库 | 原判断 | 本次更新后的判断 |
|---|---|---|
| `agent-workshop-app` | 端侧 E2E 缺失 | 已建立 Mobile H5 Playwright 冒烟基线；微信/支付宝端 E2E 仍未开始 |
| `agent-workshop-dashboard` | E2E 回归缺口明显 | 已建立 Dashboard Playwright 冒烟基线；更深层 Creator 治理回归仍需补齐 |
| 全仓 | 前端与系统级 E2E 仍缺覆盖 | 前端双端冒烟基线已落地；跨仓运行态系统级 E2E 仍未闭环 |

## 6. 当前仍未覆盖的范围

| 类别 | 未覆盖内容 |
|---|---|
| Dashboard | Creator 深层写操作、权限差异、审批决策闭环 |
| Mobile H5 | live run 实时流、附件上传真链路、审批真写回 |
| System E2E | API + worker + container-bridge + container runtime 全链路 |
| Infra | Docker 真容器拉起、回收、异常恢复、Redis/BullMQ 生产形态 |

## 7. 结论

本次增量已经把“双前端没有端到端回归门禁”的结论收缩为“已有双前端冒烟门禁，但系统级运行链路 E2E 仍缺失”。这为后续继续补齐后端、worker、bridge、container 的生产级链路提供了稳定回归基线。
