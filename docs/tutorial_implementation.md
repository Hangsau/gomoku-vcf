# Gomoku Rush VCF 教學：實作清單

> 2026-11-10 建。內容規劃見 `C:\claudehome\projects\VCF\docs\tutorial_plan.md`（課程 §2、呈現方式 §2.5）。
> 本檔是接手用的：換帳號、換 session 後照這份做，不用再問使用者。狀態欄每完成一項就改。

---

## 0. 換帳號後先做這件事：把設計稿畫布重新發佈

舊畫布 https://claude.ai/artifact/CVLvQrkdbHRFurPhdNbUey 換帳號後會 not found。原始檔在：

- `C:\claudehome\projects\VCF\docs\design\tutorial-2026-11-10\project\`（canvas.json＋10 張 .dc.html）

重新發佈步驟：
1. `Artifact` action `quickstart`、intent `design` → 拿 Design type 的 `type_url`。
2. 用 `type_url` 建新畫布（title「Gomoku Rush VCF 教學」、`auto_open: "after_first_write"`）。
3. 把整個 `project\` 資料夾複製到 scratchpad 的一個新資料夾，用 `root` 指向那個資料夾，先發 `project/canvas.json`＋`project/Main.dc.html`，再把其他 .dc.html 一次發完。
4. 新網址寫回本檔與 `tutorial_plan.md` 開頭，並告訴使用者。

選定方向是第二排三張：`Opening.dc.html`（開場）、`Board.dc.html`（教學盤，盤面是示意，要換成 W2 的真題）、`Rewind.dc.html`（倒帶課）；`Pick.dc.html` 是教學盤候選棋譜。第一排 A/B/C 是被否決的常見版型，只留著對照。

---

## 1. 已定案（不要再問使用者）

| 項目 | 決定 | 來源 |
|---|---|---|
| 呈現方式 | 一盤棋教學：開場先被打敗→倒帶→換你打；主畫面就是 15×15 教學盤；第 4 單元起倒帶課 | 使用者 2026-11-10「我太喜歡了」 |
| 動畫 | 要生動，不能只是角色抖動；可多切格讓動作順；逐格素材可派 codex | 使用者 2026-11-10 |
| 盤面 | **所有教學盤面都要先過引擎驗證**（`solveFrom` 唯一＋`move` 逐手重放＋每步可接受點由引擎判定），手擺的不准直接用 | 使用者 2026-11-10；我手擺的兩個示範都錯過 |
| 開場題 | 題庫 #004Z7T4V 截短的 3 手題（衝四→四三→活四），攻方黑＝電腦，玩家先當白防守、後換黑進攻，顏色不對調 | 使用者「三手四三、挑低分」 |
| 4-3 倒帶示範題 | 題庫 #005RSGY4 截短的 2 手四三 | 同上 |
| 教學盤（畢業考） | **P967KE41**（32 子、黑先 4 手、203.1 分、第 3 手解禁 B8）。使用者還沒親自挑，之後要換只改 W2 的題號 | 我推薦；候選 6 道在 `Pick.dc.html` |
| 教學盤落子 | 32 子＝開場 1＋31 課各 1（9-3 畢業考是下完整盤，不落子）；黑 16 白 16 | §2.5 |
| 修為／排行 | 教學不給修為、不上排行榜、不送伺服器；進度存本機 | plan §5 |
| 範圍 | 只教 VCF | plan §8 |

驗證工具與資料（給程式用）：`C:\claudehome\projects\VCF\docs\design\tutorial-2026-11-10\verify\`
- `verify.py`：對題庫候選跑引擎（唯一、合法、合格、逐手重放）
- `short3.py`：從低分 4 手題截短出 3 手、2 手題，並檢查放得進 9×9
- `gen.py`：把截短題轉成 9×9 局部座標，每步可接受點由引擎判定
- 都是用 Playwright 開本機 `game.html`（`python -m http.server 8765`，在 `C:\claudehome\projects\VCF\` 跑），在頁面裡呼叫 `solveFrom(black, white, attackerWhite)` 與 `move(black, white, t, attackerWhite)`；POST 一律攔截

---

## 2. 實作清單

派工欄：`[claude]` 自己做；`[sonnet]` 派 Agent（sonnet）；`[codex]` 派 codex（派之前先查額度，見全域 CLAUDE.md 第 3 條）。派 agent 的 prompt 一律禁止 git 操作、每完成一單位寫盤。

| W | 內容 | 派工 | 驗收 | 狀態 |
|---|---|---|---|---|
| W1 | **資料格式＋檢查程式**：`game/learn/lessons.json`（課程、盤面、任務、文字四語欄位）＋ `tools/check_lessons.py`（Playwright＋引擎逐題驗證；格式、cross-ref、四語欄位齊全） | [claude] | 對故意放錯的題報錯；對 W2/W3 的題全過 | 完成初版（tools/check_lessons.py、game/learn/lessons.json；跑過 32 課 0 錯）；還沒做「故意放錯」測試 |
| W2 | **教學盤**：P967KE41 的 32 子排落子順序（開場 1＋31 課），每子標所屬課；寫進 lessons.json 的 `board` 段；連線提示（相鄰黑子連金虛線）由資料算 | [claude] | check_lessons 通過；整盤再驗一次唯一解 | 完成：黑白輪流、由中心往外；開場題與 4-3 倒帶題已入檔並通過 |
| W3 | **第 1–4 單元課文與題目**（13 課＋開場）：中文課文我寫；盤面派 sonnet 擺＋截短，全部過 W1 檢查 | [claude] 課文／[sonnet] 盤面 | check_lessons 全過；每課至少 3 題 | 未開始 |
| W4 | **教學引擎**（新檔 `game/learn/learn.js`＋`game.html` 掛入口）：9×9 局部盤渲染、五種任務（點一點／預測／選擇／解題／看回放）＋倒帶課流程、木偶線、落子壓扁回彈、連五依序點亮、倒帶掃描線、整盤翻面 | [sonnet] | 照 `Opening.dc.html`／`Rewind.dc.html` 的互動逐步比對；四語 × 375×667、360×640 不捲動 | 未開始 |
| W5 | **開場**（照 `Opening.dc.html`，資料用 #004Z7T4V 截短題） | [sonnet]（併 W4） | 從頭玩到「進入教學盤」 | 未開始 |
| W6 | **教學盤主畫面**（照 `Board.dc.html`，盤面換 W2 的真題；點子跳小卡、信標進下一課、畢業考入口） | [sonnet] | 13 課完成後盤上 13 子位置與 W2 一致 | 未開始 |
| W7 | **逐格動畫素材**（使用者 2026-11-10：美術圖跟 codex 要，張數多一點、順暢一點沒關係）：①落子壓扁回彈＋漣漪（黑、白各一套，12–16 格）②木偶線：從棋盒拉出、拖子、繃緊彈回（16–24 格）③連五光：五顆依序點亮＋光束掃過（12–16 格）④倒帶：錄影帶掃描線、播放頭、子被拎起飛走（12–16 格）⑤整盤翻面換邊（12–16 格）⑥拉遠＋第一顆子落到教學盤（16–24 格）⑦教學盤信標波紋、子呼吸光（8–12 格循環）⑧答對印章／答錯毛筆叉（8–12 格）。同一套素材用同一張圖集生成，逐格硬切不淡入淡出（memory：feedback_sprite_hard_cuts_no_crossfade、feedback_check_reference_impl_before_claiming_hard）；配色照 game.html 的 :root 色票＋棋盤 #E9C98B／線 #5B4524。先做 CSS 版上線，codex 版替換加強 | [codex] | 使用者實看；逐格硬切 | 試畫第 1 張完成：game/learn/art/drop_black.png（1254² RGBA、背景透明），待看原圖驗收格子對齊後再派其餘 7 套（prompt 範本 docs/design/tutorial-2026-11-10/art-prompts/01_drop_black.txt） |
| W8 | **英日韓翻譯** | [codex] | 四語欄位齊全、無捲動 | 未開始 |
| W9 | **驗收**：check_lessons、四語無捲動、從清空本機紀錄的狀態玩完第 1–4 單元、console 無錯 | [claude] | 全過 | 未開始 |
| W10 | **上線第一階段**：開場＋教學盤＋第 1–4 單元；5–9 單元的點在盤上顯示但鎖住 | [claude] | 部署指令逐字：`bash C:/claudehome/projects/VCF/tools/deploy_rush.sh`（push GitHub 不等於上線） | 未開始 |
| W11 | 第 5–9 單元（截短題庫題為主；反四、禁手陷阱題手擺後必過引擎） | 之後 | 同 W3 | 未開始 |

順序：W1 → W2 → W3（可與 W4 並行，但 5H 配額規則要求批次 agent 串行，所以實際一次派一個）→ W4/W5 → W6 → W8 → W9 → W10；W7 在 W4 上線後再加強。

---

## 3. 要注意的坑

- `game.html` 已經 1800 多行，教學邏輯放新檔 `game/learn/learn.js`，`game.html` 只加入口與載入；`sw.js` 的快取清單要加新檔。
- Gomoku Rush 所有畫面所有語言不可捲動（memory：feedback_gomoku_rush_no_scroll_all_langs）。
- 黑棋四四、長連是禁手；黑先題的收尾是活四。白先題才可能四四收尾。
- 題庫最短是 4 手；1–3 手的題靠截短或手擺，兩者都要過引擎。
- 9×9 局部盤：整盤＋解＋最後成五點都要在框內（`short3.py` 的檢查）。
- 部署只跑 `bash C:/claudehome/projects/VCF/tools/deploy_rush.sh`，前面不加 cd、不接 `| tail`（會被權限規則擋）。
- 同 repo 有背景程式自動 commit `game/p/*.json`，commit 一律 `-- 檔名`。
- `C:\claudehome\projects\VCF\HANDOFF.md`、`C:\claudehome\projects\VCF\docs\handover.md`、`C:\claudehome\projects\VCF\CLAUDE.md` 有別人未 commit 的改動，不要替別人 commit。

---

## 4. 2026-11-10 這個 session 已上線的其他改動（交接用）

- 覆盤改成遊戲內研究盤（跟象牙塔同一套），不再連試煉場；改版前的舊紀錄用引擎重放重建手順（commit 087bd38、643d7f7）
- 試煉場（score.html）加「用題號找題目」，也支援 `score.html#id=題號`（087bd38）
- 新模式「火眼金睛」：只看第一手、一題 8 秒、4 手題、3 條命、分數＝題目分×(1＋剩餘秒數÷8)；Worker `/eye`、D1 `eye` 表已建（0d4dc6f）
