"""Gomoku Rush 宣傳短片錄製器（可重跑）

用法（在任何目錄都可）：
    python C:/claudehome/projects/VCF/tools/promo/rush_promo.py A

做法：本機靜態伺服器（自己啟動、結束時只關自己的 PID）＋ Playwright chromium（手機 360x640、DPR 3）
＋ CDP Page.startScreencast（jpeg 品質 92）收帶時間戳畫格 ＋ ffmpeg 依時間戳合成固定 30fps。
安全：所有非 GET 請求一律 abort（不送出去），錄完列出被擋的請求。不改遊戲任何檔案，字幕用頁面注入。
"""
import asyncio, base64, json, os, random, re, shutil, socket, subprocess, sys, tempfile, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

ROOT = r'C:\claudehome\projects\VCF'
OUT = os.path.join(ROOT, 'docs', 'promo', '2026-11-12')
FFMPEG = r'C:\Users\hangs\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe'
FFPROBE = FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe')
NICK = 'Rush'

CAP_JS = r"""
(() => {
  if (document.getElementById('promoCap')) return;
  const st = document.createElement('style');
  st.textContent = `
  #promoCap { position: fixed; left: 0; right: 0; z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    background: #0E111A; color: #fff; text-align: center; white-space: nowrap; pointer-events: none; opacity: 0;
    font-family: 'Chakra Petch', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; font-weight: 800; letter-spacing: .02em; }
  #promoCap.on { opacity: 1; }
  #promoCap .l1 { font-size: 22px; line-height: 30px; }
  #promoCap .l1 b { color: var(--accent); font-weight: 800; }
  #promoCap .l2 { font-size: 24px; line-height: 30px; color: #3CC6B4; }
  #promoCap.end { justify-content: center; }
  #promoCap.end .l1 { font-size: 40px; line-height: 48px; color: var(--accent); }
  `;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'promoCap'; document.body.appendChild(d);
  window.__cap = (html, o) => {
    o = o || {};
    d.className = o.end ? 'end' : '';
    d.style.setProperty('--accent', o.accent || '#3CC6B4');
    d.style.top = (o.top == null ? 481 : o.top) + 'px'; d.style.height = (o.h == null ? 78 : o.h) + 'px';
    d.innerHTML = html ? `<div class="l1">${html}</div>` + (o.l2 ? `<div class="l2">${o.l2}</div>` : '') : '';
    d.classList.toggle('on', !!html);
    if (html) { const l = d.querySelector('.l1'); let fs = parseFloat(getComputedStyle(l).fontSize); while (l.scrollWidth > 332 && fs > 12) { fs -= 0.5; l.style.fontSize = fs + 'px'; } }
  };
})();
"""

SOLVE_JS = ("solveFrom(g.black.join(' '),g.white.join(' '),g.p.atkWhite).then(r=>{const s=r&&r.result&&r.result.solution;"
            "return s?String(s).replace(/\\(.*\\)/,'').trim().split(/\\s+/)[0]:null})")

NEXT_JS = """async()=>{
  const solve=async()=>{const r=await solveFrom(g.black.join(' '),g.white.join(' '),g.p.atkWhite); const s=r&&r.result&&r.result.solution; return s?String(s).replace(/\(.*\)/,'').trim().split(/\s+/).filter(Boolean):null;};
  if(window.__plan_p!==g.p){ window.__plan_p=g.p; window.__plan_k=0; window.__plan=(await solve())||[]; }
  let k=window.__plan_k, t=window.__plan[2*k];
  const occ=x=>g.black.includes(x)||g.white.includes(x);
  if(!t || occ(t) || (k>0 && g.lastDef && g.lastDef!==window.__plan[2*k-1])){
    const pl=await solve(); if(pl){ window.__plan=pl; window.__plan_k=0; k=0; t=pl[0]; }
  }
  window.__plan_k=k+1; return t||null;
}"""


class Recorder:
    def __init__(self, cdp, page):
        self.cdp, self.page = cdp, page
        self.frames = []          # (virtual_t, jpeg bytes)
        self.t0 = None
        self.offset = 0.0
        self.paused = True
        self.pause_at = None
        self.marks = []

    def rollback(self, n_frames, n_marks, vt0):
        """丟掉這一次嘗試錄到的畫格（要在暫停狀態下呼叫），時間軸回到 vt0"""
        self.pause()
        del self.frames[n_frames:]
        del self.marks[n_marks:]
        self.offset = self.pause_at - self.t0 - vt0

    def mark(self, name):
        self.marks.append((name, self.vt()))

    def now(self):
        return time.perf_counter()

    async def start(self):
        # screencast 只出 CSS 像素大小（360x640，會糊）；改用背景迴圈連續 captureScreenshot（吃 DPR 3，1080x1920）
        self.t0 = self.now(); self.pause_at = self.t0
        self.running = True
        self.task = asyncio.ensure_future(self._loop())

    async def _grab(self):
        return await self.page.screenshot(type='jpeg', quality=92, animations='allow', caret='initial', scale='device')

    async def _loop(self):
        while self.running:
            t_a = self.now()
            if self.paused:
                await asyncio.sleep(0.01); continue
            try:
                b = await self._grab()
            except Exception:
                await asyncio.sleep(0.02); continue
            if not self.paused:
                self.frames.append(((t_a + self.now()) / 2 - self.t0 - self.offset, b))
            await asyncio.sleep(max(0.0, 1 / 30 - (self.now() - t_a)))

    async def snap(self):
        b = await self._grab()
        self.frames.append((self.now() - self.t0 - self.offset, b))

    async def resume(self):
        if not self.paused: return
        self.offset += self.now() - self.pause_at
        self.paused = False
        await self.snap()

    def pause(self):
        if self.paused: return
        self.paused = True; self.pause_at = self.now()

    def vt(self):
        return (self.pause_at if self.paused else self.now()) - self.t0 - self.offset

    async def stop(self, tail=0.4):
        await self.snap()
        self.frames.append((self.vt() + tail, self.frames[-1][1]))
        self.pause()
        self.running = False
        await self.task

    def render(self, mp4, workdir):
        fr = sorted(self.frames, key=lambda x: x[0])
        os.makedirs(workdir, exist_ok=True)
        lines = []
        for i, (t, b) in enumerate(fr):
            p = os.path.join(workdir, f'f{i:05d}.jpg')
            open(p, 'wb').write(b)
            if i + 1 < len(fr):
                d = max(fr[i + 1][0] - t, 0.001)
                lines.append(f"file '{p.replace(chr(92), '/')}'\nduration {d:.4f}")
            else:
                lines.append(f"file '{p.replace(chr(92), '/')}'")
        lst = os.path.join(workdir, 'list.txt')
        open(lst, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
               '-vf', 'fps=30,scale=1080:1920:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
               '-r', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]
        subprocess.run(cmd, check=True)
        return fr[-1][0]


class Game:
    """頁面操作：全部走遊戲自己的函數（show / setMode / placeAt），不改遊戲檔。"""
    def __init__(self, pg, rec):
        self.pg, self.rec = pg, rec

    async def cap(self, html, **o):
        await self.pg.evaluate("([h,o])=>window.__cap(h,o)", [html, o])

    async def home(self):
        await self.pg.evaluate("()=>{ if (typeof g!=='undefined' && g) g.over = true; show('sHome'); }")

    async def pick(self):
        await self.pg.evaluate("()=>{ if (typeof g!=='undefined' && g) g.over = true; show('sPick'); }")

    async def enter(self, btn, nick=True):
        """從挑戰選單進模式並開始（這段呼叫端要在 rec 暫停時做，進入遊戲後才 resume）"""
        await self.pg.click('#' + btn)
        await self.pg.wait_for_timeout(300)
        if nick:
            await self.pg.evaluate("n=>{const e=document.getElementById('nick'); if(e){e.value=n;}}", NICK)
        await self.pg.wait_for_function("()=>!document.getElementById('go').disabled", timeout=20000)

    async def go_and_wait_puzzle(self, resume_on_flash=True):
        await self.pg.evaluate("()=>{window.__g0 = (typeof g!=='undefined')?g:null}")
        await self.pg.click('#go')
        await self.pg.wait_for_function("()=>typeof g!=='undefined' && g && g!==window.__g0 && g.p", timeout=30000)

    async def ready(self, timeout=15000):
        await self.pg.wait_for_function("()=>g && !g.over && !g.hold", timeout=timeout)

    async def info(self):
        return await self.pg.evaluate("()=>({L:g.p.L,atkWhite:g.p.atkWhite,over:g.over,hold:g.hold})")

    async def move_one(self, eye=False):
        if eye:
            t = await self.pg.evaluate("()=>g.eySol")
        else:
            t = None
            for _ in range(6):
                t = await self.pg.evaluate(NEXT_JS)
                if t: break
                await asyncio.sleep(0.2)
            if not t:
                print('NOSOL', await self.pg.evaluate("()=>JSON.stringify({b:g.black,w:g.white,a:g.p.atkWhite,hold:g.hold,over:g.over})"))
        if not t: return None
        await self.pg.evaluate("t=>{placeAt(t); return 1}", t)
        return t

    async def state(self):
        return await self.pg.evaluate("()=>({st:!g||g.over?'over':g.p!==window.__pk?'changed':g.hold?'hold':'ready', s:g?g.solved:0})")

    async def play(self, secs=None, nmax=99, pace=(0.5, 0.9), eye=False, win_target=None, on_win=None):
        """依解答一手一手下。回傳 'won'（解開 win_target 題）／'changed'（換題）／'over'／'late'／'max'。
        win_target：目前 g.solved 達到這個數字就立刻回傳（解開那一刻，回饋畫面剛出現）。"""
        t_end = time.perf_counter() + secs if secs else None
        await self.pg.evaluate("()=>{window.__pk=g.p}")
        n = 0
        while n < nmax:
            if t_end and time.perf_counter() > t_end: return 'late'
            while True:
                s = await self.state()
                if win_target is not None and s['s'] >= win_target:
                    if on_win: on_win()
                    return 'won'
                if s['st'] != 'hold': break
                if t_end and time.perf_counter() > t_end + 1.5: return 'late'
                await asyncio.sleep(0.03)
            if s['st'] != 'ready': return s['st']
            await asyncio.sleep(random.uniform(*pace))
            t = await self.move_one(eye)
            if not t: return 'nosol'
            n += 1
            if eye: return 'moved'
        return 'max'

    async def narrate(self, rec, report, mark_name, hold=1.7, caps=True):
        """練習模式從頭解完一題，每一手換一句與實況一致的字幕，回傳最後結局字幕。"""
        info = await self.pg.evaluate("()=>({L:g.p.L, aw:g.p.atkWhite})")
        raw = await self.pg.evaluate("solveFrom(g.black.join(' '),g.white.join(' '),g.p.atkWhite).then(r=>r&&r.result?String(r.result.solution):'')")
        m = re.search(r'\((.*)\)', raw or '')
        tag = m.group(1) if m else ''
        atk, dfn = ('白', '黑') if info['aw'] else ('黑', '白')
        report.setdefault('narration', []).append({'solution': raw, 'tag': tag})
        await self.pg.evaluate("()=>{window.__pk=g.p}")
        base = await self.pg.evaluate("()=>g.solved")
        for i in range(info['L']):
            await self.cap(f'<b>{atk}衝四</b>' if i == 0 else '<b>再衝四</b>', accent=TEAL)
            await asyncio.sleep(0.5)
            assert await self.move_one(), '教學題沒有解'
            if i < info['L'] - 1:
                await self.pg.wait_for_function("()=>g && !g.over && !g.hold", timeout=8000)
                await self.cap(f'<b>{dfn}只能擋</b>', accent=TEAL)
                await asyncio.sleep(0.6)
        for _ in range(100):
            s = await self.state()
            if s['s'] > base: break
            await asyncio.sleep(0.03)
        how = await self.pg.evaluate("()=>{const l=g.log&&g.log[g.log.length-1]; return l?String(l.how):''}")
        report['narration'][-1]['how'] = how
        if '雙四' in tag or '活四' in tag or '四四' in tag or '四三' in tag:
            fin = '擋不完 贏了'
        elif '五' in tag:
            fin = '連五 贏了'
        else:
            fin = '贏了'
        await self.cap(f'<b>{fin}</b>', accent=TEAL)
        await asyncio.sleep(0.25)
        rec.mark(mark_name)
        await asyncio.sleep(hold)
        return fin


async def new_session(pw, base, bad, log):
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3, locale='zh-TW',
                              service_workers='block')

    async def route(r):
        q = r.request
        if q.method != 'GET':
            bad.append(f'{q.method} {q.url}')
            await r.abort(); return
        u = q.url
        log.append(u)
        if '/tower?' in u and 'workers.dev' in u:   # 象牙塔：用真實題目，但把「今天的進度」標成已結束，遊戲就走練習流程、不需要送任何 POST
            resp = await r.fetch()
            j = await resp.json()
            j['run'] = {'n': 0, 'score': 0, 'solved': 0, 'wrong': 0, 'hints': 0, 'seconds': 0, 'ended': True}
            await r.fulfill(response=resp, json=j); return
        await r.continue_()
    await ctx.route('**/*', route)
    pg = await ctx.new_page()
    pg.on('domcontentloaded', lambda p: print('DCL'))
    pg.on('pageerror', lambda e: print('PAGEERR', str(e)[:300]))
    pg.on('crash', lambda p: print('PAGE CRASH'))
    pg.on('close', lambda p: print('PAGE CLOSE'))
    pg.on('framenavigated', lambda f: print('NAV', f.url))
    pg.on('console', lambda m: print('CONSOLE', m.text[:200]) if True else None)
    await pg.add_init_script("localStorage.setItem('vcfgame.lang','zh')")
    await pg.goto(base + '/game.html')
    await pg.wait_for_timeout(1500)
    await pg.evaluate(CAP_JS)
    cdp = await ctx.new_cdp_session(pg)
    return b, pg, cdp


# ------------------------------------------------------------------ 共用片段
TEAL, GOLD = '#3CC6B4', '#F2B544'
HIDE_JS = "ids=>{for(const id of ['modeB','modeT','modeM','modeE','modeR']) document.getElementById(id).style.display=ids.includes(id)?'none':''; const l=document.querySelector('.pickCards'); l.style.transformOrigin='top center'; l.style.transform=ids.length?'scale(.92)':'';}"
CLEAN_MENU_JS = "()=>{for(const id of ['modeB','modeT','modeM','modeE','modeR']) document.getElementById(id).style.display=''; const l=document.querySelector('.pickCards'); if(l) l.style.transform=''; const e=document.getElementById('modeDuel'); if(e) e.style.boxShadow='';}"
# 練習模式答對後，遊戲約 0.9 秒就換下一題；這裡把「換下一題」延後，讓連五／雙四的終局盤面多停一下（只動頁面時序，不改檔）
HOLD_JS = "ms=>{ if(!window.__np){ window.__np = nextPuzzle; window.__hold = 0; nextPuzzle = async function(){ if(window.__hold) await new Promise(r=>setTimeout(r, window.__hold)); return window.__np(); }; } window.__hold = ms; }"


async def end_card(G, rec, segs, secs=3.2):
    pg = G.pg
    await G.home()
    await pg.evaluate(CLEAN_MENU_JS)
    t0 = rec.vt()
    await rec.resume()
    # 首頁本身已有 Gomoku Rush 大標，字幕只放網址
    await G.cap('rush.hangsau.app', accent=TEAL, end=True, top=418, h=76)
    rec.mark('end')
    await asyncio.sleep(secs)
    segs.append(('結尾首頁', round(rec.vt() - t0, 1)))


async def menu_card(G, rec, segs, cap_html, secs=3.0, scale=0.77, hide=None):
    """挑戰選單（完整六個模式入鏡；縮小到不被字幕蓋住）"""
    pg = G.pg
    await G.pick()
    if hide:
        await pg.evaluate(HIDE_JS, hide)
    else:
        await pg.evaluate("s=>{const l=document.querySelector('.pickCards'); l.style.transformOrigin='top center'; l.style.transform='scale('+s+')';}", scale)
    await pg.wait_for_timeout(100)
    t0 = rec.vt()
    await rec.resume()
    await G.cap(cap_html, accent=GOLD)
    rec.mark('menu')
    await asyncio.sleep(secs)
    segs.append(('挑戰選單', round(rec.vt() - t0, 1)))
    rec.pause()
    await G.cap('')


async def practice_puzzle(G, lo, hi, rank_up=0, tries=70):
    """練習模式：暫停中挑到 L 在 [lo,hi] 的題目，回傳 (L, atkWhite)。"""
    pg = G.pg
    await G.home()
    await pg.click('#modeP'); await pg.wait_for_timeout(300)
    await pg.evaluate("n=>{const d=document.getElementById('rkDown'), u=document.getElementById('rkUp'); for(let i=0;i<8;i++) if(!d.disabled) d.click(); for(let i=0;i<n;i++) if(!u.disabled) u.click();}", rank_up)
    await pg.wait_for_timeout(200)
    await G.go_and_wait_puzzle()
    seen = []
    for _ in range(tries):
        await G.ready()
        i = await G.info()
        seen.append(i['L'])
        if lo <= i['L'] <= hi: break
        await pg.evaluate("()=>skipNow()")
        await pg.wait_for_timeout(250)
    else:
        raise RuntimeError(f'找不到 L {lo}-{hi} 的題目，看過 {seen}')
    await G.ready()
    print('practice puzzle L=', i['L'], 'atkWhite=', i['atkWhite'], 'seen', seen)
    return i['L'], i['atkWhite']


async def attempt(G, rec, report, fn, tries=5):
    """跑一個遊玩片段；題目偶爾引擎沒解（不是我們的問題，是題庫題目），就丟掉這次錄到的畫格重來"""
    segs = report['segs']
    n, nm, ns, vt0 = len(rec.frames), len(rec.marks), len(segs), rec.vt()
    assert rec.paused
    for k in range(tries):
        try:
            return await fn()
        except (AssertionError, TimeoutError, Exception) as e:
            print('RETRY', k, type(e).__name__, str(e)[:120])
            rec.rollback(n, nm, vt0); del segs[ns:]
            await G.cap('')
    raise RuntimeError('片段重試多次仍失敗')


async def eye_full(G, rec, segs, name, cap_html, think=3.4):
    """火眼金睛完整一題：出題 → 倒數 → 點第一手 → 答對回饋（回饋出現就收）"""
    await G.pick()
    await G.enter('modeE')
    await G.go_and_wait_puzzle()
    t0 = rec.vt()
    await rec.resume()
    await G.cap(cap_html, accent=GOLD)
    await G.ready()
    await asyncio.sleep(think)
    ok = await G.move_one(eye=True)
    assert ok, '火眼金睛沒有解'
    await asyncio.sleep(0.12)
    rec.mark('eye_win')
    await asyncio.sleep(0.3)          # 答對回饋（+分數）顯示中就收，不讓下一題露出來
    segs.append((name, round(rec.vt() - t0, 1)))
    rec.pause()
    await G.cap('')


async def b4_two(G, rec, segs, name, cap_html):
    """無限之塔連續完整解 2 題，每題解開（+20 秒）的回饋出現才算完"""
    await G.pick()
    await G.enter('modeB')
    await G.go_and_wait_puzzle()
    t0 = rec.vt()
    await rec.resume()
    await G.cap(cap_html, accent=GOLD)
    for k in (1, 2):
        await G.ready()
        r = await G.play(pace=(0.35, 0.5), win_target=k, on_win=lambda: rec.mark(f'b4_win{k}'))
        assert r == 'won', f'無限之塔第 {k} 題沒解完：{r}'
        await asyncio.sleep(0.9 if k == 2 else 0.2)    # 第二題停在回饋上；第一題讓遊戲自己換下一題
    segs.append((name, round(rec.vt() - t0, 1)))
    rec.pause()
    await G.cap('')


# ------------------------------------------------------------------ 版本 A
async def variant_A(G, rec, report):
    pg = G.pg
    segs = report['segs']
    async def tutorial():
        L, aw = await practice_puzzle(G, 4, 4, rank_up=0)
        await pg.evaluate(HOLD_JS, 900)
        t0 = rec.vt()
        await rec.resume()
        await G.cap('五子棋 <b>一直衝四</b>衝到贏', accent=TEAL)
        rec.mark('start')
        await asyncio.sleep(2.2)
        await G.narrate(rec, report, 'tutorial_win', hold=1.3)
        segs.append(('教學 一題解完', round(rec.vt() - t0, 1)))
        rec.pause()
        await G.cap('')
        await pg.evaluate("()=>{window.__hold=0}")
    await attempt(G, rec, report, tutorial)

    await attempt(G, rec, report, lambda: eye_full(G, rec, segs, '火眼金睛', '火眼金睛 <b>一題 8 秒 找第一手</b>'))
    await attempt(G, rec, report, lambda: b4_two(G, rec, segs, '無限之塔', '無限之塔 <b>答對加 20 秒</b>'))
    await menu_card(G, rec, segs, '還有象牙塔 明鏡台 煉獄之門 兩儀殿', secs=3.4)
    await end_card(G, rec, segs, secs=3.4)


# ------------------------------------------------------------------ 版本 B
async def variant_B(G, rec, report):
    pg = G.pg
    segs = report['segs']
    L, aw = await practice_puzzle(G, 7, 9, rank_up=5)
    who = '白先' if aw else '黑先'
    report['B_puzzle'] = {'L': L, 'atkWhite': aw}
    await pg.evaluate(HOLD_JS, 900)
    t0 = rec.vt()
    await rec.resume()
    await G.cap(f'{who} <b>你看得出來嗎</b>', accent=TEAL)
    rec.mark('start')
    await asyncio.sleep(5.0)          # 不落子，畫面停在題目
    segs.append(('亮題不落子', round(rec.vt() - t0, 1)))
    t1 = rec.vt()
    await G.cap('每一手都衝四 <b>對方只能擋</b>', accent=TEAL)
    await pg.evaluate("()=>{window.__pk=g.p}")
    base = await pg.evaluate("()=>g.solved")
    n = 0
    while n < L:
        await G.ready()
        await asyncio.sleep(random.uniform(1.05, 1.2))
        t = await G.move_one()
        assert t, '沒有解'
        n += 1
        if n == L // 2: rec.mark('mid')
    for _ in range(100):
        if (await G.state())['s'] > base: break
        await asyncio.sleep(0.03)
    await asyncio.sleep(0.25)
    rec.mark('win')
    await asyncio.sleep(1.3)          # 停在獲勝回饋＋終局盤面（下一題露出來之前就收）
    segs.append(('一手一手走完', round(rec.vt() - t1, 1)))
    rec.pause()
    await G.cap('')
    await pg.evaluate("()=>{window.__hold=0}")
    await menu_card(G, rec, segs, '還有 <b>6 種玩法</b>', secs=3.5)
    await end_card(G, rec, segs, secs=3.5)


# ------------------------------------------------------------------ 版本 C
async def variant_C(G, rec, report):
    pg = G.pg
    segs = report['segs']
    await G.pick()
    await G.enter('modeE')
    await G.go_and_wait_puzzle()
    t0 = rec.vt()
    await rec.resume()
    rec.mark('start')
    for i in range(3):
        if i == 0: await G.cap('一題 8 秒 <b>只問你第一手</b>', accent=GOLD)
        if i == 2: await G.cap('<b>越答越難</b>', accent=GOLD)
        await G.ready()
        await asyncio.sleep(5.0)       # 倒數讀秒留在畫面上
        ok = await G.move_one(eye=True)
        assert ok, '火眼金睛沒有解'
        await asyncio.sleep(0.12)
        rec.mark(f'eye_win{i + 1}')
        await asyncio.sleep(0.9 if i < 2 else 0.35)   # 前兩題讓遊戲自己換下一題；第三題停在答對回饋就收
    segs.append(('火眼金睛 三題', round(rec.vt() - t0, 1)))
    rec.pause()
    await G.cap('')
    report['C_stats'] = await pg.evaluate("()=>({solved:g.solved, wrong:g.wrong})")
    # 挑戰選單：火眼金睛剛玩過，藏起來就剩 5 種
    await menu_card(G, rec, segs, '還有 <b>5 種挑戰</b>', secs=2.6, hide=['modeE'])
    await end_card(G, rec, segs, secs=2.6)


VARIANTS = {'A': variant_A, 'B': variant_B, 'C': variant_C}


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


async def main(name):
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('本機伺服器 PID', srv.pid, '埠', port)
    bad, log = [], []
    report = {'segs': [], 'server_pid': srv.pid}
    work = tempfile.mkdtemp(prefix='rush_promo_')
    try:
        time.sleep(1.0)
        async with async_playwright() as pw:
            b, pg, cdp = await new_session(pw, f'http://127.0.0.1:{port}', bad, log)
            try:
                rec = Recorder(cdp, pg)
                await rec.start()
                G = Game(pg, rec)
                await VARIANTS[name](G, rec, report)
                await rec.stop()
            finally:
                await b.close()
        mp4 = os.path.join(OUT, f'rush_{name}.mp4')
        dur = rec.render(mp4, work)
        report['virtual_duration'] = round(dur, 2)
        report['captured_frames'] = len(rec.frames)
        report['mp4'] = mp4
        # 代表畫格 6 張：優先取各遊玩片段「答對／獲勝回饋」那一格（rec.mark），不足再用均分補
        times = [(n, min(t + (0.25 if n in ('menu', 'end') else 0), dur - 0.15)) for n, t in rec.marks]
        if len(times) > 6: times = [x for x in times if x[0] != 'start']
        times.sort(key=lambda x: x[1])
        k = 0
        while len(times) < 6:
            k += 1
            times.append((f'even{k}', dur * (0.08 + 0.17 * k)))
        times = sorted(times[:6], key=lambda x: x[1]) if len(rec.marks) <= 6 else times[:6]
        report['frames'] = []
        for k, (n, t) in enumerate(times, 1):
            png = os.path.join(OUT, f'rush_{name}_{k}.png')
            subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', mp4, '-frames:v', '1', png], check=True)
            report['frames'].append((png, n, round(t, 2)))
    finally:
        srv.terminate()
        try: srv.wait(timeout=10)
        except Exception: srv.kill()
        print('伺服器 PID', srv.pid, '已結束' if srv.poll() is not None else '未結束！')
        shutil.rmtree(work, ignore_errors=True)
    report['blocked_non_get'] = bad
    report['get_hosts'] = sorted({u.split('/')[2] for u in log})
    print(json.dumps(report, ensure_ascii=False, indent=1))
    pr = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,pix_fmt,codec_name:format=duration,size',
                         '-of', 'default=nw=1', report['mp4']], capture_output=True, text=True)
    print(pr.stdout)


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'A'))
