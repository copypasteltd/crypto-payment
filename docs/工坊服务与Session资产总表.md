# 灵办词元 工坊服务与Session资产总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 工坊服务与Session资产总表 |
| 文档类型 | Workshop, Service & Session Asset Matrix |
| 适用范围 | `agent-workshop` 全工作区 |
| 基准日期 | 2026-07-08 |
| 关联文档 | `docs/产品需求草案.md`、`docs/前端需求.md`、`docs/后端设计文档.md`、`docs/数据库与正式数据模型总表.md` |
| 使用目的 | 将工坊、服务、Session、版本、session pack、slot schema、依赖声明、发布链与资产生命周期统一表格化 |

## 2. 来源口径说明表

| 口径 | 含义 |
|---|---|
| `前端与产品已明确` | 工坊、服务、Creator 使用方式已在产品/前端需求中明确 |
| `后端设计已明确` | session pack、session version、slot schema 等在后端设计中明确 |
| `资产化推导` | 为支撑正式发布、复用、继承、回滚所提出的结构建议 |

## 3. 资产层级映射总表

| 层级 | 面向用户名称 | 系统对象建议 | 是否直接展示 | 说明 |
|---|---|---|---|---|
| L1 | 工坊 | `workshop` | 是 | 分发容器，承载一组服务 |
| L2 | 服务 | `task` | 是 | 用户可直接启动的能力单元 |
| L3 | 服务版本 | `task_version` | Web 内可见 | 决定服务配置与默认 session 版本 |
| L4 | Session | `session` | Creator 可见 | 录制与复用主对象 |
| L5 | Session 版本 | `session_version` | Creator 可见 | 真正可运行与可继承的资产单元 |
| L6 | Session Pack | `canonical session pack` | 不直接展示 | 长期事实源文件包 |
| L7 | Run | `run` | 是 | 资产派生出的执行实例 |

## 4. 用户侧概念与系统对象映射表

| 用户侧术语 | 系统内对象 | 说明 |
|---|---|---|
| 工坊 | `workshop` | 内容货架与分发入口 |
| 服务 | `task + task_version` | 真正可启动能力 |
| 模板/能力包 | `session + session_version` | Creator 内部维护对象 |
| 结果 | `run_artifact + target path snapshot` | 交付物 |
| 历史任务 | `run` | 执行记录 |
| 授权要求 | `slot_schema + credential requirement + mcp requirement` | 启动前说明 |

## 5. `workshop` 建议字段总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `id` | 工坊主键 | 资产化推导 |
| `workspace_id` | 所属空间 | 资产化推导 |
| `name` | 工坊名 | 前端与产品已明确 |
| `summary` | 工坊简介 | 前端与产品已明确 |
| `owner_type` | 归属类型，`workspace / creator / platform` | 资产化推导 |
| `owner_ref_id` | 归属对象引用 | 资产化推导 |
| `cover_asset_key` | 封面图对象键 | 资产化推导 |
| `visibility` | `private / workspace / public / marketplace` | 资产化推导 |
| `status` | `draft / published / archived / hidden` | 资产化推导 |
| `service_count` | 服务数缓存字段 | 资产化推导 |
| `favorite_count` | 收藏数缓存字段 | 资产化推导 |
| `created_by_user_id` | 创建者 | 资产化推导 |

## 6. `service/task` 建议字段总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `id` | 服务主键 | 后端设计已明确 |
| `workspace_id` | 所属空间 | 后端设计已明确 |
| `name` | 服务名 | 前端与产品已明确 |
| `summary` | 服务说明 | 前端与产品已明确 |
| `task_family` | 所属任务族 | 后端设计已明确 |
| `default_session_id` | 默认 session | 资产化推导 |
| `default_task_version_id` | 默认可启动版本 | 资产化推导 |
| `visibility` | 可见范围 | 资产化推导 |
| `status` | 上线状态 | 资产化推导 |
| `success_rate_snapshot` | 成功率快照 | 前端与产品已明确 |
| `duration_range_snapshot` | 耗时区间快照 | 前端与产品已明确 |
| `cost_range_snapshot` | 费用区间快照 | 前端与产品已明确 |
| `output_types_json` | 输出物类型列表 | 前端与产品已明确 |
| `auth_requirements_json` | 授权要求 | 前端与产品已明确 |

## 7. `task_version` 建议字段总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `id` | 服务版本主键 | 后端设计已明确 |
| `task_id` | 所属服务 | 后端设计已明确 |
| `version` | 版本号 | 后端设计已明确 |
| `session_version_id` | 绑定 session version | 资产化推导 |
| `service_config_json` | UI 展示与执行配置 | 资产化推导 |
| `release_channel` | `draft / internal / gray / general` | 资产化推导 |
| `status` | 当前状态 | 资产化推导 |
| `published_at` | 发布时间 | 资产化推导 |
| `rollback_from_version_id` | 回滚来源 | 资产化推导 |

## 8. `session` 建议字段总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `id` | session 主键 | 后端设计已明确 |
| `workspace_id` | 所属空间 | 资产化推导 |
| `name` | session 名称 | 资产化推导 |
| `task_family` | 适用任务族 | 后端设计已明确 |
| `source_session_id` | fork 来源 session | 后端设计已明确 |
| `current_published_version_id` | 当前发布版本 | 资产化推导 |
| `status` | `draft / active / archived` | 资产化推导 |
| `created_by_user_id` | Creator | 后端设计已明确 |

## 9. `session_version` 建议字段总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `id` | 版本主键 | 后端设计已明确 |
| `session_id` | 所属 session | 后端设计已明确 |
| `version` | 版本号 | 后端设计已明确 |
| `lineage_parent_version_id` | 父版本引用 | 资产化推导 |
| `manifest_s3_key` | manifest 对象键 | 后端设计已明确 |
| `pack_s3_key` | canonical pack 对象键 | 后端设计已明确 |
| `runtime_profile` | 运行环境需求 | 后端设计已明确 |
| `slot_schema_version` | 槽位 schema 版本 | 后端设计已明确 |
| `required_capabilities` | 所需能力声明 | 后端设计已明确 |
| `artifact_contract` | 产物契约 | 后端设计已明确 |
| `status` | `draft / published / archived` | 后端设计已明确 |
| `created_by_user_id` | Creator | 后端设计已明确 |
| `created_at` | 创建时间 | 后端设计已明确 |

## 10. Session Pack 文件结构总表

| 文件 | 作用 | 来源口径 |
|---|---|---|
| `conversation.jsonl` | 原始会话历史 | 后端设计已明确 |
| `tool-events.jsonl` | 工具调用历史 | 后端设计已明确 |
| `workspace-base.tar.zst` | 基础工作目录快照 | 后端设计已明确 |
| `slot-schema.json` | 输入槽位定义 | 后端设计已明确 |
| `runtime-config.json` | 运行配置 | 后端设计已明确 |
| `manifest.json` | 版本、来源、依赖说明 | 后端设计已明确 |
| `validator-set.json` | 关键状态断言 | 后端设计已明确 |
| `mcp-requirements.json` | MCP 与凭证需求 | 后端设计已明确 |

## 11. Session Pack Manifest 字段总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `session_id` | session 主标识 | 后端设计已明确 |
| `session_version` | 当前版本号 | 后端设计已明确 |
| `task_family` | 适用任务族 | 后端设计已明确 |
| `runtime_profile` | 运行环境要求 | 后端设计已明确 |
| `slot_schema_version` | 输入槽位版本 | 后端设计已明确 |
| `required_capabilities` | MCP、浏览器、文件、API 能力 | 后端设计已明确 |
| `artifact_contract` | 期望输出物定义 | 后端设计已明确 |
| `created_by` | Creator 信息 | 后端设计已明确 |
| `created_at` | 版本创建时间 | 后端设计已明确 |

## 12. Slot Schema 字段建议总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `slot_id` | 槽位唯一标识 | 资产化推导 |
| `label` | 表单展示名 | 资产化推导 |
| `type` | `text / textarea / file / image / select / oauth / credential-ref / boolean / number / date` | 资产化推导 |
| `required` | 是否必填 | 资产化推导 |
| `secret` | 是否敏感 | 资产化推导 |
| `placeholder` | 输入提示 | 资产化推导 |
| `description` | 帮助说明 | 资产化推导 |
| `validation_rules` | 校验规则 | 资产化推导 |
| `upload_accept` | 文件类型限制 | 资产化推导 |
| `default_value` | 默认值 | 资产化推导 |
| `repeatable` | 是否可重复 | 资产化推导 |
| `binds_to` | 绑定运行时字段或 provider | 资产化推导 |

## 13. MCP Requirement 字段建议总表

| 字段 | 含义 | 来源口径 |
|---|---|---|
| `capability_id` | 需求唯一标识 | 资产化推导 |
| `mcp_type` | `platform-managed / workspace-managed / user-byo-managed` | 后端设计已明确 |
| `provider_hint` | provider 提示 | 资产化推导 |
| `credential_type` | `api-key / oauth / cookie / json-file / none` | 后端设计已明确 |
| `required` | 是否必需 | 资产化推导 |
| `approval_required` | 是否需审批 | 后端设计已明确 |
| `risk_level` | 风险等级 | 后端设计已明确 |
| `network_policy_ref` | 出网策略引用 | 后端设计已明确 |

## 14. 资产生命周期状态矩阵表

| 对象 | 建议状态 | 说明 |
|---|---|---|
| `workshop` | `draft / published / hidden / archived` | 决定是否对外分发 |
| `task` | `draft / active / disabled / archived` | 决定服务是否可启动 |
| `task_version` | `draft / internal / gray / general / archived` | 决定版本发布通道 |
| `session` | `draft / active / archived` | 决定主记录可维护性 |
| `session_version` | `draft / published / archived` | 发布后冻结 |

## 15. Creator 生产流程总表

| 顺序 | 阶段 | 主要产物 | 结果 |
|---|---|---|---|
| 1 | 录制或导入 session | 初始 session | 有可编辑原型 |
| 2 | 清理与脱敏 | 可复用 session 基线 | 去除敏感信息 |
| 3 | 配置 slot schema | `slot-schema.json` | 形成输入契约 |
| 4 | 声明 MCP/凭证需求 | `mcp-requirements.json` | 形成运行前校验条件 |
| 5 | 配置 artifact contract | 产物规则 | 形成交付标准 |
| 6 | 打包 canonical session pack | pack + manifest | 形成长期资产 |
| 7 | 测试 fork | 调试 run | 形成验证证据 |
| 8 | 发布 task/session 版本 | `task_version`、`session_version` | 对外可启动 |
| 9 | 监控运行与修复漂移 | 新版本与 lineage | 长期维护 |

## 16. 资产继承与 fork 规则总表

| 规则 | 说明 | 来源口径 |
|---|---|---|
| fork 来源固定到 `session_version` | 每次 run 都必须绑定具体版本 | 后端设计已明确 |
| session pack 只读 | 运行期间不回写原资产 | 后端设计已明确 |
| run 增量单独保留 | 输出、trace、state 不污染原 pack | 后端设计已明确 |
| 如需续跑 | 从 checkpoint 或 run snapshot 生成新 run | 后端设计已明确 |
| 同一 session 可在不同用户 run 上绑定不同凭证 | 资产层和密钥解耦 | 后端设计已明确 |

## 17. 发布与回滚策略总表

| 对象 | 发布动作 | 回滚动作 | 说明 |
|---|---|---|---|
| `task_version` | 切换默认可启动版本 | 回指旧版本 | 影响前台启动入口 |
| `session_version` | 绑定到新 `task_version` | 恢复旧 `task_version -> session_version` 映射 | 影响运行资产 |
| `workshop` | 切换挂载服务集合与可见范围 | 恢复旧挂载 | 影响前台展示 |
| `mcp requirement` | 更新依赖声明 | 恢复旧 requirement 集 | 影响运行前校验 |

## 18. 资产依赖矩阵表

| 对象 | 依赖对象 | 依赖类型 |
|---|---|---|
| `workshop` | `task` | 展示挂载 |
| `task_version` | `session_version` | 执行绑定 |
| `session_version` | `slot_schema` | 输入依赖 |
| `session_version` | `mcp_requirements` | 能力依赖 |
| `run` | `task_version` | 启动依赖 |
| `run` | `credential bindings` | 运行依赖 |

## 19. 资产可见性矩阵表

| 对象 | 轻度用户 | 重度用户 | Creator | Admin |
|---|---:|---:|---:|---:|
| `workshop` | 可见 | 可见 | 可见 | 可见 |
| `task` | 可见 | 可见 | 可见 | 可见 |
| `task_version` | 不默认展示 | 摘要可见 | 可见 | 可见 |
| `session` | 不可见 | 不可见 | 可见 | 可见 |
| `session_version` | 不可见 | 不可见 | 可见 | 可见 |
| `session pack manifest` | 不可见 | 不可见 | 可见 | 可见 |
| `tool-events / conversation raw` | 不可见 | 摘要或隐藏 | 可见 | 可见 |

## 20. 当前资产化缺口总表

| 资产域 | 当前状态 | 缺口 |
|---|---|---|
| 工坊主数据 | 前端原型存在 | 无正式后端对象和接口 |
| 服务版本 | 前端展示存在 | 无正式版本模型和发布链 |
| Session 元数据 | 设计存在 | 无数据库与 S3 pack 落地 |
| Slot Schema | 设计存在 | 无前后端统一 editor / validator |
| Canonical Session Pack | 设计存在 | 无 packer / unpacker / signer |
| Lineage 与回滚 | 部分实现 | 已有 inherit draft 与 `lineage_parent_version_id` 元数据链，仍无 lineage 图与版本回滚接口 |

## 21. 当前已验证资产基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| 工坊 / 服务前台结构 | 已在 Dashboard / Mobile 落地 | `dashboardData.ts`、`mobileData.ts` |
| `taskVersionId / sessionVersionId` 启动映射 | 已在双端 `runTemplates` 写死 | `app/dashboard/src/lib/runTemplates.ts`、`app/mobile/src/lib/runTemplates.ts` |
| Run 主链 | 已真实存在 | `app/api` `runs` 主链 |
| `createInformationCollectionPrompt()` | 已真实存在 | `packages/domain-models/src/runs.ts` |
| 正式 workshop/service/session 后端域 | 未实现 | API 当前无对应对象与接口 |
| Canonical session pack | 部分实现 | `packages/session-pack` 已建立最小 manifest/pack/validate 骨架，并接入列表/详情、import、archive 导出与 inherit draft；发布与运行消费主链仍未闭环 |

## 22. 当前权威性分层表

| 层级 | 当前权威源 | 说明 |
|---|---|---|
| Run 执行实例 | 后端真实代码 | 当前唯一真实运行层 |
| 工坊 / 服务目录 | 前端静态种子 | 仅承载展示与原型交互 |
| Session / Session Version | 设计文档 + 前端静态映射 | 当前无正式数据库与对象存储事实源 |
| Session Pack | 设计文档 + 最小代码骨架 | 当前已有 pack / unpack / import / export / inherit draft，仍无 signer / publish / rollback |

## 23. 当前不可宣称完成的资产能力表

| 能力 | 当前原因 | 当前结论 |
|---|---|---|
| 正式工坊主数据 | 仅前端静态对象 | 不可宣称工坊目录已正式化 |
| 正式服务版本链 | `taskVersionId` 仅存在于前端模板 | 不可宣称服务版本治理已落地 |
| 正式 Session 资产链 | 无 `session/session_version` 后端域 | 不可宣称 Session 资产化已落地 |
| Canonical Session Pack | 仅完成最小 pack/import/export/inherit draft 骨架 | 不可宣称完整 pack 资产链已落地 |
