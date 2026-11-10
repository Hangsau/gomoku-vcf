import json
from playwright.sync_api import sync_playwright
COLS = 'ABCDEFGHJKLMNOP'
xy = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
R = json.load(open('short_lessons.json', encoding='utf-8'))
pick = {'opening': next(c for c in R['3'] if c['src'] == '004Z7T4V'), 'rewind': next(c for c in R['2'] if c['src'] == '005RSGY4')}
out = {}
with sync_playwright() as pw:
    br = pw.chromium.launch(); pg = br.new_page()
    pg.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pg.goto('http://localhost:8765/game.html'); pg.wait_for_timeout(800)
    MV = lambda b, w, t: pg.evaluate("([b,w,t])=>move(b,w,t,false)", [' '.join(b), ' '.join(w), t])['result']
    for name, c in pick.items():
        B, W, sol, five = c['b'], c['w'], c['sol'], c['five']
        pts = [xy(t) for t in B + W + sol + five]
        mnx = min(p[0] for p in pts); mxx = max(p[0] for p in pts); mny = min(p[1] for p in pts); mxy = max(p[1] for p in pts)
        ox = max(0, min(6, mnx - (8 - (mxx - mnx)) // 2)); oy = max(0, min(6, mny - (8 - (mxy - mny)) // 2))
        loc = lambda t: [xy(t)[0] - ox, 8 - (xy(t)[1] - oy)]
        # 每一個攻方手：在那個局面下，所有「下了就照劇本贏」的點（擋點、贏點用引擎判）
        b, w = list(B), list(W); steps = []
        occ = lambda: set(b) | set(w)
        empties = lambda: [COLS[x + ox] + str(y + oy + 1) for x in range(9) for y in range(9) if COLS[x + ox] + str(y + oy + 1) not in occ()]
        for i in range(0, len(sol), 2):
            last = i == len(sol) - 1
            if last:   # 最後一手（活四）：所有能做出活四／雙四的點都算對
                ok = [t for t in empties() if MV(b, w, t)['r'] == 'win']
            else:
                ok = [sol[i]]
            steps.append({'mv': loc(sol[i]), 'ok': [loc(t) for t in ok], 'def': loc(sol[i + 1]) if not last else None})
            b.append(sol[i])
            if not last: w.append(sol[i + 1])
        # 最後的活四：每個擋點擋完，剩下的成五點
        f = [loc(t) for t in five]
        chk = [MV(b, w + [five[0]], five[1])['r'], MV(b, w + [five[1]], five[0])['r']]
        out[name] = {'src': c['src'], 'origin': [COLS[ox] + str(oy + 1)], 'B': [loc(t) for t in B], 'W': [loc(t) for t in W], 'steps': steps, 'five': f, 'fiveCheck': chk, 'solTxt': ' '.join(sol)}
        print(name, c['src'], 'sol', ' '.join(sol), 'origin', COLS[ox], oy + 1, '| 最後一手可接受', [s['ok'] for s in steps][-1], '| 成五確認', chk)
    br.close()
json.dump(out, open('demo_data.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(open('demo_data.json', encoding='utf-8').read())
