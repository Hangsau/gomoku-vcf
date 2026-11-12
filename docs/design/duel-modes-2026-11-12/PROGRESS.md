# PROGRESS（2026-11-12 施工紀錄）

- [x] 讀 duel.md、89443e3 前後差異（舊搶答版沒有放棄鈕）
- [x] vcf.js：`vmode` 設定檢查（預設 eight、不認得的值拒絕）、`phase`／`rv`／`seq`、`REVEAL_MS`
- [x] worker.js：`vcfFinish` 分支 `vcfLineStep`（一線天換題）、`vskip` 在一線天忽略、`vprog` 帶 `seq`
- [x] duel.html：開房表單玩法選項、房間卡片／標題顯示玩法名稱、一線天公開解法與狀態字樣、四語字串
- [x] 檢查腳本 `check/run.mjs`（t1 一線天、t2 八仙渡、t3 舊客戶端、t4 版面、t5 五子棋）→ 217 PASS／0 FAIL
- [x] docs/duel.md VCF 一節改寫
- [x] 關掉自己開的 http.server（8793）、wrangler dev（8789），`.dev.vars` 還原
- [x] REPORT.md
