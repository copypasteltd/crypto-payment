# 灵办词元 Run实例化与首轮信息收集链路总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Run实例化与首轮信息收集链路总表 |
| 适用范围 | `app/dashboard`、`app/mobile`、`app/api`、`packages/domain-models`、`app/run-worker`、`app/container-bridge` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 `CreateRunInput`、前端 run template、`RunsService.createRun()`、`createInformationCollectionPrompt()` 和运行时工作目录物化逻辑为准 |
| 直接证据 | `packages/contracts/src/runs.ts`、`packages/domain-models/src/runs.ts`、`app/api/src/modules/runs/service.ts`、`app/api/src/modules/sessions/service.ts`、`app/api/tests/run-information-collection.smoke.test.mjs`、`app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts`、`app/run-worker/src/services/workspace-preparer.ts` |
| 输出目标 | 将“先实例化，再由 Codex 首轮追问所需信息”的产品约束细化为正式链路、对象和接口总表 |

## 2. 当前产品约束总表

| 约束 | 当前落实方式 | 说明 |
|---|---|---|
| 实例化时不提交业务材料 | `CreateRunInput.initialMessage` 当前为 `null` | 前端只提交运行最小骨架，不提交具体材料内容 |
| 实例化时提交运行级绑定 | `bindings.firstPartyMcpIds / externalConnectorRefs / credentialIds` | 账号级或工作区级能力在实例化前确定 |
| 首轮由 Codex 主动询问信息 | `createInformationCollectionPrompt()` | 系统在 run 创建后自动插入追问消息 |
| 后续都在完整对话里收集 | `messages[]` + `sendRunMessage()` | 用户与 Codex 在同一 run 对话内持续补齐信息 |

## 3. 当前 `CreateRunInput` 字段边界总表

| 字段 | 当前含义 | 是否应在实例化前提供 | 说明 |
|---|---|---|---|
| `workspaceId` | 当前工作区 | 是 | 必须先确定租户边界 |
| `taskVersionId` | 服务版本 | 是 | 必须先确定执行模板 |
| `sessionVersionId` | session 版本 | 是 | 必须先确定会话资产基线 |
| `title` | 运行标题 | 是 | 便于实例列表展示 |
| `targetPath` | 目标目录 | 是 | 便于立即建立工作目录和文件边界 |
| `entrySurface` | 发起入口面 | 是 | 影响交互与埋点 |
| `initialMessage` | 首条业务消息 | 当前为否 | 当前产品要求首轮由系统 prompt 驱动，不由用户预先填表 |
| `bindings` | MCP、connector、credential 绑定 | 是 | 与账户/工作区挂钩的运行能力必须预先确定 |

## 4. 当前前端实例化模板总表

| 终端 | 当前模板位置 | 当前预填内容 | 当前不预填内容 |
|---|---|---|---|
| Dashboard | `app/dashboard/src/lib/runTemplates.ts` | `workspaceId`、`taskVersionId`、`sessionVersionId`、`title`、`targetPath`、`bindings` | 业务参数、上传材料、审批说明 |
| Mobile H5 | `app/mobile/src/lib/runTemplates.ts` | 同上，并根据入口面决定 `entrySurface = h5 / mini-program` | 业务参数、上传材料、审批说明 |

## 5. 实例化后首轮信息收集执行链总表

| 步骤 | 执行方 | 输入 | 核心动作 | 输出 |
|---|---|---|---|---|
| 1 | 前端 | 选定服务 + 当前工作区 + 固定 bindings | 构造 `CreateRunInput` | `POST /v1/runs` |
| 2 | API | `CreateRunInput` | `createRunRecord()` 建立 run，状态为 `CREATED` | `RunRecord` |
| 3 | API | 新建 run | `createInformationCollectionPrompt(run)` 生成系统提示 | 首轮 system prompt |
| 4 | API | run + prompt | 保存 `messages[0]`，计算 `informationCollection`，并作为 `nextPrompt` + `informationCollection` 返回前端 | `CreateRunResponse` |
| 5 | API | run + start job payload | 同步生成 seed files、seed artifacts、seed approval，并触发 orchestrator | 进入运行准备链 |
| 6 | 前端 | `CreateRunResponse` | 跳入实例对话页/任务对话页 | 用户看到第一条系统追问 |
| 7 | 用户 | 在完整对话中回复 | `sendRunMessage()` 将材料与说明作为普通消息持续注入 | 消息流持续补齐上下文 |
| 8 | Codex | 对话上下文 | 继续追问缺失信息、确认审批、执行任务 | 进入真正业务执行 |

## 6. 首轮系统追问消息字段总表

| 字段 | 当前来源 | 当前作用 |
|---|---|---|
| `message.role = system` | `RunsService.createRun()` | 标记为系统插入消息 |
| `message.kind = prompt` | `createMessage(..., "system", "prompt", systemPrompt)` | 标记为引导型追问 |
| `message.text` | `createInformationCollectionPrompt(run)` | 告诉用户当前任务标题、目标路径，并询问“你需要我提供什么信息给你” |
| `message.createdAt` | `nowIso()` | 保证消息排序 |

## 7. `createInformationCollectionPrompt()` 当前语义总表

| 当前输出片段 | 语义 |
|---|---|
| “请问你需要我提供什么信息给你” | 把信息收集责任交给 Codex 在对话中完成 |
| 当前任务标题 | 让 Codex 知道正在执行哪个服务 |
| 目标路径 | 让 Codex 知道应把后续结果写到哪里 |

## 8. 运行工作目录在首轮信息收集阶段的作用总表

| 目录 | 当前创建时机 | 在信息收集阶段的作用 |
|---|---|---|
| `target/` | `prepareRunWorkspace()` | 提前建立目标路径边界，后续对话里一旦用户上传材料或要求输出就有明确落点 |
| `inputs/` | `prepareRunWorkspace()` | 后续用户补传材料时的标准落点 |
| `outputs/` | `prepareRunWorkspace()` | 结果输出目录 |
| `runtime/` | `prepareRunWorkspace()` | 保存 runtime config、bridge context、mcp config、secret manifest |
| `codex-home/` | `prepareRunWorkspace()` | 隔离每个 run 的 Codex 运行态 |
| `browser-profile/` | `prepareRunWorkspace()` | 隔离浏览器状态 |
| `secrets/` | `prepareRunWorkspace()` | 后续凭证文件挂载位置 |

## 9. 当前已落地的结构化收集对象总表

| 对象 | 当前所在层 | 已落地字段 |
|---|---|---|
| `run.informationCollection` | `runSnapshot` / `runAggregate` | `prompt`、`slotSchemaVersion`、`status`、`requiredCount`、`satisfiedCount`、`missingCount`、`userMessageCount`、`attachmentCount`、`lastUpdatedAt`、`slots[]` |
| `run.informationCollection.slots[]` | `runSnapshot` / `runAggregate` | `key`、`title`、`type`、`required`、`secret`、`repeatable`、`prompt`、`description`、`placeholder`、`choices`、`accepts`、`status`、`attachmentCount`、`answerCount`、`lastAnswerText`、`lastSatisfiedAt` |

## 10. 正式系统建议的“信息收集完成度”对象总表

| 对象 | 用途 | 关键字段 |
|---|---|---|
| `run_slot_requirement` | 记录该服务当前要求用户补齐哪些信息 | `run_id`、`slot_key`、`required`、`state`、`source` |
| `run_slot_answer` | 记录用户在对话中补齐的每个槽位 | `run_id`、`slot_key`、`value_type`、`value_ref`、`answered_at` |
| `run_collection_state` | 记录整条信息收集流程是否已足够执行 | `run_id`、`state`、`missing_count`、`last_checked_at` |

## 11. 正式系统建议的 `run_collection_state` 状态机总表

| 状态 | 含义 | 进入条件 | 可流向状态 |
|---|---|---|---|
| `not_started` | 实例刚创建，尚未开始有效收集 | run 创建完成 | `collecting` |
| `collecting` | Codex 正在追问与收集信息 | 用户与 Codex 在消息流中交互 | `ready_for_execution`、`blocked`、`cancelled` |
| `ready_for_execution` | 已满足继续执行的最低信息要求 | 所有必填槽位已满足 | `executing` |
| `blocked` | 缺少关键输入或审批 | Codex 判定无法继续执行 | `collecting`、`cancelled` |
| `executing` | 信息收集完成，进入主执行阶段 | worker/bridge 开始主任务 | `completed`、`failed` |
| `completed` | 执行完成 | 任务成功收束 | 终态 |
| `cancelled` | 用户取消或审批拒绝 | 任务停止 | 终态 |
| `failed` | 主执行失败 | 执行失败 | `collecting`、终态 |

## 12. 首轮信息收集与审批的关系矩阵

| 场景 | 是否属于信息收集阶段 | 当前处理方式 |
|---|---|---|
| 用户补充主体信息、时间范围、风格偏好 | 是 | 通过普通 `sendRunMessage()` 消息补齐 |
| 用户补传材料文件 | 是 | 正式系统应写入 `inputs/` 并在消息中回填附件引用 |
| 用户确认“是否继续提交” | 否，属于审批阶段 | 通过 `approvals` 与 `approveRun()` 处理 |
| 用户要求继续追问而非立即执行 | 是 | Codex 在完整对话中继续引导 |

## 13. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 独立槽位表未落地 | 当前结构化状态挂在 `run.informationCollection` 聚合内，尚未拆为 `run_slot_requirement / run_slot_answer` 正式域 | 无法独立审计与做更深查询 | P0 |
| 文本槽位独立正式域未落地 | 当前已支持 `slotValues[]` 显式回填与“单缺口纯文本回复”轻量自动回填，但文本型槽位仍未形成独立正式答案对象 | 无法做深审计、深查询与独立治理 | P0 |
| 收集完成度持久化仍偏轻 | 当前已有 `run.informationCollection.status`，但没有独立 `run_collection_state` 读模型与专门接口 | 前端与治理面难以做更深统计与筛选 | P1 |
| 首轮 prompt 当前较通用 | 目前只插入通用追问 | 不同服务的收集策略还不够细 | P1 |

## 14. 当前已验证实例化与首轮追问基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| `CreateRunInput` 最小骨架 | 已存在 | `packages/contracts/src/runs.ts` |
| 双端实例化模板 | 已真实存在 | `app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts` |
| `initialMessage` | 当前固定 `null` | 双端 runTemplates |
| 首轮 prompt 生成 | 已真实存在 | `packages/domain-models/src/runs.ts` |
| `nextPrompt` 返回 | 已真实存在 | `app/api/src/modules/runs/service.ts` |
| `informationCollection` 返回 | 已真实存在 | `packages/contracts/src/runs.ts`、`app/api/src/modules/runs/service.ts` |
| 对话内附件补传 | 已真实存在 | `packages/api-sdk/src/index.ts`、`app/mobile/src/pages/tasks/detail.tsx`、`app/dashboard/src/pages/instances/InstancesPage.tsx` |
| 结构化 run 聚合收集状态 | 已实现 | `packages/contracts/src/runs.ts`、`packages/domain-models/src/runs.ts`、`app/api/tests/run-information-collection.smoke.test.mjs` |
| 文本槽位轻量答案回填 | 已实现 | `packages/contracts/src/runs.ts`、`packages/domain-models/src/runs.ts`、`app/api/tests/run-information-collection.smoke.test.mjs` |
| 独立 `run_slot_requirement` / `run_collection_state` 正式域 | 未实现 | 当前无独立代码与接口 |

## 15. 当前不可宣称完成的信息收集能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 完整结构化槽位收集 | 当前只完成 run 聚合内的轻量结构化状态，尚未拆到独立正式域 | 不可宣称信息收集已完全结构化治理 |
| 文本型槽位答案正式治理 | 当前已有聚合内轻量答案摘要，但没有正式 `run_slot_answer` 文本答案链 | 不可宣称所有槽位类型都已完成正式治理 |
| 完成度展示 | 当前已有 `informationCollection`，但更深统计、筛选、治理读模型未完成 | 不可宣称前端治理面已完整掌握“还缺什么” |
