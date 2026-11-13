// 棋盤座標驗收：node check_coords.mjs（前景；NEG=1 是負向測試，應該有 FAIL；QUICK=1 只跑 zh 與兩個尺寸）。
// 自己起停：http.server 8795（現行原始碼）、8796（改動前快照）、8791（題庫）、wrangler dev 8789；只用 PID 關自己啟動的行程。
// 截圖只存本資料夾 shots/。不連正式站 API（context 層擋掉）。
import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as H from './h.mjs';
import * as S from './scenes.mjs';
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
const { sleep } = H;
const HERE = dirname(fileURLToPath(import.meta.url)), SH = HERE + '/shots/';
const VCF = 'C:/claudehome/projects/VCF', SNAP = process.env.SNAP || 'C:/Users/hangs/AppData/Local/Temp/vcf-snap-coords', PERSIST = tmpdir() + '/wstate-coords2-' + Date.now();
const NEG = process.env.NEG === '1', QUICK = process.env.QUICK === '1';
mkdirSync(SH, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
const pids = [];
const kill = (pid) => { try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {} };
const killAll = () => { pids.forEach(kill); pids.length = 0; L.stopWr(); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} };
process.on('exit', killAll);
const serve = (port, cwd) => pids.push(spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd, stdio: 'ignore', windowsHide: true }).pid);
const NEW = 'http://127.0.0.1:8795', OLD = 'http://127.0.0.1:8796';
const COLS = 'ABCDEFGHJKLMNOP';
const langs = QUICK ? ['zh'] : H.LANGS, vps = QUICK ? [H.VPS[0], H.VPS[2]] : H.VPS;

// 記錄座標字的繪製呼叫（字體 600 Chakra 的 fillText；手順數字是 700，不混）
const HOOK = () => {
  window.__txt = [];
  const P = CanvasRenderingContext2D.prototype, ce = P.clearRect, ft = P.fillText;
  P.clearRect = function (x, y, w, h) { if (w >= 200 && h >= 200) window.__txt = []; return ce.apply(this, arguments); };
  P.fillText = function (t, x, y) {
    try {
      if (/^600 /.test(this.font)) {
        const m = this.getTransform(), cr = this.canvas.getBoundingClientRect(), dpr = this.canvas.width / cr.width, sx = m.a / dpr;
        window.__txt.push({ t: String(t), x: (m.a * x + m.c * y + m.e) / dpr, y: (m.b * x + m.d * y + m.f) / dpr, f: parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)[1]), fill: String(this.fillStyle).toLowerCase(), w: this.measureText(String(t)).width * sx });
      }
    } catch {}
    return ft.apply(this, arguments);
  };
};
async function mk(b, o) { const c = await H.mkCtx(b, o); await c.addInitScript(HOOK); return c; }
const geomOf = (p, kind) => p.evaluate((kind) => kind === 'duel' ? (() => { const a = window.__duel.xyOf(0), z = window.__duel.xyOf(224); return { pad: a[0], cell: (z[0] - a[0]) / 14, size: window.__duel.cv.getBoundingClientRect().width }; })() : { pad, cell, size: px }, kind);
const label = (p) => p.evaluate(() => window.RushSkin.get().board.label.toLowerCase());

// 一張盤的座標字全檢：15 字母 15 數字、順序、位置對線、不在棋子範圍內、不出盤、顏色＝label
async function labels(p, kind, tag) {
  const g = await geomOf(p, kind), t = await p.evaluate(() => window.__txt), lab = await label(p);
  const R = 0.46 * g.cell;
  const L1 = t.filter((x) => /^[A-P]$/.test(x.t)), N1 = t.filter((x) => /^\d+$/.test(x.t));
  ok(L1.length === 15 && N1.length === 15, `${tag}：15 個字母＋15 個數字（${L1.length}／${N1.length}）`);
  if (L1.length !== 15 || N1.length !== 15) return;
  const ls = [...L1].sort((a, b) => a.x - b.x), ns = [...N1].sort((a, b) => b.y - a.y);
  ok(ls.map((x) => x.t).join('') === COLS, `${tag}：字母由左到右＝${ls.map((x) => x.t).join('')}（A 在最左、P 在最右、沒有 I）`);
  ok(ns.map((x) => x.t).join(',') === Array.from({ length: 15 }, (_, i) => i + 1).join(','), `${tag}：數字由下到上＝${ns.map((x) => x.t).join(',')}（1 在最下、15 在最上）`);
  const xe = Math.max(...ls.map((x, i) => Math.abs(x.x - (g.pad + i * g.cell))));
  ok(xe < 0.6, `${tag}：每個字母的 x 對準該直線（最大偏差 ${xe.toFixed(2)}px）`);
  const ye = Math.max(...ns.map((x, i) => Math.abs((x.y - x.f * 0.36) - (g.pad + (14 - i) * g.cell))));
  ok(ye < 0.6, `${tag}：每個數字的 y 對準該橫線（最大偏差 ${ye.toFixed(2)}px）`);
  const bottom = g.pad + 14 * g.cell;
  const lt = Math.min(...ls.map((x) => x.y - 0.72 * x.f)), lb = Math.max(...ls.map((x) => x.y));
  ok(lt >= bottom + R - 0.4 && lb <= g.size - 0.2, `${tag}：字母在最下排棋子外緣（${(bottom + R).toFixed(1)}）以下、盤底（${g.size.toFixed(1)}）以內（${lt.toFixed(1)}～${lb.toFixed(1)}）`);
  const nl = Math.min(...ns.map((x) => x.x - x.w / 2)), nr = Math.max(...ns.map((x) => x.x + x.w / 2));
  ok(nl >= 0.2 && nr <= g.pad - R + 0.4, `${tag}：數字在最左排棋子外緣（${(g.pad - R).toFixed(1)}）以左、盤左緣以內（${nl.toFixed(1)}～${nr.toFixed(1)}）`);
  const f = ns[0].f, w2 = Math.max(...ns.map((x) => x.w));
  ok(f >= 7 && f <= 11.01, `${tag}：字級 ${f.toFixed(1)}px（7–11）、兩位數寬 ${w2.toFixed(1)}px`);
  ok([...L1, ...N1].every((x) => x.fill === lab), `${tag}：顏色＝目前棋盤樣式 label（${lab}）`);
  return { f, w2 };
}
// 像素對位：棋子圓心與格線都在 xy 算出來的位置
async function pixels(p, kind, tag) {
  const r = await p.evaluate((kind) => {
    const cvs = kind === 'duel' ? window.__duel.cv : document.getElementById('board'), c2 = cvs.getContext('2d'), dpr = cvs.width / cvs.getBoundingClientRect().width;
    const xyT = (t) => kind === 'duel' ? window.__duel.xyOf(window.__duel.tToP(t)) : xy(t);
    const lum = (x, y) => { const d = c2.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
    const V0 = kind === 'duel' ? null : revView(), P = kind === 'duel' ? (window.__duel.VR && window.__duel.VR.p) : (V0 ? V0.p : g);
    const out = { stones: [], grid: [] };
    if (P) { for (const t of P.black) { const [x, y] = xyT(t); out.stones.push(['b', t, lum(x, y)]); } for (const t of P.white) { const [x, y] = xyT(t); out.stones.push(['w', t, lum(x, y)]); } }
    function cell_() { if (kind === 'duel') { const a = window.__duel.xyOf(0), z = window.__duel.xyOf(224); return (z[0] - a[0]) / 14; } return cell; }
    const occ = new Set(P ? [...P.black, ...P.white] : []);
    for (const t of ['E5', 'K11', 'F12', 'C9', 'M6']) { if (occ.has(t)) continue; const [x, y] = xyT(t), cl = cell_(); out.grid.push([t, lum(x, y + cl / 2), lum(x + cl / 2, y + cl / 2), lum(x + cl / 2, y)]); }
    return out;
  }, kind);
  const bad = r.stones.filter(([k, t, l]) => (k === 'b' ? l > 110 : l < 150));
  ok(r.stones.length > 0 ? bad.length === 0 : true, `${tag}：題目棋子（${r.stones.length} 顆）的圓心像素是子色（黑暗白亮）${bad.length ? '，錯：' + bad.map((x) => x.join(':')).join(' ') : ''}`);
  const gb = r.grid.filter(([t, v, m, h]) => !(v < m - 25 && h < m - 25));
  ok(r.grid.length === 0 || gb.length === 0, `${tag}：空點上下／左右的線像素比格子中心暗（格線在 xy 算的位置上，${r.grid.length} 點）`);
}
const fresh = async (b, o = {}) => { const c = await mk(b, { w: 360, h: 640, ...o }); const p = await H.gameScene(c, 'prac'); return { c, p }; };

let b = null;
try {
  serve(8795, VCF); serve(8796, SNAP); serve(8791, VCF);
  await L.startWr(PERSIST); await sleep(3000);
  b = await H.launch();
  const allErrs = [];

  // ============ 1. 語法 ============
  console.log('== 1. 語法');
  for (const f of ['game/skin.js', 'game/settings.js']) { try { execSync(`node --check ${VCF}/${f}`, { stdio: 'pipe' }); ok(true, `node --check ${f}`); } catch (e) { ok(false, `node --check ${f}：${String(e.stderr).slice(0, 200)}`); } }
  for (const [f, mod] of [['game.html', false], ['duel.html', true]]) {
    const html = readFileSync(`${VCF}/${f}`, 'utf8'), re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0, bigOk = true;
    while ((m = re.exec(html))) { if (m[1].trim().length < 200) continue; const tmp = `${HERE}/_x${i++}${mod ? '.mjs' : '.js'}`; writeFileSync(tmp, m[1]); try { execSync(`node --check "${tmp}"`, { stdio: 'pipe' }); } catch (e) { bigOk = false; console.log(String(e.stderr).slice(0, 300)); } rmSync(tmp); }
    ok(bigOk && i > 0, `${f} 內嵌 script（${i} 段）語法`);
  }

  // ============ 2. 矩陣：關著＝基準、開著＝不擠 ============
  console.log('== 2. 全矩陣（game.html／duel.html × 尺寸 × 語言 × 開／關）對照 baseline.json');
  const base = JSON.parse(readFileSync(HERE + '/baseline.json', 'utf8'));
  let res = {};
  const rep = await S.makeReplayEntry();
  if (process.env.REUSE_AFTER === '1') { res = JSON.parse(readFileSync(HERE + '/after.json', 'utf8')); console.log('  （矩陣量測沿用上一輪完整跑出來的 after.json，時間點 ' + new Date(statSync(HERE + '/after.json').mtimeMs).toISOString() + '）'); }
  else {
    await S.gameMatrix(b, ['off', 'on'], res, { langs, vps });
    await S.duelMatrix(b, ['off', 'on'], res, { langs, vps, replayEntry: rep });
    writeFileSync(HERE + '/after.json', JSON.stringify(res, null, 1));
  }
  const keys = Object.keys(res).filter((k) => /\|off$/.test(k)), tab = {};
  let nOff = 0, offBad = [], nOn = 0, onBad = [], noBase = [];
  const flaky = [];
  const ratioMin = {}, ratios = {};
  const eq = (a, b2) => JSON.stringify(a) === JSON.stringify(b2);
  for (const k of keys) {
    const bs = base[k], off = res[k], on = res[k.replace(/off$/, 'on')];
    if (!bs) { noBase.push(k); continue; }
    nOff++;
    const same = eq(off.cv, bs.cv) && eq(off.wrap, bs.wrap) && Math.abs(off.pad - bs.pad) < 0.011 && Math.abs(off.cell - bs.cell) < 0.011 && off.overY === bs.overY && off.overX === bs.overX && eq(off.out, bs.out) && eq(off.over, bs.over);
    // 舊版本身的版面不穩（同一情境、同一程式，棋盤有時 242 有時 296，見 ja_probe.mjs）：版面（棋盤外框）跟基準不同時，
    // 只要「pad＝邊長×4.5%、cell＝(邊長−2pad)/14」這條沒動過的算式成立，就算舊版也會有的版面狀態，後續比較改用同一輪的關著當參考。
    const formulaOk = Math.abs(off.pad - off.cv[2] * 0.045) < 0.011 && Math.abs(off.cell - (off.cv[2] - 2 * off.pad) / 14) < 0.011;
    if (!same && formulaOk && !eq(off.cv, bs.cv)) flaky.push(k + ' 基準外框 ' + JSON.stringify(bs.cv) + ' 本輪 ' + JSON.stringify(off.cv));
    else if (!same) offBad.push(k + ' 基準 ' + JSON.stringify([bs.cv, bs.pad, bs.cell, bs.overY]) + ' 現在 ' + JSON.stringify([off.cv, off.pad, off.cell, off.overY]));
    if (!on) continue;
    nOn++;
    const ref = same ? bs : formulaOk ? off : bs;
    const rr = on.cell / ref.cell, vp = k.split('|')[3];
    const why = [];
    if (NEG) { if (!(rr >= 1)) why.push(`【負向】格距 ${(rr * 100).toFixed(1)}%（要求 ≥100%，預期 FAIL）`); }
    else if (rr < 0.95) why.push(`格距 ${(rr * 100).toFixed(1)}% < 95%`);
    if (!eq(on.cv, ref.cv) || !eq(on.wrap, ref.wrap)) why.push('棋盤外框變了 ' + JSON.stringify([ref.cv, on.cv]));
    if (on.overY > ref.overY || on.overX > ref.overX) why.push(`超出變多 y ${ref.overY}→${on.overY} x ${ref.overX}→${on.overX}`);
    if (ref.overY === 0 && on.overY > 0) why.push('原本不捲、現在捲');
    if (on.out.length > ref.out.length || on.out.some((x) => !ref.out.includes(x))) why.push('按鈕出界變多 ' + on.out.join(','));
    if (on.over.some((x) => !ref.over.includes(x))) why.push('棋盤與別的元素重疊 ' + on.over.join(','));
    const vk = vp; ratioMin[vk] = Math.min(ratioMin[vk] ?? 9, rr); (ratios[vk] ||= []).push([k, ref.pad, ref.cell, on.pad, on.cell, rr]);
    if (why.length) onBad.push(k + '：' + why.join('；'));
  }
  ok(noBase.length === 0, `每個量測點都有基準（${keys.length} 點，缺 ${noBase.length}${noBase.length ? '：' + noBase.slice(0, 4).join(' ') : ''}）`);
  ok(offBad.length === 0, `關著：${nOff - flaky.length} 點跟基準逐項相同（外框、位置、格距、捲動、按鈕出界、重疊）；另 ${flaky.length} 點是舊版也會出現的版面不穩狀態（外框跟基準不同，但 pad＝4.5%、cell 算式不變；見 ja_probe）${flaky.length ? '\n    ' + flaky.join('\n    ') : ''}${offBad.length ? '\n    ' + offBad.slice(0, 8).join('\n    ') : ''}`);
  ok(onBad.length === 0, `開著：${nOn} 點格距 ≥ 基準 95%、棋盤外框不變、不比基準更捲、按鈕沒出界、沒重疊${onBad.length ? '\n    ' + onBad.slice(0, 12).join('\n    ') : ''}`);
  { const inf = Object.entries(res).filter(([k]) => /^info\|duel\|review-modal-closed/.test(k)), fr = Object.entries(res).filter(([k]) => /^info\|duel\|review-free/.test(k));
    ok(inf.every(([, v]) => v === true) && fr.every(([, v]) => v === true), `賽後回看情境確實進到逐題回看（結算視窗已關：${inf.map(([, v]) => v)}；自己擺：${fr.map(([, v]) => v)}）`); }
  const fails = Object.keys(res).filter((k) => /^fail\|/.test(k)), errs = Object.entries(res).filter(([k, v]) => /^errs\|/.test(k) && v.length);
  ok(fails.length === 0, `情境全部跑完（失敗 ${fails.length}${fails.length ? '：' + fails.map((k) => k + ' ' + res[k]).join('；').slice(0, 300) : ''}）`);
  ok(errs.length === 0, `矩陣中沒有 pageerror／console error${errs.length ? '：' + JSON.stringify(errs).slice(0, 300) : ''}`);
  console.log('  --- 格距表（開著／基準，每個尺寸跨所有畫面×語言）');
  for (const vp of Object.keys(ratios)) {
    const a = ratios[vp], mn = a.reduce((x, y) => (y[5] < x[5] ? y : x)), mx = a.reduce((x, y) => (y[5] > x[5] ? y : x));
    console.log(`  ${vp.padEnd(9)} 最小 ${(mn[5] * 100).toFixed(2)}%（${mn[0].split('|').slice(0, 3).join('|')}：pad ${mn[1]}→${mn[3]}、cell ${mn[2]}→${mn[4]}）最大 ${(mx[5] * 100).toFixed(2)}%`);
  }
  // 改動前就會捲動／按鈕出界的組合
  const scrollers = Object.entries(base).filter(([k, v]) => v && v.cv && (v.overY > 0 || v.overX > 0 || v.out.length || v.over.length));
  console.log(`  --- 改動前就會捲動／按鈕出界／重疊的組合（${scrollers.length} 個，開著後都不更糟＝上面那條已驗）`);
  const grp = {}; scrollers.forEach(([k, v]) => { const [pg, sc, lg, vp] = k.split('|'); (grp[`${pg}|${sc}|${vp}`] ||= []).push(`${lg}:${v.overY || 0}px${v.out.length ? '/出界' + v.out.length : ''}${v.over.length ? '/重疊' + v.over.length : ''}`); });
  for (const [k, v] of Object.entries(grp)) console.log('    ' + k + '  ' + v.join(' '));

  // ============ 3. 座標字、點擊、像素 ============
  console.log('== 3. game.html：座標字／像素／點擊');
  {
    const { c, p } = await fresh(b);
    await H.setCoords(p, true);
    await labels(p, 'game', 'game 練習 360x640');
    await pixels(p, 'game', 'game 練習 360x640');
    for (const [w, h] of [[320, 568], [412, 915], [768, 1024]]) { await H.resizeTo(p, w, h); await labels(p, 'game', `game 練習 ${w}x${h}`); }
    await H.resizeTo(p, 360, 640);
    const hit = await p.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(), o = {}; for (const t of ['H8', 'A1', 'A15', 'P1', 'P15']) { const [x, y] = xy(t); o[t] = cellAt({ clientX: r.left + x, clientY: r.top + y }); } const [x, y] = xy('H8'); o.near = cellAt({ clientX: r.left + x + cell * 0.45, clientY: r.top + y }); o.far = cellAt({ clientX: r.left + x + cell * 0.55, clientY: r.top + y }); o.A1b = cellAt({ clientX: r.left + xy('A1')[0] - cell * 0.45, clientY: r.top + xy('A1')[1] + cell * 0.45 }); return o; });
    ok(hit.H8 === 'H8' && hit.A1 === 'A1' && hit.A15 === 'A15' && hit.P1 === 'P1' && hit.P15 === 'P15', `game 點擊對位：H8→${hit.H8}（天元）、四角 A1→${hit.A1} A15→${hit.A15} P1→${hit.P1} P15→${hit.P15}`);
    ok(hit.near === 'H8' && hit.far === 'I8'.replace('I', 'J'), `game 判定範圍：偏 0.45 格仍是 H8（${hit.near}），偏 0.55 格是 J8（${hit.far}）；角落外偏 0.45 格仍是 A1（${hit.A1b}）`);
    // 換樣式顏色跟著變
    for (const id of ['night', 'neon', 'walnut', 'green', 'paper', 'classic']) {
      await p.evaluate((id) => window.RushSkin.setBoard(id), id); await sleep(200);
      const lab = await label(p), t = await p.evaluate(() => window.__txt);
      ok(t.filter((x) => /^[A-P]$|^\d+$/.test(x.t)).length === 30 && t.filter((x) => /^[A-P]$|^\d+$/.test(x.t)).every((x) => x.fill === lab), `換棋盤「${id}」：30 個字都換成 label ${lab}`);
    }
    // 局中落子後：標記對位（點一下棋盤落一手，檢查那顆子圓心）
    allErrs.push(...H.errsOf(p)); await c.close();
  }
  for (const [scene, tag] of [['rush', '煉獄之門'], ['wx', '無相界'], ['twRev', '象牙塔研究盤'], ['rvRev', '覆盤研究盤']]) {
    const c = await mk(b, { w: 360, h: 640 }); const p = await H.gameScene(c, scene);
    await H.setCoords(p, true);
    await labels(p, 'game', `game ${tag}`); await pixels(p, 'game', `game ${tag}`);
    allErrs.push(...H.errsOf(p)); await c.close();
  }

  console.log('== 4. 設定頁：開關、預設關、立刻重畫、記得、兩頁共用、對局中切換');
  {
    const c = await mk(b, { w: 375, h: 667 });   // 全新玩家：沒有 vcfgame.coords
    const p = await H.openPage(c, 'game.html');
    ok(await p.evaluate(() => localStorage.getItem('vcfgame.coords') === null && window.RushSkin.coords() === false), '全新玩家：沒有 vcfgame.coords，RushSkin.coords()＝false');
    await p.click('#modeP'); await p.click('#go'); await p.waitForFunction(() => g && g.p, null, { timeout: 15000 }); await sleep(500);
    const f = await p.evaluate(() => ({ pad, cell, px }));
    const bs = base['game|prac|zh|375x667|off'];
    ok(Math.abs(f.pad - f.px * 0.045) < 1e-6 && (await p.evaluate(() => window.__txt.length)) === 0, `全新玩家：沒有座標字、pad＝px×4.5%（${f.pad.toFixed(2)}／${(f.px * 0.045).toFixed(2)}）${bs ? '、與基準 pad ' + bs.pad + ' cell ' + bs.cell + ' 現在 ' + f.pad.toFixed(2) + '／' + f.cell.toFixed(2) : ''}`);
    if (bs) ok(Math.abs(bs.pad - f.pad) < 0.011 && Math.abs(bs.cell - f.cell) < 0.011, '全新玩家：與 baseline.json 的 game|prac|zh|375x667 逐項相同');
    await p.evaluate(() => { document.getElementById('sPlay').hidden = true; document.getElementById('sHome').hidden = false; });
    await p.click('#openSet'); await sleep(300);
    const sw = await p.evaluate(() => { const e = document.getElementById('setCoords'), r = e.getBoundingClientRect(); return { has: !!e, role: e.getAttribute('role'), on: e.getAttribute('aria-checked'), w: Math.round(r.width), h: Math.round(r.height), txt: e.textContent.trim(), vis: !!e.offsetParent }; });
    ok(sw.has && sw.role === 'switch' && sw.on === 'false' && sw.vis, `設定頁有「${sw.txt}」開關（role=${sw.role}、aria-checked=${sw.on}＝預設關）`);
    ok(sw.h >= 44 && sw.w >= 44, `開關觸控範圍 ${sw.w}×${sw.h}px（≥44）`);
    const order = await p.evaluate(() => { const a = document.getElementById('setSkin').getBoundingClientRect(), b2 = document.getElementById('setCoords').getBoundingClientRect(), l = document.getElementById('setLang').getBoundingClientRect(); return a.bottom <= b2.top + 1 && b2.bottom <= l.top + 1; });
    ok(order, '開關列在「棋具」的下一列、「語言」之前');
    await p.evaluate(() => { document.getElementById('sSet').scrollTop = 0; });
    await p.click('#setCoords'); await sleep(250);
    ok(await p.evaluate(() => document.getElementById('setCoords').getAttribute('aria-checked') === 'true' && localStorage.getItem('vcfgame.coords') === '1' && window.RushSkin.coords()), '按一下：aria-checked=true、vcfgame.coords＝"1"');
    await p.evaluate(() => { document.getElementById('sSet').hidden = true; document.getElementById('sPlay').hidden = false; layout(); });
    await sleep(300);
    const g1 = await geomOf(p, 'game');
    ok(g1.pad > g1.size * 0.045 + 1 && (await p.evaluate(() => window.__txt.filter((x) => /^[A-P]$/.test(x.t)).length)) === 15, `開了之後棋盤立刻畫座標（pad ${g1.pad.toFixed(2)}、cell ${g1.cell.toFixed(2)}）`);
    // 立刻重畫：在設定頁開著的狀態下切換（底下棋盤同步重畫）
    await p.evaluate(() => { document.getElementById('sPlay').hidden = true; document.getElementById('sSet').hidden = false; });
    await p.click('#setCoords'); await sleep(250);
    const g2 = await geomOf(p, 'game');
    ok(Math.abs(g2.pad - g2.size * 0.045) < 1e-6 && (await p.evaluate(() => localStorage.getItem('vcfgame.coords') === '0' && window.__txt.filter((x) => /^[A-P]$/.test(x.t)).length === 0)), '關掉：底下棋盤馬上回到無座標、pad 回 4.5%、vcfgame.coords＝"0"');
    await p.click('#setCoords'); await sleep(250);
    await p.reload(); await sleep(1200);
    ok(await p.evaluate(() => window.RushSkin.coords() === true && localStorage.getItem('vcfgame.coords') === '1'), '重新整理後還是開著（記得）');
    // 兩頁共用：game 開著 → duel 也有
    const D = await c.newPage(); D.errs = []; D.on('pageerror', (e) => D.errs.push(e.message));
    await D.goto(H.BASE + '/duel.html'); await sleep(1500);
    ok(await D.evaluate(() => window.RushSkin.coords() === true), 'game.html 切開之後，duel.html 也是開著（同一個 vcfgame.coords）');
    // 別的分頁切換：storage 事件讓這頁即時跟上
    await p.evaluate(() => document.getElementById('sSet').hidden); await D.bringToFront();
    await D.evaluate(() => window.RushSkin.setCoords(false)); await sleep(500);
    ok(await p.evaluate(() => window.RushSkin.coords() === false), '另一個分頁關掉 → 這頁透過 storage 事件也跟著關');
    allErrs.push(...H.errsOf(p), ...D.errs); await c.close();
  }
  {   // 兩儀殿對局中：齒輪進設定切換，不重連、不離房
    const ctxs = await Promise.all(['Alice', 'Bob'].map((n) => mk(b, { nick: n, w: 375, h: 667 })));
    const A = await H.openPage(ctxs[0], 'duel.html'), B = await H.openPage(ctxs[1], 'duel.html');
    const id = await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
    const before = await A.evaluate(() => ({ n: window.__wsN, sent: window.__sent.length, room: window.__duel.room.id, g: (() => { const a = window.__duel.xyOf(0), z = window.__duel.xyOf(224); return [a[0], (z[0] - a[0]) / 14]; })() }));
    await A.locator('[data-set-open]:visible').first().click(); await sleep(400);
    ok(await A.evaluate(() => document.getElementById('setCoords') && !document.getElementById('rsOverlay').hidden && document.getElementById('setCoords').getAttribute('aria-checked') === 'false'), '兩儀殿對局中開設定頁：有開關、預設關');
    await A.click('#setCoords'); await sleep(400);
    const after = await A.evaluate(() => ({ n: window.__wsN, sent: window.__sent.slice(), room: window.__duel.room && window.__duel.room.id, state: window.__duel.room && window.__duel.room.state, open: window.__ws.readyState, g: (() => { const a = window.__duel.xyOf(0), z = window.__duel.xyOf(224); return [a[0], (z[0] - a[0]) / 14]; })(), labels: window.__txt.filter((x) => /^[A-P]$/.test(x.t)).length }));
    ok(after.n === before.n && after.open === 1 && after.room === before.room && after.state === 'play', `對局中切換：WebSocket 沒重連（建立次數 ${before.n}→${after.n}）、仍在房間 ${after.room}、狀態 ${after.state}`);
    const newSent = after.sent.slice(before.sent).map((s) => JSON.parse(s).t);
    ok(!newSent.some((t) => t === 'leave' || t === 'move' || t === 'resign'), `切換沒送任何房間訊息（新增：${newSent.join(',') || '無'}）`);
    ok(after.g[0] > before.g[0] + 1 && after.g[1] < before.g[1] && after.labels === 15, `棋盤馬上重畫：pad ${before.g[0].toFixed(2)}→${after.g[0].toFixed(2)}、cell ${before.g[1].toFixed(2)}→${after.g[1].toFixed(2)}、15 個字母`);
    await A.keyboard.press('Escape'); await sleep(300);
    ok(await A.evaluate(() => document.getElementById('rsOverlay').hidden), '關掉設定頁回到對局');
    // 點擊對位（真點）：天元 H8 → move p=112；cellAt 四個角
    const hit = await A.evaluate(() => { const o = {}; const cr = window.__duel.cv.getBoundingClientRect(); for (const t of ['H8', 'A1', 'A15', 'P1', 'P15']) { const [x, y] = window.__duel.xyOf(window.__duel.tToP(t)); o[t] = window.__duel.cellAt({ clientX: cr.left + x, clientY: cr.top + y }) === window.__duel.tToP(t); } return o; });
    ok(Object.values(hit).every(Boolean), `duel 點擊對位：H8、A1、A15、P1、P15 的中心都落在對的點（${JSON.stringify(hit)}）`);
    const cr = await A.evaluate(() => { const r = window.__duel.cv.getBoundingClientRect(), [x, y] = window.__duel.xyOf(window.__duel.tToP('H8')); return [r.left + x, r.top + y]; });
    const n0 = (await A.evaluate(() => window.__sent.length));
    const me = await A.evaluate(() => window.__duel.mySeat());
    await A.mouse.click(cr[0], cr[1]); await sleep(500);
    const mv = await A.evaluate((n0) => window.__sent.slice(n0).map((s) => JSON.parse(s)).filter((m) => m.t === 'move'), n0);
    ok(me !== 0 || (mv.length === 1 && mv[0].p === 112), `真的點 H8（座標字開著）→ 送出 move p=${mv[0] && mv[0].p}（天元＝112）${me !== 0 ? '（A 不是座位 0，略過）' : ''}`);
    allErrs.push(...H.errsOf(A), ...H.errsOf(B)); await Promise.all(ctxs.map((c) => c.close()));
  }

  console.log('== 5. duel.html 各種棋盤：座標字／像素');
  {
    const ctxs = await Promise.all(['Alice', 'Bob', 'Cara'].map((n) => mk(b, { nick: n, w: 360, h: 640 })));
    const A = await H.openPage(ctxs[0], 'duel.html'), B = await H.openPage(ctxs[1], 'duel.html'), C = await H.openPage(ctxs[2], 'duel.html');
    for (const p of [A, B, C]) await H.setCoords(p, true);
    const g1 = await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'free', color: 'b', priv: false });
    await H.watch(C, g1); await sleep(500);
    await labels(A, 'duel', '五子棋對局'); await labels(C, 'duel', '五子棋觀戰');
    await A.screenshot({ path: SH + 'duel_gomoku_play_zh_360x640.png' });
    await H.wsSend(A, { t: 'leave' }); await H.wsSend(B, { t: 'leave' }); await sleep(500); await C.click('#rBack').catch(() => {}); await sleep(500);
    const v1 = await H.newRoom(A, B, { t: 'create', kind: 'vcf', vmode: 'line', rank: 1, think: 180, target: 3, priv: false, color: 'b' });
    await H.watch(C, v1);
    await H.waitFn(C, () => { const d = window.__duel, st = d.room.vs.p[0]; return st && st.puzzle && Date.now() >= st.at && st.s === 'think'; }); await sleep(500);
    await labels(A, 'duel', 'VCF 對局'); await pixels(A, 'duel', 'VCF 對局');
    await A.screenshot({ path: SH + 'duel_vcf_play_zh_360x640.png' });
    await H.firstMove(B, 0); await H.waitFn(C, (s) => window.__duel.watchFocus === s, B.__seat, 15000); await sleep(600);
    await labels(C, 'duel', 'VCF 觀戰'); await pixels(C, 'duel', 'VCF 觀戰');
    await C.screenshot({ path: SH + 'duel_vcf_watch_zh_360x640.png' });
    await C.click(B.__seat === 0 ? '#pBot' : '#pTop').catch(() => {}); await sleep(500);
    await C.screenshot({ path: SH + 'duel_vcf_watch_auto_zh_360x640.png' });
    await C.setViewportSize({ width: 320, height: 568 }); await sleep(600); await C.screenshot({ path: SH + 'duel_vcf_watch_auto_zh_320x568.png' });
    await C.setViewportSize({ width: 360, height: 640 });
    for (let i = 0; i < 3; i++) await H.solveReal(A, i);
    await H.waitFn(A, () => window.__duel.room.state === 'over', null, 40000); await sleep(900);
    await H.waitFn(A, () => !document.getElementById('mEnd').hidden, null, 15000).catch(() => {});
    await A.click('#bLook', { timeout: 8000 }); await sleep(700);
    ok(await A.evaluate(() => document.getElementById('mEnd').hidden && !document.getElementById('phaseActs').hidden && !!document.querySelector('[data-rv="prev"]')), 'VCF 賽後：按「看每題解法」後結算視窗關掉、逐題回看工具列在');
    await labels(A, 'duel', 'VCF 賽後逐題回看'); await pixels(A, 'duel', 'VCF 賽後逐題回看');
    await A.screenshot({ path: SH + 'duel_vcf_review_zh_360x640.png' });
    await A.waitForSelector('[data-rv="undo"]:not([disabled])', { timeout: 15000 }).catch(() => {});
    await A.click('[data-rv="undo"]', { timeout: 8000 }); await sleep(600);
    ok(await A.evaluate(() => /自己擺/.test(document.getElementById('facts').textContent)), 'VCF 回看：按「退一手」進入自己擺（facts 出現「自己擺」）');
    await labels(A, 'duel', 'VCF 回看・自己擺'); await A.screenshot({ path: SH + 'duel_vcf_review_free_zh_360x640.png' });
    allErrs.push(...H.errsOf(A), ...H.errsOf(B), ...H.errsOf(C)); await Promise.all(ctxs.map((c) => c.close()));
    // #replay=
    const D = await mk(b, { w: 360, h: 640 }), P = await H.openPage(D, 'duel.html');
    await P.evaluate((s) => localStorage.setItem('vcfgame.today', s), JSON.stringify([rep])); await H.setCoords(P, true);
    await P.goto(H.BASE + '/duel.html?again=1'); await P.goto(H.BASE + '/duel.html#replay=' + rep.id); await sleep(1400);
    await labels(P, 'duel', '#replay= 回看（終局）');
    const mk5 = await P.evaluate(() => { const d = window.__duel, mv = d.match.moves, last = mv.at(-1), cl = (() => { const a = d.xyOf(0), z = d.xyOf(224); return (z[0] - a[0]) / 14; })(), c2 = d.cv.getContext('2d'), dpr = d.cv.width / d.cv.getBoundingClientRect().width; const px_ = (x, y) => { const q = c2.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return [q[0], q[1], q[2]]; }; const [lx, ly] = d.xyOf(last.p), ln = d.match.result && d.match.result.line, [fx, fy] = ln ? d.xyOf(ln[0]) : [0, 0]; return { dot: px_(lx, ly), ring: ln ? px_(fx + cl * 0.52, fy) : null, ringExp: ln ? 1 : 0 }; });
    const near = (a, c3, tol) => a && a.every((v, i) => Math.abs(v - c3[i]) <= tol);
    ok(near(mk5.dot, [0xFF, 0x7A, 0x6B], 14), `回看：最後一手的紅點畫在該子圓心（像素 ${mk5.dot}）`);
    ok(mk5.ring === null || near(mk5.ring, [0xF2, 0xB5, 0x44], 40), `回看：連五金框畫在第一顆連線子的外圈（像素 ${mk5.ring}）`);
    await P.screenshot({ path: SH + 'duel_replay_zh_360x640.png' });
    // 深色盤、圖片盤的對比截圖（座標字開著）
    await P.evaluate(() => { localStorage.setItem('vcfgame.owned', JSON.stringify(['b:starry', 'b:pool'])); localStorage.setItem('vcfgame.skinsOff', JSON.stringify({ off: { boards: [], stones: [] }, on: { boards: ['starry', 'pool', 'grass', 'beach', 'chalk', 'ice', 'denim'], stones: [] } })); });
    await P.goto(H.BASE + '/duel.html?again=1'); await P.goto(H.BASE + '/duel.html#replay=' + rep.id); await sleep(1500);
    for (const id of ['night', 'starry', 'pool']) {
      const set = await P.evaluate((id) => window.RushSkin.setBoard(id), id); await sleep(900);
      const t = await P.evaluate(() => window.__txt.length);
      ok(set === true && t >= 30 && (await P.evaluate(() => !document.getElementById('sRoom').hidden)), `${id}：換成功、仍在回看畫面、座標字 ${t} 個`);
      await P.screenshot({ path: SH + `duel_replay_${id}_zh_360x640.png` });
    }
    allErrs.push(...H.errsOf(P)); await D.close();
  }
  // 解題畫面截圖（開著）
  for (const [w, h] of [[320, 568], [360, 640], [375, 667], [412, 915], [768, 1024]]) {
    const c = await mk(b, { w, h }); const p = await H.gameScene(c, 'rush'); await H.setCoords(p, true); await sleep(300);
    await p.screenshot({ path: SH + `game_rush_zh_${w}x${h}.png` }); allErrs.push(...H.errsOf(p)); await c.close();
  }
  { const c = await mk(b, { w: 320, h: 568 }); const p = await H.gameScene(c, 'twRev'); await H.setCoords(p, true); await sleep(300); await p.screenshot({ path: SH + 'game_twRev_zh_320x568.png' }); await c.close(); }
  { const c = await mk(b, { w: 360, h: 640 }); const p = await H.gameScene(c, 'rvRev'); await H.setCoords(p, true); await p.evaluate(() => window.RushSkin.setBoard('night')); await sleep(300); await p.screenshot({ path: SH + 'game_rvRev_night_zh_360x640.png' }); await c.close(); }

  // ============ 6. 設定頁加了一列後仍不捲動（對照改動前快照）============
  console.log('== 6. 設定頁：四語 × 兩種尺寸，加了一列後不比改動前更擠（對照快照 8796）');
  {
    const setMeas = async (base0, kind, lang, w, h) => {
      const c = await H.mkCtx(b, { lang, w, h }); const BU = H.BASE;
      const p = await c.newPage(); p.errs = [];
      await p.goto(base0 + '/' + (kind === 'game' ? 'game.html' : 'duel.html')); await sleep(1100);
      await (kind === 'game' ? p.click('#openSet') : p.locator('[data-set-open]:visible').first().click()); await sleep(500);
      const r = await p.evaluate((kind) => {
        const d = document.documentElement, msg = document.getElementById('openMsg').getBoundingClientRect();
        return { sh: d.scrollHeight, ih: innerHeight, sw: d.scrollWidth, iw: innerWidth, msgBottom: Math.round(msg.bottom), clipped: msg.bottom > innerHeight + 0.5, has: !!document.getElementById('setCoords') };
      }, kind);
      await c.close(); return r;
    };
    let bad = [], n = 0;
    for (const lang of langs) for (const kind of ['game', 'duel']) for (const [w, h] of [[320, 568], [375, 667]]) {
      const o = await setMeas(OLD, kind, lang, w, h), nw = await setMeas(NEW, kind, lang, w, h); n++;
      const oOver = Math.max(0, o.sh - o.ih), nOver = Math.max(0, nw.sh - nw.ih);
      const worse = (nOver > oOver) || (nw.clipped && !o.clipped);
      console.log(`    ${kind} ${lang} ${w}x${h}：前 sh/ih ${o.sh}/${o.ih} 留言列底 ${o.msgBottom} 裁切 ${o.clipped}；後 ${nw.sh}/${nw.ih} 底 ${nw.msgBottom} 裁切 ${nw.clipped}`);
      if (worse || !nw.has) bad.push(`${kind} ${lang} ${w}x${h}`);
    }
    ok(bad.length === 0, `設定頁 ${n} 種組合都不比改動前更捲／更被裁${bad.length ? '：' + bad.join('、') : ''}`);
  }

  // ============ 7. 不受影響的畫面 ============
  console.log('== 7. 教學盤、score.html、商店／棋具頁預覽盤：開或關都跟改動前一樣');
  {
    const cmp = async (name, fn) => {
      const out = {};
      for (const [tag, base0, coords] of [['舊', OLD, '0'], ['新關', NEW, '0'], ['新開', NEW, '1']]) {
        const c = await H.mkCtx(b, { w: 390, h: 844, coords }); const p = await c.newPage();
        await p.goto(base0 + '/' + fn.page); await sleep(1300);
        out[tag] = await fn.run(p); await c.close();
      }
      ok(out['舊'] === out['新關'] && out['舊'] === out['新開'], `${name}：舊／新關／新開 相同（${String(out['舊']).slice(0, 40)}…；${String(out['新關']).slice(0, 12)}／${String(out['新開']).slice(0, 12)}）`);
    };
    await cmp('棋具頁預覽盤（skin-picker 畫的 canvas）', { page: 'game.html', run: async (p) => { await p.click('#openSet'); await sleep(300); await p.click('#setSkin'); await sleep(1200); return p.evaluate(() => { const r = document.getElementById('skinPick'); return r ? [...r.querySelectorAll('canvas')].map((c) => c.toDataURL()).join('|').length + ':' + [...r.querySelectorAll('canvas')].map((c) => c.toDataURL().slice(-40)).join('') : 'none'; }); } });
    await cmp('商店預覽盤（shop 畫的 canvas）', { page: 'game.html', run: async (p) => { await p.click('#openSet'); await sleep(300); await p.click('#setSkin'); await sleep(1000); const s = p.locator('.shopPlus').first(); if (!(await s.count())) return 'no-shop'; await s.click(); await sleep(1500); return p.evaluate(() => { const r = document.getElementById('shopPage'); return r ? [...r.querySelectorAll('canvas')].map((c) => c.toDataURL().slice(-60)).join('') + ':' + r.querySelectorAll('canvas').length : 'none'; }); } });
    await cmp('score.html 試煉場盤面（svg）', { page: 'score.html', run: async (p) => p.evaluate(() => { const s = document.querySelector('svg#board'); return s ? s.innerHTML.length + ':' + s.innerHTML.slice(0, 300) + s.innerHTML.slice(-200) : 'none'; }) });
    await cmp('VCF 教學盤（learn.js 的 9×9 DOM 盤）', { page: 'game.html', run: async (p) => { await p.click('#toLearn'); await sleep(1000); const b2 = p.locator('#learn button').filter({ hasText: /./ }); const n = await b2.count(); for (let i = 0; i < Math.min(n, 4) && !(await p.locator('#learn .lbrd').count()); i++) { await b2.nth(i).click().catch(() => {}); await sleep(600); } return p.evaluate(() => { const e = document.querySelector('#learn .lbrd'); return e ? e.outerHTML.length + ':' + e.outerHTML.replace(/style="[^"]*"/g, '').slice(0, 300) : 'no-board'; }); } });
  }
  ok(allErrs.length === 0, `全程沒有 pageerror／console error${allErrs.length ? '：' + JSON.stringify(allErrs).slice(0, 300) : ''}`);
  await b.close();
} catch (e) { fail++; console.log('  FAIL 腳本例外：', e && e.stack ? e.stack.slice(0, 600) : e); }
finally { killAll(); }
console.log(`PASS ${pass}／FAIL ${fail}`);
process.exit(fail ? 1 : 0);
