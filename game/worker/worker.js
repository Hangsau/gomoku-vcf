// vcf-game-api：VCF 限時闖關排行榜（Cloudflare Worker＋D1 vcf-game）
// POST /run  交一局成績 → {id, place:{rank:{today,all}}}（結算低於起始段位 demoted=1 不入榜，place 為 null）
// GET  /board?by=rank&scope=today|all → {rows:[...]}；只有一個榜，依能力分 ab 排（段位由 ab 決定，2026-11-07 使用者：段位高的要排前面）
// GET  /admin/runs（Authorization: Bearer <管理密碼>）→ 全部局的段位、能力分、每題作答、評分版本 ver，不含暱稱（後台用，2026-11-07）
// GET  /admin/scoring → 計分看板資料（2026-11-08）；排行榜只排評分版本 CUR_VER 的局
// POST /report {pid, b, w, a, kind, text, run} → 玩家回報某一題有問題（2026-11-07）；GET /blocked → 停用題號清單（遊戲抽題時跳過）
// GET  /admin/reports、POST /admin/report {id, status: open|done|blocked}（Bearer 管理密碼）
// POST /feedback {text, contact, nick, lang} → 玩家給作者留言（2026-11-08）；GET /admin/feedback、POST /admin/feedback {id, status: open|done}
// POST /practice 練習場一局（2026-11-08，不上排行，另存 practice 表）；GET /admin/practice（Bearer／Access）
// POST /blitz 4 手無限一局（2026-11-08）→ {id, place:{today,all}}；GET /board?by=b4 → 4 手無限排行（分數＝解開題目的單手分數〔題目分÷手數〕加總，同分用時短的在前）；GET /admin/blitz
// GET  /admin → 手機後台頁（留言＋回報）。只在 rush.hangsau.app/admin* 這條 route 上有效，前面擋 Cloudflare Access（email 驗證碼），
//      Worker 再驗 Access 的 JWT（env.ACCESS_TEAM、env.ACCESS_AUD），沒設或驗不過一律 403；workers.dev 上的 /admin/* 照舊只認 Bearer 管理密碼
// 部署：Cloudflare API（metadata 綁 D1 為 DB）；表結構見 game/worker/schema.sql
// 後台頁：game/worker/admin.html，部署時以 text 模組一起上傳（tools/deploy_worker.sh）
import ADMIN_HTML from "./admin.html";
import SCORING_JSON from "./scoring.json.txt";   // 計分看板資料（vcf-slover engine/scoring_eval.py 產生，部署時一起上傳；後台「計分」分頁讀 /admin/scoring）
// 評分版本（2026-11-08 使用者：全面換新評分）：排行榜只排這一版的局；舊版的局還在表裡（ver 欄），不刪
const CUR_VER = "2026-11-08b";

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
  const sql = `SELECT COUNT(*) AS n FROM runs WHERE demoted = 0 AND solved > 0 AND ver = ? ${day ? "AND day = ?" : ""} AND ${cond}`;
  const row = await env.DB.prepare(sql).bind(CUR_VER, ...(day ? [day] : []), ...vals).first();
  return row.n + 1;
}

async function postRun(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const nick = String(b.nick || "").trim().slice(0, 12);
  const r = {
    start_rank: num(b.startRank, 0, 10), final_rank: num(b.finalRank, 0, 10), ab: num(b.ab, 0, 1000000),
    total: num(b.total, 0, 200000), pps: num(b.pps, 0, 500),
    solved: num(b.solved, 0, 500), wrong: num(b.wrong, 0, 3), seconds: num(b.seconds, 0, 20000),
  };
  if (!nick || Object.values(r).some(v => v === null)) return json({ error: "bad fields" }, 400);
  const demoted = b.demoted ? 1 : 0;
  const ver = String(b.ver || "").replace(/[^0-9a-z-]/g, "").slice(0, 20) || "2026-11-07";   // 舊版遊戲沒送 ver
  const now = Date.now(), day = taipeiDay(now);
  const detail = JSON.stringify(Array.isArray(b.detail) ? b.detail.slice(0, 200) : []).slice(0, 60000);
  const res = await env.DB.prepare(
    "INSERT INTO runs(t, day, nick, start_rank, final_rank, ab, total, pps, solved, wrong, seconds, demoted, detail, ver) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(now, day, nick, r.start_rank, r.final_rank, r.ab, r.total, r.pps, r.solved, r.wrong, r.seconds, demoted, detail, ver).run();
  const id = res.meta.last_row_id;
  if (demoted || !r.solved || ver !== CUR_VER) return json({ id, day, place: null });   // 一題都沒解開＝沒證明任何段位，不入榜
  const place = {};
  for (const by of Object.keys(ORDER)) place[by] = { today: await placeOf(env, by, day, r), all: await placeOf(env, by, null, r) };
  return json({ id, day, place });
}

// 4 手無限（2026-11-08 使用者：4 手 VCF、1 分鐘、答對 +20 秒、錯 3 題結束、只算分數、有排名）：獨立的 blitz 表
async function postBlitz(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const nick = String(b.nick || "").trim().slice(0, 12), lang = String(b.lang || "").slice(0, 5);
  const solved = num(b.solved, 0, 1000), wrong = num(b.wrong, 0, 3), seconds = num(b.seconds, 0, 20000), total = num(b.total, 0, 1000000);
  if (!nick || solved === null || wrong === null || seconds === null || total === null) return json({ error: "bad fields" }, 400);
  if (total > solved * 120) return json({ error: "bad total" }, 400);   // 單手分數＝題目分÷4，4 手題最高約 100
  if (seconds > 60 + 20 * solved + 5) return json({ error: "bad time" }, 400);   // 60 秒＋每題 20 秒是上限
  const now = Date.now(), day = taipeiDay(now);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM blitz WHERE t > ?").bind(now - 60000).first();
  if (recent.n >= 60) return json({ error: "too many" }, 429);
  const detail = JSON.stringify(Array.isArray(b.detail) ? b.detail.slice(0, 1000) : []).slice(0, 200000);
  const res = await env.DB.prepare("INSERT INTO blitz(t, day, nick, lang, total, solved, wrong, seconds, detail) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(now, day, nick, lang, total, solved, wrong, seconds, detail).run();
  const id = res.meta.last_row_id;
  if (!solved) return json({ id, day, place: null });
  const better = "solved > 0 AND (total > ? OR (total = ? AND seconds < ?))";
  const today = await env.DB.prepare(`SELECT COUNT(*) AS n FROM blitz WHERE day = ? AND ${better}`).bind(day, total, total, seconds).first();
  const all = await env.DB.prepare(`SELECT COUNT(*) AS n FROM blitz WHERE ${better}`).bind(total, total, seconds).first();
  return json({ id, day, place: { today: today.n + 1, all: all.n + 1 } });
}
async function getBlitzBoard(url, env) {
  const today = url.searchParams.get("scope") !== "all";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const day = taipeiDay(Date.now());
  const st = env.DB.prepare(`SELECT id, nick, total, solved, wrong, seconds, t FROM blitz WHERE solved > 0 ${today ? "AND day = ?1" : ""} ORDER BY total DESC, seconds ASC, t ASC LIMIT ${limit}`);
  const { results } = await (today ? st.bind(day) : st).all();
  return json({ by: "b4", scope: today ? "today" : "all", day, rows: results });
}
async function adminBlitz(req, env) {
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, day, lang, total, solved, wrong, seconds, detail FROM blitz ORDER BY id").all();
  return json({ rows: results });
}

async function getBoard(url, env) {
  if (url.searchParams.get("by") === "b4") return getBlitzBoard(url, env);
  const by = ORDER[url.searchParams.get("by")] ? url.searchParams.get("by") : "rank";
  const today = url.searchParams.get("scope") !== "all";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const day = taipeiDay(Date.now());
  const sql = `SELECT id, nick, start_rank, final_rank, ab, total, pps, solved, t FROM runs WHERE demoted = 0 AND solved > 0 AND ver = ?1 ${today ? "AND day = ?2" : ""} ORDER BY ${ORDER[by]} LIMIT ${limit}`;
  const st = env.DB.prepare(sql);
  const { results } = await (today ? st.bind(CUR_VER, day) : st.bind(CUR_VER)).all();
  return json({ by, scope: today ? "today" : "all", day, ver: CUR_VER, rows: results });
}

// 管理密碼只存在本機（vcf-slover out/hub/game_admin_key.txt，不進 git）；這裡只放它的 SHA-256，原始碼公開也不會洩漏
const ADMIN_SHA256 = "0cc43f370d482a384f677854da7d68de26ac8db518bb7aa3934ca3bd09165356";
async function isAdmin(req, env) {
  const k = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");
  if (k) {
    const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k)))].map(b => b.toString(16).padStart(2, "0")).join("");
    if (h === ADMIN_SHA256) return true;
  }
  return accessOk(req, env);
}
// Cloudflare Access 的 JWT（Cf-Access-Jwt-Assertion）：檢查簽章（team 的公鑰）、iss、aud、到期。沒設定 ACCESS_TEAM／ACCESS_AUD 就一律不過。
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
async function accessOk(req, env) {
  try {
    if (!env || !env.ACCESS_TEAM || !env.ACCESS_AUD) return false;
    const tok = req.headers.get("Cf-Access-Jwt-Assertion");
    if (!tok) return false;
    const [h, p, sig] = tok.split(".");
    if (!h || !p || !sig) return false;
    const header = JSON.parse(new TextDecoder().decode(b64u(h))), body = JSON.parse(new TextDecoder().decode(b64u(p)));
    const iss = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
    const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
    if (body.iss !== iss || !aud.includes(env.ACCESS_AUD) || !body.exp || body.exp * 1000 < Date.now()) return false;
    const certs = await (await fetch(iss + "/cdn-cgi/access/certs", { cf: { cacheTtl: 3600 } })).json();
    const jwk = (certs.keys || []).find(x => x.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
  } catch { return false; }
}
async function adminRuns(req, env) {
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, day, start_rank, final_rank, ab, solved, wrong, seconds, demoted, detail, ver FROM runs ORDER BY id").all();
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
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, pid, black, white, atk, kind, text, run, status FROM reports ORDER BY id DESC LIMIT 300").all();
  return json({ rows: results });
}
async function adminSetReport(req, env) {
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
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

// 玩家留言（2026-11-08）：全站每分鐘最多 20 則，防灌；聯絡方式是個資，只在後台顯示
async function postFeedback(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const text = String(b.text || "").trim().slice(0, 500);
  if (!text) return json({ error: "empty" }, 400);
  const contact = String(b.contact || "").trim().slice(0, 100), nick = String(b.nick || "").trim().slice(0, 20), lang = String(b.lang || "").slice(0, 5);
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE t > ?").bind(now - 60000).first();
  if (recent.n >= 20) return json({ error: "too many" }, 429);
  const r = await env.DB.prepare("INSERT INTO feedback(t, text, contact, nick, lang, status) VALUES (?,?,?,?,?, 'open')").bind(now, text, contact, nick, lang).run();
  return json({ ok: true, id: r.meta.last_row_id });
}
async function adminFeedback(req, env) {
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, text, contact, nick, lang, status FROM feedback ORDER BY id DESC LIMIT 300").all();
  return json({ rows: results });
}
async function adminSetFeedback(req, env) {
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const st = ["open", "done"].includes(b.status) ? b.status : null, id = Number(b.id);
  if (!st || !Number.isInteger(id)) return json({ error: "bad fields" }, 400);
  await env.DB.prepare("UPDATE feedback SET status = ? WHERE id = ?").bind(st, id).run();
  return json({ ok: true });
}
// 練習場（2026-11-08 使用者：練習作答也送後台，分開分析大家怎麼練）：跟 /run 不同表，排行榜永遠讀不到；全站每分鐘最多 60 局防灌
async function postPractice(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const r = {
    start_rank: num(b.startRank, 0, 10), final_rank: num(b.finalRank, 0, 10), ab: num(b.ab, 0, 1000000), minutes: num(b.minutes, 0, 60),
    added: num(b.added, 0, 1000), added_sec: num(b.addedSec, 0, 100000), own: num(b.own, 0, 1000), helped: num(b.helped, 0, 1000),
    wrong: num(b.wrong, 0, 1000), seconds: num(b.seconds, 0, 100000),
  };
  if (Object.values(r).some(v => v === null)) return json({ error: "bad fields" }, 400);
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM practice WHERE t > ?").bind(now - 60000).first();
  if (recent.n >= 60) return json({ error: "too many" }, 429);
  const nick = String(b.nick || "").trim().slice(0, 12), lang = String(b.lang || "").slice(0, 5);
  const detail = JSON.stringify(Array.isArray(b.detail) ? b.detail.slice(0, 300) : []).slice(0, 90000);
  const res = await env.DB.prepare(
    "INSERT INTO practice(t, day, nick, lang, start_rank, final_rank, ab, minutes, added, added_sec, own, helped, wrong, seconds, detail) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(now, taipeiDay(now), nick, lang, r.start_rank, r.final_rank, r.ab, r.minutes, r.added, r.added_sec, r.own, r.helped, r.wrong, r.seconds, detail).run();
  return json({ ok: true, id: res.meta.last_row_id });
}
async function adminPractice(req, env) {
  if (!(await isAdmin(req, env))) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id, t, day, lang, start_rank, final_rank, ab, minutes, added, added_sec, own, helped, wrong, seconds, detail FROM practice ORDER BY id").all();
  return json({ rows: results });
}
async function adminPage(req, env) {
  if (!(await accessOk(req, env))) return new Response("forbidden", { status: 403 });
  return new Response(ADMIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
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
      if (req.method === "GET" && url.pathname === "/admin/scoring") return (await isAdmin(req, env)) ? new Response(SCORING_JSON, { headers: { "Content-Type": "application/json; charset=utf-8", ...cors } }) : json({ error: "forbidden" }, 403);
      if (req.method === "POST" && url.pathname === "/report") return await postReport(req, env);
      if (req.method === "GET" && url.pathname === "/blocked") return await getBlocked(env);
      if (req.method === "GET" && url.pathname === "/admin/reports") return await adminReports(req, env);
      if (req.method === "POST" && url.pathname === "/admin/report") return await adminSetReport(req, env);
      if (req.method === "POST" && url.pathname === "/feedback") return await postFeedback(req, env);
      if (req.method === "GET" && url.pathname === "/admin/feedback") return await adminFeedback(req, env);
      if (req.method === "POST" && url.pathname === "/admin/feedback") return await adminSetFeedback(req, env);
      if (req.method === "POST" && url.pathname === "/blitz") return await postBlitz(req, env);
      if (req.method === "GET" && url.pathname === "/admin/blitz") return await adminBlitz(req, env);
      if (req.method === "POST" && url.pathname === "/practice") return await postPractice(req, env);
      if (req.method === "GET" && url.pathname === "/admin/practice") return await adminPractice(req, env);
      if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) return await adminPage(req, env);
      const m = url.pathname.match(/^\/run\/(\d+)$/);
      if (req.method === "GET" && m) return await getRun(Number(m[1]), env);
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server", message: String(e && e.message || e) }, 500);
    }
  },
};
