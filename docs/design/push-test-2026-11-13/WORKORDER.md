# 施工單：網頁通知最小測試（iPhone 能不能收到、點了會不會開進安裝版）

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 邊做邊把進度寫到本資料夾的 `PROGRESS.md`，最後寫 `REPORT.md`。

## 背景（2026-11-13）

iPhone 上，LINE 邀請連結只能開在 Safari，進不了「加到主畫面」的安裝版（Apple 的限制）。使用者不上架 App Store（沒有預算）。唯一免費又能「點了就開進安裝版」的路是**系統通知**：通知是發給安裝版的，點了會開安裝版。之後要做「邀請最近的對手 → 對方手機跳通知 → 點了進房」。

在做整套之前，先做一個**最小測試頁**讓使用者用真的 iPhone 驗證：收不收得到通知、點了是不是開進安裝版、能不能帶著網址參數。這張單只做測試，不做邀請功能。

## 限制（違反任何一條都算失敗）

- 禁止任何 git 操作。禁止部署（不跑 `tools/deploy_*.sh`、`wrangler deploy`、`wrangler secret`）。禁止對線上 D1 下指令。本機 `wrangler dev --local` 可以。
- 行程規則：禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關自己啟動的 PID。腳本前景執行＋逾時。不對系統 Python 裝套件。
- 只准改／新增（都在 `C:\claudehome\projects\VCF\`）：
  - 新檔 `game/push-test.html`
  - `sw.js`（只加 `push` 與 `notificationclick` 兩個事件處理，其餘不動）
  - `game/worker/worker.js`、`game/worker/schema.sql`
  - `docs/design/push-test-2026-11-13/` 底下的 `PROGRESS.md`、`REPORT.md`、`check/`
- 不准碰 `game.html`、`duel.html`、`game/duel-server/`、`manifest`（先讀它確認 `scope`、`start_url`、`display`，有問題寫進 REPORT，不要改）。
- **VAPID 私鑰不准寫進任何檔案**。程式從 `env.VAPID_PRIVATE`（Worker secret，JWK 字串）讀；公鑰從 `env.VAPID_PUBLIC`（base64url 的未壓縮 P-256 公鑰）讀，並由 `GET /push/key` 回給頁面。本機測試用你自己臨時產生的一組金鑰（放 `.dev.vars` 在系統暫存資料夾的測試副本裡，不進 repo），正式金鑰由派工者設定。
- `worker.js` 是單一檔案部署（見 `tools/deploy_worker.sh`），**不能用 npm 套件**；Web Push 的 VAPID 簽章（ES256 JWT）與內容加密（RFC 8291 `aes128gcm`）用 Workers 內建的 WebCrypto 自己寫。

## 先讀

`sw.js`（全檔）、網站的 manifest（從 `game.html` 的 `<link rel="manifest">` 找）、`game/worker/worker.js` 的路由表、`json()`、`cors`、`vidOk` 與一個 POST 路由的寫法、`tools/deploy_worker.sh`（看部署時有哪些 vars）、`game/worker/schema.sql`。

## 要做的

### 伺服器（`game/worker/worker.js`、`schema.sql`）

```sql
-- 通知訂閱（2026-11-13）：pid 玩家匿名編號、endpoint 推播端點（每個裝置一個）、p256dh／auth 加密用、ua 裝置字串（除錯）
CREATE TABLE IF NOT EXISTS push_subs(endpoint TEXT PRIMARY KEY, pid TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, ua TEXT, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS push_subs_pid ON push_subs(pid);
```

- `GET /push/key` → `{ key: env.VAPID_PUBLIC }`；沒設回 503。
- `POST /push/sub`，內容 `{ pid, sub: { endpoint, keys: { p256dh, auth } } }` → 檢查 `pid`（8–40 字元 `[A-Za-z0-9_-]`）、`endpoint` 是 https 網址且長度 ≤ 1000、兩把 key 是合理長度的 base64url → upsert。回 `{ ok: true }`。
- `POST /push/test`，內容 `{ pid, delay?, url? }` → `delay` 0–30 秒（預設 5）、`url` 必須是以 `/` 開頭的站內路徑（預設 `/game/push-test.html?from=push`）。用 `ctx.waitUntil` 等 `delay` 秒後，對這個 `pid` 的每個訂閱發一則通知，內容 JSON `{ title: 'Gomoku Rush', body: '通知測試：點我', url }`。端點回 404／410 的訂閱刪掉。立即回 `{ ok: true, n: 訂閱數 }`。
  - 同一個 `pid` 60 秒內最多 5 次（記憶體計數即可），超過回 429。
- 寫一個內部函式 `sendPush(env, sub, payloadObj, ttl)`（之後邀請功能要重用），回端點的 HTTP 狀態碼。

### `sw.js`

- `push`：讀 `event.data.json()`，`showNotification(title, { body, data: { url }, tag: 'rush-test' })`。iOS 要求每個 push 都要顯示通知，不可以默默吃掉。
- `notificationclick`：關掉通知；`url` 轉成同網域絕對網址；已經有開著的本站視窗就 `client.navigate(url)` 後 `focus()`（`navigate` 不存在或失敗就 `postMessage({ t: 'push-open', url })` 再 `focus()`），沒有就 `clients.openWindow(url)`。

### 測試頁 `game/push-test.html`

一頁、手機版面、深色（顏色抄 `game.html` 的 `:root`）、繁體中文就好（這是給使用者自己測的頁，不用四語）。由上到下：

1. **現在的環境**（自動偵測、用大字顯示）：
   - 「安裝版」或「瀏覽器分頁」（`matchMedia('(display-mode: standalone)')` 或 `navigator.standalone`）
   - 是不是 App 內建瀏覽器（LINE／FB／IG 的 UA）
   - 這個瀏覽器支不支援通知（`'PushManager' in window`、`Notification.permission` 目前的值）
   - 這頁是不是從通知點進來的（網址有 `from=push`）→ 是的話用最顯眼的方式顯示「你是從通知進來的」＋目前是安裝版還是瀏覽器分頁。**這一格就是測試結論。**
2. iPhone 不在安裝版裡時，顯示一段說明：「iPhone 要先『加到主畫面』，再從主畫面打開這一頁才能收通知」＋三步驟（分享鈕 → 加入主畫面 → 從主畫面開啟，再回到這頁；提示：安裝版開起來是首頁，網址列看不到，所以這頁要提供方法——見第 5 點）。
3. 按鈕「允許通知」：必須在按鈕點擊裡呼叫 `Notification.requestPermission()`；成功後 `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`，把訂閱送 `/push/sub`。`pid` 用 localStorage 的 `vcfgame.duel.id`（沒有就照 `duel.html` 同樣的方式產生並存起來——先讀 `duel.html` 第 604 行附近）。每一步的結果（成功／錯誤訊息原文）印在頁面上的記錄區。
4. 按鈕「5 秒後發一則通知給我」→ `/push/test`。按完顯示倒數，並提示「現在把畫面關掉或切到別的 App」。
5. 讓安裝版開得到這頁：`game.html` 不准改，所以在 REPORT 裡寫清楚「使用者要怎麼在安裝版裡打開 `/game/push-test.html`」的可行做法（例如這頁自己可以被「加到主畫面」成為獨立圖示嗎？它的 manifest 連結要怎麼設才會跟主程式同一個安裝版／同一個 scope？）。**選一個最不容易出錯的做法實作在這頁上**，並把你的判斷與不確定寫進 REPORT。
6. 頁尾：一顆「複製測試結果」把上面的環境資訊與記錄區文字複製到剪貼簿，方便使用者貼回來。

Service worker 的註冊：先看 `game.html` 怎麼註冊 `sw.js`（路徑與 scope），測試頁用同一個註冊，不要另外註冊第二個。

## 檢查（結果全部貼進 REPORT.md）

1. `node --check sw.js`；`worker.js` 的語法檢查照 `docs/design/skins2-2026-11-12/WORKORDER.md` 階段 5 第 1 點；`push-test.html` 的 script 抽出來 `node --check`。
2. 加密正確性（最重要，沒有真手機時唯一能驗的）：寫 `check/check_crypto.mjs`，用 Node 內建 WebCrypto，拿 **RFC 8291 附錄的測試向量**驗證你的 `aes128gcm` 加密函式（同樣的輸入金鑰、salt、明文要得到同樣的密文），並驗證 VAPID JWT 可以用公鑰驗簽成功。為了能測，把加密寫成可以注入 salt 與本地金鑰的純函式。
3. 本機端到端：`wrangler dev --local`（測試副本放系統暫存資料夾，照 `docs/design/shop-2026-11-13/REPORT.md`「階段 4-2」的做法）＋Playwright 的 Chromium 開測試頁（授予 notifications 權限）。能驗到哪就驗到哪：`/push/key`、`/push/sub` 寫進本機 D1、`/push/test` 回應與限流、格式錯回 400。Chromium 在無頭環境通常拿不到真的推播端點——拿不到就明寫，並改用假的本機端點（自己開一個本機 HTTP 伺服器當端點）確認 Worker 真的送出了請求、帶著 `Authorization: vapid …`、`Content-Encoding: aes128gcm`、`TTL`，而且密文能用訂閱的私鑰解回原文。
4. 測試頁在 375×667、360×640 的截圖各一張，自己看、把問題寫進 REPORT。

## REPORT.md 格式

改了什麼／自己做的取捨（特別是第 5 點）／每項檢查的完整輸出／截圖裡看到的問題／沒做到或不確定的事。**真的 iPhone、真的 Apple 推播伺服器都沒辦法在這台電腦測，要明寫，不要寫成已驗證。** 最後附一段「給使用者的測試步驟」（iPhone 版、Android 版各一份，白話、一步一行）。
