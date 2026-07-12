# 灵办词元 Creator包依赖与运行配置明细总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Creator包依赖与运行配置明细总表 |
| 适用范围 | `app/dashboard` Creator 工作区，`packages/contracts` 运行时契约，`app/run-worker` 运行物料生成链路，`app/container-bridge` MCP/凭证物化链路 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前代码中的 `creatorPackages`、`packageMeta`、`creatorOperationMeta`、`BridgeSessionContext`、`McpBinding`、`credentialMounts`、`container-launch-plan` 物化逻辑为准 |
| 直接证据 | `app/dashboard/src/pages/creator/CreatorPage.tsx`、`app/dashboard/src/data/dashboardData.ts`、`packages/contracts/src/runtime.ts`、`packages/contracts/src/common.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts` |
| 输出目标 | 将 Creator 包版本、依赖、运行配置、凭证挂载、MCP 绑定、发布绑定细化到正式对象和字段级别 |

## 2. 直接证据矩阵

| 证据位置 | 当前承载内容 | 对应正式域 |
|---|---|---|
| `creatorPackages` | Creator 包卡片、四个 tab 展示摘要 | `creator_package`、`package_version` |
| `packageMeta` | owner、updatedAt、releaseChannel、workshopIds、serviceIds、versionLine、dependencies | `package_version`、`package_dependency`、`release_binding` |
| `creatorOperationMeta` | rollout、alerts、actions | `release_order`、`release_gate`、`package_operation_policy` |
| `packages/contracts/src/runtime.ts` | `credentialMounts`、`mcpBindings`、`BridgeSessionContext` | `runtime_profile`、`credential_mount_profile`、`mcp_binding_profile` |
| `container-runtime.ts` | runtime env、secret materialization、mcp config、launch plan | `runtime_profile`、`launch_profile` |
| `mcp-materializer.ts` | stdio/remote server 物化规则 | `mcp_binding_profile` |

## 3. Creator 包版本装配输入矩阵

| 装配项 | 当前来源 | 正式对象 | 关键字段 | 是否必需 | 当前状态 |
|---|---|---|---|---|---|
| Session 资产版本 | `packageMeta.versionLine`、`creatorPackages[].session` | `package_version` | `session_version_id` | 是 | 仅前端展示 |
| Task 资产版本 | `packageMeta.versionLine` | `package_version` | `task_version_id` | 是 | 仅前端展示 |
| Runtime 镜像 | `creatorPackages[].runtime`、`img: ...` 文本 | `runtime_profile` | `runtime_image_ref` | 是 | 仅文案表达 |
| 依赖项清单 | `packageMeta.dependencies`、`creatorPackages[].connectors.items` | `package_dependency` | `dependency_type`、`dependency_ref` | 是 | 无正式对象 |
| 工作区挂接 | `packageMeta.workshopIds`、`packageMeta.serviceIds` | `package_workspace_binding` | `workspace_id`、`workshop_id`、`service_id` | 是 | 无正式对象 |
| 发布通道 | `packageMeta.releaseChannel` | `release_channel_binding` | `channel` | 是 | 仅前端元数据 |
| 审批与策略 | `creatorOperationMeta.actions`、治理页 policy | `package_operation_policy` | `approval_required`、`policy_ref` | 是 | 分散在页面文案 |
| 凭证挂载 | 运行时 `credentialMounts` | `credential_mount_profile` | `credential_id`、`mode` | 视依赖而定 | 运行时已存在契约 |
| MCP 绑定 | 运行时 `mcpBindings` | `mcp_binding_profile` | `binding_id`、`source`、`transport`、`ref` | 视依赖而定 | 运行时已存在契约 |

## 4. `runtime_profile` 字段总表

| 字段 | 类型 | 当前证据 | 用途 | 当前状态 |
|---|---|---|---|---|
| `runtime_profile_id` | string | 待新增 | Runtime 配置主键 | 缺失 |
| `runtime_image_ref` | string | `container-runtime.ts` 中 `LINGBAN_RUNNER_IMAGE` | 固定运行镜像 | 半成品 |
| `codex_cli_version` | string | 待从 runner image 固化 | 固定 Codex CLI 版本 | 缺失 |
| `node_version` | string | runner image 基础环境 | 固定 Node 版本 | 文档层已有，代码未建模 |
| `python_version` | string | runner image 基础环境 | 固定 Python 版本 | 文档层已有，代码未建模 |
| `playwright_browsers_path` | string | `PLAYWRIGHT_BROWSERS_PATH` | 浏览器运行时路径 | 已有环境变量 |
| `working_directory` | string | `containerLaunchPlan.workingDirectory` | 容器默认工作目录 | 已有 |
| `entrypoint` | string[] | `node /opt/lingban/container-bridge/dist/cli.js` | 容器入口命令 | 已有 |
| `network_policy_ref` | string | `McpBinding.networkPolicyRef`、`LINGBAN_RUNNER_NETWORK` | 出网策略绑定 | 半成品 |
| `teardown_policy` | string | `removeOnExit: true` | 运行结束后的销毁规则 | 半成品 |
| `resource_profile` | object | `cpus`、`memory`、`pidsLimit` | 资源配额模板 | 已有 |
| `mount_profile` | object[] | `mounts` | 目录挂载策略 | 已有 |
| `health_probe` | object | `bridge-runner` 中 `/health` | 启动成功探针 | 半成品 |
| `log_policy` | object | `logsPath` 挂载 | 运行日志落点 | 半成品 |

## 5. 容器挂载剖面矩阵

| 挂载目录 | Host 路径 | Container 路径 | 读写属性 | 用途 |
|---|---|---|---|---|
| `target` | `hostPaths.targetPath` | `containerPaths.targetPath` | 读写 | 工作目录与最终文件编辑 |
| `inputs` | `hostPaths.inputsPath` | `containerPaths.inputsPath` | 读写 | 用户上传与系统注入输入材料 |
| `outputs` | `hostPaths.outputsPath` | `containerPaths.outputsPath` | 读写 | 结果输出与待归档产物 |
| `state` | `hostPaths.statePath` | `containerPaths.statePath` | 读写 | 中间态与运行状态文件 |
| `runtime` | `hostPaths.runtimePath` | `containerPaths.runtimePath` | 读写 | runtime config、mcp config、bridge context |
| `codex-home` | `hostPaths.codexHomePath` | `containerPaths.codexHomePath` | 读写 | Codex HOME |
| `home` | `hostPaths.homePath` | `containerPaths.homePath` | 读写 | 容器 HOME |
| `tmp` | `hostPaths.tmpPath` | `containerPaths.tmpPath` | 读写 | 临时文件 |
| `browser-profile` | `hostPaths.browserProfilePath` | `containerPaths.browserProfilePath` | 读写 | 浏览器 profile |
| `mcp` | `hostPaths.mcpPath` | `containerPaths.mcpPath` | 读写 | MCP 物化配置与状态 |
| `secrets` | `hostPaths.secretsPath` | `containerPaths.secretsPath` | 只读 | 文件型凭证 |
| `logs` | `hostPaths.logsPath` | `containerPaths.logsPath` | 读写 | 日志与诊断输出 |

## 6. `credential_mount_profile` 字段总表

| 字段 | 类型 | 当前契约 | 用途 | 当前状态 |
|---|---|---|---|---|
| `credential_mount_id` | string | 待新增 | 凭证挂载主键 | 缺失 |
| `credential_id` | string | `credentialId` | 凭证引用 | 已有 |
| `mode` | `env / file` | `credentialMount.mode` | 挂载方式 | 已有 |
| `env_name` | string \| null | `envName` | 环境变量注入名 | 已有 |
| `mount_path` | string \| null | `mountPath` | 文件挂载路径 | 已有 |
| `read_only` | boolean | `readOnly` 固定为 `true` | 权限控制 | 已有 |
| `scope` | `workspace / package_version / run` | 待新增 | 作用范围 | 缺失 |
| `rotation_policy_ref` | string \| null | 待新增 | 轮换策略引用 | 缺失 |
| `audit_required` | boolean | 待新增 | 是否记入治理审计 | 缺失 |

## 7. 凭证挂载模式执行矩阵

| 模式 | 当前代码行为 | 适用场景 | 风险控制 |
|---|---|---|---|
| `env` | `buildSecretMaterialization()` 将 `credentialId -> envName` 写入 `env` 清单 | API Key、短 token | 禁止在会话文本中回显 |
| `file` | host 文件路径映射为 container 文件路径，只读挂载 | 浏览器 cookie、证书、配置文件 | 只读挂载、容器销毁后失效 |

## 8. `mcp_binding_profile` 字段总表

| 字段 | 类型 | 当前契约 | 用途 | 当前状态 |
|---|---|---|---|---|
| `binding_id` | string | `bindingId` | MCP 绑定主键 | 已有 |
| `source` | `first-party / workspace-managed / third-party` | `source` | 标识管控来源 | 已有 |
| `transport` | `stdio / http / sse / websocket` | `transport` | 标识连接方式 | 已有 |
| `ref` | string | `ref` | 本地命令或远端地址 | 已有 |
| `credential_id` | string \| null | `credentialId` | 关联凭证 | 已有 |
| `auth_mode` | `env / file / null` | `authMode` | 认证注入方式 | 已有 |
| `auth_ref` | string \| null | `authRef` | 认证变量名或文件路径 | 已有 |
| `network_policy_ref` | string \| null | `networkPolicyRef` | 出网策略绑定 | 已有 |
| `approval_required` | boolean | `approvalRequired` | 是否需要用户审批 | 已有 |
| `health_check_ref` | string \| null | 待新增 | 连接探测规则 | 缺失 |
| `sandbox_profile_ref` | string \| null | 待新增 | 第三方 MCP 隔离级别 | 缺失 |

## 9. MCP 物化规则矩阵

| 条件 | 物化结果 | 当前证据 | 运行含义 |
|---|---|---|---|
| `transport = stdio` 且 `ref` 为 js/mjs/cjs | `local-process`，命令为 `node`，参数为 `ref` | `container-runtime.ts`、`mcp-materializer.ts` | 容器内本地进程型 MCP |
| `transport = stdio` 且 `ref` 为可执行文件 | `local-process`，命令为 `ref` | 同上 | 容器内本地可执行 MCP |
| `transport != stdio` 且 `source != third-party` | `remote-managed` | 同上 | 第一方或工作区托管远端 MCP |
| `transport != stdio` 且 `source = third-party` | `remote-unmanaged` | 同上 | 不受控第三方远端 MCP |
| `authMode = env` | 写入 `auth_env` | 同上 | 通过环境变量认证 |
| `authMode = file` | 写入 `auth_file` | 同上 | 通过文件路径认证 |

## 10. 发布绑定与可见性矩阵

| 对象 | 关键字段 | 用途 | 当前来源 | 当前状态 |
|---|---|---|---|---|
| `package_workspace_binding` | `workspace_id`、`package_version_id` | 允许哪个工作区使用哪个版本 | `packageMeta.workshopIds/serviceIds` | 缺失正式对象 |
| `release_channel_binding` | `channel`、`enabled`、`rollout_percent` | 标识发布到哪个通道、灰度比例 | `packageMeta.releaseChannel`、`creatorOperationMeta.rollout` | 缺失正式对象 |
| `service_binding` | `service_id` | 绑定工坊下具体服务 | `serviceIds[]` | 缺失正式对象 |
| `workshop_binding` | `workshop_id` | 绑定工坊目录曝光 | `workshopIds[]` | 缺失正式对象 |

## 11. Creator 页面与正式对象映射表

| 页面区域 | 当前字段 | 正式对象 | 说明 |
|---|---|---|---|
| Package 列表卡片 | `title`、`source`、`status` | `creator_package` | 顶层包摘要 |
| Session 页签 | `session.summary`、`session.items[]` | `package_version`、`session_version` | Session 资产版本与摘要 |
| Runtime 页签 | `runtime.summary`、`runtime.items[]` | `runtime_profile` | 运行环境、挂载和资源配置 |
| Connectors 页签 | `connectors.summary`、`connectors.items[]` | `package_dependency`、`mcp_binding_profile`、`credential_mount_profile` | MCP 与凭证依赖 |
| Release 页签 | `release.summary`、`release.items[]` | `release_channel_binding`、`release_gate` | 发布通道与审核门 |
| Governance 子页 | `credentials/members/policy/audit/cost` | `credential_domain`、`workspace_policy`、`audit_policy`、`quota_policy` | 治理对象集合 |

## 12. 当前正式化缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| `runtime_profile` 未建模 | 运行配置散落在文案、环境变量、launch plan | 无法版本化对比运行环境 | P0 |
| `package_dependency` 未结构化 | 依赖只存在字符串列表 | 无法校验发布前依赖完整性 | P0 |
| `credential_mount_profile` 缺少作用域 | 只有运行时 mount，没有治理层实体 | 无法做工作区级治理和轮换 | P0 |
| `mcp_binding_profile` 缺少健康探测与隔离策略 | 仅有 source/transport/ref | 无法正式接入第三方不受控 MCP | P0 |
| 发布绑定缺少正式对象 | `workshopIds/serviceIds/releaseChannel` 只是前端元数据 | 工坊目录、服务目录、发布通道无法联动 | P0 |

## 13. 当前已验证依赖与运行配置基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| Runtime env 组装 | 已实现 | `app/run-worker/src/services/container-runtime.ts` |
| Secret 物化 | 已区分 `env / file` | `container-runtime.ts` |
| MCP 物化 | 已按 `stdio / remote-managed / remote-unmanaged` 生成配置 | `container-runtime.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts` |
| Container launch plan | 已输出 mounts、labels、resources、commandPreview | `container-runtime.ts` |
| Creator 依赖展示 | 当前仅前端 `dependencies[]` 文案 | `CreatorPage.tsx` |
| Runtime profile 正式对象 | 未实现 | 当前无 `runtime_profile` 后端域 |

## 14. 当前权威性分层表

| 分层 | 当前权威源 | 说明 |
|---|---|---|
| 运行时实际物化 | Worker / Bridge 代码 | 这是当前唯一真实可执行部分 |
| Creator 依赖展示 | Dashboard 本地样例数据 | 仅表达目标对象结构 |
| 凭证 / MCP 运行时字段 | `packages/contracts/src/runtime.ts` | 契约真实存在，但治理域未成型 |
| 发布绑定字段 | 前端元数据 | 当前无正式后端记录 |

## 15. 当前不可宣称完成的运行配置能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 版本化 runtime profile | 运行配置未上收为正式对象 | 不可宣称运行环境已可版本化治理 |
| 结构化 package dependency | 依赖未落库、未校验 | 不可宣称发布前依赖治理已完成 |
| 工作区级 credential governance | mount 有运行时形态，但无治理实体 | 不可宣称凭证治理已完成 |
| BYO-MCP 正式治理 | binding 有字段，无探活/审核/隔离执行器 | 不可宣称第三方 MCP 已正式可用 |
