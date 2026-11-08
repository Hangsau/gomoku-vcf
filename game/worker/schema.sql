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
