#!/usr/bin/env bash
# 部署排行榜／留言／後台的 Worker（vcf-game-api）。
# 只上傳 game/worker/worker.js＋admin.html（admin.html 以 Text 模組匯入），從乾淨暫存資料夾跑 wrangler：
# 不在 repo 根目錄跑 wrangler（新版會把整個資料夾當資產、留下 wrangler.jsonc，2026-11-07 踩過）。
# 用法：bash tools/deploy_worker.sh
# 後台 rush.hangsau.app/admin* 這條 route 也掛在這支 Worker 上；前面是 Cloudflare Access（Zero Trust 團隊 hangsau、
# application「Gomoku Rush 後台」、只允許 psyhangsau@gmail.com 用 email 驗證碼登入，2026-11-08 建）。
# ACCESS_AUD 是那個 application 的 audience tag，不是秘密（驗 JWT 用的是 Access 的公鑰）。
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "✘ 本機 HEAD 跟 GitHub 的 main 不一樣，先 commit／push 再部署"; exit 1; }
[ -z "$(git status --porcelain -- game/worker)" ] || { echo "✘ game/worker 有沒 commit 的改動，先 commit"; exit 1; }

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
git -c core.autocrlf=false show HEAD:game/worker/worker.js > "$OUT/worker.js"
git -c core.autocrlf=false show HEAD:game/worker/admin.html > "$OUT/admin.html"
cat > "$OUT/wrangler.jsonc" <<JSON
{
  "name": "vcf-game-api",
  "main": "worker.js",
  "compatibility_date": "2026-10-01",
  "workers_dev": true,
  "preview_urls": false,
  "routes": [{ "pattern": "rush.hangsau.app/admin*", "zone_name": "hangsau.app" }],
  "vars": { "ACCESS_TEAM": "hangsau", "ACCESS_AUD": "14010c38cbcfd3bc714124e9d4677ef5f79e61097e2900e3cbe524188a60f8ad" },
  "d1_databases": [{ "binding": "DB", "database_name": "vcf-game", "database_id": "3d55c6af-334c-4b80-99e2-29d951aa77d3" }],
  "rules": [{ "type": "Text", "globs": ["**/*.html"], "fallthrough": false }]
}
JSON
(cd "$OUT" && npx --yes wrangler@4.158.0 deploy --message "$(git log -1 --format=%h) $(git log -1 --format=%s | cut -c1-60)")
curl -s -o /dev/null -w "排行榜 API 檢查：%{http_code}\n" "https://vcf-game-api.psyhangsau.workers.dev/board?by=rank&scope=today&limit=1"
