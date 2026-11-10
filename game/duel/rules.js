// 連珠規則：從 vcf-slover/engine/engine.hpp 移植，判定要跟出題器完全一樣（tests 用 C++ 算的禁手點比對）。
// 黑棋剛好五連才贏，長連、四四、三三是禁手（五連優先）；白棋五連以上都贏、沒有禁手。
export const SIZE = 15;
export const CELLS = SIZE * SIZE;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const DR = [0, 1, 1, 1];
export const DC = [1, 0, 1, -1];
const FORBID_MAX_DEPTH = 5; // 三三判定的遞迴上限（與引擎相同）
const SCAN = 4;
const COLS = 'ABCDEFGHJKLMNOP';

export const FORBID_NONE = 0;
export const FORBID_OVERLINE = 1;
export const FORBID_DOUBLE_FOUR = 2;
export const FORBID_DOUBLE_THREE = 3;

export function parseCoord(text) {
  return (SIZE - Number(text.slice(1))) * SIZE + COLS.indexOf(text[0]);
}

export function formatCoord(p) {
  return `${COLS[p % SIZE]}${SIZE - Math.floor(p / SIZE)}`;
}

export function parseList(text) {
  return text.split(' ').filter(Boolean).map(parseCoord);
}

export function boardFrom(black, white) {
  const cells = new Int8Array(CELLS);
  for (const p of parseList(black)) cells[p] = BLACK;
  for (const p of parseList(white)) cells[p] = WHITE;
  return cells;
}

function at(cells, r, c) {
  return r < 0 || r >= SIZE || c < 0 || c >= SIZE ? -1 : cells[r * SIZE + c];
}

// 把 p 視為 color，計算方向 d 上連續 color 的長度（p 本身可以是空格）
export function runLength(cells, p, d, color) {
  const r = Math.floor(p / SIZE);
  const c = p % SIZE;
  let n = 1;
  for (let k = 1; at(cells, r + k * DR[d], c + k * DC[d]) === color; k += 1) n += 1;
  for (let k = 1; at(cells, r - k * DR[d], c - k * DC[d]) === color; k += 1) n += 1;
  return n;
}

function isWinLength(length, color) {
  return color === BLACK ? length === 5 : length >= 5;
}

// p 已有 color 的棋：沿方向 d、距離 4 內，color 下了就成五的空格
function fivePointsDir(cells, p, d, color) {
  const r = Math.floor(p / SIZE);
  const c = p % SIZE;
  const out = [];
  for (let k = -SCAN; k <= SCAN; k += 1) {
    if (k !== 0) {
      const rr = r + k * DR[d];
      const cc = c + k * DC[d];
      if (at(cells, rr, cc) === EMPTY) {
        const q = rr * SIZE + cc;
        if (isWinLength(runLength(cells, q, d, color), color)) out.push(q);
      }
    }
  }
  return out;
}

// p 已有 color 的棋：p 所在四條線上所有成五點（去重）
export function fivePointsAround(cells, p, color) {
  const seen = new Set();
  for (let d = 0; d < 4; d += 1) {
    for (const q of fivePointsDir(cells, p, d, color)) seen.add(q);
  }
  return [...seen];
}

// 黑棋已在 p：方向 d 上的「四」數量（活四算 1、一線雙四算 2）
function countFoursDir(cells, p, d) {
  const r = Math.floor(p / SIZE);
  const c = p % SIZE;
  const offsets = [];
  for (let k = -SCAN; k <= SCAN; k += 1) {
    if (k !== 0) {
      const rr = r + k * DR[d];
      const cc = c + k * DC[d];
      if (at(cells, rr, cc) === EMPTY && runLength(cells, rr * SIZE + cc, d, BLACK) === 5) offsets.push(k);
    }
  }
  if (offsets.length === 0) return 0;
  let groups = 1;
  for (let i = 1; i < offsets.length; i += 1) {
    if (offsets[i] - offsets[i - 1] !== 5) groups += 1;
  }
  return groups;
}

function isContiguousBlack(cells, r, c, d, k) {
  const step = k > 0 ? 1 : -1;
  for (let j = step; j !== k; j += step) {
    if (at(cells, r + j * DR[d], c + j * DC[d]) !== BLACK) return false;
  }
  return true;
}

function endsInFiveOrLonger(cells, q) {
  for (let d = 0; d < 4; d += 1) {
    if (runLength(cells, q, d, BLACK) >= 5) return true;
  }
  return false;
}

// 黑棋已在 p：方向 d 是否為「真活三」（存在一個不是禁手的點，下了變成包含 p 的活四）
function isThreeDir(cells, p, d, depth) {
  const r = Math.floor(p / SIZE);
  const c = p % SIZE;
  for (let k = -SCAN; k <= SCAN; k += 1) {
    const rr = r + k * DR[d];
    const cc = c + k * DC[d];
    if (k !== 0 && at(cells, rr, cc) === EMPTY && isContiguousBlack(cells, r, c, d, k)) {
      const q = rr * SIZE + cc;
      cells[q] = BLACK;
      const bad = endsInFiveOrLonger(cells, q);
      const fives = bad ? 0 : fivePointsDir(cells, q, d, BLACK).length;
      cells[q] = EMPTY;
      if (!bad && fives >= 2 && forbidType(cells, q, depth + 1) === FORBID_NONE) return true;
    }
  }
  return false;
}

// 黑棋下在 p 是否禁手。會暫時改動 cells，回傳前還原。
export function forbidType(cells, p, depth = 0) {
  if (cells[p] !== EMPTY || depth >= FORBID_MAX_DEPTH) return FORBID_NONE;
  cells[p] = BLACK;
  let five = false;
  let over = false;
  for (let d = 0; d < 4; d += 1) {
    const length = runLength(cells, p, d, BLACK);
    if (length === 5) five = true;
    else if (length >= 6) over = true;
  }
  let result = FORBID_NONE;
  if (!five) {
    if (over) {
      result = FORBID_OVERLINE;
    } else {
      const foursByDir = [0, 1, 2, 3].map((d) => countFoursDir(cells, p, d));
      if (foursByDir.reduce((sum, v) => sum + v, 0) >= 2) {
        result = FORBID_DOUBLE_FOUR;
      } else {
        let threes = 0;
        for (let d = 0; d < 4 && threes < 2; d += 1) {
          if (foursByDir[d] === 0 && isThreeDir(cells, p, d, depth)) threes += 1;
        }
        if (threes >= 2) result = FORBID_DOUBLE_THREE;
      }
    }
  }
  cells[p] = EMPTY;
  return result;
}

// 黑棋下在 p 會不會形成至少一個成五點（是「四」），且不是禁手
export function isLegalFour(cells, p) {
  if (cells[p] !== EMPTY || forbidType(cells, p) !== FORBID_NONE) return false;
  cells[p] = BLACK;
  const fives = fivePointsAround(cells, p, BLACK).length;
  cells[p] = EMPTY;
  return fives > 0;
}

export function hasLegalFour(cells) {
  for (let p = 0; p < CELLS; p += 1) {
    if (isLegalFour(cells, p)) return true;
  }
  return false;
}

// 八種對稱：i 位元 0 水平翻轉、位元 1 垂直翻轉、位元 2 對角翻轉。連珠規則對稱，題目不變。
export const SYMMETRIES = 8;

function transformPoint(p, symmetry) {
  let r = Math.floor(p / SIZE);
  let c = p % SIZE;
  if (symmetry & 4) [r, c] = [c, r];
  if (symmetry & 1) c = SIZE - 1 - c;
  if (symmetry & 2) r = SIZE - 1 - r;
  return r * SIZE + c;
}

function transformList(text, symmetry) {
  return parseList(text).map((p) => formatCoord(transformPoint(p, symmetry))).join(' ');
}

export function transformPuzzle(puzzle, symmetry) {
  return { ...puzzle, b: transformList(puzzle.b, symmetry), w: transformList(puzzle.w, symmetry), sol: transformList(puzzle.sol, symmetry) };
}
