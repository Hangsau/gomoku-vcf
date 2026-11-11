# 棋盤樣式設計稿（2026-11-12）

畫布：https://claude.ai/artifact/VnG7qsg7JcBfch2FCtiS4E（Design 類型；換帳號打不開就用 project/ 重新發佈）

- A `Main.dc.html`：整套換（底部抽屜、8 套卡片）
- B `Mix.dc.html`：棋盤、棋子分開配（8 種盤 × 7 種子，組合看不清楚會提醒）
- C `Cabinet.dc.html`：棋具櫃（木架上擺棋盤和棋罐，點了看預覽再按「使用」）

樣式候選：原木、經典綠（使用者 11-12 加點）、夜墨、青瓷、宣紙、霓虹、玉石（codex 畫）、蛤碁石（codex 畫）。
程式端：`game/skin.js`（8c4f667 起所有頁面共用）。

## 定案與實作（2026-11-12）
- 使用者選 **B**（棋盤、棋子分開配），並說之後要做更多棋盤棋子＋解鎖。
- `game/skin.js`：`BOARDS`（8）、`STONES`（7）兩份清單，存 `vcfgame.board`／`vcfgame.stones`。黑子在暗盤、白子在亮盤對比不夠時自動描邊（RIM_BLACK 3、RIM_WHITE 1.6）。
- 解鎖：項目加 `lock`，`isLocked()` 看 `vcfgame.skinUnlock`；棋具頁鎖住的顯示鎖頭、不能選。解鎖制度本身還沒做。
- `game/skin-picker.js`：棋具頁＋首頁入口（三張卡下面；上排圖示列在 360 寬放不下）。
- 玉石、蛤碁石子：codex 畫（prompt：`codex_stones_prompt.md`，原圖與檢查圖在 `art-src/`），`game/skin/stones/<id>/b.png、w.png`，256×256 透明。
- 新增一套：盤加進 `BOARDS`、子加進 `STONES`（用圖就放 `game/skin/stones/<id>/`），四種語言名字都要填；棋具頁一排 8 格，超過 8 個要改成兩排或可橫滑。
