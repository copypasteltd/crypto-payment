# 灵办词元 2026-07-09 Office 预览链增量

## 1. 变更目标

| 项 | 说明 |
|---|---|
| 目标日期 | 2026-07-09 |
| 变更主题 | 为 run 文件预览链补齐常见 Office 文件的可读预览能力 |
| 目标问题 | 原实现仅支持文本、图片与 PDF 预览；`.docx/.xlsx/.xls/.pptx` 会被统一降级到下载模式，状态表中的 Office 预览缺口未关闭 |

## 2. 本次落地内容

| 类别 | 已落地内容 | 具体文件 |
|---|---|---|
| 预览 helper | 新增 `file-preview.ts`，统一承载 mime 判定、preview mode 判定与 Office 文本抽取 | `app/api/src/modules/runs/file-preview.ts` |
| Word 预览 | `.docx/.docm` 接入 `mammoth.extractRawText()` | `app/api/src/modules/runs/file-preview.ts` |
| Excel 预览 | `.xlsx/.xlsm/.xls` 接入 `xlsx`，按 sheet/row/col 限额输出文本预览 | `app/api/src/modules/runs/file-preview.ts` |
| PPTX 预览 | `.pptx/.pptm` 接入 `jszip`，抽取 slide XML 中的文本节点 | `app/api/src/modules/runs/file-preview.ts` |
| API 接线 | `readRunFile()` 与 `previewRunFile()` 统一走 textual preview 分支，并支持 object store 回源 | `app/api/src/modules/runs/file-access.ts` |
| 索引与摘要对齐 | `run_files` 的 `mimeType/previewMode/previewable` 语义同步支持 Office 文件；`me` 资产摘要同步更新 | `app/api/src/modules/runs/file-index.ts`、`app/api/src/modules/me/service.ts` |

## 3. 预览语义

| 文件类型 | 当前 preview mode | 预览形式 |
|---|---|---|
| `.docx/.docm` | `text` | 抽取正文文本 |
| `.xlsx/.xlsm/.xls` | `text` | 抽取前若干 sheet / row / col 的表格文本 |
| `.pptx/.pptm` | `text` | 按 slide 顺序抽取文本节点 |
| `.png/.jpg/.webp/.svg` | `image` | 票据化内联预览 |
| `.pdf` | `pdf` | 票据化内联预览 |
| 其他未支持类型 | `download` | 直接下载 |

## 4. 对象回源语义

| 场景 | 当前行为 |
|---|---|
| target path 仍存在 | 直接从目标目录读取并抽取 |
| target path 已清理 | 从 `run_files` indexed object 读回 buffer 后抽取 |
| Office 预览内容过长 | 返回截断文本，并由前端显示统一截断提示 |

## 5. 回归验证

| 检查项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test tests/file-chain.smoke.test.mjs` | 通过 |
| `node --test tests/file-chain-postgres.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `42/42` 通过 |

## 6. 新增证据

| 证据 | 覆盖内容 |
|---|---|
| `app/api/tests/file-chain.smoke.test.mjs` | file-backed 链路下 `.docx/.xlsx/.pptx` 预览与 target path 删除后的 docx 回源预览 |
| `app/api/tests/file-chain-postgres.scenario.mjs` | postgres-backed 链路下 `.docx/.xlsx` 预览与 target path 删除后的 docx 回源预览 |

## 7. 剩余边界

| 维度 | 当前状态 |
|---|---|
| `.doc` / `.ppt` 等旧二进制 Office 格式 | 仍未支持 |
| 病毒扫描 / 内容安全前置位 | 已在 `2026-07-09-file-security-scan-increment.md` 落地 |
| 富排版 HTML 级 Office 预览 | 仍未开始 |
