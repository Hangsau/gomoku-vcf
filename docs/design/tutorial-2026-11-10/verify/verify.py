import json
from playwright.sync_api import sync_playwright
COLS = 'ABCDEFGHJKLMNOP'
def t9(c, r): return COLS[c + 4] + str(11 - r)   # 設計稿 9×9 局部 → 15×15 座標
C = json.load(open('short.json', encoding='utf-8'))
op_w = [t9(*p) for p in [(2,6),(3,6),(4,6),(4,3),(4,4),(5,4)]]; op_b = [t9(*p) for p in [(1,6),(4,2),(2,3),(7,6)]]
rw_b = [t9(*p) for p in [(5,2),(5,3),(5,4),(3,5),(4,5),(2,7)]]; rw_w = [t9(*p) for p in [(5,1),(2,2),(7,7)]]
demos = [('開場（白攻）', ' '.join(op_b), ' '.join(op_w), True), ('開場對調（黑攻）', ' '.join(op_w), ' '.join(op_b), False), ('倒帶課（黑攻）', ' '.join(rw_b), ' '.join(rw_w), False)]
JS_REPLAY = """async ([b,w,aw,sol]) => {
  let B=b.split(' ').filter(Boolean), W=w.split(' ').filter(Boolean); const out=[];
  const seq=sol.replace(/\(.*\)/,'').trim().split(/\s+/);
  for (let i=0;i<seq.length;i+=2){ const t=seq[i]; const r=(await move(B.join(' '),W.join(' '),t,aw)).result; out.push([t,r.r,r.def||r.at||'']);
    (aw?W:B).push(t); if(r.r!=='block') break; if(seq[i+1]&&r.def!==seq[i+1]) out.push(['MISMATCH',seq[i+1],r.def]); (aw?B:W).push(r.def); }
  return out; }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); p = br.new_page()
    p.route('**/vcf-game-api.psyhangsau.workers.dev/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    p.goto('http://localhost:8765/game.html'); p.wait_for_timeout(800)
    print('== 設計稿手擺的盤面 ==')
    for name, b, w, aw in demos:
        res = p.evaluate("([b,w,aw])=>solveFrom(b,w,aw)", [b, w, aw])['result']
        rp = p.evaluate(JS_REPLAY, [b, w, aw, res.get('solution') or '']) if res.get('vcf') else []
        print(name, '| vcf', res.get('vcf'), 'L', res.get('L'), 'unique', res.get('unique'), 'legal', res.get('legal'), '| sol', res.get('solution'), '| alts', res.get('alts'), '| replay', rp)
    print('== 題庫候選 ==')
    out = []
    for c in C[:27]:
        res = p.evaluate("([b,w])=>solveFrom(b,w,false)", [c['b'], c['w']])['result']
        rp = p.evaluate(JS_REPLAY, [c['b'], c['w'], False, res['solution']])
        f = res['facts']
        good = res['vcf'] and res['unique'] and res['legal'] and res['accepted'] and res['L'] == 4 and rp[-1][1] == 'win' and not any(x[0] == 'MISMATCH' for x in rp)
        row = dict(id=c['id'], ok=good, score=res['score'], finish=res['solution'].split('(')[-1].rstrip(')'), lifts=f.get('lifts'), counter=f.get('counter'), trap=f.get('trap'), decoys=f.get('decoys'), sol=res['solution'], b=c['b'], w=c['w'], forbidden=res.get('forbidden'))
        out.append(row)
        print(c['id'], 'OK' if good else 'FAIL', res['score'], row['finish'], 'lifts', row['lifts'], 'counter', row['counter'], 'trap', row['trap'], 'decoys', row['decoys'], 'forb', len(res.get('forbidden') or []))
    json.dump(out, open('verified.json', 'w', encoding='utf-8'), ensure_ascii=False)
    br.close()
