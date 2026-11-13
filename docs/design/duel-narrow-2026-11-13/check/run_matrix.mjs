// 版面矩陣：四語 × 320×568／360×640／375×667／390×844 × 兩儀殿各畫面。用法：BASE_URL=http://127.0.0.1:8842 node run_matrix.mjs base.json（舊版）／8841（新版）
const out0 = process.argv[2] || 'matrix.json';
const H = await import('../../coords-2026-11-13/check/h.mjs');
const S = await import('../../coords-2026-11-13/check/scenes.mjs');
import { writeFileSync } from 'node:fs';
const vps = [[320, 568], [360, 640], [375, 667], [390, 844]];
const b = await H.launch();
const out = {};
let entry = null;
try { entry = await S.makeReplayEntry(); } catch (e) { console.log('replay entry 失敗', String(e).slice(0, 100)); }
// 大廳
for (const lang of H.LANGS) {
  const c = await H.mkCtx(b, { lang });
  const p = await H.openPage(c, 'duel.html');
  for (const [w, h] of vps) { await H.resizeTo(p, w, h); out[`duel|lobby|${lang}|${w}x${h}`] = await p.evaluate(() => { const d = document.documentElement; return { overY: Math.max(0, d.scrollHeight - d.clientHeight), overX: Math.max(0, d.scrollWidth - d.clientWidth) }; }); }
  await c.close();
}
await S.duelMatrix(b, ['off'], out, { vps, replayEntry: entry });
await b.close();
writeFileSync(out0, JSON.stringify(out, null, 1));
console.log('寫入', out0, Object.keys(out).length, '項');
