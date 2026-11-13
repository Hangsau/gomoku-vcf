// 問題 2 根因的直接驗證：同一個畫面、同一個視窗，只換房號數字（0000～9999 不同寬度），觸發重算版面，看棋盤外框是不是只有一種。
// 用法：BASE_URL=... node digits.mjs [lang=ja]
process.env.BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8841';
const H = await import('../../coords-2026-11-13/check/h.mjs');
const lang = process.argv[2] || 'ja';
const NAME = { zh: '房間', en: 'Room', ja: '部屋', ko: '방' }[lang];
const b = await H.launch();
const cs = await Promise.all(['A', 'B'].map((n) => H.mkCtx(b, { lang, nick: n, w: 320, h: 568 })));
const A = await H.openPage(cs[0], 'duel.html'), B = await H.openPage(cs[1], 'duel.html');
await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
await H.sleep(900);
const seen = {};
for (const n of ['0000', '1111', '1258', '2605', '3745', '4731', '5555', '6732', '7777', '8888', '9999', '1079']) {
  const r = await A.evaluate(async (t) => {
    const T = document.getElementById('rTitle'); T.style.fontSize = ''; T.textContent = t; window.dispatchEvent(new Event('resize'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = document.getElementById('board').getBoundingClientRect();
    return JSON.stringify({ cv: [c.x, c.y, c.width, c.height].map(Math.round), tight: document.getElementById('sRoom').classList.contains('tight'), titleH: Math.round(T.getBoundingClientRect().height) });
  }, NAME + ' ' + n);
  seen[r] = (seen[r] || []).concat(n);
}
for (const [k, v] of Object.entries(seen)) console.log(v.join(','), '→', k);
console.log(`${lang} 320×568：房號 12 種 → ${Object.keys(seen).length} 種版面結果`);
await b.close();
