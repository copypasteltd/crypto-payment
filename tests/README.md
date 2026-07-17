# 灵办词元测试 / Lingban Tests

`tests/` 保存跨应用 E2E 编排、浏览器验收和执行证据。组件级测试位于对应应用或共享包目录。

The `tests/` directory contains cross-application E2E orchestration, browser acceptance tests, and execution evidence. Component tests live beside their implementation packages.

## 结构 / Structure

| 路径 | 内容 |
| --- | --- |
| `e2e/playwright.config.mjs` | Playwright 项目、浏览器和服务配置 |
| `e2e/build-frontends.mjs` | 使用正式认证配置构建双前端 |
| `e2e/serve-static.mjs` | Dashboard 与 Mobile 静态服务 |
| `e2e/specs/dashboard.spec.mjs` | Workspace、Creator、Admin、Provider 与批量任务 |
| `e2e/specs/mobile.spec.mjs` | 工坊、任务、对话、文件、Provider 与个人中心 |
| `e2e/specs/admin.spec.mjs` | 独立 Admin、Provider 创建与测活、模型同步、表单边界、结构化 API 和网络错误反馈 |
| `evidence/` | 报告、截图和最近执行证据 |

## 认证与数据策略 / Auth and Data Strategy

- E2E 使用 API mock 构造完整认证启动与工作区上下文。
- 前端构建不注入认证绕过变量。
- 测试覆盖 Token 恢复、路由守卫、角色入口和真实查询参数形态。
- 测试 ID 仅用于稳定定位，页面结构仍按生产交互组织。

## 执行 / Run

```bash
pnpm exec playwright test -c tests/e2e/playwright.config.mjs
pnpm exec playwright show-report
```

## 最近结果 / Latest Result

| 日期 | 范围 | 结果 |
| --- | --- | --- |
| 2026-07-14 | Dashboard + Mobile H5 E2E | 23/23 通过 |
| 2026-07-16 | Independent Admin E2E | 9/9 通过 |
| 2026-07-14 | Backend smoke | 62/62 通过 |
| 2026-07-14 | Run Worker | 27/27 通过 |
| 2026-07-14 | Runtime Bridge | 23/23 通过 |
| 2026-07-14 | Dashboard 生产页面状态 | 52/52 通过 |
| 2026-07-14 | Mobile H5 生产页面状态 | 14/14 通过 |

Visual acceptance also checks text overflow, responsive layout, theme switching, navigation state, and production API host resolution.
