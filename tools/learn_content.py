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
C['1-3'] = [
    say('直線用字母 A 到 P 表示（沒有 I），橫線用數字 1 到 15。題號和手順都用這種寫法。', EMPTY),
    tap('coord', '點出 H8。它在棋盤正中央，叫「天元」。', EMPTY, 'H8'),
    tap('coord', '點出 F5。', EMPTY, 'F5'),
    tap('coord', '點出 L10。', EMPTY, 'L10'),
]
C['2-1'] = [
    say('再一顆就能連成五的形狀，叫做「四」。'),
    tap('five', '中間空一格也算四：補上空格就成五。', P('H8 J8 L8 M8', 'G8'), 'K8'),
    tap('five', '斜的、中間有空格，也是四。', P('F4 G5 J7 K8', 'E3'), 'H6'),
    tap('five', '這個四兩頭都能成五。點其中一頭。', P('G7 H7 J7 K7', ''), 'F7 L7', any_=True),
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
C['4-1'] = [
    say('從這課開始，每題先看結局，再一手一手倒回去。'),
    rewind('黑一手做出活四，兩頭都能成五。', P('G7 H7 J7', 'L7'), 'F7', 'E7 K7', 'F7', 1, '手擺'),
    rewind('直的也一樣。', P('H5 H6 H7', 'H9'), 'H4', 'H3 H8', 'H4', 1, '手擺'),
]
C['4-2'] = [
    say('白棋沒有禁手。一顆子同時做出兩個四，叫「四四」，對方只擋得了一個。（黑棋四四是禁手，第 7 單元會講。）'),
    rewind('白一手做出兩個四。', P('F7 K3', 'G7 H7 J7 K4 K5 K6', 'w'), 'K7', 'K8 L7', 'K7', 1, '手擺'),
]
p43a, s43a, f43a = from_bank('005RSGY4', 2)
p43b, s43b, f43b = from_bank('0068WG80', 2)
C['4-3'] = [
    rewind('先看結局，再一手一手倒回去：一顆子同時做出四和三。', p43a, s43a, f43a, s43a[-1], 2, '005RSGY4（截短 2 手）'),
    rewind('再一題四三。', p43b, s43b, f43b, s43b[-1], 2, '0068WG80（截短 2 手）'),
]
p44a, s44a, f44a = from_bank('0047T2SY', 3)
p44b, s44b, f44b = from_bank('00BBJ3T2', 3)
C['4-4'] = [
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
C['5-1'] = [
    say('從這單元開始，自己找 VCF。第一步：找材料。VCF 每一手都要是四，所以能下的點，只有「下了會變成四」的那些。'),
    tap_all('把所有下了會變成四的點都找出來。', mpos(m51[0])),
    tap_all('再一題，全部找出來。', mpos(m51[1])),
]
m52 = pick(lambda m: m['atk'] == 'b' and m['L'] == 2 and plain(m), 2)
C['5-2'] = [
    say('第二步：找終點。終點就是能一手做出「四三」或活四的那一點，通常在兩條線交會的地方。'),
    {'type': 'tap', 'kind': 'first', 'text': zh('找出終點：哪一點能同時做出四和三？'), 'pos': mpos(m52[0]), 'ans': [m52[0]['sol'][0]]},
    {'type': 'tap', 'kind': 'first', 'text': zh('再找一次終點。'), 'pos': mpos(m52[1]), 'ans': [m52[1]['sol'][0]]},
]
m53 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and plain(m), 2)
C['5-3'] = [
    say('第三步：往回接。終點還缺哪顆子？就找一個衝四，把那顆子放上去。'),
    m_rewind('先看結局，倒回去看看：第一個四是怎麼替終點鋪路的。', m53[0]),
    m_rewind('再倒一題。', m53[1]),
]
m54 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and m['trap'] and not m['forb'] and not m['counter'], 1) or []
C['5-4'] = [
    say('第四步：檢查。對方擋下的每一顆子都會留在盤上，它可能剛好擋掉你另一條線。'),
    m_solve('這題有陷阱：有的四衝下去，對方的擋子會壞了你的路。自己解解看。', m54[0]),
]
m55 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and plain(m), 3)
C['5-5'] = [
    say('四個步驟一起用：找材料、找終點、往回接、檢查。這次沒有提示。'),
    m_solve('自己解。', m55[0]), m_solve('再一題。', m55[1]), m_solve('最後一題。', m55[2]),
]
m6 = sorted([m for m in MINED if m['fit9'] and m['counter']], key=lambda m: (m['src'], m['L']))
m6_l2 = [m for m in m6 if m['L'] == 2][:2]; m6_l3 = [m for m in m6 if m['L'] == 3][:2]
C['6-1'] = [
    say('對方擋你的時候，那顆擋子可能剛好讓他自己做出四。這叫「反四」。'),
    m_rewind('這題的對方擋子差點變成反四。倒回去看看順序為什麼要這樣排。', m6_l2[0]),
]
C['6-2'] = [
    say('對方一有四，你就得先擋；你再衝四，他就直接成五。反四一出現，你的先手就沒了。'),
    m_solve('小心反四，自己解。', m6_l3[0]),
]
C['6-3'] = [
    say('同樣幾個四，換個順序，對方的擋子就不會變成四。'),
    m_solve('找出不會被反四的順序。', m6_l3[1] if len(m6_l3) > 1 else m6_l2[1]),
]
# 7-1：手擺的禁手判斷（每題由 check_lessons 用引擎確認那一點真的是／不是禁手）
FB = ['是禁手', '不是禁手']
C['7-1'] = [
    say('黑棋有三種禁手：長連（六子以上）、四四（一子做出兩個四）、三三（一子做出兩個活三）。白棋沒有禁手。'),
    {'type': 'choose', 'text': zh('黑下在金圈，同時做出橫的四和直的四。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'L8', 'pos': P('H8 J8 K8 L5 L6 L7', '')},
    {'type': 'choose', 'text': zh('黑下在金圈，同時做出兩條活三。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'H6', 'pos': P('J6 K6 H7 H8', '')},
    {'type': 'choose', 'text': zh('黑下在金圈，會連成六顆。'), 'options': [zh(o) for o in FB], 'ans': 0, 'probe': 'J7', 'pos': P('E7 F7 G7 H7 K7', '')},
    {'type': 'choose', 'text': zh('黑下在金圈，做出一個四和一條活三。'), 'options': [zh(o) for o in FB], 'ans': 1, 'probe': 'L8', 'pos': P('H8 J8 K8 L6 L7', '')},
]
C['7-2'] = [
    say('黑棋這一手如果同時連成五，就算形狀看起來像禁手，也是黑贏。成五最優先。'),
    tap('five', '這一點看起來會做出兩個四，可是它直接連成五。點下去！', P('F7 G7 H7 J7 K4 K5 K6', 'E7'), 'K7'),
]
m73 = pick(lambda m: m['atk'] == 'b' and m['L'] == 2 and m['forb'] and not m['lifts'] and not m['counter'], 1)
C['7-3'] = [
    say('黑棋不能用四四贏，所以黑先的題，收尾一定是四三或活四。'),
    m_rewind('這題有禁點。倒回去看：黑是怎麼避開禁點收尾的。', m73[0]),
]
m74 = pick(lambda m: m['atk'] == 'b' and m['L'] == 3 and m['forb'] and not m['lifts'] and not m['counter'], 1)
C['7-4'] = [
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

D = json.loads(DATA.read_text(encoding='utf-8'))
for l in D['lessons']:
    if l['id'] in C: l['steps'] = C[l['id']]
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
        tr(st.get('text'))
        for o in st.get('options', []): tr(o)
if missing:
    print('還沒翻譯的句子', len(missing), '句：要把它們加進 game/learn/i18n.json 再派翻譯')
DATA.write_text(json.dumps(D, ensure_ascii=False, indent=1), encoding='utf-8')
print('寫入', sum(len(v) for v in C.values()), '步，', len(C), '課')
