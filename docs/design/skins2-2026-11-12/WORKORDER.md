# 施工單：Gomoku Rush 新棋具（造型棋子＋特色棋盤＋後台開關）

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 邊做邊把進度寫到本資料夾的 `PROGRESS.md`（每完成一階段寫一行），最後寫 `REPORT.md`。

## 限制（違反任何一條都算失敗）
- 禁止任何 git 操作（commit、add、reset、stash、checkout、pull、clean、push）。commit 由派工者驗收後做。
- 禁止部署（不跑 `tools/deploy_*.sh`、不跑 wrangler）。
- 行程規則：禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關自己啟動的那個 PID。腳本前景執行＋逾時；要開本機網頁伺服器只開一個、記下 PID、用完只關那個 PID。
- 只准改／新增下面這些檔案（都在 `C:\claudehome\projects\VCF\`），其他一律不准碰：
  - `game/skin.js`、`game/skin-picker.js`
  - `game.html`、`duel.html`、`score.html`（只准改「在棋子上寫數字」的那幾行，見階段 2）
  - `game/worker/worker.js`、`game/worker/schema.sql`、`game/worker/admin.html`
  - `sw.js`（只有確認新圖需要它處理時才動；多半不用）
  - `docs/design/skins2-2026-11-12/` 底下的 `PROGRESS.md`、`REPORT.md`、`check/`（檢查腳本與截圖）
- `game/skin/stones/`、`game/skin/boards/` 的圖是另一位（codex）正在畫的，**不要動、不要自己產生圖**。你施工時圖可能還沒到，程式要在圖不存在時照樣能用（先用顏色畫）。
- 絕對不要碰 `index.html`（分析器）、`game/learn/`、`game/duel-server/`。
- 每完成一個階段立刻存檔。

## 先讀
1. `game/skin.js`（全檔，198 行）——棋盤與棋子樣式的唯一來源。
2. `game/skin-picker.js`（全檔，110 行）——棋具頁。
3. `docs/design/skins-2026-11-12/README.md`——上一輪的定案。
4. `game/worker/worker.js` 開頭註解、`isAdmin`（約 366 行）、`json()` 回應工具、最底下的路由表（約 520–556 行）。
5. `game/worker/admin.html` 的分頁結構（約 81–130 行：`data-tab`、`render()`、怎麼帶驗證去打 `/admin/*`）。
6. `game.html` 約 995–1015 行、`duel.html` 約 815–862、1110–1118 行、`score.html` 約 404–437 行：棋子上寫手數字的地方。

## 階段 1：`game/skin.js` 加新項目

### 1a. 棋盤 7 張（加在 `BOARDS` 最後，順序照下表）
圖在 `game/skin/boards/<id>.webp`（768×768）。`color` 是圖的大概平均色（圖沒載到時的底色，也拿來算對比）。

| id | 名字 zh／en／ja／ko | color | line | star | label | ink | edge | rim |
|---|---|---|---|---|---|---|---|---|
| grass | 草地／Grass／芝生／잔디 | #6FAF4A | #1F4A17 | #1F4A17 | #143310 | #0E2409 | #3F7A2A | – |
| starry | 星空／Starry／星空／별밤 | #141A3A | #5E6A9A | #C9D2F5 | #AEB7E0 | #F1EEFA | #0A0D22 | #A9B4DC |
| beach | 沙灘／Beach／砂浜／모래사장 | #EBD9AE | #8A6E3E | #6B5228 | #6B5228 | #2A1F0C | #C2A873 | – |
| chalk | 黑板／Chalkboard／黒板／칠판 | #24402F | #B9CDBF | #E6EFE8 | #C7D8CC | #F2F7F3 | #132419 | #B9CDBF |
| ice | 冰湖／Ice／氷の湖／얼음 호수 | #D6EAF5 | #5F8AA6 | #3F6A86 | #3F6A86 | #10222E | #9CC3D9 | – |
| denim | 牛仔布／Denim／デニム／데님 | #2F4E7E | #B8C9E6 | #E3EBF8 | #D0DCF0 | #F4F7FC | #1B3157 | #B8C9E6 |
| pool | 泳池／Pool／プール／수영장 | #4FC3D9 | #0E5F73 | #0E5F73 | #0A4756 | #06303B | #2A93A8 | – |

### 1b. 造型棋子 7 組（加在 `STONES` 最後，順序照下表）
圖在 `game/skin/stones/<id>/b.png`、`w.png`（256×256 透明，造型不是圓的，但整個落在內切圓裡）。每組加 `fig: true`。

| id | 名字 zh／en／ja／ko | 黑方是什麼 | black.fill | 白方是什麼 | white.fill |
|---|---|---|---|---|---|
| poop | 便便與霜淇淋／Poop & Soft Serve／うんちとソフトクリーム／똥과 소프트아이스크림 | 便便 | #5A3A22 | 霜淇淋 | #FFF3D6 |
| bunny | 蘿蔔與兔子／Carrot & Bunny／にんじんとうさぎ／당근과 토끼 | 胡蘿蔔 | #F08A24 | 白兔 | #FFFFFF |
| pets | 黑貓與白狗／Cat & Dog／黒ねこと白いぬ／검은 고양이와 흰 강아지 | 黑貓 | #1E1E22 | 白狗 | #FFFFFF |
| onigiri | 飯糰／Onigiri／おにぎり／주먹밥 | 海苔飯糰 | #1F2A1E | 白飯糰 | #FFFFFF |
| sky | 月亮與太陽／Moon & Sun／月と太陽／달과 해 | 夜月 | #1B2A5A | 太陽 | #FFE680 |
| boo | 炸彈與幽靈／Bomb & Ghost／ばくだんとおばけ／폭탄과 유령 | 炸彈 | #1A1A1E | 幽靈 | #FFFFFF |
| donut | 甜甜圈／Donuts／ドーナツ／도넛 | 巧克力甜甜圈 | #4A2A18 | 白糖霜甜甜圈 | #FFF4F0 |

每組：`black.ink: '#FFFFFF'`、`white.ink: '#1B1A17'`，不要 `hi`、不要 `ring`、不要 `glow`。

### 1c. `fig` 的行為
- `side()`：`fig` 的組**不自動描邊**（圖自己有描邊和白邊；畫一個圓框會很怪）。
- `drawStone`：有圖就照現在的方式畫（`drawImage` 進 2r 的正方形）；`fig` 的組把圖畫大一點（邊長 `2r × 1.12`，置中），因為造型沒有填滿正方形。圖還沒載到時照舊畫圓（用 `fill`）。`svgStone` 同樣處理。
- `cssBg`／CSS 變數：`fig` 的圖用 `center/contain no-repeat`，而且**後面不要再疊底色**（否則造型後面會有一個實心圓）；圖沒載到的情況不用特別處理。
- 棋子上的數字要看得清楚（造型上面花花的）：新增
  `RushSkin.numHalo(black)` → `fig` 的組回傳光暈色（黑方回 `'#1B1A17'`，白方回 `'#FFFFFF'`），其他組回 `null`。
  再新增方便用的 `RushSkin.fillNum(ctx, text, x, y, black)`：有光暈就先 `strokeText`（`lineWidth` 約字高的 0.28、`lineJoin='round'`、用光暈色）再 `fillText`；沒有光暈就只 `fillText`。fillStyle、font、對齊由呼叫的地方先設好，這個函式不改它們。

### 1d. 後台開關（哪些棋盤、棋子開放給玩家）
- 新增 localStorage 鍵 `vcfgame.skinsOff`（JSON：`{"boards":["id",…],"stones":["id",…]}`，列的是**關閉**的）。
- `skin.js` 載入時：先用 localStorage 裡的那份（沒有就當全部開放）；然後 `fetch('https://vcf-game-api.psyhangsau.workers.dev/skins')`，成功就把回來的 `off` 存回 localStorage，內容有變就重新套用並發 `rushskin` 事件。失敗就安靜略過（維持用舊的那份）。
- 新增 `RushSkin.isOff(it)`（傳項目物件）。`classic` 棋盤和 `flat` 棋子永遠算開放（清單裡有也不理）。
- `pick()`、`setBoard()`、`setStones()`：關閉的跟鎖住的一樣不能選；玩家原本選的那個被關閉時，畫面改用第一個（`classic`／`flat`），但**不要改寫他存的選擇**（之後重新開放就自動回來）。
- `RushSkin.boards`／`RushSkin.stones` 照舊是完整清單（後台要用），是否顯示由用的地方看 `isOff` 決定。

## 階段 2：三個頁面的數字改用 `fillNum`
`game.html`、`duel.html`、`score.html` 裡，在棋子上寫手數／順序數字的 canvas `fillText`，改成呼叫 `RushSkin.fillNum(...)`（顏色照原本的設定，不要改顏色邏輯）。
`score.html` 的 SVG `<text>`（約 415、437 行）：`RushSkin.numHalo(...)` 有值時加上 `stroke="<光暈色>" stroke-width="3" paint-order="stroke" stroke-linejoin="round"`。
只改這些行，不順手動別的。

## 階段 3：棋具頁 `game/skin-picker.js`
- 現在一排 8 格；加完以後棋盤 15 個、棋子 14 個 → 各排成 **兩排**（每排 8 格，`.sgrid` 的 8 欄不變，自動換行即可）。
- 關閉的項目（`S.isOff(it)`）**不顯示**；鎖住的照舊顯示鎖頭。
- 預覽棋盤的高度計算（`drawPreview` 裡的 `root.clientHeight - 330`）要跟著多出來的兩排調整，讓整頁**不捲動**：中英日韓 × 360×640 與 375×667 都要一屏放完、沒有任何東西超出畫面，預覽盤至少 190 像素。放不下就把格子高度從 44 降到最低 40、縮間距；觸控目標不可低於 40。
- 棋子按鈕裡的兩顆小圓：`fig` 的組用 `contain`、不要底色、不要 `border-radius` 裁切造成缺角（圖本來就在內切圓裡，裁了也沒差，但底色不能有）。
- 棋盤按鈕的小色塊：有 `img` 的棋盤用那張圖當底（`center/cover`），上面照舊疊格線。
- 首頁入口按鈕 `#skinEntry` 的兩顆小子：`fig` 時同樣不要底色。

## 階段 4：Worker 與後台
### 4a. `game/worker/schema.sql`
最後加：
```sql
-- 全站設定（2026-11-12）：k='skins_off' → {"boards":[…],"stones":[…]}，後台關閉的棋盤與棋子
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL);
```
### 4b. `game/worker/worker.js`
- `GET /skins`（公開）→ `{ off: { boards: [...], stones: [...] } }`；資料表沒有這筆就回空清單。加 `Cache-Control: public, max-age=60`。CORS 照其他公開 GET 的做法。
- `POST /admin/skins`（要 `isAdmin`）內容 `{ off: { boards: [...], stones: [...] } }` → 檢查：兩個都是陣列、每個元素是符合 `/^[a-z0-9_-]{1,24}$/` 的字串、各最多 100 個、去重複；`INSERT … ON CONFLICT(k) DO UPDATE` 寫進 `settings`；回 `{ ok: true, off }`。不合格回 400。
- `GET /admin/skins`（要 `isAdmin`）→ 同 `/skins` 的內容但不快取（後台讀最新的）。
- 檔案開頭的路由註解補上這三條；路由表加上。寫法、錯誤處理跟現有的 handler 一致。
### 4c. `game/worker/admin.html`
- 加一個分頁「棋具」（`data-tab="sk"`，放在「題庫」後面）。
- 分頁內容：兩段「棋盤」「棋子」，每個項目一列：小預覽（棋盤＝色塊或圖；棋子＝黑白兩顆）、中文名字、id、一個開關（開放／關閉）。`classic`、`flat` 顯示「固定開放」、不能關。
- 項目清單從遊戲本身來：後台頁跟遊戲同網域（`rush.hangsau.app/admin`），用 `<script src="/game/skin.js">` 載入後讀 `RushSkin.boards`／`RushSkin.stones`（圖的路徑在後台要補成 `/game/skin/...` 絕對路徑）。載不到（例如本機直接開檔）就顯示一行說明，不要壞掉。
- 切開關 → 立刻 `POST /admin/skins`（驗證方式跟後台其他 POST 一樣），成功顯示「已儲存，玩家最慢 1 分鐘後看到」，失敗把開關切回去並顯示錯誤。
- 上面加兩顆快捷鈕：「全部開放」「新的全部關閉」（後者關掉這張施工單新增的 7 張棋盤＋7 組棋子）。
- 樣式沿用後台現有的 class 與變數，觸控目標至少 44 像素，手機寬度 360 不橫向捲動。

## 階段 5：檢查（結果全部貼進 REPORT.md）
1. `node --check game/skin.js`、`node --check game/skin-picker.js`；`worker.js` 是 ES module 且匯入 .html，用 `node --input-type=module --check < game/worker/worker.js` 或等效方式只驗語法。
2. 寫 `docs/design/skins2-2026-11-12/check/check_skin.mjs`（用機器上已有的 Playwright；先找 `npx playwright --version` 或 `C:\claudehome` 其他專案 node_modules 裡現成的，**不要全域安裝東西**；真的沒有就在 `check/` 裡 `npm i playwright` 並在報告註明）：
   - 自己開一個本機靜態伺服器（VCF 根目錄），測完只關那個 PID。把對 `https://vcf-game-api.psyhangsau.workers.dev/skins` 的請求攔下來回假資料（線上還沒有這條路由）。
   - 開 `game.html`，四種語言（看 game.html 怎麼切語言）× 兩種尺寸（360×640、375×667）：打開棋具頁，檢查 ① `#skinPick` 沒有任何子元素超出視窗、`scrollHeight <= clientHeight` ② 預覽 canvas 寬 ≥ 190 ③ 棋盤格 15 個、棋子格 14 個。每種各截一張圖存 `check/shots/`。
   - 假資料回 `off: {boards:['grass','starry'], stones:['poop']}` 時：棋具頁少了這三個；先把 localStorage 設成選 `poop`＋`grass` 再載入 → `RushSkin.get()` 用的是 `classic`／`flat`，但 localStorage 裡存的選擇沒被改掉。
   - 逐一 `setStones` 7 組新棋子、`setBoard` 7 張新棋盤：沒有 console error；`RushSkin.get().black.ring` 在 `fig` 的組是 undefined；`RushSkin.numHalo(true)` 有值。圖已經在的話（看 `game/skin/stones/poop/b.png` 存不存在），截一張 `bunny`＋`grass`、一張 `sky`＋`starry` 的遊戲盤面（進一局或用棋具頁預覽都可以）。
   - 故意弄錯驗一次檢查腳本抓得到：暫時把 `.sgrid` 改成 4 欄（會超出畫面）→ 腳本要報失敗；驗完改回來。
   - 腳本結尾印 `PASS n／FAIL m`，FAIL 不是 0 就修到 0。
3. 列出你實際改了哪些檔（每個檔改了什麼，一行）。

## REPORT.md 格式
改了什麼（逐檔）／檢查完整輸出／截圖裡你看到的問題／沒做到或不確定的事（老實寫，不要寫「全部完成」帶過）。
