// score-worker.js — 詰題評分在背景跑（不卡住畫面）；引擎是 vcf-slover 的 C++ 編成的 WebAssembly（vcfscore.js / vcfscore.wasm）
// 收：{ id, black, white, attackerWhite, scale } → 回：{ id, ok, result | error }
const V = '20261107c';   // 引擎換版就改這裡，瀏覽器才會重抓（2026-11-07）
importScripts('vcfscore.js?v=' + V);
let modP = null;
function mod() {
  if (!modP) modP = VcfScore({ locateFile: f => f + '?v=' + V });
  return modP;
}
self.onmessage = async (e) => {
  const { id, black, white, attackerWhite, scale, play } = e.data;
  try {
    const M = await mod();
    if (play) {   // 試走（2026-11-07）：下一手，電腦擋，回報剩幾手 VCF
      const out = M.ccall('vcf_play2', 'string', ['string', 'string', 'string', 'number'], [black, white, play, attackerWhite ? 1 : 0]);
      self.postMessage({ id, ok: true, play: true, result: JSON.parse(out) });
      return;
    }
    const t0 = performance.now();
    const out = M.ccall('vcf_score', 'string', ['string', 'string', 'number', 'number'], [black, white, attackerWhite ? 1 : 0, scale || 1]);
    self.postMessage({ id, ok: true, ms: Math.round(performance.now() - t0), result: JSON.parse(out) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
