#!/usr/bin/env python3
"""挖「順序一錯就被反四」的短題（第二個參數 b／w 選黑先或白先，預設 b；第三個參數 hit＝改挖「被反四但擋的那手也是自己的四、還能贏」的反擊題，全部相關點都要放得進 9×9）（第 6 單元用）：題庫黑先 4 手題截短成 2–3 手，
先下第二手（順序顛倒）→ 白的擋子做出四（反四），而且之後黑就贏不了。全部用引擎驗證。
輸出：docs/design/tutorial-2026-11-10/verify/counter_black.json（每找到一題就寫盤）
用法：python C:/claudehome/projects/VCF/tools/mine_counter_black.py [抽幾道，預設 3000]
"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_lessons import Engine, fives, COLS, has_vcf

ROOT = Path(__file__).resolve().parent.parent
HIT = len(sys.argv) > 3 and sys.argv[3] == 'hit'
OUT = ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify' / (f"counter_hitback_{sys.argv[2]}.json" if HIT else 'counter_black.json' if len(sys.argv) <= 2 or sys.argv[2] == 'b' else 'counter_white.json')
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
ATK = sys.argv[2] if len(sys.argv) > 2 else 'b'
AW = ATK == 'w'
xy = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
random.seed(1110)
pool = [x for k in range(1, 11) for x in json.loads((ROOT / 'game' / 'p' / f'{k}.json').read_text(encoding='utf-8')) if x[2] == 4 and x[4] == ATK]
picks = random.sample(pool, min(N, len(pool)))
out = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else []
E = Engine()
try:
    for n, x in enumerate(picks):
        B, W = x[0].split(), x[1].split()
        r0 = E.solve(B, W, AW)
        if not (r0.get('vcf') and r0.get('unique') and r0.get('L') == 4): continue
        sol = r0['solution'].split('(')[0].split()
        b, w = list(B), list(W)
        a_, d_ = (w, b) if AW else (b, w)
        for cut in (1, 2):
            a_.append(sol[2 * cut - 2]); d_.append(sol[2 * cut - 1])
            r = E.solve(b, w, AW)
            if not (r.get('vcf') and r.get('unique') and r.get('L') == 4 - cut): continue
            s2 = r['solution'].split('(')[0].split()
            if len(s2) < 3: continue
            m2 = E.move(b, w, s2[2], AW)                        # 顛倒順序：先下第二手
            if m2.get('r') != 'block': continue
            d = m2['def']; cf = fives(d_ + [d], a_ + [s2[2]], AW)
            if not cf: continue
            b2, w2 = (b + [d], w + [s2[2]]) if AW else (b + [s2[2]], w + [d])
            if HIT:   # 反擊題：只有一個成五點、擋它那手剛好是自己的四、之後還能贏
                if len(cf) != 1 or E.move(b2, w2, sorted(cf)[0], AW).get('r') not in ('block', 'win') or not has_vcf(E, b2, w2, AW): continue
            else:
                if has_vcf(E, b2, w2, AW): continue                 # 順序錯了要真的贏不了（補過盲點的判斷）
                if E.move(b2, w2, sorted(cf)[0], AW).get('r') in ('block', 'win'): continue   # 擋他成五點那手不能又是自己的四
            rf = set()   # 每個第一手四、對方擋下後的成五點都要看得到
            for x_ in range(15):
                for y_ in range(15):
                    t_ = COLS[x_] + str(y_ + 1)
                    if t_ in b or t_ in w: continue
                    mm = E.move(b, w, t_, AW)
                    if mm.get('r') == 'block': rf |= set(fives(d_ + [mm['def']], a_ + [t_], AW))
            # 最後成五點也要算進 9×9
            fa = (w if AW else b) + s2[0::2]; fd = (b if AW else w) + s2[1::2]
            pts = [xy(t) for t in b + w + s2 + sorted(cf) + sorted(fives(fa, fd, not AW)) + sorted(rf)]
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            if max(xs) - min(xs) > 8 or max(ys) - min(ys) > 8: continue
            out.append({'src': x[5], 'atk': ATK, 'L': 4 - cut, 'b': list(b), 'w': list(w), 'sol': s2, 'wrong': s2[2], 'def': d, 'counterFive': sorted(cf), 'n': len(b) + len(w)})
            OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
            print('找到', x[5], 'L', 4 - cut, flush=True)
        if n % 100 == 0: print(n, '/', len(picks), '已找到', len(out), flush=True)
finally:
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8'); E.close()
print('完成，共', len(out))
