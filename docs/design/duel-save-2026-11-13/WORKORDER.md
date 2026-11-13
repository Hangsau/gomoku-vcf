# 施工單：兩儀殿存譜——長對局拆開存、驗證超時局有沒有存到

**立即執行、不要只輸出計畫、不要等確認。沒改檔案就是失敗。** 進度寫本資料夾 `PROGRESS.md`，最後寫 `REPORT.md`。

## 背景（2026-11-13）

使用者問「目前兩儀殿存譜方式對嗎？會不會有沒存到的問題？」。主 session 讀程式後回報幾個風險，使用者核准做其中兩項：

1. **（核准）伺服器存檔時，太大的紀錄拆開存**——使用者問「這怎麼連得回來？如果可以的話就去做」。
2. **（核准）實測五子棋超時的局有沒有存到**——「可以去試試」；有問題就修。

**沒有核准、不要做**：把首頁「今日棋局」改成向伺服器要紀錄（那是另一件事）。

### 現況（動手前自己再讀一次確認）

- 對戰伺服器 `game/duel-server/worker.js`（Durable Object `Hall`）：`recordGame(room)` 在每局結束時 `state.storage.put({ 'full:<id>': full, 'rec:<id>': sum })`。`full` 是整局（五子棋：`match`＋`result`；VCF：`vcf`、`score`、`review`，`review` 含每題題目與雙方手順）。Durable Object 單一 value 上限約 128 KiB；VCF 題數多時 `full` 可能超過 → 整個 `put` 失敗（兩把鍵一起）→ 這局沒有任何紀錄，只 `console.error`。`sendRecs`／`sendRec`（訊息 `recs`／`rec`）讀這些鍵回給前端。
- 前端 `duel.html` 的 `recordToday(r)`：我坐在座位上、收到 `state === 'over'` 時寫一筆進 localStorage `vcfgame.today`。五子棋的勝負取 `match.result`；**超時的結果不在動作紀錄裡**，程式用 `r.clock.findIndex(v => v <= 0)` 找時鐘歸零的那位，找不到（`lose < 0`）就直接 return、不存。

## 要做的

### A. 伺服器：大紀錄拆開存（`game/duel-server/worker.js`）

- `recordGame`：把 `full` 轉成 JSON 字串量大小（用 UTF-8 位元組數，不是字元數；中文暱稱一個字 3 bytes）。
  - 不超過門檻（建議 96 KiB，留餘裕）→ 照舊存成一把 `full:<id>`（物件）。舊資料與新的小紀錄格式完全不變。
  - 超過 → 字串切成每段 ≤ 門檻的片段，存成 `full:<id>:p0`、`full:<id>:p1`…；`full:<id>` 改存一個小的標頭 `{ id, at, chunked: true, parts: N, bytes: 總位元組 }`。切片要以位元組為準且不可切壞多位元組字元（做法自己定，例如先 `TextEncoder` 成位元組再切、讀回時接起來再 `TextDecoder`；或切字串時保證每段位元組 ≤ 門檻）。
  - 所有鍵（`rec:<id>`、`full:<id>`、各片段）用**同一次** `storage.put({...})` 寫入（同一次呼叫是整批成功或整批失敗，不會只存到一半）。一次 `put` 最多 128 把鍵：片段數加兩把超過時分批，並在 REPORT 說明那種情況的行為。
  - `put` 失敗時：除了 `console.error`，再試一次只存 `rec:<id>`（摘要）加一個欄位 `lost: true`，讓這局至少留下「有這一局、內容沒存到」的紀錄。
- 讀取端（`sendRec` 及任何讀 `full:` 的地方）：讀到 `chunked: true` 的標頭就把 N 個片段一次讀出（`storage.get([...keys])`）、照順序接回、`JSON.parse`；任何片段缺少或解析失敗 → 回跟「找不到這局」一樣的結果，不可以丟例外讓連線斷掉。
- `sendRecs` 列清單只讀 `rec:` 摘要，確認它用 `storage.list` 的 `start`／`end` 範圍不會把 `full:…:pN` 掃進去（鍵的前綴不同，確認即可）。
- 這就是「怎麼連得回來」：片段的鍵都以同一局的 id 開頭、帶順序編號，標頭記著總共幾段。把你的做法用三句白話寫在 REPORT 開頭，主 session 要轉述給使用者。

### B. 驗證並修正：五子棋超時的局

- 寫測試實際打一局會超時的五子棋（本機對戰伺服器，時間設最短；看 `worker.js` 有沒有可用 `--var` 縮短的常數，像 `IDLE_MS` 那樣；沒有就用房間的最短時間設定等它超時）：
  - 伺服器：`rec:`／`full:` 有沒有這一局、`win` 與結束原因對不對。
  - 兩位玩家各自的 `vcfgame.today` 有沒有寫入這一局、勝負對不對（贏的人 `res: 'w'`、輸的人 `'l'`）。
  - 把超時當下前端收到的 `r.clock` 實際數值印出來寫進 REPORT（是不是 ≤ 0）。
- 有任何一邊沒存到或勝負錯 → 修。前端修法的方向：不要靠時鐘數字猜；伺服器的房間狀態裡如果已經有結果（誰贏、原因），前端直接用；沒有就讓伺服器在結束時把結果放進送給前端的房間資料（只新增欄位，舊頁面收到不會壞）。
- 同一支測試順便確認這幾種結束方式兩邊都有存、勝負正確：連五、認輸、斷線判負（斷線的那位重新連回同一間房後也要補存到；房間已關就記錄「補不到」並寫進 REPORT，不用修）、VCF 分數到。

### C. 部署前查有沒有人在對局的小工具（新檔 `tools/duel_busy.mjs`）

使用者要求：「做之前先暫停對局，有人在對局的話就先等」。部署對戰伺服器會中斷進行中的對局，所以主 session 部署前要先查。

- `node tools/duel_busy.mjs`：用 Node 內建 `WebSocket` 連線上對戰伺服器（網址與連線參數照 `duel.html` 的 `WS_URL` 與連線那段；用一個隨機的新玩家 id、不帶暱稱或用 `duel_busy`），讀到大廳清單後立刻斷線。**只讀，不送 `create`／`sit`／`view`／`join` 等任何會改變狀態的訊息。**
- 印出：線上人數、每間房的狀態（等人／對局中／研棋／結束）與人數。有任何一間在「對局中」或「研棋」→ exit code 1；否則 0。連不上 → exit code 2。
- `node tools/duel_busy.mjs --wait 600`：每 20 秒查一次，直到沒人在對局（exit 0）或超過秒數（exit 1）。每次查都是「連線→讀→斷線」，不要掛著連線。
- 本機測試時可以用 `--url ws://127.0.0.1:8789/...` 指到本機伺服器。

## 限制（違反任何一條都算失敗）

- 禁止任何 git 操作（含 `git status`、`git diff`）。**禁止部署**（不跑 `wrangler deploy`、`tools/deploy_*.sh`）。本機 `wrangler dev` 可以。
- **不准連線上對戰伺服器做任何事**，唯一例外：`tools/duel_busy.mjs` 寫好後可以對線上跑**一次**不帶 `--wait` 的唯讀查詢，把輸出貼進 REPORT。
- 行程規則：禁止用程式名稱關行程；只准關自己啟動的 PID。腳本前景執行＋逾時。不對系統 Python 裝套件。
- 只准改／新增：`game/duel-server/worker.js`、`duel.html`（只有 B 需要修前端時；只動 `recordToday` 與它用到的資料）、新檔 `tools/duel_busy.mjs`、`docs/design/duel-save-2026-11-13/` 底下的 `PROGRESS.md`、`REPORT.md`、`check/`。
- 不准碰 `game.html`、`game/worker/`、`game/settings.js`、`game/shop.js`。`duel.html` 的 `// showInApp();`、觀戰自動追焦（`watchFollow` 等）、喇叭小框、VCF 回看的「自己擺」不要動。
- 伺服器送給前端的訊息只可以**新增欄位**；現在線上的舊版 `duel.html` 連到新伺服器、新版 `duel.html` 連到舊伺服器，都不可以壞（兩種組合在 REPORT 各寫一句你怎麼確認的）。
- 已經存在線上的舊紀錄格式不變、讀得出來。
- 不要重跑別的資料夾的檢查腳本去覆寫它們的截圖。

## 檢查（結果全部貼進 REPORT.md）

1. `node --input-type=module --check < game/duel-server/worker.js`（或它適用的檢查方式）、`node --check tools/duel_busy.mjs`、`duel.html` module script 抽出來檢查。
2. 拆存的單元測試 `check/check_chunk.mjs`：把切片與接回寫成可以單獨測的純函式（從 `worker.js` 抽出實際程式來測，做法參考之前的 `// ==…BEGIN==`／`END` 標記法），測：小於門檻不切；剛好等於、多 1 byte；500 KiB；內容全是中文與表情符號（多位元組字元不被切壞）；接回後與原字串逐位元組相同；少一段、順序錯、內容被改 → 接回函式回報失敗而不是丟例外。
3. 本機端到端 `check/check_save.mjs`（Playwright＋本機對戰伺服器，寫法照 `docs/design/duel-watch-follow-2026-11-13/check/check_follow.mjs`）：
   - B 節的各種結束方式。
   - 用測試手段造出一局超過門檻的 VCF 紀錄（例如暫時把門檻用 `--var` 調到很小，讓一般對局也會被切）：這局結束後 `recs` 清單有它、`rec` 讀得回完整內容且與沒切時的內容相同；storage 裡確實是標頭＋片段。
   - 門檻正常時一般對局仍是單一把鍵。
   - 量出真實大小：一線天搶 3、八仙渡各種目標題數下，一局 `full` 大約幾 KB（寫進 REPORT，讓主 session 知道離 128 KiB 多遠）。
   - 全程沒有 pageerror、伺服器沒有未捕捉例外。
   - 負向測試一項。
4. `tools/duel_busy.mjs`：對本機伺服器驗三種情況（沒有房、有房等人、有房對局中）輸出與 exit code 正確；`--wait` 在對局結束後會回 0。再對線上跑一次唯讀查詢，貼輸出。

## REPORT.md 格式

開頭三句白話：拆開存之後怎麼連回來／超時局原本有沒有存到、現在呢／部署時要注意什麼。接著：改了什麼（逐檔、行號範圍）／每項檢查的完整輸出／真實大小量測／沒做到或不確定的事（老實寫）。
