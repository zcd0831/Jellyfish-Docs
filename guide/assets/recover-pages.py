"""从 Jellyfish 的 subagent-run 归档恢复被整页覆盖的文档。

**这个脚本的来历值得记住**：本套指南有 17 页、每页几千行，交给多个子代理并行撰写时，
只要有一个代理手上只有「整页覆盖」的写入工具，一次误写就能让一整页内容消失。
二零二五年那一轮就发生过：三个页面（`06-models.html`、`11-plugin-usage.html`、
`14-spring-boot.html`）被覆盖成 5~1.6 KB 的占位内容，而它们**没有入库**（`git` 里是未跟踪状态），
`git restore` 救不了。

**为什么还能救回来**：子代理写入整页用的是 write_file，它的参数
`{"content": "<!DOCTYPE html>…", "path": "…"}` 会被 Jellyfish 完整记进 run 归档
（`~/.jellyfish/tool-outputs/subagent-runs/*.json`）。本脚本把那些载荷捞出来。
实测三个文件都恢复到了**与事故前字节数完全一致**。

用法：
    python3 assets/recover-pages.py                    # 干跑：列出每个页面能捞到哪几份载荷
    python3 assets/recover-pages.py --apply            # 把最长/最后一次的那份写回
    python3 assets/recover-pages.py --apply 14-spring-boot.html

判断「哪一份是最终版」的规则：**取该文件消息序号最大的那次写入**（同一归档内按
`session.messages` 的下标排序）。实测这比「取最长的」可靠——`14-spring-boot.html` 一页内
写过两次，后写的那次字符更少但字节更多，「取最长」会挑错。

⚠ 恢复出来的内容是**某个历史时刻**的版本：如果那之后还有过小改动（例如引用行号修正），
它们不在归档里，恢复后需要重跑 `fix-refs.py` 与 `check-docs.py` 补齐并复测。
"""
import glob
import json
import os
import sys

GUIDE = "Jellyfish-Docs/guide"
RUNS = os.path.expanduser("~/.jellyfish/tool-outputs/subagent-runs")
APPLY = "--apply" in sys.argv
ONLY = [a for a in sys.argv[1:] if a.endswith(".html")]

if not os.path.isdir(RUNS):
    print("找不到 run 归档目录：%s" % RUNS)
    sys.exit(2)


def looks_like_page(content):
    """只认「首尾完整」的整页载荷，占位内容与片段一律排除。"""
    return "<!DOCTYPE html>" in content and "</html>" in content.rstrip()[-40:]


def harvest(args_str, order, short, cands):
    if len(args_str) < 5000 or GUIDE not in args_str or '"content"' not in args_str:
        return
    try:
        args = json.loads(args_str)
    except Exception:
        return
    if not isinstance(args, dict):
        return
    path, content = args.get("path"), args.get("content")
    if not isinstance(path, str) or not isinstance(content, str):
        return
    if not path.endswith(".html") or not looks_like_page(content):
        return
    name = os.path.basename(path)
    cands.setdefault(name, []).append((order, content, short))


cands = {}
for f in sorted(glob.glob(os.path.join(RUNS, "*.json"))):
    try:
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        continue
    short = os.path.basename(f)
    msgs = None
    if isinstance(data, dict) and isinstance(data.get("session"), dict):
        if isinstance(data["session"].get("messages"), list):
            msgs = data["session"]["messages"]
    if msgs is not None:
        for i, msg in enumerate(msgs):
            if not isinstance(msg, dict):
                continue
            for tc in (msg.get("toolCalls") or []):
                if isinstance(tc, dict) and isinstance(tc.get("arguments"), str):
                    harvest(tc["arguments"], i, short, cands)
    else:
        stack, order = [data], 0
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                stack.extend(node.values())
            elif isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, str):
                harvest(node, order, short, cands)

targets = sorted(cands) if not ONLY else [n for n in ONLY if n in cands]
if not targets:
    print("归档里没有任何完整的整页载荷可恢复。")
    sys.exit(0)

for name in targets:
    hits = cands[name]
    cur = os.path.getsize(name) if os.path.exists(name) else -1
    print("=== %s（当前 %d 字节） ===" % (name, cur))
    for order, content, src in sorted(hits, key=lambda t: -t[0])[:5]:
        print("  %-46s 消息#%-5d 字节=%-7d" % (src, order, len(content.encode("utf-8"))))
    if cur > 20000:
        print("  当前文件已有内容（>20KB），**默认跳过**，避免用旧版本盖掉新内容")
        print()
        continue
    order, content, src = max(hits, key=lambda t: t[0])
    print("  → 选用最后一次写入（消息#%d，%d 字节）" % (order, len(content.encode("utf-8"))))
    if APPLY:
        with open(name, "w", encoding="utf-8") as out:
            out.write(content)
        print("    已写回 %s" % name)
    print()

if not APPLY:
    print("（干跑，未写盘。确认无误后加 --apply）")
