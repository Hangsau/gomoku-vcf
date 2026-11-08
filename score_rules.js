// score_rules.js — 給分規則（唯一一份；2026-11-08 使用者：重跑要快、網站評分要同一套）
// 引擎（vcfgen score／網站 vcfscore.wasm）只量測盤面事實（facts），分數全部由這支照規則算：
//   本機題庫：node engine/score_facts.mjs（幾秒重算全部題目）；網站：score.html／game 直接載入這支。
// 改任何給分規則 → 只改這支＋ RULES_VER，重跑 score_facts.mjs，不必重跑引擎。
// facts 欄位（score_api.hpp 輸出）：atk 'b'|'w'、nb、nw、L、uniq、det、stepFours[]、stepReads[]、trap、counter、prep、order、finish、
//   lifts[{at,past,shape,newFour,over44}]、decoys[[手數,反擊,算深誘餌,單獨一區]]；removals[{q,c,f}]＝拿掉每顆子後的 facts（不合格時 f＝null）
(function (root) {
  'use strict';
  const RULES_VER = '2026-11-09a';   // 2026-11-09a：白先判斷 +45（使用者定案）；2026-11-08b：解禁分種類

  // ---- 參數（改規則就改這裡；說明文字在下面 RULES，跟著改）----
  const P = {
    stepBase: 20, stepK: 20,          // 每手價值＝stepBase＋stepK×log2(選擇數)，選擇數＝這一手能下的衝四數÷2，不到 1 當 1
    decoyPerLen: 6, decoyCounter: 10, decoyCap: 120, isoEach: 2, isoCap: 20,
    trapEach: 3, counterEach: 8,      // 第 k 個 each×(1−0.5^k)
    liftTrue: 60, liftPass: 15, liftFourThree: 0,   // 解禁（使用者 2026-11-08 定案）：真解禁 60、路過解禁 15、二二三三變四三 0
    prep: 30, order: 15, forbidWin: 30, detour: 15,
    whiteJudge: 45,                   // 白先判斷（使用者 2026-11-09）：白先一開始要判斷是逼黑下禁手還是自己下四三；競速數據同分同能力白先約難 ×1.3（95% ×0.98～×1.72，54 次作答），中位分 156 ×0.3≈45
    minLen: 4,
    usefulDrop: 0.9,                   // 拿掉後分數 < 原始分×0.9＝有用
    usageMid: 0.75, usageLo: 0.7, usageHi: 1.25, balance: 0.97,
  };

  // 解禁種類（引擎量測 lifts[]：past＝最後一次是禁手時 1 長連 2 四四 3 三三；shape＝現在只看形狀；newFour；over44）
  //   真解禁：形狀還是三三、只因其中一個三的成活四點本身是禁手才能下（past 3 且 shape 3）；或原本四四、其中一個四現在再下會長連（over44）
  //   二二三三變四三：原本兩個二組成的三三禁點，其中一條線多了子，現在下這點是四三（past 3 且成四的方向當時是三）→ 不算
  //   其他（黑棋路過把子用掉、形狀不再是禁手）＝路過解禁
  function liftKind(l) {
    if ((l.past === 3 && l.shape === 3) || (l.past === 2 && l.over44)) return 'true';
    if (l.past === 3 && l.newFour) return 'fourThree';
    return 'pass';
  }
  const LIFT_PTS = { true: () => P.liftTrue, pass: () => P.liftPass, fourThree: () => P.liftFourThree };
  const grow = (each, n) => { let t = 0; for (let k = 1; k <= n; k++) t += each * (1 - Math.pow(0.5, k)); return t; };
  const r1 = (x) => Math.round(x * 10) / 10;

  // 各項分數（沒乘使用率）
  function parts(f) {
    const steps = (f.stepFours || []).map(n => P.stepBase + P.stepK * Math.log2(Math.max(1, n / 2)));
    let deep = 0, iso = 0;
    for (const [len, counter, counted, isIso] of f.decoys || []) {
      if (counted) deep += P.decoyPerLen * len + (counter ? P.decoyCounter : 0);
      else if (isIso) iso++;
    }
    const out = {
      '計算量': steps.reduce((a, b) => a + b, 0),
      '深誘餌': Math.min(P.decoyCap, deep) - Math.min(P.isoCap, P.isoEach * iso),
      '禁手陷阱': grow(P.trapEach, f.trap || 0),
      '解禁': (f.lifts || []).reduce((a, l) => a + LIFT_PTS[liftKind(l)](), 0),
      '反四': grow(P.counterEach, f.counter || 0),
      '預備反四': P.prep * (f.prep || 0),
      '手順': P.order * (f.order || 0),
      '繞路': -P.detour * Math.max(0, f.det),
    };
    if (f.atk === 'w') { out['禁手勝'] = f.finish ? P.forbidWin : 0; out['白先判斷'] = P.whiteJudge; }
    return { parts: out, steps };
  }
  // 沒乘使用率的原始分（引擎的 raw）。加總順序照引擎，浮點數才會一模一樣
  function rawScore(f) {
    const { parts: p } = parts(f);
    return p['禁手陷阱'] + p['解禁'] + p['反四'] + p['預備反四'] + p['手順'] + p['計算量'] + p['深誘餌'] + p['繞路'] + (p['禁手勝'] || 0);
  }
  const accepted = (f) => !!f && f.uniq && f.det === 0 && f.L >= P.minLen;

  // 使用率：每顆子 必要(2)／有用(1)／廢子(0)；黑白成對拿掉才算真廢子
  function usage(f, removals, raw) {
    let need = 0, useful = 0, n = 0, wB = 0, wW = 0;
    const waste = [];
    for (const r of removals) {
      n++;
      const g = r.f;
      const role = !(g && g.L === f.L && g.uniq && g.det >= 0 && g.det <= f.det) ? 2 : (r1(rawScore(g)) < raw * P.usefulDrop ? 1 : 0);
      if (role === 2) need++; else if (role === 1) useful++;
      else { waste.push(r.q); if (r.c === 'b') wB++; else wW++; }
    }
    const d = f.nb - f.nw, target = f.atk === 'b' ? 0 : 1;
    const pairs = Math.min(wB, wW);
    let extra = 0;
    if (d > target) extra = Math.min(wB - pairs, d - target);
    else if (d < target) extra = Math.min(wW - pairs, target - d);
    useful += waste.length - (2 * pairs + extra);
    const rate = n ? (need + useful) / n : 1;
    const mult = Math.max(P.usageLo, Math.min(P.usageHi, 1 + (rate - P.usageMid)));
    return { rate, mult, need, useful, waste: n - need - useful, wasteAt: waste.join(' ') };
  }

  // 一題的完整分數。rec＝引擎輸出（含 facts、removals）
  function score(rec) {
    const f = rec && rec.facts;
    if (!f) return { accepted: false, score: 0 };
    const raw = rawScore(f), acc = accepted(f);
    // 白先判斷加在使用率之前、但不進 raw：判斷每顆子必要／有用／廢子時照舊只看盤面技巧分，固定加分不影響分類
    const judge = f.atk === 'w' ? P.whiteJudge : 0;
    let fin = raw + judge, u = null, balance = false;
    if (acc && Array.isArray(rec.removals)) { u = usage(f, rec.removals, raw); fin = (raw + judge) * u.mult; }
    const dd = f.nb - f.nw;
    if (acc && (f.atk === 'b' ? dd !== 0 : dd < 0)) { fin *= P.balance; balance = true; }
    const { parts: p, steps } = parts(f);
    return { ver: RULES_VER, accepted: acc, score: r1(fin), raw, usage: u, balancePenalty: balance ? P.balance : null, parts: p, stepValues: steps.map(r1), L: f.L };
  }

  // 給看板／後台顯示的規則說明（跟上面參數同一份）
  const RULES = [
    { name: '每手價值', key: '計算量', text: `每一手 ${P.stepBase} ＋ ${P.stepK} × log₂(這一手能下的衝四數 ÷ 2)，不到 1 當 1；全題加總。只有一條路的手 ${P.stepBase} 分。` },
    { name: '深誘餌', key: '深誘餌', text: `錯的第一手能連走 ≥4 手、後一手用到這條路下過的子、又連到解答用的棋：每條 ${P.decoyPerLen} × 手數，被白反擊才斷再 +${P.decoyCounter}，全部最多 ${P.decoyCap}。太淺又單獨一區的錯路每條 −${P.isoEach}，最多 −${P.isoCap}。` },
    { name: '禁手陷阱', key: '禁手陷阱', text: `看起來能衝四其實是禁手的點，同一點只算一次；第 k 個得 ${P.trapEach} × (1 − 0.5^k)。` },
    { name: '解禁', key: '解禁', text: `真解禁 ${P.liftTrue}：形狀還是三三，只因其中一個三要成活四的點本身是禁手才能下；或原本四四、其中一個四再下會長連。路過解禁 ${P.liftPass}：黑棋路過把那些子用掉，形狀不再是禁手。原本兩個二組成的三三禁點、後來變成四三點的不算（0）。` },
    { name: '反四', key: '反四', text: `白擋的同時自己成四、黑要先擋回去：第 k 次得 ${P.counterEach} × (1 − 0.5^k)。` },
    { name: '預備反四', key: '預備反四', text: `黑擋回去的四用到更早佈好、之前沒用過的子：每次 ${P.prep}。` },
    { name: '手順', key: '手順', text: `後面才該下的四現在先衝就贏不了：每手最多算 2 個，每個 ${P.order}。` },
    { name: '禁手勝', key: '禁手勝', text: `白先最後一手逼黑擋在禁手點（黑擋不了）：+${P.forbidWin}，只有白先題。` },
    { name: '白先判斷', key: '白先判斷', text: `白先題每題 +${P.whiteJudge}：一開始要先判斷是逼黑下禁手、還是自己下四三。` },
    { name: '繞路', key: '繞路', text: `多走幾手也能贏的另一條路每條 −${P.detour}；合格題一定是 0（有就不收）。` },
  ];
  const USAGE_RULE = `使用率＝（必要的子＋有用的子）÷ 全部子。必要＝拿掉這顆題目就壞了（沒 VCF、手數變、不唯一、繞路變多）；有用＝拿掉後分數掉到 ${Math.round(P.usefulDrop * 100)}% 以下（佈假路、陷阱）；其他是廢子，黑白要成對拿掉才算真廢子。倍數＝1 ＋（使用率 − ${P.usageMid}），最低 ×${P.usageLo}、最高 ×${P.usageHi}。黑先黑白不一樣多、白先白比黑多，再 ×${P.balance}。`;

  const api = { RULES_VER, P, liftKind, parts, rawScore, accepted, usage, score, RULES, USAGE_RULE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScoreRules = api;
})(typeof self !== 'undefined' ? self : this);
