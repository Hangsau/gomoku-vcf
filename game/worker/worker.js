// vcf-game-api：VCF 限時闖關排行榜（Cloudflare Worker＋D1 vcf-game）
// POST /run  交一局成績 → {id, place:{rank:{today,all}}}（結算低於起始段位 demoted=1 不入榜，place 為 null）
// GET  /board?by=rank&scope=today|all → {rows:[...]}；只有一個榜，依能力分 ab 排（段位由 ab 決定，2026-11-07 使用者：段位高的要排前面）
// GET  /admin/runs（Authorization: Bearer <管理密碼>）→ 全部局的段位、能力分、每題作答，不含暱稱（後台用，2026-11-07）
// POST /report {pid, b, w, a, kind, text, run} → 玩家回報某一題有問題（2026-11-07）；GET /blocked → 停用題號清單（遊戲抽題時跳過）
// GET  /admin/reports、POST /admin/report {id, status: open|done|blocked}（Bearer 管理密碼）
// 部署：Cloudflare API（metadata 綁 D1 為 DB）；表結構見 game/worker/schema.sql
const ORDER = {
  rank: "ab DESC, t ASC",
};
// 比這局好的條件＋綁定值（D1 綁定數要剛好等於 ? 數）
const BETTER = {
  rank: (r) => ["ab > ?", [r.ab]],
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
const taipeiDay = (ms) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

async function placeOf(env, by, day, r) {
  const [cond, vals] = BETTER[by](r);
  const sql = `SELECT COUNT(*) AS n FROM runs WHERE demoted = 0 AND solved > 0 ${day ? "AND day = ?" : ""} AND ${cond}`;
  const row = await env.DB.prepare(sql).bind(...(day ? [day] : []), ...vals).first();
  return row.n + 1;
}

async function postRun(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const nick = String(b.nick || "").trim().slice(0, 12);
  const r = {
    start_rank: num(b.startRank, 0, 8), final_rank: num(b.finalRank, 0, 8), ab: num(b.ab, 0, 100000),
    total: num(b.total, 0, 200000), pps: num(b.pps, 0, 500),
    solved: num(b.solved, 0, 500), wrong: num(b.wrong, 0, 3), seconds: num(b.seconds, 0, 20000),
  };
  if (!nick || Object.values(r).some(v => v === null)) return json({ error: "bad fields" }, 400);
  const demoted = b.demoted ? 1 : 0;
  const now = Date.now(), day = taipeiDay(now);
  const detail = JSON.stringify(Array.isArray(b.detail) ? b.detail.slice(0, 200) : []).slice(0, 60000);
  const res = await env.DB.prepare(
    "INSERT INTO runs(t, day, nick, start_rank, final_rank, ab, total, pps, solved, wrong, seconds, demoted, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(now, day, nick, r.start_rank, r.final_rank, r.ab, r.total, r.pps, r.solved, r.wrong, r.seconds, demoted, detail).run();
  const id = res.meta.last_row_id;
  if (demoted || !r.solved) return json({ id, day, place: null });   // 一題都沒解開＝沒證明任何段位，不入榜
  const place = {};
  for (const by of Object.keys(ORDER)) place[by] = { today: await placeOf(env, by, day, r), all: await placeOf(env, by, null, r) };
  return json({ id, day, place });
}

async function getBoard(url, env) {
  const by = ORDER[url.searchParams.get("by")] ? url.searchParams.get("by") : "rank";
  const today = url.searchParams.get("scope") !== "all";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const day = taipeiDay(Date.now());
  const sql = `SELECT id, nick, start_rank, final_rank, ab, total, pps, solved, t FROM runs WHERE demoted = 0 AND solved > 0 ${today ? "AND day = ?1" : ""} ORDER BY ${ORDER[by]} LIMIT ${limit}`;
  const st = env.DB.prepare(sql);
  const { results } = await (today ? st.bind(day) : st).all();
  return json({ by, scope: today ? "today" : "all", day, rows: results });
}

// 管理密碼只存在本機（vcf-slover out/hub/game_admin_key.txt，不進 git）；這裡只放它的 SHA-256，原始碼公開也不會洩漏
const ADMIN_SHA256 = "0cc43f370d482a384f677854da7d68de26ac8db518bb7aa3934ca3bd09165356";
async function isAdmin(req) {
  const k = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");
  if (!k) return false;
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k)))].map(b => b.toString(16).padStart(2, "0")).join("");
  return h === ADMIN_SHA256;
}
async function adminRuns(req, env) {
  if (!(await isAdmin(req))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, day, start_rank, final_rank, ab, solved, wrong, seconds, demoted, detail FROM runs ORDER BY id").all();
  return json({ rows: results });
}

const KINDS = ["answer", "unfair", "other"];
async function postReport(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const pid = String(b.pid || "").replace(/[^0-9A-Z]/g, "").slice(0, 12);
  const kind = KINDS.includes(b.kind) ? b.kind : "other";
  const text = String(b.text || "").slice(0, 300);
  const black = String(b.b || "").slice(0, 400), white = String(b.w || "").slice(0, 400), atk = b.a === "w" ? "w" : "b";
  if (!pid || !black) return json({ error: "bad fields" }, 400);
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE pid = ? AND t > ?").bind(pid, now - 60000).first();
  if (recent.n >= 5) return json({ error: "too many" }, 429);
  const r = await env.DB.prepare("INSERT INTO reports(t, pid, black, white, atk, kind, text, run, status) VALUES (?,?,?,?,?,?,?,?, 'open')")
    .bind(now, pid, black, white, atk, kind, text, Number(b.run) || null).run();
  return json({ ok: true, id: r.meta.last_row_id });
}
async function getBlocked(env) {
  const { results } = await env.DB.prepare("SELECT DISTINCT pid FROM reports WHERE status = 'blocked'").all();
  return new Response(JSON.stringify({ ids: results.map(r => r.pid) }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "max-age=60", ...cors } });
}
async function adminReports(req, env) {
  if (!(await isAdmin(req))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, pid, black, white, atk, kind, text, run, status FROM reports ORDER BY id DESC LIMIT 300").all();
  return json({ rows: results });
}
async function adminSetReport(req, env) {
  if (!(await isAdmin(req))) return json({ error: "forbidden" }, 403);
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const st = ["open", "done", "blocked"].includes(b.status) ? b.status : null;
  if (!st || !b.pid) return json({ error: "bad fields" }, 400);
  const r = await env.DB.prepare("UPDATE reports SET status = ? WHERE pid = ?").bind(st, String(b.pid)).run();   // 同一題的所有回報一起改
  if (!r.meta.changes && st === "blocked" && b.b)   // 沒人回報過、後台直接停用（從作答統計那裡）：記一筆
    await env.DB.prepare("INSERT INTO reports(t, pid, black, white, atk, kind, text, status) VALUES (?,?,?,?,?, 'other', '後台直接停用', 'blocked')")
      .bind(Date.now(), String(b.pid), String(b.b), String(b.w || ""), b.a === "w" ? "w" : "b").run();
  return json({ ok: true });
}

async function getRun(id, env) {
  const row = await env.DB.prepare("SELECT id, nick, start_rank, final_rank, ab, total, pps, solved, wrong, seconds, demoted, detail, t FROM runs WHERE id = ?1").bind(id).first();
  return row ? json(row) : json({ error: "not found" }, 404);
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    try {
      if (req.method === "POST" && url.pathname === "/run") return await postRun(req, env);
      if (req.method === "GET" && url.pathname === "/board") return await getBoard(url, env);
      if (req.method === "GET" && url.pathname === "/admin/runs") return await adminRuns(req, env);
      if (req.method === "POST" && url.pathname === "/report") return await postReport(req, env);
      if (req.method === "GET" && url.pathname === "/blocked") return await getBlocked(env);
      if (req.method === "GET" && url.pathname === "/admin/reports") return await adminReports(req, env);
      if (req.method === "POST" && url.pathname === "/admin/report") return await adminSetReport(req, env);
      const m = url.pathname.match(/^\/run\/(\d+)$/);
      if (req.method === "GET" && m) return await getRun(Number(m[1]), env);
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server", message: String(e && e.message || e) }, 500);
    }
  },
};
