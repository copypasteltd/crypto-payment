# 灵办词元共享包 / Lingban Shared Packages

`packages/` 保存五个应用共同使用的契约、领域模型、数据访问、Session 资产、SDK 与设计 Token。共享包通过 pnpm workspace 参与统一构建和类型检查。

The `packages/` directory contains contracts, domain models, persistence, session assets, SDKs, and design tokens shared by all five applications.

## 包清单 / Package Inventory

| 路径 | 包名 | 职责 |
| --- | --- | --- |
| `config` | `@lingban/config` | 环境变量、配置 Schema 与优先级 |
| `contracts` | `@lingban/contracts` | API DTO、Zod Schema、Bridge/Realtime/Governance 契约 |
| `credential` | `@lingban/credential` | Credential 引用、挂载与脱敏辅助 |
| `db` | `@lingban/db` | Repository、PostgreSQL、Query Model 与 Event Bus |
| `domain-models` | `@lingban/domain-models` | Run、Quota、Search 与业务投影 |
| `files` | `@lingban/files` | 路径边界、文件读取和存储抽象 |
| `mcp` | `@lingban/mcp` | MCP 标识、Binding、策略与配置 |
| `realtime` | `@lingban/realtime` | Realtime 类型与客户端协议 |
| `api-sdk` | `@lingban/api-sdk` | Auth、Catalog、Run、Creator、Governance HTTP SDK |
| `session-pack` | `@lingban/session-pack` | Session 打包、脱敏、签名、继承和归档 |
| `shared` | `@lingban/shared` | 通用工具、日志与基础辅助 |
| `ui-tokens` | `@lingban/ui-tokens` | Dashboard/Mobile 共享视觉 Token |

## 依赖原则 / Dependency Rules

1. `contracts` 保持可序列化、可验证并独立于应用实现。
2. `domain-models` 消费契约并承载纯领域规则。
3. 基础设施包实现存储、文件、凭证与 MCP 适配。
4. `api-sdk` 和 `realtime` 为前端提供统一传输语义。
5. 应用层禁止复制共享 Schema 或自行维护同名 DTO。

## 查询参数约束 / Query Coercion

HTTP 查询参数在边界层统一执行字符串到布尔值或数值的安全转换。`"false"` 会解析为 `false`，数值分页参数通过 `z.coerce.number()` 校验，避免浏览器查询字符串触发错误过滤。

HTTP query parameters are safely coerced at the contract boundary, including explicit boolean parsing and numeric pagination validation.

## 验证 / Validation

```bash
pnpm build:shared
pnpm --filter @lingban/contracts typecheck
pnpm --filter @lingban/api-sdk test:smoke
pnpm --filter @lingban/session-pack test
pnpm --filter @lingban/db test
```

Standalone exports use the transitive `workspace:*` dependency closure, allowing each deliverable to retain the same contract sources used by the monorepo.
