# 兩儀殿小螢幕版面修正（2026-11-13，已上線）

使用者：「不修的話怎麼用...?」→ 修兩個做棋盤座標時量出的既有問題。只改 `duel.html`。

- **房名被擠成直排（320 寬）**：「自動」鈕從頂列搬到棋盤上方狀態行（`#status` 內的 `#bWatchAuto.vautob`，點擊範圍用 `::after` 撐到 44px）；房名 `nowrap`，放不下由 `fitTitle()` 縮字（下限 11px）再省略；≤374 寬頂列間隙縮小。
- **版面忽大忽小**：根因是 320 寬標題欄只有 80px，房號數字寬窄決定標題折不折行，折行後 `layout()` 走到縮緊版（棋盤 296↔242）。房名不再折行；≤374 寬 `layout()` 兩種排法都試、取棋盤大的。

驗收（主 session 重跑）：`check/check_narrow.mjs` 兩輪合計每項都過（各有 1 次測試建房逾時，不同語言，判定環境偶發）；`check/check_follow_copy.mjs` 109／0；`check/stab.mjs` 64 個畫面各載 10 次全穩定。跑法：先 `node check/env.mjs`（背景，印 READY），再跑檢查，結束用 `check/pids.json` 的 PID 關。

已知沒處理（見 `REPORT.md`「沒做到或不確定」）：英文 320 寬狀態行「Watching: 暱稱」會被省略成「Watching…」（下方玩家列仍有金框＋Watching 標籤）；「自動」鈕點擊範圍上緣 13px 蓋到上方玩家列下緣。
