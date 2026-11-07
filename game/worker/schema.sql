-- D1 資料庫 vcf-game（uuid 3d55c6af-334c-4b80-99e2-29d951aa77d3）
CREATE TABLE IF NOT EXISTS runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, day TEXT NOT NULL,
  nick TEXT NOT NULL, start_rank INTEGER NOT NULL, final_rank INTEGER NOT NULL,
  total REAL NOT NULL, pps REAL NOT NULL, solved INTEGER NOT NULL, wrong INTEGER NOT NULL,
  seconds REAL NOT NULL, demoted INTEGER NOT NULL, detail TEXT);
CREATE INDEX IF NOT EXISTS runs_rank ON runs(demoted, final_rank DESC, total DESC);
CREATE INDEX IF NOT EXISTS runs_total ON runs(demoted, total DESC);
CREATE INDEX IF NOT EXISTS runs_pps ON runs(demoted, pps DESC);
CREATE INDEX IF NOT EXISTS runs_day ON runs(day);
