# 灵办词元 Secret清理、轮换失效与实例回收执行总表

## 1. 文档信息

| 字段 | 内容 |
|---|---|
| 文档名称 | Secret清理、轮换失效与实例回收执行总表 |
| 适用范围 | `app/run-worker`、`app/container-bridge`、`app/api`、后续 runtime-cleanup/credential-lifecycle 正式域 |
| 统计日期 | 2026-07-08 |
| 当前事实 | 文件型 secret 当前会写入 `runRoot/secrets`，env 型 secret 会进入 bridge runtime env，容器挂载计划会把 `secrets` 目录只读挂入容器；当前没有实例结束后的统一清理、没有轮换后的旧 secret 失效传播、没有吊销后的运行中收敛策略。 |
| 直接证据 | `app/container-bridge/src/bridge/secret-loader.ts`、`app/run-worker/src/services/container-runtime.ts`、`app/run-worker/src/services/run-lifecycle.ts`、`docs/容器生命周期与隔离策略总表.md`、`docs/运行时物料与存储结构总表.md`、`docs/运行时物料生成、MCP物化与Bridge控制执行总表.md`、`docs/风险与成本监控表.md` |
| 输出目标 | 将 secret 挂载面、清理时机、轮换与吊销传播、失败回收、审计与作业链细化为执行总表 |

## 2. 当前事实矩阵

| 主题 | 当前证据 | 当前结论 | 当前缺口 |
|---|---|---|---|
| 文件型 secret 存放 | `hostPaths.secretsPath` / `/workspace/secrets` | 已有 per-run 目录隔离 | 无生命周期回收 |
| env 型 secret 注入 | `SecretLoader.materialize()` 返回 `env` 给 Codex session | 进程级 secret 注入已存在 | 无显式销毁与审计 |
| 只读挂载 | `container-runtime.ts` 把 `secrets` 目录挂为只读 | 容器内写保护已存在 | 宿主侧仍可残留 |
| 启动失败处理 | 缺失 secret 会直接抛错 | 能阻断错误启动 | 无失败后清理 |
| 容器回收 | 运行文档要求实例关闭即销毁 | 产品策略已明确 | 代码未实现 cleanup worker |

## 3. Secret 暴露面矩阵

| 暴露面 | 当前位置 | 当前状态 | 风险 |
|---|---|---|---|
| 宿主文件 | `<runRoot>/secrets` | 已写入或复用 | 运行后残留 |
| 容器内文件 | `/workspace/secrets` | 只读挂载 | 镜像内进程可读 |
| 子进程环境变量 | bridge -> Codex PTY env | 已注入 | 子进程继承风险 |
| runtime 清单 | `secret-manifest.json` | 明文路径清单 | 可被诊断链读取 |
| 宿主预置文件 | `SecretLoader` 直接复用 | 当前支持 | 来源不可审计 |

## 4. 清理触发时机总表

| 触发时机 | 当前状态 | 正式动作 |
|---|---|---|
| run 成功结束 | 无统一清理 | 按策略删除 `runRoot/secrets`、清空 env 上下文 |
| run 失败结束 | 无统一清理 | 清理 secret 文件并保留审计摘要 |
| run 取消 | 无统一清理 | 立即清理临时 secret |
| bridge 启动失败 | 当前仅抛错退出 | 失败补偿清理已写入文件 |
| 容器启动失败 | 当前未进入真容器执行 | 清理挂载目录与 manifest |
| 凭证轮换完成 | 当前无传播 | 标记旧 secret 待失效 |
| 凭证吊销 | 当前无传播 | 新 run 阻断，旧 run 按策略停用或限时继续 |

## 5. 运行结束清理执行链总表

| 步骤 | 执行方 | 输入 | 动作 | 输出 |
|---|---|---|---|---|
| 1 | Run lifecycle manager | run 终态事件 | 进入 cleanup 流程 | cleanup job |
| 2 | cleanup worker | `runRoot/secrets`、runtime manifest | 删除临时 file secrets | 文件清理结果 |
| 3 | cleanup worker | runtime env metadata | 清理临时 env 注入缓存 | env 清理结果 |
| 4 | cleanup worker | `secret-manifest.json` | 生成摘要或脱敏保留 | 审计摘要 |
| 5 | 审计层 | cleanup 结果 | 写 `secret.cleanup_succeeded/failed` | 审计事件 |

## 6. 轮换传播执行矩阵

| 场景 | 正式动作 | 对 run 的影响 |
|---|---|---|
| 新版本发布但旧版本仍可容忍 | 标记旧版本 `rotation_due` | 旧 run 可继续，新 run 用新版本 |
| 强制轮换 | 旧版本标记 `replaced` | 新 run 禁止使用旧版本 |
| 高风险凭证轮换 | 强制重新探活 connector | 相关 run 下一次关键动作前需校验 |
| 浏览器 state 类文件轮换 | 更新 file mount version | 旧 run 可能需重新登录或重新发起 |

## 7. 吊销与失效传播矩阵

| 场景 | 正式动作 | 运行态处理 |
|---|---|---|
| 用户主动吊销 | 标记 `revoked` | 新 run 阻断，旧 run 在下一次使用点失败并回流 |
| 凭证过期 | 标记 `expired` | 启动前阻断；运行中根据策略暂停 |
| 泄露事故 | 标记 `compromised` | 立即冻结相关 connector/package/run |
| 工作区解绑 | 删除 binding | 新 run 不可解析相关 secret |

## 8. 失败补偿矩阵

| 失败点 | 当前行为 | 正式补偿 |
|---|---|---|
| file secret 写入到一半失败 | 当前直接抛错 | 删除已写入的部分文件 |
| bridge 启动后 secret 校验失败 | 当前抛错 | 停止 PTY、清理 secret、写审计 |
| cleanup job 失败 | 当前无 | 重试 + 告警 + 标记 `cleanup_pending` |
| 容器未成功销毁 | 当前无真执行 | 阻止 secret 回收完成，进入人工处理队列 |

## 9. 保留与脱敏矩阵

| 对象 | 是否保留 | 保留内容 |
|---|---|---|
| secret 明文文件 | 否 | 不保留 |
| env 明文值 | 否 | 不保留 |
| `secret-manifest.json` | 是，需脱敏 | 仅保留 `credential_id/mount_mode/path_hash` |
| cleanup 审计 | 是 | 成功/失败、原因、耗时 |
| 轮换与吊销事件 | 是 | 版本链、绑定范围、影响面 |

## 10. 监控与告警矩阵

| 指标/事件 | 告警条件 | 动作 |
|---|---|---|
| `secret_materialize_failed` | 单小时超阈值 | 冻结相关 connector 或 package |
| `secret_cleanup_failed` | 任意高风险工作区出现 | 立即告警 |
| `orphan_secret_files` | 周期扫描发现残留 | 自动补清理或人工介入 |
| `credential_revoked_but_in_use` | 吊销后仍被新 run 解析 | 阻断并告警 |

## 11. API / 作业接口矩阵

| 接口/作业 | 作用 |
|---|---|
| cleanup worker | run 终态后清理 secret 与 runtime 残留 |
| rotation propagation job | 将新 credential version 推送到 bindings/run gate |
| revoke propagation job | 将 revoked/expired 状态推送到 connector/package/run |
| orphan secret scan job | 扫描 `runs/*/secrets` 残留 |
| `GET /v1/credentials/:id/usages` | 查询凭证影响面 |

## 12. 前端与治理回流矩阵

| 页面 | 正式展示 |
|---|---|
| Creator `governance/credentials` | 轮换到期、吊销状态、残留风险、影响 package/run 数 |
| Creator `governance/policy` | secret cleanup policy、run 结束保留策略 |
| Mobile 我的 | 凭证异常或授权失效提醒 |
| 启动实例页 | secret 不可用、已吊销、需重新授权的阻断信息 |

## 13. 当前结构性缺口总表

| 缺口 | 当前表现 | 影响 | 优先级 |
|---|---|---|---|
| 无 cleanup worker | `secrets` 目录可能长期残留 | 安全风险 | P0 |
| env/file secret 无统一销毁协议 | 仅有注入，没有回收 | 运行后暴露面过大 | P0 |
| 轮换/吊销无传播链 | credential 生命周期不会影响现有绑定 | 治理失效 | P0 |
| `secret-manifest` 可暴露过多路径信息 | 仅作为运行清单使用 | 诊断与合规风险 | P1 |
| 无 orphan 扫描 | 残留 secret 不可发现 | 运维风险 | P1 |

## 14. 实施顺序表

| 顺序 | 动作 |
|---|---|
| 1 | 新建 cleanup worker 与 secret 生命周期状态对象 |
| 2 | 把 run 终态统一接到 cleanup pipeline |
| 3 | 为 secret-manifest 增加脱敏摘要模式 |
| 4 | 实现 credential rotate/revoke propagation jobs |
| 5 | 接入 Creator 凭证治理页与告警中心 |
