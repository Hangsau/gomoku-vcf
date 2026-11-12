# REPORT：兩儀殿 VCF「一線天」＋「八仙渡」並存

結論：兩種玩法都做好並實測；`PASS 217／FAIL 0`。沒有任何 git 寫入、沒有部署。

## 1. 改了什麼（逐檔）

**`game/duel-server/vcf.js`**
- `cleanVcfSettings` 多驗 `vmode`：沒送或 `null`＝`'eight'`（`DEFAULT_VMODE`）；`'line'`／`'eight'` 照收；其他值（字串、數字、物件）回 `null`，worker 照既有慣例回 `err('bad')`，不丟例外。
- 常數 `REVEAL_MS = 5000`（舊搶答版的值）。
- 每席多 `seq`（最後一次回報的手順）；`vs` 多 `phase`（`play`／`reveal`）、`rv`、`rtimer`；`startPuzzle` 重置 `seq`；`stopTimers` 也清 `rtimer`。
- `publicVs` 多送 `phase`、`rv`（只在 `reveal` 時有值：`{ winner, seq }`）。
- 檔頭註解改成兩種玩法的說明。

**`game/duel-server/worker.js`**
- `vcfFinish`：共通部分（記 log、加分）不動；一線天走新的 `vcfLineStep`，八仙渡走原本那段（程式沒動）。**分支點只有這一處**（另外 `vcfMsg` 一行：一線天忽略 `vskip`）。
- 新增 `vcfLineStep`：有人解開＝這題結束，另一人還在做的記成 `out/late`（`log` 留他回報過的手順）；兩人都出局＝沒人得分；到目標分數直接 `over`（不停公開）；否則進 `phase: 'reveal'`，`REVEAL_MS` 後兩人一起 `vcfBegin(i+1)`。
- `vcfMsg`：`vprog` 若帶 `seq` 就存起來（兩種玩法都存，八仙渡不使用）。
- 抽題、計時（`vcfBegin`／每人思考上限 timer）、狀態送出、`review` 全部共用，沒複製。

**`duel.html`**
- 開房表單：VCF 設定最上面加「玩法」分段按鈕（一線天／八仙渡，預設八仙渡，記在 localStorage `vcfgame.duel.vmode`）；原本那句長說明改成「選中玩法的小字＋共通的明鏡台規則」，八仙渡的小字帶目前選的題數（`{p}`）。
- 開房送出 `vmode`。
- 大廳卡片：原本的「VCF 明鏡台」改成「VCF 明鏡台・一線天／八仙渡」；房間標題改成玩法名稱＋房號（`一線天 1234`）。
- 一線天的客戶端：沒有「放棄這題」鈕；對手那條不顯示他做到第幾題；`phase==='reveal'` 時閃「X 解開！+1／沒人解開・這是正解」、棋盤畫出正解手順（贏家的手順，沒人解開就用引擎算，同舊版）；狀態列字樣（出局後「等這題結果」、公開時「下一題準備中」）。
- `vprog` 多帶 `seq: round.seq`。
- 四語字串補齊（zh／en／ja／ko）：`vModeL vm_line vm_eight vmn_line vmn_eight vNoteC vRoundWin vRoundNone vNext vWhy_late vStOutWait`；`vRoundWin／vRoundNone／vNext` 是從舊版 `89443e3^` 撈回來的原文。
- 順手修一個既有的小問題（兩種玩法都受影響）：開局倒數結束時 `renderRoom()` 之後沒重算棋盤大小，「黑先」那行多出來後 360×640 會多捲 3px，補上 `layout()`。
- `window.__duel`（只在本機才有）多暴露幾個測試用的函式（`vOut`、`mySeat`、`vIsLive`、`xyOf`、`tToP`、`cv`）。

**`docs/duel.md`**：VCF 那一節改寫成兩種玩法（名稱表、共通規則、各自規則、與舊搶答版的差異、測試腳本位置）；檔案表、閒置那段的字樣同步。

**`docs/design/duel-modes-2026-11-12/`**：`PROGRESS.md`、本檔、`check/`（`lib.mjs`、`run.mjs`、`output.txt`、`shots/` 129 張）。

## 2. 一線天照舊版（`89443e3^`）哪幾處還原、哪裡不同

還原的（對照 `git show 89443e3^:docs/duel.md`、`89443e3`）：
- 兩人同一題、倒數 3 秒同時開始；先解開得 1 分；先到目標分贏。
- 下錯／時間到＝這題出局，只能等；兩人都出局或思考上限到＝沒人得分，公開正解。
- 明鏡台計時（5 秒＋每手 1 秒）不動；看不到對手手順，只看狀態。
- 一題結束停 `REVEAL_MS = 5000` 公開解法（舊版值），畫面同舊版：flash 文字＋棋盤標號手順。
- 沒有放棄鈕（舊版沒有；放棄鈕是 `89443e3` 才加的）。伺服器也忽略一線天房收到的 `vskip`。

跟舊版不一樣、原因：
1. **資料格式**：舊版用 `vs.cur`／`vs.n`；現在沿用八仙渡的 `vs.p[座位].i`（一線天兩人永遠相同）＋ `review`，才能共用抽題／計時／賽後逐題看解法，不複製兩份。賽後逐題看解法一線天每題兩人的手都有（出局的人是他下到出局為止；被搶先的人是他最後一次 `vprog` 回報的手）。
2. **對手先解開時**，還沒做完的人記成 `late`（新原因「慢了一步」）；舊版是 `time`。這樣賽後看得出是被搶先而不是自己超時。
3. **最後一題**有人拿到目標分：直接進結束畫面（舊版也是這樣：贏了就不再排下一題，但舊版仍把 `phase` 設成 done 公開；現在改由賽後逐題看解法看）。
4. 題目串用現在的「開局抽 N×3、剩 3 題補」，不是舊版「每題現抽」；效果相同（不會用完），但傳說段仍可能重複。
5. 房間標題不再帶「・第 n 題」（八仙渡沒有；狀態列已有「第 n 題」）。

## 3. 檢查完整輸出

測試方式：`check/run.mjs`（Playwright 1.62＋系統 Chrome，用 `C:/claudehome/tools/node_modules`，沒裝任何東西）；http.server 8793、`wrangler dev` 8789、`.dev.vars` 的 `BANK_URL` 指 8793；頁面的 WebSocket 位址由腳本從 8787 改接 8789（8787 是別人的 wrangler，沒碰）；兩個玩家＝兩個獨立 browser context。解題：頁面自己的引擎（`window.__duel.vSolve`）算正解後用滑鼠點攻方每一手；「下錯出局」用頁面自己的 `vOut('bad')`（跟真的下錯走同一條送出路徑；真正「時間到」出局沒有另測）。

- `node --check`：`vcf.js` 通過；`worker.js` 複製成 `.mjs` 後通過（它是 ES module）。
- 一線天整場（5 題）、八仙渡整場、舊客戶端相容、五子棋、版面 全部在下面的輸出裡（開房者座位是隨機的，腳本會把座位 0 的當 A）。

```
== 1 一線天整場
  PASS 房間 vmode=line
  PASS 房間標題顯示玩法名稱「一線天」：一線天 4537
  PASS 兩邊同一題 id=GYEZ4TP0
  PASS 一線天沒有「放棄這題」按鈕
  PASS A 解開 → A 1 分（1,0）
  PASS B 記成慢了一步、A 解開
  PASS 進入公開解法，贏家=A
  PASS B 畫面拿到公開的解法手順
  PASS 兩邊一起進第 2 題、題目相同 id=KDPKZB39
  PASS A 出局後 B 仍在做、沒換題
  PASS B 解開 → B 得分（1,1）
  PASS A 先出局時這題還沒結束
  PASS 兩人都出局 → 沒人得分、winner=null
  PASS 一起換到第 4 題、同題
  PASS A 2 分
  PASS 結束：A 3 : B 1（3,1，winner=0）
  PASS 結束畫面：A「你贏了」B「你輸了」
  PASS 比分文字 A「解開 3 : 1」B「解開 1 : 3」
  PASS 逐題看解法共 5 題（5）
  PASS 每題兩人都有紀錄
   紀錄 A: solved/null out/bad out/bad solved/null solved/null | B: out/late solved/null out/bad out/late out/late
  PASS 第 1 題 A 解開，手順 7 手
  PASS 第 1 題 B 慢了一步
  PASS 第 2 題 A 出局，留下他下到出局的手（G9 J7）
  PASS 第 2 題 B 解開，手順完整
  PASS 第 3 題兩人出局，各自手順都在
  PASS 第 4 題 B 慢了一步，下過的手還在（L14 H11）
   facts: 第 1／5 題我的：解開對手：慢了一步 // 第 2／5 題我的：這手不行對手：解開 // 第 3／5 題我的：這手不行對手：這手不行 // 第 4／5 題我的：解開對手：慢了一步 // 第 5／5 題我的：解開對手：慢了一步
  PASS 逐題看解法每題都有字、沒有 undefined
  PASS 再來一局：一線天、比分歸零
  PASS 頁面沒有 JS 錯誤 []
== 2 八仙渡整場
  PASS 房間標題「八仙渡」：八仙渡 8298
  PASS 開局兩人第 1 題同一題
  PASS 八仙渡有「放棄這題」按鈕
  PASS A 解兩題時 B 還在第 1 題（A i=2，B i=0，分數 2,0）
  PASS 對手那條顯示他做到第 3 題：Alice 第 3 題 思考中
  PASS 先解開 3 題的贏（3,0）
  PASS 結束畫面輸贏正確
  PASS 逐題看解法 3 題，A 的手順都在
  PASS B 看解法畫面：第 1／3 題我的：沒做到對手：解開
  PASS 頁面沒有 JS 錯誤 []
== 3 舊客戶端相容
   {"label":"沒有 vmode","vmode":"eight","errs":[],"alive":true,"types":"hello,lobby,room,pong"}
   {"label":"vmode=null","vmode":"eight","errs":[],"alive":true,"types":"hello,lobby,room,pong"}
   {"label":"vmode=line","vmode":"line","errs":[],"alive":true,"types":"hello,lobby,room,pong"}
   {"label":"vmode=xxx","vmode":null,"errs":["bad"],"alive":true,"types":"hello,lobby,err,pong"}
   {"label":"vmode=數字 7","vmode":null,"errs":["bad"],"alive":true,"types":"hello,lobby,err,pong"}
   {"label":"vmode=物件","vmode":null,"errs":["bad"],"alive":true,"types":"hello,lobby,err,pong"}
   {"label":"vmode=eight","vmode":"eight","errs":[],"alive":true,"types":"hello,lobby,room,pong"}
  PASS 沒有 vmode → eight
  PASS vmode=null → eight
  PASS 合法值照收
  PASS vmode=xxx → 被拒絕（bad）、連線沒斷
  PASS vmode=數字 7 → 被拒絕（bad）、連線沒斷
  PASS vmode=物件 → 被拒絕（bad）、連線沒斷
  PASS wrangler 紀錄沒有例外
== 5 五子棋基本流程
   結束畫面 你贏了 你輸了
  PASS 五子棋分出勝負
  PASS 先手（黑）連五贏
  PASS 頁面沒有 JS 錯誤 []
== 4 版面
  PASS line zh_360x640 開房表單(line)
  PASS line zh_360x640 開房表單(eight)
  PASS line zh_360x640 等倒數
  PASS line zh_360x640 對局中
  PASS line zh_360x640 落子中
  PASS line zh_360x640 出局等對手
  PASS line zh_360x640 公開解法
  PASS line zh_360x640 結束畫面
  PASS line zh_360x640 逐題看解法
  PASS line zh_360x640 對手端結束後看解法前
  PASS line zh_360x640 沒有 JS 錯誤 []
  PASS eight zh_360x640 開房表單(line)
  PASS eight zh_360x640 開房表單(eight)
  PASS eight zh_360x640 等倒數
  PASS eight zh_360x640 對局中
  PASS eight zh_360x640 落子中
  PASS eight zh_360x640 下一題
  PASS eight zh_360x640 結束畫面
  PASS eight zh_360x640 逐題看解法
  PASS eight zh_360x640 對手端結束後看解法前
  PASS eight zh_360x640 沒有 JS 錯誤 []
  PASS line en_360x640 開房表單(line)
  PASS line en_360x640 開房表單(eight)
  PASS line en_360x640 等倒數
  PASS line en_360x640 對局中
  PASS line en_360x640 落子中
  PASS line en_360x640 出局等對手
  PASS line en_360x640 公開解法
  PASS line en_360x640 結束畫面
  PASS line en_360x640 逐題看解法
  PASS line en_360x640 對手端結束後看解法前
  PASS line en_360x640 沒有 JS 錯誤 []
  PASS eight en_360x640 開房表單(line)
  PASS eight en_360x640 開房表單(eight)
  PASS eight en_360x640 等倒數
  PASS eight en_360x640 對局中
  PASS eight en_360x640 落子中
  PASS eight en_360x640 下一題
  PASS eight en_360x640 結束畫面
  PASS eight en_360x640 逐題看解法
  PASS eight en_360x640 對手端結束後看解法前
  PASS eight en_360x640 沒有 JS 錯誤 []
  PASS line ja_360x640 開房表單(line)
  PASS line ja_360x640 開房表單(eight)
  PASS line ja_360x640 等倒數
  PASS line ja_360x640 對局中
  PASS line ja_360x640 落子中
  PASS line ja_360x640 出局等對手
  PASS line ja_360x640 公開解法
  PASS line ja_360x640 結束畫面
  PASS line ja_360x640 逐題看解法
  PASS line ja_360x640 對手端結束後看解法前
  PASS line ja_360x640 沒有 JS 錯誤 []
  PASS eight ja_360x640 開房表單(line)
  PASS eight ja_360x640 開房表單(eight)
  PASS eight ja_360x640 等倒數
  PASS eight ja_360x640 對局中
  PASS eight ja_360x640 落子中
  PASS eight ja_360x640 下一題
  PASS eight ja_360x640 結束畫面
  PASS eight ja_360x640 逐題看解法
  PASS eight ja_360x640 對手端結束後看解法前
  PASS eight ja_360x640 沒有 JS 錯誤 []
  PASS line ko_360x640 開房表單(line)
  PASS line ko_360x640 開房表單(eight)
  PASS line ko_360x640 等倒數
  PASS line ko_360x640 對局中
  PASS line ko_360x640 落子中
  PASS line ko_360x640 出局等對手
  PASS line ko_360x640 公開解法
  PASS line ko_360x640 結束畫面
  PASS line ko_360x640 逐題看解法
  PASS line ko_360x640 對手端結束後看解法前
  PASS line ko_360x640 沒有 JS 錯誤 []
  PASS eight ko_360x640 開房表單(line)
  PASS eight ko_360x640 開房表單(eight)
  PASS eight ko_360x640 等倒數
  PASS eight ko_360x640 對局中
  PASS eight ko_360x640 落子中
  PASS eight ko_360x640 下一題
  PASS eight ko_360x640 結束畫面
  PASS eight ko_360x640 逐題看解法
  PASS eight ko_360x640 對手端結束後看解法前
  PASS eight ko_360x640 沒有 JS 錯誤 []
  PASS line zh_375x667 開房表單(line)
  PASS line zh_375x667 開房表單(eight)
  PASS line zh_375x667 等倒數
  PASS line zh_375x667 對局中
  PASS line zh_375x667 落子中
  PASS line zh_375x667 出局等對手
  PASS line zh_375x667 公開解法
  PASS line zh_375x667 結束畫面
  PASS line zh_375x667 逐題看解法
  PASS line zh_375x667 對手端結束後看解法前
  PASS line zh_375x667 沒有 JS 錯誤 []
  PASS eight zh_375x667 開房表單(line)
  PASS eight zh_375x667 開房表單(eight)
  PASS eight zh_375x667 等倒數
  PASS eight zh_375x667 對局中
  PASS eight zh_375x667 落子中
  PASS eight zh_375x667 下一題
  PASS eight zh_375x667 結束畫面
  PASS eight zh_375x667 逐題看解法
  PASS eight zh_375x667 對手端結束後看解法前
  PASS eight zh_375x667 沒有 JS 錯誤 []
  PASS line en_375x667 開房表單(line)
  PASS line en_375x667 開房表單(eight)
  PASS line en_375x667 等倒數
  PASS line en_375x667 對局中
  PASS line en_375x667 落子中
  PASS line en_375x667 出局等對手
  PASS line en_375x667 公開解法
  PASS line en_375x667 結束畫面
  PASS line en_375x667 逐題看解法
  PASS line en_375x667 對手端結束後看解法前
  PASS line en_375x667 沒有 JS 錯誤 []
  PASS eight en_375x667 開房表單(line)
  PASS eight en_375x667 開房表單(eight)
  PASS eight en_375x667 等倒數
  PASS eight en_375x667 對局中
  PASS eight en_375x667 落子中
  PASS eight en_375x667 下一題
  PASS eight en_375x667 結束畫面
  PASS eight en_375x667 逐題看解法
  PASS eight en_375x667 對手端結束後看解法前
  PASS eight en_375x667 沒有 JS 錯誤 []
  PASS line ja_375x667 開房表單(line)
  PASS line ja_375x667 開房表單(eight)
  PASS line ja_375x667 等倒數
  PASS line ja_375x667 對局中
  PASS line ja_375x667 落子中
  PASS line ja_375x667 出局等對手
  PASS line ja_375x667 公開解法
  PASS line ja_375x667 結束畫面
  PASS line ja_375x667 逐題看解法
  PASS line ja_375x667 對手端結束後看解法前
  PASS line ja_375x667 沒有 JS 錯誤 []
  PASS eight ja_375x667 開房表單(line)
  PASS eight ja_375x667 開房表單(eight)
  PASS eight ja_375x667 等倒數
  PASS eight ja_375x667 對局中
  PASS eight ja_375x667 落子中
  PASS eight ja_375x667 下一題
  PASS eight ja_375x667 結束畫面
  PASS eight ja_375x667 逐題看解法
  PASS eight ja_375x667 對手端結束後看解法前
  PASS eight ja_375x667 沒有 JS 錯誤 []
  PASS line ko_375x667 開房表單(line)
  PASS line ko_375x667 開房表單(eight)
  PASS line ko_375x667 等倒數
  PASS line ko_375x667 對局中
  PASS line ko_375x667 落子中
  PASS line ko_375x667 出局等對手
  PASS line ko_375x667 公開解法
  PASS line ko_375x667 結束畫面
  PASS line ko_375x667 逐題看解法
  PASS line ko_375x667 對手端結束後看解法前
  PASS line ko_375x667 沒有 JS 錯誤 []
  PASS eight ko_375x667 開房表單(line)
  PASS eight ko_375x667 開房表單(eight)
  PASS eight ko_375x667 等倒數
  PASS eight ko_375x667 對局中
  PASS eight ko_375x667 落子中
  PASS eight ko_375x667 下一題
  PASS eight ko_375x667 結束畫面
  PASS eight ko_375x667 逐題看解法
  PASS eight ko_375x667 對手端結束後看解法前
  PASS eight ko_375x667 沒有 JS 錯誤 []
PASS 217／FAIL 0
exit 0
```

截圖在 `check/shots/`：`form_{line,eight}_{zh,en,ja,ko}_{360x640,375x667}.png`（開房表單）、`{line,eight}_{count,play,armed}_…`（倒數、對局中、落子中）、`line_out_…`、`line_reveal_…`、`eight_next_…`、`{line,eight}_end_…`、`{line,eight}_review_…`；另有兩場整場流程的 `*_zh_375x667.png`（`line_play_A`、`line_reveal_B`、`line_none_A`、`line_end_A`、`line_review_A`、`eight_play_A/B`、`eight_end_A`、`eight_review_B`）。

## 4. 截圖裡我看到的問題

- 我只逐張看了少數幾張（`form_line_ja_360x640`、`line_reveal_en_360x640`、`line_out_ko_360x640`），其餘靠腳本的版面檢查（文件不可捲動、可見元素不超出視窗、對話框不可捲、沒有 `undefined`、沒有沒翻的字串鍵）——這些全過，但「好不好看」我沒有逐張審。
- 公開解法那 1.8 秒，flash 文字會蓋在棋盤上、擋住一部分手順（舊版就是這樣，沒改）。
- 日文開房表單：「モード」（類型）和「ルール」（玩法）兩個標籤字面不同，但五子棋那組也叫「ルール」（規則）——不同組、不同時出現，所以沒改；若覺得易混，`vModeL` 可改成別的字。
- 360×640 日文開房表單已被擠到幾乎貼底（落子方式那排與「部屋を作って待つ」只差一點點），沒溢出但沒有餘裕；之後再加一排就要再縮。

## 5. 沒做到／不確定的事

- **沒有真人手機實機看**，只有 Chrome 模擬 360×640、375×667。
- **「真的下錯一手」沒自動化**：下錯出局用 `vOut('bad')` 代替（同送出路徑）；`defFive／forcedForbidden／nofour` 的判定是引擎端，沒新增也沒改。「時間到」出局只在伺服器 timer 與前端 timer 的舊路徑，沒改也沒另測（最短思考上限 60 秒，沒等）。
- 閒置退出、離座判負：兩種玩法走同一段（`idleSince`），我沒改；**沒另外跑 idle 測試**。「再來一局」一線天有測（t1 結尾）；八仙渡沒重測（沒改）。
- 手機端「重新整理頁面」在一線天 `reveal` 階段重連：靠 `vcfOnRoom` 看到 `phase==='reveal'` 會重新公開，程式上有處理，**沒實測**。
- 一線天進行中對手斷線/離座的判負沿用既有 `endBy`；賽後該題的 `log` 會缺（顯示「沒做到」）——八仙渡也是這樣。
- `.dev.vars`：原本就存在（`BANK_URL=http://127.0.0.1:8791`，別的 session 的本機設定），我測試時暫時改成 8793，測完已還原成原內容；若他們的 wrangler（8787）剛好在那段時間偵測到檔案變動而重載，進行中的房間可能被重置——我沒碰他們的行程。
- 防作弊（前端回報解法）、停用題、伺服器不限訊息頻率：同 `docs/duel.md` 原本的待辦，沒處理。
- 舊檔 `vNote` 字串（原本長說明）還留在 I18N 裡沒人用了，沒刪（只准改的範圍內沒壞，下次順手清）。
