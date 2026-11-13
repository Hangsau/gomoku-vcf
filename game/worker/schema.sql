-- D1 資料庫 vcf-game（uuid 3d55c6af-334c-4b80-99e2-29d951aa77d3）
CREATE TABLE IF NOT EXISTS runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL,
  nick TEXT NOT NULL, start_rank INTEGER NOT NULL, final_rank INTEGER NOT NULL, ab REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL, pps REAL NOT NULL, solved INTEGER NOT NULL, wrong INTEGER NOT NULL,
  seconds REAL NOT NULL, demoted INTEGER NOT NULL, detail TEXT, ver TEXT NOT NULL DEFAULT '2026-11-07');
CREATE INDEX IF NOT EXISTS runs_ab ON runs(demoted, ab DESC);
-- 2026-11-08 加 ver（評分版本）：ALTER TABLE runs ADD COLUMN ver TEXT NOT NULL DEFAULT '2026-11-07'；排行榜只排 worker.js CUR_VER 那一版
-- 2026-11-07 加 ab：ALTER TABLE runs ADD COLUMN ab REAL NOT NULL DEFAULT 0；舊局由 detail 回推（起始能力分＋每題變化）
CREATE INDEX IF NOT EXISTS runs_total ON runs(demoted, total DESC);
CREATE INDEX IF NOT EXISTS runs_pps ON runs(demoted, pps DESC);
CREATE INDEX IF NOT EXISTS runs_day ON runs(day);

-- 2026-11-07：玩家回報題目問題；status open／done／blocked（blocked＝停用，遊戲不再出、匯出也排除）
CREATE TABLE IF NOT EXISTS reports(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, pid TEXT NOT NULL, black TEXT, white TEXT, atk TEXT,
  kind TEXT, text TEXT, run INTEGER, status TEXT NOT NULL DEFAULT 'open');
CREATE INDEX IF NOT EXISTS reports_pid ON reports(pid);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status);

-- 2026-11-08：玩家給作者留言；status open／done；contact 是玩家自願填的聯絡方式（個資，只在後台顯示）
CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, text TEXT NOT NULL, contact TEXT, nick TEXT, lang TEXT,
  status TEXT NOT NULL DEFAULT 'open');
CREATE INDEX IF NOT EXISTS feedback_t ON feedback(t);

-- 2026-11-08：練習場（不上排行）。minutes 0＝不限時；added／added_sec＝加時次數／秒數；own＝自己解開、helped＝靠悔棋／提示／下錯後解開；
-- detail 每題比競速多 h（用過幫助）、u（悔棋次數）、hi（提示次數）、mk（下錯次數）；wk 'quit'＝按結束時沒做完的題（不扣分）
CREATE TABLE IF NOT EXISTS practice(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL, nick TEXT, lang TEXT,
  start_rank INTEGER NOT NULL, final_rank INTEGER NOT NULL, ab REAL NOT NULL, minutes INTEGER NOT NULL,
  added INTEGER NOT NULL, added_sec INTEGER NOT NULL, own INTEGER NOT NULL, helped INTEGER NOT NULL, wrong INTEGER NOT NULL,
  seconds REAL NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS practice_t ON practice(t);

-- 2026-11-08：4 手無限（只出 4 手題、60 秒＋每題 20 秒、錯 3 題結束）；分數＝total（解開題目的單手分數＝題目分÷手數，加總），同分 seconds 小的在前；detail 每題作答（跟 runs 同格式，e 一律 0）
CREATE TABLE IF NOT EXISTS blitz(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL, nick TEXT NOT NULL, lang TEXT,
  total REAL NOT NULL, solved INTEGER NOT NULL, wrong INTEGER NOT NULL, seconds REAL NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS blitz_rank ON blitz(total DESC, seconds ASC);
CREATE INDEX IF NOT EXISTS blitz_day ON blitz(day);

-- 2026-11-09：象牙塔。tower_days＝每天 100 題（當天第一次有人要題目時 Worker 自己從 tower_pool 排；puzzles 是 JSON 陣列，每題跟題庫同格式 [黑, 白, 手數, 題目分, 攻方, 題號]）
CREATE TABLE IF NOT EXISTS tower_days(day TEXT PRIMARY KEY, puzzles TEXT NOT NULL, t INTEGER NOT NULL);
-- tower＝每人每天一列（vid＝瀏覽器隨機 ID，只有第一輪算）。n＝已交幾題（下一題的索引）；open_i／open_t＝目前這題開題時間（伺服器記時；open_t < 0＝暫停中，−open_t＝已用毫秒，2026-11-09）；
-- score＝解開題目的題目分÷10 加總；iph＝IP＋日期的雜湊（只給後台看分身，不擋人）；detail 每題 {i,id,s,ok,sec,hi,u,wk,m}
CREATE TABLE IF NOT EXISTS tower(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, tu INTEGER NOT NULL, day TEXT NOT NULL, vid TEXT NOT NULL,
  nick TEXT NOT NULL, lang TEXT, iph TEXT, n INTEGER NOT NULL DEFAULT 0, score REAL NOT NULL DEFAULT 0,
  solved INTEGER NOT NULL DEFAULT 0, wrong INTEGER NOT NULL DEFAULT 0, hints INTEGER NOT NULL DEFAULT 0, seconds REAL NOT NULL DEFAULT 0,
  open_i INTEGER NOT NULL DEFAULT -1, open_t INTEGER NOT NULL DEFAULT 0, ended INTEGER NOT NULL DEFAULT 0, detail TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS tower_dayvid ON tower(day, vid);
CREATE INDEX IF NOT EXISTS tower_rank ON tower(day, score DESC);
-- tower_pool＝出題候選（tools/tower_pool.py 從題庫 game/p/1..10.json 載入；dan＝題庫檔號 1 初段..10 傳說；p＝題目 JSON）
CREATE TABLE IF NOT EXISTS tower_pool(id TEXT PRIMARY KEY, dan INTEGER NOT NULL, score REAL NOT NULL, white INTEGER NOT NULL, p TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS tower_pool_dan ON tower_pool(dan, score);
-- tower_used＝哪題哪天出過（90 天內不重複用）
CREATE TABLE IF NOT EXISTS tower_used(id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(id, day));
CREATE INDEX IF NOT EXISTS tower_used_day ON tower_used(day);

-- 2026-11-10：明鏡台（落第一手才計時、起始 5 秒＋每手 1 秒、錯 3 題結束、可退出）。inf 1＝無限（初段起、上排行）、0＝分級（start_rank 固定，不排名）；
-- total＝解開題目的（題目分＋題目分×10%×剩餘整秒數）加總；seconds＝開錶後用時；think＝落第一手前想的時間加總；quit 1＝按退出結束；detail 每題多 th（想幾秒）、lf（剩幾秒）、pts
CREATE TABLE IF NOT EXISTS mirror(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL, nick TEXT NOT NULL, lang TEXT, inf INTEGER NOT NULL,
  start_rank INTEGER NOT NULL, top_rank INTEGER NOT NULL, total REAL NOT NULL, solved INTEGER NOT NULL, wrong INTEGER NOT NULL,
  seconds REAL NOT NULL, think REAL NOT NULL, quit INTEGER NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS mirror_rank ON mirror(inf, total DESC, seconds ASC);
CREATE INDEX IF NOT EXISTS mirror_day ON mirror(day);

-- 2026-11-10：火眼金睛（只出 4 手勝的題、一題 8 秒、只看第一手、錯 3 題結束）；total＝解開題目的（題目分×(1＋剩餘秒數÷8)）加總，同分 seconds 小的在前；detail 每題作答（e 一律 0，另有 lf 剩幾秒、pts 得分；wk 'eyx'＝第一手不是解、wa＝正解第一手）
CREATE TABLE IF NOT EXISTS eye(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL, nick TEXT NOT NULL, lang TEXT,
  total REAL NOT NULL, solved INTEGER NOT NULL, wrong INTEGER NOT NULL, seconds REAL NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS eye_rank ON eye(total DESC, seconds ASC);
CREATE INDEX IF NOT EXISTS eye_day ON eye(day);

-- 2026-11-11：新手教學進度（使用者：後台看走完度、停在哪幾關）。vid＝瀏覽器隨機 ID（跟 tower 同一個）；ev＝open／opening／step／done／exam／grad；l＝課號（例 3-2）；s＝第幾步（從 0 起）
CREATE TABLE IF NOT EXISTS learn(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL, vid TEXT NOT NULL, ev TEXT NOT NULL, l TEXT NOT NULL DEFAULT '', s INTEGER NOT NULL DEFAULT 0, lang TEXT);
CREATE INDEX IF NOT EXISTS learn_vid_day ON learn(vid, day);

-- 全站設定（2026-11-12）：k='skins_off' → {"boards":[…],"stones":[…]}，後台關閉的棋盤與棋子
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL);

-- 商店擁有紀錄（2026-11-13）：vid 匿名編號、item 'b:<棋盤id>' 或 's:<棋子id>'、price 當時價格（免費期 0）、src 來源（'free' 免費領取／'grand' 上線前已在用）
CREATE TABLE IF NOT EXISTS owned(vid TEXT NOT NULL, item TEXT NOT NULL, t INTEGER NOT NULL, price INTEGER NOT NULL DEFAULT 0, src TEXT NOT NULL DEFAULT 'free', PRIMARY KEY(vid, item));

-- 通知訂閱（2026-11-13）：pid 玩家匿名編號、endpoint 推播端點（每個裝置一個）、p256dh／auth 加密用、ua 裝置字串（除錯）
CREATE TABLE IF NOT EXISTS push_subs(endpoint TEXT PRIMARY KEY, pid TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, ua TEXT, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS push_subs_pid ON push_subs(pid);
