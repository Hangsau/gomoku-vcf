// 一盤棋的完整流程（純邏輯，不依賴畫面和連線）：五種規則、開局、換手、勝負、計時、認輸。
// 規則來源：resources/notes/gomoku_rules_complete.md。禁手判定用 rules.js（跟出題器同一套）。
// 兩個座位 0、1；顏色可以換手，棋子不變。所有動作都走 applyAction，回傳新的 match，不改舊的。
import { BLACK, CELLS, DC, DR, EMPTY, FORBID_NONE, SIZE, WHITE, forbidType, runLength } from './rules.js';

export const RULE = { FREE: 'free', RENJU: 'renju', TARA: 'tara', TARA10: 'tara10', SWAP2: 'swap2' };
export const RULE_NAMES = {
  [RULE.FREE]: '普通',
  [RULE.RENJU]: '連珠',
  [RULE.TARA]: '塔拉',
  [RULE.TARA10]: '塔拉山口 10',
  [RULE.SWAP2]: 'Swap2',
};

export const PHASE = {
  OPENING_PLACE: 'opening-place', // 塔拉系列：在限定範圍內下下一顆
  SWAP_CHOICE: 'swap-choice', // 塔拉系列：要不要換手
  OFFER: 'offer', // 山口分支：黑方提出第五手候選
  OFFER_PICK: 'offer-pick', // 山口分支：白方選一個
  SWAP2_PLACE: 'swap2-place', // 開局方擺二黑一白
  SWAP2_CHOICE: 'swap2-choice', // 另一方選黑、選白或再加兩子
  SWAP2_ADD: 'swap2-add', // 再加一黑一白
  SWAP2_COLOR: 'swap2-color', // 開局方選顏色
  PLAY: 'play',
  OVER: 'over',
};

export const ACTION = {
  PLACE: 'place',
  SWAP: 'swap',
  YAMAGUCHI: 'yamaguchi',
  OFFER: 'offer',
  PICK: 'pick',
  SWAP2_CHOICE: 'swap2-choice',
  COLOR: 'color',
  RESIGN: 'resign',
};

export const SWAP2_ADD_CHOICE = 'add';
export const OFFER_COUNT = 10;
export const END_REASON = {
  FIVE: '連成五',
  FORBIDDEN: '黑棋下在禁手',
  RESIGN: '認輸',
  TIMEOUT: '時間到',
  FULL: '棋盤下滿',
};

const CENTER_RC = Math.floor(SIZE / 2);
const FIVE = 5;
// 塔拉系列：第幾顆棋子可以下的範圍（距離天元的切比雪夫距離）
// 第 1 手半徑 0＝只能下天元（Rush 對戰 2026-11-11 使用者：照下棋順序由開局方自己下，不由系統先放；棋神之雞原版是自動放）
const TARA_ZONE = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
const TARA_LAST_STONE = 5;
const TARA_BRANCH_STONE = 4;
const SWAP2_PLACE_COLORS = [BLACK, WHITE, BLACK];
const SWAP2_ADD_COLORS = [BLACK, WHITE];
const FIRST_SEAT = 0;
const SECOND_SEAT = 1;
const SHAPE_FLIPS = [
  (r, c) => ({ r, c }),
  (r, c) => ({ r, c: -c }),
  (r, c) => ({ r: -r, c }),
  (r, c) => ({ r: -r, c: -c }),
  (r, c) => ({ r: c, c: r }),
  (r, c) => ({ r: c, c: -r }),
  (r, c) => ({ r: -c, c: r }),
  (r, c) => ({ r: -c, c: -r }),
];

const other = (seat) => 1 - seat;
const isTara = (rule) => rule === RULE.TARA || rule === RULE.TARA10;
export const ruleHasForbidden = (rule) => rule === RULE.RENJU || isTara(rule);
const seatOf = (match, color) => (color === BLACK ? match.blackSeat : other(match.blackSeat));

export function colorOf(match, seat) {
  return seat === match.blackSeat ? BLACK : WHITE;
}

function putStone(match, p, color, seat) {
  match.cells[p] = color;
  match.moves.push({ p, color, seat });
}

export function createMatch({ rule, clock = null }, now = 0) {
  if (!Object.values(RULE).includes(rule)) throw new Error(`不認識的規則：${rule}`);
  const match = {
    rule,
    phase: PHASE.PLAY,
    cells: new Int8Array(CELLS),
    moves: [], // 依序 { p, color, seat }；山口沒選中的候選不算
    offers: [],
    blackSeat: FIRST_SEAT,
    result: null,
    log: [], // 每個動作 { seat, action, t }，可重播
    startedAt: now,
    clock: clock && {
      remaining: [clock.mainMs, clock.mainMs],
      incMs: clock.incMs ?? 0,
      since: now,
    },
    config: { rule, clock },
  };
  if (isTara(rule)) {
    // 第一手一定在天元，直接放好
    match.phase = PHASE.OPENING_PLACE;   // 第一手由開局方自己下在天元
  } else if (rule === RULE.SWAP2) {
    match.phase = PHASE.SWAP2_PLACE;
  }
  return match;
}

function nextColor(match) {
  const blacks = match.moves.filter((m) => m.color === BLACK).length;
  return blacks === match.moves.length - blacks ? BLACK : WHITE;
}

// 現在輪到哪個座位動作；結束了回傳 null
export function actorOf(match) {
  switch (match.phase) {
    case PHASE.OVER:
      return null;
    case PHASE.SWAP_CHOICE:
      return seatOf(match, match.moves.at(-1).color === BLACK ? WHITE : BLACK);
    case PHASE.OFFER:
      return match.blackSeat;
    case PHASE.OFFER_PICK:
      return other(match.blackSeat);
    case PHASE.SWAP2_PLACE:
    case PHASE.SWAP2_COLOR:
      return FIRST_SEAT;
    case PHASE.SWAP2_CHOICE:
    case PHASE.SWAP2_ADD:
      return SECOND_SEAT;
    default:
      return seatOf(match, nextColor(match));
  }
}

// 開局階段下一顆要放的顏色（畫面用來顯示）
export function stoneColorToPlace(match) {
  if (match.phase === PHASE.SWAP2_PLACE) return SWAP2_PLACE_COLORS[match.moves.length];
  if (match.phase === PHASE.SWAP2_ADD) return SWAP2_ADD_COLORS[match.moves.length - SWAP2_PLACE_COLORS.length];
  return nextColor(match);
}

function chebyshevFromCenter(p) {
  return Math.max(Math.abs(Math.floor(p / SIZE) - CENTER_RC), Math.abs((p % SIZE) - CENTER_RC));
}

// 塔拉系列下一顆可以下的範圍半徑；不限範圍回傳 null（畫面用來標示）
export function openingZoneRadius(match) {
  return match.phase === PHASE.OPENING_PLACE ? TARA_ZONE[match.moves.length + 1] : null;
}

// 現在能不能走山口分支（畫面用來顯示按鈕）
export function canChooseYamaguchi(match) {
  return match.rule === RULE.TARA10 && match.phase === PHASE.SWAP_CHOICE && match.moves.length === TARA_BRANCH_STONE;
}

function isOnBoard(p) {
  return Number.isInteger(p) && p >= 0 && p < CELLS;
}

// 棋形的標準寫法：八種翻轉各自平移到原點後取最小的字串。形狀一樣就得到同一個結果，跟在盤上哪裡無關。
function shapeKey(stones) {
  let best = null;
  for (const flip of SHAPE_FLIPS) {
    const flipped = stones.map(({ r, c, color }) => ({ ...flip(r, c), color }));
    const minR = Math.min(...flipped.map((s) => s.r));
    const minC = Math.min(...flipped.map((s) => s.c));
    const key = flipped.map((s) => `${s.r - minR},${s.c - minC},${s.color}`).sort().join(' ');
    if (best === null || key < best) best = key;
  }
  return best;
}

// 使用者定的對稱：只看第五手和前四手的相對位置，不管盤端；兩個候選形成的五子形狀一樣就算對稱
export function hasSymmetricOffers(match, points) {
  const base = match.moves.map((m) => ({ r: Math.floor(m.p / SIZE), c: m.p % SIZE, color: m.color }));
  const keys = points.map((p) => shapeKey([...base, { r: Math.floor(p / SIZE), c: p % SIZE, color: BLACK }]));
  return new Set(keys).size !== keys.length;
}

function offerError(match, points) {
  if (!Array.isArray(points) || points.length !== OFFER_COUNT) return `要提出 ${OFFER_COUNT} 個點`;
  if (new Set(points).size !== points.length) return '候選點不能重複';
  if (!points.every((p) => isOnBoard(p) && match.cells[p] === EMPTY)) return '候選點要在空格上';
  if (hasSymmetricOffers(match, points)) return '候選點不能對稱';
  return null;
}

function finish(match, winnerSeat, reason, extra = {}) {
  match.phase = PHASE.OVER;
  match.result = {
    winnerSeat,
    winnerColor: winnerSeat === null ? null : colorOf(match, winnerSeat),
    reason,
    ...extra,
  };
}

function isWinningRun(rule, color, length) {
  if (rule === RULE.FREE) return length >= FIVE;
  if (rule === RULE.SWAP2) return length === FIVE;
  return color === BLACK ? length === FIVE : length >= FIVE;
}

// color 下在空格 p 會不會贏（p 留空也算得出來）
export function isWinningMove(rule, cells, p, color) {
  for (let d = 0; d < DR.length; d += 1) {
    if (isWinningRun(rule, color, runLength(cells, p, d, color))) return true;
  }
  return false;
}

function collectLine(cells, p, d, color) {
  const line = [p];
  for (const sign of [1, -1]) {
    let r = Math.floor(p / SIZE) + sign * DR[d];
    let c = (p % SIZE) + sign * DC[d];
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && cells[r * SIZE + c] === color) {
      line.push(r * SIZE + c);
      r += sign * DR[d];
      c += sign * DC[d];
    }
  }
  return line.sort((a, b) => a - b);
}

function winningLine(match, p, color) {
  for (let d = 0; d < DR.length; d += 1) {
    if (isWinningRun(match.rule, color, runLength(match.cells, p, d, color))) {
      return collectLine(match.cells, p, d, color);
    }
  }
  return null;
}

function playMove(match, seat, p) {
  const color = colorOf(match, seat);
  if (color === BLACK && ruleHasForbidden(match.rule) && forbidType(match.cells, p) !== FORBID_NONE) {
    finish(match, other(seat), END_REASON.FORBIDDEN, { point: p });
    return;
  }
  putStone(match, p, color, seat);
  const line = winningLine(match, p, color);
  if (line) finish(match, seat, END_REASON.FIVE, { line });
  else if (match.moves.length === CELLS) finish(match, null, END_REASON.FULL);
}

export function placeError(match, p) {
  if (!isOnBoard(p)) return '不在棋盤上';
  if (match.cells[p] !== EMPTY) return '這裡已經有棋子';
  const radius = openingZoneRadius(match);
  if (radius !== null && chebyshevFromCenter(p) > radius) return `要下在中央 ${radius * 2 + 1}×${radius * 2 + 1} 內`;
  return null;
}

function applyPlace(match, seat, p) {
  const canPlace = [PHASE.PLAY, PHASE.OPENING_PLACE, PHASE.SWAP2_PLACE, PHASE.SWAP2_ADD].includes(match.phase);
  if (!canPlace) return '現在不能落子';
  const error = placeError(match, p);
  if (error) return error;
  if (match.phase === PHASE.PLAY) {
    playMove(match, seat, p);
    return null;
  }
  putStone(match, p, stoneColorToPlace(match), seat);
  if (match.phase === PHASE.OPENING_PLACE) match.phase = PHASE.SWAP_CHOICE;
  else if (match.phase === PHASE.SWAP2_PLACE && match.moves.length === SWAP2_PLACE_COLORS.length) match.phase = PHASE.SWAP2_CHOICE;
  else if (match.phase === PHASE.SWAP2_ADD && match.moves.length === SWAP2_PLACE_COLORS.length + SWAP2_ADD_COLORS.length) match.phase = PHASE.SWAP2_COLOR;
  return null;
}

function applySwap(match, swap) {
  if (match.phase !== PHASE.SWAP_CHOICE) return '現在不能換手';
  if (swap) match.blackSeat = other(match.blackSeat);
  match.phase = match.moves.length === TARA_LAST_STONE ? PHASE.PLAY : PHASE.OPENING_PLACE;
  return null;
}

function chooseColor(match, seat, color) {
  if (color !== BLACK && color !== WHITE) return '選項不對';
  match.blackSeat = color === BLACK ? seat : other(seat);
  match.phase = PHASE.PLAY;
  return null;
}

function applySwap2Choice(match, seat, choice) {
  if (match.phase !== PHASE.SWAP2_CHOICE) return '現在不能選';
  if (choice === SWAP2_ADD_CHOICE) {
    match.phase = PHASE.SWAP2_ADD;
    return null;
  }
  return chooseColor(match, seat, choice);
}

function applyColor(match, seat, color) {
  if (match.phase !== PHASE.SWAP2_COLOR) return '現在不能選顏色';
  return chooseColor(match, seat, color);
}

function applyYamaguchi(match) {
  if (!canChooseYamaguchi(match)) return '現在不能轉山口';
  match.phase = PHASE.OFFER;
  return null;
}

function applyOffer(match, points) {
  if (match.phase !== PHASE.OFFER) return '現在不能提出候選';
  const error = offerError(match, points);
  if (error) return error;
  match.offers = [...points];
  match.phase = PHASE.OFFER_PICK;
  return null;
}

function applyPick(match, p) {
  if (match.phase !== PHASE.OFFER_PICK) return '現在不能選候選';
  if (!match.offers.includes(p)) return '要選黑方提出的點';
  putStone(match, p, BLACK, match.blackSeat);
  match.offers = [];
  match.phase = PHASE.PLAY;
  return null;
}

function dispatch(match, seat, action) {
  switch (action.type) {
    case ACTION.PLACE:
      return applyPlace(match, seat, action.p);
    case ACTION.SWAP:
      return applySwap(match, Boolean(action.swap));
    case ACTION.YAMAGUCHI:
      return applyYamaguchi(match);
    case ACTION.OFFER:
      return applyOffer(match, action.points);
    case ACTION.PICK:
      return applyPick(match, action.p);
    case ACTION.SWAP2_CHOICE:
      return applySwap2Choice(match, seat, action.choice);
    case ACTION.COLOR:
      return applyColor(match, seat, action.color);
    default:
      return '不認識的動作';
  }
}

function clone(match) {
  return {
    ...match,
    cells: match.cells.slice(),
    moves: [...match.moves],
    offers: [...match.offers],
    log: [...match.log],
    clock: match.clock && { ...match.clock, remaining: [...match.clock.remaining] },
  };
}

// 目前的剩餘時間（毫秒）：[座位 0, 座位 1]；沒有計時回傳 null
export function clockMs(match, now) {
  if (!match.clock) return null;
  const remaining = [...match.clock.remaining];
  const actor = actorOf(match);
  if (actor !== null) remaining[actor] = Math.max(0, remaining[actor] - (now - match.clock.since));
  return remaining;
}

// 計時器到了：輪到的人時間用完就判負。沒事回傳原本的 match。
export function checkTimeout(match, now) {
  const actor = actorOf(match);
  if (!match.clock || actor === null || clockMs(match, now)[actor] > 0) return match;
  const next = clone(match);
  next.clock.remaining[actor] = 0;
  next.clock.since = now;
  finish(next, other(actor), END_REASON.TIMEOUT);
  return next;
}

// 執行一個動作。回傳 { match, error }：不合法時 error 有原因、match 是原本的，狀態不變。
// 例外：動作送到時已超時，回傳判負後的 match，error 是「時間到」。
export function applyAction(match, seat, action, now = 0) {
  if (match.phase === PHASE.OVER) return { match, error: '這盤已經結束' };
  const timedOut = checkTimeout(match, now);
  if (timedOut !== match) return { match: timedOut, error: END_REASON.TIMEOUT };
  const actor = actorOf(match);
  const next = clone(match);
  if (next.clock) {
    next.clock.remaining[actor] -= now - next.clock.since;
    next.clock.since = now;
  }
  if (action.type === ACTION.RESIGN) {
    finish(next, other(seat), END_REASON.RESIGN);
  } else {
    if (seat !== actor) return { match, error: '還沒輪到你' };
    const error = dispatch(next, seat, action);
    if (error) return { match, error };
    if (next.clock) next.clock.remaining[actor] += next.clock.incMs;
  }
  next.log.push({ seat, action, t: now });
  return { match: next, error: null };
}

// 從紀錄重播整盤（驗棋、看棋譜用）。任何一步不合法就丟錯。
export function replayMatch(config, log, startedAt = 0) {
  let match = createMatch(config, startedAt);
  for (const { seat, action, t } of log) {
    const step = applyAction(match, seat, action, t);
    if (step.error) throw new Error(`重播失敗：${step.error}`);
    match = step.match;
  }
  return match;
}

// 存檔只留設定和動作紀錄，讀回來時重播，壞掉或被改過的紀錄會丟錯
export function serializeMatch(match) {
  return { config: match.config, log: match.log, startedAt: match.startedAt };
}

export function restoreMatch(saved) {
  if (!saved) return null;
  try {
    return replayMatch(saved.config, saved.log, saved.startedAt);
  } catch {
    return null;
  }
}
