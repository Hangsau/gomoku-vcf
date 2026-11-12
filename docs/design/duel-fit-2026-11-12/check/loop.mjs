// 檢查保險修正不會自己一直重算：數 ResizeObserver 回呼次數，畫面靜止 3 秒內應該是 0。
// 需要 http.server 8793、wrangler dev 8789。用法：node loop.mjs
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let fail = 0, pass = 0;
for (const [w, h, rule, lang] of [[412, 790, 'tara', 'zh'], [320, 570, 'swap2', 'en'], [275, 527, 'tara', 'en'], [412, 450, 'tara', 'zh'], [360, 640, 'free', 'ko']]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await c.addInitScript(([lang]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) { return new W(String(u).replace(':8787/', ':8789/'), p); };
    window.WebSocket.prototype = W.prototype;
    localStorage.setItem('vcfgame.lang', lang); localStorage.setItem('vcfgame.nick', 'Loop');
    const RO = window.ResizeObserver; window.__ro = 0;
    window.ResizeObserver = class extends RO { constructor(cb) { super((...a) => { window.__ro++; cb(...a); }); } };
    const raf = window.requestAnimationFrame; window.__raf = 0;   // 頁面自己排的 rAF 次數（含時鐘等其他用途，只當參考）
    window.requestAnimationFrame = (f) => { window.__raf++; return raf(f); };
  }, [lang]);
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /ResizeObserver loop/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8793/duel.html');
  await p.waitForFunction(() => window.__duel, null, { timeout: 15000 });
  await p.click('#openCreate'); await sleep(150);
  await p.click('#cKind button[data-v="gomoku"]'); await p.click('#cTime button[data-v="none"]'); await p.click(`#cRule button[data-v="${rule}"]`);
  await p.click('#doCreate'); await sleep(1500);
  const before = await p.evaluate(() => ({ ro: window.__ro, tight: document.getElementById('sRoom').classList.contains('tight'), px: document.getElementById('board').clientWidth }));
  await sleep(3000);
  const after = await p.evaluate(() => ({ ro: window.__ro, tight: document.getElementById('sRoom').classList.contains('tight'), px: document.getElementById('board').clientWidth }));
  const ok = after.ro === before.ro && after.px === before.px && errs.length === 0;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${w}x${h} ${rule} ${lang}：進房後 ResizeObserver 回呼 ${before.ro} 次，靜止 3 秒內再多 ${after.ro - before.ro} 次；縮緊=${after.tight} 棋盤=${after.px}${errs.length ? ' 錯誤 ' + JSON.stringify(errs) : ''}`);
  await c.close();
}
console.log(`PASS ${pass}／FAIL ${fail}`);
await b.close();
