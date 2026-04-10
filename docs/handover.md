# VCF 分析器 開發交接單

**版本**：v24-public　**日期**：2026/04/10　**作者**：Hangsau（Claude 修正）

---

## 專案概述

五子棋 VCF（連四取勝）搜尋分析器，純 HTML + JavaScript，單一檔案，跑在瀏覽器裡。  
用途包含詰棋驗算、RenjuLegend 遊戲開發輔助工具。

**開發版**：`gomoku-vcf-v24.html`  
**開放版**：`gomoku-vcf-public.html`（上 GitHub 改名 `index.html`）

---

## 架構

- 單一 AND-OR DFS（已棄用兩階段 FastDFS+Validate 架構）
- Bitboard 查表系統（9-bit 窗口，512 bytes 查表，isFive/isFour 比迴圈快 5x）
- mustCover 反擊四約束傳遞（守方堵完後每次完全重算，不繼承舊值）
- 鄰近格候選（只掃有棋子周圍 NEAR=2 格，候選格從 225 降到約 30）
- findDefense 局部掃描（傳入 lastR/lastC，只掃 ±4 格）
- TT 跨層保留 + 失敗上界（IDDFS 只在整輪開始時清一次，存 minFailDepth）
- 禁手完整遞迴（isForbiddenWithVisited + isLiveThreeInDir 完全保留，禁手內部繼續用陣列迴圈）
- 搜尋為主執行緒（Worker 在 claude.ai 環境被安全政策擋掉，改用 setTimeout 逐深度執行）
- 路徑驗證模式
- 剪枝追蹤模式（v23 新增，v24-public 改為 dev 限定）
- 直接深度模式（v24 新增，預設開啟）
- 題目管理功能（v24 新增）

> **重要**：Worker 已移除。claude.ai artifact 環境不允許 blob Worker（SecurityError）。  
> v24 為主執行緒 + setTimeout，每輪深度之間讓 UI 更新進度。  
> GitHub Pages 上線後可考慮還原 Worker 版本（環境偵測），目前低優先級。

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

> **注意**：禁手遞迴內部大量臨時落子，同步 bitboard 成本高，禁手部分繼續用陣列迴圈。  
> **注意**：BL 是全域變數，任何操作都會改動它，驗證模式必須在每步前 `bbSync(b)` 確保同步。

### 白棋專用查表（v18 後）

- `T_IS_FOUR_W[w]`：白棋版「是否形成至少一個四」
- `T_IS_LIVE4_W[w]`：白棋版「是否活四」
- 差異：白棋補空格後 l2>=5 都算成五點（黑棋只算 l2===5，長連不算勝）
- 影響：`isFour()`、`sortedFours()`、`findFours()`、`startVerifyClick()` 攻方查四段

---

## findFours 重大 Bug（v15～v22）及修正（v23）

**問題**：`findFours()` 落子後呼叫 `isFour()`，但 `isFour()` 第一行是 `if (b[r][c] !== EMPTY) return false`。  
→ 白棋永遠找不到任何四，候選手永遠為空，搜尋第一步就結束。

**修正（v23）**：落子後直接用 bitboard 查表判斷，不再呼叫 `isFour()`。

```javascript
const tFour = p === WHITE ? T_IS_FOUR_W : T_IS_FOUR;
const bl = BL[p-1];
// 落子後：
let hasFour = false;
for (let d=0; d<4; d++) {
  const {i, p:pos} = bbLineIdx(r, c, d);
  if (tFour[bbWindow(bl[d], i, pos)]) { hasFour = true; break; }
}
```

---

## 主搜尋 vs 追蹤模式不一致問題（v24 修正）

**症狀**：剪枝追蹤能找到正確路徑，但 IDDFS 主搜尋找不到。  
**原因**：IDDFS 跨層保留 TT，低深度可能記錄錯誤失敗節點，導致高深度時正確路徑被剪枝。

**修正（v24）**：新增「直接深度模式」作為預設：
- 清空 TT，直接用 maxAtk 跑一次，行為與追蹤模式完全一致
- 不受 IDDFS 跨層 TT 汙染影響
- 結果面板標示 `[直接]` 或 `[IDDFS]`

全域變數：`searchMode`（`'direct'` | `'iddfs'`），預設 `'direct'`。

> 直接深度模式不保證找到「最短」VCF，需要最短路徑時切換回 IDDFS。

---

## mustCover 設計（v22 最終版）

mustCover 代表守方目前有直接成五的空格，是守方優先級最高的應手。

### 蓋住邏輯

```
remaining = mustCover 中「未被攻方落子點直接佔據」的點集合

if remaining.length > 0：
  if defendable.length !== 1（活四或全禁手）：
    → 守方有選擇自由，此四無效，continue
  if defendable.length === 1（衝四）：
    守方唯一堵點集合 defKeySet 必須覆蓋所有 remaining 點
    → 否則 continue
if remaining.length === 0：
  → 攻方直接佔據了所有 mustCover 點，威脅消解，不限制後續邏輯
```

- `checkLiveFourWin` 必須在 mustCover 蓋住檢查**之後**執行
- `hasFive=true` 時：fivePts 直接作為 mustCover 傳給下層 OR node
- `hasFive=false` 時：blocks（反擊四成五點）作為 mustCover 傳給下層
- 守方每次堵完後呼叫 `getDefenderFourBlocks()` 完全重算，不繼承舊值

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

## 剪枝追蹤模式（dev 限定，?dev=1）

追蹤日誌標籤：

| 標籤 | 顏色 | 說明 |
|------|------|------|
| `[CONT]` | 藍 | 目標手正常通過 |
| `[CUT-TT]` | 紅 | TT 命中，被失敗上界剪掉 |
| `[CUT-MC1]` | 紅 | mustCover 非空 + 活四/全禁手，守方可去成五 |
| `[CUT-MC2]` | 紅 | mustCover 非空 + 衝四，守方堵點無法覆蓋所有 remaining |
| `[CUT-DEF0]` | 紅 | 找不到守方必堵點 |
| `[MISS]` | 黃 | 目標手不在候選四列表中 |
| `[OK-L4WIN]` | 綠 | 活四直接勝 |

---

## 題目管理（v24）

- localStorage key：`gomoku_vcf_puzzles`
- JSON 格式：`{name, white, black, ts}`
- 在 claude.ai artifact 環境可能因沙盒限制失效，請用 JSON 匯出備份
- GitHub Pages 環境 localStorage 正常運作

---

## 開放版 vs 開發版對照

| 功能 | 開放版 | 開發者（?dev=1） |
|------|--------|-----------------|
| VCF 計算 | ✓ | ✓ |
| 路徑驗證 | ✓ | ✓ |
| 題目管理 | ✓ | ✓ |
| 剪枝追蹤模式 | ✗ 隱藏 | ✓ 顯示 |
| 預載題目 | ✗ 空清單 | ✗ 空清單 |

---

## 開放版檔案結構

```html
<script>主程式（line 658 開始）</script>
<!-- about 說明區塊 / footer HTML -->
<script>dev 模式控制</script>
```

修改時確認兩段 script 各自配對，不要讓 HTML 混進 script 區塊。

---

## 實測紀錄（v24, 2026/04/08）

- 一般測試：共測試 3～4 個題目，全部正確找到答案
- 浅田真司 381：直接深度模式成功找到（v23 IDDFS 無法找到的問題已解決）
- 壓力測試：黑棋幾乎佔滿 15x15 盤面，找到 47 手攻擊（93 步），耗時 2.26 秒

---

## 2026/04/10 分析與修正紀錄

### 問題描述
使用者發現複雜題目（路徑非常多的情況）：
- 直接深度模式：70～100 秒可解，但偶爾找到「浪費手」的路徑（攻方某幾手下完後防方封住，後續沒有繼續利用，白下）
- IDDFS 模式：直接當機

### 根本原因分析（兩層問題）

**Layer 1：coverHash 碰撞（已知，未修）**
TT key 的 coverHash 截斷至 14 bit（`& 0x3FFF`），不同守方封堵方案可能產生相同 hash，導致 TT 誤判剪枝。

**Layer 2：IDDFS 跨層 TT 汙染（今日修正）**
IDDFS 在整個搜尋過程只清一次 TT（進入 IDDFS 前），之後各輪共用同一張 TT：
- d=3 搜到局面 P 失敗 → TT 記「P 失敗」
- d=5 搜到 P → TT 說失敗 → 剪枝 → 但 d=5 其實可能有解
- 結果：正確路徑被錯殺，IDDFS 在任何深度都找不到解 → 無限加深 → 當機

### 今日修正內容

在 IDDFS 的 `step()` 函數開頭加入 `TT = new Map()`，改為**每輪清空 TT**：

```javascript
// 修改前：TT 整個 IDDFS 共用
TT = new Map();  // 只在開始前清一次
function step() {
  ...
  const moves = vcfDFS(..., limit, ...);

// 修改後：每輪清空
function step() {
  TT = new Map(); // 每輪清空，避免低深度失敗記錄汙染高深度搜尋
  ...
  const moves = vcfDFS(..., limit, ...);
```

**代價**：放棄跨層 TT 剪枝效益（同一局面在不同深度不再共用快取）。  
**效益**：IDDFS 正確性恢復，找到的一定是最短 VCF 路徑，直接深度「浪費手」問題也因此解決。

### 預期效果
- 複雜題：IDDFS 找到最短解即停止，速度有機會優於直接深度（直接深度跑 maxAtk 全深，IDDFS 找到最短深度就停）
- 找到的路徑每一手攻擊都有意義，無冗餘手

### 尚未解決（Layer 1）
coverHash 14 bit 碰撞問題仍存在，當前 Layer 2 修正後 IDDFS 不再當機，但碰撞仍可能在極端情況造成誤判。  
**後續評估方向**：將 coverHash 從 14 bit 擴展為更大的 hash（32 bit？），或改用 Zobrist hash 的子集。

---

## 已知問題與待辦

**優先級高：**
- [ ] IDDFS 修正後在複雜題實測（與直接深度對比時間 + 路徑品質）
- [ ] 浅田真司 381 在 GitHub Pages 環境重新驗證
- [ ] Pages 環境實測：`?dev=1` 剪枝追蹤顯示是否正常

**優先級中：**
- [ ] coverHash 碰撞根本解法（Layer 1）：14 bit → 更大 hash 評估
- [ ] IDDFS 進階優化：TT entry 加入 `atkLeft_stored`，查表時驗證適用性，恢復跨層剪枝效益（需同時解決 Layer 1 才有意義）

**優先級低：**
- [ ] 黑棋 textarea 高度不足視覺問題（min-height 調整）
- [ ] Worker 版本還原評估（Pages 環境偵測）

---

## 給下一個 AI 的提示

- **禁手遞迴絕對不能動**，這是 Hangsau 明確要求
- 每次改動前先說明邏輯，Hangsau 確認後再寫程式碼
- 改動時輸出完整區塊，不要只給片段
- BL 是全域變數，任何地方改動 BL 都會影響其他地方
- 白棋查四有兩張表（`T_IS_FOUR_W` / `T_IS_LIVE4_W`），凡新增用到查表的地方，都要依 player 選表
- `getDefenderFourBlocks` 回傳格式（v19 後）：`{hasFive, fivePts, blocks}`，任何解構必須包含 fivePts
- `counterFive/dFive=true` 時，把 fivePts 當 mustCover 傳下層，絕對不能 continue 跳過
- `findFours()` 落子後不能呼叫 `isFour()`，必須直接用 bitboard 查表
- **IDDFS 目前每輪清空 TT**（Layer 2 修正），若未來要加回跨層剪枝，需先修 Layer 1 coverHash 碰撞問題，並在 TT entry 加入 `atkLeft_stored` 欄位做查表驗證
- 直接深度模式找到的不保證最短路徑；IDDFS（修正後）保證最短路徑
- 若未來要新增 dev 限定功能，在第二段 `<script>` 的 `isDev` 判斷裡擴充即可

---

## GitHub 部署計畫

**目標 repo 結構：**
```
gomoku-vcf/
├── index.html
├── README.md
├── CHANGELOG.md
└── docs/
    └── handover.md
```

**上線步驟：**
1. 建立 GitHub 帳號（若尚未有）
2. 建立新 repo（名稱建議：`gomoku-vcf`）
3. 上傳：`index.html` / `README.md` / `CHANGELOG.md` / `docs/handover.md`
4. 開啟 GitHub Pages（Settings → Pages → Branch: main → Save）
5. 確認 Pages 連結可正常開啟並測試功能
6. 設定第一個 Issue：確認所有測試題目在 Pages 環境結果一致

**連結：**
- 一般使用：`https://你的帳號.github.io/gomoku-vcf/`
- 開發者：`https://你的帳號.github.io/gomoku-vcf/?dev=1`
