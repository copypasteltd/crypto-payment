# 灵办词元 Query缓存、实时合流与失效执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Query缓存、实时合流与失效执行总表 |
| 适用范围 | `app/dashboard`、`app/mobile`、`packages/api-sdk`、`app/api` SSE/WS 输出链 |
| 统计日期 | 2026-07-08 |
| 统计口径 | 以当前 React Query 初始化、双端 `runStream`、各页 `queryKey`、静态数据 fallback 与正式多用户目标为准 |
| 直接证据 | `app/dashboard/src/app/providers/AppProviders.tsx`、`app/mobile/src/app.tsx`、`app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts`、`app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/tasks/*.tsx`、`app/mobile/src/pages/workshops/index.tsx`、`app/mobile/src/pages/me/index.tsx` |
| 输出目标 | 把当前缓存键、实时写入、页面装载、失效策略、静态/live 并存与正式收敛方案细化到执行层表格 |

## 2. QueryClient 初始化矩阵

| 终端 | 位置 | 当前配置 | 当前结论 | 正式建议补充 |
|---|---|---|---|---|
| Dashboard | `app/dashboard/src/app/providers/AppProviders.tsx` | `retry: 1`、`staleTime: 30000` | 已有最基础缓存层 | 增加 `gcTime`、401 统一处理、query logger、离线策略 |
| Mobile H5 | `app/mobile/src/app.tsx` | `retry: 1`、`staleTime: 30000` | 与 Dashboard 保持一致 | 增加弱网重试、页面前后台切换策略、storage hydration 策略 |

## 3. 当前 Query Key 目录矩阵

| Query Key | 终端 | 用途 | 当前来源 |
|---|---|---|---|
| `["dashboard","runs"]` | Dashboard | run 列表 | `listRuns()` + realtime upsert |
| `["dashboard","runs", runId]` | Dashboard | run 详情 | `getRun()` + realtime snapshot/event |
| `["dashboard","runs", runId, "files"]` | Dashboard | 文件树 | `listRunFileTree()` + realtime files snapshot |
| `["dashboard","runs", runId, "files", "read", path]` | Dashboard | 文件文本预览 | `readRunFile()` |
| `["mobile","runs"]` | Mobile H5 | run 列表 | `listRuns()` + realtime upsert |
| `["mobile","runs", runId]` | Mobile H5 | run 详情 | `getRun()` + realtime snapshot/event |
| `["mobile","runs", runId, "files"]` | Mobile H5 | 文件树 | `listRunFileTree()` + realtime files snapshot |
| `["mobile","runs", runId, "files", "read", path]` | Mobile H5 | 文件文本预览 | `readRunFile()` |

## 4. 列表页装载矩阵

| 页面 | 当前 Query | 当前装载行为 | 当前问题 | 正式收敛方向 |
|---|---|---|---|---|
| Dashboard 实例页 | `["dashboard","runs"]` | 10s 轮询 + realtime 合流 | 与 `instances` 静态数据混合 | 分离 `live runs` 与 `reference templates` |
| Dashboard 工坊页 | 无目录 query，创建 run 后只失效 `["dashboard","runs"]` | 工坊目录仍来自 `dashboardData` | 目录与实例不在同一缓存体系 | 增加 `["dashboard","workshops"]`、`["dashboard","services"]` |
| Mobile 任务页 | `["mobile","runs"]` | 10s 轮询 + 与静态 `tasks` 合并 | live/static 双源排序逻辑复杂 | 正式化为只读后端列表，静态数据退到 mock adapter |
| Mobile 工坊页 | `["mobile","runs"]` | 仅为“最近任务”装载 live runs | 工坊目录本身不走 query | 增加工坊目录 query |
| Mobile 我的页 | `["mobile","runs"]` | 用于生成统计与最近任务 | 页面职责混杂 | 我的页拆出 `profile/workspaces/metrics` query |

## 5. 详情页装载矩阵

| 页面 | 当前 Query | 启用条件 | 当前补偿逻辑 | 风险 |
|---|---|---|---|---|
| Dashboard 实例详情 | `["dashboard","runs", runId]` | `isLiveRunId(...)` | 失败则回退到静态实例详情 | 用户可能误以为静态示例是真实状态 |
| Dashboard 文件面板 | `["dashboard","runs", runId, "files"]` | `isLiveRunId(...)` | 文件树失败仍保留静态文件列表 | live/static 边界不清晰 |
| Dashboard 文件预览 | `["dashboard","runs", runId, "files", "read", path]` | live + 文件 tab + 有选中文件 | 失败返回 `null` | 没有错误分级 |
| Mobile 任务详情 | `["mobile","runs", runId]` | `liveTaskId` | 失败或无数据则 `findVisibleTask(...)` | 真实实例与演示任务混用 |
| Mobile 文件页详情 | `["mobile","runs", runId]` + `["mobile","runs", runId, "files"]` | `liveTaskId` | 两级 query 均失败时回退到静态任务 | 文件状态可信度不足 |
| Mobile 文件预览 | `["mobile","runs", runId, "files", "read", path]` | live + 有选中文件 | 失败返回 `null` | 缺错误提示与下载策略分流 |

## 6. 实时合流执行矩阵

| 环节 | Dashboard 当前行为 | Mobile 当前行为 | 结论 |
|---|---|---|---|
| 建连策略 | 优先 WS，缺 WS 时回退 SSE | 优先 WS，缺 WS 时回退 SSE | 双端一致 |
| Snapshot 处理 | `setQueryData` 更新详情、列表、文件树 | 同上 | 当前核心合流点明确 |
| Event 处理 | `applyBridgeEventToRunSnapshot` 后写回详情/列表/文件树 | 同上 | 领域层已承担 event -> snapshot 折叠 |
| 断连处理 | 仅设置 `connected=false` | 仅设置 `connected=false` | 缺指数退避与自动重连状态机 |
| Ack/Error | SDK 支持，页面基本未消费 | SDK 支持，页面基本未消费 | 实时错误还未进入 UI 治理面 |

## 7. `sendMessage` 回退矩阵

| 终端 | 当前优先路径 | 回退路径 | 当前结果 | 正式建议 |
|---|---|---|---|---|
| Dashboard | realtime `sendMessage()` | HTTP `POST /v1/runs/:id/messages` | 基础可用 | 将“已通过 realtime 发送 / 已回退 HTTP”显式记入 telemetry |
| Mobile H5 | realtime `sendMessage()` | HTTP `POST /v1/runs/:id/messages` | 基础可用 | 增加弱网重试、发送态、失败态 |

## 8. 文件页缓存合流矩阵

| 数据项 | 当前 key | 当前写入方 | 当前问题 | 正式建议 |
|---|---|---|---|---|
| 文件树 | `["*","runs", runId, "files"]` | 轮询 query + realtime snapshot | `files.synced` 与页面路径筛选耦合 | 将路径筛选从数据层剥离为 selector |
| 文件预览 | `["*","runs", runId, "files", "read", path]` | read query | 与文件树更新没有版本关联 | 引入 `fileVersion` / `artifactVersion` |
| 下载链接 | 非 query，直接 URL 拼装 | 页面本地构造 | 没有下载授权缓存 | 正式改为 `download session` |

## 9. 失效触发矩阵

| 动作 | 当前失效键 | 当前是否完善 | 备注 |
|---|---|---|---|
| Dashboard 创建 run | `["dashboard","runs"]` | 部分完善 | 新 run 详情依赖后续列表同步 |
| Dashboard 发送消息 | `["dashboard","runs"]`、`["dashboard","runs",runId]`、`["dashboard","runs",runId,"files"]` | 较完善 | 与 realtime 并存，存在重复刷新 |
| Mobile 创建 run | `["mobile","runs"]` | 部分完善 | 任务详情靠跳转后再次 query |
| Mobile 发送消息 | `["mobile","runs"]`、`["mobile","runs",runId]` | 部分完善 | 文件树未显式失效 |
| 工作区切换 | 当前未统一实现 | 未实现 | 正式必须清空跨 workspace query |

## 10. 静态数据与 live 数据并存矩阵

| 页面 | 静态源 | live 源 | 当前融合方式 | 风险等级 |
|---|---|---|---|---|
| Dashboard 实例页 | `instances` | `listRuns/getRun` | 以 `mapRunSnapshotToInstanceRecord` 转换后混合 | 高 |
| Dashboard 工坊页 | `workshops/services/dashboardWorkspaces` | 仅创建 run 调真实 API | 目录静态、动作真实 | 中 |
| Mobile 任务页 | `mobileData/tasks` | `listRuns/getRun` | 先 live，后与静态去重合并 | 高 |
| Mobile 文件页 | `findVisibleTask` | `getRun/listRunFileTree` | live 失败则全量回退静态 | 高 |
| Mobile 工坊页 | `mobileData/workshops/services` | `listRuns` 仅作为最近任务补充 | 目录静态、最近任务 live | 中 |

## 11. Query 失败回退矩阵

| 页面 | 当前回退方式 | 当前问题 | 正式建议 |
|---|---|---|---|
| Dashboard 文件预览 | `catch { return null }` | 用户只看到空预览 | 返回结构化错误态 |
| Dashboard 详情/文件轮询 | live 失败继续保留旧状态或静态状态 | 错误来源不透明 | 增加 query banner 与 retry CTA |
| Mobile 任务详情 | `catch { return null }` 后回退静态任务 | 容易掩盖真实 API 故障 | 区分“无权限 / 无数据 / 网络失败 / 静态参考” |
| Mobile 文件页 | `catch { return null } / []` | 文件树失败被吞掉 | 文件面板显示明确错误态 |

## 12. 正式收敛建议矩阵

| 方向 | 建议 |
|---|---|
| Query Key 分层 | 顶层补齐 `auth`、`workspaces`、`workshops`、`services`、`creator packages`，避免所有页面共用 `runs` 做侧向派生 |
| 静态数据退场 | 所有静态 reference data 下沉到 `mock adapter`，通过 `MODE=mock/real` 切换，页面不直接 import 静态数据 |
| Realtime 合流 | 保留当前 `snapshot + applyBridgeEventToRunSnapshot` 主链，补 `reconnect state`、`lastEventId`、`backoff` |
| 失败语义 | 把 `null` 回退替换为结构化错误对象，前端按错误码渲染 |
| 工作区隔离 | 切换工作区时统一 `queryClient.clear()` 或按命名空间批量失效 |
| 文件版本化 | 为文件树与预览引入版本号或 `artifact watermark`，避免看到旧预览 |

## 13. 当前阻塞项总表

| 阻塞项 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 静态数据与 live 数据并存 | 多个页面同时依赖本地 data 与真实 API | 无法建立统一真实性语义 | P0 |
| 缺 `auth/workspace` 顶层 query | 所有页面自行决定上下文 | 工作区切换与鉴权无法统一 | P0 |
| Query 失败被吞掉 | 大量 `catch { return null } / []` | 调试与用户提示不足 | P1 |
| 实时断线无统一重连状态机 | 仅 `connected=false` | 长会话稳定性不足 | P1 |

## 14. 当前已验证缓存与实时基线表

| 项 | 当前真实状态 | 证据 |
|---|---|---|
| QueryClient 初始化 | Dashboard 与 Mobile 均为 `retry:1`、`staleTime:30000` | `app/dashboard/src/app/providers/AppProviders.tsx`、`app/mobile/src/app.tsx` |
| 列表缓存键 | 已落地 `["dashboard","runs"]`、`["mobile","runs"]` | `app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/tasks/index.tsx` |
| 详情缓存键 | 已落地 `["*","runs",runId]` | `app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/tasks/detail.tsx` |
| 文件树缓存键 | 已落地 `["*","runs",runId,"files"]` | `app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/tasks/files.tsx` |
| WS 实时主链 | 双端都已通过 `createRunsRealtimeClient().connect()` 订阅 run | `app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts` |
| SSE 回退 | 双端都在无 `WebSocket` 环境下回退 `/v1/runs/:runId/stream` | `app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts`、`app/api/src/modules/runs/routes.ts` |
| Realtime 合流策略 | `snapshot` 直接写详情/列表/文件树；`event` 通过 `applyBridgeEventToRunSnapshot()` 折叠后写回 | `app/dashboard/src/lib/runStream.ts`、`app/mobile/src/lib/runStream.ts`、`packages/domain-models/src/runs.ts` |
| 发送消息回退 | 实时连接不可用时，页面可退回 HTTP `sendRunMessage()` | `app/dashboard/src/pages/instances/InstancesPage.tsx`、`app/mobile/src/pages/tasks/detail.tsx` |

## 15. 当前不可宣称完成的缓存能力表

| 能力 | 当前实际状态 | 不能宣称完成的原因 |
|---|---|---|
| 顶层鉴权/工作区缓存 | 未实现 | 没有 `auth/me`、`workspaces` Query Key 与 bootstrap 逻辑 |
| 列表级 summary/facets 缓存 | 未实现 | 后端无对应接口，前端无对应 Query Key |
| 自动重连状态机 | 未实现 | 当前仅 `connected`/`transport` 状态，没有 backoff、重试次数、lastEventId |
| 结构化错误态缓存 | 未实现 | 多处仍是 `catch { return null }` 或空数组 |
| 工作区切换命名空间失效 | 未实现 | 没有 `queryClient.clear()` 或按 workspace 级批量失效 |
| 文件版本水位 | 未实现 | 文件树与文件预览缺少版本号、watermark、etag 语义 |

## 16. 缓存收口顺序表

| 阶段 | 动作 | 收口结果 |
|---|---|---|
| Phase 1 | 补 `auth/workspaces` 顶层 Query 与 bootstrap | 页面不再各自推断工作区上下文 |
| Phase 2 | 补 `runs facets / workspace summary` 缓存键 | 顶部统计、筛选芯片脱离本地派生 |
| Phase 3 | 为工作区切换补批量失效策略 | 消除跨工作区缓存污染 |
| Phase 4 | 为 run stream 补重连/退避/错误态 | 长会话稳定性成型 |
| Phase 5 | 为文件链路补版本语义与下载会话 | 文件页缓存与预览一致性可控 |
