// 菜雞電腦（純邏輯）：每手依序看 能連五 → 擋連五 → 自己的 VCF → 對方的 VCF → 下一手會有 VCF 的點 → 棋形分數。
// 難度靠開放的層數分三級。solver 從外面傳進來（WebAssembly），沒有 solver 時等於只會最低級。
import { BLACK, CELLS, DC, DR, EMPTY, FORBID_NONE, SIZE, WHITE, forbidType } from './rules.js';
import {
  ACTION,
  PHASE,
  RULE,
  colorOf,
  isWinningMove,
  placeError,
  ruleHasForbidden,
  stoneColorToPlace,
} from './match.js';

export const BOT_LEVEL = { EASY: 1, MEDIUM: 2, HARD: 3 };
export const BOT_LEVEL_NAMES = { [BOT_LEVEL.EASY]: '初級', [BOT_LEVEL.MEDIUM]: '中級', [BOT_LEVEL.HARD]: '高級' };

const FIVE = 5;
const WINDOW_WEIGHT = [1, 12, 80, 500, 3000]; // 一個五格窗裡已有幾顆自己的棋，下這格值多少
const DEFENSE_RATIO = 0.9;
const NEAR_DISTANCE = 2;
const NOISE = { [BOT_LEVEL.EASY]: 120, [BOT_LEVEL.MEDIUM]: 30, [BOT_LEVEL.HARD]: 6 };
const ROOT_CAP = 20; // VCF 查幾手內（攻方手數）
const ROOT_NODES = 60000;
const CANDIDATE_CAP = 12;
const CANDIDATE_NODES = 6000;
const DEFEND_TRIES = 16;
const NEXT_MOVE_TRIES = 16;
const DEFAULT_BUDGET_MS = 1500; // 每手找 VCF 的時間上限，手機也要順
const SWAP_NOISE = 40;
const TEMPO_BONUS = 60;
const SWAP2_RADIUS = 3;
const CENTER_RC = Math.floor(SIZE / 2);

const opposite = (color) => (color === BLACK ? WHITE : BLACK);

function windowScore(cells, p, color) {
  const r = Math.floor(p / SIZE);
  const c = p % SIZE;
  const enemy = opposite(color);
  let total = 0;
  for (let d = 0; d < DR.length; d += 1) {
    for (let start = -(FIVE - 1); start <= 0; start += 1) {
      let own = 0;
      let isOpen = true;
      for (let k = start; k < start + FIVE && isOpen; k += 1) {
        const rr = r + k * DR[d];
        const cc = c + k * DC[d];
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || cells[rr * SIZE + cc] === enemy) isOpen = false;
        else if (cells[rr * SIZE + cc] === color) own += 1;
      }
      if (isOpen) total += WINDOW_WEIGHT[Math.min(own, FIVE - 1)];
    }
  }
  return total;
}

function isNearStone(cells, p) {
  const r = Math.floor(p / SIZE);
  const c = p % SIZE;
  for (let rr = Math.max(0, r - NEAR_DISTANCE); rr <= Math.min(SIZE - 1, r + NEAR_DISTANCE); rr += 1) {
    for (let cc = Math.max(0, c - NEAR_DISTANCE); cc <= Math.min(SIZE - 1, c + NEAR_DISTANCE); cc += 1) {
      if (cells[rr * SIZE + cc] !== EMPTY) return true;
    }
  }
  return false;
}

function isLegalFor(match, p, color) {
  if (match.cells[p] !== EMPTY) return false;
  return color !== BLACK || !ruleHasForbidden(match.rule) || forbidType(match.cells, p) === FORBID_NONE;
}

// 棋形分數排序。nearOnly 為 false 時全盤都算（開局範圍內可能沒有鄰近的點）
function rankMoves(match, color, level, rng, accept = () => true) {
  const list = [];
  const isEmptyBoard = match.moves.length === 0;
  for (let p = 0; p < CELLS; p += 1) {
    if ((isEmptyBoard || isNearStone(match.cells, p)) && accept(p) && isLegalFor(match, p, color)) {
      const value = windowScore(match.cells, p, color) + DEFENSE_RATIO * windowScore(match.cells, p, opposite(color));
      list.push({ p, score: value + rng() * NOISE[level] });
    }
  }
  return list.sort((a, b) => b.score - a.score).map((m) => m.p);
}

function anyLegalPoint(match, color) {
  for (let p = 0; p < CELLS; p += 1) {
    if (isLegalFor(match, p, color)) return p;
  }
  for (let p = 0; p < CELLS; p += 1) {
    if (match.cells[p] === EMPTY) return p; // 全部都是禁手：也只能下了
  }
  return null;
}

function findWinningPoint(match, color) {
  for (let p = 0; p < CELLS; p += 1) {
    if (match.cells[p] === EMPTY && isWinningMove(match.rule, match.cells, p, color)) return p;
  }
  return null;
}

function hasVcfAfter(ctx, p, moveColor, attacker, cap, nodes) {
  const { cells } = ctx.match;
  cells[p] = moveColor;
  const found = ctx.vcf(cells, attacker, cap, nodes) >= 0;
  cells[p] = EMPTY;
  return found;
}

// 下了之後對方就沒有 VCF 的點；對方 VCF 的第一手優先試（自己佔那裡通常最有效）
function findDefense(ctx, color, enemyFirst, ranked) {
  const tries = [enemyFirst, ...ranked.filter((p) => p !== enemyFirst)].slice(0, DEFEND_TRIES);
  for (const p of tries) {
    if (ctx.outOfTime()) return null;
    if (isLegalFor(ctx.match, p, color) && !hasVcfAfter(ctx, p, color, opposite(color), ROOT_CAP, CANDIDATE_NODES)) return p;
  }
  return null;
}

function findNextMoveVcf(ctx, color, ranked) {
  for (const p of ranked.slice(0, NEXT_MOVE_TRIES)) {
    if (ctx.outOfTime()) return null;
    if (hasVcfAfter(ctx, p, color, color, CANDIDATE_CAP, CANDIDATE_NODES)) return p;
  }
  return null;
}

function chooseMove(ctx, color) {
  const { match, level, rng } = ctx;
  const win = findWinningPoint(match, color);
  if (win !== null && isLegalFor(match, win, color)) return win;
  const block = findWinningPoint(match, opposite(color));
  if (block !== null && isLegalFor(match, block, color)) return block;
  const ranked = rankMoves(match, color, level, rng);
  if (level >= BOT_LEVEL.MEDIUM) {
    const own = ctx.vcf(match.cells, color, ROOT_CAP, ROOT_NODES);
    if (own >= 0 && isLegalFor(match, own, color)) return own;
    const enemy = ctx.vcf(match.cells, opposite(color), ROOT_CAP, ROOT_NODES);
    if (enemy >= 0) {
      const defense = findDefense(ctx, color, enemy, ranked);
      if (defense !== null) return defense;
    } else if (level >= BOT_LEVEL.HARD) {
      const next = findNextMoveVcf(ctx, color, ranked);
      if (next !== null) return next;
    }
  }
  return ranked[0] ?? anyLegalPoint(match, color);
}

// 整盤局勢：黑棋比白棋好多少（只用來決定換手和選色，很粗略）
function blackAdvantage(match, nextColor) {
  let total = nextColor === BLACK ? TEMPO_BONUS : -TEMPO_BONUS;
  for (let p = 0; p < CELLS; p += 1) {
    if (match.cells[p] === EMPTY && isNearStone(match.cells, p)) {
      total += windowScore(match.cells, p, BLACK) - windowScore(match.cells, p, WHITE);
    }
  }
  return total;
}

function preferredColor(ctx, nextColor) {
  const noise = (ctx.rng() - 0.5) * SWAP_NOISE;
  return blackAdvantage(ctx.match, nextColor) + noise > 0 ? BLACK : WHITE;
}

function chooseOpeningPlace(ctx) {
  const { match, level, rng } = ctx;
  const color = stoneColorToPlace(match);
  if (match.rule === RULE.SWAP2) {
    // 開局方要擺得差不多平衡，隨機散在中央，不靠棋形分數硬連
    const spots = [];
    for (let p = 0; p < CELLS; p += 1) {
      const far = Math.max(Math.abs(Math.floor(p / SIZE) - CENTER_RC), Math.abs((p % SIZE) - CENTER_RC));
      if (far <= SWAP2_RADIUS && match.cells[p] === EMPTY) spots.push(p);
    }
    return spots[Math.floor(rng() * spots.length)];
  }
  const ranked = rankMoves(match, color, level, rng, (p) => placeError(match, p) === null);
  return ranked[0];
}

// 山口：白方挑黑棋最不利的候選；黑棋馬上有 VCF 的先排除
function chooseOffer(ctx) {
  const { match, level, rng } = ctx;
  const value = (p) => {
    match.cells[p] = BLACK;
    const advantage = blackAdvantage(match, WHITE);
    match.cells[p] = EMPTY;
    return advantage + rng() * NOISE[level];
  };
  const safe = level >= BOT_LEVEL.MEDIUM
    ? match.offers.filter((p) => !hasVcfAfter(ctx, p, BLACK, BLACK, CANDIDATE_CAP, CANDIDATE_NODES))
    : match.offers;
  const pool = safe.length > 0 ? safe : match.offers;
  return pool.reduce((best, p) => {
    const v = value(p);
    return v < best.v ? { p, v } : best;
  }, { p: pool[0], v: Infinity }).p;
}

// 回傳這個座位要做的動作。match 不會被改到（內部用一份複本試下）。
// solver：{ firstMove(cells, attacker, isForbidOn, cap, nodes) → 第一手或 -1 }，可以是 null。
export function chooseAction(source, seat, { level, solver, rng, budgetMs = DEFAULT_BUDGET_MS, clock = Date.now }) {
  const match = { ...source, cells: source.cells.slice() };
  const deadline = clock() + budgetMs;
  const isForbidOn = ruleHasForbidden(match.rule);
  const ctx = {
    match,
    level,
    rng,
    outOfTime: () => clock() > deadline,
    vcf: (cells, attacker, cap, nodes) => (solver ? solver.firstMove(cells, attacker, isForbidOn, cap, nodes) : -1),
  };
  switch (match.phase) {
    case PHASE.PLAY:
      return { type: ACTION.PLACE, p: chooseMove(ctx, colorOf(match, seat)) };
    case PHASE.OPENING_PLACE:
    case PHASE.SWAP2_PLACE:
    case PHASE.SWAP2_ADD:
      return { type: ACTION.PLACE, p: chooseOpeningPlace(ctx) };
    case PHASE.SWAP_CHOICE:
      // 電腦不走山口分支（要自己想 10 個候選），只決定換不換
      return { type: ACTION.SWAP, swap: preferredColor(ctx, stoneColorToPlace(match)) !== colorOf(match, seat) };
    case PHASE.SWAP2_CHOICE:
      return { type: ACTION.SWAP2_CHOICE, choice: preferredColor(ctx, WHITE) };
    case PHASE.SWAP2_COLOR:
      return { type: ACTION.COLOR, color: preferredColor(ctx, WHITE) };
    case PHASE.OFFER_PICK:
      return { type: ACTION.PICK, p: chooseOffer(ctx) };
    default:
      throw new Error(`電腦不會處理這個階段：${match.phase}`);
  }
}
