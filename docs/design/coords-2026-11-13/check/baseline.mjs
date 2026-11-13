// 改動前基準：node baseline.mjs（SMOKE=1 只跑 zh 兩個尺寸，用來除錯）。結果寫 baseline.json。
// 自己起停：http.server 8795（頁面）、8791（題庫）、wrangler dev 8789；只用 PID 關自己啟動的行程。
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as H from './h.mjs';
import * as S from './scenes.mjs';
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const VCF = process.env.ROOT || 'C:/claudehome/projects/VCF', PERSIST = tmpdir() + '/wstate-coords-' + Date.now();
const SMOKE = process.env.SMOKE === '1', ONLY = process.env.ONLY || 'both';
let srv = null, srv2 = null, b = null;
const kill = (pid) => { try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {} };
const killAll = () => { if (srv2) kill(srv2); if (srv) kill(srv); srv = srv2 = null; L.stopWr(); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} };
process.on('exit', killAll);
import { existsSync, readFileSync } from 'node:fs';
const out = (ONLY !== 'both' && existsSync(HERE + '/baseline.json')) ? JSON.parse(readFileSync(HERE + '/baseline.json', 'utf8')) : {};   // ONLY=duel／game 時合併進既有基準
try {
  srv = spawn('python', ['-m', 'http.server', '8795', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  srv2 = spawn('python', ['-m', 'http.server', '8791', '--bind', '127.0.0.1'], { cwd: VCF, stdio: 'ignore', windowsHide: true }).pid;
  await L.startWr(PERSIST); await H.sleep(3000);
  b = await H.launch();
  const langs = SMOKE ? ['zh'] : H.LANGS, vps = SMOKE ? H.VPS.slice(0, 2) : H.VPS;
  if (ONLY !== 'duel') { console.log('== game.html'); await S.gameMatrix(b, ['off'], out, { langs, vps }); }
  if (ONLY !== 'game') { console.log('== duel.html'); for (const k of Object.keys(out)) if (/^(duel|fail\|duel|errs\|duel|info\|duel)/.test(k)) delete out[k]; const rep = await S.makeReplayEntry(); await S.duelMatrix(b, ['off'], out, { langs, vps, replayEntry: rep }); }
  await b.close();
  writeFileSync(HERE + (SMOKE ? '/baseline-smoke.json' : '/baseline.json'), JSON.stringify(out, null, 1));
  console.log('寫入', Object.keys(out).length, '筆');
} finally { killAll(); }
