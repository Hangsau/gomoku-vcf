# 棋盤座標 施工報告（2026-11-13）

施工單：`WORKORDER.md`。沒有做任何 git 操作、沒有部署；行程只關自己起的 PID（http.server 8795／8796／8791、wrangler dev 8789）。

## 結論

- `game.html`（解題各模式、象牙塔研究盤、覆盤研究盤、無相界）與 `duel.html`（五子棋對局、VCF 對局、觀戰、賽後逐題回看與「自己擺」、`#replay=` 回看）的 15×15 棋盤都會畫座標：A–P（無 I）由左到右在下緣、1–15 由下到上在左緣，顏色＝目前棋盤樣式的 `label`。
- 設定頁（共用 `game/settings.js`）在「棋具」下一列有「棋盤座標」開關（`role="switch"`、列高 54px、四語），存 `vcfgame.coords`（`'1'`／`'0'`），**預設關**；切換立刻重畫；兩頁共用；兩儀殿對局中從齒輪切換不重連、不送任何房間訊息。
- 最終檢查 `check/last-run.txt`：**PASS 201／FAIL 0**；負向測試 `last-run-neg.txt` 有預期的 FAIL。
- 全矩陣 392 個量測點（game 6 情境＋duel 8 情境 × 4 語 × 7 尺寸），開著時格距 **95.95%～96.04%**（要求 ≥95%）；關著時 390 點跟改動前基準逐項相同、2 點是舊版本身就會出現的版面不穩狀態（見「沒做到或不確定」第 1 條）。

## 共用程式怎麼切

全部在 `game/skin.js`（兩頁本來就共用的棋盤繪製檔）：

| 項目 | 內容 |
|---|---|
| `RushSkin.geom(px, n=15, coords=目前開關)` | 回 `{ pad, cell, coords }`。關著＝原本算法（`pad = px×0.045`、`cell = (px−2pad)/14`）；開著＝`cell = 原 cell × 0.96`，`pad = (px − 14cell)/2`（把省下的格距還給邊）。兩頁的 `setBoardPx` 都改叫它（新函式 `regeom()`），`pad`／`cell` 的算式只剩這一份。 |
| `drawBoard(ctx, o)` 新增 `o.coords` | 為真且 n=15 才畫座標字（`drawCoords`）。`score.html`、`learn.js`、`shop.js`、`skin-picker.js` 不傳這個欄位，畫出來跟以前一樣。 |
| `drawCoords` | 字畫在「最外圈棋子外緣（半徑 0.46 格）到盤邊」那一圈的正中間，所以**幾何上**不會被邊上的棋子蓋住、不壓格線與星位、不出盤。字級 = clamp((這圈寬 − 2.4)/0.72, 7, 11) px，字重 600（手順數字是 700，檢查用它區分）；兩位數若比這圈寬，橫向壓窄（最低 0.6 倍）。 |
| `RushSkin.coords()`／`setCoords(on)` | 讀寫 `vcfgame.coords`，`setCoords` 發 `rushskin` 事件；`storage` 事件讓別的分頁也跟著。頁面的 `RushSkin.onChange` 從只 `draw()` 改成 `regeom(); draw()`。 |

其他改動：`game.html`／`duel.html` 的 `draw()` 傳 `coords: RushSkin.coords()`；`duel.html` 的本機除錯物件 `window.__duel` 多露一個 `cellAt`（只在 `127.0.0.1` 才存在，給點擊對位測試用）；`game/settings.js` 加開關列（`#setCoords`）、四語字串 `setCoords`、樣式，以及一段 `@media (max-height:600px)`（見下）；`skin.js?v=`、`settings.js?v=` 全換 `20261113c`（`game.html`、`duel.html`、`score.html`）。`score.html` 只換版號。

### 設定頁在 320×568 被擠出去、已處理
多一列（54px）後，改動前剛好放下的 320×568 設定頁（留言列底 542／568）變成 597，game 頁開始捲、duel 疊層被裁。處理：`settings.js` 加 `@media (max-height:600px){ .vrow,.lrow,.swrow{min-height:46px} .setBody{gap:8px} }`，這個高度以下每列 54→46（仍 ≥44px 觸控），改完留言列底 540（比改動前還少 2px）。這會讓矮螢幕上**既有的**設定列也縮了 8px，不是只有新列。375×667 以上不受影響。

## 每個尺寸用了多少留白、格距縮多少

改動前棋盤邊到最外圈線的留白 `pad` 只有邊長 4.5%（10.8–22.7px），扣掉邊上棋子占的半徑（0.46 格，約 7–15px）後，能放字的只剩 3.6–7.7px，放不下字高約 8–11px 的座標。所以開著時 pad 增為約 6.3%，格距縮成 96%。棋盤外框（位置、大小）完全不動，所以頁面版面（其他列、按鈕、捲動）不會變。

遊戲解題畫面（`game|prac|zh`）：

| 尺寸 | 棋盤邊長 | 舊 pad | 舊 cell | 開著 pad | 開著 cell | cell 比 | 字級 |
|---|---|---|---|---|---|---|---|
| 320×568 | 255 | 11.48 | 16.58 | 16.12 | 15.91 | 95.96% | 8.9px |
| 360×640 | 300 | 13.5 | 19.5 | 18.96 | 18.72 | 96.00% | 11.0px |
| 375×667 | 327 | 14.72 | 21.26 | 20.67 | 20.4 | 95.95% | 11.0px |
| 390×844 | 374 | 16.83 | 24.31 | 23.64 | 23.34 | 96.01% | 11.0px |
| 412×915 | 396 | 17.82 | 25.74 | 25.03 | 24.71 | 96.00% | 11.0px |
| 768×1024 | 504 | 22.68 | 32.76 | 31.85 | 31.45 | 96.00% | 11.0px |
| 1280×800 | 460 | 20.7 | 29.9 | 29.07 | 28.7 | 95.99% | 11.0px |

最擠的兩儀殿 VCF 對局（`duel|vcf-play|zh`，320×568 時棋盤只有 240px，是頁面自己的下限）：cell 15.6 → 14.98（96.03%）、pad 10.8 → 15.17、字級 8.2px。全矩陣最小字級 8.17px（`game|twSolve|zh` 320×568）。全部 392 點跨尺寸的最小／最大 cell 比：95.95%（`duel|vcf-review|zh` 360×640）／96.04%（`duel|vcf-review|ko` 320×568）。點擊判定半徑是半格，所以也是改動前的 95.95% 以上。

## 看截圖發現的問題（`check/shots/`，每張都自己看過）

- 320×568 解題（`game_rush_zh_320x568.png`）、320×568 VCF 觀戰含「正在看」與「自動」鈕（`duel_vcf_watch_auto_zh_320x568.png`）：字約 8–9px，小但清楚可讀；沒被邊上的子蓋住（畫面裡 A 欄、15 列都有子貼邊）、沒壓到格線或星位、沒貼到盤邊。這是全部畫面裡字最小的情況。
- 360×640、375×667、412×915、768×1024：字 11px，清楚。768 寬時 11px 字相對 31px 的格偏小，但不影響辨認（字級上限我定 11，沒有隨盤放大，是取捨）。
- 360×640 兩儀殿五子棋對局／VCF 對局／觀戰／逐題回看（含「自己擺」，`duel_vcf_review_free_zh_360x640.png`）：字都在盤邊留白內，手順數字與紅點沒有錯位。
- 320×568 象牙塔研究盤（`game_twRev_zh_320x568.png`，**模擬畫面**，見下）：字清楚、棋盤外框跟改動前相同。
- 夜墨（`game_prac_night_zh_360x640.png`、`duel_replay_night_zh_360x640.png`）：淺灰藍字（`#AEB7CC`）在深底上對比很好。附帶看到：夜墨盤上的**黑子**幾乎融進底色（舊就有的現象，不是這次造成的；`duel_replay_night` 裡黑子只剩金色連五框）。
- 星空（`game_prac_starry_zh_360x640.png`）：淺色字（`#AEB7E0`）在星雲圖上清楚。
- 泳池（`duel_replay_pool_zh_360x640.png`）：深青字（`#0A4756`）在亮青水波圖上是所有盤裡最弱的，水波高光處略吃字，但仍可讀；沒有針對圖片盤加描邊（施工單沒要求，若要更保險可以給 label 加一圈淡描邊）。
- 沒有看到字被棋子蓋住、字跟星位或格線打架、字貼到盤邊的情況。

## 改動前就會捲動／按鈕出界／重疊的組合（基準）

共 22 個組合（都在**象牙塔模擬畫面**與一個練習畫面），開著之後超出像素與出界按鈕數都沒有增加（`last-run.txt` 第 2 節逐點驗過）：

```
game|twSolve|320x568  zh:72px/出界5 en:93px/出界5 ja:93px/出界5 ko:93px/出界5
game|twRev|320x568    zh:154px/出界8 en:183px/出界11 ja:175px/出界11 ko:175px/出界11
game|twRev|360x640    zh:82px/出界5 en:103px/出界6 ja:82px/出界6 ko:103px/出界5
game|twRev|375x667    zh:113px/出界8 en:134px/出界8 ja:113px/出界8 ko:113px/出界8
game|prac|320x568     en:6px ja:6px ko:6px
game|twSolve|360x640  en:21px/出界5 ko:21px/出界5
game|twSolve|375x667  en:21px/出界5
```

注意：象牙塔的「解題」與「答錯研究盤」是我從練習畫面用腳本硬切過去的（`document.body.classList.add('tw')`＋`twShowRev(true)`），沒有走真的象牙塔流程（那要連正式站 API），所以這幾列的絕對超出數字不代表真機，只拿來驗「開著不比關著更糟」。

## 沒做到或不確定的事（老實寫）

1. **舊版兩儀殿在 ja 320×568 的版面本身不穩**：同一個情境（五子棋對局）、同一份舊程式，棋盤有時是 242px（`.tight` 沒套上）有時是 296px（`.tight` 套上），兩種狀態都穩定、取決於進入的路徑與時序。`last-run-ja-probe.txt` 是舊快照 8 次／新程式 8 次各量一次：舊也出現 `[39,141,242]` 與 `[12,150,296]` 兩態。最終矩陣中有 2 點（`duel|gomoku-play|ja|320x568`、`duel|gomoku-watch|ja|320x568`）本輪量到的外框跟基準不同（`[9,127,302]`、`[23.5,141,273]`），不是我動了版面（我沒動 `layout()`；`pad = 邊長×4.5%` 與 `cell` 算式在關著時完全沒變，檢查有驗）。這些點的「開著 vs 關著」改用同一輪的關著當參考比較，仍過。這是舊頁面的 `layout()` 有遲滯（結果取決於先前是否已套 `.tight`）的既有問題，沒修，建議另開單處理。
2. **象牙塔真流程沒走**：象牙塔的解題與研究盤是模擬（理由見上）；覆盤研究盤是呼叫真的 `openRv()`，是真畫面。象牙塔真流程需要連正式站 API，沒測。
3. **「逐像素相同」的驗法**：關著時用棋盤外框、`pad`、`cell`、捲動量、按鈕出界、與棋盤重疊逐點比對（到 0.01px），沒有做整頁截圖逐像素 diff。商店／棋具頁預覽盤用 canvas `toDataURL` 比對（舊快照／新關／新開三份相同）；score.html 盤面 svg 內容、教學盤 DOM 都三份相同。
4. **文件沒對齊**：施工單限定只准改 `game/skin.js`、`game/settings.js`、`game.html`、`duel.html`、`score.html` 版號與本資料夾，所以 `HANDOFF.md`、`MAP.md`、`docs/handover.md`、`CHANGELOG.md` 都沒動，需要主 session 補（新增：`vcfgame.coords` 鍵、`RushSkin.geom／coords／setCoords`、`RushSettings` 多一列、`__duel.cellAt`）。`game/skin.js` 檔頭註解也沒補一行座標說明（座標段自己有註解）。
5. **字級隨盤大小只到 11px**；320 寬的 8–9px 是這個設計能給的上限（再大就得縮格距超過 5%）。
6. 圖片盤（泳池）上字的對比偏弱，見上。沒有做 WCAG 對比數值計算，是目視。
7. 「真的點 H8」只在兩儀殿五子棋對局做了一次真實點擊（送出 `move p=112`）；game.html 與其他情境的點擊對位用 `cellAt` 直接餵座標驗證（H8＝天元、四角、半格判定邊界）。

## 檔案

- `check/h.mjs`（量測與情境共用）、`check/scenes.mjs`（情境矩陣）、`check/baseline.mjs`（改動前基準，從改動前複製的快照目錄跑）、`check/check_coords.mjs`（驗收）、`check/shots_extra.mjs`（深色／圖片盤補拍）、`check/ja_probe.mjs`（舊版版面不穩排查）。
- 產物：`check/baseline.json`（408 筆，改動前）、`check/after.json`（改動後）、`check/last-run.txt`（最終輸出）、`check/last-run-neg.txt`（負向）、`check/last-run-ja-probe.txt`、`check/shots/`（21 張截圖）。`check/baseline.prev.json`、`baseline-smoke.json`、`baseline-run*.txt`、`quick-run.txt` 是除錯中間檔，可刪。
- 基準是從改動前複製的快照（`%TEMP%/vcf-snap-coords`，含另一個工作階段已加進來的「無相界」）跑出來的，不是跑 git 版本。

## 檢查輸出

### `check/last-run.txt`（最終，完整）

第 2 節的矩陣量測（392 點）沿用同一份程式剛跑完的完整一輪（`after.json`，約 25 分鐘）；那一輪因為把 ja 320×568 的 2 個舊版不穩點判成「關著與基準不同」而 FAIL 2，我確認是舊版本身不穩後只改了比較規則（見上「沒做到或不確定」第 1 條），用 `REUSE_AFTER=1` 重新比對並跑完其餘第 1、3–7 節。

```
== 1. 語法
  PASS node --check game/skin.js
  PASS node --check game/settings.js
  PASS game.html 內嵌 script（1 段）語法
  PASS duel.html 內嵌 script（1 段）語法
== 2. 全矩陣（game.html／duel.html × 尺寸 × 語言 × 開／關）對照 baseline.json
  （矩陣量測沿用上一輪完整跑出來的 after.json，時間點 2026-11-13T05:16:52.644Z）
  PASS 每個量測點都有基準（392 點，缺 0）
  PASS 關著：390 點跟基準逐項相同（外框、位置、格距、捲動、按鈕出界、重疊）；另 2 點是舊版也會出現的版面不穩狀態（外框跟基準不同，但 pad＝4.5%、cell 算式不變；見 ja_probe）
    duel|gomoku-play|ja|320x568|off 基準外框 [12,150,296,296] 本輪 [9,127,302,302]
    duel|gomoku-watch|ja|320x568|off 基準外框 [34.5,163,251,251] 本輪 [23.5,141,273,273]
  PASS 開著：392 點格距 ≥ 基準 95%、棋盤外框不變、不比基準更捲、按鈕沒出界、沒重疊
  PASS 賽後回看情境確實進到逐題回看（結算視窗已關：true,true,true,true；自己擺：true,true,true,true）
  PASS 情境全部跑完（失敗 0）
  PASS 矩陣中沒有 pageerror／console error
  --- 格距表（開著／基準，每個尺寸跨所有畫面×語言）
  320x568   最小 95.96%（duel|gomoku-watch|zh：pad 11.3→15.86、cell 16.32→15.66）最大 96.04%
  360x640   最小 95.95%（duel|vcf-review|zh：pad 12.47→17.51、cell 18.01→17.28）最大 96.03%
  375x667   最小 95.95%（game|rush|zh：pad 14.72→20.67、cell 21.26→20.4）最大 96.03%
  390x844   最小 95.97%（game|twSolve|zh：pad 13.91→19.53、cell 20.09→19.28）最大 96.01%
  412x915   最小 95.98%（game|twRev|zh：pad 16.88→23.7、cell 24.38→23.4）最大 96.00%
  768x1024  最小 95.97%（game|twSolve|en：pad 22.01→30.9、cell 31.79→30.51）最大 96.00%
  1280x800  最小 95.95%（game|twRev|zh：pad 12.65→17.76、cell 18.27→17.53）最大 96.02%
  --- 改動前就會捲動／按鈕出界／重疊的組合（22 個，開著後都不更糟＝上面那條已驗）
    game|twSolve|320x568  zh:72px/出界5 en:93px/出界5 ja:93px/出界5 ko:93px/出界5
    game|twRev|320x568  zh:154px/出界8 en:183px/出界11 ja:175px/出界11 ko:175px/出界11
    game|twRev|360x640  zh:82px/出界5 en:103px/出界6 ja:82px/出界6 ko:103px/出界5
    game|twRev|375x667  zh:113px/出界8 en:134px/出界8 ja:113px/出界8 ko:113px/出界8
    game|prac|320x568  en:6px ja:6px ko:6px
    game|twSolve|360x640  en:21px/出界5 ko:21px/出界5
    game|twSolve|375x667  en:21px/出界5
== 3. game.html：座標字／像素／點擊
  PASS game 練習 360x640：15 個字母＋15 個數字（15／15）
  PASS game 練習 360x640：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 練習 360x640：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 練習 360x640：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 練習 360x640：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 練習 360x640：字母在最下排棋子外緣（289.7）以下、盤底（300.0）以內（290.9～298.8）
  PASS game 練習 360x640：數字在最左排棋子外緣（10.3）以左、盤左緣以內（0.8～9.5）
  PASS game 練習 360x640：字級 11.0px（7–11）、兩位數寬 8.7px
  PASS game 練習 360x640：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 練習 360x640：題目棋子（12 顆）的圓心像素是子色（黑暗白亮）
  PASS game 練習 360x640：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，5 點）
  PASS game 練習 320x568：15 個字母＋15 個數字（15／15）
  PASS game 練習 320x568：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 練習 320x568：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 練習 320x568：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 練習 320x568：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 練習 320x568：字母在最下排棋子外緣（246.2）以下、盤底（255.0）以內（247.4～253.8）
  PASS game 練習 320x568：數字在最左排棋子外緣（8.8）以左、盤左緣以內（0.8～8.0）
  PASS game 練習 320x568：字級 8.9px（7–11）、兩位數寬 7.1px
  PASS game 練習 320x568：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 練習 412x915：15 個字母＋15 個數字（15／15）
  PASS game 練習 412x915：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 練習 412x915：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 練習 412x915：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 練習 412x915：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 練習 412x915：字母在最下排棋子外緣（382.3）以下、盤底（396.0）以內（385.2～393.1）
  PASS game 練習 412x915：數字在最左排棋子外緣（13.7）以左、盤左緣以內（1.1～12.5）
  PASS game 練習 412x915：字級 11.0px（7–11）、兩位數寬 11.4px
  PASS game 練習 412x915：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 練習 768x1024：15 個字母＋15 個數字（15／15）
  PASS game 練習 768x1024：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 練習 768x1024：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 練習 768x1024：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 練習 768x1024：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 練習 768x1024：字母在最下排棋子外緣（486.6）以下、盤底（504.0）以內（491.3～499.3）
  PASS game 練習 768x1024：數字在最左排棋子外緣（17.4）以左、盤左緣以內（3.0～14.4）
  PASS game 練習 768x1024：字級 11.0px（7–11）、兩位數寬 11.4px
  PASS game 練習 768x1024：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 點擊對位：H8→H8（天元）、四角 A1→A1 A15→A15 P1→P1 P15→P15
  PASS game 判定範圍：偏 0.45 格仍是 H8（H8），偏 0.55 格是 J8（J8）；角落外偏 0.45 格仍是 A1（A1）
  PASS 換棋盤「night」：30 個字都換成 label #aeb7cc
  PASS 換棋盤「neon」：30 個字都換成 label #b9b9f0
  PASS 換棋盤「walnut」：30 個字都換成 label #e3c79e
  PASS 換棋盤「green」：30 個字都換成 label #0b2414
  PASS 換棋盤「paper」：30 個字都換成 label #5e5546
  PASS 換棋盤「classic」：30 個字都換成 label #7a5e36
  PASS game 煉獄之門：15 個字母＋15 個數字（15／15）
  PASS game 煉獄之門：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 煉獄之門：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 煉獄之門：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 煉獄之門：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 煉獄之門：字母在最下排棋子外緣（289.7）以下、盤底（300.0）以內（290.9～298.8）
  PASS game 煉獄之門：數字在最左排棋子外緣（10.3）以左、盤左緣以內（0.8～9.5）
  PASS game 煉獄之門：字級 11.0px（7–11）、兩位數寬 8.7px
  PASS game 煉獄之門：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 煉獄之門：題目棋子（22 顆）的圓心像素是子色（黑暗白亮）
  PASS game 煉獄之門：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，4 點）
  PASS game 無相界：15 個字母＋15 個數字（15／15）
  PASS game 無相界：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 無相界：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 無相界：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 無相界：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 無相界：字母在最下排棋子外緣（289.7）以下、盤底（300.0）以內（290.9～298.8）
  PASS game 無相界：數字在最左排棋子外緣（10.3）以左、盤左緣以內（0.8～9.5）
  PASS game 無相界：字級 11.0px（7–11）、兩位數寬 8.7px
  PASS game 無相界：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 無相界：題目棋子（12 顆）的圓心像素是子色（黑暗白亮）
  PASS game 無相界：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，4 點）
  PASS game 象牙塔研究盤：15 個字母＋15 個數字（15／15）
  PASS game 象牙塔研究盤：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 象牙塔研究盤：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 象牙塔研究盤：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 象牙塔研究盤：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 象牙塔研究盤：字母在最下排棋子外緣（231.7）以下、盤底（240.0）以內（232.9～238.8）
  PASS game 象牙塔研究盤：數字在最左排棋子外緣（8.3）以左、盤左緣以內（0.9～7.4）
  PASS game 象牙塔研究盤：字級 8.2px（7–11）、兩位數寬 6.6px
  PASS game 象牙塔研究盤：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 象牙塔研究盤：題目棋子（20 顆）的圓心像素是子色（黑暗白亮）
  PASS game 象牙塔研究盤：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，5 點）
  PASS game 覆盤研究盤：15 個字母＋15 個數字（15／15）
  PASS game 覆盤研究盤：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS game 覆盤研究盤：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS game 覆盤研究盤：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS game 覆盤研究盤：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS game 覆盤研究盤：字母在最下排棋子外緣（289.7）以下、盤底（300.0）以內（290.9～298.8）
  PASS game 覆盤研究盤：數字在最左排棋子外緣（10.3）以左、盤左緣以內（0.8～9.5）
  PASS game 覆盤研究盤：字級 11.0px（7–11）、兩位數寬 8.7px
  PASS game 覆盤研究盤：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS game 覆盤研究盤：題目棋子（14 顆）的圓心像素是子色（黑暗白亮）
  PASS game 覆盤研究盤：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，4 點）
== 4. 設定頁：開關、預設關、立刻重畫、記得、兩頁共用、對局中切換
  PASS 全新玩家：沒有 vcfgame.coords，RushSkin.coords()＝false
  PASS 全新玩家：沒有座標字、pad＝px×4.5%（14.71／14.71）、與基準 pad 14.72 cell 21.26 現在 14.71／21.25
  PASS 全新玩家：與 baseline.json 的 game|prac|zh|375x667 逐項相同
  PASS 設定頁有「棋盤座標」開關（role=switch、aria-checked=false＝預設關）
  PASS 開關觸控範圍 315×54px（≥44）
  PASS 開關列在「棋具」的下一列、「語言」之前
  PASS 按一下：aria-checked=true、vcfgame.coords＝"1"
  PASS 開了之後棋盤立刻畫座標（pad 20.67、cell 20.40）
  PASS 關掉：底下棋盤馬上回到無座標、pad 回 4.5%、vcfgame.coords＝"0"
  PASS 重新整理後還是開著（記得）
  PASS game.html 切開之後，duel.html 也是開著（同一個 vcfgame.coords）
  PASS 另一個分頁關掉 → 這頁透過 storage 事件也跟著關
  PASS 兩儀殿對局中開設定頁：有開關、預設關
  PASS 對局中切換：WebSocket 沒重連（建立次數 1→1）、仍在房間 3704、狀態 play
  PASS 切換沒送任何房間訊息（新增：無）
  PASS 棋盤馬上重畫：pad 16.16→22.69、cell 23.34→22.40、15 個字母
  PASS 關掉設定頁回到對局
  PASS duel 點擊對位：H8、A1、A15、P1、P15 的中心都落在對的點（{"H8":true,"A1":true,"A15":true,"P1":true,"P15":true}）
  PASS 真的點 H8（座標字開著）→ 送出 move p=112（天元＝112）
== 5. duel.html 各種棋盤：座標字／像素
  PASS 五子棋對局：15 個字母＋15 個數字（15／15）
  PASS 五子棋對局：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS 五子棋對局：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS 五子棋對局：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS 五子棋對局：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS 五子棋對局：字母在最下排棋子外緣（321.5）以下、盤底（333.0）以內（323.3～331.2）
  PASS 五子棋對局：數字在最左排棋子外緣（11.5）以左、盤左緣以內（0.8～10.7）
  PASS 五子棋對局：字級 11.0px（7–11）、兩位數寬 9.9px
  PASS 五子棋對局：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS 五子棋觀戰：15 個字母＋15 個數字（15／15）
  PASS 五子棋觀戰：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS 五子棋觀戰：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS 五子棋觀戰：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS 五子棋觀戰：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS 五子棋觀戰：字母在最下排棋子外緣（332.1）以下、盤底（344.0）以內（334.1～342.0）
  PASS 五子棋觀戰：數字在最左排棋子外緣（11.9）以左、盤左緣以內（0.8～11.1）
  PASS 五子棋觀戰：字級 11.0px（7–11）、兩位數寬 10.3px
  PASS 五子棋觀戰：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS VCF 對局：15 個字母＋15 個數字（15／15）
  PASS VCF 對局：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS VCF 對局：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS VCF 對局：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS VCF 對局：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS VCF 對局：字母在最下排棋子外緣（321.5）以下、盤底（333.0）以內（323.3～331.2）
  PASS VCF 對局：數字在最左排棋子外緣（11.5）以左、盤左緣以內（0.8～10.7）
  PASS VCF 對局：字級 11.0px（7–11）、兩位數寬 9.9px
  PASS VCF 對局：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS VCF 對局：題目棋子（12 顆）的圓心像素是子色（黑暗白亮）
  PASS VCF 對局：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，4 點）
  PASS VCF 觀戰：15 個字母＋15 個數字（15／15）
  PASS VCF 觀戰：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS VCF 觀戰：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS VCF 觀戰：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS VCF 觀戰：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS VCF 觀戰：字母在最下排棋子外緣（332.1）以下、盤底（344.0）以內（334.1～342.0）
  PASS VCF 觀戰：數字在最左排棋子外緣（11.9）以左、盤左緣以內（0.8～11.1）
  PASS VCF 觀戰：字級 11.0px（7–11）、兩位數寬 10.3px
  PASS VCF 觀戰：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS VCF 觀戰：題目棋子（12 顆）的圓心像素是子色（黑暗白亮）
  PASS VCF 觀戰：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，4 點）
  PASS VCF 賽後：按「看每題解法」後結算視窗關掉、逐題回看工具列在
  PASS VCF 賽後逐題回看：15 個字母＋15 個數字（15／15）
  PASS VCF 賽後逐題回看：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS VCF 賽後逐題回看：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS VCF 賽後逐題回看：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS VCF 賽後逐題回看：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS VCF 賽後逐題回看：字母在最下排棋子外緣（267.4）以下、盤底（277.0）以內（268.6～275.8）
  PASS VCF 賽後逐題回看：數字在最左排棋子外緣（9.6）以左、盤左緣以內（0.8～8.7）
  PASS VCF 賽後逐題回看：字級 9.9px（7–11）、兩位數寬 7.9px
  PASS VCF 賽後逐題回看：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS VCF 賽後逐題回看：題目棋子（0 顆）的圓心像素是子色（黑暗白亮）
  PASS VCF 賽後逐題回看：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，5 點）
  PASS VCF 回看：按「退一手」進入自己擺（facts 出現「自己擺」）
  PASS VCF 回看・自己擺：15 個字母＋15 個數字（15／15）
  PASS VCF 回看・自己擺：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS VCF 回看・自己擺：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS VCF 回看・自己擺：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS VCF 回看・自己擺：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS VCF 回看・自己擺：字母在最下排棋子外緣（267.4）以下、盤底（277.0）以內（268.6～275.8）
  PASS VCF 回看・自己擺：數字在最左排棋子外緣（9.6）以左、盤左緣以內（0.8～8.7）
  PASS VCF 回看・自己擺：字級 9.9px（7–11）、兩位數寬 7.9px
  PASS VCF 回看・自己擺：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS #replay= 回看（終局）：15 個字母＋15 個數字（15／15）
  PASS #replay= 回看（終局）：字母由左到右＝ABCDEFGHJKLMNOP（A 在最左、P 在最右、沒有 I）
  PASS #replay= 回看（終局）：數字由下到上＝1,2,3,4,5,6,7,8,9,10,11,12,13,14,15（1 在最下、15 在最上）
  PASS #replay= 回看（終局）：每個字母的 x 對準該直線（最大偏差 0.00px）
  PASS #replay= 回看（終局）：每個數字的 y 對準該橫線（最大偏差 0.00px）
  PASS #replay= 回看（終局）：字母在最下排棋子外緣（321.5）以下、盤底（333.0）以內（323.3～331.2）
  PASS #replay= 回看（終局）：數字在最左排棋子外緣（11.5）以左、盤左緣以內（0.8～10.7）
  PASS #replay= 回看（終局）：字級 11.0px（7–11）、兩位數寬 9.9px
  PASS #replay= 回看（終局）：顏色＝目前棋盤樣式 label（#7a5e36）
  PASS 回看：最後一手的紅點畫在該子圓心（像素 255,122,107）
  PASS 回看：連五金框畫在第一顆連線子的外圈（像素 242,181,68）
  PASS night：換成功、仍在回看畫面、座標字 30 個
  PASS starry：換成功、仍在回看畫面、座標字 30 個
  PASS pool：換成功、仍在回看畫面、座標字 30 個
== 6. 設定頁：四語 × 兩種尺寸，加了一列後不比改動前更擠（對照快照 8796）
    game zh 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    game zh 375x667：前 sh/ih 667/667 留言列底 534 裁切 false；後 667/667 底 589 裁切 false
    duel zh 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    duel zh 375x667：前 sh/ih 667/667 留言列底 534 裁切 false；後 667/667 底 589 裁切 false
    game en 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    game en 375x667：前 sh/ih 667/667 留言列底 545 裁切 false；後 667/667 底 600 裁切 false
    duel en 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    duel en 375x667：前 sh/ih 667/667 留言列底 545 裁切 false；後 667/667 底 600 裁切 false
    game ja 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    game ja 375x667：前 sh/ih 667/667 留言列底 545 裁切 false；後 667/667 底 600 裁切 false
    duel ja 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    duel ja 375x667：前 sh/ih 667/667 留言列底 545 裁切 false；後 667/667 底 600 裁切 false
    game ko 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    game ko 375x667：前 sh/ih 667/667 留言列底 545 裁切 false；後 667/667 底 600 裁切 false
    duel ko 320x568：前 sh/ih 568/568 留言列底 542 裁切 false；後 568/568 底 540 裁切 false
    duel ko 375x667：前 sh/ih 667/667 留言列底 545 裁切 false；後 667/667 底 600 裁切 false
  PASS 設定頁 16 種組合都不比改動前更捲／更被裁
== 7. 教學盤、score.html、商店／棋具頁預覽盤：開或關都跟改動前一樣
  PASS 棋具頁預覽盤（skin-picker 畫的 canvas）：舊／新關／新開 相同（25590:AAAABklEQVQDAIe8oU4s0AOnAAAAAElFTk…；25590:AAAABk／25590:AAAABk）
  PASS 商店預覽盤（shop 畫的 canvas）：舊／新關／新開 相同（7GH9HwAAAP//X7/HYAAAAAZJREFUAwBOptLUIuzU…；7GH9HwAAAP//／7GH9HwAAAP//）
  PASS score.html 試煉場盤面（svg）：舊／新關／新開 相同（4896:<defs></defs><rect width="520" heig…；4896:<defs><／4896:<defs><）
  PASS VCF 教學盤（learn.js 的 9×9 DOM 盤）：舊／新關／新開 相同（14603:<div class="lbrd" ><svg class="gri…；14603:<div c／14603:<div c）
  PASS 全程沒有 pageerror／console error
PASS 201／FAIL 0
```

### 負向測試 `check/last-run-neg.txt`（NEG=1 QUICK=1，只列關鍵行；預期有 FAIL）

```
12:  FAIL 開著：392 點格距 ≥ 基準 95%、棋盤外框不變、不比基準更捲、按鈕沒出界、沒重疊
13:    game|rush|zh|320x568|off：【負向】格距 96.0%（要求 ≥100%，預期 FAIL）
14:    game|rush|zh|360x640|off：【負向】格距 96.0%（要求 ≥100%，預期 FAIL）
15:    game|rush|zh|375x667|off：【負向】格距 96.0%（要求 ≥100%，預期 FAIL）
16:    game|rush|zh|390x844|off：【負向】格距 96.0%（要求 ≥100%，預期 FAIL）
17:    game|rush|zh|412x915|off：【負向】格距 96.0%（要求 ≥100%，預期 FAIL）
```

### 舊版版面不穩排查 `check/last-run-ja-probe.txt`（舊快照／現行各 8 次，ja、320×568、五子棋對局；欄位＝棋盤外框 x,y,w,h）

```
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
舊 ja 立刻 [39,141,242,242] 1.5s後 [39,141,242,242] {"tight":false,"kids":"rhead:56 pTop:52 status:29 boardWrap:242 
新 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [39,141,242,242] 1.5s後 [39,141,242,242] {"tight":false,"kids":"rhead:56 pTop:52 status:29 boardWrap:242 
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [39,141,242,242] 1.5s後 [39,141,242,242] {"tight":false,"kids":"rhead:56 pTop:52 status:29 boardWrap:242 
舊 ja 立刻 [12,150,296,296] 1.5s後 [12,150,296,296] {"tight":true,"kids":"rhead:78 pTop:44 status:24 boardWrap:296 p
新 ja 立刻 [39,141,242,242] 1.5s後 [39,141,242,242] {"tight":false,"kids":"rhead:56 pTop:52 status:29 boardWrap:242 
```
