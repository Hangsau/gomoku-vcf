// 拆存純函式單元測試：從 worker.js 的 ==CHUNK BEGIN==／==CHUNK END== 抽出實際程式來測。node check_chunk.mjs
import { readFileSync } from 'node:fs';
const src = readFileSync('C:/claudehome/projects/VCF/game/duel-server/worker.js', 'utf8');
const a = src.indexOf('// ==CHUNK BEGIN=='), b = src.indexOf('// ==CHUNK END==');
if (a < 0 || b < 0) throw new Error('找不到標記');
const { FULL_CHUNK_BYTES, PUT_KEYS_MAX, splitByBytes, planFullPuts, joinFull, partKeys, utf8 } = new Function(src.slice(a, b) + '\nreturn { FULL_CHUNK_BYTES, PUT_KEYS_MAX, splitByBytes, planFullPuts, joinFull, partKeys, utf8 };')();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const bl = (s) => utf8.encode(s).length;
const MAX = FULL_CHUNK_BYTES;
ok(MAX === 96 * 1024, `預設門檻 ${MAX} = 96 KiB`);

// 把 plan 當 storage 寫入再讀回（用 Map 模擬）
function roundtrip(full, max = MAX) {
  const id = '1700000000000abcd', sum = { id };
  const plan = planFullPuts(id, sum, full, max), st = new Map();
  for (const batch of plan.batches) { ok(Object.keys(batch).length <= PUT_KEYS_MAX, `  批次 ${Object.keys(batch).length} 把鍵 ≤ ${PUT_KEYS_MAX}`); for (const [k, v] of Object.entries(batch)) st.set(k, v); }
  const head = st.get('full:' + id);
  const back = head.chunked ? joinFull(head, id, new Map(partKeys(id, head.parts).map((k) => [k, st.get(k)]))) : head;
  return { plan, st, head, back, id };
}
const mk = (n, ch = 'a') => ({ at: 1, pad: ch.repeat(n) });

console.log('== 門檻附近');
let r = roundtrip(mk(100)); ok(!r.plan.chunked && r.st.has('full:' + r.id) && !r.head.chunked && r.st.size === 2, '小紀錄：不切，一把 full＋一把 rec');
const base = bl(JSON.stringify(mk(0)));
r = roundtrip(mk(MAX - base)); ok(r.plan.size === MAX && !r.plan.chunked, `剛好等於門檻（${r.plan.size} bytes）：不切`);
r = roundtrip(mk(MAX - base + 1)); ok(r.plan.size === MAX + 1 && r.plan.chunked && r.head.parts === 2, `多 1 byte：切成 ${r.head.parts} 段`);
ok(JSON.stringify(r.back) === JSON.stringify(mk(MAX - base + 1)), '多 1 byte：接回相同');

console.log('== 500 KiB');
const big = mk(500 * 1024); r = roundtrip(big);
ok(r.plan.chunked && r.head.parts === Math.ceil(r.plan.size / MAX), `500 KiB：${r.head.parts} 段`);
const parts = partKeys(r.id, r.head.parts).map((k) => r.st.get(k));
ok(parts.every((p) => bl(p) <= MAX), '每段 ≤ 門檻');
ok(bl(parts.join('')) === r.head.bytes && r.head.bytes === r.plan.size, `標頭 bytes ${r.head.bytes} = 實際總位元組`);
ok(JSON.stringify(r.back) === JSON.stringify(big) && bl(JSON.stringify(r.back)) === bl(JSON.stringify(big)), '接回後逐位元組相同');
ok(r.st.has('rec:' + r.id) && r.head.id === r.id && r.head.at === 1, '標頭有 id、at，另有 rec 摘要鍵');

console.log('== 多位元組字元（中文、表情符號）');
for (const [nm, ch] of [['中文', '棋譜勝負'], ['表情', '😀🎉♟️'], ['混合', 'a中😀é']]) {
  for (const max of [MAX, 1000, 7, 5, 4, 3]) {
    const f = { at: 5, names: [ch, ch], s: ch.repeat(Math.ceil(30000 / [...ch].length)) };
    const t = splitByBytes(JSON.stringify(f), max);
    const same = t.join('') === JSON.stringify(f), fits = t.every((x) => bl(x) <= max || max < 4);
    ok(same && fits, `${nm} 門檻 ${max}：${t.length} 段，接回相同${max < 4 ? '（門檻小於 4 byte 的退化情況）' : '、每段不超過'}`);
  }
  const r2 = roundtrip({ at: 5, s: ch.repeat(60000) }, 5000);
  ok(JSON.stringify(r2.back) === JSON.stringify({ at: 5, s: ch.repeat(60000) }) && r2.head.parts > 1, `${nm} 經 plan→join：${r2.head.parts} 段，內容相同`);
}
ok(splitByBytes('', 10).length === 0, '空字串 → 0 段');

console.log('== 片段鍵超過一批（> 126 段）');
r = roundtrip(mk(200 * 1024), 1000);
ok(r.plan.batches.length >= 2 && r.plan.batches.at(-1)['full:' + r.id] && r.plan.batches.at(-1)['rec:' + r.id], `${r.head.parts} 段 → ${r.plan.batches.length} 批，標頭與 rec 在最後一批`);
ok(!r.plan.batches.slice(0, -1).some((bt) => 'full:' + r.id in bt), '前面批次沒有標頭（標頭出現時片段一定已寫入）');
ok(JSON.stringify(r.back) === JSON.stringify(mk(200 * 1024)), '分批寫入後接回相同');

console.log('== 壞資料：回 null、不丟例外');
const id = '1700000000000abcd', fl = mk(5000, '棋'), p = planFullPuts(id, { id }, fl, 3000);
const st = Object.assign({}, ...p.batches), head = st['full:' + id], ks = partKeys(id, head.parts);
ok(head.parts >= 2, `測試資料：${head.parts} 段`);
const safe = (fn) => { try { return fn(); } catch (e) { return 'THROW:' + e.message; } };
ok(joinFull(head, id, Object.fromEntries(ks.map((k) => [k, st[k]]))) !== null, '完整：接得回');
ok(safe(() => joinFull(head, id, Object.fromEntries(ks.slice(0, -1).map((k) => [k, st[k]])))) === null, '少最後一段 → null');
ok(safe(() => joinFull(head, id, Object.fromEntries(ks.slice(1).map((k) => [k, st[k]])))) === null, '少第一段 → null');
const sw = Object.fromEntries(ks.map((k) => [k, st[k]])); [sw[ks[0]], sw[ks[1]]] = [sw[ks[1]], sw[ks[0]]];
ok(safe(() => joinFull(head, id, sw)) === null, '前兩段順序錯（內容互換）→ null（靠標頭雜湊）');
const ch = Object.fromEntries(ks.map((k) => [k, st[k]])); ch[ks[1]] = ch[ks[1]].slice(0, -1) + '#';
ok(safe(() => joinFull(head, id, ch)) === null, '一段被改（長度變）→ null');
const same = Object.fromEntries(ks.map((k) => [k, st[k]])); same[ks[0]] = same[ks[0]].replace('棋', '旗');
ok(safe(() => joinFull(head, id, same)) === null, '一段被改（同位元組數）→ null（靠標頭雜湊）');
const nonStr = Object.fromEntries(ks.map((k) => [k, st[k]])); nonStr[ks[0]] = 123;
ok(safe(() => joinFull(head, id, nonStr)) === null, '片段不是字串 → null');
ok(safe(() => joinFull({ ...head, bytes: head.bytes + 1 }, id, Object.fromEntries(ks.map((k) => [k, st[k]])))) === null, '標頭總位元組數不符 → null');
ok(safe(() => joinFull({ ...head, parts: 0 }, id, {})) === null && safe(() => joinFull(null, id, {})) === null && safe(() => joinFull({ chunked: true }, id, {})) === null && safe(() => joinFull({ ...head, parts: 'x' }, id, {})) === null, '標頭壞（parts 0／null／缺欄位／非數字）→ null');
const jb = { ...Object.fromEntries(ks.map((k) => [k, st[k]])) }; jb[ks[0]] = '{' + jb[ks[0]]; const hb = { ...head, bytes: head.bytes + 1 };
ok(safe(() => joinFull(hb, id, jb)) === null, '位元組數吻合但 JSON 壞 → null');

// ---------- Hall 的 saveRec／readFull（用假 storage，真的 import worker.js） ----------
console.log('== Hall.saveRec／readFull（假 storage）');
const { Hall } = await import('file:///C:/claudehome/projects/VCF/game/duel-server/worker.js');
const mkHall = (put, getImpl, env = {}) => { const st = new Map(); const h = new Hall({ storage: { put: async (o) => { await put(o, st); }, get: async (k) => getImpl(k, st), setAlarm() {} } }, env); return { h, st }; };
const wr = (o, st) => { for (const [k, v] of Object.entries(o)) st.set(k, v); };
const rd = (k, st) => (Array.isArray(k) ? new Map(k.filter((x) => st.has(x)).map((x) => [x, st.get(x)])) : st.get(k));
const sid = '1700000000000zzzz', ssum = { id: sid, kind: 'gomoku' }, sfull = { ...ssum, at: 9, pad: '棋😀'.repeat(2000) };
let m1 = mkHall(wr, rd, { FULL_CHUNK_BYTES: '2000' });
await m1.h.saveRec(sid, ssum, sfull);
ok(m1.st.has('rec:' + sid) && m1.st.get('full:' + sid).chunked === true && m1.st.has('full:' + sid + ':p0'), `saveRec 大紀錄：標頭＋片段＋rec 都寫進去（共 ${m1.st.size} 把鍵）`);
ok(JSON.stringify(await m1.h.readFull(sid)) === JSON.stringify(sfull), 'readFull 讀回與原物件相同');
m1.st.delete('full:' + sid + ':p1');
ok((await m1.h.readFull(sid)) === null, 'readFull 少一段 → null（不丟例外）');
ok((await m1.h.readFull('1700000000000nope')) === null, 'readFull 沒有這一局 → null');
let m2 = mkHall(wr, rd); await m2.h.saveRec(sid, ssum, { ...sfull, pad: 'x' });
ok(m2.st.size === 2 && !m2.st.get('full:' + sid).chunked && (await m2.h.readFull(sid)).pad === 'x', 'saveRec 小紀錄：只有 full＋rec 兩把鍵，readFull 直接回物件（舊格式）');
await m2.st.set('full:' + sid, { id: sid, chunked: true, parts: 99999, bytes: 1 });
ok((await m2.h.readFull(sid)) === null, 'readFull 標頭 parts 離譜 → null');
let calls = 0; const origErr = console.error; const errs = []; console.error = (...a) => errs.push(a.join(' '));
let m3 = mkHall(async (o, st) => { calls++; if (calls === 1) throw new Error('value too large'); wr(o, st); }, rd);
await m3.h.saveRec(sid, ssum, sfull);
ok(calls === 2 && m3.st.size === 1 && m3.st.get('rec:' + sid).lost === true && !m3.st.has('full:' + sid), 'put 失敗 → 再存一次只有 rec，帶 lost: true，沒有 full');
let m4 = mkHall(async () => { throw new Error('boom'); }, rd); let threw = false;
try { await m4.h.saveRec(sid, ssum, sfull); } catch { threw = true; }
ok(!threw && errs.length >= 2, `兩次 put 都失敗 → 不丟例外、console.error ${errs.length} 次`);
console.error = origErr;
console.log(`PASS ${pass}／FAIL ${fail}`);
process.exit(fail ? 1 : 0);
