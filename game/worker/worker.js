// vcf-game-api：VCF 限時闖關排行榜（Cloudflare Worker＋D1 vcf-game）
// POST /run  交一局成績 → {id, place:{rank,total,pps}}（沒守住起始段位 demoted=1 不入榜，place 為 null）
// GET  /board?by=rank|total|pps&scope=today|all → {rows:[...]}
// 部署：Cloudflare API（metadata 綁 D1 為 DB）；表結構見 game/worker/schema.sql
const ORDER = {
  rank: "final_rank DESC, total DESC, t ASC",
  total: "total DESC, t ASC",
  pps: "pps DESC, t ASC",
};
// 比這局好的條件＋綁定值（D1 綁定數要剛好等於 ? 數）
const BETTER = {
  rank: (r) => ["(final_rank > ? OR (final_rank = ? AND total > ?))", [r.final_rank, r.final_rank, r.total]],
  total: (r) => ["total > ?", [r.total]],
  pps: (r) => ["pps > ?", [r.pps]],
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
const taipeiDay = (ms) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

async function placeOf(env, by, day, r) {
  const [cond, vals] = BETTER[by](r);
  const sql = `SELECT COUNT(*) AS n FROM runs WHERE demoted = 0 ${day ? "AND day = ?" : ""} AND ${cond}`;
  const row = await env.DB.prepare(sql).bind(...(day ? [day] : []), ...vals).first();
  return row.n + 1;
}

async function postRun(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const nick = String(b.nick || "").trim().slice(0, 12);
  const r = {
    start_rank: num(b.startRank, 0, 8), final_rank: num(b.finalRank, 0, 8),
    total: num(b.total, 0, 200000), pps: num(b.pps, 0, 500),
    solved: num(b.solved, 0, 500), wrong: num(b.wrong, 0, 3), seconds: num(b.seconds, 0, 20000),
  };
  if (!nick || Object.values(r).some(v => v === null)) return json({ error: "bad fields" }, 400);
  const demoted = b.demoted ? 1 : 0;
  const now = Date.now(), day = taipeiDay(now);
  const detail = JSON.stringify(Array.isArray(b.detail) ? b.detail.slice(0, 200) : []).slice(0, 60000);
  const res = await env.DB.prepare(
    "INSERT INTO runs(t, day, nick, start_rank, final_rank, total, pps, solved, wrong, seconds, demoted, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(now, day, nick, r.start_rank, r.final_rank, r.total, r.pps, r.solved, r.wrong, r.seconds, demoted, detail).run();
  const id = res.meta.last_row_id;
  if (demoted) return json({ id, day, place: null });
  const place = {};
  for (const by of Object.keys(ORDER)) place[by] = { today: await placeOf(env, by, day, r), all: await placeOf(env, by, null, r) };
  return json({ id, day, place });
}

async function getBoard(url, env) {
  const by = ORDER[url.searchParams.get("by")] ? url.searchParams.get("by") : "rank";
  const today = url.searchParams.get("scope") !== "all";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const day = taipeiDay(Date.now());
  const sql = `SELECT id, nick, start_rank, final_rank, total, pps, solved, t FROM runs WHERE demoted = 0 ${today ? "AND day = ?1" : ""} ORDER BY ${ORDER[by]} LIMIT ${limit}`;
  const st = env.DB.prepare(sql);
  const { results } = await (today ? st.bind(day) : st).all();
  return json({ by, scope: today ? "today" : "all", day, rows: results });
}

async function getRun(id, env) {
  const row = await env.DB.prepare("SELECT id, nick, start_rank, final_rank, total, pps, solved, wrong, seconds, demoted, detail, t FROM runs WHERE id = ?1").bind(id).first();
  return row ? json(row) : json({ error: "not found" }, 404);
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    try {
      if (req.method === "POST" && url.pathname === "/run") return await postRun(req, env);
      if (req.method === "GET" && url.pathname === "/board") return await getBoard(url, env);
      const m = url.pathname.match(/^\/run\/(\d+)$/);
      if (req.method === "GET" && m) return await getRun(Number(m[1]), env);
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server", message: String(e && e.message || e) }, 500);
    }
  },
};
