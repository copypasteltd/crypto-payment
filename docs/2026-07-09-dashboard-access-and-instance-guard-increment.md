# 灵办词元 Dashboard 收口增量（2026-07-09）

## 1. 本轮目标

对 Dashboard 做一轮面向生产边界的前端收口，处理两类高风险问题：

| 问题 | 风险 |
|---|---|
| Creator 域缺少正式角色守卫 | 无法保证不同工作区角色看到的 Creator 能力边界一致 |
| 实例页对跨工作区 URL 存在静默跳转 | 用户可能在错误上下文里继续对话或下载文件 |

## 2. 已落地变更

### 2.1 Creator 访问控制

| 项目 | 结果 |
|---|---|
| Creator 工作区访问角色 | `owner / admin / creator` |
| Creator 治理动作访问角色 | `owner / admin` |
| 成员状态限制 | `membershipStatus = suspended` 时整体关闭 Creator 域 |
| 无权限工作区行为 | 侧栏 Creator 入口禁用；深链访问显示显式受限说明 |

### 2.2 Creator 真实数据链修正

| 项目 | 结果 |
|---|---|
| 认证工作区无 package | 显示正式空状态 |
| 样例包回填 | 已取消 |
| 顶栏搜索 package 结果 | 仅在具备 Creator 权限时展示 |
| 包数量统计 | 与 Creator 权限同步收口 |

### 2.3 实例页工作区边界修正

| 项目 | 结果 |
|---|---|
| 跨工作区实例 URL | 不再自动跳转到其他实例 |
| 越界实例反馈 | 显式提示该实例不属于当前工作区 |
| 空详情面板行为 | 保持列表可操作，等待用户重新选择实例或切换工作区 |
| 对话输入行为 | 越界实例状态下不允许在错误上下文继续发送消息 |

## 3. 涉及文件

| 文件 | 作用 |
|---|---|
| `app/dashboard/src/lib/accessControl.ts` | Creator 访问能力判定 |
| `app/dashboard/src/app/DashboardShell.tsx` | 侧栏、搜索、统计、Creator 导航权限收口 |
| `app/dashboard/src/pages/creator/CreatorPage.tsx` | Creator 空状态、权限提示、治理入口限权 |
| `app/dashboard/src/pages/instances/InstancesPage.tsx` | 跨工作区实例 URL 边界修正 |

## 4. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/dashboard lint` | 通过 |
| `pnpm -C app/dashboard build` | 通过 |

## 5. 对当前完成度的影响

| 仓库 | 变化 |
|---|---|
| `agent-workshop-dashboard` | 完成度更新为 `86% / 46%` |

## 6. 剩余缺口

| 类别 | 剩余事项 |
|---|---|
| Creator 深域 | cost/quota/review 的正式后端闭环仍未完成 |
| 数据链 | Dashboard 其他静态参考数据仍需继续退场 |
| 权限体系 | 当前已补齐前端守卫，后端 RBAC 与审计仍需继续加固 |
| 自动化 | 前端页面级 E2E 仍未补齐 |
