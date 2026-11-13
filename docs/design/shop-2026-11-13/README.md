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

- 2026-11-13 使用者選 **A**（「就照你推薦的方式做吧」），並要求**不標「之後會收費」，只標「限時免費」**。A 稿已拿掉那兩句（B、C 稿沒改，仍留著舊字）。
- 施工單 `WORKORDER.md`，派 cc2；進度 `PROGRESS.md`、報告 `REPORT.md`。驗收、部署由主 session 做（先 schema.sql → deploy_worker → deploy_rush）。
- 2026-11-13 上線（58905ce）：cc2 施工、主 session 驗收（`node docs/design/shop-2026-11-13/check/check_shop.mjs` 174 項全過）、套 `owned` 表、部署 Worker 與 Pages；線上 `/shop` 回 200。
- 入口實際做法：首頁右上角金色購物袋 `#openShop`（`#skinEntry` 早已不在首頁）；棋具頁兩排最後各一格「＋」通往商店。沒領的商店商品不出現在棋具頁。
- 還沒做／待確認：使用者手機實看；日韓文版面只有程式檢查、沒肉眼看過，譯詞（もらう／받기／期間限定 無料／한정 무료）未經母語者確認；後台「已領 N」沒開瀏覽器實測；舊的 `docs/design/skins2-2026-11-12/check/check_skin.mjs` 早就跑不起來（等不到 `#skinEntry`），可用的版本是 `check/check_skin_copy.mjs`。
- 轉收費時要補：金流、登入綁定 vid、`settings.shop_prices` 設價（伺服器已會拒絕價格 > 0 的免費領取）、「領取」換「購買」。
- 下一件（使用者 2026-11-13 提）：邀請連結在 LINE 等內建瀏覽器開啟的問題——邀請連結加 `openExternalBrowser=1`、偵測內建瀏覽器顯示「用瀏覽器開啟」、分享文字寫明房號。

## 第二輪（2026-11-13 上線後）

使用者看了線上的 A 後說：「商店有點慘 這樣好像有點醜 看不懂買到的東西是什麼 在買什麼」。重出兩版（畫布第二排）：
- D `Stage.dc.html`：上面一塊棋盤看效果＋名稱與一句說明，下面分「棋子造型／棋盤花色」兩個分頁、有名字的格子，底部大按鈕寫明「免費領取『X』」。
- E `List.dc.html`：一列一件，左邊是擺在棋盤上的樣子，右邊直接「領取」，不跳框。
等使用者挑（ui-taste：`vcf-rush-shop2-2026-11-13`）。線上目前仍是 A。
