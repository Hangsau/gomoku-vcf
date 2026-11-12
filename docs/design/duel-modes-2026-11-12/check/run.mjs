// 兩儀殿 VCF 兩種玩法檢查：node run.mjs [t1 t2 t3 t4 t5]（不給參數＝全跑）。需要 http.server 8793、wrangler dev 8789。
import * as L from './lib.mjs';
import fs from 'node:fs';
const { ok, sleep } = L;
const want = new Set(process.argv.slice(2));
const run = (n) => want.size === 0 || want.has(n);
const b = await L.launch();
const SH = 'shots/';
const errsOf = (...ps) => ps.flatMap((p) => p.errs);

// 一題從頭解到贏（點攻方每一手，等引擎回覆）
async function solveAll(p, firstOnly = false) {
  await L.waitLive(p);
  const { raw } = await L.solveCur(p);
  const sol = L.parseSol(raw);
  let n = 0;
  for (let k = 0; k < sol.length; k += 2) {
    await p.waitForFunction(() => { const v = window.__duel.VR; return v && (!v.hold || v.done || v.out); }, null, { timeout: 8000 });
    if (await p.evaluate(() => window.__duel.VR.done || !!window.__duel.VR.out)) break;
    await L.clickT(p, sol[k]); n++;
    await p.waitForFunction((n) => { const v = window.__duel.VR; return !v || v.done || v.out || v.moves.length >= n; }, n, { timeout: 8000 });
    if (firstOnly) break;
  }
  return sol;
}
const goOut = (p, why = 'bad') => p.evaluate((w) => window.__duel.vOut(w), why);   // 頁面自己的出局函式（跟下錯走同一條送出路徑）
const stateOf = (p) => L.vs(p);
async function waitRound(p, i, t = 14000) { await p.waitForFunction((i) => { const r = window.__duel.room; return r && r.vs && r.vs.p[0].i === i && r.vs.p[1].i === i && r.vs.phase === 'play' && r.state === 'play'; }, i, { timeout: t }); }
async function waitPhase(p, ph, t = 8000) { await p.waitForFunction((ph) => { const r = window.__duel.room; return r && r.vs && r.vs.phase === ph; }, ph, { timeout: t }); }

// ===== 1. 一線天整場 =====
if (run('t1')) {
  console.log('== 1 一線天整場');
  let A = await L.mk(b, { nick: 'Alice' }), B = await L.mk(b, { nick: 'Bob' });
  await L.create(A, { kind: 'vcf', vmode: 'line', target: 3, shot: SH + 'form_line_zh_375x667.png' });
  const id = await L.roomId(A);
  ok((await L.roomOf(A)).vcf.vmode === 'line', '房間 vmode=line');
  await L.join(B, id);
  if (await A.evaluate(() => window.__duel.mySeat()) === 1) [A, B] = [B, A];   // 開房者座位是隨機的；讓 A＝座位 0
  await sleep(500);
  ok(/一線天/.test(await A.textContent('#rTitle')), '房間標題顯示玩法名稱「一線天」：' + await A.textContent('#rTitle'));
  await sleep(3800);
  let sa = await stateOf(A), sb = await stateOf(B);
  ok(sa.p[0].id === sa.p[1].id && sa.p[0].id === sb.p[0].id && sb.p[0].id === sb.p[1].id, `兩邊同一題 id=${sa.p[0].id}`);
  ok(await A.evaluate(() => !document.getElementById('aSkip')) && await B.evaluate(() => !document.getElementById('aSkip')), '一線天沒有「放棄這題」按鈕');
  await A.screenshot({ path: SH + 'line_play_A_zh_375x667.png' });
  // R1：A 解開
  await solveAll(A);
  await waitPhase(B, 'reveal');
  sa = await stateOf(A); sb = await stateOf(B);
  ok(sa.score[0] === 1 && sb.score[0] === 1 && sa.score[1] === 0, `A 解開 → A 1 分（${sa.score}）`);
  ok(sb.p[1].s === 'out' && sb.p[1].why === 'late' && sa.p[0].s === 'solved', 'B 記成慢了一步、A 解開');
  ok(sb.phase === 'reveal' && (await B.evaluate(() => window.__duel.room.vs.rv.winner)) === 0, '進入公開解法，贏家=A');
  await sleep(300);
  await B.screenshot({ path: SH + 'line_reveal_B_zh_375x667.png' });
  ok(await B.evaluate(() => { const v = window.__duel.VR; return !!(v.reveal && v.reveal.length > 0); }), 'B 畫面拿到公開的解法手順');
  await waitRound(A, 1); await waitRound(B, 1);
  sa = await stateOf(A); sb = await stateOf(B);
  ok(sa.p[0].i === 1 && sb.p[1].i === 1 && sa.p[0].id === sa.p[1].id && sa.p[0].id === sb.p[0].id, `兩邊一起進第 2 題、題目相同 id=${sa.p[0].id}`);
  // R2：A 先下一手再出局，B 還能解
  await L.waitLive(A); await L.waitLive(B);
  await solveAll(A, true); await goOut(A, 'bad'); await sleep(500);
  sb = await stateOf(B);
  ok(sb.p[0].s === 'out' && sb.p[0].why === 'bad' && sb.p[1].s === 'think' && sb.phase === 'play', 'A 出局後 B 仍在做、沒換題');
  await solveAll(B);
  await waitPhase(A, 'reveal');
  sa = await stateOf(A);
  ok(sa.score[0] === 1 && sa.score[1] === 1, `B 解開 → B 得分（${sa.score}）`);
  await waitRound(A, 2); await waitRound(B, 2);
  // R3：兩人都出局
  await L.waitLive(A); await L.waitLive(B);
  await solveAll(A, true); await solveAll(B, true);
  await goOut(A, 'bad'); await sleep(300);
  const mid = await stateOf(B);
  ok(mid.phase === 'play' && mid.p[1].s !== 'out', 'A 先出局時這題還沒結束');
  await goOut(B, 'bad'); await waitPhase(A, 'reveal');
  sa = await stateOf(A);
  ok(sa.score[0] === 1 && sa.score[1] === 1 && (await A.evaluate(() => window.__duel.room.vs.rv.winner)) === null, '兩人都出局 → 沒人得分、winner=null');
  await sleep(600);
  await A.screenshot({ path: SH + 'line_none_A_zh_375x667.png' });
  await waitRound(A, 3); await waitRound(B, 3);
  ok((await stateOf(A)).p[0].id === (await stateOf(B)).p[1].id, '一起換到第 4 題、同題');
  // R4：B 先下一手（回報進度）、A 解開 → B 慢了一步，手順留著
  await L.waitLive(A); await L.waitLive(B);
  await solveAll(B, true); await sleep(300);
  await solveAll(A); await waitPhase(B, 'reveal');
  ok((await stateOf(A)).score[0] === 2, 'A 2 分');
  await waitRound(A, 4); await waitRound(B, 4);
  // R5：A 解開 → 3 分結束
  await L.waitLive(A); await L.waitLive(B);
  await solveAll(A);
  await A.waitForFunction(() => window.__duel.room.state === 'over', null, { timeout: 8000 });
  await sleep(2000);
  sa = await stateOf(A); sb = await stateOf(B);
  ok(sa.result && sa.result.winner === 0 && sa.score[0] === 3 && sa.score[1] === 1, `結束：A 3 : B 1（${sa.score}，winner=${sa.result && sa.result.winner}）`);
  const ta = await A.textContent('#endTitle'), tb = await B.textContent('#endTitle');
  ok(ta === '你贏了' && tb === '你輸了', `結束畫面：A「${ta}」B「${tb}」`);
  ok((await A.textContent('#endWhy')).includes('3 : 1') && (await B.textContent('#endWhy')).includes('1 : 3'), `比分文字 A「${await A.textContent('#endWhy')}」B「${await B.textContent('#endWhy')}」`);
  await A.screenshot({ path: SH + 'line_end_A_zh_375x667.png' });
  const rv = await A.evaluate(() => JSON.parse(JSON.stringify(window.__duel.room.vs.review)));
  ok(rv.list.length === 5, `逐題看解法共 5 題（${rv.list.length}）`);
  const logs = rv.logs;
  ok([0, 1, 2, 3, 4].every((k) => logs[0][k] && logs[1][k]), '每題兩人都有紀錄');
  const rs = (s, k) => logs[s][k].r + '/' + logs[s][k].why;
  console.log('   紀錄 A:', [0, 1, 2, 3, 4].map((k) => rs(0, k)).join(' '), '| B:', [0, 1, 2, 3, 4].map((k) => rs(1, k)).join(' '));
  ok(logs[0][0].r === 'solved' && logs[0][0].seq.length >= 7, `第 1 題 A 解開，手順 ${logs[0][0].seq.length} 手`);
  ok(logs[1][0].why === 'late', '第 1 題 B 慢了一步');
  ok(logs[0][1].r === 'out' && logs[0][1].seq.length >= 2, `第 2 題 A 出局，留下他下到出局的手（${logs[0][1].seq.join(' ')}）`);
  ok(logs[1][1].r === 'solved' && logs[1][1].seq.length >= 7, '第 2 題 B 解開，手順完整');
  ok(logs[0][2].r === 'out' && logs[1][2].r === 'out' && logs[0][2].seq.length >= 2 && logs[1][2].seq.length >= 2, '第 3 題兩人出局，各自手順都在');
  ok(logs[1][3].why === 'late' && logs[1][3].seq.length >= 2, `第 4 題 B 慢了一步，下過的手還在（${logs[1][3].seq.join(' ')}）`);
  // 看解法畫面
  await A.waitForSelector('#mEnd:not([hidden])'); await A.click('#bLook'); await sleep(400);
  const facts = [];
  for (let k = 0; k < 5; k++) {
    facts.push(await A.textContent('#facts'));
    for (const who of ['sol', '0', '1']) { await A.click(`#phaseActs [data-rv="${who}"]`); await sleep(120); }
    if (k < 4) { await A.click('#phaseActs [data-rv="next"]'); await sleep(250); }
  }
  console.log('   facts:', facts.join(' // '));
  ok(facts.every((f) => f && !/undefined/.test(f)), '逐題看解法每題都有字、沒有 undefined');
  await A.click('#phaseActs [data-rv="sol"]'); await A.screenshot({ path: SH + 'line_review_A_zh_375x667.png' });
  // 再來一局：兩人按 → 新局 line 同房
  await A.evaluate(() => { document.getElementById('mEnd').hidden = false; }); await A.click('#bAgain'); await B.click('#bAgain'); await sleep(1200);
  const r2 = await L.roomOf(A);
  ok(r2.state === 'play' && r2.vcf.vmode === 'line' && r2.vs.score[0] === 0 && r2.vs.score[1] === 0, '再來一局：一線天、比分歸零');
  ok(errsOf(A, B).length === 0, '頁面沒有 JS 錯誤 ' + JSON.stringify(errsOf(A, B)));
  await A.context().close(); await B.context().close();
}

// ===== 2. 八仙渡整場 =====
if (run('t2')) {
  console.log('== 2 八仙渡整場');
  let A = await L.mk(b, { nick: 'Alice' }), B = await L.mk(b, { nick: 'Bob' });
  await L.create(A, { kind: 'vcf', vmode: 'eight', target: 3, shot: SH + 'form_eight_zh_375x667.png' });
  const id = await L.roomId(A); await L.join(B, id);
  if (await A.evaluate(() => window.__duel.mySeat()) === 1) [A, B] = [B, A];
  ok(/八仙渡/.test(await A.textContent('#rTitle')), '房間標題「八仙渡」：' + await A.textContent('#rTitle'));
  await sleep(3800);
  let sa = await stateOf(A);
  ok(sa.p[0].id === sa.p[1].id, '開局兩人第 1 題同一題');
  ok(await A.evaluate(() => !!document.getElementById('aSkip')), '八仙渡有「放棄這題」按鈕');
  await A.screenshot({ path: SH + 'eight_play_A_zh_375x667.png' });
  await solveAll(A); await sleep(1700);
  await solveAll(A); await sleep(1700);
  sa = await stateOf(A); const sb = await stateOf(B);
  ok(sa.p[0].i === 2 && sb.p[1].i === 0 && sa.score[0] === 2, `A 解兩題時 B 還在第 1 題（A i=${sa.p[0].i}，B i=${sb.p[1].i}，分數 ${sa.score}）`);
  const topTxt = await B.evaluate(() => document.getElementById('pTop').innerText.replace(/\n/g, ' '));
  ok(topTxt.includes('第 3 題'), '對手那條顯示他做到第 3 題：' + topTxt);
  await B.screenshot({ path: SH + 'eight_play_B_zh_375x667.png' });
  await solveAll(A);
  await A.waitForFunction(() => window.__duel.room.state === 'over', null, { timeout: 8000 });
  await sleep(2000);
  sa = await stateOf(A);
  ok(sa.result.winner === 0 && sa.score[0] === 3 && sa.score[1] === 0 && sa.p[1].i === 0, `先解開 3 題的贏（${sa.score}）`);
  ok(await A.textContent('#endTitle') === '你贏了' && await B.textContent('#endTitle') === '你輸了', '結束畫面輸贏正確');
  await A.screenshot({ path: SH + 'eight_end_A_zh_375x667.png' });
  const rv = await B.evaluate(() => JSON.parse(JSON.stringify(window.__duel.room.vs.review)));
  ok(rv.list.length === 3 && [0, 1, 2].every((k) => rv.logs[0][k] && rv.logs[0][k].r === 'solved' && rv.logs[0][k].seq.length >= 7), '逐題看解法 3 題，A 的手順都在');
  await B.click('#bLook'); await sleep(400);
  const f = await B.textContent('#facts'); ok(f && !/undefined/.test(f), 'B 看解法畫面：' + f);
  await B.screenshot({ path: SH + 'eight_review_B_zh_375x667.png' });
  ok(errsOf(A, B).length === 0, '頁面沒有 JS 錯誤 ' + JSON.stringify(errsOf(A, B)));
  await A.context().close(); await B.context().close();
}

// ===== 3. 舊客戶端相容（直接對 WebSocket 送開房訊息） =====
if (run('t3')) {
  console.log('== 3 舊客戶端相容');
  const P = await L.mk(b, { nick: 'Raw' });
  const res = await P.evaluate(async () => {
    const out = [];
    const open = (id) => new Promise((resolve) => { const w = new WebSocket(`ws://127.0.0.1:8787/ws?id=${id}&nick=raw${id}`); const msgs = []; w.onmessage = (e) => msgs.push(JSON.parse(e.data)); w.onopen = () => resolve({ w, msgs }); });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const find = (msgs) => { for (let k = msgs.length - 1; k >= 0; k--) { const m = msgs[k]; const r = m.room && typeof m.room === 'object' ? m.room : null; if (r && r.vcf) return r; } return null; };
    for (const [label, extra] of [['沒有 vmode', {}], ['vmode=null', { vmode: null }], ['vmode=line', { vmode: 'line' }], ['vmode=xxx', { vmode: 'xxx' }], ['vmode=數字 7', { vmode: 7 }], ['vmode=物件', { vmode: { a: 1 } }], ['vmode=eight', { vmode: 'eight' }]]) {
      const id = 'rawtest' + Math.random().toString(36).slice(2, 8);
      const { w, msgs } = await open(id);
      w.send(JSON.stringify({ t: 'create', kind: 'vcf', rank: 3, think: 60, target: 3, ...extra }));
      await wait(500);
      const room = find(msgs), errs = msgs.filter((m) => m.t === 'err').map((m) => m.code || m.msg || JSON.stringify(m));
      w.send(JSON.stringify({ t: 'ping' })); await wait(200);
      const alive = w.readyState === 1;
      out.push({ label, vmode: room ? room.vcf.vmode : null, errs, alive, types: [...new Set(msgs.map((m) => m.t))].join(',') });
      w.send(JSON.stringify({ t: 'leave' })); await wait(100); w.close();
    }
    return out;
  });
  for (const r of res) console.log('  ', JSON.stringify(r));
  const g = (l) => res.find((r) => r.label === l);
  ok(g('沒有 vmode').vmode === 'eight', '沒有 vmode → eight');
  ok(g('vmode=null').vmode === 'eight', 'vmode=null → eight');
  ok(g('vmode=line').vmode === 'line' && g('vmode=eight').vmode === 'eight', '合法值照收');
  for (const l of ['vmode=xxx', 'vmode=數字 7', 'vmode=物件']) ok(g(l).vmode === null && g(l).errs.length > 0 && g(l).alive, `${l} → 被拒絕（${g(l).errs.join(',')}）、連線沒斷`);
  const wlog = fs.readFileSync(process.env.TEMP + '/mine_wr.log', 'utf8');
  ok(!/Uncaught|TypeError|ReferenceError|Exception/i.test(wlog.split('Ready on')[1] || ''), 'wrangler 紀錄沒有例外');
  await P.context().close();
}

// ===== 5. 五子棋沒壞 =====
if (run('t5')) {
  console.log('== 5 五子棋基本流程');
  const A = await L.mk(b, { nick: 'Alice' }), B = await L.mk(b, { nick: 'Bob' });
  await L.create(A, { kind: 'gomoku' });
  const id = await L.roomId(A); await L.join(B, id); await sleep(500);
  const turnOf = async () => { for (const p of [A, B]) if ((await p.textContent('#status')).includes('輪到你')) return p; return null; };
  const blackMoves = ['H8', 'J8', 'K8', 'L8', 'M8'], whiteMoves = ['H7', 'J7', 'K7', 'L7'];
  let first = null;
  for (let k = 0; k < 9; k++) {
    let p = null; for (let t = 0; t < 20 && !p; t++) { p = await turnOf(); if (!p) await sleep(150); }
    if (!p) { ok(false, '找不到輪到的人 k=' + k); break; }
    if (k === 0) first = p;
    const cell = k % 2 === 0 ? blackMoves[k / 2] : whiteMoves[(k - 1) / 2];
    await L.clickT(p, cell); await sleep(250);
  }
  await sleep(1200);
  const tA = await A.textContent('#endTitle'), tB = await B.textContent('#endTitle');
  console.log('   結束畫面', tA, tB);
  ok(new Set([tA, tB]).size === 2 && [tA, tB].includes('你贏了') && [tA, tB].includes('你輸了'), '五子棋分出勝負');
  ok((first === A ? tA : tB) === '你贏了', '先手（黑）連五贏');
  ok(errsOf(A, B).length === 0, '頁面沒有 JS 錯誤 ' + JSON.stringify(errsOf(A, B)));
  await A.context().close(); await B.context().close();
}

// ===== 4. 版面：四語 × 兩種小手機 × 兩種玩法：開房表單、對局中、公開解法、結束、逐題看解法 =====
const LAYOUT_JS = () => {
  const W = innerWidth, H = innerHeight, bad = [], de = document.documentElement;
  if (de.scrollHeight > H + 1 || de.scrollWidth > W + 1) bad.push(`文件可捲動 ${de.scrollWidth}x${de.scrollHeight} > ${W}x${H}`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[hidden]') || el.closest('.list') || (el.closest('svg') && el.tagName !== 'svg')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) bad.push(`${el.tagName}#${el.id}.${String(el.className).slice(0, 20)} 超出 [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  const box = document.querySelector('.modal:not([hidden]) .box');
  if (box && box.scrollHeight > box.clientHeight + 1) bad.push(`對話框可捲動 ${box.scrollHeight} > ${box.clientHeight}`);
  const txt = document.body.innerText;
  if (/undefined/.test(txt)) bad.push('出現 undefined');
  const key = txt.match(/\b(vm_\w+|vmn_\w+|vWhy_\w+|vNoteC|vModeL|vStOutWait|vRound\w+|vNext)\b/); if (key) bad.push('出現沒翻的字串鍵 ' + key[0]);
  return bad;
};
if (run('t4')) {
  console.log('== 4 版面');
  for (const [w, h] of [[360, 640], [375, 667]]) for (const lang of ['zh', 'en', 'ja', 'ko']) for (const vmode of ['line', 'eight']) {
    const tag = `${lang}_${w}x${h}`;
    let A = await L.mk(b, { lang, w, h, nick: 'Alice' }), B = await L.mk(b, { lang, w, h, nick: 'Bob' });
    const chk = async (p, label, shot) => { const bad = await p.evaluate(LAYOUT_JS); if (shot) await p.screenshot({ path: SH + shot }); ok(bad.length === 0, `${vmode} ${tag} ${label}${bad.length ? ' → ' + bad.join('；') : ''}`); };
    await A.click('#openCreate'); await sleep(250);
    await A.click('#cKind button[data-v="vcf"]');
    for (const m of ['line', 'eight']) { await A.click(`#cVmode button[data-v="${m}"]`); await sleep(150); await chk(A, `開房表單(${m})`, `form_${m}_${tag}.png`); }
    await A.click(`#cVmode button[data-v="${vmode}"]`); await A.click('#cTarget button[data-v="3"]'); await A.click('#cThink button[data-v="60"]');
    await A.click('#doCreate'); await sleep(600);
    const id = await L.roomId(A); await L.join(B, id);
    if (await A.evaluate(() => window.__duel.mySeat()) === 1) [A, B] = [B, A];
    await sleep(500);
    await chk(A, '等倒數', `${vmode}_count_${tag}.png`);
    await sleep(3500);
    await L.waitLive(A);
    await chk(A, '對局中', `${vmode}_play_${tag}.png`);
    await solveAll(A, true); await sleep(300);
    await chk(A, '落子中', `${vmode}_armed_${tag}.png`);
    if (vmode === 'line') {   // 兩人都出局 → 公開正解
      await goOut(A, 'bad'); await sleep(300);
      await chk(A, '出局等對手', `line_out_${tag}.png`);
      await goOut(B, 'bad'); await waitPhase(A, 'reveal'); await sleep(900);
      await chk(A, '公開解法', `line_reveal_${tag}.png`);
    } else {
      await goOut(B, 'bad'); await sleep(300);
      await chk(B, '下一題', `eight_next_${tag}.png`);
    }
    A.on('dialog', (d) => d.accept());
    await A.click('#aResign'); await sleep(1900);
    await chk(A, '結束畫面', `${vmode}_end_${tag}.png`);
    await A.click('#bLook'); await sleep(500);
    await chk(A, '逐題看解法', `${vmode}_review_${tag}.png`);
    await chk(B, '對手端結束後看解法前', null);
    ok(errsOf(A, B).length === 0, `${vmode} ${tag} 沒有 JS 錯誤 ${JSON.stringify(errsOf(A, B))}`);
    await A.context().close(); await B.context().close();
  }
}

await b.close();
L.done();
process.exit(L.fail ? 1 : 0);
