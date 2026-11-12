# 施工單：Gomoku Rush 落子聲可選（9 種）

立即施工，不要輸出計畫、不要等確認。沒改檔就是失敗。回報用繁體中文，寫到本資料夾的 `REPORT_stone_sounds.md`。

## 硬性禁止
- 禁止任何 git 操作（add / commit / reset / stash / checkout / clean / pull / push）。
- 禁止部署（`tools/deploy_rush.sh`、wrangler 都不准跑）。
- 禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關你自己啟動的 PID。腳本前景執行並設逾時，不丟背景。
- 只准改 `C:\claudehome\projects\VCF\game.html`。不准動 `duel.html` 與其他檔。暫時測試腳本放系統暫存資料夾，做完刪掉；截圖放 `C:\claudehome\projects\VCF\docs\design\sound-2026-11-12\check\`。
- 禁手相關函式一律不碰。

## 先讀（都在 game.html）
- 聲音：搜尋 `// ---------- 聲音`，看 `audio()`、`sfxOut(a)`、`stoneSound(soft)`、`beep`、`vol`。
- 設定頁：搜尋 `id="sSet"` 與 `function renderSet`，看「聲音」那組兩條滑桿、語言列怎麼展開。
- 既有底部面板：`.modal`／`.box` 樣式與 `#mMsg` 的開關寫法（點外面關、Esc 關）。
- 文字：`I18N` 四種語言（zh／en／ja／ko）與 `T()`、`data-i18n`。

## 要做的事

### 1. 九種落子聲
把 `stoneSound(soft)` 改成依玩家選的種類發聲。存檔鍵 `vcfgame.sfx.stone`（用既有 `store`），預設 `wood`，值不認得時當 `wood`。

每種寫成一個純函式 `(a, out, t, v)`：`a` 是 AudioContext（或 OfflineAudioContext）、`out` 是要接上去的節點、`t` 是開始時間、`v` 是音量係數（一般落子 1、`soft` 時約 0.58，維持現在 0.35／0.6 的比例）。全部接到 `sfxOut(a)`。`wood` 必須跟現在的聲音完全一樣（同樣的參數）。

| id | 中文名 | 做法（合成參數，照這個做出明顯差異） |
|---|---|---|
| `wood` | 木頭 | 現在的：60ms 衰減雜訊過 1900Hz 帶通（Q 1.4）峰值 0.6＋正弦 420→160Hz 0.09 秒峰值 0.42 |
| `crisp` | 清脆 | 40ms 雜訊過 3200Hz 帶通（Q 2）峰值 0.55＋正弦 900→500Hz 0.05 秒峰值 0.3 |
| `deep` | 沉穩 | 80ms 雜訊過 900Hz 帶通（Q 1）峰值 0.5＋正弦 220→90Hz 0.14 秒峰值 0.55 |
| `soft` | 輕點 | 30ms 雜訊過 2400Hz 帶通（Q 1.2）峰值 0.28，沒有低頻那一下 |
| `slate` | 石板 | 35ms 雜訊過 4500Hz 帶通（Q 3）峰值 0.5＋正弦 1800→1200Hz 0.035 秒峰值 0.25 |
| `jade` | 玉石 | 兩個正弦 1400Hz 與 2100Hz 同時起音，0.12 秒指數衰減，峰值各 0.22；前面加 10ms 很短的雜訊 |
| `drop` | 水滴 | 正弦 600→1200Hz 往上滑 0.08 秒，峰值 0.4，起音 5ms |
| `bit` | 電子 | 方波 660Hz 0.04 秒接 880Hz 0.04 秒，峰值 0.16 |
| `drum` | 小鼓 | 三角波 180→80Hz 0.12 秒峰值 0.6＋50ms 雜訊過 1200Hz 低通峰值 0.2 |

所有增益包絡結尾都要降到 0.001 以下再停，避免爆音。倒數嗶聲 `beep` 不動。

### 2. 設定頁加一列
在設定頁「聲音」那組、兩條滑桿下面加一列，樣式跟下面「棋具」「語言」那種列一樣（左圖示、名稱、右邊顯示目前選的名稱與箭頭）：名稱「落子聲」。

點這一列打開一個底部面板（用既有 `.modal`／`.box`，id `mStone`，標題「落子聲」）：
- 九個選項排成 3 欄 × 3 列的按鈕格，每顆高度 ≥48px，顯示名稱；目前選的那顆用金色外框（`aria-pressed="true"`）。
- 點任何一顆：立刻播那個聲音一次（走目前的音效音量），同時選定並存檔；面板不關，方便連續試聽。
- 面板底下一顆「完成」按鈕關閉；點面板外、Esc 也能關。關閉後設定頁那一列顯示新選的名稱。
- 靜音（`soundOn` 為 false）時點選仍可選定，只是不出聲；面板內加一行小字提示「目前靜音中」（只在靜音時顯示）。

### 3. 文字
新文字全部加進 `I18N` 四種語言：列名「落子聲」、面板標題、「完成」、「目前靜音中」、九個聲音名稱。英日韓照意思翻，名稱要短（英文一個字為主：Wood、Crisp、Deep、Soft、Slate、Jade、Drop、Bit、Drum）。

## 驗證（結果寫進回報）
用 Python Playwright（寫法參考 `tools/promo/rush_promo.py`；非 GET 請求一律 abort）。起本機靜態伺服器（記 PID，結束只關這個 PID）。
1. **聲音有出來且彼此不同**：在頁面裡用 `OfflineAudioContext(1, 44100*0.4, 44100)` 逐一把九種各渲染一次（`v=1`，直接接 offline 的 destination），回報每種的：峰值（要在 0.05–1.0 之間）、能量降到峰值 1% 以下的時間、過零率（用來看高低有別）。九種的數值列成表。
2. `wood` 的渲染結果跟改之前的 `stoneSound` 參數一致（列出你比對的參數）。
3. **不捲動**：設定頁（面板關、面板開）在 375×667 與 360×640 × zh／en／ja／ko：`scrollHeight <= innerHeight`、`scrollWidth <= innerWidth`，面板 `.box` 完整在畫面內且內部不需要捲動（`box.scrollHeight <= box.clientHeight`）。語言列展開時設定頁也不可超出。列成表，任何一格超出要修到 0。
4. 選 `jade` 後重新整理：設定頁那列顯示玉石（或該語言的名稱），`store` 裡是 `jade`；進練習模式下一手棋不報錯。
5. 把 `vcfgame.sfx.stone` 設成亂字串再載入：當成 `wood`，不報錯。
6. 全程 console 沒有 error／pageerror。
7. 截圖：面板打開時 375×667 的 zh 與 en 各一張，存到上面指定的 `check\` 資料夾，檔名 `stone_zh_375x667.png`、`stone_en_375x667.png`。

## 回報內容
- 改了哪幾段（行號＋重點）。
- 上面七項的實測數值與表。
- 沒做到、沒把握、或自己做了取捨的地方。
