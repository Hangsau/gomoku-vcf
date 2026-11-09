"""象牙塔出題候選載入（2026-11-09）。

象牙塔每天的 100 題由伺服器（Worker）自己排：當天第一次有人打開時，從 D1 的 tower_pool 抽題。
這支腳本只負責把題庫（game/p/1..10.json）的題目放進 tower_pool，跑一次就夠；
之後題庫長大了（訓練入庫）想讓新題也能被抽到，再跑一次即可（已在 pool 的題不重複寫）。

每段最多放 MAX_PER_DAN 題（D1 免費方案每天寫入上限 10 萬列，題庫全部 13 萬多題放不進去）；
段內隨機抽樣（黑白照題庫比例），題目分高低都有。

用法（在 VCF 專案根目錄）：
  python tools/tower_pool.py            # 載入
  python tools/tower_pool.py --dry-run  # 只印統計
  python tools/tower_pool.py --reload   # 換評分版本後：清空 pool 重新載入（分數、段位跟著新題庫；tower_used 保留，90 天不重複照舊）
需要 npx wrangler 已登入（跟 tools/deploy_worker.sh 同一個帳號）。
"""
import argparse
import json
import os
import random
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = "vcf-game"
WRANGLER = ["npx", "--yes", "wrangler@4.158.0"]
MAX_PER_DAN = 2500   # 初段每天 17 題 × 90 天 ＝ 1,530 題，2,500 題夠 90 天不重複
CHUNK = 2000         # 每個 SQL 檔幾列


def wrangler(args):
    # 從乾淨暫存資料夾跑 wrangler（不在 repo 根目錄跑，免得新版留下 wrangler.jsonc，見 deploy_worker.sh）
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run(WRANGLER + args, cwd=tmp, capture_output=True, text=True, encoding="utf-8", shell=(os.name == "nt"))
        if r.returncode != 0:
            sys.exit(f"wrangler 失敗：{' '.join(args[:4])}\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}")
        return r.stdout


def main():
    sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台預設 cp950
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--reload", action="store_true")
    a = ap.parse_args()

    if a.reload and not a.dry_run:   # 2026-11-09b 評分換版（使用率不進分數）：舊 pool 的分數／段位是舊版的
        wrangler(["d1", "execute", DB, "--remote", "--yes", "--command", "DELETE FROM tower_pool"])
        print("已清空 tower_pool")
    out = wrangler(["d1", "execute", DB, "--remote", "--json", "--command", "SELECT id FROM tower_pool"])
    have = {r["id"] for r in json.loads(out[out.index("["):])[0]["results"]}
    rng = random.Random(20261109)
    rows = []
    for dan in range(1, 11):
        with open(os.path.join(ROOT, "game", "p", f"{dan}.json"), encoding="utf-8") as f:
            bank = [x for x in json.load(f) if x[5]]
        in_pool = sum(1 for x in bank if x[5] in have)
        rest = [x for x in bank if x[5] not in have]
        room = max(0, MAX_PER_DAN - in_pool)
        add = rng.sample(rest, room) if len(rest) > room else rest   # 黑白不刻意配比（使用者 2026-11-09），照題庫比例
        rows += [(x[5], dan, x[3], 1 if x[4] == "w" else 0, json.dumps(x, ensure_ascii=False, separators=(",", ":"))) for x in add]
        print(f"段 {dan}：題庫 {len(bank)}、已在 pool {in_pool}、新加 {len(add)}（白方 {sum(1 for x in add if x[4] == 'w')}）")
    print(f"共新加 {len(rows)} 題")
    if a.dry_run or not rows:
        return
    for i in range(0, len(rows), CHUNK):
        with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as f:
            for pid, dan, score, white, p in rows[i:i + CHUNK]:
                f.write("INSERT OR IGNORE INTO tower_pool(id, dan, score, white, p) VALUES ('%s', %d, %s, %d, '%s');\n"
                        % (pid.replace("'", "''"), dan, score, white, p.replace("'", "''")))
            path = f.name
        try:
            wrangler(["d1", "execute", DB, "--remote", "--yes", "--file", path])
        finally:
            os.unlink(path)
        print(f"  已寫 {min(i + CHUNK, len(rows))}/{len(rows)}")
    print("完成")


if __name__ == "__main__":
    main()
