# Infra README

本目录对应拆分分支 `agent-workshop-infra`，保存部署、环境变量样例与服务运行脚本。

This directory maps to the `agent-workshop-infra` branch and stores deployment assets, environment templates, and operational scripts.

## 目录结构 / Structure

| 路径 | 说明 |
| --- | --- |
| `infra/deploy/` | 上线部署资产，含 env example、nginx、systemd、安装脚本 |
| `infra/docker/` | 镜像与容器相关配置草案 |
| `infra/scripts/` | 环境准备、发布辅助、运维脚本 |

## 关键文件 / Key Files

| 文件 | 作用 |
| --- | --- |
| `infra/deploy/server/install-release.sh` | 服务端安装与部署脚本 |
| `infra/deploy/nginx/lingban.conf` | 反向代理配置 |
| `infra/deploy/systemd/lingban-api.service` | API systemd 服务 |
| `infra/deploy/systemd/lingban-run-worker.service` | worker systemd 服务 |

## 说明 / Notes

- `deploy/README.md` 记录了发布目录结构与启动方法。
- 环境变量样例与正式密钥需要分离管理。
