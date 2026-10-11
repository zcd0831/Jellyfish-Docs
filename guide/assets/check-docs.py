"""Jellyfish 使用指南 —— 结构自检脚本（HTML 层面）。

与 Jellyfish-Docs/learning/assets/verify-refs.sh 互补：那个查「文件:行号 引用能不能落地」，
这个查「HTML 本身有没有病」。检查五件事：

1. 标签闭合是否平衡（报行号 + 附近上下文）；
2. 被标了 field-table、表头却不是 6 列的表（说明这个类用错了）；
3. style.css 里 .prev / .next / .disabled 是否都在；
4. 代码块（<pre><code>）内未转义的裸标签与裸 & —— **这条最值钱**：
   写在 <pre> 里的 `<p>` / `<b>` 会被浏览器当标签解析，直接破坏代码块的显示，
   而普通的「标签清单」式检查发现不了（它们都是合法 HTML 标签名）；
5. 每页六类必备区块与唯一资源引用是否齐备。

用法：
    python3 assets/check-docs.py            # 在 guide 目录下执行
    python3 assets/check-docs.py <目录>

实现上的两个坑（改这个脚本前先看）：
  * 隐式结束标签的方向别写反：正确规则是「**开启块级元素时，若栈顶是 <p> 就先弹出它**」，
    而不是「开启 <p> 时弹出块级元素」。写反的后果是每个 <p> 都把它外面的 <div> 弹掉，
    于是全站都会被误报成「多余的 </div>」。
  * 行号必须按**原文**数：删注释 / 删 script 时要保留等量换行（用 blank_keep_lines），
    否则报出来的行号会整体前移，定位全靠猜。

已知局限：不校验 CSS 观感、不校验 Mermaid 能否被 mermaid.js 渲染（那要真跑一遍浏览器）。
"""
import glob
import os
import re
import sys

GUIDE = sys.argv[1] if len(sys.argv) > 1 else "."
os.chdir(GUIDE)

VOID = {"br", "hr", "img", "input", "meta", "link", "source", "col",
        "area", "base", "wbr", "embed", "track", "param"}
BLOCK = {"div", "table", "thead", "tbody", "tr", "td", "th", "ul", "ol",
         "li", "dl", "dt", "dd", "pre", "p", "h1", "h2", "h3", "h4",
         "nav", "main", "section", "footer", "header", "blockquote", "figure"}
# 隐式闭合规则（别写反）：**开启块级元素时，若栈顶是 <p> 就先弹出它**；
# 列表项之间同理（<li> 关闭前一个 <li>，<dt>/<dd> 互相关闭）。
AUTO_CLOSE_ON_BLOCK = {"p"}
LIKE = {"li": {"li"}, "dt": {"dt", "dd"}, "dd": {"dt", "dd"}}


def blank_keep_lines(m):
    """把匹配到的内容换成等量的空行，保证行号与原文一致（否则删注释会吃掉换行）。"""
    return "\n" * m.group(0).count("\n")


def strip_for_parse(s):
    s = re.sub(r"<!--.*?-->", blank_keep_lines, s, flags=re.S)
    return re.sub(r"<(script|style)\b.*?</\1>", blank_keep_lines, s, flags=re.S | re.I)


def check(f):
    s = open(f, encoding="utf-8").read()
    body = strip_for_parse(s)
    stack, errs = [], []
    for m in re.finditer(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(/?)>", body):
        close, name, selfclose = m.group(1), m.group(2).lower(), m.group(4)
        line = body[:m.start()].count("\n") + 1
        if name in VOID or selfclose:
            continue
        if not close:
            if name in BLOCK:
                while stack and stack[-1][0] in AUTO_CLOSE_ON_BLOCK:
                    stack.pop()
            if name in LIKE:
                while stack and stack[-1][0] in LIKE[name]:
                    stack.pop()
            stack.append((name, line))
        else:
            if stack and stack[-1][0] == name:
                stack.pop()
            elif any(t[0] == name for t in stack):
                errs.append((line, "关闭 </%s> 时，栈顶是 <%s>（第 %d 行开）"
                             % (name, stack[-1][0], stack[-1][1])))
                while stack and stack[-1][0] != name:
                    stack.pop()
                if stack:
                    stack.pop()
            else:
                errs.append((line, "多余的 </%s>" % name))
    for t, ln in stack:
        errs.append((ln, "未闭合 <%s>（第 %d 行开）" % (t, ln)))
    return errs, s


print("=" * 74)
print("1) 标签闭合（含隐式结束标签处理，报行号）")
print("=" * 74)
bad = 0
for f in sorted(glob.glob("*.html")):
    errs, s = check(f)
    if errs:
        bad += 1
        print("\n--- %s ---" % f)
        for ln, msg in sorted(set(errs))[:12]:
            print("  行 %-5d %s" % (ln, msg))
            src = s.split("\n")[ln - 1].strip()
            print("           %s" % (src[:110]))
print("\n-> 结构异常文件数：%d" % bad)

print()
print("=" * 74)
print("2) 被标了 field-table、表头却不是 6 列的表")
print("=" * 74)
n = 0
for f in sorted(glob.glob("*.html")):
    s = open(f, encoding="utf-8").read()
    for m in re.finditer(r'class="table-scroll field-table">(.*?)</table>', s, re.S):
        head = re.search(r"<thead>.*?<tr>(.*?)</tr>", m.group(1), re.S)
        cols = len(re.findall(r"<th\b", head.group(1))) if head else 0
        if cols != 6:
            n += 1
            line = s[:m.start()].count("\n") + 1
            titles = re.findall(r"<th[^>]*>(.*?)</th>", head.group(1), re.S) if head else []
            titles = [re.sub(r"<[^>]+>", "", t).strip() for t in titles]
            print("%s:%d  %d 列：%s" % (f, line, cols, " | ".join(titles)))
print("-> 共 %d 处" % n)

print()
print("=" * 74)
print("3) style.css 里是否存在 .prev")
print("=" * 74)
css = open("assets/style.css", encoding="utf-8").read()
for sel in [r"\.pager a\.prev", r"\.pager a\.next", r"\.pager a\.disabled", r"\.prev\b"]:
    print("  %-24s %s" % (sel, "有" if re.search(sel, css) else "无"))

print()
print("=" * 74)
print("4) 代码块内未转义的裸标签（会真的被浏览器当标签解析）")
print("=" * 74)
KNOWN = BLOCK | {"span", "a", "code", "em", "b", "i", "strong", "br", "img",
                 "button", "input", "link", "script", "style", "meta",
                 "title", "html", "head", "body", "table", "thead", "tbody",
                 "tr", "td", "th", "footer", "header", "small", "sub", "sup", "kbd"}
n = 0
for f in sorted(glob.glob("*.html")):
    s = open(f, encoding="utf-8").read()
    for m in re.finditer(r"<pre><code[^>]*>(.*?)</code></pre>", s, re.S):
        inner = m.group(1)
        startline = s[:m.start()].count("\n") + 1
        for t in re.finditer(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>", inner):
            name = t.group(2).lower()
            if name in KNOWN:
                n += 1
                ln = startline + inner[:t.start()].count("\n")
                snippet = inner.split("\n")[inner[:t.start()].count("\n")].strip()[:90]
                print("%s:%d  裸 <%s%s>  %s" % (f, ln, t.group(1), name, snippet))
        # 裸 & 也会出问题（非实体）
        for t in re.finditer(r"&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)", inner):
            n += 1
            ln = startline + inner[:t.start()].count("\n")
            snippet = inner.split("\n")[inner[:t.start()].count("\n")].strip()[:90]
            print("%s:%d  裸 &  %s" % (f, ln, snippet))
print("-> 共 %d 处" % n)

print()
print("=" * 74)
print("5) 每页必备区块与唯一资源引用")
print("=" * 74)
need = {
    "goals": 'class="goals"',
    "conclusion": 'class="conclusion"',
    "next-steps": 'class="next-steps"',
    "pager": 'class="pager"',
    "breadcrumb": 'class="breadcrumb"',
    "app.js": 'assets/app.js',
}
miss_total = 0
for f in sorted(glob.glob("*.html")):
    s = open(f, encoding="utf-8").read()
    miss = [k for k, v in need.items() if v not in s]
    if miss:
        miss_total += 1
        print("%-24s 缺: %s" % (f, ", ".join(miss)))
    # 不该再出现本地 vendor 引用（本套文档走 CDN 兜底）
    if "assets/vendor" in s:
        miss_total += 1
        print("%-24s 出现了 assets/vendor 引用（本套文档不依赖本地 vendor）" % f)
print("-> 有问题文件数：%d" % miss_total)
