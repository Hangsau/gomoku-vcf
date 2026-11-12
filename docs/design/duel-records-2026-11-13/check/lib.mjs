// 今日棋局集測試用工具：原生 WebSocket 假玩家（直接講伺服器協定）＋ Playwright 頁面、wrangler 起停。
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
import { replayMatch, actorOf } from 'file:///C:/claudehome/projects/VCF/game/duel/match.js';
import { spawn, execSync } from 'node:child_process';
export const BASE = 'http://127.0.0.1:8793', WSURL = 'ws://127.0.0.1:8789/ws';
export let pass = 0, fail = 0;
export const ok = (c, msg) => { if (c) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
export const done = () => { console.log(`PASS ${pass}／FAIL ${fail}`); return fail; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launch = () => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

// ---------- wrangler（用自己的 persist 資料夾，不碰別人的 .wrangler/state） ----------
let wr = null;
export async function startWr(persist) {
  wr = spawn('cmd', ['/c', 'npx', 'wrangler@4.158.0', 'dev', '-c', 'C:/claudehome/projects/VCF/game/duel-server/wrangler.toml', '--ip', '127.0.0.1', '--port', '8789', '--persist-to', persist], { cwd: 'C:/claudehome/projects/VCF', stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    try { const r = await fetch('http://127.0.0.1:8789/'); if ((await r.text()).includes('rush-duel')) return wr.pid; } catch {}
  }
  throw new Error('wrangler 起不來');
}
export function stopWr() {
  if (!wr) return;
  try { execSync(`taskkill /PID ${wr.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  wr = null;
}

// ---------- 原生 WebSocket 假玩家 ----------
export async function rc(nick) {
  const id = 'r' + Math.random().toString(36).slice(2, 14) + 'abcd';
  const ws = new WebSocket(`${WSURL}?v=2&id=${id}&nick=${encodeURIComponent(nick)}`);
  const c = { id, nick, ws, msgs: [], raw: [], room: null, waiters: [] };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.raw.push(e.data); c.msgs.push(m); if (m.t === 'room') c.room = m.room; for (const w of [...c.waiters]) w(); };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = (fn, ms = 10000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const chk = () => { let v = false; try { v = fn(c); } catch {} if (v) { c.waiters = c.waiters.filter((x) => x !== chk); clearInterval(iv); res(true); } else if (Date.now() - t0 > ms) { c.waiters = c.waiters.filter((x) => x !== chk); clearInterval(iv); rej(new Error('until 逾時：' + fn)); } };
    const iv = setInterval(chk, 100); c.waiters.push(chk); chk();
  });
  c.ask = async (msg, type, ms = 6000) => { if (msg.t === 'rec' || msg.t === 'recs') { const w = 300 - (Date.now() - (c.lastRec || 0)); if (w > 0) await sleep(w); c.lastRec = Date.now(); } const i = c.msgs.length; c.send(msg); await c.until(() => c.msgs.slice(i).some((m) => m.t === type || m.t === 'err'), ms); return c.msgs.slice(i).find((m) => m.t === type || m.t === 'err'); };
  c.recs = async (since = Date.now() - 3600e3) => { const m = await c.ask({ t: 'recs', since }, 'recs'); return m.t === 'recs' ? m.list : m; };
  c.close = () => { try { ws.close(); } catch {} };
  await c.until(() => c.msgs.some((m) => m.t === 'lobby'));
  return c;
}
export const seatOf = (c) => c.room.seats.findIndex((s) => s && s.id === c.id);

// 五子棋：A 開房（公開／私人），B 入座；回傳 { id, clients: [seat0 的人, seat1 的人] }
export async function newGomoku(A, B, { priv = false, rule = 'free', time = 'none' } = {}) {
  A.send({ t: 'leave' }); B.send({ t: 'leave' }); await sleep(400); A.room = null; B.room = null;
  A.send({ t: 'create', kind: 'gomoku', time, rule, priv, color: 'b' });
  await A.until((c) => c.room && c.room.state === 'wait');
  const id = A.room.id;
  B.send(priv ? { t: 'join', code: A.room.code } : { t: 'view', room: id }); await B.until((c) => c.room && c.room.id === id);
  B.send({ t: 'sit', room: id, seat: 1 });
  await A.until((c) => c.room.state === 'play'); await B.until((c) => c.room && c.room.state === 'play');
  return id;
}
const whoActs = (room, A, B) => { const m = room.match; const act = actorOf(replayMatch(m.config, m.log, m.startedAt)); return [A, B].find((c) => c.room.seats[act] && c.room.seats[act].id === c.id); };
export async function playMoves(A, B, points) {
  for (const p of points) {
    const n = A.room.match.log.length, mover = whoActs(A.room, A, B);
    mover.send({ t: 'move', p });
    await A.until((c) => c.room.match.log.length === n + 1); await B.until((c) => c.room.match.log.length === n + 1);
  }
}
export const moverNow = (A, B) => whoActs(A.room, A, B);
// 黑連五：黑 H 列 7~11，白下遠處；黑是先手座位（座位 0）
export const FIVE = [112, 33, 113, 34, 114, 35, 115, 36, 116];

export async function newVcf(A, B, vmode, { priv = false } = {}) {
  A.send({ t: 'leave' }); B.send({ t: 'leave' }); await sleep(400); A.room = null; B.room = null;
  A.send({ t: 'create', kind: 'vcf', vmode, rank: 1, think: 60, target: 3, priv, color: 'b' });
  await A.until((c) => c.room && c.room.state === 'wait');
  const id = A.room.id;
  B.send(priv ? { t: 'join', code: A.room.code } : { t: 'view', room: id }); await B.until((c) => c.room && c.room.id === id);
  B.send({ t: 'sit', room: id, seat: 1 });
  await A.until((c) => c.room.state === 'play'); await B.until((c) => c.room && c.room.state === 'play');
  return id;
}
// 某人解開第 k 題（伺服器信任回報；等到題目真的開始）
export async function vSolve(c, k) {
  const s = seatOf(c);
  await c.until((x) => { const st = x.room.vs && x.room.vs.p[s]; return st && st.puzzle && st.i === k && st.s === 'think' && Date.now() >= st.at - 50; }, 30000);
  c.send({ t: 'vdone', n: k, seq: ['H8'] });
}

// ---------- 頁面 ----------
export async function mk(b, { lang = 'zh', w = 375, h = 667, nick = 'Cat' } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript(([lang, nick]) => {
    const W = window.WebSocket; window.__sent = []; window.__wsN = 0;
    window.WebSocket = function (u, p) {
      const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__wsN++; window.__ws = ws;
      const s0 = ws.send.bind(ws); ws.send = (d) => { d = window.__rewrite ? window.__rewrite(String(d)) : String(d); window.__sent.push(d); return s0(d); };
      return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (!localStorage.getItem('vcfgame.lang')) localStorage.setItem('vcfgame.lang', lang);
    localStorage.setItem('vcfgame.duel.tap', '1');
    if (nick) localStorage.setItem('vcfgame.nick', nick);
  }, [lang, nick]);
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(BASE + '/duel.html');
  await sleep(1300);
  return p;
}
export const sentTypes = (p) => p.evaluate(() => window.__sent.map((s) => JSON.parse(s).t));
export const sig = (p) => p.evaluate(() => window.__duel.cv.toDataURL());
export const fit = (p) => p.evaluate(() => {
  const d = document.documentElement, bad = [];
  document.querySelectorAll('.roomc.rec .hd, .roomc.rec .seat, #lobTabs .btn, #phaseActs .btn, #status, #facts span').forEach((el) => { if (el.offsetParent && el.scrollWidth > el.clientWidth + 1 && !(el.matches('#status, #facts span'))) bad.push(el.className + ':' + el.textContent.slice(0, 20)); });
  return { sh: d.scrollHeight, ih: innerHeight, sw: d.scrollWidth, iw: innerWidth, bad };
});
