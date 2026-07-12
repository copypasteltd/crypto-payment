# 灵办词元 MCP注册表、绑定解析与运行策略执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | MCP注册表、绑定解析与运行策略执行总表 |
| 适用范围 | `app/api`、`app/run-worker`、`app/container-bridge`、`app/dashboard`、后续 mcp-registry/binding/policy 正式域 |
| 统计日期 | 2026-07-08 |
| 当前事实 | 当前系统已具备第一方、工作区托管、第三方三类 MCP 来源表达，`launch-plan.ts` 内有静态 catalog 与 `CreateRunBinding -> McpBinding[]` 解析链，Worker/Bridge 已能把绑定物化成 `mcp-config.json` 与 `mcp-bindings.json`；当前没有正式 MCP Registry、没有绑定生命周期、没有统一策略求值与发布 gate。 |
| 直接证据 | `packages/contracts/src/runtime.ts`、`app/api/src/modules/runs/launch-plan.ts`、`app/run-worker/src/services/run-lifecycle.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/container-bridge/src/bridge/mcp-materializer.ts`、`app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts`、`app/dashboard/src/pages/creator/CreatorPage.tsx`、`docs/MCP与凭证接入链路总表.md`、`docs/BYO-MCP注册、探活与出网治理执行总表.md` |
| 输出目标 | 将 MCP 注册表、绑定解析、审批/网络策略、运行期物化、发布前 gate 和前端治理映射细化为执行总表 |

## 2. 当前事实矩阵

| 主题 | 当前证据 | 当前结论 | 当前缺口 |
|---|---|---|---|
| 来源分类 | `source = first-party/workspace-managed/third-party` | 来源模型已成型 | 无正式 registry 对象 |
| 传输方式 | `stdio/http/sse/websocket` | transport 语义已成型 | 无统一健康探测与兼容矩阵 |
| 绑定解析 | `launch-plan.ts` 静态 catalog + `resolveMcpBindings()` | Run 创建时已能生成 `McpBinding[]` | catalog 写死在代码 |
| 运行期物化 | `buildMaterializedMcpConfig()` + `McpMaterializer.materialize()` | runtime 可消费物化结果 | 无策略落库与审计回放 |
| Creator Connectors 页签 | 已有 connectors、governance/policy 文案 | 产品入口已固定 | 未接真实 registry/binding 数据 |

## 3. 当前 Catalog 事实矩阵

| 类别 | 当前位置 | 当前内容 | 当前问题 |
|---|---|---|---|
| 第一方 catalog | `firstPartyMcpCatalog` | `mcp.browser.playwright`、`mcp.image.gpt-image-2` | 写死在 API 层 |
| 外部 connector catalog | `externalConnectorCatalog` | `workspace:seedance-api`、`workspace:notion-sse`、`third-party:figma-mcp`、`third-party:asset-library` | 写死在 API 层 |
| fallback 推导 | `inferExternalEntry()` | 根据 ref 前缀和文本推断 transport/source/ref | 易产生误判 |
| 网络策略引用 | `networkPolicyRef = np_<slug>` | 已自动生成 | 仅占位字符串 |
| 审批要求 | 第三方默认高风险，部分内建写死 | 基本策略已存在 | 无治理层可配置 |

## 4. 绑定解析执行链总表

| 步骤 | 执行方 | 输入 | 动作 | 输出 |
|---|---|---|---|---|
| 1 | 前端模板 | `firstPartyMcpIds[]/externalConnectorRefs[]/credentialIds[]` | 构造 `CreateRunBinding` | Run 启动绑定需求 |
| 2 | API | `CreateRunBinding` | 查 catalog / registry、补默认 credential、补策略位 | `McpBinding[]` |
| 3 | Worker | payload 中 `McpBinding[]` | 生成 host/container context | bridge context |
| 4 | Worker | container context | 生成 `mcp-config.json`、`mcp-bindings.json` | runtime 物料 |
| 5 | Bridge | runtime 物料 | 物化最终 server definition | Codex 可消费 MCP |

## 5. 注册表对象矩阵

| 对象 | 作用 | 最低字段 |
|---|---|---|
| `mcp_registry_entry` | 平台级或空间级 MCP 定义 | `mcp_id/source/transport/ref/status/risk_level` |
| `mcp_binding_profile` | 某服务/package/run 使用的绑定模板 | `binding_profile_id/mcp_id/scope/approval_required/network_policy_ref` |
| `mcp_runtime_binding` | 单次 run 解析后的运行态绑定 | `runtime_binding_id/run_id/mcp_id/credential_id/auth_mode` |
| `mcp_policy_binding` | MCP 绑定到审批、网络、路径和成本策略 | `policy_binding_id/mcp_id/policy_refs_json` |
| `mcp_health_snapshot` | 探活与兼容性结果 | `mcp_id/status/latency/capabilities_json` |

## 6. 来源与 transport 策略矩阵

| 来源 | transport | 当前行为 | 正式要求 |
|---|---|---|---|
| 第一方 | `stdio` | 直接生成本地进程定义 | 版本、可见性、审批可配置 |
| 工作区托管 | `http/sse/websocket` | 生成 `remote-managed` | 接 workspace registry 与健康状态 |
| 第三方 | `http/sse/websocket` | 生成 `remote-unmanaged` | 严格网络、审批、审计 |
| 第三方 | `stdio` | 当前契约允许，执行风险高 | 必须白名单和隔离执行策略 |

## 7. 绑定策略矩阵

| 策略位 | 当前来源 | 当前默认 | 正式要求 |
|---|---|---|---|
| `approvalRequired` | 静态 catalog / 第三方默认 true | 第一方图像 false，浏览器 true，第三方 true | 可按 workspace/package 重写 |
| `networkPolicyRef` | 自动 slug 生成 | 占位符 | 绑定正式 network policy |
| `credentialId` | 默认 credential 或按 slug 匹配 | 依赖命名匹配 | 应通过显式 binding 关系解析 |
| `authMode/authRef` | 来源于 CredentialMount | env/file | 未来支持 broker |
| `risk_level` | 当前隐含在 source/transport | 无正式字段 | 建 registry 正式字段 |

## 8. 运行期物化矩阵

| 阶段 | 当前行为 | 输出 | 当前缺口 |
|---|---|---|---|
| API 解析 | 生成 `McpBinding[]` | payload 中运行绑定 | 无 registry 查询 |
| Worker host/container 改写 | file `authRef` 双视角改写 | host/container context | 无 trace/version |
| Worker runtime build | 生成 `mcp-config.json`/`mcp-bindings.json` | runtime 文件 | 无 schema version 全覆盖 |
| Bridge materialize | 输出 `local-process/remote-managed/remote-unmanaged` | 最终 MCP config | 无调用审计和策略 enforcement |

## 9. 发布 Gate 与运行阻断矩阵

| 场景 | Gate/阻断条件 | 当前状态 | 正式要求 |
|---|---|---|---|
| Package 激活前 | connector 未探活、credential 不可用、network policy 缺失 | 文档语义 | release gate 硬阻断 |
| Run 创建前 | 绑定的 MCP 已禁用或风险未批准 | 当前无 | 阻断启动 |
| 运行中首次调用 | 高风险 MCP 需审批 | 当前仅字段占位 | 注入审批节点 |
| 运行中策略变化 | connector 被吊销/下线 | 当前无 | 新调用阻断，已启动 run 按策略收敛 |
| 探活持续失败 | 当前无自动动作 | 无 | 自动禁用或降级 |

## 10. Creator 与前端映射矩阵

| 前端位置 | 正式展示 | 当前状态 |
|---|---|---|
| Dashboard Creator `connectors` 页签 | MCP 依赖、来源、transport、默认凭证、健康态 | 仅静态 |
| Dashboard `governance/policy` | 审批、网络、路径、容器策略与 MCP 绑定关系 | 仅静态 |
| Dashboard `governance/credentials` | MCP -> credential 关联 | 仅静态 |
| Mobile 服务详情 | 当前服务所需能力摘要 | 当前为文案级 connectors 列表 |

## 11. API 与管理接口矩阵

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/v1/mcps` | 列出 registry |
| `POST` | `/v1/mcps` | 新建 registry entry |
| `PATCH` | `/v1/mcps/:mcpId` | 更新状态/风险/元数据 |
| `POST` | `/v1/mcps/:mcpId/test` | 探活 |
| `GET` | `/v1/mcp-bindings` | 查询绑定 |
| `POST` | `/v1/mcp-bindings` | 创建绑定 |
| `PATCH` | `/v1/mcp-bindings/:id` | 更新 approval/network/credential 策略 |
| `POST` | `/v1/mcp-bindings/:id/disable` | 停用绑定 |

## 12. 审计与成本联动矩阵

| 联动域 | 联动内容 |
|---|---|
| 审计域 | registry 变更、绑定变更、探活结果、运行期调用都写审计 |
| 配额域 | 高风险 connector 与高成本 connector 参与 quota evaluator |
| 计费域 | `remote-unmanaged` 和外部 provider 记录单独用量/成本 |
| 通知中心 | 探活失败、凭证到期、risk 升级推送通知 |

## 13. 当前结构性缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 静态 catalog 写死在 `launch-plan.ts` | 无法由治理层接管 | 上线后维护成本高 | P0 |
| `inferExternalEntry()` 依赖字符串推断 | 可能误判 transport/source | 运行风险 | P0 |
| 无正式 MCP registry/binding 数据域 | Creator 与 runtime 无统一权威源 | 治理不可落地 | P0 |
| `networkPolicyRef` 仅占位 | 无真实网络约束 | 安全风险 | P1 |
| 无运行期调用策略 enforcement | 审批与风险字段无法真实生效 | 治理失效 | P1 |

## 14. 实施顺序表

| 顺序 | 动作 |
|---|---|
| 1 | 新建 `mcp_registry_entry/mcp_binding_profile/mcp_policy_binding` 正式数据域 |
| 2 | 把 `launch-plan.ts` 静态 catalog 切换到 registry 查询 |
| 3 | 实现 binding resolver，显式解析 credential、policy、health 状态 |
| 4 | 在 runtime 物化层补 schema version、trace、审计 |
| 5 | 接入 Creator Connectors/Policy 页与 run 启动前阻断 |
