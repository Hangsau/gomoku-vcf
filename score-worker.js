// score-worker.js — 詰題評分在背景跑（不卡住畫面）；引擎是 vcf-slover 的 C++ 編成的 WebAssembly（vcfscore.js / vcfscore.wasm）
// 收：{ id, black, white, attackerWhite, scale } → 回：{ id, ok, result | error }
importScripts('vcfscore.js');
let modP = null;
function mod() {
  if (!modP) modP = VcfScore({ locateFile: f => f });
  return modP;
}
self.onmessage = async (e) => {
  const { id, black, white, attackerWhite, scale } = e.data;
  try {
    const M = await mod();
    const t0 = performance.now();
    const out = M.ccall('vcf_score', 'string', ['string', 'string', 'number', 'number'], [black, white, attackerWhite ? 1 : 0, scale || 1]);
    self.postMessage({ id, ok: true, ms: Math.round(performance.now() - t0), result: JSON.parse(out) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
