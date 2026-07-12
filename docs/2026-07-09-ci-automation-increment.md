# 2026-07-09 CI Automation Increment

## 1. 目标

| 项 | 内容 |
|---|---|
| 收口主题 | CI / automation gates |
| 目标 | 将当前已存在的 backend smoke、runtime tests、frontend Playwright 冒烟接入统一根脚本与 GitHub Actions |
| 日期 | 2026-07-09 |

## 2. 本轮改动

| 模块 | 改动 |
|---|---|
| 根 `package.json` | 新增 `build:frontend`、`typecheck:frontend`、`lint:frontend`、`test:backend:smoke`、`test:runtime`、`ci:backend`、`ci:runtime`、`ci:frontend`、`ci:verify` |
| `app/dashboard/package.json` | 新增 `typecheck` |
| `app/mobile/package.json` | 新增 `typecheck` |
| `tests/e2e/playwright.config.mjs` | 改为按 `PLAYWRIGHT_CHANNEL` 可选注入 channel，默认使用 Playwright Chromium，便于 CI 运行 |
| `.github/workflows/ci.yml` | 新增 `backend-smoke`、`runtime-tests`、`frontend-e2e` 三个 job，并上传 Playwright 报告 |

## 3. 本轮验证

| 命令 | 结果 |
|---|---|
| `pnpm typecheck:frontend` | 通过 |
| `pnpm lint:frontend` | 通过 |
| `pnpm ci:runtime` | 通过 |
| `pnpm test:e2e` | `6/6` 通过 |
| `pnpm ci:backend` | 通过 |

## 4. 当前 CI 覆盖面

| 维度 | 当前覆盖 |
|---|---|
| 后端 | `app/api test:smoke` `29/29` |
| runtime 包 | `app/run-worker` `14/14`，`app/container-bridge` `7/7` |
| 前端 | Playwright `dashboard + mobile-h5` 冒烟 `6/6` |

## 5. 剩余缺口

| 缺口 | 说明 |
|---|---|
| CD | 仍无镜像发布、环境部署、迁移执行、回滚工作流 |
| 前端覆盖面 | 当前仍以冒烟为主，未覆盖更深 Creator / file / auth 场景 |
| 合约门禁 | API SDK / OpenAPI 漂移校验仍未纳入流水线 |
