# Release README

本目录对应拆分分支 `agent-workshop-release`，保存可交付的发布快照与部署资源。

This directory maps to the `agent-workshop-release` branch and stores release-ready snapshots and deployment assets.

## 内容说明 / Contents

| 路径 | 说明 |
| --- | --- |
| `release/workspaces/` | 面向不同交付仓库的工作区快照 |
| `release/deploy/` | 发布环境部署说明与资产 |
| `release/static/` | 静态资源输出 |
| `release/manifest.json` | 发布包清单与元数据 |

## 使用场景 / Use Cases

- 生成对外交付包
- 在服务器侧部署 API / Dashboard / Mobile / Run Worker
- 对照正式发布资产做核验
