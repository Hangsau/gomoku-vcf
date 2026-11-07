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
