# CHANGELOG

## v25（2026/04/12）

效能優化（三項）：

- **優化一：Line Buffer**（`countFoursInDir` / `isLiveFourInDir`）：預取 ±5 格（11 格）到 local `Int8Array`，消除每次 `lineCount` 的 while 迴圈 + 2D array 存取，主要熱路徑加速 3-4x
- **優化二：countRealFourDirs 早退**：達到 cnt>=2 立即返回，省去無用方向的計算
- **優化三：bbLineIdx Lookup Table**（`BB_I` / `BB_P` Uint8Array）：消除全部 `bbLineIdx` 呼叫的 object allocation + 解構，以預計算 typed array index 取代，main + worker 雙版本同步更新

Main thread 與 Worker blob 同步完成，預期整體搜尋加速 **1.5x–2x**。

---

## v24-public（2026/04/08）

開放版製作：

- 標題簡化：移除版本號，subtitle 改為純說明文字
- 剪枝追蹤模式改為 `?dev=1` 限定顯示（一般使用者不可見）
- 新增說明區塊（三欄：什麼是 VCF、使用方式、題目管理）
- 新增 footer（作者資訊）
- 題目清單維持空白，不預載任何題目

---

## v24（2026/04/08）

- 新增**直接深度模式**（預設開啟）：清空 TT、單次 DFS，解決 IDDFS TT 跨層汙染問題
- IDDFS 模式保留，可手動切換
- 新增**題目管理功能**：localStorage 儲存、JSON 匯入匯出
- 確認 GitHub Pages 為部署目標

---

## v23

- 新增**剪枝追蹤模式**：追蹤已知手順是否被剪枝及原因
- 修正 `findFours()` 重大 Bug：落子後不再呼叫 `isFour()`，改為直接用 bitboard 查表
  - 此 Bug 導致 v15～v22 白棋（及黑棋）VCF 搜尋候選手永遠為空

---

## v22

- mustCover 蓋住邏輯完整重寫，區分活四與衝四
- `checkLiveFourWin` 移至 mustCover 蓋住檢查之後執行
- 活四時 remaining > 0 直接 continue；衝四時才允許靠守方堵點消解 mustCover

---

## v21

- 引入 effectiveMustCover
- 活四時攻方落子直接佔據 mustCover 視為消解（後發現未區分活四/衝四，v22 修正）

---

## v20

- OR node mustCover 蓋住檢查初版
- `checkLiveFourWin` 移至 mustCover 檢查之前（v22 修正）

---

## v19

- 修正 counterFive/dFive 錯誤剪枝（主要 Bug）
- `getDefenderFourBlocks` 改為完整回傳 `fivePts`，格式：`{hasFive, fivePts, blocks}`
- 驗證模式顯示修正

---

## v18

- 新增 `T_IS_FOUR_W` / `T_IS_LIVE4_W` 白棋專用查表
- 修正白棋衝四含長連成五點的誤判

---

## v17

- mustCover 完全重算（每次守方堵完後重算，不繼承舊值）
- 新增路徑驗證模式
- Worker 改為主執行緒（解決 claude.ai 沙盒限制）
- 新增快速輸入局面功能

---

## v16

- 刪除步驟 6 安全預檢
- TT 改存失敗上界 minFailDepth

---

## v15

- Bitboard 查表系統（9-bit 窗口，512 bytes 查表）
- `isFive` / `isFour` 改用查表，速度約為迴圈的 5 倍

---

## v14

- 架構換成單一 AND-OR DFS
- 加入 mustCover 反擊四約束傳遞

---

## v13

- 鄰近格候選（NEAR=2，候選格從 225 降到約 30）
- `findDefense` 局部掃描（±4 格）
- TT 跨層保留、移除子 TT

---

## v12

- 兩階段 FastDFS + ValidatePath 架構
- Zobrist TT
