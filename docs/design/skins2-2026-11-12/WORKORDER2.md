# 施工單 2：新棋具「預設關閉」，後台開了才出現

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 做完寫 `REPORT2.md`（同資料夾）。

使用者 2026-11-12：「預設關閉，以後我自己開放」。意思是：新加的棋盤、棋子在後台沒有明確打開之前，玩家一律看不到——包括玩家連不上伺服器、或手機裡沒有存過清單的情況。以後再加新棋具也是同一個規則。

## 限制（跟施工單 1 一樣）
- 禁止任何 git 操作；禁止部署（不跑 `tools/deploy_*.sh`、不跑 wrangler）。
- 禁止用程式名稱關行程（`taskkill /IM`、`pkill`、`Stop-Process -Name`）；只准關自己啟動的 PID；腳本前景執行＋逾時。
- 只准改：`C:\claudehome\projects\VCF\` 底下的 `game/skin.js`、`game/skin-picker.js`（需要才動）、`game/worker/worker.js`、`game/worker/admin.html`、`docs/design/skins2-2026-11-12/check/check_skin.mjs`、`docs/design/skins2-2026-11-12/REPORT2.md`。
- `game/skin/` 底下的圖不要動（codex 還在畫）。

## 先讀
`docs/design/skins2-2026-11-12/WORKORDER.md` 的 1d、4b、4c，和你（上一張單）在 `game/skin.js`、`worker.js`、`admin.html` 寫好的開關程式。

## 要改成的規則
1. `game/skin.js`：這次新增的 7 張棋盤（grass、starry、beach、chalk、ice、denim、pool）和 7 組棋子（poop、bunny、pets、onigiri、sky、boo、donut）每個項目加 `optIn: true`。檔案開頭註解加一行：「新加的棋盤、棋子一律加 `optIn: true`（預設關閉，後台打開才出現）」。
2. 清單格式多一份 `on`：伺服器與 localStorage（`vcfgame.skinsOff` 這個鍵沿用）都存 `{"off":{"boards":[],"stones":[]},"on":{"boards":[],"stones":[]}}`。
   - localStorage 讀到舊格式（最外層直接是 `boards`／`stones`）時當成 `off`，`on` 當空的。
3. `isOff(it)`：
   - `classic`、`flat` 永遠開放。
   - 有 `optIn` 的項目：**在 `on` 清單裡才算開放**，否則關閉（沒有清單、連不上伺服器也是關閉）。
   - 沒有 `optIn` 的項目：在 `off` 清單裡才算關閉（照舊）。
4. `GET /skins`、`GET /admin/skins` 回 `{ off: {...}, on: {...} }`；`POST /admin/skins` 收 `{ off: {...}, on: {...} }`（`on` 沒給當空的），`on` 的檢查規則跟 `off` 一樣；`settings` 表同一筆 `skins_off` 存 `{boards, stones, on:{boards, stones}}` 或你覺得乾淨的等價結構（讀舊資料不能壞）。
5. 後台「棋具」分頁：
   - 每個項目的開關顯示的是「現在玩家看不看得到」（用上面第 3 點的規則算），切換時依項目有沒有 `optIn` 去改 `on` 或 `off` 清單。
   - 有 `optIn` 的項目名字旁加小字「新」。
   - 「新的全部關閉」改成清空 `on`（不要再寫死 14 個 id）；「全部開放」＝`off` 清空＋`on` 放進所有 `optIn` 的 id。
6. `skin.js` 向伺服器要清單的那段照新格式處理；內容有變才重套用。

## 檢查（更新 `check/check_skin.mjs`，結果貼進 REPORT2.md）
- 沒有 localStorage、`/skins` 攔下來回 500：棋具頁只有 8 張棋盤、7 組棋子（14 個新的都不在）；`setStones('poop')` 回 false。
- `/skins` 回 `{off:{boards:[],stones:[]}, on:{boards:['grass'], stones:['poop','bunny']}}`：棋具頁 9 張棋盤、9 組棋子；`setStones('poop')` 回 true。
- `/skins` 回 `on` 全部 14 個：15／14，四語 × 360×640、375×667 仍然一屏放完（原本的版面檢查要改成在這個狀態下跑）。
- `off` 有 `green`、`on` 有 `grass`：green 不見、grass 出現。
- localStorage 放舊格式 `{"boards":["green"],"stones":[]}`：不報錯，green 關閉。
- 原本的其他檢查（選擇不被改寫、fig 不描邊、numHalo、負向測試）照跑。
- `node --check` 三個 js（worker 照上次的方式）；腳本結尾 `PASS n／FAIL 0`。
- 圖已經在的話（`game/skin/boards/grass.webp`、`game/skin/stones/sky/b.png` 存在才做），截 `bunny`＋`grass`、`sky`＋`starry` 的棋具頁預覽，以及一張有手數字的盤面（能做到就做，做不到寫明）。

## REPORT2.md
改了什麼（逐檔）／檢查完整輸出／沒做到或不確定的事。
