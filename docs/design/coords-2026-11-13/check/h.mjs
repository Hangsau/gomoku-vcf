// 座標檢查共用：量測函式、情境（game.html／duel.html）。基準與驗收都用同一份，改動前後可逐項比。
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
export const BASE = process.env.BASE_URL || 'http://127.0.0.1:8795';
export const VPS = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [768, 1024], [1280, 800]];
export const LANGS = ['zh', 'en', 'ja', 'ko'];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launch = () => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

// 頁內量測：棋盤外框、格距、是否捲動、超出像素、按鈕出界、棋盤與其他可見元素重疊
export const MEAS = `(kind) => {
  const f2 = (v) => Math.round(v * 100) / 100;
  const R = (el) => { const b = el.getBoundingClientRect(); return [f2(b.x), f2(b.y), f2(b.width), f2(b.height)]; };
  const cv = document.getElementById('board'), wrap = document.getElementById('boardWrap');
  let pad, cell;
  if (kind === 'duel') { const a = window.__duel.xyOf(0), z = window.__duel.xyOf(224); pad = a[0]; cell = (z[0] - a[0]) / 14; }
  else { pad = (typeof globalThis.eval === 'function') ? (0, eval)('pad') : null; cell = (0, eval)('cell'); }
  const d = document.documentElement, cr = cv.getBoundingClientRect(), out = [], over = [];
  document.querySelectorAll('button, .btn, a.btn, #status, #facts, #pTop, #pBot').forEach((el) => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return;
    if (el.closest('[hidden]')) return;
    if (b.left < -0.5 || b.right > innerWidth + 0.5 || b.top < -0.5 || b.bottom > innerHeight + 0.5) out.push((el.id || el.className || el.tagName) + '');
    if (el.contains(cv) || cv.contains(el)) return;
    const ix = Math.min(b.right, cr.right) - Math.max(b.left, cr.left), iy = Math.min(b.bottom, cr.bottom) - Math.max(b.top, cr.top);
    if (ix > 1 && iy > 1) over.push((el.id || el.className || el.tagName) + '');
  });
  return { cv: R(cv), wrap: R(wrap), pad: f2(pad), cell: f2(cell), sh: d.scrollHeight, ch: d.clientHeight, sw: d.scrollWidth, cw: d.clientWidth, overY: Math.max(0, d.scrollHeight - d.clientHeight), overX: Math.max(0, d.scrollWidth - d.clientWidth), out, over };
}`;
export const meas = (p, kind) => p.evaluate(`(${MEAS})(${JSON.stringify(kind)})`);

export async function mkCtx(b, { lang = 'zh', w = 375, h = 667, coords = null, nick = 'Cat' } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await c.route('**/vcf-game-api.psyhangsau.workers.dev/**', (r) => r.abort());   // 不打正式站的 API（扣掉它不影響棋盤版面）
  await c.addInitScript(([lang, nick, coords]) => {
    const W = window.WebSocket; window.__sent = []; window.__wsN = 0;
    window.WebSocket = function (u, p) {
      const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__wsN++; window.__ws = ws;
      const s0 = ws.send.bind(ws); ws.send = (d) => { window.__sent.push(String(d)); return s0(d); };
      return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    try {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('__seeded', '1');
        localStorage.setItem('vcfgame.lang', lang); localStorage.setItem('vcfgame.duel.tap', '1'); localStorage.setItem('vcfgame.nick', nick);
        if (coords !== null) localStorage.setItem('vcfgame.coords', coords);
      }
    } catch {}
  }, [lang, nick, coords]);
  return c;
}
export async function openPage(c, path) {
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  for (let k = 0; k < 4; k++) {   // http.server 偶爾丟檔：缺 RushSettings 就重載
    await p.goto(BASE + '/' + path); await sleep(700);
    if (await p.evaluate(() => typeof RushSettings !== 'undefined' && typeof RushSkin !== 'undefined')) break;
  }
  if (path.startsWith('duel')) await p.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 }).catch(() => {});
  p.errs.length = 0;
  return p;
}
export const errsOf = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
export const hasCoords = (p) => p.evaluate(() => !!(window.RushSkin && window.RushSkin.setCoords));
export async function setCoords(p, on) {
  await p.evaluate((on) => window.RushSkin.setCoords(on), on); await sleep(250);
}

// ---------- game.html 情境：回傳已進入該畫面的頁面 ----------
export const GAME_SCENES = ['rush', 'prac', 'wx', 'twSolve', 'twRev', 'rvRev'];
async function startPlay(p, which) {
  if (which === 'prac') await p.click('#modeP');
  else { await p.click('#toPick'); await p.click(which === 'wx' ? '#modeW' : '#modeR'); }
  await sleep(200);
  await p.click('#go');
  await p.waitForFunction(() => !document.getElementById('sPlay').hidden && g && g.p, null, { timeout: 20000 }).catch(() => {});
  await sleep(400);
}
export async function gameScene(c, scene) {
  const p = await openPage(c, 'game.html');
  if (scene === 'rush' || scene === 'prac' || scene === 'wx') { await startPlay(p, scene); return p; }
  await startPlay(p, 'prac');
  if (scene === 'twSolve') {
    await p.evaluate(() => { document.body.classList.add('tw'); g.tw = true; document.getElementById('twTools').hidden = false; document.getElementById('twRev').hidden = true; layout(); });
  } else if (scene === 'twRev') {
    await p.evaluate(() => {
      document.body.classList.add('tw'); g.tw = true; g.n = 3; g.rev = { seq: [], cur: 0, mine: null, ans: false, sol: null, ok: false, why: '這手不行', pts: 0 };
      const P = g.p, seq = ['H8', 'G8', 'H9', 'G9', 'H10'].filter((t) => !P.black.includes(t) && !P.white.includes(t)); g.rev.seq = seq; g.rev.cur = seq.length;
      try { twShowRev(true); } catch (e) { window.__simErr = String(e); }
      layout(); draw();
    });
  } else if (scene === 'rvRev') {
    await p.evaluate(() => {
      const P = g.p, seq = ['H8', 'G8', 'H9', 'G9', 'H10'].filter((t) => !P.black.includes(t) && !P.white.includes(t));
      const run = { detail: [{ b: P.black.join(' '), w: P.white.join(' '), a: P.atkWhite ? 'w' : 'b', q: seq.join(' ') }] };
      try { openRv(run, 0); } catch (e) { window.__simErr = String(e); }
      layout(); draw();
    });
  }
  await sleep(300);
  return p;
}
export async function resizeTo(p, w, h) { await p.setViewportSize({ width: w, height: h }); await sleep(450); }

// ---------- duel.html 情境 ----------
export const waitFn = (p, fn, arg, ms = 30000) => p.waitForFunction(fn, arg, { timeout: ms });
export const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
export const dRoom = (p) => p.evaluate(() => { const d = window.__duel, r = d.room; return r ? { id: r.id, state: r.state, seat: d.mySeat() } : null; });
export async function newRoom(A, B, cfg) {
  await wsSend(A, { t: 'create', ...cfg });
  await waitFn(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  const id = (await dRoom(A)).id;
  await wsSend(B, { t: 'view', room: id }); await waitFn(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
  await wsSend(B, { t: 'sit', room: id, seat: 1 });
  await waitFn(A, () => window.__duel.room.state === 'play'); await waitFn(B, () => window.__duel.room.state === 'play');
  A.__seat = (await dRoom(A)).seat; B.__seat = (await dRoom(B)).seat;
  return id;
}
export async function watch(C, id) {
  await C.waitForSelector(`[data-room="${id}"]`, { timeout: 15000 });
  await C.click(`[data-room="${id}"]`);
  await waitFn(C, (id) => window.__duel.room && window.__duel.room.id === id && !document.getElementById('sRoom').hidden, id);
  await sleep(600);
}
export async function liveSol(p, i, armedOk = false) {
  await waitFn(p, ([i, armedOk]) => { const d = window.__duel, r = d.room, s = d.mySeat(), st = r && r.vs && r.vs.p[s]; return st && st.puzzle && st.i === i && (st.s === 'think' || (armedOk && st.s === 'armed')) && Date.now() >= st.at - 50 && d.VR && d.VR.i === i; }, [i, armedOk], 60000);
  return p.evaluate(async () => {
    const d = window.__duel, P = d.VR.p;
    const r = await d.vSolve(P.black.join(' '), P.white.join(' '), P.atkWhite);
    return r && r.result && r.result.solution ? String(r.result.solution).replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean) : [];
  });
}
export const firstMove = async (p, i) => { const sol = await liveSol(p, i); const t = sol[0] || 'H8'; await wsSend(p, { t: 'vprog', n: i, moves: 1, armed: true, seq: [t] }); return t; };
export async function solveReal(p, i) { const sol = await liveSol(p, i, true); await wsSend(p, { t: 'vdone', n: i, seq: sol.length ? sol : ['H8'] }); }
