# 施工單：Gomoku Rush 棋具商店（限時免費領取）

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 邊做邊把進度寫到本資料夾的 `PROGRESS.md`（每完成一階段寫一行），最後寫 `REPORT.md`。

## 背景（使用者 2026-11-13 定的）

- 商店最終要收費；**現在是免費商店**。商品只標「**限時免費**」，按「領取」才能用，領過永久保留。
- **畫面上不准出現「之後會收費」「即將收費」這類字眼**（使用者明講）。
- 現在不做登入。擁有紀錄記在伺服器（用匿名編號 `vcfgame.vid`），手機留一份副本。
- 商品＝`game/skin.js` 裡有 `optIn: true` 的 14 件（7 張棋盤、7 組棋子）。沒有 `optIn` 的舊項目維持免費、不進商店。
- 後台開關（`/skins` 的 `on` 清單）保留：沒開的商品不出現在商店，也不能領。
- 畫面選定設計稿 A（貨架格＋小框）：原始檔 `docs/design/shop-2026-11-13/project/Main.dc.html`，照它的排法與狀態做，顏色用 `game.html` 的 `:root` 色票。

## 限制（違反任何一條都算失敗）

- 禁止任何 git 操作（commit、add、reset、stash、checkout、pull、clean、push、restore）。commit 由派工者驗收後做。
- 禁止部署、禁止碰線上資料：不跑 `tools/deploy_*.sh`、不跑 `wrangler deploy`、不對線上 D1 下任何指令（`--remote` 一律不准）。本機 `wrangler dev --local` 可以。
- 行程規則：禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關自己啟動的那個 PID。腳本前景執行＋逾時；本機伺服器記下 PID、用完只關那個 PID。這台電腦有別人的 python 訓練在跑，關錯會出事。
- 不對系統 Python 裝套件。
- 只准改／新增下面這些檔案（都在 `C:\claudehome\projects\VCF\`），其他一律不准碰：
  - `game/skin.js`、`game/skin-picker.js`、新檔 `game/shop.js`
  - `game.html`（只准：載入 `shop.js`、首頁入口、換 `skin.js?v=` 號碼）、`duel.html`、`score.html`（只准換 `skin.js?v=` 號碼）
  - `game/worker/worker.js`、`game/worker/schema.sql`、`game/worker/admin.html`
  - `sw.js`（只有新檔需要進快取清單時才動）
  - `docs/design/shop-2026-11-13/` 底下的 `PROGRESS.md`、`REPORT.md`、`check/`
  - `docs/design/skins2-2026-11-12/check/check_skin.mjs`（只有因為這次的規則改變而必須調整期望值時才動，並在 REPORT 逐條說明改了哪個期望、為什麼）
- 絕對不要碰 `index.html`（分析器）、`game/learn/`、`game/duel-server/`、`game/p/`、`CLAUDE.md`、`HANDOFF.md`、`docs/handover.md`。
- 每完成一個階段立刻存檔。

## 先讀

1. `game/skin.js`（全檔）——特別是 `lock`／`isLocked`／`unlocked()`／`K_UNLOCK`、`optIn`／`isOff`、`pick`、`setBoard`／`setStones`、對外匯出的 `RushSkin`。
2. `game/skin-picker.js`（全檔）——棋具頁與首頁入口 `#skinEntry` 怎麼插進去、四語文字怎麼放。`shop.js` 照這個檔的寫法做（自帶樣式、自己插入口）。
3. `docs/design/skins2-2026-11-12/README.md`、`docs/design/shop-2026-11-13/project/Main.dc.html`。
4. `game/worker/worker.js` 的 `getSkins`／`adminGetSkins`／`adminSetSkins`／`isAdmin`、路由表、CORS 與 `json()` 的慣用寫法；`postTowerOpen` 怎麼檢查 `vid`。`game/worker/schema.sql` 的寫法。`game/worker/admin.html` 的「棋具」分頁。
5. `game.html` 第 1921 行附近 `vcfgame.vid` 怎麼產生。

## 階段 1：伺服器（`game/worker/`）

`schema.sql` 加（照檔內既有風格、附一行中文註解）：

```sql
-- 商店擁有紀錄（2026-11-13）：vid 匿名編號、item 'b:<棋盤id>' 或 's:<棋子id>'、price 當時價格（免費期 0）、src 來源（'free' 免費領取／'grand' 上線前已在用）
CREATE TABLE IF NOT EXISTS owned(vid TEXT NOT NULL, item TEXT NOT NULL, t INTEGER NOT NULL, price INTEGER NOT NULL DEFAULT 0, src TEXT NOT NULL DEFAULT 'free', PRIMARY KEY(vid, item));
```

為什麼 item 要加 `b:`／`s:` 前綴：棋盤和棋子有同名 id（`neon`）。

路由：

- `GET /shop?vid=<vid>`（公開、不快取）→ `{ owned: ["b:grass", "s:poop", …], prices: {} }`。`vid` 格式不對回 400。`prices` 讀 `settings` 表 `k='shop_prices'`（JSON 物件 `{"b:grass": 0, …}`），沒有這筆就回 `{}`；**沒列在裡面的商品價格視為 0**。
- `POST /shop/claim`，內容 `{ vid, items: ["b:grass", …], src?: "free"|"grand" }` → 檢查：`vid` 格式同 tower；`items` 是 1–40 個符合 `/^[bs]:[a-z0-9_-]{1,24}$/` 的字串；`src` 只收這兩個值（預設 `free`）。每一項：**價格 > 0 的拒絕**（回應裡列在 `refused`，不整包失敗）；其餘 `INSERT OR IGNORE`。回 `{ owned: [全部], refused: [...] }`。
  - 不檢查商品是不是在後台 `on` 清單裡（`grand` 的項目可能之後被關掉又打開；能不能「看到」由前端的 `isOff` 管）。
- `GET /admin/shop`（要 `isAdmin`）→ `{ items: [{ item, n }], people: <不同 vid 數> }`，每件被領了幾次。
- `admin.html`「棋具」分頁：每個商品開關旁邊顯示「已領 N」；分頁上方一行「共 M 人領過」。讀不到就不顯示數字，不影響開關。

## 階段 2：`game/skin.js`

- 14 件 `optIn` 項目視為商店商品：`isShop(it)`＝`!!it.optIn`。**不用**在 14 個項目上各加欄位。
- 擁有清單：localStorage `vcfgame.owned`（JSON 陣列，元素 `'b:id'`／`'s:id'`）。`isLocked(it)` 改成：既有的 `lock` 規則照舊，**或** `isShop(it)` 且不在擁有清單。`pick`／`setBoard`／`setStones` 既有的「鎖住就退回預設、不改寫玩家存的選擇」行為沿用。
  - `isLocked` 現在只收 `it`，但棋盤棋子有同名 id，需要知道種類。做法自己定（例如清單建立時幫每個項目標 `kind`），在 REPORT 說明。
- `vid`：`skin.js` 要能取得 `vcfgame.vid`；沒有就照 `game.html` 的同一種方式產生並存起來（`skin.js` 比 `game.html` 那段早執行，也被 `duel.html`、`score.html` 載入）。確認 `game.html` 原本那段讀到既有值時不會重產。
- **上線前已在用的不收回**：第一次載入新版時（localStorage 沒有 `vcfgame.owned` 這個鍵），如果玩家存的 `vcfgame.board`／`vcfgame.stones` 是商店商品，直接放進擁有清單，並以 `src: 'grand'` 送 `POST /shop/claim`。
- 同步：載入時先用本機清單；然後 `GET /shop?vid=`，成功就取**聯集**存回本機；本機有、伺服器沒有的，補送 `POST /shop/claim`。任何網路失敗都安靜略過（離線照本機清單運作）。同步後清單有變就發既有的 `rushskin` 事件讓頁面重畫。
- 對外加：`RushSkin.isShop(it)`、`RushSkin.owns(it)`、`RushSkin.claim(it)`（回 Promise：先寫本機＋發事件，再送伺服器；伺服器把它列在 `refused` 才從本機拿掉並回 `false`）、`RushSkin.price(it)`（現在一律 0；讀 `/shop` 回來的 `prices`）。
- 換 `game.html`、`duel.html`、`score.html` 裡的 `skin.js?v=` 號碼。

## 階段 3：商店畫面（新檔 `game/shop.js`）＋入口

照 `Main.dc.html`：

- 全屏一頁（跟棋具頁同一種蓋版方式）：左上返回、標題「商店」、右上金色「限時免費」膠囊。
- 「棋子」「棋盤」兩區，各 4 欄格子。只列 `isShop` 且 `!isOff` 的項目。每格：圖（棋子＝黑白兩顆交疊；棋盤＝底圖＋格線）＋下方狀態字：`免費`（金）／`已擁有`（青）／`使用中`（青，外框也青）。
- 點一格 → 中央小框：名稱、小棋盤預覽（**用 `RushSkin` 真的畫**：看的是棋子就用「這組棋子＋玩家目前的棋盤」，看的是棋盤就用「這張棋盤＋玩家目前的棋子」）、狀態膠囊（`限時免費`／`已擁有`）、一顆大按鈕：`領取` →（領到後）`使用` →（按了）`使用中`（不可按）。右上關閉；點框外也關。
- 兩區都沒有商品時（後台全關、或連不上伺服器所以 `optIn` 全關）顯示一句「目前沒有上架的商品」。
- 四語（zh／en／ja／ko）全部要有；語言怎麼取照 `skin-picker.js`。文字：商店、限時免費、棋子、棋盤、免費、已擁有、使用中、領取、使用、關閉、返回、目前沒有上架的商品。
- 按鈕與格子觸控範圍 ≥ 44px；圖示用 inline SVG，不用 emoji。
- **所有語言 × 360×640 與 375×667 都不可捲動**（商店頁、小框打開時都算）。14 件全開時要放得下；放不下就縮格子高度，不要改成可捲動。

入口：

- 首頁：`#skinEntry` 旁邊（或同一列）加「商店」入口，樣式跟它一致。加了之後首頁四語 × 兩種尺寸仍不可捲動。
- 棋具頁（`skin-picker.js`）：**沒擁有的商店商品不再出現在棋具頁**（原本是 `optIn` 開了就出現）；兩排的最後各加一格「＋」通往商店（或整頁一顆「商店」鈕，擇一，放得下為準）。擁有的商品照常出現、可選。
- `game.html` 載入 `shop.js` 的方式照 `skin-picker.js` 那一行；`sw.js` 的快取清單若列了 `skin-picker.js` 就把 `shop.js` 也加進去。

## 階段 4：檢查（結果全部貼進 REPORT.md）

1. `node --check game/skin.js`、`game/skin-picker.js`、`game/shop.js`；`worker.js` 的語法檢查照 `docs/design/skins2-2026-11-12/WORKORDER.md` 階段 5 第 1 點的做法。
2. 伺服器：用本機 `wrangler dev --local`（自選一個沒人用的埠，先查 `game/worker/` 有沒有 wrangler 設定；本機 D1 先套 `schema.sql`）實際打：`/shop` 空清單、`/shop/claim` 領兩件、重複領不重複、格式錯回 400、把 `shop_prices` 設成某件 > 0 後該件被 `refused`、`/admin/shop` 的數字。本機跑不起來就把原因寫清楚，改用單元式測試直接呼叫處理函式，**不可略過不測**。
3. 寫 `docs/design/shop-2026-11-13/check/check_shop.mjs`（Playwright 的用法、怎麼開本機靜態伺服器、怎麼攔 `/skins` 請求，照 `docs/design/skins2-2026-11-12/check/check_skin.mjs`）。攔截 `/skins`（14 件全開）、`/shop`、`/shop/claim` 回假資料，並記錄送出的請求。檢查：
   - 四語 × 360×640／375×667：首頁、商店頁、商店小框打開、棋具頁，全部沒有捲動（`scrollHeight <= clientHeight`、沒有元素超出視窗）。
   - 全新玩家：商店 14 格都是「免費」；棋具頁看不到任何商店商品；`RushSkin.setStones('poop')` 回 false。
   - 點一格 → 領取 → 按鈕變「使用」、格子變「已擁有」、送出了 `POST /shop/claim`（內容正確）→ 按使用 → 「使用中」、`RushSkin.get()` 真的換了 → 棋具頁出現這件。
   - 重新整理後仍擁有、仍使用中。
   - 舊玩家：預先在 localStorage 放 `vcfgame.stones='poop'`、沒有 `vcfgame.owned` → 載入後仍是 poop、擁有清單有 `s:poop`、送出了 `src: 'grand'` 的 claim。
   - 伺服器有、本機沒有的項目載入後會出現在本機（聯集）；`/shop` 連不上時頁面照常、沒有 console error。
   - 後台只開 2 件時商店只有 2 格；全關時顯示空狀態文字。
   - 頁面任何地方都找不到「收費」「charge」「paid」「有料」「유료」字樣。
   - 負向測試：故意把一項期望改錯，確認腳本會 FAIL，再改回來。
   - 截圖存 `check/`：zh 375×667 的首頁、商店、小框（免費／已擁有／使用中三種）、棋具頁；en 360×640 的商店與小框。
4. 跑既有的 `node docs/design/skins2-2026-11-12/check/check_skin.mjs`，貼完整結果。因為這次規則而失敗的項目照「限制」那條處理。
5. **自己看每一張截圖**，把看到的問題寫進 REPORT（字被切、重疊、對比不夠、格子擠）。

## REPORT.md 格式

改了什麼（逐檔）／自己做的設計取捨（`kind` 怎麼標、入口放哪、格子尺寸）／每項檢查的完整輸出／截圖裡你看到的問題／沒做到或不確定的事（老實寫，不要寫「全部完成」帶過）。
