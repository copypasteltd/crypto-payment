# 灵办词元发布快照 / Lingban Release Snapshot

本目录是 2026-07-21 生成的 HZ01 服务器发布快照，包含 Dashboard、Mobile H5、独立 Admin、Backend API、Run Worker、独立工作区闭包与部署资产。

This directory is the HZ01 server release snapshot generated on 2026-07-21. It contains Dashboard, Mobile H5, independent Admin, Backend API, Run Worker, standalone workspace closures, and deployment assets.

## 内容 / Contents

| 路径 | 内容 |
| --- | --- |
| `static/dashboard` | Dashboard 生产构建 |
| `static/mobile-h5` | Taro H5 生产构建 |
| `static/admin` | 独立 Admin 生产构建 |
| `mini-program/lingban-weapp-20260721` | 可直接导入微信开发者工具的小程序目录 |
| `mini-program/lingban-weapp-20260721.zip` | 微信小程序压缩交付包 |
| `workspaces/backend` | Backend 独立工作区 |
| `workspaces/run-worker` | Run Worker 独立工作区 |
| `workspaces/dashboard` | Dashboard 独立工作区 |
| `workspaces/app` | Mobile 独立工作区 |
| `workspaces/admin` | Admin 独立工作区 |
| `deploy` | Nginx、systemd、环境模板与安装脚本 |
| `manifest.json` | 发布清单与部署检查项 |

## 本轮能力 / Release Scope

- 实例停止与强制终止
- Runtime 释放、清理重试和失败诊断
- 实例归档与恢复
- 带 Capture 前置检查的永久销毁
- Mobile、Dashboard 与 Admin 生命周期入口
- 长期资产、计费账本和审计数据保留策略

The release adds end-to-end run stop, runtime release, archive, restore, and guarded permanent deletion across API, worker, Mobile, Dashboard, and Admin.

## 验证 / Verification

| 范围 | 结果 |
| --- | --- |
| Frontend E2E | 33/33 通过 |
| Run lifecycle API | 6/6 通过 |
| Run Worker | 33/33 通过 |
| Shared DB | 29/29 通过 |
| API SDK | 28/28 通过 |
| Mobile H5 / WeChat Mini Program build | 通过 |
| WeChat artifact verification | 60 个文件，`1,223,636 Byte`，关键入口与项目配置校验通过 |

正式 Secret 通过部署环境注入。该快照不包含有效 API Key、Token、服务器密码或用户凭证。

Production secrets are injected through the deployment environment. This snapshot contains no valid API keys, tokens, server passwords, or user credentials.
