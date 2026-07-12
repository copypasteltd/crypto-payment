# 灵办词元 2026-07-09 本地基础设施闭环增量

## 1. 变更目标

| 项 | 说明 |
|---|---|
| 目标日期 | 2026-07-09 |
| 变更主题 | 本地 `api + postgres + redis + minio + host-worker + runner image` 联调入口标准化 |
| 目标问题 | API 容器未自动迁移、worker 启动半手工、compose 与 host worker 缺少统一入口、文档与当前 infra 状态存在偏差 |

## 2. 本次落地内容

| 类别 | 已落地内容 | 具体文件 |
|---|---|---|
| API 启动前迁移 | API Docker 容器启动前自动执行 `node app/api/dist/migrate.js up` | `infra/docker/api-entrypoint.sh`、`infra/docker/api.Dockerfile` |
| Compose 基础设施完善 | `minio` 新增 healthcheck，`minio-init` 改为依赖 healthy 状态，`api` 改为等待 bucket 初始化完成后再启动，并注入 `host.docker.internal` 解析 | `infra/docker/docker-compose.local.yml` |
| Compose 环境显式化 | `bridgeRegistry / credentials / mcp / quota / billing / notifications / favorites / recent / search` store 显式声明为 `postgres`，API 增加 worker ops 探针地址与 token | `infra/docker/compose.env`、`infra/docker/compose.env.example` |
| Host Worker 标准启动 | worker env 增补 `runs dir`、DLQ、重试退避、ops 端口与 token、runner 资源限制 | `infra/docker/worker.host.env`、`infra/docker/worker.host.env.example` |
| 启动脚本 | 新增宿主机 worker 启动脚本与本地联调总入口脚本 | `infra/scripts/run-local-worker.mjs`、`infra/scripts/local-stack.mjs`、`infra/scripts/env-file.mjs` |
| 根级脚本收口 | 新增 `infra:stack:config`、`infra:stack:ps`、`infra:worker:start`、`infra:local:up`、`infra:local:dev` | `package.json` |

## 3. 标准启动路径

| 场景 | 推荐命令 | 结果 |
|---|---|---|
| 仅起基础设施 | `pnpm infra:local:up` | 拉起 `postgres + redis + minio + api`，并等待 `http://127.0.0.1:3100/health` |
| 起完整本地联调链 | `pnpm infra:local:dev` | 拉起 compose、构建 `lingban/runner:local`、启动 host worker，并等待 `http://127.0.0.1:3100/readyz` |
| 单独起 host worker | `pnpm infra:worker:start` | 读取 `infra/docker/worker.host.env`，先 build `app/run-worker`，再以前台 daemon 模式启动 |
| 校验 compose 展开 | `pnpm infra:stack:config` | 输出最终 compose 拓扑，便于核对依赖与 env 注入 |

## 4. 当前验证证据

| 检查项 | 结果 |
|---|---|
| `node infra/scripts/run-local-worker.mjs --help` | 通过 |
| `node infra/scripts/local-stack.mjs --help` | 通过 |
| `pnpm infra:stack:config` | 通过 |
| `pnpm -C app/api build` | 通过 |
| `pnpm -C app/api migrate:dry-run` | 通过 |

## 5. 当前仍未闭环项

| 项 | 当前状态 | 说明 |
|---|---|---|
| Docker daemon 实机联调 | 未验证 | 当前环境 `docker daemon` 未启动，无法执行真实 `compose up`、runner image build、demo run |
| Demo run 端到端烟测 | 未验证 | 需要 daemon 可用后执行 `run -> worker -> runner container -> bridge -> api callbacks` 真链路 |
| Shared Dev / Staging 部署脚本 | 未完成 | 本次仅补齐 Local Dev 标准入口 |
| 容器级回收与对象生命周期发布脚本 | 未完成 | 仍需后续补齐发布级回滚、清桶和归档治理 |
