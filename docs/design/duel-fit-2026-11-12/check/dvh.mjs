// 模擬「裝成 App 時 100dvh 比 window.innerHeight 高」：把頁面裡所有 dvh 換成 calc(…dvh + N px 的比例) 的副本拿來開。
// 做法：讀 duel.html（修改後）與 git HEAD 版（修改前，check/duel-orig.html），把 CSS 的「100dvh」換成「calc(100dvh + 48px)」，
//       存成 check/v-fix-dvh48.html、check/v-orig-dvh48.html（都加 <base href="/">），用本機 8793 開。
// 另外用 CDP Emulation.setSafeAreaInsetsOverride（上 48、下 32）看 env(safe-area-inset-*) 生效時的版面。
// 需要 http.server 8793、wrangler dev 8789。用法：node dvh.mjs [--shots]
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.argv.includes('--shots');
const ROOT = 'C:/claudehome/projects/VCF/';
const HERE = '/docs/design/duel-fit-2026-11-12/check/';
const EXTRA = 48;
const bump = (html) => html.replace('<head>', '<head><base href="/">').replaceAll('100dvh', `calc(100dvh + ${EXTRA}px)`);
const fixSrc = fs.readFileSync(ROOT + 'duel.html', 'utf8');
const origSrc = fs.readFileSync(ROOT + 'docs/design/duel-fit-2026-11-12/check/duel-orig.html', 'utf8').replace('<head><base href="/">', '<head>');
fs.writeFileSync('v-fix-dvh48.html', bump(fixSrc));
fs.writeFileSync('v-orig-dvh48.html', bump(origSrc));
const PAGES = { '修改前': HERE + 'duel-orig.html', '修改前＋dvh多48': HERE + 'v-orig-dvh48.html', '修改後': '/duel.html', '修改後＋dvh多48': HERE + 'v-fix-dvh48.html' };

const SNAP = () => {
  const room = !document.getElementById('sRoom').hidden;
  const bot = (id) => { const e = document.getElementById(id); return e && e.offsetParent !== null ? Math.round(e.getBoundingClientRect().bottom - window.innerHeight) : null; };
  const o = { ih: innerHeight, appH: Math.round(document.querySelector('.app').getBoundingClientRect().height), over: document.documentElement.scrollHeight - innerHeight };
  if (room) {
    const kids = [...document.getElementById('sRoom').children].filter((e) => !e.classList.contains('grow'));
    Object.assign(o, { resign: bot('aResign'), leave: bot('aLeave'), px: document.getElementById('board').clientWidth, tight: document.getElementById('sRoom').classList.contains('tight'), status: document.getElementById('status').textContent,
      rows: kids.map((e) => Math.round(e.getBoundingClientRect().height)).join('/'), top: Math.round(document.querySelector('.rhead').getBoundingClientRect().top), actsPadB: getComputedStyle(document.getElementById('rActs')).paddingBottom, headPadT: getComputedStyle(document.querySelector('.rhead')).paddingTop });
  } else Object.assign(o, { openCreate: bot('openCreate'), listScroll: (() => { const l = document.querySelector('.list'); return l ? `${l.scrollHeight}/${l.clientHeight}` : null; })() });
  return o;
};
async function mk(b, { url, w, h, nick, safe }) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await c.addInitScript(([nick]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) { return new W(String(u).replace(':8787/', ':8789/'), p); };
    window.WebSocket.prototype = W.prototype;
    localStorage.setItem('vcfgame.lang', 'zh'); localStorage.setItem('vcfgame.duel.tap', '1'); localStorage.setItem('vcfgame.nick', nick);
  }, [nick]);
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.safeErr = '';
  if (safe) { try { const s = await c.newCDPSession(p); await s.send('Emulation.setSafeAreaInsetsOverride', { insets: safe }); } catch (e) { p.safeErr = String(e.message).slice(0, 120); } }
  await p.goto('http://127.0.0.1:8793' + url);
  await p.waitForFunction(() => window.__duel, null, { timeout: 15000 });
  await sleep(600);
  return p;
}
async function clickCell(p, r, c) {
  const pt = await p.evaluate(([r, c]) => { const d = window.__duel; const [x, y] = d.xyOf(r * 15 + c); const b = d.cv.getBoundingClientRect(); return [b.left + x, b.top + y]; }, [r, c]);
  await p.mouse.click(pt[0], pt[1]);
}
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let pass = 0, fail = 0;
const out = [];
const line = (s) => { console.log(s); out.push(s); };
for (const [name, url] of Object.entries(PAGES)) for (const [w, h] of [[412, 915], [412, 870]]) for (const safe of [null, { top: 48, bottom: 32 }]) {
  if (safe && name.startsWith('修改前＋')) continue;
  const tag = `${name} ${w}x${h}${safe ? ' 安全區上48下32' : ''}`;
  const A = await mk(b, { url, w, h, nick: 'Alice', safe }), B = await mk(b, { url, w, h, nick: 'Bob', safe });
  const steps = [];
  try {
    steps.push(['大廳', await A.evaluate(SNAP)]);
    await A.click('#openCreate'); await sleep(150);
    await A.click('#cKind button[data-v="gomoku"]'); await A.click('#cTime button[data-v="10+10"]'); await A.click('#cRule button[data-v="tara"]');
    await A.click('#doCreate'); await sleep(700);
    steps.push(['一進房（等對手）', await A.evaluate(SNAP)]);
    const id = await A.evaluate(() => window.__duel.room.id);
    await B.waitForSelector(`[data-room="${id}"]`, { timeout: 8000 }); await B.click(`[data-room="${id}"]`); await sleep(300);
    steps.push(['B 進房（還沒入座）', await B.evaluate(SNAP)]);
    await B.click('[data-sit]'); await sleep(700);
    steps.push(['開始對局 A', await A.evaluate(SNAP)]); steps.push(['開始對局 B', await B.evaluate(SNAP)]);
    for (const p of [A, B]) { await clickCell(p, 7, 7); await sleep(200); }   // 第 1 手天元 → 另一方出現「換手／不換」
    await sleep(400);
    steps.push(['第 1 手後 A', await A.evaluate(SNAP)]); steps.push(['第 1 手後 B', await B.evaluate(SNAP)]);
    if (SHOTS) { const q = (await A.$('#phaseActs:not([hidden])')) ? A : B; await q.screenshot({ path: `shots/dvh_${tag.replace(/[^\w\u4e00-\u9fff]+/g, '_')}.png` }); }
  } catch (e) { steps.push(['錯誤', { err: String(e.message).slice(0, 200) }]); }
  const bad = steps.filter(([, s]) => s.err || s.over > 0 || (s.resign ?? -1) > 0 || (s.leave ?? -1) > 0 || (s.openCreate ?? -1) > 0);
  const expectBad = name === '修改前＋dvh多48';
  const ok = expectBad ? bad.length > 0 : bad.length === 0 && A.errs.length + B.errs.length === 0;
  ok ? pass++ : fail++;
  line(`${ok ? 'PASS' : 'FAIL'} ${tag}${expectBad ? '（預期：要捲）' : '（預期：不用捲）'}${A.safeErr ? ' 安全區指令失敗：' + A.safeErr : ''}`);
  for (const [n, s] of steps) line(`     ${n}：${JSON.stringify(s)}`);
  await A.context().close(); await B.context().close();
}
line(`PASS ${pass}／FAIL ${fail}`);
fs.writeFileSync('dvh-result.txt', out.join('\n') + '\n');
await b.close();
