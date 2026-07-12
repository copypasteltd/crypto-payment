# 灵办词元 Issue 模板总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Issue 模板总表 |
| 文档类型 | Issue Taxonomy / Template Matrix |
| 适用范围 | `agent-workshop` 全工作区 |
| 基准日期 | 2026-07-07 |
| 关联文档 | `docs/仓库Backlog编号表.md`、`docs/开发任务拆解总表.md`、`docs/联调与验收清单.md` |
| 使用目的 | 统一 GitHub Issue 的类型、字段、标签、优先级、模板与验收口径 |

## 2. 使用规则表

| 规则 | 说明 |
|---|---|
| 一条 Issue 只对应一个最小可交付目标 | 避免把多域改动堆进同一条 Issue |
| Issue 标题必须包含 Backlog 编号 | 便于跨文档追踪 |
| 每条 Issue 都必须附带验收口径 | 不接受只有实现描述没有验收条件 |
| 高风险能力必须附带风险说明 | Credential、MCP、Docker、Auth、Files 属于高风险域 |
| 所有联调类 Issue 必须绑定证据输出 | 截图、日志、响应样例、容器证据至少一种 |

## 3. Issue 类型分类表

| 类型 | 使用场景 | 建议前缀 | 示例 |
|---|---|---|---|
| Feature | 新能力开发 | `[Feature]` | `[Feature][API-001-001] Replace file-backed runs repository` |
| Integration | 联调与接线 | `[Integration]` | `[Integration][DSH-002-002] Wire instance detail realtime` |
| Bug | 缺陷修复 | `[Bug]` | `[Bug][BRG-004-001] Bridge start fails when runtime config missing` |
| Refactor | 结构调整但不改变业务目标 | `[Refactor]` | `[Refactor][DOM-001-001] Rebuild run projection model` |
| Infra | 环境、镜像、CI/CD、部署 | `[Infra]` | `[Infra][INF-002-001] Add build/typecheck pipeline` |
| Security | 凭证、权限、审计、隔离 | `[Security]` | `[Security][CRT-001-002] Add credential broker` |
| Research | 方案验证、预研、PoC | `[Research]` | `[Research][MCP-001-003] Evaluate third-party MCP policy model` |
| Docs | 文档、规范、索引维护 | `[Docs]` | `[Docs][DOC-001-001] Update system status table` |

## 4. 全局字段模板表

| 字段 | 是否必填 | 说明 |
|---|---|---|
| Backlog 编号 | 是 | 来自 `docs/仓库Backlog编号表.md` |
| 目标仓库 | 是 | 必须明确单仓或主仓 |
| 类型 | 是 | Feature / Integration / Bug / Infra / Security 等 |
| 优先级 | 是 | `P0 / P1 / P2` |
| 估算 | 是 | `S / M / L / XL` |
| 前置依赖 | 否 | 若依赖上游 Issue，必须引用编号 |
| 输出物 | 是 | 代码、接口、页面、脚本、镜像、日志等 |
| 验收口径 | 是 | 必须可被实际证据证明 |
| 风险说明 | 高风险域必填 | 说明对 MCP、Credential、Docker、Auth 的影响 |
| 证据归档 | 联调/运行时必填 | 指向截图、日志、请求样例、容器证据 |

## 5. 标签体系总表

| 标签类别 | 标签 | 用途 |
|---|---|---|
| 仓库 | `repo:api` | 标记 `app/api` |
| 仓库 | `repo:run-worker` | 标记 `app/run-worker` |
| 仓库 | `repo:container-bridge` | 标记 `app/container-bridge` |
| 仓库 | `repo:dashboard` | 标记 `app/dashboard` |
| 仓库 | `repo:mobile` | 标记 `app/mobile` |
| 仓库 | `repo:db` | 标记 `packages/db` |
| 仓库 | `repo:api-sdk` | 标记 `packages/api-sdk` |
| 仓库 | `repo:contracts` | 标记 `packages/contracts` |
| 仓库 | `repo:domain-models` | 标记 `packages/domain-models` |
| 仓库 | `repo:credential` | 标记 `packages/credential` |
| 仓库 | `repo:mcp` | 标记 `packages/mcp` |
| 仓库 | `repo:session-pack` | 标记 `packages/session-pack` |
| 仓库 | `repo:infra` | 标记 `infra/docker`、CI/CD |
| 域 | `domain:runs` | run 聚合与对话域 |
| 域 | `domain:files` | 文件、artifact、下载域 |
| 域 | `domain:runtime` | Docker、bridge、worker 域 |
| 域 | `domain:credential` | 凭证域 |
| 域 | `domain:mcp` | MCP 域 |
| 域 | `domain:auth` | 登录、workspace、member、role 域 |
| 域 | `domain:creator` | Creator、发布、治理域 |
| 阶段 | `phase:M1` ~ `phase:M6` | 对应里程碑 |
| 风险 | `risk:high` | 高风险能力 |
| 风险 | `risk:medium` | 中风险能力 |
| 风险 | `risk:low` | 低风险能力 |
| 类型 | `type:feature` | 功能开发 |
| 类型 | `type:integration` | 联调任务 |
| 类型 | `type:bug` | 缺陷修复 |
| 类型 | `type:infra` | 基础设施 |
| 类型 | `type:security` | 安全治理 |
| 优先级 | `priority:P0` | 阻断主链 |
| 优先级 | `priority:P1` | 重要但不阻断主链 |
| 优先级 | `priority:P2` | 优化/收尾 |

## 6. 优先级响应规则表

| 优先级 | 含义 | 建议响应时效 | 建议关闭时效 |
|---|---|---|---|
| P0 | 阻断主链或安全边界 | 24 小时内确认 | 1 个里程碑内解决 |
| P1 | 影响完整交付 | 2 个工作日内确认 | 2 个里程碑内解决 |
| P2 | 优化、体验、文档补强 | 1 周内确认 | 视排期安排 |

## 7. Issue 状态流转表

| 状态 | 含义 | 允许流转到 |
|---|---|---|
| `Todo` | 已建档未开始 | `In Progress`、`Blocked` |
| `In Progress` | 已进入实现 | `In Review`、`Blocked` |
| `Blocked` | 被上游依赖阻断 | `Todo`、`In Progress` |
| `In Review` | 代码或方案已提交评审 | `Done`、`In Progress` |
| `Done` | 已通过验收 | 无 |

## 8. 标准 Feature Issue 模板表

| 模板区块 | 填写要求 |
|---|---|
| 标题 | `[Feature][编号] 简述目标` |
| 背景 | 说明为什么需要这项能力 |
| 范围 | 明确修改仓库、模块、接口或页面 |
| 非范围 | 明确本条 Issue 不做什么 |
| 输出物 | 代码、接口、脚本、页面、文档 |
| 验收口径 | 可运行或可验证的结果 |
| 依赖 | 上游 backlog 编号或 issue 链接 |
| 风险 | 高风险能力必须写 |
| 证据 | 需要提交的截图、日志、响应、容器输出 |

## 9. 标准 Integration Issue 模板表

| 模板区块 | 填写要求 |
|---|---|
| 标题 | `[Integration][编号] 说明接线目标` |
| 联调对象 | 参与联调的仓库/服务 |
| 前置条件 | 必须已经完成的上游任务 |
| 接口面 | 需要接入的 API / Realtime / 文件 / runtime |
| 页面/流程 | 明确联调落点页面和用户流程 |
| 验收路径 | 从点击到结果的完整路径 |
| 证据 | 截图、录屏、请求日志、事件日志 |

## 10. 标准 Bug Issue 模板表

| 模板区块 | 填写要求 |
|---|---|
| 标题 | `[Bug][编号] 说明故障点` |
| 现象 | 用用户视角描述问题 |
| 复现步骤 | 必须可重复执行 |
| 实际结果 | 当前错误表现 |
| 预期结果 | 正确行为 |
| 影响范围 | 哪些仓库、页面、接口、角色受到影响 |
| 临时绕过方案 | 若存在则写明 |
| 修复验收 | 复现路径消失，回归项通过 |

## 11. 标准 Infra / Security Issue 模板表

| 模板区块 | 填写要求 |
|---|---|
| 标题 | `[Infra]` 或 `[Security]` + 编号 + 目标 |
| 风险背景 | 为什么这是基础设施/安全问题 |
| 影响资产 | 容器、凭证、MCP、用户数据、审计等 |
| 风险等级 | `high / medium / low` |
| 控制措施 | 本次要新增或修正的控制点 |
| 验收证据 | 配置、日志、容器证据、权限拒绝结果 |

## 12. 仓库映射模板表

| 仓库 | 建议默认类型 | 常见标签 | 额外说明 |
|---|---|---|---|
| `app/api` | Feature / Security / Integration | `repo:api`、`domain:runs`、`domain:auth` | 后端变更必须写接口与错误口径 |
| `app/run-worker` | Feature / Infra | `repo:run-worker`、`domain:runtime` | 必须附带 Docker/worker 证据 |
| `app/container-bridge` | Feature / Security / Bug | `repo:container-bridge`、`domain:runtime`、`domain:mcp` | 必须说明 PTY、runtime、事件影响 |
| `app/dashboard` | Feature / Integration / Bug | `repo:dashboard`、`domain:creator` | 必须附带页面截图或录屏 |
| `app/mobile` | Feature / Integration / Bug | `repo:mobile`、`domain:runs` | 必须附带 H5 页面证据 |
| `packages/db` | Feature / Infra | `repo:db` | 必须附带 migration 证据 |
| `packages/api-sdk` | Feature / Refactor | `repo:api-sdk` | 必须说明被哪些前端接入点消费 |
| `packages/contracts` | Feature / Refactor | `repo:contracts` | 必须说明上游/下游兼容性 |
| `packages/domain-models` | Feature / Refactor | `repo:domain-models` | 必须说明投影或状态机变化 |
| `packages/credential` | Security / Feature | `repo:credential`、`domain:credential` | 必须附带脱敏/注入/审计口径 |
| `packages/mcp` | Security / Feature / Research | `repo:mcp`、`domain:mcp` | 必须附带风险策略说明 |
| `packages/session-pack` | Feature | `repo:session-pack`、`domain:creator` | 必须附带 manifest 与兼容性说明 |
| `infra/docker` | Infra | `repo:infra`、`domain:runtime` | 必须附带镜像或 CI/CD 证据 |

## 13. Backlog 编号到 Issue 标题映射表

| Backlog 编号示例 | 推荐标题格式 |
|---|---|
| `API-001-001` | `[Feature][API-001-001] Replace file-backed runs repository with DB repository` |
| `RWR-002-001` | `[Infra][RWR-002-001] Execute docker run for isolated per-run runtime` |
| `BRG-003-001` | `[Security][BRG-003-001] Add MCP runtime isolation and transport policy hooks` |
| `DSH-002-002` | `[Integration][DSH-002-002] Wire instance detail page to realtime snapshot and events` |
| `MOB-002-003` | `[Integration][MOB-002-003] Connect task files page to file tree/read/download APIs` |

## 14. Parent / Child Issue 关系表

| 类型 | 适用场景 | 示例 |
|---|---|---|
| Parent -> Child | 一个里程碑拆成多仓子任务 | `M2 Parent` -> `RWR-002-001` + `INF-001-001` + `BRG-001-001` |
| Cross-link | 下游依赖上游交付 | `DSH-002-002` links to `API-002-001` |
| Blocked-by | 强依赖阻断 | `MOB-003-001` blocked by auth/org API |
| Relates-to | 非阻断但相关 | `SDK-001-002` relates to `DSH-002-002` |

## 15. Review 清单表

| Issue 类型 | Review 必看项 |
|---|---|
| Feature | 范围是否过大、验收是否明确、依赖是否写全 |
| Integration | 是否写明上下游接口、联调路径、异常态 |
| Bug | 复现路径是否稳定、回归范围是否明确 |
| Infra | 是否有运行证据、是否考虑回滚 |
| Security | 是否有风险说明、边界控制、审计方案 |

## 16. Merge 前条件表

| 条件 | 适用范围 |
|---|---|
| 构建或类型检查通过 | 全部代码 Issue |
| 关联文档已更新 | 涉及架构、接口、流程变更 |
| 验收证据已附上 | Integration / Infra / Security |
| 上游依赖已关闭或满足 | 被阻断关系存在时 |
| Reviewer 明确通过 | 全部代码 Issue |

## 17. GitHub Project 看板列建议表

| 列名 | 含义 |
|---|---|
| Inbox | 新建但尚未归类 |
| Ready | 已有清晰范围和依赖 |
| In Progress | 正在开发 |
| Blocked | 被依赖阻断 |
| Review | 等待评审 |
| Verify | 等待联调或验收 |
| Done | 已关闭 |

## 18. Issue 证据附件建议表

| 场景 | 建议附件 |
|---|---|
| API | curl/httpie 请求与响应 |
| Dashboard | 截图、录屏、接口日志 |
| Mobile H5 | 截图、录屏、控制台日志 |
| Worker | worker 日志、队列执行结果 |
| Docker | `docker ps`、`inspect`、容器日志 |
| Credential | 脱敏响应、secret manifest 样例 |
| MCP | binding 样例、策略校验、测试连接输出 |
| Session Pack | manifest、导入导出结果、版本记录 |

## 19. 建议首批创建的 Issue 集合表

| 建议顺位 | 编号 | 建议类型 | 原因 |
|---|---|---|---|
| 1 | `DB-001-001` | Feature | 正式 DB 包是所有主链的起点 |
| 2 | `API-001-001` | Feature | API 需要尽快脱离 JSON repository |
| 3 | `INF-001-001` | Infra | Runner image 是真运行前提 |
| 4 | `RWR-002-001` | Infra | Docker 真执行是运行闭环关键 |
| 5 | `CRT-001-002` | Security | 凭证治理是安全主链关键 |
| 6 | `MCP-001-002` | Security | MCP registry 决定第三方能力治理边界 |
| 7 | `DSH-002-002` | Integration | Dashboard 实例页是重度用户核心页面 |
| 8 | `MOB-002-002` | Integration | H5 任务对话页是轻度用户核心页面 |

