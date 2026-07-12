# 灵办词元 测试执行、冒烟回归与验收Gate总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 测试执行、冒烟回归与验收Gate总表 |
| 适用范围 | `agent-workshop` 全工作区，覆盖五仓、共享包与 runner 基础设施 |
| 统计日期 | 2026-07-07 |
| 统计口径 | 以当前 root scripts、各仓构建结果、现有无测试现状、联调链路与正式系统目标为准，细化到执行关卡、命令、证据和阻断条件 |
| 直接证据 | `package.json`、`app/dashboard/package.json`、`app/mobile/package.json`、`app/api/package.json`、`app/run-worker/package.json`、`app/container-bridge/package.json`、`docs/测试验证与用例矩阵总表.md`、`docs/联调与验收清单.md` |
| 输出目标 | 将本地冒烟、PR 回归、夜间回归、里程碑验收、发布 Gate、故障演练和证据口径整理为执行层表格 |

## 2. 当前可执行验证命令矩阵

| 层级 | 当前命令 | 当前作用 | 当前状态 |
|---|---|---|---|
| Root | `pnpm -C . typecheck:backend` | 检查 contracts/domain/api/run-worker/container-bridge 类型链 | 已通过 |
| Root | `pnpm -C . build:backend` | 编译后端主链与共享包 | 已通过 |
| Dashboard | `pnpm -C app/dashboard build` | 产出 Dashboard 静态构建物 | 已通过 |
| Mobile H5 | `pnpm -C app/mobile build:h5` | 产出 H5 构建物 | 已通过 |
| Dashboard | `pnpm -C app/dashboard lint` | 静态检查 Dashboard 源码 | 脚本已存在，未纳入统一 Gate |
| Mobile | `pnpm -C app/mobile build:weapp` | 构建微信小程序 | 脚本存在，当前未验证 |
| Mobile | `pnpm -C app/mobile build:alipay` | 构建支付宝小程序 | 脚本存在，当前未验证 |

## 3. 当前自动化资产现状矩阵

| 资产类型 | 当前情况 | 当前结论 |
|---|---|---|
| 单元测试文件 | 当前基本缺失 | 无可稳定回归的低层保护 |
| 集成测试 | 当前缺失 | API 与 runtime 组合行为无自动化证明 |
| E2E 测试 | 当前缺失 | 真实用户主链没有自动验收 |
| 构建验证 | 已存在 | 可证明代码能编译，但不能证明行为正确 |
| 类型验证 | 已存在 | 可发现契约级不一致 |
| 手工原型验视 | 已存在 | 可做视觉与流程人工检查 |

## 4. 本地开发冒烟 Gate 矩阵

| Gate | 最低命令集合 | 阻断条件 | 当前建议归属 |
|---|---|---|---|
| Backend 本地冒烟 | `pnpm -C . typecheck:backend` + `pnpm -C . build:backend` | 任一失败即阻断 | 后端开发者 |
| Dashboard 本地冒烟 | `pnpm -C app/dashboard build` + `pnpm -C app/dashboard lint` | build 或 lint 失败即阻断 | 前端开发者 |
| Mobile H5 本地冒烟 | `pnpm -C app/mobile build:h5` | build 失败即阻断 | H5/Taro 开发者 |
| 共享包本地冒烟 | `pnpm -C . build:shared` | 契约层编译失败即阻断 | 全员 |
| 文档回挂检查 | 新增文档后检查总表索引 | 文档未挂接主索引即阻断 | 文档维护者 |

## 5. PR 级回归 Gate 矩阵

| PR 类型 | 最低 Gate | 当前缺口 |
|---|---|---|
| 契约/领域模型变更 | typecheck + shared build + contracts/domain 单元测试 | 单元测试未落地 |
| API 变更 | backend build + API/service/file-access 单元测试 | 单元测试未落地 |
| Worker / Bridge 变更 | backend build + runtime/materializer/secret-loader 单元测试 | 单元测试未落地 |
| Dashboard 变更 | dashboard build + lint + adapter 测试 | adapter 测试未落地 |
| Mobile 变更 | mobile H5 build + adapter 测试 | adapter 测试未落地 |
| 文档/配置变更 | build 无回归 + 文档索引完整 | 当前靠人工检查 |

## 6. Nightly 回归 Gate 矩阵

| 模块 | 建议执行项 | 目标 |
|---|---|---|
| API | run create/get/message/approve/file/SSE 集成测试 | 验证 HTTP 主链 |
| Realtime | WS subscribe/send/approve/cancel + SSE fallback | 验证实时主链 |
| Worker | workspace/materialize/launch plan 集成测试 | 验证 runtime 物料输出 |
| Bridge | secret/mcp/event-parser/file-watcher 测试 | 验证容器内会话基础能力 |
| Frontend Adapter | Dashboard/Mobile snapshot adapter 测试 | 验证视图投影 |
| Example/Demo | 原型入口巡检 | 防止设计稿与工程稿漂移 |

## 7. 里程碑验收 Gate 矩阵

| 里程碑 | 必须通过的 Gate | 必须补齐的证据 |
|---|---|---|
| M1: 真实 run 对话联调 | API 集成 + WS/SSE + 双端消息收发手工录屏 | 实例创建到对话闭环 |
| M2: 文件链闭环 | 文件树、预览、下载、附件上传联调 | 双端文件操作录屏与日志 |
| M3: Docker runtime 闭环 | worker 真启停、bridge 事件回传、容器销毁 | runtime log、container log、artifact 结果 |
| M4: Creator 治理闭环 | package/release/replay/audit 主链 | Creator 工作台录屏、审计导出 |
| M5: 多租户上线前验收 | auth/workspace/permission/quota/audit 全链 | 角色矩阵、越权测试、回滚演练 |

## 8. 发布前人工验收 Gate 矩阵

| 验收面 | 必看项 | 结论口径 |
|---|---|---|
| Dashboard | 语言切换、抽屉侧栏、实例详情、Creator 深链 | 关键页面无断链、无严重布局错误 |
| Mobile H5 | 工坊、任务列表、任务对话、文件页、我的页 | 关键交互可闭环，明暗主题正常 |
| API | 核心接口返回、错误码、SSE/WS 行为 | 无 P0 错误 |
| Worker/Bridge | bridge 启动、文件监听、artifact 回传 | 无阻断性 runtime 异常 |
| 文档 | 总表、后端文档、前端文档、开发文档 | 与当前工程状态一致 |

## 9. 当前应落地的 P0 单元测试执行矩阵

| 归属 | 目标模块 | 最低用例 |
|---|---|---|
| `packages/contracts` | `runs/bridge/realtime/common` | schema parse、默认值、非法类型拒绝 |
| `packages/domain-models` | `runs.ts` | 状态迁移、事件投影、信息收集 prompt |
| `app/api` | `errors.ts` | `ZodError/AppError/Unknown` 归一化 |
| `app/api` | `RunsService` | create/message/approve/cancel/ingest |
| `app/api` | `RunFileAccessService` | 越界、目录读、文件不存在、截断读取 |
| `app/run-worker` | `workspace-preparer/container-runtime/run-lifecycle` | 路径、env、secret、mcp、launch plan |
| `app/container-bridge` | `secret-loader/mcp-materializer/event-parser` | secret 缺失、auth 分流、事件解析 |

## 10. 当前应落地的 P1 集成测试执行矩阵

| 链路 | 执行方式 | 验证点 |
|---|---|---|
| API HTTP 主链 | 启动 Fastify 测试实例 | create/get/message/approve/cancel/files |
| API SSE 主链 | 建 SSE 客户端 | snapshot 首帧、backlog、增量事件 |
| API WS 主链 | 建 WebSocket 客户端 | subscribe/ack/sendMessage/approve/cancel |
| Worker 物料主链 | 临时目录 + fake payload | runtime JSON、mcp config、launch plan |
| Bridge 本地控制面 | 启动本地 bridge CLI | health/control/sendMessage/approve |

## 11. 双端适配与回归矩阵

| 终端 | 当前最关键回归点 | 需要的自动化 |
|---|---|---|
| Dashboard | `RunSnapshot -> 实例详情/文件页/Creator 视图` 投影 | adapter 单测 + 页面级 smoke |
| Mobile H5 | `RunSnapshot -> 任务对话/审批卡/文件页` 投影 | adapter 单测 + H5 smoke |
| Mobile 小程序 | `TARO_ENV` 分支与下载行为 | 平台专项 smoke，当前未开始 |

## 12. 故障与恢复 Gate 矩阵

| 故障场景 | 验收点 | 当前状态 |
|---|---|---|
| API 重启 | run 聚合与 event backlog 能恢复 | 设计上可恢复，未自动化验证 |
| bridge 进程退出 | run 状态有明确落点 | 局部逻辑存在，未系统验证 |
| worker 生成 runtime 失败 | 返回明确错误并留痕 | 未系统验证 |
| 大文件读取 | read 接口截断且下载链仍可用 | 仅代码层可推导，未自动化验证 |
| 非法路径读取 | 返回 `FILE_PATH_INVALID` | 仅代码层可推导，未自动化验证 |

## 13. 发布 Gate 建议矩阵

| 阶段 | 最低 Gate | 是否允许人工替代 |
|---|---|---|
| PR | build + lint + 单元测试 | 不建议 |
| main merge | PR Gate + API 集成 | 可短期人工补，但不应长期依赖 |
| nightly | 集成 + adapter + runtime smoke | 不建议 |
| milestone | E2E 主链 + 故障演练 + 人工录屏验收 | 可以叠加人工 |
| release | 角色权限、审计、配额、回滚演练 | 不建议 |

## 14. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 真正测试文件基本缺失 | 当前几乎只有 build/typecheck | 回归成本高 | P0 |
| PR Gate 不完整 | lint/build 未统一编排 | 提交质量波动大 | P0 |
| 集成与 E2E 未落地 | run 主链无自动验收 | 线上风险高 | P1 |
| 小程序专项 smoke 未开始 | 首发 H5 之外无验证 | 平台扩展风险高 | P1 |

