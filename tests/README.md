# 灵办词元测试 / Lingban Tests

`tests/` 保存跨应用 E2E 编排、浏览器验收和执行证据。组件级测试位于对应应用或共享包目录。

The `tests/` directory contains cross-application E2E orchestration, browser acceptance tests, and execution evidence. Component tests live beside their implementation packages.

## 结构 / Structure

| 路径 | 内容 |
| --- | --- |
| `e2e/playwright.config.mjs` | Playwright 项目、浏览器和服务配置 |
| `e2e/build-frontends.mjs` | 使用正式认证配置构建双前端 |
| `e2e/serve-static.mjs` | Dashboard 与 Mobile 静态服务 |
| `e2e/specs/dashboard.spec.mjs` | Workspace、Creator、实例生命周期、Provider 与批量任务 |
| `e2e/specs/mobile.spec.mjs` | 工坊、实例创建、任务对话、文件、生命周期与个人中心 |
| `e2e/specs/admin.spec.mjs` | 独立 Admin、Provider 运维、实例生命周期治理与错误反馈 |
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
| 2026-07-25 | API Capture/分享专项 | 4/4 通过 |
| 2026-07-25 | Runtime Bridge | 34/34 通过 |
| 2026-07-25 | Run Worker | 33/33 通过 |
| 2026-07-25 | Shared DB / Session Pack | 30/30、24/24 通过 |
| 2026-07-25 | Mobile Creator / Media | 6/6、8/8 通过 |
| 2026-07-25 | Mobile H5 / 微信小程序构建与校验 | 通过 |
| 2026-07-21 | Dashboard + Mobile H5 + Admin E2E | 34/34 通过，包含 H5 实例停止与释放请求断言 |
| 2026-07-21 | Run lifecycle API | 6/6 通过 |
| 2026-07-21 | Run Worker | 33/33 通过 |
| 2026-07-21 | Shared DB | 29/29 通过 |
| 2026-07-21 | API SDK | 28/28 通过 |
| 2026-07-21 | Dashboard 响应式视觉状态 | 1440x1000、1024x768、390x844 通过 |
| 2026-07-21 | Mobile H5 与微信小程序生产构建 | 通过 |

Visual acceptance also checks text overflow, responsive layout, theme switching, navigation state, and production API host resolution.
