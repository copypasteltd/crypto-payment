# 灵办词元 CI-CD 与发布流水线总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | CI-CD 与发布流水线总表 |
| 适用范围 | `agent-workshop` 全工作区与 5 个独立仓库 |
| 统计日期 | 2026-07-08 |
| 当前事实 | 当前工作区已存在 `.github/workflows/ci.yml`，覆盖 backend smoke、runtime tests 与 frontend E2E |
| 文档目标 | 统一梳理现有构建入口、发布单元、建议流水线、发布顺序、回滚策略、当前缺口 |

## 2. 当前自动化成熟度快照表

| 维度 | 当前状态 | 说明 |
|---|---|---|
| CI Workflow 文件 | 已存在 | `.github/workflows/ci.yml` 已接入 |
| 本地构建命令 | 已存在 | Root、Dashboard、Mobile、API、Worker、Bridge 均有 build/typecheck 入口 |
| 自动化测试 | 已建立基础门禁 | 已具备 backend smoke、runtime tests 与 frontend E2E smoke，仍缺 release / deploy / rollback 自动化 |
| 镜像发布 | 未形成流水线 | 仅有 `infra/docker/runner.Dockerfile` |
| 多仓库协调发布 | 未形成 | 当前依赖人工顺序发布 |
| 版本管理策略 | 未形成 | 各包版本固定在 `0.1.0` / 原型版本 |

## 3. 当前可执行脚本总表

| 位置 | 脚本名 | 当前命令 | 当前用途 |
|---|---|---|---|
| Root | `build:contracts` | `tsc -p packages/contracts/tsconfig.json` | 构建 contracts |
| Root | `build:domain-models` | `tsc -p packages/domain-models/tsconfig.json` | 构建 domain-models |
| Root | `build:api-sdk` | `tsc -p packages/api-sdk/tsconfig.json` | 构建 api-sdk |
| Root | `build:ui-tokens` | `tsc -p packages/ui-tokens/tsconfig.json` | 构建 ui-tokens |
| Root | `build:shared` | `pnpm --filter ... build` | 构建共享包 |
| Root | `build:backend` | `pnpm --filter ... build` | 构建 contracts/domain/api/run-worker/container-bridge |
| Root | `typecheck:backend` | `pnpm --filter ... typecheck` | 后端主链类型检查 |
| `app/api` | `build` | `tsc -p tsconfig.json` | 构建 API |
| `app/api` | `typecheck` | `tsc -p tsconfig.json --noEmit` | API 类型检查 |
| `app/api` | `start` | `node dist/index.js` | 启动 API |
| `app/dashboard` | `build` | `tsc -b && vite build` | 构建 Dashboard |
| `app/dashboard` | `dev` | `vite` | 启动 Dashboard 开发服务 |
| `app/dashboard` | `lint` | `oxlint src` | Dashboard 静态检查 |
| `app/mobile` | `build:h5` | `taro build --type h5` | 构建 H5 |
| `app/mobile` | `build:weapp` | `taro build --type weapp` | 构建微信小程序 |
| `app/mobile` | `build:alipay` | `taro build --type alipay` | 构建支付宝小程序 |
| `app/mobile` | `dev:h5` | `taro build --type h5 --watch` | H5 本地开发 |
| `app/run-worker` | `build` | `tsc -p tsconfig.json` | 构建 Worker |
| `app/run-worker` | `typecheck` | `tsc -p tsconfig.json --noEmit` | Worker 类型检查 |
| `app/container-bridge` | `build` | `tsc -p tsconfig.json` | 构建 Bridge |
| `app/container-bridge` | `typecheck` | `tsc -p tsconfig.json --noEmit` | Bridge 类型检查 |
| `app/container-bridge` | `start:runtime` | `node dist/cli.js` | 启动 Bridge Runtime |

## 4. 当前发布单元总表

| 发布单元 | 来源路径 | 当前产物 | 交付形态 |
|---|---|---|---|
| Dashboard | `app/dashboard` | `dist/` | 静态站点 |
| Mobile H5 | `app/mobile` | `dist/` | 静态站点 |
| Mobile Mini Programs | `app/mobile` | `dist/` | 小程序构建产物 |
| API | `app/api` | `dist/index.js` 等 | Node 服务产物 |
| Run Worker | `app/run-worker` | `dist/` | Node 服务或库产物 |
| Container Bridge | `app/container-bridge` | `dist/cli.js`、`dist/index.js` | Node 运行时产物 |
| Runner Image | `infra/docker/runner.Dockerfile` | Docker 镜像 | 云端运行基础镜像 |
| Shared Packages | `packages/*` | `dist/` | 共享构建产物 |

## 5. 推荐 PR 流水线矩阵表

| 流水线名称 | 触发条件 | 主要步骤 | 失败即阻断 |
|---|---|---|---|
| `pr-shared-checks` | 修改 `packages/*` | `pnpm install`、`build:shared` | 是 |
| `pr-backend-checks` | 修改 `app/api`、`app/run-worker`、`app/container-bridge`、`packages/contracts`、`packages/domain-models` | `typecheck:backend`、`build:backend` | 是 |
| `pr-dashboard-checks` | 修改 `app/dashboard` | `pnpm -C app/dashboard lint`、`build` | 是 |
| `pr-mobile-checks` | 修改 `app/mobile` | `pnpm -C app/mobile build:h5` | 是 |
| `pr-docs-checks` | 仅文档改动 | Markdown 结构检查、链接检查 | 否 |

## 6. 推荐主分支流水线矩阵表

| 流水线名称 | 触发条件 | 主要步骤 | 输出 |
|---|---|---|---|
| `main-build-all` | 合并到 `main` | 全量 install、build shared、build backend、build dashboard、build mobile h5 | 构建报告 |
| `main-package-artifacts` | `main-build-all` 成功后 | 打包静态产物与 Node 产物 | Release artifact |
| `main-runner-image-build` | `infra/docker/**` 或 backend/runtime 相关改动 | 构建 runner 镜像、执行基础烟测 | OCI image |
| `main-release-notes` | main merge | 生成变更摘要、记录版本范围 | 发布说明 |

## 7. 推荐正式发布流水线矩阵表

| 发布对象 | 建议流水线 | 建议顺序 | 当前原因 |
|---|---|---|---|
| Shared Packages | `release-shared` | 1 | contracts/domain/api-sdk/ui-tokens 是多端依赖根 |
| Backend API | `release-api` | 2 | 前后端和 runtime 共同依赖 |
| Run Worker | `release-run-worker` | 3 | 承担 runtime 物料生成与调度 |
| Container Bridge | `release-bridge` | 4 | 依赖 shared package 与 runner image |
| Runner Image | `release-runner-image` | 5 | 承载云端运行环境 |
| Dashboard | `release-dashboard` | 6 | 依赖 API 能力与环境变量 |
| Mobile H5 | `release-mobile-h5` | 7 | 首发移动端，依赖 API 能力 |
| Mini Program Builds | `release-mini-packages` | 8 | 后续接入，依赖 H5 逻辑稳定 |

## 8. 分支、标签与版本策略总表

| 维度 | 建议策略 | 当前现状 |
|---|---|---|
| 默认分支 | `main` | 已使用 |
| 功能开发 | `feature/<repo>-<topic>` | 未统一 |
| 修复分支 | `fix/<repo>-<topic>` | 未统一 |
| 发布标签 | `release-YYYYMMDD.N` 或语义版本 `vX.Y.Z` | 未形成 |
| 镜像标签 | `runner:<git-sha>` + `runner:stable` | 未形成 |
| 文档快照 | 与主仓发布时间同步打 tag | 未形成 |

## 9. 制品与缓存总表

| 类型 | 建议保留位置 | 建议保留周期 | 当前状态 |
|---|---|---|---|
| Dashboard `dist` | CI artifact / 对象存储 | 30 天 | 未自动化 |
| Mobile H5 `dist` | CI artifact / 对象存储 | 30 天 | 未自动化 |
| Node `dist` | CI artifact | 14 天 | 未自动化 |
| Runner Image | OCI Registry | 长期保留最近 N 个稳定版本 | 未自动化 |
| `pnpm` cache | CI cache | 7-14 天 | 未自动化 |
| Playwright browsers cache | 镜像层 / CI cache | 与镜像版本一致 | 部分由 Dockerfile 固化 |

## 10. 发布前强制检查矩阵表

| 检查项 | Dashboard | Mobile H5 | API | Worker | Bridge | Runner Image |
|---|---|---|---|---|---|---|
| 依赖安装成功 | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| TypeScript 构建成功 | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| Lint 成功 | 必须 | 建议 | 建议 | 建议 | 建议 | 建议 |
| 自动化测试成功 | 当前无门禁资格 | 当前无门禁资格 | 当前无门禁资格 | 当前无门禁资格 | 当前无门禁资格 | 当前无门禁资格 |
| 环境变量校验 | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |
| 发布说明 | 必须 | 必须 | 必须 | 必须 | 必须 | 必须 |

## 11. 环境晋升顺序表

| 环境 | 进入条件 | 退出条件 |
|---|---|---|
| `local` | 开发者本地构建通过 | 形成联调分支或产出评审结果 |
| `dev` | PR 合并后构建通过 | 基础联调通过 |
| `staging` | 后端、前端、runtime 联调通过 | 回归、验收、审计、配额检查通过 |
| `prod` | staging Gate 通过 | 进入正式服务 |

## 12. 回滚矩阵表

| 对象 | 回滚单位 | 建议回滚方式 | 当前备注 |
|---|---|---|---|
| Dashboard | 静态产物版本 | 切回上一个静态包 | 易回滚 |
| Mobile H5 | 静态产物版本 | 切回上一个静态包 | 易回滚 |
| API | 服务版本 | 回滚至上一个 Node 构建版本 | 需考虑数据兼容 |
| Run Worker | 服务版本 | 回滚至上一个 Worker 构建版本 | 需兼容 runtime schema |
| Container Bridge | 服务 / 镜像版本 | 回滚至上一个 bridge 构建版本 | 需兼容 runtime 文件格式 |
| Runner Image | 镜像标签 | 切回上一个稳定镜像 | 需与 bridge 版本兼容 |

## 13. 多仓库发布协调矩阵表

| 变更类型 | 至少需要联动的仓库 |
|---|---|
| `RunSnapshot` / `BridgeEvent` 契约变更 | `packages/contracts`、`packages/domain-models`、`app/api`、`app/container-bridge`、`packages/api-sdk`、前端 |
| 文件接口变更 | `app/api`、`packages/api-sdk`、`app/dashboard`、`app/mobile` |
| Codex 启动参数变更 | `app/api`、`app/run-worker`、`app/container-bridge`、`infra/docker` |
| MCP / 凭证注入变更 | `packages/contracts`、`app/run-worker`、`app/container-bridge`、`app/api` |
| 主题 token 变更 | `packages/ui-tokens`、`app/dashboard`、`app/mobile` |

## 14. 当前缺口总表

| 领域 | 当前缺口 | 优先级 |
|---|---|---|
| CI 基础设施 | 仅有单一校验流，缺 release / deploy / rollback 流水线 | P0 |
| 自动化测试 | 已有基础测试门禁，但缺 staging / production 级发布 Gate | P0 |
| 版本治理 | 无统一 tag / release / changelog 机制 | P1 |
| 镜像发布 | runner image 无自动 build / push 流程 | P1 |
| 环境变量校验 | 缺少集中 config schema 与 fail-fast 机制 | P1 |
| 回滚演练 | 没有正式回滚脚本与演练记录 | P1 |

## 15. 当前已验证自动化基线表

| 项目 | 当前结果 | 证据 |
|---|---|---|
| CI Workflow 目录 | 已存在 | `.github/workflows/ci.yml` |
| Shared Packages 构建 | 已通过 | `pnpm build:shared` |
| Backend 聚合构建 | 已通过 | `pnpm build:backend` |
| Backend 类型检查 | 已通过 | `pnpm typecheck:backend` |
| API 构建 | 已通过 | `pnpm -C app/api build` |
| Run Worker 构建 | 已通过 | `pnpm -C app/run-worker build` |
| Container Bridge 构建 | 已通过 | `pnpm -C app/container-bridge build` |
| Dashboard 构建 | 已通过 | `pnpm -C app/dashboard build` |
| Mobile H5 构建 | 已通过 | `pnpm -C app/mobile build:h5` |
| 自动化测试文件 | 已存在基础覆盖 | backend smoke、runtime tests、Playwright E2E 已在仓内落地 |

## 16. 首批 CI 落地顺序表

| 顺位 | 流水线 | 必含步骤 | 目标 |
|---|---|---|---|
| 1 | `pr-shared-checks` | install、`build:shared` | 先锁定 contracts/domain/sdk/ui-tokens |
| 2 | `pr-backend-checks` | install、`typecheck:backend`、`build:backend` | 锁定 API/worker/bridge 主链可编译 |
| 3 | `pr-dashboard-checks` | install、dashboard lint、build | 锁定 Dashboard 交付壳 |
| 4 | `pr-mobile-checks` | install、mobile `build:h5` | 锁定首发移动端 H5 |
| 5 | `main-runner-image-build` | runner image build、基础烟测 | 锁定云端执行底座 |
| 6 | `docs-link-checks` | Markdown 链接与引用检查 | 锁定文档体系可维护 |
| 7 | `test-gates` | unit/integration/e2e 分层接入 | 建立真正质量门 |

## 17. 仓库到流水线路由矩阵表

| 仓库/目录 | PR 流水线 | Main 流水线 | 发布流水线 |
|---|---|---|---|
| `packages/contracts` | `pr-shared-checks` | `main-build-all` | `release-shared` |
| `packages/domain-models` | `pr-shared-checks` | `main-build-all` | `release-shared` |
| `packages/api-sdk` | `pr-shared-checks` | `main-build-all` | `release-shared` |
| `packages/ui-tokens` | `pr-shared-checks` | `main-build-all` | `release-shared` |
| `app/api` | `pr-backend-checks` | `main-build-all` | `release-api` |
| `app/run-worker` | `pr-backend-checks` | `main-build-all` | `release-run-worker` |
| `app/container-bridge` | `pr-backend-checks` | `main-build-all` | `release-bridge` |
| `infra/docker` | `pr-backend-checks` + `main-runner-image-build` | `main-runner-image-build` | `release-runner-image` |
| `app/dashboard` | `pr-dashboard-checks` | `main-build-all` | `release-dashboard` |
| `app/mobile` | `pr-mobile-checks` | `main-build-all` | `release-mobile-h5` / `release-mini-packages` |

## 18. 当前流水线阻塞项表

| 阻塞项 | 当前表现 | 影响范围 | 处理优先级 |
|---|---|---|---|
| 缺 release / deploy / rollback workflow | 无法形成正式发布闭环 | 全仓 | P0 |
| 缺 staging / production 级 Gate | 无法建立上线前自动验收门禁 | 全仓 | P0 |
| Docker daemon 未启动 | 不能在本机验证 runner image 烟测链 | runtime / CI image 链 | P0 |
| 无镜像仓库发布链 | runner image 无版本化分发 | runtime / staging / production | P1 |
| 无 release tag / changelog 机制 | 发布记录不可追踪 | 全仓 | P1 |
| 无配置 schema fail-fast | 环境变量错误难以及时暴露 | API / worker / bridge / 前端 | P1 |

## 19. 当前版本与工具链漂移表

| 项 | 当前状态 | 风险 | 建议 |
|---|---|---|---|
| Root `packageManager` | `pnpm@10.0.0` | 与本机 `pnpm 11.7.0` 不一致 | 统一根版本或在 CI 固定 pnpm 版本 |
| Node.js 版本声明 | 当前以本机 `v22.14.0` 为证据，未见集中版本门禁 | 不同环境可能构建差异 | 增加 `.nvmrc` / `engines` / CI version pin |
| Docker 运行基座 | Client 存在，daemon 未启动 | 无法形成 runtime 烟测 | 先恢复 daemon，再固化 CI runner 能力 |
