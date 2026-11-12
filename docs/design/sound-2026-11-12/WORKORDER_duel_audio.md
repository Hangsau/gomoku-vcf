# 施工單：兩儀殿接音樂／音量／落子聲；落子聲抽成共用檔

立即施工，不要輸出計畫、不要等確認。沒改檔就是失敗。回報用繁體中文，寫到本資料夾的 `REPORT_duel_audio.md`。

## 硬性禁止
- 禁止任何 git 操作（add / commit / reset / stash / checkout / clean / pull / push）。
- 禁止部署（`tools/deploy_rush.sh`、wrangler、`game/duel-server` 都不准部署）。
- 禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關你自己啟動的 PID。腳本前景執行並設逾時，不丟背景。
- 只准改：`C:\claudehome\projects\VCF\duel.html`、`C:\claudehome\projects\VCF\game.html`、新檔 `C:\claudehome\projects\VCF\game\sound.js`。不准動 `game/duel-server/`、`game/duel/`、`score.html`、`sw.js`、其他檔。暫時測試腳本放系統暫存資料夾，做完刪掉。
- 禁手相關函式、對局規則、連線程式一律不碰。兩儀殿的版面不改（不加列、不改高度；`layout()` 與 `--appH`、ResizeObserver 不動）。

## 背景（先讀）
`game.html` 今天加了三樣東西，兩儀殿（`duel.html`）都還沒有：
1. **音量**：`vcfgame.vol.sfx`（預設 70，gain = 值/70）、`vcfgame.vol.bgm`（預設 30）。看 `game.html` 的 `vol`、`sfxOut(a)`。
2. **背景音樂**：看 `game.html` 的 `// ---------- 背景音樂` 一節（`bgmGet`、`bgmWire`、`bgmSetVol`、`bgmStep`、`bgmSync`、`bgmTouch`）。
3. **九種落子聲**：看 `game.html` 的 `sNoise`、`sTone`、`STONE_SND`、`stoneId`、`stoneKind`、`stoneSound`；存檔鍵 `vcfgame.sfx.stone`。

`duel.html` 的聲音在 `// ---------- 聲音（照 game.html）` 一節：`audio()`、`stoneSound(soft)`、`chime()`、`renderSound`，全部直接接 `a.destination`。兩個頁面同網域，`store` 讀的是同一份 localStorage。

## 要做的事

### 1. 落子聲抽成共用檔 `game/sound.js`
- 把 `game.html` 的 `sNoise`、`sTone`、`STONE_SND`（九種）、`stoneId` 原封不動搬到新檔 `game/sound.js`，掛在 `window.RushSound = { STONE_SND, stoneId, IDS }`（`IDS` 是九個 id 的順序陣列）。合成參數一個數字都不能改。
- `game.html`：刪掉搬走的那幾段，改用 `RushSound`；在載入 `game/skin.js` 的那一行旁邊用同樣寫法載入 `<script src="game/sound.js?v=20261112a"></script>`，並加一樣的註解（改了就換號碼、`duel.html` 同步）。設定頁的落子聲面板、`stoneKind`、`stoneSound`、I18N 都留在 `game.html`，行為不可變。
- `duel.html`：同樣載入 `game/sound.js?v=20261112a`。

### 2. 兩儀殿的音量
- `duel.html` 加 `sfxOut(a)`（共用 master GainNode，gain = `vcfgame.vol.sfx`/70，沒值當 70，每次發聲時重讀），`stoneSound` 與 `chime` 都改接它。
- `stoneSound(soft)` 改成依 `vcfgame.sfx.stone` 用 `RushSound.STONE_SND` 發聲（寫法照 `game.html`；`RushSound` 萬一沒載到就退回現在這段寫死的木頭聲，不可報錯）。

### 3. 兩儀殿的背景音樂
- 全程只播一首 `game/music/duel.mp3`（已在 repo 裡），循環。照 `game.html` 的做法：`HTMLAudioElement`、`preload="none"`、經 `createMediaElementSource` → GainNode 控音量（建不起來退回 `el.volume`）、曲尾 1.5 秒淡出回開頭淡入、音量 = (`vcfgame.vol.bgm`/100)×0.8、值為 0 或靜音（`soundOn` false）就 pause、切到背景 pause 回來接著播、載不到安靜失敗。
- 啟動時機：掛 `pointerdown`、`click`、`keydown`、`touchend`（capture、passive）；該播而沒在播時先呼叫 `audio()` 再播。
- `[data-sound]` 喇叭按鈕按下時音樂跟著停／播。
- 兩儀殿不做設定介面（音量與落子聲種類到 Rush 的設定頁調），上方列的喇叭與語言按鈕維持原樣。

## 驗證（結果寫進回報）
用 Python Playwright（寫法參考 `tools/promo/rush_promo.py`；非 GET 請求一律 abort；WebSocket 連不上沒關係，大廳畫面會顯示連線中）。起本機靜態伺服器（記 PID，結束只關這個 PID）。
1. `game.html`：`RushSound.IDS.length === 9`；用 `OfflineAudioContext` 渲染九種，峰值表跟 `REPORT_stone_sounds.md` 的表對照（雜訊類會有些微浮動，純音類 jade／drop／bit 要一致）；設定頁落子聲面板能開、點 `jade` 後 `store` 是 `jade`、重新整理還在。
2. `game.html` 的 `wood`：用固定種子亂數，跟 `git show HEAD:game.html` 裡的 `STONE_SND.wood` 渲染結果逐樣本相差最大值為 0（`git show` 是唯讀，可以用）。
3. `duel.html`（手機模式 `has_touch=True, is_mobile=True`、375×667，啟動參數 `--autoplay-policy=document-user-activation-required`）：點畫面前沒有音樂元素或 paused；`touchscreen.tap` 一下後 2.5 秒，音樂 `paused === false`、`currentTime` 前進、AudioContext `running`、gain 約 0.24（淡入中略低可接受）。
4. `duel.html`：`vcfgame.vol.bgm='0'` 時不播；按喇叭靜音音樂 paused、再按接著播；`vcfgame.vol.sfx='35'` 時音效 master gain 為 0.5；`vcfgame.sfx.stone='drum'` 時呼叫 `stoneSound()` 與 `stoneSound(true)` 不報錯；把 `window.RushSound` 設成 undefined 再呼叫 `stoneSound()` 也不報錯。
5. 兩個頁面在 375×667、360×640 × zh／en／ja／ko：首頁（game）／大廳（duel）`scrollHeight <= innerHeight`、`scrollWidth <= innerWidth`（沒改版面，確認沒被影響）。
6. 兩個頁面全程沒有 pageerror；console error 只允許被你 abort 的外連請求與連不上的 WebSocket，逐類列出。

## 回報內容
- 改了哪幾段（檔名＋行號＋重點）。
- 上面六項的實測數值與表。
- 沒做到、沒把握、或自己做了取捨的地方。
