# 灵办词元 第三方BYO-MCP与凭证治理总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 第三方BYO-MCP与凭证治理总表 |
| 适用范围 | `app/api`、`app/run-worker`、`app/container-bridge`、后续 connector/credential/governance 正式域 |
| 统计日期 | 2026-07-10 |
| 统计口径 | 以当前 `bindings.externalConnectorRefs`、`McpBinding.source/transport`、`SecretLoader`、`McpMaterializer`、`launch plan` 和前端 run templates 中的第三方 connector refs 为准 |
| 直接证据 | `packages/contracts/src/common.ts`、`packages/contracts/src/runtime.ts`、`packages/contracts/src/mcp.ts`、`packages/contracts/src/credentials.ts`、`app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts`、`app/run-worker/src/services/workspace-preparer.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/bridge/secret-loader.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts`、`app/container-bridge/src/bridge/remote-mcp-proxy-server.ts`、`app/api/src/modules/mcp/service.ts`、`app/api/src/modules/mcp/probe.ts`、`app/api/src/modules/credentials/service.ts`、`app/api/src/modules/credentials/broker.ts`、`app/container-bridge/tests/remote-mcp-proxy-server.test.mjs`、`app/api/tests/mcp-health-probe.smoke.test.mjs`、`app/api/tests/mcp-credentials.smoke.test.mjs` |
| 输出目标 | 将不受控第三方 MCP、BYO connector、私有凭证注入、auth mode、出网治理、审计与隔离边界细化为正式总表 |

## 2. 当前契约证据总表

| 契约/实现 | 当前字段 | 当前含义 |
|---|---|---|
| `connectorSource` | `first-party / workspace-managed / third-party` | 区分第一方、工作区托管、第三方 BYO 能力 |
| `connectorTransport` | `stdio / http / sse / websocket` | 定义 MCP 连接方式 |
| `CredentialMount` | `mode = env / file` | 定义凭证如何注入容器 |
| `McpBinding` | `source`、`transport`、`authMode`、`authRef`、`approvalRequired`、`networkPolicyRef` | 当前最关键的 MCP 绑定对象 |
| `externalConnectorRefs` | `workspace:seedance-api`、`third-party:figma-mcp`、`third-party:asset-library` | 当前 run template 已经表达 BYO / 外部 connector 引用 |

## 3. 第三方 MCP 分类总表

| 类型 | 来源 | 当前示例 | 管理责任 | 风险特征 |
|---|---|---|---|---|
| 第一方 MCP | 平台自带 | `mcp.browser.playwright`、`mcp.image.gpt-image-2` | 平台负责 | 风险最低，协议可控 |
| 工作区托管 MCP | 工作区统一管理 | `workspace:notion-sse`、`workspace:seedance-api` | 工作区管理员负责 | 网络与凭证可控，业务边界随工作区变化 |
| 第三方 BYO MCP | 用户/团队自带 | `third-party:figma-mcp`、`third-party:asset-library` | 用户或工作区负责，平台负责治理边界 | 协议、可用性、出网、工具能力都存在不确定性 |

## 4. 当前模板中的第三方能力绑定总表

| 服务 | 第一方 MCP | 外部 Connector Refs | Credential IDs | 当前判断 |
|---|---|---|---|---|
| `tax-filing` | `mcp.browser.playwright` | `workspace:notion-sse` | `cred_browser_storage_state`、`cred_tax_notice_folder` | 以第一方与工作区托管能力为主 |
| `drama-storyboard` | `mcp.image.gpt-image-2` | `workspace:seedance-api`、`third-party:figma-mcp` | `cred_openai_image_api_key`、`cred_seedance_api_key`、`cred_figma_pat` | 同时存在第一方、工作区托管和第三方 BYO |
| `poster-batch` | `mcp.image.gpt-image-2` | `third-party:asset-library` | `cred_openai_image_api_key`、`cred_asset_library_api_key` | 存在第三方外部资产库依赖 |

## 5. `McpBinding` 正式字段解释总表

| 字段 | 当前作用 | 对第三方 BYO 的意义 |
|---|---|---|
| `bindingId` | 绑定唯一标识 | 便于在审计与回放中定位该外部能力 |
| `source` | 区分第一方/托管/第三方 | 直接决定治理策略和默认风险等级 |
| `transport` | stdio/http/sse/websocket | 决定启动方式与网络暴露方式 |
| `ref` | 目标命令或远程 URL | 第三方 BYO 的核心引用 |
| `authMode` | `none / env / file` | 决定密钥是环境变量还是文件注入 |
| `authRef` | 环境变量名或文件路径 | 定义具体授权材料挂载位置 |
| `approvalRequired` | 是否需要审批 | 高风险第三方能力应默认开启 |
| `networkPolicyRef` | 出网策略引用 | 决定第三方能力可连向哪些域名/端点 |

## 6. 第三方 MCP 正式对象总表

| 对象 | 主键建议 | 用途 |
|---|---|---|
| `connector_registry_entry` | `ctr_*` | 平台登记的 connector 元信息 |
| `connector_instance` | `cti_*` | 某个工作区或用户实际绑定的一份 connector |
| `connector_credential_binding` | `ccb_*` | connector 与 credential 的绑定关系 |
| `connector_policy_binding` | `cpb_*` | connector 与网络、审批、路径策略绑定 |
| `connector_health_snapshot` | `chs_*` | 最近连通性检查与能力探测结果 |

## 7. 第三方 BYO Connector 字段总表

| 字段 | 类型 | 用途 |
|---|---|---|
| `connector_id` | string | connector 主键 |
| `scope` | `user / workspace` | 该 connector 归用户还是工作区 |
| `source_type` | `third-party` | 标明是 BYO 外部能力 |
| `display_name` | string | 前端可读名称 |
| `transport` | `stdio / http / sse / websocket` | 连接方式 |
| `endpoint_or_command` | string | URL 或进程命令 |
| `declared_tools` | json | 工具清单快照 |
| `risk_level` | `trusted / approved / restricted / blocked` | 风险等级 |
| `status` | `pending_test / active / disabled / revoked` | 当前状态 |
| `owner_user_id` | string \| null | 所有人 |
| `workspace_id` | string \| null | 所属工作区 |

## 8. 凭证注入模式总表

| 模式 | 当前实现 | 适用场景 | 风险点 | 正式建议 |
|---|---|---|---|---|
| `env` | `SecretLoader` 将值写入环境变量 | API Key、短文本 token | 易被子进程继承与日志污染 | 用最小作用域 env，并审计暴露面 |
| `file` | `SecretLoader` 写入文件或复用已有文件 | JSON 凭证、cookie jar、PAT、browser state | 文件生命周期与权限边界复杂 | 写入 `secrets/` 子路径并设置回收策略 |
| `none` | `McpBinding.authMode = none` | 公共无鉴权能力 | 外部端点本身仍可能带风险 | 仍需网络白名单 |
| `broker` | 当前已实现 `local-envelope` 与 `vault-transit-http` | 工作区共享 API key、用户私有 PAT、browser state 这类可静态加密保存的凭证 | 云 KMS/HSM adapter、更多 provider callback adapter 与动态 OAuth/签名代理仍需继续补齐 | 当前由 API credential broker 负责加密存储、运行时短租约物化、broker health probe，以及 suspend/revoke 后的 provider callback delivery/retry |

## 9. 运行时物化链路总表

| 阶段 | 当前执行方 | 当前动作 | 对第三方 BYO 的作用 |
|---|---|---|---|
| 1. 创建 run | 前端/后端 | 在 `bindings` 中提交 `externalConnectorRefs` 与 `credentialIds` | 明确需要哪些第三方能力 |
| 2. worker 准备目录 | `prepareRunWorkspace()` | 创建 `mcp/`、`secrets/`、`runtime/`、`logs/` | 为外部能力、凭证和日志留隔离目录 |
| 3. 物化 runtime config | run-worker | 生成 `runtime-config.json`、`secret-manifest.json` | 把运行所需凭证与 connector 元数据落盘 |
| 4. 物化 MCP config | `McpMaterializer` | 生成 `mcp-config.json` 和 `mcp-bindings.json` | 决定第三方 MCP 以本地进程还是远程端点连接 |
| 5. 物化 secrets | `SecretLoader` | 按 `env` 或 `file` 注入凭证 | 将第三方能力真正授权给容器内 Codex |
| 6. Bridge 注册与事件回传 | bridge/API | 执行期间持续回传事件 | 便于审计第三方能力的实际使用情况 |

## 10. 出网与网络治理总表

| 维度 | 当前字段/实现 | 当前状态 | 正式建议 |
|---|---|---|---|
| 网络策略引用 | `networkPolicyRef` | 已落地正式 `mcp-network-policy` 对象、seed/backfill 与 API 管理接口；worker/bridge runtime context 已携带 policy 实体 | 容器级 egress firewall 与更底层网络证据仍需继续下沉 |
| 远程 URL 分类 | `source=third-party` + `transport=http/sse/websocket` | API 已在 create/update MCP、binding、run create 前执行域名/协议/端口/路径前缀校验；bridge 会把远程 MCP 改写为本地 proxy URL，并在每次请求与 upgrade 时二次执行 runtime policy 校验 | 更细颗粒度 DNS/TLS 证据与容器侧统一出网封锁仍需继续补齐 |
| 本地子进程执行 | `transport=stdio` | 可运行本地命令或脚本 | 应限制允许命令、挂载目录和执行用户 |
| 日志与审计 | 当前仅事件回传与日志目录预留 | 无正式网络审计 | 应记录连接目标、首连时间、失败码、调用次数 |

## 11. 第三方 MCP 审批矩阵总表

| 场景 | 是否应审批 | 建议 gate |
|---|---|---|
| 新增第三方 connector 到工作区 | 是 | `connector_registration_gate` |
| 首次把第三方 connector 绑定到 package version | 是 | `package_dependency_gate` |
| 运行时首次访问高风险第三方端点 | 是 | `runtime_external_call_gate` |
| 仅重复使用已批准的低风险第三方 connector | 可选 | 由策略决定 |
| 更换第三方凭证或 endpoint | 是 | `connector_change_gate` |

## 12. 审计字段总表

| 事件 | 关键字段 |
|---|---|
| `connector.registered` | `connector_id`、`scope`、`transport`、`endpoint_hash`、`owner_user_id` |
| `connector.tested` | `connector_id`、`health_status`、`latency_ms`、`tool_count` |
| `connector.bound_to_package` | `package_version_id`、`connector_id`、`approval_required` |
| `connector.bound_to_run` | `run_id`、`connector_id`、`credential_id` |
| `secret.mounted` | `run_id`、`credential_id`、`mount_mode`、`target_ref` |
| `external_call.blocked` | `run_id`、`connector_id`、`network_policy_ref`、`endpoint` |
| `external_call.allowed` | `run_id`、`connector_id`、`endpoint`、`tool_name` |

## 13. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 第三方 connector 没有正式 registry | 当前只有 `externalConnectorRefs` 字符串引用 | 无法治理、审核、测试和下线 | P0 |
| 云 KMS/HSM provider 未接入 | 当前已实现 `local-envelope`、`vault-transit-http`、版本轮换、`/v1/credentials/:id/usages`、`/v1/credentials/:id/audit-events`、`/suspend` / `/revoke`、自动到期冻结、`/internal/credentials/broker/health` 与 `/internal/runs/:id/credentials/materialize` 物化租约；生产级云 KMS/HSM 托管仍未接入 | 多环境主密钥治理、硬件/云 KMS 托管与跨环境密钥轮换仍未闭环 | P1 |
| 容器级 egress firewall 已形成基础闭环 | 已完成 policy registry、API 前置 allowlist 校验、bridge 侧 remote MCP runtime proxy 与逐请求 policy 二次校验，以及 worker 侧 runtime egress proxy env 注入、Docker launch plan `NET_ADMIN` / firewall target 编排、runner entrypoint `iptables/ip6tables` 应用 | 真实 Docker daemon 现场验收、DNS/TLS 更强审计证据与更细粒度规则治理仍待补齐 | P1 |
| stdio 执行治理仍缺细粒度约束 | 已实现 path-prefix allowlist 与 `stdioPolicy.refSha256` 摘要签名，但执行用户与更细粒度目录权限收缩仍未闭环 | 本地进程型 MCP 仍有进一步收紧空间 | P0 |
| 审计粒度不足 | 当前无 connector 正式审计事件域 | 企业治理无法落地 | P1 |

## 14. 当前已验证 BYO 基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| 第三方 connector 表达 | 已可通过 `externalConnectorRefs` 表达第三方能力引用 | `packages/contracts/src/runs.ts`、`app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts` |
| 第三方来源分类 | `source = third-party` 已进入 `McpBinding` | `packages/contracts/src/runtime.ts`、`app/api/src/modules/runs/launch-plan.ts` |
| 远程非受控标记 | 第三方非 `stdio` connector 会被物化为 `remote-unmanaged` | `app/container-bridge/src/bridge/mcp-materializer.ts`、`app/run-worker/src/services/container-runtime.ts` |
| 第三方示例模板 | `figma-mcp`、`asset-library` 已存在于前端模板与 API 静态 catalog | `app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts`、`app/api/src/modules/runs/launch-plan.ts` |
| 凭证注入 | 当前已支持 env/file 两种授权材料注入 | `app/container-bridge/src/bridge/secret-loader.ts` |
| credential broker | API 已把 secret 明文加密为 envelope 持久化，并在 run 启动前通过 internal materialize route 下发短租约 secret map；当前支持 `local-envelope` 与 `vault-transit-http`，暴露 broker health probe，并已补齐 suspend/revoke provider callback delivery ledger、失败重试与审计 | `app/api/src/modules/credentials/broker.ts`、`app/api/src/modules/credentials/service.ts`、`app/api/src/modules/credentials/callback-manager.ts`、`app/api/tests/mcp-credentials.smoke.test.mjs`、`app/api/tests/credential-broker-vault.smoke.test.mjs`、`app/api/tests/credential-lifecycle-callback.smoke.test.mjs` |
| file authRef 改写 | host/container 双视角都会改写 file authRef 路径 | `app/run-worker/src/services/run-lifecycle.ts` |
| network policy 对象 | 已支持 `list/get/create/update`、seed/backfill 与 `0019_mcp_network_policies.sql`，并已把选中的 policy 实体化进 `StartRunJobPayload` / `BridgeSessionContext` 供 worker 与 bridge 执行时二次校验 | `packages/contracts/src/mcp.ts`、`packages/contracts/src/runtime.ts`、`packages/contracts/src/runs.ts`、`packages/mcp/src/index.ts`、`app/api/src/modules/mcp/service.ts`、`app/api/migrations/0019_mcp_network_policies.sql` |
| allowlist 执行 | 远程 MCP 会在 create/update MCP、create/update binding、create run 前校验 host/protocol/port/path；非第一方 `stdio` MCP 会在 API、worker、bridge 三侧校验 path-prefix allowlist，并在 bridge 物化前校验 `stdioPolicy.refSha256` | `app/api/src/modules/mcp/service.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts`、`app/api/tests/mcp-credentials.smoke.test.mjs`、`app/run-worker/tests/container-runtime.test.mjs`、`app/container-bridge/tests/mcp-materializer.test.mjs` |
| runtime remote proxy | 远程 `http/sse/websocket` MCP 已改写为本地 proxy URL，bridge 在每次 HTTP 请求、SSE 流和 websocket upgrade 时都重验 `networkPolicyRef` | `app/container-bridge/src/bridge/remote-mcp-proxy-server.ts`、`app/container-bridge/src/index.ts`、`app/container-bridge/tests/remote-mcp-proxy-server.test.mjs` |
| runtime egress proxy | worker 已可基于 `runtimeApiBaseUrl`、显式 allowlist 与 materialized `mcpNetworkPolicies` 启动本地 egress proxy，并向 local-process / Docker runtime 注入 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY`，Docker launch plan 会自动加入 `host.docker.internal:host-gateway` | `app/run-worker/src/services/egress-proxy.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/run-worker/tests/egress-proxy.test.mjs` |
| stdio 路径重写 | host/container 双视角都会重写 `stdio ref` 与 allowlist 前缀，保证本地进程模式与容器模式口径一致 | `app/run-worker/src/services/run-lifecycle.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/run-worker/tests/bridge-runner.test.mjs` |
| health snapshot 契约 | 已支持 `McpHealthStatus`、`McpHealthSnapshot`、probe/list schema | `packages/contracts/src/mcp.ts` |
| probe API | 已支持 `POST /v1/mcps/:mcpId/probe`、`GET /v1/mcps/:mcpId/health`、`GET /v1/mcp-health-snapshots` | `app/api/src/modules/mcp/routes.ts`、`app/api/src/modules/mcp/service.ts` |
| health snapshot 持久化 | 已支持 file/postgres 双存储与 `0020_mcp_health_snapshots.sql` 迁移 | `app/api/src/modules/mcp/repository.ts`、`app/api/migrations/0020_mcp_health_snapshots.sql` |
| probe 验证 | 已覆盖 `healthy / degraded / blocked / unsupported` 四类核心结果烟测 | `app/api/tests/mcp-health-probe.smoke.test.mjs` |

## 15. 当前不可宣称完成的 BYO 治理能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| Connector 注册中心 | 部分实现 | 已有 `/v1/mcps`、`/v1/mcp-bindings` 与 `/v1/mcp-network-policies`；前端 template 仍保留字符串 ref 推导，独立 `connector_instance` 域未形成 |
| 凭证 broker | 部分实现 | 已有 `local-envelope`、`vault-transit-http`、secret envelope 持久化、轮换、`/v1/credentials/:id/usages`、`/v1/credentials/:id/audit-events`、`/suspend`、`/revoke`、自动到期冻结、structured secret materialization audit、broker health probe、internal materialize route，以及 suspend/revoke provider callback delivery/retry；云 KMS/HSM provider、更多 provider adapter 与更细粒度 stdio 执行隔离仍未闭环 |
| Connector 探活与健康快照 | 部分实现 | 已有 API 级 probe、health snapshot 持久化与查询；`stdio` 实探、异步重试作业与 runtime 强制治理未闭环 |
| 第三方 connector 审批链 | 未实现 | 当前只有 `approvalRequired` 字段，没有注册/变更审批流程 |
| 出网域名白名单 | 已形成基础闭环 | API 前置 allowlist、bridge 侧 runtime remote proxy、worker 侧 runtime egress proxy hook 与容器级 egress firewall 已落地；实机联调证据与更强 TLS/DNS 级审计仍待补齐 |
| stdio 白名单 | 部分实现 | 已有 path-prefix allowlist、host/container 双侧校验与 `stdioPolicy.refSha256` 摘要签名；执行用户和更细目录权限未闭环 |
| Connector 审计域 | 未实现 | 当前没有结构化 connector register/bind/call/block 事件 |

## 16. 最短收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 落地 connector registry 与 credential binding 数据层 | 第三方 connector 从字符串引用升级为正式对象 |
| Phase 2 | 落地 connector test/health 作业 | 是否可用可量化 |
| Phase 3 | 落地 network policy 与 stdio allowlist | 第三方出网与本地执行边界可控 |
| Phase 4 | 落地审计与审批事件 | 企业治理闭环形成 |
