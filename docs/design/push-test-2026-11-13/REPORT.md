# 通知最小測試 — REPORT（2026-11-13）

> **真的 iPhone、真的 Apple／Google 推播伺服器都沒辦法在這台電腦測，以下全部是「本機能驗到的部分」。「iPhone 收得到嗎、點了開不開進安裝版」尚未驗證，要靠使用者照最後一節用真手機測。**

## 改了什麼
| 檔案 | 改動 |
|---|---|
| `sw.js` | 只在最後加 `push`、`notificationclick` 兩個事件處理（其餘不動）。`push` 一定 `showNotification`（解析失敗也顯示，iOS 不准默默吃）；`notificationclick` 關通知、轉同網域絕對網址、有本站視窗就 `navigate`＋`focus`（`navigate` 不存在或丟錯改 `postMessage({t:'push-open',url})`＋`focus`），沒有就 `openWindow`。 |
| `game/worker/worker.js` | 新增一段 Web Push：`encryptPush`（RFC 8291 aes128gcm，純函式，可注入 salt 與本地金鑰）、`vapidAuth`（RFC 8292 ES256 JWT）、`sendPush(env, sub, payloadObj, ttl)`（回端點 HTTP 狀態碼；0＝網路錯、-1＝沒設金鑰；邀請功能之後重用）、三條路由 `GET /push/key`、`POST /push/sub`、`POST /push/test`；`fetch(req, env)` 改成 `fetch(req, env, ctx)`（給 `ctx.waitUntil`）。無 npm 套件，沒有任何金鑰寫進檔案（從 `env.VAPID_PUBLIC`／`env.VAPID_PRIVATE`〔JWK 字串〕讀）。加密區段用 `// ==PUSH-CRYPTO-BEGIN==`／`END` 標記，檢查腳本直接從 worker.js 抽出來測（測的就是會部署的那份程式）。 |
| `game/worker/schema.sql` | 加 `push_subs` 表與 `push_subs_pid` 索引（照施工單）。**線上 D1 還沒套**，部署前要派工者跑。 |
| `game/push-test.html` | 新檔，測試頁。 |
| `docs/design/push-test-2026-11-13/` | `PROGRESS.md`、`REPORT.md`、`check/`（腳本、輸出、截圖） |

沒有碰：`game.html`、`duel.html`、`game/duel-server/`、`manifest.webmanifest`；沒有任何 git 操作、沒有部署、沒有碰線上 D1。

### 部署前派工者要做的事
1. `wrangler secret put VAPID_PRIVATE`（私鑰 JWK 字串）、`VAPID_PUBLIC`（base64url 未壓縮公鑰，87 字元）。一組金鑰的產法：`check/setup_e2e.mjs` 裡有（`generateKey ECDSA P-256` → `exportKey raw`／`jwk`）。`deploy_worker.sh` 的 `vars` 目前沒有這兩項，secret 不受部署影響（但 `deploy_worker.sh` 會用 `wrangler deploy`，secret 會保留）。
2. 線上 D1 套 `push_subs` 兩行 SQL。
3. 公鑰與私鑰必須是同一把，否則端點會回 403。`/push/key` 回的是 `VAPID_PUBLIC`，不會檢查它跟私鑰是否成對——**部署後先用測試頁實測一次**。

## 第 5 點：讓安裝版開得到這頁（我的取捨）
**事實**：`manifest.webmanifest` 是 `start_url: ./game.html`、`scope: ./`（整站）、`display: standalone`。所以 `game/push-test.html` 在 scope 內，與主程式共用同一支 `sw.js`（根目錄註冊，scope `/`）與同一個來源。但安裝版沒有網址列，`game.html` 不准改，所以**沒有任何現成入口能從安裝版走到這頁**。

**可行做法評估**
- A. 用主程式的 manifest（`../manifest.webmanifest`）：從這頁「加到主畫面」只會裝出開 `game.html` 的主程式，**開不到這頁**。✘
- B. 這頁自帶一份 manifest（`data:` 網址，`start_url` 指向這頁、`scope` 整站、`display: standalone`、同樣圖示）：從這頁加到主畫面就得到一個開在這頁的獨立圖示「通知測試」，同來源、同一支 `sw.js`，不需要改 `game.html`。**這是我實作的做法**。
- C. 不帶 manifest，只靠 `apple-mobile-web-app-capable`：iOS 16.4+ 的網頁推播要求安裝版有 manifest，風險更高。✘
- D. 以後在 `game.html` 放一個連到這頁的入口（目前禁止）。需要的話這是最穩的備案，也是正式版邀請功能的方向：通知點擊本來就是開安裝版內的頁面。

**不確定的地方（沒辦法在這台驗）**
1. iOS Safari 是否接受 `data:` 網址的 manifest（我只能確認 Chrome 的行為與 manifest 內容正確）。**如果 iPhone 加到主畫面後開起來是 Gomoku Rush 首頁而不是這頁，就是 data: manifest 沒生效**，頁面的黃色說明已叫使用者回報。此時請改成備案：派工者在 `game/` 放一個真實的 `push-test.webmanifest`（這次不准新增檔案，所以沒做）或走 D。
2. iOS 把「安裝版」與 Safari 的 localStorage 分開（各有各的儲存空間）。所以**安裝版裡的 `pid` 跟 Safari 裡的不是同一個**——測試頁在安裝版內產生並使用自己的 `pid`，訂閱與發送都在同一個環境，不受影響；但正式版的「邀請」要注意玩家身分是以安裝版內為準。
3. 兩個圖示（主程式＋測試頁）同一來源，iOS 的推播權限是以「來源＋service worker」授予還是以「每個安裝版」授予，我不確定；測試時若「主程式安裝版」已允許過，測試頁圖示可能要再允許一次。
4. `data:` 裡的絕對網址用的是目前網頁的來源（`new URL('../', location.href)`），部署到 `rush.hangsau.app` 後會是正確的絕對網址。

## 自己做的其他取捨
- `push-test.html` 的 API 預設是線上 `https://vcf-game-api.psyhangsau.workers.dev`；只有在 `localhost`／`127.0.0.1` 才接受網址參數 `?api=` 覆蓋（本機測試用）。
- `/push/sub` 的 `p256dh` 必須解出 65 bytes、`auth` 必須 16 bytes，比「合理長度」更嚴格；非 https 端點一律 400（本機測試副本才放行 `http://127.0.0.1:`，見 `setup_e2e.mjs`，repo 的 worker.js 沒動）。
- `/push/test` 的 `url` 規則：必須 `/` 開頭、不能 `//` 開頭、不能含空白或反斜線、≤300 字。
- 限流是 Worker 記憶體計數（照施工單），Worker 實例重啟會歸零、多實例各算各的；測試用夠，邀請功能正式上線前要改成 D1 或 Durable Object。
- VAPID `sub` 用 `https://rush.hangsau.app/`（不放個人信箱）。
- `ctx.waitUntil` 裡等 `delay` 秒（最多 30）：Workers 在回應後給 `waitUntil` 約 30 秒，`delay=30` 再加送出時間會很貼近上限；測試頁只用 5 秒。
- 通知 `tag` 固定 `rush-test`（照施工單），新通知會取代舊的，邀請功能要改成唯一 tag。

## 檢查結果

### 1. 語法
```
node --check sw.js                                           -> 無輸出（通過）
node --input-type=module --check < game/worker/worker.js     -> 無輸出（通過）
push-test.html 的 <script> 抽出來 node --check               -> 無輸出（通過）
```

### 2. 加密正確性（`check/check_crypto.mjs`，Node 內建 WebCrypto，從 worker.js 抽出實際程式）
含 RFC 8291 附錄 A 測試向量：同樣的金鑰、salt、明文，密文逐字一致；另用獨立寫的解密函式解回 RFC 範例與隨機金鑰往返；VAPID JWT 驗簽，並有改一個 bit 的負向對照。
```
我的輸出  : DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN
RFC 預期  : DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN
PASS RFC 8291 附錄 A：密文與範例完全一致
PASS 獨立解密函式能解開 RFC 範例密文
PASS 檔頭：rs=4096、idlen=65
PASS 隨機金鑰：加密後能解回原文（含中文）
PASS Authorization 格式：vapid t=<jwt>, k=<pub>
PASS header alg=ES256
PASS claims：aud 只含 origin、exp、sub
PASS k= 是公鑰
PASS 簽章是 64 bytes（r||s，不是 DER）
PASS JWT 用公鑰驗簽成功
PASS 改一個 bit 驗簽失敗（負向對照）
PASS 11／FAIL 0
```

### 3a. 本機端到端（`check/check_e2e.mjs`）
做法：`check/setup_e2e.mjs` 把 worker.js 複製到系統暫存資料夾（`%TEMP%\push_e2e`，唯一改動是放行 `http://127.0.0.1:` 端點），產臨時 VAPID 金鑰放該處 `.dev.vars`（不進 repo），`wrangler@4.158.0 d1 execute --local` 套 schema、`wrangler dev --local --port 8798`；腳本自己開本機假推播端點。測完只關了自己啟動的 PID（workerd 21184、wrangler node 40792），確認 8798 不再監聽。**Worker 真的送出請求、帶 `Authorization: vapid`、`Content-Encoding: aes128gcm`、`TTL`，密文用訂閱私鑰解回原文**；410 會刪訂閱；限流 5 次後 429。
```
PASS GET /push/key 回 65 bytes 未壓縮公鑰
PASS sub：壞 JSON → 400
PASS sub：pid 太短 → 400
PASS sub：pid 含非法字元 → 400
PASS sub：非 https 端點 → 400
PASS sub：端點 >1000 字 → 400
PASS sub：p256dh 長度不對 → 400
PASS sub：auth 長度不對 → 400
PASS sub：缺 keys → 400
PASS test：delay 31 → 400
PASS test：delay -1 → 400
PASS test：url 不合法 → 400：https://evil.com/x
PASS test：url 不合法 → 400：//evil.com/x
PASS test：url 不合法 → 400：game/x
PASS test：url 不合法 → 400：/a b
PASS test：pid 不合法 → 400
PASS sub：合法訂閱 → 200 ok
PASS sub：同端點再送 → upsert 不報錯
PASS test：回 {ok:true,n:1}
PASS test：立即回應（不等 delay）
PASS delay 2 秒內還沒送出
PASS 假端點收到 1 個請求
PASS 請求打到訂閱的端點路徑
PASS Authorization: vapid t=…, k=…
PASS Content-Encoding: aes128gcm
PASS TTL: 60
PASS k= 等於 /push/key 的公鑰
PASS Worker 實際送出的 JWT 用公鑰驗簽成功
PASS JWT aud＝端點 origin、未過期
PASS 密文用訂閱私鑰解回原文
PASS test：自訂站內 url 接受
PASS 410 回應的那次有送出
PASS 自訂 url 進了通知內容
PASS 410 之後訂閱已被刪除（n=0）
PASS 限流：同 pid 前 5 次 200、第 6、7 次 429
PASS 別的 pid 不受限、沒訂閱 n=0
PASS 36／FAIL 0
```

### 3b. 測試頁在 Chromium（`check/check_page.mjs`，系統 Chrome、授予通知權限）
**無頭 Chromium 拿不到真的推播端點**：權限可以 granted、service worker 可以註冊，但 `pushManager.subscribe` 回 `AbortError: Registration failed - permission denied`（沒有 Google 推播服務）。所以**頁面上「允許通知→訂閱→/push/sub」的完整流程這台電腦沒走過**；`/push/sub`、`/push/test` 由 3a 用假訂閱覆蓋。頁面對這個錯誤有正確顯示原文（見記錄區）。
```
PASS 375×667 環境區顯示分頁／支援通知 
PASS 375×667 有注入 manifest 連結 
PASS manifest 內容：start_url／scope／display 
PASS 375×667 沒有橫向捲動 
--- 記錄區（375×667）---
09:36:21 環境：瀏覽器分頁；pid=4i57…
09:36:22 service worker 已註冊，scope=http://127.0.0.1:63992/
09:36:23 要求通知權限…
09:36:23 權限結果：granted
09:36:23 取得伺服器公鑰…
09:36:23 訂閱推播…
09:36:23 ✘ 錯誤：AbortError: Registration failed - permission denied
PASS 按「允許通知」→ 權限 granted 
PASS service worker 註冊成功（用同一個 ../sw.js） 
PASS 375×667 from=push 顯示「你是從通知進來的」 
PASS 複製按鈕：內容含環境與記錄 
PASS 沒有未捕捉的頁面錯誤 
PASS 360×640 環境區顯示分頁／支援通知 
PASS 360×640 有注入 manifest 連結 
PASS manifest 內容：start_url／scope／display 
PASS 360×640 沒有橫向捲動 
--- 記錄區（360×640）---
09:36:27 環境：瀏覽器分頁；pid=0y0d…
09:36:27 service worker 已註冊，scope=http://127.0.0.1:63992/
09:36:28 要求通知權限…
09:36:28 權限結果：granted
09:36:28 取得伺服器公鑰…
09:36:28 訂閱推播…
09:36:28 ✘ 錯誤：AbortError: Registration failed - permission denied
PASS 按「允許通知」→ 權限 granted 
PASS service worker 註冊成功（用同一個 ../sw.js） 
PASS 360×640 from=push 顯示「你是從通知進來的」 
PASS 複製按鈕：內容含環境與記錄 
PASS 沒有未捕捉的頁面錯誤 
PASS 18／FAIL 0
```

### 4. 截圖（`check/shots/`）
`page_375x667.png`、`page_360x640.png`（初始）、`*_after_allow.png`、`*_from_push.png`。我看過：375×667 與 360×640 都一屏內放得下主要內容（環境、兩顆按鈕、記錄、複製鈕），沒有橫向捲動、字沒被切；`from=push` 時頂端的綠框「你是從通知進來的＋現在開在：⚠️ 瀏覽器分頁（沒有開進安裝版）」夠顯眼，窄螢幕下副標會折成兩行（「安裝版」的「版」單獨一行，不影響閱讀）。

截圖裡看到的問題：
- 「裝置」在桌面 Chrome 顯示「其他」，正常。
- **iPhone 專用的黃色說明卡（`#iosHelp`）只在 iOS＋非安裝版時顯示，這台電腦沒有 iOS 環境，所以沒有截到、版面沒實際看過**（只靠程式與 CSS 檢查；它是純文字卡，風險低）。
- 「2. 5 秒後發…」按鈕與下方倒數間距略大（倒數區預留一行高度），不影響使用。

## 沒做到或不確定的事
- **沒有在真 iPhone／真 Android 測**：收不收得到、點了開進安裝版還是 Safari、`url` 參數帶不帶得到，全都未驗證。`notificationclick` 的邏輯（`navigate`／`postMessage`／`openWindow` 三條路徑）沒有自動測試，只有人工閱讀＋語法檢查。
- **沒有對 Apple（`web.push.apple.com`）或 Google（FCM）的真端點送過**；Apple 對 VAPID `sub`、`aud`、`exp`（≤24 小時，我用 12 小時）、`Content-Encoding`、`TTL` 的要求只是依規格實作。加密與簽章本身已用 RFC 向量驗過。
- data: manifest 在 iOS 是否生效未驗證（見第 5 點）。
- `push-test.html` 的 iOS 說明卡未實際看過畫面。
- 線上 D1 沒有套 schema、Worker 沒有 VAPID secret、沒有部署：全待派工者。
- 沒有手動測 `sw.js` 在 Chromium 內接到真的 push 事件（無頭拿不到端點）。

## 給使用者的測試步驟
（前提：派工者已經部署 Worker、設好兩個 VAPID secret、套好 D1 schema、並把 `game/push-test.html`、`sw.js` 部署到網站。）

### iPhone 版（iOS 16.4 以上）
1. 用 Safari（不要用 LINE 內建瀏覽器）打開 `https://rush.hangsau.app/game/push-test.html`。
2. 看頁面最上面「現在的環境」，確認「開在哪裡」是「瀏覽器分頁」。
3. 點 Safari 底部的分享鈕（方塊加向上箭頭）。
4. 選「加入主畫面」，名稱保持「通知測試」，按「加入」。
5. 回到手機主畫面，點新出現的「通知測試」圖示打開。
6. 如果打開來是 Gomoku Rush 首頁而不是測試頁：截圖給我，這就是結論，後面不用做。
7. 在測試頁確認「開在哪裡」是「安裝版」、「支援通知」是「支援」。
8. 按「1. 允許通知」，跳出系統詢問時按「允許」。
9. 看下面記錄區有出現「✔ 訂閱已送到伺服器」。有錯誤就按最下面「複製測試結果」貼給我。
10. 按「2. 5 秒後發一則通知給我」。
11. 馬上按手機的 Home 鍵或切到別的 App（把測試頁關掉）。
12. 等 5～10 秒，看有沒有跳出「Gomoku Rush：通知測試：點我」。
13. 點那則通知。
14. 看打開的是不是測試頁、頂端是不是綠色「你是從通知進來的」，以及下面寫的是「✅ 安裝版」還是「⚠️ 瀏覽器分頁」。**這一格就是最重要的結論。**
15. 按「複製測試結果」，貼回來給我。

### Android 版（Chrome）
1. 用 Chrome 打開 `https://rush.hangsau.app/game/push-test.html`。
2. 確認「開在哪裡」是「瀏覽器分頁」，按「1. 允許通知」，跳出詢問時按「允許」。
3. 看記錄區有出現「✔ 訂閱已送到伺服器」。
4. 按「2. 5 秒後發一則通知給我」。
5. 馬上切到別的 App 或鎖屏。
6. 等 5～10 秒，看有沒有跳出通知；點它。
7. 看打開的頁面頂端是不是綠色「你是從通知進來的」，以及是「安裝版」還是「瀏覽器分頁」。
8. （選做）Chrome 選單 →「安裝應用程式」或「加到主畫面」後，從主畫面圖示再做一次 1～7，看點通知會不會開進安裝版。
9. 按「複製測試結果」，貼回來給我。
