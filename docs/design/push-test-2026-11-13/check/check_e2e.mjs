// 本機端到端：對 wrangler dev --local（8798）測 /push/*；本機假推播端點驗證 Worker 真的送出、密文能用訂閱私鑰解回。
// 前置：setup_e2e.mjs 建好副本並啟動 wrangler dev（見 REPORT）。用法：node check_e2e.mjs
import http from 'node:http';
import { webcrypto as crypto } from 'node:crypto';
const API = 'http://127.0.0.1:8798';
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra); } };
const b64u = (u8) => Buffer.from(u8).toString('base64url');
const unb64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));
const post = async (p, body, raw) => { const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)]; };

// ---- 假推播端點 ----
const hits = []; let nextStatus = 201;
const srv = http.createServer((req, res) => {
  const ch = []; req.on('data', d => ch.push(d)); req.on('end', () => { hits.push({ url: req.url, headers: req.headers, body: new Uint8Array(Buffer.concat(ch)) }); res.statusCode = nextStatus; res.end(); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const EP = 'http://127.0.0.1:' + srv.address().port;

// ---- 假訂閱（模擬瀏覽器：ECDH 金鑰＋auth）----
const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
const uaJwk = await crypto.subtle.exportKey('jwk', ua.privateKey);
const auth = crypto.getRandomValues(new Uint8Array(16));
const sub = (path) => ({ endpoint: EP + path, keys: { p256dh: b64u(uaPub), auth: b64u(auth) } });
const PID = 'e2etest' + Math.random().toString(36).slice(2, 8);

async function decrypt(body) {
  const te = new TextEncoder(), salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const priv = await crypto.subtle.importKey('jwk', uaJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asK = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = await crypto.subtle.deriveBits({ name: 'ECDH', public: asK }, priv, 256);
  const hk = async (s, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const cat = (...a) => Uint8Array.from(a.flatMap(x => [...x]));
  const ikm = await hk(auth, new Uint8Array(ecdh), cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hk(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hk(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  return new TextDecoder().decode(pt.slice(0, pt.lastIndexOf(2)));
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 路由與驗證 ----
{
  const r = await fetch(API + '/push/key'); const j = await r.json();
  ok(r.status === 200 && /^[A-Za-z0-9_-]{87}$/.test(j.key) && unb64u(j.key).length === 65 && unb64u(j.key)[0] === 4, 'GET /push/key 回 65 bytes 未壓縮公鑰', JSON.stringify(j));
  let s = await post('/push/sub', null, 'notjson'); ok(s[0] === 400, 'sub：壞 JSON → 400', s);
  s = await post('/push/sub', { pid: 'x', sub: sub('/a') }); ok(s[0] === 400 && s[1].error === 'bad pid', 'sub：pid 太短 → 400', s);
  s = await post('/push/sub', { pid: 'bad pid!!!', sub: sub('/a') }); ok(s[0] === 400, 'sub：pid 含非法字元 → 400', s);
  s = await post('/push/sub', { pid: PID, sub: { endpoint: 'http://example.com/x', keys: sub('/a').keys } }); ok(s[0] === 400 && s[1].error === 'bad endpoint', 'sub：非 https 端點 → 400', s);
  s = await post('/push/sub', { pid: PID, sub: { endpoint: 'https://example.com/' + 'a'.repeat(1000), keys: sub('/a').keys } }); ok(s[0] === 400, 'sub：端點 >1000 字 → 400', s);
  s = await post('/push/sub', { pid: PID, sub: { endpoint: EP + '/a', keys: { p256dh: 'AAAA', auth: b64u(auth) } } }); ok(s[0] === 400 && s[1].error === 'bad keys', 'sub：p256dh 長度不對 → 400', s);
  s = await post('/push/sub', { pid: PID, sub: { endpoint: EP + '/a', keys: { p256dh: b64u(uaPub), auth: 'AAAA' } } }); ok(s[0] === 400, 'sub：auth 長度不對 → 400', s);
  s = await post('/push/sub', { pid: PID, sub: { endpoint: EP + '/a' } }); ok(s[0] === 400, 'sub：缺 keys → 400', s);
  s = await post('/push/test', { pid: PID, delay: 31 }); ok(s[0] === 400 && s[1].error === 'bad delay', 'test：delay 31 → 400', s);
  s = await post('/push/test', { pid: PID, delay: -1 }); ok(s[0] === 400, 'test：delay -1 → 400', s);
  for (const u of ['https://evil.com/x', '//evil.com/x', 'game/x', '/a b']) { s = await post('/push/test', { pid: PID, delay: 0, url: u }); ok(s[0] === 400 && s[1].error === 'bad url', 'test：url 不合法 → 400：' + u, s); }
  s = await post('/push/test', { pid: 'short', delay: 0 }); ok(s[0] === 400, 'test：pid 不合法 → 400', s);
}

// ---- 訂閱 → 發送 → 假端點收到 ----
{
  let s = await post('/push/sub', { pid: PID, sub: sub('/ok') }); ok(s[0] === 200 && s[1].ok === true, 'sub：合法訂閱 → 200 ok', s);
  s = await post('/push/sub', { pid: PID, sub: sub('/ok') }); ok(s[0] === 200, 'sub：同端點再送 → upsert 不報錯', s);
  const t0 = Date.now();
  s = await post('/push/test', { pid: PID, delay: 2 }); const dt = Date.now() - t0;
  ok(s[0] === 200 && s[1].ok === true && s[1].n === 1, 'test：回 {ok:true,n:1}', JSON.stringify(s));
  ok(dt < 1500, 'test：立即回應（不等 delay）', dt + 'ms');
  await wait(800); ok(hits.length === 0, 'delay 2 秒內還沒送出');
  await wait(2500);
  ok(hits.length === 1, '假端點收到 1 個請求', 'n=' + hits.length);
  const h = hits[0];
  if (h) {
    ok(h.url === '/ok', '請求打到訂閱的端點路徑');
    ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/.test(h.headers.authorization || ''), 'Authorization: vapid t=…, k=…', h.headers.authorization);
    ok(h.headers['content-encoding'] === 'aes128gcm', 'Content-Encoding: aes128gcm', h.headers['content-encoding']);
    ok(h.headers.ttl === '60', 'TTL: 60', h.headers.ttl);
    const pub = (await (await fetch(API + '/push/key')).json()).key;
    ok(h.headers.authorization.endsWith('k=' + pub), 'k= 等於 /push/key 的公鑰');
    // 驗簽
    const m = h.headers.authorization.match(/t=([\w-]+)\.([\w-]+)\.([\w-]+),/);
    const vk = await crypto.subtle.importKey('raw', unb64u(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, unb64u(m[3]), new TextEncoder().encode(m[1] + '.' + m[2])), 'Worker 實際送出的 JWT 用公鑰驗簽成功');
    const claim = JSON.parse(Buffer.from(m[2], 'base64url').toString());
    ok(claim.aud === EP && claim.exp > Date.now() / 1000, 'JWT aud＝端點 origin、未過期', JSON.stringify(claim));
    let plain = null; try { plain = JSON.parse(await decrypt(h.body)); } catch (e) { plain = 'ERR ' + e.message; }
    ok(plain && plain.title === 'Gomoku Rush' && plain.body === '通知測試：點我' && plain.url === '/game/push-test.html?from=push', '密文用訂閱私鑰解回原文', JSON.stringify(plain));
  }
}

// ---- 自訂 url、404/410 清除、限流 ----
{
  hits.length = 0; nextStatus = 410;
  let s = await post('/push/test', { pid: PID, delay: 0, url: '/game.html?x=1' }); ok(s[1] && s[1].n === 1, 'test：自訂站內 url 接受', s);
  await wait(1200); ok(hits.length === 1, '410 回應的那次有送出');
  const p = JSON.parse(await decrypt(hits[0].body)); ok(p.url === '/game.html?x=1', '自訂 url 進了通知內容', JSON.stringify(p));
  s = await post('/push/test', { pid: PID, delay: 0 }); ok(s[1] && s[1].n === 0, '410 之後訂閱已被刪除（n=0）', JSON.stringify(s));
  nextStatus = 201;
  const P2 = 'ratelim' + Math.random().toString(36).slice(2, 7); const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post('/push/test', { pid: P2, delay: 0 }))[0]);
  ok(codes.slice(0, 5).every(c => c === 200) && codes[5] === 429 && codes[6] === 429, '限流：同 pid 前 5 次 200、第 6、7 次 429', codes.join(','));
  const s3 = await post('/push/test', { pid: 'other' + Math.random().toString(36).slice(2, 7), delay: 0 }); ok(s3[0] === 200 && s3[1].n === 0, '別的 pid 不受限、沒訂閱 n=0', JSON.stringify(s3));
}
srv.close();
console.log(`PASS ${pass}／FAIL ${fail}`);
process.exit(fail ? 1 : 0);
