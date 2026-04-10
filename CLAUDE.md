# VCF 分析器 — Claude 工作指引

五子棋 VCF（連四取勝）搜尋分析器。純 HTML + JavaScript 單一檔案，跑在瀏覽器裡。  
詳細設計見 [`docs/handover.md`](docs/handover.md)，本文件是 AI 工作用的精簡版。

**GitHub**：https://github.com/Hangsau/gomoku-vcf  
**線上版**：https://hangsau.github.io/gomoku-vcf/  
**開發者模式**：網址加 `?dev=1`

---

## 絕對禁止

- **禁手遞迴（`isForbiddenWithVisited` / `isLiveThreeInDir`）不能動** — Hangsau 明確要求，這是核心正確性保證
- `findFours()` 落子後不能呼叫 `isFour()`（`isFour` 第一行就 return false），必須直接用 bitboard 查表
- `getDefenderFourBlocks` 解構時必須包含 `fivePts`，不能只解構 `{hasFive, blocks}`

---

## 工作習慣

- 每次改動前先說明邏輯，Hangsau 確認後再動程式碼
- 改動輸出完整區塊，不要只給片段
- 推 GitHub 用 `gh auth token` 取得 token 後嵌入 remote URL（git 不在 PATH）：
  ```bash
  TOKEN=$(gh auth token)
  git remote set-url origin "https://${TOKEN}@github.com/Hangsau/gomoku-vcf.git"
  git push origin main
  ```

---

## 架構速查

| 元件 | 說明 |
|------|------|
| 搜尋 | 單一 AND-OR DFS（`vcfDFS`） |
| Bitboard | `BL[player-1][dir][lineIdx]`，全域變數，任何操作都會改動它 |
| 查表 | `T_FIVE` / `T_IS_FOUR` / `T_IS_LIVE4`（黑），`T_IS_FOUR_W` / `T_IS_LIVE4_W`（白） |
| TT | `Map`，key = `(hash << 34) | (atkLeft << 14) | (coverHash & 0x3FFF)`，BigInt |
| 搜尋模式 | `searchMode`：`'direct'`（預設）或 `'iddfs'` |

**白棋查表**：凡新增查四邏輯，都要依 `player` 選表（黑 `T_IS_FOUR`，白 `T_IS_FOUR_W`）。  
**BL 同步**：驗證模式每步前必須 `bbSync(b)`。

---

## 兩種搜尋模式的現況

### 直接深度模式（`'direct'`，預設）
- 清空 TT，以 `maxAtk` 直接跑一次 DFS
- 找到 N 手後**自動嘗試 N-1**，直到縮無可縮（2026/04/10 新增）
- 結果標示 `直接（原N→最終M手）`，無廢手時不多花時間
- 實測：對 56 手深的複雜題，IDDFS 超過兩分鐘仍無解，Direct Depth 47 秒完成

### IDDFS 模式（`'iddfs'`）
- 每輪 `step()` 開頭清空 TT（2026/04/10 修正 Layer 2 bug）
- **對深題（40+ 手）實際上比 Direct Depth 慢**，每輪重跑代價高
- 適合解較淺的題目（&lt;20 手），深題建議用 Direct Depth + N-1 縮短
- Layer 1 bug（coverHash 14 bit 碰撞）仍存在，極端情況仍可能誤判

---

## 已知 Bug 狀態

| Bug | 狀態 | 說明 |
|-----|------|------|
| findFours 白棋永遠找不到四（v15–v22） | ✅ v23 修正 | 改用 bitboard 查表 |
| IDDFS 跨層 TT 汙染（Layer 2） | ✅ v24 修正（2026/04/10） | 每輪清空 TT |
| Direct Depth 找到含廢手路徑 | ✅ 2026/04/10 加 N-1 重試 | 自動縮短，無廢手時無額外負擔 |
| coverHash 14 bit 碰撞（Layer 1） | ⚠️ 未修，中優先 | 極端情況誤判，考慮擴大至 32 bit |

---

## 待辦（依優先級）

**高：**
- [ ] N-1 縮短功能實測：拿有廢手的設計題驗證效果
- [ ] 浅田真司 381 在 GitHub Pages 環境重新驗證

**中：**
- [ ] coverHash 14 bit → 更大 hash（Layer 1 根本解）
- [ ] IDDFS 進階：TT entry 加 `atkLeft_stored`，恢復跨層剪枝（需先修 Layer 1，且只適合淺題）

**低：**
- [ ] Worker 版本還原（GitHub Pages 環境偵測後可考慮）
- [ ] 黑棋 textarea 高度視覺問題

---

## 搜尋策略選用指引

| 情況 | 建議 |
|------|------|
| 一般題目 | Direct Depth（預設），N-1 自動縮短 |
| 深題（40+ 手）想找最短解 | Direct Depth，結果已盡可能縮短 |
| 淺題（&lt;20 手）想確保最短解 | IDDFS（速度可接受） |
| IDDFS 跑不完 | 代表解很深，用 Direct Depth 即可 |

## 下一步建議

1. **實測 N-1 縮短**：拿一題已知有廢手的設計題，看縮短前後手數差異
2. **Layer 1 coverHash 修法**：只有在 IDDFS 成為主力後才有意義，目前低優先
3. **IDDFS 定位調整**：考慮在 UI 上標注「適合淺題（建議 &lt;20 手）」，避免用戶在深題誤用
