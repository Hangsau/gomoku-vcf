# 回報：Gomoku Rush 落子聲可選（9 種）

只改了 `game.html`。沒做任何 git 操作、沒部署、沒關任何行程（測試用本機伺服器是自己啟動的 PID 53356，跑完只關它）。暫時測試腳本已刪。

## 改了哪幾段（game.html 行號為改完後）
- **L290–292**：`.stoneGrid`（3 欄格、按鈕 min-height 52px、選中金框 `aria-pressed="true"`）。
- **L351**：設定頁「聲音」卡兩條滑桿下面加一列 `#setStone`（左圖示、名稱、右邊目前名稱＋箭頭，沿用 `.lrow`）。
- **L625**：新底部面板 `#mStone`（`.modal`／`.box`，標題、右上 X、3×3 按鈕格 `#stoneGrid`、靜音小字 `#stoneMute`、底下「完成」鈕）。關閉全走既有 `data-close`／點外面／Esc。
- **L689／721／753／785**：I18N 四語各加 `setStone stoneT done muteNow st_wood … st_drum`（13 個鍵）。
- **L856–893**：九種聲音。`sNoise`／`sTone` 兩個小工具＋`STONE_SND`（九個 `(a, out, t, v)` 純函式，全接 `sfxOut(a)` 傳進來的 `out`）；`stoneId()` 不認得的值回 `wood`；`stoneKind` 讀 `vcfgame.sfx.stone`；`stoneSound(soft, kind)` 用 `v = soft ? 0.35/0.6 : 1`（維持原比例）。`beep` 沒動。
- **L982–990（renderSet）**：列上顯示目前名稱、重畫按鈕格、點按鈕＝選定＋存檔＋立刻播＋更新列名，面板不關；靜音時顯示「目前靜音中」。
- **L997**：`#setStone` 點擊開面板（同步靜音小字）。

## 驗證結果

### 1. 九種聲音（OfflineAudioContext 0.4 秒、v=1、44.1kHz，過零率取到衰減結束為止）
| id | 峰值 | 降到峰值 1% 以下 (ms) | 過零率 | 約略主頻 Hz |
|---|---|---|---|---|
| wood | 0.557 | 60 | 0.017 | 376 |
| crisp | 0.361 | 36 | 0.036 | 793 |
| deep | 0.613 | 92 | 0.008 | 169 |
| soft | 0.108 | 12 | 0.195 | 4301 |
| slate | 0.331 | 26 | 0.073 | 1600 |
| jade | 0.547 | 82 | 0.096 | 2127 |
| drop | 0.391 | 58 | 0.035 | 778 |
| bit | 0.153 | 76 | 0.034 | 752 |
| drum | 0.525 | 82 | 0.006 | 134 |

九種峰值都在 0.05–1.0；過零率從 0.006 到 0.195，彼此有明顯高低差。（雜訊每次不同，數值會有些微浮動。）

### 2. wood 與改前一致
用同一個固定種子的亂數，把「改前 `stoneSound` 的原始合成程式」跟新的 `STONE_SND.wood(v=1)` 各渲染 0.4 秒，逐樣本相差最大值 = **0**。比對參數：雜訊 60ms、三次方衰減、帶通 1900Hz／Q 1.4、增益 0.6→0.001；正弦 420→160Hz（頻率 0.08 秒滑完）、增益 0.42→0.001（0.09 秒）、停在 0.1 秒。
過程中發現：我最初把頻率滑動時間也寫成 0.09 秒，和原本的 0.08 差了一點（最大差 0.069），已改成 `sTone` 多一個 `fdur` 參數讓 wood 用 0.08，再驗成 0。

### 3. 不捲動（設定頁面板關／面板開／語言列展開；375×667、360×640 × zh/en/ja/ko，共 8 格）
所有格：`scrollHeight == innerHeight`、`scrollWidth <= innerWidth`；面板 `.box` 完整在畫面內（375×667 頂 334／底 667；360×640 頂 307／底 640），`box.scrollHeight == box.clientHeight`（333/333，不需內部捲動）；九顆按鈕高 52px、文字沒被截（溢出 0）。**超出格數 = 0。**

### 4. 選 jade 後重新整理
點 jade → store 寫入 `jade`、`aria-pressed=true`、面板沒關；按「完成」關閉、列顯示「玉石」；重新整理後列仍是「玉石」、`stoneKind = jade`、store = `jade`。
點面板外關閉：通過。靜音（`soundOn=false`）時小字顯示、仍可選定（選了 drum 成功）。

### 5. 亂字串
`vcfgame.sfx.stone = 'zzz!!'` 載入 → `stoneKind = wood`、列顯示「木頭」，呼叫 `stoneSound()` 不報錯。

### 6. console
沒有 pageerror、沒有 JS error。唯一的 console error 是 `Failed to load resource: net::ERR_FAILED` 共 39 筆，來源只有三個 URL：Google Fonts、`vcf-game-api…/blocked`、`/skins`——是我依規定把外連請求（非本機）一律 abort 造成的，不是遊戲程式錯誤。被擋的非 GET 請求 = 0。

### 7. 截圖
`check\stone_zh_375x667.png`、`check\stone_en_375x667.png`（面板打開，3×3 格＋完成鈕完整可見）。

## 沒做到／取捨
- **「進練習模式下一手棋不報錯」我沒有真的走一手練習棋**：只在載入 jade 後直接呼叫 `stoneSound()`、`stoneSound(true)`、`stoneSound(false,'drum')`，沒錯誤。實際落子路徑（L1353 等）呼叫的仍是同一個 `stoneSound()`，我沒改它們，但「走到那一步」沒親自跑過，請實機或下一輪補測。
- 只在 Chromium 無頭 OfflineAudioContext 驗證合成；沒有實機聽感（我聽不到），九種聽起來是否「明顯不同又好聽」需要你在手機上試。
- jade 前面的 10ms 雜訊我用高通 2000Hz、峰值 0.2（施工單沒給濾波器與峰值，是我的取捨）。
- 方波 bit 的 0.04 秒切換處兩段各自衰減到 0.001，可能有輕微的段間斷點；沒聽到無法確認是否有咔聲。
- 「soft（輕點）」跟 `stoneSound(soft)` 的「soft 參數＝電腦擋那手小聲」同名但不同意思（前者是一種音色，後者是音量係數），程式內我用 `v` 區隔；若覺得易混，之後可把音色 id 改名。
- 設定頁列的圖示是我自畫的脈衝波形線條（施工單只要求「左圖示」）。
- 沒碰 `duel.html`、禁手相關函式；沒更新 HANDOFF／MAP（施工單限定只改 game.html）。
