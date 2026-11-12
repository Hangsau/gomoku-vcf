// 明鏡台觀戰看落子檢查：node run.mjs。需要 http.server 8793（BASE）、8791（題庫）、wrangler dev 8789。
import * as L from './lib.mjs';
const { ok, sleep } = L;
const b = await L.launch();
const SH = 'shots/';
const errsOf = (...ps) => ps.flatMap((p) => p.errs);
const canvasSig = (p) => p.evaluate(() => { const c = window.__duel.cv; return c.toDataURL(); });
const seqOf = (p, seat) => p.evaluate((s) => { const x = window.__duel.room.vs.p[s]; return 'seq' in x ? x.seq : undefined; }, seat);
const hasSeqField = (p) => p.evaluate(() => window.__duel.room.vs.p.some((x) => 'seq' in x));
const watchSeat = (p) => p.evaluate(() => window.__duel.watchSeat);

async function watch(p, id) { await p.click(`[data-room="${id}"]`); await sleep(500); }
async function firstMove(p) {   // 正解的第一手（攻方一手＋電腦擋一手＝2 手）
  await L.waitLive(p);
  const { raw } = await L.solveCur(p);
  const sol = L.parseSol(raw);
  await L.clickT(p, sol[0]);
  await p.waitForFunction(() => { const v = window.__duel.VR; return v.moves.length >= 1 && !v.hold; }, null, { timeout: 8000 });
}
async function setup(vmode, o = {}) {
  const A = await L.mk(b, { nick: 'Alice', ...o }), B = await L.mk(b, { nick: 'Bob', ...o }), C = await L.mk(b, { nick: 'Cat', ...o });
  await L.create(A, { kind: 'vcf', vmode, target: 3 });
  const id = await L.roomId(A); await L.join(B, id); await watch(C, id);
  return { A, B, C, id };
}

for (const vmode of ['line', 'eight']) {
  console.log('== 觀戰看落子', vmode);
  const { A, B, C } = await setup(vmode);
  await sleep(3800);
  const sa = await A.evaluate(() => window.__duel.mySeat()), sb = 1 - sa;
  ok(await C.evaluate(() => window.__duel.mySeat()) === -1, 'C 是觀戰者（不在座位上）');
  // 讓 C 先看 A 的座位
  if (await watchSeat(C) !== sa) { await C.click('#pTop'); await sleep(300); }
  ok(await watchSeat(C) === sa, `C 先看 A 的座位（${sa}）`);
  const c0 = await canvasSig(C), a0 = await canvasSig(A), b0 = await canvasSig(B);
  await C.screenshot({ path: SH + `${vmode}_C_before.png` });
  await firstMove(A);
  await sleep(600);
  const seqC = await seqOf(C, sa);
  ok(Array.isArray(seqC) && seqC.length === 2, `C 收到 A 座位的 seq 長度 2（${JSON.stringify(seqC)}）`);
  ok(!(await hasSeqField(A)) && !(await hasSeqField(B)), 'A、B 收到的狀態沒有 seq 欄位');
  const c1 = await canvasSig(C);
  ok(c1 !== c0, 'C 的棋盤畫面在 A 下棋後有變');
  // 像素：新增的棋子（2 顆）讓畫面變動像素數明顯 > 0
  const diffPx = await C.evaluate(async ([u0, u1]) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const [i0, i1] = await Promise.all([load(u0), load(u1)]);
    const mk = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const d0 = mk(i0), d1 = mk(i1); let n = 0; for (let k = 0; k < d0.length; k += 4) if (d0[k] !== d1[k] || d0[k + 1] !== d1[k + 1] || d0[k + 2] !== d1[k + 2]) n++;
    return n;
  }, [c0, c1]);
  ok(diffPx > 800, `C 畫面多出兩顆帶數字的棋子（變動像素 ${diffPx}）`);
  await C.screenshot({ path: SH + `${vmode}_C_watchA.png` });
  // 換邊
  await C.click('#pTop'); await sleep(400);
  ok(await watchSeat(C) === sb, `點上方玩家列後 watchSeat 換成 ${sb}`);
  const c2 = await canvasSig(C);
  ok(c2 === c0, 'C 換看 B（B 沒下）→ 畫面等於 A 下棋前、沒有數字棋子');
  await C.screenshot({ path: SH + `${vmode}_C_watchB.png` });
  await C.click('#pTop'); await sleep(400);
  ok(await watchSeat(C) === sa && await canvasSig(C) === c1, '再點一次換回 A、畫面跟剛才看 A 一樣');
  // 玩家自己的畫面
  const a1 = await canvasSig(A), b1 = await canvasSig(B);
  ok(a1 !== a0, 'A 自己看得到自己下的棋');
  ok(b1 === b0, 'B 看不到 A 的棋（畫面沒變）');
  ok(await A.evaluate(() => window.__duel.VR.seq.length) === 2, 'A 自己的 VR.seq 長度 2');
  ok(await A.evaluate(() => !document.getElementById('pTop').innerText.includes('⇅')) && await B.evaluate(() => !document.getElementById('pTop').innerText.includes('⇅')), '玩家的上方列沒有 ⇅');
  ok(await C.evaluate(() => document.getElementById('pTop').innerText.includes('⇅')), '觀戰者的上方列有 ⇅');
  ok(errsOf(A, B, C).length === 0, '沒有 JS 錯誤 ' + JSON.stringify(errsOf(A, B, C)));
  for (const p of [A, B, C]) await p.context().close();
}

// 離開再進別的房：watchSeat 歸 0
{
  console.log('== watchSeat 重設');
  const { A, B, C, id } = await setup('line');
  await sleep(3800);
  await C.click('#pTop'); await sleep(300);
  ok(await watchSeat(C) === 1, '點過一次 → 1');
  await C.evaluate(() => document.getElementById('rBack') ? document.getElementById('rBack').click() : null);
  await sleep(300);
  const inLobby = await C.evaluate(() => document.getElementById('sLobby') && !document.getElementById('sLobby').hidden);
  if (inLobby) { await watch(C, id); ok(await watchSeat(C) === 0, '離開再進房 → watchSeat 歸 0'); }
  else console.log('  （找不到返回鈕，跳過）');
  for (const p of [A, B, C]) await p.context().close();
}

// ===== 版面：C 觀戰畫面（有 ⇅、有數字棋子）四語 × 兩種小手機 =====
const LAYOUT_JS = () => {
  const W = innerWidth, H = innerHeight, bad = [], de = document.documentElement;
  if (de.scrollHeight > H + 1 || de.scrollWidth > W + 1) bad.push(`文件可捲動 ${de.scrollWidth}x${de.scrollHeight} > ${W}x${H}`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[hidden]') || el.closest('.list') || (el.closest('svg') && el.tagName !== 'svg')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) bad.push(`${el.tagName}#${el.id}.${String(el.className).slice(0, 20)} 超出 [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  const top = document.getElementById('pTop'), bot = document.getElementById('pBot');
  if (!top.innerText.includes('⇅')) bad.push('上方列沒有 ⇅');
  if (top.getBoundingClientRect().height > bot.getBoundingClientRect().height + 2) bad.push(`上方列比下方列高（${top.getBoundingClientRect().height} > ${bot.getBoundingClientRect().height}）`);
  const nm = top.querySelector('.nm'); if (nm && nm.scrollWidth > nm.clientWidth + 1) bad.push('上方列名字區溢出');
  if (/undefined/.test(document.body.innerText)) bad.push('出現 undefined');
  return bad;
};
console.log('== 版面（觀戰者）');
for (const [w, h] of [[360, 640], [375, 667]]) for (const lang of ['zh', 'en', 'ja', 'ko']) {
  const { A, B, C } = await setup('line', { lang, w, h });
  await sleep(3800); await firstMove(A); await sleep(500);
  const bad = await C.evaluate(LAYOUT_JS);
  await C.screenshot({ path: SH + `layout_${lang}_${w}x${h}.png` });
  ok(bad.length === 0, `觀戰 ${lang} ${w}x${h}${bad.length ? ' → ' + bad.join('；') : ''}`);
  for (const p of [A, B, C]) await p.context().close();
}

await b.close();
L.done();
process.exit(L.fail ? 1 : 0);
