13:51:15 階段0：建基準快照 temp/vcf-snap-narrow（改動前 duel.html）
13:54:14 階段1：根因＝320 寬標題欄 80px，房號數字寬窄決定換不換行→rhead 56/78→tight 開關跳動（舊版 probe2 16 次出現 1 次 [39,141,242,242]）
13:55:47 階段2：CSS／HTML／setVStatus 已改（自動鈕搬進狀態行、頂列窄螢幕擠空隙、房名 nowrap）；待做 fitTitle
13:58:38 階段3：fitTitle＋語法檢查通過；probe2 新版 20/20 穩定、舊版 4/20 跳 [39,141,242,242]（last-run-old/new-probe.txt）。下一步：矩陣＋check_narrow
13:59:41 階段4：check_narrow.mjs 寫好；矩陣（base 舊版／after 新版）背景跑中
14:09:10 階段5：基準快照缺 vcfscore.*（VCF 房間 vSolve 讀不到）→補檔重跑矩陣（背景）
14:17:25 階段5b：wrangler 抓不到題庫→nobank；env.mjs 改帶 --var BANK_URL＋本機 8791，重啟環境（先前矩陣作廢）
14:18:30 階段6：stab.mjs（重複載入穩定性）寫好，待矩陣跑完後執行
14:37:53 階段7：矩陣 base.json／after.json 各 160 項完成
14:38:11 階段8：矩陣 A 段 144/144 乾淨；C 段差異 8 項＝觀戰手動（舊版頂列有自動鈕）；發現：ja 320 gomoku『直接 320 載入』=242、『375 載入後縮到 320』=302，版面隨歷史不同→查
14:45:00 階段9：check_narrow 169/193 pass，24 項『自動鈕 44×44 點擊範圍』失敗（下緣被棋盤蓋住）→ 鈕加 z-index:1
14:45:19 階段9b：點擊範圍改 ::after -13px/-10px，四角命中；重跑 check_narrow
14:51:08 階段10：check_narrow 193/193 通過；stab.mjs N=10 背景執行（last-run-stab.txt）；接著看截圖
14:51:28 階段10b：截圖發現 en 320 狀態行『Watchin…』看不到是誰→窄螢幕狀態行邊距 16→8、gap 8→4；stab 因 CSS 動到先中止，之後重跑
14:57:39 階段11：新版 320 gomoku 無觀戰者時棋盤 242（舊版常態 296）＝退步→layout() 窄手機兩種都試取棋盤大的
14:58:46 階段12：runall.sh 背景串跑（probe→narrow→matrix→compare→stab），完成寫 runall.done
15:08:18 階段13：check_follow 不改原檔，複製成 check/check_follow_copy.mjs（只把截圖輸出導到 check/follow_shots/），等 stab 跑完（共用 8789）再跑
15:15:52 階段14：先前殘留重複行程（matrix×2、stab）已用 PID 清掉，重開單一 runall.sh 串跑
15:33:54 階段15：負向測試用房號數字決定換不換行（4717 窄數字不換行→偶發 FAIL）→ 改固定『八仙渡 8888』；stab 跑完後重跑 check_narrow
15:40:52 階段16：runall 殘留多條，全部以 PID 清除；改手動單條依序跑（compare→stab→check_narrow）
16:11:07 階段17：stab 新版 64/64 穩定（last-run-stab.txt）；跑舊版 ja,en 320 的 stab 作對照
16:21:43 階段18：env.mjs 的 timeout 7000 到期自己收掉環境（舊版 stab 因此連線被拒），重啟後重跑舊版 stab
16:31:22 階段19：digits.mjs 直接證明根因（舊版 12 個房號 → 2 種版面；新版 1 種）；重跑 check_narrow 最終版
16:37:18 階段20：環境已用 PID 收掉；跑 check_follow_copy
16:44:26 階段21：npx 在這台卡住→check_follow_copy 改直接用 npx 快取內 wrangler 4.158.0（node 直跑）＋本機題庫
16:46:02 階段22：check_follow_copy 因『自動鈕搬到狀態行』調 3 處（量 44×44 命中範圍、.vtxt 內子元素、鈕可能不在 DOM）；重跑
16:48:27 階段23：全部檢查完成，REPORT.md 寫完
