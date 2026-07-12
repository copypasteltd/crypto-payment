# 灵办词元 Run槽位收集与首轮追问执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Run槽位收集与首轮追问执行总表 |
| 适用范围 | `app/api`、`packages/contracts`、`packages/domain-models`、`app/dashboard`、`app/mobile`、`app/run-worker` |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 `CreateRunInput`、`createInformationCollectionPrompt()`、`RunsService.createRun()`、双端 run template 为准 |
| 直接证据 | `packages/contracts/src/runs.ts`、`packages/domain-models/src/runs.ts`、`app/api/src/modules/runs/service.ts`、`app/api/src/modules/sessions/service.ts`、`app/api/tests/run-information-collection.smoke.test.mjs`、`app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts`、`docs/Run实例化与首轮信息收集链路总表.md` |
| 输出目标 | 将“先实例化，再由 Codex 首轮追问”落到槽位对象、状态机、消息链、附件参与方式和执行边界表格 |

## 2. 当前运行创建边界矩阵

| 字段 | 当前要求 | 当前来源 | 当前结论 |
|---|---|---|---|
| `workspaceId` | 必填 | 双端模板 | 实例化前必须确定 |
| `taskVersionId` | 必填 | 双端模板 | 实例化前必须确定 |
| `sessionVersionId` | 必填 | 双端模板 | 实例化前必须确定 |
| `title` | 必填 | 双端模板 | 实例列表展示用 |
| `targetPath` | 必填 | 双端模板 | 目录边界必须提前建立 |
| `entrySurface` | 必填 | 双端模板 | 影响交互与埋点 |
| `initialMessage` | 当前固定 `null` | 双端模板 | 业务材料不在实例化阶段提交 |
| `bindings` | 必填 | 双端模板 | 能力依赖需先确定 |

## 3. 当前创建链路执行矩阵

| 步骤 | 执行方 | 输入 | 动作 | 输出 |
|---|---|---|---|---|
| 1 | 前端 | 服务选择、工作区、固定 bindings | 组装 `CreateRunInput` | `POST /v1/runs` |
| 2 | API | `CreateRunInput` | 创建 `RunRecord`，状态为 `CREATED` | `run` |
| 3 | API | `run` | 通过 `createInformationCollectionPrompt()` 生成首轮 system prompt | 首轮 prompt |
| 4 | API | prompt | 保存为 `messages[0]`，并返回 `nextPrompt + informationCollection` | `CreateRunResponse` |
| 5 | API | run + prompt | 生成 seed files、seed artifacts、seed approval、start job | run 聚合快照 |
| 6 | 前端 | `CreateRunResponse` | 跳转到 run 对话页 | 用户看到首轮提问 |
| 7 | 用户 / Codex | 后续消息 | 在同一会话中持续补齐材料和说明 | 进入执行态 |

## 4. 当前首轮追问内容矩阵

| 内容来源 | 当前内容 | 用途 |
|---|---|---|
| `createInformationCollectionPrompt()` 第 1 行 | “请问你需要我提供什么信息给你” | 把收集职责交给 Codex |
| 第 2 行 | 当前任务标题 | 提示当前服务目标 |
| 第 3 行 | 目标路径 | 提示结果落点 |
| 第 4 行 | 要求 Codex 告诉用户继续执行前所需的资料、账号、授权、审批和补充说明 | 约束追问范围 |

## 5. 当前已落地的轻量结构化槽位矩阵

| 对象 | 当前状态 | 说明 |
|---|---|---|
| `run.informationCollection` | 已实现 | run 创建时按 session slot schema 生成 |
| `run.informationCollection.slots[]` | 已实现 | 当前保存 slot 元信息、完成状态、附件计数，以及轻量文本答案摘要 |
| `attachments[].slotKey` | 已实现 | 用户补传文件时可把附件绑定到 file/directory 槽位 |
| 文本型轻量 `slot answer` | 已实现 | 当前可通过 `slotValues[]` 或“单缺口纯文本回复”回填到 run 聚合内 |
| 文本型 `slot answer` 独立正式对象 | 未实现 | 当前仍缺独立答案表、独立审计与更深 extractor |

## 6. 正式 `run_slot_requirement` 对象矩阵

| 字段 | 类型 | 用途 |
|---|---|---|
| `slot_requirement_id` | string | 槽位需求主键 |
| `run_id` | string | 所属 run |
| `slot_key` | string | 槽位标识，如 `filing_period`、`brand_style` |
| `slot_label` | localized string | 前端和审计可读名称 |
| `required` | boolean | 是否必填 |
| `value_type` | `text / enum / file / credential_ref / approval_rule / date_range / path_hint` | 值类型 |
| `state` | `missing / provided / confirmed / rejected` | 当前完成状态 |
| `source` | `service_template / codex_inferred / user_requested` | 槽位来源 |
| `last_message_id` | string \| null | 最近更新该槽位的消息 |

## 7. 正式 `run_slot_answer` 对象矩阵

| 字段 | 类型 | 用途 |
|---|---|---|
| `slot_answer_id` | string | 槽位答案主键 |
| `run_id` | string | 所属 run |
| `slot_key` | string | 对应槽位 |
| `answer_source` | `user_message / attachment / system_default / approver_decision` | 答案来源 |
| `value_text` | string \| null | 文本型答案 |
| `value_ref` | string \| null | 文件、credential、approval 等引用 |
| `answered_by_user_id` | string \| null | 回答人 |
| `answered_at` | datetime | 回答时间 |
| `confirmed` | boolean | 是否被 Codex 或系统确认可用 |

## 8. `run_collection_state` 状态机矩阵

| 状态 | 含义 | 进入条件 | 可流向 |
|---|---|---|---|
| `not_started` | run 刚创建，尚未开始有效收集 | run 创建完成 | `collecting` |
| `collecting` | Codex 正在追问与整理 | 首轮 prompt 发出后 | `ready_for_execution`、`blocked`、`cancelled` |
| `ready_for_execution` | 必填槽位已满足 | 缺失数为 0 且无需额外审批 | `executing` |
| `blocked` | 缺失关键输入或等待关键审批 | Codex 或系统判定暂时不可执行 | `collecting`、`cancelled` |
| `executing` | 已进入主执行阶段 | Worker/Bridge 开始执行主任务 | `completed`、`failed` |
| `completed` | 主执行结束成功 | 任务成功 | 终态 |
| `cancelled` | 用户取消或审批拒绝 | 任务终止 | 终态 |
| `failed` | 主执行失败 | 执行失败 | `collecting` 或终态 |

## 9. 槽位类型执行矩阵

| `value_type` | 典型示例 | 当前由谁补齐 | 后续挂载位置 |
|---|---|---|---|
| `text` | 业务说明、风格偏好 | 用户对话回复 | 消息与槽位答案 |
| `enum` | 渠道、输出模式 | 用户选择 | 槽位答案 |
| `file` | 报税材料、参考图、合同 | 用户上传附件 | `inputs/` 或对象存储 |
| `credential_ref` | 登录态、浏览器状态、API key 选择 | 用户或工作区预置 | credential binding |
| `approval_rule` | “提交前必须问我” | 用户说明 | approval policy |
| `date_range` | 报税期、投放周期 | 用户回复 | 槽位答案 |
| `path_hint` | 指定子目录、命名约束 | 用户回复或服务默认 | target path policy |

## 10. 槽位收集与附件联动矩阵

| 场景 | 当前状态 | 正式执行建议 |
|---|---|---|
| 文本回复补槽位 | 已支持消息发送 | 当前支持 `slotValues[]` 显式回填，且在只剩一个必填文本槽位且无附件时支持轻量自动回填 |
| 上传材料补槽位 | 上传链已落地，且 `attachments[].slotKey` 可驱动 file/directory 槽位完成态更新 | 继续补独立答案表与更深归因 |
| 引用工作区共享文件补槽位 | 当前未支持 | 允许从 workspace file picker 生成附件引用 |
| 审批说明补槽位 | 已有 approvals，但无槽位映射 | 将“提交前确认”写入 `approval_rule` 槽位 |

## 11. 槽位完成度展示矩阵

| 展示对象 | Dashboard | H5 |
|---|---|---|
| 缺失槽位数 | 对话头部状态条 | 任务头部折叠摘要 |
| 已补齐材料清单 | 对话侧栏或详情区 | 对话详情页 |
| 当前阻塞原因 | runtime/audit 面板 | 任务摘要提示 |
| 下一步建议 | system prompt + sticky note | system prompt + 顶部提示 |

## 12. 审批与槽位边界矩阵

| 场景 | 是否属于槽位收集阶段 | 处理方式 |
|---|---|---|
| 用户补主体信息、时间范围、风格偏好 | 是 | 普通消息或附件补齐 |
| 用户上传材料文件 | 是 | 写入 `input_material` 并回填槽位 |
| 用户确认“是否继续提交” | 否 | 走 `approvals` 链路 |
| 用户要求继续追问后再执行 | 是 | 保持 `collecting` |

## 13. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 无独立槽位正式域 | 当前结构化状态在 `run.informationCollection` 内，未拆成 `run_slot_requirement / run_slot_answer` | 审计、查询与深治理不足 | P0 |
| 文本型槽位独立正式域未落地 | 当前 file/directory 可通过 `slotKey` 附件绑定推进，文本答案也可轻量挂入 run 聚合，但无独立 `run_slot_answer` 正式对象 | 深审计、查询与治理不足 | P0 |
| 无独立完成度读模型 | 当前 `run.informationCollection.status` 已存在，但没有专门列表筛选与统计对象 | 前端治理面能力不足 | P1 |
| prompt 还偏通用 | 首轮追问不区分服务策略 | 复杂服务的收集效率不足 | P1 |

## 14. 当前已验证槽位收集起点表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| 首轮追问 prompt | 已实现 | `createInformationCollectionPrompt()` |
| `attachments[]` 契约 | 已存在 | `packages/contracts/src/runs.ts` |
| `sendRunMessage()` | 已支持携带附件引用字段 | `app/api/src/modules/runs/service.ts` |
| 对话内附件补传链 | 已实现 | `packages/api-sdk/src/index.ts`、`app/mobile/src/pages/tasks/detail.tsx`、`app/dashboard/src/pages/instances/InstancesPage.tsx` |
| `run.informationCollection` | 已实现 | `packages/contracts/src/runs.ts`、`packages/domain-models/src/runs.ts`、`app/api/src/modules/runs/service.ts` |
| `attachments[].slotKey` 绑定 file 槽位 | 已实现并有 smoke | `app/api/tests/run-information-collection.smoke.test.mjs` |
| 文本槽位轻量答案回填 | 已实现并有 smoke | `packages/contracts/src/runs.ts`、`packages/domain-models/src/runs.ts`、`app/api/tests/run-information-collection.smoke.test.mjs` |
| `run_slot_requirement` 独立正式对象 | 未实现 | 当前无代码与接口 |
| `run_collection_state` 独立正式对象 | 未实现 | 当前无代码与接口 |

## 15. 当前不可宣称完成的槽位能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 完整结构化槽位对象 | 只有 run 聚合内轻量状态，没有独立正式域 | 不可宣称槽位收集已完全落地 |
| 槽位与答案正式域全覆盖 | 当前 file/directory 槽位支持 `slotKey` 绑定，文本槽位已有轻量聚合内答案摘要，但仍无独立正式域 | 不可宣称所有槽位类型都已完成正式治理 |
| 服务级差异化追问 | prompt 仍是通用模板 | 不可宣称复杂服务收集策略已完成 |
