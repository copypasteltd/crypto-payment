# 2026-07-09 Dashboard Workspace Members Governance Increment

## 1. 目标

将 Dashboard Creator 治理面中的 `members` 分段从泛化的 governance summary / 静态参考块推进为真实的 workspace members / invitations 治理入口。

## 2. 本次落地内容

| 项 | 结果 |
|---|---|
| 真实成员列表 | 已接 `dashboardAuthApi.listWorkspaceMembers()` |
| 真实邀请列表 | 已接 `dashboardAuthApi.listWorkspaceInvitations()` |
| 创建邀请 | 已接 `createWorkspaceInvitation()`，并在 UI 中显示最新 accept token |
| 撤销邀请 | 已接 `revokeWorkspaceInvitation()` |
| 调整成员角色/状态 | 已接 `updateWorkspaceMember()` |
| 权限边界 | 仅 `owner / admin` 可见邀请治理与编辑动作；普通 Creator 仅可读成员列表 |
| 构建验证 | `pnpm -C app/dashboard build` 通过 |

## 3. 关键文件

| 文件 | 作用 |
|---|---|
| `app/dashboard/src/pages/creator/CreatorGovernancePanel.tsx` | 成员治理查询、mutation、成员/邀请渲染与编辑表单 |
| `app/dashboard/src/lib/api.ts` | 复用 `dashboardAuthApi` 作为成员治理 API 接入口 |
| `packages/api-sdk/src/index.ts` | 提供 workspace members / invitations SDK 方法 |

## 4. 交互结果

| 区块 | 当前行为 |
|---|---|
| 成员表 | 展示真实成员、角色、状态、更新时间 |
| 邀请表 | 展示真实邀请、角色、发起人、到期时间与备注 |
| 邀请创建卡 | 支持填写邮箱、目标角色、有效天数、备注，并回显最新 accept token |
| 待处理邀请卡 | 支持对 `pending` 邀请执行撤销 |
| 成员权限调整卡 | 支持对可管理成员修改角色或 `active/suspended` 状态 |

## 5. 仍未完成项

| 项 | 说明 |
|---|---|
| H5 成员治理 | 移动端“我的”页仍未接入正式成员治理界面 |
| Workspace preferences | Dashboard 仍未接入正式空间偏好读写 |
| Session revoke / 安全中心 | 账号安全页与设备会话管理仍未落地 |
