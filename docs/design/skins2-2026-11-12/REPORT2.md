# REPORT2：新棋具預設關閉（optIn）

## 改了什麼（逐檔）
- `game/skin.js`
  - 7 張新棋盤（grass、starry、beach、chalk、ice、denim、pool）和 7 組新棋子（poop、bunny、pets、onigiri、sky、boo、donut）各加 `optIn: true`；檔頭註解加「新加的棋盤、棋子一律加 `optIn: true`（預設關閉，後台打開才出現）」。
  - 清單格式改為 `{"off":{boards,stones},"on":{boards,stones}}`（localStorage 鍵仍是 `vcfgame.skinsOff`）；讀到舊格式（最外層直接是 boards／stones）當成 `off`，`on` 當空；壞掉的 JSON 當全空。
  - `isOff`：classic、flat 永遠開放；有 `optIn`＝不在 `on` 就關閉（沒清單、連不上伺服器也是關閉）；沒 `optIn`＝在 `off` 才關閉。
  - 向 `/skins` 要清單那段照新格式處理（`norm({off, on})`），內容有變才存回並重套用。
- `game/worker/worker.js`
  - `GET /skins`、`GET /admin/skins` 回 `{off:{…}, on:{…}}`；`POST /admin/skins` 收 `{off, on}`（`on` 沒給當空；`on` 用跟 `off` 一樣的檢查）。
  - `settings.skins_off` 存 `{boards, stones, on:{boards, stones}}`：頂層 boards／stones 仍是 off，所以舊資料（沒有 `on`）讀得動。
  - 函式 `readSkinsOff` 改名 `readSkins`。
- `game/worker/admin.html`
  - 開關顯示「玩家現在看不看得到」，切換時依 `optIn` 改 `on` 或 `off`；optIn 項目名字旁加小字「新」。
  - 「新的全部關閉」＝清空 `on`；「全部開放」＝`off` 清空＋`on` 放進 `RushSkin` 裡所有 `optIn` 的 id。寫死的 14 個 id 清單已刪。
- `game/skin-picker.js`：沒改（本來就用 `S.isOff` 過濾）。
- `check/check_skin.mjs`：假的 `/skins` 回應改為可指定整份內容或回 500；第 2 節改成 optIn 情境（2a–2e）；版面檢查（四語×兩尺寸）在「on 全部 14 個」狀態下跑。

## 檢查完整輸出
`check/run2.txt`，結尾：`PASS 104／FAIL 0`。重點：
- 2a 伺服器 500＋無 localStorage：棋盤 8、棋子 7；14 個新的都不在；`setStones('poop')`、`setBoard('grass')` 回 false。
- 2b `on`＝grass／poop、bunny：棋盤 9、棋子 9；`setStones('poop')` true、`pets` false。
- 2c `off` 有 green、`on` 有 grass：green 不見、grass 出現；localStorage 選擇不被改寫；重新開放後自動回來。
- 2d 舊格式 `{"boards":["green"],"stones":[]}`：不報錯，green 關閉。2e 壞掉的 JSON 不報錯。
- 四語×360×640／375×667（on 全 14）：15／14 一屏放完、無超出、無 console error。
- 逐一換、fig 不描邊、numHalo、fillNum、負向測試（.sgrid 改 4 欄會被抓到）都照跑通過。
- `node --check`：skin.js、skin-picker.js、admin.html 內嵌 script（抽到 `_admin_inline.js`）、worker.js（複製成 .mjs 檢查）皆通過。
- 截圖：`check/shots/combo_bunny_grass.png`、`combo_sky_starry.png`（圖都在，已截）。

## 沒做到或不確定
- 有手數字的盤面截圖：沒做（棋具頁預覽以外，要開闖關盤面並下子，這次沒寫那段流程）。
- 後台 admin.html 的切換邏輯只過語法檢查＋人工走過四種情況（optIn 開／關、一般項目開／關），沒有在瀏覽器裡跑；worker 的 POST/GET 也沒有實際打（禁止部署，也沒起本機 wrangler）。
- Worker 與 admin.html 尚未部署，線上玩家目前仍是舊行為；部署前舊版 skin.js 會把 `{off,on}` 當成沒 `boards` 欄位而全部開放，需 skin.js 與 worker 一起上。
