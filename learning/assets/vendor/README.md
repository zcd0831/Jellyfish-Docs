# assets/vendor — 第三方前端库（可选，用于完全离线阅读）

本目录存放两个外部依赖。**它们是可选的**：目录为空时文档照样能读，只是：

| 缺失的文件 | 后果 | 自动兜底 |
| --- | --- | --- |
| `highlight.min.js` | 代码块没有语法着色（仍是等宽、有行号、可复制） | `assets/app.js` 会尝试从 CDN 加载 |
| `mermaid.min.js` | 架构图 / 时序图**以源码文本形式展示**，并在页首给出提示条 | 同上 |

也就是说：**能联网时你不需要做任何事**；想完全离线（内网机器、断网、拷给同事），
把下面两个文件放进来即可。

## 一键获取

```bash
sh assets/vendor/fetch-vendor.sh
```

脚本会下载这两个文件到本目录，并检查是否为空。

## 手动获取

| 文件名（必须一致） | 来源 | 版本 | 约大小 |
| --- | --- | --- | --- |
| `highlight.min.js` | `https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js` | highlight.js 11.9.0 | 126 KB |
| `mermaid.min.js` | `https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js` | mermaid 10.9.1 | 2.9 MB |

版本要与上表一致（也和页面里 CDN 兜底用的版本一致），否则可能出现渲染差异。
浏览器也可以直接打开上面的 URL 另存为。

> **注意 `highlight.js` 与 `@highlightjs/cdn-assets` 是两个不同的 npm 包**：
> 前者的 `lib/*.js` 是给打包器用的 **CommonJS** 模块（内部 `require("./core")`），
> 直接丢进浏览器会报 `require is not defined`；只有后者的 `highlight.min.js`
> 是预构建的浏览器 bundle。这一点踩过坑，见仓库提交记录。

## 为什么不是「真正内联」

代码高亮的**样式表**（原本也是 CDN 的 `github-dark.min.css`）已经内联进
`assets/style.css`，那一部分不依赖本目录。

但两个 **JS 库**没有内联进页面：

- `mermaid.min.js` 约 2.9 MB，塞进 15 个 HTML 会让每个文件膨胀到 3 MB 以上，
  打开变慢、diff 不可读；
- 两者都是有版本的第三方构建产物，放进同一目录便于**独立升级**，
  也避免把别人的代码混进文档正文里。

所以采用「本地优先 + CDN 兜底 + 缺失即降级」三档，任何一档都能读。
