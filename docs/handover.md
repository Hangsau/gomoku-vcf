# VCF 分析器 開發交接單

**版本**：v25　**日期**：2026/04/12

---

## 專案概述

五子棋 VCF（連四取勝）搜尋分析器，純 HTML + JavaScript，單一檔案，跑在瀏覽器裡。  
用途包含詰棋驗算、RenjuLegend 遊戲開發輔助工具。

**GitHub**：https://github.com/Hangsau/gomoku-vcf  
**線上版**：https://hangsau.github.io/gomoku-vcf/  
**開發者模式**：網址加 `?dev=1`

---

## 架構

- 單一 AND-OR DFS（已棄用兩階段 FastDFS+Validate 架構）
- Bitboard 查表系統（9-bit 窗口，512 bytes 查表，isFive/isFour 比迴圈快 5x）
- mustCover 反擊四約束傳遞（守方堵完後每次完全重算，不繼承舊值）
- 鄰近格候選（只掃有棋子周圍 NEAR=2 格，候選格從 225 降到約 30）
- findDefense 局部掃描（傳入 lastR/lastC，只掃 ±4 格）
- TT 跨層保留 + 失敗上界（IDDFS 每輪開始時清空，存 minFailDepth）
- 禁手完整遞迴（isForbiddenWithVisited + isLiveThreeInDir 完全保留，禁手內部繼續用陣列迴圈）
- 搜尋為主執行緒 + Web Worker（GitHub Pages 環境用 Worker，其他環境偵測後退回主執行緒）
- 路徑驗證模式
- 剪枝追蹤模式（dev 限定，`?dev=1`）
- 直接深度模式（v24 新增，預設開啟）
- 題目管理功能（v24 新增）

---

## Bitboard 設計

```
BL[player-1][dir][lineIdx] = Uint16
方向: 0=橫, 1=縱, 2=\斜, 3=/斜
線索引:
  橫: i=r, pos=c
  縱: i=c, pos=r
  \斜: i=r-c+14, pos=c
  /斜: i=r+c,   pos=r
```

查表：`bbWindow()` 純位元運算，`T_FIVE` / `T_IS_FOUR` / `T_IS_LIVE4` 一次查到。

### bbLineIdx Lookup Table（v25 新增）

```javascript
const BB_I = new Uint8Array(15 * 15 * 4);  // 預計算 lineIdx
const BB_P = new Uint8Array(15 * 15 * 4);  // 預計算 position
// 存取：const base = (r*15+c)*4; i = BB_I[base+d]; pos = BB_P[base+d];
```

消除所有 `bbLineIdx(r,c,d)` 的 object allocation + 解構。hot path 加速約 3-5x。

> **注意**：BL 是全域變數，任何操作都會改動它，驗證模式必須在每步前 `bbSync(b)` 確保同步。

### 白棋專用查表（v18 後）

- `T_IS_FOUR_W[w]`：白棋版「是否形成至少一個四」
- `T_IS_LIVE4_W[w]`：白棋版「是否活四」
- 差異：白棋補空格後 l2>=5 都算成五點（黑棋只算 l2===5，長連不算勝）
- 影響：`isFour()`、`sortedFours()`、`findFours()`、`startVerifyClick()` 攻方查四段

---

## 兩種搜尋模式

### 直接深度模式（`'direct'`，預設）
- 清空 TT，以 `maxAtk` 直接跑一次 DFS
- 找到 N 手後**自動嘗試 N-1**，直到縮無可縮
- 結果標示 `直接（原N→最終M手）`，無廢手時不多花時間
- 實測：對 56 手深的複雜題，IDDFS 超過兩分鐘仍無解，Direct Depth 47 秒完成

### IDDFS 模式（`'iddfs'`）
- 每輪 `step()` 開頭清空 TT（v24 修正 Layer 2 bug）
- 對深題（40+ 手）實際上比 Direct Depth 慢，每輪重跑代價高
- 適合解較淺的題目（<20 手），深題建議用 Direct Depth

| 情況 | 建議 |
|------|------|
| 一般題目 | Direct Depth（預設） |
| 深題（40+ 手）想找最短解 | Direct Depth，結果已盡可能縮短 |
| 淺題（<20 手）想確保最短解 | IDDFS |

---

## mustCover 設計（v22 最終版）

mustCover 代表守方目前有直接成五的空格，是守方優先級最高的應手。

```
remaining = mustCover 中「未被攻方落子點直接佔據」的點集合

if remaining.length > 0：
  if defendable.length !== 1（活四或全禁手）：→ 守方有選擇自由，此四無效，continue
  if defendable.length === 1（衝四）：守方唯一堵點集合 defKeySet 必須覆蓋所有 remaining → 否則 continue
if remaining.length === 0：→ 攻方直接佔據了所有 mustCover 點，威脅消解，不限制後續邏輯
```

- `checkLiveFourWin` 必須在 mustCover 蓋住檢查**之後**執行
- `hasFive=true` 時：fivePts 直接作為 mustCover 傳給下層 OR node
- `hasFive=false` 時：blocks（反擊四成五點）作為 mustCover 傳給下層

### getDefenderFourBlocks 回傳格式（v19 後）

```javascript
{hasFive: bool, fivePts: Set<key>, blocks: Set<key>}
```

凡是解構這個函數的地方，都要加 fivePts，不能只解構 `{hasFive, blocks}`。

---

## TT Key 設計

```javascript
ttKey(hash, atkLeft, coverHash)
= (hash << 34) | (atkLeft << 14) | (coverHash & 0x3FFF)
// BigInt 避免 32-bit 溢位
// TT 存失敗上界，查表時 if TT[key] >= atkLeft → return null
// coverHash 用 XOR hash 截斷至 14 bit，理論上有碰撞風險（待評估）
```

---

## 已知 Bug 狀態

| Bug | 狀態 | 說明 |
|-----|------|------|
| findFours 白棋永遠找不到四（v15–v22） | ✅ v23 修正 | 改用 bitboard 查表 |
| IDDFS 跨層 TT 汙染（Layer 2） | ✅ v24 修正 | 每輪清空 TT |
| Direct Depth 找到含廢手路徑 | ✅ v24 修正 | 自動 N-1 縮短 |
| coverHash 14 bit 碰撞（Layer 1） | ⚠️ 未修，中優先 | 極端情況誤判，考慮擴大至 32 bit |

---

## 待辦（依優先級）

**中：**
- [ ] coverHash 14 bit → 更大 hash（Layer 1 根本解）
- [ ] IDDFS 進階：TT entry 加 `atkLeft_stored`，恢復跨層剪枝（需先修 Layer 1）

**低：**
- [ ] 黑棋 textarea 高度視覺問題
- [ ] Worker 版本環境偵測完善（GitHub Pages 以外環境的退回邏輯）

---

## 給下一個 AI 的提示

- **禁手遞迴絕對不能動**：`isForbiddenWithVisited` / `isLiveThreeInDir`，Hangsau 明確要求
- 每次改動前先說明邏輯，Hangsau 確認後再寫程式碼
- 改動時輸出完整區塊，不要只給片段
- BL 是全域變數，任何地方改動 BL 都會影響其他地方
- BB_I / BB_P 是 typed array 預計算，main thread 和 Worker blob **各有一份**，兩處都要同步修改
- 白棋查四有兩張表（`T_IS_FOUR_W` / `T_IS_LIVE4_W`），凡新增用到查表的地方，都要依 player 選表
- `getDefenderFourBlocks` 回傳格式（v19 後）：`{hasFive, fivePts, blocks}`，任何解構必須包含 fivePts
- `findFours()` 落子後不能呼叫 `isFour()`，必須直接用 bitboard 查表
- IDDFS 目前每輪清空 TT（Layer 2 修正），若未來要加回跨層剪枝，需先修 Layer 1 coverHash 碰撞問題
- 直接深度模式找到的不保證最短路徑；IDDFS（修正後）保證最短路徑
- Dev 限定功能在第二段 `<script>` 的 `isDev` 判斷裡擴充
- 推 GitHub 用 `gh auth token` 取得 token：
  ```bash
  TOKEN=$(gh auth token)
  git remote set-url origin "https://${TOKEN}@github.com/Hangsau/gomoku-vcf.git"
  git push origin main
  ```
