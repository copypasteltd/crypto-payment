# 灵办词元 / Lingban Workshop

`灵办词元` 是一套面向企业与个人的云端 Agent 工坊系统。它把可复用的 Codex CLI / Claude Code CLI 工作流沉淀为可继承的 workshop 资产，并提供移动端 H5、小程序形态与 Web Dashboard 两类前端入口。

This repository is the working monorepo for Lingban Workshop. It contains the frontend clients, backend services, runtime bridge, shared packages, documentation, release bundles, and prototype references.

## 仓库定位 / Repository Role

| 目录 | 作用 | 典型内容 |
| --- | --- | --- |
| `app/` | 五个主应用 | API、run-worker、container-bridge、dashboard、mobile |
| `packages/` | 共享包 | contracts、db、session-pack、api-sdk、ui-tokens |
| `docs/` | 需求、设计、开发文档 | 产品、前端、后端、治理、上线资料 |
| `example/` | 单文件原型 | 三套风格的 H5 / Dashboard 打样 |
| `infra/` | 部署与运维资产 | nginx、systemd、env example、脚本 |
| `tests/` | E2E 与证据 | Playwright 配置、用例、产物 |
| `release/` | 发布包快照 | workspaces、deploy、manifest |
| `standalone/` | 独立仓库镜像 | app/backend/dashboard/run-worker/sdk |
| `.codex-artifacts/` | 视觉与回归证据 | 截图、校验图片 |
| `.lingban-data/` | 本地运行数据 | run、bridge、对象化产物 |
| `.smoke/` | 冒烟执行产物 | API / objectify / preview 样本 |
| `.tmp/` | 临时诊断与实验输出 | 调试日志、临时运行目录 |

## 远端分支映射 / Branch Map

下表对应已推送到 `git@github.com:copypasteltd/crypto-payment.git` 的拆分分支。

| 分支 | 内容范围 | 适用场景 |
| --- | --- | --- |
| `agent-workshop-root` | 根级配置、workspace 元数据、`.github` | 查看整体工程入口与根脚本 |
| `agent-workshop-app` | `app/` | 只看五个主应用代码 |
| `agent-workshop-packages` | `packages/` | 只看共享契约与基础能力 |
| `agent-workshop-docs` | `docs/` | 只看完整需求与设计文档 |
| `agent-workshop-example` | `example/` | 只看单文件原型参考 |
| `agent-workshop-infra` | `infra/` | 只看部署与运维资产 |
| `agent-workshop-tests` | `tests/` | 只看自动化测试与证据目录 |
| `agent-workshop-release` | `release/` | 只看发布输出与部署包 |
| `agent-workshop-standalone` | `standalone/` | 只看独立交付仓库快照 |
| `agent-workshop-playwright-report` | `playwright-report/` | 查看最近一次 Playwright 报告 |
| `agent-workshop-codex-artifacts` | `.codex-artifacts/` | 查看设计与回归截图 |
| `agent-workshop-lingban-data` | `.lingban-data/` | 查看本地运行时样本数据 |
| `agent-workshop-smoke` | `.smoke/` | 查看冒烟执行结果 |
| `agent-workshop-tmp` | `.tmp/` | 查看临时诊断输出 |
| `agent-workshop-monorepo` | 工程整包快照 | 需要一份完整快照时使用 |

## 系统代码结构 / Code Architecture

| 层级 | 路径 | 说明 |
| --- | --- | --- |
| 前端重度端 | `app/dashboard` | React + Vite Dashboard，面向 creator 与重度运营 |
| 前端轻量端 | `app/mobile` | Taro + React，H5 首发，后续适配小程序 |
| 接入后端 | `app/api` | Fastify API、鉴权、run 聚合、MCP/凭证/文件/审计入口 |
| 运行调度 | `app/run-worker` | run preflight、工作区准备、runtime 物化、队列消费 |
| 运行桥接 | `app/container-bridge` | Codex CLI PTY、文件监听、MCP 物化、回调与控制面 |
| 共享契约 | `packages/contracts` | 前后端共享接口、事件、DTO、治理结构 |
| 数据访问 | `packages/db` | repository、query model、event bus、持久化抽象 |
| 会话资产 | `packages/session-pack` | session 打包、脱敏、签名、回放边界 |
| 前端接线 | `packages/api-sdk` `packages/realtime` `packages/ui-tokens` | API SDK、实时协议、设计 token |

## 核心工作流 / Main Runtime Flow

1. 用户从 `dashboard` 或 `mobile` 选择 workshop 并实例化 run。
2. `app/api` 创建 run，写入初始快照与运行计划。
3. `app/run-worker` 完成 preflight、workspace 准备与 runtime 配置生成。
4. `app/container-bridge` 启动 Codex CLI 会话，物化 MCP 与私有凭证，接管目标工作路径。
5. runtime 通过 internal API 回写事件、文件、诊断与状态。
6. 前端通过 HTTP + WebSocket / SSE 订阅 run 进度、对话与文件结果。

## 常用命令 / Common Commands

```bash
pnpm build:shared
pnpm build:backend
pnpm build:frontend
pnpm typecheck:backend
pnpm typecheck:frontend
pnpm ci:backend
pnpm test:runtime:compiled
```

## 阅读顺序 / Suggested Reading Order

1. [docs/产品需求草案.md](C:/dev/copypaste/agent-workshop/docs/产品需求草案.md)
2. [docs/前端需求.md](C:/dev/copypaste/agent-workshop/docs/前端需求.md)
3. [docs/后端设计文档.md](C:/dev/copypaste/agent-workshop/docs/后端设计文档.md)
4. [docs/后端开发文档.md](C:/dev/copypaste/agent-workshop/docs/后端开发文档.md)
5. [docs/dashboard开发文档.md](C:/dev/copypaste/agent-workshop/docs/dashboard开发文档.md)
6. [docs/小程序开发文档.md](C:/dev/copypaste/agent-workshop/docs/小程序开发文档.md)

## 说明 / Notes

- 当前工作目录严格位于 `C:\dev\copypaste\agent-workshop`。
- 本轮分支拆推未使用本地 `docker / wsl / 虚拟化环境`。
- `.lingban-data`、`.smoke`、`.tmp` 内包含运行样本与诊断数据，适合开发核对，不适合作为正式生产数据源。
