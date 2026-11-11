// VCF 明鏡台搶答（2026-11-11 使用者）：兩人同一題同時開始，先解開得 1 分，先拿到目標分數贏。
// 明鏡台規則（想的時候不扣落子時間，第一手落下後 5 秒、每手 +1 秒）在前端計時；伺服器管出題、每題思考上限、誰先解開。
// 題目從 Rush 題庫（game/p/段位.json）抽，只用 20 手內的題（使用者：能玩的就 20 手以下）。
// 第一版相信前端回報的解法；之後要防作弊，把 vcfscore.wasm 放進伺服器重驗 seq。

export const VCF_THINK = [60, 180, 300];   // 每題思考上限（秒），預設 180
export const VCF_TARGET = [3, 5];
export const VCF_MAX_L = 20;
const RANK_MIN = 1, RANK_MAX = 10;         // 題庫檔 1..10＝初段..傳說
export const COUNT_MS = 3000;              // 每題開始前倒數
export const REVEAL_MS = 5000;             // 每題結束後停幾秒看解法
const MAX_SEQ = 120;
const WHY = ['five', 'forbid', 'nofour', 'time', 'bad'];
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
export function pickPuzzle(list, used) {
  for (let tries = 0; tries < 50; tries++) {
    const x = list[Math.floor(Math.random() * list.length)];
    if (!used.has(x[5])) { used.add(x[5]); return x; }
  }
  return list[Math.floor(Math.random() * list.length)];
}

export const newVs = () => ({ score: [0, 0], n: 0, used: new Set(), cur: null, result: null, token: Math.random() });

// 送給前端的樣子：每題結束前不送任何人的手順（不能偷看對手下哪）
export function publicVs(vs) {
  if (!vs) return null;
  const c = vs.cur;
  return {
    score: vs.score, n: vs.n, result: vs.result,
    cur: c && {
      n: c.n, puzzle: c.puzzle, startAt: c.startAt, deadline: c.deadline, phase: c.phase, winner: c.winner, endAt: c.endAt,
      st: c.st.map(({ s, moves, why }) => ({ s, moves, why })),
      seqs: c.phase === 'done' ? c.seqs : null,
    },
  };
}
