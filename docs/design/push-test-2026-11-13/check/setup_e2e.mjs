// 建本機測試副本（系統暫存資料夾，不進 repo）：複製 worker，產臨時 VAPID 金鑰放 .dev.vars。用法：node setup_e2e.mjs <輸出資料夾>
// 副本唯一的改動：endpoint 檢查額外放行 http://127.0.0.1（為了用本機假端點；repo 裡的 worker.js 不動）。
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
const out = process.argv[2];
const root = 'C:/claudehome/projects/VCF/';
fs.mkdirSync(out, { recursive: true });
for (const f of ['admin.html', 'scoring.json.txt', 'schema.sql']) fs.copyFileSync(root + 'game/worker/' + f, path.join(out, f));
let w = fs.readFileSync(root + 'game/worker/worker.js', 'utf8');
const needle = '!/^https:\\/\\/[^\\s]+$/.test(s.endpoint)';
if (!w.includes(needle)) throw new Error('找不到 endpoint 檢查');
w = w.replace(needle, '!/^(https:\\/\\/|http:\\/\\/127\\.0\\.0\\.1:)[^\\s]+$/.test(s.endpoint)');
fs.writeFileSync(path.join(out, 'worker.js'), w);
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
fs.writeFileSync(path.join(out, '.dev.vars'), `VAPID_PUBLIC=${pub}\nVAPID_PRIVATE=${JSON.stringify(jwk)}\n`);
fs.writeFileSync(path.join(out, 'wrangler.jsonc'), JSON.stringify({
  name: 'push-e2e', main: 'worker.js', compatibility_date: '2026-10-01',
  d1_databases: [{ binding: 'DB', database_name: 'vcf-game', database_id: '00000000-0000-0000-0000-000000000000' }],
  rules: [{ type: 'Text', globs: ['**/*.html', '**/*.txt'], fallthrough: false }],
}, null, 2));
fs.writeFileSync(path.join(out, 'pub.txt'), pub);
console.log('ready', out, 'pub=' + pub.slice(0, 12) + '…');
