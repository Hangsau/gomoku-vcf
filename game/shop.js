// game/shop.js — 棋具商店（2026-11-13 使用者定案：商店首頁一張「棋具」卡 → 棋具頁 D「上面搭配看效果、下面選商品」，docs/design/shop-2026-11-13/）
// 商品＝game/skin.js 裡有 optIn 的項目（RushSkin.isShop）。現在是免費商店：商品只標「限時免費」，按「免費領取」才能用，領過永久保留。
// 兩個畫面（同一個全屏層 #shopPage）：商店首頁（卡片清單 CARDS）→ 棋具頁（預覽盤＋兩個分頁＋4 欄格子＋底部大按鈕，沒有彈出小框）。
// 棋具頁：棋子、棋盤兩邊各自記住選擇（selS／selB），預覽盤用 RushSkin 真的畫；點格子只是選、底部按鈕才領取／換上，只動目前分頁那一件。
// 入口：首頁右上角購物袋（本檔自己插進 #openSet 前面）→ 商店首頁；棋具頁（設定→棋具）兩排最後的「＋」呼叫 RushShop.open({ stage:true, tab, from:'picker' }) → 直接進棋具頁。
// 後台關閉的（isOff）不顯示。一屏不捲動（中英日韓 × 360×640／375×667）。依賴 game.html 的全域：lang、RushSkin。
(() => {
  if (!window.RushSkin) return;
  const S = window.RushSkin;
  const UI = {
    zh: { shop: '商店', gear: '棋具', free: '限時免費', stonesT: '棋子造型', boardsT: '棋盤花色', count: '棋子造型 {a} 組・棋盤花色 {b} 張', tag: '免費', owned: '已擁有', using: '使用中', def: '預設', defIn: '預設・內建', pairB: '搭配的棋盤', pairS: '搭配的棋子', defSfx: '（預設）', claim: '免費領取「{n}」', use: '換上「{n}」', back: '返回', empty: '目前沒有上架的商品' },
    en: { shop: 'Shop', gear: 'Board & stones', free: 'Free for now', stonesT: 'Stone sets', boardsT: 'Board looks', count: '{a} stone sets · {b} boards', tag: 'Free', owned: 'Owned', using: 'In use', def: 'Default', defIn: 'Default · built-in', pairB: 'Paired board', pairS: 'Paired stones', defSfx: ' (default)', claim: 'Claim free "{n}"', use: 'Use "{n}"', back: 'Back', empty: 'Nothing on the shelves right now' },
    ja: { shop: 'ショップ', gear: '碁盤と石', free: '期間限定 無料', stonesT: '石のデザイン', boardsT: '盤のデザイン', count: '石 {a} 種・盤 {b} 種', tag: '無料', owned: '所持済み', using: '使用中', def: 'デフォルト', defIn: 'デフォルト・内蔵', pairB: '組み合わせる盤', pairS: '組み合わせる石', defSfx: '（デフォルト）', claim: '「{n}」を無料でもらう', use: '「{n}」に変更', back: '戻る', empty: '現在、並んでいる商品はありません' },
    ko: { shop: '상점', gear: '판과 돌', free: '한정 무료', stonesT: '돌 디자인', boardsT: '판 디자인', count: '돌 {a}종 · 판 {b}종', tag: '무료', owned: '보유 중', using: '사용 중', def: '기본', defIn: '기본 · 내장', pairB: '함께 쓸 판', pairS: '함께 쓸 돌', defSfx: ' (기본)', claim: '"{n}" 무료 받기', use: '"{n}" 사용', back: '뒤로', empty: '지금 진열된 상품이 없어요' },
  };
  const L = () => { const l = typeof lang !== 'undefined' ? lang : (window.RushLang ? window.RushLang() : 'zh'); return UI[l] ? l : 'zh'; };   // game.html 的 lang 是全域；duel.html 的在模組裡，靠 window.RushLang()
  const U = (k, v) => { let t = UI[L()][k]; if (v) for (const x in v) t = t.replace('{' + x + '}', v[x]); return t; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC_BAG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  const IC_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const IC_NEXT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B6BCCB" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M9 5l7 7-7 7"/></svg>';

  const css = `
#shopPage{position:fixed;inset:0;z-index:41;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden;padding:calc(8px + env(safe-area-inset-top)) 16px calc(12px + env(safe-area-inset-bottom));gap:8px}
#shopPage[hidden]{display:none}
#shopPage .hbar{flex:none;display:flex;align-items:center;gap:8px;margin-left:-8px}
#shopPage .hbar h1{margin:0;font-size:20px;font-weight:900;flex:1;min-width:0}
#shopPage .back{width:48px;height:48px;border:0;border-radius:24px;background:var(--panel);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
#shopPage .pill{flex:none;font-size:13px;font-weight:700;color:var(--goldInk);background:var(--gold);border-radius:999px;padding:5px 12px;white-space:nowrap}
#shopPage .empty{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--text2);font-size:15px}
#shopPage .card{flex:none;display:flex;align-items:center;gap:14px;height:116px;box-sizing:border-box;padding:0 14px;border-radius:18px;background:var(--panel);border:2px solid var(--gold);color:var(--text);cursor:pointer;font-family:inherit;text-align:left;width:100%}
#shopPage .card .th{position:relative;flex:none;width:88px;height:88px;border-radius:12px;overflow:hidden}
#shopPage .card .th u{position:absolute;left:11px;top:11px;width:67px;height:67px;background-size:22px 22px}
#shopPage .card .th i{position:absolute;width:20px;height:20px;border-radius:50%}
#shopPage .card .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
#shopPage .card .tx b{font-size:20px;font-weight:900}
#shopPage .card .tx span{font-size:13px;color:var(--text2)}
#shopPage .card .tx em{font-style:normal;align-self:flex-start;font-size:12px;font-weight:900;color:var(--goldInk);background:var(--gold);border-radius:999px;padding:3px 10px}
#shopPage .top{flex:none;display:flex;gap:12px;align-items:stretch}
#shopPage .top canvas{flex:none;display:block;border-radius:14px}
#shopPage .sinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding-top:2px}
#shopPage .sinfo .k{font-size:12px;font-weight:700;color:var(--text2)}
#shopPage .sinfo .nm{font-size:19px;font-weight:900;line-height:1.25;overflow-wrap:anywhere}
#shopPage .sinfo .chip{align-self:flex-start;font-size:13px;font-weight:900;border-radius:999px;padding:4px 11px;color:var(--goldInk);background:var(--gold)}
#shopPage .sinfo .chip.has{color:var(--tealInk);background:var(--teal)}
#shopPage .sinfo .chip.def{color:var(--text);background:#2E3546}
#shopPage .sinfo .sp{flex:1}
#shopPage .sinfo .ot{font-size:14px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
#shopPage .stabs{flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#shopPage .stabs button{height:44px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer;border:2px solid var(--line);background:transparent;color:var(--text2);padding:0 4px;overflow:hidden}
#shopPage .stabs button[aria-pressed="true"]{border-color:var(--text);background:var(--text);color:var(--bg)}
#shopPage .grid{flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#shopPage .cell{width:100%;height:var(--ch,124px);padding:6px 1px 0;border-radius:14px;cursor:pointer;background:var(--panel);border:2px solid var(--line);color:var(--text);display:flex;flex-direction:column;align-items:center;gap:3px;font-family:inherit;box-sizing:border-box;overflow:hidden}
#shopPage .cell.sel{border-color:var(--gold)}
#shopPage .cell .nm{font-size:11px;font-weight:700;line-height:1.15;max-width:100%;overflow-wrap:anywhere;text-align:center;display:block}
#shopPage .cell .tg{font-size:11px;font-weight:700;color:var(--gold);white-space:nowrap;max-width:100%}
#shopPage .cell.has .tg{color:var(--teal)}
#shopPage .cell.def:not(.on) .tg{color:var(--text2)}
#shopPage .pair{position:relative;display:block;width:58px;height:var(--ph,44px);flex:none}
#shopPage .pair i{position:absolute;width:36px;height:36px;border-radius:50%;background-size:contain;background-repeat:no-repeat;background-position:center}
#shopPage .pair i.fig{border-radius:0}
#shopPage .pair i.a{left:0;top:0}
#shopPage .pair i.b{left:22px;top:8px}
#shopPage .pair i.d{width:32px;height:32px}
#shopPage .pair i.d.a{left:2px;top:2px;background:#1B1A17;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
#shopPage .pair i.d.b{left:24px;top:10px;background:#FBFAF6}
#shopPage .bd{position:relative;display:block;width:44px;height:44px;border-radius:8px;overflow:hidden;background-size:cover;background-position:center;flex:none}
#shopPage .bd u{position:absolute;left:4px;top:4px;width:37px;height:37px;background-size:12px 12px}
#shopPage .grow{flex:1;min-height:0}
#shopPage .cta{flex:none;width:100%;height:52px;border:0;border-radius:14px;font-family:inherit;font-size:17px;font-weight:900;cursor:pointer;background:var(--gold);color:var(--goldInk);padding:0 10px;overflow:hidden;line-height:1.15;display:flex;align-items:center;justify-content:center;text-align:center;overflow-wrap:anywhere}
#shopPage .cta.use{background:var(--teal);color:var(--tealInk)}
#shopPage .cta.on{background:var(--tealBg);color:var(--teal);cursor:default;opacity:1}
#shopPage .cta:disabled:not(.on){background:var(--panel);color:var(--text2);cursor:default}
#shopPage.tight{--ch:112px;--ph:38px;gap:6px}
#shopPage.tight .pair{transform:scale(.88);transform-origin:top center}
#shopPage.tight .bd{width:38px;height:38px}
#shopPage.tight .bd u{width:31px;height:31px}
#shopPage.tight .cta{height:46px}
`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  const root = document.createElement('div'); root.id = 'shopPage'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  document.body.appendChild(root);

  const items = (list) => list.filter((x) => S.isShop(x) && !S.isOff(x));
  const DEF = { s: 'flat', b: 'classic' };
  const byId = (kind, id) => (kind === 'b' ? S.boards : S.stones).find((x) => x.id === id);
  const defIt = (kind) => byId(kind, DEF[kind]);
  const isDef = (kind, it) => it.id === DEF[kind];
  const owns = (kind, it) => isDef(kind, it) || S.owns(it);
  const curId = (kind) => (kind === 'b' ? S.boardId() : S.stonesId());
  const using = (kind, it) => owns(kind, it) && curId(kind) === it.id;

  // 狀態：view＝'home'｜'stage'；tab＝'s'｜'b'；selS／selB＝兩邊各自記住的選擇（進棋具頁時＝玩家正在用的）；from＝'picker' 表示從棋具頁的「＋」進來
  let view = 'home', tab = 's', selS = null, selB = null, from = null;
  const sel = (kind) => (kind === 's' ? selS : selB);
  function initSel() { selS = S.stonesId(); selB = S.boardId(); }

  // ---------- 格子 ----------
  const bgUrl = (u) => `url('${u}')`;
  function stoneCell(it, isD) {
    if (isD) return '<span class="pair" aria-hidden="true"><i class="a d"></i><i class="b d"></i></span>';
    const mk = (sd, cls) => `<i class="${cls}${sd.fig ? ' fig' : ''}" style="background-image:${sd.img ? bgUrl(sd.img) : 'none'};${sd.img ? '' : `background-color:${sd.fill}`}"></i>`;
    return `<span class="pair" aria-hidden="true">${mk(it.black, 'a')}${mk(it.white, 'b')}</span>`;
  }
  function boardCell(it) {
    return `<span class="bd" aria-hidden="true" style="background-color:${it.color};${it.img ? `background-image:${bgUrl(it.img)}` : ''}"><u style="background-image:linear-gradient(${it.line} 1px,transparent 1px),linear-gradient(90deg,${it.line} 1px,transparent 1px)"></u></span>`;
  }
  function cell(kind, it) {
    const has = owns(kind, it), on = using(kind, it), d = isDef(kind, it), cur = sel(kind) === it.id;
    const tg = on ? U('using') : d ? U('def') : has ? U('owned') : U('tag'), nm = S.name(it, L());
    return `<button type="button" class="cell${has ? ' has' : ''}${d ? ' def' : ''}${on ? ' on' : ''}${cur ? ' sel' : ''}" data-k="${kind}:${esc(it.id)}" aria-pressed="${cur}" aria-label="${esc(nm)}">${kind === 's' ? stoneCell(it, d) : boardCell(it)}<span class="nm">${esc(nm)}</span><span class="tg">${esc(tg)}</span></button>`;
  }

  // ---------- 預覽盤：用 RushSkin 真的畫（盤＝棋盤分頁選的、子＝棋子分頁選的） ----------
  const PRE = [[1, 1, 'b'], [2, 2, 'w'], [3, 3, 'b'], [2, 3, 'b'], [4, 2, 'w'], [3, 1, 'w'], [1, 3, 'b'], [4, 4, 'w'], [5, 3, 'b'], [3, 5, 'w']];
  function drawPreview(cv, size) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = S.preview(selB, selS);
    const n = 7, pad = size * 0.1, cellPx = (size - 2 * pad) / (n - 1);
    ctx.clearRect(0, 0, size, size);
    S.drawBoard(ctx, { size, pad, cell: cellPx, n, round: 14, starR: 0 }, p.board);
    for (const [c, r, k] of PRE) S.drawStone(ctx, pad + c * cellPx, pad + r * cellPx, cellPx * 0.46, k === 'b', 1, 1.5, k === 'b' ? p.black : p.white);
    cv.dataset.board = p.board.id; cv.dataset.stones = selS;   // 給檢查腳本對照
  }

  // ---------- 商店首頁（卡片由 CARDS 產生，之後加類別多一筆） ----------
  const CARDS = [{
    id: 'gear', title: () => U('gear'),
    sub: () => U('count', { a: items(S.stones).length, b: items(S.boards).length }),
    count: () => items(S.stones).length + items(S.boards).length,
    thumb: () => { const b = defIt('b') || {}, c = b.color || '#E9C98B', l = b.line || '#5B4524'; return `<span class="th" aria-hidden="true" style="background:${c}"><u style="background-image:linear-gradient(${l} 1px,transparent 1px),linear-gradient(90deg,${l} 1px,transparent 1px)"></u><i style="left:23px;top:23px;background:#1B1A17"></i><i style="left:45px;top:23px;background:#FBFAF6;box-shadow:inset 0 0 0 1.5px #1B1A17"></i><i style="left:45px;top:45px;background:#1B1A17"></i><i style="left:23px;top:45px;background:#FBFAF6;box-shadow:inset 0 0 0 1.5px #1B1A17"></i></span>`; },
    go: () => { view = 'stage'; tab = 's'; initSel(); },
  }];
  function homeBody() {
    const cs = CARDS.filter((c) => c.count() > 0);
    if (!cs.length) return `<p class="empty">${esc(U('empty'))}</p>`;
    return cs.map((c) => `<button type="button" class="card" data-card="${c.id}">${c.thumb()}<span class="tx"><b>${esc(c.title())}</b><span>${esc(c.sub())}</span><em>${esc(U('free'))}</em></span>${IC_NEXT}</button>`).join('');
  }

  // ---------- 棋具頁 ----------
  function stageBody() {
    const kind = tab, other = kind === 's' ? 'b' : 's';
    const list = [defIt(kind)].concat(items(kind === 's' ? S.stones : S.boards)).filter(Boolean);
    const id = sel(kind), it = list.find((x) => x.id === id), shown = byId(kind, id), oit = byId(other, sel(other));
    const has = it ? owns(kind, it) : !!shown;   // 不在格子裡的（例如玩家正在用的「夜墨」）不是商店商品，視為已擁有
    const chip = shown && isDef(kind, shown) ? `<span class="chip def">${esc(U('defIn'))}</span>` : has ? `<span class="chip has">${esc(U('owned'))}</span>` : `<span class="chip">${esc(U('free'))}</span>`;
    const otName = oit ? S.name(oit, L()) + (isDef(other, oit) ? U('defSfx') : '') : '';
    let cta;
    if (!it) cta = `<button type="button" class="cta" data-cta="none" disabled>${esc(shown && curId(kind) === shown.id ? U('using') : U('use', { n: shown ? S.name(shown, L()) : '' }))}</button>`;
    else if (using(kind, it)) cta = `<button type="button" class="cta on" data-cta="none" disabled>${esc(U('using'))}</button>`;
    else if (has) cta = `<button type="button" class="cta use" data-cta="use">${esc(U('use', { n: S.name(it, L()) }))}</button>`;
    else cta = `<button type="button" class="cta" data-cta="claim">${esc(U('claim', { n: S.name(it, L()) }))}</button>`;
    return `<div class="top"><canvas aria-hidden="true"></canvas><div class="sinfo"><span class="k">${esc(U(kind === 's' ? 'stonesT' : 'boardsT'))}</span><b class="nm">${esc(shown ? S.name(shown, L()) : '')}</b>${chip}<div class="sp"></div><span class="k">${esc(U(kind === 's' ? 'pairB' : 'pairS'))}</span><span class="ot">${esc(otName)}</span></div></div>`
      + `<div class="stabs"><button type="button" data-tab="s" aria-pressed="${tab === 's'}">${esc(U('stonesT'))}</button><button type="button" data-tab="b" aria-pressed="${tab === 'b'}">${esc(U('boardsT'))}</button></div>`
      + `<div class="grid">${list.map((x) => cell(kind, x)).join('')}</div><div class="grow"></div>${cta}`;
  }

  // ---------- 整頁 ----------
  const focusKey = () => { const a = document.activeElement; if (!a || !root.contains(a)) return null; return a.dataset.k ? 'k=' + a.dataset.k : a.dataset.tab ? 't=' + a.dataset.tab : a.dataset.card ? 'c=' + a.dataset.card : a.hasAttribute('data-back') ? 'back' : a.dataset.cta ? 'cta' : null; };
  const focusBack = (k) => {
    if (!k) return;
    const el = k === 'back' ? root.querySelector('[data-back]') : k === 'cta' ? (root.querySelector('[data-cta]:not([disabled])') || root.querySelector('[data-back]')) : root.querySelector(k[0] === 'k' ? `[data-k="${k.slice(2)}"]` : k[0] === 't' ? `[data-tab="${k.slice(2)}"]` : `[data-card="${k.slice(2)}"]`);
    if (el) el.focus();
  };
  function render() {
    if (root.hidden) return;
    const fk = focusKey(), stage = view === 'stage';
    root.className = '';
    root.innerHTML = `<div class="hbar"><button type="button" class="back" data-back aria-label="${esc(U('back'))}">${IC_BACK}</button><h1>${esc(stage ? U('gear') : U('shop'))}</h1>${stage ? `<span class="pill">${esc(U('free'))}</span>` : ''}</div>${stage ? stageBody() : homeBody()}`;
    const cv = root.querySelector('.top canvas');
    if (cv) drawPreview(cv, 168);
    if (root.scrollHeight > root.clientHeight + 1) { root.classList.add('tight'); if (cv) drawPreview(cv, 140); }   // 放不下：縮預覽盤、格子矮一點，不改成可捲動
    root.querySelector('[data-back]').onclick = () => back();
    root.querySelectorAll('[data-card]').forEach((el) => { el.onclick = () => { CARDS.find((c) => c.id === el.dataset.card).go(); render(); root.querySelector('[data-back]').focus(); }; });
    root.querySelectorAll('[data-tab]').forEach((el) => { el.onclick = () => { tab = el.dataset.tab; render(); const t = root.querySelector(`[data-tab="${tab}"]`); if (t) t.focus(); }; });
    root.querySelectorAll('[data-k]').forEach((el) => { el.onclick = () => { const [k, id] = el.dataset.k.split(':'); if (k === 's') selS = id; else selB = id; render(); const c = root.querySelector(`[data-k="${el.dataset.k}"]`); if (c) c.focus(); }; });
    const cta = root.querySelector('[data-cta]:not([disabled])');
    if (cta) cta.onclick = async () => {
      const kind = tab, it = byId(kind, sel(kind)); if (!it) return; cta.disabled = true;
      if (cta.dataset.cta === 'claim') await S.claim(it);
      else if (kind === 'b') S.setBoard(it.id); else S.setStones(it.id);   // 領取只領取；換上要再按一次（按鈕變成「換上」）
      render();
    };
    focusBack(fk);
  }
  function enter(o) {
    o = o || {};
    from = o.from || null; view = o.stage ? 'stage' : 'home'; tab = o.tab === 'b' ? 'b' : 's'; initSel();
    root.hidden = false;
    // 從棋具頁過來：把棋具頁那一格歷史換成商店，返回時不會留一格空的
    if (history.state && history.state.skin) history.replaceState({ shop: 1 }, ''); else history.pushState({ shop: 1 }, '');
    render(); root.querySelector('[data-back]').focus();
  }
  function hide() { root.hidden = true; root.innerHTML = ''; }
  function back() {
    if (view === 'stage' && !from) { view = 'home'; render(); root.querySelector('[data-back]').focus(); return; }
    if (from === 'picker' && window.RushSkinPicker) { hide(); from = null; history.replaceState({ skin: 1 }, ''); window.RushSkinPicker.open(true); return; }
    close();
  }
  function close() { hide(); from = null; if (history.state && history.state.shop) history.back(); if (entry) entry.focus(); }
  addEventListener('popstate', () => { if (!root.hidden) hide(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) back(); });
  addEventListener('resize', () => { if (!root.hidden) render(); });
  // 領取、換樣式、圖載入完、伺服器同步完都會發 rushskin：重畫（不重複寫歷史）
  S.onChange(() => { if (!root.hidden) render(); });
  new MutationObserver(() => { if (!root.hidden) render(); setEntryLabel(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // ---------- 首頁入口 ----------
  let entry = null;
  function setEntryLabel() { if (entry) { entry.setAttribute('aria-label', U('shop')); entry.title = U('shop'); } }
  const openSet = document.getElementById('openSet');
  if (openSet && openSet.parentNode) {
    entry = document.createElement('button'); entry.type = 'button'; entry.id = 'openShop'; entry.className = 'icob gold'; entry.innerHTML = IC_BAG;
    openSet.parentNode.insertBefore(entry, openSet);
    entry.onclick = () => enter();
    setEntryLabel();
  }
  window.RushShop = { open: enter, close };
})();
