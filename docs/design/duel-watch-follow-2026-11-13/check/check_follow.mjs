// 兩儀殿 VCF 觀戰自動追焦檢查：node check_follow.mjs（前景執行；NEG=1 是負向測試，應該有 FAIL）。
// 三個 context：A、B 兩位玩家＋C 觀戰。自己起停：http.server 8795（頁面）、8791（題庫）、wrangler dev 8789；只用 PID 關自己啟動的行程。
// 截圖只存本資料夾的 shots/。玩家用本機引擎算真解，用 ws 送 vprog／vdone／vout（跟真頁面送的訊息一樣）。
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
const { ok, sleep } = L;
const HERE = dirname(fileURLToPath(import.meta.url)), SH = HERE + '/shots/';
const VCF = 'C:/claudehome/projects/VCF', BASE = 'http://127.0.0.1:8795';
const PERSIST = tmpdir() + '/wstate-follow-' + Date.now();
const NEG = process.env.NEG === '1';
mkdirSync(SH, { recursive: true });
let srv = null, srv2 = null, b = null;
const killAll = () => { if (srv2) { try { execSync(`taskkill /PID ${srv2} /T /F`, { stdio: 'ignore' }); } catch {} srv2 = null; } if (srv) { try { execSync(`taskkill /PID ${srv} /T /F`, { stdio: 'ignore' }); } catch {} srv = null; } L.stopWr(); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} };
const errsOf = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
const errsAll = [];
const allPages = [];

const TXT = {   // 驗收用的四語字串（跟 duel.html 的 vOn／vLook／vWatchN／vFirst／vSwitch／vAuto 一致）
  zh: { on: '觀看中', look: '看他', watchN: (n) => `正在看：${n}`, first: '等第一手', sw: (n) => `改看 ${n}`, auto: '自動' },
  en: { on: 'Watching', look: 'Watch', watchN: (n) => `Watching: ${n}`, first: 'Waiting for 1st move', sw: (n) => `Now watching ${n}`, auto: 'Auto' },
  ja: { on: '注目中', look: '見る', watchN: (n) => `注目：${n}`, first: '初手待ち', sw: (n) => `${n}に切替`, auto: '自動' },
  ko: { on: '보는 중', look: '보기', watchN: (n) => `보는 중: ${n}`, first: '첫 수 대기', sw: (n) => `${n} 관전`, auto: '자동' },
};

async function ctxOf({ lang = 'zh', w = 375, h = 667, nick = 'Cat' } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await c.addInitScript(([lang, nick]) => {
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
      }
    } catch {}
  }, [lang, nick]);
  return c;
}
async function open(c, path) {
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  allPages.push(p);
  await p.goto(BASE + '/' + path); await sleep(1000);
  return p;
}
const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
const waitFn = (p, fn, arg, ms = 30000) => p.waitForFunction(fn, arg, { timeout: ms });
const dRoom = (p) => p.evaluate(() => { const d = window.__duel, r = d.room; return r ? { id: r.id, state: r.state, seat: d.mySeat() } : null; });
async function newRoom(A, B, cfg) {
  await wsSend(A, { t: 'create', ...cfg });
  await waitFn(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  const id = (await dRoom(A)).id;
  await wsSend(B, { t: 'view', room: id }); await waitFn(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
  await wsSend(B, { t: 'sit', room: id, seat: 1 });
  await waitFn(A, () => window.__duel.room.state === 'play'); await waitFn(B, () => window.__duel.room.state === 'play');
  A.__seat = (await dRoom(A)).seat; B.__seat = (await dRoom(B)).seat;
  return id;
}
async function watch(C, id) {   // 跟真人一樣：大廳點那間房進去觀戰
  await C.waitForSelector(`[data-room="${id}"]`, { timeout: 15000 });
  await C.click(`[data-room="${id}"]`);
  await waitFn(C, (id) => window.__duel.room && window.__duel.room.id === id && !document.getElementById('sRoom').hidden, id);
  await sleep(600);
}
// 玩家頁：等第 i 題可以下，算真解
async function liveSol(p, i, armedOk = false) {
  await waitFn(p, ([i, armedOk]) => { const d = window.__duel, r = d.room, s = d.mySeat(), st = r && r.vs && r.vs.p[s]; return st && st.puzzle && st.i === i && (st.s === 'think' || (armedOk && st.s === 'armed')) && Date.now() >= st.at - 50 && d.VR && d.VR.i === i; }, [i, armedOk], 60000);
  return p.evaluate(async () => {
    const d = window.__duel, P = d.VR.p;
    const r = await d.vSolve(P.black.join(' '), P.white.join(' '), P.atkWhite);
    return r && r.result && r.result.solution ? String(r.result.solution).replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean) : [];
  });
}
const firstMove = async (p, i) => { const sol = await liveSol(p, i); const t = sol[0] || 'H8'; await wsSend(p, { t: 'vprog', n: i, moves: 1, armed: true, seq: [t] }); return t; };
const outNow = async (p, i, seq = []) => wsSend(p, { t: 'vout', n: i, why: 'bad', seq });
async function solveReal(p, i) { const sol = await liveSol(p, i, true); await wsSend(p, { t: 'vdone', n: i, seq: sol.length ? sol : ['H8'] }); }

// ---------- 觀戰畫面量測 ----------
const ui = (p) => p.evaluate(() => {
  const g = (id) => { const e = document.getElementById(id); return { view: e.classList.contains('view'), tag: !!e.querySelector('.vwatch'), tagTxt: e.querySelector('.vwatch')?.textContent || '', look: !!e.querySelector('.vlook'), lookTxt: e.querySelector('.vlook')?.textContent || '', nick: e.querySelector('.nm > span')?.textContent || '', role: e.getAttribute('role') }; };
  const bt = document.getElementById('bWatchAuto'), r = bt.getBoundingClientRect(), d = window.__duel;
  return { top: g('pTop'), bot: g('pBot'), status: document.getElementById('status').textContent, badge: document.querySelector('#status .vauto')?.textContent || null, btn: !bt.hidden, btnTxt: bt.textContent, btnAria: bt.getAttribute('aria-label'), btnW: Math.round(r.width), btnH: Math.round(r.height), btnIn: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, toast: [...document.querySelectorAll('.toast')].map((x) => x.textContent), focus: d.watchFocus, auto: d.watchAuto, seat: d.watchSeat, nicks: d.room.seats.map((s) => s && s.nick), phase: d.room.vs && d.room.vs.phase, sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth };
});
const colorAt = (p, t) => p.evaluate((t) => {
  const d = window.__duel, q = d.xyOf(d.tToP(t)), cv = d.cv, bw = cv.getBoundingClientRect().width, dpr = cv.width / bw, cell = bw * 0.91 / 14, c2 = cv.getContext('2d');
  const lumAt = (x, y) => { const px = c2.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return (px[0] + px[1] + px[2]) / 3; };
  const s = lumAt(q[0] - cell * 0.25, q[1] - cell * 0.25), e = lumAt(q[0] + cell * 0.5, q[1] + cell * 0.5);
  return Math.abs(s - e) < 25 ? '-' : s < e ? 'b' : 'w';
}, t);
const stones = (p) => p.evaluate(() => { const d = window.__duel, cv = d.cv, bw = cv.getBoundingClientRect().width, dpr = cv.width / bw, cell = bw * 0.91 / 14, c2 = cv.getContext('2d'); let n = 0; const lumAt = (x, y) => { const px = c2.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return (px[0] + px[1] + px[2]) / 3; }; for (let q = 0; q < 225; q++) { const [x, y] = d.xyOf(q), a = lumAt(x - cell * 0.25, y - cell * 0.25), e = lumAt(x + cell * 0.5, y + cell * 0.5); if (Math.abs(a - e) >= 25) n++; } return n; });
const waitFocus = (C, seat, ms = 15000) => waitFn(C, (seat) => window.__duel.watchFocus === seat, seat, ms);
// 看誰的標示：該列整列金框＋「觀看中」、另一列「看他」、狀態行寫「正在看：暱稱」、watchFocus 一致
async function expectView(C, seat, label, lang = 'zh') {
  let u = await ui(C);
  for (let k = 0; k < 12 && (!u.status.includes(TXT[lang].watchN(u.nicks[seat])) || u.focus !== seat); k++) { await sleep(250); u = await ui(C); }   // 開局倒數那幾秒狀態行是「準備…」，等它過去
  const T = TXT[lang], nick = u.nicks[seat];
  const rows = [['top', u.top], ['bot', u.bot]], v = rows.filter(([, r]) => r.view);
  const oth = v.length === 1 ? rows.find(([, r]) => r !== v[0][1])[1] : { tag: true, look: false, lookTxt: '' };
  const good = v.length === 1 && v[0][1].nick === nick && v[0][1].tag && v[0][1].tagTxt === T.on && !oth.tag && oth.look && oth.lookTxt === T.look && u.status.includes(T.watchN(nick)) && u.focus === seat && u.seat === seat;
  ok(good, `${label}：看 ${nick}（觀看中列＝${v.map(([k, r]) => k + ':' + r.nick).join(',')}、另一列看他、狀態「${u.status}」、focus ${u.focus}）`);
  return u;
}
async function expectNobody(C, label, lang = 'zh') {
  let u = await ui(C);
  for (let k = 0; k < 12 && !u.status.includes(TXT[lang].first); k++) { await sleep(250); u = await ui(C); }
  const T = TXT[lang];
  ok(u.focus === null && !u.top.view && !u.bot.view && !u.top.tag && !u.bot.tag && u.status.includes(T.first), `${label}：兩列都沒有「${T.on}」、狀態「${u.status}」`);
  return u;
}
async function toastSeen(C, text, ms = 2500) { try { await C.waitForFunction((t) => [...document.querySelectorAll('.toast')].some((x) => x.textContent === t), text, { timeout: ms }); return true; } catch { return false; } }
const clickRow = async (C, which) => { await C.click('#' + which); await sleep(300); };
const viewRow = async (C, seat) => (await ui(C)).top.nick === (await ui(C)).nicks[seat] ? 'pTop' : 'pBot';
const otherRowOf = async (C, seat) => (await viewRow(C, seat)) === 'pTop' ? 'pBot' : 'pTop';

try {
  srv = spawn('python', ['-m', 'http.server', '8795', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  srv2 = spawn('python', ['-m', 'http.server', '8791', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  await L.startWr(PERSIST);
  await sleep(4000);
  b = await L.launch();
  const actx = await ctxOf({ nick: 'Alice' }), bctx = await ctxOf({ nick: 'Bob' }), cctx = await ctxOf({ nick: 'Cara' });
  const A = await open(actx, 'duel.html'), B = await open(bctx, 'duel.html'), C = await open(cctx, 'duel.html');

  // ================= 1. 一線天 =================
  console.log('== 1. 一線天');
  const id1 = await newRoom(A, B, { t: 'create', kind: 'vcf', vmode: 'line', rank: 1, think: 180, target: 3, priv: false, color: 'b' });
  await watch(C, id1);
  const SA = A.__seat, SB = B.__seat;
  console.log(`  A 座位 ${SA}、B 座位 ${SB}`);
  // 題目 0
  await waitFn(C, () => { const d = window.__duel, st = d.room.vs.p[0]; return st && st.puzzle && Date.now() >= st.at && st.s === 'think'; });
  await sleep(500);
  const nStones0 = await stones(C);
  await expectNobody(C, '題目 1 開始：還沒人落子');
  ok(nStones0 > 0 && (await ui(C)).top.look && (await ui(C)).bot.look, `題目原樣：棋盤上 ${nStones0} 顆題目子、沒有手順；兩列都是「看他」`);
  await C.screenshot({ path: SH + 'line_first_zh_375x667.png' });
  const tB = await firstMove(B, 0);
  await waitFocus(C, SB);
  await sleep(300);
  await expectView(C, SB, '一線天：B 先落子 → C 自動看 B');
  ok(await colorAt(C, tB) !== '-', `棋盤上出現 B 的第一手 ${tB}`);
  ok((await ui(C)).badge === '自動' && !(await ui(C)).btn, '自動追焦中：狀態行有「自動」小標、沒有「自動」鈕');
  ok(await toastSeen(C, '改看 Bob', 1500), '切換提示「改看 Bob」出現');
  await C.screenshot({ path: SH + 'line_auto_zh_375x667.png' });
  await outNow(B, 0, [tB]);
  await waitFocus(C, SA);
  await sleep(300);
  await expectView(C, SA, '一線天：B 下錯出局 → C 自動切到 A');
  ok(await toastSeen(C, '改看 Alice', 1500), '切換提示「改看 Alice」出現（自動切）');
  ok(await colorAt(C, tB) === '-', '切到 A 後棋盤上沒有 B 的子（A 還沒下）');
  await solveReal(A, 0);
  await waitFn(C, () => window.__duel.room.vs.phase === 'reveal');
  await sleep(600);
  let u = await ui(C);
  ok(u.phase === 'reveal' && u.focus === SA && (await C.evaluate(() => window.__duel.VR.endSeen && window.__duel.VR.reveal && window.__duel.VR.reveal.length > 0)), `A 解開 → 公開解法（reveal 有手順、focus 不變）`);
  // 題目 1
  await waitFn(C, () => window.__duel.room.vs.phase === 'play' && window.__duel.room.vs.p[0].i === 1 && Date.now() >= window.__duel.room.vs.p[0].at, null, 20000);
  await sleep(500);
  await expectNobody(C, '換下一題：重新從「等第一手」開始');
  const tA1 = await firstMove(A, 1);
  await waitFocus(C, SA);
  await expectView(C, SA, '下一題 A 先落子 → C 跟 A');
  // 手動
  const oth = await otherRowOf(C, SA);
  await clickRow(C, oth);
  await waitFocus(C, SB);
  u = await expectView(C, SB, '手動點 B 的列 → 看 B');
  ok(u.auto === false && u.badge === null && u.btn && u.btnTxt === '自動' && u.btnAria === '自動追焦', `手動後：「自動」小標消失、出現可按的「自動」鈕（aria「${u.btnAria}」）`);
  ok(u.btnW >= 44 && u.btnH >= 44 && u.btnIn, `「自動」鈕 ${u.btnW}×${u.btnH}、在畫面內`);
  ok(await toastSeen(C, '改看 Bob', 1500), '手動切也有「改看 Bob」提示');
  await solveReal(A, 1);
  await waitFn(C, () => window.__duel.room.vs.phase === 'reveal');
  await waitFn(C, () => window.__duel.room.vs.phase === 'play' && window.__duel.room.vs.p[0].i === 2 && Date.now() >= window.__duel.room.vs.p[0].at, null, 20000);
  await sleep(500);
  u = await ui(C);
  ok(u.focus === SB && u.auto === false, `手動後換題 → 不跳（仍看 B，focus ${u.focus}）`);
  await expectView(C, SB, '換題後仍是手動看 B');
  const tA2 = await firstMove(A, 2);
  await sleep(700);
  u = await ui(C);
  ok(u.focus === SB && u.auto === false, `手動後 A 先落子 → 不跳（仍看 B）`);
  await expectView(C, SB, 'A 先落子後仍看 B');
  // 按「自動」→ 立刻依規則跳
  await C.click('#bWatchAuto'); await sleep(500);
  u = await expectView(C, SA, '按「自動」→ 立刻跳到該看的人（A 先落子了）');
  ok(u.auto === true && u.badge === '自動' && !u.btn, '回到自動：小標回來、「自動」鈕消失');
  // 玩家自己的畫面
  for (const [nm, P] of [['A', A], ['B', B]]) {
    const pu = await ui(P);
    ok(!pu.btn && !pu.top.tag && !pu.bot.tag && !pu.top.look && !pu.bot.look && !pu.top.view && !pu.bot.view && !pu.badge && pu.top.role === null && pu.bot.role === null, `玩家 ${nm} 自己的畫面：沒有「自動」鈕、觀看中、看他、小標（狀態「${pu.status}」）`);
  }
  // 兩人都出局
  await outNow(A, 2, [tA2]);
  await waitFocus(C, SB);
  await expectView(C, SB, '一線天：A 出局 → 自動切 B');
  await outNow(B, 2, []);
  await waitFn(C, () => window.__duel.room.vs.phase === 'reveal');
  await sleep(500);
  const rv = await C.evaluate(() => ({ w: window.__duel.room.vs.rv && window.__duel.room.vs.rv.winner, st: window.__duel.room.vs.p.map((x) => x.s + ':' + x.why) }));
  ok(rv.w === null, `兩人都出局 → 公開解法流程（沒人得分、${rv.st.join(' ')}）`);
  await waitFn(C, () => window.__duel.room.vs.phase === 'play' && window.__duel.room.vs.p[0].i === 3 && Date.now() >= window.__duel.room.vs.p[0].at, null, 20000);
  await sleep(500);
  await expectNobody(C, '兩人都出局後下一題：回到「等第一手」');
  errsAll.push(...errsOf(A), ...errsOf(B), ...errsOf(C));

  // ================= 2. 四語 × 兩種尺寸（接在一線天這題「等第一手」） =================
  console.log('== 2. 四語 × 375×667、360×640（觀戰畫面）');
  for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[375, 667], [360, 640]]) {
    const c = await ctxOf({ lang, w, h, nick: 'Dan' });
    const D = await open(c, 'duel.html');
    await watch(D, id1);
    const T = TXT[lang];
    await expectNobody(D, `${lang} ${w}×${h} 等第一手`, lang);
    let f = await ui(D);
    ok(f.sh <= f.ih && f.sw <= f.iw, `${lang} ${w}×${h} 等第一手：不捲動（sh ${f.sh}/${f.ih}、sw ${f.sw}/${f.iw}）`);
    await D.click('#pTop'); await sleep(400);   // 手動看上面那位
    f = await ui(D);
    const seat = f.focus;
    await expectView(D, seat, `${lang} ${w}×${h} 手動後`, lang);
    ok(f.btn && f.btnTxt === T.auto && f.btnW >= 44 && f.btnH >= 44 && f.btnIn, `${lang} ${w}×${h}：「自動」鈕文字「${f.btnTxt}」${f.btnW}×${f.btnH}、在畫面內`);
    ok(f.sh <= f.ih && f.sw <= f.iw, `${lang} ${w}×${h} 手動後：不捲動（sh ${f.sh}/${f.ih}、sw ${f.sw}/${f.iw}）`);
    ok(await toastSeen(D, T.sw(f.nicks[seat]), 1500), `${lang}：切換提示「${T.sw(f.nicks[seat])}」`);
    const cut = await D.evaluate(() => { const bad = []; for (const sel of ['#pTop', '#pBot']) { const bar = document.querySelector(sel).getBoundingClientRect(); for (const e of document.querySelectorAll(sel + ' .vwatch, ' + sel + ' .vlook')) { const r = e.getBoundingClientRect(); if (r.right > bar.right + 0.5 || r.left < bar.left - 0.5 || r.height < 10 || e.scrollWidth > e.clientWidth + 1) bad.push(e.textContent); } } const st = document.getElementById('status'), sr = st.getBoundingClientRect(); const so = [...st.children].some((e) => e.scrollWidth > e.clientWidth + 1 && e.className !== 'vwho'); return { bad, stH: Math.round(sr.height), so }; });
    ok(cut.bad.length === 0 && cut.stH <= 40 && !cut.so, `${lang} ${w}×${h}：標籤沒被切、狀態行沒換行（標籤 ${JSON.stringify(cut.bad)}、狀態高 ${cut.stH}）`);
    await D.click('#bWatchAuto'); await sleep(400);
    f = await ui(D);
    ok(f.auto && f.badge === T.auto && !f.btn, `${lang} ${w}×${h}：按「自動」→ 小標「${f.badge}」`);
    if ((lang === 'en' && w === 360)) { await D.click('#pTop'); await sleep(400); await D.screenshot({ path: SH + `line_manual_en_${w}x${h}.png` }); }
    errsAll.push(...errsOf(D));
    await c.close();
  }

  // ================= 3. 八仙渡 =================
  console.log('== 3. 八仙渡');
  await C.click('#rBack'); await sleep(500);
  await wsSend(A, { t: 'leave' }); await wsSend(B, { t: 'leave' }); await sleep(600);
  const id2 = await newRoom(A, B, { t: 'create', kind: 'vcf', vmode: 'eight', rank: 1, think: 180, target: 5, priv: false, color: 'b' });
  await watch(C, id2);
  const P = [A.__seat === 0 ? A : B, A.__seat === 0 ? B : A];   // P[座位]
  const nm = (s) => (P[s] === A ? 'Alice' : 'Bob');
  await sleep(500);
  await expectView(C, 0, `八仙渡 0:0 → 預設看座位 0（${nm(0)}）`);
  await solveReal(P[1], 0);
  await waitFocus(C, 1);
  await expectView(C, 1, `${nm(1)} 解開一題（0:1，領先）→ C 看 ${nm(1)}`);
  await C.screenshot({ path: SH + 'eight_auto_zh_375x667.png' });
  await solveReal(P[0], 0);
  await waitFn(C, () => window.__duel.room.vs.score[0] === 1);
  await sleep(500);
  u = await ui(C);
  if (NEG) ok(u.focus === 0, '【負向】同分 1:1 應該切到座位 0（這條預期 FAIL，因為規則是同分不換）');
  else ok(u.focus === 1, `${nm(0)} 也解開一題（1:1）→ C 仍看 ${nm(1)}（focus ${u.focus}）`);
  await expectView(C, 1, '同分不換：標示仍在原本那位');
  await solveReal(P[0], 1);
  await waitFocus(C, 0);
  await expectView(C, 0, `${nm(0)} 再解開一題（2:1，超車）→ C 切到 ${nm(0)}`);
  ok(await toastSeen(C, `改看 ${nm(0)}`, 1500), `超車切換有「改看 ${nm(0)}」提示`);
  // 手動
  await clickRow(C, await otherRowOf(C, 0));
  await waitFocus(C, 1);
  u = await expectView(C, 1, `手動點 ${nm(1)} → 看 ${nm(1)}`);
  ok(u.auto === false && u.btn && u.badge === null, '手動後：「自動」小標消失、「自動」鈕出現');
  await C.screenshot({ path: SH + 'eight_manual_zh_375x667.png' });
  await solveReal(P[1], 1);
  await waitFn(C, () => window.__duel.room.vs.score[1] === 2);
  await solveReal(P[0], 2);
  await waitFn(C, () => window.__duel.room.vs.score[0] === 3);
  await sleep(600);
  u = await ui(C);
  ok(u.focus === 1 && u.auto === false, `手動後對手超車（3:2）→ 不跳（仍看 ${nm(1)}）`);
  await C.click('#bWatchAuto'); await sleep(500);
  u = await expectView(C, 0, `按「自動」→ 立刻跳到領先的 ${nm(0)}（3:2）`);
  ok(u.auto && u.badge === '自動' && !u.btn, '回到自動');
  // 再手動，然後打完這局 → 再來一局回到自動
  await clickRow(C, await otherRowOf(C, 0));
  await waitFocus(C, 1);
  await solveReal(P[0], 3);
  await waitFn(C, () => window.__duel.room.vs.score[0] === 4);
  await solveReal(P[0], 4);
  await waitFn(C, () => window.__duel.room.state === 'over', null, 30000);
  await sleep(800);
  u = await ui(C);
  ok(!u.btn && !u.top.tag && !u.bot.tag && !u.top.look && !u.bot.look, `賽後逐題回看：不顯示「自動」鈕、觀看中、看他（btn ${u.btn}）`);
  await wsSend(A, { t: 'again' }); await wsSend(B, { t: 'again' });
  await waitFn(C, () => window.__duel.room.state === 'play' && window.__duel.room.vs.score[0] === 0 && window.__duel.room.vs.score[1] === 0, null, 20000);
  await sleep(4500);
  u = await ui(C);
  ok(u.auto === true && u.focus === 0 && !u.btn && u.badge === '自動', `再來一局 → 回到自動（auto ${u.auto}、focus ${u.focus}、小標 ${u.badge}）`);
  await expectView(C, 0, '新的一局：0:0 預設看座位 0');
  errsAll.push(...errsOf(A), ...errsOf(B), ...errsOf(C));

  // ================= 4. 五子棋房的觀戰不受影響 =================
  console.log('== 4. 五子棋房觀戰');
  await C.click('#rBack'); await sleep(500);
  await wsSend(A, { t: 'leave' }); await wsSend(B, { t: 'leave' }); await sleep(600);
  const id3 = await newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'free', priv: false, color: 'b' });
  await watch(C, id3);
  u = await ui(C);
  const gm = await C.evaluate(() => ({ view: !!document.querySelector('.pbar.view'), tag: !!document.querySelector('.vwatch, .vlook'), flip: [...document.querySelectorAll('.pbar')].some((e) => e.dataset.seat !== undefined || e.getAttribute('role') === 'button') }));
  ok(!u.btn && !gm.view && !gm.tag && !gm.flip, `五子棋房觀戰：沒有自動鈕、觀看中、看他、可點的玩家列（${JSON.stringify(gm)}）`);
  await C.click('#pTop'); await sleep(300);
  ok(!(await ui(C)).btn && (await C.evaluate(() => window.__duel.watchSeat)) === 0, '五子棋房點上方玩家列沒有反應');

  // ================= 5. 觀戰者沒有送出影響對局的訊息 =================
  console.log('== 5. C 送出的訊息');
  const sent = await C.evaluate(() => window.__sent.map((s) => { try { return JSON.parse(s).t; } catch { return '?'; } }));
  const kinds = [...new Set(sent)];
  const bad = kinds.filter((k) => ['act', 'move', 'vprog', 'vdone', 'vout', 'vskip', 'sit', 'resign', 'again', 'create', 'smove', 'studyReq', 'studyEnd', 'studyCancel', 'join'].includes(k));
  ok(bad.length === 0, `C 全程送出 ${sent.length} 則：${JSON.stringify(kinds)}；沒有任何影響對局的類型（${JSON.stringify(bad)}）`);
  errsAll.push(...errsOf(A), ...errsOf(B), ...errsOf(C));
  ok(errsAll.length === 0, `全程沒有 pageerror／console error（${errsAll.length}）${errsAll.slice(0, 3).join(' | ')}`);
} catch (e) {
  console.log('  FAIL 腳本例外：' + (e && e.stack || e)); L.ok(false, '腳本例外');
} finally {
  if (b) await b.close().catch(() => {});
  killAll();
}
const f = L.done();
process.exit(f ? 1 : 0);
