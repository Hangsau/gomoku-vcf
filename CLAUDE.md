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
- **不保證最短路徑**，偶爾找到含冗餘手的解

### IDDFS 模式（`'iddfs'`）
- 每輪 `step()` 開頭清空 TT（2026/04/10 修正 Layer 2 bug）
- **保證找到最短 VCF 路徑**
- Layer 1 bug（coverHash 14 bit 碰撞）仍存在，極端情況仍可能誤判

---

## 已知 Bug 狀態

| Bug | 狀態 | 說明 |
|-----|------|------|
| findFours 白棋永遠找不到四（v15–v22） | ✅ v23 修正 | 改用 bitboard 查表 |
| IDDFS 跨層 TT 汙染（Layer 2） | ✅ v24 修正（2026/04/10） | 每輪清空 TT |
| coverHash 14 bit 碰撞（Layer 1） | ⚠️ 未修，中優先 | 極端情況誤判，考慮擴大至 32 bit |

---

## 待辦（依優先級）

**高：**
- [ ] IDDFS 修正後在複雜題實測（對比直接深度的時間 + 路徑品質）
- [ ] 浅田真司 381 在 GitHub Pages 環境重新驗證

**中：**
- [ ] coverHash 14 bit → 更大 hash（Layer 1 根本解）
- [ ] IDDFS 進階：TT entry 加 `atkLeft_stored`，恢復跨層剪枝（需先修 Layer 1）

**低：**
- [ ] Worker 版本還原（GitHub Pages 環境偵測後可考慮）
- [ ] 黑棋 textarea 高度視覺問題

---

## 下一步建議

1. **先實測 IDDFS 修正效果**：拿那個 70-100 秒的複雜題，對比 IDDFS vs 直接深度的速度與路徑品質
2. **如果 IDDFS 還是太慢**：進入 Layer 1 修法（coverHash 擴大）+ TT entry 加 `atkLeft_stored`，這樣跨層剪枝可以恢復，IDDFS 速度會再提升
3. **如果 IDDFS 夠快且路徑品質好**：可以考慮把 IDDFS 改為預設模式
