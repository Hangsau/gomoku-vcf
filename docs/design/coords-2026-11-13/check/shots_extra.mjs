// 補拍：深色盤（夜墨）、圖片盤（星空、泳池）開著座標的截圖，game.html 解題畫面與兩儀殿回看各一張；node shots_extra.mjs（自己起停伺服器）。
import { spawn, execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as H from './h.mjs';
import * as S from './scenes.mjs';
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), SH = HERE + '/shots/', VCF = 'C:/claudehome/projects/VCF', PERSIST = tmpdir() + '/wstate-coords3-' + Date.now();
const pids = [];
const killAll = () => { pids.forEach((p) => { try { execSync(`taskkill /PID ${p} /T /F`, { stdio: 'ignore' }); } catch {} }); pids.length = 0; L.stopWr(); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} };
process.on('exit', killAll);
const ids = ['night', 'starry', 'pool'];
const seed = () => { localStorage.setItem('vcfgame.owned', JSON.stringify(['b:starry', 'b:pool'])); localStorage.setItem('vcfgame.skinsOff', JSON.stringify({ off: { boards: [], stones: [] }, on: { boards: ['starry', 'pool'], stones: [] } })); };
try {
  pids.push(spawn('python', ['-m', 'http.server', '8795', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid);
  pids.push(spawn('python', ['-m', 'http.server', '8791', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid);
  await L.startWr(PERSIST); await H.sleep(3000);
  const b = await H.launch();
  // game.html 解題畫面
  for (const id of ids) {
    const c = await H.mkCtx(b, { w: 360, h: 640, coords: '1' });
    const p = await c.newPage(); await p.goto(H.BASE + '/game.html'); await p.evaluate(seed); await p.reload(); await H.sleep(1200);
    await p.click('#modeP'); await p.click('#go'); await p.waitForFunction(() => g && g.p, null, { timeout: 15000 }); await H.sleep(500);
    const set = await p.evaluate((id) => window.RushSkin.setBoard(id), id); await H.sleep(1000);
    console.log('game', id, set); await p.screenshot({ path: SH + `game_prac_${id}_zh_360x640.png` }); await c.close();
  }
  // 兩儀殿回看
  const rep = await S.makeReplayEntry();
  for (const id of ids) {
    const c = await H.mkCtx(b, { w: 360, h: 640, coords: '1' });
    const p = await c.newPage(); await p.goto(H.BASE + '/duel.html'); await p.evaluate(seed); await p.evaluate((s) => localStorage.setItem('vcfgame.today', s), JSON.stringify([rep]));
    await p.goto(H.BASE + '/duel.html?again=1'); await p.goto(H.BASE + '/duel.html#replay=' + rep.id); await H.sleep(1500);
    const set = await p.evaluate((id) => window.RushSkin.setBoard(id), id); await H.sleep(1000);
    console.log('replay', id, set, await p.evaluate(() => !document.getElementById('sRoom').hidden)); await p.screenshot({ path: SH + `duel_replay_${id}_zh_360x640.png` }); await c.close();
  }
  await b.close();
} finally { killAll(); }
