// score-worker.js — 詰題評分在背景跑（不卡住畫面）；引擎是 vcf-slover 的 C++ 編成的 WebAssembly（vcfscore.js / vcfscore.wasm）
// 收：{ id, black, white, attackerWhite, scale, anyCount } → 回：{ id, ok, result | error }（anyCount＝算使用率時不檢查黑白子數，2026-11-07b）
const V = '20261112a';   // 2026-11-12a：空四開出新路算繞路（不合格）； -m（2026-11-08）：多了 vcf_move，評分不變   // 引擎換版就改這裡，瀏覽器才會重抓（2026-11-08a 每手價值）
importScripts('vcfscore.js?v=' + V, 'score_rules.js?v=' + V);   // score_rules.js：給分規則（引擎只量測盤面事實，分數照規則算，跟本機題庫同一份，2026-11-08）
let modP = null;
function mod() {
  if (!modP) modP = VcfScore({ locateFile: f => f + '?v=' + V });
  return modP;
}
self.onmessage = async (e) => {
  const { id, black, white, attackerWhite, scale, play, move, anyCount } = e.data;
  try {
    const M = await mod();
    if (move) {   // Gomoku Rush 判定（2026-11-08）：下一手、電腦擋、判對方連五／被禁手／沒四了；不搜 VCF
      const out = M.ccall('vcf_move', 'string', ['string', 'string', 'string', 'number'], [black, white, move, attackerWhite ? 1 : 0]);
      self.postMessage({ id, ok: true, move: true, result: JSON.parse(out) });
      return;
    }
    if (play) {   // 試走（2026-11-07）：下一手，電腦擋，回報剩幾手 VCF
      const out = M.ccall('vcf_play2', 'string', ['string', 'string', 'string', 'number'], [black, white, play, attackerWhite ? 1 : 0]);
      self.postMessage({ id, ok: true, play: true, result: JSON.parse(out) });
      return;
    }
    const t0 = performance.now();
    const out = M.ccall('vcf_score', 'string', ['string', 'string', 'number', 'number', 'number'], [black, white, attackerWhite ? 1 : 0, scale || 1, anyCount ? 1 : 0]);
    const result = JSON.parse(out);
    if (result.facts) {   // 分數照規則檔（還沒算使用率；使用率由頁面收齊每顆子的量測後再交給規則檔）
      const S = ScoreRules.score({ facts: result.facts });
      result.score = S.score; result.raw = S.raw; result.accepted = S.accepted; result.shortParts = S.parts;
      result.stepValues = S.stepValues; result.balancePenalty = S.balancePenalty; result.rulesVer = S.ver;
    }
    self.postMessage({ id, ok: true, ms: Math.round(performance.now() - t0), result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
