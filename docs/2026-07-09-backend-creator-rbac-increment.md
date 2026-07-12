# 2026-07-09 Backend Creator RBAC Increment

## 1. 目标

| 项 | 内容 |
|---|---|
| 收口主题 | Backend Creator RBAC |
| 目标 | 将 Dashboard 已存在的 Creator 角色守卫下沉到 `app/api`，补齐服务端对象级权限边界 |
| 日期 | 2026-07-09 |

## 2. 本轮实现

| 模块 | 改动 |
|---|---|
| `app/api/src/modules/auth/request-auth.ts` | 新增 `requireCurrentWorkspaceAccess()`，统一处理当前工作区 `membershipStatus + role` 校验 |
| `app/api/src/modules/creator/routes.ts` | Creator 读接口收口到 `owner / admin / creator`；治理与 activation 收口到 `owner / admin` |
| `app/api/src/modules/creator/service.ts` | 新增 package 可见性、workspaceContextKey 边界、治理动作权限校验；Creator 对象级权限从前端约定变为服务端事实 |
| `app/api/tests/creator-rbac.smoke.test.mjs` | 新增服务端 RBAC 烟测，覆盖角色限制、gate 决策级别、activation 权限、工作区切换与 package 隐身策略 |
| 既有 smoke 基线 | `creator-release-replay`、`billing-ledger`、`file-chain-postgres` 已同步迁移到新的权限模型 |

## 3. 当前权限矩阵

| 能力 | owner | admin | creator | operator | viewer |
|---|---:|---:|---:|---:|---:|
| package 列表/详情 | 是 | 是 | 是 | 否 | 否 |
| release / replay 读写 | 是 | 是 | 是 | 否 | 否 |
| gate 决策 | 按 gate 要求 | 按 gate 要求 | 仅 creator 级 gate | 否 | 否 |
| activation | 是 | 是 | 否 | 否 | 否 |
| governance summary / audit export | 是 | 是 | 否 | 否 | 否 |

## 4. 可见性与上下文规则

| 规则 | 当前实现 |
|---|---|
| package 可见性 | 只返回当前工作区可见 package；跨工作区按 `CREATOR_PACKAGE_NOT_FOUND` 处理 |
| context 越权 | 当前 token 不允许直接查询其他 `workspaceContextKey` 的治理视图 |
| route/service 分层 | route 拦基础角色；service 拦 package/context/gate/object-level 权限 |

## 5. 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test app/api/tests/creator-rbac.smoke.test.mjs app/api/tests/creator-release-replay.smoke.test.mjs app/api/tests/creator-launch-template-activation.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `29/29` 通过 |

## 6. 剩余缺口

| 缺口 | 说明 |
|---|---|
| Vault/KMS credentials broker | 仍未替换当前文件/元数据治理方式 |
| review 正式对象 | Creator review 工作流与独立对象模型未完全落地 |
| 前端全域 E2E | Dashboard / H5 尚未形成与后端 RBAC 对应的系统级自动化门禁 |
