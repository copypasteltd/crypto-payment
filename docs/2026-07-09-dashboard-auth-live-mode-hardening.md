# 2026-07-09 Increment: Dashboard Auth Live Mode Hardening

## 1. 目标

收紧 Dashboard 在认证工作区中的数据回退策略，避免真实工作区在查询未返回、空列表或局部引用失配时混入样例目录、样例实例或错误的静态关联对象。

## 2. 本次变更范围

| 模块 | 文件 | 变更 |
|---|---|---|
| Dashboard Shell | `app/dashboard/src/app/DashboardShell.tsx` | 认证工作区下，`workshops / services / instances` 查询未成功时不再回退静态样例列表 |
| Workshops 页面 | `app/dashboard/src/pages/workshops/WorkshopsPage.tsx` | 认证工作区下，最近实例区不再从静态 `instances` 回填 |
| Instances 页面 | `app/dashboard/src/pages/instances/InstancesPage.tsx` | 数据模式从 `live/static` 扩展为 `live/empty/static`；认证工作区无 run 时进入 `empty`，不再展示样例实例 |
| Creator 页面 | `app/dashboard/src/pages/creator/CreatorPage.tsx` | 认证工作区下，关联工坊/服务若未命中实时 catalog，不再错误映射到静态样例对象，而是明确显示未解析引用 |

## 3. 行为变化

| 场景 | 旧行为 | 新行为 |
|---|---|---|
| DashboardShell 查询未返回 | 可能显示静态工坊、服务、实例 | 认证工作区显示空列表或等待真实查询结果 |
| Workshops 页最近实例 | 真实 run 不可用时回填静态实例 | 认证工作区直接显示空最近实例 |
| Instances 页无真实 run | 自动进入样例实例列表 | 认证工作区进入 `empty` 模式，并明确提示当前无真实实例 |
| Creator 关联引用失配 | 尝试匹配静态样例工坊/服务 | 显示 `未解析工坊/服务 <id>` 占位，避免误导 |

## 4. 工程意义

| 维度 | 意义 |
|---|---|
| 数据可信度 | 认证工作区中的列表、通知、搜索候选、实例面板不再混入虚构样例 |
| 空态语义 | 把“没有数据”与“样例预览”拆成两个明确模式 |
| Creator 准确性 | 防止 package 绑定关系被静态样例误解释 |
| 静态退场路径 | 与 `docs/静态参考数据退场与真实数据接线执行总表.md` 中的 `demo mode` 拆分目标保持一致 |

## 5. 验证

| 命令 | 结果 |
|---|---|
| `pnpm -C app/dashboard build` | 通过 |
| `pnpm test:e2e:dashboard` | 通过，`3/3` |
