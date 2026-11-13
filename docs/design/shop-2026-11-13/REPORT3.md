# REPORT3 — 商店改版（商店首頁＋棋具頁 D）

## 改了什麼

- `game/shop.js` 整份重寫：
  - 商店首頁：標題「商店」、一張「棋具」大卡（縮圖＝原木盤＋平面黑白子四顆交錯，純 CSS，色票取 `classic` 盤；「棋子造型 N 組・棋盤花色 M 張」；「限時免費」膠囊；右箭頭）。卡片由 `CARDS` 陣列產生，加類別只要多一筆。N、M 取 `isShop && !isOff`；兩者都是 0 → 整頁只顯示「目前沒有上架的商品」。
  - 棋具頁 D：頁首（返回／棋具／限時免費）、左上預覽盤（`RushSkin.preview(selB, selS)` + `drawBoard/drawStone` 真的畫）、右上（分頁標題、名稱、狀態膠囊、「搭配的棋盤／棋子」＋另一邊名稱，預設加「（預設）」）、兩顆分頁鈕、4 欄格子（第一格＝預設：棋子 `flat`／棋盤 `classic`）、底部大按鈕。沒有彈出小框。
  - 棋子、棋盤各自記住選擇（`selS`／`selB`），切分頁不重設；進頁時＝玩家正在用的（非商店的盤如 `night` 也能預覽，格子沒有選中，按鈕顯示「使用中」且不可按）。
  - 按鈕只動目前分頁選中的那一件：沒擁有→「免費領取『名』」（只 `RushSkin.claim`，不自動換上）；已擁有／預設→「換上『名』」；正在用→「使用中」（disabled）。
  - 四語字串（含 `{n}`、`{a}`、`{b}` 樣板）；英文的 `free` 由「Limited-time free」縮成「Free for now」（原句在 360px 會讓頁首擠成兩行、膠囊折行）。
  - 導覽：購物袋 → 商店首頁；棋具頁返回 → 商店首頁；商店首頁返回 → 關閉；從設定→棋具的「＋」→ `RushShop.open({stage:true, tab, from:'picker'})` 直接進棋具頁對應分頁，返回回到設定的棋具頁（歷史那一格重用，不多推）。瀏覽器返回鍵與 Esc 也處理。
- `game/skin-picker.js`：「＋」帶分頁（`data-shop="b|s"`）、呼叫 `RushShop.open({...})`；`open(reuse)` 新增「重用歷史那一格」參數（從商店返回用）。
- `game.html`：沒動（`shop.js` 載入版號本來就跟 BUILD 走）。
- `check/check_shop.mjs` 改成新流程（舊小框流程拿掉）；新增 `check/run3.txt`、`run3_neg.txt`、`run3_skin_copy.txt` 與新截圖。

## 自己做的取捨

- 領取後**不**自動換上：按鈕變成「換上『名』」再按一次才換（對應施工單「領取→換上→使用中」）。
- 格高固定 124px、格內名稱 11px，最長名稱（韓文「똥과 소프트아이스크림」、日文「うんちとソフトクリーム」）最多 3 行；中英文多為 1–2 行。第一版用 116px／12px，ja／ko 的便便格被切到（檢查抓到），所以放大。
- 底部大按鈕允許 2 行（日文「…を無料でもらう」會折兩行），不用省略號，不被切。
- 放不下時（`scrollHeight > clientHeight`）才進 `tight`：預覽盤 168→140、格高 112。本次所有尺寸實測都沒需要捲動。
- 我自己建的 class 一開始用了 `.info`、`.tabs`，與 `game.html` 全域同名規則撞名（置中、padding、color 全跑掉，截圖看到才發現），已改名 `.sinfo`／`.stabs`。
- 預覽盤的 `<canvas>` 上放了 `data-board`／`data-stones`（給檢查腳本對照用，無行為）。

## 檢查結果（完整輸出見 `check/run3.txt`、`run3_neg.txt`、`run3_skin_copy.txt`，下方也附在文末）

1. `node --check game/shop.js`、`game/skin-picker.js`：兩個都通過（無輸出）。
2. `check_shop.mjs`：**PASS 286／FAIL 0**。涵蓋：首頁購物袋→商店首頁有「棋具」卡、數量 7／7 → 點進棋具頁；兩分頁第一格是預設、每格名稱有且沒被切；混搭（pets＋grass，同時驗 `preview` 參數、畫布左上像素、中央子像素 ≠ 平面黑子）；切回分頁選擇還在；選預設格預覽回平面／原木且另一邊不變；在棋子分頁領取只送 `s:pets`、棋盤那邊狀態不變；領取→換上→使用中、設定→棋具頁出現；重新整理仍擁有；＋進來停對應分頁、返回回棋具頁、瀏覽器返回鍵關商店；`night` 盤進頁預覽夜墨、沒有選中、按鈕不可按、無錯誤；全新玩家看不到／選不了沒領的、舊玩家 `grand`、聯集同步、`/shop` 連不上、後台只開 2 件／全關／`/skins` 500、`refused`、禁字（所有頁面、四語）；四語×(360×640、375×667)×(商店首頁、棋具頁兩分頁＋選最長名稱)不捲動且按鈕完整。
3. 負向測試：`NEG=1`（把期望格數改錯）→ **FAIL 17**（預期有 FAIL）；腳本內另有一項「把格子改 2 欄會被抓到」PASS。
4. `check_skin_copy.mjs`：**PASS 104／FAIL 0**。

第一輪跑出 3 個 FAIL（ja／ko 的便便格、ko 的黑貓白狗格名稱被切）→ 放大格高、縮名稱字後 0 FAIL。

## 截圖（自己看過）

`check/` 下：`store_home_zh_375x667.png`、`stage_zh_375x667_stones_mix.png`（黑貓白狗＋草地盤）、`stage_zh_375x667_boards.png`、`stage_en_360x640_stones.png`、`stage_ja_360x640_stones.png`、`stage_ko_360x640_stones.png`、`stage_zh_375x667_night.png`。

看到的問題：
- 第一版截圖：右上資訊欄文字全置中、名稱發灰（撞到全域 `.info`）→ 已修（改名），重拍後左對齊正常。
- 英文頁首「Board & stones」＋「Limited-time free」擠成兩行 → 英文膠囊改「Free for now」，已修。
- 已知、沒動：頁首大標題字有一圈淡白描邊（`game.html` 的全域 h1 樣式，舊商店頁也是這樣）；「夜墨」兩字在截圖用的 headless Chrome 字型上筆畫偏糊（字型 fallback，非版面問題）。
- 棋盤分頁格子下方、按鈕上方有一段空白（版面剩餘空間），沒填。
- 舊的 `check/` 截圖（`dialog_*`、`shop_*`、`picker_*`）是舊流程產物，我沒刪，已過時。

## 沒做到／不確定

- 未在真機（Safari／實際觸控）驗證，只用 Playwright＋系統 Chrome（dpr 2）。
- 設計稿的字型是 Noto Sans TC，實作用 `game.html` 既有字型，行寬略有差異。
- 預覽盤右側資訊欄在 ko 長名稱會到 3 行，仍在範圍內；沒測更長的未來商品名。
- 沒有部署、沒有 git 操作、沒動 `skin.js`／`worker/`／`duel.html`／`settings.js`／`duel-server/`。

---

## 附：完整輸出

### node --check
（`game/shop.js`、`game/skin-picker.js` 皆無輸出＝通過）

### check_shop.mjs（run3.txt）
見 `check/run3.txt`（286 PASS／0 FAIL），最後一行：`PASS 286／FAIL 0`

### NEG=1（run3_neg.txt）
最後一行：`PASS 269／FAIL 17（NEG=1：預期有 FAIL）`

### check_skin_copy.mjs（run3_skin_copy.txt）
最後兩行：`PASS 負向測試：.sgrid 4 欄會被抓到（bad=5 sh=675/ch=640 canvas=190）`、`PASS 104／FAIL 0`
