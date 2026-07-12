# 灵办词元 2026-07-09 文件安全扫描增量

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | 文件安全扫描增量 |
| 日期 | 2026-07-09 |
| 变更主题 | 为上传、预览、下载与 download ticket 主链补齐文件安全扫描前置位 |
| 目标问题 | 原有文件链已具备对象存储、preview gateway、download ticket 与 retention sweeper，但缺少恶意文件前置拦截与运维可观测，无法宣称文件域具备生产级安全门 |

## 2. 本次落地范围

| 模块 | 变更 | 关键文件 |
|---|---|---|
| 合同层 | `RunUploadRecord` 新增 `scanStatus/scanEngine/scanReasonCode/scanDetail/scanSignature/scannedAt`；`RunDownloadTicket` 新增 `checksum` | `packages/contracts/src/uploads.ts` |
| 配置层 | 新增 `LINGBAN_FILE_SCAN_*` 运行时配置，支持 `disabled / builtin / clamav` 与 `allow / block` 错误策略 | `packages/config/src/index.ts` |
| 扫描服务 | 新增 `RunFileSecurityService`，内置扩展名、MIME、宏 Office、可执行头、shebang、EICAR 检测，并支持 `clamd` `INSTREAM` 接入 | `app/api/src/modules/uploads/file-security.ts` |
| 上传链 | `PUT /uploads/:id/content` 在落对象前执行扫描；阻断结果会持久化为 `status=blocked` | `app/api/src/modules/uploads/service.ts` |
| 文件访问链 | `read / preview / direct download / download ticket` 全部接入安全门；上传附件会按 upload record 复用/补扫，运行产物会按 path 或 object source 扫描 | `app/api/src/modules/runs/file-access.ts`、`app/api/src/modules/uploads/service.ts` |
| 票据链 | object-backed download ticket 新增 `checksum` 校验，避免票据签发后对象内容漂移继续放行 | `app/api/src/modules/uploads/service.ts` |
| 运维面 | 新增 `GET /internal/file-security`，并将 readiness/metrics 纳入 `/readyz` 与 `/internal/metrics` | `app/api/src/modules/bridge/routes.ts`、`app/api/src/app/ops.ts` |

## 3. 扫描语义

| 场景 | 执行时机 | 当前策略 |
|---|---|---|
| 上传附件 | `PUT /content` 落对象前 | 默认 builtin 扫描，命中即拒绝写入对象存储 |
| 旧 upload record / 缺失扫描元数据 | 首次 attach / preview / download 时 | 懒补扫并回写 upload record |
| target path 真实文件 | `read / preview / direct download / download ticket` 前 | 按文件路径重新扫描 |
| indexed object 回源文件 | `preview / direct download / resolve ticket` 前 | 按 object stream 扫描 |
| object-backed ticket | `GET /v1/downloads/:ticketId` | 先扫对象，再校验 `checksum` 是否与签发时一致 |

## 4. 当前内置规则

| 规则类别 | 当前实现 |
|---|---|
| 扩展名阻断 | `.exe/.dll/.bat/.cmd/.ps1/.vbs/.js/.jar/.sh` 等高风险可执行/脚本扩展名默认阻断 |
| MIME 阻断 | `application/x-msdownload`、`application/x-executable`、`text/x-shellscript` 等默认阻断 |
| 宏 Office 阻断 | `.docm/.xlsm/.pptm/.xlsb/.xlam` 等默认阻断 |
| 头部签名 | PE / ELF / Mach-O 检测 |
| 脚本头 | `#!` shebang 检测 |
| 测试签名 | EICAR 检测 |
| 外接引擎 | `clamd` `PING` readiness 与 `INSTREAM` 扫描 |

## 5. 新增配置

| 环境变量 | 作用 |
|---|---|
| `LINGBAN_FILE_SCAN_MODE` | `disabled / builtin / clamav` |
| `LINGBAN_FILE_SCAN_ERROR_POLICY` | 扫描错误时 `allow / block` |
| `LINGBAN_FILE_SCAN_TIMEOUT_MS` | 扫描或 `clamd` 通讯超时 |
| `LINGBAN_FILE_SCAN_BLOCKED_EXTENSIONS` | 自定义扩展名阻断列表 |
| `LINGBAN_FILE_SCAN_BLOCKED_MIME_PREFIXES` | 自定义 MIME 前缀阻断列表 |
| `LINGBAN_FILE_SCAN_BLOCK_MACRO_OFFICE` | 是否阻断宏 Office 文件 |
| `LINGBAN_FILE_SCAN_CLAMAV_HOST` | `clamd` 主机 |
| `LINGBAN_FILE_SCAN_CLAMAV_PORT` | `clamd` 端口 |

## 6. 验证结果

| 验证项 | 结果 |
|---|---|
| `pnpm -C app/api build` | 通过 |
| `node --test --test-concurrency=1 tests/file-chain.smoke.test.mjs tests/file-chain-postgres.smoke.test.mjs tests/file-security.smoke.test.mjs tests/file-security-postgres.smoke.test.mjs tests/readiness-metrics.smoke.test.mjs` | 通过 |
| `pnpm -C app/api test:smoke` | `44/44` 通过 |

## 7. 剩余缺口

| 项目 | 状态 |
|---|---|
| 跨 run 分层归档 / 冷热分级 | 已在 `2026-07-09-run-file-lifecycle-cold-archive-increment.md` 落地 |
| 全局对象清单反查与桶级 reconcile | 未开始 |
| 富排版 HTML 级 Office 预览 | 未开始 |

