// 問題 2 探針：ja 320x568 五子棋對局，重複開房量版面，印出每列高度與換行狀況
import * as H from '../../coords-2026-11-13/check/h.mjs';
const port = process.argv[2] || '8841', N = +(process.argv[3] || 12), lang = process.argv[4] || 'ja';
process.env.BASE_URL = `http://127.0.0.1:${port}`;
const b = await H.launch();
const seen = {};
for (let i = 0; i < N; i++) {
  const cA = await H.mkCtx(b, { lang, nick: 'Alice', w: 320, h: 568 }), cB = await H.mkCtx(b, { lang, nick: 'Bob', w: 320, h: 568 });
  // mkCtx 讀 H.BASE（模組載入時定下），所以直接用完整網址
  const A = await cA.newPage(), B = await cB.newPage();
  for (const p of [A, B]) { await p.goto(`http://127.0.0.1:${port}/duel.html`); await p.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 }); }
  await H.sleep(800);
  await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
  await H.sleep(900);
  const info = await A.evaluate(() => {
    const g = (id) => document.getElementById(id), h = (el) => Math.round(el.getBoundingClientRect().height);
    return { cv: [...(() => { const r = g('board').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })()], tight: g('sRoom').classList.contains('tight'), rhead: h(document.querySelector('.rhead')), title: h(g('rTitle')), sub: h(g('rSub')), pTop: h(g('pTop')), status: h(g('status')), pBot: h(g('pBot')), facts: h(g('facts')), rActs: h(g('rActs')), factsTxt: g('facts').textContent, ttl: document.querySelector('.rhead .ttl').getBoundingClientRect().width, titleTxt: g('rTitle').textContent, subTxt: g('rSub').textContent, btns: [...document.querySelectorAll('.rhead > *')].filter(e=>!e.hidden).map(e=>Math.round(e.getBoundingClientRect().width)).join(','), scroll: document.documentElement.scrollHeight - innerHeight };
  });
  const key = JSON.stringify(info.cv); seen[key] = (seen[key] || 0) + 1;
  console.log(i, JSON.stringify(info));
  await cA.close(); await cB.close();
}
console.log('不同結果數', Object.keys(seen).length, JSON.stringify(seen));
await b.close();
