# 灵办词元发布快照 / Lingban Release Snapshot

本分支保存 2026-07-21 生成的服务器发布快照，包含 Dashboard、Mobile H5、独立 Admin、后端工作区、Run Worker 工作区和部署资产。

This branch contains the server release snapshot generated on 2026-07-21, including Dashboard, Mobile H5, independent Admin, backend and worker workspaces, and deployment assets.

## 内容 / Contents

| 路径 | 内容 |
| --- | --- |
| `release/static/dashboard` | Dashboard production build |
| `release/static/mobile-h5` | Taro H5 production build |
| `release/static/admin` | Independent Admin production build |
| `release/workspaces/backend` | Backend standalone workspace |
| `release/workspaces/run-worker` | Run Worker standalone workspace |
| `release/workspaces/dashboard` | Dashboard standalone workspace |
| `release/workspaces/app` | Mobile standalone workspace |
| `release/workspaces/admin` | Admin standalone workspace |
| `release/deploy` | Nginx、systemd、环境模板与安装脚本 |
| `release/manifest.json` | 发布清单、生成时间与部署检查项 |

## 验证 / Verification

| 范围 | 结果 |
| --- | --- |
| Dashboard build | 通过 |
| Mobile H5 build | 通过 |
| Run lifecycle API | 6/6 通过 |
| Run Worker tests | 33/33 通过 |
| Shared DB tests | 29/29 通过 |
| API SDK tests | 28/28 通过 |
| Frontend E2E | 33/33 通过 |

正式 Secret 通过部署环境注入，发布快照仅包含无效占位配置。

Production secrets are injected by the deployment environment; this snapshot contains placeholder configuration only.
