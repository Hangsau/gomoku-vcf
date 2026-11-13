# 兩儀殿邀請連結：內建瀏覽器的處理（2026-11-13）

使用者回報：LINE 傳邀請連結，朋友點了開在 LINE 內建瀏覽器，不是已安裝的版本；之後又說希望「按了就一定進 App」，擔心開到另一個網站等於重複登入。

## 已上線

- 邀請連結加 `&openExternalBrowser=1`（LINE 會改用手機預設瀏覽器開）；進頁後跟 `r` 一起從網址拿掉。
- 分享文字多一行「邀請碼：XXXXXX」（四語），對方可以自己打開安裝版、在大廳輸入邀請碼進房。

## 做好但關著（`duel.html` 最後的 `showInApp()` 被註解掉）

cc2 照 `WORKORDER.md` 做了「偵測到內建瀏覽器就跳面板：用瀏覽器開啟／先在這裡玩」（`#mInApp`、`inAppBrowser()`、`showInApp()`），檢查腳本 `check/check_inapp.mjs` 在面板開著時全過（`check/run1.txt`）。**現在面板關著，這支腳本的面板項目會 FAIL，屬預期。**

沒開的原因：
- 安裝版屬於「當初按安裝的那個瀏覽器」，不一定是預設瀏覽器；面板裡 Android 強制用 Chrome 開（`package=com.android.chrome`）對用別的瀏覽器安裝的人是錯的。
- iPhone 的安裝版永遠不接連結。所以「用瀏覽器開啟」保證不了進 App。

## 等使用者確認的改法（我建議的 A）

邀請連結開在「沒有任何遊戲紀錄的瀏覽器」時（沒有 `vcfgame.nick` 等），不直接進房，先跳面板：
- 「我已經安裝過」→ 複製邀請碼，請他打開 App 在大廳貼上。
- 「第一次玩」→ 直接在這裡進房。
有紀錄的瀏覽器照舊直接進房。

要保證「按了一定進 App」只有上架商店 App（Android：Google Play＋驗證連結；iPhone：App Store），建議等收費時一起評估（商店 App 賣數位商品通常要走平台付款並抽成）。

## 沒驗證的

真實的 LINE／Facebook／Instagram App 都沒測過，以上行為是依平台文件與 UA 假裝測試。上線後要請使用者用 LINE 實點一次。

## 2026-11-13 後續

- 使用者實測：iPhone 上 LINE 點新邀請連結會跳到 Safari（參數有效），但不會開進主畫面的安裝版——「很爛，去想個方式做吧」。
- 查證（2026-11）：iOS 沒有讓連結開進主畫面網頁 App 的機制，iOS 27 也沒有新增；Safari 與安裝版儲存分開。要連結開進 App 只有上架 App Store。
- 使用者：沒有錢註冊 Apple 開發者帳號 → **不上架**。
- 免費的方向（主 session 定）：① 遊戲內「邀請最近的對手」＋系統通知（通知點了會開安裝版）；先做最小通知測試給使用者用 iPhone 驗證，施工單 `docs/design/push-test-2026-11-13/WORKORDER.md`。② Google 登入讓 Safari 與安裝版是同一份資料（計畫 `docs/design/accounts-2026-11-13/PLAN.md`，只做 Google、不做信箱驗證碼、不管舊暱稱紀錄）。
