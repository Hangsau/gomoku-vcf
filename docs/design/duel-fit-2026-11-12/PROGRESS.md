# 進度（接手者）

## 階段 1 重現（duel.html 未改時量的）— 完成
- 基本矩陣 320 組：全部超出 0（前一位 286 組 `check/matrix-pre.txt`＋接手補跑 284 起 36 組 `check/matrix-pre-rest.txt`）。
- 施工單列的特殊情境 18 組（`check/extra-pre.txt`）：全部超出 0。
- 追加情境 90 組（`check/extra2.mjs`，結果 `check/extra2-pre.txt`）：29 組有超出，分三類：
  1. 視窗高度變了但頁面沒收到 resize（人為把事件吃掉）：915→700 塔拉，文件超出 14px，認輸鈕還在畫面內。
  2. 對局中字突然變大（人為改樣式表，沒有任何事件）：700 高、×1.5 時認輸鈕掉到畫面下 45px。
  3. 很小的視窗（棋盤已縮到下限 240 還放不下）：330×632 英文 Swap2 認輸鈕低 4px；320×610 英文 26px；320×570 最多 66px；275×527 最多 109px。
  （「大廳 450 高進房」那幾組的超出都發生在 450 高當下，變回 790／700 後沒有超出。）
- 412 寬、高 640～915 的一般情況：沒有重現使用者說的狀況。

## 階段 2 修 — 已改 duel.html（見 REPORT.md）
- 改動：`duel.html` CSS 加 `#sRoom.tight` 一組（128–138 行）、`layout()` 改成先照舊算、放不下才加 `.tight` 並把棋盤下限放到 200（902–912 行）、新增 `layoutSoon()`＋ResizeObserver／visualViewport／fonts.ready（915–921 行）。

## 階段 3 驗 — 進行中
- `check/extra2.mjs`（90 組）修改後：超出 0、錯誤 0（`check/extra2-post.txt`）；412×450 那個模擬鍵盤的高度仍放不下（最多 57px），另列。
- 同一支腳本開「修改前的頁面」（`ORIG=1`，`check/duel-orig.html`＝git HEAD 版加一行 base）：抓到 21 組超出（`check/extra2-orig.txt`）＝故意弄錯有抓到。
- `check/loop.mjs`：靜止 3 秒內 ResizeObserver 回呼 0 次，PASS 5／FAIL 0。
- 修前修後截圖各 21 張在 `check/shots/`（pre_／post_）。
- 待跑：`fit.mjs all`（跑中）、`duel-modes` 的 `run.mjs`。

## 派工者補充後（使用者：塔拉、有計時、裝成 App、一進房就要捲）
- 機制驗證（`check/dvh.mjs`，結果 `check/dvh-result.txt`）：把頁面裡的 `100dvh` 換成 `calc(100dvh + 48px)` 模擬「dvh 比 window.innerHeight 高 48」。
  - 修改前：412×915／412×870、塔拉 10+10，一進房文件就超出 48px，棋盤從 396 白縮到 348，認輸鈕／離開鈕底邊仍在視窗下 32px；大廳的「開房」鈕也在視窗下 32px。＝派工者說的機制成立（電腦上模擬）。
  - 修改後（`.app` 高度改用 layout() 寫進去的 `--appH`＝window.innerHeight）：同樣情境全部在視窗內，棋盤 396。
  - CDP `Emulation.setSafeAreaInsetsOverride`（上 48、下 32）有生效（標題列 padding 52、按鈕列 padding 48）：修改前後都不用捲。
- `dvh.mjs`：PASS 14／FAIL 0。
- 線上 `https://rush.hangsau.app/duel` 標頭：`Cache-Control: public, max-age=0, must-revalidate`；`sw.js` 是網路優先。
- 跑中：`fit.mjs all`（最終版頁面）。之後：extra2、loop、run.mjs。
