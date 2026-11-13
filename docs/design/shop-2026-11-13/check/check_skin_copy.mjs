// 【商店施工用副本，2026-11-13】原檔 docs/design/skins2-2026-11-12/check/check_skin.mjs 未動。
// 副本只改兩處：① openPicker 改走「設定 → 棋具」（原檔等的 #skinEntry 首頁按鈕 2026-11-12 就拿掉了，原檔本來就跑不起來）；
// ② 預設把 14 件商店商品都放進 vcfgame.owned（這次規則：沒領取的商店商品不能選、不出現在棋具頁），其餘期望一個字沒改。
// Playwright 用 C:\claudehome\tools\node_modules 現成的；本機靜態伺服器開在這個 process 裡（結束就自己關，不碰別的行程）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const SHOTS = path.join(HERE, 'skin_shots');
fs.mkdirSync(SHOTS, { recursive: true });
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

const NEW_B = ['grass','starry','beach','chalk','ice','denim','pool'], NEW_S = ['poop','bunny','pets','onigiri','sky','boo','donut'];
const EMPTY = { boards: [], stones: [] };
const ALL_ON = { off: EMPTY, on: { boards: NEW_B, stones: NEW_S } };
let fakeResp = ALL_ON;   // /skins 的假回應；'500' 就回 500
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });   // playwright 要的 build 沒裝，用系統 Chrome（不全域安裝）
async function newPage(w, h, lang, ls = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  ls = { 'vcfgame.owned': JSON.stringify([...NEW_B.map((x) => 'b:' + x), ...NEW_S.map((x) => 's:' + x)]), ...ls };   // 副本改動②
  await ctx.addInitScript(([lang, ls]) => { try { if (lang) localStorage.setItem('vcfgame.lang', lang); for (const k in ls) localStorage.setItem(k, ls[k]); } catch {} }, [lang, ls]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.route('https://vcf-game-api.psyhangsau.workers.dev/**', (r) => {
    if (/\/skins$/.test(r.request().url())) {
      if (fakeResp === '500') return r.fulfill({ status: 500, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'err' });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(fakeResp) });
    }
    return r.abort();   // 其他線上請求不碰
  });
  return { ctx, page, errs };
}
async function openPicker(page) {
  await page.goto(BASE + '/game.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RushSkin && document.getElementById('openSet'));
  await page.waitForTimeout(400);
  await page.click('#openSet'); await page.waitForSelector('#sSet:not([hidden])');
  await page.click('#setSkin');
  await page.waitForSelector('#skinPick:not([hidden]) canvas');
  await page.waitForTimeout(250);
}
const layoutCheck = (page) => page.evaluate(() => {
  const r = document.getElementById('skinPick'), vw = innerWidth, vh = innerHeight, bad = [];
  for (const e of r.querySelectorAll('*')) {
    const b = e.getBoundingClientRect(); if (!b.width && !b.height) continue;
    if (b.bottom > vh + 0.5 || b.right > vw + 0.5 || b.left < -0.5 || b.top < -0.5) bad.push((e.className || e.tagName) + ':' + Math.round(b.bottom));
  }
  const minTouch = Math.min(...[...r.querySelectorAll('.sopt')].map((e) => e.offsetHeight)), minW = Math.min(...[...r.querySelectorAll('.sopt')].map((e) => e.getBoundingClientRect().width));
  return { bad: bad.slice(0, 5), sh: r.scrollHeight, ch: r.clientHeight, minW, cw: r.querySelector('canvas').getBoundingClientRect().width, nb: r.querySelectorAll('[data-b]').length, ns: r.querySelectorAll('[data-s]').length, minTouch };
});

// ---- 1. 四語 × 兩尺寸 ----
for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[360, 640], [375, 667]]) {
  fakeResp = ALL_ON;
  const { ctx, page, errs } = await newPage(w, h, lang);
  await openPicker(page);
  const L = await layoutCheck(page), tag = `${lang} ${w}x${h}`;
  ok(L.bad.length === 0, `${tag} 沒有東西超出視窗 ${JSON.stringify(L.bad)}`);
  ok(L.sh <= L.ch, `${tag} scrollHeight ${L.sh} <= clientHeight ${L.ch}`);
  ok(L.cw >= 190, `${tag} 預覽 canvas 寬 ${Math.round(L.cw)} >= 190`);
  ok(L.nb === 15 && L.ns === 14, `${tag} 棋盤格 ${L.nb}/15、棋子格 ${L.ns}/14`);
  ok(L.minTouch >= 40, `${tag} 格子高度最小 ${L.minTouch} >= 40（寬 ${L.minW.toFixed(1)}，8 欄不變所以寬度 <40，原本就如此）`);
  ok(errs.length === 0, `${tag} 沒有 console error ${errs.slice(0, 2)}`);
  await page.screenshot({ path: path.join(SHOTS, `picker_${lang}_${w}x${h}.png`) });
  await ctx.close();
}

// ---- 2. 預設關閉（optIn）----
const probe = (page) => page.evaluate(() => ({
  nb: document.querySelectorAll('[data-b]').length, ns: document.querySelectorAll('[data-s]').length,
  hasB: [...document.querySelectorAll('[data-b]')].map((e) => e.dataset.b), hasS: [...document.querySelectorAll('[data-s]')].map((e) => e.dataset.s),
}));
{   // 2a. 沒 localStorage、伺服器 500
  fakeResp = '500';
  const { ctx, page, errs } = await newPage(375, 667, 'zh');
  await openPicker(page);
  const r = await probe(page), t = await page.evaluate(() => ({ sp: RushSkin.setStones('poop'), sg: RushSkin.setBoard('grass'), cur: RushSkin.get().board.id + '/' + RushSkin.get().stones.id }));
  ok(r.nb === 8 && r.ns === 7, `2a 500＋無清單：棋盤 ${r.nb}/8、棋子 ${r.ns}/7`);
  ok(!NEW_B.some((x) => r.hasB.includes(x)) && !NEW_S.some((x) => r.hasS.includes(x)), '2a 14 個新的都不在');
  ok(t.sp === false && t.sg === false, `2a setStones('poop') ${t.sp}、setBoard('grass') ${t.sg} 都回 false`);
  ok(errs.length === 0, `2a 沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}
{   // 2b. on 兩個棋盤…grass；stones poop、bunny
  fakeResp = { off: EMPTY, on: { boards: ['grass'], stones: ['poop', 'bunny'] } };
  const { ctx, page } = await newPage(375, 667, 'zh');
  await openPicker(page);
  const r = await probe(page), t = await page.evaluate(() => ({ sp: RushSkin.setStones('poop'), pe: RushSkin.setStones('pets') }));
  ok(r.nb === 9 && r.ns === 9, `2b 棋盤 ${r.nb}/9、棋子 ${r.ns}/9`);
  ok(r.hasB.includes('grass') && !r.hasB.includes('starry') && r.hasS.includes('poop') && r.hasS.includes('bunny') && !r.hasS.includes('pets'), '2b 只有 on 的出現');
  ok(t.sp === true && t.pe === false, `2b setStones('poop') ${t.sp}（要 true）、pets ${t.pe}（要 false）`);
  await ctx.close();
}
{   // 2c. off 有 green、on 有 grass；選擇不被改寫；重新開放後回來
  fakeResp = { off: { boards: ['green'], stones: [] }, on: { boards: ['grass'], stones: ['poop'] } };
  const { ctx, page } = await newPage(375, 667, 'zh', { 'vcfgame.board': 'green', 'vcfgame.stones': 'bunny' });
  await openPicker(page);
  const r = await probe(page);
  const x = await page.evaluate(() => ({ b: RushSkin.get().board.id, s: RushSkin.get().stones.id, lsB: localStorage.getItem('vcfgame.board'), lsS: localStorage.getItem('vcfgame.stones'), isOffClassic: RushSkin.isOff(RushSkin.boards[0]), isOffFlat: RushSkin.isOff(RushSkin.stones[0]) }));
  ok(!r.hasB.includes('green') && r.hasB.includes('grass'), '2c green 不見、grass 出現');
  ok(x.b === 'classic' && x.s === 'flat', `2c 選的都不開放時實際用 ${x.b}/${x.s}`);
  ok(x.lsB === 'green' && x.lsS === 'bunny', `2c localStorage 的選擇沒被改寫 ${x.lsB}/${x.lsS}`);
  ok(x.isOffClassic === false && x.isOffFlat === false, 'classic、flat 永遠開放');
  fakeResp = { off: EMPTY, on: { boards: NEW_B, stones: NEW_S } };
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.RushSkin); await page.waitForTimeout(600);
  const back = await page.evaluate(() => RushSkin.get().board.id + '/' + RushSkin.get().stones.id);
  ok(back === 'green/bunny', `重新開放後自動回來 ${back}`);
  await ctx.close();
}
{   // 2d. 舊格式 localStorage、伺服器連不上
  fakeResp = '500';
  const { ctx, page, errs } = await newPage(375, 667, 'zh', { 'vcfgame.skinsOff': JSON.stringify({ boards: ['green'], stones: [] }) });
  await openPicker(page);
  const r = await probe(page);
  ok(!r.hasB.includes('green') && r.nb === 7, `2d 舊格式：green 關閉、棋盤 ${r.nb}/7（新的也都不在）`);
  ok(errs.length === 0, `2d 舊格式不報錯 ${errs.slice(0, 2)}`);
  await ctx.close();
}
{   // 2e. 內容壞掉的 localStorage 不報錯
  fakeResp = '500';
  const { ctx, page, errs } = await newPage(375, 667, 'zh', { 'vcfgame.skinsOff': '{壞掉' });
  await openPicker(page);
  const r = await probe(page);
  ok(r.nb === 8 && r.ns === 7 && errs.length === 0, `2e 壞掉的 localStorage：${r.nb}/8、${r.ns}/7、error ${errs.length}`);
  await ctx.close();
}

// ---- 3. 逐一換 ----
{
  fakeResp = ALL_ON;
  const { ctx, page, errs } = await newPage(375, 667, 'zh');
  await openPicker(page);
  const res = await page.evaluate(() => {
    const out = [];
    for (const id of ['poop', 'bunny', 'pets', 'onigiri', 'sky', 'boo', 'donut']) {
      const okSet = RushSkin.setStones(id), g = RushSkin.get();
      out.push({ id, okSet, ring: g.black.ring === undefined && g.white.ring === undefined, halo: !!RushSkin.numHalo(true) && !!RushSkin.numHalo(false), bg: getComputedStyle(document.documentElement).getPropertyValue('--sk-b').includes('contain') });
    }
    for (const id of ['grass', 'starry', 'beach', 'chalk', 'ice', 'denim', 'pool']) out.push({ id, okSet: RushSkin.setBoard(id) });
    RushSkin.setStones('flat'); RushSkin.setBoard('classic');
    return { out, flatHalo: RushSkin.numHalo(true), haveFill: typeof RushSkin.fillNum };
  });
  for (const o of res.out) {
    ok(o.okSet, `換 ${o.id} 成功`);
    if ('ring' in o) { ok(o.ring, `${o.id} fig 組 ring 是 undefined`); ok(o.halo, `${o.id} numHalo 有值`); ok(o.bg, `${o.id} CSS 變數是 contain`); }
  }
  ok(res.flatHalo === null, '非 fig 組 numHalo 回 null');
  ok(res.haveFill === 'function', 'fillNum 存在');
  // fillNum：fig 時先描邊再填
  const calls = await page.evaluate(() => {
    RushSkin.setStones('bunny');
    const log = [], ctx = { font: '700 20px sans-serif', save() {}, restore() {}, strokeText() { log.push('stroke:' + this.lineWidth + ':' + this.strokeStyle + ':' + this.lineJoin); }, fillText() { log.push('fill'); } };
    RushSkin.fillNum(ctx, '1', 0, 0, true); RushSkin.fillNum(ctx, '2', 0, 0, false);
    RushSkin.setStones('flat'); const l2 = []; ctx.strokeText = () => l2.push('stroke'); ctx.fillText = () => l2.push('fill'); RushSkin.fillNum(ctx, '3', 0, 0, true);
    return { log, l2 };
  });
  const norm = calls.log.join('|').replace(/5\.6\d*/g, '5.6');
  ok(norm === 'stroke:5.6:#1B1A17:round|fill|stroke:5.6:#FFFFFF:round|fill', `fillNum fig：${norm}`);
  ok(calls.l2.join('|') === 'fill', 'fillNum 非 fig 只 fill');
  ok(errs.length === 0, `逐一換沒有 console error ${errs.slice(0, 2)}`);
  await ctx.close();
}

// ---- 4. 截圖（圖在才截）----
const have = (p) => fs.existsSync(path.join(ROOT, p));
for (const [st, bd] of [['bunny', 'grass'], ['sky', 'starry']]) {
  const sOk = have(`game/skin/stones/${st}/b.png`), bOk = have(`game/skin/boards/${bd}.webp`);
  if (!sOk || !bOk) { console.log(`SKIP 截圖 ${st}+${bd}：圖還沒到（棋子 ${sOk}、棋盤 ${bOk}）`); continue; }
  fakeResp = ALL_ON;
  const { ctx, page } = await newPage(375, 667, 'zh', { 'vcfgame.board': bd, 'vcfgame.stones': st });
  await openPicker(page); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, `combo_${st}_${bd}.png`) });
  console.log(`SHOT combo_${st}_${bd}.png`);
  await ctx.close();
}

// ---- 5. 故意弄錯：.sgrid 改 4 欄，檢查要抓得到 ----
{
  fakeResp = ALL_ON;
  const { ctx, page } = await newPage(360, 640, 'zh');
  await openPicker(page);
  await page.addStyleTag({ content: '#skinPick .sgrid{grid-template-columns:repeat(4,minmax(0,1fr)) !important}' });
  await page.evaluate(() => dispatchEvent(new Event('resize'))); await page.waitForTimeout(200);
  const L = await layoutCheck(page);
  const caught = L.bad.length > 0 || L.sh > L.ch || L.cw < 190;
  ok(caught, `負向測試：.sgrid 4 欄會被抓到（bad=${L.bad.length} sh=${L.sh}/ch=${L.ch} canvas=${Math.round(L.cw)}）`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`PASS ${pass}／FAIL ${fail}`);
process.exit(fail ? 1 : 0);
