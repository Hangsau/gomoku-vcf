#!/usr/bin/env python3
"""VCF 教學端到端測試：從首頁進教學 → 開場 → 教學盤 → 依資料檔自動作答做完所有有內容的課。
每個畫面量 #learn 內容有沒有超出一屏（.lbody 內容高度 > 可用高度、或底部按鈕超出視窗），收 console 錯誤。
用法：python C:/claudehome/projects/VCF/tools/test_learn.py [zh|en|ja|ko] [寬x高]
"""
import json, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
D = json.loads((ROOT / 'game/learn/lessons.json').read_text(encoding='utf-8'))
lang = next((a for a in sys.argv[1:] if a in ('zh', 'en', 'ja', 'ko')), 'zh')
vp = next((tuple(map(int, a.split('x'))) for a in sys.argv[1:] if 'x' in a), (375, 667))
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
issues, errs = [], []

def overflow(pg, where):
    r = pg.evaluate("""() => { const b = document.querySelector('#learn .lbody'), f = document.querySelector('#learn .lfoot');
      if (!b) return null; const fr = f.getBoundingClientRect();
      return { over: b.scrollHeight - b.clientHeight, footOut: fr.bottom - innerHeight, page: document.documentElement.scrollHeight - innerHeight }; }""")
    if r and (r['over'] > 1 or r['footOut'] > 1 or r['page'] > 1): issues.append(f'{where}：超出 {r}')

def tap(pg, t): pg.click(f'#learn .lhit[aria-label="{t}"]', force=True)
def btn(pg, timeout=8000):
    pg.wait_for_selector('#learn .lfoot .lbtn:not([disabled])', timeout=timeout); pg.click('#learn .lfoot .lbtn:not([disabled])')

try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': vp[0], 'height': vp[1]})
        ctx.add_init_script(f"try{{localStorage.setItem('vcfgame.lang','{lang}');localStorage.removeItem('vcfgame.learn')}}catch(e){{}}")
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
        pg.goto(f'http://127.0.0.1:{port}/game.html'); pg.wait_for_timeout(800)
        home = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
        if home > 1: issues.append(f'首頁多了教學卡後超出 {home}px')
        pg.click('#toLearn'); pg.wait_for_timeout(1700)
        O = D['opening']; line = O['line']; five = O['five']
        atk, dfn = line[0::2], line[1::2]
        overflow(pg, '開場防守')
        for i in range(len(atk)):
            pg.wait_for_timeout(500)
            tap(pg, dfn[i] if i < len(dfn) else five[0]); pg.wait_for_timeout(1100)
        overflow(pg, '開場輸了')
        btn(pg)                                   # 倒帶看看
        btn(pg, timeout=15000)                    # 開始
        for i in range(len(atk)):
            pg.wait_for_timeout(300); tap(pg, atk[i]); pg.wait_for_timeout(1500)
        overflow(pg, '開場進攻')
        tap(pg, five[1]); pg.wait_for_timeout(900)
        btn(pg); pg.wait_for_timeout(1200); overflow(pg, '開場拉遠')
        btn(pg); pg.wait_for_timeout(600); overflow(pg, '教學盤')
        done = 0
        for l in D['lessons']:
            if not l['steps']: break
            btn(pg); pg.wait_for_timeout(400)     # 落下這一子
            for k, st in enumerate(l['steps']):
                where = f"{l['id']} 第 {k + 1} 步（{st['type']}）"
                pg.wait_for_timeout(300); overflow(pg, where)
                T = st['type']
                if T == 'say': btn(pg)
                elif T == 'choose': pg.click(f'#learn .lopt >> nth={st["ans"]}'); btn(pg)
                elif T == 'predict': pg.wait_for_timeout(700); tap(pg, st['ans'][0]); pg.wait_for_timeout(1100); btn(pg)
                elif T == 'tap' and st.get('all'):
                    for a in st['ans']: tap(pg, a); pg.wait_for_timeout(250)
                    btn(pg)
                elif T == 'tap':
                    tap(pg, 'H8' if st['kind'] == 'free' else st['ans'][0]); pg.wait_for_timeout(1500 if st['kind'] == 'free' else 700); btn(pg)
                elif T == 'solve':   # 照驗證過的手順下，電腦用引擎擋
                    for j in range(0, len(st['line']), 2):
                        pg.wait_for_timeout(300); tap(pg, st['line'][j]); pg.wait_for_timeout(1600)
                    pg.wait_for_function("document.querySelectorAll('#learn .lfoot .lbtn').length === 1", timeout=20000)   # 解完才只剩「下一步」；別按到退一手
                    overflow(pg, where + ' 解完'); btn(pg, timeout=12000)
                elif T == 'rewind':
                    ln = st['line'] + [st['five'][0], st['five'][1]]
                    btn(pg)                       # 倒帶一手
                    for j in range(len(ln) - 1, -1, -1):
                        pg.wait_for_timeout(750); overflow(pg, where + f' 倒帶到第 {j + 1} 手')
                        tap(pg, ln[j] if j % 2 == 0 else ln[j - 1]); pg.wait_for_timeout(400)
                        btn(pg)
                    for j in range(0, len(ln), 2):
                        pg.wait_for_timeout(300); tap(pg, ln[j]); pg.wait_for_timeout(1400)
                    overflow(pg, where + ' 正著下完'); btn(pg)
            pg.wait_for_timeout(700); overflow(pg, f"{l['id']} 完成後回教學盤")
            done += 1
        stones = pg.evaluate("document.querySelectorAll('#learn .lst').length")
        if done == sum(1 for l in D['lessons'] if l['steps']):   # 全部做完 → 畢業考：照教學盤正解下完
            btn(pg); pg.wait_for_timeout(800); overflow(pg, '畢業考')
            sol = D['board']['sol']
            for j in range(0, len(sol), 2):
                tap(pg, sol[j]); pg.wait_for_timeout(2200)
            pg.wait_for_function("document.querySelectorAll('#learn .lfoot .lbtn').length === 1", timeout=20000)
            grad = pg.evaluate("(document.querySelector('#learn .lmsg .tag')||{}).textContent")
            if not pg.evaluate("JSON.parse(localStorage.getItem('vcfgame.learn')).graduated === true"): issues.append(f'畢業考沒有過關（訊息：{grad}）')
            overflow(pg, '畢業')
        prog = pg.evaluate("localStorage.getItem('vcfgame.learn')")
        print(f'{lang} {vp}：做完 {done} 課，教學盤子數 {stones}，進度 {prog}')
        br.close()
finally:
    srv.terminate()
for i in issues: print('問題', i)
for e in errs: print('console', e)
print('問題數', len(issues), 'console 錯誤', len(errs))
