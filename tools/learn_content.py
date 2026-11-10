#!/usr/bin/env python3
"""VCF 教學課文與題目（W3）。執行後重寫 game/learn/lessons.json 的 lessons（board、opening 保留）。

用法：python C:/claudehome/projects/VCF/tools/learn_content.py
之後一定要跑：python C:/claudehome/projects/VCF/tools/check_lessons.py
盤面一律要過引擎檢查；手擺的也一樣（2026-11-10 使用者要求）。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'game' / 'learn' / 'lessons.json'
SHORT = ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify' / 'short_lessons.json'
COLS = 'ABCDEFGHJKLMNOP'
W0 = 'D3'   # 第 1–4 單元手擺題的 9×9 框：D–M、3–11

def zh(s): return {'zh': s}
def P(b, w, atk='b', win=W0): return {'b': b.split() if isinstance(b, str) else b, 'w': w.split() if isinstance(w, str) else w, 'atk': atk, 'win': win}
def say(t, pos=None): return {'type': 'say', 'text': zh(t), **({'pos': pos} if pos else {})}
def tap(kind, t, pos, ans, any_=False): return {'type': 'tap', 'kind': kind, 'text': zh(t), 'pos': pos, 'ans': ans.split() if isinstance(ans, str) else ans, **({'any': True} if any_ else {})}
def predict(t, pos, play, ans): return {'type': 'predict', 'text': zh(t), 'pos': pos, 'play': play, 'ans': [ans]}
def choose(t, opts, ans, pos=None): return {'type': 'choose', 'text': zh(t), 'options': [zh(o) for o in opts], 'ans': ans, **({'pos': pos} if pos else {})}
def rewind(t, pos, line, five, last_accept, L, src=''):
    return {'type': 'rewind', 'text': zh(t), 'src': src, 'pos': pos, 'L': L, 'line': line.split() if isinstance(line, str) else line,
            'five': five.split() if isinstance(five, str) else five, 'accept': {str(L - 1): last_accept.split() if isinstance(last_accept, str) else last_accept}}

def from_bank(src, L):
    """題庫截短題（short_lessons.json，已驗證），自動算 9×9 框"""
    c = next(x for x in json.loads(SHORT.read_text(encoding='utf-8'))[str(L)] if x['src'] == src)
    xy = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
    pts = [xy(t) for t in c['b'] + c['w'] + c['sol'] + c['five']]
    mnx, mxx = min(p[0] for p in pts), max(p[0] for p in pts); mny, mxy = min(p[1] for p in pts), max(p[1] for p in pts)
    ox = max(0, min(6, mnx - (8 - (mxx - mnx)) // 2)); oy = max(0, min(6, mny - (8 - (mxy - mny)) // 2))
    return P(c['b'], c['w'], 'b', COLS[ox] + str(oy + 1)), c['sol'], sorted(c['five'])

EMPTY = P('', '')
C = {}
C['1-1'] = [
    say('這是棋盤。棋子下在線和線的交叉點上，不是格子裡面。', EMPTY),
    tap('free', '黑棋先下。點任何一個交叉點，放下你的第一顆子。', EMPTY, ''),
    say('黑白輪流，一人一手。誰先把五顆子連成一直線，誰就贏。'),
]
C['1-2'] = [
    tap('five', '橫的四顆，差一顆就連成五。補上它！', P('H8 J8 K8 L8', 'G8'), 'M8'),
    tap('five', '直的也算。', P('H5 H6 H7 H8', 'H9'), 'H4'),
    tap('five', '斜的也算。', P('F5 G6 H7 J8', 'K9'), 'E4'),
    tap('five', '另一個方向的斜線也算。', P('K5 J6 H7 G8', 'L4'), 'F9'),
]
# 座標課用完整 15×15 棋盤（2026-11-10 使用者：9×9 局部盤找 H8 找不到、天元不在正中央）
FULL = {'b': [], 'w': [], 'atk': 'b', 'win': None}
C['1-3'] = [
    say('棋盤邊上有座標：下面是字母 A 到 P（沒有 I），左邊是數字 1 到 15。先找字母那一直排，再往上數到數字。', FULL),
    tap('coord', '點出 H8。它在棋盤正中央，叫「天元」。', FULL, 'H8'),
    tap('coord', '點出 D4。它是左下角的星位。', FULL, 'D4'),
    tap('coord', '點出 L12。', FULL, 'L12'),
    tap('coord', '點出 C10。', FULL, 'C10'),
]
# 2-1 改成「認四」：分辨哪些形狀是四（2026-11-10 使用者：原本又是補一顆成五，跟 1-2 重複）
IS4 = ['是四：再一顆就能連成五', '不是四']
def is4(t, pos, ans): return {'type': 'choose', 'text': zh(t), 'options': [zh(o) for o in IS4], 'ans': ans, 'isFour': True, 'pos': pos}
C['2-1'] = [
    say('再下一顆就能連成五的形狀，叫做「四」。中間空一格也算。下面每一題，判斷黑棋這條線是不是四。'),
    is4('中間空了一格。', P('H8 J8 L8 M8', ''), 0),
    is4('只有三顆連在一起。', P('G8 H8 J8', ''), 1),
    is4('四顆，可是中間空了兩格。', P('F8 G8 K8 L8', ''), 1),
    is4('四顆連在一起，可是兩頭都被白擋住。', P('F8 G8 H8 J8', 'E8 K8'), 1),
    is4('斜的，中間空一格。', P('F4 G5 J7 K8', ''), 0),
    say('四：只差一顆就成五，不管中間有沒有空。兩頭都被擋住，或空太多，就不是四。'),
]
C['2-2'] = [
    say('對方有四的時候，你一定要擋在那一點，不然他下一手就連成五。'),
    tap('block', '黑有四了。你是白，擋住它！', P('E5 F5 G5 H5', 'D5'), 'J5'),
    tap('block', '中間有空格的四，要擋空格。', P('K4 K5 K7 K8', ''), 'K6'),
    tap('block', '斜的四，擋哪裡？', P('E9 F8 G7 H6', 'J5'), 'D10'),
]
C['2-3'] = [
    choose('這個四是哪一種？', ['活四：兩頭都能成五，擋不住', '衝四：只有一頭能成五，擋得住'], 0, P('G7 H7 J7 K7', '')),
    choose('那這個呢？', ['活四：兩頭都能成五，擋不住', '衝四：只有一頭能成五，擋得住'], 1, P('G7 H7 J7 K7', 'F7')),
    say('活四：對方擋一頭，你就下另一頭。衝四：對方擋住那一點，這條線就沒用了。'),
]
C['2-4'] = [
    tap('four', '黑有三顆了。再下一顆，讓它變成四。（不只一個答案）', P('F6 G6 H6', 'E6'), 'J6 K6', any_=True),
    tap('four', '這次三顆兩邊都空著，能成四的點更多。點一個。', P('F8 G8 H8', ''), 'D8 E8 J8 K8', any_=True),
    say('能變成四的點，就是你可以拿來「衝四」的材料。'),
]
C['3-1'] = [
    predict('黑下了 K7，做出四。白只能擋哪裡？', P('G7 H7 J7 J8', 'F7 G5 H5 J5 H9'), 'K7', 'L7'),
    predict('白自己也有一條三，但它還是得先擋你的四。黑下 H7，白擋哪？', P('E4 F5 G6', 'D3 K4 K5 K6'), 'H7', 'J8'),
    say('這就是「絕對先手」：你衝四，對方一定只能擋那一點，連自己的攻勢都得先放下。'),
]
C['3-2'] = [
    predict('黑下 H8。白擋哪？', P('E8 F8 G8 K5 K6 K7', 'D8 K4'), 'H8', 'J8'),
    predict('接著黑下 K8。白又擋哪？', P('E8 F8 G8 H8 K5 K6 K7', 'D8 K4 J8'), 'K8', 'K9'),
    say('擋點只有一個，所以你可以先在腦中算好：我下這裡，它一定擋那裡。'),
]
C['3-3'] = [
    say('每衝一個四，對方就多擋一顆子在盤上。'),
    choose('衝四之前，要先想什麼？', ['衝完之後，還有沒有下一個四可以接', '先衝再說，反正對方一定要擋'], 0),
    say('衝了卻接不下去，只是幫對方多放一顆子，還可能擋掉你自己的線。'),
]
C['5-1'] = [
    say('從這單元開始用「倒帶」：先看結局，再一次退兩手，每退一層就找「下一手下哪」。'),
    rewind('黑一手做出活四，兩頭都能成五。', P('G7 H7 J7', 'L7'), 'F7', 'E7 K7', 'F7', 1, '手擺'),
    rewind('直的也一樣。', P('H5 H6 H7', 'H9'), 'H4', 'H3 H8', 'H4', 1, '手擺'),
]
C['5-2'] = [
    say('一顆子同時做出兩個四，叫「四四」，對方只擋得了一個。白棋可以這樣贏；黑棋四四是禁手（上一單元教過）。'),
    rewind('白一手做出兩個四。', P('F7 K3', 'G7 H7 J7 K4 K5 K6', 'w'), 'K7', 'K8 L7', 'K7', 1, '手擺'),
    'M73',
]
p43a, s43a, f43a = from_bank('005RSGY4', 2)
p43b, s43b, f43b = from_bank('0068WG80', 2)
C['5-3'] = [
    rewind('一顆子同時做出四和三，叫「四三」：對方擋了四，三就變成活四。', p43a, s43a, f43a, s43a[-1], 2, '005RSGY4（截短 2 手）'),
    rewind('再一題四三。', p43b, s43b, f43b, s43b[-1], 2, '0068WG80（截短 2 手）'),
]
p44a, s44a, f44a = from_bank('0047T2SY', 3)
p44b, s44b, f44b = from_bank('00BBJ3T2', 3)
C['5-4'] = [
    rewind('先衝一個四，讓子到位，再做四三。', p44a, s44a, f44a, s44a[-1], 3, '0047T2SY（截短 1 手）'),
    rewind('再一題。', p44b, s44b, f44b, s44b[-1], 3, '00BBJ3T2（截短 1 手）'),
]

# ---------- 第 5–9 單元（題目來自 tools/mine_lessons.py 挖的題，全部是題庫截短、引擎驗證過） ----------
MINED = json.loads((ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify' / 'mined.json').read_text(encoding='utf-8'))
USED = {'005RSGY4', '0068WG80', '0047T2SY', '00BBJ3T2', '004Z7T4V'}
def win_of(pts_txt):
    xy_ = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
    pts = [xy_(t) for t in pts_txt]
    mnx, mxx = min(p[0] for p in pts), max(p[0] for p in pts); mny, mxy = min(p[1] for p in pts), max(p[1] for p in pts)
    ox = max(0, min(6, mnx - (8 - (mxx - mnx)) // 2)); oy = max(0, min(6, mny - (8 - (mxy - mny)) // 2))
    return COLS[ox] + str(oy + 1)
def pick(cond, k=1):
    out = []
    for m in sorted(MINED, key=lambda m: (m['n'], m['src'])):
        if m['fit9'] and m['src'] not in USED and cond(m):
            out.append(m); USED.add(m['src'])
            if len(out) == k: break
    if len(out) < k: raise SystemExit(f'挖到的題不夠：{cond}')
    return out
def mpos(m): return P(m['b'], m['w'], m['atk'], win_of(m['b'] + m['w'] + m['sol'] + m['five']))
def m_rewind(t, m): return rewind(t, mpos(m), m['sol'], m['five'], m['sol'][-1], m['L'], f"{m['src']}（截短）")
def m_solve(t, m, finish=None):
    s = {'type': 'solve', 'text': zh(t), 'src': f"{m['src']}（截短）", 'pos': mpos(m), 'L': m['L'], 'line': m['sol']}
    if finish: s['finish'] = finish
    else: s['five'] = m['five']
    return s
plain = lambda m: not m['lifts'] and not m['counter'] and not m['forb'] and not m['trap']

# 「全部找出來」題的答案要用引擎算（下了會成四的點），只算一次
_E = None
def four_points(pos):
    global _E
    import sys as _s; _s.path.insert(0, str(Path(__file__).resolve().parent))
    from check_lessons import Engine, window_points
    if _E is None: _E = Engine()
    aw = pos['atk'] == 'w'
    return sorted(t for t in window_points(pos['win']) if t not in pos['b'] and t not in pos['w']
                  and _E.move(pos['b'], pos['w'], t, aw).get('r') not in ('notfour', 'forbidden', 'illegal', 'forcedForbidden'))
def tap_all(t, pos):
    return {'type': 'tap', 'kind': 'four', 'all': True, 'text': zh(t), 'pos': pos, 'ans': four_points(pos)}

m51 = [m for m in pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and plain(m), 6)]
m51 = [m for m in m51 if len(four_points(mpos(m))) <= 6][:2]
C['6-1'] = [
    say('從這單元開始，自己找 VCF。第一步：找材料。VCF 每一手都要是四，所以能下的點，只有「下了會變成四」的那些。'),
    tap_all('把所有下了會變成四的點都找出來。', mpos(m51[0])),
    tap_all('再一題，全部找出來。', mpos(m51[1])),
]
m52 = pick(lambda m: m['atk'] == 'b' and m['L'] == 2 and plain(m), 2)
C['6-2'] = [
    say('第二步：找終點。終點就是能一手做出「四三」或活四的那一點，通常在兩條線交會的地方。'),
    {'type': 'tap', 'kind': 'first', 'text': zh('找出終點：哪一點能同時做出四和三？'), 'pos': mpos(m52[0]), 'ans': [m52[0]['sol'][0]]},
    {'type': 'tap', 'kind': 'first', 'text': zh('再找一次終點。'), 'pos': mpos(m52[1]), 'ans': [m52[1]['sol'][0]]},
]
m53 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and plain(m), 2)
C['6-3'] = [
    say('第三步：往回接。終點還缺哪顆子？就找一個衝四，把那顆子放上去。'),
    m_rewind('先看結局，倒回去看看：第一個四是怎麼替終點鋪路的。', m53[0]),
    m_rewind('再倒一題。', m53[1]),
]
m54 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and m['trap'] and not m['forb'] and not m['counter'], 1) or []
def trap_demo(m):
    """找一手「是四但不是正解」、而且白的擋子剛好落在正解要用的點上（用引擎算）"""
    pos = mpos(m); four_points(pos)   # 確保引擎已開
    atk_pts = set(m['sol'][0::2])
    for t in four_points(pos):
        if t == m['sol'][0]: continue
        r = _E.move(pos['b'], pos['w'], t, pos['atk'] == 'w')
        if r.get('r') == 'block' and r.get('def') in atk_pts: return t, r['def']
    raise SystemExit(f'{m["src"]} 找不到示範陷阱的那一手')
wrong, hit = trap_demo(m54[0])
C['6-4'] = [
    say('第四步：檢查。對方擋下的每一顆子都會留在盤上，它可能剛好擋掉你要用的點。'),
    predict(f'先看一個錯誤示範：如果黑先下 {wrong}，白會擋哪？', mpos(m54[0]), wrong, hit),
    say(f'白擋在 {hit}，剛好是正解要下的點。順序錯了，你自己的路就被對方的擋子堵死。'),
    m_solve('現在自己解：想好順序再下。走錯了會告訴你是哪顆擋子壞了路。', m54[0]),
]
m55 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and plain(m), 3)
C['6-6'] = [
    say('四個步驟一起用：找材料、找終點、往回接、檢查。這次沒有提示。'),
    m_solve('自己解。', m55[0]), m_solve('再一題。', m55[1]), m_solve('最後一題。', m55[2]),
]
# 第 6 單元（2026-11-10 使用者：6-2、6-3 換順序結果一樣，看不出教學目的）→ 只用「順序一錯就被反四」的題：
# 正解第一、二手顛倒時，守方的擋子會做出四，而且之後攻方贏不了（tools/mine_counter_black.py 等挖、引擎驗證）
VD = ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify'
CB = json.loads((VD / 'counter_black.json').read_text(encoding='utf-8')) if (VD / 'counter_black.json').exists() else []
CO = CB if len(CB) >= 3 else json.loads((VD / 'counter_order.json').read_text(encoding='utf-8'))   # 黑先挖到 3 道以上就用黑先
_MI = {(m['src'], m['L']): m for m in MINED}
for h in CO:   # counter_order.json 只存題號，盤面從 mined.json 補
    if 'b' not in h: m = _MI[(h['src'], h['L'])]; h['b'], h['w'] = m['b'], m['w']
def c_full(h):   # 補上手順走完後的成五點（倒帶課要用）
    aw = h['atk'] == 'w'; a = (h['w'] if aw else h['b']) + h['sol'][0::2]; d = (h['b'] if aw else h['w']) + h['sol'][1::2]
    import sys as _s; _s.path.insert(0, str(Path(__file__).resolve().parent)); from check_lessons import fives
    return sorted(fives(a, d, not aw))
def c_pts(h): return h['b'] + h['w'] + h['sol'] + h['counterFive'] + c_full(h)
def c_fit(h):   # 盤面＋解＋反四點＋最後成五點都要放得進 9×9
    xy_ = lambda t: (COLS.index(t[0]), int(t[1:]) - 1); ps = [xy_(t) for t in c_pts(h)]
    return max(p[0] for p in ps) - min(p[0] for p in ps) <= 8 and max(p[1] for p in ps) - min(p[1] for p in ps) <= 8
def c_pos(h): return P(h['b'], h['w'], h['atk'], win_of(c_pts(h)))
WO = json.loads((VD / 'counter_order.json').read_text(encoding='utf-8'))
for h in WO:
    if 'b' not in h: m = _MI[(h['src'], h['L'])]; h['b'], h['w'] = m['b'], m['w']
def no_forbid(h):
    """反四單元（第 7）贏法不能靠逼禁（2026-11-10 使用者：6-3 莫名其妙四四禁贏；逼禁 8-2 才教）"""
    four_points(c_pos(h))   # 確保引擎已開
    aw = h['atk'] == 'w'
    a, d = list(h['w'] if aw else h['b']), list(h['b'] if aw else h['w'])
    for i in range(0, len(h['sol']), 2):
        bb, ww = (d, a) if aw else (a, d)
        m = _E.move(bb, ww, h['sol'][i], aw)
        if '禁' in (m.get('how') or '') or m.get('forcedForbidden'): return False
        a.append(h['sol'][i])
        if i + 1 < len(h['sol']): d.append(h['sol'][i + 1])
    return True
seen6, CO6 = set(), []
for h in sorted(CB, key=lambda h: (h['L'], h['n'], h['src'])) + sorted(WO, key=lambda h: (h['L'], h['n'], h['src'])):   # 黑先優先，不夠用白先補
    if h['src'] not in seen6 and h['src'] not in USED and c_fit(h) and no_forbid(h): seen6.add(h['src']); CO6.append(h)
if len(CO6) < 3: raise SystemExit(f'第 6 單元合格的反四題只有 {len(CO6)} 道，要再挖')
for h in CO6[:3]: USED.add(h['src'])
def c_names(h): return ('白', '黑') if h['atk'] == 'w' else ('黑', '白')
def c_predict(h):
    A, Dn = c_names(h)
    s = predict(f'先看錯誤示範：{A}如果先下 {h["wrong"]}（正解其實是第二手才下），{Dn}會擋哪？', c_pos(h), h['wrong'], h['def'])
    s['counter'] = h['counterFive']
    s['counterText'] = zh(f'{Dn}擋在 {h["def"]}，這一擋同時做出了{Dn}自己的四（紅圈那點一下就成五）。{A}只能回頭去擋，先手沒了，這題就贏不了。這就是反四。')
    return s
def c_solve(t, h): return {'type': 'solve', 'text': zh(t), 'src': f"{h['src']}（截短）", 'pos': c_pos(h), 'L': h['L'], 'line': h['sol'], 'five': c_full(h)}
def c_rewind(t, h): return rewind(t, c_pos(h), h['sol'], c_full(h), h['sol'][-1], h['L'], f"{h['src']}（截短）")
h1, h2, h3 = CO6[0], CO6[1], CO6[2]
C['7-1'] = [
    say('對方擋你的時候，那顆擋子留在盤上。如果它剛好讓對方自己也連成四，就叫「反四」。'),
    c_predict(h1),
    c_rewind('現在看正確的順序：先下哪一手，對方的擋子才不會變成四。', h1),
]
C['7-2'] = [
    say('對方一有四，你就得先擋他，不能再衝自己的四。反四一出現，你的先手就沒了。'),
    c_predict(h2),
    c_solve('換個順序，自己解：先下的那一手，要讓對方的擋子做不出四。', h2),
]
C['7-3'] = [
    say('衝四之前多問一句：對方擋下來的那顆子，會不會剛好連成他的四？會的話，換一個順序。'),
    c_solve('這次沒有示範。想好順序再下，走錯了會告訴你是哪顆擋子變成反四。', h3),
]
# 7-1：手擺的禁手判斷（每題由 check_lessons 用引擎確認那一點真的是／不是禁手）
FB = ['是禁手', '不是禁手']
C['4-1'] = [
    say('黑棋有三種禁手：長連（六子以上）、四四（一子做出兩個四）、三三（一子做出兩個活三）。白棋沒有禁手。'),
    {'type': 'choose', 'text': zh('黑下在金圈，同時做出橫的四和直的四。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'L8', 'pos': P('H8 J8 K8 L5 L6 L7', '')},
    {'type': 'choose', 'text': zh('黑下在金圈，同時做出兩條活三。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'H6', 'pos': P('J6 K6 H7 H8', '')},
    {'type': 'choose', 'text': zh('黑下在金圈，會連成六顆。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'J7', 'pos': P('E7 F7 G7 H7 K7', '')},
    {'type': 'choose', 'text': zh('黑下在金圈，做出一個四和一條活三。'), 'options': [zh(o) for o in FB], 'ans': 1, 'probe': 'L8', 'pos': P('H8 J8 K8 L6 L7', '')},
]
C['4-2'] = [
    say('黑棋這一手如果同時連成五，就算形狀看起來像禁手，也是黑贏。成五最優先。'),
    tap('five', '這一點看起來會做出兩個四，可是它直接連成五。點下去！', P('F7 G7 H7 J7 K4 K5 K6', 'E7'), 'K7'),
]
C['4-3'] = [
    say('黑棋每一手都要先問：這點能不能下？下面幾題自己判斷（金圈是黑要下的點）。'),
    {'type': 'choose', 'text': zh('黑下在金圈，剛好連成五顆。'), 'options': [zh(o) for o in FB], 'ans': 1, 'probe': 'J7', 'pos': P('E7 F7 G7 H7', '')},
    {'type': 'choose', 'text': zh('黑下在金圈：直的是活三，橫的那條三左邊被白擋住。'), 'options': [zh(o) for o in FB], 'ans': 1, 'probe': 'H6', 'pos': P('J6 K6 H7 H8', 'G6')},
    {'type': 'choose', 'text': zh('黑下在金圈：直的四加斜的四。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'K7', 'pos': P('K4 K5 K6 J6 H5 G4', '')},
    say('判斷禁手的順序：先看會不會成五（成五就贏）；再數這一手同時做出幾個四、幾條活三。兩個以上就是禁手。'),
]
m73 = pick(lambda m: m['atk'] == 'b' and m['L'] == 2 and m['forb'] and not m['lifts'] and not m['counter'], 1)
C['5-2'][-1] = m_rewind('黑棋不能四四，收尾只能四三或活四。這題盤上有禁點，倒回去看黑怎麼避開。', m73[0])
m74 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and m['forb'] and not m['lifts'] and not m['counter'], 1)
C['6-5'] = [
    say('黑棋路上某一手如果是禁手，那手就不能下，要換一條路。'),
    m_solve('盤上有禁點（下了會被判負的點）。避開它，自己解。', m74[0]),
]
m81 = pick(lambda m: m['atk'] == 'w' and m['L'] == 1 and plain(m), 1)
m81b = pick(lambda m: m['atk'] == 'w' and m['L'] == 2 and plain(m), 1)
C['8-1'] = [
    say('白棋沒有禁手：四四、長連都可以。白先的題，收尾的方式比黑多。'),
    m_rewind('白一手就擋不住了。倒回去看看。', m81[0]),
    m_solve('換你當白，自己解。', m81b[0]),
]
FORBID_SRC = ['M4YHYJ78', 'W0477G8E', '3TADFNHY', 'ED60S04S']
m82 = [m for m in MINED if m['src'] in FORBID_SRC and m['fit9'] and m['L'] <= 2]
m82 = sorted(m82, key=lambda m: (m['L'], m['n']))[:2]
for m in m82: USED.add(m['src'])
C['8-2'] = [
    say('白還有一招：衝一個四，讓黑唯一的擋點剛好是黑的禁手。黑不能下禁手，就擋不了。這叫「逼禁」。'),
    m_solve('用逼禁贏。', m82[0], finish='forbid'),
    m_solve('再一題逼禁。', m82[1], finish='forbid'),
]
m83 = pick(lambda m: m['atk'] == 'w' and m['L'] == 3 and plain(m), 2)
C['8-3'] = [say('白先綜合：四四、四三、逼禁都可能是終點。'), m_solve('自己解。', m83[0]), m_solve('再一題。', m83[1])]
m91 = sorted([m for m in MINED if m['fit9'] and m['atk'] == 'b' and m['lifts'] and m['L'] == 3 and not m['counter']], key=lambda m: m['n'])[:2]
C['9-1'] = [
    say('原本是禁手的點，衝了幾個四之後形狀改變，可能變成可以下。這叫「解禁」。'),
    m_rewind('這題的某一手，一開始是禁點。倒回去看看它什麼時候變成可以下。', m91[0]),
    m_solve('自己解一題有解禁的。', m91[1]),
]
V27 = {r['id']: r for r in json.loads((ROOT / 'docs' / 'design' / 'tutorial-2026-11-10' / 'verify' / 'verified.json').read_text(encoding='utf-8'))}
def bank_solve(t, src):
    r = V27[src]; sol = r['sol'].split('(')[0].split()
    return {'type': 'solve', 'text': zh(t), 'src': src, 'pos': {'b': r['b'].split(), 'w': r['w'].split(), 'atk': 'b'}, 'L': 4, 'line': sol}
C['9-2'] = [
    say('手數變多時，方法一樣：找材料、找終點、往回接、檢查。只是往回接要接好幾層。'),
    bank_solve('4 手題，整個棋盤。自己解。', 'R3WSNQTV'),
    bank_solve('再一題 4 手題。', 'KPPVPBY9'),
]

# ---------- 課程表（v2 順序：禁手提前到第 4 單元）＋倒帶每一關的可接受點＋教學盤對應 ----------
TITLES = [
 ('1-1', 1, '棋盤和輪流'), ('1-2', 1, '連成五就贏'), ('1-3', 1, '座標'),
 ('2-1', 2, '什麼是四'), ('2-2', 2, '擋四'), ('2-3', 2, '活四和衝四'), ('2-4', 2, '做一個四'),
 ('3-1', 3, '衝四是絕對先手'), ('3-2', 3, '擋點是確定的'), ('3-3', 3, '亂衝會浪費'),
 ('4-1', 4, '三種禁手'), ('4-2', 4, '成五最優先'), ('4-3', 4, '這點能不能下'),
 ('5-1', 5, '活四'), ('5-2', 5, '四四：白可以、黑不行'), ('5-3', 5, '四三'), ('5-4', 5, '先衝一個四，再做四三'),
 ('6-1', 6, '找材料'), ('6-2', 6, '找終點'), ('6-3', 6, '往回接'), ('6-4', 6, '對方的擋子也是棋子'), ('6-5', 6, '路上的禁手'), ('6-6', 6, '四步驟一起用'),
 ('7-1', 7, '擋子變成四'), ('7-2', 7, '反四之後你就沒有先手'), ('7-3', 7, '換手順躲開反四'),
 ('8-1', 8, '白棋可以四四、長連'), ('8-2', 8, '逼黑擋在禁點'), ('8-3', 8, '白先綜合'),
 ('9-1', 9, '解禁'), ('9-2', 9, '長的 VCF'), ('9-3', 9, '畢業考'),
]
def stages_of(st):
    """倒帶 v2：先拿掉成五那手，之後每次退兩手；每關（輪攻方下）算出所有「下了還能贏」的點"""
    four_points(st['pos'])   # 確保引擎已開
    from check_lessons import window_points, has_vcf
    pos = st['pos']; aw = pos['atk'] == 'w'
    full = st['line'] + [st['five'][0], st['five'][1]]
    out = []
    for keep in range(len(full) - 1, -1, -2):
        a = list(pos['w'] if aw else pos['b']) + full[0:keep:2]; d = list(pos['b'] if aw else pos['w']) + full[1:keep:2]
        bb, ww = (d, a) if aw else (a, d)
        acc = []
        for t in window_points(pos['win']):
            if t in a or t in d: continue
            m = _E.move(bb, ww, t, aw)
            if m.get('r') == 'win': acc.append(t)
            elif m.get('r') == 'block' and not m.get('nofour'):
                b2, w2 = (d + [m['def']], a + [t]) if aw else (a + [t], d + [m['def']])
                if has_vcf(_E, b2, w2, aw): acc.append(t)
        if full[keep] not in acc: raise SystemExit(f'倒帶關卡算錯（{st.get("src")}）：保留 {keep} 手時正解 {full[keep]} 判定贏不了')
        out.append({'keep': keep, 'accept': sorted(acc)})
    return out
D = json.loads(DATA.read_text(encoding='utf-8'))
lessons = []
for lid, u, title in TITLES:
    L = {'id': lid, 'unit': u, 'title': {'zh': title}, 'steps': C.get(lid, [])}
    if lid == '9-3': L['noStone'] = True
    for st in L['steps']:
        if st.get('type') == 'rewind': st['stages'] = stages_of(st)
        if st.get('type') in ('rewind', 'solve') and u <= 5: st['toFive'] = True   # 初學下到連成五；第 6 單元起下到活四就算解開
    lessons.append(L)
D['lessons'] = lessons
# 教學盤：32 子黑白輪流、由中心往外，依新課程順序對應（盤面不變）
import math
bd = D['board']; xy2 = lambda t: (COLS.index(t[0]), int(t[1:]) - 1)
cx = sum(xy2(t)[0] for t in bd['b'] + bd['w']) / 32; cy = sum(xy2(t)[1] for t in bd['b'] + bd['w']) / 32
key = lambda t: math.hypot(xy2(t)[0] - cx, xy2(t)[1] - cy)
Bs, Ws = sorted(bd['b'], key=key), sorted(bd['w'], key=key)
seq = ['opening'] + [lid for lid, _, _ in TITLES if lid != '9-3']
bd['order'] = [{'lesson': lid, 't': (Bs if k % 2 == 0 else Ws)[k // 2], 'c': 'b' if k % 2 == 0 else 'w'} for k, lid in enumerate(seq)]
missing_steps = [lid for lid, _, _ in TITLES if lid != '9-3' and not C.get(lid)]
if missing_steps: raise SystemExit(f'這些課沒有內容：{missing_steps}')
if _E: _E.close()
# 套翻譯：game/learn/i18n.json 以中文原文為鍵（中文沒改的句子不用重翻；新句子要再跑翻譯）
I18N = ROOT / 'game' / 'learn' / 'i18n.json'
TR = json.loads(I18N.read_text(encoding='utf-8')) if I18N.exists() else {}
missing = set()
def tr(o):
    if not isinstance(o, dict) or not o.get('zh'): return
    t = TR.get(o['zh'])
    if not t: missing.add(o['zh']); return
    for k in ('en', 'ja', 'ko'):
        if t.get(k): o[k] = t[k]
tr(D['opening'].get('text'))
for l in D['lessons']:
    tr(l.get('title'))
    for st in l.get('steps', []):
        tr(st.get('text')); tr(st.get('counterText'))
        for o in st.get('options', []): tr(o)
if missing:
    print('還沒翻譯的句子', len(missing), '句：要把它們加進 game/learn/i18n.json 再派翻譯')
DATA.write_text(json.dumps(D, ensure_ascii=False, indent=1), encoding='utf-8')
print('寫入', sum(len(v) for v in C.values()), '步，', len(C), '課')
