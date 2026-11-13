// 棋具商店檢查（2026-11-13，施工單 3：商店首頁＋棋具頁 D）：node docs/design/shop-2026-11-13/check/check_shop.mjs
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
async function openStage(page, tab = 's') {
  await openShop(page); await page.click('#shopPage .card'); await page.waitForSelector('#shopPage .top canvas');
  if (tab === 'b') await page.click('#shopPage [data-tab="b"]');
  await page.waitForTimeout(250);
}
const cells = (page) => page.evaluate(() => [...document.querySelectorAll('#shopPage .cell')].map((e) => ({ k: e.dataset.k, nm: e.querySelector('.nm').textContent, tg: e.querySelector('.tg').textContent, sel: e.classList.contains('sel'), on: e.classList.contains('on') })));
const prev = (page) => page.evaluate(() => { const c = document.querySelector('#shopPage .top canvas'); return { board: c.dataset.board, stones: c.dataset.stones, w: c.getBoundingClientRect().width }; });
const ctaOf = (page) => page.evaluate(() => { const b = document.querySelector('#shopPage .cta'); return b ? { t: b.textContent, dis: b.disabled, fit: b.scrollWidth <= b.clientWidth && b.scrollHeight <= b.clientHeight } : null; });
// 預覽畫布像素：取盤面左上角一小塊（沒有子）的顏色，驗證真的畫了這個盤
const px = (page) => page.evaluate(() => { const c = document.querySelector('#shopPage .top canvas'), x = c.getContext('2d'), w = c.width, d = x.getImageData(Math.round(w * 0.06), Math.round(w * 0.06), 4, 4).data; return [d[0], d[1], d[2]]; });
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

// ---- 1. 四語 × 兩尺寸：首頁、商店首頁、棋具頁兩個分頁（14 件全上架）、設定→棋具頁 ----
for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[360, 640], [375, 667]]) {
  const tag = `${lang} ${w}x${h}`;
  { // 首頁、商店首頁、棋具頁
    const { ctx, page, errs } = await newPage(w, h, lang);
    await gotoHome(page);
    const H = await homeLayout(page);
    ok(H.bad.length === 0 && H.docSh <= H.vh && H.docSw <= H.vw, `${tag} 首頁沒有捲動／超出（docSh ${H.docSh}<=${H.vh}、bad ${JSON.stringify(H.bad)}）`);
    ok(H.minTouch >= 44 && H.n >= 5, `${tag} 首頁上排鈕（含商店 #openShop）最小觸控 ${H.minTouch} >= 44、共 ${H.n} 顆`);
    const label = await page.getAttribute('#openShop', 'aria-label');
    if (lang === 'zh' && w === 375) await page.screenshot({ path: shotsOf('home_zh_375x667.png') });
    await page.click('#openShop'); await page.waitForSelector('#shopPage:not([hidden])'); await page.waitForTimeout(250);
    const Sh = await layout(page, '#shopPage', '.card,.back');
    const hd = await page.evaluate(() => ({ title: document.querySelector('#shopPage h1').textContent, cards: document.querySelectorAll('#shopPage .card').length, sub: document.querySelector('#shopPage .card .tx span')?.textContent, pill: document.querySelector('#shopPage .card em')?.textContent }));
    ok(Sh.bad.length === 0 && Sh.sh <= Sh.ch && Sh.docSh <= Sh.vh, `${tag} 商店首頁沒有捲動／超出（sh ${Sh.sh}<=${Sh.ch}、bad ${JSON.stringify(Sh.bad)}）`);
    ok(Sh.minTouch >= 44 && hd.cards === 1 && label === hd.title && hd.pill, `${tag} 商店首頁：入口 aria「${label}」＝標題「${hd.title}」、1 張卡、膠囊「${hd.pill}」、最小觸控 ${Sh.minTouch}`);
    ok(/\b7\b.*\b7\b/.test(hd.sub), `${tag} 卡片數量「${hd.sub}」＝ 7／7`);
    if (lang === 'zh' && w === 375) await page.screenshot({ path: shotsOf('store_home_zh_375x667.png') });
    let txt = await pageText(page); ok(!FORBID.test(txt), `${tag} 商店首頁文字沒有禁字`);
    await page.click('#shopPage .card'); await page.waitForSelector('#shopPage .top canvas'); await page.waitForTimeout(250);
    for (const t of ['s', 'b']) {
      await page.click(`#shopPage [data-tab="${t}"]`); await page.waitForTimeout(150);
      const L = await layout(page, '#shopPage', '.cell,.back,.stabs button,.cta');
      const cs = await cells(page), pv = await prev(page);
      const cut = await page.evaluate(() => [...document.querySelectorAll('#shopPage .cell')].filter((e) => { const n = e.querySelector('.nm'), t = e.querySelector('.tg'), eb = e.getBoundingClientRect().bottom; return n.scrollWidth > n.clientWidth + 1 || t.scrollWidth > t.clientWidth + 1 || n.getBoundingClientRect().bottom > eb - 1 || t.getBoundingClientRect().bottom > eb + 0.5; }).map((e) => e.dataset.k));
      ok(L.bad.length === 0 && L.sh <= L.ch && L.docSh <= L.vh, `${tag} 棋具頁[${t}] 沒有捲動／超出（sh ${L.sh}<=${L.ch}、bad ${JSON.stringify(L.bad)}）`);
      ok(cs.length === (NEG ? 7 : 8) && L.minTouch >= 44, `${tag} 棋具頁[${t}] 格子 ${cs.length}/${NEG ? 7 : 8}、最小觸控 ${L.minTouch}`);
      ok(cut.length === 0 && cs.every((c) => c.nm.length > 0), `${tag} 棋具頁[${t}] 每格有名稱、名稱和狀態字都沒被切（切到：${cut}）`);
      ok(cs[0].k === (t === 's' ? 's:flat' : 'b:classic') && cs[0].tg.length > 0, `${tag} 棋具頁[${t}] 第一格是預設「${cs[0].k}／${cs[0].nm}／${cs[0].tg}」`);
      ok(pv.w >= 140, `${tag} 棋具頁[${t}] 預覽盤 ${Math.round(pv.w)}px >= 140`);
      const long = await page.evaluate(() => [...document.querySelectorAll('#shopPage .cell')].sort((a, b) => b.querySelector('.nm').textContent.length - a.querySelector('.nm').textContent.length)[0].dataset.k);
      await page.click(`#shopPage .cell[data-k="${long}"]`); await page.waitForTimeout(150);
      const L2 = await layout(page, '#shopPage', '.cell,.back,.stabs button,.cta'), cta = await ctaOf(page);
      ok(L2.bad.length === 0 && L2.sh <= L2.ch && cta && cta.fit, `${tag} 棋具頁[${t}] 選最長名稱 ${long}：不捲動、按鈕「${cta && cta.t}」沒被切`);
      txt = await pageText(page); ok(!FORBID.test(txt), `${tag} 棋具頁[${t}] 文字沒有禁字`);
      if (lang === 'zh' && w === 375 && t === 'b') await page.screenshot({ path: shotsOf('stage_zh_375x667_boards.png') });
      if (lang === 'en' && w === 360 && t === 's') await page.screenshot({ path: shotsOf('stage_en_360x640_stones.png') });
      if (lang === 'ja' && w === 360 && t === 's') await page.screenshot({ path: shotsOf('stage_ja_360x640_stones.png') });
      if (lang === 'ko' && w === 360 && t === 's') await page.screenshot({ path: shotsOf('stage_ko_360x640_stones.png') });
    }
    ok(errs.length === 0, `${tag} 首頁／商店沒有 console error ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  { // 設定→棋具頁（14 件全領＋全開）
    const { ctx, page, errs } = await newPage(w, h, lang, { 'vcfgame.owned': JSON.stringify(ALL_KEYS) }, { owned: ALL_KEYS });
    await openPicker(page);
    const P = await layout(page, '#skinPick', '.sopt');
    const cnt = await page.evaluate(() => ({ nb: document.querySelectorAll('[data-b]').length, ns: document.querySelectorAll('[data-s]').length, plus: document.querySelectorAll('[data-shop]').length, cv: document.querySelector('#skinPick canvas').getBoundingClientRect().width }));
    ok(P.bad.length === 0 && P.sh <= P.ch && P.docSh <= P.vh, `${tag} 設定棋具頁沒有捲動／超出（sh ${P.sh}<=${P.ch}、bad ${JSON.stringify(P.bad)}）`);
    ok(cnt.nb === 15 && cnt.ns === 14 && cnt.plus === 2, `${tag} 設定棋具頁 棋盤 ${cnt.nb}/15、棋子 ${cnt.ns}/14、「＋」${cnt.plus}/2`);
    const pv = await page.evaluate(() => [...document.querySelectorAll('#skinPick [data-shop]')].map((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return { op: cs.opacity, vis: cs.visibility, w: b.width, h: b.height, svg: !!e.querySelector('svg'), t: e.dataset.shop }; }));
    ok(pv.length === 2 && pv.every((x) => x.op === '1' && x.vis === 'visible' && x.w > 20 && x.h >= 40 && x.svg) && pv.map((x) => x.t).join() === 'b,s', `${tag} 「＋」真的看得到且帶分頁 ${JSON.stringify(pv.map((x) => x.t))}`);
    ok(cnt.cv >= 190, `${tag} 設定棋具頁預覽 ${Math.round(cnt.cv)}px >= 190`);
    const txt = await pageText(page);
    ok(!FORBID.test(txt), `${tag} 設定棋具頁文字沒有禁字`);
    ok(errs.length === 0, `${tag} 設定棋具頁沒有 console error ${errs.slice(0, 2)}`);
    await ctx.close();
  }
}

// ---- 2. 全新玩家 ----
{
  const { ctx, page, errs } = await newPage(375, 667, 'zh');
  await openStage(page, 's');
  const cs = await cells(page);
  await page.click('#shopPage [data-tab="b"]'); await page.waitForTimeout(150);
  const cb = await cells(page);
  const r = await page.evaluate(() => ({ sp: RushSkin.setStones('poop'), sg: RushSkin.setBoard('grass'), cur: RushSkin.get().board.id + '/' + RushSkin.get().stones.id, owned: localStorage.getItem('vcfgame.owned') }));
  ok(cs.length === (NEG ? 7 : 8) && cb.length === 8, `全新玩家：棋子分頁 ${cs.length} 格、棋盤分頁 ${cb.length} 格（各＝預設＋7）`);
  ok(cs[0].tg === '使用中' && cs.slice(1).every((c) => c.tg === '免費') && cb[0].tg === '使用中' && cb.slice(1).every((c) => c.tg === '免費'), `全新玩家：預設格「使用中」、其餘都是「免費」${[...new Set(cs.slice(1).map((c) => c.tg))]}`);
  ok(r.sp === false && r.sg === false && r.cur === 'classic/flat', `未領取 setStones('poop') ${r.sp}、setBoard('grass') ${r.sg} 都回 false，仍是 ${r.cur}`);
  ok(r.owned === '[]', `第一次載入存下空的擁有清單 ${r.owned}`);
  ok(cs[0].sel && cb[0].sel, '進頁時選中的是玩家正在用的（預設格，兩個分頁都是）');
  await page.click('#shopPage .back'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => !!document.querySelector('#shopPage .card') && !document.getElementById('shopPage').hidden), '棋具頁返回 → 回商店首頁');
  await page.click('#shopPage .back'); await page.waitForSelector('#shopPage', { state: 'hidden' });
  await page.click('#openSet'); await page.click('#setSkin'); await page.waitForSelector('#skinPick:not([hidden]) canvas');
  const p = await page.evaluate(() => ({ b: [...document.querySelectorAll('[data-b]')].map((e) => e.dataset.b), s: [...document.querySelectorAll('[data-s]')].map((e) => e.dataset.s), plus: document.querySelectorAll('[data-shop]').length }));
  ok(!NEW_B.some((x) => p.b.includes(x)) && !NEW_S.some((x) => p.s.includes(x)) && p.b.length === 8 && p.s.length === 7, `全新玩家：設定棋具頁看不到商店商品（棋盤 ${p.b.length}/8、棋子 ${p.s.length}/7）`);
  ok(p.plus === 2, `設定棋具頁兩排各有「＋」${p.plus}`);
  ok(errs.length === 0, `全新玩家流程沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 3. 混搭、預設格、按鈕只動目前分頁、領取→換上→使用中、設定棋具頁出現、重新整理 ----
{
  const { ctx, page, errs, claims } = await newPage(375, 667, 'zh');
  await openStage(page, 's');
  const px0 = await px(page);
  await page.click('#shopPage .cell[data-k="s:pets"]'); await page.waitForTimeout(150);
  const a = { nm: await page.textContent('#shopPage .sinfo .nm'), chip: await page.textContent('#shopPage .sinfo .chip'), cta: await ctaOf(page), other: await page.textContent('#shopPage .sinfo .ot') };
  ok(a.nm === '黑貓與白狗' && a.chip === '限時免費' && a.cta.t === '免費領取「黑貓與白狗」' && !a.cta.dis, `棋子分頁選黑貓與白狗：名稱「${a.nm}」膠囊「${a.chip}」按鈕「${a.cta.t}」`);
  ok(a.other === '原木（預設）', `「搭配的棋盤」顯示「${a.other}」`);
  await page.click('#shopPage [data-tab="b"]'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.querySelector('#shopPage .sinfo .k').textContent) === '棋盤花色', '切到棋盤分頁，標題變「棋盤花色」');
  await page.click('#shopPage .cell[data-k="b:grass"]'); await page.waitForTimeout(150);
  const b = { pv: await prev(page), other: await page.textContent('#shopPage .sinfo .ot'), px: await px(page) };
  ok(b.pv.board === 'grass' && b.pv.stones === 'pets' && b.other === '黑貓與白狗', `混搭：預覽盤＝${b.pv.board}、子＝${b.pv.stones}（RushSkin.preview 參數）、搭配的棋子「${b.other}」`);
  ok(Math.abs(b.px[0] - px0[0]) + Math.abs(b.px[1] - px0[1]) + Math.abs(b.px[2] - px0[2]) > 60, `混搭：預覽畫布像素確實換成草地盤 ${JSON.stringify(px0)} → ${JSON.stringify(b.px)}`);
  const figs = await page.evaluate(() => { const c = document.querySelector('#shopPage .top canvas'), x = c.getContext('2d'), w = c.width, n = 7, pad = w * 0.1, cp = (w - 2 * pad) / (n - 1), d = x.getImageData(Math.round(pad + 3 * cp), Math.round(pad + 3 * cp), 1, 1).data; return [d[0], d[1], d[2]]; });
  const ref = await page.evaluate(() => { const S = RushSkin, c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); const p = S.preview('grass', 'flat'); S.drawBoard(x, { size: 200, pad: 20, cell: 26.67, n: 7, round: 14, starR: 0 }, p.board); S.drawStone(x, 20 + 3 * 26.67, 20 + 3 * 26.67, 26.67 * 0.46, true, 1, 1.5, p.black); const d = x.getImageData(100, 100, 1, 1).data; return [d[0], d[1], d[2]]; });
  ok(Math.abs(figs[0] - ref[0]) + Math.abs(figs[1] - ref[1]) + Math.abs(figs[2] - ref[2]) > 30, `混搭：預覽中央那顆子是造型子（像素 ${JSON.stringify(figs)} ≠ 平面黑子 ${JSON.stringify(ref)}）`);
  await page.click('#shopPage [data-tab="s"]'); await page.waitForTimeout(150);
  const c1 = await cells(page), pv1 = await prev(page);
  ok(c1.find((c) => c.k === 's:pets').sel && !c1[0].sel && pv1.stones === 'pets' && pv1.board === 'grass', `切回棋子分頁：選擇還在（pets 選中、預覽 ${pv1.board}/${pv1.stones}）`);
  await page.screenshot({ path: shotsOf('stage_zh_375x667_stones_mix.png') });
  await page.click('#shopPage .cell[data-k="s:flat"]'); await page.waitForTimeout(150);
  const d1 = await prev(page), dn = await page.textContent('#shopPage .sinfo .nm'), dchip = await page.textContent('#shopPage .sinfo .chip'), dcta = await ctaOf(page);
  ok(d1.stones === 'flat' && d1.board === 'grass' && dn === '平面' && dchip === '預設・內建' && dcta.t === '使用中' && dcta.dis, `選預設格：預覽 ${d1.board}/${d1.stones}（棋盤那邊不變）、「${dn}／${dchip}」、按鈕「${dcta.t}」不可按`);
  await page.click('#shopPage [data-tab="b"]'); await page.click('#shopPage .cell[data-k="b:classic"]'); await page.waitForTimeout(150);
  const d2 = await prev(page);
  ok(d2.board === 'classic' && d2.stones === 'flat', `棋盤預設格：預覽回原木＋平面 ${d2.board}/${d2.stones}`);
  await page.click('#shopPage [data-tab="s"]'); await page.click('#shopPage .cell[data-k="s:pets"]'); await page.click('#shopPage [data-tab="b"]'); await page.click('#shopPage .cell[data-k="b:grass"]');
  await page.click('#shopPage [data-tab="s"]'); await page.waitForTimeout(100);
  await page.click('#shopPage .cta'); await page.waitForFunction(() => /^換上/.test(document.querySelector('#shopPage .cta')?.textContent)); await page.waitForTimeout(200);
  const g1 = { own: await lsOwned(page), cta: await ctaOf(page), tg: await page.textContent('#shopPage .cell[data-k="s:pets"] .tg'), chip: await page.textContent('#shopPage .sinfo .chip') };
  ok(claims.length === 1 && claims[0].items.length === 1 && claims[0].items[0] === 's:pets' && claims[0].src === 'free' && /^[0-9a-f-]{16,40}$/i.test(claims[0].vid), `在棋子分頁領取：只送 ${JSON.stringify(claims[0])}`);
  ok(JSON.stringify(g1.own) === '["s:pets"]' && g1.cta.t === '換上「黑貓與白狗」' && g1.tg === '已擁有' && g1.chip === '已擁有', `領取後：本機擁有 ${JSON.stringify(g1.own)}、按鈕「${g1.cta.t}」、格子「${g1.tg}」、膠囊「${g1.chip}」`);
  ok(await page.evaluate(() => RushSkin.get().stones.id + '/' + RushSkin.get().board.id) === 'flat/classic', '領取只是領取：還沒換上（仍是 flat/classic）');
  await page.click('#shopPage [data-tab="b"]'); await page.waitForTimeout(100);
  const bs = await ctaOf(page), bt = await page.textContent('#shopPage .cell[data-k="b:grass"] .tg');
  ok(bs.t === '免費領取「草地」' && bt === '免費' && claims.length === 1, `棋盤那邊狀態不變：按鈕「${bs.t}」、格子「${bt}」；claims 仍 ${claims.length} 次`);
  await page.click('#shopPage [data-tab="s"]'); await page.click('#shopPage .cta'); await page.waitForFunction(() => document.querySelector('#shopPage .cta')?.textContent === '使用中'); await page.waitForTimeout(200);
  const u = await page.evaluate(() => ({ dis: document.querySelector('#shopPage .cta').disabled, on: document.querySelector('#shopPage .cell[data-k="s:pets"]').classList.contains('on'), tg: document.querySelector('#shopPage .cell[data-k="s:pets"] .tg').textContent, cur: RushSkin.get().stones.id, ls: localStorage.getItem('vcfgame.stones'), flatTg: document.querySelector('#shopPage .cell[data-k="s:flat"] .tg').textContent }));
  ok(u.dis && u.on && u.tg === '使用中' && u.cur === 'pets' && u.ls === 'pets' && u.flatTg === '預設' && claims.length === 1, `換上 → 使用中：按鈕不可按、格子「${u.tg}」、RushSkin ${u.cur}、localStorage ${u.ls}、預設格改回「${u.flatTg}」、沒多送 claim`);
  await page.click('#shopPage [data-tab="b"]'); await page.click('#shopPage .cta'); await page.waitForFunction(() => /^換上/.test(document.querySelector('#shopPage .cta')?.textContent));
  await page.click('#shopPage .cta'); await page.waitForFunction(() => document.querySelector('#shopPage .cta')?.textContent === '使用中');
  ok(claims.length === 2 && claims[1].items[0] === 'b:grass', `領棋盤 b:grass：claim ${JSON.stringify(claims[1])}`);
  const lsO = await lsOwned(page);
  ok(lsO && lsO.length === 2 && lsO.includes('s:pets') && lsO.includes('b:grass'), `localStorage 擁有清單 ${JSON.stringify(lsO)}`);
  await page.click('#shopPage .back'); await page.click('#shopPage .back'); await page.waitForSelector('#shopPage', { state: 'hidden' });
  await page.click('#openSet'); await page.click('#setSkin'); await page.waitForSelector('#skinPick:not([hidden]) canvas');
  const p = await page.evaluate(() => ({ b: [...document.querySelectorAll('[data-b]')].map((e) => e.dataset.b), s: [...document.querySelectorAll('[data-s]')].map((e) => e.dataset.s), pressedS: document.querySelector('[data-s][aria-pressed="true"]').dataset.s, pressedB: document.querySelector('[data-b][aria-pressed="true"]').dataset.b }));
  ok(p.s.includes('pets') && p.b.includes('grass') && p.s.length === 8 && p.b.length === 9 && p.pressedS === 'pets' && p.pressedB === 'grass', `設定棋具頁出現領到的：棋子 ${p.s.length}/8 含 pets、棋盤 ${p.b.length}/9 含 grass，選中 ${p.pressedS}/${p.pressedB}`);
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RushSkin && window.RushShop); await page.waitForTimeout(600);
  const re = await page.evaluate(() => ({ cur: RushSkin.get().board.id + '/' + RushSkin.get().stones.id, owned: JSON.parse(localStorage.getItem('vcfgame.owned')) }));
  ok(re.cur === 'grass/pets' && re.owned.length === 2, `重新整理後仍使用 ${re.cur}、擁有 ${JSON.stringify(re.owned)}`);
  await openStage(page, 's');
  const re2 = await cells(page), pv2 = await prev(page);
  ok(re2.filter((c) => c.tg !== '免費' && c.tg !== '預設').map((c) => c.k + ':' + c.tg).join() === 's:pets:使用中' && pv2.board === 'grass' && pv2.stones === 'pets', `重新整理後棋具頁：進頁預覽＝正在用的 ${pv2.board}/${pv2.stones}、使用中那格 pets`);
  ok(errs.length === 0, `領取流程沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 3b. 從棋具頁「＋」進來；玩家正在用非商店的棋盤 ----
{
  const { ctx, page, errs } = await newPage(375, 667, 'zh', { 'vcfgame.board': 'night' });
  await openPicker(page);
  ok(await page.evaluate(() => RushSkin.boardId()) === 'night', '玩家用「夜墨」盤（night）');
  await page.click('#skinPick [data-shop="b"]'); await page.waitForSelector('#shopPage:not([hidden])'); await page.waitForTimeout(250);
  const a = await page.evaluate(() => ({ picker: document.getElementById('skinPick').hidden, stage: !!document.querySelector('#shopPage .top canvas'), tab: document.querySelector('#shopPage [data-tab][aria-pressed="true"]').dataset.tab, title: document.querySelector('#shopPage h1').textContent }));
  ok(a.picker && a.stage && a.tab === 'b' && a.title === '棋具', `棋盤那排的＋：直接進棋具頁、停在棋盤分頁（${JSON.stringify(a)}）`);
  const cs = await cells(page), pv = await prev(page), cta = await ctaOf(page), nm = await page.textContent('#shopPage .sinfo .nm');
  ok(pv.board === 'night' && cs.every((c) => !c.sel) && nm.length > 0 && cta.dis, `夜墨：預覽 ${pv.board}、沒有格子被選中、名稱「${nm}」、按鈕「${cta.t}」不可按`);
  await page.screenshot({ path: shotsOf('stage_zh_375x667_night.png') });
  await page.click('#shopPage [data-tab="s"]'); await page.waitForTimeout(150);
  const cs2 = await cells(page);
  ok(cs2[0].sel, '棋子分頁：玩家用的是預設平面，第一格選中');
  await page.click('#shopPage .back'); await page.waitForTimeout(250);
  const r = await page.evaluate(() => ({ shopHidden: document.getElementById('shopPage').hidden, picker: !document.getElementById('skinPick').hidden, cv: !!document.querySelector('#skinPick canvas') }));
  ok(r.shopHidden && r.picker && r.cv, `返回回到原本的棋具頁（設定）${JSON.stringify(r)}`);
  await page.click('#skinPick [data-shop="s"]'); await page.waitForSelector('#shopPage:not([hidden])'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.querySelector('#shopPage [data-tab][aria-pressed="true"]').dataset.tab) === 's', '棋子那排的＋：停在棋子造型分頁');
  await page.goBack(); await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.getElementById('shopPage').hidden), '瀏覽器返回鍵會關掉商店');
  ok(errs.length === 0, `＋進來／夜墨沒有 console error ${errs.slice(0, 2)}`);
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
  await openStage(page, 's');
  const t = await cells(page), pv = await prev(page);
  ok(t.filter((c) => c.on).map((c) => c.k).join() === 's:poop' && t.find((c) => c.k === 's:poop').sel && pv.board === 'grass' && pv.stones === 'poop', `舊玩家：進棋具頁選中並使用中 poop、預覽 ${pv.board}/${pv.stones}`);
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
  await openStage(page, 's');
  const s1 = (await cells(page)).filter((c) => ['s:pets', 's:poop'].includes(c.k)).map((c) => c.k + ':' + c.tg).sort();
  await page.click('#shopPage [data-tab="b"]');
  const s2 = (await cells(page)).filter((c) => ['b:grass', 'b:pool'].includes(c.k)).map((c) => c.k + ':' + c.tg);
  ok(s1.join('|') === 's:pets:已擁有|s:poop:免費' && s2.join('|') === 'b:grass:已擁有|b:pool:已擁有', `商店顯示 ${s1}｜${s2}`);
  ok(errs.length === 0, `同步沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}
{   // /shop 連不上
  const { ctx, page, errs } = await newPage(375, 667, 'zh', { 'vcfgame.owned': JSON.stringify(['s:bunny']) }, { owned: null });
  await openStage(page, 's');
  const cs = await cells(page);
  ok(cs.length === 8 && cs.find((c) => c.k === 's:bunny').tg === '已擁有', `/shop 連不上：商店照常 ${cs.length} 格、本機清單的 bunny「${cs.find((c) => c.k === 's:bunny').tg}」`);
  await page.click('#shopPage .cell[data-k="s:pets"]'); await page.click('#shopPage .cta'); await page.waitForFunction(() => /^換上/.test(document.querySelector('#shopPage .cta')?.textContent));
  const lo = await lsOwned(page);
  ok(lo.includes('s:pets'), `/shop 連不上：領取仍先寫本機 ${JSON.stringify(lo)}`);
  ok(errs.length === 0, `/shop 連不上沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}
{   // 價格 > 0 → 伺服器拒絕 → 本機拿掉
  const { ctx, page, errs, claims } = await newPage(375, 667, 'zh', {}, { prices: { 's:boo': 30 } });
  await openStage(page, 's');
  const pr = await page.evaluate(() => RushSkin.price(RushSkin.stones.find((x) => x.id === 'boo')) + '/' + RushSkin.price(RushSkin.stones.find((x) => x.id === 'poop')));
  ok(pr === '30/0', `RushSkin.price 讀到 /shop 的 prices：boo/poop = ${pr}`);
  await page.click('#shopPage .cell[data-k="s:boo"]'); await page.click('#shopPage .cta'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ cta: document.querySelector('#shopPage .cta').textContent, own: localStorage.getItem('vcfgame.owned') }));
  ok(claims.length === 1 && /^免費領取/.test(r.cta) && !r.own.includes('s:boo'), `被伺服器 refused：按鈕回到「${r.cta}」、本機清單 ${r.own}`);
  ok(errs.length === 0, `refused 沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 6. 後台開關 ----
{
  const { ctx, page } = await newPage(375, 667, 'zh', {}, { skins: { off: EMPTY, on: { boards: ['grass'], stones: ['poop'] } } });
  await openShop(page);
  const sub = await page.textContent('#shopPage .card .tx span');
  ok(sub === '棋子造型 1 組・棋盤花色 1 張', `後台只開 2 件：卡片「${sub}」`);
  await page.click('#shopPage .card'); await page.waitForSelector('#shopPage .top canvas');
  const a = await cells(page); await page.click('#shopPage [data-tab="b"]'); const b = await cells(page);
  ok(a.length === 2 && b.length === 2 && a[1].k === 's:poop' && b[1].k === 'b:grass', `後台只開 2 件：各分頁＝預設＋1（${a.map((c) => c.k)}｜${b.map((c) => c.k)}）`);
  const H = await layout(page, '#shopPage', '.cell');
  ok(H.sh <= H.ch && H.bad.length === 0, `只開 2 件版面正常（sh ${H.sh}/${H.ch}）`);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(375, 667, 'zh', {}, { skins: NONE_ON });
  await openShop(page);
  const r = await page.evaluate(() => ({ cards: document.querySelectorAll('#shopPage .card').length, empty: document.querySelector('#shopPage .empty')?.textContent }));
  ok(r.cards === 0 && r.empty === '目前沒有上架的商品', `後台全關：${r.cards} 張卡、文字「${r.empty}」`);
  await ctx.close();
  for (const lang of ['en', 'ja', 'ko']) {
    const x = await newPage(360, 640, lang, {}, { skins: '500' });
    await openShop(x.page);
    const e = await x.page.evaluate(() => ({ t: document.querySelector('#shopPage .empty')?.textContent, c: document.querySelectorAll('#shopPage .card').length }));
    ok(!!e.t && e.c === 0 && !FORBID.test(e.t), `${lang} 連不上 /skins（optIn 全關）：空狀態「${e.t}」、${e.c} 張卡`);
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
  await openStage(page, 's');
  await page.addStyleTag({ content: '#shopPage .grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important} #shopPage .cell{height:160px !important}' });
  await page.waitForTimeout(200);
  const L = await layout(page, '#shopPage', '.cell');
  ok(L.bad.length > 0 || L.sh > L.ch, `負向測試：把格子改成 2 欄會被抓到（bad=${L.bad.length} sh=${L.sh}/ch=${L.ch}）`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`PASS ${pass}／FAIL ${fail}${NEG ? '（NEG=1：預期有 FAIL）' : ''}`);
process.exit(fail ? 1 : 0);
