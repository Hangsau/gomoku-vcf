# 施工回報：Gomoku Rush 新棋具（2026-11-12）

階段 1–5 都做了。沒有 git 操作、沒有部署、沒有關任何行程（檢查腳本的本機伺服器開在腳本自己的 process 裡，結束就自己關）。

## 改了什麼（逐檔）

- `game/skin.js`：加 7 張棋盤（img 指到 `game/skin/boards/<id>.webp`）、7 組造型棋子（`fig: true`，img 指到 `game/skin/stones/<id>/b.png`、`w.png`）。`side()` 對 fig 不自動描邊。`drawStone`／`svgStone` 的 fig 圖邊長 2r×1.12 置中。`cssBg` 的 fig 圖用 `center/contain no-repeat`，不疊底色。新增 `RushSkin.numHalo(black)`、`RushSkin.fillNum(ctx,text,x,y,black)`。新增 `vcfgame.skinsOff`、`RushSkin.isOff()`，`pick`／`setBoard`／`setStones` 不能選關閉的；原本選的被關掉時改用 classic／flat 但不改寫 localStorage。載入時 `fetch(.../skins)`，有變就存回、重套用並發 `rushskin`，失敗安靜略過。`storage` 事件也跟著 `skinsOff` 變。
- `game/skin-picker.js`：關閉的項目不顯示。預覽盤高度改成實際量（整頁高 − 內距 − 其他區塊 − 間距），不再用 `−330` 的猜值。小於 190 時自動加 `.tight`（格高 44→40、縮間距）。fig 棋子按鈕的小圓用 contain、不要底色、不裁圓。有 img 的棋盤色塊用那張圖當底、上面疊格線。首頁 `#skinEntry` 的兩顆小子，fig 時不要底色、不要圈。
- `game.html`（1 行）、`duel.html`（2 行）：手數字的 `ctx.fillText` 改 `RushSkin.fillNum(...)`，顏色邏輯沒動。
- `score.html`（2 行）：兩個 SVG `<text>`，`numHalo` 有值時加 `stroke`／`stroke-width="3"`／`paint-order="stroke"`／`stroke-linejoin="round"`。
- `game/worker/schema.sql`：加 `settings` 表。
- `game/worker/worker.js`：開頭路由註解補三條。新增 `GET /skins`（公開、`Cache-Control: public, max-age=60`、CORS）、`GET /admin/skins`（isAdmin、不快取）、`POST /admin/skins`（isAdmin；驗兩個都是陣列、每個元素符合 `/^[a-z0-9_-]{1,24}$/`、各最多 100、去重；`INSERT … ON CONFLICT DO UPDATE`；不合格回 400）。路由表已加。
- `game/worker/admin.html`：新分頁「棋具」（`data-tab="sk"`，在「題庫」後）。載入 `/game/skin.js`，兩段「棋盤」「棋子」，每列有預覽、中文名、id、開放／關閉開關（`role=switch`，44px 高）。classic、flat 顯示「固定開放」。切換立刻 POST，成功顯示「已儲存，玩家最慢 1 分鐘後看到」，失敗不改狀態並顯示錯誤。有「全部開放」「新的全部關閉」兩顆鈕。載不到 `RushSkin` 時顯示一行說明。
- `docs/design/skins2-2026-11-12/`：`PROGRESS.md`、`REPORT.md`、`check/check_skin.mjs`、`check/run1.txt`、`check/shots/*.png`；另有 `check/patch_*.py`（我用來改檔的一次性腳本，可刪）、`check/_admin_inline.js`（admin 內嵌 script 抽出來驗語法用，可刪）。
- 沒動：`sw.js`、`index.html`、`game/learn/`、`game/duel-server/`、`game/skin/stones/`、`game/skin/boards/`。

## 檢查完整輸出

1. 語法：`node --check game/skin.js`、`game/skin-picker.js` 都過。`worker.js` 把兩行 `import` 換成空字串後做 `node --check`，過。`admin.html` 的內嵌 script 抽出來 `node --check`，過。
2. `node docs/design/skins2-2026-11-12/check/check_skin.mjs`：**`PASS 96／FAIL 0`**，完整逐條輸出在 `check/run1.txt`。涵蓋：
   - 四語 × 360×640／375×667：沒有東西超出視窗、`scrollHeight <= clientHeight`、預覽 canvas 寬 ≥190（360 寬是 270、375 寬是 295）、棋盤格 15、棋子格 14、格子高度 ≥40、沒有 console error。
   - 假資料 `off: {boards:['grass','starry'], stones:['poop']}`：棋具頁少這三個（13／13 格）。localStorage 先設 `poop`＋`grass` 時，`RushSkin.get()` 用 classic／flat，localStorage 沒被改。`setBoard`／`setStones` 回 false。classic 永遠開放。重新開放後重載，自動回到 grass／poop。
   - 7 組棋子、7 張棋盤逐一 `setStones`／`setBoard`：沒有 console error。fig 組 `ring` 是 undefined、`numHalo` 黑白都有值、`--sk-b` 是 contain。非 fig 組 `numHalo` 回 null。`fillNum` 在 fig 時先 `strokeText`（lineWidth＝字高×0.28、`round`、光暈色）再 `fillText`，非 fig 只 `fillText`。
   - 負向測試：用注入 CSS 把 `.sgrid` 暫時改成 4 欄（沒有動原始檔，所以不需要改回），腳本抓到（5 個元素超出、`scrollHeight` 675／`clientHeight` 640），算 PASS。
3. 實際改的檔案見上節。

## 截圖裡我看到的問題

我只實際看了 `picker_ja_360x640.png`，其餘七張沒有逐張看，只靠上面的數字檢查。
- 版面一屏放得下，兩排棋盤（8＋7）、兩排棋子（8＋6）、預覽盤完整。
- 棋子第二排只有 bunny 有圖，其餘 5 格是空的方塊：那些棋子的圖還沒到，按鈕裡沒有底色（符合規格），所以看起來是空格。圖到了就會有。
- 棋盤色塊現在是用顏色（棋盤圖還不存在），所以只有底色加格線。

## 沒做到或不確定的事

- **圖還沒到，所以兩張組合截圖沒截**（`bunny`＋`grass`、`sky`＋`starry`）：棋盤圖（`game/skin/boards/`）整個資料夾還不存在，`sky` 的棋子圖也不存在，腳本印了 `SKIP`。圖到了再跑一次腳本就會自動截。
- **fig 圖的實際畫法只在有圖的 `poop`、`bunny` 看到過按鈕縮圖**；`drawStone` 放大 1.12 在盤面上的樣子、手數字光暈的實際觀感，沒有用真圖在遊戲盤面上看過。
- **`admin.html` 的「棋具」分頁沒有在瀏覽器實際跑過**（只驗了語法，也只能在 `rush.hangsau.app/admin` 的 Access 後面用；本機沒有 Worker）。開關、`全部開放`、`新的全部關閉`、失敗還原這些行為是照規格寫的，沒被實測。
- **Worker 三條路由沒有實際打過**（沒有部署、沒有本機 D1），只驗了語法。`settings` 表要在 D1 上執行 `schema.sql` 的最後兩行才會有。
- **格子寬度小於 40**：規格要求 8 欄不變、觸控目標不低於 40。360 寬時每格寬約 37.5px（375 寬約 39px），高度是 44（`.tight` 時 40）。寬度小於 40 是原本 8 欄就有的，我沒有動，檢查腳本只驗高度 ≥40，這件事請你決定要不要處理（例如縮頁面左右內距）。
- **Playwright 瀏覽器**：`C:\claudehome\tools\node_modules` 的 Playwright 要的 chromium build（1234）沒安裝，我改用系統 Chrome（`executablePath`），沒有全域安裝任何東西。
- 預覽 canvas 在 `.tight` 模式沒被觸發過（所有測試尺寸的空間都夠），這條路徑沒實測。
- `sw.js` 沒動；我沒檢查它是否會快取 `game/skin/boards/*.webp`，圖到了之後離線／更新行為沒驗。
