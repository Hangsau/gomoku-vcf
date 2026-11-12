// 兩儀殿五子棋房間「要不要捲」——特殊情境。需要 http.server 8793、wrangler dev 8789。
// 用法：node extra2.mjs [--out=file.json] [--shots=前綴]   環境變數 NOFIX=1＝用注入把 duel.html 的保險修正關掉（ResizeObserver／visualViewport／fonts.ready 都失效）
//       ONLYTAG=字串 只跑標籤含這段字的案例
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:8793';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const outFile = (args.find((a) => a.startsWith('--out=')) || '--out=extra2-result.json').slice(6);
const SHOTS = (args.find((a) => a.startsWith('--shots=')) || '--shots=').slice(8);
const NOFIX = !!process.env.NOFIX;
const ORIG = !!process.env.ORIG;   // ORIG=1：頁面改開 check/duel-orig.html（git HEAD 的 duel.html 加一行 <base href="/">，真正的「修前」）
const SHOTLIST = fs.existsSync('shot-labels.json') ? new Set(JSON.parse(fs.readFileSync('shot-labels.json', 'utf8'))) : null;
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SAMPLER = () => {
  window.__fit = new Map();
  window.__hs = () => {
    const kids = [...document.getElementById('sRoom').children].filter((e) => !e.classList.contains('grow'));
    return Object.fromEntries(kids.map((e) => [e.id || e.className.split(' ')[0], Math.round(e.getBoundingClientRect().height)]));
  };
  window.__snap = () => {
    const over = document.documentElement.scrollHeight - window.innerHeight;
    const rs = document.getElementById('aResign'), lv = document.getElementById('aLeave');
    const rb = rs ? Math.round(rs.getBoundingClientRect().bottom - window.innerHeight) : null;
    const lb = lv ? Math.round(lv.getBoundingClientRect().bottom - window.innerHeight) : null;
    return { over, resignBelow: rb, leaveBelow: lb, worst: Math.max(over, rb ?? -999, lb ?? -999), px: document.getElementById('board').clientWidth, heights: window.__hs(), iw: innerWidth, ih: innerHeight, vvh: window.visualViewport ? Math.round(window.visualViewport.height) : null };
  };
  setInterval(() => {
    const room = document.getElementById('sRoom');
    if (!room || room.hidden) return;
    const s = window.__snap();
    const key = [document.getElementById('status').textContent, document.getElementById('phaseActs').hidden ? '-' : document.getElementById('phaseActs').children.length, document.getElementById('rActs').children.length, document.getElementById('facts').textContent, document.getElementById('rSub').textContent, window.__stage || ''].join('|');
    // 只有連續兩次取樣（約 60ms 以上）都超出才算；重算版面前那一格的瞬間不算「要捲」
    const eff = Math.min(s.worst, window.__prevWorst ?? -999); window.__prevWorst = s.worst;
    const old = window.__fit.get(key);
    if (!old || eff > old.worst) window.__fit.set(key, { key, ...s, worst: eff, rawWorst: s.worst });
  }, 60);
};

async function mk(b, { lang = 'zh', w, h, nick, tap = '1', noSampler = false, fontDelay = 0 }) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await c.addInitScript(([lang, nick, tap, NOFIX]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) { return new W(String(u).replace(':8787/', ':8789/'), p); };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (!localStorage.getItem('vcfgame.lang')) localStorage.setItem('vcfgame.lang', lang);
    localStorage.setItem('vcfgame.duel.tap', tap);
    localStorage.setItem('vcfgame.nick', nick);
    localStorage.setItem('vcfgame.duel.rule', 'free');
    // 模擬「視窗高度變了但頁面沒收到 resize」：__blockResize 為真時把 window 的 resize 事件吃掉
    window.addEventListener('resize', (e) => { if (window.__blockResize) e.stopImmediatePropagation(); }, true);
    if (NOFIX) {   // 把保險修正關掉
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      const add = DOMTokenList.prototype.add; DOMTokenList.prototype.add = function (...a) { return add.apply(this, a.filter((x) => x !== 'tight')); };   // 「縮緊」樣式也關掉（棋盤下限 200 關不掉）
      if (window.visualViewport) window.visualViewport.addEventListener = () => {};
      try { Object.defineProperty(document.fonts, 'ready', { get: () => new Promise(() => {}) }); } catch (e) {}
    }
  }, [lang, nick, tap, NOFIX]);
  if (fontDelay) await c.route(/fonts\.(googleapis|gstatic)\.com/, async (r) => { await sleep(fontDelay); r.continue().catch(() => {}); });
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  await p.goto(BASE + (ORIG ? '/docs/design/duel-fit-2026-11-12/check/duel-orig.html' : '/duel.html'));
  await p.waitForFunction(() => window.__duel, null, { timeout: 15000 });
  if (!noSampler) await p.evaluate(`(${SAMPLER})()`);
  await sleep(500);
  return p;
}
async function create(p, { rule, time }) {
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
  return a.sort((x, y) => x[2] - y[2]).slice(0, 120);
})();
async function step(pages, ci) {
  for (const p of pages) {
    const btn = await p.$('#phaseActs:not([hidden]) .btn.gold:not(:disabled)');
    if (btn && (await p.evaluate(() => !document.querySelector('#phaseActs [data-a=yes]')))) { await btn.click(); await sleep(150); return true; }
  }
  const before = await logLen(pages[0]);
  for (const p of pages) { await clickCell(p, cands[ci][0], cands[ci][1]); await sleep(110); if ((await logLen(pages[0])) !== before) return true; }
  return false;
}
// ctx.ci 跨多次呼叫延續，才不會重點已經有子的格
async function playMoves(ctx, n) {
  let done = 0, guard = 0;
  while (done < n && guard++ < n * 8 && ctx.ci < cands.length) {
    if ((await stateOf(ctx.pages[0])) !== 'play') break;
    const adv = await step(ctx.pages, ctx.ci);
    ctx.ci++; if (adv) done++;
  }
}
const stage = (pages, s) => Promise.all(pages.map((p) => p.evaluate((s) => { window.__stage = s; }, s)));
const snap = async (p, who, tag) => ({ who, snapAt: tag, ...(await p.evaluate(() => window.__snap())) });
const collect = (p) => p.evaluate(() => [...window.__fit.values()]);
async function setH(p, w, h, { cdp = false, block = false } = {}) {
  if (block) await p.evaluate(() => { window.__blockResize = true; });
  if (cdp) { const s = await p.context().newCDPSession(p); await s.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await s.detach(); }
  else await p.setViewportSize({ width: w, height: h });
  await sleep(350);
}
const scalePx = (p, k) => p.evaluate((k) => {   // 把樣式表裡所有 px 字級乘上倍率（模擬手機把字調大）
  for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch (e) { continue; } for (const r of rules) { if (r.style && r.style.fontSize && /px$/.test(r.style.fontSize)) r.style.fontSize = parseFloat(r.style.fontSize) * k + 'px'; } }
}, k);

// 一個案例的骨架：開房（A）、B 入座、依 o.run(ctx) 做事、收結果
async function runCase(b, o) {
  const label = o.tag;
  const rows = [];
  let A, B, extra = [];
  try {
    A = await mk(b, { ...o, w: o.w0 ?? o.w, h: o.h0 ?? o.h, nick: 'Alice' }); B = await mk(b, { ...o, w: o.w0 ?? o.w, h: o.h0 ?? o.h, nick: 'Bob' });
    const ctx = { A, B, pages: [A, B], ci: 0, b, o, rows, extra, snaps: [] };
    if (o.preCreate) await o.preCreate(ctx);
    await create(A, { rule: o.rule || 'free', time: o.time || 'none' });
    ctx.id = await A.evaluate(() => window.__duel.room.id);
    await join(B, ctx.id);
    await sleep(300);
    await o.run(ctx);
    await sleep(400);
    if (SHOTS && (!SHOTLIST || SHOTLIST.has(label))) { let sp = ctx.pages[0]; for (const q of ctx.pages) if (await q.evaluate(() => window.__snap().worst > 0 || !document.getElementById('phaseActs').hidden)) { sp = q; break; } await sp.screenshot({ path: `shots/${SHOTS}${o.shot || label.replace(/[^\w\u4e00-\u9fff.]+/g, '_')}_A.png` }); }
    for (const [who, p] of [['A', ctx.pages[0]], ['B', ctx.pages[1]], ...extra.map((p, i) => ['C' + i, p])]) {
      rows.push({ label, ...(await snap(p, who, '最後')) });
      for (const e of await collect(p)) rows.push({ label, who, ...e });
    }
    for (const s of ctx.snaps) rows.push({ label, ...s });
  } catch (e) { rows.push({ label, error: String(e.message || e).slice(0, 300) }); }
  for (const p of [A, B, ...extra]) if (p) { rows.push(...p.errs.map((m) => ({ label, pageerror: m }))); await p.context().close().catch(() => {}); }
  return rows;
}

const b = await chromium.launch({ executablePath: exe });
const jobs = [];
const W = 412;
for (const H of [790, 700]) {
  for (const rule of ['free', 'tara']) {
    // 1a 進房時 915，對局中用 CDP 改矮（會有 resize 事件）
    for (const h2 of [...new Set([H, 640])]) jobs.push({ tag: `1a 進房915→對局中CDP改成${h2} ${rule}`, w: W, h: 915, rule, run: async (c) => { await playMoves(c, 2); await stage(c.pages, '改矮後'); for (const p of c.pages) await setH(p, W, h2, { cdp: true }); await playMoves(c, 5); } });
    // 1b 同上，但頁面收不到 resize（模擬事件漏掉），之後繼續下
    jobs.push({ tag: `1b 進房915→${H}、頁面沒收到resize ${rule}`, w: W, h: 915, rule, run: async (c) => { await playMoves(c, 2); await stage(c.pages, '改矮後'); for (const p of c.pages) await setH(p, W, H, { block: true }); await playMoves(c, 5); } });
    // 2a 大廳時視窗 412×450（鍵盤開著）進房，再變回 H
    jobs.push({ tag: `2a 大廳450(鍵盤)進房→${H} ${rule}`, w: W, h: 450, rule, run: async (c) => { await stage(c.pages, '450'); await playMoves(c, 1); await stage(c.pages, '變回後'); for (const p of c.pages) await setH(p, W, H); await playMoves(c, 5); } });
    // 2b 同上但變回時頁面沒收到 resize
    jobs.push({ tag: `2b 大廳450(鍵盤)進房→${H}、沒收到resize ${rule}`, w: W, h: 450, rule, run: async (c) => { await stage(c.pages, '450'); await playMoves(c, 1); await stage(c.pages, '變回後'); for (const p of c.pages) await setH(p, W, H, { block: true }); await playMoves(c, 5); } });
  }
  // 3 再來一局
  jobs.push({ tag: `3 結束後再來一局 ${H}`, w: W, h: H, rule: 'tara', run: async (c) => {
    await playMoves(c, 7); await c.A.click('#aResign'); await sleep(900);
    await c.A.waitForSelector('#mEnd:not([hidden])', { timeout: 5000 }); c.snaps.push(await snap(c.A, 'A', '結束視窗'));
    await c.A.click('#bAgain'); await c.B.click('#bAgain'); await sleep(900);
    await stage(c.pages, '第二局'); c.ci = 0; await playMoves(c, 8);
  } });
  // 4 從大廳直接進一間對局中的房間（觀戰）
  jobs.push({ tag: `4 從大廳進對局中的房間(觀戰) ${H}`, w: W, h: H, rule: 'tara', run: async (c) => {
    await playMoves(c, 3);
    const C = await mk(c.b, { w: W, h: H, nick: 'Carol' }); c.extra.push(C);
    await C.waitForSelector(`[data-room="${c.id}"]`, { timeout: 8000 }); await C.click(`[data-room="${c.id}"]`); await sleep(500);
    await playMoves(c, 5);
  } });
  // 5 斷線重連（reload）
  jobs.push({ tag: `5 對局中重新整理 ${H}`, w: W, h: H, rule: 'tara', run: async (c) => {
    await playMoves(c, 4);
    await c.A.reload(); await c.A.waitForFunction(() => window.__duel && window.__duel.room && !document.getElementById('sRoom').hidden, null, { timeout: 15000 });
    await c.A.evaluate(`(${SAMPLER})()`); await stage([c.A], '重連後'); await sleep(600);
    c.snaps.push(await snap(c.A, 'A', '重連後'));
    await playMoves(c, 4);
  } });
  // 6 字放大
  for (const fs of [18, 20]) jobs.push({ tag: `6a 對局中根字級改${fs}px ${H}`, w: W, h: H, rule: 'tara', run: async (c) => { await playMoves(c, 2); await stage(c.pages, '放大後'); for (const p of c.pages) await p.evaluate((fs) => { document.documentElement.style.fontSize = fs + 'px'; }, fs); await sleep(300); await playMoves(c, 6); } });
  for (const k of [1.15, 1.3, 1.5]) {
    jobs.push({ tag: `6b 進房前樣式表px字級×${k} ${H}`, w: W, h: H, rule: 'tara', preCreate: async (c) => { for (const p of c.pages) await scalePx(p, k); }, run: async (c) => { await playMoves(c, 8); } });
    jobs.push({ tag: `6c 對局中樣式表px字級×${k}(不會有任何事件) ${H}`, w: W, h: H, rule: 'tara', run: async (c) => { await playMoves(c, 2); await stage(c.pages, '放大後'); for (const p of c.pages) await scalePx(p, k); await sleep(300); await playMoves(c, 6); } });
  }
  for (const pct of [130, 150]) jobs.push({ tag: `6d 對局中html加text-size-adjust:${pct}% ${H}`, w: W, h: H, rule: 'tara', run: async (c) => { await playMoves(c, 2); await stage(c.pages, '放大後'); for (const p of c.pages) await p.evaluate((pct) => { document.documentElement.style.textSizeAdjust = pct + '%'; document.documentElement.style.webkitTextSizeAdjust = pct + '%'; }, pct); await sleep(300); await playMoves(c, 6); } });
  // 7 字型晚到（3 秒，進房之後才到）
  jobs.push({ tag: `7 字型晚到3秒 ${H}`, w: W, h: H, rule: 'tara', fontDelay: 3000, run: async (c) => { await sleep(3500); await playMoves(c, 6); } });
}
// 8 很小的視窗（手機「顯示大小」調到最大、或 Chrome 頁面縮放 125%／150%）
for (const [w, h] of [[353, 680], [353, 640], [330, 632], [320, 640], [320, 610], [320, 570], [275, 527]]) for (const rule of ['free', 'tara', 'swap2']) for (const lang of ['zh', 'en']) {
  jobs.push({ tag: `8 小視窗 ${w}x${h} ${rule} ${lang}`, w, h, rule, lang, run: async (c) => { await playMoves(c, 8); } });
}
const only = process.env.ONLYTAG;
const todo = only ? jobs.filter((j) => j.tag.includes(only)) : jobs;
const all = [];
let next = 0;
const CONC = +(process.env.CONC || 3);
async function worker() { while (next < todo.length) { const j = todo[next++]; const t0 = Date.now(); const r = await runCase(b, j); all.push(...r); const bad = r.filter((x) => x.worst > 0 || x.error).length; console.log(`[${next}/${todo.length}] ${j.tag} ${((Date.now() - t0) / 1000).toFixed(1)}s 超出 ${bad}`); } }
await Promise.all(Array.from({ length: CONC }, worker));
fs.writeFileSync(outFile, JSON.stringify(all, null, 1));
const kb = all.filter((x) => x.worst > 0 && x.ih === 450);   // 412×450（模擬鍵盤開著）本來就放不下，另外列
const over = all.filter((x) => x.worst > 0 && x.ih !== 450);
const errs = all.filter((x) => x.error || x.pageerror);
// 每個案例只印最糟的一筆
const worstBy = new Map();
for (const x of over) { const o = worstBy.get(x.label); if (!o || x.worst > o.worst) worstBy.set(x.label, x); }
for (const x of worstBy.values()) console.log(`OVER ${x.label} | ${x.who} 視窗${x.iw}x${x.ih} 文件超出${x.over} 認輸鈕底${x.resignBelow} 離開鈕底${x.leaveBelow} 棋盤${x.px} [${(x.key || x.snapAt || '').slice(0, 50)}] h=${JSON.stringify(x.heights)}`);
for (const x of errs) console.log('ERR', x.label, x.error || x.pageerror);
console.log(`另：412×450（模擬鍵盤開著的高度）當下超出的取樣 ${kb.length} 筆，最多 ${Math.max(0, ...kb.map((x) => x.worst))}px（不列入超出）`);
console.log(`${ORIG ? '(修改前的 duel.html) ' : ''}${NOFIX ? '(保險修正關掉) ' : ''}案例 ${todo.length}，取樣畫面 ${all.filter((x) => x.key || x.snapAt).length}，超出的案例 ${worstBy.size}（超出的取樣 ${over.length}），錯誤 ${errs.length}`);
await b.close();
