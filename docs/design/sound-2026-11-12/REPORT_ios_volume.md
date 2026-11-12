# 回報：Gomoku Rush 背景音樂音量（iPhone）

只改 `game.html`，未做任何 git 操作、未部署。測試用本機靜態伺服器（PID 77896，只關這個 PID），測試腳本放暫存資料夾，已刪除。

## 改了什麼（game.html）
- `bgmGet`（約 881–897 行）：軌物件多一個 `gain: null`，建立後呼叫 `bgmWire(bgm[n])`。
- 新增 `bgmWire(t)`：`audio()` 取共用 AudioContext → `createGain()`（初值 0）→ `createMediaElementSource(el).connect(gain).connect(destination)`；成功則 `t.gain = g`、`el.volume = 1`；`audio()` 回 null 或任何例外 → `t.gain = null`，維持舊的 `el.volume` 做法。
- 新增 `bgmSetVol(t, x)`：有 gain 設 `gain.gain.value`，否則設 `el.volume`。
- `bgmPauseAll` 與 `bgmStep` 原本寫 `el.volume = …` 的兩處改呼叫 `bgmSetVol`。
- 第 4 點（AudioContext 恢復）：`audioWake()` 已會 `resume()` 共用 context，音樂軌接在同一個 context，不需額外處理，沒加。

## 實測（Chromium 360x640）
1. 點畫面 2.5 秒後：menu `paused=false`、`el.volume=1`、gain=0.209。低於 0.24 是因為曲首 1.5 秒淡入（currentTime/1.5）還沒走完，不是錯。
2. 滑桿 60：gain=0.48（=0.6×0.8，吻合）。滑桿 0：menu `paused=true`、gain=0。當時只建立過 menu 一軌（play 尚未建立），所以「兩軌都 paused」只驗到 menu 這一軌。
3. 進解題畫面：play `paused=false`、gain=0.228（淡入中）；menu `paused=true`、gain=0.014（已淡出暫停，殘值無影響）。
4. `createMediaElementSource` 覆寫成 throw：menu 仍播放，`gain=null`、音量走 `el.volume`=0.24；切解題畫面後 play 播放、`el.volume`=0.2225、menu 暫停。
5. 兩輪 console 都沒有 error／pageerror。
6. 非 GET 請求：兩輪皆 0 筆被擋（無任何非 GET）。

## 沒做到／沒把握
- 沒有真的 iPhone Safari 可測，只在 Chromium 驗證邏輯；iOS 上 `createMediaElementSource` 配串流 mp3 是標準做法，但實機音量要使用者聽。
- 若 AudioContext 中途被 `closed` 後重建（罕見），舊軌 gain 仍連在舊 context，那條音樂可能無聲；未處理（原本 `audio()` 就會在 closed 時重建）。
- 滑桿 0 時兩軌都 paused 只驗到已建立的 menu 軌（程式碼對所有已建軌一視同仁）。
