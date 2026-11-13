# 通知最小測試（2026-11-13）

目的：確認 iPhone／Android 的安裝版收得到網頁通知、點通知會開進安裝版。通過才做「揪人」（開房後廣播通知：公開房→所有開了通知的玩家；私人房→最近的對手）。

## 狀態

- 程式已上線（2ce1d7c）：`game/push-test.html`、`sw.js` 的 `push`／`notificationclick`、Worker 的 `/push/key`、`/push/sub`、`/push/test`、D1 `push_subs` 表已建。
- 入口：遊戲「設定」頁最下面的「通知測試」（**暫時的**，測完拿掉；`game.html` 的 `#openPushTest`）。測試頁上方有「← 回遊戲」。
- **還缺一步：Worker 的兩個 secret `VAPID_PUBLIC`、`VAPID_PRIVATE` 沒設**（主 session 嘗試 `wrangler secret put` 被 auto mode 權限擋下，等使用者同意）。沒設之前 `/push/key` 回 503，測試頁按「允許通知」會失敗。
  - 做法：用 Node WebCrypto 產一組 ECDSA P-256 金鑰（`check/setup_e2e.mjs` 有寫法）；公鑰 raw→base64url、私鑰 JWK 字串；`npx wrangler@4.158.0 secret put VAPID_PUBLIC --name vcf-game-api`、`… VAPID_PRIVATE …`（從 stdin 餵，私鑰不落地、不進 repo、不貼對話）。
  - 設好後：`curl https://vcf-game-api.psyhangsau.workers.dev/push/key` 應回 `{ key }`。
- 使用者測試步驟：`REPORT.md` 最後一節，但入口改成「打開已安裝的 Gomoku Rush → 設定 → 通知測試」（不用另外把測試頁加到主畫面）。

## 驗證到哪

本機：加密與簽章對過 RFC 8291 測試向量、Worker 對假端點真的送出正確請求（`check/`）。真的 Apple／Google 推播伺服器與真手機都沒測過。
