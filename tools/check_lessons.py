#!/usr/bin/env python3
"""VCF 教學資料檢查（W1，2026-11-10）。

用法（在任何目錄）：
    python C:/claudehome/projects/VCF/tools/check_lessons.py            # 檢查 game/learn/lessons.json
    python C:/claudehome/projects/VCF/tools/check_lessons.py --langs     # 另外要求四語文字齊全（上線前用）

做什麼：
  1. 結構：課程 id 不重複、單元 1–9、每課每步有必填欄位、中文文字必填。
  2. 教學盤：32 子、黑白各 16、落子順序剛好用完每顆子一次、每課對到一顆子；
     引擎驗證整盤是唯一解、手數與宣告相同。
  3. 每一步的盤面（9×9 局部）：
       solve / rewind：引擎唯一解、手數相同、逐手重放每步擋點一致、最後真的贏；
                       每一手的 accept（可接受的點）＝引擎判定會照劇本贏的點，兩者要完全相同
       tap(kind=five)：答案＝下了會連成五的所有點（黑剛好五）
       tap(kind=block)：答案＝對方下了會連成五、所以必須擋的所有點
       tap(kind=four)：答案＝下了會成四的所有點（引擎 move 不回 notfour／forbidden／illegal）
       predict：答案＝引擎 move 回傳的擋點
       choose：只檢查 ans 在選項裡
     所有子、答案、解都要在 9×9 框內。
引擎：用 Playwright 開本機 game.html，在頁面裡呼叫 solveFrom()／move()（跟正式遊戲同一顆 WebAssembly）。
所有 POST 攔截，不會碰正式伺服器。
"""
import json, socket, subprocess, sys, time, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'learn' / 'lessons.json'
COLS = 'ABCDEFGHJKLMNOP'
LANGS = ('zh', 'en', 'ja', 'ko')
STEP_TYPES = {'say', 'tap', 'predict', 'choose', 'solve', 'rewind', 'replay', 'opening'}

errors, warns = [], []
def err(where, msg): errors.append(f'{where}：{msg}')
def warn(where, msg): warns.append(f'{where}：{msg}')

def xy(t):
    if not isinstance(t, str) or len(t) < 2 or t[0] not in COLS or not t[1:].isdigit() or not 1 <= int(t[1:]) <= 15:
        raise ValueError(f'座標格式不對：{t!r}')
    return COLS.index(t[0]), int(t[1:]) - 1

def fives(own, opp, black):
    """own 下了會連成五的空點（黑剛好五、白五以上）"""
    S = {xy(t) for t in own}; occ = S | {xy(t) for t in opp}; out = set()
    for x in range(15):
        for y in range(15):
            if (x, y) in occ: continue
            for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
                n = 1
                for sgn in (1, -1):
                    k = 1
                    while (x + sgn * dx * k, y + sgn * dy * k) in S: n += 1; k += 1
                if (n == 5) if black else (n >= 5): out.add(COLS[x] + str(y + 1)); break
    return out

def in_window(where, pts, win):
    if not win: return
    ox, oy = xy(win)
    for t in pts:
        x, y = xy(t)
        if not (ox <= x < ox + 9 and oy <= y < oy + 9): err(where, f'{t} 不在 9×9 框內（左下角 {win}）')

def text_ok(where, obj, need_langs):
    if not isinstance(obj, dict) or not obj.get('zh'): err(where, '缺中文文字'); return
    if need_langs:
        for l in LANGS:
            if not obj.get(l): err(where, f'缺 {l} 文字')
    else:
        miss = [l for l in LANGS if not obj.get(l)]
        if miss: warn(where, '尚缺 ' + '/'.join(miss))

class Engine:
    def __init__(self):
        from playwright.sync_api import sync_playwright
        s = socket.socket(); s.bind(('127.0.0.1', 0)); self.port = s.getsockname()[1]; s.close()
        self.srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(self.port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.8)
        self.pw = sync_playwright().start(); self.br = self.pw.chromium.launch(); self.pg = self.br.new_page()
        self.pg.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
        self.pg.goto(f'http://127.0.0.1:{self.port}/game.html'); self.pg.wait_for_function('typeof solveFrom === "function" && typeof move === "function"', timeout=20000)
    def solve(self, b, w, aw):
        return self.pg.evaluate('([b,w,aw])=>solveFrom(b,w,aw)', [' '.join(b), ' '.join(w), aw])['result']
    def move(self, b, w, t, aw):
        return self.pg.evaluate('([b,w,t,aw])=>move(b,w,t,aw)', [' '.join(b), ' '.join(w), t, aw])['result']
    def close(self):
        self.br.close(); self.pw.stop(); self.srv.terminate()

def check_line(E, where, pos, step):
    """solve／rewind：驗唯一解與逐手重放；每手 accept 要等於引擎判定照劇本會贏的點"""
    B, W = list(pos['b']), list(pos['w']); aw = pos.get('atk', 'b') == 'w'
    atk, dfn = (W, B) if aw else (B, W)
    r = E.solve(B, W, aw)
    if not r.get('vcf'): err(where, '引擎說沒有 VCF'); return
    if not r.get('unique'): err(where, '引擎說答案不唯一')
    if not r.get('legal'): err(where, '盤面不合法')
    if step.get('L') is not None and r.get('L') != step['L']: err(where, f'手數宣告 {step["L"]}，引擎是 {r.get("L")}')
    sol = r['solution'].split('(')[0].split()
    want = step.get('line')
    if want and want[:len(sol)] != sol: err(where, f'手順宣告 {" ".join(want)}，引擎正解 {" ".join(sol)}')
    accepts = step.get('accept') or {}
    a, d = list(atk), list(dfn)
    for i in range(0, len(sol), 2):
        mv = sol[i]; last = i == len(sol) - 1
        if str(i // 2) in accepts:   # 這一手宣告的可接受點，要跟引擎判定完全一樣
            region = window_points(pos.get('win'))
            okset = set()
            for t in region:
                if t in a or t in d: continue
                bb, ww = (d, a) if aw else (a, d)
                m = E.move(bb, ww, t, aw)
                if (last and m.get('r') == 'win') or (not last and t == mv):
                    okset.add(t)
            if set(accepts[str(i // 2)]) != okset: err(where, f'第 {i // 2 + 1} 手可接受點宣告 {sorted(accepts[str(i // 2)])}，引擎 {sorted(okset)}')
        bb, ww = (d, a) if aw else (a, d)
        m = E.move(bb, ww, mv, aw)
        a.append(mv)
        if last:
            if m.get('r') != 'win': err(where, f'最後一手 {mv} 引擎回 {m.get("r")}，不是 win')
        else:
            if m.get('r') != 'block' or m.get('def') != sol[i + 1]: err(where, f'第 {i // 2 + 1} 手 {mv} 引擎回 {m}，跟正解擋點 {sol[i + 1]} 不同')
            d.append(sol[i + 1])
    fv = fives(a, d, not aw)
    if step.get('five') and set(step['five']) != fv: err(where, f'成五點宣告 {step["five"]}，算出 {sorted(fv)}')
    in_window(where, B + W + sol + sorted(fv), pos.get('win'))

def window_points(win):
    if not win: return [COLS[x] + str(y + 1) for x in range(15) for y in range(15)]
    ox, oy = xy(win)
    return [COLS[x] + str(y + 1) for x in range(ox, min(15, ox + 9)) for y in range(oy, min(15, oy + 9))]

def check_step(E, where, st):
    typ = st.get('type')
    if typ not in STEP_TYPES: err(where, f'不認得的步驟類型 {typ!r}'); return
    pos = st.get('pos')
    if typ in ('solve', 'rewind', 'opening'):
        if not pos: err(where, '缺 pos'); return
        if typ == 'solve' and st.get('finish') == 'forbid':   # 逼禁收尾：最後一手引擎要回「禁手」勝
            r = E.solve(pos['b'], pos['w'], pos.get('atk') == 'w')
            if not (r.get('vcf') and r.get('unique') and r.get('L') == st.get('L')): err(where, f'逼禁題：引擎 vcf={r.get("vcf")} unique={r.get("unique")} L={r.get("L")}'); return
            sol = r['solution'].split('(')[0].split()
            if st.get('line') and st['line'] != sol: err(where, f'逼禁題手順宣告 {st["line"]}，引擎 {sol}')
            a, d = list(pos['w']), list(pos['b'])
            for i in range(0, len(sol), 2):
                m = E.move(d, a, sol[i], True)
                if i == len(sol) - 1 and not ('禁' in (m.get('how') or '')): err(where, f'逼禁題最後一手 {sol[i]} 引擎回 {m}')
                a.append(sol[i])
                if i + 1 < len(sol): d.append(sol[i + 1])
            if pos.get('win'): in_window(where, list(pos['b']) + list(pos['w']) + sol, pos['win'])
            return
        check_line(E, where, pos, st); return
    if typ in ('tap', 'predict'):
        if not pos: err(where, '缺 pos'); return
        B, W = pos['b'], pos['w']; aw = pos.get('atk', 'b') == 'w'
        ans = set(st.get('ans') or [])
        if st.get('kind') == 'free': in_window(where, list(B) + list(W), pos.get('win')); return   # 自由落子，不判
        if not ans: err(where, '缺 ans'); return
        if st.get('kind') == 'coord':   # 點出指定座標：答案只能一個點，且要是空點
            if len(ans) != 1 or (ans & set(B) | ans & set(W)): err(where, '座標題答案要剛好一個空點')
            in_window(where, list(B) + list(W) + sorted(ans), pos.get('win')); return
        in_window(where, list(B) + list(W) + sorted(ans), pos.get('win'))
        if typ == 'predict':
            m = E.move(B, W, st['play'], aw)
            if m.get('r') != 'block' or {m.get('def')} != ans: err(where, f'預測題：下 {st["play"]} 後引擎擋 {m.get("def")}（{m.get("r")}），答案寫 {sorted(ans)}')
            if st.get('counter'):   # 反四示範：擋子要真的做出四（標的點＝守方成五點），而且之後攻方贏不了
                atk2 = (list(W) if aw else list(B)) + [st['play']]; dfn2 = (list(B) if aw else list(W)) + [m.get('def')]
                cf = fives(dfn2, atk2, aw)
                if cf != set(st['counter']): err(where, f'反四示範：守方成五點算出 {sorted(cf)}，寫 {st["counter"]}')
                b2, w2 = (dfn2, atk2) if aw else (atk2, dfn2)
                if E.solve(b2, w2, aw).get('vcf'): err(where, '反四示範：順序錯之後引擎說還能贏，示範不成立')
                in_window(where, sorted(cf), pos.get('win'))
            return
        kind = st.get('kind')
        own, opp = (W, B) if aw else (B, W)
        if kind == 'five':
            got = fives(own, opp, not aw)
        elif kind == 'block':   # 玩家當守方：要擋的就是攻方（pos.atk）下了會成五的點
            got = fives(own, opp, not aw)
        elif kind == 'four':
            got = set()
            for t in window_points(pos.get('win')):
                if t in B or t in W: continue
                m = E.move(B, W, t, aw)
                if m.get('r') not in ('notfour', 'forbidden', 'illegal', 'forcedForbidden'): got.add(t)
        elif kind == 'first':   # 點出這題 VCF 的第一手（唯一解）
            r = E.solve(B, W, aw)
            if not (r.get('vcf') and r.get('unique')): err(where, 'first 題：引擎說沒有唯一 VCF'); return
            got = {r['solution'].split()[0]}
        elif kind == 'free':
            return   # 自由點選（例如 1-1 隨意落子），不判
        else:
            err(where, f'tap 缺 kind（five／block／four／free）'); return
        if kind != 'free' and got != ans and not (st.get('any') and ans <= got and ans):
            err(where, f'{kind} 題答案寫 {sorted(ans)}，算出 {sorted(got)}')
        return
    if typ == 'choose':
        opts = st.get('options') or []
        if st.get('ans') not in range(len(opts)): err(where, 'choose 的 ans 不是選項編號')
        if st.get('isFour'):   # 認四題：攻方這些子有沒有「下一顆就成五」的點，要跟答案一致（選項 0＝是四）
            aw = pos.get('atk') == 'w'; own, opp = (pos['w'], pos['b']) if aw else (pos['b'], pos['w'])
            has = bool(fives(own, opp, not aw))
            if has != (st.get('ans') == 0): err(where, f'認四題：成五點 {sorted(fives(own, opp, not aw))}，答案寫 {"是" if st.get("ans") == 0 else "不是"}四')
            in_window(where, list(pos['b']) + list(pos['w']), pos.get('win'))
        if st.get('probe'):   # 禁手判斷題：probe 那一點黑下去是不是禁手，要跟答案一致（選項 0＝是禁手）
            if not pos: err(where, 'probe 題缺 pos'); return
            m = E.move(pos['b'], pos['w'], st['probe'], False)
            forb = m.get('r') == 'forbidden'
            if forb != (st.get('ans') == 0): err(where, f'禁手判斷題：{st["probe"]} 引擎回 {m.get("r")}，答案寫 {"是" if st.get("ans") == 0 else "不是"}禁手')
            in_window(where, list(pos['b']) + list(pos['w']) + [st['probe']], pos.get('win'))

def main():
    need_langs = '--langs' in sys.argv
    files = [a for a in sys.argv[1:] if a.endswith('.json')]   # 可指定別的資料檔（測試用）
    D = json.loads((Path(files[0]) if files else DATA).read_text(encoding='utf-8'))
    lessons = D.get('lessons', [])
    ids = [l.get('id') for l in lessons]
    for i in set(ids):
        if ids.count(i) > 1: err('課程', f'id 重複：{i}')
    E = Engine()
    try:
        # 教學盤
        bd = D.get('board') or {}
        B, W, order = bd.get('b', []), bd.get('w', []), bd.get('order', [])
        if len(B) != 16 or len(W) != 16: err('教學盤', f'子數 黑 {len(B)} 白 {len(W)}，應各 16')
        placed = [o.get('t') for o in order]
        if sorted(placed) != sorted(B + W): err('教學盤', '落子順序沒有剛好用完每顆子一次')
        for o in order:
            if o.get('lesson') != 'opening' and o.get('lesson') not in ids: err('教學盤', f'{o.get("t")} 對到不存在的課 {o.get("lesson")}')
            if (o.get('t') in B) != (o.get('c') == 'b'): err('教學盤', f'{o.get("t")} 顏色標錯')
        placing = [l['id'] for l in lessons if not l.get('noStone')]
        if sorted(o.get('lesson') for o in order if o.get('lesson') != 'opening') != sorted(placing): err('教學盤', '每課（除了不落子的課）要剛好對到一顆子')
        r = E.solve(B, W, False)
        if not (r.get('vcf') and r.get('unique') and r.get('legal')): err('教學盤', f'引擎驗證失敗：vcf={r.get("vcf")} unique={r.get("unique")} legal={r.get("legal")}')
        if bd.get('L') and r.get('L') != bd['L']: err('教學盤', f'手數宣告 {bd["L"]}，引擎 {r.get("L")}')
        # 每課
        for l in lessons:
            lw = f'課 {l.get("id")}'
            if not isinstance(l.get('unit'), int) or not 1 <= l['unit'] <= 9: err(lw, 'unit 要是 1–9')
            text_ok(lw + ' 課名', l.get('title'), need_langs)
            steps = l.get('steps') or []
            if not steps: warn(lw, '還沒有步驟')
            for k, st in enumerate(steps):
                sw = f'{lw} 第 {k + 1} 步'
                text_ok(sw, st.get('text'), need_langs)
                try: check_step(E, sw, st)
                except ValueError as e: err(sw, str(e))
    finally:
        E.close()
    for w_ in warns: print('提醒', w_)
    for e in errors: print('錯誤', e)
    print(f'檢查完：{len(lessons)} 課，錯誤 {len(errors)}，提醒 {len(warns)}')
    sys.exit(1 if errors else 0)

if __name__ == '__main__':
    main()
