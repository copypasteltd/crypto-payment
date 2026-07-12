# Tests README

本目录对应拆分分支 `agent-workshop-tests`，用于保存自动化测试、E2E 编排与执行证据。

This directory maps to the `agent-workshop-tests` branch and stores automated tests, E2E orchestration, and execution evidence.

## 目录结构 / Structure

| 路径 | 说明 |
| --- | --- |
| `tests/e2e/playwright.config.mjs` | Playwright 主配置 |
| `tests/e2e/build-frontends.mjs` | 前端构建辅助脚本 |
| `tests/e2e/serve-static.mjs` | 静态资源服务脚本 |
| `tests/e2e/specs/dashboard.spec.mjs` | Dashboard E2E 用例 |
| `tests/e2e/specs/mobile.spec.mjs` | Mobile H5 E2E 用例 |
| `tests/evidence/` | 最近执行的证据与 Playwright 输出 |

## 测试范围 / Scope

- Dashboard 主导航、详情、工作区、Creator 入口
- Mobile H5 的工坊、任务、文件、我的页面
- 视觉回归基础证据归档
