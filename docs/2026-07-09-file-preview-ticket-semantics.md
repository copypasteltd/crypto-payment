# 灵办词元 2026-07-09 文件预览票据语义修正

## 1. 变更目标

| 项 | 说明 |
|---|---|
| 目标日期 | 2026-07-09 |
| 变更主题 | 统一 `run file preview` 与 `download ticket` 的配额、计费与返回语义 |
| 目标问题 | 图片 / PDF 预览依赖下载票据才能在前端展示，但旧实现把这条链记成 `download-ticket`；更严重的是 `preview.mode = download` 时也会隐式创建 ticket，文件页点选二进制文件会产生无效下载票据与错误计费语义 |

## 2. 本次修正

| 类别 | 已落地内容 | 具体文件 |
|---|---|---|
| Preview route 语义收口 | `GET /v1/runs/:runId/files/preview` 只在 `image` / `pdf` 模式下补发 preview access ticket；`download` 模式不再自动创建 ticket | `app/api/src/modules/runs/routes.ts` |
| Download ticket 用途区分 | `RunUploadService.createDownloadTicket()` 新增内部 `purpose = download | preview` 语义 | `app/api/src/modules/uploads/service.ts` |
| 配额错误语义 | preview 用途现在返回 `RUN_FILE_PREVIEW_QUOTA_BLOCKED` / `RUN_FILE_PREVIEW_QUOTA_APPROVAL_REQUIRED`，文案与审批提示改为 “preview file” 语义 | `app/api/src/modules/uploads/service.ts` |
| 计费语义修正 | image/pdf preview access ticket 现在计入 `source = file-preview`，`sourceRef = file.path`；正式下载仍保留 `source = download-ticket` | `app/api/src/modules/uploads/service.ts` |
| 前端消费契约保持稳定 | 前端继续从 preview 响应读取 `downloadUrl / downloadTicketId / downloadExpiresAt`；仅行为口径修正，无需改动 SDK 契约 | `packages/api-sdk/src/index.ts`、`app/mobile/src/pages/tasks/files.tsx`、`app/dashboard/src/pages/instances/InstancesPage.tsx` |

## 3. 修正后的行为矩阵

| 预览模式 | Preview API 返回 | 是否创建 ticket | 配额/计费来源 |
|---|---|---|---|
| `text` | 直接返回 `content` | 否 | `file-preview` |
| `image` | 返回 `downloadUrl` 等票据信息 | 是 | `file-preview` |
| `pdf` | 返回 `downloadUrl` 等票据信息 | 是 | `file-preview` |
| `download` | 返回无内容的 preview 描述 | 否 | 无新增 preview ticket 计费 |

## 4. 回归验证

| 检查项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test tests/file-chain.smoke.test.mjs tests/file-chain-postgres.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `38/38` 通过 |

## 5. 新增 smoke 证据

| 证据 | 覆盖内容 |
|---|---|
| `app/api/tests/file-chain.smoke.test.mjs` | file-backed 链路下，PNG / PDF preview 会返回 ticket，下载内容类型正确，且不会新增 `download-ticket` 账本来源 |
| `app/api/tests/file-chain-postgres.scenario.mjs` | postgres-backed 链路下，PNG / PDF preview 行为与 file-backed 一致 |
| `app/api/tests/file-chain-postgres.smoke.test.mjs` | 对 postgres scenario 结果增加 `imagePreviewMode/pdfPreviewMode` 断言 |

## 6. 影响评估

| 维度 | 影响 |
|---|---|
| Mobile H5 文件页 | 图片与 PDF live preview 的票据来源更符合预览语义 |
| Dashboard 文件页 | 实例右侧文件面板不再因点选二进制文件而隐式制造无效下载票据 |
| Billing / Quota | preview 与 direct download 的账本来源分离，后续统计更可解释 |
| Object Storage 回退链 | 不受影响；仍由 `run_files` 索引与 object store 回退承接 |
