A 完成：worker.js 拆存（planFullPuts/joinFull/saveRec/readFull）
B 前端：recordToday 優先用 r.result（伺服器新增欄位），沒有才回退時鐘；伺服器 roomMsg 加 result
C 完成：tools/duel_busy.mjs 寫好（待本機驗證）
check_chunk.mjs 寫好並跑（退化門檻<4byte 修了一個切壞表情符號的 bug）
check_save.mjs 寫好，開始跑
check_save：功能面全過，修 storage 讀法（_cf_KV）後重跑
check_busy 7 項過；check_save 37 項過；剩線上唯讀一次、語法檢查、REPORT
REPORT.md 完成（全部階段完成）
