# 灵办词元 2026-07-09 run_files 输出域 source 分类修正

## 1. 变更目标

| 项 | 说明 |
|---|---|
| 目标日期 | 2026-07-09 |
| 变更主题 | `run_files` 对运行输出目录的 `source` 判定从 `kind` 绑定改为路径来源优先 |
| 目标问题 | `/output/*.png`、`/output/*.pdf`、`/receipts/*` 会因为 `kind = screenshot / receipt` 被错误归到 `target-scan`，导致 indexed 查询、对象键命名、前端筛选与统计口径出现偏移 |

## 2. 本次修正

| 类别 | 已落地内容 | 具体文件 |
|---|---|---|
| Source 判定规则 | `source` 先看路径来源，再看展示 `kind`；`/archive` -> `archive`，`/logs` 或 `.log` -> `log`，`/output` / `/outputs` / `/receipts` -> `runtime-output` | `app/api/src/modules/runs/file-index.ts` |
| Kind 语义保留 | `kind = screenshot / receipt / output / log / archive` 继续保留，用于前端标签与预览模式，不再承担“来源域”判断 | `app/api/src/modules/runs/file-index.ts`、`packages/contracts/src/common.ts` |
| Object key 一致性 | 运行输出域图片 / PDF / receipt 现在写入 `runs/<runId>/indexed/runtime-output/...`，不再落到 `target-scan` 前缀 | `app/api/src/modules/runs/file-index.ts` |
| Indexed 查询一致性 | `GET /v1/runs/:id/files/indexed?source=runtime-output` 现在会包含输出目录里的图片 / PDF 文件 | `app/api/tests/file-chain.smoke.test.mjs`、`app/api/tests/file-chain-postgres.scenario.mjs` |

## 3. 修正后的规则矩阵

| 路径或特征 | source | kind 示例 |
|---|---|---|
| `uploads/<uploadId>/*` 且命中 upload 记录 | `user-upload` | `input` / `screenshot` |
| `/archive/*` | `archive` | `archive` |
| `/logs/*` 或 `*.log` | `log` | `log` |
| `/output/*` / `/outputs/*` / `/receipts/*` | `runtime-output` | `output` / `receipt` / `screenshot` |
| 其他 targetPath 内扫描文件 | `target-scan` | 任意 |

## 4. 回归验证

| 检查项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test tests/file-chain.smoke.test.mjs tests/file-chain-postgres.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `38/38` 通过 |

## 5. 新增证据

| 证据 | 覆盖内容 |
|---|---|
| `app/api/tests/file-chain.smoke.test.mjs` | file-backed 链路下，`output/preview.png` 与 `output/preview.pdf` 的 `source/objectKey` 归于 `runtime-output`，且 indexed 查询能按 `source=runtime-output` 命中 |
| `app/api/tests/file-chain-postgres.scenario.mjs` | postgres-backed 链路下同样验证图片 / PDF 输出域 source 分类与 object key |
| `app/api/tests/file-chain-postgres.smoke.test.mjs` | 对 scenario JSON 结果增加 `indexedRuntimeBinaryCount` 断言 |

## 6. 影响评估

| 维度 | 影响 |
|---|---|
| Backend indexed 查询 | `source=runtime-output` 的结果更符合运行输出语义 |
| Object storage 结构 | 二进制输出物的 object key 前缀更稳定，便于后续按 source 做生命周期治理 |
| Mobile / Dashboard 文件页 | 运行输出域文件的来源标签、筛选与统计口径更一致 |
| Billing / Preview | 不直接改变 preview 计费，但让 output 域二进制文件在索引和票据链上保持统一来源语义 |
