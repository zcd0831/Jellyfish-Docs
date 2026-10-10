#!/bin/sh
# ============================================================================
# verify-refs.sh —— 文档「文件:行号」引用自检
#
# 作用：把 *.html 里所有 `Xxx.java:123` / `path/pom.xml:54-56` 形式的引用抽出来，
#       逐个落到源码上，报出「缺文件 / 越界 / 可疑」三类问题。
#
# 用法：
#   sh assets/verify-refs.sh                          # 自动定位文档目录与源码根
#   sh assets/verify-refs.sh -v                       # 额外列出「引用注释/注解行」的条目
#   sh assets/verify-refs.sh <文档目录> <源码根目录>     # 显式指定
#   sh assets/verify-refs.sh -h                       # 帮助
#
# 关于「可疑」：文档经常**故意**引 javadoc 注释原文（例如引 bootstrap() 的行内注释），
# 所以「首行是注释/注解」不算问题，默认只汇总数量；只有「首行为空行」「首行是纯括号」
# 才说明行号可能偏了。前者要看得加 -v。
#
# 为什么支持位置参数：某些受限终端不允许 `VAR=value cmd` 这种写法，
# 会被判为非法命令；所以源码根既可用第 2 个参数给，也可用 SRC_ROOT 环境变量给。
#
# 退出码：0 = 无越界/缺文件；1 = 有；2 = 环境问题（找不到文档或源码根）
#
# 两条硬性实现约束（都踩过坑，别改）：
#   1. 所有变量展开一律写成 ${var}。变量名后紧跟中日韩字符或全角标点时，
#      某些 shell 在非 UTF-8 locale 下会把多字节字符的首字节吃进变量名，
#      配合 set -u 直接报 "unbound variable" 并中止。
#   2. 只用 find 与 grep（+ sh 内建）。不依赖 awk/sed/sort/uniq/wc/mktemp/cut/tr/dirname/basename，
#      因为受限环境里它们可能不可用。
#
# 已知限制：只校验「带文件名」的引用。形如 <code>:645</code> 的简写
# （依赖上文提到的文件名）无法自动校验，脚本会报出这类引用的数量。
# ============================================================================
set -u

# ---- 0. 参数 --------------------------------------------------------------
VERBOSE=0
while [ $# -gt 0 ]; do
    case "${1}" in
        -h|--help)
            echo "用法: sh ${0} [-v] [文档目录] [源码根目录]"
            echo "  不给参数时：文档目录 = 本脚本所在目录的上一级；源码根自动向上搜索。"
            echo "  -v 额外列出「引用注释/注解行」的条目（默认只汇总数量）。"
            echo "  也可以设环境变量 SRC_ROOT 指定源码根。"
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=1
            shift
            ;;
        *)
            break
            ;;
    esac
done

# ---- 1. 文档目录：按「脚本自身位置」解析 -----------------------------------
# 不用当前目录：否则从仓库根运行时，候选路径会全部从仓库根算起而落空。
case "${0}" in
    */*) SCRIPT_DIR=${0%/*} ;;
    *)   SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}" && pwd) || exit 2

DOC_DIR=${1:-$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)}
if [ ! -f "${DOC_DIR}/index.html" ]; then
    echo "找不到文档目录：${DOC_DIR} 下没有 index.html" >&2
    echo "提示：把文档目录作为第 1 个参数传进来。" >&2
    exit 2
fi

# ---- 2. 源码根 / 工作区根 -------------------------------------------------
# 工作区根 = 同时容纳内核仓库 Jellyfish/ 与官方插件仓库 Jellyfish-Plugins/ 的那一层。
# 索引必须建在工作区根上，否则文档里对插件仓库的引用会被误报成「缺文件」。
SRC_ROOT=${2:-${SRC_ROOT:-}}
TRIED=""

if [ -n "${SRC_ROOT}" ] && [ -d "${SRC_ROOT}" ]; then
    SRC_ROOT=$(CDPATH= cd -- "${SRC_ROOT}" && pwd)
else
    SRC_ROOT=""
fi

# 自动搜索：既接受「工作区根」，也接受「内核仓库根」
for cand in \
    "${SRC_ROOT}" \
    "${DOC_DIR}/../.." \
    "${DOC_DIR}/.." \
    "${DOC_DIR}/../../.." ; do
    [ -z "${cand}" ] && continue
    TRIED="${TRIED}
    ${cand}"
    if [ -d "${cand}/Jellyfish/jellyfish-core/src/main/java" ]; then
        SRC_ROOT=${cand}
        break
    fi
    if [ -d "${cand}/jellyfish-core/src/main/java" ]; then
        SRC_ROOT=${cand}
        break
    fi
done

if [ -z "${SRC_ROOT}" ] || [ ! -d "${SRC_ROOT}" ]; then
    echo "找不到源码根目录。已尝试：${TRIED}" >&2
    echo "" >&2
    echo "请显式指定（注意本机可能不允许 VAR=值 前缀写法）：" >&2
    echo "    sh ${0} <文档目录> <源码根目录>" >&2
    echo "例如：" >&2
    echo "    sh ${0} Jellyfish-Docs/learning .    # 源码根 = 当前目录" >&2
    exit 2
fi
SRC_ROOT=$(CDPATH= cd -- "${SRC_ROOT}" && pwd)

# 归一化：若给的是内核仓库根，工作区根就是它的上一级
if [ -d "${SRC_ROOT}/Jellyfish/jellyfish-core/src/main/java" ]; then
    WS_ROOT=${SRC_ROOT}
    SRC_ROOT=${SRC_ROOT}/Jellyfish
elif [ -d "${SRC_ROOT}/jellyfish-core/src/main/java" ]; then
    WS_ROOT=${SRC_ROOT%/*}
else
    echo "源码根不像 Jellyfish 仓库：${SRC_ROOT}" >&2
    exit 2
fi

echo "文档目录  ${DOC_DIR}"
echo "工作区根  ${WS_ROOT}"
echo "内核仓库  ${SRC_ROOT}"
echo ""

TMP_BASE=${TMPDIR:-/tmp}
TMP_ALL="${TMP_BASE}/.verify-refs.$$"
# 三个临时文件一次清干净（第一版只删了一个，于是留下了 .refs/.seen 残渣）
trap 'rm -f "${TMP_ALL}" "${TMP_ALL}.refs" "${TMP_ALL}.seen"' 0 1 2 3 15

# ---- 3. 建一次文件名索引 ---------------------------------------------------
# 索引整个工作区（含插件仓库）：文档里既有内核引用，也有插件与文档自身的引用。
# 排除 .git 与 target，避免把构建产物里的同名文件也算进来。
find "${WS_ROOT}" \
     \( -name .git -o -name target -o -name node_modules \) -prune -o \
     \( -name '*.java' -o -name '*.md' -o -name '*.xml' -o -name '*.json' -o -name '*.sh' \) -print \
    > "${TMP_ALL}" 2>/dev/null

echo "索引文件数 $(grep -c "" "${TMP_ALL}")"
echo ""

# ---- 4. 抽出引用并逐条校验 -------------------------------------------------
REF_PATTERN='[A-Za-z0-9_$./-]+\.(java|md|xml|json|sh):[0-9]+(-[0-9]+)?'

grep -rhoE "${REF_PATTERN}" "${DOC_DIR}"/*.html 2>/dev/null > "${TMP_ALL}.refs"
: > "${TMP_ALL}.seen"

total=0
located=0
missing=0
out_of_range=0
suspicious_other=0
suspicious_comment=0
ambiguous=0
printable=""

while IFS= read -r ref; do
    [ -z "${ref}" ] && continue

    # 去重：同一引用在多页出现只校验一次
    if grep -qFx "${ref}" "${TMP_ALL}.seen" 2>/dev/null; then
        continue
    fi
    echo "${ref}" >> "${TMP_ALL}.seen"

    total=$((total + 1))

    name=${ref%:*}
    spec=${ref##*:}
    start=${spec%%-*}
    end=${spec##*-}

    # ---- 4.1 定位文件：内核仓库优先，其次工作区，最后按路径后缀匹配 ----------
    path=""
    if [ -f "${SRC_ROOT}/${name}" ]; then
        path="${SRC_ROOT}/${name}"
    elif [ -f "${WS_ROOT}/${name}" ]; then
        path="${WS_ROOT}/${name}"
    else
        # 按路径后缀匹配。同名文件很多（PluginConfig.java 有 6 个、pom.xml 有十余个），
        # 多候选时静默取第一个会校验到「别的那个文件」上——于是报出假的空行/越界。
        # 这种情况如实报「歧义」，并提示把路径写到能唯一确定的一层。
        hits=$(grep -c "/${name}\$" "${TMP_ALL}" 2>/dev/null)
        [ -z "${hits}" ] && hits=0
        if [ "${hits}" -gt 1 ]; then
            ambiguous=$((ambiguous + 1))
            printable="${printable}
歧义     ${ref}  （${hits} 个同名文件；请把路径补到能唯一确定的一层）"
            continue
        fi
        path=$(grep -m1 "/${name}\$" "${TMP_ALL}" 2>/dev/null)
    fi

    if [ -z "${path}" ] || [ ! -f "${path}" ]; then
        missing=$((missing + 1))
        printable="${printable}
缺文件   ${ref}"
        continue
    fi

    located=$((located + 1))

    # ---- 4.2 行数：grep -c "" 数行 -----------------------------------------
    lines=$(grep -c "" "${path}" 2>/dev/null)
    [ -z "${lines}" ] && lines=0

    if [ "${start}" -gt "${lines}" ] 2>/dev/null; then
        out_of_range=$((out_of_range + 1))
        printable="${printable}
越界     ${ref}  （文件仅 ${lines} 行）"
        continue
    fi
    if [ "${end}" -gt "${lines}" ] 2>/dev/null; then
        out_of_range=$((out_of_range + 1))
        printable="${printable}
越界     ${ref}  （区间末端 ${end} > 文件 ${lines} 行）"
        continue
    fi

    # ---- 4.3 取第 start 行内容：grep -n "" 编号后筛 -------------------------
    numbered=$(grep -n "" "${path}" 2>/dev/null | grep -m1 "^${start}:" 2>/dev/null)
    text=${numbered#*:}

    # ---- 4.4 可疑判定 ------------------------------------------------------
    reason=""
    if echo "${text}" | grep -qE '^[[:space:]]*$'; then
        reason="首行为空行"
    else
        case "${name}" in
            *.java)
                if echo "${text}" | grep -qE '^[[:space:]]*(//|/\*|\*)'; then
                    reason="首行是注释行（引用注释时可忽略）"
                elif echo "${text}" | grep -qE '^[[:space:]]*(@|import[[:space:]]|package[[:space:]])'; then
                    reason="首行是注解或 import/package"
                elif echo "${text}" | grep -qE '^[[:space:]]*(\}|\);?|\{)[[:space:]]*$'; then
                    reason="首行是纯括号"
                fi
                ;;
            *.xml)
                if echo "${text}" | grep -qE '^[[:space:]]*(<!--|-->)'; then
                    reason="首行是 XML 注释"
                fi
                ;;
        esac
    fi

    if [ -n "${reason}" ]; then
        case "${reason}" in
            首行是注释行*|首行是注解*|首行是\ XML\ 注释)
                # 引注释/注解是常见且有意的写法，默认只计数
                suspicious_comment=$((suspicious_comment + 1))
                if [ "${VERBOSE}" = "1" ]; then
                    printable="${printable}
注释引用 ${ref}  （${reason}）"
                fi
                ;;
            *)
                suspicious_other=$((suspicious_other + 1))
                printable="${printable}
可疑     ${ref}  （${reason}）"
                ;;
        esac
    fi
done < "${TMP_ALL}.refs"

# 简写引用数量（形如 <code>:645</code>，没有文件名，无法自动校验）
shorthand=$(grep -rhoE '<code>:[0-9]+' "${DOC_DIR}"/*.html 2>/dev/null | grep -c "")

# ---- 5. 输出与汇总 --------------------------------------------------------
if [ -n "${printable}" ]; then
    echo "${printable}" | grep -v '^$'
    echo ""
fi

echo "─────────────────────────────────────────────"
echo "带文件名的引用  ${total}（已定位 ${located}）"
echo "缺文件          ${missing}"
echo "越界            ${out_of_range}"
echo "可疑            ${suspicious_other}（首行为空行或纯括号，说明行号可能偏了）"
echo "歧义            ${ambiguous}（同名文件有多个候选，本脚本无法判定；不算错误，但建议补路径）"
echo "引用注释/注解行  ${suspicious_comment}（属预期；加 -v 可列出）"
echo "另有「只有行号」的简写引用 ${shorthand} 处，本脚本无法自动校验"
echo "  （形如 <code>:645</code>，依赖上文提到的文件名；要校验得先改写成带文件名的形式）"

if [ "${out_of_range}" -gt 0 ] || [ "${missing}" -gt 0 ]; then
    echo ""
    echo "结论：存在越界或缺文件，必须修。"
    exit 1
fi

echo ""
echo "结论：无越界、无缺文件。"
if [ "${suspicious_other}" -gt 0 ]; then
    echo "      上面的「可疑」建议逐条确认是否行号偏了。"
fi
exit 0
