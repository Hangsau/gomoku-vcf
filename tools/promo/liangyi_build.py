"""《兩儀》MV 橫式與「兩儀殿」直式廣告 剪接腳本（可重跑）
用法：
    python C:/claudehome/projects/VCF/tools/promo/liangyi_build.py <mv|ad> [build|check|all] [選項]
    mv  ＝橫式 1920x1080、24fps、約 57 秒（歌曲 15.0–72.3）→ docs/promo/成品_有配樂/兩儀_MV_橫式.mp4
    ad  ＝直式 1080x1920、24fps、約 22 秒（副歌）          → docs/promo/成品_有配樂/兩儀殿_廣告_直式.mp4
    不帶參數只印這段用法（避免誤覆蓋成品）。預設動作 build；check 產生縮圖總覽＋每個切點前後對照圖；all＝build＋check。
選項：
    --assets DIR   AI 影片資料夾（預設 docs/promo/MV素材/兩儀橫 或 兩儀916）
    --out FILE     成品路徑（預設見上；用假素材試跑時務必指到暫存資料夾）
    --check-dir D  檢查圖資料夾（預設 docs/promo/檢查截圖/兩儀）
    --work DIR     中間檔資料夾（預設 %TEMP%/liangyi_build_work/<mv|ad>）
    python liangyi_build.py fake <資料夾>   用 ffmpeg 產生假素材（色塊片）給腳本試跑，不放進專案

素材：
    歌曲   docs/遊戲音樂_原檔/6_戰鬥_兩儀_有唱.mp3
    歌詞時間 docs/遊戲音樂_原檔/兩儀_分軌/時間點.json（句子起迄；下刀點＝每句起點前 0.15 秒）
    兩儀殿實錄 docs/promo/無聲原片/duel_line.mp4 ＋ duel_line_時間點.json（tools/promo/duel_promo.mjs 錄）
    mv 的 AI 影片：1_對坐 2_黑衣 3_兩手 5_白衣 6_深淵 7_劍 8_雪盾 8b_棋盤前破盾 9_落子 10_山河 (.mp4)；
      取用區段依使用者限制寫在 plan_mv（5_白衣只用 0–1.8s、2_黑衣 0–2.5/3.0–5.0s、7_劍動作 0–2.2s…）
    ad 的 AI 影片：a1_對坐 a2_劍 (.mp4)；缺檔時改用純色底＋字卡，不失敗
"""
import json
import os
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = r'C:\Users\hangs\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin'
FFMPEG = os.path.join(FF, 'ffmpeg.exe')
FFPROBE = os.path.join(FF, 'ffprobe.exe')
ROOT = r'C:\claudehome\projects\VCF\docs'
ASSET = os.path.join(ROOT, 'promo', 'MV素材')
SONG = os.path.join(ROOT, '遊戲音樂_原檔', '6_戰鬥_兩儀_有唱.mp3')
TIMES = os.path.join(ROOT, '遊戲音樂_原檔', '兩儀_分軌', '時間點.json')
DUEL = os.path.join(ROOT, 'promo', '無聲原片', 'duel_line.mp4')
DUEL_JSON = os.path.join(ROOT, 'promo', '無聲原片', 'duel_line_時間點.json')
FINAL_DIR = os.path.join(ROOT, 'promo', '成品_有配樂')
FINALS = {'mv': os.path.join(FINAL_DIR, '兩儀_MV_橫式.mp4'), 'ad': os.path.join(FINAL_DIR, '兩儀殿_廣告_直式.mp4')}
CHECK_DIR = os.path.join(ROOT, 'promo', '檢查截圖', '兩儀')
AIDIR = {'mv': os.path.join(ASSET, '兩儀橫'), 'ad': os.path.join(ASSET, '兩儀916')}
FONT = r'C:\Windows\Fonts\kaiu.ttf'
MV_FILES = ['1_對坐', '2_黑衣', '3_兩手', '5_白衣', '6_深淵', '7_劍', '8_雪盾', '8b_棋盤前破盾', '9_落子', '10_山河']
AD_FILES = ['a1_對坐', 'a2_劍']
FPS = 24
TH = ['-threads', '4']
BG = '0x0F0F1B'

# ---- 執行期狀態（main 填）
MODE = 'mv'
W, H = 1920, 1080
VID = WORK = FINAL = CHECK = ''
SEGS = []       # dict: name, a, b(歌曲或影片時間，僅供檢查圖標示), dur(淨長), kind, ...
SUBS = []       # (png, t_start, t_end) 影片時間
XF = 0.3
SONG_START = SONG_LEN = 0.0
AUDIO_FADE_IN, AUDIO_FADE_OUT = 0.5, 1.5
MISSING = []


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, timeout=kw.pop('timeout', 1200), **kw)
    if r.returncode:
        sys.stderr.write(r.stderr.decode('utf8', 'replace')[-2500:])
        raise SystemExit(f'ffmpeg 失敗: {[str(c) for c in cmd[:6]]}')
    return r


def probe_dur(path):
    r = run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
    return float(r.stdout.decode().strip())


# ---------------------------------------------------------------- 資料
def load_lines():
    j = json.load(open(TIMES, encoding='utf8'))
    L = {x['i']: x for x in j['lines']}
    assert len(L) == 10, '時間點.json 要有 10 句'
    return L


def load_marks():
    j = json.load(open(DUEL_JSON, encoding='utf8'))
    m = {x['name']: x['t'] for x in j['marks']}
    for k in ('countdown_start', 'q1_start', 'q1_solve', 'q3_start', 'q3_solve', 'q4_start', 'q4_solve', 'result'):
        assert k in m, f'duel_line_時間點.json 缺 {k}'
    return m, j['duration']


# ---------------------------------------------------------------- 文字
def bold_text_layer(size, text, cx, cy, size_w=None, stroke_in=2, stroke_out=5, pad=False, canvas=None, maxw=None):
    """回傳 (RGBA 整幅圖層, 文字框)。白字先加粗（白色描邊 2px）、外圈深色描邊（共 3px 深色邊）＋柔影。"""
    cw, ch = canvas or (W, H)
    font = ImageFont.truetype(FONT, size)
    if maxw:
        while ImageDraw.Draw(Image.new('RGB', (4, 4))).textbbox((0, 0), text, font=font)[2] > maxw and size > 20:
            size -= 2
            font = ImageFont.truetype(FONT, size)
    d0 = ImageDraw.Draw(Image.new('RGB', (4, 4)))
    bb = d0.textbbox((0, 0), text, font=font, stroke_width=stroke_out)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = int(cx - tw / 2 - bb[0])
    y = int(cy - th / 2 - bb[1])
    layer = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    if pad:
        p = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        ImageDraw.Draw(p).rounded_rectangle((x + bb[0] - 30, y + bb[1] - 16, x + bb[2] + 30, y + bb[3] + 20), radius=20, fill=(8, 8, 18, 190))
        layer = Image.alpha_composite(layer, p.filter(ImageFilter.GaussianBlur(2)))
    sh = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + 4), text, font=font, fill=(0, 0, 0, 255), stroke_width=stroke_out, stroke_fill=(0, 0, 0, 255))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    layer = Image.alpha_composite(layer, sh)
    dr = ImageDraw.Draw(layer)
    dr.text((x, y), text, font=font, fill=(10, 10, 20, 255), stroke_width=stroke_out, stroke_fill=(10, 10, 20, 255))
    dr.text((x, y), text, font=font, fill=(255, 255, 255, 255), stroke_width=stroke_in, stroke_fill=(255, 255, 255, 255))
    return layer, (x + bb[0], y + bb[1], x + bb[2], y + bb[3])


def merge_layers(*layers):
    out = layers[0]
    for l in layers[1:]:
        out = Image.alpha_composite(out, l)
    return out


# ---------------------------------------------------------------- 片段渲染
def fit_vf(L, f=1.0, ss=0.0):
    """影片濾鏡：從 ss 起、速度 f（<1 慢放）、鋪滿 W×H（裁切）、補尾、截成 L 秒"""
    return (f'setpts={1.0 / f:.6f}*(PTS-STARTPTS),scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={FPS},'
            f'tpad=stop_mode=clone:stop_duration=0.5,trim=duration={L:.4f},setpts=PTS-STARTPTS,format=yuv420p')


def render_ai(src, L, out, win=None, fit=False):
    """AI 影片：win=(a,b) 取來源區段；不給＝整段。比 L 短就慢放填滿，比 L 長就取開頭 L 秒（不加速）。回傳 info。"""
    sd = probe_dur(src)
    a, b = (0.0, sd) if win is None else (max(0.0, win[0]), min(sd, win[1]))
    seg = b - a
    f = 1.0
    if seg < L:
        f = seg / L
    elif fit and seg / L <= 1.45:       # 指定區段略長於可用長度：整段略加速放進去
        f = seg / L
    used = (a, a + min(seg, L * f))
    vf = fit_vf(L, f)
    run([FFMPEG, '-v', 'error', '-y'] + TH + ['-ss', f'{a:.3f}', '-t', f'{seg:.3f}', '-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '14',
         '-preset', 'fast', out])
    return {'src': os.path.basename(src), 'L': round(L, 2), 'speed': round(f, 3), 'used': tuple(round(x, 2) for x in used)}


def solid_card(L, out, top=(22, 30, 54), bot=(8, 10, 22)):
    """缺檔時的底：上下漸層純色"""
    im = Image.new('RGB', (W, H))
    px = im.load()
    for y in range(H):
        t = y / (H - 1)
        c = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3))
        for x in range(0, W, 1):
            px[x, y] = c
    p = os.path.join(WORK, 'solid.png')
    im.save(p)
    still(p, L, out)
    return {'src': '(純色底)', 'L': round(L, 2), 'speed': 0.0, 'used': (0, 0)}


def still(png, L, out):
    run([FFMPEG, '-v', 'error', '-y'] + TH + ['-loop', '1', '-framerate', str(FPS), '-t', f'{L:.4f}', '-i', png,
         '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out])


def blurred_bg_from_duel(t, out_png):
    """實錄某一格 → 鋪滿 W×H、高斯模糊 sigma30、壓暗 40%"""
    raw = out_png + '.raw.png'
    run([FFMPEG, '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', DUEL, '-frames:v', '1', raw])
    im = Image.open(raw).convert('RGB')
    sc = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    l, tp = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((l, tp, l + W, tp + H)).filter(ImageFilter.GaussianBlur(30))
    import numpy as np
    a = np.asarray(im, dtype=np.float32) * 0.40
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out_png)
    return out_png


def shadow_on(base, box, blur=40, alpha=200, off=(0, 14)):
    x0, y0, x1, y1 = box
    sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((x0 + off[0], y0 + off[1], x1 + off[0], y1 + off[1]), fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert('RGBA'), sh).convert('RGB')


def render_duel(name, L, t_a, t_b, out, crop_h, freeze=0.0, cx_frac=0.5, fh=1040):
    """兩儀殿實錄（直式 1170x2532）。橫式：裁上方 crop_h 後放進橫框中央（模糊壓暗背景＋柔影）；
    直式廣告：裁 1170x2080 鋪滿全螢幕。來源區段 [t_a,t_b] 以 (t_b-t_a)/(L-freeze) 的速度播放（>1 快轉），最後 freeze 秒定格。"""
    play = L - freeze
    f = (t_b - t_a) / play            # 來源秒 / 輸出秒
    if MODE == 'ad':
        fw, fhh, x0, y0 = W, H, 0, 0
        vf_src = f'crop=1170:2080:0:0,scale={W}:{H}'
        base_png = None
    else:
        fhh = fh
        fw = round(1170 * fhh / crop_h)
        x0 = int(W * cx_frac - fw / 2)
        y0 = (H - fhh) // 2
        vf_src = f'crop=1170:{crop_h}:0:0,scale={fw}:{fhh}'
        mid = (t_a + t_b) / 2
        bg_png = blurred_bg_from_duel(mid, os.path.join(WORK, f'bg_{name}.png'))
        base = shadow_on(Image.open(bg_png).convert('RGB'), (x0, y0, x0 + fw, y0 + fhh))
        base_png = os.path.join(WORK, f'base_{name}.png')
        base.save(base_png)
    fg = (f'[1:v]setpts=(PTS-STARTPTS)/{f:.6f},{vf_src},fps={FPS},tpad=stop_mode=clone:stop_duration={freeze + 0.5:.3f},'
          f'trim=duration={L:.4f},setpts=PTS-STARTPTS[fg]')
    if MODE == 'ad':
        fc = fg.replace('[fg]', ',format=yuv420p[v]')
        cmd = [FFMPEG, '-v', 'error', '-y'] + TH + ['-ss', f'{t_a:.3f}', '-t', f'{(t_b - t_a) + 0.2:.3f}', '-i', DUEL, '-filter_complex',
               fc.replace('[1:v]', '[0:v]'), '-map', '[v]', '-t', f'{L:.4f}', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out]
    else:
        fc = fg + f';[0:v][fg]overlay={x0}:{y0}:shortest=1,format=yuv420p[v]'
        cmd = [FFMPEG, '-v', 'error', '-y'] + TH + ['-loop', '1', '-framerate', str(FPS), '-i', base_png,
               '-ss', f'{t_a:.3f}', '-t', f'{(t_b - t_a) + 0.2:.3f}', '-i', DUEL, '-filter_complex', fc, '-map', '[v]', '-t', f'{L:.4f}',
               '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out]
    run(cmd)
    return {'src': 'duel_line.mp4', 'L': round(L, 2), 'speed': round(f, 2), 'used': (round(t_a, 2), round(t_b, 2)), 'freeze': round(freeze, 2),
            'panel_x': x0}


# ---------------------------------------------------------------- 時間軸引擎
def lens_of(segs):
    n = len(segs)
    out = []
    for i, s in enumerate(segs):
        out.append(s['dur'] + (XF / 2 if i > 0 else 0) + (XF / 2 if i < n - 1 else 0))
    return out


def starts_of(segs):
    t, out = 0.0, []
    for s in segs:
        out.append(t)
        t += s['dur']
    return out


def compose(clips, lens, overlays, total):
    """clips: 各段 mp4；overlays: [(png, t_start, t_end)]；音樂 SONG_START 起 total 秒，淡入淡出"""
    n = len(clips)
    cmd = [FFMPEG, '-v', 'error', '-y'] + TH + ['-filter_complex_threads', '4']
    for c in clips:
        cmd += ['-i', c]
    for ov in overlays:
        pth, s, e = ov[:3]
        cmd += ['-loop', '1', '-framerate', str(FPS), '-t', f'{e - s:.3f}', '-i', pth]
    cmd += ['-ss', f'{SONG_START:.3f}', '-t', f'{total:.3f}', '-i', SONG]
    fc = []
    M = lens[0]
    prev = '[0:v]'
    for i in range(1, n):
        fc.append(f'{prev}[{i}:v]xfade=transition=fade:duration={XF}:offset={M - XF:.3f}[x{i}]')
        prev = f'[x{i}]'
        M = M + lens[i] - XF
    for k, ov in enumerate(overlays):
        pth, s, e = ov[:3]
        fd = ov[3] if len(ov) > 3 else 0.3
        idx = n + k
        D = e - s
        fc.append(f'[{idx}:v]format=rgba,fade=t=in:st=0:d={fd}:alpha=1,fade=t=out:st={max(D - fd, 0.0):.3f}:d={fd}:alpha=1,setpts=PTS+{s:.3f}/TB[s{k}]')
        fc.append(f'{prev}[s{k}]overlay=0:0:eof_action=pass:format=auto[o{k}]')
        prev = f'[o{k}]'
    fc.append(f'{prev}fade=t=in:st=0:d=0.8,fade=t=out:st={total - 1.0:.3f}:d=1.0,format=yuv420p[v]')
    ai = n + len(overlays)
    fc.append(f'[{ai}:a]afade=t=in:st=0:d={AUDIO_FADE_IN},afade=t=out:st={total - AUDIO_FADE_OUT:.3f}:d={AUDIO_FADE_OUT}[a]')
    cmd += ['-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium',
            '-r', str(FPS), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', FINAL]
    print('合成中，預計片長', round(M, 2))
    run(cmd, timeout=3000)
    print('輸出', FINAL)


# ---------------------------------------------------------------- MV 規劃
def plan_mv():
    global SONG_START, SONG_LEN, SEGS, SUBS
    L = load_lines()
    mk, _ = load_marks()
    cut = {i: L[i]['start'] - 0.15 for i in L}
    t0, t_end = 15.0, 72.3
    c10_end = 65.9
    SONG_START, SONG_LEN = t0, t_end - t0
    m1 = (cut[1] + cut[2]) / 2
    m10 = (cut[10] + c10_end) / 2
    m7 = cut[7] + 0.6 * (cut[8] - cut[7])       # 7_劍：動作 0–2.2s 佔前六成，光柱佔後四成
    m8 = (cut[8] + cut[9]) / 2
    segs = [
        dict(name='片頭_1對坐', a=t0, b=cut[1], kind='ai', f='1_對坐', title=True),
        dict(name='句1前_2黑衣', a=cut[1], b=m1, kind='ai', f='2_黑衣', win=(0.0, 2.5)),
        dict(name='句1後_5白衣', a=m1, b=cut[2], kind='ai', f='5_白衣', win=(0.0, 1.8)),
        dict(name='句2_3兩手', a=cut[2], b=cut[3], kind='ai', f='3_兩手'),
        dict(name='句3_實錄倒數', a=cut[3], b=cut[4], kind='duel', win=(mk['q1_start'] - 0.5, mk['q1_start'] + 2.7), crop=1800, freeze=0.0),
        dict(name='句4_2黑衣正面', a=cut[4], b=cut[5], kind='ai', f='2_黑衣', win=(3.0, 5.0)),
        dict(name='句5_6深淵', a=cut[5], b=cut[6], kind='ai', f='6_深淵'),
        dict(name='句6_實錄沖四', a=cut[6], b=cut[7], kind='duel', win=(mk['q3_start'] - 0.4, mk['q3_solve'] - 0.45), crop=1800, freeze=1.2),
        dict(name='句7前_7劍揮劍', a=cut[7], b=m7, kind='ai', f='7_劍', win=(0.0, 2.2)),
        dict(name='句7後_7劍光柱', a=m7, b=cut[8], kind='ai', f='7_劍', win=(2.2, 4.4)),
        dict(name='句8前_8雪盾', a=cut[8], b=m8, kind='ai', f='8_雪盾', win=(0.5, 3.0)),
        dict(name='句8後_8b破盾', a=m8, b=cut[9], kind='ai', f='8b_棋盤前破盾', win=(2.0, 4.0)),
        dict(name='句9_實錄解開', a=cut[9], b=cut[10], kind='duel', win=(mk['q4_solve'] - 2.9, mk['q4_solve'] + 0.6), crop=1800, freeze=0.0),
        dict(name='句10前_9落子', a=cut[10], b=m10, kind='ai', f='9_落子', win=(0.0, 3.0)),
        dict(name='句10後_10山河', a=m10, b=c10_end, kind='ai', f='10_山河'),
        dict(name='結尾_實錄結果', a=c10_end, b=t_end, kind='duel', win=(mk['result'] - 0.6, 10 ** 6), crop=2100, freeze=None, end=True),
    ]
    for s in segs:
        s['dur'] = s['b'] - s['a']
    SEGS = segs
    st = starts_of(segs)
    song2vid = lambda t: t - t0
    # 字幕（72px、加粗、深色描邊）；疊在實錄上的三句加深色底條
    STRONG = {3, 6, 9}
    SUBS = []
    for i in range(1, 11):
        txt = L[i]['text'].replace(' ', '　')
        s = max(L[i]['start'] - 0.05, 0)
        nxt = L[i + 1]['start'] - 0.05 if i < 10 else L[i]['end'] + 0.4
        e = min(L[i]['end'] + 0.25, nxt)
        layer, _ = bold_text_layer(72, txt, W / 2, H * 0.86, pad=(i in STRONG), maxw=1780)
        pth = os.path.join(WORK, f'sub_{i:02d}.png')
        layer.save(pth)
        SUBS.append((pth, song2vid(s), song2vid(e)))
    # 片名「兩儀」：片頭淡入淡出
    tl, _ = bold_text_layer(300, '兩儀', W / 2, H * 0.47, stroke_in=3, stroke_out=8)
    tp = os.path.join(WORK, 'title.png')
    tl.save(tp)
    SUBS.append((tp, song2vid(t0 + 1.0), song2vid(cut[1] - 0.3), 1.0))
    # 末 2.5 秒「兩儀殿｜rush.hangsau.app」（實錄移到左側，字在右側）
    ea = t_end - 2.5
    l1, _ = bold_text_layer(120, '兩儀殿', W * 0.70, H * 0.43, stroke_in=3, stroke_out=7)
    l2, _ = bold_text_layer(66, 'rush.hangsau.app', W * 0.70, H * 0.60, stroke_in=2, stroke_out=6)
    ep = os.path.join(WORK, 'endcard.png')
    merge_layers(l1, l2).save(ep)
    SUBS.append((ep, song2vid(ea), song2vid(t_end), 0.5))
    return st


# ---------------------------------------------------------------- 廣告規劃
def plan_ad():
    global SONG_START, SONG_LEN, SEGS, SUBS, AUDIO_FADE_IN, AUDIO_FADE_OUT
    L = load_lines()
    mk, _ = load_marks()
    t0 = L[7]['start'] - 0.3
    t_end = 72.3
    SONG_START, SONG_LEN = t0, t_end - t0
    AUDIO_FADE_IN, AUDIO_FADE_OUT = 0.3, 1.2
    d_a1, d_a2, d_end = 3.0, 2.0, 4.5
    foot = SONG_LEN - d_a1 - d_a2 - d_end                  # 實錄總長
    d1, d3, d4, d5 = 2.6, 1.3, 2.0, 3.3
    d2 = foot - d1 - d3 - d4 - d5
    q1s, q1v, res = mk['q1_start'], mk['q1_solve'], mk['result']
    segs = [
        dict(name='a1_對坐', kind='ai', f='a1_對坐', dur=d_a1, a=0, b=d_a1, win=(1.0, 4.0)),
        dict(name='a2_劍', kind='ai', f='a2_劍', dur=d_a2, a=d_a1, b=d_a1 + d_a2, win=(0.3, 2.3)),
        dict(name='實錄1_倒數', kind='duel', win=(mk['countdown_start'] + 0.3, mk['countdown_start'] + 0.3 + d1), dur=d1, freeze=0.0),
        dict(name='實錄2_沖四', kind='duel', win=(q1s + 0.6, q1v - 0.1), dur=d2, freeze=0.0),
        dict(name='實錄3_得分', kind='duel', win=(q1v - 0.1, q1v - 0.1 + d3), dur=d3, freeze=0.0),
        dict(name='實錄4_快轉', kind='duel', win=(q1v + 1.5, mk['q4_solve'] - 3.3), dur=d4, freeze=0.0),
        dict(name='實錄5_獲勝', kind='duel', win=(mk['q4_solve'] - 1.0, res + 2.0), dur=d5, freeze=0.0),
        dict(name='片尾字卡', kind='card', dur=d_end),
    ]
    t = 0.0
    for s in segs:
        s['a'], s['b'] = t, t + s['dur']
        t += s['dur']
    SEGS = segs
    st = starts_of(segs)
    SUBS = []

    def cap(png_name, text, ts, te, size=82, y=0.86, pad=True):
        layer, _ = bold_text_layer(size, text, W / 2, H * y, pad=pad, maxw=980)
        pth = os.path.join(WORK, png_name)
        layer.save(pth)
        SUBS.append((pth, ts, te))
    big, _ = bold_text_layer(190, '真人對戰', W / 2, H * 0.5, stroke_in=3, stroke_out=8)
    bp = os.path.join(WORK, 'cap_big1.png'); big.save(bp)
    SUBS.append((bp, 0.2, d_a1))
    big2, _ = bold_text_layer(120, '同一題 誰先解開', W / 2, H * 0.5, stroke_in=3, stroke_out=7, maxw=980)
    bp2 = os.path.join(WORK, 'cap_big2.png'); big2.save(bp2)
    SUBS.append((bp2, d_a1 + 0.1, d_a1 + d_a2 + 0.1))
    s_d = d_a1 + d_a2
    cap('cap_1.png', '同時開始', st[2] + 0.2, st[3] + 0.1)
    cap('cap_2.png', '連續沖四', st[3] + 0.2, st[4] + 0.1)
    cap('cap_3.png', '先解開的得分', st[4] + 0.1, st[6] - 0.0)
    cap('cap_4.png', '先拿 3 分獲勝', st[6] + 0.1, st[7] + 0.2, y=0.07)
    # 片尾字卡
    r1, _ = bold_text_layer(230, '兩儀殿', W / 2, H * 0.36, stroke_in=4, stroke_out=9)
    r2, _ = bold_text_layer(98, '免登入 馬上開戰', W / 2, H * 0.54, stroke_in=3, stroke_out=7, maxw=980)
    r3, _ = bold_text_layer(84, 'rush.hangsau.app', W / 2, H * 0.66, stroke_in=2, stroke_out=6, maxw=980)
    cp = os.path.join(WORK, 'endcard_ad.png')
    merge_layers(r1, r2, r3).save(cp)
    SUBS.append((cp, st[7] + 0.1, st[7] + d_end))
    return st


# ---------------------------------------------------------------- build
def pick_ai_window(seg, sd, state):
    """回傳 (win 或 None, 備註)。pos=mid/tail/head_avoid 為 5_白衣 的分段使用規則（句1後 取尾、句4 取不重疊的開頭）。"""
    p = seg.get('pos')
    if p == 'mid':
        L = seg['_L']
        a = max(0.0, (sd - L) / 2)
        return (a, a + L), ''
    if p == 'tail':
        L = seg['_L']
        a = max(0.0, sd - L)
        state['tail_a'] = a
        return (a, sd), ''
    if p == 'head_avoid':
        a = 0.0
        b = state.get('tail_a', sd)
        return (a, b), ''
    return None, ''


def build():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(os.path.dirname(FINAL), exist_ok=True)
    st = plan_mv() if MODE == 'mv' else plan_ad()
    names = MV_FILES if MODE == 'mv' else AD_FILES
    src = lambda f: os.path.join(VID, f + '.mp4')
    miss = [src(f) for f in names if not os.path.exists(src(f))]
    if MODE == 'mv' and miss:
        print('缺素材（等 AI 影片放進來再跑）：')
        for m in miss:
            print('  缺', m)
        raise SystemExit(2)
    if miss:
        print('ad 缺 AI 影片，改用純色底＋字卡：', ', '.join(os.path.basename(m) for m in miss))
    lens = lens_of(SEGS)
    clips, info = [], []
    state = {}
    for i, s in enumerate(SEGS):
        out = os.path.join(WORK, f'clip_{i:02d}.mp4')
        Lc = lens[i]
        s['_L'] = Lc
        if s['kind'] == 'ai':
            pth = src(s['f'])
            if not os.path.exists(pth):
                r = solid_card(Lc, out)
            else:
                sd = probe_dur(pth)
                win = s.get('win')
                r = render_ai(pth, Lc, out, win, fit=win is not None)
        elif s['kind'] == 'duel':
            ta, tb = s['win']
            if s.get('end'):
                _, dd = load_marks()
                tb = dd - 0.05
                s['win'] = (ta, tb)
                avail = tb - ta
                freeze = max(Lc - avail, 0.0)
                r = render_duel(s['name'], Lc, ta, tb, out, s['crop'], freeze=freeze, cx_frac=0.30)
            else:
                r = render_duel(s['name'], Lc, ta, tb, out, s.get('crop', 1800), freeze=s.get('freeze', 0.0))
        else:   # card（廣告片尾）
            top, bot = (24, 34, 62), (8, 10, 22)
            g = Image.new('RGB', (1, H))
            for y in range(H):
                t = y / (H - 1)
                g.putpixel((0, y), tuple(int(top[k] * (1 - t) + bot[k] * t) for k in range(3)))
            g = g.resize((W, H))
            gp = os.path.join(WORK, 'card_bg.png')
            g.save(gp)
            still(gp, Lc, out)
            r = {'src': '(字卡底)', 'L': round(Lc, 2), 'speed': 0.0, 'used': (0, 0)}
        print('完成', s['name'], round(Lc, 2), 'x%s' % r['speed'], r['used'])
        clips.append(out)
        info.append(r)
    total = sum(s['dur'] for s in SEGS)
    compose(clips, lens, SUBS, total)
    json.dump({'mode': MODE, 'final': FINAL, 'total': round(total, 2), 'segs': [{'name': s['name'], 'start': round(a, 2), 'dur': round(s['dur'], 2)}
              for s, a in zip(SEGS, st)], 'clips': [{k: (list(v) if isinstance(v, tuple) else v) for k, v in x.items()} for x in info]},
              open(os.path.join(WORK, 'build_info.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- check
def grab(t, w=480):
    import io
    r = run([FFMPEG, '-v', 'error', '-ss', f'{max(t, 0):.3f}', '-i', FINAL, '-frames:v', '1', '-vf', f'scale={w}:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'])
    return Image.open(io.BytesIO(r.stdout)).convert('RGB')


def sheet(cells, cols, path, tw):
    font = ImageFont.truetype(FONT, 20 if tw >= 300 else 15)
    th = round(tw * H / W)
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
    import numpy as np
    os.makedirs(CHECK, exist_ok=True)
    if not SEGS:
        (plan_mv if MODE == 'mv' else plan_ad)()
    st = starts_of(SEGS)
    dur = probe_dur(FINAL)
    wide = MODE == 'mv'
    tw_sheet = 400 if wide else 210
    cells = []
    for s, a in zip(SEGS, st):
        t = a + s['dur'] / 2
        cells.append((t, f"{s['name']} {t:.1f}s"))
    for ov in SUBS:
        pth, a, b = ov[:3]
        t = (a + b) / 2
        cells.append((t, f"字幕/字卡 {os.path.basename(pth)[:10]} {t:.1f}s"))
    sheet(cells, 5 if wide else 9, os.path.join(CHECK, f'{MODE}_縮圖總覽.png'), tw_sheet)
    cuts = []
    for s, a in zip(SEGS[:-1], st[1:]):
        for dt in (-0.2, 0.2):
            cuts.append((a + dt, f"{s['name'][:7]}|切{a:.1f} {dt:+.1f}"))
    sheet(cuts, 6 if wide else 12, os.path.join(CHECK, f'{MODE}_切點對照.png'), 300 if wide else 150)
    r = run([FFMPEG, '-v', 'error', '-i', FINAL, '-vf', 'scale=96:54', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
    a = np.frombuffer(r.stdout, np.uint8).reshape(-1, 54 * 96).mean(axis=1)
    print('片長', round(dur, 2), '總格數', len(a), '最暗(1~末1.5秒)', round(float(a[FPS:-int(FPS * 1.5)].min()), 1))
    bad = [(round(i / FPS, 2), round(float(v), 1)) for i, v in enumerate(a) if FPS <= i < len(a) - int(FPS * 1.5) and v < 8]
    print('亮度<8 的格:', bad[:10])
    d = np.abs(np.diff(a))
    print('相鄰格亮度跳變最大 5 處:', [(round((int(i) + 1) / FPS, 2), round(float(d[i]), 1)) for i in np.argsort(d)[-5:]])
    print('檢查圖:', CHECK)


# ---------------------------------------------------------------- 假素材
def make_fake(d):
    os.makedirs(os.path.join(d, '兩儀橫'), exist_ok=True)
    os.makedirs(os.path.join(d, '兩儀916'), exist_ok=True)
    cols = ['0x405080', '0x805040', '0x508040', '0x804080', '0x408080', '0x808040', '0x606060', '0x304060', '0x603040']
    for k, f in enumerate(MV_FILES):
        run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={cols[k]}:s=1920x1080:r=24:d=5,format=yuv420p', '-f', 'lavfi',
             '-i', 'testsrc2=s=1920x1080:r=24:d=5', '-filter_complex', '[0:v][1:v]blend=all_mode=average[v]', '-map', '[v]', '-c:v', 'libx264',
             '-crf', '23', os.path.join(d, '兩儀橫', f + '.mp4')])
    for k, f in enumerate(AD_FILES):
        run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={cols[k]}:s=1080x1920:r=24:d=5,format=yuv420p', '-f', 'lavfi',
             '-i', 'testsrc2=s=1080x1920:r=24:d=5', '-filter_complex', '[0:v][1:v]blend=all_mode=average[v]', '-map', '[v]', '-c:v', 'libx264',
             '-crf', '23', os.path.join(d, '兩儀916', f + '.mp4')])
    print('假素材已產生於', d)


def main():
    global MODE, W, H, VID, WORK, FINAL, CHECK, XF
    a = sys.argv[1:]
    if not a or a[0] not in ('mv', 'ad', 'fake'):
        print(__doc__)
        return
    if a[0] == 'fake':
        make_fake(a[1] if len(a) > 1 else os.path.join(tempfile.gettempdir(), 'liangyi_fake'))
        return
    MODE = a[0]
    opts = {}
    rest = []
    i = 1
    while i < len(a):
        if a[i].startswith('--'):
            opts[a[i][2:]] = a[i + 1]
            i += 2
        else:
            rest.append(a[i])
            i += 1
    act = rest[0] if rest else 'build'
    W, H = (1920, 1080) if MODE == 'mv' else (1080, 1920)
    XF = 0.3 if MODE == 'mv' else 0.2
    VID = opts.get('assets', AIDIR[MODE])
    FINAL = opts.get('out', FINALS[MODE])
    CHECK = opts.get('check-dir', CHECK_DIR)
    WORK = opts.get('work', os.path.join(tempfile.gettempdir(), 'liangyi_build_work', MODE))
    os.makedirs(WORK, exist_ok=True)
    if act in ('build', 'all'):
        build()
    if act in ('check', 'all'):
        check()


if __name__ == '__main__':
    main()
