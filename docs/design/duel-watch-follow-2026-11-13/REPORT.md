# REPORT：兩儀殿 VCF 觀戰自動追焦（2026-11-13）

**伺服器沒改、不需要部署對戰伺服器**（只改 `duel.html`，部署走 `tools/deploy_rush.sh`）。我沒做任何 git 操作、沒部署。

## 改了什麼（`duel.html`）
- 786–788：新狀態 `watchAuto`、`watchFocus`（null＝一線天這題還沒人落子）、`watchPuz`、`watchKey` 與 `watchReset()`（`enterRoom`／`toLobby`／回看三處原本的 `watchSeat = 0` 改呼叫它）。
- 1405–1470：`watchTo`／`watchManual`／`watchBackAuto`／`watchFollow`。`watchFollow()` 在 `vcfOnRoom()` 內（觀戰者、對局進行中、非 REPLAY）每次收到房間狀態執行；換房或再來一局（`room.id:games` 變了）自動回到自動。兩列玩家列都能點（點已在看的那位不動）。
- 1527–1545 `vcfBar`：觀戰者進行中，正在看的那列加 `.view`（金框＋底色＋內框）＋文字標籤「觀看中」；另一列有「看他」小標、`role=button`、`tabindex=0`、aria-label、Enter／空白鍵可切。觀戰時不再套 `.on`（避免跟金框混淆）。tick 每 100ms 重畫改成內容沒變就不重寫（按鈕才不會按到一半被換掉）。
- 1547–1560 `vcfStatus`：觀戰狀態行改成「正在看：暱稱・第 n 題・剩 t」＋自動時的「自動」小標；一線天還沒人落子寫「等第一手・…」。
- 215 行起：工具列（rhead）新增 `#bWatchAuto`「自動」鈕（手動時才顯示、≥44px、aria「自動追焦」）；CSS 119–128。
- 370／395／420／445 行：四語新字串 `vOn vLook vWatchN vFirst vSwitch vAuto vAutoAria vWatchRest vLookAria`。
- 992 `clearBarAttrs`：五子棋的 `renderBar`／`emptySeatBar` 進來時清掉 VCF 觀戰留下的 `data-seat／role／tabindex／aria-label／cursor`（第一輪檢查抓到的 bug：從 VCF 房切到五子棋房，玩家列殘留 `role=button`，已修）。
- 1752 `window.__duel`（只有本機）多開 `watchFocus`、`watchAuto` 兩個唯讀 getter 給測試。
- 原本「點上方玩家列換邊」的 `⇅` 小記號與單純 flip 邏輯被取代。`// showInApp();`、喇叭小框、齒輪、`RushSettings` 沒動。

## 判斷「先落子、出局、領先」用的資料（伺服器原本就送給觀戰者的）
- **先落子**：`room.vs.p[座位].seq` 非空，或 `s === 'armed'`／`'solved'`（玩家每下完一手送 `vprog`，伺服器把 `seq` 只送給不在座位上的人）。
- **出局**：`room.vs.p[座位].s === 'out'`（含下錯、時間到、`late`）。一線天跟著的人出局 → 另一位還沒出局就切過去；兩人都出局由伺服器進 reveal 流程，前端不動。
- **領先**：`room.vs.score[座位]`；八仙渡「另一位分數 > 現在看的那位」才切，同分不動，0:0 預設座位 0。
- 一線天 reveal（公開解法）期間 focus 不動；`vs.p[0].i` 變了（換題）才重設為「等第一手」。

## 檢查完整輸出

### node --check
`duel.html` 的 module script 抽到 `check/module.mjs`：`node --check` → SYNTAX_OK（`check/last-syntax.txt`）。伺服器沒改，不用檢查。

### check_follow.mjs 正向（`check/last-run-pass.txt`）
```
== 1. 一線天
  A 座位 0、B 座位 1
  PASS 題目 1 開始：還沒人落子：兩列都沒有「觀看中」、狀態「等第一手・第 1 題・剩 3:00自動」
  PASS 題目原樣：棋盤上 12 顆題目子、沒有手順；兩列都是「看他」
  PASS 一線天：B 先落子 → C 自動看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 1 題・剩 3:00自動」、focus 1）
  PASS 棋盤上出現 B 的第一手 H10
  PASS 自動追焦中：狀態行有「自動」小標、沒有「自動」鈕
  PASS 切換提示「改看 Bob」出現
  PASS 一線天：B 下錯出局 → C 自動切到 A：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 1 題・剩 2:59自動」、focus 0）
  PASS 切換提示「改看 Alice」出現（自動切）
  PASS 切到 A 後棋盤上沒有 B 的子（A 還沒下）
  PASS A 解開 → 公開解法（reveal 有手順、focus 不變）
  PASS 換下一題：重新從「等第一手」開始：兩列都沒有「觀看中」、狀態「等第一手・第 2 題・剩 3:00自動」
  PASS 下一題 A 先落子 → C 跟 A：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 2 題・剩 3:00自動」、focus 0）
  PASS 手動點 B 的列 → 看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 2 題・剩 3:00」、focus 1）
  PASS 手動後：「自動」小標消失、出現可按的「自動」鈕（aria「自動追焦」）
  PASS 「自動」鈕 52×44、在畫面內
  PASS 手動切也有「改看 Bob」提示
  PASS 手動後換題 → 不跳（仍看 B，focus 1）
  PASS 換題後仍是手動看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 3 題・剩 3:00」、focus 1）
  PASS 手動後 A 先落子 → 不跳（仍看 B）
  PASS A 先落子後仍看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 3 題・剩 2:59」、focus 1）
  PASS 按「自動」→ 立刻跳到該看的人（A 先落子了）：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 3 題・剩 2:59自動」、focus 0）
  PASS 回到自動：小標回來、「自動」鈕消失
  PASS 玩家 A 自己的畫面：沒有「自動」鈕、觀看中、看他、小標（狀態「第 3 題・想好再落子・剩 2:59」）
  PASS 玩家 B 自己的畫面：沒有「自動」鈕、觀看中、看他、小標（狀態「第 3 題・想好再落子・剩 2:59」）
  PASS 一線天：A 出局 → 自動切 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 3 題・剩 2:59自動」、focus 1）
  PASS 兩人都出局 → 公開解法流程（沒人得分、out:bad out:bad）
  PASS 兩人都出局後下一題：回到「等第一手」：兩列都沒有「觀看中」、狀態「等第一手・第 4 題・剩 3:00自動」
== 2. 四語 × 375×667、360×640（觀戰畫面）
  PASS zh 375×667 等第一手：兩列都沒有「觀看中」、狀態「等第一手・第 4 題・剩 2:58自動」
  PASS zh 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS zh 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 4 題・剩 2:57」、focus 1）
  PASS zh 375×667：「自動」鈕文字「自動」52×44、在畫面內
  PASS zh 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS zh：切換提示「改看 Bob」
  PASS zh 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS zh 375×667：按「自動」→ 小標「自動」
  PASS zh 360×640 等第一手：兩列都沒有「觀看中」、狀態「等第一手・第 4 題・剩 2:55自動」
  PASS zh 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS zh 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 4 題・剩 2:54」、focus 1）
  PASS zh 360×640：「自動」鈕文字「自動」52×44、在畫面內
  PASS zh 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS zh：切換提示「改看 Bob」
  PASS zh 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS zh 360×640：按「自動」→ 小標「自動」
  PASS en 375×667 等第一手：兩列都沒有「Watching」、狀態「Waiting for 1st move・puzzle 4 · 2:52 leftAuto」
  PASS en 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS en 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「Watching: Bob・puzzle 4 · 2:51 left」、focus 1）
  PASS en 375×667：「自動」鈕文字「Auto」57×44、在畫面內
  PASS en 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS en：切換提示「Now watching Bob」
  PASS en 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS en 375×667：按「自動」→ 小標「Auto」
  PASS en 360×640 等第一手：兩列都沒有「Watching」、狀態「Waiting for 1st move・puzzle 4 · 2:49 leftAuto」
  PASS en 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS en 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「Watching: Bob・puzzle 4 · 2:48 left」、focus 1）
  PASS en 360×640：「自動」鈕文字「Auto」57×44、在畫面內
  PASS en 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS en：切換提示「Now watching Bob」
  PASS en 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS en 360×640：按「自動」→ 小標「Auto」
  PASS ja 375×667 等第一手：兩列都沒有「注目中」、狀態「初手待ち・第4問・残り 2:45自動」
  PASS ja 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS ja 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「注目：Bob・第4問・残り 2:45」、focus 1）
  PASS ja 375×667：「自動」鈕文字「自動」52×44、在畫面內
  PASS ja 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS ja：切換提示「Bobに切替」
  PASS ja 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ja 375×667：按「自動」→ 小標「自動」
  PASS ja 360×640 等第一手：兩列都沒有「注目中」、狀態「初手待ち・第4問・残り 2:42自動」
  PASS ja 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS ja 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「注目：Bob・第4問・残り 2:41」、focus 1）
  PASS ja 360×640：「自動」鈕文字「自動」52×44、在畫面內
  PASS ja 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS ja：切換提示「Bobに切替」
  PASS ja 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ja 360×640：按「自動」→ 小標「自動」
  PASS ko 375×667 等第一手：兩列都沒有「보는 중」、狀態「첫 수 대기・4번 문제 · 2:39 남음자동」
  PASS ko 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS ko 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「보는 중: Bob・4번 문제 · 2:38 남음」、focus 1）
  PASS ko 375×667：「自動」鈕文字「자동」50×44、在畫面內
  PASS ko 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS ko：切換提示「Bob 관전」
  PASS ko 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ko 375×667：按「自動」→ 小標「자동」
  PASS ko 360×640 等第一手：兩列都沒有「보는 중」、狀態「첫 수 대기・4번 문제 · 2:36 남음자동」
  PASS ko 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS ko 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「보는 중: Bob・4번 문제 · 2:35 남음」、focus 1）
  PASS ko 360×640：「自動」鈕文字「자동」50×44、在畫面內
  PASS ko 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS ko：切換提示「Bob 관전」
  PASS ko 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ko 360×640：按「自動」→ 小標「자동」
== 3. 八仙渡
  PASS 八仙渡 0:0 → 預設看座位 0（Alice）：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 1 題・剩 3:00自動」、focus 0）
  PASS Bob 解開一題（0:1，領先）→ C 看 Bob：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 1 題・剩 3:00自動」、focus 1）
  PASS Alice 也解開一題（1:1）→ C 仍看 Bob（focus 1）
  PASS 同分不換：標示仍在原本那位：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 1 題・剩 3:00自動」、focus 1）
  PASS Alice 再解開一題（2:1，超車）→ C 切到 Alice：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 2 題・剩 3:00自動」、focus 0）
  PASS 超車切換有「改看 Alice」提示
  PASS 手動點 Bob → 看 Bob：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 2 題・剩 3:00」、focus 1）
  PASS 手動後：「自動」小標消失、「自動」鈕出現
  PASS 手動後對手超車（3:2）→ 不跳（仍看 Bob）
  PASS 按「自動」→ 立刻跳到領先的 Alice（3:2）：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 3 題・剩 2:59自動」、focus 0）
  PASS 回到自動
  PASS 賽後逐題回看：不顯示「自動」鈕、觀看中、看他（btn false）
  PASS 再來一局 → 回到自動（auto true、focus 0、小標 自動）
  PASS 新的一局：0:0 預設看座位 0：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 1 題・剩 2:59自動」、focus 0）
== 4. 五子棋房觀戰
  PASS 五子棋房觀戰：沒有自動鈕、觀看中、看他、可點的玩家列（{"view":false,"tag":false,"flip":false}）
  PASS 五子棋房點上方玩家列沒有反應
== 5. C 送出的訊息
  PASS C 全程送出 7 則：["view","ping","leave"]；沒有任何影響對局的類型（[]）
  PASS 全程沒有 pageerror／console error（0）
PASS 109／FAIL 0
```

### 負向測試 `NEG=1`（`check/last-run-neg.txt`；預期 FAIL 那一條）
```
== 1. 一線天
  A 座位 0、B 座位 1
  PASS 題目 1 開始：還沒人落子：兩列都沒有「觀看中」、狀態「等第一手・第 1 題・剩 3:00自動」
  PASS 題目原樣：棋盤上 20 顆題目子、沒有手順；兩列都是「看他」
  PASS 一線天：B 先落子 → C 自動看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 1 題・剩 3:00自動」、focus 1）
  PASS 棋盤上出現 B 的第一手 J14
  PASS 自動追焦中：狀態行有「自動」小標、沒有「自動」鈕
  PASS 切換提示「改看 Bob」出現
  PASS 一線天：B 下錯出局 → C 自動切到 A：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 1 題・剩 2:59自動」、focus 0）
  PASS 切換提示「改看 Alice」出現（自動切）
  PASS 切到 A 後棋盤上沒有 B 的子（A 還沒下）
  PASS A 解開 → 公開解法（reveal 有手順、focus 不變）
  PASS 換下一題：重新從「等第一手」開始：兩列都沒有「觀看中」、狀態「等第一手・第 2 題・剩 3:00自動」
  PASS 下一題 A 先落子 → C 跟 A：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 2 題・剩 3:00自動」、focus 0）
  PASS 手動點 B 的列 → 看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 2 題・剩 3:00」、focus 1）
  PASS 手動後：「自動」小標消失、出現可按的「自動」鈕（aria「自動追焦」）
  PASS 「自動」鈕 52×44、在畫面內
  PASS 手動切也有「改看 Bob」提示
  PASS 手動後換題 → 不跳（仍看 B，focus 1）
  PASS 換題後仍是手動看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 3 題・剩 3:00」、focus 1）
  PASS 手動後 A 先落子 → 不跳（仍看 B）
  PASS A 先落子後仍看 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 3 題・剩 2:59」、focus 1）
  PASS 按「自動」→ 立刻跳到該看的人（A 先落子了）：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 3 題・剩 2:59自動」、focus 0）
  PASS 回到自動：小標回來、「自動」鈕消失
  PASS 玩家 A 自己的畫面：沒有「自動」鈕、觀看中、看他、小標（狀態「第 3 題・想好再落子・剩 2:59」）
  PASS 玩家 B 自己的畫面：沒有「自動」鈕、觀看中、看他、小標（狀態「第 3 題・想好再落子・剩 2:59」）
  PASS 一線天：A 出局 → 自動切 B：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 3 題・剩 2:59自動」、focus 1）
  PASS 兩人都出局 → 公開解法流程（沒人得分、out:bad out:bad）
  PASS 兩人都出局後下一題：回到「等第一手」：兩列都沒有「觀看中」、狀態「等第一手・第 4 題・剩 3:00自動」
== 2. 四語 × 375×667、360×640（觀戰畫面）
  PASS zh 375×667 等第一手：兩列都沒有「觀看中」、狀態「等第一手・第 4 題・剩 2:58自動」
  PASS zh 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS zh 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 4 題・剩 2:58」、focus 1）
  PASS zh 375×667：「自動」鈕文字「自動」52×44、在畫面內
  PASS zh 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS zh：切換提示「改看 Bob」
  PASS zh 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS zh 375×667：按「自動」→ 小標「自動」
  PASS zh 360×640 等第一手：兩列都沒有「觀看中」、狀態「等第一手・第 4 題・剩 2:55自動」
  PASS zh 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS zh 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 4 題・剩 2:54」、focus 1）
  PASS zh 360×640：「自動」鈕文字「自動」52×44、在畫面內
  PASS zh 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS zh：切換提示「改看 Bob」
  PASS zh 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS zh 360×640：按「自動」→ 小標「自動」
  PASS en 375×667 等第一手：兩列都沒有「Watching」、狀態「Waiting for 1st move・puzzle 4 · 2:52 leftAuto」
  PASS en 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS en 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「Watching: Bob・puzzle 4 · 2:51 left」、focus 1）
  PASS en 375×667：「自動」鈕文字「Auto」57×44、在畫面內
  PASS en 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS en：切換提示「Now watching Bob」
  PASS en 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS en 375×667：按「自動」→ 小標「Auto」
  PASS en 360×640 等第一手：兩列都沒有「Watching」、狀態「Waiting for 1st move・puzzle 4 · 2:49 leftAuto」
  PASS en 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS en 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「Watching: Bob・puzzle 4 · 2:48 left」、focus 1）
  PASS en 360×640：「自動」鈕文字「Auto」57×44、在畫面內
  PASS en 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS en：切換提示「Now watching Bob」
  PASS en 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS en 360×640：按「自動」→ 小標「Auto」
  PASS ja 375×667 等第一手：兩列都沒有「注目中」、狀態「初手待ち・第4問・残り 2:45自動」
  PASS ja 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS ja 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「注目：Bob・第4問・残り 2:45」、focus 1）
  PASS ja 375×667：「自動」鈕文字「自動」52×44、在畫面內
  PASS ja 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS ja：切換提示「Bobに切替」
  PASS ja 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ja 375×667：按「自動」→ 小標「自動」
  PASS ja 360×640 等第一手：兩列都沒有「注目中」、狀態「初手待ち・第4問・残り 2:42自動」
  PASS ja 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS ja 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「注目：Bob・第4問・残り 2:42」、focus 1）
  PASS ja 360×640：「自動」鈕文字「自動」52×44、在畫面內
  PASS ja 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS ja：切換提示「Bobに切替」
  PASS ja 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ja 360×640：按「自動」→ 小標「自動」
  PASS ko 375×667 等第一手：兩列都沒有「보는 중」、狀態「첫 수 대기・4번 문제 · 2:39 남음자동」
  PASS ko 375×667 等第一手：不捲動（sh 667/667、sw 375/375）
  PASS ko 375×667 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「보는 중: Bob・4번 문제 · 2:38 남음」、focus 1）
  PASS ko 375×667：「自動」鈕文字「자동」50×44、在畫面內
  PASS ko 375×667 手動後：不捲動（sh 667/667、sw 375/375）
  PASS ko：切換提示「Bob 관전」
  PASS ko 375×667：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ko 375×667：按「自動」→ 小標「자동」
  PASS ko 360×640 等第一手：兩列都沒有「보는 중」、狀態「첫 수 대기・4번 문제 · 2:36 남음자동」
  PASS ko 360×640 等第一手：不捲動（sh 640/640、sw 360/360）
  PASS ko 360×640 手動後：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「보는 중: Bob・4번 문제 · 2:35 남음」、focus 1）
  PASS ko 360×640：「自動」鈕文字「자동」50×44、在畫面內
  PASS ko 360×640 手動後：不捲動（sh 640/640、sw 360/360）
  PASS ko：切換提示「Bob 관전」
  PASS ko 360×640：標籤沒被切、狀態行沒換行（標籤 []、狀態高 29）
  PASS ko 360×640：按「自動」→ 小標「자동」
== 3. 八仙渡
  PASS 八仙渡 0:0 → 預設看座位 0（Alice）：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 1 題・剩 3:00自動」、focus 0）
  PASS Bob 解開一題（0:1，領先）→ C 看 Bob：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 1 題・剩 3:00自動」、focus 1）
  FAIL 【負向】同分 1:1 應該切到座位 0（這條預期 FAIL，因為規則是同分不換）
  PASS 同分不換：標示仍在原本那位：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 1 題・剩 3:00自動」、focus 1）
  PASS Alice 再解開一題（2:1，超車）→ C 切到 Alice：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 2 題・剩 3:00自動」、focus 0）
  PASS 超車切換有「改看 Alice」提示
  PASS 手動點 Bob → 看 Bob：看 Bob（觀看中列＝bot:Bob、另一列看他、狀態「正在看：Bob・第 2 題・剩 3:00」、focus 1）
  PASS 手動後：「自動」小標消失、「自動」鈕出現
  PASS 手動後對手超車（3:2）→ 不跳（仍看 Bob）
  PASS 按「自動」→ 立刻跳到領先的 Alice（3:2）：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 3 題・剩 2:59自動」、focus 0）
  PASS 回到自動
  PASS 賽後逐題回看：不顯示「自動」鈕、觀看中、看他（btn false）
  PASS 再來一局 → 回到自動（auto true、focus 0、小標 自動）
  PASS 新的一局：0:0 預設看座位 0：看 Alice（觀看中列＝bot:Alice、另一列看他、狀態「正在看：Alice・第 1 題・剩 2:59自動」、focus 0）
== 4. 五子棋房觀戰
  PASS 五子棋房觀戰：沒有自動鈕、觀看中、看他、可點的玩家列（{"view":false,"tag":false,"flip":false}）
  PASS 五子棋房點上方玩家列沒有反應
== 5. C 送出的訊息
  PASS C 全程送出 7 則：["view","ping","leave"]；沒有任何影響對局的類型（[]）
  PASS 全程沒有 pageerror／console error（0）
PASS 108／FAIL 1
```
負向把「同分 1:1」的期望故意改成「應該切」，如預期只有這一條 FAIL（108 PASS／1 FAIL），證明同分不換的斷言抓得到違規。

## 截圖（`check/shots/`，我都看過）
- `line_first_zh_375x667.png`：一線天題目剛開始。狀態行「等第一手・第 1 題・剩 3:00」＋「自動」小標；兩列都只有「看他」、沒有「觀看中」；棋盤只有題目子。OK。
- `line_auto_zh_375x667.png`：B 先落子後自動看 B。下方 Bob 整列金框＋「觀看中」，狀態行「正在看：Bob」，棋盤有 B 的手順 1；上方 Alice「看他」；下方提示「改看 Bob」。OK。
- `eight_auto_zh_375x667.png`（未逐張詳述，同上版型）、`eight_manual_zh_375x667.png`：手動後工具列出現金框「自動」鈕，小標消失，「正在看：Bob」。
- `line_manual_en_360x640.png`：en 360×640 手動後，「Auto」鈕、「Watching: Alice」、「Watching」標籤都完整；提示「Now watching Alice」。
- 看到的問題：
  1. 「自動」鈕在工具列出現時把標題擠窄：zh 的「八仙渡 3192」會折成兩行、副標被截成「初段・每…」；en 的「Sky Gap 4900」折成三行。棋盤與按鈕仍在畫面內、不捲動，但標題較醜。我沒再改（要改只能縮標題或把鈕換位置，屬設計取捨）。
  2. 狀態行「正在看：Bob」跟「・第 1 題」之間有一點空隙（flex gap），不影響閱讀。
  3. 提示（toast）出現在畫面底部，會短暫蓋住「黑先・1 人觀戰」那行（1.8 秒），是頁面既有 toast 樣式。

## 沒做到或不確定的事
- 玩家「出局」「先落子」是用 ws 直接送 `vprog`／`vout`／`vdone` 模擬（跟真頁面送的訊息格式相同），沒有用真人點棋盤下棋；玩家自己那條下棋流程沒改動，所以沒重測。
- 一線天兩人在同一個 ws 訊息裡同時各有第一手（很罕見）時，會優先看原本顯示的那位，沒有專門測。
- 玩家下錯第一手（`vout` 時 seq 為空）且另一位還沒下時，我讓 C 去看還沒出局的那位（規則沒規定這種情況）；未單獨測。
- `docs/duel.md`「觀戰」段落還寫「點上方玩家列換看另一位」，我依限制沒碰它，接手者要同步成自動追焦＋手動／「自動」鈕＋標示規則。
- 沒有實機（手機）測，只有 Chrome 375×667、360×640 四語。
- `tools/` 與其他資料夾的截圖沒有重跑。
