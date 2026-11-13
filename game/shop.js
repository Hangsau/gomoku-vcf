// game/shop.js — 棋具商店（2026-11-13 使用者選設計稿 A「貨架格」，docs/design/shop-2026-11-13/）
// 商品＝game/skin.js 裡有 optIn 的項目（RushSkin.isShop）。現在是免費商店：商品只標「限時免費」，按「領取」才能用，領過永久保留。
// 全屏一頁：左上返回、標題、右上「限時免費」膠囊；棋子、棋盤各一區 4 欄格子；點一格跳小框（預覽＋領取／使用）。
// 入口：首頁右上角的購物袋鈕（本檔自己插進 #openSet 前面），棋具頁兩排最後的「＋」（skin-picker.js 呼叫 RushShop.open）。
// 後台關閉的（isOff）不顯示。一屏不捲動（中英日韓 × 360×640／375×667，小框打開時也一樣）。依賴 game.html 的全域：lang、RushSkin。
(() => {
  if (!window.RushSkin) return;
  const S = window.RushSkin;
  const UI = {
    zh: { shop: '商店', free: '限時免費', stones: '棋子', boards: '棋盤', tag: '免費', owned: '已擁有', using: '使用中', claim: '領取', use: '使用', close: '關閉', back: '返回', empty: '目前沒有上架的商品' },
    en: { shop: 'Shop', free: 'Limited-time free', stones: 'Stones', boards: 'Boards', tag: 'Free', owned: 'Owned', using: 'In use', claim: 'Claim', use: 'Use', close: 'Close', back: 'Back', empty: 'Nothing on the shelves right now' },
    ja: { shop: 'ショップ', free: '期間限定 無料', stones: '石', boards: '盤', tag: '無料', owned: '所持済み', using: '使用中', claim: 'もらう', use: '使う', close: '閉じる', back: '戻る', empty: '現在、並んでいる商品はありません' },
    ko: { shop: '상점', free: '한정 무료', stones: '돌', boards: '판', tag: '무료', owned: '보유 중', using: '사용 중', claim: '받기', use: '사용', close: '닫기', back: '뒤로', empty: '지금 진열된 상품이 없어요' },
  };
  const L = () => { const l = typeof lang !== 'undefined' ? lang : (window.RushLang ? window.RushLang() : 'zh'); return UI[l] ? l : 'zh'; };   // game.html 的 lang 是全域；duel.html 的在模組裡，靠 window.RushLang()
  const U = (k) => UI[L()][k];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC_BAG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  const IC_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const IC_X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const css = `
#shopPage{position:fixed;inset:0;z-index:41;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden;padding:calc(10px + env(safe-area-inset-top)) 16px calc(14px + env(safe-area-inset-bottom));gap:10px}
#shopPage[hidden]{display:none}
#shopPage .hbar{flex:none;display:flex;align-items:center;gap:8px;margin-left:-8px}
#shopPage .hbar h1{margin:0;font-size:20px;font-weight:900;flex:1;min-width:0}
#shopPage .back{width:48px;height:48px;border:0;border-radius:24px;background:var(--panel);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
#shopPage .pill{flex:none;font-size:13px;font-weight:700;color:var(--goldInk);background:var(--gold);border-radius:999px;padding:5px 12px;white-space:nowrap}
#shopPage .sec{flex:none;display:flex;flex-direction:column;gap:8px}
#shopPage .sec b{font-size:15px}
#shopPage .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#shopPage .cell{width:100%;height:var(--ch,84px);padding:6px 0 0;border-radius:14px;cursor:pointer;background:var(--panel);border:2px solid var(--line);color:var(--text);display:flex;flex-direction:column;align-items:center;gap:3px;font-family:inherit}
#shopPage .cell.on{border-color:var(--teal)}
#shopPage .cell .tg{font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap}
#shopPage .cell.has .tg{color:var(--teal)}
#shopPage .pair{position:relative;display:block;width:62px;height:52px}
#shopPage .pair i{position:absolute;width:40px;height:40px;border-radius:50%;background-size:contain;background-repeat:no-repeat;background-position:center}
#shopPage .pair i.fig{border-radius:0}
#shopPage .pair i.a{left:0;top:0}
#shopPage .pair i.b{left:22px;top:12px}
#shopPage .bd{position:relative;display:block;width:52px;height:52px;border-radius:8px;overflow:hidden;background-size:cover;background-position:center}
#shopPage .bd u{position:absolute;left:5px;top:5px;width:43px;height:43px;background-size:14px 14px}
#shopPage.tight{--ch:72px;gap:6px}
#shopPage.tight .pair{transform:scale(.88);transform-origin:top center;height:46px}
#shopPage.tight .bd{width:46px;height:46px}
#shopPage .empty{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--text2);font-size:15px}
#shopDlg{position:absolute;inset:0;background:rgba(6,8,13,.78);display:flex;align-items:center;justify-content:center;padding:16px}
#shopDlg[hidden]{display:none}
#shopDlg .box{position:relative;width:min(300px,100%);box-sizing:border-box;background:var(--panel);border:1px solid var(--line2);border-radius:18px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:12px}
#shopDlg .x{position:absolute;right:2px;top:2px;width:48px;height:48px;border:0;border-radius:24px;background:transparent;color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer}
#shopDlg h2{margin:4px 44px 0;font-size:18px;font-weight:900;text-align:center;line-height:1.25}
#shopDlg canvas{flex:none;display:block;border-radius:12px}
#shopDlg .st{font-size:13px;font-weight:700;border-radius:999px;padding:4px 10px;color:var(--goldInk);background:var(--gold)}
#shopDlg .st.has{color:var(--tealInk);background:var(--teal)}
#shopDlg .cta{width:100%;height:48px;border:0;border-radius:14px;font-family:inherit;font-size:17px;font-weight:900;cursor:pointer;background:var(--gold);color:var(--goldInk)}
#shopDlg .cta.use{background:var(--teal);color:var(--tealInk)}
#shopDlg .cta.on{background:var(--tealBg);color:var(--teal);cursor:default;opacity:1}
`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  const root = document.createElement('div'); root.id = 'shopPage'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  document.body.appendChild(root);

  let sel = null;   // 小框裡的商品 { kind: 'b'|'s', it }
  const items = (list) => list.filter((x) => S.isShop(x) && !S.isOff(x));
  const using = (kind, it) => S.owns(it) && (kind === 'b' ? S.boardId() : S.stonesId()) === it.id;

  // ---------- 格子 ----------
  const bgUrl = (u) => `url('${u}')`;
  function stoneCell(it) {
    const mk = (sd, cls) => `<i class="${cls}${sd.fig ? ' fig' : ''}" style="background-image:${sd.img ? bgUrl(sd.img) : 'none'};${sd.img ? '' : `background-color:${sd.fill}`}"></i>`;
    return `<span class="pair" aria-hidden="true">${mk(it.black, 'a')}${mk(it.white, 'b')}</span>`;
  }
  function boardCell(it) {
    return `<span class="bd" aria-hidden="true" style="background-color:${it.color};${it.img ? `background-image:${bgUrl(it.img)}` : ''}"><u style="background-image:linear-gradient(${it.line} 1px,transparent 1px),linear-gradient(90deg,${it.line} 1px,transparent 1px)"></u></span>`;
  }
  function cell(kind, it) {
    const has = S.owns(it), on = using(kind, it), lg = L();
    return `<button type="button" class="cell${has ? ' has' : ''}${on ? ' on' : ''}" data-k="${kind}:${esc(it.id)}" aria-label="${esc(S.name(it, lg))}">${kind === 's' ? stoneCell(it) : boardCell(it)}<span class="tg">${esc(on ? U('using') : has ? U('owned') : U('tag'))}</span></button>`;
  }

  // ---------- 小框 ----------
  const PRE = [[1, 1, 'b'], [2, 2, 'w'], [3, 3, 'b'], [2, 3, 'b'], [4, 2, 'w'], [3, 1, 'w'], [1, 3, 'b'], [4, 4, 'w'], [5, 3, 'b'], [3, 5, 'w']];
  // 用 RushSkin 真的畫：看棋子＝這組棋子＋玩家目前的棋盤；看棋盤＝這張棋盤＋玩家目前的棋子
  function drawPreview(cv) {
    if (!sel) return;
    const size = Math.max(140, Math.min(200, innerHeight - 400)), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bdId = sel.kind === 'b' ? sel.it.id : S.boardId(), stId = sel.kind === 's' ? sel.it.id : S.stonesId();
    const p = S.preview(bdId, stId);
    const n = 7, pad = size * 0.1, cellPx = (size - 2 * pad) / (n - 1);
    ctx.clearRect(0, 0, size, size);
    S.drawBoard(ctx, { size, pad, cell: cellPx, n, round: 12, starR: 0 }, p.board);
    for (const [c, r, k] of PRE) S.drawStone(ctx, pad + c * cellPx, pad + r * cellPx, cellPx * 0.46, k === 'b', 1, 1.5, k === 'b' ? p.black : p.white);
  }
  function dialog() {
    if (!sel) return '';
    const { kind, it } = sel, has = S.owns(it), on = using(kind, it), lg = L();
    const cta = on ? `<button type="button" class="cta on" data-cta="none" disabled>${esc(U('using'))}</button>`
      : has ? `<button type="button" class="cta use" data-cta="use">${esc(U('use'))}</button>`
      : `<button type="button" class="cta" data-cta="claim">${esc(U('claim'))}</button>`;
    return `<div class="box"><button type="button" class="x" data-x aria-label="${esc(U('close'))}">${IC_X}</button><h2>${esc(S.name(it, lg))}</h2><canvas aria-hidden="true"></canvas><span class="st${has ? ' has' : ''}">${esc(has ? U('owned') : U('free'))}</span>${cta}</div>`;
  }

  // ---------- 整頁 ----------
  function render() {
    const act = document.activeElement && root.contains(document.activeElement) ? (document.activeElement.dataset.k || (document.activeElement.dataset.cta && 'cta') || (document.activeElement.hasAttribute('data-x') && 'x') || (document.activeElement.dataset.back !== undefined && 'back')) : null;
    const st = items(S.stones), bd = items(S.boards);
    const sec = (title, kind, list) => (list.length ? `<div class="sec"><b>${esc(title)}</b><div class="grid">${list.map((it) => cell(kind, it)).join('')}</div></div>` : '');
    const body = st.length || bd.length ? sec(U('stones'), 's', st) + sec(U('boards'), 'b', bd) : `<p class="empty">${esc(U('empty'))}</p>`;
    root.className = '';
    root.innerHTML = `<div class="hbar"><button type="button" class="back" data-back aria-label="${esc(U('back'))}">${IC_BACK}</button><h1>${esc(U('shop'))}</h1><span class="pill">${esc(U('free'))}</span></div>${body}<div id="shopDlg" ${sel ? '' : 'hidden'}>${dialog()}</div>`;
    if (root.scrollHeight > root.clientHeight + 1) root.classList.add('tight');   // 放不下：格子縮矮，不改成可捲動
    root.querySelector('[data-back]').onclick = () => close();
    root.querySelectorAll('[data-k]').forEach((el) => { el.onclick = () => { const [k, id] = el.dataset.k.split(':'); const it = (k === 'b' ? S.boards : S.stones).find((x) => x.id === id); if (it) { sel = { kind: k, it }; render(); const c = root.querySelector('[data-cta]'); if (c && !c.disabled) c.focus(); else root.querySelector('[data-x]').focus(); } }; });
    const dlg = root.querySelector('#shopDlg');
    dlg.onclick = (e) => { if (e.target === dlg) closeDlg(); };
    const x = root.querySelector('[data-x]'); if (x) x.onclick = () => closeDlg();
    const cta = root.querySelector('[data-cta]');
    if (cta && !cta.disabled) cta.onclick = async () => {
      const { kind, it } = sel; cta.disabled = true;
      if (cta.dataset.cta === 'claim') await S.claim(it);
      else if (kind === 'b') S.setBoard(it.id); else S.setStones(it.id);
      render();
    };
    const cv = root.querySelector('#shopDlg canvas'); if (cv) drawPreview(cv);
    if (act) { const el = act === 'cta' ? root.querySelector('[data-cta]:not([disabled])') || root.querySelector('[data-x]') : act === 'x' ? root.querySelector('[data-x]') : act === 'back' ? root.querySelector('[data-back]') : root.querySelector(`[data-k="${act}"]`); if (el) el.focus(); }
  }
  function closeDlg() {
    const k = sel && `${sel.kind}:${sel.it.id}`; sel = null; render();
    const el = k && root.querySelector(`[data-k="${k}"]`); if (el) el.focus();
  }
  function open() {
    sel = null; root.hidden = false;
    // 從棋具頁過來：把棋具頁那一格歷史換成商店，返回時不會留一格空的
    if (history.state && history.state.skin) history.replaceState({ shop: 1 }, ''); else history.pushState({ shop: 1 }, '');
    render(); root.querySelector('[data-back]').focus();
  }
  function hide() { root.hidden = true; sel = null; root.innerHTML = ''; }
  function close() { hide(); if (history.state && history.state.shop) history.back(); if (entry) entry.focus(); }
  addEventListener('popstate', () => { if (!root.hidden) hide(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) { if (sel) closeDlg(); else close(); } });
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
    entry.onclick = () => open();
    setEntryLabel();
  }
  window.RushShop = { open, close };
})();
