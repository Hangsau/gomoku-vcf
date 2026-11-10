from playwright.sync_api import sync_playwright
COLS = 'ABCDEFGHJKLMNOP'
def t9(c, r): return COLS[c + 4] + str(11 - r)
def J(ps): return ' '.join(t9(*p) for p in ps)
OW = [(2,6),(3,6),(4,6),(4,3),(4,4),(5,4)]; OB = [(1,6),(4,2),(2,3),(7,6)]
with sync_playwright() as pw:
    br = pw.chromium.launch(); p = br.new_page()
    p.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    p.goto('http://localhost:8765/game.html'); p.wait_for_timeout(800)
    M = lambda b, w, t: p.evaluate("([b,w,t])=>move(b,w,t,false)", [b, w, t])['result']
    # 對調後：原白子變黑（玩家進攻），原黑子變白（電腦防守）
    print('第一手 (4,5)：', M(J(OW), J(OB), t9(4,5)))
    b2 = OW + [(4,5)]; w2 = OB + [(4,7)]
    for alt, ends in [((2,7), [(6,3), (1,8)]), ((6,3), [(7,2), (2,7)])]:
        print('第二手', alt, M(J(b2), J(w2), t9(*alt)))
        for blk, fin in [(ends[0], ends[1]), (ends[1], ends[0])]:
            print('   白擋', blk, '→ 黑', fin, M(J(b2 + [alt]), J(w2 + [blk]), t9(*fin)))
    br.close()
