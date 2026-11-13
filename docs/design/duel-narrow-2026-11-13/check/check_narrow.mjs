// 問題 1 檢查：房名單行、玩法名＋房號完整、「自動」鈕在狀態行（可按、≥44px、狀態行與棋盤位置不變）；全程無 pageerror；負向測試一項。
// 用法：node check_narrow.mjs（BASE_URL 預設走現行 8841）
process.env.BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8841';
const H = await import('../../coords-2026-11-13/check/h.mjs');
const { sleep } = H;
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
const vps = [[320, 568], [360, 640], [375, 667]];
const SHOTS = new URL('./shots/', import.meta.url).pathname.replace(/^\//, '');
const B0 = await H.launch();

const M = () => {
  const g = (id) => document.getElementById(id), R = (el) => { const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100); };
  const t = g('rTitle'), sub = g('rSub'), st = g('status'), btn = g('bWatchAuto'), cs = getComputedStyle(t), fs = parseFloat(cs.fontSize);
  const bh = btn && !btn.hidden && btn.offsetParent ? R(btn) : null;
  let hit = null;
  if (bh) {   // 以按鈕中心為中心、44×44 的方框：中心與四角（內縮 1px）取到的元素都要是這顆鈕
    const cx = bh[0] + bh[2] / 2, cy = bh[1] + bh[3] / 2, pts = [[cx, cy], [cx - 21, cy - 21], [cx + 21, cy - 21], [cx - 21, cy + 21], [cx + 21, cy + 21]];
    hit = pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return e === btn || (e && btn.contains(e)); });
  }
  return {
    title: t.textContent, titleH: Math.round(t.getBoundingClientRect().height), titleFs: fs, titleTrunc: t.scrollWidth > t.clientWidth + 1, titleOne: t.getBoundingClientRect().height <= fs * 1.7,
    subH: Math.round(sub.getBoundingClientRect().height), subOne: sub.getBoundingClientRect().height <= 24,
    statusH: Math.round(st.getBoundingClientRect().height * 100) / 100, statusTxt: st.textContent, statusOne: st.getBoundingClientRect().height <= 31,
    cv: R(g('board')), btn: bh, hit, badge: document.querySelector('#status .vauto')?.textContent || null,
    rheadKids: [...document.querySelectorAll('.rhead > *')].filter((e) => !e.hidden).map((e) => e.id || e.className).join(','),
    sh: document.documentElement.scrollHeight, ih: innerHeight,
  };
};
const mm = (p) => p.evaluate(`(${M})()`);

for (const lang of H.LANGS) {
  console.log('==== 語言', lang);
  const ctxs = await Promise.all(['Alice', 'Bob', 'Cara'].map((n) => H.mkCtx(B0, { lang, nick: n })));
  const A = await H.openPage(ctxs[0], 'duel.html'), B = await H.openPage(ctxs[1], 'duel.html'), C = await H.openPage(ctxs[2], 'duel.html');
  const all = [A, B, C];
  try {
    // 一般對局（五子棋）
    await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
    await sleep(500);
    for (const [w, h] of vps) {
      await H.resizeTo(A, w, h); const m = await mm(A);
      ok(m.titleOne && !m.titleTrunc && m.subOne, `${lang} ${w}×${h} 五子棋對局：房名單行且完整「${m.title}」(${m.titleFs}px)，副標單行`);
      if (w === 320 && (lang === 'zh' || lang === 'ja')) await A.screenshot({ path: `${SHOTS}gomoku_play_${lang}_${w}x${h}.png` });
    }
    await H.wsSend(A, { t: 'leave' }); await H.wsSend(B, { t: 'leave' }); await sleep(600);
    for (const vmode of ['line', 'eight']) {
      const id = await H.newRoom(A, B, { t: 'create', kind: 'vcf', vmode, rank: 1, think: 300, target: 3, priv: false, color: 'b' });
      if (!(await C.evaluate(() => !document.getElementById('sLobby').hidden))) { await C.click('#rBack').catch(() => {}); await sleep(500); }
      await H.watch(C, id);
      await H.waitFn(C, () => { const d = window.__duel, st = d.room.vs.p[0]; return st && st.puzzle && Date.now() >= st.at && st.s === 'think'; });
      await sleep(400);
      const SB = B.__seat;
      if (vmode === 'line') { await H.firstMove(B, 0); await H.waitFn(C, (s) => window.__duel.watchFocus === s, SB, 15000); await sleep(500); }
      for (const [w, h] of vps) {
        await H.resizeTo(C, w, h);
        const a = await mm(C);   // 自動
        ok(a.titleOne && !a.titleTrunc && a.subOne && a.statusOne, `${lang} ${w}×${h} ${vmode} 觀戰自動：房名單行完整「${a.title}」(${a.titleFs}px)、副標單行、狀態行單行(${a.statusH}px)`);
        ok(a.btn === null && !!a.badge, `${lang} ${w}×${h} ${vmode} 觀戰自動：狀態行有小標「${a.badge}」、沒有可按的「自動」鈕`);
        ok(!/bWatchAuto/.test(a.rheadKids) && a.rheadKids.split(',').length === 5, `${lang} ${w}×${h} ${vmode} 頂列元素 ${a.rheadKids.split(',').length} 項（${a.rheadKids}）＝返回/標題/邀請/喇叭/齒輪`);
        // 手動：點另一列
        await C.click(SB === 0 ? '#pBot' : '#pTop').catch(() => {}); await sleep(vmode === 'eight' ? 750 : 450);
        const mnu = await mm(C);
        ok(mnu.titleOne && !mnu.titleTrunc && mnu.subOne && mnu.statusOne, `${lang} ${w}×${h} ${vmode} 觀戰手動：房名單行完整「${mnu.title}」、副標單行、狀態行單行(${mnu.statusH}px)`);
        ok(!!mnu.btn && mnu.btn[0] >= 0 && mnu.btn[0] + mnu.btn[2] <= w && mnu.btn[1] + mnu.btn[3] <= h && mnu.hit === true, `${lang} ${w}×${h} ${vmode} 手動：狀態行有「自動」鈕 ${JSON.stringify(mnu.btn)}，以它為中心 44×44 範圍內都點得到它(hit=${mnu.hit})`);
        ok(mnu.statusH === a.statusH && JSON.stringify(mnu.cv) === JSON.stringify(a.cv) && mnu.sh === a.sh, `${lang} ${w}×${h} ${vmode} 自動↔手動：狀態行高度 ${a.statusH}→${mnu.statusH}、棋盤 ${JSON.stringify(a.cv)}→${JSON.stringify(mnu.cv)}、頁高 ${a.sh}→${mnu.sh}`);
        if (vmode === 'line' && (((lang === 'zh' || lang === 'ja') && (w === 320 || w === 360)) || (lang === 'en' && w === 320))) await C.screenshot({ path: `${SHOTS}watch_manual_${lang}_${w}x${h}.png` });
        // 按下去回自動（真的用座標點擊）
        const bx = mnu.btn ? mnu.btn[0] + mnu.btn[2] / 2 : 0, by = mnu.btn ? mnu.btn[1] + mnu.btn[3] / 2 : 0;
        await C.mouse.click(bx, by); await sleep(450);
        const back = await mm(C), wa = await C.evaluate(() => window.__duel.watchAuto);
        ok(wa === true && back.btn === null && !!back.badge && back.statusH === a.statusH && JSON.stringify(back.cv) === JSON.stringify(a.cv), `${lang} ${w}×${h} ${vmode} 按「自動」：回到自動(${wa})、鈕消失、小標「${back.badge}」、狀態行與棋盤位置不變`);
      }
      await H.wsSend(A, { t: 'leave' }); await H.wsSend(B, { t: 'leave' }); await sleep(600);
      await C.click('#rBack').catch(() => {}); await sleep(500);
    }
    for (const p of all) ok(H.errsOf(p).length === 0, `${lang} 全程沒有 pageerror${H.errsOf(p).length ? '：' + H.errsOf(p).join(' | ') : ''}`);
  } catch (e) { fail++; console.log('  FAIL 例外', lang, String(e).slice(0, 300)); }
  await Promise.all(ctxs.map((c) => c.close()));
}

// 負向測試：把頂列還原成舊樣式（可換行、48px 鈕），檢查項要能抓到
{
  console.log('==== 負向測試');
  const c = await H.mkCtx(B0, { lang: 'ja', nick: 'Neg' }), c2 = await H.mkCtx(B0, { lang: 'ja', nick: 'Neg2' });
  const p = await H.openPage(c, 'duel.html'), q = await H.openPage(c2, 'duel.html');
  await H.newRoom(p, q, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
  await H.resizeTo(p, 320, 568);
  await p.addStyleTag({ content: '.rhead .ttl b { white-space: normal !important; overflow: visible !important; font-size: 18px !important; } .rhead { gap: 8px !important; padding-left: 8px !important; padding-right: 8px !important; } .rhead .icob { width: 48px !important; }' });
  await p.evaluate(() => { const t = document.getElementById('rTitle'); t.textContent = '八仙渡 8888'; t.style.fontSize = ''; });   // 固定用最寬的標題，結果不看房號數字寬窄（那正是舊版不穩的原因）
  await sleep(500);
  const m = await mm(p);
  ok(!m.titleOne, `負向：還原成舊樣式後房名「${m.title}」高 ${m.titleH}px（字 ${m.titleFs}px）→ 檢查抓得到換行（titleOne=${m.titleOne}）`);
  await c.close(); await c2.close();
}
console.log(`PASS ${pass}／FAIL ${fail}`);
await B0.close();
process.exit(fail ? 1 : 0);
