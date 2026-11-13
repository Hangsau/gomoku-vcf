# Gomoku Rush 棋具商店設計稿（2026-11-13）

畫布：https://claude.ai/artifact/C2xNBNjJctPYjkLmnuqLNL（Design 類型；換帳號打不開就用 `project/` 重新發佈，圖要重新上傳並把 `.dc.html` 裡的 `/_blob/<id>` 換成新網址）

- A `Main.dc.html`：貨架格（4 欄小格，點了跳小框看預覽＋領取）
- B `Try.dc.html`：試用台（上方棋盤即時試擺，下面兩排商品，底部一顆領取鈕）
- C `Showcase.dc.html`：櫥窗（一次看一件大圖，左右翻）

稿上的圖是遊戲實際的圖（`game/skin/stones/<id>/b.png、w.png`、`game/skin/boards/<id>.webp`），上傳成畫布素材；`.dc.html` 裡 ST／BD 兩張表依序對應 poop、bunny、pets、onigiri、sky、boo、donut 與 grass、starry、beach、chalk、ice、denim、pool。

## 使用者定的規則（2026-11-13）

- 最終要做成付費商店；現在是免費商店。
- 定案做法：商品標「限時免費」，按「領取」才能用，**領過永久保留**；現在不做登入。
- 擁有紀錄要記在伺服器（以 `vcfgame.vid` 匿名編號），手機留副本；之後收費時加登入綁定＋金流，畫面沿用。
- 商品＝第二輪新棋具 14 件（7 組造型棋子＋7 張特色棋盤）；原本 8 盤 7 子維持免費。後台開關保留（關掉的不出現在商店）。

## 狀態

等使用者挑版本（ui-taste：`vcf-rush-shop-2026-11-13`，pending）。尚未施工。
