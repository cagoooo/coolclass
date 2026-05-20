#!/usr/bin/env bash
# 阿凱老師的教室小幫手｜自動升版腳本
#
# 用法：
#   ./bump-version.sh                       # 用 git short hash + 時間戳
#   ./bump-version.sh "修正抽卡跳回卡背"     # 帶上 release notes
#
# 做的事：
#   1. 產生版本號：YYYYMMDD-HHMM-shortHash
#   2. 替換 sw.js 內的 BUILD_VERSION 占位字串
#   3. 寫入 version.json（給前端 polling 用）
#   4. 提示你 commit + push
#
# 這個檔不會自動 commit/push — 讓你 review 完再決定。

set -e

cd "$(dirname "$0")"

# 版本號
TIMESTAMP=$(date +%Y%m%d-%H%M)
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  SHORT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
else
  SHORT_HASH="local"
fi
VERSION="${TIMESTAMP}-${SHORT_HASH}"

NOTES="${1:-自動升版}"

echo "──────────────────────────────────"
echo "🚀 升版到 ${VERSION}"
echo "📝 備註：${NOTES}"
echo "──────────────────────────────────"

# 替換 sw.js
if [ ! -f sw.js ]; then
  echo "❌ 找不到 sw.js"
  exit 1
fi

# 跨平台 sed (macOS BSD vs Linux GNU vs Git Bash on Windows)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|const BUILD_VERSION = \"[^\"]*\";|const BUILD_VERSION = \"${VERSION}\";|" sw.js
else
  sed -i "s|const BUILD_VERSION = \"[^\"]*\";|const BUILD_VERSION = \"${VERSION}\";|" sw.js
fi
echo "✓ sw.js 內 BUILD_VERSION 已更新"

# 寫 version.json
BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > version.json <<EOF
{
  "version": "${VERSION}",
  "builtAt": "${BUILT_AT}",
  "notes": "${NOTES}"
}
EOF
echo "✓ version.json 已寫入"

# 確認
echo ""
echo "──────────────────────────────────"
echo "✅ 完成！下一步："
echo "   git add -A && git commit -m \"v${VERSION}: ${NOTES}\" && git push"
echo "──────────────────────────────────"
