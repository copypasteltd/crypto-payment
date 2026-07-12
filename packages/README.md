# Packages README

本目录对应拆分分支 `agent-workshop-packages`，承载所有共享契约、基础设施抽象与前端公共能力。

This directory maps to the `agent-workshop-packages` branch and contains all shared contracts, infrastructure abstractions, and client-side shared capabilities.

## 共享包清单 / Package Inventory

| 路径 | 包名 | 作用 |
| --- | --- | --- |
| `packages/config` | `@lingban/config` | 环境变量、配置装载与优先级 |
| `packages/contracts` | `@lingban/contracts` | API DTO、实时事件、治理协议、Schema |
| `packages/credential` | `@lingban/credential` | secret / credential 抽象能力 |
| `packages/db` | `@lingban/db` | repository、query repository、event bus、数据库访问 |
| `packages/domain-models` | `@lingban/domain-models` | run、quota、search 等领域模型 |
| `packages/files` | `@lingban/files` | 文件系统、文件对象与读写能力 |
| `packages/mcp` | `@lingban/mcp` | MCP 解析、策略与配置封装 |
| `packages/realtime` | `@lingban/realtime` | 前端实时订阅协议与封装 |
| `packages/api-sdk` | `@lingban/api-sdk` | dashboard / mobile 调用 API 的 SDK |
| `packages/session-pack` | `@lingban/session-pack` | session 打包、脱敏、签名、schema |
| `packages/shared` | `@lingban/shared` | 通用工具与共享辅助方法 |
| `packages/ui-tokens` | `@lingban/ui-tokens` | 双前端共用设计 token |

## 建议阅读顺序 / Suggested Order

1. `contracts`
2. `domain-models`
3. `db`
4. `session-pack`
5. `api-sdk` / `realtime`
6. `ui-tokens`

## 代码层边界 / Layer Boundaries

| 层 | 包 |
| --- | --- |
| 协议层 | `contracts`, `domain-models` |
| 持久化与基础设施层 | `db`, `files`, `credential`, `mcp`, `config` |
| 交付与消费层 | `api-sdk`, `realtime`, `ui-tokens`, `shared` |
| 会话资产层 | `session-pack` |
