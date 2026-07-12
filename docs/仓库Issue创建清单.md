# 灵办词元 仓库 Issue 创建清单

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 仓库 Issue 创建清单 |
| 文档类型 | Issue Creation Checklist / Repo Ticket Seed List |
| 适用范围 | `agent-workshop` 全工作区 |
| 基准日期 | 2026-07-08 |
| 关联文档 | `docs/仓库Backlog编号表.md`、`docs/Issue模板总表.md`、`docs/实施排期总表.md`、`docs/仓库完成度与模块状态表.md` |
| 使用目的 | 为首批 GitHub Issue 创建提供可直接复制的任务清单、标题、标签、依赖和验收口径 |

## 2. 使用说明表

| 项目 | 说明 |
|---|---|
| 创建粒度 | 一条 Issue 对应一个最小可交付目标 |
| 创建顺序 | 按批次和关键路径顺序创建 |
| 编号来源 | 全部来自 `docs/仓库Backlog编号表.md` |
| 标签来源 | 全部来自 `docs/Issue模板总表.md` |
| 验收口径 | 每条 Issue 必须落到可验证证据 |

## 3. 当前建卡口径校准表

| 当前代码基线 | 建议标题动词 | 说明 |
|---|---|---|
| 代码不存在 | `Bootstrap` / `Introduce` / `Create` | 适用于 `packages/db`、`packages/credential`、`packages/mcp`、`packages/session-pack` 等新增域 |
| 已有骨架但未正式可用 | `Harden` / `Promote` / `Complete` | 适用于 runner image、run-worker、bridge CLI、前端真实接线收口 |
| 已有局部真实接线 | `Replace` / `Wire` / `Finish` | 适用于静态数据退场、SDK 收口、实例/任务页真数据补齐 |
| 已有能力但边界不统一 | `Consolidate` / `Unify` / `Extract` | 适用于 SSE fallback、下载 helper、统一错误模型 |

## 4. 首批必须创建的 Issue 总表

| 顺位 | 编号 | 推荐标题 | 仓库 | 类型 | 优先级 | 估算 | 前置依赖 |
|---|---|---|---|---|---|---|---|
| 1 | `DB-001-001` | `[Feature][DB-001-001] Bootstrap packages/db with schema and migration entrypoint` | `packages/db` | Feature | P0 | M | 无 |
| 2 | `DB-002-001` | `[Feature][DB-002-001] Add runs core tables for run persistence` | `packages/db` | Feature | P0 | M | `DB-001-001` |
| 3 | `API-001-001` | `[Feature][API-001-001] Replace file-backed runs repository with DB repository` | `app/api` | Feature | P0 | L | `DB-001-001`、`DB-002-001` |
| 4 | `INF-001-001` | `[Infra][INF-001-001] Harden runner image for codex and playwright runtime` | `infra/docker` | Infra | P0 | M | 无 |
| 5 | `RWR-001-001` | `[Feature][RWR-001-001] Promote run-worker scaffold to persistent queue consumer` | `app/run-worker` | Feature | P0 | M | Redis 环境 |
| 6 | `RWR-002-001` | `[Infra][RWR-002-001] Execute docker run for isolated per-run runtime` | `app/run-worker` | Infra | P0 | L | `INF-001-001`、`RWR-001-001` |
| 7 | `BRG-001-001` | `[Feature][BRG-001-001] Harden bridge runtime CLI bootstrap and shutdown flow` | `app/container-bridge` | Feature | P0 | M | `INF-001-001` |
| 8 | `CRT-001-002` | `[Security][CRT-001-002] Implement credential broker and secret materialization flow` | `packages/credential` | Security | P0 | L | 无 |
| 9 | `MCP-001-002` | `[Security][MCP-001-002] Implement MCP registry and binding model` | `packages/mcp` | Security | P0 | L | 无 |
| 10 | `SDK-001-003` | `[Feature][SDK-001-003] Add auth and workspace client to api-sdk` | `packages/api-sdk` | Feature | P0 | M | auth/org API |

## 5. Batch 1 Issue 创建表

| 编号 | 推荐标题 | 标签 | 输出物 | 验收口径 |
|---|---|---|---|---|
| `DB-001-001` | `[Feature][DB-001-001] Bootstrap packages/db with schema and migration entrypoint` | `repo:db` `type:feature` `priority:P0` `phase:M1` | `packages/db` 初始结构、构建脚本、migration 入口 | `pnpm build` / `typecheck` 通过 |
| `DB-001-002` | `[Feature][DB-001-002] Add migration workflow and local DB bootstrap` | `repo:db` `type:feature` `priority:P0` `phase:M1` | migration 脚本、本地初始化脚本 | 新环境可初始化 DB |
| `DB-002-001` | `[Feature][DB-002-001] Add runs core tables for run persistence` | `repo:db` `domain:runs` `priority:P0` `phase:M1` | run/messages/approvals/artifacts/file_index 表 | migration 成功执行 |
| `API-001-001` | `[Feature][API-001-001] Replace file-backed runs repository with DB repository` | `repo:api` `domain:runs` `priority:P0` `phase:M1` | DB repository、service 接线 | 创建/读取/更新 run 成功 |
| `API-002-001` | `[Feature][API-002-001] Persist run snapshots and projections in DB-backed service` | `repo:api` `domain:runs` `priority:P0` `phase:M1` | snapshot/projection 调整 | API 主链不再依赖 JSON 权威源 |

## 6. Batch 2 Issue 创建表

| 编号 | 推荐标题 | 标签 | 输出物 | 验收口径 |
|---|---|---|---|---|
| `INF-001-001` | `[Infra][INF-001-001] Harden runner image for codex and playwright runtime` | `repo:infra` `domain:runtime` `type:infra` `priority:P0` `phase:M2` | runner image、构建脚本 | 镜像内 bridge CLI 可启动 |
| `RWR-001-001` | `[Feature][RWR-001-001] Promote run-worker scaffold to persistent queue consumer` | `repo:run-worker` `domain:runtime` `priority:P0` `phase:M2` | worker 入口、队列消费 | start-run job 可消费 |
| `RWR-002-001` | `[Infra][RWR-002-001] Execute docker run for isolated per-run runtime` | `repo:run-worker` `domain:runtime` `priority:P0` `phase:M2` `risk:high` | docker executor | 真实容器可启动 |
| `RWR-002-002` | `[Infra][RWR-002-002] Stop and cleanup per-run containers and workspace residues` | `repo:run-worker` `domain:runtime` `priority:P0` `phase:M2` | stop/cleanup 逻辑 | 容器可停止并清理 |
| `BRG-001-001` | `[Feature][BRG-001-001] Harden bridge runtime CLI bootstrap and shutdown flow` | `repo:container-bridge` `domain:runtime` `priority:P0` `phase:M2` | CLI 启停稳定化 | bridge 生命周期稳定 |

## 7. Batch 3 Issue 创建表

| 编号 | 推荐标题 | 标签 | 输出物 | 验收口径 |
|---|---|---|---|---|
| `CRT-001-001` | `[Security][CRT-001-001] Bootstrap credential package and broker interfaces` | `repo:credential` `domain:credential` `type:security` `priority:P0` `phase:M3` | 包结构、interface | 包可构建 |
| `CRT-001-002` | `[Security][CRT-001-002] Implement credential broker and secret materialization flow` | `repo:credential` `domain:credential` `priority:P0` `phase:M3` `risk:high` | broker、materializer | 脱敏+注入链可用 |
| `MCP-001-001` | `[Security][MCP-001-001] Bootstrap MCP package and binding interfaces` | `repo:mcp` `domain:mcp` `priority:P0` `phase:M3` | 包结构、interface | 包可构建 |
| `MCP-001-002` | `[Security][MCP-001-002] Implement MCP registry and binding model` | `repo:mcp` `domain:mcp` `priority:P0` `phase:M3` `risk:high` | registry、binding model | registry 可调用 |
| `BRG-003-001` | `[Security][BRG-003-001] Add MCP runtime isolation and transport policy hooks` | `repo:container-bridge` `domain:mcp` `risk:high` `priority:P0` `phase:M3` | runtime adapter | third-party MCP 可控接入 |

## 8. Batch 4 Issue 创建表

| 编号 | 推荐标题 | 标签 | 输出物 | 验收口径 |
|---|---|---|---|---|
| `SDK-001-001` | `[Feature][SDK-001-001] Add file download helper to api-sdk` | `repo:api-sdk` `domain:files` `priority:P1` `phase:M4` | SDK helper | 前端不再手拼 URL |
| `SDK-001-002` | `[Feature][SDK-001-002] Add SSE fallback helper to api-sdk` | `repo:api-sdk` `domain:runs` `priority:P1` `phase:M4` | SSE helper | 两端共用 fallback |
| `DSH-002-002` | `[Integration][DSH-002-002] Wire instance detail page to realtime snapshot and events` | `repo:dashboard` `domain:runs` `type:integration` `priority:P1` `phase:M4` | 实例详情真接线 | 实时对话可用 |
| `MOB-002-002` | `[Integration][MOB-002-002] Wire task detail page to realtime snapshot and events` | `repo:mobile` `domain:runs` `type:integration` `priority:P1` `phase:M4` | 任务详情真接线 | H5 对话主链可用 |
| `DSH-004-001` | `[Feature][DSH-004-001] Add auth and workspace switching to dashboard` | `repo:dashboard` `domain:auth` `priority:P0` `phase:M4` | 登录态/空间态 | 权限边界正确 |
| `MOB-003-001` | `[Feature][MOB-003-001] Add auth and workspace switching to mobile H5` | `repo:mobile` `domain:auth` `priority:P0` `phase:M4` | 登录态/空间态 | H5 用户态可用 |

## 9. Batch 5 / Batch 6 Issue 创建表

| 编号 | 推荐标题 | 标签 | 输出物 | 验收口径 |
|---|---|---|---|---|
| `SES-001-001` | `[Feature][SES-001-001] Define session pack manifest and package structure` | `repo:session-pack` `domain:creator` `priority:P1` `phase:M5` | manifest 与格式规范 | pack 可校验 |
| `API-005-001` | `[Feature][API-005-001] Add session pack import export and publish APIs` | `repo:api` `domain:creator` `priority:P1` `phase:M5` | import/export/publish routes | pack 流程可跑通 |
| `DSH-003-001` | `[Integration][DSH-003-001] Wire creator package and version pages to real APIs` | `repo:dashboard` `domain:creator` `priority:P1` `phase:M5` | Creator 真接线 | 发布链页面可用 |
| `API-003-001` | `[Security][API-003-001] Add auth middleware and protected route policy` | `repo:api` `domain:auth` `priority:P0` `phase:M6` | auth middleware | 未授权访问被拒绝 |
| `API-006-001` | `[Security][API-006-001] Add audit trail for run credential mcp and creator actions` | `repo:api` `domain:auth` `type:security` `priority:P1` `phase:M6` | audit service | 审计记录齐全 |
| `INF-002-001` | `[Infra][INF-002-001] Add CI pipeline for build typecheck and test gates` | `repo:infra` `type:infra` `priority:P1` `phase:M6` | workflow files | CI 自动跑通 |

## 10. 每条 Issue 必填标签组合表

| 类型 | 最少标签组合 |
|---|---|
| API Feature | `repo:api` + `type:feature` + `priority:*` + `phase:*` |
| Runtime Infra | `repo:run-worker` 或 `repo:container-bridge` + `type:infra` + `domain:runtime` + `risk:high` |
| Security | `type:security` + `domain:*` + `priority:*` + `phase:*` |
| Frontend Integration | `repo:dashboard` 或 `repo:mobile` + `type:integration` + `domain:*` |
| Creator Feature | `domain:creator` + `phase:M5` |

## 11. 每条 Issue 建卡模板字段表

| 字段 | 示例 |
|---|---|
| Title | `[Feature][API-001-001] Replace file-backed runs repository with DB repository` |
| Repository | `app/api` |
| Type | `Feature` |
| Priority | `P0` |
| Estimate | `L` |
| Phase | `M1` |
| Labels | `repo:api`, `type:feature`, `domain:runs`, `priority:P0`, `phase:M1` |
| Dependency | `DB-001-001`, `DB-002-001` |
| Output | `DB repository + service integration + migration evidence` |
| Acceptance | `POST /v1/runs`, `GET /v1/runs/:runId` 基于 PostgreSQL 成功` |

## 12. 建卡先后顺序表

| 创建波次 | 目标 | 建议 Issue 数量 |
|---|---|---|
| Wave 1 | 关键路径起点 | 8-10 |
| Wave 2 | Docker/runtime 闭环 | 6-8 |
| Wave 3 | Credential/MCP 治理 | 6-8 |
| Wave 4 | Dashboard/H5 联调 | 8-12 |
| Wave 5 | Session Pack / Creator | 4-6 |
| Wave 6 | Auth/Audit/CI-CD | 6-8 |

## 13. 当前不建议过早创建的 Issue 表

| 编号方向 | 原因 |
|---|---|
| 大量 P2 UI 优化 Issue | 当前主链尚未稳定，容易稀释重点 |
| Mini Program 细化 Issue | H5 真实链路未完成前不建议拆太细 |
| 成本/用量报表细化 Issue | auth/audit/正式数据层未落地前意义有限 |
| 大规模回归用例 Issue | 在主链基本稳定前会频繁重写 |

## 14. 建卡检查清单表

| 检查项 | 是否必须 |
|---|---|
| 是否带 backlog 编号 | 是 |
| 是否指定单一主仓库 | 是 |
| 是否写明前置依赖 | 是 |
| 是否写明输出物 | 是 |
| 是否写明验收口径 | 是 |
| 是否带正确标签 | 是 |
| 是否声明风险 | 高风险域必填 |
| 是否声明证据附件类型 | Integration / Infra / Security 必填 |

## 15. 建议首批 Project 分组表

| Project Group | 包含 Issue |
|---|---|
| Foundation / DB | `DB-*`、`API-001-*` |
| Runtime / Isolation | `INF-001-*`、`RWR-*`、`BRG-001-*` |
| Security / Governance | `CRT-*`、`MCP-*`、`API-003-*`、`API-006-*` |
| Frontend Integration | `SDK-*`、`DSH-*`、`MOB-*` |
| Creator / Session Pack | `SES-*`、`API-005-*`、`DSH-003-*` |

## 16. Issue 关闭前证据表

| Issue 类型 | 最少证据 |
|---|---|
| Feature | 构建通过 + 代码入口 + 验收说明 |
| Integration | 页面证据 + 请求/事件日志 |
| Infra | 命令输出 + 容器/镜像证据 |
| Security | 脱敏/拒绝/审计结果 |
| Bug | 复现前后对比 |

## 17. 当前半成品续做 Issue 表

| 编号 | 当前基线 | 建议建卡标题方向 | 原因 |
|---|---|---|---|
| `INF-001-001` | runner Dockerfile 与 entrypoint 已存在 | `Harden runner image...` | 当前不是从零开始，重点是正式化与验证 |
| `RWR-001-001` | run-worker 已是可编译库与能力导出层 | `Promote run-worker scaffold...` | 重点是转为常驻消费者，不是新建目录 |
| `RWR-002-001` | 已能生成 container launch plan | `Execute docker run...` | 执行层缺失，不是参数设计缺失 |
| `BRG-001-001` | bridge CLI、PTY、上下文加载、退出路径已存在 | `Harden bridge runtime CLI...` | 重点是强化异常、自愈、日志与正式策略 |
| `SDK-001-002` | 双前端各自已有 SSE fallback 逻辑 | `Extract shared SSE fallback helper...` | 重点是统一，不是首次实现 |
| `DSH-002-002` | Dashboard 实例页已接 snapshot/realtime/messages/files | `Finish wiring instance detail...` | 重点是清退静态补充数据与补边角 |
| `MOB-002-002` | H5 任务详情已接 snapshot/realtime/messages | `Finish wiring task detail...` | 重点是补审批、认证、失败恢复 |

## 18. 当前最值得先建的 Issue 表

| 顺位 | 编号 | 原因 |
|---|---|---|
| 1 | `INF-001-001` | 本地基础已存在，最快形成正式 runtime 地基 |
| 2 | `BRG-001-001` | bridge 是运行主链关键点，已有骨架，收口收益高 |
| 3 | `SDK-001-001` | 改动面小且能同时降低双前端重复代码 |
| 4 | `SDK-001-002` | 双前端都受益，且实现证据已存在于页面层 |
| 5 | `DSH-002-002` | Dashboard 实例页已处于真实联调边缘，补齐收益高 |
| 6 | `MOB-002-002` | H5 是首发端，任务对话页最接近正式主链 |
