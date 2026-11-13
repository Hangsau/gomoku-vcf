// 喇叭小框檢查：node check_soundpop.mjs（前景執行；NEG=1 是負向測試，應該 FAIL）。
// 自己起停：http.server 8797（頁面）、wrangler dev 8789（兩儀殿，persist 放 TEMP）；只用 PID 關自己啟動的行程。
// 外連請求一律攔掉（只放 127.0.0.1；留言 API 用 route 假回應）。截圖只存本資料夾的 shots/。
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
const { ok, sleep } = L;
const HERE = dirname(fileURLToPath(import.meta.url)), SH = HERE + '/shots/';
const VCF = 'C:/claudehome/projects/VCF', BASE = 'http://127.0.0.1:8797';
const PERSIST = tmpdir() + '/wstate-soundpop-' + Date.now();
const NEG = process.env.NEG === '1';
mkdirSync(SH, { recursive: true });
let srv = null, b = null;
const killAll = () => { if (srv) { try { execSync(`taskkill /PID ${srv} /T /F`, { stdio: 'ignore' }); } catch {} srv = null; } L.stopWr(); };
const errsOf = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
const errsAll = [];
const LANGS = ['zh', 'en', 'ja', 'ko'], SIZES = [[375, 667], [360, 640]];

async function ctxOf({ lang = 'zh', w = 375, h = 667, nick = 'Cat', sound = null, touch = false } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: touch });
  await c.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (u.hostname === 'vcf-game-api.psyhangsau.workers.dev') {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      c.__api = c.__api || []; c.__api.push({ url: u.pathname, body: r.request().postData() });
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"ok":true}' });
    }
    return r.abort();
  });
  await c.addInitScript(([lang, nick, sound]) => {
    const W = window.WebSocket; window.__wsCount = 0;
    window.WebSocket = function (u, p) {
      window.__wsCount++;
      const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__ws = ws;
      return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    try {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('__seeded', '1');
        localStorage.setItem('vcfgame.lang', lang); localStorage.setItem('vcfgame.duel.tap', '1'); localStorage.setItem('vcfgame.nick', nick);
        if (sound !== null) localStorage.setItem('vcfgame.sound', sound);
      }
    } catch {}
    // 記下所有對 vcfgame.sound 的寫入（驗證沒有任何操作寫 '0'）
    window.__sndWrites = []; const si = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'vcfgame.sound') window.__sndWrites.push(String(v)); return si.call(this, k, v); };
  }, [lang, nick, sound]);
  return c;
}
async function open(c, path) {
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(BASE + '/' + path); await sleep(900);
  return p;
}
const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
const waitFor = (p, fn, arg, ms = 20000) => p.waitForFunction(fn, arg, { timeout: ms });
async function sitB(A, B, id) {   // 偶爾 view 剛到、座位還沒開，重送最多 4 次
  for (let i = 0; i < 4; i++) {
    const free = await A.evaluate(() => (window.__duel.room.seats || []).findIndex((x) => !x));   // 創房者的座位會隨機（黑先），坐另一個空位
    await wsSend(B, { t: 'sit', room: id, seat: free < 0 ? 1 : free });
    try { await waitFor(A, () => window.__duel.room.state === 'play', null, 6000); await waitFor(B, () => window.__duel.room.state === 'play', null, 6000); return; } catch { await sleep(500); }
  }
  throw new Error('入座失敗：' + JSON.stringify(await A.evaluate(() => window.__duel.room && { s: window.__duel.room.state, seats: window.__duel.room.seats })));
}
const connected = (p) => waitFor(p, () => window.__ws && window.__ws.readyState === 1);
const noScroll = (p) => p.evaluate(() => {
  const d = document.documentElement, ih = innerHeight, iw = innerWidth;
  const ov = document.getElementById('rsOverlay'), ovPage = ov && !ov.hidden ? ov.querySelector('.rsPage') : null;
  const body = [...document.querySelectorAll('.setBody')].find((e) => e.offsetParent !== null || (ov && ov.contains(e) && !ov.hidden));
  let lastBottom = body ? Math.max(...[...body.children].map((x) => x.getBoundingClientRect().bottom)) : 0;
  return { sh: d.scrollHeight, ih, sw: d.scrollWidth, iw, pageOver: ovPage ? ovPage.scrollHeight - ovPage.clientHeight : 0, lastBottom: Math.round(lastBottom), hasBody: !!body };
});
const okNoScroll = (r, label) => ok(r.sh <= r.ih + 1 && r.sw <= r.iw + 1 && r.pageOver <= 1 && (!r.hasBody || r.lastBottom <= r.ih + 1), `${label} 不捲動（doc ${r.sh}/${r.ih}、寬 ${r.sw}/${r.iw}、頁內溢出 ${r.pageOver}、最後一項底 ${r.lastBottom}）`);
const LANGS_ARIA = { zh: '聲音', en: 'Sound', ja: 'サウンド', ko: '소리' };
const ls = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const setRange = (p, id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const popState = (p) => p.evaluate(() => { const e = document.querySelector('.rsPop'); const r = e.getBoundingClientRect(); return { open: !e.hidden, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), sl: !!e.querySelector('#popSfx'), bl: !!e.querySelector('#popBgm'), iw: innerWidth, ih: innerHeight }; });
const btnInfo = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), muted: e.dataset.muted, exp: e.getAttribute('aria-expanded'), aria: e.getAttribute('aria-label'), vis: r.width > 0 }; }, sel);
const popIn = (st) => st.open && st.l >= 0 && st.r <= st.iw && st.t >= 0 && st.b <= st.ih;
const sndWrites = (p) => p.evaluate(() => window.__sndWrites.slice());
const GSND = '#sStart [data-sound]', GPLAY = '#sPlay [data-sound]', DLOB = '#sLobby [data-sound]', DROOM = '#sRoom [data-sound]';
const visCount = (p, s) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).length, s);
async function gameToStart(p) { await p.evaluate(() => show('sPick')); await p.click('#modeR'); await sleep(200); }
async function startRun(p) { if (!(await p.inputValue('#nick'))) await p.fill('#nick', 'Cat'); await p.click('#go'); await waitFor(p, () => g && g.p && !g.hold, null, 30000); await sleep(300); }
async function gameToPlay(p) { await gameToStart(p); await startRun(p); }
async function duelRoom(c, c2) {
  const A = await open(c, 'duel.html'); await connected(A);
  const B = await open(c2, 'duel.html'); await connected(B);
  await wsSend(A, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
  await waitFor(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  const id = await A.evaluate(() => window.__duel.room.id);
  await wsSend(B, { t: 'view', room: id }); await waitFor(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
  await sitB(A, B, id);
  return { A, B, id };
}
const centerOf = (p) => p.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
const gEng = (p) => p.evaluate(() => { window.__eng = 0; const pm = engine.postMessage.bind(engine); engine.postMessage = (...a) => { window.__eng++; return pm(...a); }; });
const gPt = (p) => p.evaluate(() => { const r = cv.getBoundingClientRect(); for (let c = 1; c < N; c++) { const t = COLS[c] + (N - 11); if (!g.black.includes(t) && !g.white.includes(t)) return [r.left + pad + c * cell, r.top + pad + 11 * cell]; } return null; });
const gSoundOn = (p, path) => path === 'game.html' ? p.evaluate(() => soundOn) : p.evaluate(() => window.__duel.soundOn);

try {
  srv = spawn('python', ['-m', 'http.server', '8797', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  await L.startWr(PERSIST);
  await sleep(4000);
  b = await L.launch();

  console.log('== 1. 四個有喇叭的畫面：一顆喇叭 ≥44px，點了出小框（兩條滑桿），完整在畫面內');
  {
    const c = await ctxOf({ nick: 'Alice' });
    const g = await open(c, 'game.html'); await gameToStart(g);
    const n1 = await visCount(g, GSND);
    let bi = await btnInfo(g, GSND);
    ok(n1 === 1 && bi.w >= 44 && bi.h >= 44, `game.html 競速開始畫面：一顆喇叭 ${bi.w}x${bi.h}`);
    await g.click(GSND); await sleep(150);
    let st = await popState(g); bi = await btnInfo(g, GSND);
    ok(st.open && st.sl && st.bl && popIn(st) && bi.exp === 'true', `開始畫面小框：兩條滑桿、在畫面內（${st.l},${st.t}–${st.r},${st.b}／${st.iw}x${st.ih}）、aria-expanded=${bi.exp}`);
    await g.keyboard.press('Escape'); await sleep(100);
    await startRun(g);
    const n2 = await visCount(g, GPLAY);
    bi = await btnInfo(g, GPLAY);
    ok(n2 === 1 && bi.w >= 44 && bi.h >= 44, `game.html 解題畫面：一顆喇叭 ${bi.w}x${bi.h}`);
    await g.click(GPLAY); await sleep(150); st = await popState(g);
    ok(st.open && st.sl && st.bl && popIn(st), `解題畫面小框：兩條滑桿、在畫面內（${st.l},${st.t}–${st.r},${st.b}）`);
    await g.screenshot({ path: SH + 'pop_game_play_zh_375x667.png' });
    errsAll.push(...errsOf(g));
    const d = await open(c, 'duel.html'); await connected(d);
    const dn = await visCount(d, DLOB);
    bi = await btnInfo(d, DLOB);
    ok(dn === 1 && bi.w >= 44 && bi.h >= 44, `兩儀殿大廳：一顆喇叭 ${bi.w}x${bi.h}`);
    const order = await d.evaluate(() => [...document.querySelectorAll('#sLobby .topbar button')].map((e) => e.hasAttribute('data-sound') ? 'snd' : e.hasAttribute('data-set-open') ? 'gear' : '?').join(','));
    ok(order === 'snd,gear', `大廳右上角順序：${order}（喇叭在前、齒輪在最右）`);
    await d.screenshot({ path: SH + 'pop_duel_lobby_zh_375x667.png' });
    await d.click(DLOB); await sleep(150); st = await popState(d);
    ok(st.open && st.sl && st.bl && popIn(st), `大廳小框：兩條滑桿、在畫面內（${st.l},${st.t}–${st.r},${st.b}）`);
    await d.keyboard.press('Escape');
    await wsSend(d, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
    await waitFor(d, () => window.__duel.room && window.__duel.room.state === 'wait');
    const rn = await visCount(d, DROOM);
    bi = await btnInfo(d, DROOM);
    ok(rn === 1 && bi.w >= 44 && bi.h >= 44, `兩儀殿房間：一顆喇叭 ${bi.w}x${bi.h}`);
    const ro = await d.evaluate(() => [...document.querySelectorAll('#sRoom .rhead button')].filter((e) => e.getClientRects().length).map((e) => e.hasAttribute('data-sound') ? 'snd' : e.hasAttribute('data-set-open') ? 'gear' : e.id).join(','));
    ok(/snd,gear$/.test(ro), `房間右上角順序：${ro}`);
    await d.click(DROOM); await sleep(150); st = await popState(d);
    ok(st.open && st.sl && st.bl && popIn(st), `房間小框：兩條滑桿、在畫面內（${st.l},${st.t}–${st.r},${st.b}）`);
    await d.screenshot({ path: SH + 'pop_duel_room_zh_375x667.png' });
    errsAll.push(...errsOf(d)); await c.close();
  }

  console.log('== 2. 拉「音樂」到 0、「音效」不動：音樂停、落子聲實際音量不變（讀頁面實際的 gain）');
  {
    const c = await ctxOf({ nick: 'Alice' });
    const g = await open(c, 'game.html'); await gameToPlay(g);
    await g.click(GPLAY); await sleep(100);
    await setRange(g, 'popSfx', 50); await setRange(g, 'popBgm', 40); await sleep(200);
    const gb = await g.evaluate(() => { const a = audio(); const gain = sfxOut(a).gain.value; return { gain, vol: vol.sfx, wanted: bgmWanted(), playing: Object.values(bgm).filter((t) => t.el && !t.el.paused).length }; });
    await setRange(g, 'popBgm', 0); await sleep(300);
    const ga = await g.evaluate(() => { const a = audio(); return { gain: sfxOut(a).gain.value, vol: vol.sfx, bgmVol: vol.bgm, wanted: bgmWanted(), playing: Object.values(bgm).filter((t) => t.el && !t.el.paused).length }; });
    ok(await ls(g, 'vcfgame.vol.bgm') === '0' && await ls(g, 'vcfgame.vol.sfx') === '50' && ga.bgmVol === 0 && !ga.wanted && ga.playing === 0, `game.html：bgm=0（存檔 '0'、vol.bgm=${ga.bgmVol}、bgmWanted=${gb.wanted}→${ga.wanted}、播放中的音樂 ${gb.playing}→${ga.playing}）`);
    ok(NEG ? Math.abs(ga.gain - gb.gain) > 0.1 : Math.abs(ga.gain - gb.gain) < 1e-9 && Math.abs(ga.gain - 50 / 70) < 1e-6 && ga.vol === 50, `game.html：落子聲 master gain ${gb.gain.toFixed(4)} → ${ga.gain.toFixed(4)}（=50/70，沒變）`);
    errsAll.push(...errsOf(g));
    const d = await open(c, 'duel.html'); await connected(d);
    await d.mouse.click(10, 300); await sleep(200);
    await d.click(DLOB); await sleep(100);
    await setRange(d, 'popSfx', 50); await setRange(d, 'popBgm', 40); await sleep(250);
    const db = await d.evaluate(() => { const x = window.__duel; return { gain: x.sfxOut(x.audio()).gain.value, bgm: x.bgmVolume(), paused: x.bgmEl ? x.bgmEl.paused : null }; });
    await setRange(d, 'popBgm', 0); await sleep(300);
    const da = await d.evaluate(() => { const x = window.__duel; return { gain: x.sfxOut(x.audio()).gain.value, bgm: x.bgmVolume(), paused: x.bgmEl ? x.bgmEl.paused : null, sfxVol: x.volOf('sfx', 70) }; });
    ok(da.bgm === 0 && (da.paused === null || da.paused === true) && await ls(d, 'vcfgame.vol.bgm') === '0', `兩儀殿：bgmVolume() ${db.bgm}→0、音樂暫停=${da.paused}（拉之前 paused=${db.paused}）`);
    ok(Math.abs(da.gain - db.gain) < 1e-9 && Math.abs(da.gain - 50 / 70) < 1e-6 && da.sfxVol === 50, `兩儀殿：落子聲 master gain ${db.gain.toFixed(4)} → ${da.gain.toFixed(4)}（=50/70，沒變）`);
    const still = await d.evaluate(() => { const x = window.__duel; let used = null; const R = window.RushSound; const k = R.stoneId(localStorage.getItem('vcfgame.sfx.stone')); const f = R.STONE_SND[k]; R.STONE_SND[k] = (a, out, t, v) => { used = out.gain.value; return f(a, out, t, v); }; x.stoneSound(false); R.STONE_SND[k] = f; return used; });
    ok(still !== null && still > 0.5, `兩儀殿：音樂 0 時 stoneSound() 仍以 gain ${still && still.toFixed(4)} 發聲`);
    errsAll.push(...errsOf(d)); await c.close();
  }

  console.log('== 3. 兩條都 0 → 靜音圖示；拉回 > 0 → 有聲圖示；整個流程沒有寫過 vcfgame.sound=0');
  for (const [name, path, sel, pre] of [['game.html 開始畫面', 'game.html', GSND, gameToStart], ['兩儀殿大廳', 'duel.html', DLOB, null]]) {
    const c = await ctxOf({ nick: 'Alice' }); const p = await open(c, path); if (pre) await pre(p); else await connected(p);
    const m0 = (await btnInfo(p, sel)).muted;
    await p.click(sel); await sleep(100);
    await setRange(p, 'popSfx', 0); const m1 = (await btnInfo(p, sel)).muted;
    await setRange(p, 'popBgm', 0); const m2 = (await btnInfo(p, sel)).muted;
    await setRange(p, 'popSfx', 30); const m3 = (await btnInfo(p, sel)).muted;
    await setRange(p, 'popBgm', 20); const m4 = (await btnInfo(p, sel)).muted;
    const w = await sndWrites(p);
    ok(m0 === '0' && m1 === '0' && m2 === '1' && m3 === '0' && m4 === '0', `${name}：圖示 muted 序列 初始${m0}／只音效0→${m1}／兩條0→${m2}／音效拉回→${m3}／音樂拉回→${m4}（1＝靜音圖示）`);
    ok(!w.includes('0') && await ls(p, 'vcfgame.sound') !== '0', `${name}：vcfgame.sound 寫入紀錄 ${JSON.stringify(w)}，沒有 '0'`);
    errsAll.push(...errsOf(p)); await c.close();
  }

  console.log('== 4. 小框拉完 → 設定頁同值；設定頁拉完 → 再開小框同值');
  {
    const c = await ctxOf({ nick: 'Alice' });
    const d = await open(c, 'duel.html'); await connected(d);
    await d.click(DLOB); await setRange(d, 'popSfx', 61); await setRange(d, 'popBgm', 17); await d.keyboard.press('Escape'); await sleep(100);
    await d.click('#sLobby [data-set-open]'); await sleep(250);
    const s1 = await d.evaluate(() => [document.getElementById('volSfx').value, document.getElementById('volBgm').value, document.getElementById('volSfxN').textContent, document.getElementById('volBgmN').textContent]);
    ok(s1.join() === '61,17,61,17', `兩儀殿：小框 61/17 → 設定頁滑桿與數字 ${s1.join('/')}`);
    await setRange(d, 'volSfx', 25); await setRange(d, 'volBgm', 88);
    await d.click('#setBack'); await sleep(150);
    await d.click(DLOB); await sleep(100);
    const p1 = await d.evaluate(() => [document.getElementById('popSfx').value, document.getElementById('popBgm').value, document.getElementById('popSfxN').textContent, document.getElementById('popBgmN').textContent]);
    ok(p1.join() === '25,88,25,88', `兩儀殿：設定頁 25/88 → 再開小框 ${p1.join('/')}`);
    const g = await open(c, 'game.html'); await gameToStart(g);
    await g.click(GSND); await sleep(100);
    const g0 = await g.evaluate(() => [document.getElementById('popSfx').value, document.getElementById('popBgm').value]);
    ok(g0.join() === '25,88', `game.html：沿用同一組存檔，開小框讀到 ${g0.join('/')}`);
    await setRange(g, 'popSfx', 44); await g.keyboard.press('Escape'); await g.evaluate(() => show('sHome')); await sleep(150);
    await g.click('#openSet'); await sleep(250);
    const g1 = await g.evaluate(() => [document.getElementById('volSfx').value, document.getElementById('volSfxN').textContent]);
    ok(g1.join() === '44,44', `game.html：小框 44 → 設定頁 ${g1.join('/')}`);
    await setRange(g, 'volBgm', 9); await g.click('#setBack'); await gameToStart(g); await g.click(GSND); await sleep(100);
    const g2 = await g.evaluate(() => document.getElementById('popBgm').value);
    ok(g2 === '9', `game.html：設定頁 音樂 9 → 再開小框 ${g2}`);
    errsAll.push(...errsOf(d), ...errsOf(g)); await c.close();
  }

  console.log("== 5. 預先 vcfgame.sound='0'：喇叭是靜音圖示；小框把任一條拉 >0 → '1'、有聲；兩頁都驗");
  for (const [name, path, sel, pre] of [['game.html', 'game.html', GSND, gameToStart], ['兩儀殿', 'duel.html', DLOB, null]]) {
    const c = await ctxOf({ nick: 'Alice', sound: '0' }); const p = await open(c, path); if (pre) await pre(p); else await connected(p);
    const so0 = await gSoundOn(p, path);
    const bi = await btnInfo(p, sel);
    ok(so0 === false && bi.muted === '1', `${name}：進頁 soundOn=${so0}、喇叭圖示靜音（muted=${bi.muted}）`);
    await p.mouse.click(10, 300); await p.click(sel); await sleep(100);
    await setRange(p, 'popBgm', 35); await sleep(250);
    const so1 = await gSoundOn(p, path);
    const bi1 = await btnInfo(p, sel);
    const lsv = await ls(p, 'vcfgame.sound');
    ok(so1 === true && lsv === '1' && bi1.muted === '0', `${name}：拉音樂 >0 後 soundOn=${so1}、vcfgame.sound='${lsv}'、圖示變有聲（muted=${bi1.muted}）`);
    const au = path === 'game.html' ? await p.evaluate(() => !!audio()) : await p.evaluate(() => !!window.__duel.audio());
    ok(au, `${name}：AudioContext 可建（有聲）`);
    await setRange(p, 'popBgm', 0); await setRange(p, 'popSfx', 0);
    const w2 = await sndWrites(p);
    ok(JSON.stringify(w2) === JSON.stringify(['1']), `${name}：整個流程寫入 vcfgame.sound ${JSON.stringify(w2)}（只有 '1'，兩條拉 0 也沒寫 '0'）`);
    errsAll.push(...errsOf(p)); await c.close();
  }

  console.log('== 6. 關閉小框：點外面／再點喇叭／Esc');
  for (const [name, path, sel, pre] of [['game.html', 'game.html', GSND, gameToStart], ['兩儀殿', 'duel.html', DLOB, null]]) {
    const c = await ctxOf({ nick: 'Alice' }); const p = await open(c, path); if (pre) await pre(p); else await connected(p);
    await p.click(sel); await sleep(100); const o1 = (await popState(p)).open;
    await p.mouse.click(180, 520); await sleep(100); const o2 = (await popState(p)).open;
    await p.click(sel); await sleep(100); const o3 = (await popState(p)).open;
    await p.click(sel); await sleep(100); const o4 = (await popState(p)).open;
    await p.click(sel); await sleep(100);
    await p.keyboard.press('Escape'); await sleep(100); const o5 = (await popState(p)).open; const ex = (await btnInfo(p, sel)).exp;
    await p.click(sel); await sleep(100); await p.click('.rsPop #popSfx', { position: { x: 30, y: 10 } }); await sleep(100); const o6 = (await popState(p)).open;
    ok(o1 && !o2 && o3 && !o4 && !o5 && ex === 'false' && o6, `${name}：開${o1}→點外面後${o2}→再開${o3}→再點喇叭後${o4}→（開）Esc 後${o5}、aria-expanded=${ex}；在小框內點滑桿不關=${o6}`);
    errsAll.push(...errsOf(p)); await c.close();
  }

  console.log('== 7. 小框開著點棋盤：小框關、盤面沒多一顆子、沒有送出落子');
  {
    const c = await ctxOf({ nick: 'Cat' });
    const g = await open(c, 'game.html'); await gameToPlay(g); await gEng(g);
    const pt = await gPt(g);
    const st0 = await g.evaluate(() => ({ n: g.black.length + g.white.length, mv: g.moves.length, eng: window.__eng }));
    await g.click(GPLAY); await sleep(100);
    await g.mouse.click(pt[0], pt[1]); await sleep(900);
    const st1 = await g.evaluate(() => ({ n: g.black.length + g.white.length, mv: g.moves.length, eng: window.__eng }));
    const pp = await popState(g);
    ok(!pp.open && st1.n === st0.n && st1.mv === st0.mv && st1.eng === st0.eng, `game.html 解題畫面（滑鼠）：小框關了、棋子數 ${st0.n}→${st1.n}、moves ${st0.mv}→${st1.mv}、送引擎 ${st0.eng}→${st1.eng}`);
    await g.mouse.click(pt[0], pt[1]); await sleep(1500);
    const st2 = await g.evaluate(() => ({ mv: g.moves.length, eng: window.__eng }));
    ok(st2.eng > st1.eng, `對照：小框關著點同一格 → 送引擎 ${st1.eng}→${st2.eng}（點擊確實會被處理；這格不是衝四，引擎回「不是四」所以盤面不變、只警告）`);
    errsAll.push(...errsOf(g)); await c.close();
    const ct = await ctxOf({ nick: 'Cat', touch: true });
    const gt = await open(ct, 'game.html'); await gameToPlay(gt); await gEng(gt);
    const pt2 = await gPt(gt);
    const t0 = await gt.evaluate(() => ({ mv: g.moves.length, eng: window.__eng }));
    await gt.tap(GPLAY); await sleep(150);
    const topen = (await popState(gt)).open;
    await gt.touchscreen.tap(pt2[0], pt2[1]); await sleep(900);
    const t1 = await gt.evaluate(() => ({ mv: g.moves.length, eng: window.__eng })), tp = await popState(gt);
    ok(topen && !tp.open && t1.mv === t0.mv && t1.eng === t0.eng, `game.html 解題畫面（觸控）：小框開=${topen}→點棋盤後關=${!tp.open}、moves ${t0.mv}→${t1.mv}、送引擎 ${t0.eng}→${t1.eng}`);
    await gt.touchscreen.tap(pt2[0], pt2[1]); await sleep(1500);
    const t2 = await gt.evaluate(() => ({ eng: window.__eng }));
    ok(t2.eng > t1.eng, `對照（觸控）：小框關著點同一格 → 送引擎 ${t1.eng}→${t2.eng}`);
    errsAll.push(...errsOf(gt)); await ct.close();
    const c1 = await ctxOf({ nick: 'Alice' }), c2 = await ctxOf({ nick: 'Bob' });
    const { A, B } = await duelRoom(c1, c2);
    for (const P of [A, B]) await P.evaluate(() => { window.__sent = []; const s = window.__ws.send.bind(window.__ws); window.__ws.send = (x) => { window.__sent.push(x); return s(x); }; });
    const ca = await centerOf(A), cb = await centerOf(B);
    const m0a = await A.evaluate(() => window.__duel.match.log.length), m0b = await B.evaluate(() => window.__duel.match.log.length);
    await A.click(DROOM); await B.click(DROOM); await sleep(100);
    await A.mouse.click(ca[0], ca[1]); await B.mouse.click(cb[0], cb[1]); await sleep(900);
    const cnt = (P, re) => P.evaluate((s) => window.__sent.filter((x) => new RegExp(s).test(x)).length, re);
    const sa = await cnt(A, '"t":"(move|smove)"'), sb = await cnt(B, '"t":"(move|smove)"');
    const pa = await popState(A), pb = await popState(B);
    const m1a = await A.evaluate(() => window.__duel.match.log.length), m1b = await B.evaluate(() => window.__duel.match.log.length);
    ok(!pa.open && !pb.open && sa === 0 && sb === 0 && m1a === m0a && m1b === m0b, `兩儀殿對局中：兩邊小框都關了、送出落子 A=${sa} B=${sb}、盤面手數 ${m0a}→${m1a}／${m0b}→${m1b}`);
    await A.mouse.click(ca[0], ca[1]); await B.mouse.click(cb[0], cb[1]); await sleep(1500);
    const sa2 = await cnt(A, '"t":"move"'), sb2 = await cnt(B, '"t":"move"');
    ok(sa2 + sb2 === 1, `對照：小框關著各點中央 → 輪到的那一方送出落子（A=${sa2} B=${sb2}，合計 1）`);
    errsAll.push(...errsOf(A), ...errsOf(B)); await c1.close(); await c2.close();
  }

  console.log('== 8. 兩儀殿對局中開關小框：仍在房間、WebSocket 沒重連、計時繼續');
  {
    const c1 = await ctxOf({ nick: 'Alice' }), c2 = await ctxOf({ nick: 'Bob' });
    const { A, B } = await duelRoom(c1, c2);
    const snap = (p) => p.evaluate(() => ({ state: window.__duel.room.state, rid: window.__duel.room.id, ws: window.__wsCount, open: window.__ws.readyState, tag: (window.__ws.__t = window.__ws.__t || Math.random()), bar: document.getElementById('pTop').textContent + '|' + document.getElementById('pBot').textContent, seats: JSON.stringify((window.__duel.room.seats || []).map((s) => s && s.nick)), hist: history.length }));
    const a0 = await snap(A), b0 = await snap(B);
    await A.click(DROOM); await sleep(1500);
    const mid = await snap(A), pm = await popState(A);
    await setRange(A, 'popBgm', 22); await sleep(100); await A.click(DROOM); await sleep(1300);
    const a1 = await snap(A), b1 = await snap(B);
    ok(pm.open && mid.bar !== a0.bar, `小框開著時計時仍在走（${a0.bar} → ${mid.bar}）`);
    ok(a1.state === 'play' && a1.rid === a0.rid && a1.ws === a0.ws && a1.open === 1 && a1.tag === a0.tag && a1.hist === a0.hist, `A 仍在房間 ${a1.rid}、對局進行中、WebSocket 沒重連（建立 ${a0.ws}→${a1.ws}、同一個物件）、history.length ${a0.hist}→${a1.hist}`);
    ok(b1.state === 'play' && b1.seats === b0.seats && b1.ws === b0.ws, `B 沒看到 A 離開（座位 ${b1.seats}）`);
    ok(a1.bar !== mid.bar, `關掉後計時繼續（${mid.bar} → ${a1.bar}）`);
    errsAll.push(...errsOf(A), ...errsOf(B)); await c1.close(); await c2.close();
  }

  console.log('== 9. 四語 × 375×667、360×640：四個畫面，小框開著與關著都不捲動、小框在畫面內');
  for (const [w, h] of SIZES) for (const lang of LANGS) {
    const c = await ctxOf({ lang, w, h, nick: 'Cat' });
    const g = await open(c, 'game.html'); await gameToStart(g);
    const labs = [];
    for (const nm of ['game 開始', 'game 解題']) {
      const sel = nm === 'game 開始' ? GSND : GPLAY;
      if (nm === 'game 解題') await startRun(g);
      okNoScroll(await noScroll(g), `[${lang} ${w}x${h}] ${nm}（小框關著）`);
      const bi = await btnInfo(g, sel); labs.push(bi.aria);
      await g.click(sel); await sleep(150);
      const r1 = await noScroll(g), st = await popState(g);
      okNoScroll(r1, `[${lang} ${w}x${h}] ${nm}（小框開著）`);
      ok(popIn(st) && st.r - st.l >= 200, `[${lang} ${w}x${h}] ${nm} 小框完整在畫面內（${st.l},${st.t}–${st.r},${st.b}／${st.iw}x${st.ih}，寬 ${st.r - st.l}）`);
      if (nm === 'game 開始') console.log(`    [${lang}] 小框文字：${await g.evaluate(() => [...document.querySelectorAll('.rsPop label span')].map((e) => e.textContent).join('/'))}；喇叭 aria-label：${bi.aria}`);
      await g.keyboard.press('Escape');
    }
    ok(labs.every((x) => x === LANGS_ARIA[lang]), `[${lang}] 喇叭 aria-label＝「${LANGS_ARIA[lang]}」（${labs.join(',')}）`);
    errsAll.push(...errsOf(g));
    const d = await open(c, 'duel.html'); await connected(d);
    okNoScroll(await noScroll(d), `[${lang} ${w}x${h}] 兩儀殿大廳（小框關著）`);
    await d.click(DLOB); await sleep(150);
    let r1 = await noScroll(d), st = await popState(d);
    okNoScroll(r1, `[${lang} ${w}x${h}] 兩儀殿大廳（小框開著）`);
    ok(popIn(st), `[${lang} ${w}x${h}] 兩儀殿大廳 小框完整在畫面內（${st.l},${st.t}–${st.r},${st.b}）`);
    const ab = (await btnInfo(d, DLOB)).aria; ok(ab === LANGS_ARIA[lang], `[${lang}] 兩儀殿大廳喇叭 aria-label＝${ab}`);
    await d.keyboard.press('Escape');
    await wsSend(d, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
    await waitFor(d, () => window.__duel.room && window.__duel.room.state === 'wait');
    okNoScroll(await noScroll(d), `[${lang} ${w}x${h}] 兩儀殿房間（小框關著）`);
    const bi = await btnInfo(d, DROOM); ok(bi.w >= 44 && bi.h >= 44 && bi.aria === LANGS_ARIA[lang], `[${lang} ${w}x${h}] 房間喇叭 ${bi.w}x${bi.h}、aria＝${bi.aria}`);
    await d.click(DROOM); await sleep(150); r1 = await noScroll(d); st = await popState(d);
    okNoScroll(r1, `[${lang} ${w}x${h}] 兩儀殿房間（小框開著）`);
    ok(popIn(st), `[${lang} ${w}x${h}] 兩儀殿房間 小框完整在畫面內（${st.l},${st.t}–${st.r},${st.b}）`);
    if (lang === 'en' && w === 360) await d.screenshot({ path: SH + 'pop_duel_room_en_360x640.png' });
    errsAll.push(...errsOf(d)); await c.close();
  }

  ok(errsAll.length === 0, `全程沒有 pageerror／console error（${errsAll.length}）${errsAll.slice(0, 3).join(' | ')}`);
} catch (e) {
  console.log('  FAIL 腳本例外：' + (e && e.stack || e)); L.ok(false, '腳本例外');
} finally {
  if (b) await b.close().catch(() => {});
  killAll();
}
const f = L.done();
process.exit(f ? 1 : 0);
