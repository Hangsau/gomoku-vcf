# REPORT：Gomoku Rush 棋具商店（限時免費領取）

施工完成日 2026-11-13。全程沒有 commit／push／部署，沒碰線上 D1。**我做過一次 `git status --short` 看改了哪些檔（唯讀，不改任何東西）**，算不算違反「禁止任何 git 操作」請派工者判斷。

## 改了什麼（逐檔）

- `game/skin.js`：商店商品＝`optIn`（`isShop`）；擁有清單 `vcfgame.owned`；`isLocked` 加「商店商品且未擁有」；`vid()`、`claim()`、`owns()`、`price()`、`isShop()` 對外；第一次載入遷移（`src:'grand'`）；啟動時 `GET /shop?vid=` 取聯集＋補送；`storage` 事件同步擁有清單。
- `game/shop.js`（新）：商店頁、小框、首頁入口（本檔自己插到 `#openSet` 前面）、`RushShop.open/close`。
- `game/skin-picker.js`：沒領取的商店商品不列；兩排最後各一格「＋」（class `shopPlus`）通往商店；四語加「商店」。
- `game.html`：只動兩處——載入 `shop.js` 一行（接在 `skin-picker.js` 那行後面）、`skin.js?v=20261112b → 20261113a`。`duel.html`、`score.html`：只換 `skin.js?v=` 號碼。
- `game/worker/worker.js`：`GET /shop`、`POST /shop/claim`、`GET /admin/shop` 與路由。
- `game/worker/schema.sql`：`owned` 表（照施工單原文＋中文註解）。
- `game/worker/admin.html`：「棋具」分頁每件旁顯示「已領 N」、上方「共 M 人領過」；讀不到就不顯示、不影響開關。
- `sw.js`：沒動（它沒有列檔案清單，網路優先快取，`shop.js` 自動進快取）。
- `docs/design/shop-2026-11-13/`：`PROGRESS.md`、`REPORT.md`、`check/`（`check_shop.mjs`、`check_skin_copy.mjs`、各次輸出、截圖）。
- **`docs/design/skins2-2026-11-12/check/check_skin.mjs` 沒有改**（見下面「既有 check_skin」）。

## 自己做的設計取捨

- **`kind` 怎麼標**：沒有在 14 個項目上加欄位，也沒有在清單建立時標。擁有清單的鍵由 `itemKey(it)` 即時算：`BOARDS.includes(it) ? 'b:' : 's:'` ＋ id（跟 `isOff` 判斷種類同一招）。所以 `isLocked(it)` 仍只收 `it`。
- **入口放哪**：施工單說「`#skinEntry` 旁邊」，但 `#skinEntry` 在 2026-11-12 就從首頁拿掉了（棋具改走 設定→棋具，`skin-picker.js` 檔頭也寫了）。我改成在首頁右上角那排（設定、分享、排行榜）最前面加一顆金色購物袋 `#openShop`（48×48，跟旁邊同一排同樣式）。設定頁沒加商店列。這是跟施工單字面不同的地方，請確認。
- **棋具頁「＋」**：兩排最後各一格虛線框的「＋」（不做整頁一顆「商店」鈕）。從棋具頁按「＋」會把棋具頁收起、開商店，並用 `history.replaceState` 把棋具頁那格歷史換成商店，返回一次回到設定頁，不會留空的一格。
- **格子尺寸**：預設高 84px、4 欄、間距 8px（照設計稿）；14 件全開在 360×640 放得下，不需縮。`#shopPage.tight`（格高 72px）是保險：整頁 `scrollHeight > clientHeight` 才會套。
- **小框預覽**：用 `RushSkin.preview(盤id, 子id)`＋`drawBoard/drawStone` 真的畫 7 路小盤（含自動描邊）；看棋子＝這組棋子＋玩家目前棋盤、看棋盤＝這張棋盤＋玩家目前棋子。
- **同步細節**：載入時 `GET /shop` 成功就取聯集、同步完一定發一次 `rushskin`（讓商店頁拿到 `prices`）；本機有伺服器沒有的以 `src:'free'` 補送（一次最多 40 件）。領取失敗（連不上）不會從本機拿掉，只有伺服器明說 `refused` 才拿掉。
- **`/shop` 回應加 `Cache-Control: no-store`**（施工單說不快取）。
- **`GET /admin/shop`** 的 `people` 是 `COUNT(DISTINCT vid)`（領過任何東西的人數）。

## 每項檢查的輸出

### 階段 4-1 語法
`node --check game/skin.js`、`game/skin-picker.js`、`game/shop.js`：全部無輸出（通過）。`node --input-type=module --check < game/worker/worker.js`：`syntax-ok`。

### 階段 4-2 伺服器（本機 `wrangler dev --local`）
做法：把 `worker.js`／`admin.html`／`scoring.json.txt`／`schema.sql` 複製到系統暫存資料夾，寫一份 `wrangler.jsonc`（只有 D1 binding，無 route，沒有任何線上動作），**測試副本的 `ADMIN_SHA256` 換成 `testkey` 的雜湊**（只在暫存副本，repo 裡的 worker.js 沒動）；`wrangler d1 execute vcf-game --local --file schema.sql` 套 schema；`wrangler dev --local --port 8799`，測完只關自己啟動的 PID（workerd 37904、wrangler node 7640），確認 8799 已不在監聽。實際輸出：

```
GET  /shop?vid=0123456789abcdef0123            -> {"owned":[],"prices":{}} [200]
GET  /shop?vid=bad                             -> {"error":"bad vid"} [400]
POST /shop/claim items [b:grass,s:poop]        -> {"owned":["b:grass","s:poop"],"refused":[]} [200]
POST /shop/claim items [b:grass,s:bunny] grand -> {"owned":["b:grass","s:poop","s:bunny"],"refused":[]} [200]   (b:grass 重複沒有重複)
POST /shop/claim items ["X:grass"]             -> {"error":"bad items"} [400]
POST /shop/claim items []                      -> {"error":"bad items"} [400]
POST /shop/claim src:"x"                       -> {"error":"bad src"} [400]
POST /shop/claim vid:"zz"                      -> {"error":"bad vid"} [400]
POST /shop/claim 內容 notjson                   -> {"error":"bad json"} [400]
GET  /shop?vid=...                             -> {"owned":["b:grass","s:poop","s:bunny"],"prices":{}} [200]
GET  /admin/shop (無金鑰)                       -> {"error":"forbidden"} [403]
GET  /admin/shop (Bearer testkey)              -> {"items":[{"item":"b:grass","n":1},{"item":"s:bunny","n":1},{"item":"s:poop","n":1}],"people":1} [200]
--- 本機 D1 settings 寫入 shop_prices = {"b:starry":50,"s:poop":0} 之後 ---
GET  /shop?vid=...                             -> {"owned":[3 件],"prices":{"b:starry":50,"s:poop":0}} [200]
POST /shop/claim items [b:starry,s:donut]      -> {"owned":["b:grass","s:poop","s:bunny","s:donut"],"refused":["b:starry"]} [200]
GET  /admin/shop                               -> items b:grass 1、s:bunny 1、s:donut 1、s:poop 1，people 1
```
（admin 的 Cloudflare Access 路徑沒測，只測 Bearer 金鑰路徑。）

### 階段 4-3 `check/check_shop.mjs`（正式輸出：`check/run_final.txt`）
最後一行：`PASS 174／FAIL 0`
範圍：四語 × 360×640／375×667 的首頁、商店頁、小框、棋具頁（14 件全領的最擠情況）全部沒捲動／沒超出；全新玩家 14 格都「免費」、棋具頁看不到商店商品、`setStones('poop')`／`setBoard('grass')` 回 false；領取→使用→棋具頁出現；claim 內容（`{vid, items:['s:poop'], src:'free'}`，vid 與 localStorage 相同）；重新整理後仍擁有仍使用中；舊玩家遷移（`src:'grand'`）；已有擁有清單的玩家不遷移；聯集＋補送；`/shop` 連不上；價格>0 被 refused 並從本機拿掉；後台只開 2 件／全關空狀態（zh 與 en/ja/ko 連不上 `/skins`）；`duel.html`、`score.html` 載入新 `skin.js` 不報錯且建立 vid；`game.html` 不覆蓋既有 vid；全部頁面文字／aria-label／title 沒有「收費、charge、paid、有料、유료」。完整逐條輸出見 `check/run_final.txt`。

**負向測試**：`NEG=1`（把「商店 14 格」的期望改成 13）→ `check/run_neg.txt`：`PASS 165／FAIL 9（NEG=1：預期有 FAIL）`，exit code 1，抓到的 FAIL 例如：`FAIL zh 360x640 商店格子＋返回鈕共 15（期望 14）、最小觸控 48 >= 44`。另有腳本內建的版面負向測試（把格子改 2 欄 → 被抓到，PASS）。
另外**回歸驗證**：我把 `shopPlus` 暫時改回有問題的 `plus`，腳本出現 8 條 FAIL（`「＋」真的看得到 … "op":"0"`），還原後全過。

### 階段 4-4 既有 `check_skin.mjs`
- **原檔未改，直接跑會 Timeout**：`page.waitForFunction: Timeout 30000ms exceeded`（`check_skin.mjs:52`，等 `#skinEntry`）。這**不是這次的改動造成**：`#skinEntry` 首頁按鈕 2026-11-12 就拿掉了（`skin-picker.js` 檔頭有寫），原檔在我動手前就跑不起來（我開工前先跑過一次確認）。
- 為了確認這次沒弄壞舊期望，我在 `shop-2026-11-13/check/` 做了**副本 `check_skin_copy.mjs`**，只改兩處（副本檔頭有寫）：① `openPicker` 改走「設定→棋具」；② 預設把 14 件商店商品放進 `vcfgame.owned`（因為這次規則：沒領取的商店商品不能選、不出現在棋具頁）。其餘期望一字未改。結果（`check/run_skin_copy.txt`）：`PASS 104／FAIL 0`，0 FAIL。
- 原檔要不要修（改 `openPicker` 與預設擁有清單），請派工者決定；我照限制沒動它。

## 截圖（`check/`）與我看到的問題
看過：`home_zh_375x667`、`shop_zh_375x667`、`dialog_zh_375x667_free／owned／using`、`picker_zh_375x667`、`shop_en_360x640`、`dialog_en_360x640`。
- **已修**：棋具頁「＋」第一次截圖完全看不到——`game.html` 有全域 `.plus{opacity:0}`，撞名。改名 `shopPlus` 並補可見性斷言（原本只數 DOM 數量所以漏掉）。
- **已修**：小框「使用中」按鈕被 `game.html` 的 `button:disabled{opacity:.45}` 壓得發灰，對比不夠；`.cta.on` 加 `opacity:1`，重截後正常；改完後 check_shop、NEG、check_skin_copy 都重跑過。
- 沒修／可接受：① 商店頁下方留白約 1/3（14 件放得下，沒有多的內容）。② 返回鈕是 panel 色圓底在深底上，圓底很淡、只有箭頭清楚（設計稿原樣）。③ 小框蓋住格子，背景只看得到上排邊緣（設計稿原樣）。
- 沒看到：字被切、元素重疊、格子擠（zh／en）。

## 沒做到／不確定的事
- **ja／ko 的截圖我沒存也沒肉眼看過**，版面靠腳本數字（沒捲動、沒超出、觸控≥44）驗證，文字長度沒有肉眼確認；也沒母語審稿（「もらう」「받기」「期間限定 無料」「한정 무료」是我的譯法）。
- **入口位置跟施工單字面不同**（上面已說明：首頁右上購物袋，不是 `#skinEntry` 旁）。
- admin.html 的「已領 N」**沒有開瀏覽器實測後台頁面**（後台要 Cloudflare Access／金鑰，本機沒跑），只確認語法與讀取邏輯寫法。
- 沒測 Cloudflare Access 的 admin 路徑；`/admin/shop` 只用 Bearer 測。
- 部署順序提醒（主 session 做）：先 `schema.sql`（`owned` 表）→ `deploy_worker.sh` → `deploy_rush.sh`。若先部署前端、Worker 還沒有 `/shop`，玩家端只會靜默失敗（領取只存本機），不會壞掉。
- 舊玩家遷移時若 localStorage 無法寫入（隱私模式），每次載入都會當成「第一次」並重送 `grand` claim（伺服器 `INSERT OR IGNORE`，無害）。
- `RushSkin.price()` 目前只用於讀取；商店畫面沒有顯示價格（現在一律 0，施工單也沒要求）。
