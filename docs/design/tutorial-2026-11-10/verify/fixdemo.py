from playwright.sync_api import sync_playwright
COLS = 'ABCDEFGHJKLMNOP'
def t9(c, r): return COLS[c + 4] + str(11 - r)
def J(ps): return ' '.join(t9(*p) for p in ps)
OW = [(2,6),(3,6),(4,6),(4,3),(4,4),(5,4)]; OB = [(1,6),(4,2),(2,3),(7,6)]
RB = [(5,2),(5,3),(5,4),(3,5),(4,5)]; RW = [(5,1),(2,2),(7,7)]
with sync_playwright() as pw:
    br = pw.chromium.launch(); p = br.new_page()
    p.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    p.goto('http://localhost:8765/game.html'); p.wait_for_timeout(800)
    S = lambda b, w, aw: p.evaluate("([b,w,aw])=>solveFrom(b,w,aw)", [b, w, aw])['result']
    M = lambda b, w, t, aw: p.evaluate("([b,w,t,aw])=>move(b,w,t,aw)", [b, w, t, aw])['result']
    r = S(J(OB), J(OW), True); print('開場 白攻', r['vcf'], 'L', r['L'], 'unique', r['unique'], r['solution'], 'J6=', t9(4,5), 'J4=', t9(4,7), 'G4=', t9(2,7))
    b2 = J(OB + [(4,7)]); w2 = J(OW + [(4,5)])
    for alt in [(2,7), (6,3)]:
        print('  第二手', alt, t9(*alt), M(b2, w2, t9(*alt), True))
    # 活四之後兩個成五點
    w3 = J(OW + [(4,5), (2,7)])
    print('  (2,7) 後擋 (6,3)：', M(J(OB + [(4,7), (6,3)]), w3, t9(1,8), True), '｜擋 (1,8)：', M(J(OB + [(4,7), (1,8)]), w3, t9(6,3), True))
    r = S(J(RB), J(RW), False); print('倒帶課 黑攻（拿掉 (2,7)）', r['vcf'], 'L', r['L'], 'unique', r['unique'], r['legal'], r['solution'], ' (5,5)=', t9(5,5), '(5,6)=', t9(5,6), '(6,5)=', t9(6,5), '(2,5)=', t9(2,5), '(7,5)=', t9(7,5))
    b2 = J(RB + [(5,5)]); w2 = J(RW + [(5,6)])
    for alt in [(6,5), (2,5)]: print('  第二手', alt, M(b2, w2, t9(*alt), False))
    print('  (6,5) 後白擋 (7,5)，黑 (2,5)：', M(J(RB + [(5,5), (6,5)]), J(RW + [(5,6), (7,5)]), t9(2,5), False))
    print('  (2,5) 後白擋 (1,5)，黑 (6,5)：', M(J(RB + [(5,5), (2,5)]), J(RW + [(5,6), (1,5)]), t9(6,5), False))
    br.close()
