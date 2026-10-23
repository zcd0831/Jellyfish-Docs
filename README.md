# Jellyfish-Docs

Jellyfish 的**领域模型文档**：一份 Markdown 源 + 一套纯静态 HTML 文档站。
没有构建步骤，克隆下来双击 `model/docs/index.html` 就能读。

## 目录结构

```
Jellyfish-Docs/
└── model/
    ├── 模型图.md            # 领域模型总图（按模块分组）+ 聚合/服务/事件/规则
    ├── 模块-感知.md          # 感知：会话、上下文流水、提示词快照、窗口折叠、运行策略
    ├── 模块-行动.md          # 行动：工具与执行、模型与供应商、代理身份、预算台账
    ├── 模块-规划.md          # 规划：计划、尝试、验证、驱动循环
    ├── 模块-记忆.md          # 记忆：反思、经验、技能（SOP）
    └── docs/                # 静态 HTML 文档站
        ├── index.html       #   入口：目录 + 三种阅读路径
        ├── 01-intro.html    #   整体介绍
        ├── 02-language.html #   统一语言（术语表 / 易混概念 / 状态枚举）
        ├── 03-overview.html #   模型总览（12 聚合 / 15 服务 / 3 端口 / 事件全景）
        ├── 04-perception.html
        ├── 05-action.html
        ├── 06-planning.html
        ├── 07-memory.html
        └── assets/          #   style.css + app.js（侧栏、页内目录、翻页、Mermaid 渲染）
```

四份模块文档结构一致：模块定位与边界 → 总览图 → 对象操作图 → 聚合清单 → 领域服务清单 →
其他实体/值对象 → 领域事件 → 生命周期与规则 → 服务操作详解。

## 阅读方式

- **想看图文**：打开 `model/docs/index.html`（`file://` 直接可用，不请求任何后端）。
- **想看源文**：直接读 `model/模型图.md` 与四份模块文档。
- **想用 HTTP**：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000/model/docs/
```

HTML 站的 Mermaid 图通过 CDN 加载（`mermaid@10.9.1`）。断网时图会退化成源码文本，正文与表格不受影响；需要彻底离线，把 `mermaid.min.js` 放进 `model/docs/assets/` 并改一下 `app.js` 的引用即可。

## 维护约定

- **Markdown 是源，HTML 是转写**。改任何一边都要同步另一边，尤其是 Mermaid 图——两边图应逐行一致。
- 新增图表时，Mermaid 块里的 `<br/>`、`<|..` 等裸 `<` 必须转义成 `&lt;`，否则浏览器会当标签吃掉，图会静默渲染错误。
- 术语以 `02-language.html`（统一语言）为准；代码名与领域名不一致时，以代码名为准并在此登记。
- 凡与源码注释冲突，以后者为准。

## 相关仓库

| 仓库 | 关系 |
| --- | --- |
| [Jellyfish](https://github.com/zcd0831/Jellyfish) | 内核，本文档描述的领域模型来源 |
| [Jellyfish-Plugins](https://github.com/zcd0831/Jellyfish-Plugins) | 官方插件 |
