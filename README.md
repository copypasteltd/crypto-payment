# 灵办词元发布快照 / Lingban Release Snapshot

本分支保存 2026-07-25 生成的服务器发布快照，包含 Dashboard、Mobile H5、独立 Admin、后端工作区、Run Worker 工作区和部署资产。

This branch contains the server release snapshot generated on 2026-07-25, including Dashboard, Mobile H5, independent Admin, backend and worker workspaces, and deployment assets.

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
| Mobile H5 build | 通过 |
| WeChat Mini Program build and verifier | 通过 |
| Mobile creator flow | 6/6 通过 |
| Mobile media rendering | 8/8 通过 |
| API capture/share focused suites | 4/4 通过 |
| Run Worker tests | 33/33 通过 |
| Runtime Bridge tests | 34/34 通过 |
| Shared DB tests | 30/30 通过 |
| Session Pack tests | 24/24 通过 |

正式 Secret 通过部署环境注入，发布快照仅包含无效占位配置。

Production secrets are injected by the deployment environment; this snapshot contains placeholder configuration only.
