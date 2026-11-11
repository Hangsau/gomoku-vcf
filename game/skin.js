// game/skin.js — 棋盤與棋子樣式（2026-11-11 使用者：「一個地方設定，全部更換」；2026-11-12 選設計稿 B：棋盤、棋子分開配）
// 闖關（game.html）、教學（learn.js）、兩儀殿（duel.html）、詰題試煉場（score.html）都叫這裡畫棋盤和棋子，
// 所以在「棋具」選一次，存在這台裝置（localStorage vcfgame.board／vcfgame.stones），每個頁面都跟著換。
// 棋子可以用圖（codex 畫的透明 PNG，256×256，game/skin/stones/<id>/b.png、w.png），棋盤也可以（img）。
// 圖只畫棋子本體和棋盤底：格線、星位、最後一手、連五框等標記一律由程式畫在上面，換哪套都看得清楚。
// 圖還沒載入完先用顏色畫，載入完發 rushskin 事件讓頁面重畫。
// 看得清楚的保證：黑子在暗盤上、白子在亮盤上對比不夠時，程式自動幫那顆子描邊（rim）。
// 之後要做解鎖（使用者 2026-11-12）：項目加 lock（例如 { by: 'xiu', n: 300 }），isLocked() 看 vcfgame.skinUnlock 有沒有它。
(() => {
  const K_BOARD = 'vcfgame.board', K_STONES = 'vcfgame.stones', K_UNLOCK = 'vcfgame.skinUnlock';
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
  const isLocked = (it) => !!(it && it.lock) && !unlocked().includes(it.id);
  const pick = (list, id) => { const it = list.find((x) => x.id === id); return it && !isLocked(it) ? it : list[0]; };

  // 對比（WCAG 相對亮度）：看子在盤上清不清楚
  function lum(hex) {
    const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const RIM_BLACK = 3, RIM_WHITE = 1.6;   // 低於這個對比就自動描邊
  function side(bd, s, black) {
    if (s.ring) return s;
    const need = black ? contrast(bd.color, s.fill) < RIM_BLACK : contrast(bd.color, s.fill) < RIM_WHITE;
    return need ? { ...s, ring: black ? (bd.rim || bd.line) : bd.line } : s;
  }

  let board = pick(BOARDS, ls.get(K_BOARD)), stones = pick(STONES, ls.get(K_STONES));
  let cur;
  function compose() {
    cur = { id: board.id + '/' + stones.id, board, stones, black: side(board, stones.black, true), white: side(board, stones.white, false) };
    [board.img, cur.black.img, cur.white.img].forEach(img);
  }

  const cssBg = (s) => {
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
    if (im) ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
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
    if (s.img) return `<image href="${s.img}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" ${extra.replace(/fill-opacity/g, 'opacity')}/>` + ring;
    const fill = s.hi ? `url(#${black ? 'skgb' : 'skgw'})` : s.fill;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${s.ring ? ` stroke="${s.ring}" stroke-width="1.3"` : ''} ${extra}/>`;
  }

  function changed() { compose(); applyCss(); fire(); }
  function setBoard(id) { const it = BOARDS.find((x) => x.id === id); if (!it || isLocked(it)) return false; board = it; ls.set(K_BOARD, id); changed(); return true; }
  function setStones(id) { const it = STONES.find((x) => x.id === id); if (!it || isLocked(it)) return false; stones = it; ls.set(K_STONES, id); changed(); return true; }

  window.RushSkin = {
    EVT, boards: BOARDS, stones: STONES,
    get: () => cur,
    boardId: () => board.id, stonesId: () => stones.id,
    setBoard, setStones, isLocked,
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
  });
  compose();
  applyCss();
})();
