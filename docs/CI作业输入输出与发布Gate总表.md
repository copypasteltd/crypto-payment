# 灵办词元 CI作业输入输出与发布Gate总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | CI作业输入输出与发布Gate总表 |
| 适用范围 | 五个独立仓库、四个共享包、runner image、前后端构建与发布 |
| 统计日期 | 2026-07-07 |
| 统计口径 | 以当前 `package.json` 脚本、现测构建结果、目录结构、发布顺序设计为准 |
| 直接证据 | `package.json`、`app/*/package.json`、`packages/*/package.json`、`infra/docker/runner.Dockerfile`、`docs/CI-CD与发布流水线总表.md` |
| 输出目标 | 将 PR、主分支、发布、镜像、产物、缓存、手工 Gate、环境变量输入输出全部明细化 |

## 2. 当前可执行构建入口矩阵

| 范围 | 命令 | 输出 |
|---|---|---|
| Shared | `pnpm build:shared` | `packages/contracts/domain-models/api-sdk/ui-tokens/dist` |
| Backend | `pnpm build:backend` | `packages/contracts/domain-models` + `app/api/run-worker/container-bridge/dist` |
| Backend Typecheck | `pnpm typecheck:backend` | 类型检查结果 |
| Dashboard | `pnpm -C app/dashboard build` | `app/dashboard/dist` |
| Mobile H5 | `pnpm -C app/mobile build:h5` | `app/mobile/dist` |
| API | `pnpm -C app/api build` | `app/api/dist` |
| Run Worker | `pnpm -C app/run-worker build` | `app/run-worker/dist` |
| Container Bridge | `pnpm -C app/container-bridge build` | `app/container-bridge/dist` |

## 3. PR 流水线作业矩阵

| 作业名 | 触发范围 | 主要输入 | 主要命令 | 主要输出 | 是否阻断 |
|---|---|---|---|---|---|
| `pr-shared-checks` | `packages/*` | workspace 依赖、TSConfig | `pnpm build:shared` | shared dist、构建日志 | 是 |
| `pr-backend-typecheck` | `app/api`、`app/run-worker`、`app/container-bridge`、`packages/contracts`、`packages/domain-models` | backend 源码 | `pnpm typecheck:backend` | 类型检查结果 | 是 |
| `pr-backend-build` | 同上 | backend 源码 | `pnpm build:backend` | backend dist | 是 |
| `pr-dashboard-checks` | `app/dashboard` | dashboard 源码 | `pnpm -C app/dashboard lint`、`build` | `dist`、lint 结果 | 是 |
| `pr-mobile-h5-build` | `app/mobile` | mobile 源码 | `pnpm -C app/mobile build:h5` | `dist` | 是 |
| `pr-docs-checks` | `docs/**` | Markdown 文档 | 链接与结构检查 | 文档校验结果 | 否 |

## 4. 主分支流水线作业矩阵

| 作业名 | 触发条件 | 主要命令 | 产物 |
|---|---|---|---|
| `main-install` | 合并到 `main` | `pnpm install --frozen-lockfile` | 依赖缓存 |
| `main-build-shared` | `main-install` 后 | `pnpm build:shared` | shared dist |
| `main-build-backend` | `main-build-shared` 后 | `pnpm build:backend` | API/Worker/Bridge dist |
| `main-build-dashboard` | `main-build-shared` 后 | `pnpm -C app/dashboard build` | dashboard dist |
| `main-build-mobile-h5` | `main-build-shared` 后 | `pnpm -C app/mobile build:h5` | mobile dist |
| `main-package-artifacts` | 上述成功后 | 打包 dist 和元数据 | Release artifact |
| `main-runner-image-build` | `infra/docker/**` 或 runtime 相关变更 | Docker build | runner image |
| `main-release-notes` | 主分支合并成功 | 生成 changelog | 发布摘要 |

## 5. 发布流水线矩阵

| 发布对象 | 前置 Gate | 发布动作 | 发布产物 |
|---|---|---|---|
| Shared Packages | shared build 成功 | 发布 npm 包或内部 registry 包 | `@lingban/*` |
| Backend API | backend build 成功、配置校验通过 | 部署 Node 服务 | API 服务版本 |
| Run Worker | backend build 成功 | 部署 worker 服务 | worker 服务版本 |
| Container Bridge | backend build 成功 | 发布 bridge 构建产物 | bridge 版本 |
| Runner Image | bridge 构建成功 | 构建并推送 OCI 镜像 | `ghcr.io/lingban/runner:*` |
| Dashboard | dashboard build 成功、API env 配置通过 | 发布静态站点 | Dashboard 静态包 |
| Mobile H5 | mobile build 成功、API env 配置通过 | 发布静态站点 | H5 静态包 |

## 6. Runner Image 作业矩阵

| 步骤 | 输入 | 输出 | 说明 |
|---|---|---|---|
| 拉取基础镜像 | `node:22-bookworm-slim` | 构建上下文 | Runner 基底 |
| 安装系统工具 | apt 包清单 | 系统层工具 | `bash/curl/git/jq/python3/pip/rg/zip/unzip` |
| 安装 `pnpm` | `corepack` | 包管理器 | 固定 workspace 构建工具 |
| 安装 Playwright | `@playwright/test` + Chromium | 浏览器运行环境 | 支撑浏览器自动化任务 |
| 构建 bridge 产物 | workspace 源码 | `/opt/lingban/container-bridge/dist` | 容器内执行入口 |
| 写入 entrypoint | `entrypoint.sh` | 启动脚本 | 检查 context 文件并启动 bridge |

## 7. 环境变量与凭证输入矩阵

| 类别 | 变量/凭证 | 用途 | 作用作业 |
|---|---|---|---|
| Node 安装 | `NODE_AUTH_TOKEN` 或内部 registry 凭证 | 拉取私有依赖 | install、publish |
| 镜像推送 | `GHCR_TOKEN` 或 OCI registry 凭证 | 推送 runner image | image build/release |
| Dashboard 环境 | `VITE_API_BASE_URL`、`VITE_WS_BASE_URL` | 前端接口地址 | dashboard/h5 build |
| Backend 环境 | DB、对象存储、队列、密钥 | 服务运行配置 | API/Worker deploy |
| 发布签名 | release bot token | tag、release note、归档 | release jobs |

## 8. 产物与缓存矩阵

| 类型 | 来源作业 | 建议保留位置 | 建议保留周期 |
|---|---|---|---|
| `dist` 静态产物 | dashboard、mobile | CI artifact / 对象存储 | 30 天 |
| Node `dist` | API、Worker、Bridge、shared | CI artifact | 14 天 |
| Runner Image | image build | OCI Registry | 最近 N 个稳定版长期保留 |
| `pnpm` cache | install | CI cache | 7-14 天 |
| Playwright 浏览器缓存 | image build / CI cache | 镜像层或 cache | 与镜像版本同步 |

## 9. 发布 Gate 矩阵

| Gate | 适用对象 | 通过标准 |
|---|---|---|
| `build-pass` | 全部发布对象 | 对应 build 成功 |
| `typecheck-pass` | backend、shared | 类型检查成功 |
| `lint-pass` | dashboard，后续可扩展到其他仓库 | lint 成功 |
| `config-validated` | API、Worker、Dashboard、Mobile | 必填环境变量校验通过 |
| `artifact-ready` | 全部发布对象 | 产物已上传并可追溯 |
| `manual-approval` | prod 部署、镜像推送、正式 tag | 指定角色人工确认 |

## 10. 手工审批责任矩阵

| 动作 | 开发 | Creator/产品 | 运维/平台 | 审计/治理 |
|---|---|---|---|---|
| 合并 PR | 负责 | 关注 | 关注 | 无 |
| 触发 staging 发布 | 发起 | 确认 | 负责 | 无 |
| 触发 prod 发布 | 发起 | 确认 | 负责 | 关注 |
| 推送 runner image stable tag | 关注 | 无 | 负责 | 关注 |
| 回滚生产版本 | 配合 | 通知 | 负责 | 关注 |

## 11. 当前缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 无正式 CI workflow | 当前只有本地脚本 | 无法形成统一质量门 | P0 |
| 自动化测试缺失 | 当前几乎没有真实 test/spec 文件 | 发布风险高 | P0 |
| release/tag/changelog 机制缺失 | 无统一版本线 | 无法稳定回滚和审计 | P1 |
| image build/push 自动化缺失 | runner image 无正式流水线 | 云端运行环境不可稳定交付 | P1 |

