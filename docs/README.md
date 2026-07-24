# 灵办词元文档 / Lingban Documentation

`docs/` 是灵办词元产品、架构、开发、治理、测试与上线资料的唯一文档目录。

The `docs/` directory is the canonical location for product, architecture, development, governance, testing, and release documentation.

## 核心文档 / Core Documents

| 文档 | 用途 |
| --- | --- |
| `产品需求草案.md` | 产品定位、用户、工坊、Session 资产与核心流程 |
| `前端需求.md` | H5 与 Dashboard 信息架构和交互规范 |
| `dashboard开发文档.md` | React + Vite 路由、状态、样式和验收约束 |
| `小程序开发文档.md` | Taro H5 首发与微信/支付宝特化方案 |
| `后端设计文档.md` | 后端组件、Run 隔离、MCP、Credential、文件与事件流 |
| `后端开发文档.md` | TypeScript/Fastify/BullMQ/Bridge 的实现要求 |
| `20260717session控制修改方案.md` | App Server、Capture、Draft、Replay、签名、迁移、前端与上线验收的完整基线 |
| `系统实现差距审计-2026-07-12.md` | 实现覆盖、交付差距与风险审计 |
| `联调与验收清单.md` | 分层联调、证据和上线验收项 |

## 最近实现资料 / Recent Implementation Notes

| 文档 | 范围 |
| --- | --- |
| `20260724会话固化与只读分享实现说明.md` | 会话检查点、继续运行、只读对话分享与固化资产分享 |
| `20260720真实运行闭环与前端验收记录.md` | Codex 实例、对话、文件和运行闭环验收 |
| `20260720移动端Creator闭环验收记录.md` | H5/小程序 Creator 项目与发布链路 |
| `微信小程序构建与登录配置.md` | 微信登录、API 域名、构建产物与开发者工具导入配置 |

## 阅读顺序 / Reading Order

1. 产品需求草案
2. 前端需求与后端设计
3. Dashboard、小程序与后端开发文档
4. 接口、治理、数据、Runtime 与部署总表
5. Session Control 修改方案
6. 差距审计和联调验收清单

## 文档规则 / Documentation Rules

- 文档文件统一保存在 `docs/`。
- 需求、设计、实现状态和验证证据分栏表述。
- 代码路径、接口和环境变量使用可检索的原始名称。
- 增量记录包含日期、影响范围、验证命令和剩余风险。
- 服务器密码、API Key、Token 和用户数据禁止进入文档。

Documents use bilingual headings where appropriate and keep implementation evidence traceable to code paths and verification commands.

## 最新验收记录 / Latest Acceptance Record

- `20260720真实运行闭环与前端验收记录.md`：真实 Provider、Codex App Server、MCP、Session 固化、工坊发布消费、Dashboard、H5、微信构建和 HZ01 部署证据。
