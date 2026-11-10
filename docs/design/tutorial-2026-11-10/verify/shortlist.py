import json, math, sys
BANK = 'C:/claudehome/projects/VCF/game/p'
COLS = 'ABCDEFGHJKLMNOP'
def xy(t): return COLS.index(t[0]), int(t[1:]) - 1
rows = []
for k in range(1, 11):
    for x in json.load(open(f'{BANK}/{k}.json', encoding='utf-8')):
        if x[2] != 4 or x[4] != 'b': continue
        B = x[0].split(); W = x[1].split()
        if len(B) + len(W) != 32: continue
        P = [xy(t) for t in B + W]
        cx = sum(p[0] for p in P) / 32; cy = sum(p[1] for p in P) / 32
        cdist = math.hypot(cx - 7, cy - 7)
        edge = min(min(p[0], p[1], 14 - p[0], 14 - p[1]) for p in P)
        S = set(P)
        nb = [sum((p[0] + dx, p[1] + dy) in S for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy) for p in P]
        lonely = sum(1 for n in nb if n == 0)
        conn = sum(1 for n in nb if n >= 2) / 32
        xs = [p[0] for p in P]; ys = [p[1] for p in P]
        w = max(xs) - min(xs) + 1; h = max(ys) - min(ys) + 1
        rows.append(dict(id=x[5], file=k, score=x[3], b=x[0], w=x[1], cdist=cdist, edge=edge, lonely=lonely, conn=conn, w_=w, h_=h))
print('candidates', len(rows))
ok = [r for r in rows if r['edge'] >= 1 and r['lonely'] == 0 and r['cdist'] <= 2.0 and r['w_'] <= 12 and r['h_'] <= 12]
print('pass filters', len(ok))
for r in ok: r['rank'] = r['score'] / 100 + r['conn'] * 2 - r['cdist'] * 0.3
ok.sort(key=lambda r: -r['rank'])
json.dump(ok[:60], open('short.json', 'w', encoding='utf-8'), ensure_ascii=False)
for r in ok[:15]: print(r['id'], r['file'], r['score'], round(r['conn'], 2), round(r['cdist'], 2), r['w_'], r['h_'])
