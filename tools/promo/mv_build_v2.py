"""《落子無聲》MV 橫式版（1920x1080、24fps）建置腳本（可重跑）
    python C:/claudehome/projects/VCF/tools/promo/mv_build_v2.py <h|v> [build|check|all]
    h = 橫式 1920x1080；v = 直式 1080x1920。不帶參數只印用法（避免誤覆蓋成品）

以 mv_build.py（直式初版）為底：疊化 0.3 秒、5b->6 白閃、字幕、頭尾淡入淡出、音訊淡入淡出沿用。
- 十段 AI 影片直接用（1920x1080、24fps）；太短慢放、太長裁尾，9_心弦整段加速填滿
- 遊戲實錄（直式）放進橫式畫框：模糊壓暗背景 + 高 1000 前景 + 柔影
- 中間檔：MV素材/第二版/work/
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = r'C:\Users\hangs\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin'
FFMPEG = os.path.join(FF, 'ffmpeg.exe')
FFPROBE = os.path.join(FF, 'ffprobe.exe')
ROOT = r'C:\claudehome\projects\VCF\docs'
ASSET = os.path.join(ROOT, 'promo', 'MV素材')
OUTD = os.path.join(ASSET, '第二版')
VIDDIR = {'h': os.path.join(ASSET, '落子無聲橫'), 'v': os.path.join(ASSET, '落子無聲916')}
SONG = os.path.join(ROOT, '遊戲音樂_原檔', '4_主題曲_落子無聲_有唱.mp3')
RUSH_A = os.path.join(ROOT, 'promo', '無聲原片', 'rush_A.mp4')
FONT = r'C:\Windows\Fonts\kaiu.ttf'
FINALS = {'h': os.path.join(ROOT, 'promo', '成品_有配樂', '落子無聲_MV_橫式.mp4'),
          'v': os.path.join(ROOT, 'promo', '成品_有配樂', '落子無聲_MV_直式.mp4')}
FPS = 24
MODE = 'h'
W, H = 1920, 1080
WORK = FINAL = VID = ''
# 版面參數（set_mode 填）
LAY = {}


def set_mode(m):
    global MODE, W, H, WORK, FINAL, VID, LAY
    MODE = m
    VID = VIDDIR[m]
    FINAL = FINALS[m]
    if m == 'h':
        W, H = 1920, 1080
        WORK = os.path.join(OUTD, 'work')
        LAY = dict(fw=756, fh=1000, gx=None, gy=None, sub_size=54, sub_y=0.86, sub_y_strong=0.86, sub_maxw=None,
                   sheet_cols=5, cut_cols=6, sheet_tw=480, cut_tw=320, sheet_name='檢查_縮圖.png', cut_name='檢查_切點.png')
    else:
        W, H = 1080, 1920
        WORK = os.path.join(OUTD, 'work_v')
        fw = 960
        fh = round(fw * 1430 / 1080)
        LAY = dict(fw=fw, fh=fh, gx=(W - fw) // 2, gy=290, sub_size=64, sub_y=0.80, sub_y_strong=0.90, sub_maxw=1000,
                   sheet_cols=9, cut_cols=9, sheet_tw=240, cut_tw=200, sheet_name='檢查_縮圖_直式.png',
                   cut_name='檢查_切點_直式.png')

SONG_START, SONG_LEN = 21.0, 60.4
XF = 0.3
HALF = XF / 2
BG = '0x0F0F1B'
TH = ['-threads', '4']

# 名稱, 起, 迄, 素材
SEGS = [
    ('1_月色', 21.0, 26.1, '1.mp4'),
    ('2_星子', 26.1, 30.3, '2.mp4'),
    ('3_執黑', 30.3, 33.9, '3.mp4'),
    ('4_動心', 33.9, 39.0, '4.mp4'),
    ('5a_一步', 39.0, 43.2, '5a.mp4'),
    ('game', 43.2, 50.4, None),
    ('5b_一念', 50.4, 53.6, '5b.mp4'),
    ('6_落子', 53.6, 58.2, '6.mp4'),
    ('7_五星', 58.2, 62.5, '7.mp4'),
    ('8_看見', 62.5, 67.2, '8.mp4'),
    ('9_心弦', 67.2, 75.4, '9.mp4'),
    ('end_win', 75.4, 77.4, None),
    ('end_home', 77.4, 81.4, None),
]
WHITE_AFTER = {'5b_一念'}
FILL_ALL = {'9_心弦'}      # 整段用到：加速填滿
# 若檢查後某段需要改成整段略加速填滿，把名稱加進 FILL_ALL（見回報）
FILL_ALL |= set(os.environ.get('MV_FILL', '').split(',')) - {''}

SUBS = [
    ('月色鋪成一張盤', 22.0, 25.8),
    ('星子零落　無人看', 26.4, 29.7),
    ('你執黑　我執白', 30.7, 33.7),
    ('誰先動了心　誰先亂', 34.1, 38.5),
    ('一步近', 39.4, 42.6),
    ('一步遠', 43.5, 46.2),
    ('輸贏都在', 46.8, 50.2),
    ('一念間', 50.6, 52.8),
    ('落子無聲　風也不敢喧', 54.2, 58.1),
    ('五星連成線　劃過長夜的邊', 58.3, 62.4),
    ('等你看見　那一瞬間', 62.6, 67.1),
    ('萬籟俱寂　只剩心跳的弦', 67.3, 75.4),
]
STRONG_SUBS = {'一步遠', '輸贏都在'}   # 疊在遊戲畫面上，加強陰影


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, timeout=kw.pop('timeout', 900), **kw)
    if r.returncode:
        sys.stderr.write(r.stderr.decode('utf8', 'replace')[-2500:])
        raise SystemExit(f'ffmpeg 失敗: {cmd[:6]}')
    return r


def probe_dur(path):
    r = run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
    return float(r.stdout.decode().strip())


def lens_of():
    n = len(SEGS)
    out = []
    for i, (name, a, b, _) in enumerate(SEGS):
        out.append((b - a) + (HALF if i > 0 else 0) + (HALF if i < n - 1 else 0))
    return out


def blurred_bg(src, t_last, out_png):
    """取影片最後一格 -> 高斯模糊 sigma30、壓暗到 40%、1920x1080"""
    raw = out_png + '.raw.png'
    run([FFMPEG, '-v', 'error', '-y', '-sseof', '-0.1', '-i', src, '-update', '1', '-frames:v', '1', raw])
    im = Image.open(raw).convert('RGB').resize((W, H), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(30))
    a = np.asarray(im, dtype=np.float32) * 0.40
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    im.save(out_png)
    return im


def shadow_on(base, box, blur=40, alpha=200, off=(0, 14)):
    x0, y0, x1, y1 = box
    sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((x0 + off[0], y0 + off[1], x1 + off[0], y1 + off[1]), fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert('RGBA'), sh).convert('RGB')


def render_video_clip(src, name, L, out):
    sd = probe_dur(src)
    if L > sd:
        f = L / sd                      # 慢放
    elif name in FILL_ALL:
        f = L / sd                      # 加速填滿
    else:
        f = 1.0
    vf = (f'setpts={f:.6f}*PTS,scale={W}:{H},fps={FPS},tpad=stop_mode=clone:stop_duration=0.2,'
          f'trim=duration={L:.4f},setpts=PTS-STARTPTS,format=yuv420p')
    run([FFMPEG, '-v', 'error', '-y'] + TH + ['-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '12',
         '-preset', 'fast', out])
    speed = 1.0 / f
    used = min(sd, L * speed) if f == 1.0 else sd
    return {'name': name, 'src_dur': sd, 'L': L, 'speed': speed, 'used': (0.0, used)}


def game_xy():
    fw, fh = LAY['fw'], LAY['fh']
    if LAY['gx'] is None:
        return (W - fw) // 2, (H - fh) // 2
    return LAY['gx'], LAY['gy']


def render_game(L, bg_png, out):
    base = Image.open(bg_png).convert('RGB')
    fw, fh = LAY['fw'], LAY['fh']
    x0, y0 = game_xy()
    base = shadow_on(base, (x0, y0, x0 + fw, y0 + fh))
    bp = os.path.join(WORK, 'game_base.png')
    base.save(bp)
    fc = (f'[1:v]crop=1080:1430:0:0,scale={fw}:{fh},fps={FPS},trim=duration={L:.4f},setpts=PTS-STARTPTS[fg];'
          f'[0:v][fg]overlay={x0}:{y0}:shortest=1,format=yuv420p[v]')
    run([FFMPEG, '-v', 'error', '-y'] + TH + ['-loop', '1', '-framerate', str(FPS), '-i', bp,
         '-ss', '0', '-i', RUSH_A, '-filter_complex', fc, '-map', '[v]', '-t', f'{L:.4f}', '-c:v', 'libx264',
         '-crf', '12', '-preset', 'fast', out])
    return {'name': 'game', 'src_dur': 26.4, 'L': L, 'speed': 1.0, 'used': (0.0, L)}


def render_end_win(L, bg_png, out):
    png = os.path.join(WORK, 'end_win_frame.png')
    run([FFMPEG, '-v', 'error', '-y', '-ss', '7.45', '-i', RUSH_A, '-frames:v', '1', png])
    fw, fh = LAY['fw'], LAY['fh']
    g = Image.open(png).convert('RGB').crop((0, 0, 1080, 1430)).resize((fw, fh), Image.LANCZOS)
    base = Image.open(bg_png).convert('RGB')
    x0, y0 = game_xy()
    base = shadow_on(base, (x0, y0, x0 + fw, y0 + fh))
    base.paste(g, (x0, y0))
    bp = os.path.join(WORK, 'end_win_comp.png')
    base.save(bp)
    still(bp, L, out)
    return {'name': 'end_win', 'src_dur': 0, 'L': L, 'speed': 0.0, 'used': (7.45, 7.45)}


def draw_text(base, text, size, cx, cy):
    font = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(base)
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = int(cx - tw / 2 - bb[0])
    y = int(cy - th / 2 - bb[1])
    sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + 3), text, font=font, fill=(0, 0, 0, 230))
    sh = sh.filter(ImageFilter.GaussianBlur(5))
    out = Image.alpha_composite(base.convert('RGBA'), sh)
    ImageDraw.Draw(out).text((x, y), text, font=font, fill=(255, 255, 255, 255),
                             stroke_width=2, stroke_fill=(10, 10, 20, 170))
    return out.convert('RGB'), (x, y, x + tw, y + th)


def render_end_home(L, bg_png, out):
    png = os.path.join(WORK, 'end_home_frame.png')
    run([FFMPEG, '-v', 'error', '-y', '-ss', '25.6', '-i', RUSH_A, '-frames:v', '1', png])
    if MODE == 'h':
        g = Image.open(png).convert('RGB').resize((540, 960), Image.LANCZOS)
        cx = int(W * 0.30)
        x0, y0 = cx - 270, (H - 960) // 2
        gw, gh = 540, 960
        tcx = 1380
        rows = [('落子無聲', 110), ('Gomoku Rush', 64), ('rush.hangsau.app', 56)]
        ys = [H // 2 - 150, H // 2 + 10, H // 2 + 110]
    else:
        gh = 1050
        gw = round(1080 * gh / 1920)
        g = Image.open(png).convert('RGB').resize((gw, gh), Image.LANCZOS)
        x0, y0 = (W - gw) // 2, 130
        tcx = W // 2
        rows = [('落子無聲', 120), ('Gomoku Rush', 68), ('rush.hangsau.app', 60)]
        ys = [1370, 1520, 1630]
    base = Image.open(bg_png).convert('RGB')
    base = shadow_on(base, (x0, y0, x0 + gw, y0 + gh))
    base.paste(g, (x0, y0))
    boxes = []
    for (t, s), y in zip(rows, ys):
        base, bx = draw_text(base, t, s, tcx, y)
        boxes.append(bx)
    print('片尾卡文字範圍', boxes)
    bp = os.path.join(WORK, 'end_home_comp.png')
    base.save(bp)
    still(bp, L, out)
    return {'name': 'end_home', 'src_dur': 0, 'L': L, 'speed': 0.0, 'used': (25.6, 25.6)}


def still(png, L, out):
    run([FFMPEG, '-v', 'error', '-y'] + TH + ['-loop', '1', '-framerate', str(FPS), '-t', f'{L:.4f}', '-i', png,
         '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', out])


def make_sub_png(text, path):
    size = LAY['sub_size']
    font = ImageFont.truetype(FONT, size)
    if LAY['sub_maxw']:
        while True:
            bb0 = ImageDraw.Draw(Image.new('RGB', (4, 4))).textbbox((0, 0), text, font=font)
            if bb0[2] - bb0[0] <= LAY['sub_maxw']:
                break
            size -= 1
            font = ImageFont.truetype(FONT, size)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = (W - tw) // 2 - bb[0]
    strong = text in STRONG_SUBS
    y = int(H * (LAY['sub_y_strong'] if strong else LAY['sub_y'])) - th // 2 - bb[1]
    if strong:   # 疊在米色棋盤上：先墊一條半透明深色底
        pad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(pad).rounded_rectangle((x + bb[0] - 28, y + bb[1] - 14, x + bb[2] + 28, y + bb[3] + 18),
                                              radius=18, fill=(8, 8, 18, 185))
        layer = Image.alpha_composite(layer, pad.filter(ImageFilter.GaussianBlur(2)))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + 3), text, font=font, fill=(0, 0, 0, 255 if strong else 230))
    sh = sh.filter(ImageFilter.GaussianBlur(7 if strong else 5))
    out = Image.alpha_composite(layer, sh)
    if strong:
        out = Image.alpha_composite(out, sh)       # 疊兩層加深陰影
    ImageDraw.Draw(out).text((x, y), text, font=font, fill=(255, 255, 255, 255),
                             stroke_width=3 if strong else 2, stroke_fill=(10, 10, 20, 230 if strong else 170))
    out.save(path)


def build():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(os.path.dirname(FINAL), exist_ok=True)
    n = len(SEGS)
    lens = lens_of()
    src = lambda f: os.path.join(VID, f)
    bg_game = os.path.join(WORK, 'bg_game.png')
    bg_end = os.path.join(WORK, 'bg_end.png')
    for _, _, _, f in SEGS:
        if f and not os.path.exists(src(f)):
            raise SystemExit('缺素材 ' + src(f))
    blurred_bg(src('5a.mp4'), 0, bg_game)
    blurred_bg(src('9.mp4'), 0, bg_end)
    clips, info = [], []
    for i, (name, a, b, f) in enumerate(SEGS):
        out = os.path.join(WORK, f'clip_{i:02d}_{name}.mp4')
        L = lens[i]
        if name == 'game':
            r = render_game(L, bg_game, out)
        elif name == 'end_win':
            r = render_end_win(L, bg_end, out)
        elif name == 'end_home':
            r = render_end_home(L, bg_end, out)
        else:
            r = render_video_clip(src(f), name, L, out)
        print('完成', name, round(L, 3), 'x%.3f' % r['speed'], r['used'])
        clips.append(out)
        info.append(r)

    subs = []
    for k, (txt, s, e) in enumerate(SUBS):
        pth = os.path.join(WORK, f'sub_{k:02d}.png')
        make_sub_png(txt, pth)
        subs.append((pth, s - SONG_START, e - SONG_START))

    cmd = [FFMPEG, '-v', 'error', '-y'] + TH + ['-filter_complex_threads', '4']
    for c in clips:
        cmd += ['-i', c]
    for pth, s, e in subs:
        cmd += ['-loop', '1', '-framerate', str(FPS), '-t', f'{e - s:.3f}', '-i', pth]
    cmd += ['-ss', str(SONG_START), '-t', str(SONG_LEN), '-i', SONG]
    fc = []
    M = lens[0]
    prev = '[0:v]'
    for i in range(1, n):
        tr = 'fadewhite' if SEGS[i - 1][0] in WHITE_AFTER else 'fade'
        fc.append(f'{prev}[{i}:v]xfade=transition={tr}:duration={XF}:offset={M - XF:.3f}[x{i}]')
        prev = f'[x{i}]'
        M = M + lens[i] - XF
    for k, (pth, s, e) in enumerate(subs):
        idx = n + k
        D = e - s
        fc.append(f'[{idx}:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st={D - 0.3:.3f}:d=0.3:alpha=1,'
                  f'setpts=PTS+{s:.3f}/TB[s{k}]')
        fc.append(f'{prev}[s{k}]overlay=0:0:eof_action=pass:format=auto[o{k}]')
        prev = f'[o{k}]'
    fc.append(f'{prev}fade=t=in:st=0:d=1.0,fade=t=out:st={SONG_LEN - 1.0:.3f}:d=1.0,format=yuv420p[v]')
    ai = n + len(subs)
    fc.append(f'[{ai}:a]afade=t=in:st=0:d=0.5,afade=t=out:st={SONG_LEN - 3.0:.3f}:d=3.0[a]')
    cmd += ['-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]', '-t', str(SONG_LEN),
            '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-r', str(FPS), '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', FINAL]
    print('合成中，預計片長', round(M, 2))
    run(cmd, timeout=2400)
    print('輸出', FINAL)


def grab(t, w=480):
    r = run([FFMPEG, '-v', 'error', '-ss', f'{t:.3f}', '-i', FINAL, '-frames:v', '1', '-vf', f'scale={w}:-2',
             '-f', 'image2pipe', '-vcodec', 'png', '-'])
    import io
    return Image.open(io.BytesIO(r.stdout)).convert('RGB')


def sheet(cells, cols, path, tw=480):
    font = ImageFont.truetype(FONT, 20 if tw >= 400 else 15)
    th = int(tw * H / W)
    rows = (len(cells) + cols - 1) // cols
    S = Image.new('RGB', (cols * (tw + 8) + 8, rows * (th + 34) + 8), (30, 30, 30))
    d = ImageDraw.Draw(S)
    for k, (t, label) in enumerate(cells):
        im = grab(t, tw)
        x = 8 + (k % cols) * (tw + 8)
        y = 8 + (k // cols) * (th + 34)
        S.paste(im, (x, y))
        d.text((x, y + th + 4), label, font=font, fill=(255, 255, 255))
    S.save(path)


def check():
    cells = []
    for name, a, b, _ in SEGS:
        t = (a + b) / 2 - SONG_START
        cells.append((t, f'{name} {t:.1f}s'))
    for txt, s, e in SUBS:
        t = (s + e) / 2 - SONG_START
        cells.append((t, f'字幕 {txt[:8]} {t:.1f}s'))
    sheet(cells, LAY['sheet_cols'], os.path.join(OUTD, LAY['sheet_name']), tw=LAY['sheet_tw'])
    cuts = []
    for name, a, b, _ in SEGS[:-1]:
        c = b - SONG_START
        for dt in (-0.25, 0.0, 0.25):
            cuts.append((c + dt, f'{name}|切 {c:.1f}s {dt:+.2f}'))
    sheet(cuts, LAY['cut_cols'], os.path.join(OUTD, LAY['cut_name']), tw=LAY['cut_tw'])
    # 逐格亮度：找閃黑
    r = run([FFMPEG, '-v', 'error', '-i', FINAL, '-vf', 'scale=96:54', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
    a = np.frombuffer(r.stdout, np.uint8).reshape(-1, 54 * 96).mean(axis=1)
    print('總格數', len(a), '最暗(2~59s)', a[24:1416].min(), '位置秒', (24 + a[24:1416].argmin()) / FPS)
    bad = [(round(i / FPS, 2), round(float(v), 1)) for i, v in enumerate(a) if 24 <= i < 1416 and v < 8]
    print('亮度<8 的格(頭尾淡入淡出除外):', bad)
    d = np.abs(np.diff(a))
    print('相鄰格亮度跳變最大 5 處:', [(round((int(i) + 1) / FPS, 2), round(float(d[i]), 1)) for i in np.argsort(d)[-5:]])


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('h', 'v', 'hdry'):
        print(__doc__)
        raise SystemExit(0)
    m = sys.argv[1]
    if m == 'hdry':     # 橫式乾跑：只驗路徑，不輸出
        set_mode('h')
        for _, _, _, f in SEGS:
            if f:
                pth = os.path.join(VID, f)
                print(('OK ' if os.path.exists(pth) else '缺 ') + pth)
        raise SystemExit(0)
    set_mode(m)
    mode = sys.argv[2] if len(sys.argv) > 2 else 'build'
    if mode in ('build', 'all'):
        build()
    if mode in ('check', 'all'):
        check()
