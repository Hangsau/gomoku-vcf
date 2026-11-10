# 從題庫低分 4 手題（黑先）截短：走掉前 k 手 → 剩 L=4-k 手；引擎驗唯一、逐手重放；整盤＋解＋成五點要放得進 9×9
import json
from playwright.sync_api import sync_playwright
BANK = 'C:/claudehome/projects/VCF/game/p'; COLS = 'ABCDEFGHJKLMNOP'
xy = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
def fives(B, W, black=True):   # 下了會連成五的空點（黑：剛好五）
    S = set(B); occ = S | set(W); out = []
    for x in range(15):
        for y in range(15):
            if (x, y) in occ: continue
            for dx, dy in ((1,0),(0,1),(1,1),(1,-1)):
                n = 1; k = 1
                while (x+dx*k, y+dy*k) in S: n += 1; k += 1
                k = 1
                while (x-dx*k, y-dy*k) in S: n += 1; k += 1
                if (n == 5) if black else (n >= 5): out.append((x, y)); break
    return out
pool = []
for k in range(1, 4):
    for x in json.load(open(f'{BANK}/{k}.json', encoding='utf-8')):
        if x[2] == 4 and x[4] == 'b': pool.append(x)
pool.sort(key=lambda x: (x[3], len(x[0].split()) + len(x[1].split())))
print('pool', len(pool), 'lowest scores', [p[3] for p in pool[:5]])
res = {3: [], 2: []}
with sync_playwright() as pw:
    br = pw.chromium.launch(); pg = br.new_page()
    pg.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pg.goto('http://localhost:8765/game.html'); pg.wait_for_timeout(800)
    SOL = lambda b, w: pg.evaluate("([b,w])=>solveFrom(b,w,false)", [b, w])['result']
    MV = lambda b, w, t: pg.evaluate("([b,w,t])=>move(b,w,t,false)", [b, w, t])['result']
    tried = 0
    for x in pool[:400]:
        if len(res[3]) >= 8 and len(res[2]) >= 8: break
        B = x[0].split(); W = x[1].split()
        r0 = SOL(' '.join(B), ' '.join(W)); tried += 1
        if not (r0.get('vcf') and r0.get('unique') and r0.get('L') == 4): continue
        seq = r0['solution'].split('(')[0].split()
        b, w = list(B), list(W)
        for cut in (1, 2):
            b.append(seq[2*cut-2]); w.append(seq[2*cut-1])
            L = 4 - cut
            if len(res[L]) >= 8: continue
            r = SOL(' '.join(b), ' '.join(w))
            if not (r.get('vcf') and r.get('unique') and r.get('L') == L and r.get('legal')): continue
            s2 = r['solution'].split('(')[0].split()
            # 逐手重放
            bb, ww, ok = list(b), list(w), True
            for i in range(0, len(s2), 2):
                m = MV(' '.join(bb), ' '.join(ww), s2[i]); bb.append(s2[i])
                if i + 1 < len(s2):
                    if m['r'] != 'block' or m.get('def') != s2[i+1]: ok = False; break
                    ww.append(s2[i+1])
                elif m['r'] != 'win': ok = False
            if not ok: continue
            five = fives([xy(t) for t in bb], [xy(t) for t in ww])
            pts = [xy(t) for t in b + w + s2] + five
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            if max(xs) - min(xs) > 8 or max(ys) - min(ys) > 8: continue
            res[L].append(dict(src=x[5], srcScore=x[3], b=b[:], w=w[:], sol=s2, five=[COLS[p[0]] + str(p[1]+1) for p in five], n=len(b)+len(w), facts=r.get('facts', {}), score=r.get('score')))
    br.close()
print('tried', tried)
for L in (3, 2):
    print('== L', L, len(res[L]))
    for c in res[L]: print(' src', c['src'], c['srcScore'], 'stones', c['n'], 'sol', ' '.join(c['sol']), 'five', c['five'], 'counter', c['facts'].get('counter'), 'trap', c['facts'].get('trap'), 'lifts', len(c['facts'].get('lifts') or []))
json.dump(res, open('short_lessons.json', 'w', encoding='utf-8'), ensure_ascii=False)
