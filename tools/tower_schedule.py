"""象牙塔每日題目排程（2026-11-09 使用者定）。

每天 100 題、所有人同一組、由易到難；越高段越少題：
  初段 17・二段 15・三段 13・四段 12・五段 10・六段 9・七段 8・八段 7・九段 5・傳說 4
每段內照題目分分層抽（低→高各一層），所以段內也是由易到難；有白方題的段每 10 題放 1 題白方題。
同一題 90 天內不重複（前後都算）；不夠就挑最久沒出過的。被回報停用（/blocked）的題不選。
排好的清單寫進 D1 的 tower_days（不放公開檔案，免得被先看到）；已經排過的日子不動。

用法（在 VCF 專案根目錄）：
  python tools/tower_schedule.py              # 從今天起補滿 120 天
  python tools/tower_schedule.py --days 30    # 補滿 30 天
  python tools/tower_schedule.py --dry-run    # 只印統計，不寫 D1
需要 npx wrangler 已登入（跟 tools/deploy_worker.sh 同一個帳號）。
"""
import argparse
import datetime as dt
import json
import os
import random
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://vcf-game-api.psyhangsau.workers.dev"
DB = "vcf-game"
WRANGLER = ["npx", "--yes", "wrangler@4.158.0"]
# 題庫檔 game/p/1..10.json ＝ 初段..傳說；每段題數（合計 100）
PLAN = {1: 17, 2: 15, 3: 13, 4: 12, 5: 10, 6: 9, 7: 8, 8: 7, 9: 5, 10: 4}
NO_REPEAT_DAYS = 90
assert sum(PLAN.values()) == 100


def wrangler(args):
    # 從乾淨暫存資料夾跑 wrangler（不在 repo 根目錄跑，免得新版留下 wrangler.jsonc，見 deploy_worker.sh）
    with tempfile.TemporaryDirectory() as tmp:
        cmd = WRANGLER + args
        r = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True, encoding="utf-8", shell=(os.name == "nt"))
        if r.returncode != 0:
            sys.exit(f"wrangler 失敗：{' '.join(args)}\n{r.stdout}\n{r.stderr}")
        return r.stdout


def d1_query(sql):
    out = wrangler(["d1", "execute", DB, "--remote", "--json", "--command", sql])
    data = json.loads(out[out.index("["):])
    return data[0]["results"]


def load_bank():
    bank = {}
    for k in PLAN:
        with open(os.path.join(ROOT, "game", "p", f"{k}.json"), encoding="utf-8") as f:
            bank[k] = json.load(f)
    return bank


def blocked_ids():
    req = urllib.request.Request(API + "/blocked", headers={"User-Agent": "Mozilla/5.0 tower-schedule"})   # 預設 Python UA 會被 Cloudflare 擋 403
    with urllib.request.urlopen(req, timeout=20) as r:
        return set(json.load(r).get("ids", []))


def pick_day(day, bank, last_used, blocked):
    """排一天：回傳 100 題（由易到難）。last_used：題號 → 用過的日子清單（含已排的未來日子）。"""
    rng = random.Random("tower-" + day.isoformat())
    out = []
    for k, cnt in PLAN.items():
        pool = [x for x in bank[k] if x[5] and x[5] not in blocked]

        def gap(x):   # 離最近一次使用幾天（前後都算）；沒用過＝無限大
            ds = last_used.get(x[5])
            return min(abs((day - u).days) for u in ds) if ds else 10 ** 6

        fresh = [x for x in pool if gap(x) >= NO_REPEAT_DAYS]
        if len(fresh) < cnt * 3:   # 新題太少：補上最久沒出過的
            rest = sorted((x for x in pool if gap(x) < NO_REPEAT_DAYS), key=gap, reverse=True)
            fresh += rest[: cnt * 3 - len(fresh)]
        fresh.sort(key=lambda x: x[3])
        whites = [x for x in fresh if x[4] == "w"]
        n_white = min(len(whites), round(cnt / 10))
        chosen = []
        # 題目分分層：把候選依分數切成 cnt 層，每層抽一題；指定幾層改抽白方題
        layers = [fresh[i * len(fresh) // cnt:(i + 1) * len(fresh) // cnt] for i in range(cnt)]
        white_layers = set(rng.sample(range(cnt), n_white)) if n_white else set()
        for i, layer in enumerate(layers):
            cands = [x for x in layer if x not in chosen]
            if i in white_layers:
                w = [x for x in cands if x[4] == "w"] or [x for x in whites if x not in chosen]
                if w:
                    cands = w
            if not cands:
                cands = [x for x in fresh if x not in chosen]
            chosen.append(rng.choice(cands))
        out += sorted(chosen, key=lambda x: x[3])
    ids = [x[5] for x in out]
    assert len(out) == 100 and len(set(ids)) == 100, "同一天有重複題"
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950，中文會亂碼
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    today = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=8)).date()   # 台北日期，跟 Worker 一致
    bank = load_bank()
    blocked = blocked_ids()
    rows = d1_query("SELECT day, puzzles FROM tower_days")
    have = {}
    last_used = {}
    for r in rows:
        d = dt.date.fromisoformat(r["day"])
        have[d] = True
        for x in json.loads(r["puzzles"]):
            last_used.setdefault(x[5], []).append(d)

    new = []
    for i in range(a.days):
        d = today + dt.timedelta(days=i)
        if d in have:
            continue
        ps = pick_day(d, bank, last_used, blocked)
        for x in ps:
            last_used.setdefault(x[5], []).append(d)
        new.append((d, ps))

    print(f"已排 {len(have)} 天；新排 {len(new)} 天（{new[0][0] if new else '-'} ～ {new[-1][0] if new else '-'}）")
    if new:
        d, ps = new[0]
        tot = sum(x[3] for x in ps) / 10
        print(f"範例 {d}：滿分 {tot:.0f}、白方題 {sum(1 for x in ps if x[4] == 'w')} 題、題目分 {ps[0][3]:.0f} → {ps[-1][3]:.0f}")
    # 90 天內重複的題數（高段題少，可能不得不重複）
    rep = sum(1 for ds in last_used.values() for x, y in zip(sorted(ds), sorted(ds)[1:]) if (y - x).days < NO_REPEAT_DAYS)
    print(f"90 天內重複出現：{rep} 次")
    if a.dry_run or not new:
        return
    now = int(dt.datetime.now().timestamp() * 1000)
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as f:
        for d, ps in new:
            js = json.dumps(ps, ensure_ascii=False, separators=(",", ":")).replace("'", "''")
            f.write(f"INSERT OR IGNORE INTO tower_days(day, puzzles, t) VALUES ('{d.isoformat()}', '{js}', {now});\n")
        path = f.name
    try:
        wrangler(["d1", "execute", DB, "--remote", "--yes", "--file", path])
    finally:
        os.unlink(path)
    print("已寫入 D1 tower_days")


if __name__ == "__main__":
    main()
