# 灵办词元发布快照 / Lingban Release Snapshot

本分支保存 2026-07-14 生成的服务器发布快照，包含前端静态产物、后端工作区、Run Worker 工作区和部署资产。

This branch contains the server release snapshot generated on 2026-07-14, including frontend static assets, backend and worker workspaces, and deployment assets.

## 内容 / Contents

| 路径 | 内容 |
| --- | --- |
| `release/static/dashboard` | Dashboard production build |
| `release/static/mobile-h5` | Taro H5 production build |
| `release/workspaces/backend` | Backend standalone workspace |
| `release/workspaces/run-worker` | Run Worker standalone workspace |
| `release/workspaces/dashboard` | Dashboard standalone workspace |
| `release/workspaces/app` | Mobile standalone workspace |
| `release/deploy` | Nginx、systemd、环境模板与安装脚本 |
| `release/manifest.json` | 发布清单、生成时间与部署检查项 |

## 验证 / Verification

| 范围 | 结果 |
| --- | --- |
| Dashboard build | 通过 |
| Mobile H5 build | 通过 |
| Backend smoke | 62/62 通过 |
| Run Worker tests | 27/27 通过 |
| Runtime Bridge tests | 23/23 通过 |
| Frontend E2E | 23/23 通过 |

正式 Secret 通过部署环境注入，发布快照仅包含无效占位配置。

Production secrets are injected by the deployment environment; this snapshot contains placeholder configuration only.
