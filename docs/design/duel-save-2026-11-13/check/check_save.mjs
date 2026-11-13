// 兩儀殿存譜端到端檢查：node check_save.mjs（前景執行，約 3–4 分鐘；超時與斷線判負要等 60 秒）。
// 自己起停：python http.server 8796（頁面＋題庫）、wrangler dev 8797（兩輪：門檻正常／FULL_CHUNK_BYTES 調小）；只用 PID 關自己啟動的行程。
// 玩家＝真的 duel.html 頁面（用 window.__ws 送訊息，跟頁面送的一樣），觀察者＝原生 WebSocket。
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, openSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const VCF = 'C:/claudehome/projects/VCF', PAGE = 'http://127.0.0.1:8796', WR_PORT = 8797, WSURL = `ws://127.0.0.1:${WR_PORT}/ws`;
const TMP = tmpdir() + '/wstate-save-' + Date.now();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEG = process.env.NEG === '1';   // 負向：把「玩家今日棋局有存到」的判斷反過來（預期出現 FAIL，證明檢查會抓到沒存的情況）
let srv = null, wr = null, b = null;
const killPid = (pid) => { try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {} };
const stopWr = () => { if (wr) { killPid(wr); wr = null; } };
async function startWr(persist, vars, logName) {
  mkdirSync(persist, { recursive: true });
  const fd = openSync(HERE + '/' + logName, 'w');
  const args = ['/c', 'npx', 'wrangler@4.158.0', 'dev', '-c', VCF + '/game/duel-server/wrangler.toml', '--ip', '127.0.0.1', '--port', String(WR_PORT), '--persist-to', persist, '--var', `BANK_URL:${PAGE}`, ...vars.flatMap((v) => ['--var', v])];
  wr = spawn('cmd', args, { cwd: VCF, stdio: ['ignore', fd, fd], windowsHide: true }).pid;
  for (let i = 0; i < 90; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${WR_PORT}/`); if ((await r.text()).includes('rush-duel')) return; } catch {} }
  throw new Error('wrangler 起不來');
}
const errsOf = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
const errsAll = [];

// ---------- 玩家頁 ----------
async function player(nick, { strip = false } = {}) {
  const c = await b.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });
  await c.addInitScript(([nick, strip, port]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) {
      if (window.__block) throw new Error('blocked');   // 測斷線：不讓頁面自動重連
      const ws = new W(String(u).replace(':8787/', ':' + port + '/'), p); window.__ws = ws; return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (strip) { const P = JSON.parse; JSON.parse = function (s, ...a) { const o = P.call(this, s, ...a); if (o && o.t === 'room' && o.room) delete o.room.result; return o; }; }   // 模擬舊伺服器：房間資料沒有 result 欄位
    if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('vcfgame.lang', 'zh'); localStorage.setItem('vcfgame.duel.tap', '1'); localStorage.setItem('vcfgame.nick', nick); }
  }, [nick, strip, WR_PORT]);
  const p = await c.newPage();
  p.errs = []; p.nick = nick; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(PAGE + '/duel.html'); await sleep(1200);
  return p;
}
const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
const waitFn = (p, fn, arg, ms = 30000) => p.waitForFunction(fn, arg, { timeout: ms });
const dRoom = (p) => p.evaluate(() => { const d = window.__duel, r = d.room; return r ? { id: r.id, state: r.state, seat: d.mySeat() } : null; });
async function pair(cfg, nickA, nickB, opts = {}) {
  const A = await player(nickA, opts), B = await player(nickB, opts);
  await wsSend(A, { t: 'create', ...cfg, priv: false, color: 'b' });
  await waitFn(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  const id = (await dRoom(A)).id;
  await wsSend(B, { t: 'view', room: id }); await waitFn(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
  await wsSend(B, { t: 'sit', room: id, seat: 1 });
  await waitFn(A, () => window.__duel.room.state === 'play'); await waitFn(B, () => window.__duel.room.state === 'play');
  A.__seat = (await dRoom(A)).seat; B.__seat = (await dRoom(B)).seat; A.rid = B.rid = id;
  return { A, B, id, bySeat: [A.__seat === 0 ? A : B, A.__seat === 0 ? B : A] };
}
const GOM = { kind: 'gomoku', time: 'none', rule: 'free' };
const FIVE = [112, 33, 113, 34, 114, 35, 115, 36, 116];   // 黑 H 列連五（黑＝座位 0＝開房的 A）
async function playMoves(g, pts) {
  for (const q of pts) {
    const n = await g.A.evaluate(() => window.__duel.match.moves.length);
    const mover = n % 2 === 0 ? g.bySeat[0] : g.bySeat[1];
    await wsSend(mover, { t: 'move', p: q });
    await waitFn(g.A, (n) => window.__duel.match.moves.length === n + 1, n, 8000);
  }
}
// 玩家頁今日棋局：這一局（房號開頭的 gk）的那筆
const today = (p, rid) => p.evaluate((rid) => window.__duel.todayRead().filter((x) => String(x.gk || '').startsWith(rid + ':')).map((x) => ({ res: x.sum.res, kind: x.sum.kind, n: x.sum.n, note: x.rec.note, win: x.rec.win, mine: x.rec.mine })), rid);
const waitOver = (p, ms = 90000) => waitFn(p, () => window.__duel.room && window.__duel.room.state === 'over', null, ms);

// ---------- 原生 WebSocket（觀察者／量大小的玩家） ----------
async function rc(nick) {
  const id = 'r' + Math.random().toString(36).slice(2, 14) + 'abcd';
  const ws = new WebSocket(`${WSURL}?v=2&id=${id}&nick=${encodeURIComponent(nick)}`);
  const c = { id, nick, ws, msgs: [], room: null, lastRec: 0 };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'room') c.room = m.room; };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { let v = false; try { v = fn(c); } catch {} if (v) return true; await sleep(80); } throw new Error('until 逾時：' + fn); };
  c.ask = async (msg, type, ms = 8000) => { if (msg.t === 'rec' || msg.t === 'recs') { const w = 320 - (Date.now() - c.lastRec); if (w > 0) await sleep(w); c.lastRec = Date.now(); } const i = c.msgs.length; c.send(msg); await c.until(() => c.msgs.slice(i).some((m) => m.t === type || m.t === 'err'), ms); return c.msgs.slice(i).find((m) => m.t === type || m.t === 'err'); };
  c.recs = async () => { const m = await c.ask({ t: 'recs', since: Date.now() - 3600e3 }, 'recs'); return m.t === 'recs' ? m.list : m; };
  c.rec = async (id) => c.ask({ t: 'rec', id }, 'rec');
  await c.until(() => c.msgs.some((m) => m.t === 'lobby'));
  return c;
}
const byNames = (list, a, b2) => (Array.isArray(list) ? list : []).find((r) => r.names[0] === a && r.names[1] === b2) || (Array.isArray(list) ? list : []).find((r) => r.names[0] === b2 && r.names[1] === a);
const bytes = (s) => new TextEncoder().encode(s).length;
// 原生玩家開 VCF 房並打完（A 解 target 題；B 解 bSolve 題；一線天 B 在前 bSolve 題先解），回傳 { rid, A, B }
async function rawVcf(vmode, target, bSolve, nick, seqLen = 15) {
  const A = await rc(nick + 'a'), B = await rc(nick + 'b');
  A.send({ t: 'create', kind: 'vcf', vmode, rank: 1, think: 60, target, priv: false, color: 'b' });
  await A.until((c) => c.room && c.room.state === 'wait');
  const rid = A.room.id;
  B.send({ t: 'view', room: rid }); await B.until((c) => c.room && c.room.id === rid);
  B.send({ t: 'sit', room: rid, seat: 1 });
  await A.until((c) => c.room.state === 'play' && c.room.vs && c.room.vs.p[0].puzzle); await B.until((c) => c.room && c.room.state === 'play');
  const SEQ = ['H8', 'H9', 'J9', 'J10', 'K10', 'K11', 'L11', 'L12', 'M12', 'M13', 'N13', 'N14', 'O14', 'O15', 'P15'].slice(0, seqLen);
  const seatA = A.room.seats.findIndex((s) => s.id === A.id), seatB = 1 - seatA;
  const ready = (c, s, k) => c.until((x) => { const st = x.room.vs && x.room.vs.p[s]; return x.room.state !== 'play' || (st && st.puzzle && st.i === k && st.s === 'think' && Date.now() >= st.at - 50); }, 40000);
  let sa = 0, sb = 0;
  for (let k = 0; sa < target; k++) {
    if (vmode === 'eight') {
      if (sb < bSolve) { await ready(B, seatB, sb); B.send({ t: 'vdone', n: sb, seq: SEQ }); sb++; await B.until((c) => c.room.vs.score[seatB] === sb, 8000); }
      await ready(A, seatA, sa); A.send({ t: 'vdone', n: sa, seq: SEQ }); sa++;
      await A.until((c) => c.room.state === 'over' || c.room.vs.score[seatA] === sa, 8000);
    } else {   // 一線天：兩人同一題；先解開的得分
      const first = sb < bSolve ? [B, seatB] : [A, seatA];
      await ready(first[0], first[1], k); first[0].send({ t: 'vdone', n: k, seq: SEQ });
      if (first[1] === seatA) sa++; else sb++;
      await A.until((c) => c.room.state === 'over' || (c.room.vs.phase === 'reveal' && c.room.vs.score[seatA] + c.room.vs.score[seatB] === sa + sb), 10000);
      if (A.room.state !== 'over') await A.until((c) => c.room.state === 'over' || (c.room.vs.phase === 'play' && c.room.vs.p[0].i === k + 1), 15000);
    }
    if (A.room.state === 'over') break;
  }
  await A.until((c) => c.room.state === 'over', 20000);
  await B.until((c) => c.room.state === 'over', 5000);
  return { rid, A, B, seatA };
}

// ---------- 讀 wrangler 本機 DO 的 sqlite（看 storage 裡實際有哪些鍵） ----------
const sqliteFiles = (dir) => { const found = []; const walk = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d, { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (e.name.endsWith('.sqlite')) found.push(p); } }; walk(dir); return found; };
async function storageKeys(dir) {
  const { DatabaseSync } = await import('node:sqlite');
  const found = sqliteFiles(dir), out = [];
  for (const f of found) {
    let db;
    try { db = new DatabaseSync(f, { readOnly: true }); } catch (e) { console.log('  （開不了 ' + f + '：' + e.message + '）'); continue; }
    try { for (const r of db.prepare('SELECT key FROM _cf_KV').all()) out.push(typeof r.key === 'string' ? r.key : Buffer.from(r.key).toString('utf8')); } catch (e) { console.log('  （讀不了 _cf_KV：' + e.message + '）'); }
    try { db.close(); } catch {}
  }
  return { keys: out, files: found };
}

try {
  srv = spawn('python', ['-m', 'http.server', '8796', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  rmSync(TMP, { recursive: true, force: true });
  await startWr(TMP + '/r1', [], 'wrangler-r1.log');
  b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const O = await rc('Obs');

  // ================= 1. 五子棋各種結束方式（門檻正常） =================
  console.log('== 1. 五子棋：先開超時（兩組）與斷線三組，同時跑 60 秒；期間做連五、認輸');
  const T1 = await pair({ ...GOM, time: '1+0' }, 'TmA', 'TmB');
  const T2 = await pair({ ...GOM, time: '1+0' }, 'TsA', 'TsB', { strip: true });
  const D1 = await pair(GOM, 'DcA', 'DcB');
  for (const g of [T1, T2, D1]) await playMoves(g, [112, 33, 113, 34]);   // 各 4 手；接著輪到黑（座位 0），黑不動 → 1 分鐘用完
  const dcStart = Date.now();
  await D1.B.evaluate(() => { window.__block = true; window.__ws.close(); });   // B 斷線且不自動重連

  const F = await pair(GOM, 'FvA', 'FvB');
  await playMoves(F, FIVE);
  await waitOver(F.A); await waitOver(F.B); await sleep(500);
  let list = await O.recs();
  let r = byNames(list, 'FvA', 'FvB');
  ok(r && r.kind === 'gomoku' && r.win === 0 && r.n === 9 && r.names[0] === 'FvA', `連五：伺服器有這一局、win=${r && r.win}（黑＝FvA 座位 0）、n=${r && r.n}`);
  let ta = await today(F.A, F.id), tb = await today(F.B, F.id);
  const fiveOk = ta.length === 1 && ta[0].res === 'w' && tb.length === 1 && tb[0].res === 'l';
  ok(NEG ? !fiveOk : fiveOk, `連五：A 的今日棋局 ${JSON.stringify(ta)}／B 的 ${JSON.stringify(tb)}（贏 w、輸 l）${NEG ? '【NEG：判斷反過來，預期 FAIL】' : ''}`);
  const fullFive = r && (await O.rec(r.id));
  ok(fullFive && fullFive.t === 'rec' && fullFive.rec.match && fullFive.rec.result && fullFive.rec.result.winnerSeat === 0, '連五：rec 讀得回完整對局（match＋result）');
  console.log('  連五局單筆 rec 訊息大小：' + bytes(JSON.stringify(fullFive)) + ' bytes');

  const R = await pair(GOM, 'RsA', 'RsB');
  await playMoves(R, [112, 33, 113]);
  await wsSend(R.bySeat[1], { t: 'resign' });
  await waitOver(R.A); await waitOver(R.B); await sleep(500);
  list = await O.recs(); r = byNames(list, 'RsA', 'RsB');
  ok(r && r.win === 0 && r.note === 'resign', `認輸：伺服器 win=${r && r.win} note=${r && r.note}（黑 RsA 贏）`);
  ta = await today(R.A, R.id); tb = await today(R.B, R.id);
  ok(ta.length === 1 && ta[0].res === 'w' && tb.length === 1 && tb[0].res === 'l' && ta[0].note === 'resign', `認輸：A ${JSON.stringify(ta)}／B ${JSON.stringify(tb)}`);

  console.log('== 2. VCF 分數到（八仙渡、一線天，頁面玩家）');
  const vsolve = async (p, k) => { await waitFn(p, (k) => { const d = window.__duel, r = d.room, s = d.mySeat(), st = r && r.vs && r.vs.p[s]; return r.state !== 'play' || (st && st.puzzle && st.i === k && st.s === 'think' && Date.now() >= st.at - 50); }, k, 60000); await wsSend(p, { t: 'vdone', n: k, seq: ['H8', 'H9', 'J9'] }); };
  const V = await pair({ kind: 'vcf', vmode: 'eight', rank: 1, think: 60, target: 3 }, 'VeA', 'VeB');
  await vsolve(V.bySeat[1], 0);
  for (let k = 0; k < 3; k++) await vsolve(V.bySeat[0], k);
  await waitOver(V.A); await waitOver(V.B); await sleep(1800);
  list = await O.recs(); r = byNames(list, 'VeA', 'VeB');
  ok(r && r.kind === 'vcf' && r.vmode === 'eight' && r.win === V.bySeat[0].__seat && r.note === 'score' && r.score[V.bySeat[0].__seat] === 3 && r.score[V.bySeat[1].__seat] === 1, `八仙渡：伺服器 win=${r && r.win} score=${r && JSON.stringify(r.score)} note=${r && r.note}`);
  ta = await today(V.bySeat[0], V.id); tb = await today(V.bySeat[1], V.id);
  ok(ta.length === 1 && ta[0].res === 'w' && tb.length === 1 && tb[0].res === 'l', `八仙渡：贏的 ${JSON.stringify(ta)}／輸的 ${JSON.stringify(tb)}`);
  const L = await pair({ kind: 'vcf', vmode: 'line', rank: 1, think: 60, target: 3 }, 'VlA', 'VlB');
  for (let k = 0; k < 3; k++) await vsolve(L.bySeat[0], k);
  await waitOver(L.A); await waitOver(L.B); await sleep(1800);
  list = await O.recs(); r = byNames(list, 'VlA', 'VlB');
  ok(r && r.vmode === 'line' && r.win === L.bySeat[0].__seat && r.note === 'score', `一線天：伺服器 win=${r && r.win} score=${r && JSON.stringify(r.score)}`);
  ta = await today(L.bySeat[0], L.id); tb = await today(L.bySeat[1], L.id);
  ok(ta.length === 1 && ta[0].res === 'w' && tb.length === 1 && tb[0].res === 'l', `一線天：贏的 ${JSON.stringify(ta)}／輸的 ${JSON.stringify(tb)}`);

  console.log('== 3. 超時、斷線判負（等伺服器判）');
  for (const g of [T1, T2]) await waitOver(g.A, 100000);
  // 斷線判負：伺服器同一個 tick 先送 over、再把斷線的人移出座位、房間回等人，頁面來不及停在 over；改等「今日棋局有這一筆」
  await waitFn(D1.A, (rid) => window.__duel.todayRead().some((x) => String(x.gk || '').startsWith(rid + ':')), D1.id, 100000);
  console.log(`  從開始等到三組都判完花了 ${Math.round((Date.now() - dcStart) / 1000)} 秒（斷線寬限 PLAY_GRACE_MS 60 秒、棋鐘 1 分鐘）`);
  await sleep(800);
  list = await O.recs();
  for (const [g, na, nb, label] of [[T1, 'TmA', 'TmB', '超時（新頁面＋新伺服器）'], [T2, 'TsA', 'TsB', '超時（頁面收不到 result 欄位＝新頁面連舊伺服器）']]) {
    r = byNames(list, na, nb);
    ok(r && r.win === 1 && r.n === 4, `${label}：伺服器有這一局、win=${r && r.win}（白＝${nb} 贏）、n=${r && r.n}`);
    const full = r && (await O.rec(r.id));
    ok(full && full.rec && full.rec.result && full.rec.result.reason === '時間到' && full.rec.result.winnerSeat === 1, `${label}：rec.result = ${full && full.rec && JSON.stringify(full.rec.result)}`);
    const clkA = await g.A.evaluate(() => ({ clock: window.__duel.room.clock, result: window.__duel.room.result === undefined ? '(沒有這個欄位)' : window.__duel.room.result }));
    const clkB = await g.B.evaluate(() => ({ clock: window.__duel.room.clock }));
    console.log(`  ${label}：A 頁面超時當下 r.clock=${JSON.stringify(clkA.clock)} r.result=${JSON.stringify(clkA.result)}；B 頁面 r.clock=${JSON.stringify(clkB.clock)}`);
    ok(clkA.clock.some((v) => v <= 0) && clkB.clock.some((v) => v <= 0), `${label}：兩邊收到的 r.clock 都有 ≤ 0 的值（${JSON.stringify(clkA.clock)}）`);
    const ta2 = await today(g.A, g.id), tb2 = await today(g.B, g.id);
    ok(ta2.length === 1 && ta2[0].res === 'l' && tb2.length === 1 && tb2[0].res === 'w', `${label}：黑（${na}）輸 l、白（${nb}）贏 w ── ${JSON.stringify(ta2)}／${JSON.stringify(tb2)}`);
  }
  ok(await T2.A.evaluate(() => window.__duel.room.result === undefined), '超時（舊伺服器模擬）：頁面確實沒收到 result 欄位，走的是時鐘回退路徑（＝舊版頁面唯一的做法）');
  const T1r = await T1.A.evaluate(() => window.__duel.room.result);
  ok(T1r && T1r.winnerSeat === 1 && T1r.reason === '時間到', `新伺服器的房間資料帶 result：${JSON.stringify(T1r)}`);
  r = byNames(list, 'DcA', 'DcB');
  ok(r && r.win === 0 && r.note === 'disconnect', `斷線判負：伺服器有這一局 win=${r && r.win}（DcA 贏）note=${r && r.note}`);
  const tdA = await today(D1.A, D1.id), tdB = await today(D1.B, D1.id);
  ok(tdA.length === 1 && tdA[0].res === 'w', `斷線判負：留在房裡的 A 有存到 ${JSON.stringify(tdA)}`);
  console.log(`  斷線判負：斷線那位（B）判負當下沒連線，今日棋局 ${JSON.stringify(tdB)}`);
  await D1.B.evaluate(() => { window.__block = false; });
  await sleep(12000);   // 頁面自己重連（退避最多 8 秒）
  const tdB2 = await today(D1.B, D1.id);
  const dBroom = await D1.B.evaluate(() => { const r = window.__duel.room; return r ? { state: r.state, seated: window.__duel.mySeat() } : null; });
  console.log(`  斷線那位重連回同一間房後：房間 ${JSON.stringify(dBroom)}；今日棋局 ${JSON.stringify(tdB2)}`);
  ok(tdB2.length === 0 && dBroom && dBroom.state === 'wait', '斷線判負：重連後補不到（判負時座位已清、房間回等人，收不到 over）——記錄為「補不到」，不修');
  for (const g of [F, R, V, L, T1, T2, D1]) errsAll.push(...errsOf(g.A), ...errsOf(g.B));

  // ================= 4. 真實大小量測（門檻正常） =================
  console.log('== 4. 真實大小：一局 rec 訊息（≈ full；少兩個玩家 id、多一個 mine）');
  const sizes = [];
  for (const [vm, tg] of [['line', 3], ['line', 5], ['line', 10], ['eight', 3], ['eight', 5], ['eight', 10]]) {
    const nk = 'Sz' + vm[0] + tg;
    const g = await rawVcf(vm, tg, tg - 1, nk);
    await sleep(500);
    const rr = byNames(await O.recs(), nk + 'a', nk + 'b');
    const full = rr && await O.rec(rr.id);
    const sz = full && full.rec ? bytes(JSON.stringify(full.rec)) : -1;
    sizes.push([vm, tg, sz, full && full.rec ? full.rec.review.list.length : 0]);
    console.log(`  ${vm === 'line' ? '一線天' : '八仙渡'} 目標 ${tg} 題（輸家解 ${tg - 1}）：回看有 ${full && full.rec ? full.rec.review.list.length : '?'} 題，rec ≈ ${sz} bytes（${(sz / 1024).toFixed(1)} KiB；離 128 KiB 還有 ${(128 - sz / 1024).toFixed(0)} KiB）`);
    g.A.ws.close(); g.B.ws.close();
  }
  writeFileSync(HERE + '/last-sizes.json', JSON.stringify(sizes));
  ok(sizes.every(([, , s]) => s > 0 && s < 98304), `六種組合都小於 96 KiB 門檻（最大 ${Math.max(...sizes.map((x) => x[2]))} bytes；seq 用 15 手合成，真人手順約 3–20 手）`);

  const k1 = await storageKeys(TMP + '/r1');
  console.log(`  本機 storage（sqlite 檔 ${k1.files.length} 個）鍵 ${k1.keys.length} 把`);
  const fullKeys = k1.keys.filter((k) => k.startsWith('full:')), pKeys = k1.keys.filter((k) => /^full:.+:p\d+$/.test(k));
  ok(k1.keys.length > 0 && fullKeys.length >= 10 && pKeys.length === 0, `門檻正常：${fullKeys.length} 局的 full 都是單一把鍵，沒有 :pN 片段鍵（${pKeys.length}）`);
  O.ws.close();

  // ================= 5. 門檻調小：一般對局也被拆存 =================
  console.log('== 5. FULL_CHUNK_BYTES 調成 600：一般對局被拆存，讀得回、內容相同');
  for (const g of [F, R, V, L, T1, T2, D1]) { await g.A.context().close().catch(() => {}); await g.B.context().close().catch(() => {}); }
  stopWr(); await sleep(1500);
  await startWr(TMP + '/r2', ['FULL_CHUNK_BYTES:600'], 'wrangler-r2.log');
  const O2 = await rc('Obs2');
  const cg = await pair(GOM, 'CkA', 'CkB');
  await playMoves(cg, FIVE);
  await waitOver(cg.A); await waitOver(cg.B); await sleep(500);
  const matchSeen = await cg.A.evaluate(() => ({ match: window.__duel.room.match, result: window.__duel.room.result }));
  list = await O2.recs(); r = byNames(list, 'CkA', 'CkB');
  ok(r && r.win === 0, '拆存的五子棋局：recs 清單有它（摘要在 rec:<id>）');
  const got = r && await O2.rec(r.id);
  ok(got && got.t === 'rec' && JSON.stringify(got.rec.match) === JSON.stringify(matchSeen.match) && JSON.stringify(got.rec.result) === JSON.stringify(matchSeen.result), '拆存的五子棋局：rec 讀回的 match／result 與玩家當時收到的房間資料逐字相同');
  ta = await today(cg.A, cg.id);
  ok(ta.length === 1 && ta[0].res === 'w', '拆存的局：玩家今日棋局照常寫入');
  const vg = await rawVcf('eight', 3, 2, 'Ck8');
  const vsSeen = vg.A.room.vs;
  await sleep(500);
  list = await O2.recs(); const rv = byNames(list, 'Ck8a', 'Ck8b');
  const gotV = rv && await O2.rec(rv.id);
  ok(gotV && gotV.t === 'rec' && JSON.stringify(gotV.rec.review) === JSON.stringify(vsSeen.review) && JSON.stringify(gotV.rec.score) === JSON.stringify(vsSeen.score), `拆存的 VCF 局：review（${gotV && gotV.rec && gotV.rec.review.list.length} 題）與玩家收到的逐字相同`);
  vg.A.ws.close(); vg.B.ws.close();
  const k2 = await storageKeys(TMP + '/r2');
  const hdrs = k2.keys.filter((k) => /^full:[0-9a-z]+$/.test(k)), parts2 = k2.keys.filter((k) => /^full:[0-9a-z]+:p\d+$/.test(k));
  const mineParts = parts2.filter((k) => k.startsWith('full:' + (r ? r.id : 'x') + ':'));
  ok(hdrs.length >= 2 && mineParts.length >= 2 && mineParts.every((k) => /:p\d+$/.test(k)), `storage 裡是標頭＋片段：這局五子棋有 ${mineParts.length} 段（${mineParts.sort().join(', ')}）；全部 full 標頭 ${hdrs.length}、片段鍵 ${parts2.length}`);
  ok(k2.keys.filter((k) => k.startsWith('rec:')).length >= 2, 'rec: 摘要鍵獨立存在，recs 清單用 rec: 前綴範圍，不會掃進 full: 片段');

  // ================= 6. 負向 =================
  console.log('== 6. 負向：拆存局少一段');
  const gid = r.id, vid = rv.id;
  O2.ws.close(); await cg.A.context().close(); await cg.B.context().close();
  stopWr(); await sleep(2500);
  const { DatabaseSync } = await import('node:sqlite');
  let del = 0;
  for (const f of sqliteFiles(TMP + '/r2')) { let db; try { db = new DatabaseSync(f); } catch { continue; } try { del += Number(db.prepare('DELETE FROM _cf_KV WHERE key = ?').run('full:' + gid + ':p1').changes); } catch {} try { db.close(); } catch {} }
  console.log(`  刪掉 full:${gid}:p1（sqlite 刪了 ${del} 列）`);
  ok(del === 1, '測試手段：成功從 storage 刪掉一段');
  await startWr(TMP + '/r2', ['FULL_CHUNK_BYTES:600'], 'wrangler-r2b.log');
  const O3 = await rc('Obs3');
  const bad = await O3.rec(gid);
  ok(bad.t === 'err' && bad.code === 'gone', `少一段：回 err gone（${JSON.stringify(bad)}），不是例外`);
  const alive = await O3.ask({ t: 'ping' }, 'pong');
  ok(alive.t === 'pong' && O3.ws.readyState === 1, '少一段：連線還活著（ping → pong）');
  const good = await O3.rec(vid);
  ok(good.t === 'rec' && good.rec.review, '少一段：其他完整的拆存局照常讀得到');
  const l3 = await O3.recs();
  ok(!!byNames(l3, 'CkA', 'CkB'), '少一段：清單（rec:）仍列出這一局');
  O3.ws.close();
  errsAll.push(...errsOf(cg.A), ...errsOf(cg.B));
  ok(errsAll.length === 0, `全程沒有 pageerror／console error（${errsAll.length}）${errsAll.slice(0, 3).join(' | ')}`);
} catch (e) {
  console.log('  FAIL 腳本例外：' + (e && e.stack || e)); fail++;
} finally {
  if (b) await b.close().catch(() => {});
  stopWr();
  if (srv) killPid(srv);
  await sleep(500);
  const bad = [];
  for (const n of ['wrangler-r1.log', 'wrangler-r2.log', 'wrangler-r2b.log']) { const f = HERE + '/' + n; if (!existsSync(f)) continue; const t = readFileSync(f, 'utf8'); bad.push(...t.split('\n').filter((l) => /Uncaught|Unhandled|棋局存檔失敗|棋局摘要存檔也失敗|TypeError|ReferenceError/.test(l)).map((l) => n + ': ' + l.trim())); }
  ok(bad.length === 0, `伺服器 log 沒有未捕捉例外／存檔失敗（${bad.length}）${bad.slice(0, 3).join(' | ')}`);
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  console.log(`PASS ${pass}／FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
}
