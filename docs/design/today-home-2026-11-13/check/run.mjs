// 首頁「今日棋局」檢查：node run.mjs（前景執行）。
// 自己起停：http.server 8793（頁面）、8791（題庫）、wrangler dev 8789（兩儀殿）；只用 PID 關自己啟動的行程。
// 單人模式真的玩（引擎 solveFrom 算解，placeAt 落子），再用 endGame／twFinish 收局；象牙塔的伺服器 API 用 Playwright 攔截模擬。
// 兩儀殿：兩個頁面當玩家（用頁面自己的連線送訊息），第三個頁面觀戰。
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
import { replayMatch, actorOf } from 'file:///C:/claudehome/projects/VCF/game/duel/match.js';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
const { ok, sleep } = L;
const VCF = 'C:/claudehome/projects/VCF', BASE = L.BASE;
const PERSIST = 'C:/Users/hangs/AppData/Local/Temp/claude/01840b1a6fcdd9a6/d902b244-6044-45c8-b3f8-f25711dbe07b/scratchpad/wstate-today';
const SH = 'shots/';
mkdirSync(SH, { recursive: true });
rmSync(PERSIST, { recursive: true, force: true }); mkdirSync(PERSIST, { recursive: true });
const API = 'https://vcf-game-api.psyhangsau.workers.dev';
const OLD = VCF + '/duel_old_a157680_tmp.html';
const servers = [];
let b = null;
const errsAll = [];
const errs = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
function http(port) { const c = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }); servers.push(c.pid); }
const killAll = () => { for (const pid of servers) { try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {} } servers.length = 0; L.stopWr(); try { rmSync(OLD, { force: true }); } catch {} };

// ---------- 頁面 ----------
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function ctxOf(opts = {}) {
  const { lang = 'zh', w = 375, h = 667, nick = 'Cat', seed = null, tower = null } = opts;
  const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await c.addInitScript(([lang, nick, seed]) => {
    const W = window.WebSocket; window.__sent = []; window.__wsN = 0;
    window.WebSocket = function (u, p) {
      const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__wsN++; window.__ws = ws;
      const s0 = ws.send.bind(ws); ws.send = (d) => { window.__sent.push(String(d)); return s0(d); };
      return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    try {
      if (!localStorage.getItem('__seeded')) {   // 每個 context 只種一次資料；之後重新整理、開新分頁都要保留頁面自己寫的
        localStorage.setItem('__seeded', '1');
        if (!localStorage.getItem('vcfgame.lang')) localStorage.setItem('vcfgame.lang', lang);
        localStorage.setItem('vcfgame.duel.tap', '1');
        if (nick) localStorage.setItem('vcfgame.nick', nick);
        if (seed !== null) localStorage.setItem('vcfgame.today', seed);
      }
    } catch {}
  }, [lang, nick, seed]);
  const st = { n: 0, solved: 0, wrong: 0, hints: 0, seconds: 0 };
  await c.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (!u.href.startsWith(API) || !tower) return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const json = (o) => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    let body = {}; try { body = req.postDataJSON() || {}; } catch {}
    if (u.pathname === '/tower') return json({ day: '2026-11-13', run: null, place: null, puzzles: Array.from({ length: 5 }, () => tower.puzzle) });
    if (u.pathname === '/tower/open') return json({ run: { open_ms: 0 } });
    if (u.pathname === '/tower/step') { st.n++; if (body.ok) st.solved++; else st.wrong++; st.seconds += 3; return json({ pts: body.ok ? 5 : 0, sec: 3, run: { ...st }, place: null }); }
    if (u.pathname === '/tower/end') return json({ run: { ...st, ended: true }, place: 3 });
    return route.abort();
  });
  return c;
}
async function open(c, path) {
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(BASE + '/' + path);
  await sleep(900);
  return p;
}
const today = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('vcfgame.today')) || []; } catch { return null; } });
const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
const sentTypes = (p) => p.evaluate(() => window.__sent.map((s) => JSON.parse(s).t));
const scrollInfo = (p) => p.evaluate(() => { const d = document.documentElement; return { sh: d.scrollHeight, ih: innerHeight, sw: d.scrollWidth, iw: innerWidth }; });
const fits = async (p) => { const f = await scrollInfo(p); return { good: f.sh <= f.ih && f.sw <= f.iw, f }; };
const homeBtnHidden = (p) => p.evaluate(() => document.getElementById('homeRev').hidden);
const setStore = (p, v) => p.evaluate((v) => { if (v === null) localStorage.removeItem('vcfgame.today'); else localStorage.setItem('vcfgame.today', v); }, v);

// ---------- 單人玩法 ----------
async function solveN(p, n) {
  for (let i = 0; i < n; i++) {
    await p.waitForFunction(() => g && g.p && !g.hold && !g.over, null, { timeout: 90000 });
    await p.evaluate(async () => {
      const n0 = g.log.length;
      for (let k = 0; k < 14 && g.log.length === n0 && !g.over; k++) {
        let t;
        if (g.ey) t = g.eySol;
        else {
          const r = await solveFrom(g.black.join(' '), g.white.join(' '), g.p.atkWhite);
          const sol = r && r.result && r.result.solution ? String(r.result.solution).replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean) : [];
          t = sol.find((x) => !g.black.includes(x) && !g.white.includes(x));
        }
        if (!t) { await wrong('bad', ''); break; }   // 引擎在這個盤面算不出解（無限之塔偶爾發生，跟今日棋局無關）：記成答錯，照樣是一題
        await placeAt(t);
        for (let w = 0; w < 120 && g.hold && g.log.length === n0 && !g.over; w++) await new Promise((r) => setTimeout(r, 50));
      }
    });
    if (i < n - 1 && await p.evaluate(() => g.tw)) { await p.waitForFunction(() => g.rev, null, { timeout: 20000 }); await p.evaluate(() => document.getElementById('twGoNext').click()); }
  }
}
async function startMode(p, btn, pre) {
  await p.evaluate(() => show('sHome'));
  if (pre) await p.evaluate(pre);
  await p.evaluate((id) => document.getElementById(id).click(), btn);
  await sleep(500);
  await p.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 15000 });
  await p.evaluate(() => document.getElementById('go').click());
}
async function endRun(p, tw) {
  if (tw) { await p.waitForFunction(() => g.rev, null, { timeout: 20000 }); await p.evaluate(() => document.getElementById('twEnd2').click()); }
  else await p.evaluate(() => endGame('測試：收局'));
  await p.waitForFunction(() => !document.getElementById('sEnd').hidden, null, { timeout: 20000 });
  await sleep(300);
}
const rows = (p) => p.evaluate(() => [...document.querySelectorAll('#todayList .rev')].map((r) => ({ tm: r.querySelector('.tm').textContent, mdn: r.querySelector('.mdn').textContent, info: r.querySelector('.info').textContent })));
async function openToday(p) { await p.evaluate(() => show('sHome')); await p.click('#homeRev'); await sleep(200); }

// ---------- 兩儀殿（頁面當玩家，用頁面自己的連線送訊息）----------
const dRoom = (p) => p.evaluate(() => { const d = window.__duel, r = d.room; return r ? { id: r.id, state: r.state, games: r.games, seat: d.mySeat(), log: r.match ? r.match.log.length : 0 } : null; });
const waitRoom = (p, fn, arg, ms = 20000) => p.waitForFunction(fn, arg, { timeout: ms });
async function playMoves(A, B, pts) {
  for (const pt of pts) {
    const n = (await dRoom(A)).log;
    const m = await A.evaluate(() => window.__duel.room.match);
    const act = actorOf(replayMatch(m.config, m.log, m.startedAt));
    const mover = [A, B].find((p) => p.__seat === act);
    await wsSend(mover, { t: 'move', p: pt });
    await waitRoom(A, (n) => window.__duel.room.match.log.length === n + 1, n);
    await waitRoom(B, (n) => window.__duel.room.match.log.length === n + 1, n);
  }
}
async function newRoom(A, B, O, cfg) {
  await wsSend(A, { t: 'create', ...cfg });
  await waitRoom(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  const id = (await dRoom(A)).id;
  await wsSend(B, { t: 'view', room: id }); await waitRoom(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
  if (O) { await wsSend(O, { t: 'view', room: id }); await waitRoom(O, (id) => window.__duel.room && window.__duel.room.id === id, id); }
  await wsSend(B, { t: 'sit', room: id, seat: 1 });
  await waitRoom(A, () => window.__duel.room.state === 'play'); await waitRoom(B, () => window.__duel.room.state === 'play');
  A.__seat = (await dRoom(A)).seat; B.__seat = (await dRoom(B)).seat;
  return id;
}
async function vSolve(p, k) {
  await p.waitForFunction((k) => { const d = window.__duel, r = d.room, s = d.mySeat(), st = r && r.vs && r.vs.p[s]; return st && st.puzzle && st.i === k && st.s === 'think' && Date.now() >= st.at - 50; }, k, { timeout: 40000 });
  await wsSend(p, { t: 'vdone', n: k, seq: ['H8'] });
}
const FIVE = L.FIVE;

try {
  http(8793); http(8791);
  await L.startWr(PERSIST);
  await sleep(800);
  b = await L.launch();
  const T0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();

  // ================= 1. 單人各模式 =================
  console.log('== 1. 單人各模式各結束一局');
  const tower = { puzzle: null };
  const sctx = await ctxOf({ tower });
  const S = await open(sctx, 'game.html');
  ok(await homeBtnHidden(S), '一開始沒有紀錄：首頁沒有「今日棋局」按鈕');
  ok((await S.evaluate(() => document.getElementById('homeRev').textContent)) === '今日棋局', '按鈕文字＝今日棋局');
  const names = [];
  const modes = [
    ['prac', 'modeP', null, '練習'], ['rank', 'modeR', null, '煉獄之門'], ['b4', 'modeB', null, '無限之塔'], ['ey', 'modeE', null, '火眼金睛'],
    ['mj', 'modeM', () => { mjInf = true; }, '明鏡台・無限（排名）'], ['mj', 'modeM', () => { mjInf = false; }, '明鏡台・分級（練功）'], ['tw', 'modeT', null, '象牙塔'],
  ];
  for (const [mode, btn, pre, name] of modes) {
    if (mode === 'tw') {
      const x = (await today(S)).find((e) => e.mode === 'b4').detail[0];
      tower.puzzle = [x.b, x.w, x.L, x.s, x.a, x.id];
    }
    const before = (await today(S)).length;
    await startMode(S, btn, pre);
    if (mode === 'b4') { await S.waitForFunction(() => g && g.p, null, { timeout: 60000 }); await S.evaluate(() => { g.left = 600; }); }   // 引擎算解會吃掉 60 秒，測試時放寬無限之塔的倒數（只改這個測試的剩餘秒數）
    await solveN(S, 2);
    const shown = await S.evaluate(() => g.log.length);
    await endRun(S, mode === 'tw');
    const t = await today(S), e = t.at(-1);
    ok(t.length === before + 1 && e.src === 'solo', `${name}：結束一局後多一筆、只有一筆（${before} → ${t.length}）`);
    ok(e.mode === mode && (mode !== 'mj' || e.inf === (name.includes('無限') ? 1 : 0)), `${name}：mode＝${e.mode}${e.inf != null ? '、inf＝' + e.inf : ''}`);
    ok(e.detail.length === shown && shown === 2 && e.detail.every((x) => x.b && x.w && x.q), `${name}：detail 題數 ${e.detail.length}（解開 ${e.detail.filter((x) => x.ok).length}）＝ 那局實際作答題數 ${shown}（每題有盤面與手順）`);
    await S.evaluate(() => show('sEnd'));   // 再進一次結算畫面：不可重複寫
    ok((await today(S)).length === before + 1, `${name}：同一局再進結算畫面不重複寫`);
    names.push(name);
    if (mode === 'tw') console.log('  （象牙塔：伺服器 API 用攔截模擬；未驗真伺服器的一天一次與計分，只驗遊戲端收局時寫入今日棋局）');
  }
  const soloSeed = JSON.stringify(await today(S));
  ok(await S.evaluate(() => JSON.parse(localStorage.getItem('vcfgame.lastRev')).detail.length > 0), '既有 vcfgame.lastRev 照舊有寫');

  // 首頁清單
  await S.evaluate(() => show('sHome'));
  ok(!(await homeBtnHidden(S)), '首頁出現「今日棋局」');
  await S.click('#homeRev'); await sleep(250);
  const rs = await rows(S);
  ok(rs.length === 7, `清單 ${rs.length} 筆（7 局）`);
  ok(JSON.stringify(rs.map((r) => r.mdn)) === JSON.stringify([...names].reverse()), `新的在上、模式名正確：${rs.map((r) => r.mdn).join('｜')}`);
  const saved = (await today(S)).slice().reverse();
  ok(rs.every((r, i) => r.info === `解開 ${saved[i].detail.filter((x) => x.ok).length} / ${saved[i].detail.length} 題` && /^\d\d:\d\d$/.test(r.tm)), `每列摘要＝解開幾題／共幾題（${rs.map((r) => r.info.replace('解開 ', '').replace(' 題', '')).join('、')}）、時間 ${rs[0].tm}`);
  await S.screenshot({ path: SH + 'today_solo_7.png' });

  // ================= 2. 點單人那筆 =================
  console.log('== 2. 點單人那筆 → 題目清單 → 研究盤 → 返回');
  await S.evaluate(() => document.querySelectorAll('#todayList .rev a')[4].click());   // 新的在上：象牙塔、明鏡台分級、明鏡台無限、火眼金睛、無限之塔（第 5 列）
  await sleep(300);
  const rv1 = await S.evaluate(() => ({ today: document.getElementById('mToday').hidden, rev: document.getElementById('mReview').hidden, n: document.querySelectorAll('#revList .rev').length }));
  ok(rv1.today && !rv1.rev && rv1.n === 2, `題目清單開了、題數 ${rv1.n}（今日棋局清單暫時收起）`);
  await S.evaluate(() => document.querySelector('#revList .rev a').click()); await sleep(500);
  const rv2 = await S.evaluate(() => { const e = JSON.parse(localStorage.getItem('vcfgame.today')).filter((x) => x.mode === 'b4')[0]; return { rvw: !!rvw, body: document.body.classList.contains('rv'), blk: rvw && rvw.p.black.join(' '), wht: rvw && rvw.p.white.join(' '), b: e.detail[0].b, w: e.detail[0].w, seq: rvw && rvw.r.seq.length, twRev: !document.getElementById('twRev').hidden }; });
  ok(rv2.rvw && rv2.body && rv2.twRev && rv2.blk === rv2.b && rv2.wht === rv2.w && rv2.blk.split(' ').length > 3, `研究盤開了，盤面是那題的棋子（黑 ${rv2.blk.split(' ').length} 顆、白 ${rv2.wht.split(' ').length} 顆、手順 ${rv2.seq} 手）`);
  await S.screenshot({ path: SH + 'today_solo_rv.png' });
  await S.click('#rvBack'); await sleep(300);
  ok(await S.evaluate(() => !document.getElementById('mReview').hidden && !rvw), '研究盤返回 → 回題目清單');
  await S.evaluate(() => document.querySelector('#mReview [data-close]').click()); await sleep(300);
  ok(await S.evaluate(() => !document.getElementById('mToday').hidden && document.getElementById('mReview').hidden), '關掉題目清單 → 回到今日棋局清單');
  await S.keyboard.press('Escape'); await sleep(200);
  ok(await S.evaluate(() => document.getElementById('mToday').hidden && !document.getElementById('sHome').hidden), 'Esc 關閉 → 首頁，沒卡住');
  // 手機返回鍵：研究盤開著按瀏覽器返回 → 回題目清單（既有行為）
  await S.click('#homeRev'); await S.evaluate(() => document.querySelectorAll('#todayList .rev a')[0].click()); await sleep(200);
  await S.evaluate(() => document.querySelector('#revList .rev a').click()); await sleep(400);
  await S.goBack(); await sleep(400);
  ok(await S.evaluate(() => !rvw && !document.getElementById('mReview').hidden), '研究盤中按瀏覽器返回 → 回題目清單');
  await S.keyboard.press('Escape'); await sleep(300);
  await S.evaluate(() => { for (const m of document.querySelectorAll('.modal')) m.hidden = true; });
  // 重新整理後清單還在
  await S.reload(); await sleep(900);
  ok(!(await homeBtnHidden(S)), '重新整理後首頁仍有「今日棋局」');
  await S.click('#homeRev'); await sleep(200);
  ok((await rows(S)).length === 7, '重新整理後清單仍 7 筆');
  // 舊格式紀錄（只有 m、沒有 q）→ 覆盤重建手順寫回同一筆，不新增
  await S.evaluate(() => { const a = JSON.parse(localStorage.getItem('vcfgame.today')); const e = a.find((x) => x.mode === 'rank'); for (const x of e.detail) { x.m = x.q; delete x.q; } localStorage.setItem('vcfgame.today', JSON.stringify(a)); });
  await S.reload(); await sleep(900);
  await S.click('#homeRev'); await sleep(200);
  await S.evaluate(() => document.querySelectorAll('#todayList .rev a')[5].click()); await sleep(300);   // 第 6 列＝煉獄之門
  await S.evaluate(() => document.querySelector('#revList .rev a').click());
  await S.waitForFunction(() => { const e = JSON.parse(localStorage.getItem('vcfgame.today')).find((x) => x.mode === 'rank'); return e.detail[0].q; }, null, { timeout: 30000 });
  const rb = await today(S);
  ok(rb.length === 7 && rb.filter((x) => x.mode === 'rank').length === 1 && rb.find((x) => x.mode === 'rank').detail[0].q.split(' ').length >= 1, '覆盤重建手順：寫回今日棋局同一筆（仍 7 筆、煉獄之門只有 1 筆）');
  errsAll.push(...errs(S));
  await sctx.close();

  // ================= 3. 兩儀殿 =================
  console.log('== 3. 兩儀殿：兩人下完五子棋＋VCF');
  const junk = Array.from({ length: 400 }, (_, i) => ({ at: T0 - 1000 - (400 - i), src: 'solo', rid: 'j' + i, mode: 'rank', detail: [{ b: 'H8', w: 'H9', a: 'b', ok: 1 }], junk: i }));
  const actx = await ctxOf({ nick: 'Alice', seed: JSON.stringify(junk) }), bctx = await ctxOf({ nick: 'Bob' }), octx = await ctxOf({ nick: 'Obs' });
  const A = await open(actx, 'duel.html'), B = await open(bctx, 'duel.html'), O = await open(octx, 'duel.html');
  await newRoom(A, B, O, { t: 'create', kind: 'gomoku', time: 'none', rule: 'free', priv: false, color: 'b' });
  await playMoves(A, B, FIVE);
  await waitRoom(A, () => window.__duel.room.state === 'over'); await waitRoom(B, () => window.__duel.room.state === 'over'); await waitRoom(O, () => window.__duel.room.state === 'over');
  await sleep(600);
  const ta = await today(A), tb = await today(B), to = await today(O);
  const winPg = [A, B].find((p) => p.__seat === 0);
  ok(ta.length === 300 && ta.at(-1).src === 'duel' && ta[0].junk === 101, `A 的紀錄：寫入後 400 筆舊資料＋1 → 只留 300 筆、最新的在、丟的是最舊的（第一筆 junk ${ta[0].junk}）`);
  ok(tb.length === 1 && tb[0].src === 'duel', 'B 的紀錄 1 筆');
  ok(to.length === 0, '觀戰的 O 沒有寫（0 筆）');
  const ea = ta.at(-1), eb = tb[0];
  ok(ea.rec.kind === 'gomoku' && ea.rec.match.log.length === 9 && ea.rec.win === 0 && ea.rec.names[0] && ea.rec.mine === A.__seat && ea.rec.cols.length === 2 && ea.rec.result.winnerSeat === 0 && /^d[0-9a-z]+$/.test(ea.id), '五子棋 rec：kind、match.log 9 手、win、mine、cols、result、本機 id');
  ok(ea.sum.res === (A.__seat === 0 ? 'w' : 'l') && eb.sum.res === (B.__seat === 0 ? 'w' : 'l') && ea.sum.n === 9 && ea.sum.opp === 'Bob' && eb.sum.opp === 'Alice', `摘要：A ${ea.sum.res}／B ${eb.sum.res}、手數 ${ea.sum.n}、對手暱稱對`);
  console.log('  例（duel 筆，精簡）：', JSON.stringify({ ...ea, rec: { ...ea.rec, match: { ...ea.rec.match, log: '[' + ea.rec.match.log.length + ' 筆]' } } }).slice(0, 600));
  // 重新整理 A：同一局不重複
  await A.reload(); await sleep(1800);
  const back = await A.evaluate(() => ({ st: window.__duel.room && window.__duel.room.state, g: window.__duel.room && window.__duel.room.games }));
  const ta2 = await today(A);
  ok(ta2.length === 300 && ta2.at(-1).id === ea.id, `A 重新整理後同一局不重複寫（房間重送：${JSON.stringify(back)}）`);
  // 再來一局＋認輸
  await wsSend(A, { t: 'again' }); await wsSend(B, { t: 'again' });
  await waitRoom(A, () => window.__duel.room.state === 'play' && window.__duel.room.games === 2); await waitRoom(B, () => window.__duel.room.state === 'play' && window.__duel.room.games === 2);
  A.__seat = (await dRoom(A)).seat; B.__seat = (await dRoom(B)).seat;
  await playMoves(A, B, [112]);
  await wsSend(A, { t: 'resign' });
  await waitRoom(A, () => window.__duel.room.state === 'over'); await waitRoom(B, () => window.__duel.room.state === 'over'); await sleep(500);
  const ta3 = await today(A), tb3 = await today(B);
  ok(ta3.length === 300 && ta3.at(-1).id !== ea.id && tb3.length === 2 && ta3.at(-1).rec.note === 'resign' && ta3.at(-1).sum.res === 'l' && tb3.at(-1).sum.res === 'w', '再來一局：兩邊各多一筆（A 認輸＝負、B＝勝）');
  // VCF
  await wsSend(A, { t: 'leave' }); await wsSend(B, { t: 'leave' }); await wsSend(O, { t: 'leave' }); await sleep(500);
  await newRoom(A, B, O, { t: 'create', kind: 'vcf', vmode: 'eight', rank: 1, think: 60, target: 3, priv: false, color: 'b' });
  await vSolve(B, 0);
  for (let k = 0; k < 3; k++) await vSolve(A, k);
  await waitRoom(A, () => window.__duel.room.state === 'over', null, 30000); await waitRoom(B, () => window.__duel.room.state === 'over', null, 30000);
  await sleep(1200);
  const ta4 = await today(A), tb4 = await today(B), to4 = await today(O);
  const ev = ta4.at(-1), evb = tb4.at(-1);
  ok(ta4.length === 300 && tb4.length === 3 && ev.rec.kind === 'vcf' && evb.rec.kind === 'vcf', 'VCF（八仙渡）：兩位玩家各多一筆');
  ok(ev.rec.vmode === 'eight' && ev.rec.review.list.length >= 3 && ev.rec.review.logs.length === 2 && ev.rec.score[A.__seat] === 3 && ev.rec.score[1 - A.__seat] === 1 && ev.rec.win === A.__seat && ev.rec.vcf.vmode === 'eight', `VCF rec：vcf、score ${ev.rec.score}、review 題目 ${ev.rec.review.list.length}、兩人 logs`);
  ok(ev.sum.n === (A.__seat === 0 ? '3 : 1' : '1 : 3') && ev.sum.res === (A.__seat === 0 ? 'w' : 'l'), `VCF 摘要：比分「${ev.sum.n}」結果 ${ev.sum.res}`);
  ok(to4.length === 0, '觀戰的 O 仍是 0 筆');
  await A.reload(); await sleep(1500);
  await B.reload(); await sleep(1500);
  ok((await today(A)).length === 300 && (await today(B)).length === 3, 'VCF 結束後重新整理：不重複寫');
  errsAll.push(...errs(A), ...errs(B), ...errs(O));
  const duelSeed = JSON.stringify((await today(B)));   // B 的 3 筆（五子棋連五、認輸、VCF）
  const bEntries = await today(B);

  // ================= 4. 首頁點兩儀殿那筆 → 回看 =================
  console.log('== 4. 首頁 → 兩儀殿回看');
  await A.goto(BASE + '/game.html'); await sleep(900);
  ok(!(await homeBtnHidden(A)), 'A 首頁有今日棋局（300 筆舊資料不顯示，只顯示今天的）');
  await A.click('#homeRev'); await sleep(200);
  const ra = await rows(A);
  ok(ra.length === 3 && ra[0].mdn === '兩儀殿・VCF' && ra[1].mdn === '兩儀殿・五子棋' && ra[2].mdn === '兩儀殿・五子棋', `A 清單 3 筆：${ra.map((r) => r.mdn).join('｜')}`);
  ok(ra[1].info.includes('對 Bob') && ra[1].info.includes('負') && ra[1].info.includes('1 手') && ra[0].info.includes('對 Bob') && ra[0].info.includes(A.__seat === 0 ? '3 : 1' : '1 : 3'), `摘要：「${ra[0].info}」「${ra[1].info}」「${ra[2].info}」`);
  await A.screenshot({ path: SH + 'today_duel_3.png' });
  // 五子棋連五（第 3 列）
  await A.evaluate(() => document.querySelectorAll('#todayList .rev a')[2].click());
  await A.waitForFunction(() => location.pathname.endsWith('duel.html') && window.__duel && window.__duel.REPLAY, null, { timeout: 15000 }); await sleep(600);
  const r1 = await A.evaluate(() => ({ hash: location.hash, cur: window.__duel.REPLAY.cur, n: window.__duel.match.moves.length, room: document.getElementById('sRoom').hidden, status: document.getElementById('status').textContent }));
  ok(r1.hash === '' && r1.cur === 9 && r1.n === 9 && !r1.room, `進回看：hash 已清掉、停在最後一手 ${r1.cur}/${r1.n}（${r1.status}）`);
  const sg = await A.evaluate(() => window.__duel.cv.toDataURL());
  await A.click('[data-rp="prev"]'); await sleep(200);
  ok(await A.evaluate(() => window.__duel.REPLAY.cur) === 8 && (await A.evaluate(() => window.__duel.cv.toDataURL())) !== sg, '◀ 退一手：8 手、畫面少一顆子');
  await A.screenshot({ path: SH + 'replay_from_home_gomoku.png' });
  const sent1 = await sentTypes(A);
  ok(!sent1.some((t) => ['view', 'sit', 'leave', 'join', 'create', 'rec', 'recs'].includes(t)), `全程沒送 view／sit／leave／join／create／rec／recs（送過：${[...new Set(sent1)].join(',') || '無'}）`);
  await A.click('#rBack'); await A.waitForURL(/game\.html/, { timeout: 8000 }); await sleep(600);
  ok(await A.evaluate(() => !document.getElementById('sHome').hidden), '回看的返回鍵 → 回 game.html 首頁');
  // VCF（第 1 列）
  await A.click('#homeRev'); await sleep(200);
  await A.evaluate(() => document.querySelectorAll('#todayList .rev a')[0].click());
  await A.waitForFunction(() => location.pathname.endsWith('duel.html') && window.__duel && window.__duel.REPLAY && window.__duel.RV, null, { timeout: 15000 }); await sleep(600);
  const vbtn = await A.evaluate(() => [...document.querySelectorAll('#phaseActs button')].map((x) => x.textContent));
  ok(vbtn.includes('◀') && vbtn.includes('▶') && vbtn.includes('Alice') && vbtn.includes('Bob'), `VCF 回看：${vbtn.join('｜')}`);
  const v0 = await A.evaluate(() => window.__duel.cv.toDataURL());
  await A.click('[data-rv="next"]'); await sleep(500);
  ok(await A.evaluate(() => window.__duel.RV.k) === 1 && (await A.evaluate(() => window.__duel.cv.toDataURL())) !== v0, 'VCF：▶ 換下一題、畫面變');
  await A.click('[data-rv="1"]'); await sleep(400);
  ok(await A.evaluate(() => window.__duel.RV.who) === 1, 'VCF：換看另一位的手順');
  ok(!(await sentTypes(A)).some((t) => ['view', 'sit', 'leave', 'join', 'rec', 'recs'].includes(t)), 'VCF 回看也沒送房間訊息');
  await A.screenshot({ path: SH + 'replay_from_home_vcf.png' });
  await A.goBack(); await A.waitForURL(/game\.html/, { timeout: 8000 }); await sleep(600);
  ok(await A.evaluate(() => !document.getElementById('sHome').hidden), '瀏覽器返回鍵 → 回 game.html 首頁，不是空白');
  // 找不到那筆
  {
    const nctx = await ctxOf({ nick: 'New', seed: duelSeed });   // 另開一個沒有座位的玩家（A 還坐在 VCF 房，重連會被帶回房間，那是既有行為）
    const N = await open(nctx, 'duel.html#replay=dnotexist');
    ok(await N.evaluate(() => !document.getElementById('sLobby').hidden && !window.__duel.REPLAY && location.hash === ''), '#replay=找不到的 id → 照常顯示大廳、hash 清掉');
    errsAll.push(...errs(N)); await nctx.close();
  }
  errsAll.push(...errs(A));
  await actx.close(); await bctx.close(); await octx.close();

  // ================= 5. 大廳沒有切換鈕 ＋ 版面對照 =================
  console.log('== 5. 大廳');
  const src = readFileSync(VCF + '/duel.html', 'utf8');
  const bad = ["t: 'recs'", "t: 'rec'", 'lobTab', 'recCard', 'recPending', 'tabRecs', 'tabRooms', 'rpEmpty', 'recsDrawn', "m.t === 'recs'", "m.t === 'rec'"].filter((k) => src.includes(k));
  ok(bad.length === 0, `duel.html 沒有殘留切換鈕／送 recs／rec 的程式與字串${bad.length ? '：' + bad.join(',') : ''}`);
  const oldSrc = execSync('git show a157680:duel.html', { cwd: VCF, maxBuffer: 1 << 26 }).toString('utf8');
  writeFileSync(OLD, oldSrc);
  const meas = async (path) => {
    const c = await ctxOf({ nick: 'Cat' }); const p = await open(c, path); await sleep(500);
    const m = await p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return [Math.round(x.top), Math.round(x.height)]; }; return { list: r('#list'), thumb: r('.thumb'), net: r('#net'), me: r('.pad.me'), tabs: !!document.getElementById('lobTabs') }; });
    const sent = await sentTypes(p);
    errsAll.push(...errs(p)); await c.close(); return { m, sent };
  };
  const nw = await meas('duel.html'), od = await meas('duel_old_a157680_tmp.html');
  console.log('  新版', JSON.stringify(nw.m), ' 舊版(a157680)', JSON.stringify(od.m));
  ok(JSON.stringify(nw.m.list) === JSON.stringify(od.m.list) && JSON.stringify(nw.m.thumb) === JSON.stringify(od.m.thumb) && !nw.m.tabs, '#list 的位置與高度、下方按鈕列位置，跟加切換鈕之前（a157680）完全一樣；沒有 #lobTabs');
  ok(!nw.sent.includes('recs') && !nw.sent.includes('rec'), `大廳載入後沒送 recs／rec（送過：${[...new Set(nw.sent)].join(',')}）`);

  // ================= 6. 昨天、上限、壞掉的資料 =================
  console.log('== 6. 昨天／上限／壞資料');
  const mk = (i, at, extra = {}) => ({ at, src: 'solo', rid: 'x' + i, mode: 'rank', detail: [{ b: 'H8', w: 'H9', a: 'b', ok: 1, r: 1, L: 3, s: 5, sec: 1, e: 0, id: 'p' }], ...extra });
  const c6 = await ctxOf({ nick: 'Cat', tower });
  const P6 = await open(c6, 'game.html');
  await setStore(P6, JSON.stringify([mk(1, T0 - 1), mk(2, T0 - 86400e3)])); await P6.reload(); await sleep(700);
  ok(await homeBtnHidden(P6), '全部都是昨天：首頁按鈕不顯示');
  await setStore(P6, JSON.stringify([mk(1, T0 - 1), mk(2, T0 + 5000), mk(3, T0 + 9000)])); await P6.reload(); await sleep(700);
  ok(!(await homeBtnHidden(P6)), '有一筆今天：按鈕顯示');
  await P6.click('#homeRev'); await sleep(200);
  const r6 = await rows(P6);
  ok(r6.length === 2, `昨天那筆不出現在清單（${r6.length} 筆）`);
  const entriesDuelYday = [{ at: T0 - 5, src: 'duel', id: 'dyday', sum: { kind: 'gomoku', opp: 'X', res: 'w', n: 5 }, rec: {} }];
  await setStore(P6, JSON.stringify(entriesDuelYday)); await P6.reload(); await sleep(700);
  ok(await homeBtnHidden(P6), '昨天的兩儀殿紀錄也不顯示');
  // 400 筆（今天）＋收一局 → 只留 300
  await setStore(P6, JSON.stringify(Array.from({ length: 400 }, (_, i) => mk(i, T0 + 1000 + i * 10, { junk: i }))));
  await P6.reload(); await sleep(700);
  await startMode(P6, 'modeP'); await solveN(P6, 1); await endRun(P6, false);
  const t6 = await today(P6);
  ok(t6.length === 300 && t6.at(-1).mode === 'prac' && t6[0].junk === 101, `塞 400 筆今天的資料再收一局：只留 300 筆、最新的還在、第一筆是 junk ${t6[0].junk}`);
  // 滿了（setItem 丟例外）就丟最舊的再試
  const q = await P6.evaluate(() => {
    const big = Array.from({ length: 150 }, (_, i) => ({ at: Date.now() + i, src: 'solo', rid: 'q' + i, mode: 'rank', detail: [{ b: 'x'.repeat(1000) }], idx: i }));
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vcfgame.today' && v.length > 100000) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); };
    let res; try { res = todayWrite(big); } finally { Storage.prototype.setItem = orig; }
    const a = JSON.parse(localStorage.getItem('vcfgame.today'));
    return { res, n: a.length, first: a[0].idx, last: a.at(-1).idx };
  });
  ok(q.res === true && q.n < 150 && q.n > 50 && q.last === 149, `game.html 寫入失敗時丟最舊的再試：150 → ${q.n} 筆（第一筆 ${q.first}、最新 ${q.last} 在）`);
  // 壞資料
  await setStore(P6, '{不是 json'); await P6.reload(); await sleep(700);
  ok(await homeBtnHidden(P6) && errs(P6).length === 0, 'game.html：vcfgame.today 不是 JSON → 當成空的、沒有錯誤');
  await setStore(P6, JSON.stringify({ a: 1 })); await P6.reload(); await sleep(700);
  ok(await homeBtnHidden(P6) && errs(P6).length === 0, 'game.html：內容不是陣列 → 當成空的');
  await setStore(P6, '{不是 json');
  await startMode(P6, 'modeP'); await solveN(P6, 1); await endRun(P6, false);
  ok((await today(P6)).length === 1, 'game.html：壞資料狀態下收一局 → 直接蓋成新的 1 筆');
  errsAll.push(...errs(P6)); await c6.close();
  // duel.html 端
  const c6d = await ctxOf({ nick: 'Cat' });
  const D6 = await open(c6d, 'duel.html');
  const dq = await D6.evaluate(() => {
    const big = Array.from({ length: 150 }, (_, i) => ({ at: Date.now() + i, src: 'duel', id: 'q' + i, detail: 'x'.repeat(1000), idx: i }));
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vcfgame.today' && v.length > 100000) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); };
    let res; try { res = window.__duel.todayWrite(big); } finally { Storage.prototype.setItem = orig; }
    const a = JSON.parse(localStorage.getItem('vcfgame.today'));
    const cap = (() => { window.__duel.todayWrite(Array.from({ length: 400 }, (_, i) => ({ at: i, idx: i }))); return JSON.parse(localStorage.getItem('vcfgame.today')); })();
    return { res, n: a.length, last: a.at(-1).idx, capN: cap.length, capFirst: cap[0].idx, capLast: cap.at(-1).idx };
  });
  ok(dq.res === true && dq.n < 150 && dq.last === 149 && dq.capN === 300 && dq.capFirst === 100 && dq.capLast === 399, `duel.html 同樣：滿了丟舊的（150 → ${dq.n}）、400 筆只留 300（${dq.capFirst}…${dq.capLast}）`);
  await D6.evaluate(() => localStorage.setItem('vcfgame.today', '{不是 json'));
  ok(await D6.evaluate(() => window.__duel.todayRead().length === 0), 'duel.html：壞資料讀出來是空陣列');
  await c6d.pages()[0].close();
  const D7 = await open(c6d, 'duel.html#replay=dx');
  ok(await D7.evaluate(() => !document.getElementById('sLobby').hidden) && errs(D7).length === 0, 'duel.html：壞資料＋#replay → 顯示大廳、沒有錯誤');
  errsAll.push(...errs(D6), ...errs(D7)); await c6d.close();

  // ================= 7. 不可捲動 =================
  console.log('== 7. 版面：4 語言 × 2 尺寸');
  const bigList = JSON.stringify(Array.from({ length: 40 }, (_, i) => { const base = i % 2 ? bEntries[i % 3] : JSON.parse(soloSeed)[i % 7]; return { ...base, at: Math.max(T0 + 1, Date.now() - i * 60000) }; }));
  const one = JSON.stringify([JSON.parse(soloSeed)[0]]);
  for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[375, 667], [360, 640]]) {
    const tag = `${lang} ${w}×${h}`;
    const c = await ctxOf({ lang, w, h, nick: 'Cat', seed: '[]' });
    const p = await open(c, 'game.html');
    const chk = async (what) => { const r = await fits(p); ok(r.good, `${tag} ${what}：高 ${r.f.sh}/${r.f.ih} 寬 ${r.f.sw}/${r.f.iw}`); };
    await chk('首頁（無按鈕）');
    await setStore(p, one); await p.reload(); await sleep(600);
    ok(!(await homeBtnHidden(p)), `${tag} 有紀錄 → 按鈕出現`);
    await chk('首頁（有按鈕）');
    await p.click('#homeRev'); await sleep(250);
    await chk('今日棋局清單（1 筆）');
    let box = await p.evaluate(() => { const b = document.querySelector('#mToday .box').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, ih: innerHeight }; });
    ok(box.top >= 0 && box.bottom <= box.ih + 1, `${tag} 清單視窗在畫面內（1 筆）`);
    if (lang === 'zh' && w === 375) await p.screenshot({ path: SH + 'today_1_zh_375.png' });
    await p.evaluate(() => document.querySelector('#mToday [data-close]').click());
    await setStore(p, bigList); await p.reload(); await sleep(600);
    await p.click('#homeRev'); await sleep(250);
    await chk('今日棋局清單（40 筆）');
    const inner = await p.evaluate(() => { const bx = document.querySelector('#mToday .box'); const wide = [...document.querySelectorAll('#todayList .rev')].filter((r) => r.scrollWidth > r.clientWidth + 1).length; return { scroll: bx.scrollHeight > bx.clientHeight, ov: getComputedStyle(bx).overflowY, wide, n: document.querySelectorAll('#todayList .rev').length }; });
    ok(inner.n === 40 && inner.scroll && inner.ov === 'auto' && inner.wide === 0, `${tag} 40 筆：清單在自己的區塊內捲、列沒有橫向溢出`);
    if (lang === 'en' && w === 360) await p.screenshot({ path: SH + 'today_40_en_360.png' });
    if (lang === 'ko' && w === 375) await p.screenshot({ path: SH + 'today_40_ko_375.png' });
    // 兩儀殿：大廳、回看
    await setStore(p, duelSeed);
    let d = await open(c, 'duel.html');
    const chkd = async (what) => { const r = await fits(d); ok(r.good, `${tag} ${what}：高 ${r.f.sh}/${r.f.ih} 寬 ${r.f.sw}/${r.f.iw}`); };
    await chkd('兩儀殿大廳');
    const ids = bEntries.map((e) => e.id);
    for (const [i, what] of [[0, '五子棋回看'], [2, 'VCF 回看']]) {
      await d.close(); d = await open(c, 'duel.html#replay=' + ids[i]); await sleep(300);
      ok(await d.evaluate(() => !!window.__duel.REPLAY), `${tag} ${what}進得去`);
      await chkd(what);
      if (i === 0) { await d.click('[data-rp="prev"]'); await sleep(150); await chkd('五子棋回看（退一手）'); }
      if (lang === 'zh' && w === 375 && i === 2) await d.screenshot({ path: SH + 'replay_vcf_zh_375.png' });
    }
    errsAll.push(...errs(p), ...errs(d));
    await c.close();
  }
  ok(errsAll.length === 0, '全程沒有 JS 錯誤 ' + JSON.stringify(errsAll));
} catch (e) {
  console.log('  FAIL 腳本例外：', e && e.stack || e);
  L.ok(false, '腳本例外');
}
try { if (b) await b.close(); } catch {}
killAll();
try { rmSync(PERSIST, { recursive: true, force: true }); } catch {}
const f = L.done();
process.exit(f ? 1 : 0);
