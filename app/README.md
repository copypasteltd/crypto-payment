# App Layer README

本目录对应拆分分支 `agent-workshop-app`，包含灵办词元的五个主应用。

This directory maps to the `agent-workshop-app` branch and contains the five runtime applications of Lingban Workshop.

## 应用清单 / Applications

| 路径 | 包名 | 角色 | 关键入口 |
| --- | --- | --- | --- |
| `app/api` | `@lingban/api` | 接入层与控制面 API | `src/index.ts`, `src/app/create-server.ts` |
| `app/run-worker` | `@lingban/run-worker` | run 队列消费、runtime 物化、生命周期调度 | `src/daemon.ts`, `src/jobs/start-run.ts` |
| `app/container-bridge` | `@lingban/container-bridge` | Codex CLI bridge、文件监听、MCP/secret 物化 | `src/cli.ts`, `src/bridge/*` |
| `app/dashboard` | `dashboard` | React + Vite Dashboard | `src/main.tsx`, `src/app/App.tsx` |
| `app/mobile` | `lingban-mobile` | Taro H5 / 小程序前端 | `src/app.tsx`, `src/pages/*` |

## 依赖关系 / Dependency Direction

| From | To | 目的 |
| --- | --- | --- |
| `dashboard` / `mobile` | `packages/api-sdk`, `packages/contracts`, `packages/ui-tokens` | 接口调用、类型共享、视觉 token |
| `api` | `packages/contracts`, `packages/db`, `packages/domain-models`, `packages/session-pack` | 协议、持久化、领域模型、session 资产 |
| `run-worker` | `packages/contracts`, `packages/domain-models`, `packages/session-pack` | 运行计划、工作区物化、资产落地 |
| `container-bridge` | `packages/contracts`, `packages/mcp`, `packages/credential` | MCP 配置、secret 注入、bridge 事件协议 |

## 代码阅读建议 / Reading Guide

1. 先看 `app/api`，理解 run、credential、MCP、file 与 workshop 的主数据面。
2. 再看 `app/run-worker`，理解 run 从创建到启动的编排链路。
3. 然后看 `app/container-bridge`，理解 Codex CLI 是如何被桥接、监听与控制的。
4. 最后看 `app/dashboard` 与 `app/mobile`，理解双端如何消费同一套 run / workshop / file 能力。

## 常用命令 / Commands

```bash
pnpm -C app/api build
pnpm -C app/run-worker test
pnpm -C app/container-bridge typecheck
pnpm -C app/dashboard dev
pnpm -C app/mobile dev:h5
```
