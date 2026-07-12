# 灵办词元 2026-07-09 storage retention sweeper 增量

## 1. 变更目标

| 项 | 说明 |
|---|---|
| 目标日期 | 2026-07-09 |
| 变更主题 | 为 upload object 与 download ticket 补齐后台 retention / GC 能力 |
| 目标问题 | 原有文件链仅具备单 run 的 `run_files` 托管对象替换清理；过期 download ticket 记录、长期未附着 upload object 与 `expired` upload record 没有后台回收机制 |

## 2. 本次落地内容

| 类别 | 已落地内容 | 具体文件 |
|---|---|---|
| Retention manager | 新增 `UploadRetentionManager`，支持周期 sweep、手动 sweep、dry-run、累计指标与最近一次执行报告 | `app/api/src/modules/uploads/retention.ts` |
| Repository 删除能力 | `UploadRepository` 新增 `listUploads()`、`deleteUpload()`、`deleteDownloadTicket()` | `app/api/src/modules/uploads/repository.ts` |
| 服务启动接线 | API 启动后自动拉起 sweeper，关闭时优雅停止 | `app/api/src/app/create-server.ts` |
| 运维入口 | 新增 `GET /internal/storage-retention` 与 `POST /internal/storage-retention/sweep` | `app/api/src/modules/bridge/routes.ts` |
| 指标导出 | `/internal/metrics` 新增 retention sweeper 活跃态与累计清理计数 | `app/api/src/app/ops.ts` |
| 环境配置 | 新增 sweep 周期、download ticket retention、unattached upload TTL、expired upload retention 4 个参数 | `packages/config/src/index.ts`、`infra/docker/compose.env*` |

## 3. Sweep 语义

| 对象 | 当前规则 |
|---|---|
| 过期 download ticket | `expiresAt + LINGBAN_DOWNLOAD_TICKET_RETENTION_SECONDS` 到期后删除记录 |
| 未附着 upload | `updatedAt` 超过 `LINGBAN_UNATTACHED_UPLOAD_TTL_SECONDS` 后删除 object，并将 record 标记为 `expired` |
| 已过保留期的 `expired` upload | `updatedAt` 超过 `LINGBAN_EXPIRED_UPLOAD_RETENTION_SECONDS` 后删除 object 与 record |
| 已附着 upload | 不参与 sweeper 删除 |
| dry-run | 返回候选数量，不执行真实删除 |

## 4. 回归验证

| 检查项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test tests/upload-retention.smoke.test.mjs` | 通过 |
| `node --test tests/upload-retention-postgres.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `44/44` 通过 |

## 5. 新增证据

| 证据 | 覆盖内容 |
|---|---|
| `app/api/tests/upload-retention.smoke.test.mjs` | file-backed upload/download ticket retention sweep |
| `app/api/tests/upload-retention-postgres.scenario.mjs` | postgres-backed retention sweep |
| `app/api/tests/upload-retention-postgres.smoke.test.mjs` | postgres scenario 包装与 CI 入口 |

## 6. 剩余边界

| 维度 | 当前状态 |
|---|---|
| Office 类预览 | 已在 `2026-07-09-office-preview-chain-increment.md` 落地 |
| 病毒扫描 / 内容安全前置位 | 已在 `2026-07-09-file-security-scan-increment.md` 落地 |
| 跨 run 分层归档 / 冷热分级 | 已在 `2026-07-09-run-file-lifecycle-cold-archive-increment.md` 落地 |
| 全局对象清单反查与桶级 reconcile | 仍未开始 |

