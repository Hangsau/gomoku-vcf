// game/skin.js — 棋盤與棋子樣式（2026-11-11 使用者：「一個地方設定，全部更換」；2026-11-12 選設計稿 B：棋盤、棋子分開配）
// 闖關（game.html）、教學（learn.js）、兩儀殿（duel.html）、詰題試煉場（score.html）都叫這裡畫棋盤和棋子，
// 所以在「棋具」選一次，存在這台裝置（localStorage vcfgame.board／vcfgame.stones），每個頁面都跟著換。
// 棋子可以用圖（codex 畫的透明 PNG，256×256，game/skin/stones/<id>/b.png、w.png），棋盤也可以（img）。
// 圖只畫棋子本體和棋盤底：格線、星位、最後一手、連五框等標記一律由程式畫在上面，換哪套都看得清楚。
// 圖還沒載入完先用顏色畫，載入完發 rushskin 事件讓頁面重畫。
// 看得清楚的保證：黑子在暗盤上、白子在亮盤上對比不夠時，程式自動幫那顆子描邊（rim）。
// 新加的棋盤、棋子一律加 `optIn: true`（預設關閉，後台打開才出現）。
// 之後要做解鎖（使用者 2026-11-12）：項目加 lock（例如 { by: 'xiu', n: 300 }），isLocked() 看 vcfgame.skinUnlock 有沒有它。
// 商店（2026-11-13）：有 optIn 的項目就是商店商品（isShop），要先「領取」才能用；擁有清單 vcfgame.owned（'b:<棋盤id>'／'s:<棋子id>'，因為棋盤棋子有同名 id）
// 存在這台裝置，也記在伺服器（以匿名編號 vcfgame.vid；GET /shop、POST /shop/claim），兩邊取聯集；離線照本機清單運作。
(() => {
  const K_BOARD = 'vcfgame.board', K_STONES = 'vcfgame.stones', K_UNLOCK = 'vcfgame.skinUnlock', K_OFF = 'vcfgame.skinsOff', K_OWNED = 'vcfgame.owned', K_VID = 'vcfgame.vid';
  const API = 'https://vcf-game-api.psyhangsau.workers.dev';
  const API_SKINS = API + '/skins';
  const EVT = 'rushskin';
  const N = (zh, en, ja, ko) => ({ zh, en, ja, ko });

  // 棋盤：color 底色、line 格線、star 星位、label 座標字、ink 盤色底上的粗字、edge 盤邊厚度色（教學盤的立體邊）、rim 黑子在這盤上不夠清楚時的描邊色、img 底圖
  const BOARDS = [
    { id: 'classic', name: N('原木', 'Wood', '木目', '원목'), color: '#E9C98B', line: '#5B4524', star: '#5B4524', label: '#7A5E36', ink: '#1B1A17', edge: '#9C7A45' },
    { id: 'green', name: N('經典綠', 'Green', 'グリーン', '초록'), color: '#4E9A62', line: '#1E4A2C', star: '#1E4A2C', label: '#0B2414', ink: '#0B2414', edge: '#2F6B41' },
    { id: 'night', name: N('夜墨', 'Night', '夜墨', '밤먹'), color: '#1F2533', line: '#56627A', star: '#8A93A8', label: '#AEB7CC', ink: '#F1EEFA', edge: '#10141D', rim: '#9AA3B8' },
    { id: 'celadon', name: N('青瓷', 'Celadon', '青磁', '청자'), color: '#C4DCCB', line: '#557564', star: '#3E5A4C', label: '#3E5A4C', ink: '#16201B', edge: '#8FB09B' },
    { id: 'paper', name: N('宣紙', 'Paper', '和紙', '한지'), color: '#F3EDE0', line: '#9A8F7A', star: '#5E5546', label: '#5E5546', ink: '#23201C', edge: '#CFC5B0' },
    { id: 'neon', name: N('霓虹', 'Neon', 'ネオン', '네온'), color: '#141428', line: '#39396A', star: '#FF4FA3', label: '#B9B9F0', ink: '#F1EEFA', edge: '#0A0A18', rim: '#B9B9F0' },
    { id: 'walnut', name: N('胡桃木', 'Walnut', 'ウォルナット', '호두나무'), color: '#5A3E2B', line: '#C9A57A', star: '#E3C79E', label: '#E3C79E', ink: '#FBF1E2', edge: '#3A271A', rim: '#E3C79E' },
    { id: 'kaya', name: N('榧木', 'Kaya', '榧', '비자나무'), color: '#E2B871', line: '#6E4F22', star: '#6E4F22', label: '#6E4F22', ink: '#2A1D0B', edge: '#A9803F' },
    { id: 'grass', name: N('草地', 'Grass', '芝生', '잔디'), color: '#69971A', line: '#1F4A17', star: '#1F4A17', label: '#143310', ink: '#0E2409', edge: '#3F7A2A', img: 'game/skin/boards/grass.webp', optIn: true },
    { id: 'starry', name: N('星空', 'Starry', '星空', '별밤'), color: '#2A3668', line: '#5E6A9A', star: '#C9D2F5', label: '#AEB7E0', ink: '#F1EEFA', edge: '#0A0D22', rim: '#A9B4DC', img: 'game/skin/boards/starry.webp', optIn: true },
    { id: 'beach', name: N('沙灘', 'Beach', '砂浜', '모래사장'), color: '#EFD2A5', line: '#8A6E3E', star: '#6B5228', label: '#6B5228', ink: '#2A1F0C', edge: '#C2A873', img: 'game/skin/boards/beach.webp', optIn: true },
    { id: 'chalk', name: N('黑板', 'Chalkboard', '黒板', '칠판'), color: '#30523F', line: '#B9CDBF', star: '#E6EFE8', label: '#C7D8CC', ink: '#F2F7F3', edge: '#132419', rim: '#B9CDBF', img: 'game/skin/boards/chalk.webp', optIn: true },
    { id: 'ice', name: N('冰湖', 'Ice', '氷の湖', '얼음 호수'), color: '#AECADB', line: '#3F6A86', star: '#3F6A86', label: '#3F6A86', ink: '#10222E', edge: '#9CC3D9', img: 'game/skin/boards/ice.webp', optIn: true },
    { id: 'denim', name: N('牛仔布', 'Denim', 'デニム', '데님'), color: '#2F4461', line: '#B8C9E6', star: '#E3EBF8', label: '#D0DCF0', ink: '#F4F7FC', edge: '#1B3157', rim: '#B8C9E6', img: 'game/skin/boards/denim.webp', optIn: true },
    { id: 'pool', name: N('泳池', 'Pool', 'プール', '수영장'), color: '#2FC0CA', line: '#0E5F73', star: '#0E5F73', label: '#0A4756', ink: '#06303B', edge: '#2A93A8', img: 'game/skin/boards/pool.webp', optIn: true },
  ];
  // 棋子：fill 底色（用圖時是圖的平均色，拿來算對比）、hi 左上高光色（有就畫成漸層）、ring 外框色、glow 發光、ink 子上手數字的顏色、img 圖
  const STONES = [
    { id: 'flat', name: N('平面', 'Flat', 'フラット', '평면'),
      black: { fill: '#1B1A17', ink: '#FBFAF6' }, white: { fill: '#FBFAF6', ring: '#1B1A17', ink: '#1B1A17' } },
    { id: 'gloss', name: N('光澤', 'Gloss', '光沢', '광택'),
      black: { fill: '#0A0C10', hi: '#5A6070', ink: '#FBFAF6' }, white: { fill: '#D6D2C6', hi: '#FFFFFF', ink: '#1B1A17' } },
    { id: 'glaze', name: N('釉面', 'Glaze', '釉薬', '유약'),
      black: { fill: '#16201B', hi: '#5B6E64', ink: '#F1F4EE' }, white: { fill: '#E2E8E0', hi: '#FFFFFF', ring: '#7E9A8A', ink: '#16201B' } },
    { id: 'neon', name: N('霓虹', 'Neon', 'ネオン', '네온'),
      black: { fill: '#120A1E', hi: '#3A1F4F', ring: '#FF4FA3', glow: true, ink: '#FFD1E8' }, white: { fill: '#BDF3FF', hi: '#FFFFFF', ring: '#2FD8FF', glow: true, ink: '#0B2A33' } },
    { id: 'inkdot', name: N('墨點', 'Ink', '墨', '먹'),
      black: { fill: '#23201C', ring: '#8F8678', ink: '#FFFDF8' }, white: { fill: '#FFFDF8', ring: '#23201C', ink: '#23201C' } },
    { id: 'jade', name: N('玉石', 'Jade', '玉石', '옥돌'),
      black: { fill: '#1A241D', hi: '#6E7A78', ink: '#E6F2EC', img: 'game/skin/stones/jade/b.png' }, white: { fill: '#E0E4DA', hi: '#FFFFFF', ink: '#10171A', img: 'game/skin/stones/jade/w.png' } },
    { id: 'shell', name: N('蛤碁石', 'Clamshell', '蛤碁石', '조개 바둑돌'),
      black: { fill: '#262729', hi: '#4A4A48', ink: '#F4F1EA', img: 'game/skin/stones/shell/b.png' }, white: { fill: '#D9D1C6', hi: '#FFFFFF', ring: '#C9C1AE', ink: '#18181A', img: 'game/skin/stones/shell/w.png' } },
    { id: 'poop', name: N('便便與霜淇淋', 'Poop & Soft Serve', 'うんちとソフトクリーム', '똥과 소프트아이스크림'), fig: true, optIn: true,
      black: { fill: '#5A3A22', ink: '#FFFFFF', img: 'game/skin/stones/poop/b.png', fig: true }, white: { fill: '#FFF3D6', ink: '#1B1A17', img: 'game/skin/stones/poop/w.png', fig: true } },
    { id: 'bunny', name: N('蘿蔔與兔子', 'Carrot & Bunny', 'にんじんとうさぎ', '당근과 토끼'), fig: true, optIn: true,
      black: { fill: '#F08A24', ink: '#FFFFFF', img: 'game/skin/stones/bunny/b.png', fig: true }, white: { fill: '#FFFFFF', ink: '#1B1A17', img: 'game/skin/stones/bunny/w.png', fig: true } },
    { id: 'pets', name: N('黑貓與白狗', 'Cat & Dog', '黒ねこと白いぬ', '검은 고양이와 흰 강아지'), fig: true, optIn: true,
      black: { fill: '#1E1E22', ink: '#FFFFFF', img: 'game/skin/stones/pets/b.png', fig: true }, white: { fill: '#FFFFFF', ink: '#1B1A17', img: 'game/skin/stones/pets/w.png', fig: true } },
    { id: 'onigiri', name: N('飯糰', 'Onigiri', 'おにぎり', '주먹밥'), fig: true, optIn: true,
      black: { fill: '#1F2A1E', ink: '#FFFFFF', img: 'game/skin/stones/onigiri/b.png', fig: true }, white: { fill: '#FFFFFF', ink: '#1B1A17', img: 'game/skin/stones/onigiri/w.png', fig: true } },
    { id: 'sky', name: N('月亮與太陽', 'Moon & Sun', '月と太陽', '달과 해'), fig: true, optIn: true,
      black: { fill: '#1B2A5A', ink: '#FFFFFF', img: 'game/skin/stones/sky/b.png', fig: true }, white: { fill: '#FFE680', ink: '#1B1A17', img: 'game/skin/stones/sky/w.png', fig: true } },
    { id: 'boo', name: N('炸彈與幽靈', 'Bomb & Ghost', 'ばくだんとおばけ', '폭탄과 유령'), fig: true, optIn: true,
      black: { fill: '#1A1A1E', ink: '#FFFFFF', img: 'game/skin/stones/boo/b.png', fig: true }, white: { fill: '#FFFFFF', ink: '#1B1A17', img: 'game/skin/stones/boo/w.png', fig: true } },
    { id: 'donut', name: N('甜甜圈', 'Donuts', 'ドーナツ', '도넛'), fig: true, optIn: true,
      black: { fill: '#4A2A18', ink: '#FFFFFF', img: 'game/skin/stones/donut/b.png', fig: true }, white: { fill: '#FFF4F0', ink: '#1B1A17', img: 'game/skin/stones/donut/w.png', fig: true } },
  ];

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const imgs = new Map();   // 路徑 → Image
  const fire = () => { try { window.dispatchEvent(new Event(EVT)); } catch {} };
  function img(src) {
    if (!src) return null;
    if (!imgs.has(src)) { const im = new Image(); im.onload = fire; im.src = src; imgs.set(src, im); }
    const im = imgs.get(src);
    return im.complete && im.naturalWidth ? im : null;
  }
  const unlocked = () => { try { return JSON.parse(ls.get(K_UNLOCK) || '[]'); } catch { return []; } };
  // 商店商品＝有 optIn 的項目。擁有清單的元素 'b:id'／'s:id'：種類用「在哪個清單裡」判斷（跟 isOff 同一招），不在 14 個項目上各加欄位
  const isShop = (it) => !!(it && it.optIn);
  const itemKey = (it) => (it ? (BOARDS.includes(it) ? 'b:' : 's:') + it.id : '');
  const OWNED_KEY = /^[bs]:[a-z0-9_-]{1,24}$/;
  const readOwned = () => { try { const a = JSON.parse(ls.get(K_OWNED) || '[]'); return new Set(Array.isArray(a) ? a.filter((x) => typeof x === 'string' && OWNED_KEY.test(x)) : []); } catch { return new Set(); } };
  let owned = readOwned();
  const saveOwned = () => ls.set(K_OWNED, JSON.stringify([...owned]));
  const owns = (it) => owned.has(itemKey(it));
  let prices = {};   // 'b:id'／'s:id' → 價格；沒列＝0（現在都是免費）
  const price = (it) => { const p = Number(prices[itemKey(it)]); return Number.isFinite(p) && p > 0 ? p : 0; };
  const isLocked = (it) => (!!(it && it.lock) && !unlocked().includes(it.id)) || (isShop(it) && !owns(it));
  // 後台開關（vcfgame.skinsOff）：{"off":{"boards":[…],"stones":[…]},"on":{"boards":[…],"stones":[…]}}
  // 沒有 optIn 的項目：在 off 裡才關閉；有 optIn 的項目：在 on 裡才開放（沒清單、連不上伺服器＝關閉）。舊格式（最外層直接是 boards／stones）當成 off。
  const arr = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
  const lists = (o) => ({ boards: arr(o && o.boards), stones: arr(o && o.stones) });
  const norm = (o) => { o = o && typeof o === 'object' ? o : {}; return ('off' in o || 'on' in o) ? { off: lists(o.off), on: lists(o.on) } : { off: lists(o), on: lists(null) }; };
  const readOff = () => { try { return norm(JSON.parse(ls.get(K_OFF) || '{}')); } catch { return norm(null); } };
  let off = readOff();
  const isOff = (it) => {
    if (!it || it.id === 'classic' || it.id === 'flat') return false;
    const k = BOARDS.includes(it) ? 'boards' : 'stones';
    return it.optIn ? !off.on[k].includes(it.id) : off.off[k].includes(it.id);
  };
  const pick = (list, id) => { const it = list.find((x) => x.id === id); return it && !isLocked(it) && !isOff(it) ? it : list[0]; };
  const repick = () => { board = pick(BOARDS, ls.get(K_BOARD)); stones = pick(STONES, ls.get(K_STONES)); };

  // 對比（WCAG 相對亮度）：看子在盤上清不清楚
  function lum(hex) {
    const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const RIM_BLACK = 3, RIM_WHITE = 1.6;   // 低於這個對比就自動描邊
  function side(bd, s, black) {
    if (s.ring || s.fig) return s;   // 造型棋子自己有描邊，不再畫圓框
    const need = black ? contrast(bd.color, s.fill) < RIM_BLACK : contrast(bd.color, s.fill) < RIM_WHITE;
    return need ? { ...s, ring: black ? (bd.rim || bd.line) : bd.line } : s;
  }

  let board = pick(BOARDS, ls.get(K_BOARD)), stones = pick(STONES, ls.get(K_STONES));
  const FIG = 1.12;   // 造型棋子的圖畫大一點（造型沒有填滿正方形）
  let cur;
  function compose() {
    cur = { id: board.id + '/' + stones.id, board, stones, black: side(board, stones.black, true), white: side(board, stones.white, false) };
    [board.img, cur.black.img, cur.white.img].forEach(img);
  }

  const cssBg = (s) => {
    if (s.fig && s.img) return `url("${s.img}") center/contain no-repeat`;   // 造型自己有輪廓，後面不疊底色
    const base = s.hi ? `radial-gradient(circle at 35% 30%, ${s.hi}, ${s.fill} 70%)` : s.fill;
    return s.img ? `url("${s.img}") center/cover no-repeat, ${base}` : base;
  };
  const cssSh = (s) => [s.ring ? `0 0 0 1.5px ${s.ring}` : '', s.glow ? `0 0 8px ${s.ring}` : ''].filter(Boolean).join(',') || '0 0 0 0 transparent';
  function applyCss() {   // 給用網頁元素組棋盤的地方（教學盤、小圓點標示）用
    const st = document.documentElement.style, b = cur.board;
    st.setProperty('--sk-board', b.img ? `url("${b.img}") center/cover no-repeat, ${b.color}` : b.color);
    st.setProperty('--sk-board-c', b.color);
    st.setProperty('--sk-line', b.line);
    st.setProperty('--sk-star', b.star);
    st.setProperty('--sk-label', b.label);
    st.setProperty('--sk-edge', b.edge);
    st.setProperty('--sk-board-ink', b.ink);
    st.setProperty('--sk-b', cssBg(cur.black));
    st.setProperty('--sk-w', cssBg(cur.white));
    st.setProperty('--sk-b-c', cur.black.fill);
    st.setProperty('--sk-w-c', cur.white.fill);
    st.setProperty('--sk-b-ink', cur.black.ink);
    st.setProperty('--sk-w-ink', cur.white.ink);
    st.setProperty('--sk-b-sh', cssSh(cur.black));
    st.setProperty('--sk-w-sh', cssSh(cur.white));
  }

  const STAR15 = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  // canvas 畫整個空棋盤：底、格線、星位。o = { x, y, size, pad, cell, n, round, lineWidth, starR, crisp }
  function drawBoard(ctx, o, bd = cur.board) {
    const x0 = o.x || 0, y0 = o.y || 0, n = o.n || 15, size = o.size;
    const round = o.round ?? 10, lw = o.lineWidth || 1;
    roundRect(ctx, x0, y0, size, size, round);
    ctx.fillStyle = bd.color; ctx.fill();
    const bimg = img(bd.img);
    if (bimg) { ctx.save(); roundRect(ctx, x0, y0, size, size, round); ctx.clip(); ctx.drawImage(bimg, x0, y0, size, size); ctx.restore(); }
    ctx.strokeStyle = bd.line; ctx.lineWidth = lw;
    const a = o.pad, b = o.pad + (n - 1) * o.cell;
    for (let i = 0; i < n; i++) {
      const p = o.crisp === false ? o.pad + i * o.cell : Math.round(o.pad + i * o.cell) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0 + a, y0 + p); ctx.lineTo(x0 + b, y0 + p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + p, y0 + a); ctx.lineTo(x0 + p, y0 + b); ctx.stroke();
    }
    if (n === 15 && o.starR !== 0) {
      ctx.fillStyle = bd.star;
      for (const [r, c] of STAR15) { ctx.beginPath(); ctx.arc(x0 + o.pad + c * o.cell, y0 + o.pad + r * o.cell, o.starR || 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // canvas 畫一顆子（圓心 x,y、半徑 r）；sd 可以傳別的樣式（棋具頁預覽用）
  function drawStone(ctx, x, y, r, black, alpha, ringW, sd) {
    const s = sd || (black ? cur.black : cur.white), im = img(s.img);
    ctx.save();
    ctx.globalAlpha = alpha ?? 1;
    if (im) { const d = r * 2 * (s.fig ? FIG : 1); ctx.drawImage(im, x - d / 2, y - d / 2, d, d); }
    else {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (s.hi) {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.05, x, y, r);
        g.addColorStop(0, s.hi); g.addColorStop(0.7, s.fill); g.addColorStop(1, s.fill);
        ctx.fillStyle = g;
      } else ctx.fillStyle = s.fill;
      ctx.fill();
    }
    if (s.ring) {
      if (s.glow) { ctx.shadowColor = s.ring; ctx.shadowBlur = r * 0.6; }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = ringW || 1.5; ctx.strokeStyle = s.ring; ctx.stroke();
    }
    ctx.restore();
  }

  // SVG 版（詰題試煉場的盤面）：回傳字串；有漸層的子要的 <defs> 也放在這裡
  const grad = (id, s) => (s.hi ? `<radialGradient id="${id}" cx="50%" cy="50%" r="50%" fx="35%" fy="30%"><stop offset="0" stop-color="${s.hi}"/><stop offset=".7" stop-color="${s.fill}"/></radialGradient>` : '');
  function svgBoard(o) {
    const s = cur.board, n = o.n || 15, a = o.pad, b = o.pad + (n - 1) * o.cell;
    let g = `<defs>${grad('skgb', cur.black)}${grad('skgw', cur.white)}</defs><rect width="${o.size}" height="${o.size}" rx="${o.round ?? 8}" fill="${s.color}"/>`;
    if (s.img) g += `<image href="${s.img}" width="${o.size}" height="${o.size}" preserveAspectRatio="none" clip-path="inset(0 round ${o.round ?? 8}px)"/>`;
    for (let i = 0; i < n; i++) {
      const p = o.pad + i * o.cell;
      g += `<line x1="${a}" y1="${p}" x2="${b}" y2="${p}" stroke="${s.line}" stroke-width="1"/><line x1="${p}" y1="${a}" x2="${p}" y2="${b}" stroke="${s.line}" stroke-width="1"/>`;
    }
    if (n === 15) STAR15.forEach(([r, c]) => { g += `<circle cx="${o.pad + c * o.cell}" cy="${o.pad + r * o.cell}" r="${o.starR || 3.5}" fill="${s.star}"/>`; });
    return g;
  }
  // extra：加在 circle 上的屬性（例如 fill-opacity），有圖的時候改加在 image 上
  function svgStone(x, y, r, black, extra = '') {
    const s = black ? cur.black : cur.white;
    const ring = s.ring ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${s.ring}" stroke-width="1.3"/>` : '';
    if (s.img) { const d = r * 2 * (s.fig ? FIG : 1); return `<image href="${s.img}" x="${x - d / 2}" y="${y - d / 2}" width="${d}" height="${d}" ${extra.replace(/fill-opacity/g, 'opacity')}/>` + ring; }
    const fill = s.hi ? `url(#${black ? 'skgb' : 'skgw'})` : s.fill;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${s.ring ? ` stroke="${s.ring}" stroke-width="1.3"` : ''} ${extra}/>`;
  }

  function changed() { compose(); applyCss(); fire(); }
  function setBoard(id) { const it = BOARDS.find((x) => x.id === id); if (!it || isLocked(it) || isOff(it)) return false; board = it; ls.set(K_BOARD, id); changed(); return true; }
  function setStones(id) { const it = STONES.find((x) => x.id === id); if (!it || isLocked(it) || isOff(it)) return false; stones = it; ls.set(K_STONES, id); changed(); return true; }

  window.RushSkin = {
    EVT, boards: BOARDS, stones: STONES,
    get: () => cur,
    boardId: () => board.id, stonesId: () => stones.id,
    setBoard, setStones, isLocked, isOff,
    isShop, owns, claim, price, vid,
    // 造型棋子上的手數字要加光暈才看得清楚：回光暈色，其他組回 null
    numHalo: (black) => { const s = black ? cur.black : cur.white; return s.fig ? (black ? '#1B1A17' : '#FFFFFF') : null; },
    // fillStyle、font、對齊由呼叫的地方先設好；有光暈就先描邊再填
    fillNum(ctx, text, x, y, black) {
      const h = window.RushSkin.numHalo(black);
      if (h) {
        const px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [])[1]) || 12;
        ctx.save(); ctx.lineWidth = px * 0.28; ctx.lineJoin = 'round'; ctx.strokeStyle = h; ctx.strokeText(text, x, y); ctx.restore();
      }
      ctx.fillText(text, x, y);
    },
    // 預覽用：某個盤配某組子時，實際畫出來的黑白子（含自動描邊）
    preview: (boardId, stonesId) => { const bd = BOARDS.find((x) => x.id === boardId) || board, st = STONES.find((x) => x.id === stonesId) || stones; return { board: bd, black: side(bd, st.black, true), white: side(bd, st.white, false) }; },
    drawBoard, drawStone, svgBoard, svgStone,
    ink: (black) => (black ? cur.black.ink : cur.white.ink),
    name: (it, lang) => it.name[lang] || it.name.en,
    // 換了樣式（或圖載入完）就叫 fn 重畫；別的分頁換了這頁也跟著換
    onChange(fn) { window.addEventListener(EVT, fn); },
  };
  window.addEventListener('storage', (e) => {
    if (e.key === K_BOARD) { board = pick(BOARDS, e.newValue); changed(); }
    if (e.key === K_STONES) { stones = pick(STONES, e.newValue); changed(); }
    if (e.key === K_OFF) { off = readOff(); repick(); changed(); }
    if (e.key === K_OWNED) { owned = readOwned(); repick(); changed(); }
  });
  compose();
  applyCss();

  // ---------- 商店：擁有清單與伺服器同步 ----------
  // 匿名編號：跟象牙塔、教學共用 vcfgame.vid；沒有（或格式不對）就用 game.html 同一種方式產生並存起來
  function vid() {
    let v = ls.get(K_VID);
    if (!v || !/^[0-9a-f-]{16,40}$/i.test(v)) {
      v = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      ls.set(K_VID, v);
    }
    return v;
  }
  function postClaim(items, src) {
    return fetch(API + '/shop/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vid: vid(), items, src }) }).then((r) => (r.ok ? r.json() : null));
  }
  const ownedChanged = () => { saveOwned(); repick(); changed(); };
  // 領取：先寫本機＋發事件（畫面馬上變），再送伺服器；伺服器明說拒絕才拿掉並回 false，連不上就留著（之後同步補送）
  async function claim(it) {
    const k = itemKey(it);
    if (!isShop(it) || !k) return false;
    if (!owned.has(k)) { owned.add(k); ownedChanged(); }
    try {
      const j = await postClaim([k], 'free');
      if (j && Array.isArray(j.refused) && j.refused.includes(k)) { owned.delete(k); ownedChanged(); return false; }
    } catch {}
    return true;
  }
  try {
    // 第一次載入新版（本機沒有擁有清單）：玩家已經在用的商店商品直接算他的，不收回
    if (ls.get(K_OWNED) === null) {
      const had = [];
      const b = BOARDS.find((x) => x.id === ls.get(K_BOARD)), st = STONES.find((x) => x.id === ls.get(K_STONES));
      if (b && isShop(b)) had.push(itemKey(b));
      if (st && isShop(st)) had.push(itemKey(st));
      had.forEach((k) => owned.add(k));
      saveOwned(); repick(); compose(); applyCss();
      if (had.length) postClaim(had, 'grand').catch(() => {});
    }
    // 同步：伺服器的清單跟本機取聯集；本機有、伺服器沒有的補送；任何失敗都安靜略過
    fetch(API + '/shop?vid=' + encodeURIComponent(vid())).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      if (j.prices && typeof j.prices === 'object') prices = j.prices;
      const srv = new Set(Array.isArray(j.owned) ? j.owned.filter((x) => typeof x === 'string' && OWNED_KEY.test(x)) : []);
      const before = owned.size;
      srv.forEach((k) => owned.add(k));
      const missing = [...owned].filter((k) => !srv.has(k));
      if (owned.size !== before) ownedChanged(); else fire();
      if (missing.length) postClaim(missing.slice(0, 40), 'free').catch(() => {});
    }).catch(() => {});
  } catch {}
  // 後台開關：向 Worker 要最新的關閉清單，有變就存回、重新套用；失敗安靜略過（維持舊的那份）
  try {
    fetch(API_SKINS).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.off) return;
      const next = norm({ off: j.off, on: j.on });
      if (JSON.stringify(next) === JSON.stringify(off)) return;
      ls.set(K_OFF, JSON.stringify(next)); off = readOff();
      board = pick(BOARDS, ls.get(K_BOARD)); stones = pick(STONES, ls.get(K_STONES));
      changed();
    }).catch(() => {});
  } catch {}
})();
