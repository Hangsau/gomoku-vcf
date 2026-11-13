// 自己的測試環境：http 8841＝現行 VCF、8842＝改動前快照、wrangler 8789。PID 寫進 pids.json，結束時只關這幾個。
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
const PERSIST = tmpdir() + '/wstate-narrow-' + Date.now();
const pids = [];
const stop = () => { pids.forEach((p) => { try { execSync(`taskkill /PID ${p} /T /F`, { stdio: 'ignore' }); } catch {} }); try { rmSync(PERSIST, { recursive: true, force: true }); } catch {} process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const sv = (port, cwd) => pids.push(spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd, stdio: 'ignore', windowsHide: true }).pid);
sv(8841, 'C:/claudehome/projects/VCF'); sv(8842, 'C:/Users/hangs/AppData/Local/Temp/vcf-snap-narrow');
sv(8791, 'C:/claudehome/projects/VCF');   // 題庫（game/p/*.json）：wrangler 抓不到正式站題庫會「nobank」整局取消
const wr = spawn('cmd', ['/c', 'npx', 'wrangler@4.158.0', 'dev', '-c', 'C:/claudehome/projects/VCF/game/duel-server/wrangler.toml', '--ip', '127.0.0.1', '--port', '8789', '--persist-to', PERSIST, '--var', 'BANK_URL:http://127.0.0.1:8791'], { cwd: 'C:/claudehome/projects/VCF', stdio: 'ignore', windowsHide: true });
pids.push(wr.pid);
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 1000)); try { const r = await fetch('http://127.0.0.1:8789/'); if ((await r.text()).includes('rush-duel')) break; } catch {} }
writeFileSync(new URL('./pids.json', import.meta.url), JSON.stringify(pids));
console.log('READY', pids.join(','));
setInterval(() => {}, 1e6);
