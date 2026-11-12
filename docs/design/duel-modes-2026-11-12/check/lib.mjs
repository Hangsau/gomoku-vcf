import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
export const BASE = 'http://127.0.0.1:8793', WS = 'ws://127.0.0.1:8789/ws';
export let pass = 0, fail = 0;
export const ok = (c, msg) => { if (c) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
export const done = () => { console.log(`PASS ${pass}／FAIL ${fail}`); };
export const launch = () => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function mk(b, { lang = 'zh', w = 375, h = 667, nick } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript(([lang, nick]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) { return new W(String(u).replace(':8787/', ':8789/'), p); };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    if (!localStorage.getItem('vcfgame.lang')) localStorage.setItem('vcfgame.lang', lang);
    localStorage.setItem('vcfgame.duel.tap', '1');
    if (nick) localStorage.setItem('vcfgame.nick', nick);
  }, [lang, nick]);
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(BASE + '/duel.html');
  await p.waitForFunction(() => document.getElementById('netTxt') ? true : true);
  await sleep(1200);
  return p;
}
// 開房（kind vcf／gomoku）
export async function create(p, o) {
  await p.click('#openCreate'); await sleep(200);
  if (o.kind === 'gomoku') {
    await p.click('#cKind button[data-v="gomoku"]'); await p.click('#cTime button[data-v="none"]'); await p.click('#cRule button[data-v="free"]');
  } else {
    await p.click('#cKind button[data-v="vcf"]');
    await p.click(`#cVmode button[data-v="${o.vmode}"]`);
    await p.click(`#cTarget button[data-v="${o.target || 3}"]`);
    await p.click(`#cThink button[data-v="${o.think || 60}"]`);
  }
  if (o.shot) await p.screenshot({ path: o.shot });
  await p.click('#doCreate'); await sleep(600);
}
export async function join(p, roomId) {
  await p.click(`[data-room="${roomId}"]`); await sleep(400);
  await p.click('[data-sit]'); await sleep(500);
}
export const roomOf = (p) => p.evaluate(() => window.__duel.room);
export async function roomId(p) { return (await roomOf(p)).id; }
// 棋盤格座標（標記如 H8）→ 頁面座標點擊
export async function clickT(p, t) {
  const pt = await p.evaluate((t) => { const d = window.__duel; const [x, y] = d.xyOf(d.tToP(t)); const r = d.cv.getBoundingClientRect(); return [r.left + x, r.top + y]; }, t);
  await p.mouse.click(pt[0], pt[1]);
}
export async function solveCur(p) {   // 目前這題的正解（引擎算）：回傳手順陣列
  return p.evaluate(async () => {
    const v = window.__duel.VR; const q = v.p;
    const r = await window.__duel.vSolve(q.black.join(' '), q.white.join(' '), q.atkWhite);
    return { raw: r.result && r.result.solution, i: v.i, id: q.id };
  });
}
export const parseSol = (raw) => String(raw).replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
export async function waitLive(p, timeout = 15000) {   // 倒數結束、這題可以下
  await p.waitForFunction(() => { const r = window.__duel.room, v = window.__duel.VR; if (!r || !v || r.state !== 'play') return false; const d = window.__duel, st = r.vs.p[d.mySeat() >= 0 ? d.mySeat() : 0]; return d.vIsLive(st) && !v.hold && !v.out && !v.done; }, null, { timeout });
}
export const vs = (p) => p.evaluate(() => { const r = window.__duel.room; return r && r.vs ? JSON.parse(JSON.stringify({ score: r.vs.score, phase: r.vs.phase, p: r.vs.p.map(x => ({ i: x.i, s: x.s, why: x.why, id: x.puzzle && x.puzzle[5] })), result: r.vs.result, state: r.state })) : null; });
