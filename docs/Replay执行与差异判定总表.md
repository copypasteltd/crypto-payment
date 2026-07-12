# 灵办词元 Replay执行与差异判定总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Replay执行与差异判定总表 |
| 适用范围 | Creator Debug/Replay、Release Replay Gate、审计回放链路 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 Replay 文档、Creator Debug 页面语义、Run/Bridge 事件模型、文件与产物链路为准 |
| 直接证据 | `docs/Release回放与审核状态流总表.md`、`docs/实时事件与控制协议总表.md`、`docs/消息附件与输入物料链路总表.md`、`packages/contracts/src/bridge.ts`、`packages/contracts/src/realtime.ts`、`app/dashboard/src/pages/creator/CreatorPage.tsx` |
| 输出目标 | 将 Replay 的来源、执行阶段、差异分类、阈值判定、导出结果、页面映射细化为正式执行表 |

## 2. 回放来源类型矩阵

| 来源类型 | 来源对象 | 用途 | 典型场景 |
|---|---|---|---|
| `run_replay` | `source_run_id` | 复盘单次真实实例 | 生产问题复核 |
| `package_replay` | `source_session_version_id` + `package_version_id` | 复盘某个包版本的标准执行路径 | Creator 调试 |
| `release_gate_replay` | `release_id` + `package_version_id` | 作为发布 Gate 证据 | 发布前校验 |

## 3. Replay 执行阶段矩阵

| 阶段 | 状态 | 输入 | 核心动作 | 输出 |
|---|---|---|---|---|
| 阶段 1 | `queued` | replay 请求 | 排队、分配执行资源 | 待执行 replay |
| 阶段 2 | `rehydrating` | source run、session asset、runtime profile | 恢复上下文、输入材料、路径结构、MCP 绑定摘要 | replay 工作目录 |
| 阶段 3 | `replaying` | 事件序列、消息、审批、材料引用 | 重新驱动对话、审批、工具调用、文件变化监听 | replay 原始结果 |
| 阶段 4 | `diffing` | 原始结果、source 快照 | 进行消息、文件、审批、产物差异比较 | `replay_diff[]` |
| 阶段 5 | `passed / failed` | 差异结果 | 生成通过/失败结论 | replay 总结 |
| 阶段 6 | `exported` | replay 总结、差异、证据 | 导出审计包或回放摘要 | 导出物 |

## 4. Replay 输入物料矩阵

| 输入类别 | 来源 | 用途 |
|---|---|---|
| 会话消息 | `run_messages` 或原型 JSON 聚合 | 重放对话顺序 |
| 审批记录 | `approvals` | 重放审批节点 |
| 输入材料 | `inputs/`、附件元数据 | 提供同一批材料 |
| 运行配置 | `runtime_profile`、`bridge context` | 保持运行环境一致性 |
| MCP 绑定 | `mcpBindings` | 还原工具连接范围 |
| 文件快照 | `target/outputs/archive` 索引 | 做路径和产物差异比对 |
| 事件流 | `run_events` 或 JSONL backlog | 对齐状态切换与产物发布时间 |

## 5. 差异分类矩阵

| 差异类型 | 对比对象 | 判定维度 | 输出对象 |
|---|---|---|---|
| `message_diff` | 原始消息 vs replay 消息 | 顺序、角色、摘要、一致性 | `replay_diff` |
| `approval_diff` | 原始审批 vs replay 审批 | 节点数、审批状态、时间顺序 | `replay_diff` |
| `file_tree_diff` | 原始文件树 vs replay 文件树 | 路径、文件种类、缺失/新增 | `replay_diff` |
| `artifact_diff` | 原始产物 vs replay 产物 | 产物数量、状态、目标路径 | `replay_diff` |
| `tool_path_diff` | 原始工具路径 vs replay 工具路径 | 关键步骤偏移 | `replay_diff` |
| `runtime_diff` | 原始 runtime profile vs replay runtime profile | 镜像、环境变量、MCP 绑定摘要 | `replay_diff` |

## 6. 差异阈值判定矩阵

| 差异类型 | 默认阈值建议 | 通过条件 | 失败条件 |
|---|---|---|---|
| 消息顺序 | 关键系统消息顺序必须一致 | 核心节点顺序一致 | 核心节点缺失或顺序颠倒 |
| 审批节点 | 节点数与状态必须一致 | 节点完整且状态一致 | 审批节点缺失、提前或被绕过 |
| 文件树 | 关键产物路径必须存在 | 核心产物齐全 | 核心产物缺失、输出目录偏移 |
| 产物摘要 | 核心产物数量与类型一致 | 主产物、回执、审计文件齐全 | 主产物缺失或种类变化 |
| 工具路径 | 允许非关键性顺序抖动 | 非关键步骤差异在白名单内 | 关键工具调用缺失或新增敏感调用 |
| Runtime | 镜像、MCP 与 credential 作用域一致 | 运行边界一致 | 运行边界扩大或缩小导致行为偏移 |

## 7. `replay_diff` 字段总表

| 字段 | 类型 | 用途 |
|---|---|---|
| `diff_id` | string | 差异主键 |
| `replay_id` | string | 所属回放单 |
| `diff_type` | enum | 差异类型 |
| `severity` | `info / warn / block` | 严重级别 |
| `source_ref` | string | 原始引用对象 |
| `replay_ref` | string | 回放引用对象 |
| `summary` | localized string | 差异摘要 |
| `accepted_by_policy` | boolean | 是否在白名单阈值内 |
| `evidence_path` | string \| null | 关联文件或导出路径 |

## 8. Replay 导出物矩阵

| 导出物 | 内容 | 用途 |
|---|---|---|
| `replay-summary.json` | replay 概要、状态、差异统计 | 审计归档 |
| `replay-events.jsonl` | 回放事件流 | 诊断与复核 |
| `replay-diff.json` | 结构化差异列表 | 发布 Gate 证据 |
| `replay-report.md` | 面向 Creator/Approver 的摘要报告 | 页面展示与审批 |
| `replay-files-manifest.json` | 回放期文件清单 | 文件域核对 |

## 9. 页面与接口映射总表

| 页面/接口 | 当前用途 | 正式对象 |
|---|---|---|
| `creator/packages/:packageId/debug` | Creator 查看回放结果 | `replay_session`、`replay_diff` |
| `GET /v1/replays` | 查询回放列表 | `replay_session[]` |
| `GET /v1/replays/:replayId` | 查询回放详情 | `replay_detail` |
| `GET /v1/replays/:replayId/events` | 查询回放事件序列 | `replay_event[]` |
| `GET /v1/replays/:replayId/diffs` | 查询差异列表 | `replay_diff[]` |
| `POST /v1/replays/:replayId/export` | 导出回放证据 | `audit_export_job` |

## 10. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| Replay 对象未落地 | 仅文档和页面语义 | 无法形成正式回放结果 | P0 |
| 差异对象未建模 | 无结构化 `replay_diff` | 无法做 Gate 自动判断 | P0 |
| 回放执行器未实现 | 当前没有 replay worker | 无法重放 session | P0 |
| 导出物未生成 | 仅停留在设计层 | 无法提供审计证据 | P1 |

## 11. 当前已验证 Replay 基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| Replay 页面入口 | 已存在 Creator debug 路由 | `app/dashboard/src/lib/routes.ts`、`CreatorPage.tsx` |
| Replay 差异语义 | 已在文档与页面语义中表达 | 当前系列 replay/release 文档 |
| 运行事件契约 | 已存在 `BridgeEvent` / realtime 契约 | `packages/contracts/src/bridge.ts`、`realtime.ts` |
| Replay 后端对象 | 未实现 | API 当前无 `/v1/replays` |
| Replay 执行器 | 未实现 | worker 当前无 replay job |

## 12. 当前不可宣称完成的 Replay 能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 真实回放执行 | 无 replay worker、无 replay session 域 | 不可宣称回放能力已落地 |
| 自动 diff 判定 | 无 `replay_diff` 对象与阈值执行器 | 不可宣称 Gate 自动判定已落地 |
| 回放审计导出 | 无导出任务与导出物生成链 | 不可宣称回放证据链已完成 |
