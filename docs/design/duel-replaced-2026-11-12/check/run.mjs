// 兩儀殿「被取代不重連」檢查：node run.mjs。需要 http.server 8793、wrangler dev 8789。
import * as L from '../../duel-modes-2026-11-12/check/lib.mjs';
const { ok, sleep } = L;
const SH = 'shots/';
const b = await L.launch();
const errsOf = (...ps) => ps.flatMap((p) => p.errs);
const allErrs = [];

async function second(p) {   // 同一 context 第二個分頁（共用 localStorage＝同一個 ID）
  const q = await p.context().newPage();
  q.errs = []; q.wsN = 0;
  q.on('pageerror', (e) => q.errs.push(e.message)); q.on('console', (m) => { if (m.type() === 'error') q.errs.push(m.text()); });
  q.on('websocket', () => q.wsN++);
  await q.goto(L.BASE + '/duel.html'); await sleep(1200);
  return q;
}
const replShown = (p) => p.evaluate(() => !document.getElementById('mReplaced').hidden);
const netTxt = (p) => p.evaluate(() => document.getElementById('net').querySelector('span').textContent);
const watchRooms = (p) => p.evaluate(() => { window.__rc = 0; let last = window.__duel.room; setInterval(() => { const r = window.__duel.room; if (r !== last) { last = r; window.__rc++; } }, 50); });
const turnOf = async (ps) => { for (let t = 0; t < 30; t++) { for (const p of ps) if ((await p.textContent('#status')).includes('輪到你')) return p; await sleep(150); } return null; };
const nMoves = (p) => p.evaluate(() => { const r = window.__duel.room; return r && r.moves != null ? r.moves : JSON.stringify(r && r.match ? r.match.log || r.match : null).length; });

console.log('== T1 兩個分頁不互踢');
const A1 = await L.mk(b, { nick: 'Alice' }), B = await L.mk(b, { nick: 'Bob' });
A1.wsN = 0; A1.on('websocket', () => A1.wsN++);
await L.create(A1, { kind: 'gomoku' });
const id = await L.roomId(A1); await L.join(B, id); await sleep(500);
await watchRooms(B);
const A2 = await second(A1);
await sleep(1500);
ok(await replShown(A1), 'A1 出現 #mReplaced');
ok((await netTxt(A1)) === '已在別的畫面開啟', 'A1 連線燈 = netRepl：' + await netTxt(A1));
await A1.screenshot({ path: SH + 't1_A1_replaced.png' });
const a1n = A1.wsN, a2n = A2.wsN, rc0 = await B.evaluate(() => window.__rc);
await sleep(10000);
ok(A1.wsN === a1n, `10 秒內 A1 連線次數不增加（${a1n}→${A1.wsN}）`);
ok(A2.wsN === a2n, `10 秒內 A2 連線次數不增加（${a2n}→${A2.wsN}）`);
const rc1 = await B.evaluate(() => window.__rc);
ok(rc1 - rc0 <= 1, `Bob 10 秒內 room 訊息不重複（${rc0}→${rc1}）`);

console.log('== T2 A2 回到座位並能下子');
ok(await A2.evaluate(() => window.__duel.mySeat()) >= 0, 'A2 在原座位 seat=' + await A2.evaluate(() => window.__duel.mySeat()));
ok(!(await replShown(A2)), 'A2 沒有對話框');
let first = await turnOf([A2, B]);
if (first === B) { await L.clickT(B, 'H8'); await sleep(500); first = await turnOf([A2, B]); }
ok(first === A2, '輪到 A2（Alice）');
const bMovesBefore = await nMoves(B);
await L.clickT(A2, 'K10'); await sleep(700);
const bMovesAfter = await nMoves(B);
ok(bMovesAfter !== bMovesBefore, `Bob 看得到 Alice 下的子（${bMovesBefore}→${bMovesAfter}）`);

console.log('== T3 A1 按「改用這裡」');
await A1.click('#replUse'); await sleep(1500);
ok(!(await replShown(A1)), 'A1 對話框消失');
ok(await A1.evaluate(() => window.__duel.mySeat()) >= 0, 'A1 回到房間座位');
ok(await replShown(A2), 'A2 出現對話框');
const b1 = A1.wsN, b2 = A2.wsN;
await sleep(10000);
ok(A1.wsN === b1 && A2.wsN === b2, `之後 10 秒連線次數不增加（A1 ${b1}→${A1.wsN}、A2 ${b2}→${A2.wsN}）`);
let t = await turnOf([A1, B]);
if (t === B) { await L.clickT(B, 'L10'); await sleep(500); t = await turnOf([A1, B]); }
const m0 = await nMoves(B);
if (t === A1) { await L.clickT(A1, 'M10'); await sleep(700); }
ok(t === A1 && (await nMoves(B)) !== m0, 'A1 能下子');

console.log('== T4 切回前景自動接手');
// A2 目前被取代；模擬它切回前景
await A2.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); });
// 先確認被取代時 ws 是 CLOSED（visibilitychange 才有作用）
await A2.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(1500);
ok(!(await replShown(A2)), 'A2 對話框關掉');
ok(await A2.evaluate(() => window.__duel.mySeat()) >= 0, 'A2 接手回到座位');
ok(await replShown(A1), 'A1 被取代、出現對話框（自動接手會讓對方被取代）');

console.log('== T5 沒連線時點棋盤');
// 讓 A1 先接手（拿到最新狀態），確保是 Alice 的回合，再讓 A2 接手把 A1 取代；A1 手上的舊狀態就是「輪到我」
await A1.click('#replUse'); await sleep(1200);
{ const tt = await turnOf([A1, B]); if (tt === B) { await L.clickT(B, 'N10'); await sleep(600); } }
ok((await A1.textContent('#status')).includes('輪到你'), 'A1 狀態是輪到你');
await A2.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(1500);
ok(await replShown(A1), 'A1 再度被取代');
await A1.evaluate(() => { document.getElementById('mReplaced').hidden = true; });
await A1.evaluate(() => { document.getElementById('flash').hidden = true; });
const cnt = async () => await A2.evaluate(() => JSON.stringify(window.__duel.room && window.__duel.room.match ? window.__duel.room.match : window.__duel.room.moves));
const before = await cnt();
await L.clickT(A1, 'D4'); await sleep(300);
const fl = await A1.evaluate(() => { const f = document.getElementById('flash'); return f.hidden ? '' : f.textContent; });
ok(/連線中，請稍候/.test(fl), 'A1 顯示 netWait flash：' + fl);
await sleep(500);
ok((await cnt()) === before, '棋局狀態沒變');
await A1.screenshot({ path: SH + 't5_netwait.png' });

console.log('== T6 版面（對話框開著）');
for (const [w, h] of [[375, 667], [360, 640]]) for (const lang of ['zh', 'en', 'ja', 'ko']) {
  const X = await L.mk(b, { lang, w, h, nick: 'Zed' });
  const Y = await second(X); await sleep(1200);
  const bad = await X.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = [], de = document.documentElement;
    if (de.scrollHeight > H + 1 || de.scrollWidth > W + 1) bad.push(`文件可捲動 ${de.scrollWidth}x${de.scrollHeight}`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[hidden]') || el.closest('.list') || (el.closest('svg') && el.tagName !== 'svg')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) bad.push(`${el.tagName}#${el.id} 超出`);
    }
    const box = document.querySelector('.modal:not([hidden]) .box');
    if (!box) bad.push('沒有對話框'); else if (box.scrollHeight > box.clientHeight + 1) bad.push('對話框可捲動');
    const txt = document.body.innerText;
    if (/undefined/.test(txt)) bad.push('undefined');
    if (/\b(replT|replSub|replUse|netRepl|netWait)\b/.test(txt)) bad.push('沒翻的 key');
    return bad;
  });
  const title = await X.textContent('#replT');
  await X.screenshot({ path: `${SH}t6_${lang}_${w}x${h}.png` });
  ok(bad.length === 0, `${lang} ${w}x${h} 「${title}」${bad.length ? ' → ' + bad.join('；') : ''}`);
  allErrs.push(...errsOf(X, Y));
  await X.context().close();
}

allErrs.push(...errsOf(A1, A2, B));
ok(allErrs.length === 0, '全程沒有 JS 錯誤 ' + JSON.stringify(allErrs));
await b.close();
L.done();
