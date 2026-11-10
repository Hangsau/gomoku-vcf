#!/usr/bin/env python3
"""教學動畫素材整理（W7）：codex 畫的 4×4 圖集 → 遊戲用的 WebP＋manifest。

用法：python C:/claudehome/projects/VCF/tools/art_build.py
讀：game/learn/art/*.png（codex 原圖，留著不動）
寫：game/learn/art/web/<名>.webp（壓縮過、低透明度雜色清掉）＋ game/learn/art/manifest.json
manifest 每張記：frames、cols、rows，以及「主體」在格子裡的位置與大小（用最後一格的不透明範圍量），
讓 learn.js 把動畫的子剛好疊在棋盤上的子：
  anchor：主體中心相對格子中心的偏移（以格寬為 1）
  size：主體寬度相對格寬（棋子類就是棋子直徑）
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'game' / 'learn' / 'art'
WEB = ART / 'web'
WEB.mkdir(exist_ok=True)
COLS = ROWS = 4
man = {}
for p in sorted(ART.glob('*.png')):
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    # 低透明度像素的顏色是去背殘渣（看圖時的紅黃綠雜邊），alpha < 10 的直接清成全透明
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10: px[x, y] = (0, 0, 0, 0)
    cw, ch = w / COLS, h / ROWS
    last = im.crop((round(3 * cw), round(3 * ch), round(4 * cw), round(4 * ch)))
    a = last.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    bb = a.getbbox()
    anchor, size = [0, 0], 1
    if bb:
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        anchor = [round(cx / cw - .5, 3), round(cy / ch - .5, 3)]
        size = round((bb[2] - bb[0]) / cw, 3)
    side = 1024   # 4×4 各 256px，播放時縮到棋盤格大小，夠清楚又小
    im.resize((side, side), Image.LANCZOS).save(WEB / (p.stem + '.webp'), 'WEBP', quality=86, method=6)
    man[p.stem] = {'file': f'web/{p.stem}.webp', 'cols': COLS, 'rows': ROWS, 'frames': COLS * ROWS, 'anchor': anchor, 'size': size}
    print(p.stem, 'anchor', anchor, 'size', size, round((WEB / (p.stem + '.webp')).stat().st_size / 1024), 'KB')
(ART / 'manifest.json').write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding='utf-8')
print('manifest', len(man))
