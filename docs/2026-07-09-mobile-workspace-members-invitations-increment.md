# 2026-07-09 Mobile 工作区成员与邀请增量

## 1. 本次目标

为 `app/mobile` 的“我的”页补齐真实的工作区协作能力，覆盖：

- 当前工作区成员摘要读取
- 当前账号待接受 workspace invitations 读取
- 基于 `acceptToken` 的移动端接受邀请流程
- 接受成功后的工作区切换联动

## 2. 代码变更

| 文件 | 变更 |
|---|---|
| `app/mobile/src/pages/me/index.tsx` | 新增 workspace members / my invitations 查询；新增 accept token 输入与接受流；新增当前工作区成员摘要卡片与待接受邀请卡片；通知摘要补入邀请提醒；当前工作区角色展示改为优先消费真实 `role` 字段 |

## 3. 新增能力

| 能力 | 说明 |
|---|---|
| 当前工作区成员摘要 | 读取 `GET /v1/workspaces/:workspaceId/members`，展示成员总数、生效中、已暂停、当前角色与前 5 名成员摘要 |
| 待接受邀请列表 | 读取 `GET /v1/auth/invitations`，仅展示 `pending` 邀请 |
| 接受邀请流 | 用户在移动端粘贴完整 `acceptToken` 后，调用 `POST /v1/auth/invitations/:invitationId/accept` |
| 接受后切换 | 接受成功后继续调用 `POST /v1/workspaces/switch`，优先切换到新加入工作区；若切换失败，仍回写最新 session envelope |

## 4. 文档同步

| 文件 | 同步内容 |
|---|---|
| `docs/仓库完成度与模块状态表.md` | 更新 mobile 完成度、我的页模块说明、数据装载层说明 |
| `docs/小程序开发文档.md` | 更新移动端真实数据接线范围与“空间协作”模块 |
| `docs/页面路由与接口映射总表.md` | 修正 Mobile 我的页真实后端覆盖范围 |
| `docs/我的页资产沉淀、授权摘要与工作区概览执行总表.md` | 修正我的页当前事实与真实数据入口描述 |
| `docs/认证初始化、会话刷新与工作区切换执行总表.md` | 标记 H5 我的页 members / invitations 接线已落地 |

## 5. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm exec tsc --noEmit` | 通过 |
| `pnpm build:h5` | 通过 |

## 6. 仍然未完成

| 主题 | 剩余缺口 |
|---|---|
| 资产域 | 我的页资产仍主要来自任务文件扁平化，不是正式资产读模型 |
| 通知域 | 我的页通知仍是页面内派生摘要，不是正式通知对象 |
| 收藏域 | 收藏工坊与服务仍未接入真实后端 |
| 小程序特化 | `weapp / alipay` 仍未完成专项适配与 QA |
