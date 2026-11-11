// Gomoku Rush 對戰大廳（2026-11-11）：一個 Durable Object（Hall）放所有房間和棋局，玩家用 WebSocket 連進來。
// 兩種房間：kind 'gomoku'（五子棋，game/duel/match.js 每一手都在這裡驗）、kind 'vcf'（VCF 明鏡台競速，見 vcf.js）。
// 狀態只放記憶體：大廳重開（部署、長時間沒人）房間就清空；第一版夠用，人多了再拆成一個房間一個 DO。
import { BLACK, WHITE, EMPTY, CELLS, FORBID_NONE, forbidType } from '../duel/rules.js';
import { cleanVcfSettings, cleanSeq, cleanWhy, loadBank, newVs, initList, startPuzzle, stopTimers, publicVs, COUNT_MS, NEXT_MS } from './vcf.js';
import { RULE, ACTION, PHASE, OFFER_COUNT, SWAP2_ADD_CHOICE, createMatch, applyAction, actorOf, colorOf, checkTimeout, clockMs, isWinningMove, serializeMatch, ruleHasForbidden } from '../duel/match.js';

// 時間：'none'＝不計時，或「分+每手加秒」字串（2026-11-11 使用者：5+5、10+10、自訂；分 1–180、秒 0–60）
const MAX_MIN = 180, MAX_INC = 60, MS_PER_MIN = 60000, MS_PER_SEC = 1000;
function parseTime(t) {
  if (t === 'none') return { ok: true, clock: null };
  const m = /^(\d{1,3})\+(\d{1,2})$/.exec(String(t));
  if (!m || +m[1] < 1 || +m[1] > MAX_MIN || +m[2] > MAX_INC) return { ok: false };
  return { ok: true, clock: { mainMs: +m[1] * MS_PER_MIN, incMs: +m[2] * MS_PER_SEC } };
}
const RULES = Object.values(RULE);
const PLACE_PHASES = [PHASE.PLAY, PHASE.OPENING_PLACE, PHASE.SWAP2_PLACE, PHASE.SWAP2_ADD];
// match.js 的錯誤原因（中文）換成前端認得的代碼
const ERR_CODES = [['中央', 'zone'], ['對稱', 'symmetric'], ['黑方提出', 'notoffer'], ['候選點', 'badoffer']];
const errCode = (msg) => (ERR_CODES.find(([k]) => String(msg).includes(k)) || [null, 'bad'])[1];
const MAX_ROOMS = 200;
const MAX_NICK = 12;
const PLAY_GRACE_MS = 60000;   // 對局中斷線，60 秒內回來可以繼續，過了判輸
const WAIT_GRACE_MS = 15000;   // 等人時斷線（例如重新整理），15 秒內回來還在座位上
const ROOM_ID_MIN = 1000, ROOM_ID_SPAN = 9000;   // 房號 4 位數
const TIMER_SLACK_MS = 50;      // 計時到了再多等一點才判，避免差幾毫秒還沒到
const LOBBY_DEBOUNCE_MS = 50;   // 同一瞬間很多變動，大廳清單只送一次
const ROUND_SLACK_MS = 300;     // 每題思考上限到了再多等一點，讓剛好送出的解開先到
const EARLY_MSG_MS = 500;       // 倒數結束前這麼久以內送來的進度還收（兩邊時鐘可能差一點）
const MAX_REPORTED_MOVES = 99;
// 研棋（2026-11-11 使用者）：不計時、自訂時間的房間對局中可以申請；任何時間設定下完都能覆盤
const STUDY_FAST_TIMES = ['5+5', '10+10'];
const STUDY_COOLDOWN_MS = 30000;   // 被拒絕後多久才能再申請
// 閒置退出（2026-11-11 使用者：開房等到睡著怎麼辦、要有入座時間退出機制）：坐著 IDLE_MS 沒動作就問「還在嗎？」，ASK_MS 內沒回應就離座（對局中＝判負）
// 本機測試可以用 --var IDLE_MS:8000 --var IDLE_ASK_MS:5000 縮短
const IDLE_MS = 10 * 60000, IDLE_ASK_MS = 60000;
const canStudy = (room) => room.kind === 'gomoku' && !STUDY_FAST_TIMES.includes(room.time);
// 只接受 Rush 網頁連進來（瀏覽器一定會帶 Origin）；本機測試用 127.0.0.1／localhost
const ORIGIN_OK = [/^https:\/\/rush\.hangsau\.app$/, /^https:\/\/([a-z0-9-]+\.)?gomoku-rush\.pages\.dev$/, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const origin = req.headers.get('Origin');
      if (origin && !ORIGIN_OK.some((re) => re.test(origin))) return new Response('forbidden origin', { status: 403 });
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
    this.state = state;
    this.idleMs = Number(env.IDLE_MS) || IDLE_MS;
    this.askMs = Number(env.IDLE_ASK_MS) || IDLE_ASK_MS;
    this.sweepMs = Math.min(15000, this.idleMs / 4);
    this.alarmSet = false;
  }
  // 閒置檢查用 Durable Object 的 alarm 定時喚醒（建構時設的 setInterval 不會跑，2026-11-11 實測）；有人連著才一直排
  ensureAlarm() {
    if (this.alarmSet) return;
    this.alarmSet = true;
    this.state.storage.setAlarm(Date.now() + this.sweepMs);
  }
  async alarm() {
    this.alarmSet = false;
    this.idleSweep();
    if (this.clients.size || this.rooms.size) this.ensureAlarm();
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
    this.ensureAlarm();
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
    const playing = room.state === 'play' || room.state === 'study';
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
    if (m.t !== 'ping') {   // 自己按的任何操作都算「還在」（自動送的 ping 不算）
      const s = this.seatOf(id);
      if (s) { const rec = s.room.seats[s.seat]; rec.lastAct = Date.now(); if (rec.askUntil) { rec.askUntil = null; this.send(ws, { t: 'idleClear' }); } }
    }
    switch (m.t) {
      case 'ping': return this.send(ws, { t: 'pong', now: Date.now() });
      case 'here': return;   // 「還在嗎？」按了繼續：上面已經記成有動作
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
        if (kind === 'vcf' ? !vcf : !parseTime(m.time).ok || !RULES.includes(m.rule)) return err('bad');
        this.leaveAll(id);
        const room = {
          id: this.newRoomId(), kind, vcf, time: kind === 'gomoku' ? String(m.time) : null, rule: kind === 'gomoku' ? m.rule : null, createdAt: Date.now(), waitSince: Date.now(), state: 'wait',
          seats: [null, null], match: null, vs: null, endNote: null, again: new Set(), timer: null, games: 0,
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
        if (![0, 1].includes(seat) || room.state === 'play' || room.state === 'study' || room.seats[seat]) return err('taken');
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
      case 'vprog': case 'vdone': case 'vout': case 'vskip': {   // VCF 競速：進度、解開、下錯／時間到、放棄這題
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
      case 'studyReq': case 'studyCancel': case 'studyAns': case 'review':
      case 'smove': case 'snav': case 'studyEnd': {   // 研棋：申請／取消／回覆、下完覆盤、研棋中下子／前後手／結束
        const s = this.seatOf(id);
        if (!s || s.room.kind !== 'gomoku') return err('bad');
        return this.studyMsg(s.room, s.seat, m, err);
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
          if (s.room.kind === 'gomoku') s.room.seats.reverse();   // 五子棋交換座位（黑白）；VCF 競速沒有顏色，不用換
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

  // ---------- 研棋 ----------
  studyMsg(room, seat, m, err) {
    const now = Date.now();
    switch (m.t) {
      case 'studyReq':
        if (room.state !== 'play' || !canStudy(room) || room.req) return;
        if ((room.reqBlock?.[seat] || 0) > now) return err('cool');
        room.req = { seat };
        return this.roomChanged(room);
      case 'studyCancel':
        if (room.req && room.req.seat === seat) { room.req = null; this.roomChanged(room); }
        return;
      case 'studyAns': {
        if (room.state !== 'play' || !room.req || room.req.seat === seat) return;
        if (m.ok === true) return this.enterStudy(room, 'request');
        const asker = room.seats[room.req.seat];
        room.reqBlock = room.reqBlock || [0, 0];
        room.reqBlock[room.req.seat] = now + STUDY_COOLDOWN_MS;
        room.req = null;
        const c = asker && this.clients.get(asker.id);
        if (c) this.send(c.ws, { t: 'note', code: 'declined' });
        return this.roomChanged(room);
      }
      case 'review':   // 下完覆盤：勝負已定，不用申請
        if (room.state !== 'over' || !room.match) return;
        return this.enterStudy(room, 'review');
    }
    const st = room.study;
    if (room.state !== 'study' || !st) return;
    if (m.t === 'smove') {
      const p = Number(m.p);
      if (!Number.isInteger(p) || p < 0 || p >= CELLS) return err('bad');
      const shown = st.seq.slice(0, st.cur);
      if (shown.some((x) => x.p === p)) return err('occupied');
      const color = shown.length && shown.at(-1).color === BLACK ? WHITE : BLACK;   // 研棋不管禁手，黑白輪流
      st.seq = [...shown, { p, color }];
      st.cur = st.seq.length;
    } else if (m.t === 'snav') {
      if (m.to === 'prev') st.cur = Math.max(0, st.cur - 1);
      else if (m.to === 'next') st.cur = Math.min(st.seq.length, st.cur + 1);
      else if (m.to === 'real') { st.seq = st.real.slice(); st.cur = st.real.length; }
      else return err('bad');
    } else if (m.t === 'studyEnd') {
      room.state = 'over';
      room.study = null;
    }
    this.roomChanged(room);
  }
  enterStudy(room, from) {
    clearTimeout(room.timer);
    const real = room.match.moves.map((x) => ({ p: x.p, color: x.color }));
    room.study = { seq: real.slice(), cur: real.length, real, from };
    room.req = null;
    room.state = 'study';
    if (from === 'request') room.endNote = 'study';   // 對局中研棋：這盤不計勝負
    this.roomChanged(room);
  }

  // ---------- 房間 ----------
  newRoomId() {
    for (;;) { const k = String(ROOM_ID_MIN + Math.floor(Math.random() * ROOM_ID_SPAN)); if (!this.rooms.has(k)) return k; }
  }
  seatRec(id, nick) { return { id, nick, online: true, graceT: null, lastAct: Date.now(), askUntil: null }; }
  // 多久沒動作：五子棋對局中只看輪到的人（從上一手算起），等人從開始等算起，其他從自己最後一個操作算起
  idleSince(room, seat) {
    const rec = room.seats[seat];
    if (room.state === 'play' && room.kind === 'gomoku' && room.match) {
      if (actorOf(room.match) !== seat) return null;
      const lastMove = room.match.log.length ? room.match.log.at(-1).t : room.match.startedAt;
      return Math.max(rec.lastAct, lastMove);
    }
    if (room.state === 'wait') return Math.max(rec.lastAct, room.waitSince || 0);
    return rec.lastAct;
  }
  idleSweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      room.seats.forEach((rec, seat) => {
        if (!rec || !rec.online || room.seats[seat] !== rec) return;
        const c = this.clients.get(rec.id);
        if (rec.askUntil) {
          if (now < rec.askUntil) return;
          rec.askUntil = null;   // 問了沒回：離座（對局中判負）
          if (c) this.send(c.ws, { t: 'note', code: 'idleOut' });
          if (room.state === 'play') {
            this.endBy(room, seat, 'idle');
            const other = room.seats[1 - seat], oc = other && this.clients.get(other.id);
            if (oc) this.send(oc.ws, { t: 'note', code: 'oppIdle', nick: rec.nick });   // 留下的人：對手太久沒回應、判你勝
          }
          if (c && c.room === room.id) c.room = null;
          this.stand(room, seat);
          if (c) this.send(c.ws, this.lobbyMsg());
          return;
        }
        const since = this.idleSince(room, seat);
        if (since != null && now - since >= this.idleMs) {
          rec.askUntil = now + this.askMs;
          if (c) this.send(c.ws, { t: 'idleAsk', ms: this.askMs });
        }
      });
    }
  }
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
    if (room.state === 'over' || room.state === 'study') this.resetRoom(room);   // 有人走了：留下的人回到等人狀態
    if (!room.seats.some(Boolean)) return this.closeRoom(room);
    this.roomChanged(room);
  }
  resetRoom(room) {
    room.state = 'wait'; room.waitSince = Date.now(); room.match = null; room.vs = null; room.study = null; room.req = null; room.endNote = null; room.again.clear();
    clearTimeout(room.timer); stopTimers(room.vs);
  }
  closeRoom(room) {
    clearTimeout(room.timer); stopTimers(room.vs);
    this.rooms.delete(room.id);
    for (const c of this.clients.values()) if (c.room === room.id) { c.room = null; this.send(c.ws, { t: 'closed', room: room.id }); }
    this.broadcastLobby();
  }
  start(room) {
    room.state = 'play';
    room.endNote = null;
    room.study = null; room.req = null; room.reqBlock = [0, 0];
    room.again.clear();
    room.games += 1;
    if (room.kind === 'vcf') { room.vs = newVs(); this.vcfStart(room); return; }
    room.match = createMatch({ rule: room.rule, clock: parseTime(room.time).clock }, Date.now());
    this.armTimer(room);
  }

  // ---------- VCF 明鏡台競速 ----------
  async vcfStart(room) {   // 抽好題目串，倒數 3 秒後兩人同時從第 1 題開始
    const vs = room.vs, token = vs.token;
    let bank;
    try { bank = await loadBank(this.env.BANK_URL, room.vcf.rank); }
    catch (e) { console.error('題庫讀不到', e); room.endNote = 'nobank'; vs.result = { winner: null, note: 'nobank' }; room.state = 'over'; return this.roomChanged(room); }
    if (room.vs !== vs || vs.token !== token || room.state !== 'play') return;   // 等題目時房間變了
    initList(vs, bank, room.vcf.target);
    vs.startAt = Date.now() + COUNT_MS;
    for (const seat of [0, 1]) this.vcfBegin(room, seat, 0, vs.startAt);
    this.roomChanged(room);
  }
  vcfBegin(room, seat, i, at) {   // 某人開始做第 i 題，設這題的思考上限
    const vs = room.vs, st = vs.p[seat];
    startPuzzle(vs, seat, i, at, room.vcf.think);
    clearTimeout(st.timer);
    st.timer = setTimeout(() => this.vcfFinish(room, seat, 'out', 'time', null), st.deadline - Date.now() + ROUND_SLACK_MS);
  }
  vcfMsg(room, seat, m) {
    const vs = room.vs, st = vs && vs.p[seat];
    if (!st || vs.result || Number(m.n) !== st.i || Date.now() < st.at - EARLY_MSG_MS) return;
    if (st.s !== 'think' && st.s !== 'armed') return;
    if (m.t === 'vprog') {
      st.s = m.armed ? 'armed' : 'think';
      st.moves = Math.max(0, Math.min(MAX_REPORTED_MOVES, Number(m.moves) | 0));
      return this.roomChanged(room);
    }
    if (m.t === 'vdone') return this.vcfFinish(room, seat, 'solved', null, cleanSeq(m.seq));
    this.vcfFinish(room, seat, 'out', m.t === 'vskip' ? 'skip' : cleanWhy(m.why), cleanSeq(m.seq));
  }
  vcfFinish(room, seat, r, why, seq) {   // 這題結束：解開加 1；到目標就贏，不然停一下換下一題
    const vs = room.vs, st = vs && vs.p[seat];
    if (!st || vs.result || room.state !== 'play' || (st.s !== 'think' && st.s !== 'armed')) return;
    clearTimeout(st.timer);
    st.s = r; st.why = why;
    st.log[st.i] = { r, why, seq: seq || [] };
    if (r === 'solved') vs.score[seat] += 1;
    if (vs.score[seat] >= room.vcf.target) {
      vs.result = { winner: seat, note: 'score' };
      room.state = 'over';
      stopTimers(vs);
      return this.roomChanged(room);
    }
    const i = st.i;
    st.timer = setTimeout(() => {
      if (room.vs !== vs || vs.result || st.i !== i) return;
      this.vcfBegin(room, seat, i + 1, Date.now());
      this.roomChanged(room);
    }, NEXT_MS);
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
      stopTimers(room.vs);
      if (room.vs) room.vs.result = { winner: 1 - seat, note };
      room.endNote = note; room.state = 'over';
      return this.roomChanged(room);
    }
    room.match = applyAction(room.match, seat, { type: ACTION.RESIGN }, Date.now()).match;
    room.endNote = note;
    this.afterChange(room);
  }
  afterChange(room) {
    if (room.match && room.match.result) { room.state = 'over'; room.req = null; clearTimeout(room.timer); }
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
    }, left + TIMER_SLACK_MS);
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
        canStudy: canStudy(room), req: room.req || null,
        study: room.study ? { seq: room.study.seq.map((x) => [x.p, x.color]), cur: room.study.cur, realN: room.study.real.length, from: room.study.from } : null,
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
      id: r.id, kind: r.kind, vcf: r.vcf, score: r.vs ? r.vs.score : null, time: r.time, rule: r.rule, state: r.state, createdAt: r.createdAt, waitSince: r.waitSince,
      seats: r.seats.map(s => s && { nick: s.nick, online: s.online }),
      watchers: this.watchers(r),
      moves: r.match ? r.match.moves.length : 0,
    })).sort((a, b) => (a.state === 'wait' ? 0 : 1) - (b.state === 'wait' ? 0 : 1) || b.createdAt - a.createdAt);
    return { t: 'lobby', rooms, online: this.clients.size, now: Date.now() };
  }
  broadcastLobby() {   // 大廳清單給還沒進房的人
    clearTimeout(this.lobbyT);
    this.lobbyT = setTimeout(() => {   // 同一瞬間很多變動只送一次
      const msg = JSON.stringify(this.lobbyMsg());
      for (const c of this.clients.values()) if (!c.room) try { c.ws.send(msg); } catch {}
    }, LOBBY_DEBOUNCE_MS);
  }
}
