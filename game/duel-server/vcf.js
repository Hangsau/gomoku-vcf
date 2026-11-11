// VCF 明鏡台競速（2026-11-11 使用者改版）：兩人做同一串題目、同樣順序，各自往下做，先解開 N 題的贏。
// 下錯、時間到、按「放棄這題」＝這題失敗，直接下一題，沒有額外懲罰（防呆：不是四的手不算錯，在前端擋）。
// 明鏡台規則（想的時候不扣落子時間，第一手落下後 5 秒、每手 +1 秒）在前端計時；伺服器管出題、每題思考上限、誰解開幾題。
// 題目從 Rush 題庫（game/p/段位.json）抽，只用 20 手內的題。開局抽 N×3 題，任何人做到剩 3 題就往後補，不會用完。
// 第一版相信前端回報的解法；之後要防作弊，把 vcfscore.wasm 放進伺服器重驗 seq。

const VCF_THINK = [60, 180, 300];   // 每題思考上限（秒），預設 180
const VCF_TARGET = [3, 5, 10];      // 先解開幾題獲勝
export const VCF_MAX_L = 20;
const RANK_MIN = 1, RANK_MAX = 10;         // 題庫檔 1..10＝初段..傳說
export const COUNT_MS = 3000;              // 開局倒數
export const NEXT_MS = 1200;               // 一題結束（解開／失敗）停多久換下一題
const LIST_MULT = 3, LIST_AHEAD = 3;       // 開局抽 N×3 題；剩 3 題就補
const MAX_SEQ = 120;
const WHY = ['five', 'forbid', 'nofour', 'time', 'bad', 'skip'];
const COORD = /^[A-HJ-P](1[0-5]|[1-9])$/;

export function cleanVcfSettings(m) {
  const rank = Number(m.rank), think = Number(m.think), target = Number(m.target);
  if (!Number.isInteger(rank) || rank < RANK_MIN || rank > RANK_MAX) return null;
  if (!VCF_THINK.includes(think) || !VCF_TARGET.includes(target)) return null;
  return { rank, think, target };
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

const newSeat = () => ({ i: 0, at: 0, deadline: 0, s: 'think', moves: 0, why: null, log: [], timer: null });
export const newVs = () => ({ score: [0, 0], list: [], bank: null, used: new Set(), startAt: 0, p: [newSeat(), newSeat()], result: null, token: Math.random() });

// 題目串：確保第 i 題後面還有 LIST_AHEAD 題
export function ensureList(vs, i) {
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
  Object.assign(st, { i, at, deadline: at + thinkSec * 1000, s: 'think', moves: 0, why: null });
}
export function stopTimers(vs) {
  if (vs) for (const st of vs.p) { clearTimeout(st.timer); st.timer = null; }
}

// 送給前端的樣子：比賽中只送每人目前那題的題目和進度，不送手順（不能偷看對手下哪）；結束才送整串題目和兩人手順
export function publicVs(vs) {
  if (!vs) return null;
  const over = !!vs.result;
  return {
    score: vs.score, startAt: vs.startAt, result: vs.result,
    p: vs.p.map((st) => ({ i: st.i, at: st.at, deadline: st.deadline, s: st.s, moves: st.moves, why: st.why, puzzle: vs.list[st.i] || null })),
    review: over ? {
      list: vs.list.slice(0, Math.max(...vs.p.map((st) => st.i)) + 1),
      logs: vs.p.map((st) => st.log),
    } : null,
  };
}
