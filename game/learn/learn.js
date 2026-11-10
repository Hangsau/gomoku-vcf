// game/learn/learn.js — Gomoku Rush「VCF 教學」（2026-11-10，W4–W6）
// 一盤棋教學：開場先被打敗→倒帶→換你打；主畫面是 15×15 教學盤（每完成一課落一顆子）；第 4 單元起倒帶課。
// 資料：game/learn/lessons.json（所有盤面已由 tools/check_lessons.py 用引擎驗證）。進度只存本機，不送伺服器、不給修為。
// 依賴 game.html 的全域：move()（引擎判定）、stoneSound()、lang、$。設計稿：docs/design/tutorial-2026-11-10/project/。
(() => {
  'use strict';
  const COLS = 'ABCDEFGHJKLMNOP';
  const KEY = 'vcfgame.learn';
  const UI = {
    zh: { entry: 'VCF 教學', entrySub: '新手從這裡開始', board: '教學盤', placed: '已落 {n} 子・還有 {m} 子', exam: '畢業考', next: '下一子', start: '落下這一子', again: '再上一次這課', soon: '即將推出', soonSub: '這一課還在準備中。', cont: '繼續', nextStep: '下一步', tapBoard: '點棋盤作答', ok: '答對了', no: '再想想', done: '完成', back: '返回', close: '關閉', rewindOne: '倒帶一手', rewindMore: '再倒一手', playFwd: '倒帶完成，正著下一遍', drop: '落下這一子', you: '你', cpu: '電腦', youDef: '你：白（防守）', youAtk: '你：黑（進攻）', lostT: '你輸了', wonT: '你贏了', rw: '倒帶看看', go: '開始', enter: '進入教學盤', firstStone: '這局，是你的第一顆子', firstSub: '每學會一件事，這張棋盤就多一顆子。全部落完的時候，你會看懂它在說什麼。', hint: '提示', unit: '第 {u} 單元', end: '結局', q: '第 {n} 手是什麼？', fwd: '正著下', forced: '它只能擋那裡……', examT: '畢業考', examSub: '這盤棋，是你一路學過來的。現在把它下完。', grad: '畢業了！', gradSub: '你自己解開了一道真正的 VCF。去無限之塔、火眼金睛、明鏡台試試身手吧。', locked: '先完成前面的課' },
    en: { entry: 'VCF Lessons', entrySub: 'New here? Start here', board: 'Lesson Board', placed: '{n} stones placed · {m} to go', exam: 'Final', next: 'Next stone', start: 'Place this stone', again: 'Replay this lesson', soon: 'Coming soon', soonSub: 'This lesson is still being prepared.', cont: 'Continue', nextStep: 'Next', tapBoard: 'Tap the board', ok: 'Correct', no: 'Think again', done: 'Done', back: 'Back', close: 'Close', rewindOne: 'Rewind one move', rewindMore: 'Rewind again', playFwd: 'Now play it forward', drop: 'Place this stone', you: 'You', cpu: 'CPU', youDef: 'You: White (defend)', youAtk: 'You: Black (attack)', lostT: 'You lost', wonT: 'You won', rw: 'Rewind it', go: 'Start', enter: 'Open the Lesson Board', firstStone: 'That game is your first stone', firstSub: 'Each thing you learn adds a stone to this board. When it is full, you will see what it says.', hint: 'Hint', unit: 'Unit {u}', end: 'The ending', q: 'What was move {n}?', fwd: 'Play forward', forced: 'It can only block there…', examT: 'Final', examSub: 'You built this board lesson by lesson. Now finish it.', grad: 'You graduated!', gradSub: 'You solved a real VCF on your own. Try Endless Tower, Fiery Eyes and Mirror Terrace.', locked: 'Finish the earlier lessons first' },
    ja: { entry: 'VCF 教室', entrySub: '初めての方はここから', board: '教室の盤', placed: '{n} 子・あと {m} 子', exam: '卒業試験', next: '次の一子', start: 'この一子を置く', again: 'このレッスンをもう一度', soon: '準備中', soonSub: 'このレッスンは準備中です。', cont: '続ける', nextStep: '次へ', tapBoard: '盤をタップ', ok: '正解', no: 'もう一度', done: '完了', back: '戻る', close: '閉じる', rewindOne: '一手巻き戻す', rewindMore: 'さらに巻き戻す', playFwd: '巻き戻し完了、順に打つ', drop: 'この一子を置く', you: 'あなた', cpu: 'CPU', youDef: 'あなた：白（守り）', youAtk: 'あなた：黒（攻め）', lostT: '負け', wonT: '勝ち', rw: '巻き戻す', go: '開始', enter: '教室の盤へ', firstStone: 'この対局が最初の一子', firstSub: '一つ覚えるたびに、この盤に一子増えます。全部置き終えたとき、その意味が分かります。', hint: 'ヒント', unit: '第 {u} 単元', end: '結末', q: '{n} 手目は？', fwd: '順に打つ', forced: 'そこを止めるしかない……', examT: '卒業試験', examSub: 'この盤はあなたが一つずつ学んで作ったもの。最後まで打ち切ろう。', grad: '卒業！', gradSub: '本物の VCF を自力で解きました。無限の塔・火眼金睛・明鏡台に挑戦しよう。', locked: '先に前のレッスンを' },
    ko: { entry: 'VCF 교실', entrySub: '처음이라면 여기부터', board: '교실 판', placed: '{n}수 놓음 · {m}수 남음', exam: '졸업 시험', next: '다음 수', start: '이 수 놓기', again: '이 레슨 다시', soon: '준비 중', soonSub: '이 레슨은 준비 중입니다.', cont: '계속', nextStep: '다음', tapBoard: '판을 누르세요', ok: '정답', no: '다시 생각해 봐요', done: '완료', back: '돌아가기', close: '닫기', rewindOne: '한 수 되감기', rewindMore: '더 되감기', playFwd: '되감기 끝, 순서대로 두기', drop: '이 수 놓기', you: '나', cpu: 'CPU', youDef: '나: 백(수비)', youAtk: '나: 흑(공격)', lostT: '졌습니다', wonT: '이겼습니다', rw: '되감아 보기', go: '시작', enter: '교실 판으로', firstStone: '이 판이 첫 번째 수', firstSub: '하나 배울 때마다 이 판에 한 수가 늘어납니다. 다 채우면 무슨 뜻인지 알게 됩니다.', hint: '힌트', unit: '{u}단원', end: '결말', q: '{n}번째 수는?', fwd: '순서대로', forced: '거기밖에 막을 수 없어요……', examT: '졸업 시험', examSub: '이 판은 당신이 하나씩 배워 만든 것. 이제 끝까지 두세요.', grad: '졸업!', gradSub: '진짜 VCF를 스스로 풀었습니다. 무한의 탑·화안금정·명경대에 도전해 보세요.', locked: '앞 레슨을 먼저 끝내세요' },
  };
  const L = () => (typeof lang !== 'undefined' && UI[lang]) ? lang : 'zh';
  const U = (k, v) => String(UI[L()][k] ?? UI.zh[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? v[n] : ''));
  const TX = (o) => !o ? '' : (o[L()] || o.zh || '');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const xy = (t) => [COLS.indexOf(t[0]), +t.slice(1) - 1];
  const nm = (x, y) => COLS[x] + (y + 1);
  const snd = (soft) => { try { if (typeof stoneSound === 'function') stoneSound(soft); } catch {} };
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} } };

  // ---------- 樣式（一屏不捲動；動畫照設計稿，codex 逐格圖之後替換） ----------
  const css = `
#learn{position:fixed;inset:0;z-index:40;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden;font-family:inherit}
#learn[hidden]{display:none}
#learn .lbar{flex:none;display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 12px 6px}
#learn .lbar b{flex:1;font-size:17px;font-weight:900;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#learn .lchip{height:28px;padding:0 10px;border-radius:14px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
#learn .lbody{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;padding:0 12px;gap:10px}
#learn .lbrd{position:relative;flex:none;border-radius:14px;background:#E9C98B;box-shadow:0 7px 0 #9C7A45,0 12px 28px rgba(0,0,0,.45);touch-action:manipulation}
#learn .lbrd svg.grid{position:absolute;inset:0}
#learn .lst{position:absolute;border-radius:50%;pointer-events:none;box-shadow:inset -3px -4px 0 rgba(0,0,0,.18),0 2px 3px rgba(0,0,0,.35)}
#learn .lst.b{background:#1B1A17}#learn .lst.w{background:#FBFAF6}
#learn .lst .n{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--num);font-weight:700}
#learn .lst.b .n{color:#FBFAF6}#learn .lst.w .n{color:#1B1A17}
#learn .lhit{position:absolute;border:0;padding:0;background:transparent;border-radius:50%;cursor:pointer}
#learn .lmsg{flex:none;width:100%;max-width:520px;box-sizing:border-box;border-radius:18px;background:var(--panel);border:1px solid var(--line);padding:12px 15px;min-height:96px}
#learn .lmsg .tag{display:block;font-size:13px;font-weight:700;color:var(--gold)}
#learn .lmsg .tx{display:block;margin-top:4px;font-size:16px;line-height:1.5}
#learn .lmsg.good{background:#12201F;border-color:#2C6B62}#learn .lmsg.good .tag{color:var(--teal)}
#learn .lmsg.bad{background:#2A1716;border-color:#6B2E28}#learn .lmsg.bad .tag{color:var(--fail)}
#learn .lfoot{flex:none;display:flex;gap:10px;padding:8px 12px calc(14px + env(safe-area-inset-bottom));width:100%;max-width:544px;box-sizing:border-box;align-self:center}
#learn .lbtn{flex:1;height:58px;border-radius:18px;border:0;background:var(--gold);color:var(--goldInk);font-size:19px;font-weight:900;box-shadow:0 5px 0 #8A6420;display:flex;align-items:center;justify-content:center;gap:8px}
#learn .lbtn:disabled{background:var(--panel2);color:#8E95A6;box-shadow:none}
#learn .lbtn.teal{background:var(--teal);color:var(--tealInk);box-shadow:0 5px 0 #1C7F72}
#learn .lbtn.ghost{background:transparent;border:1px solid var(--line2);color:var(--text);box-shadow:none;font-size:16px;font-weight:700}
#learn .lopts{display:flex;flex-direction:column;gap:8px;width:100%;max-width:520px}
#learn .lopt{min-height:52px;border-radius:14px;border:1px solid var(--line2);background:var(--panel);color:var(--text);font-size:16px;text-align:left;padding:10px 14px}
#learn .lopt.ok{border-color:var(--teal);background:#12201F}#learn .lopt.ng{border-color:var(--fail);background:#2A1716}
#learn .tape{position:relative;flex:none;width:100%;max-width:520px;height:40px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}
#learn .tape i{position:absolute;top:8px;width:24px;height:24px;border-radius:50%;box-sizing:border-box;font-style:normal;font-family:var(--num);font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;transition:opacity .3s}
#learn .tape .head{position:absolute;top:-4px;width:4px;height:48px;border-radius:2px;background:var(--fail);box-shadow:0 0 8px var(--fail);transition:left .35s cubic-bezier(.3,.7,.3,1)}
#learn .lcard{width:100%;max-width:520px;box-sizing:border-box;border-radius:18px;background:var(--panel);border:1px solid #2C6B62;padding:12px 14px}
#learn .lcard b{display:block;font-size:19px;margin-top:4px}#learn .lcard > span:not(.lchip){display:block;font-size:14px;color:var(--text2);margin-top:4px;line-height:1.5}
#learn .lscan{position:absolute;inset:0;border-radius:14px;pointer-events:none;background-color:rgba(20,30,50,.3);background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 2px,transparent 2px 6px);animation:lscan .3s linear infinite}
@keyframes lscan{to{background-position:0 12px}}
@keyframes ldrop{0%{transform:translateY(-46px) scale(1.5);opacity:0}38%{transform:translateY(-8px) scale(1.12);opacity:1}55%{transform:translateY(0) scale(1.22,.74)}68%{transform:translateY(-5px) scale(.9,1.12)}80%{transform:translateY(0) scale(1.06,.94)}90%{transform:translateY(-1px) scale(.98,1.02)}100%{transform:none}}
@keyframes lripple{0%{transform:scale(.6);opacity:.8}100%{transform:scale(2.4);opacity:0}}
@keyframes llift{0%{transform:none;opacity:1}30%{transform:translateY(4px) scale(1.15,.85)}100%{transform:translateY(-70px) scale(.5) rotate(-40deg);opacity:0}}
@keyframes lglow{0%,100%{transform:scale(.8);opacity:.45}50%{transform:scale(1.15);opacity:1}}
@keyframes llit{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1.06)}}
@keyframes lbeam{from{transform:rotate(var(--a)) scaleX(0)}to{transform:rotate(var(--a)) scaleX(1)}}
@keyframes lquake{0%,100%{transform:none}15%{transform:translate(-7px,3px) rotate(-1deg)}30%{transform:translate(6px,-4px) rotate(1deg)}45%{transform:translate(-5px,2px)}60%{transform:translate(4px,-2px)}80%{transform:translate(-2px,1px)}}
@keyframes lno{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
@keyframes lflipA{to{transform:perspective(900px) rotateY(90deg)}}
@keyframes lflipB{from{transform:perspective(900px) rotateY(-90deg)}70%{transform:perspective(900px) rotateY(8deg)}to{transform:none}}
@keyframes lthread{from{stroke-dashoffset:520}to{stroke-dashoffset:0}}
@keyframes ltravel{from{offset-distance:0%;transform:scale(.6)}to{offset-distance:100%;transform:scale(1)}}
@keyframes lbeacon{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.6);opacity:0}}
@keyframes lcore{0%,100%{transform:scale(.85)}50%{transform:scale(1.1)}}
@keyframes lbreath{0%,100%{box-shadow:0 0 0 1.5px rgba(242,181,68,.35)}50%{box-shadow:0 0 0 2.5px rgba(242,181,68,.85)}}
@keyframes lmsg{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
@keyframes lpull{0%{transform:scale(3);opacity:.2}60%{opacity:1}100%{transform:none;opacity:1}}
@keyframes lhalo{0%{transform:scale(1);opacity:.9}100%{transform:scale(3);opacity:0}}
@keyframes lstamp{0%{transform:scale(2.4) rotate(-24deg);opacity:0}60%{transform:scale(.92) rotate(-12deg);opacity:1}100%{transform:scale(1) rotate(-12deg);opacity:1}}
#learn .a-drop{animation:ldrop .55s cubic-bezier(.3,.7,.4,1) both}
#learn .a-lift{animation:llift .26s ease-in both}
#learn .a-lit{animation:llit .5s ease-out both}
#learn .a-quake{animation:lquake .5s ease-out .5s}
#learn .a-no{animation:lno .35s ease-out}
#learn .a-flipA{animation:lflipA .32s ease-in both}
#learn .a-flipB{animation:lflipB .5s ease-out both}
#learn .a-msg{animation:lmsg .25s ease-out both}
#learn .a-pull{animation:lpull 1s cubic-bezier(.2,.8,.2,1) both}
#learn .a-breath{animation:lbreath 3.2s ease-in-out infinite}
#learn .ripple{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(91,69,36,.6);animation:lripple .55s ease-out .2s both}
#learn .glow{position:absolute;border-radius:50%;border:3px dashed;box-sizing:border-box;pointer-events:none;animation:lglow 1s ease-in-out infinite}
#learn .beam{position:absolute;height:10px;border-radius:5px;transform-origin:5px 5px;pointer-events:none;animation:lbeam .5s ease-out .45s both}
#learn .ring{position:absolute;border-radius:50%;border:3px dashed #FBFAF6;box-sizing:border-box;pointer-events:none;animation:lglow 1.4s ease-in-out infinite}
#learn .xmark{position:absolute;pointer-events:none;color:var(--fail)}
#learn .travel{position:absolute;left:0;top:0;border-radius:50%;background:#FBFAF6;box-shadow:0 0 0 3px #3CC6B4,0 6px 10px rgba(0,0,0,.4);offset-rotate:0deg;offset-anchor:50% 50%;animation:ltravel .5s cubic-bezier(.5,0,.3,1) .25s both;pointer-events:none}
#learn .thread{stroke-dasharray:520;animation:lthread .35s ease-out both}
#learn .beacon{position:absolute;pointer-events:none}
#learn .beacon i{position:absolute;inset:0;border-radius:50%;border:2px solid #3CC6B4;animation:lbeacon 1.8s ease-out infinite}
#learn .beacon b{position:absolute;inset:25%;border-radius:50%;background:#3CC6B4;box-shadow:0 0 12px #3CC6B4;animation:lcore 1.2s ease-in-out infinite}
#learn .stamp{position:absolute;right:-6px;top:-16px;width:84px;height:84px;border-radius:14px;border:4px solid #D64B3C;color:#D64B3C;background:rgba(255,236,230,.88);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:28px;pointer-events:none;animation:lstamp .4s cubic-bezier(.2,.9,.3,1.1) both}
#learn .halo{position:absolute;border-radius:50%;border:2px solid var(--gold);animation:lhalo 1.4s ease-out 1.2s infinite}
`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---------- 外框 ----------
  const root = document.createElement('div'); root.id = 'learn'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  document.body.appendChild(root);
  let DATA = null, run = 0;   // run：每換一個畫面 +1，舊畫面的計時器看到就停
  const load = async () => DATA || (DATA = await fetch('game/learn/lessons.json?v=' + (typeof BUILD !== 'undefined' ? BUILD : Date.now())).then(r => r.json()));
  const svgIco = (d, fill) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const IC = { x: 'M6 6l12 12M18 6L6 18', back: 'M15 18l-6-6 6-6', play: 'M8 5v14l11-7z', rew: 'M11 6v12L2 12zM21 6v12l-9-6z', trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8', redo: 'M3 12a9 9 0 1 0 3-6.7M3 3v5h5' };
  function frame(title, chip) {
    root.innerHTML = `<div class="lbar"><button type="button" class="icob" data-x aria-label="${U('close')}">${svgIco(IC.x)}</button><b>${title}</b>${chip || ''}</div><div class="lbody"></div><div class="lfoot"></div>`;
    root.querySelector('[data-x]').onclick = () => close();
    return { body: root.querySelector('.lbody'), foot: root.querySelector('.lfoot') };
  }
  function close() {
    run++; root.hidden = true; root.innerHTML = '';
    if (history.state && history.state.learn) history.back();
  }
  addEventListener('popstate', () => { if (!root.hidden) { run++; root.hidden = true; root.innerHTML = ''; } });

  // ---------- codex 逐格圖集（2026-11-10 W7）：4×4 圖集逐格硬切播放；沒載到就用上面的 CSS 動畫 ----------
  // manifest.json 由 tools/art_build.py 產生：anchor＝主體中心相對格心偏移、size＝主體寬／格寬
  let ART = null, artP = null;
  const loadArt = () => artP || (artP = fetch('game/learn/art/manifest.json?v=' + (typeof BUILD !== 'undefined' ? BUILD : Date.now())).then(r => r.ok ? r.json() : null).then(m => {
    ART = m;
    if (m) Object.values(m).forEach(s => { const i = new Image(); i.src = 'game/learn/art/' + s.file; });   // 打開教學才載（約 3 MB），先載好第一次播放不閃
  }).catch(() => {}));
  const FRAME_MS = 42;
  // host：疊在誰上面；cx,cy：主體中心要對準的位置（px）；body：主體要多寬（px）；opt.full＝整張蓋滿 host（特效層）
  function sprite(host, name, cx, cy, body, opt = {}) {
    const s = ART && ART[name];
    if (!s) return null;
    const cell = opt.full ? Math.max(host.clientWidth, host.clientHeight) : body / s.size;
    const el = document.createElement('div');
    const left = opt.full ? 0 : cx - cell / 2 - s.anchor[0] * cell, top = opt.full ? 0 : cy - cell / 2 - s.anchor[1] * cell;
    el.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${opt.full ? host.clientWidth : cell}px;height:${opt.full ? host.clientHeight : cell}px;pointer-events:none;background:url('game/learn/art/${s.file}') no-repeat;background-size:${s.cols * 100}% ${s.rows * 100}%;z-index:${opt.z || 3};${opt.rot ? `transform:rotate(${opt.rot}deg)` : ''}`;
    host.appendChild(el);
    let k = 0;
    const show = () => { const c = k % s.cols, r = Math.floor(k / s.cols); el.style.backgroundPosition = `${c * 100 / (s.cols - 1)}% ${r * 100 / (s.rows - 1)}%`; };
    show();
    const done = new Promise(res => {
      const tick = setInterval(() => {
        k++;
        if (k >= s.frames) { if (opt.loop) k = 0; else { clearInterval(tick); if (!opt.keep) el.remove(); res(); return; } }
        show();
      }, opt.ms || FRAME_MS);
      el._stop = () => { clearInterval(tick); el.remove(); res(); };
    });
    el.done = done;
    return el;
  }

  // ---------- 棋盤（9×9 局部或 15×15 全盤） ----------
  // opts: { win:'D3'|null, n:9|15, size }，回傳物件可以放子、標記、接點擊
  function makeBoard(host, win, n) {
    const ox = win ? xy(win)[0] : 0, oy = win ? xy(win)[1] : 0;
    const el = document.createElement('div'); el.className = 'lbrd';
    host.appendChild(el);
    const B = { el, n, ox, oy, size: 0, cell: 0, m: 0, stones: new Map(), onTap: null };
    B.fit = (avail) => {
      // 盤邊標座標（2026-11-10 使用者：9×9 局部盤沒標字母數字，叫人找 H8 根本找不到）：下緣字母、左緣數字
      const s = Math.max(220, Math.min(avail, 520)); B.size = s; B.m = Math.max(Math.round(s / (n * 2)), 20); B.cell = (s - 2 * B.m) / (n - 1);
      el.style.width = el.style.height = s + 'px';
      let lines = '', labels = '';
      const fs = Math.max(9, Math.min(12, Math.round(B.cell * 0.42)));
      for (let i = 0; i < n; i++) {
        const p = Math.round(B.m + i * B.cell) + .5; lines += `<line x1="${B.m}" y1="${p}" x2="${s - B.m}" y2="${p}"/><line x1="${p}" y1="${B.m}" x2="${p}" y2="${s - B.m}"/>`;
        labels += `<text x="${p}" y="${s - B.m + fs + 4}" text-anchor="middle">${COLS[ox + i]}</text><text x="${B.m - 6}" y="${p + fs * .36}" text-anchor="end">${oy + n - i}</text>`;
      }
      const star = n === 15 ? ['D4', 'D12', 'L4', 'L12', 'H8'].map(t => { const [x, y] = xy(t); return `<circle cx="${B.m + x * B.cell}" cy="${B.m + (14 - y) * B.cell}" r="3"/>`; }).join('') : '';
      el.innerHTML = `<svg class="grid" width="${s}" height="${s}" aria-hidden="true"><g stroke="#5B4524" stroke-width="1">${lines}</g><g fill="#5B4524">${star}</g><g fill="#7A5E36" font-size="${fs}" font-family="var(--num)" font-weight="700">${labels}</g></svg>`;
      B.layer = document.createElement('div'); B.layer.style.cssText = 'position:absolute;inset:0'; el.appendChild(B.layer);
      B.hits = document.createElement('div'); B.hits.style.cssText = 'position:absolute;inset:0'; el.appendChild(B.hits);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const t = nm(ox + c, oy + n - 1 - r), [px, py] = B.px(t), h = document.createElement('button');
        h.type = 'button'; h.className = 'lhit'; h.setAttribute('aria-label', t);
        const d = B.cell; h.style.cssText = `left:${px - d / 2}px;top:${py - d / 2}px;width:${d}px;height:${d}px`;
        h.onclick = () => B.onTap && B.onTap(t);
        B.hits.appendChild(h);
      }
      B.stones = new Map();
    };
    B.px = (t) => { const [x, y] = xy(t); return [B.m + (x - ox) * B.cell, B.m + (oy + n - 1 - y) * B.cell]; };
    B.put = (t, color, o = {}) => {
      B.take(t, true);
      const [px, py] = B.px(t), d = B.cell * 0.88, s = document.createElement('div');
      s.className = 'lst ' + color + (o.anim === false ? '' : ' a-drop') + (o.cls ? ' ' + o.cls : '');
      s.style.cssText = `left:${px - d / 2}px;top:${py - d / 2}px;width:${d}px;height:${d}px`;
      if (o.num) s.innerHTML = `<span class="n" style="font-size:${Math.round(d * .5)}px">${o.num}</span>`;
      B.layer.appendChild(s); B.stones.set(t, { el: s, color });
      if (o.anim !== false) {
        snd(color === 'w');
        const sp = sprite(B.layer, color === 'b' ? 'drop_black' : 'drop_white', px, py, d);
        if (sp) { s.classList.remove('a-drop'); s.style.opacity = 0; sp.done.then(() => { s.style.opacity = ''; }); }   // 逐格圖播完才換成真的子
        else { const rp = document.createElement('div'); rp.className = 'ripple'; s.appendChild(rp); }
      }
      return s;
    };
    B.take = (t, silent) => {
      const s = B.stones.get(t); if (!s) return; B.stones.delete(t);
      if (silent) { s.el.remove(); return; }
      const [px, py] = B.px(t), sp = sprite(B.layer, s.color === 'b' ? 'lift_black' : 'lift_white', px, py, B.cell * 0.88);
      if (sp) { s.el.remove(); return; }
      s.el.className = s.el.className.replace(' a-drop', '') + ' a-lift'; setTimeout(() => s.el.remove(), 280);
    };
    B.has = (t) => B.stones.has(t);
    B.mark = (cls, t, html, extra) => { const [px, py] = B.px(t), d = B.cell * 0.92, m = document.createElement('div'); m.className = cls; m.style.cssText = `left:${px - d / 2}px;top:${py - d / 2}px;width:${d}px;height:${d}px;${extra || ''}`; if (html) m.innerHTML = html; B.layer.appendChild(m); return m; };
    B.glow = (t, color) => B.mark('glow', t, '', `border-color:${color}`);
    B.clearMarks = () => B.layer.querySelectorAll('.glow,.ring,.xmark,.beam,.beacon,.travelsvg,.travel,.stamp').forEach(e => (e._stop ? e._stop() : e.remove()));
    B.cross = (t) => {   // 答錯：毛筆叉（逐格圖，停在最後一格）
      const [px, py] = B.px(t), sp = sprite(B.layer, 'brush_x', px, py, B.cell * 0.9, { keep: true });
      if (sp) { sp.classList.add('xmark'); return sp; }
      return B.mark('xmark', t, `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" fill="none"/></svg>`);
    };
    B.shake = () => { el.classList.remove('a-no'); void el.offsetWidth; el.classList.add('a-no'); };
    B.beam = (a, b, color) => {
      const [x1, y1] = B.px(a), [x2, y2] = B.px(b), w = Math.hypot(x2 - x1, y2 - y1) + 10, ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const m = document.createElement('div'); m.className = 'beam'; m.style.cssText = `left:${x1 - 5}px;top:${y1 - 5}px;width:${w}px;background:${color};box-shadow:0 0 16px ${color};--a:${ang}deg`; B.layer.appendChild(m);
    };
    B.thread = async (t, color) => {   // 木偶線：從右上角拉一條線到擋點，子沿線被拖過去
      const [tx, ty] = B.px(t), sx = B.size + 2, sy = -40, d = `M ${sx} ${sy} Q ${Math.round((sx + tx) / 2 + 40)} ${Math.round((sy + ty) / 2 - 40)} ${tx} ${ty}`;
      const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('class', 'travelsvg'); sv.setAttribute('width', B.size); sv.setAttribute('height', B.size); sv.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none';
      sv.innerHTML = `<path class="thread" d="${d}" fill="none" stroke="#3CC6B4" stroke-width="2.5" stroke-linecap="round"/>`; B.layer.appendChild(sv);
      const dd = B.cell * 0.88, tr = document.createElement('div'); tr.className = 'travel'; tr.style.cssText = `width:${dd}px;height:${dd}px;offset-path:path('${d}');background:${color === 'b' ? '#1B1A17' : '#FBFAF6'}`; B.layer.appendChild(tr);
      await sleep(780); sv.remove(); tr.remove(); B.put(t, color);
    };
    B.five = (pts, good) => {   // 連成五：依序點亮＋光束＋震動
      const c = good ? 'rgba(242,181,68,.6)' : 'rgba(255,122,107,.6)';
      // 橫、直的五：用逐格圖（金＝黑子五連、紅＝白子五連；圖裡的子顏色要對得上才用）
      if (pts.length === 5) {
        const s0 = B.stones.get(pts[0]), [x1, y1] = B.px(pts[0]), [x2, y2] = B.px(pts[4]);
        // 金色圖是黑子、紅色圖是白子：顏色和輸贏都對得上才用圖（例如開場黑子五連是「你輸了」，要紅光，用 CSS）
        const name = s0 && (good && s0.color === 'b' ? 'five_gold' : !good && s0.color === 'w' ? 'five_red' : null), horiz = y1 === y2, vert = x1 === x2;
        if (name && (horiz || vert) && ART && ART[name]) {
          const sp = sprite(B.layer, name, (x1 + x2) / 2, (y1 + y2) / 2, 4 * B.cell + B.cell * 0.88, { keep: true, rot: vert ? 90 : 0, z: 4 });
          if (sp) { sp.classList.add('fxk'); el.classList.remove('a-quake'); void el.offsetWidth; el.classList.add('a-quake'); return; }
        }
      }
      pts.forEach((t, i) => { const s = B.stones.get(t); if (s) { s.el.style.animationDelay = (i * .12) + 's'; s.el.classList.remove('a-drop'); s.el.classList.add('a-lit'); s.el.style.boxShadow = `0 0 0 3px ${c}`; } });
      B.beam(pts[0], pts[pts.length - 1], c);
      el.classList.remove('a-quake'); void el.offsetWidth; el.classList.add('a-quake');
    };
    B.unfive = () => {   // 清掉連五的光線、圖集與點亮（倒帶前用；2026-11-10 使用者：倒帶後紅線還在）
      B.layer.querySelectorAll('.beam,.fxk').forEach(e => (e._stop ? e._stop() : e.remove()));
      B.layer.querySelectorAll('.a-lit').forEach(e => { e.classList.remove('a-lit'); e.style.boxShadow = ''; e.style.animationDelay = ''; });
      el.classList.remove('a-quake');
    };
    return B;
  }
  function fiveLine(stones, last) {   // stones：Set(座標)，找最後一手連成的五
    const [x, y] = xy(last);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const run_ = [last];
      for (let k = 1; stones.has(nm(x + dx * k, y + dy * k)); k++) run_.push(nm(x + dx * k, y + dy * k));
      for (let k = 1; stones.has(nm(x - dx * k, y - dy * k)); k++) run_.unshift(nm(x - dx * k, y - dy * k));
      if (run_.length >= 5) return run_.slice(0, 5);
    }
    return [last];
  }
  // 版面：量出棋盤能用多大（扣掉上方欄、訊息卡、下方按鈕），一屏放得下
  function boardSize(extra = 0) {
    const w = Math.min(root.clientWidth, 544) - 24, h = root.clientHeight - 60 - 116 - 86 - extra - 10;
    return Math.floor(Math.min(w, h));
  }
  function msg(body, tag, text, kind) {
    let m = body.querySelector('.lmsg');
    if (!m) { m = document.createElement('div'); m.className = 'lmsg'; body.appendChild(m); }
    m.className = 'lmsg a-msg' + (kind ? ' ' + kind : '');
    m.innerHTML = `<span class="tag"></span><span class="tx"></span>`;
    m.querySelector('.tag').textContent = tag || ''; m.querySelector('.tx').textContent = text || '';
    void m.offsetWidth;
    return m;
  }
  function button(foot, label, cls, onClick, ico) {
    foot.innerHTML = '';
    if (!label) return null;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lbtn' + (cls ? ' ' + cls : '');
    b.innerHTML = (ico ? svgIco(ico, ico === IC.play || ico === IC.rew) : '') + '<span></span>'; b.querySelector('span').textContent = label;   // 播放、倒帶是實心三角；獎盃、重來是線條
    if (onClick) b.onclick = onClick; else b.disabled = true;
    foot.appendChild(b); return b;
  }

  // ---------- 進度 ----------
  const prog = () => store.get();
  const saveDone = (id) => { const p = prog(); p.done = Array.from(new Set([...(p.done || []), id])); store.set(p); };
  const isDone = (id) => (prog().done || []).includes(id);

  // ---------- 入口：首頁「挑戰」上方插一張教學卡（還沒看過開場的人多一行「新手從這裡開始」） ----------
  const entry = document.createElement('button'); entry.type = 'button'; entry.id = 'toLearn'; entry.className = 'mode slim';
  entry.style.cssText = 'border-color:#3CC6B4;border-style:dashed;min-height:84px';
  const entryLabel = () => {
    entry.innerHTML = `<span class="big" style="color:#3CC6B4"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><circle cx="15" cy="9" r="2.2" fill="currentColor"/></svg></span><span class="tx"><b></b><span></span></span>`;
    entry.querySelector('b').textContent = U('entry');
    entry.querySelector('.tx span').textContent = prog().opening ? '' : U('entrySub');
  };
  const pick = document.getElementById('toPick');
  if (pick && pick.parentNode) { pick.parentNode.insertBefore(entry, pick); entryLabel(); }
  new MutationObserver(entryLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  entry.onclick = () => open();

  async function open() {
    root.hidden = false; history.pushState({ learn: 1 }, '');
    root.innerHTML = '';
    loadArt();
    await load();
    if (!prog().opening) return opening(); else return boardScreen();
  }
  window.openLearn = open;

  // ---------- 開場：先被打敗，再換你打 ----------
  async function opening() {
    const my = ++run, O = DATA.opening, pos = O.pos;
    const chip = (atk) => `<span class="lchip" data-role style="background:${atk ? '#1F3B39' : '#3D1F1F'};color:${atk ? '#3CC6B4' : '#FFB3A8'}">${U(atk ? 'youAtk' : 'youDef')}</span>`;
    let f = frame('', chip(false));
    let B = makeBoard(f.body, pos.win, 9); B.fit(boardSize());
    pos.b.forEach(t => B.put(t, 'b', { anim: false })); pos.w.forEach(t => B.put(t, 'w', { anim: false }));
    const line = O.line, five = O.five, alive = () => my === run;
    const atkMoves = line.filter((_, i) => i % 2 === 0), defMoves = line.filter((_, i) => i % 2 === 1);
    msg(f.body, '', TX({ zh: '你是白棋。黑要攻過來了……', en: 'You are White. Black is coming at you…', ja: 'あなたは白。黒が攻めてくる……', ko: '당신은 백. 흑이 공격해 옵니다……' }));
    button(f.foot, '');
    const played = [];   // 依序記下落子，倒帶用
    const put = (t, c) => { B.put(t, c); played.push(t); };
    await sleep(1100); if (!alive()) return;
    // 前半：電腦（黑）照手順攻，你（白）擋
    for (let i = 0; i < atkMoves.length; i++) {
      put(atkMoves[i], 'b');
      const last = i === atkMoves.length - 1, want = last ? five : [defMoves[i]];
      want.forEach(t => B.glow(t, '#FF7A6B'));
      msg(f.body, TX([{ zh: '擋住！', en: 'Block it!', ja: '止めて！', ko: '막으세요!' }, { zh: '又來了！', en: 'Again!', ja: 'また来た！', ko: '또 왔어요!' }, { zh: '兩頭都是洞', en: 'Open at both ends', ja: '両端が空いた', ko: '양쪽이 뚫렸다' }][Math.min(i, 2)]), [
        TX({ zh: '黑衝四了，只差紅圈那一點就連成五。', en: 'Black made a four. One more at the red ring and it is five.', ja: '黒が四を作った。赤い輪の一点で五になる。', ko: '흑이 사를 만들었습니다. 빨간 원 한 점이면 오목.' }),
        TX({ zh: '這一手同時做出四和三。先擋四，不然馬上輸。', en: 'This move makes a four and a three at once. Block the four first.', ja: 'この一手で四と三を同時に。まず四を止めて。', ko: '이 한 수로 사와 삼을 동시에. 먼저 사를 막으세요.' }),
        TX({ zh: '三變成活四了：兩頭都能成五。你只有一手。', en: 'The three became an open four: both ends make five. You get one move.', ja: '三が活四に。両端で五になる。あなたは一手だけ。', ko: '삼이 활사가 됐습니다. 양쪽 다 오목. 한 수뿐입니다.' })][Math.min(i, 2)], 'bad');
      const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
      B.onTap = null; B.clearMarks(); if (!alive()) return;
      put(t, 'w');
      await sleep(700); if (!alive()) return;
      if (!last && t !== defMoves[i]) { put(defMoves[i], 'b'); break; }   // 沒擋到：黑直接連五
      if (last) { put(five.find(p => p !== t) || five[0], 'b'); break; }
    }
    const blackSet = new Set([...pos.b, ...played.filter(t => B.stones.get(t) && B.stones.get(t).color === 'b')]);
    B.five(fiveLine(blackSet, played[played.length - 1]), false);
    msg(f.body, U('lostT'), TX({ zh: '可是回頭看：你每一手都只能擋那裡，根本沒得選。', en: 'But look back: every move, you could only block that one spot. You never had a choice.', ja: 'でも振り返ると、毎手そこを止めるしかなかった。選択肢はなかった。', ko: '돌아보면 매번 그곳밖에 막을 수 없었습니다. 선택지가 없었죠.' }), 'bad');
    await new Promise(res => button(f.foot, U('rw'), '', res, IC.redo));
    if (!alive()) return;
    // 倒帶：一顆顆拎走，掃描線
    button(f.foot, ''); B.clearMarks(); B.unfive();
    const scan = sprite(B.el, 'rewind_fx', 0, 0, 0, { full: true, loop: true, z: 6 }) || Object.assign(document.createElement('div'), { className: 'lscan' });
    if (!scan.parentNode) B.el.appendChild(scan);
    msg(f.body, '', TX({ zh: '倒帶……', en: 'Rewinding…', ja: '巻き戻し中……', ko: '되감는 중……' }));
    for (let k = played.length - 1; k >= 0; k--) { B.take(played[k]); await sleep(300); if (!alive()) return; }
    scan._stop ? scan._stop() : scan.remove();
    B.el.classList.add('a-flipA'); await sleep(330); B.el.classList.remove('a-flipA'); B.el.classList.add('a-flipB');
    const role = root.querySelector('[data-role]'); role.textContent = U('youAtk'); role.style.background = '#1F3B39'; role.style.color = '#3CC6B4';
    msg(f.body, '', TX({ zh: '換你了。換到對面：剛才逼你的那串棋，這次由你來下。', en: 'Your turn. Switch sides: play the same moves that just beat you.', ja: '交代。席を替えて、さっきあなたを追い詰めた手順を、今度はあなたが打つ。', ko: '이제 당신 차례. 자리를 바꿔, 방금 당신을 몰아붙인 수순을 직접 두세요.' }), 'good');
    await new Promise(res => button(f.foot, U('go'), 'teal', res, IC.play));
    if (!alive()) return; button(f.foot, '');
    // 後半：你（黑）照手順攻，電腦（白）被木偶線拖去擋
    const acc = O.accept || {};
    const tips = [
      { zh: '先衝一個四：下一顆子做出四，它就只能擋一個地方。', en: 'Start with a four: it can only block one spot.', ja: 'まず四を作る。相手は一点しか止められない。', ko: '먼저 사를 만드세요. 상대는 한 곳만 막을 수 있습니다.' },
      { zh: '看那條線：它只能擋那裡。再來，一子同時做出四和三。', en: 'See the string? It had to block there. Now make a four and a three at once.', ja: '糸を見て。そこを止めるしかない。次は四と三を同時に。', ko: '실을 보세요. 거기밖에 못 막아요. 이제 사와 삼을 동시에.' },
      { zh: '它又只能擋四。現在把三變成兩頭都能成五的活四！', en: 'It had to block the four again. Now turn the three into an open four!', ja: 'また四を止めるしかない。三を活四に！', ko: '또 사를 막을 수밖에. 이제 삼을 활사로!' },
    ];
    const blackNow = new Set(pos.b);
    for (let i = 0; i < atkMoves.length; i++) {
      const ok = acc[String(i)] || [atkMoves[i]];
      ok.forEach(t => B.glow(t, '#3CC6B4'));
      msg(f.body, '', TX(tips[Math.min(i, tips.length - 1)]));
      let t;
      while (true) {
        t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
        if (!alive()) return;
        if (ok.includes(t)) break;
        B.shake(); msg(f.body, U('no'), TX({ zh: '不是這裡，看發光的點。', en: 'Not there. Look for the glowing point.', ja: 'そこじゃない。光っている点を見て。', ko: '거기가 아니에요. 빛나는 점을 보세요.' }), 'bad');
      }
      B.onTap = null; B.clearMarks(); B.put(t, 'b'); blackNow.add(t);
      await sleep(450); if (!alive()) return;
      msg(f.body, '', U('forced'));
      const blk = i < atkMoves.length - 1 ? defMoves[i] : five[0];
      await B.thread(blk, 'w'); if (!alive()) return;
    }
    B.glow(five[1], '#3CC6B4');
    msg(f.body, '', TX({ zh: '它只擋得了一頭。連成五！', en: 'It can only block one end. Make five!', ja: '片方しか止められない。五にしよう！', ko: '한쪽밖에 못 막아요. 오목을 만드세요!' }));
    while (true) {
      const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
      if (!alive()) return;
      if (t === five[1]) { B.onTap = null; B.clearMarks(); B.put(t, 'b'); blackNow.add(t); B.five(fiveLine(blackNow, t), true); break; }
      B.shake();
    }
    msg(f.body, U('wonT'), TX({ zh: '剛才逼你的，現在換你逼它。這種一路衝四、對手只能跟著擋的贏法，叫 VCF。', en: 'What forced you now forces it. Winning by four after four while the opponent can only block is called VCF.', ja: 'さっき追い詰められた手で、今度は追い詰めた。四を連続して相手に止めさせ続ける勝ち方を VCF と呼ぶ。', ko: '당신을 몰아붙인 수로 이번엔 상대를 몰아붙였습니다. 사를 계속 만들어 상대가 막기만 하게 하는 승리법을 VCF라고 합니다.' }), 'good');
    await new Promise(res => button(f.foot, U('cont'), '', res));
    if (!alive()) return;
    const p = prog(); p.opening = true; store.set(p);
    // 拉遠：這局變成教學盤上第一顆子
    f = frame(U('board'));
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:12px';
    f.body.appendChild(wrap);
    const BB = makeBoard(wrap, null, 15); BB.fit(Math.min(boardSize(-40), 360)); BB.el.classList.add('a-pull');
    const first = DATA.board.order[0];
    setTimeout(() => {   // 第一顆子從天而降：金色光暈（逐格圖），沒有圖就用 CSS
      if (!alive()) return;
      const [px, py] = BB.px(first.t), sp = sprite(BB.layer, 'land_gold', px, py, BB.cell * 0.88);
      if (sp) { const s = BB.put(first.t, first.c, { anim: false, cls: 'a-breath' }); s.style.opacity = 0; sp.done.then(() => { s.style.opacity = ''; }); }
      else { BB.put(first.t, first.c, { cls: 'a-breath' }); BB.mark('halo', first.t); }
    }, 900);
    const t1 = document.createElement('b'); t1.style.cssText = 'font-size:21px;text-align:center'; t1.textContent = U('firstStone');
    const t2 = document.createElement('span'); t2.style.cssText = 'font-size:15px;color:var(--text2);text-align:center;line-height:1.6;max-width:320px'; t2.textContent = U('firstSub');
    wrap.append(t1, t2);
    button(f.foot, U('enter'), '', () => boardScreen());
  }

  // ---------- 教學盤主畫面 ----------
  function boardScreen() {
    const my = ++run, bd = DATA.board, order = bd.order, lessons = DATA.lessons;
    const byId = Object.fromEntries(lessons.map(l => [l.id, l]));
    const doneSet = new Set(prog().done || []);
    const placedN = order.filter(o => o.lesson === 'opening' || doneSet.has(o.lesson)).length;
    const f = frame(U('board'), `<button type="button" class="lchip" data-exam style="border:1px solid #5C4A22;background:transparent;color:var(--gold);height:40px">${svgIco(IC.trophy)}${U('exam')}</button>`);
    const sub = document.createElement('span'); sub.style.cssText = 'font-size:13px;color:var(--text2);align-self:flex-start;max-width:520px;width:100%;margin:-4px auto 0'; sub.textContent = U('placed', { n: placedN, m: order.length - placedN });
    f.body.appendChild(sub);
    const B = makeBoard(f.body, null, 15); B.fit(boardSize(18));
    // 下一課＝落子順序中第一個還沒完成的課
    const nextO = order.find(o => o.lesson !== 'opening' && !doneSet.has(o.lesson));
    order.forEach(o => { if (o.lesson === 'opening' || doneSet.has(o.lesson)) B.put(o.t, o.c, { anim: false, cls: o.c === 'b' ? 'a-breath' : '' }); });
    if (prog().justDone) {   // 剛完成的課：子落到盤上，再轉一圈金光（逐格圖 unit_clear）
      const o = order.find(x => x.lesson === prog().justDone);
      if (o) { B.take(o.t, true); setTimeout(() => { if (!alive()) return; B.put(o.t, o.c, { cls: o.c === 'b' ? 'a-breath' : '' }); const [px, py] = B.px(o.t); setTimeout(() => alive() && sprite(B.layer, 'unit_clear', px, py, B.cell * 0.88, { ms: 55 }), 650); }, 350); }
      const p = prog(); delete p.justDone; store.set(p);
    }
    const alive = () => my === run;
    if (nextO) {   // 下一課的信標：逐格圖循環，沒有圖就用 CSS 波紋
      const [px, py] = B.px(nextO.t), sp = sprite(B.layer, 'beacon', px, py, B.cell * 0.45, { loop: true, ms: 70 });   // manifest 量的是信標核心
      if (sp) sp.classList.add('beacon');
      else { const bc = B.mark('beacon', nextO.t, '<i></i><i style="animation-delay:.6s"></i><i style="animation-delay:1.2s"></i><b></b>'); bc.style.transform = 'scale(1.3)'; }
    }
    const card = document.createElement('div'); card.className = 'lcard a-msg'; f.body.appendChild(card);
    const showNext = () => {
      if (!nextO) { card.innerHTML = `<b></b>`; card.querySelector('b').textContent = U('examSub'); button(f.foot, U('examT'), 'teal', () => exam(), IC.trophy); return; }
      const l = byId[nextO.lesson], ready = l.steps && l.steps.length;
      card.innerHTML = `<span class="lchip" style="background:#1F3B39;color:#3CC6B4">${U('next')}・${l.id}</span><b></b><span></span>`;
      card.querySelector('b').textContent = TX(l.title); card.querySelector('span:last-child').textContent = ready ? U('unit', { u: l.unit }) : U('soonSub');
      button(f.foot, ready ? U('start') : U('soon'), 'teal', ready ? () => lesson(l) : null, ready ? IC.play : null);
    };
    showNext();
    B.onTap = (t) => {
      const o = order.find(x => x.t === t);
      if (nextO && t === nextO.t) return showNext();
      if (!o || !(o.lesson === 'opening' || doneSet.has(o.lesson))) return;
      const l = o.lesson === 'opening' ? { id: '0', title: { zh: '開場：先被打敗，再換你打', en: 'Opening: lose first, then win', ja: '開幕：まず負けて、次に勝つ', ko: '오프닝: 먼저 지고, 이기기' } } : byId[o.lesson];
      card.innerHTML = `<span class="lchip" style="background:#3A2F17;color:var(--gold)">${l.id === '0' ? '★' : l.id}</span><b></b>`;
      card.querySelector('b').textContent = TX(l.title);
      button(f.foot, U('again'), 'ghost', () => (l.id === '0' ? opening() : lesson(l)), IC.redo);
    };
    root.querySelector('[data-exam]').onclick = () => (nextO ? (card.innerHTML = '<b></b>', card.querySelector('b').textContent = U('locked'), button(f.foot, U('locked'), '', null)) : exam());
  }

  // ---------- 一課 ----------
  async function lesson(l) {
    const my = ++run, alive = () => my === run;
    for (let i = 0; i < l.steps.length; i++) {
      const st = l.steps[i];
      const r = await step(l, st, i, alive);
      if (!alive() || r === 'quit') return;
    }
    saveDone(l.id); const p = prog(); p.justDone = l.id; store.set(p);
    boardScreen();
  }
  function progressChip(l, i) {
    return `<span class="lchip" style="background:#1F3B39;color:#3CC6B4;font-family:var(--num)">${l.id}・${i + 1}/${l.steps.length}</span>`;
  }
  async function step(l, st, i, alive) {
    const f = frame(TX(l.title), progressChip(l, i));
    const T = st.type;
    if (T === 'rewind') return rewindStep(l, st, i, f, alive);
    if (T === 'solve') return solveStep(l, st, f, alive);
    const pos = st.pos;
    let B = null;
    if (pos) { B = makeBoard(f.body, pos.win || null, pos.win ? 9 : 15); B.fit(boardSize(T === 'choose' ? (st.options.length * 60) : 0)); pos.b.forEach(t => B.put(t, 'b', { anim: false })); pos.w.forEach(t => B.put(t, 'w', { anim: false })); }
    const text = TX(st.text);
    if (T === 'say') { msg(f.body, '', text); return new Promise(res => button(f.foot, U('cont'), '', res)); }
    if (T === 'choose') {
      if (st.probe && B) B.glow(st.probe, '#F2B544');   // 禁手判斷題：標出要判斷的那一點
      msg(f.body, '', text);
      const box = document.createElement('div'); box.className = 'lopts'; f.body.appendChild(box);
      button(f.foot, '');
      return new Promise(res => {
        st.options.forEach((o, k) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'lopt'; b.textContent = TX(o);
          b.onclick = () => {
            if (k === st.ans) { b.classList.add('ok'); box.querySelectorAll('button').forEach(x => x.disabled = true); msg(f.body, U('ok'), '', 'good'); button(f.foot, U('nextStep'), '', res); }
            else { b.classList.add('ng'); msg(f.body, U('no'), text, 'bad'); }
          };
          box.appendChild(b);
        });
      });
    }
    if (T === 'predict') {   // 先下攻方那手，再問擋哪
      msg(f.body, '', text); button(f.foot, U('tapBoard'));
      const atkC = pos.atk === 'w' ? 'w' : 'b', defC = atkC === 'b' ? 'w' : 'b';
      await sleep(500); if (!alive()) return 'quit';
      B.put(st.play, atkC);
      let miss = 0;
      while (true) {
        const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
        if (!alive()) return 'quit';
        if (st.ans.includes(t)) { B.onTap = null; B.clearMarks(); await B.thread(t, defC); break; }
        miss++; B.shake(); B.clearMarks(); B.cross(t); msg(f.body, U('no'), TX({ zh: '這一點擋不住。四只差哪一點就成五？', en: 'That does not stop it. Which single point would complete five?', ja: 'そこでは止まらない。どの一点で五になる？', ko: '거기로는 못 막아요. 어느 한 점이면 오목이 되나요?' }), 'bad');
        if (miss >= 2) st.ans.forEach(a => B.glow(a, '#3CC6B4'));
      }
      msg(f.body, U('ok'), text, 'good');
      return new Promise(res => button(f.foot, U('nextStep'), '', res));
    }
    if (T === 'tap') {
      const kind = st.kind, myC = kind === 'block' ? (pos.atk === 'w' ? 'b' : 'w') : (pos.atk === 'w' ? 'w' : 'b');
      msg(f.body, '', text); button(f.foot, U('tapBoard'));
      if (kind === 'free') {
        const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
        if (!alive()) return 'quit';
        B.onTap = null; B.put(t, 'b');
        await sleep(600); if (!alive()) return 'quit';
        const [x, y] = xy(t), cand = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]].map(([dx, dy]) => nm(x + dx, y + dy)).find(p => { const [a, b] = xy(p); return a >= B.ox && a < B.ox + 9 && b >= B.oy && b < B.oy + 9 && !B.has(p); });
        if (cand) await B.thread(cand, 'w');
        msg(f.body, U('ok'), TX({ zh: '白也下了一手。就是這樣一人一手輪流。', en: 'White answered. That is it: one move each, taking turns.', ja: '白も一手。こうして一手ずつ交代で打つ。', ko: '백도 한 수. 이렇게 한 수씩 번갈아 둡니다.' }), 'good');
        return new Promise(res => button(f.foot, U('nextStep'), '', res));
      }
      if (st.all) {   // 全部找出來：每找到一個標青圈，全部找到才過
        const found = new Set();
        while (found.size < st.ans.length) {
          const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p) && !found.has(p)) res(p); }; });
          if (!alive()) return 'quit';
          if (st.ans.includes(t)) { found.add(t); B.mark('ring', t, '', 'border-color:#3CC6B4;border-style:solid'); msg(f.body, `${found.size} / ${st.ans.length}`, text, 'good'); }
          else { B.shake(); B.cross(t); msg(f.body, U('no'), TX({ zh: '這點下了不會變成四。', en: 'That point does not make a four.', ja: 'そこでは四にならない。', ko: '거기는 사가 되지 않습니다.' }), 'bad'); }
        }
        B.onTap = null;
        msg(f.body, U('ok'), text, 'good');
        return new Promise(res => button(f.foot, U('nextStep'), '', res));
      }
      let miss = 0;
      while (true) {
        const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
        if (!alive()) return 'quit';
        if (st.ans.includes(t)) {
          B.onTap = null; B.clearMarks();
          if (kind === 'coord') { B.mark('ring', t, '', 'border-color:#3CC6B4;border-style:solid'); }
          else {
            B.put(t, myC);
            if (kind === 'five') { const own = new Set([...(myC === 'b' ? pos.b : pos.w), t]); B.five(fiveLine(own, t), true); }
          }
          break;
        }
        miss++; B.shake(); B.clearMarks(); B.cross(t);
        const hint = { five: { zh: '找那條四，差的是哪一點？', en: 'Find the four. Which point is missing?', ja: '四を探して。足りないのはどの点？', ko: '사를 찾으세요. 빠진 점은 어디?' }, block: { zh: '對方哪一點下了就成五？擋那裡。', en: 'Where would the opponent make five? Block there.', ja: '相手が五になる点はどこ？そこを止めて。', ko: '상대가 오목이 되는 점은? 거기를 막으세요.' }, four: { zh: '下了之後，要再一顆就能成五才算四。', en: 'After your move it must need just one more stone to make five.', ja: '打ったあと、あと一つで五になれば四。', ko: '둔 뒤 한 개만 더 놓으면 오목이 되어야 사입니다.' }, coord: { zh: '先找字母那一直排，再找數字那一橫排。', en: 'Find the letter column first, then the number row.', ja: 'まず文字の縦列、次に数字の横列。', ko: '먼저 글자 세로줄, 그다음 숫자 가로줄.' } }[kind];
        msg(f.body, U('no'), TX(hint), 'bad');
        if (miss >= 2) st.ans.forEach(a => B.glow(a, '#3CC6B4'));
      }
      msg(f.body, U('ok'), text, 'good');
      return new Promise(res => button(f.foot, U('nextStep'), '', res));
    }
    msg(f.body, '', text); return new Promise(res => button(f.foot, U('cont'), '', res));
  }

  // ---------- 倒帶課：先看結局、倒帶一手答一題、最後正著下 ----------
  async function rewindStep(l, st, i, f, alive) {
    const pos = st.pos, atkC = pos.atk === 'w' ? 'w' : 'b', defC = atkC === 'b' ? 'w' : 'b';
    const line = [...st.line, st.five[0], st.five[1]];   // 攻、擋、攻、擋……、最後擋一頭、攻方成五
    const colorAt = (k) => (k % 2 === 0 ? atkC : defC);
    const tape = document.createElement('div'); tape.className = 'tape'; f.body.appendChild(tape);
    const B = makeBoard(f.body, pos.win, 9); B.fit(boardSize(50));
    const head = document.createElement('div'); head.className = 'head'; tape.appendChild(head);
    const dots = line.map((t, k) => { const d = document.createElement('i'); d.textContent = k + 1; const c = colorAt(k); d.style.cssText = `background:${c === 'b' ? '#1B1A17' : '#FBFAF6'};color:${c === 'b' ? '#FBFAF6' : '#1B1A17'};border:2px solid ${c === 'b' ? '#FBFAF6' : '#1B1A17'}`; tape.appendChild(d); return d; });
    const layoutTape = (n) => { const w = tape.clientWidth - 40, gap = w / Math.max(1, line.length - 1); dots.forEach((d, k) => { d.style.left = (8 + k * gap) + 'px'; d.style.opacity = k < n ? 1 : .25; }); head.style.left = Math.max(4, Math.min(tape.clientWidth - 8, 8 + n * gap - gap / 2 + 10)) + 'px'; };
    pos.b.forEach(t => B.put(t, 'b', { anim: false })); pos.w.forEach(t => B.put(t, 'w', { anim: false }));
    line.forEach((t, k) => B.put(t, colorAt(k), { anim: false, num: k + 1 }));
    layoutTape(line.length);
    const atkSet = new Set([...(atkC === 'b' ? pos.b : pos.w), ...line.filter((_, k) => k % 2 === 0)]);
    B.five(fiveLine(atkSet, line[line.length - 1]), true);
    msg(f.body, U('end'), TX(st.text));
    await new Promise(res => button(f.foot, U('rewindOne'), '', res, IC.rew));
    // 倒帶：從最後一手往回，每退一手問一題
    for (let k = line.length - 1; k >= 0; k--) {
      if (!alive()) return 'quit';
      button(f.foot, '');
      const scan = sprite(B.el, 'rewind_fx', 0, 0, 0, { full: true, loop: true, z: 6 }) || Object.assign(document.createElement('div'), { className: 'lscan' });
      if (!scan.parentNode) B.el.appendChild(scan);
      B.take(line[k]); layoutTape(k);
      await sleep(620); scan._stop ? scan._stop() : scan.remove(); if (!alive()) return 'quit';
      B.unfive();
      const isAtk = k % 2 === 0, t0 = line[k];
      let ans, q, hint, stoneQ = false;
      if (isAtk) {
        ans = (k === line.length - 1) ? [t0] : (k === st.line.length - 1 && st.accept && st.accept[String(st.L - 1)]) ? st.accept[String(st.L - 1)] : [t0];
        q = k === line.length - 1 ? TX({ zh: '最後一手在哪裡連成五？', en: 'Where did the last move make five?', ja: '最後の一手はどこで五に？', ko: '마지막 수는 어디서 오목이 됐나요?' })
          : k === st.line.length - 1 ? TX({ zh: '這一手做出兩頭都能成五的活四（或兩個四）。下哪？', en: 'This move made an open four (or two fours). Where?', ja: 'この一手で活四（または四四）。どこ？', ko: '이 수로 활사(또는 쌍사)를 만들었습니다. 어디?' })
          : TX({ zh: '這一手衝四，逼對方只能擋。下哪？想想它跟後面的手怎麼接。', en: 'This move made a four and forced a block. Where? Think how it links to what came next.', ja: 'この一手で四を作り、止めさせた。どこ？後の手とのつながりを考えて。', ko: '이 수로 사를 만들어 막게 했습니다. 어디? 다음 수와 어떻게 이어지는지 생각해 보세요.' });
        hint = TX({ zh: '找一條再一顆就成四（或成五）的線，答案在它的空點上。', en: 'Find a line that needs one more stone to make a four (or five). The answer is on its empty point.', ja: 'あと一つで四（または五）になる線を探して。答えはその空点。', ko: '한 개만 더 놓으면 사(또는 오목)가 되는 줄을 찾으세요.' });
      } else {
        stoneQ = true; B.mark('ring', t0);
        // 逼它擋那裡的四：上一手攻方的子，跟它同一條線上的攻方子都算
        const prev = line[k - 1], [px, py] = xy(prev), [bx, by] = xy(t0), dx = Math.sign(px - bx), dy = Math.sign(py - by);
        ans = [];
        for (let s = -5; s <= 5; s++) { const p = nm(bx + dx * s, by + dy * s); if (B.has(p) && B.stones.get(p).color === atkC) ans.push(p); }
        if (!ans.includes(prev)) ans.push(prev);
        q = TX({ zh: '虛線圈是對方擋過的地方。是哪顆子逼它擋那裡？點那條四上的子。', en: 'The dashed ring is where the opponent blocked. Which stone forced it? Tap a stone of that four.', ja: '点線の輪は相手が止めた所。どの石がそうさせた？その四の石をタップ。', ko: '점선 원은 상대가 막은 자리. 어느 돌이 그렇게 만들었나요? 그 사의 돌을 누르세요.' });
        hint = TX({ zh: '虛線圈在一條「再一顆就成五」的線的盡頭。', en: 'The ring sits at the end of a line that was one stone from five.', ja: '点線の輪は「あと一つで五」の線の端にある。', ko: '점선 원은 "한 개만 더면 오목"인 줄의 끝에 있습니다.' });
      }
      msg(f.body, U('q', { n: k + 1 }), q);
      let miss = 0;
      while (true) {
        const t = await new Promise(res => { B.onTap = (p) => { if (stoneQ ? B.has(p) : !B.has(p)) res(p); }; });
        if (!alive()) return 'quit';
        if (ans.includes(t)) break;
        miss++; B.shake(); msg(f.body, U('no'), hint, 'bad');
        if (miss >= 2) ans.forEach(a => B.glow(a, '#3CC6B4'));
      }
      B.onTap = null; B.clearMarks();
      if (!stoneQ) { const g = B.put(ans.includes(t0) ? t0 : ans[0], atkC, { cls: '' }); g.style.opacity = .55; setTimeout(() => B.take(ans.includes(t0) ? t0 : ans[0], true), 700); }
      msg(f.body, U('ok'), k === 0 ? TX({ zh: '倒帶完成。現在不看數字，自己正著下一遍。', en: 'Rewind complete. Now play it forward yourself, no numbers.', ja: '巻き戻し完了。今度は数字なしで、順に打ってみよう。', ko: '되감기 완료. 이제 숫자 없이 순서대로 두어 보세요.' }) : '', 'good');
      if (k > 0) await new Promise(res => button(f.foot, U('rewindMore'), '', res, IC.rew));
      else await new Promise(res => button(f.foot, U('playFwd'), 'teal', res, IC.play));
    }
    // 正著下：攻方每手只接受驗證過的點，對方被木偶線拖去擋
    button(f.foot, '');
    const atkMoves = line.filter((_, k) => k % 2 === 0), defMoves = line.filter((_, k) => k % 2 === 1);
    const placed = new Set(atkC === 'b' ? pos.b : pos.w);
    for (let m = 0; m < atkMoves.length; m++) {
      layoutTape(m * 2);
      const ok = (m === st.L - 1 && st.accept && st.accept[String(st.L - 1)]) ? st.accept[String(st.L - 1)] : [atkMoves[m]];   // 活四那手：引擎驗證過的所有點都算對
      msg(f.body, U('fwd'), m === atkMoves.length - 1 ? TX({ zh: '連成五！', en: 'Make five!', ja: '五を作れ！', ko: '오목을 만드세요!' }) : TX({ zh: '下一手？', en: 'Next move?', ja: '次の一手は？', ko: '다음 수는?' }));
      let miss = 0, t;
      while (true) {
        t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
        if (!alive()) return 'quit';
        if (ok.includes(t)) break;
        miss++; B.shake(); msg(f.body, U('no'), TX({ zh: '照剛才倒帶看到的順序下。', en: 'Follow the order you just rewound.', ja: 'さっき巻き戻した順に。', ko: '방금 되감아 본 순서대로.' }), 'bad');
        if (miss >= 2) ok.forEach(a => B.glow(a, '#3CC6B4'));
      }
      B.onTap = null; B.clearMarks(); B.put(t, atkC); placed.add(t);
      if (m === atkMoves.length - 1) { B.five(fiveLine(placed, t), true); break; }
      await sleep(450); if (!alive()) return 'quit';
      msg(f.body, '', U('forced'));
      await B.thread(defMoves[m], defC); if (!alive()) return 'quit';
    }
    layoutTape(line.length);
    if (!sprite(B.el, 'stamp_ok', B.size - 46, 40, 76, { keep: true, z: 7 })) { const stamp = document.createElement('div'); stamp.className = 'stamp'; stamp.textContent = '✓'; B.el.appendChild(stamp); }
    msg(f.body, U('done'), TX({ zh: '你先倒著想了一次，又正著下了一次。找 VCF 就是這樣：先看終點，再往回接。', en: 'You thought it through backward, then played it forward. That is how to find a VCF: see the end, then link back.', ja: '逆にたどって、順に打った。VCF の探し方はこれ：終点を見て、逆につなぐ。', ko: '거꾸로 생각하고, 순서대로 두었습니다. VCF 찾는 법: 끝을 보고, 거꾸로 잇기.' }), 'good');
    return new Promise(res => button(f.foot, U('nextStep'), '', res));
  }

  // ---------- 自己解：9×9 局部盤，引擎即時判定（下錯退回這手） ----------
  async function solveStep(l, st, f, alive) {
    const pos = st.pos, aw = pos.atk === 'w', atkC = aw ? 'w' : 'b', defC = aw ? 'b' : 'w';
    const B = makeBoard(f.body, pos.win || null, pos.win ? 9 : 15); B.fit(boardSize());   // 沒給框＝整盤 15×15（長題）
    const b = [...pos.b], w = [...pos.w], mine = aw ? w : b, theirs = aw ? b : w;
    b.forEach(t => B.put(t, 'b', { anim: false })); w.forEach(t => B.put(t, 'w', { anim: false }));
    msg(f.body, '', TX(st.text)); button(f.foot, '');
    const why = {
      forbidden: { zh: '這點是黑棋禁手，不能下。', en: 'That is a forbidden point for Black.', ja: 'そこは黒の禁手。', ko: '거기는 흑의 금수입니다.' },
      notfour: { zh: '這手不是四。這題每一手都要是四。', en: 'That is not a four. Every move here must be a four.', ja: 'それは四じゃない。毎手が四。', ko: '사가 아닙니다. 매 수가 사여야 합니다.' },
      defFive: { zh: '對方的擋子變成四，你沒擋，它連成五了（反四）。', en: 'The block made a four for them and you ignored it: they made five (counter-four).', ja: '相手の止めが四になっていた。放置して五にされた（逆四）。', ko: '상대의 막는 돌이 사가 됐는데 무시해서 오목이 됐습니다(역사).' },
      bad: { zh: '這條路接不下去。退回去再想想。', en: 'That path leads nowhere. Step back and think again.', ja: 'その道は続かない。戻って考え直そう。', ko: '그 길은 이어지지 않습니다. 돌아가서 다시 생각해 보세요.' },
      nofour: { zh: '下完這手之後你就沒有四可以衝了。換一條路。', en: 'After that you have no fours left. Try another path.', ja: 'その後、四が打てなくなる。別の道を。', ko: '그 다음엔 둘 사가 없습니다. 다른 길로.' },
    };
    let miss = 0;
    while (true) {
      const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
      if (!alive()) return 'quit';
      B.onTap = null; B.clearMarks();
      const r = (await move(b.join(' '), w.join(' '), t, aw)).result || { r: 'illegal' };
      if (!alive()) return 'quit';
      if (r.r === 'illegal') continue;
      if (r.r === 'forbidden' || r.r === 'notfour') { B.shake(); B.cross(t); msg(f.body, U('no'), TX(why[r.r]), 'bad'); continue; }
      B.put(t, atkC); mine.push(t);
      if (r.r === 'win') {
        if (/禁/.test(r.how || '')) { if (r.at) { B.glow(r.at, '#FF7A6B'); B.cross(r.at); } msg(f.body, U('ok'), TX({ zh: '黑唯一的擋點是禁手：黑擋不了，白贏！', en: 'Black’s only block is a forbidden point: White wins!', ja: '黒の唯一の止めが禁手。白の勝ち！', ko: '흑의 유일한 막는 자리가 금수: 백 승리!' }), 'good'); await sleep(1200); }
        else if (/五/.test(r.how || '')) B.five(fiveLine(new Set(mine), t), true); else B.glow(t, '#F2B544');
        break;
      }
      if (r.r === 'block') {
        await sleep(400); if (!alive()) return 'quit';
        if (r.forcedForbidden) { B.glow(r.def, '#FF7A6B'); msg(f.body, U('ok'), TX({ zh: '黑唯一的擋點是禁手：黑擋不了，白贏！', en: 'Black’s only block is a forbidden point: White wins!', ja: '黒の唯一の止めが禁手。白の勝ち！', ko: '흑의 유일한 막는 자리가 금수: 백 승리!' }), 'good'); break; }
        msg(f.body, '', U('forced')); await B.thread(r.def, defC); theirs.push(r.def);
        if (r.nofour) { B.shake(); msg(f.body, U('no'), TX(why.nofour), 'bad'); await sleep(900); B.take(r.def); theirs.pop(); B.take(t); mine.pop(); continue; }
        msg(f.body, '', TX(st.text)); continue;
      }
      // defFive／bad：退回這一手（反四：對方剛才那顆擋子閃紅光）
      if (r.r === 'defFive' && theirs.length) { const [px, py] = B.px(theirs[theirs.length - 1]); sprite(B.layer, 'counter_four', px, py, B.cell * 0.88, { ms: 50 }); }
      miss++; B.shake(); msg(f.body, U('no'), TX(why[r.r] || why.bad), 'bad');
      await sleep(900); if (!alive()) return 'quit';
      B.take(t); mine.pop();
      if (miss >= 2 && st.line) B.glow(st.line[(mine.length - (aw ? pos.w.length : pos.b.length)) * 2] || st.line[0], '#3CC6B4');
    }
    msg(f.body, U('done'), TX({ zh: '解開了！', en: 'Solved!', ja: '解けた！', ko: '풀었습니다!' }), 'good');
    return new Promise(res => button(f.foot, U('nextStep'), '', res));
  }

  // ---------- 畢業考：教學盤整盤，用引擎判定 ----------
  async function exam() {
    const my = ++run, alive = () => my === run, bd = DATA.board;
    const f = frame(U('examT'));
    const B = makeBoard(f.body, null, 15); B.fit(boardSize());
    let b = [...bd.b], w = [...bd.w];
    b.forEach(t => B.put(t, 'b', { anim: false })); w.forEach(t => B.put(t, 'w', { anim: false }));
    msg(f.body, U('examT'), U('examSub')); button(f.foot, '');
    while (true) {
      const t = await new Promise(res => { B.onTap = (p) => { if (!B.has(p)) res(p); }; });
      if (!alive()) return;
      B.onTap = null;
      const r = (await move(b.join(' '), w.join(' '), t, false)).result || { r: 'illegal' };
      if (!alive()) return;
      if (r.r === 'illegal') continue;
      if (r.r === 'forbidden' || r.r === 'notfour') { B.shake(); msg(f.body, U('no'), r.r === 'forbidden' ? TX({ zh: '這點是禁手。', en: 'That point is forbidden.', ja: 'そこは禁手。', ko: '거기는 금수입니다.' }) : TX({ zh: '這手不是四。VCF 每一手都要是四。', en: 'That is not a four. Every VCF move must be a four.', ja: 'それは四じゃない。VCF は毎手が四。', ko: '사가 아닙니다. VCF는 매 수가 사여야 합니다.' }), 'bad'); continue; }
      B.put(t, 'b'); b.push(t);
      if (r.r === 'win') { if (/五/.test(r.how || '')) B.five(fiveLine(new Set(b), t), true); else B.glow(t, '#F2B544'); break; }   // 活四／四四：已經擋不住
      if (r.r === 'block') { await sleep(400); await B.thread(r.def, 'w'); w.push(r.def); msg(f.body, '', U('forced')); continue; }
      // 下錯（對方反四成五、或接不下去）：退回這一手重來
      B.shake(); msg(f.body, U('no'), TX({ zh: '這條路不通。退回去再想想。', en: 'That path fails. Step back and think again.', ja: 'その道は通らない。戻って考え直そう。', ko: '그 길은 막혔습니다. 돌아가서 다시 생각해 보세요.' }), 'bad');
      await sleep(900); B.take(t); b.pop();
    }
    // 下完：補上五連（引擎回 win 表示已經擋不住；這裡讓玩家看到結局）
    sprite(B.el, 'graduation', 0, 0, 0, { full: true, z: 8, ms: 70 });
    msg(f.body, U('grad'), U('gradSub'), 'good');
    const p = prog(); p.graduated = true; store.set(p);
    button(f.foot, U('back'), '', () => boardScreen());
  }
})();
