# 2026-07-09 Workspace Membership & Invitations Increment

## 1. 目标

补齐 `app/api` 的工作区成员与邀请治理链路，形成可复用、可验证、可切换 file/postgres 存储后端的正式后端能力。

## 2. 本次落地范围

| 域 | 本次结果 |
|---|---|
| Auth Service | 已新增成员列表、邀请列表、我的邀请、创建邀请、接受邀请、撤销邀请、成员角色/状态变更 |
| Auth Routes | 已新增 `/v1/auth/invitations*` 与 `/v1/workspaces/:workspaceId/members|invitations*` |
| Auth Repository | 已补齐 `lingban_workspace_invitations` 的 file-backed / postgres-backed 读写能力 |
| SDK | `packages/api-sdk` 已新增成员/邀请相关 client 方法 |
| 测试 | 已新增 file-backed / postgres-backed 双模式 smoke，纳入 `app/api test:smoke` |

## 3. 关键文件

| 文件 | 作用 |
|---|---|
| `app/api/src/modules/auth/service.ts` | 成员与邀请治理主业务逻辑、角色约束、邀请 token 校验 |
| `app/api/src/modules/auth/routes.ts` | 暴露成员/邀请 HTTP 接口 |
| `app/api/src/modules/auth/repository.ts` | 持久化 invitations 与 workspace-scoped memberships |
| `app/api/src/modules/auth/storage-schema.ts` | `authState` 增加 invitations 结构 |
| `app/api/migrations/0013_auth_workspace_invitations.sql` | 正式建表与索引 |
| `packages/contracts/src/auth.ts` | 成员/邀请 schema 与输入输出契约 |
| `packages/api-sdk/src/index.ts` | 前端 SDK 方法补齐 |
| `app/api/tests/workspace-membership-invitations.scenario.mjs` | 双模式真实 API 场景脚本 |
| `app/api/tests/workspace-membership-invitations*.smoke.test.mjs` | file/postgres 回归入口 |

## 4. 实现要点

| 主题 | 当前实现 |
|---|---|
| 角色约束 | `owner` 可管理 `admin/creator/operator/viewer`，`admin` 可管理 `creator/operator/viewer` |
| 安全边界 | 自我成员变更禁止；`owner` 成员不可通过该接口变更；邀请接受要求邮箱匹配与 token 匹配 |
| 状态机 | invitation 支持 `pending / accepted / revoked / expired`；过期状态按 `expiresAt` 动态推导 |
| 会话联动 | 接受邀请后不强制切换当前工作区，但会刷新 `session.workspaces` 可见范围 |
| 存储切换 | file-backed 与 postgres-backed 共享同一 service 行为，fake postgres 已覆盖 migration 与 repository 写入 |

## 5. 新增接口

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/v1/auth/invitations` | 当前用户可接受的邀请列表 |
| `POST` | `/v1/auth/invitations/:invitationId/accept` | 当前用户接受邀请 |
| `GET` | `/v1/workspaces/:workspaceId/members` | 工作区成员列表 |
| `PATCH` | `/v1/workspaces/:workspaceId/members/:userId` | 修改成员角色或状态 |
| `GET` | `/v1/workspaces/:workspaceId/invitations` | 工作区邀请列表 |
| `POST` | `/v1/workspaces/:workspaceId/invitations` | 创建邀请 |
| `POST` | `/v1/workspaces/:workspaceId/invitations/:invitationId/revoke` | 撤销邀请 |

## 6. 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `pnpm -C packages/api-sdk build` | 通过 |
| `pnpm -C app/api exec node --test tests/workspace-membership-invitations.smoke.test.mjs` | 通过 |
| `pnpm -C app/api exec node --test tests/workspace-membership-invitations-postgres.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，当前 `32/32` |

## 7. 仍未完成项

| 项 | 说明 |
|---|---|
| Workspace preferences | 偏好读写与默认空间策略仍未落地 |
| Session revoke / 安全中心 | 设备级会话管理仍未建设 |
| 前端深页治理 UI | Dashboard / Mobile 对成员治理的正式界面仍待接线 |
