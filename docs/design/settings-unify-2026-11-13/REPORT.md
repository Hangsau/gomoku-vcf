# REPORT：兩儀殿聲音鈕、語言鈕收進共用設定頁（2026-11-13）

結果：檢查 91 PASS／0 FAIL（連跑兩次都過）；負向測試（NEG=1，把「大廳齒輪數」期望改成 2）如預期 FAIL 1 項。沒有做任何 git 操作、沒有部署；行程只關自己啟動的 PID（腳本內 taskkill /PID）。

## 改了什麼（逐檔）

- **新檔 `game/settings.js`**（約 236 行）：整份設定頁——帳號卡、落子音效／音樂音量、落子聲（含選單視窗）、棋具列、語言列、給作者留言（含視窗、送 `apiBase + '/feedback'`）。自帶樣式（全限定在 `.rsx` 底下，值逐項從 game.html 原 `#sSet`／`.modal`／`.rform`／`.stoneGrid` 規則複製）與四語文字（從 game.html I18N 抽出的 set*／acc*／msg*／st_*／close／done／muteNow／stoneT／home）。`RushSettings.init(opts)`：給 `host` 就畫在該元素裡（game.html），不給就自建全屏疊層 `#rsOverlay`（duel.html，z-index 30，在棋具頁 40／商店 41 之下）。自己讀寫 `vcfgame.vol.sfx`、`vcfgame.vol.bgm`、`vcfgame.sfx.stone`；語言與音量／落子聲的即時套用靠宿主的回呼（`setLang`、`onVol`、`onStone`、`previewStone`、`getSound`、`setSound`）。另外把 `window.renderSet` 指到它的 render（skin-picker.js 與 `RushSkin.onChange` 重畫用）。
- **`game.html`**：
  - CSS：刪掉原 `#sSet …`、`.stoneGrid …` 規則（約 L263 起換成一行註解）。
  - HTML：`<section id="sSet">` 改成空容器（L310 附近）；刪掉 `#mMsg`、`#mStone` 兩個視窗。
  - JS：刪掉原 `renderSet()` 與設定頁所有事件綁定，換成 `RushSettings.init({ host: $('sSet'), … })` 接線（L913–924）；刪掉 `openMsg`／`msgSend` 處理；保留 `$('openSet').onclick = () => show('sSet')`。L569 新增 `<script src="game/settings.js?v=20261113a">`。
  - 沒動：首頁與解題畫面的兩顆 `[data-sound]` 喇叭鈕、`soundOn`／`stoneSound`／`bgm*`、`show()`、`openModal`。
- **`duel.html`**：
  - 大廳右上角（L186）與房間右上角（L204）：喇叭鈕、地球鈕、`#langs` 選單全拿掉，各換一顆齒輪（`data-set-open`，圖示與 game.html `#openSet` 相同，48×48）。
  - 刪 `.langs` CSS、`langMenu`／`langBtn` 程式、`SND_ON/SND_OFF`、`renderSound` 與 `[data-sound]` 綁定；`applyLang()` 改成幫齒輪設 aria-label、重畫設定頁（若開著）。
  - L594–605 新增接線：`window.RushLang`（給 skin-picker／shop 取語言）、`RushSettings.init({…, unmuteOnVol: true})`、齒輪 onclick。
  - `stoneSound(soft, kind)` 多一個 kind 參數（設定頁試聽用）。`window.__duel`（只有本機）多暴露 `bgmVolume`、`volOf`（檢查用）。
  - L328 起新增載入 `game/settings.js`、`game/skin-picker.js`、`game/shop.js`（棋具頁、商店頁才開得起來）。順手更新一則過時註解。
  - 沒動：`// showInApp();` 那行、`RV.free`／`rvTap`、WebSocket、房間邏輯、計時。duel.html 原本整檔 CRLF，已維持 CRLF。
- **`game/skin-picker.js`、`game/shop.js`**（各只改 1 行）：`L()` 取語言時，全域 `lang` 不存在就用 `window.RushLang()`（duel.html 的 lang 是模組內變數）。game.html 行為不變。
- 沒動：`sw.js`（只有網路優先的 fetch 快取，沒有預載清單）、`game/skin.js`、`game/sound.js`、`game/duel-server/`、`game/worker/`、`game/learn/`、`score.html`。

## 共用檔怎麼切的、兩頁各自保留什麼

- 共用（`settings.js`）：設定頁的 HTML、樣式、四語文字、留言送出、音量／落子聲／語言的存檔與 UI 狀態。
- game.html 保留：喇叭鈕（首頁、解題）、音訊引擎與 BGM、`show()` 畫面切換（設定頁仍是 `sSet` 這個畫面，開啟方式、返回鍵、不 pushState 都跟改前相同）。
- duel.html 保留：自己的音訊引擎與 BGM、疊層開關（齒輪／返回鈕／Esc）。疊層不寫 history，關掉就回到原本大廳／房間，對局、連線、計時照跑。
- 棋具頁／商店頁的 pushState 行為沒改（棋具頁自己 `pushState({skin:1})`，跟 game.html 一樣）。兩儀殿裡按返回鍵時，棋具頁開著就先關棋具頁。

## `vcfgame.sound` 怎麼處理的

- 查到的 game.html 現況：設定頁**沒有**總開關，只有兩個音量滑桿；總開關 `vcfgame.sound` 由首頁、解題畫面的喇叭鈕（`[data-sound]`）切；設定頁只在「落子聲」視窗顯示「目前靜音中」（`soundOn` 為 false 時）。音量拉到 0 不會關 `soundOn`，但 `bgmWanted()` 要 `vol.bgm > 0`，音效 gain 為 0 → 聽起來等於全關。
- game.html：完全照舊（喇叭鈕還在，設定頁行為不變）。
- 兩儀殿：喇叭鈕拿掉後，玩家用設定頁的兩條音量，拉到 0 即視同關（音樂不播、音效 gain=0）。舊玩家 `vcfgame.sound='0'`：`unmuteOnVol` 開啟——拉任一條音量到 >0 就 `setSound(true)`（寫回 `vcfgame.sound='1'`、重新同步音樂），「目前靜音中」提示同時消失。這是我加的小機制（不是 game.html 現有做法，因為 game.html 有喇叭鈕所以不需要；工單說不要另創，但「靜音又沒地方打開」必須避免，這是最小解，只在兩儀殿開啟）。**請使用者確認**：若偏好「進兩儀殿偵測到 sound='0' 就直接打開」或「設定頁加總開關」，再改。

## 檢查輸出

1. 語法：`node --check game/settings.js`、`game/skin-picker.js`、`game/shop.js` 通過；game.html 抽出的 classic script、duel.html 抽出的 module script 通過（輸出：settings ok／picker/shop ok／game-scripts ok／duel-module ok）。
2. `check/check_settings.mjs`（完整輸出在 `check/run_final.txt`，負向在 `check/run_neg.txt`）。節摘：
   - 1. 大廳與房間：沒有 `[data-sound]`、`#langBtn`、`#langs`；各一顆齒輪 48×48 ✓
   - 2. 四語（zh/en/ja/ko）：兩頁設定頁都出現；列數 7/7（帳號卡、音效、音樂、落子聲、棋具、語言、留言）；每列文字（13 段）相同；`.setBody` 的 outerHTML 完全相同（3279/3403/3301/3302 字元）✓
   - 3. 兩儀殿切英文：大廳「開房 → Open a room」立刻變、設定頁標題 Settings；重整仍是英文；game.html 也是英文 ✓
   - 4. 音量：音效 20 → localStorage=20、master gain=0.2857（20/70）、頁面 `volOf`=20；90 → gain 1.2857；音樂 55 → `bgmVolume()`=55、音樂 gain 節點 0.44（=55/100×0.8，播放中）；音樂 0 → 暫停 ✓
   - 5. 落子聲換「玉石」→ 存檔、當場試聽播 jade、`stoneSound()` 下一次播 jade（包住 `RushSound.STONE_SND` 驗）；棋具頁在兩儀殿裡打開，換棋盤 classic→green，兩儀殿重畫 3 次且都用新盤（`green|flat`）；關棋具頁回設定頁 ✓
   - 6. 兩人對局中 A 開設定、拉音量、關：計時在設定頁開著時仍走（5:00→4:59）；A 仍在房間、WebSocket 建立次數 1→1、readyState 1、同一個物件（沒重連）；B 座位清單不變、狀態 play；關掉後計時繼續；Esc 可關 ✓
   - 7. `vcfgame.sound='0'`：進頁 `soundOn=false`、落子聲視窗顯示「目前靜音中」；拉音效音量後 `soundOn=true`、`vcfgame.sound='1'`、AudioContext 可建、提示消失；兩條拉到 0 頁面讀到 0；game.html 喇叭鈕仍在（2 顆）✓
   - 8. game.html：開設定頁不新增歷史（`history.length` 2→2、state、hash 不變；改前程式 `show('sSet')` 本來就不 pushState——這是從程式碼推出的基準，我沒有改前頁面的實測錄影，因為動手前沒先跑；只能用程式碼證明）；音量／落子聲（頁面 `vol`、`stoneKind` 同步）／語言（切日文）／留言（`/feedback` 收到 text 與 lang=ja、狀態文字正確）／棋具頁／返回鈕／首頁購物袋→商店頁（Esc 關）都可操作；開設定頁後瀏覽器返回 `goBack()` 回 null（無上一頁，跟改前無歷史一致）✓
   - 9. 四語 × 375×667、360×640：兩儀殿大廳、房間、兩儀殿大廳裡的設定頁、房間裡的設定頁、game.html 設定頁，全部 doc 高度 = 視窗高、寬無溢出、疊層內溢出 0、最後一項底（最深 547px）都在視窗內 ✓
   - 全程 pageerror／console error：0 ✓
   - 負向（NEG=1）：「大廳一顆齒輪」期望改成 2 → FAIL 1（`大廳一顆齒輪，觸控 48x48`），其餘 90 PASS；已改回，正向 91 PASS。
3. `check_shop.mjs`：**沒跑**（它的截圖寫回 shop 資料夾，工單說做不到就不要跑）。改在自己的腳本驗：首頁購物袋 `#openShop` → 商店頁可開、Esc 可關；設定→棋具列 → 棋具頁可開、可關回設定頁（第 8 項）。

## 截圖（我自己看過，`check/shots/`）

- `duel_lobby_zh_375x667.png`：右上只有一顆齒輪，標題置中，沒擠。畫面裡兩間房是本機 wrangler 殘留的測試房間，非本次改動。
- `duel_room_zh_375x667.png`：房間右上角「邀請」＋齒輪，間距正常，標題「房間 2454」沒被擠掉。
- `duel_settings_zh_375x667.png`、`game_settings_zh_375x667.png`：兩張看起來完全一樣（符合 HTML 相同的檢查），一屏、下方留白，沒有捲動。
- `duel_settings_en_360x640.png`：英文帳號卡副標折兩行、「Board & stones」值「Wood・Flat」沒被截；沒問題。
- 觀察（不是這次引入）：「棋具」列左邊的雙圓圖示比其他列圖示略偏上（原 game.html 就是這樣，樣式不准改所以沒動）。

## 沒做到／不確定的事

1. **`vcfgame.sound='0'` 解法是我加的**（見上），需要使用者確認。
2. **game.html 的 `I18N` 裡舊的 set*／acc*／msg*／st_*／muteNow／stoneT 文字鍵沒刪**（已不被設定頁使用；`close`、`done` 別處還在用，msgBtn 等我沒逐一確認有無他處引用）。沒刪是為了不超出「搬動與共用」範圍；之後可清。`STONE_IDS` 解構也殘留未使用。
3. 兩儀殿沒有 `[data-sound]` 之後，房間裡沒有「一鍵靜音」；要靜音得開設定頁拉兩條。
4. 沒有跑改前頁面的實測基準（見檢查 8），返回鍵「跟改前相同」是靠程式碼對照與 `history` 前後不變證明。
5. 兩儀殿 `sw.js` 無需改（網路優先快取），瀏覽器若快取 settings.js 四小時內可能舊檔；已用 `?v=20261113a`，上線時換版號即可。
6. 檢查用的 wrangler 本機兩儀殿偶爾 `sit` 搶座位（創房者座位隨機），腳本已改成坐另一個空位；與產品程式無關。
