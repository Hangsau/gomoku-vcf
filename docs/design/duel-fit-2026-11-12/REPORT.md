# 兩儀殿：認輸鈕要往下捲才看得到（Pixel 10）——調查與修正（2026-11-12）

使用者回報：Pixel 10、裝成 App、塔拉＋計時，**一進房就要捲**才看得到認輸鈕。
施工：cc2 做到重現階段撞額度上限，主 session 的 agent（duel-fit）接手；本檔由主 session 依 agent 回報整理（agent 的報告檔寫入被系統擋下）。

## 結論
- **電腦上沒有直接重現**：412×915／870／850／790／740 一般開法都放得下（基本矩陣 320 組＋特殊情境 18 組，超出 0）。
- **模擬出一個吻合的機制**：整頁高度用 `100dvh`、算棋盤用 `window.innerHeight`。把 `100dvh` 換成 `calc(100dvh + 48px)`（模擬 App 模式下 dvh 比 innerHeight 高）：一進房文件超出 48px，棋盤從 396 白縮到 348，認輸／離開鈕仍在視窗下 32px，大廳「開房」鈕也一樣。
- **這個假設有弱點**：單人頁 `game.html` 是同一種做法（`min-height: 100dvh`＋`window.innerHeight`），使用者沒說單人頁有問題。所以不能說已找到原因；要等實機確認。
- 另外量到的真實超出（修改前，90 個追加情境中 21 個，全是極端條件）：視窗變矮沒收到 resize（14px）、對局中字放大 1.5 倍（認輸鈕低 45px）、很小的視窗（330×632 以下，最多 109px）。表在 `check/evidence-table.md`。

## 改了什麼（只動 `duel.html`）
1. `.app` 高度改 `var(--appH, 100dvh)`；`layout()` 開頭把 `window.innerHeight` 寫進 `--appH`——整頁高度和棋盤用同一個數字。
2. `layout()`：先照舊算（棋盤下限 240），還超出就加 `#sRoom.tight`（各列縮緊）再算一次（下限 200）。
3. 保險：`layoutSoon()`（rAF 合併）＋ `ResizeObserver`（棋盤與 `.grow` 以外各列）＋ `visualViewport` resize ＋ `document.fonts.ready`。
   不會無限迴圈：被觀察的列高度跟棋盤大小無關；`check/loop.mjs` 進房後回呼 2 次、靜止 3 秒 0 次。

## 檢查
- `check/fit.mjs`（最終版）：338 組超出 0。中途一次當掉是本機 http.server 偶發拒絕連線（`check/openstress.mjs` 連開 400 次：修改後頁面失敗 0、修改前失敗 7，都是 ERR_CONNECTION_REFUSED），不是頁面卡住。
- `check/extra2.mjs`（90 組）：修改後超出 0；開修改前頁面抓到 21 組（故意弄錯有抓到）。
- `check/dvh.mjs`（模擬 dvh 高 48px）：PASS 14／FAIL 0。
- `docs/design/duel-modes-2026-11-12/check/run.mjs`：PASS 217／FAIL 0（一線天、八仙渡、五子棋沒壞）。

## 沒做到／待定
- 實機 Pixel 10 App 模式測不到。若更新後仍要捲：真因可能是 `innerHeight` 本身比看得到的高，這次修正救不到；下一步是加 `?dbg=1` 顯示 innerHeight／100dvh／visualViewport.height／safe-area 四個數字，請使用者截圖。
- 沒加 `html, body { overflow: hidden }`：若真因是別的，加了會變成捲也捲不到。實機確認後再決定。
- `.tight` 是新外觀（只在約 330×632 以下、棋盤縮到 240 還放不下時出現），沒出設計稿。
- 412×450（鍵盤開著）當下仍放不下（38～57px），鍵盤收起後正常。
- 觀戰後入座、Android 系統字型放大的實際效果沒測。
- 快取：`sw.js` 網路優先，線上 `/duel` 是 `max-age=0, must-revalidate`；App 開在背景的要關掉重開才拿到新版。
