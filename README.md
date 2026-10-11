# Jellyfish-Docs

Jellyfish 的**离线文档站**：两套纯静态 HTML 文档，同源不同视角——一套讲「怎么用」，一套讲「怎么实现的」。
没有构建步骤，克隆下来双击 `index.html` 就能读；断网也能读，只损失图的渲染与代码高亮。

## 在线阅读

| 文档 | 面向谁 | 规模 | 在线地址                                               | 本地入口 |
| --- | --- | --- |----------------------------------------------------| --- |
| **Jellyfish 使用指南** | 想用 Jellyfish 干活的人 | 16 个内容页 + 首页 | <https://jellyfish-agent.cloud/guide/0.1.2>        | [`guide/index.html`](guide/index.html) |
| **Jellyfish 源码深度解析** | 想读懂内核设计与插件化实现的人 | 28 个内容页 + 首页 | <https://www.jellyfish-agent.cloud/learning/0.1.2> | [`learning/index.html`](learning/index.html) |

- **使用指南（`guide/`）**：环境与安装、三种运行模式、四份配置文件的全字段表、内置工具速查、会话与上下文、
  权限与审批、官方插件安装、从零开发一个插件、整合到 Spring Boot、故障排查与 FAQ。
  **不讲内核实现细节，只讲可操作的东西。**
- **源码深度解析（`learning/`）**：Agent Loop 内核、多厂商 LLM 抽象、权限审批、工具系统与 IO、命令系统、配置体系、
  会话持久化与上下文、子代理、装配与 DI、可观测性、TUI / CLI / Server 三种外壳、13 个官方插件逐个拆解，
  外加坑点清单与同类工具对比。**每条结论都标注 `文件:行号` 出处。**

两套文档都带侧栏导航、页内搜索、代码复制、行号锚点与上下页翻页，各自首页给了一份推荐阅读顺序。

## 目录结构

```
Jellyfish-Docs/
├── guide/                       # 《Jellyfish 详细使用指南》
│   ├── index.html               #   首页：总览 + 页面地图 + 推荐学习顺序
│   ├── 01-overview.html         #   16 个内容页，文件名带两位编号
│   ├── …
│   └── assets/                  #   style.css + app.js
└── learning/                    # 《Jellyfish 源码深度解析》
    ├── index.html               #   首页
    ├── 01-overview.html         #   28 个内容页
    ├── …
    └── assets/
        ├── style.css
        ├── app.js
        └── vendor/              #   第三方前端库（不入版本库，见下）
```

两套文档各自带一份 `assets/`，互不依赖，可以单独拷走一套部署。

## 本地阅读

双击任意 `index.html` 即可——页面不请求任何后端接口，`file://` 下同样可用。想用 HTTP 打开：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000/guide/ 或 http://localhost:8000/learning/
```

## 第三方前端库不入版本库

`learning/assets/vendor/` 下的两个文件是别人编译好的 minified 构建产物（体积以 MB 计），已在 `.gitignore` 里排除：

| 文件 | 用途 | 缺失时 |
| --- | --- | --- |
| `highlight.min.js` | 代码高亮 | 自动回退 CDN |
| `mermaid.min.js` | 流程图渲染 | 自动回退 CDN；CDN 也不可达时图以源码文本展示，不会变成空白 |

想彻底离线，把这两个文件放进 `learning/assets/vendor/`（版本需与 `assets/app.js` 里的 CDN 兜底一致）。
`guide/` 不走本地 vendor，直接引 CDN——缺网时代码块仍有配色，只是图退化成源码文本。

## 文档的依据

两套文档整理自下列仓库（当前对应 **0.1.2**）：

| 仓库 | 在文档里的角色 |
| --- | --- |
| `Jellyfish` | 内核：三外壳、装配、扩展点与插件运行时、插件 SPI。`文件:行号` 的主要落点 |
| `Jellyfish-Plugins` | 官方插件与插件开发教程 |
| `Jellyfish-Spring-Boot-Starter` | 把内核接进已有的 Spring Boot 应用 |
| `Jellyfish-Spring-Template` | 集成示例模板（部分配置与门面用法取自它） |

写作约定：

- 每条结论都附 `文件:行号` 或 `文件:章节` 形式的出处，方便回仓库核对；
- 查不到出处的内容标 `【待确认】`，宁可标出来也不编造；
- 示例里的密钥、token、内网地址一律写成占位符（`sk-***`、`${OPENAI_API_KEY}`、`/path/to/…`）。

## 怎么改这套文档

工序（切页、页面骨架、引用摘录、核验口径）见 `Jellyfish-Skills` 仓库的 `source-deep-dive-docs` 技能，
正文在它的 `SKILL.md`，细节在 `references/02-doc-architecture.md` 与 `references/03-page-authoring.md`。

改完必须跑核验脚本——**脚本常驻技能目录，不复制进本仓库**（复制一份就会各自漂移）：

```bash
# 内部一致性：编号、侧栏、翻页、链接（改过页面就重跑）
python3 Jellyfish-Skills/source-deep-dive-docs/scripts/check-docs.py Jellyfish-Docs/learning
python3 Jellyfish-Skills/source-deep-dive-docs/scripts/check-docs.py Jellyfish-Docs/guide

# 引用是否条条落地：多仓库工作区必须显式给源码根，别依赖自动探测
sh Jellyfish-Skills/source-deep-dive-docs/scripts/verify-refs.sh \
   Jellyfish-Docs/learning Jellyfish Jellyfish-Plugins
sh Jellyfish-Skills/source-deep-dive-docs/scripts/verify-refs.sh \
   Jellyfish-Docs/guide Jellyfish Jellyfish-Plugins Jellyfish-Spring-Boot-Starter Jellyfish-Spring-Template
```

两点要知道：

- `cpPlugins.sh` 不在上面任何一个源码根里（它随聚合工作区放在各仓库之外），因此 `verify-refs.sh`
  会把它报成「缺文件」；要消掉这条，把它的所在目录也作为源码根传进去。
- 插入页面要连编号一起改，并同步各页侧栏与翻页——`check-docs.py` 会把这些不一致逐条报出来；
  批量改编号先读技能里的 `references/05-pitfalls.md`（旧号恰好是新号会互相碰撞）。

## 相关仓库

| 仓库 | 关系 |
| --- | --- |
| [Jellyfish](https://github.com/zcd0831/Jellyfish) | 内核，文档解析的对象 |
| [Jellyfish-Plugins](https://github.com/zcd0831/Jellyfish-Plugins) | 官方插件，插件开发的实例来源 |
| [Jellyfish-Spring-Boot-Starter](https://github.com/zcd0831/Jellyfish-Spring-Boot-Starter) | 集成方案 |
| [Jellyfish-Skills](https://github.com/zcd0831/Jellyfish-Skills) | 写这套文档所用的技能与核验脚本 |
