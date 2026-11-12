// game/skin-picker.js — 「棋具」頁：棋盤、棋子分開配（2026-11-12 使用者選設計稿 B，docs/design/skins-2026-11-12/）
// 上面大預覽，下面一排選盤、一排選子；點了就換、就存（RushSkin 存 localStorage），闖關、教學、兩儀殿、試煉場一起換。
// 鎖住的（之後的解鎖制度）顯示鎖頭、不能選；後台關閉的（S.isOff）不顯示。棋盤、棋子各兩排（8 欄自動換行）。一屏不捲動（中英日韓 × 360×640／375×667）。
// 入口在設定頁（#setSkin），不再有首頁按鈕。依賴 game.html 的全域：lang、RushSkin（game/skin.js）。
(() => {
  if (!window.RushSkin) return;
  const S = window.RushSkin;
  const UI = {
    zh: { entry: '棋具', title: '棋具', board: '棋盤', stones: '棋子', close: '關閉', note: '選了就換，闖關、教學、兩儀殿一起套用', locked: '還沒解鎖' },
    en: { entry: 'Board & stones', title: 'Board & stones', board: 'Board', stones: 'Stones', close: 'Close', note: 'Applies right away everywhere: puzzles, lessons and duels', locked: 'Locked' },
    ja: { entry: '碁盤と石', title: '碁盤と石', board: '盤', stones: '石', close: '閉じる', note: '選ぶとすぐ反映。問題・教室・対戦すべてに', locked: '未解放' },
    ko: { entry: '판과 돌', title: '판과 돌', board: '판', stones: '돌', close: '닫기', note: '고르면 바로 적용돼요. 문제·교실·대전 모두', locked: '잠김' },
  };
  const L = () => (typeof lang !== 'undefined' && UI[lang]) ? lang : 'zh';
  const U = (k) => UI[L()][k];
  const IC_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  const css = `
#skinPick{position:fixed;inset:0;z-index:40;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden;padding:calc(8px + env(safe-area-inset-top)) 16px calc(12px + env(safe-area-inset-bottom));gap:clamp(8px,1.8dvh,16px)}
#skinPick[hidden]{display:none}
#skinPick .sbar{flex:none;display:flex;align-items:center;gap:6px;margin-left:-8px}
#skinPick .sbar b{font-size:19px;font-weight:900}
#skinPick canvas{flex:none;align-self:center;display:block}
#skinPick .srow{flex:none;display:flex;flex-direction:column;gap:6px}
#skinPick .shd{display:flex;align-items:baseline;gap:8px;min-width:0}
#skinPick .shd b{font-size:15px;flex:none}
#skinPick .shd span{font-size:13px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#skinPick .sgrid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px}
#skinPick.tight{--sh:40px;gap:6px;padding-top:calc(4px + env(safe-area-inset-top));padding-bottom:calc(6px + env(safe-area-inset-bottom))}
#skinPick.tight .srow{gap:3px}
#skinPick.tight .sgrid{gap:3px}
#skinPick .sopt{position:relative;height:var(--sh,44px);padding:0;border-radius:12px;border:2px solid var(--line2);background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text)}
#skinPick .sopt[aria-pressed="true"]{border-color:var(--gold)}
#skinPick .sopt.st{background:var(--panel);border-color:transparent}
#skinPick .sopt.st[aria-pressed="true"]{border-color:var(--gold)}
#skinPick .sopt:disabled{cursor:default;opacity:.55}
#skinPick .sopt .lk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,12,18,.55);border-radius:10px;color:var(--text)}
#skinPick .sw{width:30px;height:30px;border-radius:8px}
#skinPick .dot{position:absolute;width:18px;height:18px;border-radius:50%}
#skinPick .dot.fig{width:20px;height:20px;border-radius:0;background-color:transparent}
#skinPick .snote{flex:none;margin:auto 0 0;font-size:12px;color:var(--text2);text-align:center}
.skPair{position:relative;width:30px;height:22px;flex:none;margin:0 0 0 0;display:inline-block}
.skPair i{position:absolute;width:16px;height:16px;border-radius:50%}
.skPair i.fig{border-radius:0}
`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  // ---------- 入口：設定頁的「棋具」列（2026-11-12 從首頁拿掉，改由設定頁打開）；game.html 用 window.RushSkinPicker.open()／pair() ----------
  const pairHTML = () => {
    const fg = !!S.get().black.fig;   // 造型棋子：不要底色、不要圈
    return `<span class="skPair" aria-hidden="true"><i class="${fg ? 'fig' : ''}" style="left:0;top:0;background:var(--sk-b);box-shadow:${fg ? 'none' : 'var(--sk-b-sh),0 0 0 1.5px #8A90A0'}"></i><i class="${fg ? 'fig' : ''}" style="left:12px;top:6px;background:var(--sk-w);box-shadow:${fg ? 'none' : 'var(--sk-w-sh)'}"></i></span>`;
  };
  const refreshSet = () => { if (typeof window.renderSet === 'function') window.renderSet(); };
  new MutationObserver(() => { if (!root.hidden) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // ---------- 棋具頁 ----------
  const root = document.createElement('div'); root.id = 'skinPick'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  document.body.appendChild(root);

  // 預覽盤面：11 路局部，一條剛連成的五（金圈）＋最後一手紅點，看得出標記在這套上清不清楚
  const PRE = [[3, 3, 1], [4, 4, 0], [5, 5, 1], [4, 5, 1], [6, 4, 0], [5, 3, 0], [3, 5, 1], [6, 6, 0], [6, 5, 1], [5, 7, 0], [2, 5, 1], [8, 4, 0]];
  const FIVE = [[2, 5], [3, 5], [4, 5], [5, 5], [6, 5]];
  const LAST = [6, 5];   // 最後一手剛好連成五
  // 預覽盤能用的高度 = 整頁高度 − 內距 − 其他區塊高度 − 區塊間距（實際量，不用猜；選項排數變了也不用改數字）
  function previewRoom(cv) {
    const cs = getComputedStyle(root), kids = [...root.children], gap = parseFloat(cs.rowGap) || 0;
    cv.style.display = 'none';
    const others = kids.filter((k) => k !== cv).reduce((a, k) => a + k.offsetHeight, 0);
    cv.style.display = '';
    return root.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - others - gap * (kids.length - 1);
  }
  function drawPreview(cv) {
    root.classList.remove('tight');
    let room = previewRoom(cv);
    if (room < 190) { root.classList.add('tight'); room = previewRoom(cv); }   // 放不下：格子 44→40、縮間距
    const avail = Math.min(root.clientWidth - 32, room);
    const px = Math.max(190, Math.min(420, Math.floor(avail)));
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(px * dpr); cv.height = Math.round(px * dpr); cv.style.width = cv.style.height = px + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = 11, pad = px * 0.05, cell = (px - 2 * pad) / (n - 1), xy = (c, r) => [pad + c * cell, pad + r * cell];
    ctx.clearRect(0, 0, px, px);
    S.drawBoard(ctx, { size: px, pad, cell, n, round: 14, starR: 0 });
    for (const [c, r, b] of PRE) { const [x, y] = xy(c, r); S.drawStone(ctx, x, y, cell * 0.46, !!b); }
    const [lx, ly] = xy(...LAST); ctx.fillStyle = '#FF7A6B'; ctx.beginPath(); ctx.arc(lx, ly, cell * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#F2B544';
    for (const [c, r] of FIVE) { const [x, y] = xy(c, r); ctx.beginPath(); ctx.arc(x, y, cell * 0.52, 0, Math.PI * 2); ctx.stroke(); }
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // url 用單引號：整串放在 style="…" 裡
  const bgOf = (s) => {
    if (s.fig && s.img) return `url('${s.img}') center/contain no-repeat`;   // 造型：不要底色
    return (s.img ? `url('${s.img}') center/cover no-repeat, ` : '') + (s.hi ? `radial-gradient(circle at 35% 30%, ${s.hi}, ${s.fill} 70%)` : s.fill);
  };
  const shOf = (s) => [s.ring ? `0 0 0 1.5px ${s.ring}` : '', s.glow ? `0 0 6px ${s.ring}` : ''].filter(Boolean).join(',') || 'none';
  const swOf = (b) => (b.img ? `url('${b.img}') center/cover no-repeat, ` : '') + b.color;
  function render() {
    const lg = L(), bId = S.boardId(), sId = S.stonesId();
    const bName = S.name(S.boards.find((x) => x.id === bId), lg), sName = S.name(S.stones.find((x) => x.id === sId), lg);
    const lock = (it) => (S.isLocked(it) ? `<span class="lk" title="${esc(U('locked'))}">${IC_LOCK}</span>` : '');
    const boards = S.boards.filter((b) => !S.isOff(b)).map((b) => `<button type="button" class="sopt" data-b="${b.id}" aria-pressed="${b.id === bId}" aria-label="${esc(S.name(b, lg))}"${S.isLocked(b) ? ' disabled' : ''}><span class="sw" style="background:${b.img ? '' : b.color};background-image:linear-gradient(${b.line} 1px,transparent 1px),linear-gradient(90deg,${b.line} 1px,transparent 1px)${b.img ? `,url('${b.img}'),linear-gradient(${b.color},${b.color})` : ''};background-size:10px 10px,10px 10px${b.img ? ',cover,auto' : ''};background-position:4px 4px,4px 4px${b.img ? ',center,0 0' : ''};background-repeat:repeat,repeat${b.img ? ',no-repeat,no-repeat' : ''}"></span>${lock(b)}</button>`).join('');
    const stones = S.stones.filter((s) => !S.isOff(s)).map((s) => {
      const p = S.preview('night', s.id);   // 按鈕底是深色，用深色盤算描邊，黑子才看得到
      return `<button type="button" class="sopt st" data-s="${s.id}" aria-pressed="${s.id === sId}" aria-label="${esc(S.name(s, lg))}"${S.isLocked(s) ? ' disabled' : ''}><span class="dot${s.fig ? ' fig' : ''}" style="left:calc(50% - 15px);top:6px;background:${bgOf(p.black)};box-shadow:${shOf(p.black)}"></span><span class="dot${s.fig ? ' fig' : ''}" style="left:calc(50% - 3px);top:16px;background:${bgOf(p.white)};box-shadow:${shOf(p.white)}"></span>${lock(s)}</button>`;
    }).join('');
    root.innerHTML = `<div class="sbar"><button type="button" class="icob" data-x aria-label="${esc(U('close'))}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><b>${esc(U('title'))}</b></div>
<canvas aria-hidden="true"></canvas>
<div class="srow"><div class="shd"><b>${esc(U('board'))}</b><span>${esc(bName)}</span></div><div class="sgrid">${boards}</div></div>
<div class="srow"><div class="shd"><b>${esc(U('stones'))}</b><span>${esc(sName)}</span></div><div class="sgrid">${stones}</div></div>
<p class="snote">${esc(U('note'))}</p>`;
    root.querySelector('[data-x]').onclick = () => close();
    root.querySelectorAll('[data-b]').forEach((el) => { el.onclick = () => { S.setBoard(el.dataset.b); render(); }; });
    root.querySelectorAll('[data-s]').forEach((el) => { el.onclick = () => { S.setStones(el.dataset.s); render(); }; });
    drawPreview(root.querySelector('canvas'));
  }
  function open() { root.hidden = false; history.pushState({ skin: 1 }, ''); render(); root.querySelector('[data-x]').focus(); }
  function close() {
    root.hidden = true; root.innerHTML = ''; const back = document.getElementById('setSkin'); if (back) back.focus();
    if (history.state && history.state.skin) history.back();
  }
  addEventListener('popstate', () => { if (!root.hidden) { root.hidden = true; root.innerHTML = ''; } });
  addEventListener('resize', () => { if (!root.hidden) drawPreview(root.querySelector('canvas')); });
  S.onChange(() => { if (!root.hidden) drawPreview(root.querySelector('canvas')); });
  window.RushSkinPicker = { open, pair: pairHTML };
  refreshSet();   // 棋子圖載入完重畫
})();
