# REPORT：兩儀殿邀請連結在內建瀏覽器的處理（2026-11-13）

**先講清楚**：真實的 LINE、Facebook、Instagram App 在這台電腦上沒辦法測。以下所有「內建瀏覽器」都是用 Playwright 的 `userAgent` 字串假裝出來的，只驗證了「偵測 → 面板 → 導向網址組得對」。LINE 看到 `openExternalBrowser=1` 是否真的改用外部瀏覽器、Android 上 `intent://` 是否真的叫起 Chrome、iOS 各 App 右上角選單的實際文字，都**沒有驗證**。

## 改了什麼（只動 `duel.html`；行號為改完後的位置）
- 261–273：新增底部面板 `#mInApp`（沿用 `.modal`／`.box`／`btn gold`／`btn ghost`／`icob`，沒有新版型）。按鈕：主按鈕 `abOpen`、iOS 操作說明 `abIos`、`abCopy`（複製連結，文字沿用既有 `copyLink`）、次要 `abStay`。
- 352、376 與另兩行（四語 I18N，各接在 `shareText` 後面）：新增 `inviteCodeLine`、`abT`、`abNote`、`abOpen`、`abStay`、`abIos`。
- 679–681：`urlCode0` 保存原始邀請碼；進頁時若網址有 `openExternalBrowser` 而沒有 `r`，立刻 `replaceState` 拿掉。
- 683：`inviteUrl()` 加 `&openExternalBrowser=1`。
- 692：`inviteText()` 在網址（呼叫端接在後面）之前多一行「邀請碼：XXXXXX」（四語）。
- 約 721–760：`inAppBrowser()`、`isAndroid()`、`isIOS()`、`externalUrl()`、`showInApp()`。
- hello 收到後的 `replaceState`（原本只刪 `r`）同時刪 `openExternalBrowser`。
- 1675：`connect();` 之後呼叫 `showInApp();`。

## 自己做的取捨
- `join` 流程完全沒動：面板只是蓋在畫面上，hello 後照常送 join，所以按「先在這裡玩」時人已在房裡（測試 6 驗證）。
- 偵測順序 LINE → Instagram → Facebook → WeChat → Kakao（Instagram 的 UA 有時也含 FB 字樣，先判 Instagram）。LINE 判斷用 `Line/`。
- 「非 LINE 的 Android」才組 `intent://`；LINE 不論 Android／iOS 都顯示主按鈕＋`openExternalBrowser=1`（規格如此）。其他 iOS（Instagram、WeChat、FB iOS）顯示操作說明＋複製連結，沒有主按鈕。
- 導向網址與「複製連結」用 `externalUrl()`：origin＋pathname＋`r`（取自原始邀請碼 `urlCode0`）＋`lang`（目前語言）。沒有邀請碼時只帶 `lang`。
- `sessionStorage['vcfgame.duel.inapp']`：按「先在這裡玩」或右上 ✕ 才寫入；面板只在進頁時出現一次。
- 英文 `abNote` 一開始用彎引號 `’`，截圖看到引號離字母很遠（後備字型），改成直引號。
- 驗證用 `__clip`（攔截 `navigator.clipboard`）取得複製內容，因為 `inviteUrl`／`inviteText` 不是全域函式；沒有為了測試新增全域。
- 臨時的修補腳本 `_patch.py` 用完已刪。

## 檢查 1：語法
把 `duel.html` 的 `<script type="module">…</script>` 內容用 Python 正規式抽到 `check/_script.mjs`，跑 `node --check`，輸出 `SYNTAX_OK`（兩次：初版與改引號後）。暫存檔已刪。

## 檢查 2：`check/check_inapp.mjs`（最後一次完整輸出）
```
== 1. 一般瀏覽器沒有面板
  PASS Android Chrome：面板不出現
  PASS 桌機 Chrome：面板不出現
  PASS iOS Safari：面板不出現
== 2. 內建瀏覽器面板（四語）
  PASS zh LINE Android：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS zh LINE iOS：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS zh Facebook Android：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS zh Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=點右上角 ⋯ → 用瀏覽器開啟 copy=複製連結 stay=先在這裡玩）
  PASS zh WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=點右上角 ⋯ → 用瀏覽器開啟 copy=複製連結 stay=先在這裡玩）
  PASS zh KakaoTalk Android：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS en LINE Android：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS en LINE iOS：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS en Facebook Android：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS en Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=Tap ⋯ at the top right → Open in browser copy=Copy link stay=Play here for now）
  PASS en WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=Tap ⋯ at the top right → Open in browser copy=Copy link stay=Play here for now）
  PASS en KakaoTalk Android：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS ja LINE Android：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ja LINE iOS：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ja Facebook Android：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ja Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=右上の ⋯ →「ブラウザで開く」 copy=リンクをコピー stay=ここで遊ぶ）
  PASS ja WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=右上の ⋯ →「ブラウザで開く」 copy=リンクをコピー stay=ここで遊ぶ）
  PASS ja KakaoTalk Android：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ko LINE Android：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
  PASS ko LINE iOS：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
  PASS ko Facebook Android：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
  PASS ko Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=오른쪽 위 ⋯ → 브라우저로 열기 copy=링크 복사 stay=여기서 먼저 하기）
  PASS ko WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=오른쪽 위 ⋯ → 브라우저로 열기 copy=링크 복사 stay=여기서 먼저 하기）
  PASS ko KakaoTalk Android：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
== 3. 不捲動、面板完整在畫面內
  PASS 375×667 zh LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 zh Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 375×667 en LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 en Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 375×667 ja LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 ja Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 375×667 ko LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 ko Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 360×640 zh LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 zh Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
  PASS 360×640 en LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 en Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
  PASS 360×640 ja LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 ja Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
  PASS 360×640 ko LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 ko Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
== 4. 邀請連結與分享文字（A 開房）
  PASS A 開房，邀請碼 XKC5JE
  PASS zh 複製的內容含「邀請碼：XKC5JE」與 openExternalBrowser=1
  PASS zh 邀請碼那行在網址之前
  例（zh）："來兩儀殿跟我對戰\n五子棋・普規・不計時\n邀請碼：XKC5JE\nhttp://127.0.0.1:8793/duel.html?r=XKC5JE&lang=zh&openExternalBrowser=1"
  PASS en 複製的內容含「Invite code: XKC5JE」與 openExternalBrowser=1
  PASS en 邀請碼那行在網址之前
  PASS ja 複製的內容含「招待コード：XKC5JE」與 openExternalBrowser=1
  PASS ja 邀請碼那行在網址之前
  PASS ko 複製的內容含「초대 코드: XKC5JE」與 openExternalBrowser=1
  PASS ko 邀請碼那行在網址之前
  PASS inviteNote 仍有「不用安裝、不用註冊」
== 5. 一般瀏覽器帶 ?r=…&openExternalBrowser=1&lang=en 進頁
  PASS 自動進房；網址只剩「?lang=en」
  PASS 一般瀏覽器沒有面板
  PASS B 入座，開局
  PASS 只帶 openExternalBrowser（沒有 r）也被拿掉：「?lang=en」
  PASS 既有流程：各下一手（log 2）
== 6. 內建瀏覽器帶 ?r= 進頁，按「先在這裡玩」
  PASS 面板出現（LINE Android）
  PASS 面板還開著時，join 已經照常完成（人在房裡）
  PASS 按「先在這裡玩」面板關掉
  PASS 人在房間裡
  PASS 能入座，開局
  PASS 關掉面板後重新整理：同一分頁不再出現
== 7. 主按鈕導向
  PASS 進頁後網址的 r 已被 replaceState 拿掉
  intent 目標：intent://127.0.0.1:8793/duel.html?r=R6GRV3&lang=en#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=http%3A%2F%2F127.0.0.1%3A8793%2Fduel.html%3Fr%3DR6GRV3%26lang%3Den;end
  PASS Facebook Android：intent:// 開頭、package=com.android.chrome、帶 browser_fallback_url、r 正確
  PASS browser_fallback_url 解碼＝原網址（帶 r、lang）
  LINE 目標：http://127.0.0.1:8793/duel.html?r=8M4CXT&lang=ja&openExternalBrowser=1
  PASS LINE Android：目標網址含 openExternalBrowser=1、r、lang
  PASS iOS Instagram「複製連結」複製含 r 的完整網址：http://127.0.0.1:8793/duel.html?r=AMSFZ7&lang=zh
== 8. 公開房一般流程（大廳入座、各下一手）
  PASS 開房→大廳入座→各下一手
  PASS 全程沒有 pageerror／console error []
PASS 71／FAIL 0
```

## 負向測試（`NEG=1`：把「Android Chrome 沒有面板」改成期望有）
```
== 1. 一般瀏覽器沒有面板
  FAIL Android Chrome：面板（NEG：故意期望有）
  PASS 桌機 Chrome：面板不出現
  PASS iOS Safari：面板不出現
== 2. 內建瀏覽器面板（四語）
  PASS zh LINE Android：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS zh LINE iOS：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS zh Facebook Android：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS zh Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=點右上角 ⋯ → 用瀏覽器開啟 copy=複製連結 stay=先在這裡玩）
  PASS zh WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=點右上角 ⋯ → 用瀏覽器開啟 copy=複製連結 stay=先在這裡玩）
  PASS zh KakaoTalk Android：面板出現、文字與按鈕組合正確（open=用瀏覽器開啟 ios=null copy=null stay=先在這裡玩）
  PASS en LINE Android：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS en LINE iOS：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS en Facebook Android：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS en Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=Tap ⋯ at the top right → Open in browser copy=Copy link stay=Play here for now）
  PASS en WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=Tap ⋯ at the top right → Open in browser copy=Copy link stay=Play here for now）
  PASS en KakaoTalk Android：面板出現、文字與按鈕組合正確（open=Open in browser ios=null copy=null stay=Play here for now）
  PASS ja LINE Android：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ja LINE iOS：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ja Facebook Android：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ja Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=右上の ⋯ →「ブラウザで開く」 copy=リンクをコピー stay=ここで遊ぶ）
  PASS ja WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=右上の ⋯ →「ブラウザで開く」 copy=リンクをコピー stay=ここで遊ぶ）
  PASS ja KakaoTalk Android：面板出現、文字與按鈕組合正確（open=ブラウザで開く ios=null copy=null stay=ここで遊ぶ）
  PASS ko LINE Android：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
  PASS ko LINE iOS：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
  PASS ko Facebook Android：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
  PASS ko Instagram iOS：面板出現、文字與按鈕組合正確（open=null ios=오른쪽 위 ⋯ → 브라우저로 열기 copy=링크 복사 stay=여기서 먼저 하기）
  PASS ko WeChat iOS：面板出現、文字與按鈕組合正確（open=null ios=오른쪽 위 ⋯ → 브라우저로 열기 copy=링크 복사 stay=여기서 먼저 하기）
  PASS ko KakaoTalk Android：面板出現、文字與按鈕組合正確（open=브라우저로 열기 ios=null copy=null stay=여기서 먼저 하기）
== 3. 不捲動、面板完整在畫面內
  PASS 375×667 zh LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 zh Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 375×667 en LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 en Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 375×667 ja LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 ja Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 375×667 ko LINE Android：sh 667/667 sw 375/375 面板 top 449 bottom 667
  PASS 375×667 ko Instagram iOS：sh 667/667 sw 375/375 面板 top 426 bottom 667
  PASS 360×640 zh LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 zh Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
  PASS 360×640 en LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 en Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
  PASS 360×640 ja LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 ja Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
  PASS 360×640 ko LINE Android：sh 640/640 sw 360/360 面板 top 422 bottom 640
  PASS 360×640 ko Instagram iOS：sh 640/640 sw 360/360 面板 top 399 bottom 640
== 4. 邀請連結與分享文字（A 開房）
  PASS A 開房，邀請碼 SY4VG3
  PASS zh 複製的內容含「邀請碼：SY4VG3」與 openExternalBrowser=1
  PASS zh 邀請碼那行在網址之前
  例（zh）："來兩儀殿跟我對戰\n五子棋・普規・不計時\n邀請碼：SY4VG3\nhttp://127.0.0.1:8793/duel.html?r=SY4VG3&lang=zh&openExternalBrowser=1"
  PASS en 複製的內容含「Invite code: SY4VG3」與 openExternalBrowser=1
  PASS en 邀請碼那行在網址之前
  PASS ja 複製的內容含「招待コード：SY4VG3」與 openExternalBrowser=1
  PASS ja 邀請碼那行在網址之前
  PASS ko 複製的內容含「초대 코드: SY4VG3」與 openExternalBrowser=1
  PASS ko 邀請碼那行在網址之前
  PASS inviteNote 仍有「不用安裝、不用註冊」
== 5. 一般瀏覽器帶 ?r=…&openExternalBrowser=1&lang=en 進頁
  PASS 自動進房；網址只剩「?lang=en」
  PASS 一般瀏覽器沒有面板
  PASS B 入座，開局
  PASS 只帶 openExternalBrowser（沒有 r）也被拿掉：「?lang=en」
  PASS 既有流程：各下一手（log 2）
== 6. 內建瀏覽器帶 ?r= 進頁，按「先在這裡玩」
  PASS 面板出現（LINE Android）
  PASS 面板還開著時，join 已經照常完成（人在房裡）
  PASS 按「先在這裡玩」面板關掉
  PASS 人在房間裡
  PASS 能入座，開局
  PASS 關掉面板後重新整理：同一分頁不再出現
== 7. 主按鈕導向
  PASS 進頁後網址的 r 已被 replaceState 拿掉
  intent 目標：intent://127.0.0.1:8793/duel.html?r=RRAEHB&lang=en#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=http%3A%2F%2F127.0.0.1%3A8793%2Fduel.html%3Fr%3DRRAEHB%26lang%3Den;end
  PASS Facebook Android：intent:// 開頭、package=com.android.chrome、帶 browser_fallback_url、r 正確
  PASS browser_fallback_url 解碼＝原網址（帶 r、lang）
  LINE 目標：http://127.0.0.1:8793/duel.html?r=UWTTCD&lang=ja&openExternalBrowser=1
  PASS LINE Android：目標網址含 openExternalBrowser=1、r、lang
  PASS iOS Instagram「複製連結」複製含 r 的完整網址：http://127.0.0.1:8793/duel.html?r=BYHRM3&lang=zh
== 8. 公開房一般流程（大廳入座、各下一手）
  PASS 開房→大廳入座→各下一手
  PASS 全程沒有 pageerror／console error []
PASS 70／FAIL 1
```
確認會 FAIL（exit 1，只有那一項失敗），改回後正常版 71／0。

## 檢查 3：既有 `today-home-2026-11-13/check/run.mjs`（結尾；完整輸出存 `check/today_run.txt`）
```
  PASS ko 360×640 今日棋局清單（1 筆）：高 640/640 寬 360/360
  PASS ko 360×640 清單視窗在畫面內（1 筆）
  PASS ko 360×640 今日棋局清單（40 筆）：高 640/640 寬 360/360
  PASS ko 360×640 40 筆：清單在自己的區塊內捲、列沒有橫向溢出
  PASS ko 360×640 兩儀殿大廳：高 640/640 寬 360/360
  PASS ko 360×640 五子棋回看進得去
  PASS ko 360×640 五子棋回看：高 640/640 寬 360/360
  PASS ko 360×640 五子棋回看（退一手）：高 640/640 寬 360/360
  PASS ko 360×640 VCF 回看進得去
  PASS ko 360×640 VCF 回看：高 640/640 寬 360/360
  PASS 全程沒有 JS 錯誤 []
PASS 189／FAIL 0
```
exit 0。

## 截圖裡看到的問題（三張我自己都看過）
- `check/shot_line_android_zh_375.png`（LINE Android，zh 375×667）：面板貼底、兩顆按鈕完整；右上 ✕ 有一圈青色焦點框（`openModal` 本來就會 focus 第一個 `data-close`，其他面板同樣）。說明文字折成兩行，第二行只剩孤字「來。」——文案是規格指定的，沒改。
- `check/shot_ig_ios_zh_375.png`（Instagram iOS，zh 375×667）：說明文字同樣有孤字「來。」；金色那行「點右上角 ⋯ → 用瀏覽器開啟」清楚，「⋯」正常顯示；「複製連結」「先在這裡玩」兩顆完整，面板沒超出畫面。
- `check/shot_fb_android_en_360.png`（Facebook Android，en 360×640）：面板完整在畫面內。初版 `won’t` 的彎引號被畫成離字母很遠，已改直引號並重拍、重看，確認正常。
- 另有同樣的 ✕ 焦點框，沒處理（既有行為）。

## 沒做到或不確定的事
- 真實 LINE／Facebook／Instagram／WeChat／Kakao App、真實手機：**沒測**。
- `intent://` 在桌機 Chrome 只會在 console 出現 “Failed to launch … no registered handler”，測試只驗證目標網址；我把這句從 console error 檢查裡排除（只排除 `Failed to launch 'intent:/`）。真手機 Android 是否叫起 Chrome 未驗。
- iOS 非 LINE：只給操作說明，各 App 的選單文字可能與「用瀏覽器開啟」不同，四語都沒對照實機。
- 面板在 `mGone`／`mJoin` 同時出現時的堆疊（同 z-index，後面的蓋在上面）沒有專門測。
- 沒有部署、沒有 git 操作。
