// game/skin.js — 棋盤與棋子樣式（2026-11-11 使用者：「一個地方設定，全部更換」）
// 闖關（game.html）、教學（learn.js）、兩儀殿（duel.html）、詰題試煉場（score.html）都叫這裡畫棋盤和棋子，
// 所以換樣式只要在選單選一次，存在這台裝置（localStorage vcfgame.skin），每個頁面都跟著換。
// 一套樣式＝一組顏色；也可以用圖（codex 畫的透明 PNG，256×256，放 game/skin/<id>/）。
// 圖只畫棋子本體和棋盤底：格線、星位、最後一手、連五框等標記一律由程式畫在上面，換哪套都看得清楚。
// 圖還沒載入完就先用顏色畫，載入完發 rushskin 事件讓頁面重畫。
(() => {
  const KEY = 'vcfgame.skin';
  const DEFAULT = 'classic';
  const EVT = 'rushskin';

  // board: color 底色、line 格線、star 星位、label 座標字、ink 盤面色底上的粗字、edge 盤邊厚度色（教學盤的立體邊）、img 底圖
  // black/white: fill 底色、ring 外框色（null＝不描）、ink 子上手數字的顏色、img 棋子圖
  const SKINS = [
    { id: 'classic', name: { zh: '原木', en: 'Classic wood', ja: '木目', ko: '원목' },
      board: { color: '#E9C98B', line: '#5B4524', star: '#5B4524', label: '#7A5E36', ink: '#1B1A17', edge: '#9C7A45' },
      black: { fill: '#1B1A17', ring: null, ink: '#FBFAF6' },
      white: { fill: '#FBFAF6', ring: '#1B1A17', ink: '#1B1A17' } },
  ];

  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch {} },
  };
  const imgs = new Map();   // 路徑 → Image
  const fire = () => { try { window.dispatchEvent(new Event(EVT)); } catch {} };
  function img(src) {
    if (!src) return null;
    if (!imgs.has(src)) { const im = new Image(); im.onload = fire; im.src = src; imgs.set(src, im); }
    const im = imgs.get(src);
    return im.complete && im.naturalWidth ? im : null;
  }
  const byId = (id) => SKINS.find((s) => s.id === id);
  let cur = byId(store.get()) || byId(DEFAULT);

  function preload(s) { [s.board.img, s.black.img, s.white.img].forEach(img); }
  function applyCss() {   // 給用網頁元素組棋盤的地方（教學盤、小圓點標示）用
    const st = document.documentElement.style, s = cur;
    const bg = (side) => (side.img ? `url("${side.img}") center/cover no-repeat, ${side.fill}` : side.fill);
    st.setProperty('--sk-board', s.board.img ? `url("${s.board.img}") center/cover no-repeat, ${s.board.color}` : s.board.color);
    st.setProperty('--sk-board-c', s.board.color);
    st.setProperty('--sk-line', s.board.line);
    st.setProperty('--sk-star', s.board.star);
    st.setProperty('--sk-label', s.board.label);
    st.setProperty('--sk-edge', s.board.edge);
    st.setProperty('--sk-board-ink', s.board.ink);
    st.setProperty('--sk-b', bg(s.black));
    st.setProperty('--sk-w', bg(s.white));
    st.setProperty('--sk-b-c', s.black.fill);
    st.setProperty('--sk-w-c', s.white.fill);
    st.setProperty('--sk-b-ink', s.black.ink);
    st.setProperty('--sk-w-ink', s.white.ink);
    st.setProperty('--sk-w-ring', s.white.ring || 'transparent');
  }

  const STAR15 = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  // canvas 畫整個空棋盤：底、格線、星位。o = { x, y, size, pad, cell, n, round, lineWidth, starR }
  function drawBoard(ctx, o) {
    const s = cur.board, x0 = o.x || 0, y0 = o.y || 0, n = o.n || 15, size = o.size;
    const round = o.round ?? 10, lw = o.lineWidth || 1;
    roundRect(ctx, x0, y0, size, size, round);
    ctx.fillStyle = s.color; ctx.fill();
    const bimg = img(s.img);
    if (bimg) { ctx.save(); roundRect(ctx, x0, y0, size, size, round); ctx.clip(); ctx.drawImage(bimg, x0, y0, size, size); ctx.restore(); }
    ctx.strokeStyle = s.line; ctx.lineWidth = lw;
    const a = o.pad, b = o.pad + (n - 1) * o.cell;
    for (let i = 0; i < n; i++) {
      const p = o.crisp === false ? o.pad + i * o.cell : Math.round(o.pad + i * o.cell) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0 + a, y0 + p); ctx.lineTo(x0 + b, y0 + p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + p, y0 + a); ctx.lineTo(x0 + p, y0 + b); ctx.stroke();
    }
    if (n === 15 && o.starR !== 0) {
      ctx.fillStyle = s.star;
      for (const [r, c] of STAR15) { ctx.beginPath(); ctx.arc(x0 + o.pad + c * o.cell, y0 + o.pad + r * o.cell, o.starR || 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // canvas 畫一顆子（圓心 x,y、半徑 r）
  function drawStone(ctx, x, y, r, black, alpha, ringW) {
    const side = black ? cur.black : cur.white, im = img(side.img);
    ctx.globalAlpha = alpha ?? 1;
    if (im) ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
    else {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = side.fill; ctx.fill();
      if (side.ring) { ctx.lineWidth = ringW || 1.5; ctx.strokeStyle = side.ring; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }

  // SVG 版（詰題試煉場的盤面）：回傳字串
  function svgBoard(o) {
    const s = cur.board, n = o.n || 15, a = o.pad, b = o.pad + (n - 1) * o.cell;
    let g = `<rect width="${o.size}" height="${o.size}" rx="${o.round ?? 8}" fill="${s.color}"/>`;
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
    const side = black ? cur.black : cur.white;
    if (side.img) return `<image href="${side.img}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" ${extra.replace(/fill-opacity/g, 'opacity')}/>`;
    const ring = side.ring ? ` stroke="${side.ring}" stroke-width="1.3"` : '';
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${side.fill}"${ring} ${extra}/>`;
  }

  function set(id) {
    const s = byId(id); if (!s) return false;
    cur = s; store.set(id); preload(s); applyCss(); fire();
    return true;
  }

  window.RushSkin = {
    EVT, list: SKINS,
    get: () => cur,
    set, drawBoard, drawStone, svgBoard, svgStone,
    ink: (black) => (black ? cur.black.ink : cur.white.ink),
    // 換了樣式（或圖載入完）就叫 fn 重畫；別的分頁換了這頁也跟著換
    onChange(fn) { window.addEventListener(EVT, fn); },
  };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { const s = byId(e.newValue) || byId(DEFAULT); cur = s; preload(s); applyCss(); fire(); } });
  preload(cur);
  applyCss();
})();
