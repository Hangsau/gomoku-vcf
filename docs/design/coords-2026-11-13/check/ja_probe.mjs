// 排查 ja 320x568 五子棋對局基準與現況不同：同一情境在舊快照（8796）與現行（8795）各量多次，看是不是版面本身不穩。
import { spawn, execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as H from './h.mjs';
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
const VCF = 'C:/claudehome/projects/VCF', SNAP = 'C:/Users/hangs/AppData/Local/Temp/vcf-snap-coords', PERSIST = tmpdir() + '/wstate-coords4-' + Date.now();
const pids = []; const killAll = () => { pids.forEach((p) => { try { execSync(`taskkill /PID ${p} /T /F`, { stdio: 'ignore' }); } catch {} }); pids.length = 0; L.stopWr(); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} };
process.on('exit', killAll);
const sv = (port, cwd) => pids.push(spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd, stdio: 'ignore', windowsHide: true }).pid);
try {
  sv(8795, VCF); sv(8796, SNAP); sv(8791, VCF); await L.startWr(PERSIST); await H.sleep(3000);
  const b = await H.launch();
  for (const [tag, port] of Array.from({ length: 16 }, (_, i) => (i % 2 ? ['新', 8795] : ['舊', 8796]))) {
    for (const lang of ['ja']) {
      process.env.BASE_URL = `http://127.0.0.1:${port}`;
      const cA = await b.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' }), cB = await b.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });
      const mk = async (c, nick) => { await c.route('**/vcf-game-api.psyhangsau.workers.dev/**', (r) => r.abort()); await c.addInitScript(([lang, nick]) => { const W = window.WebSocket; window.WebSocket = function (u, p) { const ws = new W(String(u).replace(':8787/', ':8789/'), p); window.__ws = ws; return ws; }; window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); if (!localStorage.getItem('__s')) { localStorage.setItem('__s', '1'); localStorage.setItem('vcfgame.lang', lang); localStorage.setItem('vcfgame.nick', nick); localStorage.setItem('vcfgame.duel.tap', '1'); } }, [lang, nick]); const p = await c.newPage(); await p.goto(`http://127.0.0.1:${port}/duel.html`); await p.waitForFunction(() => window.__ws && window.__ws.readyState === 1, null, { timeout: 15000 }); await H.sleep(800); return p; };
      const A = await mk(cA, 'Alice'), B = await mk(cB, 'Bob');
      await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
      await A.setViewportSize({ width: 320, height: 568 }); await H.sleep(600);
      const m1 = await H.meas(A, 'duel'); await H.sleep(1500); const m2 = await H.meas(A, 'duel');
      const info = await A.evaluate(() => ({ tight: document.getElementById('sRoom').classList.contains('tight'), kids: [...document.getElementById('sRoom').children].filter((e) => !e.hidden && e.offsetParent).map((e) => (e.id || e.className).toString().slice(0, 10) + ':' + Math.round(e.getBoundingClientRect().height)).join(' '), status: document.getElementById('status').textContent.slice(0, 14) }));
      console.log(tag, lang, '立刻', JSON.stringify(m1.cv), '1.5s後', JSON.stringify(m2.cv), JSON.stringify(info));
      await cA.close(); await cB.close();
    }
  }
  await b.close();
} finally { killAll(); }
