# REPORT：兩儀殿 VCF 覆盤「自己擺」

結論：做完了，檢查 56 項全過；負向測試（故意改錯一個期望）如預期 FAIL。**沒有做 git 操作、沒有部署**；只改了 `duel.html`，並在本資料夾新增 `PROGRESS.md`、`REPORT.md`、`check/`。

## 1. 改了什麼（`duel.html`，行號為改完後）

| 行 | 內容 |
|---|---|
| 106–108 | CSS：回看工具列（`#phaseActs:has(.rvt)`）間距 4px、左右邊距 8px；分頁字 11px。為了在同一列塞進兩顆 44px 圖示鈕，360 寬也不縮到 <44px |
| 371／395／419／443 | 四語（zh／en／ja／ko）新字：`rvUndo`（退一手）、`rvReset`（回到這題開頭）、`rvFree`（自己擺，顯示在「第 1／3 題…」那行尾，例「自己擺 3」） |
| 1409 | `RV` 多一個欄位 `free: null`（null＝沒擺，顯示正解／玩家手順；陣列＝自己擺的完整手順） |
| 1516 | `rvFacts`：有自己擺時多一個 `自己擺 N` |
| 1527–1540 | `rvBar`：工具列多 `undo`、`reset` 兩顆 inline SVG 圖示鈕（44×48，在同一列，沒新增一整列）；按 ◀ ▶／正解／玩家分頁一律 `RV.free = null` |
| 1543–1553 | 新 `rvShown()`、`rvTap(ev)`：點空點 → `RV.free = 目前顯示的手順 + 這一點`（所以是「從目前顯示的局面接下去」）；只擋已有子的點 |
| 1602 | `vcfDraw`：有 `RV.free` 就畫它（沿用 `numbered()` 的手順數字畫法） |
| 1634 | `vcfClick` 開頭：回看狀態（`rvIsOn()`）→ 交給 `rvTap` |

賽後逐題回看與首頁「今日棋局」的 `#replay=` 回看**走同一條路徑**（`enterReplay` 把 rec.review 組成唯讀 room，`rvIsOn()` 為真），所以一份程式碼兩處都有。五子棋回看（`renderReplay`）、`// showInApp();`、伺服器都沒動。不送任何 WebSocket 訊息。

行為細節：
- 沒擺過就按「退一手」：從目前顯示的手順（正解或玩家的）退一手開始變成自己擺（同 `game.html` 研究盤的 ◀ 一樣可以一路退回開頭）。
- 「回到這題開頭」：自己擺的線設成空的（只剩題目原樣），仍在自己擺狀態；再按正解／玩家分頁才回到該來源。
- 攻守輪流＝手順奇偶（第 1、3、5…手攻方、第 2、4…手守方），顏色由 `atkWhite` 決定；跟 `game.html` `draw()` 的 `(k%2===0) !== atkWhite` 同一套。

## 2. 跟 `game.html` 研究盤一樣／不一樣

一樣：
- 資料表示：題目＋一條手順（`game.html` 是 `r.seq` + `r.cur`；這邊是 `RV.free` 整條）。
- 下一顆黑白由手順奇偶＋攻方顏色決定；落子後用同樣的聲音規則（`stoneSound(長度 % 2 === 0)`）。
- **只擋「已有子的點」**（題目黑、題目白、已在目前這條線上的點）；**黑棋禁手、四、勝負都不判斷、不問引擎**（`game.html` `twRevTap` 也不擋，所以我也沒多擋）。
- 單點就下（`game.html` 研究盤是 `cv` 的 click → `twRevTap`，沒有「點兩下才下」）。**兩邊不同時以 game.html 為準**：兩儀殿對戰中的 VCF 有 `cfg.tap==='2'` 的點兩下設定，但回看的自己擺不套用，單點。
- 手順數字畫法同（金色／深色數字、同字型大小）。

不一樣：
- `game.html` 研究盤有 `cur` 指標（◀ ▶ 在已擺好的線上前後走、擺在中間會截斷後面）；這邊只有「退一手」（刪最後一手）和「回開頭」，沒有往前走回來。工單只要求退一手／回開頭，沒多做。
- `game.html` 的「看答案」按鈕會把自己擺的存起來（`r.mine`），再按可以回到；這邊切到正解／玩家分頁就**直接清掉**（工單明定）。
- `game.html` 擺子時 `r.seq.slice(0, r.cur)`；這邊從目前顯示的手順接（`rvShown()`），因為兩儀殿顯示的是「正解／某玩家」整條手順。

## 3. 檢查

### 3-1. `node --check`（`<script type="module">` 抽出來）
```
node --check check/module.mjs  → exit 0（無輸出）
```
（`check/module.mjs` 是從 duel.html 抽出的內容，改完後重抽過。）

### 3-2. `check/check_study.mjs`（Playwright；自己起 http.server 8795＋8791、wrangler dev 8789，persist 放 TEMP；兩個 context 當兩位玩家，只用 PID 關自己啟動的行程；截圖只存 `check/shots/`）
涵蓋工單 10 項：賽後逐題回看擺子（顏色、手順數字）、點已有子的點、退一手／回開頭、先看正解再接著擺／切回正解消失、換題消失、首頁 `#replay=` 同樣能擺、WebSocket 攔截（`window.__sent` 前後筆數相同）、五子棋回看按鈕與行為不變、四語×兩尺寸不捲動且按鈕在畫面內且回看按鈕 ≥44px 且分頁文字沒被截斷、全程無 pageerror／console error。

量測方式（誠實說明）：
- 黑／白／空是逐點取石子邊緣內側的像素亮度判斷；手順數字是 hook `RushSkin.fillNum` 記錄；「畫面像素相同」是比對 225 點的黑白空＋手順數字，**不是比整張 dataURL**——棋盤底圖每次重畫有些微像素差（我存下兩張目視相同的圖比對，有 1422 個像素不同），整張比會誤報。
- 真人流程：賽後先跳結算視窗，測試像真人一樣先按「看每題解法」才進回看（一開始我沒按，結算視窗蓋住棋盤，點擊被擋，才發現——這是既有行為，不是 bug）。
- VCF 對局用本機引擎算真解回報 `vdone`，所以「正解」是真的 7 手。

**正向執行完整輸出**（`check/last-run-pass.txt`；`[debug]` 兩行是我留的診斷，無害）：

```== 1. 開局：先打一盤五子棋（回看對照用），再打 VCF
  PASS 賽後先跳結算視窗（mEnd）
  PASS VCF 打完，A 按「看每題解法」進賽後逐題回看
== 2. 賽後逐題回看（A 的房間畫面）
  PASS 工具列在同一列：prev,next,sol,0,1,undo,reset
  PASS 一開始看正解、沒有自己擺的
  PASS 回到這題開頭 → 自己擺的線是空的（只剩題目）
  PASS 回到開頭 → 畫面跟正解不同（正解的手順數字消失）
  [debug] tap J8 {"x":207.26,"y":293} board vp 375x667
  PASS 點空點 J8 → 多一顆子（["J8"]）
  [debug] lum t1 after tap {"s":25,"e":191}
  PASS 第一手顏色＝攻方（黑先）：畫面 b
  PASS 標手順數字 1
  PASS 再點 → 對方顏色：畫面 w
  PASS 手順數字 1、2
  PASS 第三手又是攻方顏色
  PASS 點已有子的點（自己擺的、題目黑、題目白）→ 沒有變化
  PASS 退一手 → 少一顆子（2 手）
  PASS 退一手後手順數字只剩 1、2
  PASS 回到這題開頭 → 回到題目原樣（跟一開始按回到開頭時像素相同）
  PASS 按正解 → 自己擺的消失、回到正解原樣（像素相同）
  PASS 從正解局面接下去：正解 7 手＋1，前段相同
  PASS 手順數字連續
  PASS 切回正解 → 自己擺的消失
  PASS 沒擺過時按退一手 → 從正解退一手
  PASS 看我的手順時也能自己擺
  PASS 切到對手的手順 → 自己擺的消失
  PASS 第 1 題擺了一手
  PASS 換到下一題 → 自己擺的消失
  PASS 換回第 1 題也是乾淨的
  PASS 自己擺（點棋盤、退一手、回開頭、切換）全程沒有送出 WebSocket 訊息（11 → 11）
  PASS zh 375×667 賽後畫面：不捲動、按鈕都在畫面內、回看按鈕 ≥44px（{"sh":667,"ih":667,"sw":375,"iw":375,"bad":[],"small":[]}）
== 3. 首頁今日棋局 → 回看（#replay=）
  PASS A 本機有 2 筆今日棋局（gomoku,vcf）
  PASS 回看畫面也有自己擺的按鈕：prev,next,sol,0,1,undo,reset
  PASS 回看：點兩下 → 接在正解後面擺了 2 手（共 9）
  PASS 回看：兩手顏色不同（輪流）
  PASS 回看：退一手
  PASS 回看：回到這題開頭
  PASS 回看：切回正解 → 原樣
  PASS 回看：換題 → 清掉
  PASS 回看自己擺沒有 WebSocket 訊息（0 → 0）
== 4. 五子棋回看
  PASS 五子棋回看按鈕仍是 4 個 rp：first,prev,next,last
  PASS 五子棋回看點棋盤沒有反應
== 5. 四語 × 375×667、360×640
  PASS zh 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"正解","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS zh 375×667：擺了 3 手
  PASS zh 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"正解","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS zh 360×640：擺了 3 手
  PASS en 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"Answer","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS en 375×667：擺了 3 手
  PASS en 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"Answer","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS en 360×640：擺了 3 手
  PASS ja 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"正解手順","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS ja 375×667：擺了 3 手
  PASS ja 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"正解手順","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS ja 360×640：擺了 3 手
  PASS ko 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"정답","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS ko 375×667：擺了 3 手
  PASS ko 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"정답","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS ko 360×640：擺了 3 手
  PASS 全程沒有 pageerror／console error（0）
PASS 56／FAIL 0

`

**負向測試**（NEG=1 把第一手點擊後的期望從 1 顆改成 2 顆，應 FAIL；已改回，上面正向就是改回後的結果）：

`
== 1. 開局：先打一盤五子棋（回看對照用），再打 VCF
  PASS 賽後先跳結算視窗（mEnd）
  PASS VCF 打完，A 按「看每題解法」進賽後逐題回看
== 2. 賽後逐題回看（A 的房間畫面）
  PASS 工具列在同一列：prev,next,sol,0,1,undo,reset
  PASS 一開始看正解、沒有自己擺的
  PASS 回到這題開頭 → 自己擺的線是空的（只剩題目）
  PASS 回到開頭 → 畫面跟正解不同（正解的手順數字消失）
  [debug] tap G8 {"x":167.73999999999998,"y":293} board vp 375x667
  FAIL 點空點 G8 → 多一顆子（["G8"]）
  [debug] lum t1 after tap {"s":25,"e":191}
  PASS 第一手顏色＝攻方（黑先）：畫面 b
  PASS 標手順數字 1
  PASS 再點 → 對方顏色：畫面 w
  PASS 手順數字 1、2
  PASS 第三手又是攻方顏色
  PASS 點已有子的點（自己擺的、題目黑、題目白）→ 沒有變化
  PASS 退一手 → 少一顆子（2 手）
  PASS 退一手後手順數字只剩 1、2
  PASS 回到這題開頭 → 回到題目原樣（跟一開始按回到開頭時像素相同）
  PASS 按正解 → 自己擺的消失、回到正解原樣（像素相同）
  PASS 從正解局面接下去：正解 7 手＋1，前段相同
  PASS 手順數字連續
  PASS 切回正解 → 自己擺的消失
  PASS 沒擺過時按退一手 → 從正解退一手
  PASS 看我的手順時也能自己擺
  PASS 切到對手的手順 → 自己擺的消失
  PASS 第 1 題擺了一手
  PASS 換到下一題 → 自己擺的消失
  PASS 換回第 1 題也是乾淨的
  PASS 自己擺（點棋盤、退一手、回開頭、切換）全程沒有送出 WebSocket 訊息（11 → 11）
  PASS zh 375×667 賽後畫面：不捲動、按鈕都在畫面內、回看按鈕 ≥44px（{"sh":667,"ih":667,"sw":375,"iw":375,"bad":[],"small":[]}）
== 3. 首頁今日棋局 → 回看（#replay=）
  PASS A 本機有 2 筆今日棋局（gomoku,vcf）
  PASS 回看畫面也有自己擺的按鈕：prev,next,sol,0,1,undo,reset
  PASS 回看：點兩下 → 接在正解後面擺了 2 手（共 9）
  PASS 回看：兩手顏色不同（輪流）
  PASS 回看：退一手
  PASS 回看：回到這題開頭
  PASS 回看：切回正解 → 原樣
  PASS 回看：換題 → 清掉
  PASS 回看自己擺沒有 WebSocket 訊息（0 → 0）
== 4. 五子棋回看
  PASS 五子棋回看按鈕仍是 4 個 rp：first,prev,next,last
  PASS 五子棋回看點棋盤沒有反應
== 5. 四語 × 375×667、360×640
  PASS zh 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"正解","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS zh 375×667：擺了 3 手
  PASS zh 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"正解","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS zh 360×640：擺了 3 手
  PASS en 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"Answer","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS en 375×667：擺了 3 手
  PASS en 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"Answer","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS en 360×640：擺了 3 手
  PASS ja 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"正解手順","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS ja 375×667：擺了 3 手
  PASS ja 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"正解手順","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS ja 360×640：擺了 3 手
  PASS ko 375×667：不捲動、按鈕在畫面內、≥44px（sh 667/667、sw 375/375、bad []、small []）；分頁 [{"t":"정답","cut":false,"w":52},{"t":"Alice","cut":false,"w":54},{"t":"Bob","cut":false,"w":54}]
  PASS ko 375×667：擺了 3 手
  PASS ko 360×640：不捲動、按鈕在畫面內、≥44px（sh 640/640、sw 360/360、bad []、small []）；分頁 [{"t":"정답","cut":false,"w":47},{"t":"Alice","cut":false,"w":49},{"t":"Bob","cut":false,"w":49}]
  PASS ko 360×640：擺了 3 手
  PASS 全程沒有 pageerror／console error（0）
PASS 55／FAIL 1

```
→ exit 1、`FAIL 點空點 G8 → 多一顆子（["G8"]）`，其餘 55 項照過：測試真的在檢查。

## 4. 截圖（我自己都看過）

存在 `check/shots/`：
- `study_replay_zh_375x667.png`（首頁今日棋局進的回看，zh 375×667，擺了 3 手）
- `study_replay_en_360x640.png`（同畫面，en 360×640，擺了 3 手）
- `study_live_zh_375_3moves.png`（賽後逐題回看，zh 375×667，擺了 3 手）
- `replay_gomoku_zh_375.png`（五子棋回看，確認沒變）、`live_review_zh_375.png`、`live_end_dialog_zh_375.png`

看到的：
1. 3 手都標了 1、2、3；黑棋用金色數字、白棋深色數字，顏色輪流正確；工具列在同一列，不捲動，「再來一局」等原有按鈕仍完整在畫面內。
2. **第一版（字 13px、間距 4px）360 寬的三個分頁只有 41–43px，不到 44px**；同時 en 的「Answer」、ja 的「正解手順」被截成「Answ…」。已改（左右邊距 8px、分頁字 11px），現在 360 寬分頁 47–49px、四語文字都不再被截。代價：分頁字 11px 偏小（原本 15px）。
3. 「回到這題開頭」用的 `|◀` 圖示跟旁邊「上一題」的 ◀ 長得有點像（一個是回這題開頭、一個是上一題）。有 aria-label／title 說明，但沒有文字標籤，新用戶第一次可能猜錯；是否換圖示（例如圓形箭頭）留給你決定。
4. 「自己擺」只出現在「第 1／3 題」那行尾的小字（`自己擺 3`），沒有別的視覺提示說明現在是自己擺狀態——切回正解／玩家分頁才會消失，使用者可能不知道那個分頁會清掉自己的線。

## 5. 沒做到／不確定

- `docs/duel.md` 的 VCF 回看段落**沒更新**（工單限制只准改 `duel.html`），請之後補一句「回看可自己擺子，切題／切分頁清掉」。HANDOFF／MAP 也沒動，同理。
- 沒有「往前走回來」（見 §2 不一樣）；擺錯想還原只能「退一手」或「回到開頭」，一旦切分頁就全清。
- 沒有部署、沒有在真手機上測；只測了 Chromium（Playwright）375×667、360×640。「≥44px」只量了回看工具列的按鈕，沒量全頁。
- 黑棋禁手不擋（跟 game.html 研究盤一致）：使用者在黑方擺到禁手也會照下，不會有提示。
- 賽後結算視窗（`mEnd`）蓋住棋盤是既有行為（要先按「看每題解法」），沒動。
- 「≥44px」靠 `#phaseActs:has(.rvt)` 選擇器（`:has()`）；舊瀏覽器（Chrome <105、Firefox <121）不支援時會退回 8px 邊距＋較窄分頁（功能不受影響，360 寬可能分頁略窄）。
- 這台電腦上有別人的 python 訓練，我只關自己起的 http.server／wrangler PID；結束後 workerd 殘留 0 個。