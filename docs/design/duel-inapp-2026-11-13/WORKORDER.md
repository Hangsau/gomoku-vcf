# 施工單：兩儀殿邀請連結在 LINE 等內建瀏覽器開啟的處理

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 邊做邊把進度寫到本資料夾的 `PROGRESS.md`，最後寫 `REPORT.md`。

## 背景（使用者 2026-11-13 回報）

用 LINE 傳邀請連結，朋友點了會在 LINE 內建的瀏覽器開，不是他已經安裝好的那個版本。內建瀏覽器的資料（暱稱、紀錄、商店領的棋具）跟安裝版是分開的。其他通訊軟體也有同樣問題。

## 限制（違反任何一條都算失敗）

- 禁止任何 git 操作（含 `git status`、`git diff`）。commit 由派工者驗收後做。
- 禁止部署（不跑 `tools/deploy_*.sh`、不跑 `wrangler deploy`）。本機 `wrangler dev` 可以。
- 行程規則：禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關自己啟動的 PID。腳本前景執行＋逾時。這台電腦有別人的 python 訓練在跑。
- 不對系統 Python 裝套件。
- 只准改 `C:\claudehome\projects\VCF\duel.html`，以及在 `docs/design/duel-inapp-2026-11-13/` 底下新增 `PROGRESS.md`、`REPORT.md`、`check/`。其他一律不准碰（特別是 `game/duel-server/`、`game.html`、`game/skin.js`、`game/shop.js`）。
- 伺服器不用改。

## 先讀

`duel.html`：第 661–690 行附近（`inviteUrl`、`inviteDesc`、`inviteText`、`copyInvite`、分享鈕）、處理網址 `?r=` 的那段（收到 `hello` 後送 `join`、`replaceState` 拿掉 `r`）、`I18N` 四語、既有底部面板 `.modal` 的寫法（例如 `mJoin`、「房間已關」那個面板）、`toast`。上一輪的施工單與測試寫法：`docs/design/duel-invite-2026-11-12/WORKORDER.md` 與同資料夾的檢查腳本。

## 要做的三件事

### 1. 邀請連結加 LINE 的參數

- `inviteUrl()` 產生的網址加 `&openExternalBrowser=1`（LINE 官方參數：LINE 看到就改用手機預設瀏覽器開；其他軟體會忽略它）。
- 進頁時如果網址有 `openExternalBrowser`，跟 `r` 一起用 `history.replaceState` 拿掉（沒有 `r` 時也要拿掉）。既有的 `?r=`、`?lang=` 行為不能變。

### 2. 在內建瀏覽器裡顯示提示

- 寫一個 `inAppBrowser()`，從 `navigator.userAgent` 判斷，回傳 `'line'`／`'fb'`（`FBAN`、`FBAV`、`FB_IAB`、Messenger）／`'ig'`（`Instagram`）／`'wechat'`（`MicroMessenger`）／`'kakao'`（`KAKAOTALK`）／`null`。再寫 `isAndroid()`、`isIOS()`。
- 偵測到在內建瀏覽器時，進頁後顯示一個**既有樣式的底部面板**（沿用 `.modal`，不要發明新版型），每次進頁最多出現一次，關掉後這個分頁不再出現（`sessionStorage`）：
  - 標題：「用瀏覽器開啟」
  - 一行說明：「這裡是 App 內建的瀏覽器，你的暱稱和紀錄不會跟著過來。」
  - **Android**：主按鈕「用瀏覽器開啟」。
    - LINE：把目前網址加上 `openExternalBrowser=1` 後 `location.href` 過去（連結本來沒帶參數的情況，例如舊連結）。
    - 其他：導向 `intent://<host><path><query>#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=<編碼後的原網址>;end`。
    - 要帶著 `r` 與 `lang`：如果 `r` 已經被 `replaceState` 拿掉，進頁時先把原始邀請碼記在變數裡，組網址時加回去。
  - **iOS**：沒有可靠的自動跳法。LINE 一樣用 `openExternalBrowser=1`；其他顯示一行操作說明「點右上角 ⋯ → 用瀏覽器開啟」（這裡的「⋯」是文字不是 emoji，可以用），加一顆「複製連結」（複製含 `r` 的完整網址，沿用 `copyInvite` 的複製方式與「已複製」提示）。
  - 次要按鈕：「先在這裡玩」（關掉面板，照常進房）。面板出現時不可以擋住或延後既有的 `join` 流程——關掉面板後人應該已經在房裡。
- 不在內建瀏覽器時，完全沒有任何變化。
- 新文字加進 `I18N` 四語（zh／en／ja／ko），簡短。

### 3. 分享文字寫明邀請碼

- `inviteText()` 多一行「邀請碼：XXXXXX」（四語），放在網址之前，讓收到的人可以自己打開安裝版、在大廳按「輸入邀請碼」進房。
- 邀請面板那行說明（`inviteNote`）裡的「不用安裝、不用註冊」保留。

## 檢查（結果全部貼進 REPORT.md）

1. 把 `duel.html` 的 `<script>` 內容抽出來做語法檢查（做法自己定，說明怎麼做的）。
2. 寫 `check/check_inapp.mjs`（Playwright；本機靜態伺服器與本機對戰伺服器的起法、多個 context 當不同玩家的寫法，照 `docs/design/today-home-2026-11-13/check/run.mjs`）。用 `browser.newContext({ userAgent })` 假裝各種環境：
   - 一般 Chrome（Android、桌機）、iOS Safari：沒有面板。
   - LINE Android、LINE iOS、Facebook Android、Instagram iOS、WeChat、KakaoTalk：面板出現、文字正確、按鈕組合正確（Android 有「用瀏覽器開啟」；iOS 非 LINE 有操作說明＋「複製連結」）。UA 字串用真實樣式，寫在腳本裡並註明是哪個環境。
   - Android 非 LINE 按主按鈕：攔截導向，確認目標是 `intent://` 開頭、含 `package=com.android.chrome`、`browser_fallback_url`，而且帶著正確的 `r`。LINE 按主按鈕：目標網址含 `openExternalBrowser=1` 和 `r`。
   - 帶 `?r=<真的邀請碼>&openExternalBrowser=1&lang=en` 進頁（一般瀏覽器）：自動進房、網址裡 `r` 和 `openExternalBrowser` 都被拿掉。
   - 內建瀏覽器帶 `?r=` 進頁：面板出現，按「先在這裡玩」後人在房間裡、能入座。
   - 關掉面板後重新整理：同一分頁不再出現。
   - A 開房後讀 `inviteUrl()` 與 `inviteText()`：網址含 `openExternalBrowser=1`；文字含「邀請碼：」＋那 6 碼（四語各驗一次）。
   - 不捲動：面板開著時，375×667 與 360×640 × zh／en／ja／ko，`scrollHeight <= innerHeight`、`scrollWidth <= innerWidth`、面板完整在畫面內。
   - 既有功能沒壞：公開房一般流程（開房→另一人從大廳入座→各下一手）沒有錯誤；全程沒有 pageerror。
   - 負向測試：故意把一項期望改錯確認會 FAIL，再改回。
   - 截圖存 `check/`：zh 375×667 的 LINE Android 面板、Instagram iOS 面板；en 360×640 的 Facebook Android 面板。**自己看每一張**，把看到的問題寫進 REPORT。
3. 跑既有的 `docs/design/today-home-2026-11-13/check/run.mjs`，貼最後的結果（確認沒弄壞）。

## REPORT.md 格式

改了什麼（行號範圍）／自己做的取捨／每項檢查的完整輸出／截圖裡看到的問題／沒做到或不確定的事。**真實的 LINE、Facebook App 沒辦法在這台電腦測，這一點要明寫，不要寫成已驗證。**
