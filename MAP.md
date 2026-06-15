# MAP — VCF（五子棋 VCF 連四取勝搜尋分析器）

> 結構地圖，給冷啟動讀者（人/LLM）。格式與維護流程見 `C:\claudehome\CODEBASE_MAP_METHODOLOGY.md`。
> 行為規範見 `CLAUDE.md`；詳細交接見 `docs/handover.md`；版本史 `CHANGELOG.md`。
>
> `last_verified: 2026-06-15`

---

## 1. 一句話定位 + 技術棧

**瀏覽器端五子棋 VCF（Victory by Continuous Fours，連續衝四取勝）搜尋分析器**。  
**單檔 monolith**：純前端 HTML5 Canvas + 原生 JavaScript（ES6+，零依賴），重運算走 Web Worker。  
跑：直接開 `index.html`（或部署 GitHub Pages）；無 build step；`?dev=1` 開發模式（剪枝 trace + 禁手視覺化）；puzzle 存 localStorage。

---

## 2. 「要做 X → 去讀 Y」決策索引

| 你要做的事 | 動這裡（皆在 `index.html` 內，搜函式名定位） |
|-----------|--------|
| 改核心搜尋演算法 | `vcfDFS`（AND-OR DFS 主引擎）+ `runVCF`（Direct-Depth vs IDDFS 分派）；**同步改 Worker blob 內的複本**（見雷 §4） |
| 改盤面樣式判定（成五/衝四/活四） | `isFive` / `isFour` / `countFours` / `findFours` + bitboard `bbWindow`/`bbLineIdx`（9-bit 視窗 O(1) 查表） |
| 改禁手規則（黑棋 33/44/長連） | `isForbiddenWithVisited`（**CLAUDE.md 標禁碰**）/ `getForbidType` / `initForbidState`（v27 precompute） |
| 改防守解算 | `findDefense` / `getDefenderFourBlocks` / `checkLiveFourWin` |
| 改置換表剪枝 | `ttKey` / `boardHash` / `coverHash` |
| 改 UI / 驗證模式 / playback | `setTool` / `applyBoardFromInput` / `startVerifyClick` / `renderVcfPlayback` |
| 改 puzzle 存取 | `savePuzzle` / `loadPuzzle` / `loadPuzzleFromJSON`（localStorage key `gomoku_vcf_puzzles`） |
| 深入架構/設計史 | `docs/handover.md`(218) |

---

## 3. 檔案地圖

| 檔 | 行 | 職責 |
|----|----|------|
| `index.html` | 3291 | **唯一原始檔**：CSS(1–507) + HTML markup(508–714) + 主 script(715–) + Worker blob(1840–2443) |
| `docs/handover.md` | 218 | 詳細交接：v27 FORBID precompute、BB_I/BB_P typed array、mustCover、TT key、已知 bug、改碼規則 |
| `README.md` | — | 對外使用說明 |
| `CLAUDE.md` | — | 改碼禁忌（禁手遞迴勿碰 / Worker 同步 / Hangsau 核可流程） |
| `HANDOFF.md` | — | 指向 handover.md |
| `CHANGELOG.md` | — | v1–v27 版本史 |

**生成物（非原始碼，勿手改）**：`graphify-out/graph.html`、`graphify-out/graph.json`、`graphify-out/GRAPH_REPORT.md`（graphify 知識圖譜分析輸出）。

---

## 4. 踩雷點 / 非顯而易見處

1. **Worker blob 是主執行緒核心函式的複本，改任一核心函式必兩邊同步**（`index.html` 約 1840–2443）。只改主執行緒、忘了 Worker blob → GitHub Pages 上跑出與本地不同的結果，且難察覺（fallback 才走主執行緒）。CLAUDE.md 列為硬規則。
2. **`isForbiddenWithVisited`（禁手遞迴）設計凍結，CLAUDE.md 明令勿碰**。v27 的 FORBID precompute（`forbidState[]` 增量更新）只是「餵 O(1) 讀取」給搜尋，核心遞迴沒動；要加速禁手別改遞迴，改 precompute 層。
3. **bitboard 9-bit 視窗查表是熱路徑**：`bbWindow` 每次搜尋呼叫百萬次，用 `T_FIVE`/`T_IS_FOUR`/`T_IS_LIVE4`（各 512 項，黑白各一套）O(1) 取代 O(7) 掃描，~5x。改盤面判定邏輯要連帶確認這些查表不失效。
4. **兩種搜尋模式行為不同**：Direct-Depth（v24+ 預設，單次 DFS at maxAtk 找到就退 maxAtk-1，快）vs IDDFS（逐層加深保證最短解，但深局慢/易 timeout，每輪清 TT）。回報「搜尋慢/解不對」先確認跑哪個模式。
5. **mustCover 約束每 ply 全重算、不繼承**（handover.md 140–151）：防守方的直接成五威脅會約束後續選點；改搜尋選點邏輯要理解這個傳播是逐層重算。
6. **盤面雙表示**：`b`=Uint8Array(225) 給 UI/判定；`BL[player-1][dir][lineIdx]`=Uint16 壓縮線狀態給搜尋。兩者要靠 `bbSync` 保持一致。
7. **只有黑棋有禁手**（33/44/長連），白棋無；改禁手邏輯別套到白棋。

---

## 5. 邊界 / 別碰

- **設計凍結**：禁手遞迴 `isForbiddenWithVisited` 與相關判定，Hangsau 要求改動前先核可。
- **單檔架構**：所有邏輯在 `index.html`，沒有模組拆分；改動牽一髮（尤其 Worker blob 同步）。
- **`graphify-out/` 是分析生成物**，非原始碼，重跑 graphify 會覆寫。
- **與 `vcf-slover` 是姊妹專案**（另一個五子棋 VCF solver，亦單檔 HTML），別混用兩邊檔案。
