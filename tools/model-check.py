#!/usr/bin/env python3
"""模型 ↔ 代码 ↔ 文档站 对账脚本。

检查四件事，任一不一致即非零退出：
  1. 模型里声明的类/枚举在代码里都有对应文件；
  2. 枚举常量逐个一致；
  3. 文档声明的方法在代码里存在（未到切片的项列在 PENDING 里，只提示不报错）；
  4. docs/*.html 里的 mermaid 与 markdown 源码逐字一致。

用法：python3 tools/model-check.py [代码仓库路径]
默认代码仓库路径为 ../Jellyfish。
"""
import glob
import html as htmllib
import io
import os
import re
import sys

DOCS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(DOCS, "model")
HTML = os.path.join(MODEL, "docs")

PAGES = {
    "03-overview.html": "模型图.md",
    "04-perception.html": "模块-感知.md",
    "05-action.html": "模块-行动.md",
    "06-planning.html": "模块-规划.md",
    "07-memory.html": "模块-记忆.md",
    "08-application.html": "模块-应用层.md",
    "09-infrastructure.html": "模块-基础设施层.md",
}

# 尚未到对应切片的类/方法：出现时只提示，不算漂移
PENDING_CLASSES = {
    "ExperienceRetriever": "S4 经验检索",
    "ExperienceDistillationService": "S4 经验沉淀",
    "ExperienceFeedbackService": "S4 经验反馈",
    "RetrievalInput": "S4 经验检索入参",
    "DistillationInput": "S4 经验沉淀入参",
    "FeedbackInput": "S4 经验反馈入参",
    "StepTrace": "S4 沉淀轨迹",
}
PENDING = {
    "RuntimePolicy": ["adjust"],                      # S5 策略调整
    "StartSessionUseCase": ["startSubSession"],       # S3 子代理
    "BudgetService": ["settleFromSubSession"],        # S3 子会话结算
    "Experience": ["reinforce", "penalize", "archive", "mergeWith"],   # S4 经验闭环
    "SkillDefinition": ["updateSop", "renderDetailedSop"],             # S5 技能
    "InstructionTemplate": ["render"],                                 # S5 技能
}


def read(path):
    return io.open(path, encoding="utf-8").read()


def mermaid_blocks(text):
    return [b.strip() for b in re.findall(r"```mermaid(.*?)```", text, re.S)]


def classes_and_methods():
    classes, methods, enums = {}, {}, {}
    for path in glob.glob(os.path.join(MODEL, "*.md")):
        for block in mermaid_blocks(read(path)):
            for m in re.finditer(r"class\s+([A-Za-z0-9_]+)\s*\{((?:.|\n)*?)\n\s{0,12}\}", block):
                name, body = m.group(1), m.group(2)
                classes.setdefault(name, os.path.basename(path))
                for mm in re.finditer(r"^\s*\+([A-Za-z0-9_]+)\s*\(", body, re.M):
                    methods.setdefault(name, set()).add(mm.group(1))
                consts = set(re.findall(r"^\s*([A-Z][A-Z0-9_]*)\s*$", body, re.M))
                if consts:
                    enums[name] = consts
    return classes, methods, enums


def java_files(repo):
    found = {}
    for root, _, files in os.walk(repo):
        if os.sep + "target" + os.sep in root:
            continue
        for fn in files:
            if fn.endswith(".java"):
                found[fn[:-5]] = os.path.join(root, fn)
    return found


def enum_constants(source):
    body = source[source.index("{") + 1:source.rindex("}")]
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    body = re.sub(r"//[^\n]*", "", body)
    body = re.sub(r"\([^)]*\)", "", body)
    body = re.sub(r"@\w+", "", body)
    consts = set()
    for part in body.split(","):
        token = part.strip().split("\n")[0].strip()
        if re.fullmatch(r"[A-Z][A-Z0-9_]*", token):
            consts.add(token)
    return consts


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(DOCS), "Jellyfish")
    if not os.path.isdir(repo):
        print("找不到代码仓库：%s" % repo)
        return 2
    java = java_files(repo)
    classes, methods, enums = classes_and_methods()
    problems, notes = [], []

    for name, source_md in sorted(classes.items()):
        if name in java:
            continue
        if name in PENDING_CLASSES:
            notes.append("待实现（%s）：%s" % (PENDING_CLASSES[name], name))
        else:
            problems.append("模型类缺失：%s（%s）" % (name, source_md))

    for name, consts in sorted(enums.items()):
        if name not in java:
            continue
        code = enum_constants(read(java[name]))
        if code != consts:
            problems.append("枚举不一致：%s 文档缺=%s 代码缺=%s"
                            % (name, sorted(consts - code), sorted(code - consts)))

    for name, declared in sorted(methods.items()):
        if name not in java:
            continue
        src = read(java[name])
        for method in sorted(declared):
            if re.search(r"\b%s\s*\(" % re.escape(method), src):
                continue
            if method in PENDING.get(name, []):
                notes.append("待实现（切片未到）：%s.%s" % (name, method))
            else:
                problems.append("文档方法缺失：%s.%s（%s）" % (name, method, os.path.relpath(java[name], repo)))

    for page, md in sorted(PAGES.items()):
        html_path = os.path.join(HTML, page)
        md_blocks = mermaid_blocks(read(os.path.join(MODEL, md)))
        html_blocks = [htmllib.unescape(b).strip()
                       for b in re.findall(r'<pre class="mermaid">(.*?)</pre>', read(html_path), re.S)]
        if len(md_blocks) != len(html_blocks):
            problems.append("图数量不一致：%s md=%d html=%d" % (page, len(md_blocks), len(html_blocks)))
            continue
        for i, (a, b) in enumerate(zip(md_blocks, html_blocks)):
            if re.sub(r"\s+", " ", a) != re.sub(r"\s+", " ", b):
                problems.append("图不一致：%s 第 %d 个" % (page, i + 1))

    for note in notes:
        print("  · %s" % note)
    if problems:
        print("\n发现 %d 处漂移：" % len(problems))
        for p in problems:
            print("  ✗ %s" % p)
        return 1
    print("对账通过：模型 %d 类 / 枚举 %d 个 / HTML 图 %d 页全部一致" % (len(classes), len(enums), len(PAGES)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
