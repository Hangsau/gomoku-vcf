// 兩儀殿五子棋房間「要不要捲」檢查。需要 http.server 8793、wrangler dev 8789。
// 用法：node fit.mjs [matrix|extra|all] [--out=file.json] [--quick]
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:8793';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith('--')) || 'all';
const outFile = (args.find((a) => a.startsWith('--out=')) || '--out=fit-result.json').slice(6);
const quick = args.includes('--quick');
const CONC = +(process.env.CONC || 4);
const SHOTS = args.find((a) => a.startsWith('--shots=')) ? args.find((a) => a.startsWith('--shots=')).slice(8) : '';   // 前綴，例如 pre_／post_
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// 頁面內取樣器：每 60ms 量一次，每個「畫面狀態鍵」只留最大超出的一筆
const SAMPLER = () => {
  window.__fit = new Map();
  const ids = ['rhead', 'pTop', 'status', 'boardWrap', 'pBot', 'facts', 'phaseActs', 'rActs'];
  const hs = () => {
    const kids = [...document.getElementById('sRoom').children].filter((e) => !e.classList.contains('grow'));
    return Object.fromEntries(kids.map((e) => [e.id || e.className.split(' ')[0], Math.round(e.getBoundingClientRect().height)]));
  };
  setInterval(() => {
    const room = document.getElementById('sRoom');
    if (!room || room.hidden) return;
    const over = document.documentElement.scrollHeight - window.innerHeight;
    const rs = document.getElementById('aResign');
    const rb = rs ? Math.round(rs.getBoundingClientRect().bottom - window.innerHeight) : null;
    const lv = document.getElementById('aLeave');
    const lb = lv ? Math.round(lv.getBoundingClientRect().bottom - window.innerHeight) : null;
    const key = [document.getElementById('status').textContent, document.getElementById('phaseActs').hidden ? '-' : document.getElementById('phaseActs').children.length, document.getElementById('rActs').children.length, document.getElementById('facts').textContent, document.getElementById('rSub').textContent].join('|');
    const worst = Math.max(over, rb ?? -999, lb ?? -999);
    const old = window.__fit.get(key);
    if (!old || worst > old.worst) window.__fit.set(key, { key, over, resignBelow: rb, leaveBelow: lb, worst, px: window.__duel && document.getElementById('board').clientWidth, heights: hs(), iw: innerWidth, ih: innerHeight });
  }, 60);
};

async function mk(b, { lang, w, h, nick, tap = '1', fontDelay = 0, textScale = 1 }) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await c.addInitScript(([lang, nick, tap]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) { return new W(String(u).replace(':8787/', ':8789/'), p); };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (!localStorage.getItem('vcfgame.lang')) localStorage.setItem('vcfgame.lang', lang);
    localStorage.setItem('vcfgame.duel.tap', tap);
    localStorage.setItem('vcfgame.nick', nick);
    localStorage.setItem('vcfgame.duel.rule', 'free');
  }, [lang, nick, tap]);
  if (fontDelay) await c.route(/fonts\.(googleapis|gstatic)\.com/, async (r) => { await sleep(fontDelay); r.continue().catch(() => {}); });
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE + '/duel.html');
  await p.waitForFunction(() => window.__duel, null, { timeout: 15000 });
  if (textScale !== 1) {   // 模擬系統字放大：把所有樣式表裡的 px 字級乘上倍率（Chrome 桌面沒有 Android 的字型縮放）
    await p.evaluate((k) => {
      for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch (e) { continue; } for (const r of rules) { if (r.style && r.style.fontSize && /px$/.test(r.style.fontSize)) r.style.fontSize = parseFloat(r.style.fontSize) * k + 'px'; } }
    }, textScale);
  }
  await p.evaluate(`(${SAMPLER})()`);
  await sleep(500);
  return p;
}
async function create(p, { rule, time, shot }) {
  await p.click('#openCreate'); await sleep(150);
  await p.click('#cKind button[data-v="gomoku"]');
  await p.click(`#cTime button[data-v="${time}"]`);
  await p.click(`#cRule button[data-v="${rule}"]`);
  await p.click('#doCreate'); await sleep(500);
}
async function join(p, id) {
  await p.waitForSelector(`[data-room="${id}"]`, { timeout: 8000 });
  await p.click(`[data-room="${id}"]`); await sleep(250);
  await p.click('[data-sit]'); await sleep(400);
}
const logLen = (p) => p.evaluate(() => { const r = window.__duel.room; return r && r.match ? r.match.log.length : -1; });
const stateOf = (p) => p.evaluate(() => window.__duel.room && window.__duel.room.state);
async function clickCell(p, r, c) {
  const pt = await p.evaluate(([r, c]) => { const d = window.__duel; const [x, y] = d.xyOf(r * 15 + c); const b = d.cv.getBoundingClientRect(); return [b.left + x, b.top + y]; }, [r, c]);
  await p.mouse.click(pt[0], pt[1]);
}
const cands = (() => {
  const a = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) a.push([r, c, Math.max(Math.abs(r - 7), Math.abs(c - 7)) + ((r * 7 + c * 13) % 5) / 10]);
  return a.sort((x, y) => x[2] - y[2]).slice(0, 80);
})();
// 推進一步：先按開局決定按鈕，不然點下一個候選格。回傳 true＝有推進
async function step(pages, ci) {
  for (const p of pages) {
    const btn = await p.$('#phaseActs:not([hidden]) .btn.gold:not(:disabled)');
    if (btn && (await p.evaluate(() => !document.querySelector('#phaseActs [data-a=yes]')))) {
      const before = await logLen(p);
      await btn.click(); await sleep(150);
      if ((await logLen(p)) !== before || true) return true;
    }
  }
  const before = await logLen(pages[0]);
  for (const p of pages) { await clickCell(p, cands[ci][0], cands[ci][1]); await sleep(110); if ((await logLen(pages[0])) !== before) return true; }
  return false;
}
async function playMoves(pages, n) {
  let ci = 0, done = 0, guard = 0;
  while (done < n && guard++ < n * 8 && ci < cands.length) {
    if ((await stateOf(pages[0])) !== 'play') break;
    const adv = await step(pages, ci);
    if (!adv) ci++; else { done++; ci++; }
  }
}
const collect = (p) => p.evaluate(() => [...window.__fit.values()]);

// 一個案例：開房、兩人入座、走完開局＋幾手，回傳兩個座位頁面的超出紀錄
async function runCase(b, o) {
  const label = `${o.w}x${o.h} ${o.rule} ${o.time} ${o.lang}${o.tag ? ' ' + o.tag : ''}`;
  const rows = [];
  let A, B;
  try {
    A = await mk(b, { ...o, nick: 'Alice' }); B = await mk(b, { ...o, nick: 'Bob' });   // 開頁逾時也記成這一組的錯誤，不讓整支掛掉
    await create(A, o);
    const id = await A.evaluate(() => window.__duel.room.id);
    await join(B, id);
    await sleep(300);
    if (o.beforePlay) await o.beforePlay(A, B);
    await playMoves([A, B], o.moves ?? 8);
    if (o.afterPlay) await o.afterPlay(A, B);
    if (o.shot) { await A.screenshot({ path: o.shot + 'A.png' }); await B.screenshot({ path: o.shot + 'B.png' }); }
    for (const [who, p] of [['A', A], ['B', B]]) for (const e of await collect(p)) rows.push({ label, who, ...e });
  } catch (e) { rows.push({ label, error: String(e.message || e).slice(0, 200) }); }
  rows.push(...[A, B].filter(Boolean).flatMap((p) => p.errs.map((m) => ({ label, pageerror: m }))));
  for (const p of [A, B]) if (p) await p.context().close().catch(() => {});
  return rows;
}

const b = await chromium.launch({ executablePath: exe });
const jobs = [];
const VPS = [[412, 915], [412, 850], [412, 790], [412, 740], [384, 740], [360, 690], [360, 640], [375, 667]];
const RULES = ['free', 'renju', 'tara', 'tara10', 'swap2'];
const TIMES = ['none', '10+10'];
const LANGS = ['zh', 'en', 'ja', 'ko'];
if (mode === 'matrix' || mode === 'all') {
  for (const [w, h] of VPS) for (const rule of RULES) for (const time of TIMES) for (const lang of LANGS) {
    if (quick && !(lang === 'zh' || (lang === 'en' && rule === 'swap2'))) continue;
    jobs.push({ w, h, rule, time, lang });
  }
}
if (mode === 'extra' || mode === 'all') {
  const base = { w: 412, h: 790, rule: 'free', time: 'none', lang: 'zh' };
  jobs.push({ ...base, tag: '字型晚到1.5秒', fontDelay: 1500 });
  jobs.push({ ...base, tag: '字放大1.25', textScale: 1.25 });
  jobs.push({ ...base, tag: '字放大1.5', textScale: 1.5, w: 360, h: 690 });
  jobs.push({ ...base, tag: '落子點兩下', tap: '2' });
  jobs.push({ ...base, rule: 'tara', tag: '落子點兩下', tap: '2' });
  jobs.push({ ...base, tag: '視窗高 790→850→790(進房後)', afterPlay: async (A, B) => { for (const p of [A, B]) { await p.setViewportSize({ width: 412, height: 850 }); } await sleep(400); for (const p of [A, B]) await p.setViewportSize({ width: 412, height: 790 }); await sleep(500); } , beforePlay: async (A, B) => { for (const p of [A, B]) await p.setViewportSize({ width: 412, height: 850 }); await sleep(400); for (const p of [A, B]) await p.setViewportSize({ width: 412, height: 790 }); await sleep(400); } });
  for (const lang of LANGS) {
    // 對方申請研棋：A 申請 → B 看到「接受/拒絕」；B 拒絕；再申請、B 接受 → 研棋工具列；結束
    jobs.push({ ...base, lang, tag: '申請研棋', moves: 4, afterPlay: async (A, B) => {
      await A.click('#aStudy'); await sleep(500);
      await sleep(300);
      await B.click('#phaseActs [data-a=no]'); await sleep(500);
      await A.evaluate(() => 0); await sleep(500);
      await A.click('#aStudy').catch(() => {}); await sleep(500);
    } });
    jobs.push({ ...base, lang, tag: '研棋進出', moves: 4, afterPlay: async (A, B) => {
      await A.click('#aStudy'); await sleep(500);
      await B.click('#phaseActs [data-a=yes]'); await sleep(700);
      await clickCell(A, 3, 3); await sleep(300); await clickCell(B, 3, 5); await sleep(400);
      await A.click('#aStudyEnd'); await sleep(500);
    } });
    jobs.push({ ...base, lang, rule: 'swap2', tag: '有人觀戰', moves: 4, beforePlay: async (A, B) => {
      const id = await A.evaluate(() => window.__duel.room.id);
      const C = await mk(b, { ...base, lang, nick: 'Carol' });
      await C.waitForSelector(`[data-room="${id}"]`); await C.click(`[data-room="${id}"]`); await sleep(500);
      globalThis.__C = C;
    }, shot: undefined });
  }
}
if (process.env.ONLY) jobs.splice(+process.env.ONLY + 1, jobs.length); if (process.env.ONLY) jobs.splice(0, +process.env.ONLY);
if (process.env.FROM) jobs.splice(0, +process.env.FROM);
if (process.env.COUNT) jobs.splice(+process.env.COUNT);   // 接續：跳過前面已跑完的
const all = [];
let next = 0;
async function worker() { while (next < jobs.length) { const j = jobs[next++]; const t0 = Date.now(); const r = await runCase(b, j); all.push(...r); const bad = r.filter((x) => x.worst > 0 || x.error).length; console.log(`[${next}/${jobs.length}] ${j.w}x${j.h} ${j.rule} ${j.time} ${j.lang} ${j.tag || ''} ${((Date.now() - t0) / 1000).toFixed(1)}s 超出 ${bad}`); } }
await Promise.all(Array.from({ length: CONC }, worker));
fs.writeFileSync(outFile, JSON.stringify(all, null, 1));
const over = all.filter((x) => x.worst > 0);
const errs = all.filter((x) => x.error || x.pageerror);
console.log(`案例 ${jobs.length}，取樣畫面 ${all.filter((x) => x.key).length}，超出 ${over.length}，錯誤 ${errs.length}`);
for (const x of over) console.log(`OVER ${x.label} ${x.who} 超出${x.over} 認輸鈕底${x.resignBelow} 離開鈕底${x.leaveBelow} 棋盤${x.px} [${x.key.slice(0, 60)}] h=${JSON.stringify(x.heights)}`);
for (const x of errs) console.log('ERR', x.label, x.error || x.pageerror);
await b.close();
