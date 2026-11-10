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

D = json.loads(DATA.read_text(encoding='utf-8'))
for l in D['lessons']:
    if l['id'] in C: l['steps'] = C[l['id']]
DATA.write_text(json.dumps(D, ensure_ascii=False, indent=1), encoding='utf-8')
print('寫入', sum(len(v) for v in C.values()), '步，', len(C), '課')
