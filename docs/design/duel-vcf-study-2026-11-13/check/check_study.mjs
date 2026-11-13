// 兩儀殿 VCF 覆盤「自己擺」檢查：node check_study.mjs（前景執行；NEG=1 是負向測試，應該 FAIL）。
// 自己起停：http.server 8795（頁面）、wrangler dev 8789（兩儀殿，persist 放 TEMP）；只用 PID 關自己啟動的行程。截圖只存本資料夾的 shots/。
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
const { ok, sleep } = L;
const HERE = dirname(fileURLToPath(import.meta.url)), SH = HERE + '/shots/';
const VCF = 'C:/claudehome/projects/VCF', BASE = 'http://127.0.0.1:8795';
const PERSIST = tmpdir() + '/wstate-study-' + Date.now();
const NEG = process.env.NEG === '1';
mkdirSync(SH, { recursive: true });
let srv = null, srv2 = null, b = null;
const killAll = () => { if (srv2) { try { execSync(`taskkill /PID ${srv2} /T /F`, { stdio: 'ignore' }); } catch {} srv2 = null; } if (srv) { try { execSync(`taskkill /PID ${srv} /T /F`, { stdio: 'ignore' }); } catch {} srv = null; } L.stopWr(); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} };
const errsOf = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
const errsAll = [];

async function ctxOf({ lang = 'zh', w = 375, h = 667, nick = 'Cat', seed = null } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await c.addInitScript(([lang, nick, seed]) => {
    const W = window.WebSocket; window.__sent = [];
    window.WebSocket = function (u, p) {
      const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__ws = ws;
      const s0 = ws.send.bind(ws); ws.send = (d) => { window.__sent.push(String(d)); return s0(d); };
      return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    try {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('__seeded', '1');
        localStorage.setItem('vcfgame.lang', lang); localStorage.setItem('vcfgame.duel.tap', '1'); localStorage.setItem('vcfgame.nick', nick);
        if (seed !== null) localStorage.setItem('vcfgame.today', seed);
      }
    } catch {}
  }, [lang, nick, seed]);
  return c;
}
async function open(c, path) {
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(BASE + '/' + path); await sleep(1000);
  return p;
}
const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
const waitRoom = (p, fn, arg, ms = 30000) => p.waitForFunction(fn, arg, { timeout: ms });
const dRoom = (p) => p.evaluate(() => { const d = window.__duel, r = d.room; return r ? { id: r.id, state: r.state, seat: d.mySeat() } : null; });
async function newRoom(A, B, cfg) {
  await wsSend(A, { t: 'create', ...cfg });
  await waitRoom(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  const id = (await dRoom(A)).id;
  await wsSend(B, { t: 'view', room: id }); await waitRoom(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
  await wsSend(B, { t: 'sit', room: id, seat: 1 });
  await waitRoom(A, () => window.__duel.room.state === 'play'); await waitRoom(B, () => window.__duel.room.state === 'play');
  A.__seat = (await dRoom(A)).seat; B.__seat = (await dRoom(B)).seat;
}
// 用本機引擎算這題的真解，回報 vdone（伺服器信任回報）
async function vSolveReal(p, k) {
  await p.waitForFunction((k) => { const d = window.__duel, r = d.room, s = d.mySeat(), st = r && r.vs && r.vs.p[s]; return st && st.puzzle && st.i === k && st.s === 'think' && Date.now() >= st.at - 50; }, k, { timeout: 60000 });
  const seq = await p.evaluate(async () => {
    const d = window.__duel, P = d.VR.p;
    const r = await d.vSolve(P.black.join(' '), P.white.join(' '), P.atkWhite);
    return r && r.result && r.result.solution ? String(r.result.solution).replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean) : [];
  });
  await wsSend(p, { t: 'vdone', n: k, seq: seq.length ? seq : ['H8'] });
}

// ---------- 畫面上的量測 ----------
const hook = (p) => p.evaluate(() => { window.__nums = []; const db = RushSkin.drawBoard; RushSkin.drawBoard = function (...a) { window.__nums = []; return db.apply(this, a); }; const f = RushSkin.fillNum; RushSkin.fillNum = function (c, s, ...r) { window.__nums.push(s); return f.call(this, c, s, ...r); }; });
const st = (p) => p.evaluate(() => { const d = window.__duel, R = d.RV, x = d.room.vs.review.list[R.k]; return { k: R.k, who: R.who, free: R.free ? [...R.free] : null, black: x[0].split(' ').filter(Boolean), white: x[1].split(' ').filter(Boolean), atkWhite: x[4] === 'w' }; });
// 畫面重畫一次後，取手順數字（renderRoom 會重畫；用 phase 按鈕以外的方式：直接呼叫全域 draw）
const redrawNums = (p) => p.evaluate(() => window.__nums.slice());   // 最近一次 draw() �AAA的手順數字
// 點棋盤上某個 token（例 'H8'）
async function tapT(p, t) {
  const r = await p.evaluate((t) => { const d = window.__duel, q = d.xyOf(d.tToP(t)), b = d.cv.getBoundingClientRect(); return { x: b.left + q[0], y: b.top + q[1] }; }, t);
  if (!globalThis.__dbg) { globalThis.__dbg = 1; console.log('  [debug] tap', t, JSON.stringify(r), await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e && (e.id || e.tagName)) + ' vp ' + innerWidth + 'x' + innerHeight; }, [r.x, r.y])); }
  await p.mouse.click(r.x, r.y); await sleep(250);
}
// 某個 token 那格的石子顏色：'b' 黑 / 'w' 白 / null 沒子（取石子邊緣內側、避開手順數字）
const colorAt = (p, t) => p.evaluate((t) => {
  const d = window.__duel, q = d.xyOf(d.tToP(t)), cv = d.cv, bw = cv.getBoundingClientRect().width, dpr = cv.width / bw, cell = bw * 0.91 / 14, c2 = cv.getContext('2d');
  const lumAt = (x, y) => { const px = c2.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return (px[0] + px[1] + px[2]) / 3; };
  const s = lumAt(q[0] - cell * 0.25, q[1] - cell * 0.25), e = lumAt(q[0] + cell * 0.5, q[1] + cell * 0.5);   // 石子邊緣內側 vs 同格斜角的棋盤底色
  return { s: Math.round(s), e: Math.round(e) };
}, t);
// 'b' 黑子／'w' 白子／'-' 沒子
const kind = async (p, t) => { const { s, e } = await colorAt(p, t); return Math.abs(s - e) < 25 ? '-' : s < e ? 'b' : 'w'; };
// 找 n 個還空著的點（不在題目、也不在目前顯示的手順上）
const freePts = (p, n) => p.evaluate((n) => {
  const d = window.__duel, R = d.RV, x = d.room.vs.review.list[R.k], occ = new Set([...x[0].split(' '), ...x[1].split(' ')].filter(Boolean));
  const cur = R.free || (R.who === 'sol' ? R.sol.get(R.k) : d.room.vs.review.logs[R.who][R.k]?.seq) || []; cur.forEach((t) => occ.add(t));
  const out = [];
  for (const c of [112, 111, 113, 97, 127, 96, 128, 126, 98, 110, 114]) { const t = 'ABCDEFGHJKLMNOP'[c % 15] + (15 - Math.floor(c / 15)); if (!occ.has(t)) out.push(t); if (out.length === n) break; }
  return out;
}, n);
import { writeFileSync } from 'node:fs';
const dump = async (p, name) => writeFileSync(SH + name + '.png', Buffer.from((await dumpImg(p, name)).split(',')[1], 'base64'));
const sentN = (p) => p.evaluate(() => window.__sent.length);
// 畫面簽章：225 點的 黑／白／空（逐點取樣）＋最近一次 draw 的手順數字。不比整張 dataURL（棋盤底圖每次重畫有些微像素差，已確認兩張目視相同但有 1422 點不同）
const sig = (p) => p.evaluate(() => {
  const d = window.__duel, cv = d.cv, bw = cv.getBoundingClientRect().width, dpr = cv.width / bw, cell = bw * 0.91 / 14, c2 = cv.getContext('2d');
  const lumAt = (x, y) => { const px = c2.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return (px[0] + px[1] + px[2]) / 3; };
  let s = '';
  for (let q = 0; q < 225; q++) { const [x, y] = d.xyOf(q), a = lumAt(x - cell * 0.25, y - cell * 0.25), e = lumAt(x + cell * 0.5, y + cell * 0.5); s += Math.abs(a - e) < 25 ? '-' : a < e ? 'b' : 'w'; }
  return s + '|' + (window.__nums || []).join(',');
});
const dumpImg = (p, name) => p.evaluate(() => window.__duel.cv.toDataURL());
const fits = (p) => p.evaluate(() => {
  const d = document.documentElement, bad = [], iw = innerWidth, ih = innerHeight;
  document.querySelectorAll('button').forEach((el) => { if (!el.offsetParent) return; const r = el.getBoundingClientRect(); if (r.width && (r.bottom > ih + 0.5 || r.right > iw + 0.5 || r.left < -0.5 || r.top < -0.5)) bad.push((el.id || el.className) + ':' + el.textContent.trim().slice(0, 10)); });
  const small = [...document.querySelectorAll('#phaseActs .btn')].filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((el) => el.dataset.rv + ':' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
  return { sh: d.scrollHeight, ih, sw: d.scrollWidth, iw, bad, small };
});
const btns = (p) => p.evaluate(() => [...document.querySelectorAll('#phaseActs button')].map((x) => x.dataset.rv || x.dataset.rp));

try {
  srv = spawn('python', ['-m', 'http.server', '8795', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  srv2 = spawn('python', ['-m', 'http.server', '8791', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;   // 兩儀殿伺服器讀題庫的埠
  await L.startWr(PERSIST);
  await sleep(4000);   // wrangler 剛起來，先等它穩
  b = await L.launch();

  // ================= 1. 兩人打一場（先五子棋連五，再 VCF 八仙渡） =================
  console.log('== 1. 開局：先打一盤五子棋（回看對照用），再打 VCF');
  const actx = await ctxOf({ nick: 'Alice' }), bctx = await ctxOf({ nick: 'Bob' });
  const A = await open(actx, 'duel.html'), B = await open(bctx, 'duel.html');
  await newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'free', priv: false, color: 'b' });
  for (const pt of L.FIVE) {
    const m = await A.evaluate(() => window.__duel.room.match); const n = m.log.length;
    const { replayMatch, actorOf } = await import('file:///C:/claudehome/projects/VCF/game/duel/match.js');
    const act = actorOf(replayMatch(m.config, m.log, m.startedAt)), mover = [A, B].find((p) => p.__seat === act);
    await wsSend(mover, { t: 'move', p: pt });
    await waitRoom(A, (n) => window.__duel.room.match.log.length === n + 1, n); await waitRoom(B, (n) => window.__duel.room.match.log.length === n + 1, n);
  }
  await waitRoom(A, () => window.__duel.room.state === 'over'); await sleep(600);
  await wsSend(A, { t: 'leave' }); await wsSend(B, { t: 'leave' }); await sleep(500);
  await newRoom(A, B, { t: 'create', kind: 'vcf', vmode: 'eight', rank: 1, think: 60, target: 3, priv: false, color: 'b' });
  await vSolveReal(B, 0);
  for (let k = 0; k < 3; k++) await vSolveReal(A, k);
  await waitRoom(A, () => window.__duel.room.state === 'over' && window.__duel.RV, null, 40000); await waitRoom(B, () => window.__duel.room.state === 'over', null, 40000);
  await sleep(1200);
  await A.waitForFunction(() => !document.getElementById('mEnd').hidden, null, { timeout: 8000 }).catch(() => {});
  ok(await A.evaluate(() => !document.getElementById('mEnd').hidden), '賽後先跳結算視窗（mEnd）');
  await A.screenshot({ path: SH + 'live_end_dialog_zh_375.png' });
  await A.click('#bLook'); await sleep(400);   // 「看每題解法」：跟真人一樣先關結算視窗
  ok(await A.evaluate(() => document.getElementById('mEnd').hidden), 'VCF 打完，A 按「看每題解法」進賽後逐題回看');
  await A.screenshot({ path: SH + 'live_review_zh_375.png' });

  // ================= 2. 賽後逐題回看：自己擺 =================
  console.log('== 2. 賽後逐題回看（A 的房間畫面）');
  await hook(A);
  const bt0 = await btns(A);
  ok(bt0.join(',') === 'prev,next,sol,' + (A.__seat === 0 ? '0,1' : '1,0') + ',undo,reset', `工具列在同一列：${bt0.join(',')}`);
  const s0 = await st(A);
  ok(s0.who === 'sol' && s0.free === null, '一開始看正解、沒有自己擺的');
  await A.click('[data-rv="sol"]'); await sleep(300);   // 重畫一次，讓手順數字記錄跟著進來
  const sigSol = await sig(A);
  const n0 = await sentN(A);
  // 2a 從題目開頭擺（先「回到這題開頭」，空盤）
  await A.click('[data-rv="reset"]'); await sleep(250);
  let s = await st(A);
  ok(s.free && s.free.length === 0, '回到這題開頭 → 自己擺的線是空的（只剩題目）');
  const sigBase = await sig(A);
  ok(sigBase !== sigSol || s0.free === null, '回到開頭 → 畫面跟正解不同（正解的手順數字消失）');
  const [t1, t2, t3] = await freePts(A, 3);
  await tapT(A, t1);
  s = await st(A);
  ok(s.free.length === (NEG ? 2 : 1) && s.free[0] === t1, `點空點 ${t1} → 多一顆子（${JSON.stringify(s.free)}）`);
  console.log('  [debug] lum t1 after tap', JSON.stringify(await colorAt(A, t1)));
  const c1 = await kind(A, t1), want1 = s0.atkWhite ? 'w' : 'b';
  ok(c1 === want1, `第一手顏色＝攻方（${s0.atkWhite ? '白' : '黑'}先）：畫面 ${c1}`);
  ok(JSON.stringify(await redrawNums(A)) === '["1"]', '標手順數字 1');
  await tapT(A, t2);
  const c2 = await kind(A, t2);
  ok(c2 === (s0.atkWhite ? 'b' : 'w'), `再點 → 對方顏色：畫面 ${c2}`);
  ok(JSON.stringify(await redrawNums(A)) === '["1","2"]', '手順數字 1、2');
  await tapT(A, t3);
  ok((await st(A)).free.length === 3 && await kind(A, t3) === want1, '第三手又是攻方顏色');
  await A.screenshot({ path: SH + 'study_live_zh_375_3moves.png' });
  // 2b 點已有子的點
  const sig3 = await sig(A);
  await tapT(A, t2);   // 自己擺的子
  const pz = (await st(A));
  await tapT(A, pz.black[0]); await tapT(A, pz.white[0] || pz.black[1]);   // 題目的子
  ok((await st(A)).free.length === 3 && await sig(A) === sig3, '點已有子的點（自己擺的、題目黑、題目白）→ 沒有變化');
  // 2c 退一手、回到開頭
  await A.click('[data-rv="undo"]'); await sleep(250);
  s = await st(A);
  ok(s.free.length === 2 && await kind(A, t3) === '-', '退一手 → 少一顆子（2 手）');
  ok(JSON.stringify(await redrawNums(A)) === '["1","2"]', '退一手後手順數字只剩 1、2');
  await A.click('[data-rv="reset"]'); await sleep(250);
  ok((await st(A)).free.length === 0 && await sig(A) === sigBase, '回到這題開頭 → 回到題目原樣（跟一開始按回到開頭時像素相同）');
  // 2d 先看正解走幾步，再接著擺
  await A.click('[data-rv="sol"]'); await sleep(250);
  const sol = await A.evaluate(() => { const R = window.__duel.RV; return R.sol.get(R.k) || null; });
  ok((await st(A)).free === null && await sig(A) === sigSol, '按正解 → 自己擺的消失、回到正解原樣（像素相同）');
  const [u1] = await freePts(A, 1);
  await tapT(A, u1);
  s = await st(A);
  ok(sol && s.free.length === sol.length + 1 && s.free.slice(0, sol.length).join(' ') === sol.join(' ') && s.free.at(-1) === u1, `從正解局面接下去：正解 ${sol ? sol.length : '?'} 手＋1，前段相同`);
  ok(JSON.stringify(await redrawNums(A)) === JSON.stringify(Array.from({ length: s.free.length }, (_, i) => String(i + 1))), '手順數字連續');
  await A.click('[data-rv="sol"]'); await sleep(250);
  ok((await st(A)).free === null && await sig(A) === sigSol, '切回正解 → 自己擺的消失');
  // 2e 退一手（沒擺過）：從目前顯示的手順退一手
  if (sol && sol.length > 0) { await A.click('[data-rv="undo"]'); await sleep(250); ok((await st(A)).free.length === sol.length - 1, '沒擺過時按退一手 → 從正解退一手'); await A.click('[data-rv="sol"]'); await sleep(250); }
  // 2f 玩家分頁
  const other = A.__seat === 0 ? 1 : 0;
  await A.click(`[data-rv="${A.__seat}"]`); await sleep(250);
  const [v1] = await freePts(A, 1); await tapT(A, v1);
  ok((await st(A)).free !== null, '看我的手順時也能自己擺');
  await A.click(`[data-rv="${other}"]`); await sleep(250);
  ok((await st(A)).free === null && (await st(A)).who === other, '切到對手的手順 → 自己擺的消失');
  await A.click('[data-rv="sol"]'); await sleep(250);
  // 2g 換題
  const [w1] = await freePts(A, 1); await tapT(A, w1);
  ok((await st(A)).free !== null && (await st(A)).k === 0, '第 1 題擺了一手');
  await A.click('[data-rv="next"]'); await sleep(500);
  s = await st(A);
  ok(s.k === 1 && s.free === null, '換到下一題 → 自己擺的消失');
  await A.click('[data-rv="prev"]'); await sleep(300);
  ok((await st(A)).k === 0 && (await st(A)).free === null, '換回第 1 題也是乾淨的');
  // 2h 沒有 WebSocket 訊息
  const nEnd = await sentN(A);
  ok(nEnd === n0, `自己擺（點棋盤、退一手、回開頭、切換）全程沒有送出 WebSocket 訊息（${n0} → ${nEnd}）`);
  // 2i 觸控範圍、不捲動
  const f0 = await fits(A);
  ok(f0.sh <= f0.ih && f0.sw <= f0.iw && !f0.bad.length && !f0.small.length, `zh 375×667 賽後畫面：不捲動、按鈕都在畫面內、回看按鈕 ≥44px（${JSON.stringify(f0)}）`);
  errsAll.push(...errsOf(A), ...errsOf(B));

  // ================= 3. 首頁「今日棋局」→ 回看 =================
  console.log('== 3. 首頁今日棋局 → 回看（#replay=）');
  const today = await A.evaluate(() => JSON.parse(localStorage.getItem('vcfgame.today')));
  ok(today.length === 2 && today.some((e) => e.rec.kind === 'vcf') && today.some((e) => e.rec.kind === 'gomoku'), `A 本機有 2 筆今日棋局（${today.map((e) => e.rec.kind).join(',')}）`);
  await A.goto(BASE + '/game.html'); await sleep(900);
  await A.click('#homeRev'); await sleep(200);
  const idx = await A.evaluate(() => [...document.querySelectorAll('#todayList .rev')].findIndex((r) => /VCF/.test(r.querySelector('.mdn').textContent)));
  await A.evaluate((i) => document.querySelectorAll('#todayList .rev a')[i].click(), idx);
  await A.waitForFunction(() => location.pathname.endsWith('duel.html') && window.__duel && window.__duel.REPLAY && window.__duel.RV, null, { timeout: 15000 }); await sleep(700);
  await hook(A);
  const nR0 = await sentN(A);
  ok((await btns(A)).join(',').endsWith('undo,reset'), `回看畫面也有自己擺的按鈕：${(await btns(A)).join(',')}`);
  await A.click('[data-rv="sol"]'); await sleep(400);
  const sigR = await sig(A);
  const [r1, r2] = await freePts(A, 2);
  await tapT(A, r1); await tapT(A, r2);
  s = await st(A);
  const cr = await kind(A, r1);
  ok(s.free && s.free.length >= 2 && s.free.slice(-2).join() === [r1, r2].join() && cr !== '-', `回看：點兩下 → 接在正解後面擺了 2 手（共 ${s.free && s.free.length}）`);
  ok(await kind(A, r1) !== await kind(A, r2) && await kind(A, r1) !== '-' && await kind(A, r2) !== '-', '回看：兩手顏色不同（輪流）');
  await A.click('[data-rv="undo"]'); await sleep(200);
  ok((await st(A)).free.length === s.free.length - 1, '回看：退一手');
  await A.click('[data-rv="reset"]'); await sleep(200);
  ok((await st(A)).free.length === 0, '回看：回到這題開頭');
  await A.click('[data-rv="sol"]'); await sleep(250);
  ok((await st(A)).free === null && await sig(A) === sigR, '回看：切回正解 → 原樣');
  await tapT(A, (await freePts(A, 1))[0]);
  await A.click('[data-rv="next"]'); await sleep(400);
  ok((await st(A)).free === null, '回看：換題 → 清掉');
  const nR1 = await sentN(A);
  ok(nR1 === nR0, `回看自己擺沒有 WebSocket 訊息（${nR0} → ${nR1}）`);
  errsAll.push(...errsOf(A));

  // ================= 4. 五子棋回看不變 =================
  console.log('== 4. 五子棋回看');
  await A.goto(BASE + '/game.html'); await sleep(900);
  await A.click('#homeRev'); await sleep(200);
  const gi = await A.evaluate(() => [...document.querySelectorAll('#todayList .rev')].findIndex((r) => /五子棋/.test(r.querySelector('.mdn').textContent)));
  await A.evaluate((i) => document.querySelectorAll('#todayList .rev a')[i].click(), gi);
  await A.waitForFunction(() => location.pathname.endsWith('duel.html') && window.__duel && window.__duel.REPLAY && window.__duel.match, null, { timeout: 15000 }); await sleep(600);
  const gb = await btns(A);
  ok(gb.join(',') === 'first,prev,next,last', `五子棋回看按鈕仍是 4 個 rp：${gb.join(',')}`);
  const gs = await sig(A), gc = await A.evaluate(() => window.__duel.REPLAY.cur);
  await tapT(A, 'H8'); await tapT(A, 'A1');
  ok(await sig(A) === gs && await A.evaluate(() => window.__duel.REPLAY.cur) === gc, '五子棋回看點棋盤沒有反應');
  await A.screenshot({ path: SH + 'replay_gomoku_zh_375.png' });
  errsAll.push(...errsOf(A));

  // ================= 5. 四語 × 兩種尺寸：回看不捲動 =================
  console.log('== 5. 四語 × 375×667、360×640');
  const seed = JSON.stringify(today);
  const vid = today.find((e) => e.rec.kind === 'vcf').id;
  for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[375, 667], [360, 640]]) {
    const c = await ctxOf({ lang, w, h, nick: 'Alice', seed });
    const d = await open(c, 'duel.html#replay=' + vid);
    await d.waitForFunction(() => window.__duel && window.__duel.RV, null, { timeout: 15000 }); await sleep(500);
    await hook(d);
    const [p1, p2, p3] = await freePts(d, 3);
    await d.click('[data-rv="reset"]'); await sleep(200);
    for (const p of [p1, p2, p3]) await tapT(d, p);
    const f = await fits(d);
    const tabs = await d.evaluate(() => [...document.querySelectorAll('#phaseActs .rvt')].map((x) => ({ t: x.textContent, cut: x.scrollWidth > x.clientWidth + 1, w: Math.round(x.getBoundingClientRect().width) })));
    ok(f.sh <= f.ih && f.sw <= f.iw && !f.bad.length && !f.small.length && !tabs.some((x) => x.cut), `${lang} ${w}×${h}：不捲動、按鈕在畫面內、≥44px（sh ${f.sh}/${f.ih}、sw ${f.sw}/${f.iw}、bad ${JSON.stringify(f.bad)}、small ${JSON.stringify(f.small)}）；分頁 ${JSON.stringify(tabs)}`);
    ok((await st(d)).free.length === 3, `${lang} ${w}×${h}：擺了 3 手`);
    if ((lang === 'zh' && w === 375) || (lang === 'en' && w === 360)) await d.screenshot({ path: SH + `study_replay_${lang}_${w}x${h}.png` });
    errsAll.push(...errsOf(d));
    await c.close();
  }
  ok(errsAll.length === 0, `全程沒有 pageerror／console error（${errsAll.length}）${errsAll.slice(0, 3).join(' | ')}`);
} catch (e) {
  console.log('  FAIL 腳本例外：' + (e && e.stack || e)); L.ok(false, '腳本例外');
} finally {
  if (b) await b.close().catch(() => {});
  killAll();
}
const f = L.done();
process.exit(f ? 1 : 0);
