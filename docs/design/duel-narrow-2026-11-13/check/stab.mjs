// 問題 2：同一畫面重複載入，版面結果要完全相同。用法：BASE_URL=... node stab.mjs [N=10] [langs=zh,en,ja,ko] [vps=320x568,360x640]
// 每個畫面每次「重新載入頁面（或開全新頁面）」→ 等進入該畫面 → 靜置 → 量版面簽名（棋盤外框、各列高度、tight、房名字級、頁高）；不同簽名的種類數必須是 1。
process.env.BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8841';
const H = await import('../../coords-2026-11-13/check/h.mjs');
const S = await import('../../coords-2026-11-13/check/scenes.mjs');
const { sleep } = H;
const N = +(process.argv[2] || 10);
const LANGS = (process.argv[3] || 'zh,en,ja,ko').split(',');
const VPS = (process.argv[4] || '320x568,360x640').split(',').map((s) => s.split('x').map(Number));
let bad = 0, total = 0;

const SIG = () => {
  const g = (id) => document.getElementById(id), h = (el) => Math.round(el.getBoundingClientRect().height * 10) / 10;
  const r = g('board').getBoundingClientRect(), d = document.documentElement;
  const room = g('sRoom'), vis = !room.hidden;
  const kids = vis ? [...room.children].filter((e) => !e.hidden && e.offsetParent).map((e) => (e.id || e.className).toString().split(' ')[0].slice(0, 8) + ':' + h(e)).join(' ') : 'lobby';
  return JSON.stringify({ cv: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10), tight: room.classList.contains('tight'), kids, titleFs: getComputedStyle(g('rTitle')).fontSize, sh: d.scrollHeight, ih: innerHeight });
};
async function loop(label, n, step) {
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    let sig;
    try { sig = await step(i); } catch (e) { sig = 'ERR ' + String(e).slice(0, 80); }
    seen.set(sig, (seen.get(sig) || 0) + 1);
  }
  total++;
  const ok = seen.size === 1 && ![...seen.keys()][0].startsWith('ERR');
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}：${n} 次載入，${seen.size} 種結果` + (ok ? '' : '\n    ' + [...seen].map(([k, v]) => v + '× ' + k).join('\n    ')));
}
const settle = async (p) => { await sleep(900); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const reloadTo = async (p, cond, arg) => { await p.reload(); await p.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 }); if (cond) await p.waitForFunction(cond, arg, { timeout: 10000 }); await settle(p); return p.evaluate(`(${SIG})()`); };
const inRoom = (id) => window.__duel.room && window.__duel.room.id === id && !document.getElementById('sRoom').hidden;

const b = await H.launch();
for (const lang of LANGS) for (const [w, h] of VPS) {
  const tag = `${lang} ${w}×${h}`;
  const mk = async (nick) => { const c = await H.mkCtx(b, { lang, nick, w, h }); return { c, p: await H.openPage(c, 'duel.html') }; };
  const [ma, mb, mc] = [await mk('Alice'), await mk('Bob'), await mk('Cara')];
  const [A, B, C] = [ma.p, mb.p, mc.p];
  try {
    await loop(`${tag} 大廳`, N, (i) => reloadTo(C, null));
    // 五子棋
    const g1 = await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
    await H.watch(C, g1); await sleep(400);
    await loop(`${tag} 五子棋對局`, N, (i) => reloadTo(A, inRoom, g1));
    const watchBack = async (id) => { await C.reload(); await C.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 }); await sleep(600); const here = await C.evaluate((id) => !!(window.__duel && window.__duel.room && window.__duel.room.id === id && !document.getElementById('sRoom').hidden), id).catch(() => false); if (!here) await H.watch(C, id); await sleep(500); };
    await loop(`${tag} 五子棋觀戰`, N, async () => { await watchBack(g1); await settle(C); return C.evaluate(`(${SIG})()`); });
    await H.wsSend(A, { t: 'leave' }); await H.wsSend(B, { t: 'leave' }); await sleep(600);
    await C.click('#rBack').catch(() => {}); await sleep(500);
    // VCF
    const v1 = await H.newRoom(A, B, { t: 'create', kind: 'vcf', vmode: 'line', rank: 1, think: 300, target: 3, priv: false, color: 'b' });
    await C.reload(); await C.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 }); await sleep(600);
    await H.watch(C, v1);
    await H.waitFn(C, () => { const d = window.__duel, st = d.room.vs.p[0]; return st && st.puzzle && Date.now() >= st.at && st.s === 'think'; });
    await loop(`${tag} VCF 對局`, N, (i) => reloadTo(A, inRoom, v1));
    await H.firstMove(B, 0); const SB = B.__seat;
    const watchTo = () => watchBack(v1);
    await loop(`${tag} VCF 觀戰（自動）`, N, async () => { await watchTo(); await settle(C); return C.evaluate(`(${SIG})()`); });
    await loop(`${tag} VCF 觀戰（手動，有「自動」鈕）`, N, async () => { await watchTo(); await C.click(SB === 0 ? '#pBot' : '#pTop').catch(() => {}); await settle(C); return C.evaluate(`(${SIG})()`); });
    for (let i = 0; i < 3; i++) await H.solveReal(A, i);
    await H.waitFn(A, () => window.__duel.room.state === 'over', null, 40000); await sleep(900);
    await loop(`${tag} VCF 賽後回看（逐題）`, N, async () => {
      await A.reload(); await A.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 });
      await A.waitForFunction(() => window.__duel.room && window.__duel.room.state === 'over', null, { timeout: 10000 }); await sleep(600);
      const hasLook = await A.evaluate(() => !!document.getElementById('bLook') && !document.getElementById('mEnd').hidden);
      if (hasLook) { await A.click('#bLook'); await sleep(500); }
      await settle(A); return (hasLook ? '' : '[沒有 bLook] ') + (await A.evaluate(`(${SIG})()`));
    });
    // 今日棋局回看（#replay=）
    const entry = globalThis.__entry || (globalThis.__entry = await S.makeReplayEntry());
    const D = await H.mkCtx(b, { lang, w, h }); const P = await H.openPage(D, 'duel.html');
    await P.evaluate((s) => localStorage.setItem('vcfgame.today', s), JSON.stringify([entry]));
    await loop(`${tag} 今日棋局回看（#replay=）`, N, async () => { await P.goto(H.BASE + '/duel.html?again=1'); await P.goto(H.BASE + '/duel.html#replay=' + entry.id); await sleep(1300); await settle(P); return P.evaluate(`(${SIG})()`); });
    await D.close();
    for (const p of [A, B, C]) if (H.errsOf(p).length) console.log('  pageerror', tag, H.errsOf(p).slice(0, 3));
  } catch (e) { bad++; total++; console.log(`FAIL ${tag} 流程例外：`, String(e).slice(0, 200)); }
  await Promise.all([ma, mb, mc].map((m) => m.c.close()));
}
await b.close();
console.log(`穩定性：${total - bad}／${total} 項畫面 × 尺寸 × 語言完全穩定（N=${N}）`);
process.exit(bad ? 1 : 0);
