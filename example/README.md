# 灵办词元原型 / Lingban Prototypes

`example/` 包含三套单文件 H5 与 Dashboard 原型。所有页面可直接打开，无需开发服务器。

The `example/` directory contains three single-file H5 and Dashboard prototypes. Each file can be opened directly without a development server.

## 总入口 / Index

打开 `index.html` 查看全部样式和设备入口。

Open `index.html` to access all styles and device variants.

## 文件 / Files

| 风格 | H5 | Dashboard | 定位 |
| --- | --- | --- | --- |
| A Infra | `style-a-infra-h5.html` | `style-a-infra-dashboard.html` | 基础设施工具感 |
| B Protocol | `style-b-protocol-h5.html` | `style-b-protocol-dashboard.html` | 协议与数据层次感 |
| C Operator | `style-c-operator-h5.html` | `style-c-operator-dashboard.html` | 当前产品定稿参照 |

## 方案 C 交互基线 / Style C Baseline

- H5 固定 `工坊 / 任务 / 我的` 三个底部入口。
- 任务页承载多任务列表；进入任务后提供完整对话、详情和文件入口。
- 文件页支持面包屑、路径选择和手动路径输入。
- “我的”包含个人/企业工作区选择、授权、主题和账户信息。
- Dashboard 提供可折叠侧栏、工作区视图、Creator 治理与独立平台后台。
- 三套原型均保留明暗主题和现代扁平图标。

Production frontend code uses Style C as a visual and interaction reference while retaining API-driven state and responsive constraints.
