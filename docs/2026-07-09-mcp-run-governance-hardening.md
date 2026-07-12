# 2026-07-09 MCP Run Governance Hardening

## 1. 本轮目标

补齐 run 启动前的 MCP 基础治理边界与审批闭环，避免后端在未注册、已禁用或未配置网络策略的情况下继续把 remote MCP 注入到运行实例，并确保 `approvalRequired` 可真实阻断启动。

## 2. 已落地规则

| 规则 | 生效位置 | 结果 |
|---|---|---|
| remote MCP 必须先注册 | `app/api/src/modules/mcp/service.ts` `resolveRunContext()` | 未注册 external connector ref 在 run 创建前被拒绝 |
| 仅 `active` 状态 MCP 可注入 | `resolveRunContext()` | disabled MCP 不再进入 start job |
| remote MCP 必须具备网络策略 | `resolveRunContext()` | `binding.networkPolicyRef` 或 `entry.defaultNetworkPolicyRef` 至少存在一个 |
| remote MCP 的 `transport/ref` 必须匹配 | `createMcp()` / `updateMcp()` / `resolveRunContext()` | 非法 URL、错误协议、remote + stdio 组合被拒绝 |
| first-party MCP 仅允许系统认可的 helper 形态 | `createMcp()` / `updateMcp()` | first-party 维持 `stdio + absolute helper path` 约束 |
| `approvalRequired` 可阻断 run 启动 | `app/api/src/modules/runs/service.ts` | 高风险 MCP 会生成 `mcp-access` 审批并把 run 置为 `WAITING_APPROVAL` |
| 多个启动前审批不会提前放行 | `runsService.approve()` | 仅当全部 startup-gating approvals 被批准后，run 才进入启动链 |

## 3. 代码改动

| 文件 | 改动 |
|---|---|
| `app/api/src/modules/mcp/service.ts` | 新增 registry shape 校验、run-time 可注入校验、known first-party allowlist、remote network-policy 校验 |
| `app/api/src/modules/runs/service.ts` | 新增 `mcp-access` 审批、startup-gating approvals 集合、审批后再启动的状态机逻辑 |
| `packages/contracts/src/runs.ts` | 新增 `mcp-access` approval kind |
| `app/api/tests/mcp-credentials.smoke.test.mjs` | 在原有正向 smoke 上新增未注册 remote MCP、无 network policy remote MCP、错误 websocket ref 的负向断言，以及高风险 MCP 的 `WAITING_APPROVAL -> approve -> start` 验证 |

## 4. 验证结果

| 命令 | 结果 |
|---|---|
| `node --test app/api/tests/mcp-credentials.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `36/36` 通过 |

## 5. 仍未完成的深域

| 主题 | 当前状态 |
|---|---|
| run 内 MCP 调用边界审计 | 尚未形成正式 `mcp.call` 事件与持久化读模型 |
| 第三方高风险 MCP 审批深域 | 已接入启动前审批链；尚未补齐审批策略模板、审批批次合并视图与前端专门呈现 |
| 凭证 broker / Vault-KMS | 仍为本地 metadata + materialization 模型，未接正式外部密钥托管 |
| workspace 级域名白名单模型 | 当前以 `networkPolicyRef` 必填替代，尚未实现独立 allowlist 数据模型 |
