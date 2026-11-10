#!/usr/bin/env python3
"""第 5–9 單元挖題（W11）：從題庫 4 手題（黑先、白先）照正解走掉前 k 手 → 剩 1–3 手的短題，
每題用引擎驗證（唯一、合法、逐手重放），並記下特徵：反四 counter、解禁 lifts、陷阱 trap、禁點 forbidden、
收尾 finish，以及能不能放進 9×9 框（連最後成五點）。
輸出：docs/design/tutorial-2026-11-10/verify/mined.json（每完成一題就寫盤）
用法：python C:/claudehome/projects/VCF/tools/mine_lessons.py [每色取幾道，預設 500]
"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_lessons import Engine, fives, COLS   # 同一套引擎呼叫

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify' / 'mined.json'
N = int(sys.argv[1]) if len(sys.argv) > 1 else 500
xy = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
random.seed(20261110)
pool = {'b': [], 'w': []}
for k in range(1, 11):
    for x in json.loads((ROOT / 'game' / 'p' / f'{k}.json').read_text(encoding='utf-8')):
        if x[2] == 4: pool[x[4]].append(x)
picks = random.sample(pool['b'], min(N, len(pool['b']))) + random.sample(pool['w'], min(N, len(pool['w'])))
out = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else []
seen = {(m['src'], m['L']) for m in out}
E = Engine()
try:
    for n, x in enumerate(picks):
        aw = x[4] == 'w'
        B, W = x[0].split(), x[1].split()
        r0 = E.solve(B, W, aw)
        if not (r0.get('vcf') and r0.get('unique') and r0.get('L') == 4): continue
        sol = r0['solution'].split('(')[0].split()
        a, d = (list(W), list(B)) if aw else (list(B), list(W))
        for cut in (1, 2, 3):
            a.append(sol[2 * cut - 2]); d.append(sol[2 * cut - 1])
            L = 4 - cut
            if (x[5], L) in seen: continue
            bb, ww = (d, a) if aw else (a, d)
            r = E.solve(bb, ww, aw)
            if not (r.get('vcf') and r.get('unique') and r.get('legal') and r.get('L') == L): continue
            s2 = r['solution'].split('(')[0].split()
            aa, dd, ok = list(a), list(d), True
            for i in range(0, len(s2), 2):
                b2, w2 = (dd, aa) if aw else (aa, dd)
                m = E.move(b2, w2, s2[i], aw); aa.append(s2[i])
                if i + 1 < len(s2):
                    if m.get('r') != 'block' or m.get('def') != s2[i + 1]: ok = False; break
                    dd.append(s2[i + 1])
                elif m.get('r') != 'win': ok = False
            if not ok: continue
            fv = sorted(fives(aa, dd, not aw))
            pts = [xy(t) for t in bb + ww + s2 + fv]
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            f = r.get('facts', {})
            out.append({'src': x[5], 'srcScore': x[3], 'atk': x[4], 'L': L, 'b': list(bb), 'w': list(ww), 'sol': s2, 'five': fv,
                        'fit9': max(xs) - min(xs) <= 8 and max(ys) - min(ys) <= 8, 'n': len(bb) + len(ww),
                        'counter': f.get('counter', 0), 'trap': f.get('trap', 0), 'lifts': [l.get('at') for l in (f.get('lifts') or [])],
                        'forb': r.get('forbidden') or [], 'finish': r['solution'].split('(')[-1].rstrip(')') if '(' in r['solution'] else '', 'score': r.get('score')})
            seen.add((x[5], L))
        if n % 20 == 0:
            OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
            print(n, '/', len(picks), '已收', len(out), flush=True)
finally:
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    E.close()
print('完成，共', len(out))
