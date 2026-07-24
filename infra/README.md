# 灵办词元基础设施 / Lingban Infrastructure

`infra/` 保存发布、部署、Nginx、systemd、环境样例和运维脚本。

The `infra/` directory contains release, deployment, Nginx, systemd, environment templates, and operational scripts.

## 结构 / Structure

| 路径 | 内容 |
| --- | --- |
| `deploy/` | Release 安装器、环境模板、Nginx 与 systemd 单元 |
| `scripts/export-standalone-workspace.mjs` | 导出五个带完整 workspace 依赖闭包的交付仓库 |
| `scripts/prepare-production-release.mjs` | 生成生产发布目录和静态前端产物 |
| `docker/` | 服务器 Runtime 镜像与隔离执行配置 |
| `docker/playwright-mcp-entrypoint.sh` | 服务器 Runtime 内启动 Playwright MCP 的标准入口 |

## HZ01 端口 / HZ01 Ports

| 服务 | 端口 | 地址 |
| --- | ---: | --- |
| Dashboard | 38110 | `http://192.168.31.20:38110/` |
| Mobile H5 | 38120 | `http://192.168.31.20:38120/` |
| API | 38130 | `http://192.168.31.20:38130` |

服务器凭证和正式 Secret 由外部安全载体管理，不进入仓库或发布包。

Server credentials and production secrets are managed through external secure channels and are excluded from source control and release bundles.

## 发布命令 / Release Commands

```bash
pnpm standalone:export:all
node infra/scripts/prepare-production-release.mjs
```

Local preparation uses native Node.js/pnpm. Runtime installation and isolation validation are performed on the designated server.

截至 2026-07-25，Capture 恢复、Codex thread 恢复和 Playwright MCP 入口已纳入服务器发布资产。
