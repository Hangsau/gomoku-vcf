# 施工單：兩儀殿的聲音鈕、語言鈕收進同一個設定頁

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 邊做邊把進度寫到本資料夾的 `PROGRESS.md`，最後寫 `REPORT.md`。

## 背景（使用者 2026-11-13）

「為什麼兩儀殿有自己的聲音開關跟語言切換？這些不都在設定裡面就處理好的嗎？讓所有設定都在設定完成」「為什麼不全部收在同一個設定裡」。

現況：
- `game.html` 有設定頁 `#sSet`（2026-11-12 做的）：帳號卡（還沒開放）、音效音量、音樂音量、落子聲、棋具、語言、給作者留言。首頁右上齒輪 `#openSet` 進去。
- `duel.html`（兩儀殿，獨立頁面，比設定頁早一天做）大廳右上角有喇叭鈕（`[data-sound]`）和地球鈕（`#langBtn`＋`#langs`），房間畫面右上角也有一顆喇叭鈕。兩邊存同一組 localStorage 鍵（`vcfgame.sound`、`vcfgame.lang`、`vcfgame.vol.sfx`、`vcfgame.vol.bgm`、`vcfgame.sfx.stone`、`vcfgame.board`、`vcfgame.stones`）。
- 兩儀殿沒有進設定的入口。

## 做完的樣子

- 兩儀殿大廳與房間畫面右上角：喇叭鈕、地球鈕、語言選單都拿掉，換成**一顆齒輪**（圖示與 `game.html` 的 `#openSet` 相同）。
- 點齒輪 → **在兩儀殿頁面內**蓋上跟 `game.html` 一樣的設定頁（不可以跳去 `game.html`：人在房間裡，離開頁面會斷線）。關掉回到原本的大廳／房間，對局、連線、計時不受影響。
- 設定頁內容與 `game.html` 的完全一樣（同樣的項目、順序、樣式、四語文字）：音效音量、音樂音量、落子聲、棋具、語言、給作者留言、帳號卡。
- 在兩儀殿改的設定**立刻生效**：音量拉了馬上變、語言切了整頁文字馬上換、落子聲與棋具換了下一手就用新的。
- **只有一份設定頁的程式**：`game.html` 與 `duel.html` 用同一份（抽成共用檔，例如 `game/settings.js`，自帶樣式與四語文字，做法參考 `game/skin-picker.js`、`game/shop.js`）。不可以在 `duel.html` 另外抄一份。
- `game.html` 的設定頁行為、外觀、開啟方式（含瀏覽器返回鍵的行為）跟現在一樣。
- `vcfgame.sound`（總開關）目前在 `game.html` 設定頁是怎麼處理的，先查清楚寫進 REPORT；喇叭鈕拿掉後，玩家要能在設定頁把聲音完全關掉（音量拉到 0 視同關，或設定頁已有對應做法——照 `game.html` 現有的做法，不要另創）。如果某個玩家目前是 `vcfgame.sound='0'`（之前用喇叭鈕關的），不可以變成「關著卻沒有地方打開」。

## 限制（違反任何一條都算失敗）

- 禁止任何 git 操作。禁止部署。本機 `wrangler dev` 可以。
- 行程規則：禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關自己啟動的 PID。腳本前景執行＋逾時。不對系統 Python 裝套件。
- 只准改／新增（都在 `C:\claudehome\projects\VCF\`）：`game.html`、`duel.html`、`game/skin-picker.js`、`game/shop.js`（只有為了能在 `duel.html` 載入才動）、新檔 `game/settings.js`、`sw.js`（只有快取清單需要時）、`docs/design/settings-unify-2026-11-13/` 底下的 `PROGRESS.md`、`REPORT.md`、`check/`。
- 不准碰：`game/duel-server/`、`game/worker/`、`game/skin.js`（除非換 `?v=` 之外有必要，必要就在 REPORT 說明）、`game/learn/`、`score.html`。
- `duel.html` 最後那行被註解掉的 `// showInApp();` 不要動。VCF 回看的「自己擺」（`RV.free`、`rvTap`）不要動。
- 不要重跑別的資料夾的檢查腳本去覆寫它們的截圖；要跑就確認輸出只寫到自己的 `check/`。
- 這是搬動與共用，不是重新設計：設定頁長相不准改。
- 兩儀殿所有畫面、`game.html` 設定頁：四語 × 375×667、360×640 不可捲動。

## 先讀

`game.html`：`#sSet` 的 HTML、相關 CSS、開關它的程式（`openSet`、`setBack`、history 處理）、音量滑桿與落子聲選單、語言列、`openMsg`、`renderSound`、`bgmSync`、`applyLang`。`duel.html`：`[data-sound]`、`#langBtn`、`#langs`、`langMenu`、`applyLang`、`renderSound`、`bgmSync`、`volOf`、落子聲怎麼取、`RushSkin` 怎麼用、`.modal` 與全屏畫面的切換方式、history／返回鍵處理。`game/skin-picker.js`、`game/shop.js`（共用檔怎麼自帶樣式、怎麼被頁面載入）。

## 檢查（結果全部貼進 REPORT.md）

1. 語法：`node --check` 新檔與兩頁抽出的 script。
2. 寫 `check/check_settings.mjs`（Playwright；本機靜態伺服器＋本機對戰伺服器、兩個 context 的寫法照 `docs/design/duel-vcf-study-2026-11-13/check/check_study.mjs`；外連請求一律攔掉；截圖只存自己的 `check/`）：
   - 兩儀殿大廳、房間：找不到 `[data-sound]`、`#langBtn`；各有一顆齒輪，觸控 ≥ 44px。
   - 大廳點齒輪 → 設定頁出現，項目與 `game.html` 設定頁逐項相同（比對兩頁設定頁的列數與每列文字，四語）。
   - 在兩儀殿設定頁切語言 → 大廳文字立刻變；重新整理後仍是新語言；回 `game.html` 也是。
   - 拉音效／音樂音量 → localStorage 值更新，而且兩儀殿正在用的音量值跟著變（讀頁面實際使用的變數或 gain 值，不是只看 localStorage）。
   - 換落子聲、換棋具 → 兩儀殿下一次落子／重畫用新的。
   - 兩人進房開始對局後，其中一人開設定再關：仍在房間、連線沒斷（WebSocket 沒有重連）、對手那邊沒看到他離開、計時繼續。
   - 預先放 `vcfgame.sound='0'` 進頁：有辦法在設定頁把聲音打開（照你查到的 `game.html` 做法驗）。
   - `game.html`：齒輪進設定頁、每一項仍可操作、返回鍵行為與改動前相同（改動前先記錄基準）。
   - 四語 × 兩種尺寸：兩儀殿大廳、房間、兩儀殿裡的設定頁、`game.html` 設定頁都不捲動。
   - 全程沒有 pageerror。
   - 負向測試：故意把一項期望改錯確認會 FAIL，再改回。
   - 截圖：zh 375×667 的兩儀殿大廳、房間、兩儀殿裡的設定頁；en 360×640 的兩儀殿裡的設定頁。**自己看每一張**，把問題寫進 REPORT。
3. 跑 `node docs/design/shop-2026-11-13/check/check_shop.mjs`（它的截圖會寫回 shop 資料夾——跑之前把它的輸出導到你自己的資料夾，或改用環境變數；做不到就不要跑，改成自己在腳本裡驗「首頁→商店、設定→棋具」仍可開）。

## REPORT.md 格式

改了什麼（逐檔、行號範圍）／共用檔怎麼切的、兩頁各自保留了什麼／`vcfgame.sound` 的處理／每項檢查的完整輸出／截圖裡看到的問題／沒做到或不確定的事（老實寫）。
