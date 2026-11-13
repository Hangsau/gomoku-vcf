# 兩儀殿 VCF 觀戰自動追焦（2026-11-13）

規則是使用者定的，見 `WORKORDER.md`「背景」：一線天跟先落子的、出局換另一位；八仙渡跟領先的、同分不換、超車才換；手動切了就停止自動、有「自動」鈕可按回；要一眼看得出在看誰（使用者補充：「現在的手動追焦 不好知道現在在看誰的」）。

## 狀態

- 2026-11-13 10:5x 派 cc2 施工，11 輪後回「You've hit your 5-hour limit · resets 1:20pm (Asia/Taipei)」，**零改動**。
- 已排 shotclock 單次工作 `shotclock-20261113-1330-b5b0`（13:30，主帳號 sonnet，cwd＝VCF，prompt＝`shotclock_prompt.md`）照同一張施工單重做。只施工，不 commit、不部署。
- **接手的人要做**：看 `PROGRESS.md`／`REPORT.md` 有沒有產出 → 讀 `duel.html` 的改動、重跑 `check/check_follow.mjs`、看截圖 → 通過才 commit（列檔名）＋ `bash C:/claudehome/projects/VCF/tools/deploy_rush.sh`；REPORT 若寫「伺服器有改」，還要先部署對戰伺服器（`npx wrangler@4.158.0 deploy -c C:/claudehome/projects/VCF/game/duel-server/wrangler.toml`，先看大廳沒人）。沒產出就重派。
