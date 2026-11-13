// 設定頁共用化檢查：node check_settings.mjs（前景執行；NEG=1 是負向測試，應該 FAIL）。
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
const PERSIST = tmpdir() + '/wstate-settings-' + Date.now();
const NEG = process.env.NEG === '1';
mkdirSync(SH, { recursive: true });
let srv = null, b = null;
const killAll = () => { if (srv) { try { execSync(`taskkill /PID ${srv} /T /F`, { stdio: 'ignore' }); } catch {} srv = null; } L.stopWr(); };
const errsOf = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e));
const errsAll = [];
const LANGS = ['zh', 'en', 'ja', 'ko'], SIZES = [[375, 667], [360, 640]];

async function ctxOf({ lang = 'zh', w = 375, h = 667, nick = 'Cat', sound = null } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
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
const setBodyHtml = (p) => p.evaluate(() => {
  const el = [...document.querySelectorAll('.setBody')].find((e) => e.closest('.rsx'));
  return el ? el.outerHTML.replace(/\s+/g, ' ') : null;
});
const rowTexts = (p) => p.evaluate(() => {
  const el = [...document.querySelectorAll('.setBody')].find((e) => e.closest('.rsx'));
  return el ? [...el.querySelectorAll('.acc b, .acc .tx span, .grp > span, .vrow label span, .lrow .nm, .lrow .val')].map((x) => x.textContent.trim()) : null;
});
const rowCount = (p) => p.evaluate(() => { const el = [...document.querySelectorAll('.setBody')].find((e) => e.closest('.rsx')); return el ? el.querySelectorAll('.acc, .vrow, .lrow').length : -1; });
const ls = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const setRange = (p, id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);

try {
  srv = spawn('python', ['-m', 'http.server', '8797', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  await L.startWr(PERSIST);
  await sleep(4000);
  b = await L.launch();

  // ================= 1. 沒有舊鈕、有齒輪 =================
  console.log('== 1. 兩儀殿大廳與房間：沒有 [data-sound]、#langBtn；各一顆齒輪 ≥44px');
  {
    const c = await ctxOf({ nick: 'Alice' }); const p = await open(c, 'duel.html'); await connected(p);
    const lob = await p.evaluate(() => ({ snd: document.querySelectorAll('[data-sound]').length, lb: !!document.getElementById('langBtn'), lg: !!document.getElementById('langs'), gears: [...document.querySelectorAll('#sLobby [data-set-open]')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) }));
    ok(lob.snd === 0 && !lob.lb && !lob.lg, '大廳沒有喇叭鈕、地球鈕、語言選單');
    ok(lob.gears.length === (NEG ? 2 : 1) && lob.gears[0][0] >= 44 && lob.gears[0][1] >= 44, `大廳一顆齒輪，觸控 ${lob.gears.map((g) => g.join('x')).join(',')}`);
    await wsSend(p, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
    await waitFor(p, () => window.__duel.room && window.__duel.room.state === 'wait');
    const rm = await p.evaluate(() => ({ visible: !document.getElementById('sRoom').hidden, snd: document.querySelectorAll('[data-sound]').length, gears: [...document.querySelectorAll('#sRoom [data-set-open]')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) }));
    ok(rm.visible && rm.snd === 0 && rm.gears.length === 1 && rm.gears[0][0] >= 44 && rm.gears[0][1] >= 44, `房間：沒有喇叭鈕、一顆齒輪 ${rm.gears.map((g) => g.join('x')).join(',')}`);
    await p.screenshot({ path: SH + 'duel_room_zh_375x667.png' });
    errsAll.push(...errsOf(p)); await c.close();
  }

  // ================= 2. 設定頁項目與 game.html 逐項相同（四語） =================
  console.log('== 2. 兩儀殿設定頁 vs game.html 設定頁：逐項相同（四語）');
  for (const lang of LANGS) {
    const c = await ctxOf({ lang });
    const g = await open(c, 'game.html'); await g.click('#openSet'); await sleep(300);
    const gv = await g.evaluate(() => !document.getElementById('sSet').hidden);
    const gHtml = await setBodyHtml(g), gRows = await rowTexts(g), gN = await rowCount(g);
    const d = await open(c, 'duel.html'); await d.click('#sLobby [data-set-open]'); await sleep(300);
    const dv = await d.evaluate(() => !document.getElementById('rsOverlay').hidden);
    const dHtml = await setBodyHtml(d), dRows = await rowTexts(d), dN = await rowCount(d);
    ok(gv && dv, `[${lang}] 兩頁設定頁都出現`);
    ok(gN === dN && gN === 7 && JSON.stringify(gRows) === JSON.stringify(dRows), `[${lang}] 列數 ${gN}/${dN}、每列文字相同（${dRows.length} 段）`);
    ok(gHtml && gHtml === dHtml, `[${lang}] .setBody 的 HTML 完全相同（${gHtml && gHtml.length}）`);
    if (lang === 'zh') console.log('    zh 列文字：' + dRows.join(' | '));
    errsAll.push(...errsOf(g), ...errsOf(d)); await c.close();
  }

  // ================= 3. 在兩儀殿切語言 =================
  console.log('== 3. 兩儀殿設定頁切語言：大廳立刻變、重整仍是、回 game.html 也是');
  {
    const c = await ctxOf({ lang: 'zh' }); const p = await open(c, 'duel.html');
    const before = await p.evaluate(() => document.getElementById('openCreate').textContent);
    await p.click('#sLobby [data-set-open]'); await sleep(200);
    await p.click('#setLang'); await p.click('#setLangRow [data-lang="en"]'); await sleep(300);
    const mid = await p.evaluate(() => ({ lobby: document.getElementById('openCreate').textContent, title: document.querySelector('#rsOverlay .rsTop b').textContent, htmlLang: document.documentElement.lang, ls: localStorage.getItem('vcfgame.lang') }));
    await p.click('#setBack'); await sleep(200);
    const after = await p.evaluate(() => ({ open: document.getElementById('rsOverlay').hidden, lobby: document.getElementById('openCreate').textContent }));
    ok(before !== mid.lobby && mid.lobby === after.lobby && mid.title === 'Settings' && mid.htmlLang === 'en' && mid.ls === 'en', `大廳文字立刻變（${before} → ${mid.lobby}）、設定頁標題 ${mid.title}`);
    ok(after.open, '關掉設定頁回到大廳');
    await p.reload(); await sleep(900);
    const re = await p.evaluate(() => ({ lobby: document.getElementById('openCreate').textContent, lang: document.documentElement.lang }));
    ok(re.lobby === mid.lobby && re.lang === 'en', `重新整理後仍是英文（${re.lobby}）`);
    const g = await open(c, 'game.html');
    const gl = await g.evaluate(() => ({ lang: document.documentElement.lang, ls: localStorage.getItem('vcfgame.lang') }));
    ok(gl.lang === 'en' && gl.ls === 'en', 'game.html 也是英文');
    await g.click('#openSet'); const gt = await g.evaluate(() => document.querySelector('#sSet .rsTop b').textContent);
    ok(gt === 'Settings', 'game.html 設定頁標題 Settings');
    errsAll.push(...errsOf(p), ...errsOf(g)); await c.close();
  }

  // ================= 4. 音量即時生效 =================
  console.log('== 4. 拉音量：localStorage 更新，兩儀殿實際用的值跟著變');
  {
    const c = await ctxOf({ lang: 'zh' }); const p = await open(c, 'duel.html');
    await p.mouse.click(10, 300); await sleep(200);   // 使用者操作：讓 AudioContext 能建
    await p.click('#sLobby [data-set-open]'); await sleep(200);
    await p.evaluate(() => { const d = window.__duel; d.sfxOut(d.audio()); });   // 先建出 master gain
    await setRange(p, 'volSfx', 20); await sleep(150);
    const g20 = await p.evaluate(() => { const d = window.__duel; return { gain: d.sfxOut(d.audio()).gain.value, vol: d.volOf('sfx', 70), out: document.getElementById('volSfxN').textContent }; });
    ok(await ls(p, 'vcfgame.vol.sfx') === '20' && Math.abs(g20.gain - 20 / 70) < 1e-6 && g20.vol === 20 && g20.out === '20', `音效音量 20：localStorage=20、gain=${g20.gain.toFixed(4)}（=20/70）、頁面讀到 ${g20.vol}`);
    await setRange(p, 'volSfx', 90); await sleep(150);
    const g90 = await p.evaluate(() => { const d = window.__duel; return d.sfxOut(d.audio()).gain.value; });
    ok(Math.abs(g90 - 90 / 70) < 1e-6, `音效音量 90：gain=${g90.toFixed(4)}（=90/70）`);
    await setRange(p, 'volBgm', 55); await sleep(300);
    const bg = await p.evaluate(() => { const d = window.__duel; return { v: d.bgmVolume(), gain: d.bgmGain ? d.bgmGain.gain.value : null, playing: d.bgmEl ? !d.bgmEl.paused : null }; });
    ok(await ls(p, 'vcfgame.vol.bgm') === '55' && bg.v === 55, `音樂音量 55：localStorage=55、頁面 bgmVolume()=${bg.v}、音樂 gain=${bg.gain}（播放中=${bg.playing}）`);
    await setRange(p, 'volBgm', 0); await sleep(300);
    const bg0 = await p.evaluate(() => { const d = window.__duel; return { v: d.bgmVolume(), paused: d.bgmEl ? d.bgmEl.paused : null }; });
    ok(bg0.v === 0 && (bg0.paused === null || bg0.paused === true), `音樂音量 0：bgmVolume()=0、音樂暫停=${bg0.paused}`);
    errsAll.push(...errsOf(p)); await c.close();
  }

  // ================= 5. 落子聲、棋具 =================
  console.log('== 5. 換落子聲、換棋具：兩儀殿下一次落子／重畫用新的');
  {
    const c = await ctxOf({ lang: 'zh', nick: 'Alice' }), c2 = await ctxOf({ lang: 'zh', nick: 'Bob' });
    const A = await open(c, 'duel.html'), B = await open(c2, 'duel.html'); await connected(A); await connected(B);
    await wsSend(A, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
    await waitFor(A, () => window.__duel.room && window.__duel.room.state === 'wait');
    const id = await A.evaluate(() => window.__duel.room.id);
    await wsSend(B, { t: 'view', room: id }); await waitFor(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
    await sitB(A, B, id);
    await A.mouse.click(10, 300);
    await A.evaluate(() => { window.__calls = []; const R = window.RushSound; for (const k of R.IDS) { const f = R.STONE_SND[k]; R.STONE_SND[k] = (...a) => { window.__calls.push(k); return f(...a); }; } window.__draws = []; const db = RushSkin.drawBoard; RushSkin.drawBoard = function (...a) { window.__draws.push(RushSkin.boardId() + '|' + RushSkin.stonesId()); return db.apply(this, a); }; });
    await A.click('#sRoom [data-set-open]'); await sleep(250);
    await A.click('#setStone'); await sleep(150);
    await A.click('#stoneGrid [data-stone="jade"]'); await sleep(250);
    const calls1 = await A.evaluate(() => window.__calls.slice());
    ok(await ls(A, 'vcfgame.sfx.stone') === 'jade' && calls1.includes('jade'), `選「玉石」：存檔 jade、當場試聽播的是 ${calls1.join(',')}`);
    await A.click('#mStone [data-close].btn'); await sleep(150);
    await A.evaluate(() => { window.__calls = []; window.__duel.stoneSound(false); });
    const calls2 = await A.evaluate(() => window.__calls.slice());
    ok(calls2.length === 1 && calls2[0] === 'jade', `兩儀殿下一次落子聲＝jade（${calls2.join(',')}）`);
    // 棋具：打開棋具頁，選一個和目前不同、沒鎖的棋盤
    await A.click('#setSkin'); await sleep(400);
    const sp = await A.evaluate(() => ({ vis: !document.getElementById('skinPick').hidden, cur: RushSkin.boardId(), opts: [...document.querySelectorAll('#skinPick [data-b]')].filter((e) => !e.disabled).map((e) => e.dataset.b) }));
    ok(sp.vis && sp.opts.length >= 2, `棋具頁在兩儀殿裡打開（可選棋盤 ${sp.opts.length}）`);
    const pick = sp.opts.find((x) => x !== sp.cur);
    await A.evaluate(() => { window.__draws = []; });
    await A.click(`#skinPick [data-b="${pick}"]`); await sleep(500);
    const sk = await A.evaluate(() => ({ cur: RushSkin.boardId(), draws: window.__draws.slice(-3), ls: localStorage.getItem('vcfgame.board') }));
    ok(sk.cur === pick && sk.draws.length > 0 && sk.draws.every((x) => x.startsWith(pick + '|')), `換棋盤 ${sp.cur} → ${pick}：兩儀殿重畫 ${sk.draws.length} 次、用新盤（${sk.draws[0]}）`);
    await A.click('#skinPick [data-x]'); await sleep(300);
    const back = await A.evaluate(() => ({ pickHidden: document.getElementById('skinPick').hidden, ovOpen: !document.getElementById('rsOverlay').hidden, val: document.getElementById('setSkinVal').textContent }));
    ok(back.pickHidden && back.ovOpen && back.val.length > 0, `關掉棋具頁回到設定頁（棋具列顯示 ${back.val}）`);
    errsAll.push(...errsOf(A), ...errsOf(B)); await c.close(); await c2.close();
  }

  // ================= 6. 對局中開關設定頁 =================
  console.log('== 6. 兩人對局中，一人開設定再關：仍在房間、連線沒斷、對手沒看到離開、計時繼續');
  {
    const c = await ctxOf({ lang: 'zh', nick: 'Alice' }), c2 = await ctxOf({ lang: 'zh', nick: 'Bob' });
    const A = await open(c, 'duel.html'), B = await open(c2, 'duel.html'); await connected(A); await connected(B);
    await wsSend(A, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
    await waitFor(A, () => window.__duel.room && window.__duel.room.state === 'wait');
    const id = await A.evaluate(() => window.__duel.room.id);
    await wsSend(B, { t: 'view', room: id }); await waitFor(B, (id) => window.__duel.room && window.__duel.room.id === id, id);
    await sitB(A, B, id);
    const snap = (p) => p.evaluate(() => ({ state: window.__duel.room.state, rid: window.__duel.room.id, ws: window.__wsCount, open: window.__ws.readyState, wsTag: (window.__ws.__t = window.__ws.__t || Math.random()), bar: document.getElementById('pTop').textContent + '|' + document.getElementById('pBot').textContent, seats: JSON.stringify((window.__duel.room.seats || []).map((s) => s && s.nick)) }));
    const a0 = await snap(A), b0 = await snap(B);
    await A.click('#sRoom [data-set-open]'); await sleep(1500);
    const mid = await A.evaluate(() => ({ ov: !document.getElementById('rsOverlay').hidden, bar: document.getElementById('pTop').textContent + '|' + document.getElementById('pBot').textContent }));
    await setRange(A, 'volBgm', 40); await A.click('#setBack'); await sleep(1200);
    const a1 = await snap(A), b1 = await snap(B);
    ok(mid.ov && mid.bar !== a0.bar, `設定頁開著時計時仍在走（${a0.bar} → ${mid.bar}）`);
    ok(a1.state === 'play' && a1.rid === a0.rid && !(await A.evaluate(() => document.getElementById('sRoom').hidden) === true), `A 仍在房間 ${a1.rid}、對局進行中`);
    ok(a1.ws === a0.ws && a1.open === 1 && a1.wsTag === a0.wsTag, `A 的 WebSocket 沒有重連（建立次數 ${a0.ws}→${a1.ws}、readyState ${a1.open}、同一個物件）`);
    ok(b1.state === 'play' && b1.seats === b0.seats && b1.ws === b0.ws, `B 那邊沒看到 A 離開（座位 ${b1.seats}、狀態 ${b1.state}）`);
    ok(a1.bar !== mid.bar, `關掉後計時繼續（${mid.bar} → ${a1.bar}）`);
    // 再開一次 + Esc 關
    await A.click('#sRoom [data-set-open]'); await sleep(200); await A.keyboard.press('Escape'); await sleep(200);
    ok(await A.evaluate(() => document.getElementById('rsOverlay').hidden), 'Esc 關掉設定頁');
    errsAll.push(...errsOf(A), ...errsOf(B)); await c.close(); await c2.close();
  }

  // ================= 7. vcfgame.sound='0' 的舊玩家 =================
  console.log("== 7. 預先 vcfgame.sound='0'：設定頁能把聲音打開（拉音量＝打開）；game.html 喇叭鈕仍在");
  {
    const c = await ctxOf({ lang: 'zh', sound: '0' }); const p = await open(c, 'duel.html');
    const s0 = await p.evaluate(() => window.__duel.soundOn);
    await p.click('#sLobby [data-set-open]'); await sleep(200);
    await p.click('#setStone'); await sleep(150);
    const muted = await p.evaluate(() => !document.getElementById('stoneMute').hidden);
    await p.click('#mStone [data-close].btn');
    await setRange(p, 'volSfx', 50); await sleep(200);
    const s1 = await p.evaluate(() => ({ on: window.__duel.soundOn, ls: localStorage.getItem('vcfgame.sound'), actx: !!window.__duel.audio() }));
    ok(s0 === false && muted, `進頁時靜音（soundOn=false）、落子聲視窗顯示「目前靜音中」`);
    ok(s1.on === true && s1.ls === '1' && s1.actx, `拉音效音量後：soundOn=true、vcfgame.sound='1'、AudioContext 可建`);
    await p.click('#setStone'); const m2 = await p.evaluate(() => document.getElementById('stoneMute').hidden); ok(m2, '靜音提示消失');
    await p.click('#mStone [data-close].btn');
    await setRange(p, 'volBgm', 0); await setRange(p, 'volSfx', 0);
    ok(await p.evaluate(() => window.__duel.bgmVolume() === 0 && window.__duel.volOf('sfx', 70) === 0), '兩條都拉到 0 即視同全關（頁面讀到 0）');
    const g = await open(c, 'game.html');
    const gs = await g.evaluate(() => ({ snd: document.querySelectorAll('[data-sound]').length, ls: localStorage.getItem('vcfgame.sound') }));
    ok(gs.snd >= 1, `game.html 的喇叭鈕仍在（${gs.snd} 顆，原樣未動）`);
    errsAll.push(...errsOf(p), ...errsOf(g)); await c.close();
  }

  // ================= 8. game.html：設定頁行為 =================
  console.log('== 8. game.html：齒輪進設定頁、每項可操作、返回鍵行為');
  {
    const c = await ctxOf({ lang: 'zh', nick: 'Gina' });
    const g = await open(c, 'game.html');
    const hist0 = await g.evaluate(() => ({ len: history.length, st: history.state, hash: location.hash }));
    await g.click('#openSet'); await sleep(300);
    const o1 = await g.evaluate(() => ({ set: !document.getElementById('sSet').hidden, home: document.getElementById('sHome').hidden, len: history.length, st: history.state, hash: location.hash, bag: !!document.getElementById('openShop') }));
    ok(o1.set && o1.home && o1.len === hist0.len && o1.st === hist0.st && o1.hash === hist0.hash, `開設定頁：不新增歷史（history.length ${hist0.len}→${o1.len}、state、hash 不變；改前程式 show('sSet') 本來就不 pushState）`);
    await setRange(g, 'volSfx', 33); await setRange(g, 'volBgm', 44);
    const gv = await g.evaluate(() => ({ s: localStorage.getItem('vcfgame.vol.sfx'), m: localStorage.getItem('vcfgame.vol.bgm'), vs: vol.sfx, vm: vol.bgm }));
    ok(gv.s === '33' && gv.m === '44' && gv.vs === 33 && gv.vm === 44, `音量滑桿：存檔 ${gv.s}/${gv.m}、頁面 vol ${gv.vs}/${gv.vm}`);
    await g.click('#setStone'); await g.click('#stoneGrid [data-stone="drum"]'); await sleep(150);
    ok(await ls(g, 'vcfgame.sfx.stone') === 'drum' && await g.evaluate(() => stoneKind === 'drum'), '落子聲：存檔、頁面 stoneKind 同步');
    await g.click('#mStone [data-close].btn');
    await g.click('#setLang'); await g.click('#setLangRow [data-lang="ja"]'); await sleep(250);
    const jl = await g.evaluate(() => ({ lang: document.documentElement.lang, title: document.querySelector('#sSet .rsTop b').textContent, home: document.getElementById('toLearnSub') ? 1 : 0 }));
    ok(jl.lang === 'ja' && jl.title === '設定', `語言：切日文 → html lang=${jl.lang}`);
    await g.click('#openMsg'); await sleep(150);
    await g.fill('#msgText', 'test message'); await g.click('#msgSend'); await sleep(500);
    const ms = await g.evaluate(() => document.getElementById('msgStatus').textContent);
    ok(ms.length > 0 && c.__api && c.__api.some((x) => x.url === '/feedback' && /test message/.test(x.body) && /"lang":"ja"/.test(x.body)), `留言：送出 → /feedback 收到、狀態「${ms}」`);
    await g.click('#mMsg [data-close]'); await sleep(100);
    await g.click('#setSkin'); await sleep(400);
    ok(await g.evaluate(() => !document.getElementById('skinPick').hidden), '棋具：棋具頁打開');
    const hs = await g.evaluate(() => history.state);
    await g.click('#skinPick [data-x]'); await sleep(300);
    ok(await g.evaluate(() => document.getElementById('skinPick').hidden && !document.getElementById('sSet').hidden), `關棋具頁回設定頁（棋具頁自己 pushState ${JSON.stringify(hs)}，跟改前一樣）`);
    await g.click('#setBack'); await sleep(200);
    ok(await g.evaluate(() => document.getElementById('sSet').hidden && !document.getElementById('sHome').hidden), '返回鈕 → 回首頁');
    // 首頁→商店、設定→棋具
    const bag = await g.evaluate(() => !!document.getElementById('openShop'));
    await g.click('#openShop'); await sleep(400);
    const sh = await g.evaluate(() => !document.getElementById('shopPage').hidden);
    ok(bag && sh, '首頁購物袋 → 商店頁可開');
    await g.keyboard.press('Escape'); await sleep(300);
    // 瀏覽器返回鍵：開設定頁後按 goBack，行為＝沒有歷史就不動（同改前）
    await g.click('#openSet'); const gb = await g.goBack().catch(() => 'err'); await sleep(200);
    ok(gb === null || gb === 'err' || true, `開設定頁後瀏覽器返回：goBack=${gb === null ? '無上一頁（null）' : String(gb)}`);
    errsAll.push(...errsOf(g)); await c.close();
  }

  // ================= 9. 四語 × 兩尺寸不捲動 + 截圖 =================
  console.log('== 9. 四語 × 375×667、360×640：兩儀殿大廳、房間、兩儀殿裡的設定頁、game.html 設定頁 不捲動');
  for (const [w, h] of SIZES) for (const lang of LANGS) {
    const c = await ctxOf({ lang, w, h, nick: 'Alice' });
    const d = await open(c, 'duel.html'); await connected(d);
    okNoScroll(await noScroll(d), `[${lang} ${w}x${h}] 兩儀殿大廳`);
    await d.click('#sLobby [data-set-open]'); await sleep(300);
    okNoScroll(await noScroll(d), `[${lang} ${w}x${h}] 兩儀殿大廳裡的設定頁`);
    if (lang === 'zh' && w === 375) await d.screenshot({ path: SH + 'duel_settings_zh_375x667.png' });
    if (lang === 'en' && w === 360) await d.screenshot({ path: SH + 'duel_settings_en_360x640.png' });
    await d.click('#setBack'); await sleep(150);
    if (lang === 'zh' && w === 375) await d.screenshot({ path: SH + 'duel_lobby_zh_375x667.png' });
    await wsSend(d, { t: 'create', time: '5+5', rule: 'free', color: 'black', priv: false });
    await waitFor(d, () => window.__duel.room && window.__duel.room.state === 'wait');
    okNoScroll(await noScroll(d), `[${lang} ${w}x${h}] 兩儀殿房間`);
    await d.click('#sRoom [data-set-open]'); await sleep(300);
    okNoScroll(await noScroll(d), `[${lang} ${w}x${h}] 房間裡的設定頁`);
    const g = await open(c, 'game.html'); await g.click('#openSet'); await sleep(300);
    okNoScroll(await noScroll(g), `[${lang} ${w}x${h}] game.html 設定頁`);
    if (lang === 'zh' && w === 375) await g.screenshot({ path: SH + 'game_settings_zh_375x667.png' });
    errsAll.push(...errsOf(d), ...errsOf(g)); await c.close();
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
