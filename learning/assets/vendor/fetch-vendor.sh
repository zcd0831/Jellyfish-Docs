#!/bin/sh
# ============================================================================
# 下载本套文档需要的两个第三方前端库到本目录，之后就能**完全离线**阅读。
#
# 用法：
#     sh assets/vendor/fetch-vendor.sh
# 或在目录内：
#     chmod +x fetch-vendor.sh && ./fetch-vendor.sh
#
# 下载内容（版本与页面里 CDN 兜底用的版本保持一致）：
#     highlight.min.js   highlight.js 11.9.0  @highlightjs/cdn-assets 的浏览器 bundle（代码语法高亮）
#     mermaid.min.js     mermaid      10.9.1  dist/mermaid.min.js （架构图 / 时序图渲染）
#
# 说明：这两个文件缺失时文档**依然可读**（代码不着色、图表以源码形式展示），
#       assets/app.js 会自动回退到 CDN；放好文件后回退逻辑不再触发。
# ============================================================================
set -e

DIR=$(cd "$(dirname "$0")" && pwd)

fetch() {
    url="$1"
    out="$2"
    printf '下载 %-20s ← %s\n' "$out" "$url"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$DIR/$out"
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$url" -O "$DIR/$out"
    else
        printf '错误：既没有 curl 也没有 wget，请手动下载：\n  %s\n' "$url" >&2
        exit 1
    fi

    if [ ! -s "$DIR/$out" ]; then
        printf '错误：%s 下载后为空，请检查网络或代理。\n' "$out" >&2
        exit 1
    fi
}

fetch "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js" "highlight.min.js"
fetch "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"   "mermaid.min.js"

printf '\n完成。当前目录内容：\n'
ls -l "$DIR"

printf '\n提示：mermaid.min.js 约 2.9 MB、highlight.min.js 约 130 KB。\n'
printf '      若文件大小明显偏小（KB 级别），多半是下载到了一个错误页而不是脚本。\n'
