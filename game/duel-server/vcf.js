// VCF 明鏡台（兩種玩法並存，2026-11-12 使用者定；開房時選 vmode）：
//   eight 八仙渡（2026-11-11 改版的競速）：兩人做同一串題目、同樣順序，各自往下做，先解開 N 題的贏。
//     下錯、時間到、按「放棄這題」＝這題失敗，直接下一題，沒有額外懲罰（防呆：不是四的手不算錯，在前端擋）。
//   line 一線天（舊的搶答）：兩人同一題同時開始，先解開得 1 分，然後兩人一起換下一題（停 REVEAL_MS 公開解法）；先拿到 N 分贏。
//     下錯／時間到＝這題出局只能等；兩人都出局＝沒人得分。沒有「放棄這題」（客戶端不送 vskip，伺服器也不收）。
//   兩種玩法共用 vs.p[座位].i（目前題號；一線天兩人永遠相同）和同一份計時、log、review。
// 玩家比賽中看不到對手下在哪；觀戰者看得到（伺服器只把每人目前的手順 seq 送給不在座位上的人）。
// 明鏡台規則（想的時候不扣落子時間，第一手落下後 5 秒、每手 +1 秒）在前端計時；伺服器管出題、每題思考上限、誰解開幾題。
// 題目從 Rush 題庫（game/p/段位.json）抽，只用 20 手內的題。開局抽 N×3 題，任何人做到剩 3 題就往後補，不會用完。
// 第一版相信前端回報的解法；之後要防作弊，把 vcfscore.wasm 放進伺服器重驗 seq。

const VCF_THINK = [60, 180, 300];   // 每題思考上限（秒），預設 180
const VCF_TARGET = [3, 5, 10];      // 先解開幾題獲勝
const VCF_MAX_L = 20;
const RANK_MIN = 1, RANK_MAX = 10;         // 題庫檔 1..10＝初段..傳說
export const COUNT_MS = 3000;              // 開局倒數
export const REVEAL_MS = 5000;             // 一線天：一題結束後停幾秒公開解法（舊搶答版的值）
export const NEXT_MS = 1200;               // 一題結束（解開／失敗）停多久換下一題
const LIST_MULT = 3, LIST_AHEAD = 3;       // 開局抽 N×3 題；剩 3 題就補
const MAX_SEQ = 120;
const WHY = ['five', 'forbid', 'nofour', 'time', 'bad', 'skip'];   // 'late'（一線天：對手先解開，這題沒做完）只由伺服器寫，不收客戶端送來的
const VMODES = ['line', 'eight'];
export const DEFAULT_VMODE = 'eight';       // 舊客戶端沒送 vmode 就是八仙渡（開房當時線上的玩法）
const COORD = /^[A-HJ-P](1[0-5]|[1-9])$/;

export function cleanVcfSettings(m) {
  const rank = Number(m.rank), think = Number(m.think), target = Number(m.target);
  if (!Number.isInteger(rank) || rank < RANK_MIN || rank > RANK_MAX) return null;
  if (!VCF_THINK.includes(think) || !VCF_TARGET.includes(target)) return null;
  const vmode = m.vmode === undefined || m.vmode === null ? DEFAULT_VMODE : m.vmode;   // 舊客戶端沒送＝八仙渡；送了不認得的值就拒絕（跟其他欄位一樣）
  if (!VMODES.includes(vmode)) return null;
  return { rank, think, target, vmode };
}
export const cleanSeq = (seq) => (Array.isArray(seq) ? seq.slice(0, MAX_SEQ).map(String).filter((t) => COORD.test(t)) : []);
export const cleanWhy = (w) => (WHY.includes(w) ? w : 'bad');

const banks = new Map();   // 段位 → Promise<題目陣列>，大廳活著時只抓一次
export function loadBank(base, rank) {
  if (!banks.has(rank)) {
    const p = fetch(`${base}/game/p/${rank}.json`)
      .then((r) => { if (!r.ok) throw new Error('bank ' + r.status); return r.json(); })
      .then((list) => list.filter((x) => x[2] <= VCF_MAX_L));
    p.catch(() => banks.delete(rank));   // 抓失敗下次重抓
    banks.set(rank, p);
  }
  return banks.get(rank);
}
function pickPuzzle(list, used) {
  for (let tries = 0; tries < 50; tries++) {
    const x = list[Math.floor(Math.random() * list.length)];
    if (!used.has(x[5])) { used.add(x[5]); return x; }
  }
  return list[Math.floor(Math.random() * list.length)];   // 題庫小（傳說段）抽不到新的就允許重複
}

const newSeat = () => ({ i: 0, at: 0, deadline: 0, s: 'think', moves: 0, why: null, log: [], seq: [], timer: null });
export const newVs = () => ({ score: [0, 0], list: [], bank: null, used: new Set(), startAt: 0, p: [newSeat(), newSeat()], result: null, token: Math.random(), phase: 'play', rv: null, rtimer: null });

// 題目串：確保第 i 題後面還有 LIST_AHEAD 題
function ensureList(vs, i) {
  while (vs.list.length < i + 1 + LIST_AHEAD) vs.list.push(pickPuzzle(vs.bank, vs.used));
}
export function initList(vs, bank, target) {
  vs.bank = bank;
  while (vs.list.length < target * LIST_MULT) vs.list.push(pickPuzzle(bank, vs.used));
}
// 某人開始做第 i 題
export function startPuzzle(vs, seat, i, at, thinkSec) {
  const st = vs.p[seat];
  ensureList(vs, i);
  Object.assign(st, { i, at, deadline: at + thinkSec * 1000, s: 'think', moves: 0, why: null, seq: [] });
}
export function stopTimers(vs) {
  if (vs) { for (const st of vs.p) { clearTimeout(st.timer); st.timer = null; } clearTimeout(vs.rtimer); vs.rtimer = null; }
}

// 送給前端的樣子：比賽中只送每人目前那題的題目和進度，不送手順給玩家（不能偷看對手下哪）；結束才送整串題目和兩人手順
// withSeq（只有不在座位上的觀戰者收到，2026-11-13 使用者）：比賽中多送每人這題目前的手順 seq，讓觀戰者看得到下在哪
export function publicVs(vs, withSeq = false) {
  if (!vs) return null;
  const over = !!vs.result;
  return {
    score: vs.score, startAt: vs.startAt, result: vs.result,
    phase: vs.phase, rv: vs.phase === 'reveal' ? vs.rv : null,   // 一線天：一題結束停下來公開解法（rv＝{ winner, seq }）
    p: vs.p.map((st) => ({ i: st.i, at: st.at, deadline: st.deadline, s: st.s, moves: st.moves, why: st.why, puzzle: vs.list[st.i] || null, ...(withSeq && !over ? { seq: st.seq } : {}) })),
    review: over ? {
      list: vs.list.slice(0, Math.max(...vs.p.map((st) => st.i)) + 1),
      logs: vs.p.map((st) => st.log),
    } : null,
  };
}
