// 今日棋局集檢查：node run.mjs（前景執行）。需要 http.server 8793（頁面）、8791（題庫）；wrangler dev 8789 由本腳本自己起停（資料放 PERSIST）。
import * as L from './lib.mjs';
import { mkdirSync, rmSync } from 'node:fs';
const { ok, sleep } = L;
const PERSIST = process.argv[2] || 'C:/Users/hangs/AppData/Local/Temp/claude/01840b1a6fcdd9a6/d902b244-6044-45c8-b3f8-f25711dbe07b/scratchpad/wstate';
rmSync(PERSIST, { recursive: true, force: true }); mkdirSync(PERSIST, { recursive: true });
const SH = 'shots/';
const errsAll = [];
mkdirSync(SH, { recursive: true });
await L.startWr(PERSIST);
let b = null;
const clients = [];
const R = async (nick) => { const c = await L.rc(nick); clients.push(c); return c; };
try {
  // ================= 1. 伺服器存檔 =================
  console.log('== 1. 各種結局各存一筆');
  const A = await R('Alice'), B = await R('Bob'), O = await R('Obs');
  ok((await O.recs()).length === 0, '一開始清單是空的');

  // 五子棋：真的下到連五
  const g1 = await L.newGomoku(A, B);
  await L.playMoves(A, B, L.FIVE);
  await A.until((c) => c.room.state === 'over');
  await sleep(400);
  let list = await O.recs();
  ok(list.length === 1, '連五那局：清單 1 筆');
  const r1 = list[0];
  ok(r1.kind === 'gomoku' && r1.rule === 'free' && r1.n === 9 && r1.win === 0 && r1.names[0] === 'Alice' && r1.names[1] === 'Bob' && r1.priv === false, `連五局內容正確 ${JSON.stringify(r1)}`);
  ok(r1.cols[0] === 1 && r1.cols[1] === 2 && r1.mine === null && !('pids' in r1), '黑白座位對、觀察者 mine=null、沒有 pids');
  ok(r1.id && r1.at > 0 && Math.abs(r1.at - Date.now()) < 60000, '有 id 和結束時間');

  // 再來一局（同房）＋認輸：多一筆不是覆蓋
  A.send({ t: 'again' }); B.send({ t: 'again' });
  await A.until((c) => c.room.state === 'play' && c.room.games === 2);
  await B.until((c) => c.room.state === 'play' && c.room.games === 2);
  await L.playMoves(A, B, [112]);
  const mover = L.moverNow(A, B), other = mover === A ? B : A;
  other.send({ t: 'resign' });
  await A.until((c) => c.room.state === 'over'); await sleep(400);
  list = await O.recs();
  ok(list.length === 2, '再來一局認輸：多一筆（共 2 筆）');
  const r2 = list[0];
  ok(r2.id !== r1.id && list[1].id === r1.id, '新局在前、第一局沒被覆蓋');
  ok(r2.n === 1 && r2.note === 'resign' && r2.names[0] === 'Bob' && r2.names[1] === 'Alice' && r2.win === (mover === B ? 0 : 1), `認輸局：座位交換（黑＝Bob）、贏家是沒認輸的 ${JSON.stringify(r2)}`);

  // 零手結束不存
  const g0 = await L.newGomoku(A, B);
  A.send({ t: 'resign' }); await A.until((c) => c.room.state === 'over'); await sleep(500);
  ok((await O.recs()).length === 2, '0 手就結束的五子棋局：沒有新增');
  // 離開房間回大廳（清掉座位）
  A.send({ t: 'leave' }); B.send({ t: 'leave' }); await sleep(300);

  // VCF：八仙渡（A 贏 3：1）
  console.log('== VCF 八仙渡');
  await L.newVcf(A, B, 'eight');
  await L.vSolve(B, 0);
  for (let k = 0; k < 3; k++) await L.vSolve(A, k);
  await A.until((c) => c.room.state === 'over', 20000); await sleep(400);
  list = await O.recs();
  const r3 = list[0];
  ok(list.length === 3 && r3.kind === 'vcf' && r3.vmode === 'eight' && r3.win === 0 && r3.score[0] === 3 && r3.score[1] === 1 && r3.names[0] === 'Alice' && r3.note === 'score', `八仙渡局內容正確 ${JSON.stringify(r3)}`);
  A.send({ t: 'leave' }); B.send({ t: 'leave' }); await sleep(300);

  // VCF：一線天（A 3：B 1）
  console.log('== VCF 一線天（約 20 秒）');
  await L.newVcf(A, B, 'line');
  const winners = [A, B, A, A];
  for (let r = 0; r < 4; r++) await L.vSolve(winners[r], r);
  await A.until((c) => c.room.state === 'over', 30000); await sleep(400);
  list = await O.recs();
  const r4 = list[0];
  ok(list.length === 4 && r4.kind === 'vcf' && r4.vmode === 'line' && r4.score[0] === 3 && r4.score[1] === 1 && r4.win === 0, `一線天局內容正確 ${JSON.stringify(r4)}`);
  const full = await O.ask({ t: 'rec', id: r4.id }, 'rec');
  ok(full.t === 'rec' && full.rec.review && full.rec.review.list.length >= 4 && full.rec.review.logs.length === 2 && full.rec.vcf.vmode === 'line', '單筆 rec：VCF 有 review（題目串、兩人 logs）和設定');
  const fg = await O.ask({ t: 'rec', id: r1.id }, 'rec');
  ok(fg.t === 'rec' && fg.rec.match.log.length === 9 && fg.rec.match.config.rule === 'free' && fg.rec.result.winnerSeat === 0, '單筆 rec：五子棋有 match.log（9 手）和 result');
  const gone = await O.ask({ t: 'rec', id: '0000000000000zzzz' }, 'rec');
  ok(gone.t === 'err' && gone.code === 'gone', '不存在的 id 回 err gone');
  const gone2 = await O.ask({ t: 'rec', id: "x'; DROP" }, 'rec');
  ok(gone2.t === 'err' && gone2.code === 'gone', '亂格式的 id 回 err gone');
  A.send({ t: 'leave' }); B.send({ t: 'leave' }); await sleep(300);

  // since 過濾
  const future = await O.recs(Date.now() + 5000);
  ok(Array.isArray(future) && future.length === 0, 'since 在未來 → 空清單');
  const mid = await O.recs(r3.at);
  ok(mid.length === 2 && mid[0].id === r4.id && mid[1].id === r3.id, 'since＝第三局的結束時間 → 只含第三、四局（新的在前）');

  // ================= 3. 私人房 =================
  console.log('== 3. 私人房可見範圍');
  const C = await R('Carol');
  const pid = await L.newGomoku(A, B, { priv: true });
  await L.playMoves(A, B, [112, 33]);
  B.send({ t: 'resign' }); await A.until((c) => c.room.state === 'over'); await sleep(400);
  await sleep(1100);
  const la = await A.recs(), lb = await B.recs(), lc = await C.recs(), lo = await O.recs();
  const pa = la.find((r) => r.priv), pb = lb.find((r) => r.priv);
  ok(pa && pa.mine === 0 && pb && pb.mine === 1 && pa.id === pb.id, `兩位玩家各自看得到那局（mine 0／1）`);
  ok(!lc.some((r) => r.priv) && !lo.some((r) => r.priv), '第三人／觀察者的清單沒有私人局');
  const direct = await C.ask({ t: 'rec', id: pa.id }, 'rec');
  ok(direct.t === 'err' && direct.code === 'gone', '第三人直接要那局的 id → gone');
  const own = await A.ask({ t: 'rec', id: pa.id }, 'rec');
  ok(own.t === 'rec' && own.rec.mine === 0 && own.rec.priv === true && own.rec.match.log.length === 3, '玩家自己要得到整筆（2 手＋認輸共 3 個動作）');
  const ids = [A.id, B.id];
  const leaks = [A, B, C, O].flatMap((c) => c.raw.filter((s) => (s.includes('"t":"recs"') || s.includes('"t":"rec"')) && ids.some((i) => s.includes(i))));
  ok(leaks.length === 0, `所有 recs／rec 回應都不含玩家 id（檢查 ${[A, B, C, O].reduce((n, c) => n + c.raw.filter((s) => s.includes('"t":"rec')).length, 0)} 則）`);
  A.send({ t: 'leave' }); B.send({ t: 'leave' }); await sleep(300);

  // 頻率限制
  const i0 = O.msgs.length;
  for (let i = 0; i < 8; i++) O.send({ t: 'recs', since: Date.now() - 1000 });
  await sleep(800);
  ok(O.msgs.slice(i0).some((m) => m.t === 'err' && m.code === 'slow'), '一秒內狂送 recs：收到 slow');
  await sleep(1200);

  // ================= 4. 重啟後還在 =================
  console.log('== 4. 重啟 wrangler dev 後資料還在');
  const before = (await O.recs()).map((r) => r.id);
  clients.forEach((c) => c.close()); clients.length = 0;
  L.stopWr(); await sleep(1500);
  await L.startWr(PERSIST);
  const O2 = await R('Obs2');
  const after = (await O2.recs()).map((r) => r.id);
  ok(before.length === 4 && JSON.stringify(before) === JSON.stringify(after), `重啟後清單相同（${after.length} 筆）`);
  const again = await O2.ask({ t: 'rec', id: r1.id }, 'rec');
  ok(again.t === 'rec' && again.rec.match.log.length === 9, '重啟後單筆 rec 還拿得到');

  // ================= 5–7. 頁面 =================
  console.log('== 5. 頁面：今日棋局＋回看');
  b = await L.launch();
  const P = await L.mk(b, { nick: 'Cat' });
  const pubList = await O2.recs();
  ok(await P.evaluate(() => document.getElementById('lobTabs').children.length) === 2, '大廳有兩個切換鈕');
  ok(await P.evaluate(() => document.querySelector('#lobTabs .gold').dataset.tab) === 'rooms', '預設在「對局」');
  await P.screenshot({ path: SH + 'lobby_rooms.png' });
  await P.click('[data-tab="recs"]'); await sleep(700);
  const cards = await P.evaluate(() => document.querySelectorAll('.roomc.rec').length);
  ok(cards === pubList.length && cards === 4, `今日棋局出現 ${cards} 張卡（等於公開局數 ${pubList.length}）`);
  const txt = await P.evaluate(() => document.getElementById('list').innerText);
  ok(txt.includes('Alice') && txt.includes('Bob') && txt.includes('9 手') && txt.includes('3 : 1') && txt.includes('一線天') && txt.includes('八仙渡'), '卡片有暱稱、手數、比分、玩法名');
  await P.screenshot({ path: SH + 'lobby_recs.png' });
  // 捲動位置：清單捲一點、點下面那張
  await P.evaluate(() => { const l = document.getElementById('list'); l.scrollTop = 120; });
  const sc0 = await P.evaluate(() => document.getElementById('list').scrollTop);
  const sentBefore = (await L.sentTypes(P)).length;
  await P.evaluate((id) => document.querySelector(`[data-rec="${id}"]`).click(), r1.id);
  await P.waitForFunction(() => window.__duel.REPLAY, null, { timeout: 5000 });
  await sleep(400);
  const st1 = await P.evaluate(() => ({ cur: window.__duel.REPLAY.cur, n: window.__duel.match.moves.length, sRoomHidden: document.getElementById('sRoom').hidden, title: document.getElementById('rTitle').textContent, status: document.getElementById('status').textContent, facts: document.getElementById('facts').textContent, acts: document.getElementById('rActs').children.length, sit: document.querySelectorAll('[data-sit]').length, endHidden: document.getElementById('mEnd').hidden, inv: getComputedStyle(document.getElementById('rInvite')).display === 'none', btns: [...document.querySelectorAll('#phaseActs button')].map((x) => x.textContent) }));
  ok(!st1.sRoomHidden && st1.cur === 9 && st1.n === 9, `點五子棋局 → 回看畫面、停在最後一手（${st1.cur}/${st1.n}）`);
  ok(st1.status.includes('黑棋勝') && st1.facts.includes('第 9／9 手') && st1.title.includes('普規'), `狀態列＝${st1.status}｜${st1.facts}｜${st1.title}`);
  ok(st1.acts === 0 && st1.sit === 0 && st1.endHidden && st1.inv, '沒有入座／再來一局／研棋／認輸／邀請');
  ok(JSON.stringify(st1.btns) === JSON.stringify(['|◀', '◀', '▶', '▶|']), '導覽鈕：第一手 上一手 下一手 最後一手');
  const bars = await P.evaluate(() => document.getElementById('pTop').innerText + '|' + document.getElementById('pBot').innerText);
  ok(bars.includes('Alice') && bars.includes('Bob') && bars.includes('勝'), `玩家列有暱稱和勝標記：${bars.replace(/\n/g, ' ')}`);
  await P.screenshot({ path: SH + 'replay_gomoku_end.png' });
  const sEnd = await L.sig(P);
  await P.click('[data-rp="prev"]'); await sleep(200);
  const sPrev = await L.sig(P), cur8 = await P.evaluate(() => window.__duel.REPLAY.cur);
  ok(cur8 === 8 && sPrev !== sEnd, '◀ 退一手：第 8 手、畫面變了（少一顆子）');
  const cnt = async () => P.evaluate(() => { const d = window.__duel; return d.match.moves.slice(0, d.REPLAY.cur).length; });
  ok(await cnt() === 8, '盤上棋子數 8');
  await P.click('[data-rp="first"]'); await sleep(200);
  ok(await cnt() === 0 && await P.evaluate(() => document.querySelector('[data-rp="prev"]').disabled), '|◀ 回到開頭：0 顆、◀ 停用');
  await P.screenshot({ path: SH + 'replay_gomoku_start.png' });
  await P.click('[data-rp="next"]'); await P.click('[data-rp="next"]'); await sleep(150);
  ok(await cnt() === 2, '▶ 兩次：2 顆');
  await P.click('[data-rp="last"]'); await sleep(200);
  ok(await sig2(P) === sEnd, '▶| 回最後一手：畫面等於一開始');
  const sent1 = (await L.sentTypes(P)).slice(sentBefore);
  ok(sent1.every((t) => t === 'rec' || t === 'ping'), `回看期間只送過 rec／ping：${JSON.stringify(sent1)}`);

  // 6. 回看時大廳廣播
  console.log('== 6. 回看中大廳廣播不拉走畫面');
  const D = await R('Dan'), E = await R('Eve');
  const titleBefore = await P.evaluate(() => document.getElementById('rTitle').textContent);
  await L.newGomoku(D, E);
  await L.playMoves(D, E, [112, 33, 113]);
  await sleep(500);
  const st6 = await P.evaluate(() => ({ rep: !!window.__duel.REPLAY, hidden: document.getElementById('sRoom').hidden, id: window.__duel.room && window.__duel.room.id, title: document.getElementById('rTitle').textContent, cur: window.__duel.REPLAY && window.__duel.REPLAY.cur }));
  ok(st6.rep && !st6.hidden && st6.id === 'rec' && st6.title === titleBefore && st6.cur === 9, `D、E 開房對局（大廳廣播）後仍在回看：${JSON.stringify(st6)}`);
  ok(await L.sig(P) === sEnd, '棋盤沒被改動');
  // 斷線重連
  const wsN0 = await P.evaluate(() => window.__wsN);
  // 真的斷線：把本機伺服器關掉再開（資料還在），頁面會自己重連
  L.stopWr(); await sleep(1500); await L.startWr(PERSIST);
  await P.waitForFunction((n) => window.__wsN > n && window.__ws.readyState === 1, wsN0, { timeout: 40000 }); await sleep(800);
  const st6b = await P.evaluate(() => ({ n: window.__wsN, rep: !!window.__duel.REPLAY, hidden: document.getElementById('sRoom').hidden, id: window.__duel.room && window.__duel.room.id }));
  const sent6 = (await L.sentTypes(P)).slice(sentBefore);
  ok(st6b.rep && !st6b.hidden && st6b.id === 'rec', `斷線重連後仍在回看（伺服器關掉再開，新連線數 ${wsN0} → ${st6b.n}）`);
  ok(sent6.every((t) => ['rec', 'ping'].includes(t)), `重連後也沒送 view／sit／leave／join：${JSON.stringify([...new Set(sent6)])}`);
  D.send({ t: 'leave' }); E.send({ t: 'leave' });
  // 返回
  await P.click('#rBack'); await sleep(400);
  const back = await P.evaluate(() => ({ lobHidden: document.getElementById('sLobby').hidden, tab: document.querySelector('#lobTabs .gold').dataset.tab, cards: document.querySelectorAll('.roomc.rec').length, sc: document.getElementById('list').scrollTop, rep: window.__duel.REPLAY }));
  ok(!back.lobHidden && back.tab === 'recs' && back.cards === 4 && back.rep === null, `返回 → 大廳「今日棋局」清單（${back.cards} 張）`);
  ok(Math.abs(back.sc - sc0) <= 2, `清單捲動位置保留（${sc0} → ${back.sc}${sc0 === 0 ? '；注意清單沒有超出，這項沒有實質驗證' : ''}）`);
  ok(!(await L.sentTypes(P)).includes('view') && !(await L.sentTypes(P)).includes('sit') && !(await L.sentTypes(P)).includes('leave'), '整個過程沒送過 view／sit／leave');

  // VCF 回看
  await P.evaluate((id) => document.querySelector(`[data-rec="${id}"]`).click(), r4.id);
  await P.waitForFunction(() => window.__duel.REPLAY && window.__duel.RV, null, { timeout: 5000 }); await sleep(500);
  const v1 = await P.evaluate(() => ({ k: window.__duel.RV.k, who: window.__duel.RV.who, btn: [...document.querySelectorAll('#phaseActs button')].map((x) => x.textContent), status: document.getElementById('status').textContent, facts: document.getElementById('facts').textContent, acts: document.getElementById('rActs').children.length, title: document.getElementById('rTitle').textContent }));
  ok(v1.k === 0 && v1.btn.includes('◀') && v1.btn.includes('▶') && v1.btn.includes('正解') && v1.btn.includes('Alice') && v1.btn.includes('Bob'), `VCF 回看：◀ ▶ 正解 ＋ 兩位暱稱鈕（${v1.btn.join('｜')}）`);
  ok(v1.status.includes('3 : 1') && v1.acts === 0 && v1.title.includes('一線天'), `VCF 狀態「${v1.status}」、沒有操作鈕、標題「${v1.title}」`);
  await P.screenshot({ path: SH + 'replay_vcf.png' });
  const vs0 = await L.sig(P);
  await P.click('[data-rv="next"]'); await sleep(500);
  ok(await P.evaluate(() => window.__duel.RV.k) === 1 && await L.sig(P) !== vs0, '▶ 換到下一題（題號 1、畫面變）');
  await P.click('[data-rv="1"]'); await sleep(500);
  ok(await P.evaluate(() => window.__duel.RV.who) === 1, '點對手暱稱鈕換成看他的手順');
  await P.click('[data-rv="0"]'); await sleep(300);
  ok(await P.evaluate(() => window.__duel.RV.who) === 0, '點另一位換回來');
  await P.click('#rBack'); await sleep(300);
  ok(await P.evaluate(() => !document.getElementById('sLobby').hidden && document.querySelector('#lobTabs .gold').dataset.tab === 'recs' && document.querySelectorAll('.roomc.rec').length === 4), 'VCF 回看返回 → 今日棋局清單');

  // 切回「對局」再切進來會重抓（新增一局後多一張）
  await P.click('[data-tab="rooms"]'); await sleep(200);
  ok(await P.evaluate(() => document.getElementById('lobTabs').querySelector('.gold').dataset.tab) === 'rooms', '切回「對局」');
  ok(errs(P).length === 0, '頁面沒有 JS 錯誤 ' + JSON.stringify(errs(P)));

  // 空清單、舊伺服器
  console.log('== 舊伺服器：不認得 recs');
  {
    const Q = await L.mk(b, { nick: 'Old' });
    // 模擬舊伺服器：recs／rec 改成伺服器不認得的訊息（default → err bad）
    await Q.evaluate(() => { window.__rewrite = (d) => d.replace('"t":"recs"', '"t":"recsOLD"').replace('"t":"rec"', '"t":"recOLD"'); });
    await Q.click('[data-tab="recs"]'); await sleep(800);
    const old = await Q.evaluate(() => ({ txt: document.getElementById('list').innerText, toast: !!document.querySelector('.toast'), modal: [...document.querySelectorAll('.modal')].some((m) => !m.hidden) }));
    ok(old.txt.includes('今天還沒有棋局') && !old.toast && !old.modal, `舊伺服器回 bad → 顯示空狀態、沒有錯誤視窗（${old.txt.trim()}）`);
    ok(errs(Q).length === 0, '舊伺服器情境沒有 JS 錯誤');
    await Q.context().close();
  }

  // ================= 7. 不可捲動 =================
  console.log('== 7. 版面：4 語言 × 2 尺寸');
  const fakes = (n) => Array.from({ length: n }, (_, i) => i % 3 === 0
    ? { id: 'f' + i, at: Date.now() - i * 60000, kind: 'vcf', vmode: i % 2 ? 'line' : 'eight', rank: 1 + (i % 10), score: [3, 2], names: ['WWWWWWWWWWWW', '十二個字的暱稱十二個字'], win: 0, note: 'score', priv: i % 4 === 0, mine: i % 5 === 0 ? 1 : null }
    : { id: 'f' + i, at: Date.now() - i * 60000, kind: 'gomoku', rule: ['free', 'renju', 'tara', 'tara10', 'swap2'][i % 5], time: i % 2 ? 'none' : '10+10', n: 100 + i, names: ['MMMMMMMMMMMM', 'Bob'], win: i % 2 ? 1 : null, note: null, priv: false, mine: null, cols: i % 2 ? [1, 2] : [2, 1] });
  for (const lang of ['zh', 'en', 'ja', 'ko']) for (const [w, h] of [[375, 667], [360, 640]]) {
    const X = await L.mk(b, { lang, w, h, nick: 'Cat' });
    const tag = `${lang} ${w}×${h}`;
    const chk = async (what) => { const f = await L.fit(X); ok(f.sh <= f.ih && f.sw <= f.iw && f.bad.length === 0, `${tag} ${what}：高 ${f.sh}/${f.ih} 寬 ${f.sw}/${f.iw}${f.bad.length ? ' 溢出 ' + JSON.stringify(f.bad) : ''}`); };
    await X.click('[data-tab="recs"]'); await sleep(700);
    await chk('今日棋局（真資料 4 筆）');
    await X.evaluate(() => window.__duel.setRecs([])); await sleep(100);
    await chk('今日棋局（0 筆）');
    await X.evaluate((f) => window.__duel.setRecs(f), fakes(30)); await sleep(150);
    await chk('今日棋局（30 筆）');
    const inner = await X.evaluate(() => { const l = document.getElementById('list'); return l.scrollHeight > l.clientHeight && getComputedStyle(l).overflowY === 'auto'; });
    ok(inner, `${tag} 30 筆時清單在自己的區塊內捲`);
    if (lang === 'zh' && w === 375) await X.screenshot({ path: SH + 'lobby_recs_30.png' });
    // 回真資料，開回看
    await X.click('[data-tab="rooms"]'); await sleep(150); await X.click('[data-tab="recs"]'); await sleep(700);
    await X.evaluate((id) => document.querySelector(`[data-rec="${id}"]`).click(), r1.id);
    await X.waitForFunction(() => window.__duel.REPLAY, null, { timeout: 5000 }); await sleep(500);
    await chk('五子棋回看（終局）');
    await X.click('[data-rp="prev"]'); await sleep(150);
    await chk('五子棋回看（退一手）');
    if (lang === 'en' && w === 360) await X.screenshot({ path: SH + 'replay_gomoku_en_360.png' });
    await X.click('#rBack'); await sleep(300);
    await X.evaluate((id) => document.querySelector(`[data-rec="${id}"]`).click(), r4.id);
    await X.waitForFunction(() => window.__duel.REPLAY && window.__duel.RV, null, { timeout: 5000 }); await sleep(600);
    await chk('VCF 回看');
    if (lang === 'ko' && w === 375) await X.screenshot({ path: SH + 'replay_vcf_ko.png' });
    errsAll.push(...errs(X));
    await X.context().close();
  }
  ok(errsAll.length === 0, '版面測試全程沒有 JS 錯誤 ' + JSON.stringify(errsAll));
} catch (e) {
  console.log('  FAIL 腳本例外：', e && e.stack || e);
  L.ok(false, '腳本例外');
} finally {
  try { if (b) await b.close(); } catch {}
  clients.forEach((c) => c.close());
  L.stopWr();
  try { rmSync(PERSIST, { recursive: true, force: true }); } catch {}
}
const f = L.done();
process.exit(f ? 1 : 0);

function errs(p) { return p.errs.filter((e) => !/Failed to load resource|ERR_/.test(e)); }
async function sig2(p) { return L.sig(p); }
