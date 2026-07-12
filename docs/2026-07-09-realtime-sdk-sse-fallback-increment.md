# 灵办词元 Realtime SDK SSE Fallback 增量说明（2026-07-09）

## 1. 本次目标

补齐 `packages/api-sdk` 在 realtime 领域的统一能力缺口，将双前端原本各自手写的 SSE fallback 逻辑收敛到共享 SDK，形成单一、可测试、可复用的运行时订阅层。

## 2. 本次改动

| 类别 | 文件 | 改动内容 | 作用 |
|---|---|---|---|
| Realtime SDK | `packages/api-sdk/src/index.ts` | 为 `createRunsRealtimeClient()` 新增统一 transport 逻辑，支持 `WebSocket -> SSE` 自动退化；新增 `eventSourceFactory`、`preferTransport`、`onTransport` | 让 Dashboard 与 Mobile 共享一套 realtime 连接策略，减少重复实现与行为漂移 |
| SDK 测试 | `packages/api-sdk/tests/runs-realtime.test.mjs` | 新增 websocket 主链与 websocket 失败后自动退到 SSE 的测试 | 证明 SDK 行为不是静态设计，而是已通过自动化验证 |
| Dashboard 接线 | `app/dashboard/src/lib/runStream.ts` | 删除页面内手写 SSE 分支，改为完全消费 SDK 的 `onSnapshot / onEvent / onTransport` | 页面层只保留状态映射，不再维护 transport 细节 |
| Mobile 接线 | `app/mobile/src/lib/runStream.ts` | 删除页面内手写 SSE 分支，改为完全消费 SDK 的 `onSnapshot / onEvent / onTransport` | H5 端与 Dashboard 的 realtime 口径一致 |

## 3. 关键设计点

| 设计点 | 当前实现 |
|---|---|
| 默认策略 | 优先 WebSocket，失败且未建立连接时自动退到 SSE |
| 退化触发条件 | `socketFactory` 创建失败，或 WebSocket 在 `open` 前发生 `error/close` |
| 页面可见状态 | SDK 通过 `onTransport("ws" | "sse")` 将当前 transport 显式暴露给消费端 |
| 命令能力 | `sendMessage / approve / cancel` 仍以 WebSocket 为主；当 transport 为 SSE 时，前端继续沿用现有 HTTP fallback |
| 关闭语义 | 页面关闭连接时，SDK 统一负责清理 listener 并关闭底层 transport |

## 4. 验证结果

| 验证项 | 结果 |
|---|---|
| `pnpm -C packages/api-sdk test:smoke` | 通过，`6/6` |
| `pnpm -C app/dashboard build` | 通过 |
| `pnpm -C app/mobile exec tsc --noEmit --pretty false` | 通过 |
| `pnpm -C app/mobile build:h5` | 通过 |
| `pnpm test:e2e` | 通过，`6/6` |

## 5. 对仓库状态的影响

| 仓库 | 影响 |
|---|---|
| `agent-workshop-sdk` | 间接受益。容器侧 bridge 事件流的消费方现在有统一降级策略 |
| `agent-workshop-app` | H5 realtime 订阅层去重，移动端 SSE fallback 从页面逻辑提升为共享 SDK 能力 |
| `agent-workshop-dashboard` | Dashboard realtime 订阅层去重，transport 行为更稳定 |
| `agent-workshop-backend` | `/ws/runs/:id` 与 `/v1/runs/:id/stream` 两条链都被双端共享能力显式消费，验证口径更完整 |
| `agent-workshop-sdk (shared package)` | `packages/api-sdk` 的 realtime 能力从“只有 WebSocket helper”提升到“带 transport 退化策略的正式 SDK” |

## 6. 当前结论

| 维度 | 结论 |
|---|---|
| 工程收敛度 | 提升明显，双前端不再各自维护 SSE 分支 |
| 可测试性 | 提升明显，transport 退化路径已经有自动化测试 |
| 生产可用性 | 提升明显，WebSocket 不可用时前端仍能保留 run 订阅能力 |

## 7. 仍未完成项

| 类别 | 未完成内容 |
|---|---|
| Realtime 恢复 | 仍未实现断线重连策略、退避算法、resume token |
| 消息通道 | SSE transport 下命令仍依赖 HTTP fallback，尚未形成更细粒度 ACK 语义 |
| 观测 | transport 切换原因、切换次数、订阅失败原因尚未沉淀为正式指标与日志字段 |
