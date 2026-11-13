# REPORT：兩儀殿存譜（2026-11-13）

**給使用者的三句白話（主 session 轉述用）**

1. **拆開存之後怎麼連回來**：一局太大（超過 96 KiB）就把紀錄切成好幾段，每段的名字都以這一局的編號開頭、後面加順序號（`full:<編號>:p0`、`:p1`…），原本那把 `full:<編號>` 改放一張小標頭，寫著「共幾段、總共幾 byte、整份的指紋」；讀的時候照標頭的段數把全部段落一次讀出、依序接起來、驗過 byte 數與指紋才還原，少一段或被改過就當作「找不到這局」，不會斷線。
2. **超時局原本有沒有存到**：實測本來就有存到——伺服器那邊有、兩位玩家的「今日棋局」也有、勝負也對（超時當下頁面收到的 `r.clock` 是 `[0, 59972]`，輸的那位確實是 0）；所以不是壞掉，我只是把它改得更穩：伺服器的房間資料多帶 `result`（誰贏、原因），頁面優先用它，沒有才回頭看時鐘。**真正沒存到的只有「斷線判負的那位自己」**：判負時他已不在線上，重連回來時房間已回到等人，補不到（伺服器那邊有存，只是他的裝置沒有）。
3. **部署時要注意**：① 部署前先跑 `node tools/duel_busy.mjs`（有人對局就 exit 1，`--wait 600` 會等到沒人）；② 這次只新增欄位與新鍵格式，新舊頁面與新舊伺服器兩種組合都不會壞（見下）；③ 部署會重開大廳、進行中的對局會中斷，所以第 ① 點要先做；④ 目前一局最大才幾 KB，離 128 KiB 很遠，拆存只是保險。

## 改了什麼

| 檔 | 行 | 內容 |
|---|---|---|
| `game/duel-server/worker.js` | 44–90 | 新增 `// ==CHUNK BEGIN==`…`END` 區塊：`FULL_CHUNK_BYTES`(96 KiB)、`PUT_KEYS_MAX`(128)、`fnv1a`、`splitByBytes`（以 UTF-8 位元組切、切點退到字元開頭，不切壞中文／表情符號）、`planFullPuts`（小紀錄一批兩把鍵；大紀錄片段鍵先寫、標頭與 rec 放最後一批）、`partKeys`、`joinFull`（驗段數、每段是字串、總 byte、指紋、JSON；任何不對回 null、不丟例外） |
| 同上 | 120 | 建構子：`this.chunkBytes = Number(env.FULL_CHUNK_BYTES) \|\| 96 KiB`（本機測試用 `--var FULL_CHUNK_BYTES:600` 調小；線上沒設＝預設） |
| 同上 | 675、679–695 | `recordGame` 改呼叫新的 `saveRec(id, sum, full)`：照 `planFullPuts` 的批次依序 `put`；失敗 → `console.error` ＋ 再試一次只存 `rec:<id>` 加 `lost: true`；再失敗只 log |
| 同上 | 688–694、715 | 新 `readFull(key)`：讀 `full:<id>`，是 `chunked` 標頭就 `storage.get([...片段鍵])` 接回；`sendRec` 改用它（找不到／壞掉 → 原本的 `err gone`） |
| 同上 | 736 | `roomMsg` 新增欄位 `result`（五子棋 `match.result`，沒有就 null）——**只新增欄位** |
| `duel.html` | 889 | `recordToday`：`let result = match.result \|\| r.result;`，沒有才走原本的時鐘回退；其餘不動 |
| `tools/duel_busy.mjs`（新，57 行） | — | 部署前查有沒有人在對局（只讀：只連線讀大廳、斷線，不送任何會改狀態的訊息） |
| `docs/design/duel-save-2026-11-13/` | — | `PROGRESS.md`、本檔、`check/`（`check_chunk.mjs`、`check_save.mjs`、`check_busy.mjs` 與各次輸出） |

`sendRecs` 確認：用 `storage.list({ start: 'rec:' + pad13(since), end: 'rec;', reverse: true })`，只掃 `rec:` 前綴；`full:…:pN` 前綴不同，掃不到（端到端 check 也驗了 storage 裡 `rec:` 與 `full:` 各自獨立）。

### 一次 put 超過 128 把鍵時的行為
片段 + 標頭 + rec 超過 128 把（片段 > 126 段，約 12 MB 的紀錄，目前不可能）→ 依序分批 `put`：片段鍵先寫，**標頭與 rec 放最後一批**，所以讀得到標頭時片段一定都在；中途失敗 → 落回只存 `rec` + `lost: true`，已寫入的前面片段會留成孤兒鍵（無害、不會被讀到、沒有清理）。單元測試涵蓋（205 段 → 2 批）。

## 新舊相容怎麼確認
- **舊版 duel.html → 新伺服器**：伺服器對前端只多了 `room.result` 一個欄位；舊頁面不讀它、用時鐘判斷——`check_save` 超時局兩邊的 `r.clock` 都是 `[0, ~59970]`，證明舊邏輯在新伺服器上仍算得出輸家。`rec`／`recs`／`room` 訊息的其他欄位沒動。
- **新版 duel.html → 舊伺服器**：`check_save` 用 `JSON.parse` 掛鉤把房間訊息的 `result` 刪掉（＝舊伺服器），新頁面走回退路徑，兩位玩家今日棋局仍對（輸 l／贏 w）。
- **舊紀錄格式**：沒切的紀錄 `full:<id>` 依舊是整個物件；`readFull` 對「不是 chunked」的值原樣回傳（單元測試＋端到端「門檻正常」皆驗）。

## 檢查輸出（完整）

### 1. 語法檢查（check/last-syntax.txt）
```
$ node --input-type=module --check < game/duel-server/worker.js
OK
$ node --check tools/duel_busy.mjs
OK
$ node --check duel.html 的 module script（抽出）
OK
```

### 2. 拆存單元測試 check/check_chunk.mjs
```
  PASS 預設門檻 98304 = 96 KiB
== 門檻附近
  PASS   批次 2 把鍵 ≤ 128
  PASS 小紀錄：不切，一把 full＋一把 rec
  PASS   批次 2 把鍵 ≤ 128
  PASS 剛好等於門檻（98304 bytes）：不切
  PASS   批次 4 把鍵 ≤ 128
  PASS 多 1 byte：切成 2 段
  PASS 多 1 byte：接回相同
== 500 KiB
  PASS   批次 8 把鍵 ≤ 128
  PASS 500 KiB：6 段
  PASS 每段 ≤ 門檻
  PASS 標頭 bytes 512017 = 實際總位元組
  PASS 接回後逐位元組相同
  PASS 標頭有 id、at，另有 rec 摘要鍵
== 多位元組字元（中文、表情符號）
  PASS 中文 門檻 98304：1 段，接回相同、每段不超過
  PASS 中文 門檻 1000：91 段，接回相同、每段不超過
  PASS 中文 門檻 7：15009 段，接回相同、每段不超過
  PASS 中文 門檻 5：30013 段，接回相同、每段不超過
  PASS 中文 門檻 4：30017 段，接回相同、每段不超過
  PASS 中文 門檻 3：30019 段，接回相同（門檻小於 4 byte 的退化情況）
  PASS   批次 128 把鍵 ≤ 128
  PASS   批次 19 把鍵 ≤ 128
  PASS 中文 經 plan→join：145 段，內容相同
  PASS 表情 門檻 98304：2 段，接回相同、每段不超過
  PASS 表情 門檻 1000：106 段，接回相同、每段不超過
  PASS 表情 門檻 7：15011 段，接回相同、每段不超過
  PASS 表情 門檻 5：30013 段，接回相同、每段不超過
  PASS 表情 門檻 4：30017 段，接回相同、每段不超過
  PASS 表情 門檻 3：30019 段，接回相同（門檻小於 4 byte 的退化情況）
  PASS   批次 128 把鍵 ≤ 128
  PASS   批次 43 把鍵 ≤ 128
  PASS 表情 經 plan→join：169 段，內容相同
  PASS 混合 門檻 98304：1 段，接回相同、每段不超過
  PASS 混合 門檻 1000：76 段，接回相同、每段不超過
  PASS 混合 門檻 7：11258 段，接回相同、每段不超過
  PASS 混合 門檻 5：22511 段，接回相同、每段不超過
  PASS 混合 門檻 4：22514 段，接回相同、每段不超過
  PASS 混合 門檻 3：22518 段，接回相同（門檻小於 4 byte 的退化情況）
  PASS   批次 123 把鍵 ≤ 128
  PASS 混合 經 plan→join：121 段，內容相同
  PASS 空字串 → 0 段
== 片段鍵超過一批（> 126 段）
  PASS   批次 128 把鍵 ≤ 128
  PASS   批次 79 把鍵 ≤ 128
  PASS 205 段 → 2 批，標頭與 rec 在最後一批
  PASS 前面批次沒有標頭（標頭出現時片段一定已寫入）
  PASS 分批寫入後接回相同
== 壞資料：回 null、不丟例外
  PASS 測試資料：6 段
  PASS 完整：接得回
  PASS 少最後一段 → null
  PASS 少第一段 → null
  PASS 前兩段順序錯（內容互換）→ null（靠標頭雜湊）
  PASS 一段被改（長度變）→ null
  PASS 一段被改（同位元組數）→ null（靠標頭雜湊）
  PASS 片段不是字串 → null
  PASS 標頭總位元組數不符 → null
  PASS 標頭壞（parts 0／null／缺欄位／非數字）→ null
  PASS 位元組數吻合但 JSON 壞 → null
== Hall.saveRec／readFull（假 storage）
  PASS saveRec 大紀錄：標頭＋片段＋rec 都寫進去（共 10 把鍵）
  PASS readFull 讀回與原物件相同
  PASS readFull 少一段 → null（不丟例外）
  PASS readFull 沒有這一局 → null
  PASS saveRec 小紀錄：只有 full＋rec 兩把鍵，readFull 直接回物件（舊格式）
  PASS readFull 標頭 parts 離譜 → null
  PASS put 失敗 → 再存一次只有 rec，帶 lost: true，沒有 full
  PASS 兩次 put 都失敗 → 不丟例外、console.error 3 次
PASS 65／FAIL 0
```

### 3. 端到端 check/check_save.mjs
```
== 1. 五子棋：先開超時（兩組）與斷線三組，同時跑 60 秒；期間做連五、認輸
  PASS 連五：伺服器有這一局、win=0（黑＝FvA 座位 0）、n=9
  PASS 連五：A 的今日棋局 [{"res":"w","kind":"gomoku","n":9,"note":null,"win":0,"mine":0}]／B 的 [{"res":"l","kind":"gomoku","n":9,"note":null,"win":0,"mine":1}]（贏 w、輸 l）
  PASS 連五：rec 讀得回完整對局（match＋result）
  連五局單筆 rec 訊息大小：956 bytes
  PASS 認輸：伺服器 win=0 note=resign（黑 RsA 贏）
  PASS 認輸：A [{"res":"w","kind":"gomoku","n":3,"note":"resign","win":0,"mine":0}]／B [{"res":"l","kind":"gomoku","n":3,"note":"resign","win":0,"mine":1}]
== 2. VCF 分數到（八仙渡、一線天，頁面玩家）
  PASS 八仙渡：伺服器 win=0 score=[3,1] note=score
  PASS 八仙渡：贏的 [{"res":"w","kind":"vcf","n":"3 : 1","note":"score","win":0,"mine":0}]／輸的 [{"res":"l","kind":"vcf","n":"1 : 3","note":"score","win":0,"mine":1}]
  PASS 一線天：伺服器 win=0 score=[3,0]
  PASS 一線天：贏的 [{"res":"w","kind":"vcf","n":"3 : 0","note":"score","win":0,"mine":0}]／輸的 [{"res":"l","kind":"vcf","n":"0 : 3","note":"score","win":0,"mine":1}]
== 3. 超時、斷線判負（等伺服器判）
  從開始等到三組都判完花了 60 秒（斷線寬限 PLAY_GRACE_MS 60 秒、棋鐘 1 分鐘）
  PASS 超時（新頁面＋新伺服器）：伺服器有這一局、win=1（白＝TmB 贏）、n=4
  PASS 超時（新頁面＋新伺服器）：rec.result = {"winnerSeat":1,"winnerColor":2,"reason":"時間到"}
  超時（新頁面＋新伺服器）：A 頁面超時當下 r.clock=[0,59973] r.result={"winnerSeat":1,"winnerColor":2,"reason":"時間到"}；B 頁面 r.clock=[0,59973]
  PASS 超時（新頁面＋新伺服器）：兩邊收到的 r.clock 都有 ≤ 0 的值（[0,59973]）
  PASS 超時（新頁面＋新伺服器）：黑（TmA）輸 l、白（TmB）贏 w ── [{"res":"l","kind":"gomoku","n":4,"note":null,"win":1,"mine":0}]／[{"res":"w","kind":"gomoku","n":4,"note":null,"win":1,"mine":1}]
  PASS 超時（頁面收不到 result 欄位＝新頁面連舊伺服器）：伺服器有這一局、win=1（白＝TsB 贏）、n=4
  PASS 超時（頁面收不到 result 欄位＝新頁面連舊伺服器）：rec.result = {"winnerSeat":1,"winnerColor":2,"reason":"時間到"}
  超時（頁面收不到 result 欄位＝新頁面連舊伺服器）：A 頁面超時當下 r.clock=[0,59987] r.result="(沒有這個欄位)"；B 頁面 r.clock=[0,59987]
  PASS 超時（頁面收不到 result 欄位＝新頁面連舊伺服器）：兩邊收到的 r.clock 都有 ≤ 0 的值（[0,59987]）
  PASS 超時（頁面收不到 result 欄位＝新頁面連舊伺服器）：黑（TsA）輸 l、白（TsB）贏 w ── [{"res":"l","kind":"gomoku","n":4,"note":null,"win":1,"mine":0}]／[{"res":"w","kind":"gomoku","n":4,"note":null,"win":1,"mine":1}]
  PASS 超時（舊伺服器模擬）：頁面確實沒收到 result 欄位，走的是時鐘回退路徑（＝舊版頁面唯一的做法）
  PASS 新伺服器的房間資料帶 result：{"winnerSeat":1,"winnerColor":2,"reason":"時間到"}
  PASS 斷線判負：伺服器有這一局 win=0（DcA 贏）note=disconnect
  PASS 斷線判負：留在房裡的 A 有存到 [{"res":"w","kind":"gomoku","n":4,"note":"disconnect","win":0,"mine":0}]
  斷線判負：斷線那位（B）判負當下沒連線，今日棋局 []
  斷線那位重連回同一間房後：房間 {"state":"wait","seated":-1}；今日棋局 []
  PASS 斷線判負：重連後補不到（判負時座位已清、房間回等人，收不到 over）——記錄為「補不到」，不修
== 4. 真實大小：一局 rec 訊息（≈ full；少兩個玩家 id、多一個 mine）
  一線天 目標 3 題（輸家解 2）：回看有 5 題，rec ≈ 1396 bytes（1.4 KiB；離 128 KiB 還有 127 KiB）
  一線天 目標 5 題（輸家解 4）：回看有 9 題，rec ≈ 2256 bytes（2.2 KiB；離 128 KiB 還有 126 KiB）
  一線天 目標 10 題（輸家解 9）：回看有 19 題，rec ≈ 4676 bytes（4.6 KiB；離 128 KiB 還有 123 KiB）
  八仙渡 目標 3 題（輸家解 2）：回看有 3 題，rec ≈ 1082 bytes（1.1 KiB；離 128 KiB 還有 127 KiB）
  八仙渡 目標 5 題（輸家解 4）：回看有 5 題，rec ≈ 1709 bytes（1.7 KiB；離 128 KiB 還有 126 KiB）
  八仙渡 目標 10 題（輸家解 9）：回看有 10 題，rec ≈ 3234 bytes（3.2 KiB；離 128 KiB 還有 125 KiB）
  PASS 六種組合都小於 96 KiB 門檻（最大 4676 bytes；seq 用 15 手合成，真人手順約 3–20 手）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  本機 storage（sqlite 檔 9 個）鍵 26 把
  PASS 門檻正常：13 局的 full 都是單一把鍵，沒有 :pN 片段鍵（0）
== 5. FULL_CHUNK_BYTES 調成 600：一般對局被拆存，讀得回、內容相同
  PASS 拆存的五子棋局：recs 清單有它（摘要在 rec:<id>）
  PASS 拆存的五子棋局：rec 讀回的 match／result 與玩家當時收到的房間資料逐字相同
  PASS 拆存的局：玩家今日棋局照常寫入
  PASS 拆存的 VCF 局：review（3 題）與玩家收到的逐字相同
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  （讀不了 _cf_KV：no such table: _cf_KV）
  PASS storage 裡是標頭＋片段：這局五子棋有 2 段（full:1794540680402aurb:p0, full:1794540680402aurb:p1）；全部 full 標頭 2、片段鍵 4
  PASS rec: 摘要鍵獨立存在，recs 清單用 rec: 前綴範圍，不會掃進 full: 片段
== 6. 負向：拆存局少一段
  刪掉 full:1794540680402aurb:p1（sqlite 刪了 1 列）
  PASS 測試手段：成功從 storage 刪掉一段
  PASS 少一段：回 err gone（{"t":"err","code":"gone"}），不是例外
  PASS 少一段：連線還活著（ping → pong）
  PASS 少一段：其他完整的拆存局照常讀得到
  PASS 少一段：清單（rec:）仍列出這一局
  PASS 全程沒有 pageerror／console error（0）
  PASS 伺服器 log 沒有未捕捉例外／存檔失敗（0）
PASS 37／FAIL 0
```

### 4. tools/duel_busy.mjs 本機三種情況＋--wait（check/check_busy.mjs）
```
== 沒有房
    | 線上人數：1（含這次查詢自己 1 位）；房間 0 間
    | 沒有人在對局 → 可以部署
  PASS exit 0
== 有房等人
    | 線上人數：3（含這次查詢自己 1 位）；房間 1 間
    |   房 1562　五子棋　等人　座位 1/2　觀戰 0
    | 沒有人在對局 → 可以部署
  PASS exit 0（線上 3＝A、B、這次查詢）
== 有房對局中
    | 線上人數：3（含這次查詢自己 1 位）；房間 1 間
    |   房 1562　五子棋　對局中　座位 2/2　觀戰 0
    | 有 1 間正在對局／研棋 → 先不要部署
  PASS exit 1
== --wait：另一邊 B 在 25 秒後認輸，對局結束後回 0
    | 線上人數：3（含這次查詢自己 1 位）；房間 1 間
    |   房 1562　五子棋　對局中　座位 2/2　觀戰 0
    | 有 1 間正在對局／研棋 → 先不要部署
    | 20 秒後再查…
    | 線上人數：3（含這次查詢自己 1 位）；房間 1 間
    |   房 1562　五子棋　對局中　座位 2/2　觀戰 0
    | 有 1 間正在對局／研棋 → 先不要部署
    | 20 秒後再查…
    | 線上人數：3（含這次查詢自己 1 位）；房間 1 間
    |   房 1562　五子棋　結束　座位 2/2　觀戰 0
    | 沒有人在對局 → 可以部署
  PASS exit 0、花了 41 秒（每 20 秒查一次，第 2 次才看到結束）
== --wait 逾時：再開一局，--wait 3 應回 1
    | 線上人數：3（含這次查詢自己 1 位）；房間 1 間
    |   房 1562　五子棋　對局中　座位 2/2　觀戰 0
    | 有 1 間正在對局／研棋 → 先不要部署
    | 等了 0 秒，仍有人在對局
  PASS exit 1
== 唯讀：這些查詢沒有改變任何房間
  PASS 房間還是對局中、兩個座位都在
== 連不上
    | 查詢失敗：連不上 ws://127.0.0.1:1/ws
  PASS exit 2
PASS 7／FAIL 0
```

線上唯讀一次（不帶 --wait）：
```
$ node tools/duel_busy.mjs  （線上，唯讀一次）
線上人數：3（含這次查詢自己 1 位）；房間 0 間
沒有人在對局 → 可以部署
exit=0
```

## 真實大小量測（門檻正常、本機伺服器、題庫 rank 1）
一局 `rec` 訊息的 JSON 位元組數（≈ `full`：少兩個玩家 id、多一個 `mine`，差約 ±100 bytes）。輸家解到「目標−1」題＝這個目標下最長的局之一；兩人每題手順用 15 手合成（真人約 3–20 手）。

| 玩法 | 目標題數 | 回看題數 | 大小 | 離 128 KiB |
|---|---|---|---|---|
| 一線天 | 3 | 5 | 1380 B（1.3 KiB） | 127 KiB |
| 一線天 | 5 | 9 | 2322 B（2.3 KiB） | 126 KiB |
| 一線天 | 10 | 19 | 4521 B（4.4 KiB） | 124 KiB |
| 八仙渡 | 3 | 3 | 1106 B（1.1 KiB） | 127 KiB |
| 八仙渡 | 5 | 5 | 1814 B（1.8 KiB） | 126 KiB |
| 八仙渡 | 10 | 10 | 3233 B（3.2 KiB） | 125 KiB |
| 五子棋連五（9 手） | — | — | 956 B | — |

結論：正常對局差 25 倍以上才會碰到 128 KiB；一局要有上千題才會超過 96 KiB 門檻，現實上不會發生。拆存是保險，所以（原先主 session 擔心的）「VCF 題數多時 put 失敗」目前沒有實際風險。

## 沒做到或不確定的事（老實寫）
1. **`lost: true` 的真實 DO put 失敗路徑沒在真的 Durable Object 上觸發過**：正常對局造不出 >128 KiB 的值，所以用假 storage（`check_chunk.mjs` 最後一段，真的 import `worker.js` 的 `Hall`）驗證：第一次 put 丟例外 → 第二次只寫 `rec:<id>` 且 `lost: true`、沒有 `full`；兩次都失敗 → 不丟例外、只 `console.error`。真實的 128 KiB 上限行為只能靠這個模擬。
2. **前端沒有顯示 `lost`**：`lost: true` 的摘要會出現在 `recs` 清單，但點進去（`rec`）會得到 `gone`；前端怎麼呈現沒有改（不在核准範圍）。
3. **斷線判負的那位補不到**（依工單只記錄）：判負後同一個 tick 內座位被清、房間回「等人」，他重連後 `room.state === 'wait'`，收不到 `over`；實測重連後他的今日棋局沒有這一局。留在房裡的對手有存到。
4. **超時局原本就有存到**，沒有找到需要修的 bug；前端改動（用 `r.result`）是強化而非修 bug。超時計時器靠伺服器 `setTimeout`，這次本機測到棋鐘 1 分鐘＋伺服器判負約 60 秒內完成。
5. **端到端沒跑 `NEG=1`**：工單要「負向測試一項」，我做的是「拆存局少一段」（直接從 sqlite 刪掉 `p1`、重啟本機 wrangler 後讀取 → `err gone`、連線還活著、別局照常、清單仍列出）。`check_save.mjs` 另有 `NEG=1` 開關（把「今日棋局有存到」的判斷反過來，預期 FAIL）但這次沒有執行。
6. **合成手順**：大小量測的 `seq` 是 15 手合成，不是真解；真人的手順長度會略有出入，但量級不變。
7. **孤兒片段不清理**（見上「超過 128 把鍵」）。同一局整批 `put` 失敗不會留下片段（單次 `put` 是原子的），只有多批的情況才會。
8. **沒有碰** `game.html`、`game/worker/`、`game/settings.js`、`game/shop.js`；`duel.html` 只改一行（889）；沒有任何 git 操作、沒有部署、沒有連線上伺服器（除 `duel_busy.mjs` 唯讀一次）；沒有用程式名稱關行程，都是 `taskkill /PID <自己啟動的 PID> /T`。
9. 本機測試用的 `python -m http.server 8796`、`wrangler dev 8797` 已由腳本自己關掉；`check/wrangler-*.log` 是 wrangler 輸出，保留供查。
