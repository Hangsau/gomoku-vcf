// game/settings.js — 共用設定頁（2026-11-13 使用者：兩儀殿不要自己的聲音鈕、語言鈕，所有設定收在同一個設定頁）
// game.html（首頁齒輪 → #sSet 畫面）與 duel.html（兩儀殿大廳／房間齒輪 → 頁面內蓋上的全屏設定頁）用同一份：項目、順序、樣式、四語文字都在這裡。
// 內容：帳號卡（之後開放）、落子音效音量、音樂音量、落子聲、棋具、語言、給作者留言。
// 自帶樣式（全部限定在 .rsx 底下）與四語文字；自己讀寫 localStorage（vcfgame.vol.sfx／vcfgame.vol.bgm／vcfgame.sfx.stone／vcfgame.lang 經由宿主）。
// 依賴：game/sound.js（RushSound：落子聲種類）、game/skin.js（RushSkin，選用：棋具列）、game/skin-picker.js（RushSkinPicker，選用）。
// 用法：const set = RushSettings.init({ host, getLang, setLang, onBack, onVol, onStone, previewStone, getSound, setSound, unmuteOnVol, apiBase, openBtn });
//   host：給元素＝畫在那個元素裡（game.html 的 #sSet）；不給＝自己建全屏疊層（duel.html）。
//   getLang()／setLang(code)：宿主的語言（setLang 要存 vcfgame.lang 並重畫宿主文字）。
//   onBack()：host 模式按返回鈕；疊層模式自己關閉。 onVol(kind, value)：音量改了，宿主即時套用（kind＝'sfx'／'bgm'）。
//   onStone(kind)：落子聲換了。 previewStone(kind)：試聽。 getSound()：目前是否有聲（靜音提示用）。
//   unmuteOnVol（兩儀殿用）：舊玩家 vcfgame.sound='0'（以前用喇叭鈕關的）而這頁已沒有喇叭鈕，拉任一條音量到 >0 就把總開關打開（setSound(true)）。
//   apiBase：留言送到 apiBase + '/feedback'。 openBtn：疊層模式的齒輪鈕或回傳它的函式（關閉時把焦點還給它）。title(lang)：設定的四語標題（齒輪鈕的 aria-label 用）。
(() => {
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const LANGS = [['zh', '中文', 'zh-Hant'], ['en', 'English', 'en'], ['ja', '日本語', 'ja'], ['ko', '한국어', 'ko']];
  const I18N = {
    zh: { setT: "設定", accT: "帳號", accSub: "登入後成績跟著你換裝置（之後開放）", setSnd: "聲音", setSfx: "落子音效", setBgm: "音樂", setMore: "外觀與其他", setSkin: "棋具", setLang: "語言", setStone: "落子聲", msgBtn: "給作者留言", msgT: "給作者留言", msgHint: "建議、遇到的問題、想要的功能都可以寫，只有作者看得到。", msgPh: "想說的話", msgContactPh: "聯絡方式（選填，想收到回覆再填，例如 IG 或 email）", msgSend: "送出", msgEmpty: "請先寫點什麼。", msgOk: "收到了，謝謝！", msgFail: "沒送出去，請稍後再試。", close: "關閉", done: "完成", muteNow: "目前靜音中", stoneT: "落子聲", home: "回入口", st_wood: "木頭", st_crisp: "清脆", st_deep: "沉穩", st_soft: "輕點", st_slate: "石板", st_jade: "玉石", st_drop: "水滴", st_bit: "電子", st_drum: "小鼓" },
    en: { setT: "Settings", accT: "Account", accSub: "Sign in to keep your scores across devices (coming later)", setSnd: "Sound", setSfx: "Stone sound", setBgm: "Music", setMore: "Look & more", setSkin: "Board & stones", setLang: "Language", setStone: "Move sound", msgBtn: "Message the developer", msgT: "Message the developer", msgHint: "Suggestions, problems, feature ideas: only the developer can read this.", msgPh: "Your message", msgContactPh: "Contact (optional, only if you want a reply, e.g. Instagram or email)", msgSend: "Send", msgEmpty: "Please write something first.", msgOk: "Got it, thank you!", msgFail: "Couldn't send. Please try again later.", close: "Close", done: "Done", muteNow: "Sound is muted", stoneT: "Move sound", home: "Back", st_wood: "Wood", st_crisp: "Crisp", st_deep: "Deep", st_soft: "Soft", st_slate: "Slate", st_jade: "Jade", st_drop: "Drop", st_bit: "Bit", st_drum: "Drum" },
    ja: { setT: "設定", accT: "アカウント", accSub: "ログインすると成績を端末間で引き継げます（近日対応）", setSnd: "サウンド", setSfx: "着手音", setBgm: "音楽", setMore: "外観ほか", setSkin: "碁盤と石", setLang: "言語", setStone: "着手音の種類", msgBtn: "作者にメッセージ", msgT: "作者にメッセージ", msgHint: "提案・不具合・欲しい機能など何でもどうぞ。作者だけが読めます。", msgPh: "メッセージ", msgContactPh: "連絡先（任意。返信がほしい場合のみ。Instagram やメールなど）", msgSend: "送信", msgEmpty: "まず何か書いてください。", msgOk: "受け取りました。ありがとうございます！", msgFail: "送信できませんでした。しばらくしてからもう一度お試しください。", close: "閉じる", done: "完了", muteNow: "現在ミュート中", stoneT: "着手音", home: "戻る", st_wood: "木", st_crisp: "澄", st_deep: "重", st_soft: "軽", st_slate: "石板", st_jade: "玉", st_drop: "水滴", st_bit: "電子", st_drum: "太鼓" },
    ko: { setT: "설정", accT: "계정", accSub: "로그인하면 기록이 기기를 넘어 이어져요 (추후 지원)", setSnd: "소리", setSfx: "착수음", setBgm: "음악", setMore: "외형 및 기타", setSkin: "판과 돌", setLang: "언어", setStone: "착수음 종류", msgBtn: "개발자에게 메시지", msgT: "개발자에게 메시지", msgHint: "제안, 문제, 원하는 기능 무엇이든 적어 주세요. 개발자만 볼 수 있습니다.", msgPh: "메시지", msgContactPh: "연락처 (선택, 답장을 원할 때만. 인스타그램이나 이메일 등)", msgSend: "보내기", msgEmpty: "먼저 내용을 적어 주세요.", msgOk: "잘 받았습니다. 감사합니다!", msgFail: "보내지 못했습니다. 잠시 후 다시 시도해 주세요.", close: "닫기", done: "완료", muteNow: "현재 음소거 중", stoneT: "착수음", home: "돌아가기", st_wood: "나무", st_crisp: "청명", st_deep: "묵직", st_soft: "가벼움", st_slate: "석판", st_jade: "옥", st_drop: "물방울", st_bit: "전자", st_drum: "북" },
  };
  const R = window.RushSound;
  const clampVol = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : d; };
  const css = `
.rsx{--rs-bg:var(--bg)}
.rsx .rsTop{position:relative;display:flex;justify-content:flex-start;align-items:center;padding:calc(6px + env(safe-area-inset-top)) 8px 0}
.rsx .rsTop b{font-size:18px}
.rsx .icob{width:48px;height:48px;border:0;border-radius:14px;background:transparent;color:var(--text);display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer;font:inherit}
.rsx .ico{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.rsx button:focus-visible,.rsx input:focus-visible,.rsx textarea:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
.rsx .setBody{padding:8px 16px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:clamp(8px,1.8dvh,12px)}
.rsx .acc{display:flex;align-items:center;gap:12px;min-height:68px;padding:8px 14px;border:1px solid var(--line2);border-radius:16px;background:var(--panel);color:var(--text);text-align:left;cursor:default}
.rsx .acc .av{width:40px;height:40px;border-radius:50%;background:var(--panel2);display:inline-flex;align-items:center;justify-content:center;flex:none}
.rsx .acc .av .ico{width:22px;height:22px;color:var(--text2)}
.rsx .acc .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.rsx .acc .tx b{font-size:16px}
.rsx .acc .tx span{font-size:13px;color:var(--text2);line-height:1.35}
.rsx .grp{display:flex;flex-direction:column;gap:6px}
.rsx .grp>span{font-size:13px;color:var(--text2);padding-left:4px}
.rsx .card{border-radius:16px;background:var(--panel);padding:2px 14px}
.rsx .card .sep{height:1px;background:var(--line)}
.rsx .vrow{display:flex;align-items:center;gap:10px;min-height:52px}
.rsx .vrow label{display:flex;align-items:center;gap:8px;width:112px;flex:none;font-size:15px;min-width:0;white-space:nowrap}
.rsx .vrow label .ico{width:20px;height:20px;flex:none}
.rsx .vrow input[type=range]{flex:1;min-width:0;height:44px;margin:0;accent-color:var(--gold)}
.rsx .vrow output{width:28px;text-align:right;font-family:var(--num);font-size:16px;color:var(--gold);flex:none}
.rsx .lrow{display:flex;align-items:center;gap:10px;width:100%;min-height:54px;padding:0;border:0;background:transparent;color:var(--text);font:inherit;font-size:15px;text-align:left;cursor:pointer}
.rsx .lrow>.ico{width:22px;height:22px;margin:0 4px;flex:none}
.rsx .lrow .nm{flex:1;min-width:0}
.rsx .lrow .val{font-size:14px;color:var(--text2);min-width:0;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rsx .lrow .chev{width:20px;height:20px;flex:none;color:var(--text2);transition:transform .15s}
.rsx .lrow[aria-expanded="true"] .chev{transform:rotate(90deg)}
.rsx .langRow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:0 0 10px}
.rsx .langRow[hidden]{display:none}
.rsx .langRow button{min-height:44px;padding:0 4px;border-radius:10px;border:1px solid var(--line2);background:transparent;color:var(--text);font:inherit;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.rsx .langRow button[aria-pressed="true"]{border:2px solid var(--gold);color:var(--gold);font-weight:700}
.rsx .muted{color:var(--text2)}
.rsx .stoneGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.rsx .stoneGrid button{min-height:52px;padding:0 4px;border-radius:12px;border:1px solid var(--line2);background:transparent;color:var(--text);font:inherit;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.rsx .stoneGrid button[aria-pressed="true"]{border:2px solid var(--gold);color:var(--gold);font-weight:700}
.rsx .btn{height:60px;border-radius:18px;border:0;font:inherit;font-size:20px;font-weight:900;cursor:pointer}
.rsx .btn.gold{background:var(--gold);color:var(--goldInk)}
.rsx .btn:disabled{cursor:default;opacity:.45}
.rsx .rsModal{position:fixed;inset:0;background:rgba(5,7,12,.7);display:flex;align-items:flex-end;justify-content:center;z-index:5}
.rsx .rsModal[hidden]{display:none}
.rsx .rsModal .box{width:100%;max-width:520px;max-height:88dvh;overflow-y:auto;border-radius:24px 24px 0 0;background:var(--panel);padding:10px 16px calc(20px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;color:var(--text)}
.rsx .rsModal h2{margin:4px 0 0;font-size:20px}
.rsx .grip{align-self:center;width:44px;height:5px;border-radius:3px;background:var(--line2)}
.rsx .rform{display:flex;flex-direction:column;gap:8px;padding:10px 4px 14px;font-size:14px}
.rsx .rform input[type=text]{width:100%;min-height:44px;background:var(--bg);color:var(--text);border:1px solid var(--line2);border-radius:12px;padding:8px 10px;font:inherit}
.rsx .rform textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line2);border-radius:12px;padding:8px 10px;font:inherit}
#rsOverlay{position:fixed;inset:0;z-index:30;background:var(--bg);color:var(--text);overflow:hidden;font-family:'Noto Sans TC',sans-serif}
#rsOverlay:lang(ja){font-family:'Noto Sans JP','Noto Sans TC',sans-serif}
#rsOverlay:lang(ko){font-family:'Noto Sans KR','Noto Sans TC',sans-serif;word-break:keep-all}
#rsOverlay[hidden]{display:none}
#rsOverlay .rsPage{max-width:520px;margin:0 auto;height:100%;display:flex;flex-direction:column;overflow:hidden}
`;
  const ICO = (p) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const CHEV = `<svg class="ico chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
  const X = ICO('<path d="M6 6l12 12M18 6L6 18"/>');
  const PAGE = (T) => `
  <div class="rsTop">
    <button type="button" class="icob" id="setBack" aria-label="${T('home')}">${ICO('<path d="M15 5l-7 7 7 7"/>')}</button>
    <b>${T('setT')}</b>
  </div>
  <div class="setBody">
    <div class="acc" role="group" aria-disabled="true">
      <span class="av">${ICO('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 14.5-4 16 0"/>')}</span>
      <span class="tx"><b>${T('accT')}</b><span>${T('accSub')}</span></span>
    </div>
    <div class="grp">
      <span>${T('setSnd')}</span>
      <div class="card">
        <div class="vrow"><label for="volSfx">${ICO('<circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/>')}<span>${T('setSfx')}</span></label><input id="volSfx" type="range" min="0" max="100" step="1" value="70"><output id="volSfxN" for="volSfx">70</output></div>
        <div class="sep"></div>
        <div class="vrow"><label for="volBgm">${ICO('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>')}<span>${T('setBgm')}</span></label><input id="volBgm" type="range" min="0" max="100" step="1" value="30"><output id="volBgmN" for="volBgm">30</output></div>
        <div class="sep"></div>
        <button type="button" class="lrow" id="setStone" aria-haspopup="dialog">${ICO('<path d="M3 12h2.5l2-5 3 10 3-8 2 3H21"/>')}<span class="nm">${T('setStone')}</span><span class="val" id="setStoneVal"></span>${CHEV}</button>
      </div>
    </div>
    <div class="grp">
      <span>${T('setMore')}</span>
      <div class="card">
        <button type="button" class="lrow" id="setSkin"><span id="setSkinPair"></span><span class="nm">${T('setSkin')}</span><span class="val" id="setSkinVal"></span>${CHEV}</button>
        <div class="sep"></div>
        <button type="button" class="lrow" id="setLang" aria-expanded="false" aria-controls="setLangRow">${ICO('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>')}<span class="nm">${T('setLang')}</span><span class="val" id="setLangVal"></span>${CHEV}</button>
        <div class="langRow" id="setLangRow" role="group" aria-label="Language" hidden></div>
        <div class="sep"></div>
        <button type="button" class="lrow" id="openMsg">${ICO('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>')}<span class="nm">${T('msgBtn')}</span>${CHEV}</button>
      </div>
    </div>
  </div>
  <div class="rsModal" id="mMsg" hidden role="dialog" aria-modal="true" aria-labelledby="mMsgT">
    <div class="box"><div class="grip"></div><div style="display:flex;align-items:center;justify-content:space-between"><h2 id="mMsgT">${T('msgT')}</h2><button type="button" class="icob" data-close aria-label="${T('close')}">${X}</button></div>
      <div class="rform">
        <span class="muted">${T('msgHint')}</span>
        <textarea id="msgText" maxlength="500" rows="5" placeholder="${T('msgPh')}" aria-labelledby="mMsgT"></textarea>
        <input id="msgContact" type="text" maxlength="100" autocomplete="off" placeholder="${T('msgContactPh')}" aria-label="${T('msgContactPh')}">
        <div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn gold" id="msgSend" style="height:44px;flex:1;font-size:16px">${T('msgSend')}</button><span class="muted" id="msgStatus" role="status" style="font-size:13px"></span></div>
      </div>
    </div>
  </div>
  <div class="rsModal" id="mStone" hidden role="dialog" aria-modal="true" aria-labelledby="mStoneT">
    <div class="box"><div class="grip"></div><div style="display:flex;align-items:center;justify-content:space-between"><h2 id="mStoneT">${T('stoneT')}</h2><button type="button" class="icob" data-close aria-label="${T('close')}">${X}</button></div>
      <div class="stoneGrid" id="stoneGrid" role="group" aria-labelledby="mStoneT"></div>
      <span class="muted" id="stoneMute" style="font-size:13px" hidden>${T('muteNow')}</span>
      <button type="button" class="btn gold" data-close style="height:48px;font-size:16px">${T('done')}</button>
    </div>
  </div>`;

  function init(o) {
    if (document.getElementById('rsStyle') === null) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'rsStyle', textContent: css }));
    const overlay = !o.host;
    let root;
    if (overlay) {
      root = document.createElement('div'); root.id = 'rsOverlay'; root.hidden = true; root.className = 'rsx';
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      document.body.appendChild(root);
    } else { root = o.host; root.classList.add('rsx'); }
    const q = (id) => root.querySelector('#' + id);
    const L = () => { const l = o.getLang(); return I18N[l] ? l : 'zh'; };
    const T = (k) => I18N[L()][k] ?? I18N.zh[k] ?? k;
    const stoneKind = () => R.stoneId(store.get('vcfgame.sfx.stone'));
    const vols = () => ({ sfx: clampVol(store.get('vcfgame.vol.sfx'), 70), bgm: clampVol(store.get('vcfgame.vol.bgm'), 30) });
    const closeModals = () => root.querySelectorAll('.rsModal').forEach((m) => { m.hidden = true; });
    const openModal = (id) => { const m = q(id); m.hidden = false; m.querySelector('[data-close]').focus(); };
    let langOpen = false, built = '', stoneCache = '';

    function build() {   // 語言換了才重蓋整頁（文字都在 HTML 裡）；其餘只更新值
      const key = L();
      if (built === key) return;
      const msgText = built && q('msgText') ? q('msgText').value : '', msgContact = built && q('msgContact') ? q('msgContact').value : '';
      built = key;
      root.innerHTML = overlay ? '<div class="rsPage">' + PAGE(T) + '</div>' : PAGE(T);
      if (msgText) q('msgText').value = msgText; if (msgContact) q('msgContact').value = msgContact;
      wire();
    }
    function render() {
      build();
      root.setAttribute('lang', LANGS.find((l) => l[0] === L())[2]);
      const v = vols(), S = window.RushSkin, k = stoneKind();
      q('volSfx').value = v.sfx; q('volSfxN').textContent = v.sfx; q('volBgm').value = v.bgm; q('volBgmN').textContent = v.bgm;
      if (S) {
        const nm = (list, id) => { const it = list.find((x) => x.id === id); return it ? S.name(it, L()) : ''; };
        q('setSkinVal').textContent = nm(S.boards, S.boardId()) + '・' + nm(S.stones, S.stonesId());
        const P = window.RushSkinPicker; q('setSkinPair').innerHTML = P ? P.pair() : '';
      }
      q('setStoneVal').textContent = T('st_' + k);
      q('stoneGrid').innerHTML = R.IDS.map((id) => `<button type="button" data-stone="${id}" aria-pressed="${id === k}">${T('st_' + id)}</button>`).join('');
      q('stoneGrid').querySelectorAll('[data-stone]').forEach((b) => b.onclick = () => {
        store.set('vcfgame.sfx.stone', b.dataset.stone);
        q('stoneGrid').querySelectorAll('[data-stone]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        q('setStoneVal').textContent = T('st_' + b.dataset.stone);
        if (o.onStone) o.onStone(b.dataset.stone);
        if (o.previewStone) o.previewStone(b.dataset.stone);
      });
      q('stoneMute').hidden = !!o.getSound();
      q('setLangVal').textContent = LANGS.find((l) => l[0] === L())[1];
      q('setLangRow').innerHTML = LANGS.map(([c, n, h]) => `<button type="button" lang="${h}" data-lang="${c}" aria-pressed="${c === L()}">${n}</button>`).join('');
      q('setLangRow').querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { o.setLang(b.dataset.lang); render(); });
      q('setLangRow').hidden = !langOpen; q('setLang').setAttribute('aria-expanded', String(langOpen));
    }
    function setVol(kind, raw, dflt) {
      const n = clampVol(raw, dflt);
      q(kind === 'sfx' ? 'volSfxN' : 'volBgmN').textContent = n;
      store.set('vcfgame.vol.' + kind, String(n));
      if (o.unmuteOnVol && n > 0 && !o.getSound() && o.setSound) { o.setSound(true); q('stoneMute').hidden = true; }
      if (o.onVol) o.onVol(kind, n);
    }
    function wire() {
      q('setBack').onclick = () => (overlay ? close() : o.onBack && o.onBack());
      q('setLang').onclick = () => { langOpen = q('setLangRow').hidden; q('setLangRow').hidden = !langOpen; q('setLang').setAttribute('aria-expanded', String(langOpen)); };
      q('setStone').onclick = () => { q('stoneMute').hidden = !!o.getSound(); openModal('mStone'); };
      q('setSkin').onclick = () => { if (window.RushSkinPicker) window.RushSkinPicker.open(); };
      q('volSfx').oninput = (e) => setVol('sfx', e.target.value, 70);
      q('volSfx').onchange = () => { if (o.getSound() && vols().sfx > 0 && o.previewStone) o.previewStone(); };   // 放開時播一聲試聽
      q('volBgm').oninput = (e) => setVol('bgm', e.target.value, 30);
      root.querySelectorAll('.rsModal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; }));
      q('openMsg').onclick = () => { q('msgStatus').textContent = ''; q('msgSend').disabled = false; openModal('mMsg'); };
      q('msgSend').onclick = async () => {
        const text = q('msgText').value.trim();
        if (!text) { q('msgStatus').textContent = T('msgEmpty'); q('msgText').focus(); return; }
        q('msgSend').disabled = true; q('msgStatus').textContent = '';
        try {
          const r = await fetch(o.apiBase + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, contact: q('msgContact').value.trim(), nick: store.get('vcfgame.nick') || '', lang: L() }) });
          if (!r.ok) throw new Error(r.status);
          q('msgText').value = ''; q('msgStatus').textContent = T('msgOk');
        } catch { q('msgStatus').textContent = T('msgFail'); q('msgSend').disabled = false; }
      };
    }
    function open() {
      if (!overlay) return;
      render(); root.hidden = false; q('setBack').focus();
    }
    function close() {
      if (!overlay) return;
      closeModals(); root.hidden = true;
      const ob = typeof o.openBtn === 'function' ? o.openBtn() : o.openBtn;
      if (ob && !ob.hidden && ob.isConnected) ob.focus();
    }
    if (overlay) {
      addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || root.hidden) return;
        if ([...root.querySelectorAll('.rsModal')].some((m) => !m.hidden)) closeModals();
        else if (!document.getElementById('skinPick') || document.getElementById('skinPick').hidden) { if (!document.getElementById('shopPage') || document.getElementById('shopPage').hidden) close(); }
      });
    } else {
      addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
    }
    window.renderSet = render;   // skin-picker.js／棋子圖載入完時重畫用
    if (window.RushSkin) window.RushSkin.onChange(render);
    render();
    return { open, close, render, isOpen: () => overlay && !root.hidden, root };
  }
  window.RushSettings = { init, title: (l) => (I18N[l] || I18N.zh).setT };
})();
