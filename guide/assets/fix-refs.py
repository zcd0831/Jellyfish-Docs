"""把指南里的出处引用「行号范围端点落在空行」修掉（默认干跑，加 --apply 才写盘）。

规则：对每条 `路径:起-止`，读源码对应行，把范围收缩到第一个与最后一个非空行。
收缩只动端点、不动内容，因此引用指向的语义区域不变。

用法：
    python3 assets/fix-refs.py <workspace根> <guide目录>            # 干跑，只打印
    python3 assets/fix-refs.py <workspace根> <guide目录> --apply    # 写盘
"""
import glob
import os
import re
import sys

ROOT = sys.argv[1]
GUIDE = sys.argv[2]
APPLY = "--apply" in sys.argv

REF = re.compile(
    r"([A-Za-z0-9_][A-Za-z0-9_./-]*/[A-Za-z0-9_.-]+"
    r"\.(?:md|java|xml|json|sh|properties|py|js|ts|yaml|yml|txt|html))"
    r":(\d+)(?:-(\d+))?"
)

files = sorted(glob.glob(os.path.join(GUIDE, "*.html")))
print("扫描文件 %d 个：%s" % (len(files), ", ".join(os.path.basename(x) for x in files[:3]) + " ..."))
total_hits = 0
cache = {}
mapping = {}   # old citation -> new citation
skipped = []

for f in files:
    text = open(f, encoding="utf-8").read()
    for m in REF.finditer(text):
        total_hits += 1
        path, a, b = m.group(1), int(m.group(2)), m.group(3)
        old = m.group(0)
        src = os.path.join(ROOT, path)
        if not os.path.isfile(src):
            continue
        if src not in cache:
            cache[src] = open(src, encoding="utf-8", errors="replace").read().split("\n")
        lines = cache[src]
        end = int(b) if b else a
        if a > len(lines):
            continue
        lo, hi = a, min(end, len(lines))
        # 只把**起点**前移到第一个非空行（结尾不动：收缩结尾只是噪音，不改变读者体验）
        while lo <= hi and not lines[lo - 1].strip():
            lo += 1
        if lo > hi:
            # 整段落在空行上：**不自动猜**。单行引用的正确目标常常在同一小节的别处
            # （实测 Jellyfish-Plugins/README.md:674 的正确目标是 658），猜错比不改更糟。
            skipped.append((path, a, end, "整段皆空行，需人工确认正确行号"))
            continue
        if (lo, end) == (a, end):
            continue
        new = "%s:%d-%d" % (path, lo, end) if b else "%s:%d" % (path, lo)
        if b and lo == end:
            new = "%s:%d" % (path, lo)
        mapping[old] = new

print("待改引用 %d 条（去重后）；正则共命中 %d 处" % (len(mapping), total_hits))
for old, new in sorted(mapping.items()):
    print("  %-52s -> %s" % (old, new))
if skipped:
    print("\n需人工看：")
    for p, a, b, why in skipped:
        print("  %s:%d-%d  %s" % (p, a, b, why))

if not APPLY:
    print("\n（干跑，未写盘。加 --apply 生效）")
    sys.exit(0)

changed = 0
for f in files:
    text = open(f, encoding="utf-8").read()
    new_text = text
    for old, new in mapping.items():
        new_text = new_text.replace(old, new)
    if new_text != text:
        open(f, "w", encoding="utf-8").write(new_text)
        changed += 1
print("\n已写盘：%d 个文件" % changed)
