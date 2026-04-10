# 五子棋 VCF 分析器

**VCF（連四取勝）搜尋分析工具，純 HTML + JavaScript，單一檔案，跑在瀏覽器裡。**

🔗 **線上使用**：[https://你的帳號.github.io/gomoku-vcf/](https://你的帳號.github.io/gomoku-vcf/)  
🛠 **開發者模式**：網址加 `?dev=1` 可顯示剪枝追蹤功能

---

## 功能簡介

- **VCF 搜尋**：自動尋找黑棋或白棋的連四取勝手順
- **禁手規則**：支援黑棋禁手（三三、四四、長連）
- **路徑驗證**：輸入已知手順，驗證是否為合法 VCF
- **題目管理**：儲存、載入、匯入匯出題目（JSON 格式）
- **直接深度模式**（預設）：清空 TT 單次 DFS，結果最穩定
- **IDDFS 模式**：逐層加深，可找最短手順

---

## 使用方式

1. 開啟線上連結（或直接用瀏覽器打開 `index.html`）
2. 在「盤面編輯」tab 輸入棋子座標（格式如 `H8 G7 F6`）
3. 選擇攻方顏色、最大搜尋深度
4. 按「開始 VCF 搜尋」
5. 結果顯示於右側面板，點擊手順可在盤面上回放

---

## 技術架構摘要

| 項目 | 說明 |
|------|------|
| 搜尋演算法 | 單一 AND-OR DFS |
| 加速機制 | Bitboard 9-bit 查表（查表速度約為迴圈的 5 倍） |
| 剪枝 | mustCover 反擊四約束傳遞、TT 失敗上界 |
| 候選格 | 只掃有棋子周圍 NEAR=2 格（約 30 格，非全盤 225 格） |
| 禁手 | 完整遞迴實作（isForbiddenWithVisited） |
| 執行環境 | 主執行緒（Worker 因 claude.ai 沙盒限制移除） |

詳細設計見 [`docs/handover.md`](docs/handover.md)

---

## 部署說明

本工具為純靜態網頁，不需伺服器。

**GitHub Pages 部署步驟：**

1. Fork 或 clone 此 repo
2. 確認 `index.html` 在 repo 根目錄
3. `Settings → Pages → Branch: main → Save`
4. 等待幾分鐘後，Pages 連結即可使用

---

## 題目管理

- 題目儲存於 `localStorage`（key: `gomoku_vcf_puzzles`）
- GitHub Pages 環境 localStorage 正常運作
- 跨裝置使用請用「匯出 JSON」功能備份題目

JSON 格式：
```json
{
  "name": "題目名稱",
  "white": "A1 B2 C3",
  "black": "D4 E5 F6",
  "ts": 1712563200000
}
```

---

## 開發者模式

網址加 `?dev=1` 可顯示**剪枝追蹤模式**：

- 輸入已知正確手順，追蹤搜尋過程中路徑是否被剪枝
- 日誌標籤：`[CONT]` `[CUT-TT]` `[CUT-MC1]` `[CUT-MC2]` `[CUT-DEF0]` `[MISS]` `[OK-L4WIN]`

---

## 作者

Hangsau · Line: hangsau  
本工具為 RenjuLegend（Unity 五子棋遊戲）詰棋系統的輔助開發工具。
