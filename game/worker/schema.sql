-- D1 資料庫 vcf-game（uuid 3d55c6af-334c-4b80-99e2-29d951aa77d3）
CREATE TABLE IF NOT EXISTS runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL,
  nick TEXT NOT NULL, start_rank INTEGER NOT NULL, final_rank INTEGER NOT NULL, ab REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL, pps REAL NOT NULL, solved INTEGER NOT NULL, wrong INTEGER NOT NULL,
  seconds REAL NOT NULL, demoted INTEGER NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS runs_ab ON runs(demoted, ab DESC);
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
