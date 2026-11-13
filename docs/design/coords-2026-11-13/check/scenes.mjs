// 情境矩陣：game.html 與 duel.html 各畫面 × 尺寸 × 四語，量測棋盤與頁面。基準（改動前）與驗收（改動後）共用。
// states=['off'] 只量預設（改動前沒有座標功能）；states=['off','on'] 另用 RushSkin.setCoords(true) 切換量開著。
import * as H from './h.mjs';
import * as L from 'file:///C:/claudehome/projects/VCF/docs/design/duel-records-2026-11-13/check/lib.mjs';
const { sleep } = H;

async function snapVps(p, kind, key, states, out, vps = H.VPS, extra = null) {
  for (const [w, h] of vps) {
    await H.resizeTo(p, w, h);
    if (extra) await extra(p);
    for (const st of states) {
      if (st === 'on') await H.setCoords(p, true);
      else if (await H.hasCoords(p)) await H.setCoords(p, false);
      await sleep(150);
      out[`${key}|${w}x${h}|${st}`] = await H.meas(p, kind);
    }
    if (states.includes('on')) await H.setCoords(p, false);
  }
}

export async function gameMatrix(b, states, out, { langs = H.LANGS, scenes = H.GAME_SCENES, vps = H.VPS } = {}) {
  for (const lang of langs) for (const scene of scenes) {
    const [w0, h0] = vps[0];
    const c = await H.mkCtx(b, { lang, w: w0, h: h0 });
    try {
      const p = await H.gameScene(c, scene);
      const bad = await p.evaluate(() => window.__simErr || null);
      if (bad) console.log('  sim 錯誤', scene, bad);
      await snapVps(p, 'game', `game|${scene}|${lang}`, states, out, vps);
      if (H.errsOf(p).length) out[`errs|game|${scene}|${lang}`] = H.errsOf(p);
    } catch (e) { out[`fail|game|${scene}|${lang}`] = String(e).slice(0, 200); console.log('  失敗', scene, lang, String(e).slice(0, 120)); }
    await c.close();
  }
}

// duel：每種語言一輪（三個玩家頁）；每個畫面逐尺寸量。replayRec＝一筆本機今日棋局（可為 null）
export async function duelMatrix(b, states, out, { langs = H.LANGS, vps = H.VPS, replayEntry = null, keep = null } = {}) {
  for (const lang of langs) {
    const ctxs = await Promise.all(['Alice', 'Bob', 'Cara'].map((n) => H.mkCtx(b, { lang, nick: n })));
    const A = await H.openPage(ctxs[0], 'duel.html'), B = await H.openPage(ctxs[1], 'duel.html'), C = await H.openPage(ctxs[2], 'duel.html');
    const K = (s) => `duel|${s}|${lang}`;
    try {
      // 五子棋
      const g1 = await H.newRoom(A, B, { t: 'create', kind: 'gomoku', time: 'none', rule: 'renju', color: 'b', priv: false });
      await H.watch(C, g1); await sleep(500);
      await snapVps(A, 'duel', K('gomoku-play'), states, out, vps);
      await snapVps(C, 'duel', K('gomoku-watch'), states, out, vps);
      await H.wsSend(A, { t: 'leave' }); await H.wsSend(B, { t: 'leave' }); await sleep(500);
      await C.click('#rBack').catch(() => {}); await sleep(500);
      // VCF（一線天，3 題先到）
      const v1 = await H.newRoom(A, B, { t: 'create', kind: 'vcf', vmode: 'line', rank: 1, think: 180, target: 3, priv: false, color: 'b' });
      await H.watch(C, v1);
      await H.waitFn(C, () => { const d = window.__duel, st = d.room.vs.p[0]; return st && st.puzzle && Date.now() >= st.at && st.s === 'think'; });
      await sleep(400);
      await snapVps(A, 'duel', K('vcf-play'), states, out, vps);
      const SB = B.__seat;
      await H.firstMove(B, 0);
      await H.waitFn(C, (s) => window.__duel.watchFocus === s, SB, 15000);
      await sleep(500);
      await snapVps(C, 'duel', K('vcf-watch'), states, out, vps);
      // 手動點另一列 → 出現「自動」鈕
      await C.click(SB === 0 ? '#pBot' : '#pTop').catch(() => {}); await sleep(400);
      await snapVps(C, 'duel', K('vcf-watch-auto'), states, out, vps);
      // 打完：A 連解三題
      for (let i = 0; i < 3; i++) await H.solveReal(A, i);
      await H.waitFn(A, () => window.__duel.room.state === 'over', null, 40000);
      await sleep(900);
      // 賽後逐題回看
      await H.waitFn(A, () => !document.getElementById('mEnd').hidden, null, 15000).catch(() => {});
      await A.click('#bLook', { timeout: 8000 }).catch((e) => { out[`fail|duel|bLook|${lang}`] = String(e).slice(0, 120); }); await sleep(600);
      out[`info|duel|review-modal-closed|${lang}`] = await A.evaluate(() => document.getElementById('mEnd').hidden);
      await snapVps(A, 'duel', K('vcf-review'), states, out, vps);
      await A.waitForSelector('[data-rv="undo"]:not([disabled])', { timeout: 15000 }).catch(() => {});
      await A.click('[data-rv="undo"]', { timeout: 8000 }).catch((e) => { out[`fail|duel|undo|${lang}`] = String(e).slice(0, 120); }); await sleep(500);
      out[`info|duel|review-free|${lang}`] = await A.evaluate(() => /自己擺|Your line|自分で打つ|직접 두기/.test(document.getElementById('facts').textContent));
      await snapVps(A, 'duel', K('vcf-review-free'), states, out, vps);
      // 今日棋局回看
      if (replayEntry) {
        const D = await H.mkCtx(b, { lang });
        const P = await H.openPage(D, 'duel.html');
        await P.evaluate((s) => localStorage.setItem('vcfgame.today', s), JSON.stringify([replayEntry]));
        await P.goto(H.BASE + '/duel.html?again=1'); await P.goto(H.BASE + '/duel.html#replay=' + replayEntry.id); await sleep(1300);
        await snapVps(P, 'duel', K('replay'), states, out, vps);
        out[`errs|duel|replay|${lang}`] = H.errsOf(P);
        await D.close();
      }
      if (keep) keep.push(...[A, B, C]);
    } catch (e) { out[`fail|duel|${lang}`] = String(e).slice(0, 300); console.log('  duel 失敗', lang, String(e).slice(0, 200)); }
    out[`errs|duel|${lang}`] = [...H.errsOf(A), ...H.errsOf(B), ...H.errsOf(C)];
    if (!keep) await Promise.all(ctxs.map((c) => c.close()));
  }
}

// 用假玩家打一局五子棋，從伺服器取回放紀錄，包成「今日棋局」一筆
export async function makeReplayEntry() {
  const P1 = await L.rc('Alice'), P2 = await L.rc('Bob'), O = await L.rc('Obs');
  try {
    const id = await L.newGomoku(P1, P2, { rule: 'free', time: 'none' });
    const t0 = Date.now() - 5000;
    const first = [P1, P2].find((c) => c.room.seats[0] && c.room.seats[0].id === c.id);
    await L.playMoves(P1, P2, L.FIVE);
    await sleep(800);
    const list = await O.recs(t0);
    const r = list.find((x) => x.id) || list[0];
    const m = await O.ask({ t: 'rec', id: r.id }, 'rec');
    return { at: m.rec.at, src: 'duel', id: 'dtest1', gk: 'g1', sum: { kind: m.rec.kind, opp: 'x', res: 'w', n: m.rec.n || 0 }, rec: m.rec };
  } finally { [P1, P2, O].forEach((c) => c.close()); }
}
