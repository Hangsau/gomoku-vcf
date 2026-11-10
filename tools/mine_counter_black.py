#!/usr/bin/env python3
"""挖「黑先、順序一錯就被反四」的短題（第 6 單元用）：題庫黑先 4 手題截短成 2–3 手，
先下第二手（順序顛倒）→ 白的擋子做出四（反四），而且之後黑就贏不了。全部用引擎驗證。
輸出：docs/design/tutorial-2026-11-10/verify/counter_black.json（每找到一題就寫盤）
用法：python C:/claudehome/projects/VCF/tools/mine_counter_black.py [抽幾道，預設 3000]
"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_lessons import Engine, fives, COLS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify' / 'counter_black.json'
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
xy = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
random.seed(1110)
pool = [x for k in range(1, 11) for x in json.loads((ROOT / 'game' / 'p' / f'{k}.json').read_text(encoding='utf-8')) if x[2] == 4 and x[4] == 'b']
picks = random.sample(pool, min(N, len(pool)))
out = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else []
E = Engine()
try:
    for n, x in enumerate(picks):
        B, W = x[0].split(), x[1].split()
        r0 = E.solve(B, W, False)
        if not (r0.get('vcf') and r0.get('unique') and r0.get('L') == 4): continue
        sol = r0['solution'].split('(')[0].split()
        b, w = list(B), list(W)
        for cut in (1, 2):
            b.append(sol[2 * cut - 2]); w.append(sol[2 * cut - 1])
            r = E.solve(b, w, False)
            if not (r.get('vcf') and r.get('unique') and r.get('L') == 4 - cut): continue
            s2 = r['solution'].split('(')[0].split()
            if len(s2) < 3: continue
            m2 = E.move(b, w, s2[2], False)                     # 顛倒順序：先下第二手
            if m2.get('r') != 'block': continue
            d = m2['def']; cf = fives(w + [d], b + [s2[2]], False)
            if not cf: continue
            after = E.solve(b + [s2[2]], w + [d], False)
            if after.get('vcf'): continue
            pts = [xy(t) for t in b + w + s2 + sorted(cf)]
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            if max(xs) - min(xs) > 8 or max(ys) - min(ys) > 8: continue
            out.append({'src': x[5], 'atk': 'b', 'L': 4 - cut, 'b': list(b), 'w': list(w), 'sol': s2, 'wrong': s2[2], 'def': d, 'counterFive': sorted(cf), 'n': len(b) + len(w)})
            OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
            print('找到', x[5], 'L', 4 - cut, flush=True)
        if n % 100 == 0: print(n, '/', len(picks), '已找到', len(out), flush=True)
finally:
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8'); E.close()
print('完成，共', len(out))
