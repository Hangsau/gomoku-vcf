# 新棋具第二輪（2026-11-12）：造型棋子 7 組＋特色棋盤 7 張＋後台開關

使用者要求：多一點棋盤跟棋子，要有特色（便便、蘿蔔跟兔子這類，不一定是棋子圖案）；後台可以選要不要開放；**新的預設關閉，使用者自己開**。
沒有出設計稿（使用者說「依照你的創意」；棋具頁只是多排兩排）。

## 內容
- 棋子（`game/skin/stones/<id>/b.png、w.png`，256×256 透明，貼紙風：深色描邊＋白邊）：poop 便便與霜淇淋、bunny 蘿蔔與兔子、pets 黑貓與白狗、onigiri 飯糰、sky 月亮與太陽、boo 炸彈與幽靈、donut 甜甜圈。
- 棋盤（`game/skin/boards/<id>.webp`，768×768）：grass 草地、starry 星空、beach 沙灘、chalk 黑板、ice 冰湖、denim 牛仔布、pool 泳池。

## 規則（程式在 `game/skin.js`）
- 造型棋子加 `fig: true`：不自動描圓框、圖畫大 1.12 倍、CSS 用 contain 不疊底色、棋子上的數字用 `RushSkin.fillNum`／`numHalo` 加光暈。
- **新加的棋盤、棋子一律加 `optIn: true`**：後台打開（在 `on` 清單）才出現；連不上伺服器、沒有清單時也是關的。沒有 `optIn` 的舊項目在 `off` 清單才關。`classic`、`flat` 永遠開放。
- 被關掉的項目玩家看不到；正在用的被關掉時畫面退回 classic／flat，但不改寫玩家存的選擇。
- 伺服器：`settings` 表 `k='skins_off'`；`GET /skins`（公開、快取 60 秒）、`GET／POST /admin/skins`。後台「棋具」分頁切換。
- 清單存在玩家手機 `vcfgame.skinsOff`（`{off:{boards,stones}, on:{boards,stones}}`）。

## 美術怎麼做的
codex 畫（提示：`codex_stones_prompt.md`、`codex_boards_prompt.md`、`codex_redo_prompt.md`）。原圖 `*_raw*.png` 太大不進 git，只留在本機 `art-src/`；檢查圖與報告有進 git。
教訓：棋盤底圖只說「對比要低」會被畫成純色（第一輪星空、黑板、泳池、冰湖亮度標準差 <3）；要給區間（7～18）。

## 檢查
`node docs/design/skins2-2026-11-12/check/check_skin.mjs`（用系統 Chrome；四語 × 360×640／375×667 一屏不捲動、開關規則、fig 行為、負向測試）。2026-11-12：PASS 104／FAIL 0。

## 派工
程式：cc2（`WORKORDER.md`、`WORKORDER2.md` → `REPORT.md`、`REPORT2.md`）；圖：codex；計畫與驗收：主 session。
