# 灵办词元 BYO-MCP注册、探活与出网治理执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | BYO-MCP注册、探活与出网治理执行总表 |
| 适用范围 | `app/api`、`app/run-worker`、`app/container-bridge`、后续 connector/credential/governance 域 |
| 统计日期 | 2026-07-10 |
| 统计口径 | 以当前 `externalConnectorRefs`、`McpBinding`、`SecretLoader`、`McpMaterializer`、launch plan 与第三方 MCP 设计为准 |
| 直接证据 | `packages/contracts/src/common.ts`、`packages/contracts/src/runtime.ts`、`packages/contracts/src/mcp.ts`、`app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts`、`app/container-bridge/src/bridge/secret-loader.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts`、`app/container-bridge/src/bridge/remote-mcp-proxy-server.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/api/src/modules/mcp/service.ts`、`app/api/src/modules/mcp/probe.ts`、`app/container-bridge/tests/remote-mcp-proxy-server.test.mjs`、`app/api/tests/mcp-health-probe.smoke.test.mjs`、`docs/第三方BYO-MCP与凭证治理总表.md` |
| 输出目标 | 将 BYO-MCP 注册、审核、健康探测、物化、出网治理、审计与下线回收表格化到执行层 |

## 2. 当前合同事实矩阵

| 契约 | 当前字段 | 当前意义 |
|---|---|---|
| `connectorSource` | `first-party / workspace-managed / third-party` | 区分平台、工作区托管、第三方不受控 |
| `connectorTransport` | `stdio / http / sse / websocket` | 区分本地进程和远端协议 |
| `McpBinding` | `source`、`transport`、`ref`、`authMode`、`authRef`、`networkPolicyRef`、`approvalRequired` | 当前最关键的运行绑定对象 |
| `createRun.bindings.externalConnectorRefs` | `workspace:seedance-api`、`third-party:figma-mcp` 等 | 前端已能表达 BYO connector 引用 |
| `SecretLoader` | `env` / `file` | 当前凭证注入器 |
| `McpMaterializer` | `local-process`、`remote-managed`、`remote-unmanaged` | 当前 MCP 物化结果 |

## 3. BYO-MCP 注册执行矩阵

| 步骤 | 执行方 | 输入 | 核心动作 | 输出 |
|---|---|---|---|---|
| 1 | 用户/管理员 | connector 基本信息 | 填写名称、传输方式、endpoint/command、用途 | 注册草稿 |
| 2 | API | 注册草稿 | 生成 `connector_registry_entry` 与 `connector_instance` | 待测试 connector |
| 3 | 用户/管理员 | credential 选择或上传 | 建立 `connector_credential_binding` | 绑定凭证 |
| 4 | API / Worker | 探活请求 | 执行 `connector_health_snapshot` | 健康结果 |
| 5 | 审批人/管理员 | 健康结果与风险等级 | 决定是否激活 | `active / disabled` |

## 4. 正式对象执行矩阵

| 对象 | 主键建议 | 用途 |
|---|---|---|
| `connector_registry_entry` | `ctr_*` | 平台级 connector 元信息定义 |
| `connector_instance` | `cti_*` | 用户或工作区实际启用的一个 connector |
| `connector_credential_binding` | `ccb_*` | connector 与 credential 的绑定 |
| `connector_policy_binding` | `cpb_*` | connector 与网络策略、审批策略、路径策略绑定 |
| `connector_health_snapshot` | `chs_*` | 最近一次探活、能力探测与风险结论 |
| `connector_audit_event` | `cae_*` | 连接、调用、阻断、下线审计 |

## 5. `connector_instance` 字段矩阵

| 字段 | 类型 | 用途 |
|---|---|---|
| `connector_instance_id` | string | 实例主键 |
| `scope` | `user / workspace` | 归属范围 |
| `display_name` | string | 展示名称 |
| `source_type` | `third-party` | 标识 BYO |
| `transport` | `stdio / http / sse / websocket` | 连接方式 |
| `endpoint_or_command` | string | URL 或本地命令 |
| `risk_level` | `trusted / approved / restricted / blocked` | 风险级别 |
| `status` | `pending_test / active / disabled / revoked` | 当前状态 |
| `owner_user_id` | string \| null | 所有人 |
| `workspace_id` | string \| null | 所属工作区 |

## 6. 探活执行矩阵

| 场景 | 执行方式 | 成功标准 | 失败结果 |
|---|---|---|---|
| `http` connector | 发起健康探测请求 | 返回 2xx，协议字段可解析 | 标记 failed、记录错误码 |
| `sse` connector | 建立 SSE 连接并读取握手事件 | 指定时间内收到首个事件 | 标记 failed |
| `websocket` connector | 建立 WS 并完成握手 | 指定时间内握手成功 | 标记 failed |
| `stdio` connector | 启动进程并检测退出码与握手输出 | 可启动且握手输出合法 | 标记 failed |

## 7. 出网治理执行矩阵

| 维度 | 当前字段 | 正式执行建议 |
|---|---|---|
| 网络策略引用 | `networkPolicyRef` | 所有 BYO 远端 connector 必须绑定 |
| 域名白名单 | 已实现 API 与 runtime policy 校验 | 以域名/端口/协议/路径前缀粒度控制，当前已形成 API + worker proxy + container firewall 三层治理 |
| TLS 校验 | 已实现为 policy 字段与 runtime 校验 | 强制 HTTPS/WSS 或显式豁免 |
| 本地进程白名单 | 已实现 path-prefix allowlist | `stdio` 仅允许 allowlist 目录内命令/脚本，后续继续补命令签名与执行用户限制 |
| 连接审计 | 部分实现 | 已有 `mcp.call` 调用审计；连接级 register/block 事件仍待结构化 |

## 8. 凭证绑定执行矩阵

| 绑定模式 | 当前能力 | 适用场景 | 正式建议 |
|---|---|---|---|
| `env` | 已支持 | API key、短 token | 最小作用域 env，禁止日志暴露 |
| `file` | 已支持 | cookie jar、json key、证书 | 固定写入 `secrets/` 子目录 |
| `broker` | 未实现 | OAuth、短时签名、轮换凭证 | 新增 credential broker |
| `none` | 当前通过 `authMode = null` 表达 | 公共无鉴权 connector | 仍需网络白名单 |

## 9. 运行时物化执行矩阵

| 阶段 | 执行方 | 动作 | 输出 |
|---|---|---|---|
| run 创建 | 前端/API | 提交 `externalConnectorRefs` | run 绑定需求 |
| runtime 物料生成 | Worker | 解析 connector -> `McpBinding[]` | `bridge context`、`mcp-config.json` |
| secret 物化 | Bridge | `SecretLoader` 注入 env/file | `env`、写入的 secret files |
| MCP 物化 | Bridge | `McpMaterializer` 输出 `local-process / remote-managed / remote-unmanaged`，并把远程 MCP URL 改写为本地 proxy URL | 运行时 MCP 配置 |
| 审计回传 | Bridge/API | 记录外部调用事件 | 审计事件 |

## 10. 审批执行矩阵

| 场景 | 是否默认审批 | 建议 Gate |
|---|---|---|
| 新增第三方 connector 到工作区 | 是 | `connector_registration_gate` |
| 首次绑定到 package version | 是 | `package_dependency_gate` |
| 首次访问高风险外部域名 | 是 | `runtime_external_call_gate` |
| 低风险已批准 connector 重复调用 | 可按策略豁免 | `policy_decision` |
| 更换 endpoint 或 credential | 是 | `connector_change_gate` |

## 11. 下线与回收执行矩阵

| 触发条件 | 动作 | 影响 |
|---|---|---|
| connector 探活持续失败 | 自动禁用 | 新 run 不再可用 |
| credential 过期 | 挂起 connector | 等待重新绑定 |
| 审计发现违规域名 | 立即撤销 | 运行期调用被阻断 |
| 用户主动删除 | 解绑 package/run/credential 关系 | 历史审计保留 |

## 12. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 独立 connector registry 域未闭环 | 已有通用 MCP registry/binding，但 run template 仍保留字符串 ref 推导 | BYO 生命周期治理仍不完整 | P0 |
| 容器级 egress firewall 已形成基础闭环 | API allowlist、probe 前置阻断、bridge 侧 runtime proxy 二次校验、worker 侧 egress proxy / firewall target 编排与 runner entrypoint `iptables/ip6tables` 应用已落地 | 真实 Docker daemon 现场验收与更强 TLS/DNS 级审计证据仍待补齐 | P1 |
| stdio 仍缺细粒度执行治理 | 已实现 path-prefix allowlist，但仍缺命令签名、执行用户与更细目录权限收缩 | 本地进程型 BYO 仍有进一步收紧空间 | P0 |
| 无 connector 审计对象 | 无结构化连接与调用审计 | 企业治理无法落地 | P1 |

## 13. 当前已验证注册/探活起点表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| Connector 引用输入 | 当前可在 run template 中提交 `externalConnectorRefs` | `app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts` |
| Connector 推导 | API 会把未知 ref 推导成 `workspace-managed` 或 `third-party` 的静态条目 | `app/api/src/modules/runs/launch-plan.ts` |
| 远程类型区分 | `remote-managed` / `remote-unmanaged` 已写入物化配置 | `app/container-bridge/src/bridge/mcp-materializer.ts`、`app/run-worker/src/services/container-runtime.ts` |
| 网络策略字段 | `networkPolicyRef` 已进入 `McpBinding` 契约和 launch payload | `packages/contracts/src/runtime.ts`、`app/api/src/modules/runs/launch-plan.ts` |
| Secret 注入 | 第三方 connector 所需凭证当前可经 `SecretLoader` 注入 | `app/container-bridge/src/bridge/secret-loader.ts` |
| MCP 注册与绑定接口 | 已支持 `POST /v1/mcps`、`POST /v1/mcp-bindings`、`POST /v1/mcp-network-policies` | `app/api/src/modules/mcp/routes.ts`、`app/api/src/modules/mcp/service.ts` |
| stdio allowlist | 已在 API、worker、bridge 三侧落地 path-prefix allowlist，并对 host/container 运行模式分别改写路径 | `app/api/src/modules/mcp/service.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/run-worker/src/services/run-lifecycle.ts`、`app/run-worker/src/services/bridge-runner.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts` |
| runtime remote proxy | 远程 `http/sse/websocket` MCP 会改写到本地 proxy，bridge 在每次请求与 upgrade 时按 `networkPolicyRef` 重验目标 URL | `app/container-bridge/src/bridge/remote-mcp-proxy-server.ts`、`app/container-bridge/src/index.ts`、`app/container-bridge/tests/remote-mcp-proxy-server.test.mjs` |
| 探活与健康查询接口 | 已支持 `POST /v1/mcps/:mcpId/probe`、`GET /v1/mcps/:mcpId/health`、`GET /v1/mcp-health-snapshots` | `app/api/src/modules/mcp/routes.ts`、`app/api/src/modules/mcp/service.ts` |
| 健康快照持久化 | 已支持 file/postgres 双存储与 `0020_mcp_health_snapshots.sql` 迁移 | `app/api/src/modules/mcp/repository.ts`、`app/api/migrations/0020_mcp_health_snapshots.sql` |
| 探活结果验证 | 已覆盖 `healthy / degraded / blocked / unsupported` 核心结果 | `app/api/tests/mcp-health-probe.smoke.test.mjs` |

## 14. 当前不可宣称完成的注册/探活能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| Connector 注册接口 | 部分实现 | 已有 `/v1/mcps`、`/v1/mcp-bindings`、`/v1/mcp-network-policies`；独立 `connector_instance` 生命周期域未形成 |
| 探活执行 | 部分实现 | 已有 API 级 probe、health snapshot 持久化与查询；`stdio` 实探、异步重试作业与 runtime 强制治理未闭环 |
| 出网治理执行 | 部分实现 | API allowlist、probe 前置阻断与 bridge 侧 runtime proxy 已落地；容器级域名、端口、TLS、协议统一封锁未闭环 |
| stdio 执行治理 | 部分实现 | 已有 path-prefix allowlist、host/container 双侧校验与 `stdioPolicy.refSha256` 摘要签名；执行用户与更细权限未闭环 |
| 下线回收 | 未实现 | 当前没有 connector revoke/disable 与 run 阻断链 |
| 审批 Gate | 未实现 | 当前没有 `connector_registration_gate` 等实际流程 |

## 15. 收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 先建 connector registry / instance / policy / health 数据对象 | BYO-MCP 有正式主数据 |
| Phase 2 | 再建 registration/test/revoke API 与作业 | connector 生命周期可操作 |
| Phase 3 | 落地 network policy 与 stdio allowlist | 外部连接面可控 |
| Phase 4 | 把审批与审计接入发布/运行链 | BYO-MCP 治理闭环成型 |
