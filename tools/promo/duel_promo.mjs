// 兩儀殿「一線天」實戰錄影（可重跑）
//   node C:/claudehome/projects/VCF/tools/promo/duel_promo.mjs            錄影 → docs/promo/無聲原片/duel_line.mp4 ＋ duel_line_時間點.json
//   node C:/claudehome/projects/VCF/tools/promo/duel_promo.mjs probe      只量截圖速度（不開 wrangler）
//
// 做法（照 rush_promo.py 的思路，改用 Node）：
// - 自己起本機 http.server（埠 8795）與 wrangler dev（埠 8797、inspector 9331），只關自己啟動的 PID（taskkill /PID /T）
// - .dev.vars 先備份、BANK_URL 改指 8795，結束一定還原
// - 兩個玩家「黑夜」「白雪」各一個 browser context；只錄黑夜（手機 390x844、DPR 3 → 1170x2532）
// - 錄影＝背景迴圈連續 CDP captureScreenshot（吃 DPR）＋時間戳，結束後 ffmpeg 依時間戳合成 30fps
// - 解答由白雪那頁（不錄影）用遊戲自己的 vSolve 算，黑夜那頁只負責點，錄影不卡頓
// - 不碰線上：頁面的 WebSocket 一律改接本機 8797，並擋掉所有 workers.dev 請求
import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/claudehome/projects/VCF';
const HTTP_PORT = 8795, WS_PORT = 8797, INSPECTOR = 9331;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;
const SCRATCH = process.env.DUEL_SCRATCH || 'C:/Users/hangs/AppData/Local/Temp/claude/01840b1a6fcdd9a6/b023a0c3-5f94-417c-9ab0-7f2590694573/scratchpad/liangyi';
const FFMPEG = 'C:/Users/hangs/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const OUT_DIR = `${ROOT}/docs/promo/無聲原片`;
const OUT_MP4 = `${OUT_DIR}/duel_line.mp4`;
const OUT_JSON = `${OUT_DIR}/duel_line_時間點.json`;
const DEV_VARS = `${ROOT}/game/duel-server/.dev.vars`;
const PROBE = process.argv[2] === 'probe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pids = [];

// ---------------------------------------------------------------- 起停
function killTree(pid) { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); }

async function waitHttp(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(500);
  }
  throw new Error('等不到 ' + url);
}

// ---------------------------------------------------------------- 錄影器
class Recorder {
  constructor(cdp, dir) { this.cdp = cdp; this.dir = dir; this.frames = []; this.marks = []; this.running = false; this.t0 = 0; }
  now() { return performance.now() / 1000; }
  vt() { return this.now() - this.t0; }
  mark(name, extra) { const t = +this.vt().toFixed(2); this.marks.push({ name, t, ...(extra || {}) }); console.log('  MARK', name, t); return t; }
  async grab() {
    const a = this.now();
    const r = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 390, height: 844, scale: 3 } });
    const b = this.now();
    return { t: (a + b) / 2 - this.t0, buf: Buffer.from(r.data, 'base64') };
  }
  async start() {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const f of fs.readdirSync(this.dir)) fs.unlinkSync(path.join(this.dir, f));
    this.t0 = this.now(); this.running = true;
    this.task = (async () => {
      while (this.running) {
        try { const f = await this.grab(); const i = this.frames.length; fs.writeFileSync(path.join(this.dir, `f${String(i).padStart(5, '0')}.jpg`), f.buf); this.frames.push(f.t); }
        catch (e) { await sleep(20); }
      }
    })();
  }
  async stop(tail = 0.3) {
    await sleep(tail * 1000);
    this.running = false; await this.task;
    return this.vt();
  }
  render(mp4) {
    const lines = [];
    const fr = this.frames;
    for (let i = 0; i < fr.length; i++) {
      const p = path.join(this.dir, `f${String(i).padStart(5, '0')}.jpg`).replace(/\\/g, '/');
      lines.push(`file '${p}'`);
      if (i + 1 < fr.length) lines.push(`duration ${Math.max(fr[i + 1] - fr[i], 0.001).toFixed(4)}`);
    }
    // 第一格以前的時間（t0 到第一格）算進第一格，確保影片秒數＝錄影秒數
    const lst = path.join(this.dir, 'list.txt');
    fs.writeFileSync(lst, lines.join('\n') + '\n');
    const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
      '-vf', 'fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-r', '30',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit', timeout: 600000 });
    if (r.status) throw new Error('ffmpeg 合成失敗');
  }
}

// ---------------------------------------------------------------- 頁面操作（沿用 docs/design/duel-modes-2026-11-12/check/lib.mjs 的做法）
async function mk(browser, { nick, w = 390, h = 844, dpr = 3 }, blocked) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'zh-TW', serviceWorkers: 'block' });
  await ctx.addInitScript(([nick, wsPort]) => {
    const W = window.WebSocket;
    window.WebSocket = function (u, p) { return new W(String(u).replace(':8787/', ':' + wsPort + '/'), p); };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    localStorage.setItem('vcfgame.lang', 'zh');
    localStorage.setItem('vcfgame.duel.tap', '1');
    localStorage.setItem('vcfgame.nick', nick);
    localStorage.setItem('vcfgame.sound', '0');
  }, [nick, WS_PORT]);
  // 保險：任何不是本機的請求（含線上 workers.dev）一律擋掉並記下
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (/^(http|ws)s?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    blocked.push(u); return r.abort();
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE + '/duel.html');
  await sleep(1500);
  return p;
}
const roomOf = (p) => p.evaluate(() => window.__duel.room);
async function waitLive(p, timeout = 20000) {
  await p.waitForFunction(() => { const r = window.__duel.room, v = window.__duel.VR; if (!r || !v || r.state !== 'play') return false; const d = window.__duel, st = r.vs.p[d.mySeat() >= 0 ? d.mySeat() : 0]; return d.vIsLive(st) && !v.hold && !v.out && !v.done; }, null, { timeout });
}
async function clickT(p, t) {
  const pt = await p.evaluate((t) => { const d = window.__duel; const [x, y] = d.xyOf(d.tToP(t)); const r = d.cv.getBoundingClientRect(); return [r.left + x, r.top + y]; }, t);
  await p.mouse.click(pt[0], pt[1]);
}
const parseSol = (raw) => String(raw).replace(/\(.*\)/, '').trim().split(/\s+/).filter(Boolean);
async function solveCur(p) {
  const raw = await p.evaluate(async () => { const v = window.__duel.VR; const q = v.p; const r = await window.__duel.vSolve(q.black.join(' '), q.white.join(' '), q.atkWhite); return r.result && r.result.solution; });
  return parseSol(raw);
}
async function waitPhase(p, ph, t = 15000) { await p.waitForFunction((ph) => { const r = window.__duel.room; return r && r.vs && r.vs.phase === ph; }, ph, { timeout: t }); }
async function waitRound(p, i, t = 20000) { await p.waitForFunction((i) => { const r = window.__duel.room; return r && r.vs && r.vs.p[0].i === i && r.vs.p[1].i === i && r.vs.phase === 'play' && r.state === 'play'; }, i, { timeout: t }); }
async function waitScore(p, a, b, t = 15000) { await p.waitForFunction(([a, b]) => { const r = window.__duel.room; return r && r.vs && r.vs.score[0] + r.vs.score[1] >= a + b; }, [a, b], { timeout: t }); }

// 依 sol 一手一手點（攻方 = sol 偶數位），回傳最後一手落下的錄影秒數
async function playSol(p, sol, pace, rec, onFinal) {
  let n = 0;
  for (let k = 0; k < sol.length; k += 2) {
    await p.waitForFunction(() => { const v = window.__duel.VR; return v && (!v.hold || v.done || v.out); }, null, { timeout: 10000 });
    if (await p.evaluate(() => window.__duel.VR.done || !!window.__duel.VR.out)) break;
    await sleep(rnd(pace[0], pace[1]) * 1000);
    await clickT(p, sol[k]); n++;
    if (k + 2 >= sol.length && onFinal) onFinal();
    await p.waitForFunction((n) => { const v = window.__duel.VR; return !v || v.done || v.out || v.moves.length >= n; }, n, { timeout: 10000 });
  }
}

// ---------------------------------------------------------------- 主流程
async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const report = { pids: [], blocked: [], notes: [] };
  let devVarsBackup = null, srv = null, wr = null, browser = null;
  try {
    // 1. 本機站
    srv = spawn('python', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
    pids.push(srv.pid); console.log('http.server PID', srv.pid, '埠', HTTP_PORT);
    await waitHttp(BASE + '/duel.html');
    if (!PROBE) {
      // 2. wrangler dev（先備份 .dev.vars）
      devVarsBackup = fs.existsSync(DEV_VARS) ? fs.readFileSync(DEV_VARS) : null;
      fs.writeFileSync(DEV_VARS, `BANK_URL=${BASE}\n`);
      const log = fs.openSync(path.join(SCRATCH, 'wrangler.log'), 'w');
      wr = spawn('cmd.exe', ['/c', 'npx', 'wrangler@4.158.0', 'dev', '-c', 'game/duel-server/wrangler.toml', '--ip', '127.0.0.1', '--port', String(WS_PORT),
        '--inspector-port', String(INSPECTOR), '--persist-to', path.join(SCRATCH, 'wr-state')], { cwd: ROOT, stdio: ['ignore', log, log], windowsHide: true });
      pids.push(wr.pid); console.log('wrangler(cmd) PID', wr.pid, '埠', WS_PORT);
      await waitHttp(`http://127.0.0.1:${WS_PORT}/`, 120000);
    }
    // 3. 瀏覽器
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const A = await mk(browser, { nick: '黑夜' }, report.blocked);          // 錄這個
    if (PROBE) {
      const cdp = await A.context().newCDPSession(A);
      const rec = new Recorder(cdp, path.join(SCRATCH, 'probe_frames'));
      await rec.start(); await sleep(5000); const d = await rec.stop();
      const sz = fs.statSync(path.join(SCRATCH, 'probe_frames', 'f00001.jpg')).size;
      console.log(`PROBE ${rec.frames.length} 格 / ${d.toFixed(1)} 秒 = ${(rec.frames.length / d).toFixed(1)} fps，單格 ${sz} bytes`);
      return report;
    }
    const B = await mk(browser, { nick: '白雪', dpr: 1 }, report.blocked);
    // 4. 開房（不錄）：一線天、初段、目標 3 分、每題 3 分鐘
    await A.click('#openCreate'); await sleep(300);
    await A.click('#cKind button[data-v="vcf"]');
    await A.click('#cVmode button[data-v="line"]');
    while (!(await A.evaluate(() => document.getElementById('vRkDown').disabled))) { await A.click('#vRkDown'); await sleep(60); }
    await A.click('#cTarget button[data-v="3"]');
    await A.click('#cThink button[data-v="180"]');
    const rankTxt = await A.textContent('#vRkName');
    await A.click('#doCreate'); await sleep(800);
    const room0 = await roomOf(A);
    console.log('房間', room0.id, 'vmode', room0.vcf.vmode, 'rank', rankTxt, 'target', room0.vcf.target);
    report.room = { id: room0.id, vmode: room0.vcf.vmode, rank: rankTxt, target: room0.vcf.target, think: room0.vcf.think };
    await sleep(500);
    // 白雪先進大廳看到房間；等會兒才坐下
    await B.waitForSelector(`[data-room="${room0.id}"]`, { timeout: 15000 });
    await B.click(`[data-room="${room0.id}"]`); await sleep(500);

    // 5. 開始錄影（黑夜在等人的房間）
    const cdp = await A.context().newCDPSession(A);
    const rec = new Recorder(cdp, path.join(SCRATCH, 'frames'));
    await rec.start();
    await sleep(1800);
    await B.click('[data-sit]');
    rec.mark('countdown_start');
    // 偵測進入第 0 題可下
    const rounds = [{ who: 'A' }, { who: 'B' }, { who: 'A' }, { who: 'A' }];
    for (let r = 0; r < rounds.length; r++) {
      if (r === 0) await waitRound(A, 0, 30000); else await waitRound(A, r, 30000);
      await Promise.all([waitLive(A, 30000), waitLive(B, 30000)]);
      rec.mark(`q${r + 1}_start`);
      const sol = await solveCur(B);                 // 解答由白雪那頁算（同一題）
      report.notes.push(`q${r + 1} 解 ${sol.join(' ')}`);
      if (rounds[r].who === 'A') {
        await sleep(1500);                           // 讓畫面停一下像在讀題
        await playSol(A, sol, [0.45, 0.62], rec, () => { });
        rec.mark(`q${r + 1}_solve`);
        if (r < rounds.length - 1) { await waitPhase(A, 'reveal'); rec.mark(`q${r + 1}_reveal`); }
      } else {
        await sleep(3000);                           // 黑夜看著題目、白雪先解開
        await playSol(B, sol, [0.28, 0.4], rec, null);
        rec.mark(`q${r + 1}_solve_opp`);
        await waitPhase(A, 'reveal'); rec.mark(`q${r + 1}_reveal`);
      }
      if (r < rounds.length - 1) await sleep(300);
    }
    // 6. 結果畫面
    await A.waitForFunction(() => window.__duel.room.state === 'over', null, { timeout: 15000 });
    await A.waitForFunction(() => { const m = document.getElementById('mEnd'); return m && !m.hidden; }, null, { timeout: 8000 }).catch(() => report.notes.push('mEnd 沒有出現'));
    rec.mark('result');
    const endTitle = await A.textContent('#endTitle').catch(() => null), endWhy = await A.textContent('#endWhy').catch(() => null);
    report.end = { endTitle, endWhy, score: await A.evaluate(() => window.__duel.room.vs.score) };
    console.log('結果', endTitle, endWhy, report.end.score);
    await sleep(3500);
    const dur = await rec.stop(0.2);
    report.errors = [...A.errs, ...B.errs];
    await browser.close(); browser = null;
    // 7. 合成
    fs.mkdirSync(OUT_DIR, { recursive: true });
    rec.render(OUT_MP4);
    const meta = { file: 'duel_line.mp4', duration: +dur.toFixed(2), frames_captured: rec.frames.length, capture_fps: +(rec.frames.length / dur).toFixed(1),
      viewport: '390x844 DPR3', marks: rec.marks, report: { room: report.room, end: report.end, notes: report.notes, blocked_requests: report.blocked, js_errors: report.errors } };
    fs.writeFileSync(OUT_JSON, JSON.stringify(meta, null, 1));
    console.log('完成', OUT_MP4, dur.toFixed(1), '秒');
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
    if (wr) killTree(wr.pid);
    if (srv) killTree(srv.pid);
    if (!PROBE) {
      if (devVarsBackup) fs.writeFileSync(DEV_VARS, devVarsBackup); else if (fs.existsSync(DEV_VARS)) fs.unlinkSync(DEV_VARS);
      console.log('.dev.vars 已還原');
    }
    console.log('已關閉我啟動的 PID:', pids.join(', '));
  }
  return report;
}

main().then(() => process.exit(0)).catch((e) => { console.error('失敗', e); process.exit(1); });
