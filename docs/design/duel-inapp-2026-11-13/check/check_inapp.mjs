// 兩儀殿「內建瀏覽器提示」檢查：node check_inapp.mjs（前景執行）。NEG=1 時把一項期望故意改錯，確認會 FAIL。
// 自己起停 http.server 8793（頁面）與 wrangler dev 8789（兩儀殿，自己的 persist 資料夾）；只用 PID 關自己啟動的行程。
// 注意：UA 是用字串假裝，真實的 LINE / Facebook App 沒辦法在這台電腦測。
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const { sleep } = L;
const VCF = 'C:/claudehome/projects/VCF', BASE = L.BASE;
const HERE = 'C:/claudehome/projects/VCF/docs/design/duel-inapp-2026-11-13/check/';
const PERSIST = tmpdir().replace(/\\/g, '/') + '/wstate-inapp';
const NEG = process.env.NEG === '1';
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };
rmSync(PERSIST, { recursive: true, force: true }); mkdirSync(PERSIST, { recursive: true });
const servers = []; let b = null; const errsAll = [];
const killAll = () => { for (const pid of servers) { try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {} } servers.length = 0; L.stopWr(); };

// 假裝各環境的 UA（真實樣式；標明是哪個環境）
const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',   // Android 一般 Chrome
  chromeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',          // 桌機 Chrome
  safariIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',   // iOS Safari
  lineAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Line/14.1.0/IAB',   // LINE Android 內建瀏覽器
  lineIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.5.0',   // LINE iOS 內建瀏覽器
  fbAndroid: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]',   // Facebook Android
  igIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.20.113 (iPhone14,5; iOS 17_4; en_US; en; scale=3.00; 1170x2532; 568974511)',   // Instagram iOS
  wechatIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47(0x18002f2f) NetType/WIFI Language/zh_TW',   // WeChat iOS
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-G991N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 KAKAOTALK 2410540',   // KakaoTalk Android
};
const TXT = {
  zh: { t: '用瀏覽器開啟', note: '這裡是 App 內建的瀏覽器，你的暱稱和紀錄不會跟著過來。', open: '用瀏覽器開啟', stay: '先在這裡玩', ios: '點右上角 ⋯ → 用瀏覽器開啟', copy: '複製連結', code: '邀請碼：' },
  en: { t: 'Open in your browser', note: 'This is an in-app browser. Your nickname and records won\'t carry over.', open: 'Open in browser', stay: 'Play here for now', ios: 'Tap ⋯ at the top right → Open in browser', copy: 'Copy link', code: 'Invite code: ' },
  ja: { t: 'ブラウザで開く', note: 'アプリ内ブラウザです。ニックネームや記録は引き継がれません。', open: 'ブラウザで開く', stay: 'ここで遊ぶ', ios: '右上の ⋯ →「ブラウザで開く」', copy: 'リンクをコピー', code: '招待コード：' },
  ko: { t: '브라우저로 열기', note: '앱 내장 브라우저입니다. 닉네임과 기록이 이어지지 않습니다.', open: '브라우저로 열기', stay: '여기서 먼저 하기', ios: '오른쪽 위 ⋯ → 브라우저로 열기', copy: '링크 복사', code: '초대 코드: ' },
};
const errs = (p) => p.errs.filter((e) => !/Failed to load resource|ERR_|Failed to launch 'intent:/.test(e));
async function mkPage(ua, { lang = 'zh', w = 375, h = 667, nick = 'Cat', path = 'duel.html', nav = false } = {}) {
  const c = await b.newContext({ userAgent: ua, viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await c.addInitScript(([lang, nick]) => {
    const W = window.WebSocket; window.__sent = [];
    window.WebSocket = function (u, p) {
      const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__ws = ws;
      const s0 = ws.send.bind(ws); ws.send = (d) => { window.__sent.push(String(d)); return s0(d); };
      return ws;
    };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    try {
      if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('vcfgame.lang', lang); localStorage.setItem('vcfgame.duel.tap', '1'); localStorage.setItem('vcfgame.nick', nick); }
    } catch {}
    window.__clip = null;
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true }); } catch {}
  }, [lang, nick]);
  const p = await c.newPage(); p.ctx = c; p.navs = [];
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  if (nav) {   // 抓導向目標（含 intent:// 這種瀏覽器不會真的去的網址）
    const cdp = await c.newCDPSession(p); await cdp.send('Page.enable');
    cdp.on('Page.frameRequestedNavigation', (e) => p.navs.push(e.url));
    await p.route((u) => /openExternalBrowser/.test(u.href) && u.pathname.endsWith('duel.html'), (r) => r.abort());
  }
  await p.goto(BASE + '/' + path);
  await sleep(1000);
  return p;
}
const panel = (p) => p.evaluate(() => {
  const m = document.getElementById('mInApp'), vis = (el) => !!el && !el.hidden && el.offsetParent !== null;
  const box = m.querySelector('.box').getBoundingClientRect();
  const tx = (id) => (vis(document.getElementById(id)) ? document.getElementById(id).textContent : null);
  return { shown: !m.hidden, t: document.getElementById('mInAppT').textContent, note: m.querySelector('[data-i18n=abNote]').textContent, open: tx('abOpen'), ios: tx('abIos'), copy: tx('abCopy'), stay: tx('abStay'),
    sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, box: { t: box.top, b: box.bottom, l: box.left, r: box.right } };
});
const wsSend = (p, o) => p.evaluate((s) => window.__ws.send(s), JSON.stringify(o));
const dRoom = (p) => p.evaluate(() => { const d = window.__duel, r = d.room; return r ? { id: r.id, code: r.code, state: r.state, seat: d.mySeat(), log: r.match ? r.match.log.length : 0 } : null; });
const waitRoom = (p, fn, arg, ms = 12000) => p.waitForFunction(fn, arg, { timeout: ms });
async function newRoom(A) {
  await wsSend(A, { t: 'leave' }); await sleep(400);
  await wsSend(A, { t: 'create', kind: 'gomoku', time: 'none', rule: 'free', priv: false, color: 'b' });
  await waitRoom(A, () => window.__duel.room && window.__duel.room.state === 'wait');
  return dRoom(A);
}

try {
  servers.push(spawn('python', ['-m', 'http.server', '8793', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid);
  await L.startWr(PERSIST); await sleep(800);
  b = await L.launch();

  // ===== 1. 一般環境：沒有面板 =====
  console.log('== 1. 一般瀏覽器沒有面板');
  for (const [name, ua] of [['Android Chrome', UA.chromeAndroid], ['桌機 Chrome', UA.chromeDesktop], ['iOS Safari', UA.safariIOS]]) {
    const p = await mkPage(ua);
    const s = await panel(p);
    const neg = NEG && name === 'Android Chrome';
    ok(s.shown === neg, `${name}：面板${neg ? '（NEG：故意期望有）' : '不出現'}`);
    errsAll.push(...errs(p)); await p.ctx.close();
  }

  // ===== 2. 內建瀏覽器：面板與按鈕組合 =====
  console.log('== 2. 內建瀏覽器面板（四語）');
  const cases = [
    ['LINE Android', UA.lineAndroid, { open: true, ios: false, copy: false }],
    ['LINE iOS', UA.lineIOS, { open: true, ios: false, copy: false }],
    ['Facebook Android', UA.fbAndroid, { open: true, ios: false, copy: false }],
    ['Instagram iOS', UA.igIOS, { open: false, ios: true, copy: true }],
    ['WeChat iOS', UA.wechatIOS, { open: false, ios: true, copy: true }],
    ['KakaoTalk Android', UA.kakaoAndroid, { open: true, ios: false, copy: false }],
  ];
  for (const lang of ['zh', 'en', 'ja', 'ko']) {
    for (const [name, ua, want] of cases) {
      const p = await mkPage(ua, { lang }); const s = await panel(p); const t = TXT[lang];
      const good = s.shown && s.t === t.t && s.note === t.note && s.stay === t.stay
        && (want.open ? s.open === t.open : s.open === null) && (want.ios ? s.ios === t.ios : s.ios === null) && (want.copy ? s.copy === t.copy : s.copy === null);
      ok(good, `${lang} ${name}：面板出現、文字與按鈕組合正確（open=${s.open} ios=${s.ios} copy=${s.copy} stay=${s.stay}）`);
      errsAll.push(...errs(p)); await p.ctx.close();
    }
  }

  // ===== 3. 不捲動、面板在畫面內 =====
  console.log('== 3. 不捲動、面板完整在畫面內');
  for (const [w, h] of [[375, 667], [360, 640]]) for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [name, ua] of [['LINE Android', UA.lineAndroid], ['Instagram iOS', UA.igIOS]]) {
    const p = await mkPage(ua, { lang, w, h }); const s = await panel(p);
    ok(s.sh <= s.ih && s.sw <= s.iw && s.box.t >= 0 && s.box.b <= s.ih + 0.5 && s.box.l >= 0 && s.box.r <= s.iw + 0.5, `${w}×${h} ${lang} ${name}：sh ${s.sh}/${s.ih} sw ${s.sw}/${s.iw} 面板 top ${Math.round(s.box.t)} bottom ${Math.round(s.box.b)}`);
    if (w === 375 && lang === 'zh' && name === 'LINE Android') await p.screenshot({ path: HERE + 'shot_line_android_zh_375.png' });
    if (w === 375 && lang === 'zh' && name === 'Instagram iOS') await p.screenshot({ path: HERE + 'shot_ig_ios_zh_375.png' });
    errsAll.push(...errs(p)); await p.ctx.close();
  }
  { const p = await mkPage(UA.fbAndroid, { lang: 'en', w: 360, h: 640 }); await p.screenshot({ path: HERE + 'shot_fb_android_en_360.png' }); await p.ctx.close(); }

  // ===== 4. 邀請：A 開房 =====
  console.log('== 4. 邀請連結與分享文字（A 開房）');
  const A = await mkPage(UA.chromeAndroid, { nick: 'Alice' });
  let room = await newRoom(A); let code = room.code;
  ok(/^[A-Z0-9]{6}$/.test(code), `A 開房，邀請碼 ${code}`);
  for (const lang of ['zh', 'en', 'ja', 'ko']) {
    await A.evaluate((l) => { document.getElementById('langBtn').click(); document.querySelector(`[data-lang=${l}]`).click(); }, lang);
    await sleep(200);
    await A.click('#rInvite'); await sleep(200);
    await A.evaluate(() => { window.__clip = null; }); await A.click('#invCopy'); await sleep(250);
    const clip = await A.evaluate(() => window.__clip);
    ok(clip && clip.includes('openExternalBrowser=1') && clip.includes(TXT[lang].code + code) && clip.includes('r=' + code), `${lang} 複製的內容含「${TXT[lang].code}${code}」與 openExternalBrowser=1`);
    ok(clip && clip.indexOf(TXT[lang].code) < clip.indexOf('http'), `${lang} 邀請碼那行在網址之前`);
    if (lang === 'zh') console.log('  例（zh）：' + JSON.stringify(clip));
    await A.evaluate(() => { document.getElementById('mInvite').hidden = true; });
  }
  await A.evaluate(() => { document.getElementById('langBtn').click(); document.querySelector('[data-lang=zh]').click(); });
  await sleep(200);
  ok((await A.evaluate(() => document.querySelector('[data-i18n=inviteNote]').textContent)).includes('不用安裝、不用註冊'), 'inviteNote 仍有「不用安裝、不用註冊」');

  // ===== 5. 網址帶 r + openExternalBrowser =====
  console.log('== 5. 一般瀏覽器帶 ?r=…&openExternalBrowser=1&lang=en 進頁');
  const B = await mkPage(UA.chromeDesktop, { nick: 'Bob', path: `duel.html?r=${code}&openExternalBrowser=1&lang=en` });
  await waitRoom(B, (c) => window.__duel.room && window.__duel.room.code === c, code);
  const url1 = await B.evaluate(() => location.search);
  ok(!/[?&]r=/.test(url1) && !/openExternalBrowser/.test(url1) && url1.includes('lang=en'), `自動進房；網址只剩「${url1}」`);
  ok(!(await panel(B)).shown, '一般瀏覽器沒有面板');
  await wsSend(B, { t: 'sit', room: room.id, seat: 1 });
  await waitRoom(A, () => window.__duel.room.state === 'play'); await waitRoom(B, () => window.__duel.room.state === 'play');
  ok(true, 'B 入座，開局');
  const B2 = await mkPage(UA.chromeDesktop, { nick: 'Cy', path: 'duel.html?openExternalBrowser=1&lang=en' });
  const q2 = await B2.evaluate(() => location.search);
  ok(!/openExternalBrowser/.test(q2), '只帶 openExternalBrowser（沒有 r）也被拿掉：「' + q2 + '」');
  await B2.ctx.close();
  await wsSend(A, { t: 'move', p: 112 }); await waitRoom(A, () => window.__duel.room.match.log.length === 1);
  await wsSend(B, { t: 'move', p: 33 }); await waitRoom(A, () => window.__duel.room.match.log.length === 2);
  ok(true, '既有流程：各下一手（log 2）');
  errsAll.push(...errs(B)); await B.ctx.close();

  // ===== 6. 內建瀏覽器帶 r：先在這裡玩 =====
  console.log('== 6. 內建瀏覽器帶 ?r= 進頁，按「先在這裡玩」');
  room = await newRoom(A); code = room.code;
  const C = await mkPage(UA.lineAndroid, { nick: 'Cleo', path: `duel.html?r=${code}&lang=zh` });
  const s6 = await panel(C);
  ok(s6.shown && s6.open === '用瀏覽器開啟', '面板出現（LINE Android）');
  await waitRoom(C, (c) => window.__duel.room && window.__duel.room.code === c, code);
  ok(true, '面板還開著時，join 已經照常完成（人在房裡）');
  await C.click('#abStay'); await sleep(200);
  ok(!(await panel(C)).shown, '按「先在這裡玩」面板關掉');
  ok((await dRoom(C)).code === code, '人在房間裡');
  await wsSend(C, { t: 'sit', room: room.id, seat: 1 });
  await waitRoom(C, () => window.__duel.room.state === 'play'); await waitRoom(A, () => window.__duel.room.state === 'play');
  ok(true, '能入座，開局');
  await C.reload(); await sleep(1200);
  ok(!(await panel(C)).shown, '關掉面板後重新整理：同一分頁不再出現');
  errsAll.push(...errs(C)); await C.ctx.close();

  // ===== 7. 按主按鈕的導向 =====
  console.log('== 7. 主按鈕導向');
  room = await newRoom(A); code = room.code;
  const D = await mkPage(UA.fbAndroid, { lang: 'en', nick: 'Dee', path: `duel.html?r=${code}&lang=en`, nav: true });
  await waitRoom(D, (c) => window.__duel.room && window.__duel.room.code === c, code);
  ok(!/[?&]r=/.test(await D.evaluate(() => location.search)), '進頁後網址的 r 已被 replaceState 拿掉');
  await D.click('#abOpen'); await sleep(600);
  const intent = D.navs.find((u) => u.startsWith('intent://'));
  console.log('  intent 目標：' + intent);
  ok(!!intent && intent.includes('package=com.android.chrome') && intent.includes('S.browser_fallback_url=') && intent.startsWith('intent://127.0.0.1:8793/duel.html?r=' + code), 'Facebook Android：intent:// 開頭、package=com.android.chrome、帶 browser_fallback_url、r 正確');
  ok(!!intent && decodeURIComponent(intent.split('S.browser_fallback_url=')[1].split(';end')[0]) === `${BASE}/duel.html?r=${code}&lang=en`, 'browser_fallback_url 解碼＝原網址（帶 r、lang）');
  errsAll.push(...errs(D)); await D.ctx.close();
  room = await newRoom(A); code = room.code;
  const E = await mkPage(UA.lineAndroid, { lang: 'ja', nick: 'Eve', path: `duel.html?r=${code}&lang=ja`, nav: true });
  await waitRoom(E, (c) => window.__duel.room && window.__duel.room.code === c, code);
  await E.click('#abOpen'); await sleep(600);
  const ln = E.navs.find((u) => /openExternalBrowser/.test(u));
  console.log('  LINE 目標：' + ln);
  ok(!!ln && ln.includes('openExternalBrowser=1') && ln.includes('r=' + code) && ln.includes('lang=ja'), 'LINE Android：目標網址含 openExternalBrowser=1、r、lang');
  errsAll.push(...errs(E)); await E.ctx.close();
  room = await newRoom(A); code = room.code;
  const F = await mkPage(UA.igIOS, { nick: 'Fay', path: `duel.html?r=${code}&lang=zh` });
  await waitRoom(F, (c) => window.__duel.room && window.__duel.room.code === c, code);
  await F.click('#abCopy'); await sleep(250);
  const cp = await F.evaluate(() => window.__clip);
  ok(cp === `${BASE}/duel.html?r=${code}&lang=zh`, 'iOS Instagram「複製連結」複製含 r 的完整網址：' + cp);
  errsAll.push(...errs(F)); await F.ctx.close();

  // ===== 8. 既有流程：從大廳入座 =====
  console.log('== 8. 公開房一般流程（大廳入座、各下一手）');
  room = await newRoom(A);
  const G = await mkPage(UA.chromeDesktop, { nick: 'Gus' });
  await wsSend(G, { t: 'view', room: room.id }); await waitRoom(G, (id) => window.__duel.room && window.__duel.room.id === id, room.id);
  await wsSend(G, { t: 'sit', room: room.id, seat: 1 });
  await waitRoom(A, () => window.__duel.room.state === 'play'); await waitRoom(G, () => window.__duel.room.state === 'play');
  await wsSend(A, { t: 'move', p: 112 }); await waitRoom(G, () => window.__duel.room.match.log.length === 1);
  await wsSend(G, { t: 'move', p: 33 }); await waitRoom(A, () => window.__duel.room.match.log.length === 2);
  ok(true, '開房→大廳入座→各下一手');
  errsAll.push(...errs(A), ...errs(G)); await G.ctx.close(); await A.ctx.close();
  ok(errsAll.length === 0, '全程沒有 pageerror／console error ' + JSON.stringify(errsAll));
} catch (e) {
  console.log('  FAIL 腳本例外：', e && e.stack || e); fail++;
}
try { if (b) await b.close(); } catch {}
killAll();
try { rmSync(PERSIST, { recursive: true, force: true }); } catch {}
console.log(`PASS ${pass}／FAIL ${fail}`);
process.exit(fail ? 1 : 0);
