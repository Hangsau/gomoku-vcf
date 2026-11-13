// 棋具商店檢查（2026-11-13）：node docs/design/shop-2026-11-13/check/check_shop.mjs
// 環境變數 NEG=1：故意把「商店有 14 格」的期望改成 13，驗證腳本會 FAIL（負向測試）。
// Playwright 用 C:\claudehome\tools\node_modules 現成的；本機靜態伺服器開在這個 process 裡（結束就自己關，不碰別的行程）。
// 線上請求全部攔截：/skins、/shop、/shop/claim 回假資料並記錄送出的請求，其他一律 abort，不碰線上。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
fs.mkdirSync(HERE, { recursive: true });
const NEG = process.env.NEG === '1';
const { chromium } = await import(pathToFileURL('C:/claudehome/tools/node_modules/playwright/index.mjs').href);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('PASS ' + msg); } else { fail++; console.log('FAIL ' + msg); } };

const NEW_B = ['grass', 'starry', 'beach', 'chalk', 'ice', 'denim', 'pool'], NEW_S = ['poop', 'bunny', 'pets', 'onigiri', 'sky', 'boo', 'donut'];
const ALL_KEYS = [...NEW_B.map((x) => 'b:' + x), ...NEW_S.map((x) => 's:' + x)];
const EMPTY = { boards: [], stones: [] };
const ALL_ON = { off: EMPTY, on: { boards: NEW_B, stones: NEW_S } };
const NONE_ON = { off: EMPTY, on: EMPTY };
const FORBID = /收費|charge|paid|有料|유료/i;

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });   // 用系統 Chrome（不全域安裝）
// opts: skins（/skins 回什麼；'500' 就回 500）、owned（伺服器 /shop 的 owned；null＝連不上）、prices
async function newPage(w, h, lang, ls = {}, opts = {}) {
  const o = { skins: ALL_ON, owned: [], prices: {}, ...opts };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  // 預設的 localStorage 只在這個分頁第一次載入時放（sessionStorage 旗標），重新整理不會蓋掉玩家後來的選擇
  await ctx.addInitScript(([lang, ls]) => { try { if (sessionStorage.getItem('__shopInit')) return; sessionStorage.setItem('__shopInit', '1'); if (lang) localStorage.setItem('vcfgame.lang', lang); for (const k in ls) localStorage.setItem(k, ls[k]); } catch {} }, [lang, ls]);
  const page = await ctx.newPage();
  const errs = [], claims = [], gets = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  await page.route('https://vcf-game-api.psyhangsau.workers.dev/**', (r) => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/skins') {
      if (o.skins === '500') return r.fulfill({ status: 500, contentType: 'text/plain', headers: CORS, body: 'err' });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o.skins) });
    }
    if (url.pathname === '/shop' && req.method() === 'GET') {
      gets.push(url.search);
      if (o.owned === null) return r.abort();
      return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ owned: o.owned, prices: o.prices }) });
    }
    if (url.pathname === '/shop/claim' && req.method() === 'POST') {
      const b = JSON.parse(req.postData() || '{}'); claims.push(b);
      if (o.owned === null) return r.abort();   // 伺服器整個連不上
      const refused = (b.items || []).filter((k) => Number(o.prices[k]) > 0);
      return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ owned: [...new Set([...o.owned, ...(b.items || []).filter((k) => !refused.includes(k))])], refused }) });
    }
    return r.abort();   // 其他線上請求不碰
  });
  return { ctx, page, errs, claims, gets };
}
async function gotoHome(page) {
  await page.goto(BASE + '/game.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RushSkin && window.RushShop && document.getElementById('openShop'));
  await page.waitForTimeout(600);
}
async function openShop(page) { await gotoHome(page); await page.click('#openShop'); await page.waitForSelector('#shopPage:not([hidden])'); await page.waitForTimeout(250); }
async function openPicker(page) {
  await gotoHome(page);
  await page.click('#openSet'); await page.waitForSelector('#sSet:not([hidden])');
  await page.click('#setSkin'); await page.waitForSelector('#skinPick:not([hidden]) canvas'); await page.waitForTimeout(300);
}
const lsGet = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const lsOwned = async (page) => { try { return JSON.parse(await lsGet(page, 'vcfgame.owned')) || []; } catch { return null; } };

// 版面：沒有捲動、沒有元素超出視窗、觸控範圍
const layout = (page, rootSel, touchSel) => page.evaluate(([rootSel, touchSel]) => {
  const r = document.querySelector(rootSel), vw = innerWidth, vh = innerHeight, bad = [];
  for (const e of r.querySelectorAll('*')) {
    if (e.closest('[hidden]')) continue;
    const b = e.getBoundingClientRect(); if (!b.width && !b.height) continue;
    if (b.bottom > vh + 0.5 || b.right > vw + 0.5 || b.left < -0.5 || b.top < -0.5) bad.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ':' + Math.round(b.bottom) + '/' + Math.round(b.right));
  }
  const touch = [...r.querySelectorAll(touchSel)].filter((e) => !e.closest('[hidden]')).map((e) => { const b = e.getBoundingClientRect(); return Math.min(b.width, b.height); });
  const de = document.documentElement;
  return { bad: bad.slice(0, 5), sh: r.scrollHeight, ch: r.clientHeight, docSh: de.scrollHeight, vh, docSw: de.scrollWidth, vw, minTouch: touch.length ? Math.min(...touch) : 999, n: touch.length };
}, [rootSel, touchSel]);
const homeLayout = (page) => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight, bad = [], de = document.documentElement;
  for (const e of document.querySelectorAll('#sHome *')) {
    if (e.closest('[hidden]')) continue;
    const b = e.getBoundingClientRect(); if (!b.width && !b.height) continue;
    if (b.bottom > vh + 0.5 || b.right > vw + 0.5 || b.left < -0.5) bad.push((e.id || e.className || e.tagName) + ':' + Math.round(b.bottom) + '/' + Math.round(b.right));
  }
  const top = [...document.querySelectorAll('#sHome .topbar .icob')].map((e) => { const b = e.getBoundingClientRect(); return Math.min(b.width, b.height); });
  return { bad: bad.slice(0, 5), docSh: de.scrollHeight, vh, docSw: de.scrollWidth, vw, minTouch: Math.min(...top), n: top.length };
});
const pageText = (page) => page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label],[title],[alt]')].map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.title || '') + ' ' + (e.getAttribute('alt') || '')).join(' '));
const shotsOf = (name) => path.join(HERE, name);

// ---- 1. 四語 × 兩尺寸：首頁、商店、小框、棋具頁（棋具頁用 14 件全擁有的最擠情況）----
for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[360, 640], [375, 667]]) {
  const tag = `${lang} ${w}x${h}`;
  { // 首頁、商店、小框
    const { ctx, page, errs } = await newPage(w, h, lang);
    await gotoHome(page);
    const H = await homeLayout(page);
    ok(H.bad.length === 0 && H.docSh <= H.vh && H.docSw <= H.vw, `${tag} 首頁沒有捲動／超出（docSh ${H.docSh}<=${H.vh}、bad ${JSON.stringify(H.bad)}）`);
    ok(H.minTouch >= 44 && H.n >= 5, `${tag} 首頁上排鈕（含商店 #openShop）最小觸控 ${H.minTouch} >= 44、共 ${H.n} 顆`);
    const label = await page.getAttribute('#openShop', 'aria-label');
    if (lang === 'zh' && w === 375) await page.screenshot({ path: shotsOf('home_zh_375x667.png') });
    await page.click('#openShop'); await page.waitForSelector('#shopPage:not([hidden])'); await page.waitForTimeout(250);
    const Sh = await layout(page, '#shopPage', '.cell,.back');
    ok(Sh.bad.length === 0 && Sh.sh <= Sh.ch && Sh.docSh <= Sh.vh, `${tag} 商店頁沒有捲動／超出（sh ${Sh.sh}<=${Sh.ch}、bad ${JSON.stringify(Sh.bad)}）`);
    ok(Sh.n === (NEG ? 13 : 14) + 1 && Sh.minTouch >= 44, `${tag} 商店格子＋返回鈕共 ${Sh.n}（期望 ${(NEG ? 13 : 14) + 1}）、最小觸控 ${Sh.minTouch} >= 44`);
    const hd = await page.evaluate(() => ({ title: document.querySelector('#shopPage h1').textContent, pill: document.querySelector('#shopPage .pill').textContent, tag: document.querySelector('#shopPage .cell .tg').textContent }));
    ok(label === hd.title && hd.title && hd.pill && hd.tag, `${tag} 四語文字有出來：入口 aria「${label}」、標題「${hd.title}」、膠囊「${hd.pill}」、格子「${hd.tag}」`);
    if (lang === 'zh' && w === 375) await page.screenshot({ path: shotsOf('shop_zh_375x667.png') });
    if (lang === 'en' && w === 360) await page.screenshot({ path: shotsOf('shop_en_360x640.png') });
    await page.click('.cell[data-k="s:donut"]'); await page.waitForTimeout(250);
    const D = await layout(page, '#shopPage .box', '.cta,.x');
    const dlgIn = await page.evaluate(() => { const b = document.querySelector('#shopDlg .box').getBoundingClientRect(); return { ok: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, cv: document.querySelector('#shopDlg canvas').getBoundingClientRect().width }; });
    ok(dlgIn.ok && D.bad.length === 0 && D.docSh <= D.vh && D.minTouch >= 44, `${tag} 小框沒有捲動／超出（框在視窗內 ${dlgIn.ok}、預覽 ${Math.round(dlgIn.cv)}px、最小觸控 ${D.minTouch}）`);
    if (lang === 'en' && w === 360) await page.screenshot({ path: shotsOf('dialog_en_360x640.png') });
    const txt = await pageText(page);
    ok(!FORBID.test(txt), `${tag} 商店＋小框文字沒有禁字`);
    ok(errs.length === 0, `${tag} 首頁／商店沒有 console error ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  { // 棋具頁（14 件全領＋全開）
    const { ctx, page, errs } = await newPage(w, h, lang, { 'vcfgame.owned': JSON.stringify(ALL_KEYS) }, { owned: ALL_KEYS });
    await openPicker(page);
    const P = await layout(page, '#skinPick', '.sopt');
    const cnt = await page.evaluate(() => ({ nb: document.querySelectorAll('[data-b]').length, ns: document.querySelectorAll('[data-s]').length, plus: document.querySelectorAll('[data-shop]').length, cv: document.querySelector('#skinPick canvas').getBoundingClientRect().width }));
    ok(P.bad.length === 0 && P.sh <= P.ch && P.docSh <= P.vh, `${tag} 棋具頁沒有捲動／超出（sh ${P.sh}<=${P.ch}、bad ${JSON.stringify(P.bad)}）`);
    ok(cnt.nb === 15 && cnt.ns === 14 && cnt.plus === 2, `${tag} 棋具頁 棋盤 ${cnt.nb}/15、棋子 ${cnt.ns}/14、「＋」${cnt.plus}/2`);
    const pv = await page.evaluate(() => [...document.querySelectorAll('#skinPick [data-shop]')].map((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return { op: cs.opacity, vis: cs.visibility, w: b.width, h: b.height, svg: !!e.querySelector('svg') }; }));
    ok(pv.length === 2 && pv.every((x) => x.op === '1' && x.vis === 'visible' && x.w > 20 && x.h >= 40 && x.svg), `${tag} 「＋」真的看得到（opacity／visibility／尺寸）${JSON.stringify(pv[0])}`);   // 第一次漏了：game.html 有全域 .plus{opacity:0}，撞名＋DOM 數量還是對的
    ok(cnt.cv >= 190, `${tag} 棋具頁預覽 ${Math.round(cnt.cv)}px >= 190`);
    const hh = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#skinPick .sopt')].map((e) => e.offsetHeight)));
    ok(hh >= 40, `${tag} 棋具頁格子高度最小 ${hh} >= 40`);
    if (lang === 'zh' && w === 375) await page.screenshot({ path: shotsOf('picker_zh_375x667.png') });
    const txt = await pageText(page);
    ok(!FORBID.test(txt), `${tag} 棋具頁文字沒有禁字`);
    ok(errs.length === 0, `${tag} 棋具頁沒有 console error ${errs.slice(0, 2)}`);
    await ctx.close();
  }
}

// ---- 2. 全新玩家 ----
{
  const { ctx, page, errs } = await newPage(375, 667, 'zh');
  await openShop(page);
  const r = await page.evaluate(() => ({
    cells: [...document.querySelectorAll('#shopPage .cell')].map((e) => e.dataset.k), tags: [...document.querySelectorAll('#shopPage .cell .tg')].map((e) => e.textContent),
    secs: [...document.querySelectorAll('#shopPage .sec b')].map((e) => e.textContent),
    sp: RushSkin.setStones('poop'), sg: RushSkin.setBoard('grass'), cur: RushSkin.get().board.id + '/' + RushSkin.get().stones.id, owned: localStorage.getItem('vcfgame.owned'),
  }));
  ok(r.cells.length === (NEG ? 13 : 14), `全新玩家：商店 ${r.cells.length} 格（期望 ${NEG ? 13 : 14}）`);
  ok(r.tags.every((t) => t === '免費'), `全新玩家：每格都是「免費」${[...new Set(r.tags)]}`);
  ok(r.secs.join(',') === '棋子,棋盤', `兩區標題 ${r.secs}`);
  ok(r.sp === false && r.sg === false && r.cur === 'classic/flat', `未領取 setStones('poop') ${r.sp}、setBoard('grass') ${r.sg} 都回 false，仍是 ${r.cur}`);
  ok(r.owned === '[]', `第一次載入存下空的擁有清單 ${r.owned}`);
  await page.click('#shopPage .back'); await page.waitForSelector('#shopPage', { state: 'hidden' });
  await page.click('#openSet'); await page.click('#setSkin'); await page.waitForSelector('#skinPick:not([hidden]) canvas');
  const p = await page.evaluate(() => ({ b: [...document.querySelectorAll('[data-b]')].map((e) => e.dataset.b), s: [...document.querySelectorAll('[data-s]')].map((e) => e.dataset.s), plus: document.querySelectorAll('[data-shop]').length }));
  ok(!NEW_B.some((x) => p.b.includes(x)) && !NEW_S.some((x) => p.s.includes(x)) && p.b.length === 8 && p.s.length === 7, `全新玩家：棋具頁看不到商店商品（棋盤 ${p.b.length}/8、棋子 ${p.s.length}/7）`);
  ok(p.plus === 2, `棋具頁兩排各有「＋」${p.plus}`);
  await page.click('#skinPick [data-shop]'); await page.waitForSelector('#shopPage:not([hidden])');
  ok(await page.evaluate(() => document.getElementById('skinPick').hidden), '按「＋」後棋具頁收起、商店打開');
  ok(errs.length === 0, `全新玩家流程沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 3. 領取 → 使用 → 棋具頁出現；重新整理仍在 ----
{
  const { ctx, page, errs, claims } = await newPage(375, 667, 'zh');
  await openShop(page);
  await page.click('.cell[data-k="s:poop"]'); await page.waitForTimeout(200);
  const d0 = await page.evaluate(() => ({ h2: document.querySelector('#shopDlg h2').textContent, st: document.querySelector('#shopDlg .st').textContent, cta: document.querySelector('#shopDlg .cta').textContent }));
  ok(d0.h2 === '便便與霜淇淋' && d0.st === '限時免費' && d0.cta === '領取', `小框（未領）：${d0.h2}／${d0.st}／${d0.cta}`);
  await page.screenshot({ path: shotsOf('dialog_zh_375x667_free.png') });
  await page.click('#shopDlg .cta'); await page.waitForFunction(() => document.querySelector('#shopDlg .cta')?.textContent === '使用'); await page.waitForTimeout(200);
  const d1 = await page.evaluate(() => ({ st: document.querySelector('#shopDlg .st').textContent, tag: document.querySelector('.cell[data-k="s:poop"] .tg').textContent, own: RushSkin.owns(RushSkin.stones.find((x) => x.id === 'poop')) }));
  ok(d1.st === '已擁有' && d1.tag === '已擁有' && d1.own, `領取後：小框膠囊「${d1.st}」、格子「${d1.tag}」、RushSkin.owns ${d1.own}`);
  ok(claims.length === 1 && claims[0].items.length === 1 && claims[0].items[0] === 's:poop' && claims[0].src === 'free' && /^[0-9a-f-]{16,40}$/i.test(claims[0].vid), `送出 POST /shop/claim ${JSON.stringify(claims[0])}`);
  const vid1 = await lsGet(page, 'vcfgame.vid');
  ok(claims[0] && claims[0].vid === vid1, 'claim 的 vid 就是 localStorage vcfgame.vid');
  await page.screenshot({ path: shotsOf('dialog_zh_375x667_owned.png') });
  await page.click('#shopDlg .cta'); await page.waitForFunction(() => document.querySelector('#shopDlg .cta')?.textContent === '使用中'); await page.waitForTimeout(200);
  const d2 = await page.evaluate(() => ({ dis: document.querySelector('#shopDlg .cta').disabled, tag: document.querySelector('.cell[data-k="s:poop"] .tg').textContent, on: document.querySelector('.cell[data-k="s:poop"]').classList.contains('on'), cur: RushSkin.get().stones.id, ls: localStorage.getItem('vcfgame.stones') }));
  ok(d2.dis && d2.tag === '使用中' && d2.on && d2.cur === 'poop' && d2.ls === 'poop', `使用後：按鈕 disabled ${d2.dis}、格子「${d2.tag}」外框 on ${d2.on}、RushSkin 用 ${d2.cur}、localStorage ${d2.ls}`);
  await page.screenshot({ path: shotsOf('dialog_zh_375x667_using.png') });
  ok(claims.length === 1, `使用不會再送 claim（共 ${claims.length} 次）`);
  // 領第二件：棋盤
  await page.click('#shopDlg .x'); await page.click('.cell[data-k="b:starry"]'); await page.click('#shopDlg .cta'); await page.waitForFunction(() => document.querySelector('#shopDlg .cta')?.textContent === '使用');
  await page.click('#shopDlg .cta'); await page.waitForFunction(() => document.querySelector('#shopDlg .cta')?.textContent === '使用中');
  ok(claims.length === 2 && claims[1].items[0] === 'b:starry', `領棋盤 b:starry：claim ${JSON.stringify(claims[1])}`);
  const lsO = await lsOwned(page);
  ok(lsO && lsO.includes('s:poop') && lsO.includes('b:starry') && lsO.length === 2, `localStorage 擁有清單 ${JSON.stringify(lsO)}`);
  // 點框外關閉
  await page.mouse.click(5, 5); await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.getElementById('shopDlg').hidden), '點小框外面會關閉小框');
  // 棋具頁出現
  await page.click('#shopPage .back'); await page.waitForSelector('#shopPage', { state: 'hidden' });
  await page.click('#openSet'); await page.click('#setSkin'); await page.waitForSelector('#skinPick:not([hidden]) canvas');
  const p = await page.evaluate(() => ({ b: [...document.querySelectorAll('[data-b]')].map((e) => e.dataset.b), s: [...document.querySelectorAll('[data-s]')].map((e) => e.dataset.s), pressedS: document.querySelector('[data-s][aria-pressed="true"]').dataset.s, pressedB: document.querySelector('[data-b][aria-pressed="true"]').dataset.b }));
  ok(p.s.includes('poop') && p.b.includes('starry') && p.s.length === 8 && p.b.length === 9 && p.pressedS === 'poop' && p.pressedB === 'starry', `棋具頁出現領到的：棋子 ${p.s.length}/8 含 poop、棋盤 ${p.b.length}/9 含 starry，選中 ${p.pressedS}/${p.pressedB}`);
  // 重新整理
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RushSkin && window.RushShop); await page.waitForTimeout(600);
  const re = await page.evaluate(() => ({ cur: RushSkin.get().board.id + '/' + RushSkin.get().stones.id, owned: JSON.parse(localStorage.getItem('vcfgame.owned')) }));
  ok(re.cur === 'starry/poop' && re.owned.length === 2, `重新整理後仍使用 ${re.cur}、擁有 ${JSON.stringify(re.owned)}`);
  await page.click('#openShop'); await page.waitForSelector('#shopPage:not([hidden])');
  const re2 = await page.evaluate(() => [...document.querySelectorAll('#shopPage .cell')].filter((e) => e.querySelector('.tg').textContent !== '免費').map((e) => e.dataset.k + ':' + e.querySelector('.tg').textContent));
  ok(re2.length === 2 && re2.includes('s:poop:使用中') && re2.includes('b:starry:使用中'), `重新整理後商店仍顯示 ${re2}`);
  ok(errs.length === 0, `領取流程沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 4. 舊玩家：上線前已經在用的不收回 ----
{
  const { ctx, page, errs, claims } = await newPage(375, 667, 'zh', { 'vcfgame.stones': 'poop', 'vcfgame.board': 'grass' });
  await gotoHome(page);
  const r = await page.evaluate(() => ({ cur: RushSkin.get().board.id + '/' + RushSkin.get().stones.id, owned: JSON.parse(localStorage.getItem('vcfgame.owned')) }));
  ok(r.cur === 'grass/poop', `舊玩家：載入後仍是 ${r.cur}`);
  ok(r.owned.includes('s:poop') && r.owned.includes('b:grass') && r.owned.length === 2, `舊玩家：擁有清單 ${JSON.stringify(r.owned)}`);
  const g = claims.find((c) => c.src === 'grand');
  ok(g && g.items.length === 2 && g.items.includes('s:poop') && g.items.includes('b:grass'), `舊玩家：送出 src:'grand' 的 claim ${JSON.stringify(g)}`);
  await page.click('#openShop'); await page.waitForSelector('#shopPage:not([hidden])');
  const t = await page.evaluate(() => [...document.querySelectorAll('#shopPage .cell')].filter((e) => e.querySelector('.tg').textContent === '使用中').map((e) => e.dataset.k));
  ok(t.length === 2, `舊玩家：商店兩格「使用中」${t}`);
  // 已經有 owned 鍵的玩家不再走遷移（即使 stones 是商店商品但沒領）
  ok(errs.length === 0, `舊玩家沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
  const b = await newPage(375, 667, 'zh', { 'vcfgame.stones': 'poop', 'vcfgame.owned': '[]' });
  await gotoHome(b.page);
  const r2 = await b.page.evaluate(() => ({ cur: RushSkin.get().stones.id, owned: localStorage.getItem('vcfgame.owned') }));
  ok(r2.cur === 'flat' && r2.owned === '[]' && !b.claims.some((c) => c.src === 'grand'), `已有擁有清單的玩家不再遷移：實際用 ${r2.cur}、清單 ${r2.owned}、沒送 grand`);
  await b.ctx.close();
}

// ---- 5. 同步：聯集、補送、連不上 ----
{
  const { ctx, page, errs, claims, gets } = await newPage(375, 667, 'zh', { 'vcfgame.owned': JSON.stringify(['s:pets']) }, { owned: ['b:grass', 'b:pool'] });
  await gotoHome(page);
  const o = await lsOwned(page);
  ok(gets.length >= 1 && /vid=[0-9a-f-]{16,40}/i.test(gets[0]), `載入時 GET /shop${gets[0]}`);
  ok(o && o.includes('b:grass') && o.includes('b:pool') && o.includes('s:pets') && o.length === 3, `聯集：伺服器有、本機沒有的出現在本機 ${JSON.stringify(o)}`);
  const f = claims.find((c) => c.items.includes('s:pets'));
  ok(f && f.items.length === 1 && f.src === 'free', `本機有、伺服器沒有的補送 ${JSON.stringify(f)}`);
  await page.click('#openShop'); await page.waitForSelector('#shopPage:not([hidden])');
  const tg = await page.evaluate(() => ['b:grass', 'b:pool', 's:pets', 's:poop'].map((k) => k + ':' + document.querySelector(`.cell[data-k="${k}"] .tg`).textContent));
  ok(tg.join('|') === 'b:grass:已擁有|b:pool:已擁有|s:pets:已擁有|s:poop:免費', `商店顯示 ${tg}`);
  ok(errs.length === 0, `同步沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}
{   // /shop 連不上
  const { ctx, page, errs } = await newPage(375, 667, 'zh', { 'vcfgame.owned': JSON.stringify(['s:bunny']) }, { owned: null });
  await openShop(page);
  const r = await page.evaluate(() => ({ n: document.querySelectorAll('#shopPage .cell').length, tag: document.querySelector('.cell[data-k="s:bunny"] .tg').textContent }));
  ok(r.n === 14 && r.tag === '已擁有', `/shop 連不上：商店照常 ${r.n} 格、本機清單的 bunny「${r.tag}」`);
  await page.click('.cell[data-k="s:pets"]'); await page.click('#shopDlg .cta'); await page.waitForFunction(() => document.querySelector('#shopDlg .cta')?.textContent === '使用');
  const lo = await lsOwned(page);
  ok(lo.includes('s:pets'), `/shop 連不上：領取仍先寫本機 ${JSON.stringify(lo)}`);
  ok(errs.length === 0, `/shop 連不上沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}
{   // 價格 > 0 → 伺服器拒絕 → 本機拿掉
  const { ctx, page, errs, claims } = await newPage(375, 667, 'zh', {}, { prices: { 's:boo': 30 } });
  await openShop(page);
  const pr = await page.evaluate(() => RushSkin.price(RushSkin.stones.find((x) => x.id === 'boo')) + '/' + RushSkin.price(RushSkin.stones.find((x) => x.id === 'poop')));
  ok(pr === '30/0', `RushSkin.price 讀到 /shop 的 prices：boo/poop = ${pr}`);
  await page.click('.cell[data-k="s:boo"]'); await page.click('#shopDlg .cta'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ cta: document.querySelector('#shopDlg .cta').textContent, own: localStorage.getItem('vcfgame.owned') }));
  ok(claims.length === 1 && r.cta === '領取' && !r.own.includes('s:boo'), `被伺服器 refused：按鈕回到「${r.cta}」、本機清單 ${r.own}`);
  ok(errs.length === 0, `refused 沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 6. 後台開關 ----
{
  const { ctx, page } = await newPage(375, 667, 'zh', {}, { skins: { off: EMPTY, on: { boards: ['grass'], stones: ['poop'] } } });
  await openShop(page);
  const r = await page.evaluate(() => ({ cells: [...document.querySelectorAll('#shopPage .cell')].map((e) => e.dataset.k), secs: [...document.querySelectorAll('#shopPage .sec b')].map((e) => e.textContent) }));
  ok(r.cells.length === 2 && r.cells.includes('s:poop') && r.cells.includes('b:grass'), `後台只開 2 件：商店 ${r.cells}`);
  const H = await layout(page, '#shopPage', '.cell');
  ok(H.sh <= H.ch && H.bad.length === 0, `只開 2 件版面正常（sh ${H.sh}/${H.ch}）`);
  await ctx.close();
}
{
  const { ctx, page, errs } = await newPage(375, 667, 'zh', {}, { skins: NONE_ON });
  await openShop(page);
  const r = await page.evaluate(() => ({ cells: document.querySelectorAll('#shopPage .cell').length, empty: document.querySelector('#shopPage .empty')?.textContent }));
  ok(r.cells === 0 && r.empty === '目前沒有上架的商品', `後台全關：${r.cells} 格、文字「${r.empty}」`);
  await ctx.close();
  for (const lang of ['en', 'ja', 'ko']) {
    const x = await newPage(360, 640, lang, {}, { skins: '500' });
    await openShop(x.page);
    const e = await x.page.evaluate(() => document.querySelector('#shopPage .empty')?.textContent);
    ok(!!e && !FORBID.test(e), `${lang} 連不上 /skins（optIn 全關）：空狀態「${e}」`);
    ok(x.errs.length === 0, `${lang} 空狀態沒有 console error ${x.errs.slice(0, 2)}`);
    await x.ctx.close();
  }
}

// ---- 7. 其他頁面載入新 skin.js 不報錯，且第一次載入會建 vid ----
for (const f of ['duel.html', 'score.html']) {
  const { ctx, page, errs } = await newPage(375, 667, 'zh');
  await page.goto(BASE + '/' + f, { waitUntil: 'load' }); await page.waitForFunction(() => window.RushSkin); await page.waitForTimeout(500);
  const v = await lsGet(page, 'vcfgame.vid');
  ok(/^[0-9a-f-]{16,40}$/i.test(v || ''), `${f} 載入後 vcfgame.vid 有效（${v && v.slice(0, 8)}…）`);
  const real = errs.filter((e) => !/WebSocket connection to 'ws:\/\/127\.0\.0\.1/.test(e));   // duel.html 在本機會連 ws://127.0.0.1:8787（對戰伺服器，檢查環境沒開），跟商店無關
  ok(real.length === 0, `${f} 沒有 console error（已排除本機對戰 WebSocket 連不上）${real.slice(0, 2)}`);
  await ctx.close();
}
{   // game.html 原本那段讀到既有 vid 不會重產
  const fixed = '0123456789abcdef0123456789abcdef';
  const { ctx, page } = await newPage(375, 667, 'zh', { 'vcfgame.vid': fixed });
  await gotoHome(page);
  ok(await lsGet(page, 'vcfgame.vid') === fixed, 'game.html 載入後既有的 vcfgame.vid 沒被換掉');
  await ctx.close();
}

// ---- 8. 負向測試：這支腳本抓得到版面壞掉 ----
{
  const { ctx, page } = await newPage(360, 640, 'zh');
  await openShop(page);
  await page.addStyleTag({ content: '#shopPage .grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important} #shopPage{--ch:120px !important}' });
  await page.evaluate(() => document.querySelector('#shopPage').classList.add('x')); await page.waitForTimeout(200);
  const L = await layout(page, '#shopPage', '.cell');
  ok(L.bad.length > 0 || L.sh > L.ch, `負向測試：把格子改成 2 欄會被抓到（bad=${L.bad.length} sh=${L.sh}/ch=${L.ch}）`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`PASS ${pass}／FAIL ${fail}${NEG ? '（NEG=1：預期有 FAIL）' : ''}`);
process.exit(fail ? 1 : 0);
