// Gomoku Rush 對戰大廳（2026-11-11）：一個 Durable Object（Hall）放所有房間和棋局，玩家用 WebSocket 連進來。
// 兩種房間：kind 'gomoku'（五子棋，game/duel/match.js 每一手都在這裡驗）、kind 'vcf'（VCF 明鏡台搶答，見 vcf.js）。
// 狀態只放記憶體：大廳重開（部署、長時間沒人）房間就清空；第一版夠用，人多了再拆成一個房間一個 DO。
import { BLACK, WHITE, EMPTY, CELLS, FORBID_NONE, forbidType } from '../duel/rules.js';
import { cleanVcfSettings, cleanSeq, cleanWhy, loadBank, pickPuzzle, newVs, publicVs, COUNT_MS, REVEAL_MS } from './vcf.js';
import { RULE, ACTION, PHASE, OFFER_COUNT, SWAP2_ADD_CHOICE, createMatch, applyAction, actorOf, colorOf, checkTimeout, clockMs, isWinningMove, serializeMatch, ruleHasForbidden } from '../duel/match.js';

const TIMES = { none: null, '5+3': { mainMs: 300000, incMs: 3000 }, '10+5': { mainMs: 600000, incMs: 5000 } };
const RULES = Object.values(RULE);
const PLACE_PHASES = [PHASE.PLAY, PHASE.OPENING_PLACE, PHASE.SWAP2_PLACE, PHASE.SWAP2_ADD];
// match.js 的錯誤原因（中文）換成前端認得的代碼
const ERR_CODES = [['中央', 'zone'], ['對稱', 'symmetric'], ['黑方提出', 'notoffer'], ['候選點', 'badoffer']];
const errCode = (msg) => (ERR_CODES.find(([k]) => String(msg).includes(k)) || [null, 'bad'])[1];
const MAX_ROOMS = 200;
const MAX_NICK = 12;
const PLAY_GRACE_MS = 60000;   // 對局中斷線，60 秒內回來可以繼續，過了判輸
const WAIT_GRACE_MS = 15000;   // 等人時斷線（例如重新整理），15 秒內回來還在座位上

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      return env.HALL.get(env.HALL.idFromName('hall')).fetch(req);
    }
    return new Response('rush-duel', { status: 200 });
  },
};

const cleanNick = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NICK) || '?';
const cleanId = (s) => (/^[A-Za-z0-9_-]{8,40}$/.test(String(s)) ? String(s) : null);

export class Hall {
  constructor(state, env) {
    this.env = env;
    this.clients = new Map();   // 玩家 id → { ws, nick, room: 正在看的房號或 null }
    this.rooms = new Map();     // 房號 → room
  }

  async fetch(req) {
    const url = new URL(req.url);
    const id = cleanId(url.searchParams.get('id'));
    if (!id) return new Response('bad id', { status: 400 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.connect(id, cleanNick(url.searchParams.get('nick')), server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- 連線 ----------
  connect(id, nick, ws) {
    const old = this.clients.get(id);
    if (old && old.ws !== ws) try { old.ws.close(4000, 'replaced'); } catch {}
    const c = { ws, nick, room: null };
    this.clients.set(id, c);
    ws.addEventListener('message', (ev) => { try { this.onMessage(id, ws, JSON.parse(ev.data)); } catch (e) { this.send(ws, { t: 'err', code: 'bad' }); } });
    const gone = () => this.disconnect(id, ws);
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
    this.send(ws, { t: 'hello', you: id, now: Date.now() });
    // 原本坐在某個房間（重新整理、斷線重連）：接回去
    const seated = this.seatOf(id);
    if (seated) {
      const { room, seat } = seated;
      room.seats[seat].online = true;
      room.seats[seat].nick = nick;
      clearTimeout(room.seats[seat].graceT);
      c.room = room.id;
      this.roomChanged(room);
    }
    this.send(ws, this.lobbyMsg());
  }

  disconnect(id, ws) {
    const c = this.clients.get(id);
    if (!c || c.ws !== ws) return;   // 已被新連線取代
    this.clients.delete(id);
    const seated = this.seatOf(id);
    if (!seated) { if (c.room) this.roomChanged(this.rooms.get(c.room)); return; }
    const { room, seat } = seated;
    const s = room.seats[seat];
    s.online = false;
    const playing = room.state === 'play';
    s.graceT = setTimeout(() => {
      if (room.seats[seat] !== s || s.online) return;
      if (room.state === 'play') this.endBy(room, seat, 'disconnect');
      this.stand(room, seat);
    }, playing ? PLAY_GRACE_MS : WAIT_GRACE_MS);
    this.roomChanged(room);
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }

  // ---------- 訊息 ----------
  onMessage(id, ws, m) {
    const c = this.clients.get(id);
    if (!c || c.ws !== ws) return;
    const err = (code) => this.send(ws, { t: 'err', code });
    switch (m.t) {
      case 'ping': return this.send(ws, { t: 'pong', now: Date.now() });
      case 'nick': {
        c.nick = cleanNick(m.nick);
        const s = this.seatOf(id);
        if (s) { s.room.seats[s.seat].nick = c.nick; this.roomChanged(s.room); }
        return;
      }
      case 'create': {
        if (this.rooms.size >= MAX_ROOMS) return err('full');
        const kind = m.kind === 'vcf' ? 'vcf' : 'gomoku';
        const vcf = kind === 'vcf' ? cleanVcfSettings(m) : null;
        if (kind === 'vcf' ? !vcf : !(m.time in TIMES) || !RULES.includes(m.rule)) return err('bad');
        this.leaveAll(id);
        const room = {
          id: this.newRoomId(), kind, vcf, time: kind === 'gomoku' ? m.time : null, rule: kind === 'gomoku' ? m.rule : null, createdAt: Date.now(), state: 'wait',
          seats: [null, null], match: null, vs: null, endNote: null, again: new Set(), timer: null, vtimer: null, games: 0,
        };
        this.rooms.set(room.id, room);
        const seat = m.color === 'w' ? 1 : m.color === 'b' ? 0 : (Math.random() < 0.5 ? 0 : 1);
        room.seats[seat] = this.seatRec(id, c.nick);
        c.room = room.id;
        this.roomChanged(room);
        return;
      }
      case 'view': {   // 點進房間看（還沒入座）
        const room = this.rooms.get(String(m.room));
        if (!room) { c.room = null; return err('gone'); }
        if (c.room && c.room !== room.id) this.leaveAll(id);
        c.room = room.id;
        this.roomChanged(room);
        return;
      }
      case 'sit': {
        const room = this.rooms.get(String(m.room));
        const seat = Number(m.seat);
        if (!room) return err('gone');
        if (![0, 1].includes(seat) || room.state === 'play' || room.seats[seat]) return err('taken');
        const mine = this.seatOf(id);
        if (mine && mine.room !== room) this.leaveAll(id);
        if (mine && mine.room === room) return err('taken');
        if (room.state === 'over') this.resetRoom(room);
        room.seats[seat] = this.seatRec(id, c.nick);
        c.room = room.id;
        if (room.seats[0] && room.seats[1]) this.start(room);
        this.roomChanged(room);
        return;
      }
      case 'vprog': case 'vdone': case 'vout': {   // VCF 搶答：進度、解開、出局
        const s = this.seatOf(id);
        if (!s || s.room.kind !== 'vcf' || s.room.state !== 'play') return err('notplay');
        return this.vcfMsg(s.room, s.seat, m);
      }
      case 'move': {
        const s = this.seatOf(id);
        if (!s || s.room.kind !== 'gomoku' || s.room.state !== 'play') return err('notplay');
        const { room, seat } = s;
        const p = Number(m.p);
        if (!Number.isInteger(p) || p < 0 || p >= CELLS) return err('bad');
        if (actorOf(room.match) !== seat) return err('notturn');
        if (!PLACE_PHASES.includes(room.match.phase)) return err('bad');
        if (room.match.cells[p] !== EMPTY) return err('occupied');
        // Rush 的規則：自己下禁手只擋下，不判輸（只在有禁手的規則、正式對局階段）
        if (room.match.phase === PHASE.PLAY && ruleHasForbidden(room.rule) && colorOf(room.match, seat) === BLACK && forbidType(room.match.cells, p) !== FORBID_NONE) return err('forbidden');
        return this.apply(room, seat, { type: ACTION.PLACE, p }, err);
      }
      case 'act': {   // 開局的決定：換手、轉山口、提候選、挑候選、Swap2 選擇、選色
        const s = this.seatOf(id);
        if (!s || s.room.kind !== 'gomoku' || s.room.state !== 'play') return err('notplay');
        if (actorOf(s.room.match) !== s.seat) return err('notturn');
        const action = this.cleanAction(m.action);
        if (!action) return err('bad');
        return this.apply(s.room, s.seat, action, err);
      }
      case 'resign': {
        const s = this.seatOf(id);
        if (!s || s.room.state !== 'play') return;
        this.endBy(s.room, s.seat, 'resign');
        return;
      }
      case 'again': {   // 下完了想再來一局：兩邊都按就交換黑白開新局
        const s = this.seatOf(id);
        if (!s || s.room.state !== 'over') return;
        s.room.again.add(id);
        if (s.room.seats[0] && s.room.seats[1] && s.room.seats.every(x => s.room.again.has(x.id))) {
          if (s.room.kind === 'gomoku') s.room.seats.reverse();   // 五子棋交換座位（黑白）；搶答沒有顏色，不用換
          this.start(s.room);
        }
        this.roomChanged(s.room);
        return;
      }
      case 'leave': {   // 回大廳；對局中離開＝認輸
        this.leaveAll(id);
        c.room = null;
        this.send(ws, this.lobbyMsg());
        return;
      }
      default: return err('bad');
    }
  }

  cleanAction(a) {
    if (!a || typeof a !== 'object') return null;
    const pt = (v) => (Number.isInteger(v) && v >= 0 && v < CELLS ? v : null);
    switch (a.type) {
      case ACTION.SWAP: return { type: ACTION.SWAP, swap: a.swap === true };
      case ACTION.YAMAGUCHI: return { type: ACTION.YAMAGUCHI };
      case ACTION.OFFER: {
        if (!Array.isArray(a.points) || a.points.length !== OFFER_COUNT) return null;
        const points = a.points.map(pt);
        return points.includes(null) ? null : { type: ACTION.OFFER, points };
      }
      case ACTION.PICK: return pt(a.p) === null ? null : { type: ACTION.PICK, p: a.p };
      case ACTION.SWAP2_CHOICE: return [BLACK, WHITE, SWAP2_ADD_CHOICE].includes(a.choice) ? { type: ACTION.SWAP2_CHOICE, choice: a.choice } : null;
      case ACTION.COLOR: return [BLACK, WHITE].includes(a.color) ? { type: ACTION.COLOR, color: a.color } : null;
      default: return null;
    }
  }
  apply(room, seat, action, err) {
    const r = applyAction(room.match, seat, action, Date.now());
    room.match = r.match;
    if (r.error && !room.match.result) return err(errCode(r.error));
    this.trapCheck(room);
    this.afterChange(room);
  }

  // ---------- 房間 ----------
  newRoomId() {
    for (;;) { const k = String(1000 + Math.floor(Math.random() * 9000)); if (!this.rooms.has(k)) return k; }
  }
  seatRec(id, nick) { return { id, nick, online: true, graceT: null }; }
  seatOf(id) {
    for (const room of this.rooms.values()) {
      const seat = room.seats.findIndex(s => s && s.id === id);
      if (seat >= 0) return { room, seat };
    }
    return null;
  }
  leaveAll(id) {
    const s = this.seatOf(id);
    if (s) {
      if (s.room.state === 'play') this.endBy(s.room, s.seat, 'resign');
      this.stand(s.room, s.seat);
    }
    const c = this.clients.get(id);
    if (c && c.room && (!s || s.room.id !== c.room)) { const r = this.rooms.get(c.room); c.room = null; if (r) this.roomChanged(r); }
  }
  stand(room, seat) {
    const s = room.seats[seat];
    if (!s) return;
    clearTimeout(s.graceT);
    room.seats[seat] = null;
    room.again.delete(s.id);
    if (room.state === 'over') this.resetRoom(room);   // 有人走了：留下的人回到等人狀態
    if (!room.seats.some(Boolean)) return this.closeRoom(room);
    this.roomChanged(room);
  }
  resetRoom(room) {
    room.state = 'wait'; room.match = null; room.vs = null; room.endNote = null; room.again.clear();
    clearTimeout(room.timer); clearTimeout(room.vtimer);
  }
  closeRoom(room) {
    clearTimeout(room.timer); clearTimeout(room.vtimer);
    this.rooms.delete(room.id);
    for (const c of this.clients.values()) if (c.room === room.id) { c.room = null; this.send(c.ws, { t: 'closed', room: room.id }); }
    this.broadcastLobby();
  }
  start(room) {
    room.state = 'play';
    room.endNote = null;
    room.again.clear();
    room.games += 1;
    if (room.kind === 'vcf') { room.vs = newVs(); this.vcfNext(room); return; }
    room.match = createMatch({ rule: room.rule, clock: TIMES[room.time] }, Date.now());
    this.armTimer(room);
  }

  // ---------- VCF 明鏡台搶答 ----------
  async vcfNext(room) {   // 出下一題：倒數 3 秒後兩人同時開始
    const vs = room.vs, token = vs.token;
    let x;
    try { x = pickPuzzle(await loadBank(this.env.BANK_URL, room.vcf.rank), vs.used); }
    catch (e) { console.error('題庫讀不到', e); room.endNote = 'nobank'; vs.result = { winner: null, note: 'nobank' }; room.state = 'over'; return this.roomChanged(room); }
    if (room.vs !== vs || vs.token !== token || room.state !== 'play') return;   // 等題目時房間變了
    const now = Date.now();
    vs.n += 1;
    vs.cur = {
      n: vs.n, puzzle: x, startAt: now + COUNT_MS, deadline: now + COUNT_MS + room.vcf.think * 1000, phase: 'play', winner: null, endAt: null,
      st: [{ s: 'think', moves: 0, why: null }, { s: 'think', moves: 0, why: null }], seqs: [null, null],
    };
    clearTimeout(room.vtimer);
    room.vtimer = setTimeout(() => this.vcfEndRound(room, null), vs.cur.deadline - now + 300);   // 思考上限到：這題沒人得分
    this.roomChanged(room);
  }
  vcfMsg(room, seat, m) {
    const c = room.vs && room.vs.cur;
    if (!c || c.phase !== 'play' || Number(m.n) !== c.n || Date.now() < c.startAt - 500) return;
    const me = c.st[seat];
    if (me.s !== 'think' && me.s !== 'armed') return;
    if (m.t === 'vprog') {
      me.s = m.armed ? 'armed' : 'think';
      me.moves = Math.max(0, Math.min(99, Number(m.moves) | 0));
      return this.roomChanged(room);
    }
    c.seqs[seat] = cleanSeq(m.seq);
    if (m.t === 'vdone') {
      me.s = 'solved';
      room.vs.score[seat] += 1;
      return this.vcfEndRound(room, seat);
    }
    me.s = 'out'; me.why = cleanWhy(m.why);
    if (c.st.every((x) => x.s === 'out')) return this.vcfEndRound(room, null);
    this.roomChanged(room);
  }
  vcfEndRound(room, winner) {
    const vs = room.vs, c = vs && vs.cur;
    if (!c || c.phase !== 'play' || room.state !== 'play') return;
    clearTimeout(room.vtimer);
    c.phase = 'done'; c.winner = winner; c.endAt = Date.now();
    for (const x of c.st) if (x.s === 'think' || x.s === 'armed') { x.s = 'out'; x.why = winner === null ? 'time' : x.why; }
    if (winner !== null && vs.score[winner] >= room.vcf.target) {
      vs.result = { winner, note: 'score' };
      room.state = 'over';
    } else {
      room.vtimer = setTimeout(() => this.vcfNext(room), REVEAL_MS);
    }
    this.roomChanged(room);
  }
  // 黑棋非擋不可的點是禁手（Rush 的「被禁手」）：白棋只有一個連五點、那點對黑是禁手、黑自己又沒有連五 → 判黑輸
  trapCheck(room) {
    const m = room.match;
    if (m.result || m.phase !== PHASE.PLAY || !ruleHasForbidden(room.rule) || colorOf(m, actorOf(m)) !== BLACK) return;
    const cells = m.cells;
    for (let p = 0; p < CELLS; p++) if (cells[p] === EMPTY && isWinningMove(m.rule, cells, p, BLACK) && forbidType(cells, p) === FORBID_NONE) return;
    const fives = [];
    for (let p = 0; p < CELLS; p++) if (cells[p] === EMPTY && isWinningMove(m.rule, cells, p, WHITE)) fives.push(p);
    if (fives.length === 1 && forbidType(cells, fives[0]) !== FORBID_NONE) {
      room.match = applyAction(m, actorOf(m), { type: ACTION.PLACE, p: fives[0] }, Date.now()).match;   // match.js 判黑下禁手輸
    }
  }
  endBy(room, seat, note) {
    if (room.kind === 'vcf') {
      clearTimeout(room.vtimer);
      if (room.vs) { room.vs.result = { winner: 1 - seat, note }; if (room.vs.cur) room.vs.cur.phase = 'done'; }
      room.endNote = note; room.state = 'over';
      return this.roomChanged(room);
    }
    room.match = applyAction(room.match, seat, { type: ACTION.RESIGN }, Date.now()).match;
    room.endNote = note;
    this.afterChange(room);
  }
  afterChange(room) {
    if (room.match && room.match.result) { room.state = 'over'; clearTimeout(room.timer); }
    else this.armTimer(room);
    this.roomChanged(room);
  }
  armTimer(room) {   // 計時：輪到的人時間用完就判負（伺服器的時間為準）
    clearTimeout(room.timer);
    const m = room.match;
    if (!m || !m.clock || m.result) return;
    const left = clockMs(m, Date.now())[actorOf(m)];
    room.timer = setTimeout(() => {
      const next = checkTimeout(room.match, Date.now());
      if (next !== room.match) { room.match = next; this.afterChange(room); } else this.armTimer(room);
    }, left + 50);
  }

  // ---------- 廣播 ----------
  roomMsg(room) {
    const m = room.match, now = Date.now();
    return {
      t: 'room', now,
      room: {
        id: room.id, kind: room.kind, vcf: room.vcf, time: room.time, rule: room.rule, state: room.state, games: room.games, endNote: room.endNote,
        vs: publicVs(room.vs),
        seats: room.seats.map(s => s && { id: s.id, nick: s.nick, online: s.online }),
        watchers: this.watchers(room),
        again: [...room.again],
        match: m ? serializeMatch(m) : null,
        clock: m && m.clock ? clockMs(m, now) : null,
      },
    };
  }
  watchers(room) {
    let n = 0;
    for (const [id, c] of this.clients) if (c.room === room.id && !room.seats.some(s => s && s.id === id)) n++;
    return n;
  }
  roomChanged(room) {
    if (!room || !this.rooms.has(room.id)) return this.broadcastLobby();
    const msg = this.roomMsg(room);
    for (const c of this.clients.values()) if (c.room === room.id) this.send(c.ws, msg);
    this.broadcastLobby();
  }
  lobbyMsg() {
    const rooms = [...this.rooms.values()].map(r => ({
      id: r.id, kind: r.kind, vcf: r.vcf, score: r.vs ? r.vs.score : null, time: r.time, rule: r.rule, state: r.state, createdAt: r.createdAt,
      seats: r.seats.map(s => s && { nick: s.nick, online: s.online }),
      watchers: this.watchers(r),
      moves: r.match ? r.match.moves.length : 0,
    })).sort((a, b) => (a.state === 'wait' ? 0 : 1) - (b.state === 'wait' ? 0 : 1) || b.createdAt - a.createdAt);
    return { t: 'lobby', rooms, online: this.clients.size };
  }
  broadcastLobby() {   // 大廳清單給還沒進房的人
    clearTimeout(this.lobbyT);
    this.lobbyT = setTimeout(() => {   // 同一瞬間很多變動只送一次
      const msg = JSON.stringify(this.lobbyMsg());
      for (const c of this.clients.values()) if (!c.room) try { c.ws.send(msg); } catch {}
    }, 50);
  }
}
