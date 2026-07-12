# 灵办词元 Quota 执行点增量记录

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Quota 执行点增量记录 |
| 日期 | 2026-07-08 |
| 范围 | `app/api` |
| 目标 | 将 quota enforcement 从 `run create` 扩展到消息发送、上传写入、文件读取、文本预览、下载票据、直链下载 |

## 2. 本轮完成项

| 模块 | 已完成能力 | 说明 |
|---|---|---|
| Quota Service | 通用 `previewUsage / commitUsageDecision / consumeApprovedUsageOverride` | 支持先预判、再提交、审批后重试放行 |
| Run Message | `POST /v1/runs/:runId/messages` quota 前置检查 | 估算 `model_tokens`，支持 `block / require_approval / warn` |
| Upload Content | `PUT /v1/runs/:runId/uploads/:uploadId/content` quota 前置检查 | 使用 `storage_bytes` 控制对象写入 |
| File Read | `GET /v1/runs/:runId/files/read` quota 前置检查 | 使用 `download_bytes` 控制文本读取 |
| File Preview | `GET /v1/runs/:runId/files/preview` quota 前置检查 | 文本预览按返回字节计量 |
| Download Ticket | `POST /v1/runs/:runId/download-tickets` quota 前置检查 | 使用文件体积计量 `download_bytes` |
| Direct Download | `GET /v1/runs/:runId/files/download` quota 前置检查 | 直链下载补齐与 download ticket 等价的 quota gate |
| Approval UX | run 内 quota 审批反馈 | 新增 run 级审批挂载与系统消息回写 |
| Retry Model | 审批后重试可成功 | 审批通过后，下一次相同动作会消费已批准 override 并放行一次 |

## 3. 新增/修改的关键文件

| 文件 | 作用 |
|---|---|
| `app/api/src/modules/quotas/service.ts` | 增加 usage 预判、提交、审批后消费 override |
| `app/api/src/modules/runs/approval-feedback.ts` | 统一 quota 审批反馈、run 内系统消息、审批事件回写 |
| `app/api/src/modules/runs/quota-usage.ts` | 统一从 run 上下文生成 quota usage context |
| `app/api/src/modules/runs/service.ts` | 消息发送 quota gate；新增非状态切换的审批决策分支 |
| `app/api/src/modules/runs/file-access.ts` | 文件读取、文本预览、直链下载 quota gate |
| `app/api/src/modules/uploads/service.ts` | 上传写入、下载票据 quota gate |
| `app/api/src/modules/runs/routes.ts` | 将请求用户注入 read / preview / download / message 执行点 |
| `app/api/src/modules/uploads/routes.ts` | 将请求用户注入 upload content 执行点 |
| `app/api/tests/quota-execution-points.smoke.test.mjs` | 新增执行点级 smoke |
| `app/api/package.json` | `test:smoke` 纳入新用例 |

## 4. 设计决策

| 决策 | 原因 |
|---|---|
| 审批通过后采用“重试一次放行”模型 | 上传、下载、预览、消息发送属于瞬时动作，审批通过后重试即可恢复，不需要后台代发 |
| 对 stateless 动作的 quota 审批不切换 run 状态 | 避免把 `QUEUED / STARTING / RUNNING` 的实例误切到 `RUNNING / CANCELLED` |
| 对 `WAITING_APPROVAL` 的启动前审批保留原有 resume 语义 | 保持 `run create` 的 quota gate 行为不变 |
| `download_bytes` 对文本预览按返回字节计量 | 与 H5 / Dashboard 文本查看的真实输出量一致 |
| `model_tokens` 采用消息字节估算 | 当前 bridge 未回传真实 token usage，先建立可执行治理点 |

## 5. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm -C app/api typecheck` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `node --test tests/quota-governance.smoke.test.mjs` | 通过 |
| `node --test tests/file-chain.smoke.test.mjs` | 通过 |
| `node --test tests/quota-execution-points.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | 通过，`15/15` |

## 6. 当前剩余缺口

| 领域 | 剩余项 |
|---|---|
| Token 计量 | 仍缺少 bridge / model provider 回传的真实 token usage |
| MCP 治理 | `mcp_calls / browser_minutes / image_credits` 等执行点尚未接入真实调用链 |
| Cost Ledger | quota 仍属于治理层，正式计费账本尚未落地 |
| 审批体验 | 当前 stateless 动作审批采用“用户重试”模型，尚未做自动回放 |
| 下载链路 | download ticket 已治理，二次分发与批量打包下载尚未单独计量 |

## 7. 对仓库状态的影响

| 仓库 | 影响 |
|---|---|
| `agent-workshop-backend` | quota 从 run-create 扩展到多执行点，生产闭环明显增强 |
| `agent-workshop-app` | 现有任务页审批闭环现在能承接更多后端 quota 事件 |
| `agent-workshop-dashboard` | Creator / 重度用户在 run 内和治理台看到的 quota 审批数据与执行点更加一致 |
