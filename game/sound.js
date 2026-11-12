// 落子聲九種（game.html 與 duel.html 共用）。純函式 (a, out, t, v)：a＝AudioContext／OfflineAudioContext，out＝接出去的節點，t＝開始時間，v＝音量係數（一般 1、電腦擋那手 soft 約 0.58）
(function () {
function sNoise(a, out, t, v, dur, type, freq, q, peak) {   // 衰減雜訊（三次方衰減）過濾波器
  const n = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = a.createBufferSource(); src.buffer = n;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.setValueAtTime(peak * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out); src.start(t);
}
function sTone(a, out, t, v, type, f0, f1, dur, peak, att, fdur) {   // 單一振盪器：頻率 f0→f1 在 fdur（預設同 dur）內指數滑動，增益指數衰減到 0.001
  const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + (fdur || dur));
  const g = a.createGain();
  if (att) { g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0011, peak * v), t + att); }
  else g.gain.setValueAtTime(peak * v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.01);
}
const STONE_SND = {
  wood: (a, out, t, v) => { sNoise(a, out, t, v, 0.06, 'bandpass', 1900, 1.4, 0.6); sTone(a, out, t, v, 'sine', 420, 160, 0.09, 0.42, 0, 0.08); },   // 跟改版前一模一樣：頻率 0.08 秒滑完、增益 0.09 秒衰完
  crisp: (a, out, t, v) => { sNoise(a, out, t, v, 0.04, 'bandpass', 3200, 2, 0.55); sTone(a, out, t, v, 'sine', 900, 500, 0.05, 0.3); },
  deep: (a, out, t, v) => { sNoise(a, out, t, v, 0.08, 'bandpass', 900, 1, 0.5); sTone(a, out, t, v, 'sine', 220, 90, 0.14, 0.55); },
  soft: (a, out, t, v) => { sNoise(a, out, t, v, 0.03, 'bandpass', 2400, 1.2, 0.28); },
  slate: (a, out, t, v) => { sNoise(a, out, t, v, 0.035, 'bandpass', 4500, 3, 0.5); sTone(a, out, t, v, 'sine', 1800, 1200, 0.035, 0.25); },
  jade: (a, out, t, v) => { sNoise(a, out, t, v, 0.01, 'highpass', 2000, 0.7, 0.2); sTone(a, out, t, v, 'sine', 1400, 1400, 0.12, 0.22); sTone(a, out, t, v, 'sine', 2100, 2100, 0.12, 0.22); },
  drop: (a, out, t, v) => { sTone(a, out, t, v, 'sine', 600, 1200, 0.08, 0.4, 0.005); },
  bit: (a, out, t, v) => {   // 方波 660Hz 0.04 秒接 880Hz 0.04 秒
    sTone(a, out, t, v, 'square', 660, 660, 0.04, 0.16); sTone(a, out, t + 0.04, v, 'square', 880, 880, 0.04, 0.16);
  },
  drum: (a, out, t, v) => { sTone(a, out, t, v, 'triangle', 180, 80, 0.12, 0.6); sNoise(a, out, t, v, 0.05, 'lowpass', 1200, 0.7, 0.2); },
};
const IDS = ['wood', 'crisp', 'deep', 'soft', 'slate', 'jade', 'drop', 'bit', 'drum'];
const stoneId = (x) => STONE_SND[x] ? x : 'wood';
window.RushSound = { STONE_SND, stoneId, IDS };
})();
