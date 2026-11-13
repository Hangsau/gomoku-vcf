// 驗證 worker.js 內的 Web Push 加密（RFC 8291）與 VAPID（RFC 8292）。用法：node check_crypto.mjs
import fs from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
const here = new URL('.', import.meta.url);
const src = fs.readFileSync(new URL('../../../../game/worker/worker.js', here), 'utf8');
const m = src.match(/\/\/ ==PUSH-CRYPTO-BEGIN==[^\n]*\n([\s\S]*?)\/\/ ==PUSH-CRYPTO-END==/);
if (!m) { console.log('FAIL 找不到 PUSH-CRYPTO 區段'); process.exit(1); }
const lib = new Function('crypto', m[1] + '\nreturn { b64uEnc, b64uDec, catBytes, hkdf, encryptPush, vapidAuth };')(crypto);
const { b64uEnc, b64uDec, catBytes, hkdf, encryptPush, vapidAuth } = lib;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra); } };

// ---- 獨立的解密（照 RFC 8291 §3.4 寫，不重用被測函式）----
async function decrypt(body, uaPrivJwk, uaPub, auth) {
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const uaPriv = await crypto.subtle.importKey('jwk', uaPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPriv, 256));
  const te = new TextEncoder();
  const ikm = await hkdf(auth, ecdh, catBytes(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
  let end = pt.length - 1; while (end >= 0 && pt[end] === 0) end--;
  if (pt[end] !== 2) throw new Error('padding delimiter 不是 0x02');
  return new TextDecoder().decode(pt.slice(0, end));
}
const jwkOf = (priv, pub) => { const p = b64uDec(pub); return { kty: 'EC', crv: 'P-256', d: priv, x: b64uEnc(p.slice(1, 33)), y: b64uEnc(p.slice(33, 65)), ext: true }; };

// ---- 1. RFC 8291 附錄 A 測試向量 ----
const V = {
  plain: 'When I grow up, I want to be a watermelon',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPriv: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const asJwk = jwkOf(V.asPriv, V.asPub), uaJwk = jwkOf(V.uaPriv, V.uaPub);
const asKeyPair = {
  privateKey: await crypto.subtle.importKey('jwk', asJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
  publicKey: await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: asJwk.x, y: asJwk.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
};
const body = await encryptPush(V.plain, b64uDec(V.uaPub), b64uDec(V.auth), asKeyPair, b64uDec(V.salt));
console.log('我的輸出  :', b64uEnc(body));
console.log('RFC 預期  :', V.body);
ok(b64uEnc(body) === V.body, 'RFC 8291 附錄 A：密文與範例完全一致');
// 先證明範例字串本身記對了（用獨立解密把 RFC 範例解回原文）
ok((await decrypt(b64uDec(V.body), uaJwk, b64uDec(V.uaPub), b64uDec(V.auth))) === V.plain, '獨立解密函式能解開 RFC 範例密文');

// ---- 2. 隨機金鑰往返 ----
{
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const uaPrivJwk = await crypto.subtle.exportKey('jwk', ua.privateKey);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const text = JSON.stringify({ title: 'Gomoku Rush', body: '通知測試：點我', url: '/game/push-test.html?from=push' });
  const b = await encryptPush(text, uaPub, auth);
  ok(b[20] === 65 && b[16] === 0 && b[17] === 0 && b[18] === 0x10 && b[19] === 0, '檔頭：rs=4096、idlen=65');
  ok((await decrypt(b, uaPrivJwk, uaPub, auth)) === text, '隨機金鑰：加密後能解回原文（含中文）');
}

// ---- 3. VAPID JWT 驗簽 ----
{
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64uEnc(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const now = 1_800_000_000;
  const h = await vapidAuth('https://web.push.apple.com/abc123', jwk, pub, now);
  const mm = h.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/);
  ok(!!mm, 'Authorization 格式：vapid t=<jwt>, k=<pub>', h);
  if (mm) {
    const [, a, b, c, k] = mm;
    const claim = JSON.parse(new TextDecoder().decode(b64uDec(b)));
    ok(JSON.parse(new TextDecoder().decode(b64uDec(a))).alg === 'ES256', 'header alg=ES256');
    ok(claim.aud === 'https://web.push.apple.com' && claim.exp === now + 43200 && /^(mailto:|https:)/.test(claim.sub), 'claims：aud 只含 origin、exp、sub', JSON.stringify(claim));
    ok(k === pub, 'k= 是公鑰');
    const vk = await crypto.subtle.importKey('raw', b64uDec(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sig = b64uDec(c);
    ok(sig.length === 64, '簽章是 64 bytes（r||s，不是 DER）');
    ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, sig, new TextEncoder().encode(a + '.' + b)), 'JWT 用公鑰驗簽成功');
    const bad = sig.slice(); bad[0] ^= 1;
    ok(!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, bad, new TextEncoder().encode(a + '.' + b))), '改一個 bit 驗簽失敗（負向對照）');
  }
}
console.log(`PASS ${pass}／FAIL ${fail}`);
process.exit(fail ? 1 : 0);
