#!/usr/bin/env bash
# 把 Gomoku Rush 部署到 Cloudflare Pages（https://rush.hangsau.app）。
# 只上傳「已 commit 且已推上 GitHub」的檔案（git archive HEAD），跟 GitHub Pages 內容一致；
# 不上傳說明文件、docs、Worker 原始碼。根網址 / 就是遊戲（index.html＝game.html 的複本），
# 分析器不上傳；game.html、score.html 照舊可開（Pages 會把 .html 轉成無副檔名網址）。
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT=gomoku-rush
SITE=https://rush.hangsau.app

git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "✘ 本機 HEAD 跟 GitHub 的 main 不一樣，先 push／pull 再部署"; exit 1; }

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT" .wrangler' EXIT  # .wrangler 是 wrangler 自己留的快取，不留在 repo 裡
# autocrlf=false：上傳跟 GitHub 上一模一樣的位元組（Windows 預設會轉成 CRLF）
git -c core.autocrlf=false archive HEAD | tar -x -C "$OUT"
rm -rf "$OUT/docs" "$OUT/game/worker" "$OUT/tools"
find "$OUT" -maxdepth 1 -name '*.md' -delete
cp "$OUT/game.html" "$OUT/index.html"  # 原 index.html（分析器）使用者 2026-11-07 說不用了，不上傳
# /analyzer 曾經上線過，Pages 自己的快取會繼續回舊分析器（s-maxage 7 天，清網域快取也清不掉，2026-11-08 踩過），所以明確轉回首頁
printf '/analyzer / 301
/analyzer.html / 301
/analyzer/* / 301
' > "$OUT/_redirects"

npx --yes wrangler@4.158.0 pages deploy "$OUT" --project-name "$PROJECT" --branch main --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s | cut -c1-80)"

# 確認線上換成這一版的 game.html
want="$(git show HEAD:game.html | sha256sum | cut -c1-16)"
for i in 1 2 3 4 5 6; do
  got="$(curl -sL "$SITE/?nocache=$RANDOM" | sha256sum | cut -c1-16)"
  [ "$got" = "$want" ] && { echo "✔ 已部署 $(git rev-parse --short HEAD) → $SITE"; exit 0; }
  sleep 5
done
echo "上傳完成，但 $SITE 的 game.html 還不是這一版（可能是快取），稍後再查"; exit 1
