# 灵办词元 MCP 与凭证接入链路总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | MCP 与凭证接入链路总表 |
| 适用范围 | Run 创建链、Worker、Container Bridge、Creator 治理、前端启动模板 |
| 统计日期 | 2026-07-10 |
| 当前事实 | 当前已经具备 MCP binding 契约、first-party / workspace-managed / third-party 三类来源表达、凭证 env/file 双挂载模式、MCP 配置物化与 Secret Loader；`/v1/credentials`、`/v1/credentials/:id/usages`、`/v1/credentials/:id/audit-events`、`/v1/mcps`、`/v1/mcp-bindings`、`/v1/mcp-network-policies`、probe/health API 已落地，credential broker 已完成 `local-envelope` 与 `vault-transit-http` 双 provider，加密存储、自动到期冻结、`/internal/credentials/broker/health`、结构化物化审计、provider lifecycle callback delivery ledger，以及运行时 materialize 主链；`/internal/credentials/callbacks` 与 `/internal/credentials/callbacks/sweep` 已可诊断和手动补偿 suspend/revoke 回调。 |
| 文档目标 | 统一说明当前绑定模型、注入链路、第三方 MCP 边界、凭证作用域、正式治理能力与当前缺口 |

## 2. 证据来源总表

| 类型 | 路径 |
|---|---|
| MCP / Credential 契约 | `packages/contracts/src/runtime.ts`、`packages/contracts/src/credentials.ts`、`common.ts`、`runs.ts` |
| Run 启动载荷构建 | `app/api/src/modules/runs/launch-plan.ts` |
| Worker 凭证与 MCP 物化 | `app/run-worker/src/services/run-lifecycle.ts`、`bridge-runner.ts`、`container-runtime.ts` |
| Bridge 物化与加载 | `app/container-bridge/src/bridge/mcp-materializer.ts`、`secret-loader.ts`、`src/transports/api-connector.ts` |
| 前端启动模板 | `app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts` |
| Creator / 治理设计依据 | `docs/租户权限与治理对象总表.md`、`docs/工坊服务与Session资产总表.md`、`docs/后端开发文档.md` |

## 3. 当前 MCP / 凭证基础契约总表

| 对象 | 当前字段 | 当前作用 |
|---|---|---|
| `CredentialMount` | `credentialId`、`mode`、`envName/mountPath`、`readOnly` | 表示凭证挂载方式 |
| `McpBinding` | `bindingId`、`source`、`transport`、`ref`、`credentialId`、`authMode`、`authRef`、`networkPolicyRef`、`approvalRequired` | 表示运行时 MCP 连接信息 |
| `BridgeSessionContext` | `credentialMounts[]`、`mcpBindings[]` | Bridge 启动时的完整凭证与 MCP 上下文 |
| `CreateRunBinding` | `firstPartyMcpIds[]`、`externalConnectorRefs[]`、`credentialIds[]` | 前端启动 run 时携带的绑定需求 |

## 4. 当前 MCP 来源分类总表

| 来源 | 当前标识 | 当前含义 |
|---|---|---|
| 第一方 MCP | `first-party` | 平台内建能力，如浏览器、图像能力 |
| 工作区托管 MCP | `workspace-managed` | 企业或工作区维护的受控连接器 |
| 第三方不受控 MCP | `third-party` | 用户或企业接入的外部连接器 |

## 5. 当前传输方式总表

| `transport` | 当前含义 | 当前落地点 |
|---|---|---|
| `stdio` | 本地进程形式 MCP | 第一方浏览器、图像能力 |
| `http` | 远程 HTTP MCP | `workspace:seedance-api`、`third-party:asset-library` |
| `sse` | SSE MCP | `workspace:notion-sse`、`third-party:figma-mcp` |
| `websocket` | WebSocket MCP | 当前契约支持，示例中未显式使用 |

## 6. 当前内建 MCP Catalog 总表

| MCP ID | 来源 | 传输 | 运行时引用 | 默认凭证 | 审批要求 |
|---|---|---|---|---|---|
| `mcp.browser.playwright` | 第一方 | `stdio` | `/workspace/mcp/playwright-browser-helper.js` | `cred_browser_storage_state` | 是 |
| `mcp.image.gpt-image-2` | 第一方 | `stdio` | `/workspace/mcp/imagegen-helper.js` | `cred_openai_image_api_key` | 否 |

## 7. 当前外部连接器 Catalog 总表

| 连接器引用 | 来源 | 传输 | 运行时引用 | 默认凭证 | 审批要求 |
|---|---|---|---|---|---|
| `workspace:seedance-api` | 工作区托管 | `http` | `https://mcp.workspace.internal/seedance` | `cred_seedance_api_key` | 否 |
| `workspace:notion-sse` | 工作区托管 | `sse` | `https://mcp.workspace.internal/notion/sse` | `cred_workspace_notion_token` | 否 |
| `third-party:figma-mcp` | 第三方 | `sse` | `https://third-party-mcp.example.org/figma/sse` | `cred_figma_pat` | 是 |
| `third-party:asset-library` | 第三方 | `http` | `https://third-party-mcp.example.org/assets` | `cred_asset_library_api_key` | 是 |

## 8. 当前前端启动模板到 MCP / 凭证映射表

| 服务 | 第一方 MCP | 外部连接器 | 凭证 ID |
|---|---|---|---|
| `tax-filing` | `mcp.browser.playwright` | `workspace:notion-sse` | `cred_browser_storage_state`、`cred_tax_notice_folder` |
| `drama-storyboard` | `mcp.image.gpt-image-2` | `workspace:seedance-api`、`third-party:figma-mcp` | `cred_openai_image_api_key`、`cred_seedance_api_key`、`cred_figma_pat` |
| `poster-batch` | `mcp.image.gpt-image-2` | `third-party:asset-library` | `cred_openai_image_api_key`、`cred_asset_library_api_key` |

## 9. 当前凭证挂载模式矩阵表

| 挂载模式 | 适用场景 | 当前规则 |
|---|---|---|
| `env` | API Key、Token、简单文本密钥 | 通过 `LB_*` 环境变量注入 |
| `file` | Browser storage state、OAuth JSON、会话文件 | 写入 `/workspace/secrets/<folder>/<slug>.json` |

## 10. 当前凭证挂载推导规则表

| 条件 | 当前结果 |
|---|---|
| `credentialId` 含 `cookie/session/oauth/json/storage-state/browser` | 推导为 `file` 挂载 |
| 其他一般 API Key 场景 | 推导为 `env` 挂载 |
| `browser` / `storage-state` 类 | 进入 `/workspace/secrets/browser/` |
| `oauth` 类 | 进入 `/workspace/secrets/oauth/` |
| `mcp` 类 | 进入 `/workspace/secrets/mcp/` |
| 其他 | 进入 `/workspace/secrets/api/` |

## 11. 当前 end-to-end 注入链路总表

| 阶段 | 输入 | 输出 |
|---|---|---|
| 前端构建 `CreateRunInput` | `firstPartyMcpIds / externalConnectorRefs / credentialIds` | `CreateRunBinding` |
| API `buildStartRunJobPayload()` | `CreateRunBinding` | `credentialMounts[]`、`mcpBindings[]` |
| Worker `buildHostBridgeSessionContext()` / `buildContainerBridgeSessionContext()` | `credentialMounts[] / mcpBindings[]` | host/container 双上下文 |
| Worker `materializeRunRuntime()` | 上下文与 payload | `mcp-config.json`、`mcp-bindings.json`、`secret-manifest.json` |
| Worker `ApiConnector.materializeRunCredentials()` | `runId + credentialMounts` | internal materialize 响应中的短租约 secret map |
| Bridge `McpMaterializer` | `BridgeSessionContext.mcpBindings` | 运行时 MCP 配置文件 |
| Bridge `SecretLoader` | `credentialMounts[]` + materialized secret map | env 注入、文件写入 |
| Codex 运行时 | `CODEX_BIN` + env/file secret | 拥有最小 MCP 与凭证集 |

## 12. 第三方不受控 MCP 边界矩阵表

| 维度 | 工作区托管 MCP | 第三方不受控 MCP |
|---|---|---|
| 来源控制 | 工作区/平台控制 | 外部来源 |
| 连接稳定性 | 平台可测试 | 不可完全控制 |
| 凭证来源 | 工作区或平台凭证 | 用户或工作区绑定凭证 |
| 风险等级 | 中 | 高 |
| 建议审批 | 可按策略定 | 默认高风险动作启审批 |
| 建议网络策略 | 受控 allowlist | 更严格 allowlist 与审计 |

## 13. 凭证作用域矩阵表

| 作用域 | 当前建议用途 |
|---|---|
| 平台级 | 第一方能力通用凭证、平台内部密钥 |
| 工作区级 | 企业共享系统、共享浏览器状态、共享 SaaS Token |
| 用户级 | 用户自带 API Key、个人第三方 MCP 凭证 |
| run 级 | 短期派生凭证、临时会话文件 |

## 14. 建议正式治理对象总表

| 对象 | 作用 |
|---|---|
| `credentials` | 凭证元数据 |
| `credential_versions` | 轮换版本 |
| `credential_bindings` | 凭证与用户/工作区/服务的绑定关系 |
| `mcp_registry` | MCP 注册中心 |
| `mcp_bindings` | MCP 与工作区/服务/session 的绑定关系 |
| `network_policies` | MCP 出网与域名策略 |
| `connectivity_checks` | MCP 连通性测试结果 |

## 15. 建议管理接口总表

| 接口 | 作用 |
|---|---|
| `GET /credentials` | 列出当前用户/工作区可见凭证 |
| `POST /credentials` | 新增凭证 |
| `POST /credentials/:id/rotate` | 轮换凭证 |
| `GET /mcps` | 列出 MCP Registry |
| `POST /mcp-bindings` | 绑定 MCP 到工作区/服务 |
| `POST /mcp-bindings/:id/test` | 执行连通性测试 |
| `GET /mcp-bindings/:id/audit` | 查看治理与调用记录 |

## 16. 当前异常与失败场景总表

| 场景 | 当前表现 |
|---|---|
| 缺少 secret value | `SecretLoader` 抛出 `Missing secret value for credential <id>` |
| `BRIDGE_CONTEXT_PATH` 缺失 | Bridge CLI 启动失败 |
| 第三方连接器配置错误 | 当前多在运行时 HTTP/解析阶段暴露 |
| 凭证文件不存在 | `SecretLoader` 校验文件失败 |

## 17. 当前治理缺口总表

| 缺口 | 当前原因 | 优先级 |
|---|---|---|
| 云 KMS/HSM provider 缺失 | 当前 broker 已实现 `local-envelope` 与 `vault-transit-http`，但 AWS/GCP/Azure KMS 与 HSM adapter 仍未接入 | P1 |
| MCP Registry 深域对象未完全拆分 | 已有 `/v1/mcps`、`/v1/mcp-bindings`、`/v1/mcp-network-policies`，但静态 template ref 与独立 connector instance 域仍未完全收口 | P0 |
| 第三方 MCP 测试能力部分缺口 | 已有 probe/health snapshot，`stdio` 实探、异步重试与批量治理未闭环 | P1 |
| 凭证跨系统撤销回调 | 已有 usage graph、suspend/revoke active-run impact action、自动到期冻结、structured secret audit，以及 provider-configured HTTP callback 的 delivery ledger、失败重试与审计；更多 provider adapter 与 richer callback auth/payload 策略仍待扩展 | P1 |
| stdio 执行用户隔离缺失 | 已有 allowlist 与 `refSha256` 摘要签名；Docker runtime 已补齐非 root 执行、entrypoint 降权与目录/secret 权限收紧，local-process 模式下更细粒度用户隔离仍未闭环 | P1 |
| 调用审计深域仍缺 connector register/bind/block 事件 | MCP call 账本已落地，注册治理审计尚未结构化 | P1 |

## 18. 实施顺序总表

| 顺序 | 动作 |
|---|---|
| 1 | 建立 `credentials / mcp_registry / mcp_bindings / network_policies` 正式数据层 |
| 2 | 把代码内静态 Catalog 迁移到 Registry + 后台治理 |
| 3 | 在现有 `local-envelope` / `vault-transit-http` 基线之上补云 KMS/HSM provider，并补 usage/revoke 传播 |
| 4 | 将 MCP 连通性扩展到异步探活作业、`stdio` 实探与批量治理面板 |
| 5 | 补齐 connector register/bind/block 事件、更多 provider callback adapter 与更细粒度 stdio 执行隔离 |

## 19. 当前已验证接入基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| 绑定契约 | `CreateRunBinding`、`CredentialMount`、`McpBinding`、`BridgeSessionContext` 已落地 | `packages/contracts/src/runtime.ts`、`packages/contracts/src/runs.ts` |
| 前端绑定来源 | Dashboard/Mobile `runTemplates` 已提交 `firstPartyMcpIds/externalConnectorRefs/credentialIds` | `app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts` |
| API 静态 Catalog | `launch-plan.ts` 内已存在 first-party 与 external connector catalog | `app/api/src/modules/runs/launch-plan.ts` |
| Credential mount 推导 | 已按 credentialId 推导 `env/file` 与默认 mountPath/envName | `app/api/src/modules/runs/launch-plan.ts` |
| Worker 双视角改写 | 已生成 host/container 两份 bridge context，并改写 file mount 与 file authRef | `app/run-worker/src/services/run-lifecycle.ts` |
| Bridge Secret 注入 | `SecretLoader` 已支持 `env` 与 `file` 物化 | `app/container-bridge/src/bridge/secret-loader.ts` |
| Bridge MCP 物化 | `McpMaterializer` 已输出 `mcp-config.json` 与 `mcp-bindings.json` | `app/container-bridge/src/bridge/mcp-materializer.ts` |

## 20. 当前权威性分层表

| 领域 | 当前权威层 | 当前说明 |
|---|---|---|
| Run 绑定输入 | 前端 `runTemplates` + `CreateRunInput.bindings` | 当前仍由前端模板决定 |
| MCP/credential 推导 | API `launch-plan.ts` | 当前静态 catalog 与推导规则以代码写死为准 |
| host/container 路径改写 | run-worker `run-lifecycle.ts` | 当前 worker 是路径改写权威源 |
| Secret 注入执行 | container-bridge `SecretLoader` | 当前 bridge 是实际注入执行点 |
| MCP server config 执行 | container-bridge `McpMaterializer` | 当前 bridge 是实际物化执行点 |
| 凭证治理 / MCP 注册中心 | API `credentials + mcps + mcp-bindings + mcp-network-policies` | 当前已存在正式后端权威域，仍有部分前端 template 级静态 ref 需要继续收口 |

## 21. 当前不可宣称完成的接入能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| 正式凭证 Broker | 部分实现 | 已有 `local-envelope`、`vault-transit-http`、secret envelope 持久化、rotate、`/internal/credentials/broker/health` 与 internal materialize；云 KMS/HSM provider 未接入 |
| MCP Registry | 部分实现 | 已有 `/v1/mcps`、`/v1/mcp-bindings`、`/v1/mcp-network-policies`，但静态 catalog/template 仍未完全退场 |
| 连通性测试 | 部分实现 | 已有 `probe`、`health`、health snapshot 持久化；异步作业化与 `stdio` 实探未闭环 |
| 网络策略执行 | 已形成基础闭环 | API、worker、bridge 与容器 firewall 已接线；实机验收与 TLS/DNS 级证据仍待补齐 |
| 凭证轮换 | 部分实现 | 已有 rotate、`secretVersion`、usage graph、自动到期冻结、active-run revoke 传播，以及 provider callback delivery/retry 基线；旧版本淘汰策略与更多 provider adapter 未闭环 |
| 调用审计 | 部分实现 | MCP call 账本与 secret materialization audit 已落地；connector register/bind/block 事件未全部结构化 |
