# 施工單：Gomoku Rush 背景音樂音量在 iPhone 上無效

立即施工，不要輸出計畫、不要等確認。沒改檔就是失敗。回報用繁體中文，寫到本資料夾的 `REPORT_ios_volume.md`。

## 硬性禁止
- 禁止任何 git 操作（add / commit / reset / stash / checkout / clean / pull / push）。
- 禁止部署（`tools/deploy_rush.sh`、wrangler 都不准跑）。
- 禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關你自己啟動的 PID。腳本前景執行並設逾時，不丟背景。
- 只准改 `C:\claudehome\projects\VCF\game.html`。不准動 `duel.html` 與其他檔（回報檔與你自己的暫時測試腳本除外，測試腳本放系統暫存資料夾，做完刪掉）。

## 問題
`game.html` 的背景音樂（搜尋 `BGM_MAX`、`bgmGet`、`bgmStep`、`bgmPauseAll`）用 `HTMLAudioElement.volume` 控制音量與淡入淡出。iOS Safari 的 `volume` 是唯讀、永遠 1，所以 iPhone 上音樂會以最大音量播放，設定頁的音樂滑桿和淡入淡出都沒作用。

## 修法
把音樂改成經過 Web Audio 的 GainNode 控制音量（不要用 fetch 解碼整檔，仍用 `HTMLAudioElement` 串流）：

1. 每個音樂元素在第一次要播放時（已在使用者點擊之後），用共用的 AudioContext 做 `createMediaElementSource(el)` → 自己的 `GainNode` → `destination`。每個元素只能建一次 source，建好存在該軌的物件上。
2. 有 GainNode 的軌：`el.volume` 固定 1，原本寫 `el.volume = X` 的地方改成設 `gain.gain.value = X`（`bgmStep` 的那行與 `bgmPauseAll`、`bgmGet` 的初始值）。
3. AudioContext 的取得：現有 `audio()` 在 `soundOn` 為 false 時回傳 null，那時音樂本來就不播，沒問題。若 AudioContext 建不起來或 `createMediaElementSource` 丟例外，退回原本的 `el.volume` 做法（保持現在的行為），不可讓遊戲出錯。
4. AudioContext 不是 `running` 時（iPhone 被電話或切 App 打斷後）音樂會沒聲音；現有 `audioWake()` 會在下一次碰畫面或切回來時 `resume()`，確認音樂軌也跟著恢復，不需要額外處理就不要加。
5. 不要改畫面、文字、存檔鍵與其他行為。

## 驗證（結果寫進回報）
專案已有 Python Playwright（參考 `tools/promo/rush_promo.py` 的啟動與「非 GET 請求一律 abort」寫法）。起本機靜態伺服器（記 PID，結束只關這個 PID），開 `game.html`：
1. 點一下畫面後：選單音樂 `paused === false`、`el.volume === 1`、該軌 GainNode 的 `gain.value` 約等於 (30/100)×0.8 = 0.24（淡入完成後）。
2. 把 `vcfgame.vol.bgm` 經設定頁滑桿改成 60：gain 約 0.48；改成 0：兩軌都 paused。
3. 進解題畫面：解題音樂在播且 gain 淡入、選單音樂淡出後 paused。
4. 模擬 `createMediaElementSource` 丟例外（測試裡覆寫成 throw）：音樂仍能播、音量走 `el.volume`，console 沒有未捕捉錯誤。
5. 全程 console 沒有 error／pageerror。
6. 測試不對線上送出任何非 GET 請求。

## 回報內容
- 改了哪幾行（貼改後的程式片段與行號）。
- 上面六項各自的實測數值。
- 沒做到或沒把握的地方。
