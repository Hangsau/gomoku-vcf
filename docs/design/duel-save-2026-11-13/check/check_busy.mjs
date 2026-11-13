// tools/duel_busy.mjs 對本機伺服器驗三種情況＋--wait＋連不上：node check_busy.mjs（前景，約 1 分鐘）。自己起停 wrangler dev 8797，只關自己的 PID。
import { spawn, execSync, spawnSync } from 'node:child_process';
const busyAsync = (url, ...a) => new Promise((res) => { const c = spawn('node', ['C:/claudehome/projects/VCF/tools/duel_busy.mjs', '--url', url, ...a], { windowsHide: true }); let o = '', e = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => (e += d)); c.on('close', (st) => { console.log(o.split('\n').filter(Boolean).map((l) => '    | ' + l).join('\n') + (e ? '\n    ! ' + e.trim() : '')); res({ status: st, stdout: o }); }); });   // --wait 要非同步跑，不然擋住測試自己的認輸計時器
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const VCF = 'C:/claudehome/projects/VCF', URL_ = 'ws://127.0.0.1:8797/ws', P = tmpdir() + '/wstate-busy-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
mkdirSync(P, { recursive: true });
const wr = spawn('cmd', ['/c', 'npx', 'wrangler@4.158.0', 'dev', '-c', VCF + '/game/duel-server/wrangler.toml', '--ip', '127.0.0.1', '--port', '8797', '--persist-to', P], { stdio: 'ignore', windowsHide: true }).pid;
const busy = (...a) => { const r = spawnSync('node', [VCF + '/tools/duel_busy.mjs', '--url', URL_, ...a], { encoding: 'utf8', timeout: 120000 }); console.log(r.stdout.split('\n').filter(Boolean).map((l) => '    | ' + l).join('\n') + (r.stderr ? '\n    ! ' + r.stderr.trim() : '')); return r; };
const mk = async (n) => { const ws = new WebSocket(`${URL_}?v=2&id=bz${n}abcdefghij&nick=${n}`); const c = { ws, m: [], send: (o) => ws.send(JSON.stringify(o)) }; ws.onmessage = (e) => c.m.push(JSON.parse(e.data)); await new Promise((r) => (ws.onopen = r)); return c; };
const room = (c) => c.m.filter((x) => x.t === 'room').at(-1)?.room;
try {
  for (let i = 0; i < 60; i++) { await sleep(1000); try { const r = await fetch('http://127.0.0.1:8797/'); if ((await r.text()).includes('rush-duel')) break; } catch {} }
  console.log('== 沒有房');
  let r = busy(); ok(r.status === 0 && /沒有人在對局/.test(r.stdout) && /房間 0 間/.test(r.stdout), `exit ${r.status}`);
  const A = await mk('A'), B = await mk('B'); await sleep(300);
  A.send({ t: 'create', kind: 'gomoku', time: 'none', rule: 'free', priv: false, color: 'b' }); await sleep(500);
  console.log('== 有房等人');
  r = busy(); ok(r.status === 0 && /等人/.test(r.stdout) && /座位 1\/2/.test(r.stdout) && /線上人數：3/.test(r.stdout), `exit ${r.status}（線上 3＝A、B、這次查詢）`);
  const id = room(A).id; B.send({ t: 'view', room: id }); await sleep(300); B.send({ t: 'sit', room: id, seat: 1 }); await sleep(600);
  console.log('== 有房對局中');
  r = busy(); ok(r.status === 1 && /對局中/.test(r.stdout) && /先不要部署/.test(r.stdout), `exit ${r.status}`);
  console.log('== --wait：另一邊 B 在 25 秒後認輸，對局結束後回 0');
  setTimeout(() => B.send({ t: 'resign' }), 25000);
  const t0 = Date.now(); r = await busyAsync(URL_, '--wait', '120');
  ok(r.status === 0 && /結束/.test(r.stdout) && Date.now() - t0 > 20000 && Date.now() - t0 < 60000, `exit ${r.status}、花了 ${Math.round((Date.now() - t0) / 1000)} 秒（每 20 秒查一次，第 2 次才看到結束）`);
  console.log('== --wait 逾時：再開一局，--wait 3 應回 1');
  A.send({ t: 'again' }); B.send({ t: 'again' }); await sleep(800);
  r = await busyAsync(URL_, '--wait', '3'); ok(r.status === 1 && /仍有人在對局/.test(r.stdout), `exit ${r.status}`);
  console.log('== 唯讀：這些查詢沒有改變任何房間');
  await sleep(300); ok(room(A).state === 'play' && room(A).seats.every(Boolean), '房間還是對局中、兩個座位都在');
  console.log('== 連不上');
  r = spawnSync('node', [VCF + '/tools/duel_busy.mjs', '--url', 'ws://127.0.0.1:1/ws'], { encoding: 'utf8', timeout: 30000 }); console.log('    | ' + (r.stderr || r.stdout).trim());
  ok(r.status === 2, `exit ${r.status}`);
  A.ws.close(); B.ws.close();
} catch (e) { console.log('  FAIL 例外：' + (e.stack || e)); fail++; }
finally { try { execSync(`taskkill /PID ${wr} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(500); try { rmSync(P, { recursive: true, force: true }); } catch {} console.log(`PASS ${pass}／FAIL ${fail}`); process.exit(fail ? 1 : 0); }
