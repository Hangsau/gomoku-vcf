// 測試頁：本機靜態伺服器＋Chromium（授予通知權限），API 指向本機 wrangler dev（8798）。截圖存 shots/。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../');
const { chromium } = await import(pathToFileURL('C:/claudehome/tools/node_modules/playwright/index.mjs').href);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port;
let pass = 0, fail = 0; const ok = (c, n, e = '') => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : e); };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [w, h] of [[375, 667], [360, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, permissions: ['notifications'] });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + '/game/push-test.html?api=' + encodeURIComponent('http://127.0.0.1:8798'));
  await page.waitForTimeout(800);
  const envText = await page.innerText('#env');
  ok(/瀏覽器分頁/.test(envText) && /支援通知/.test(envText), `${w}×${h} 環境區顯示分頁／支援通知`, envText);
  ok(await page.evaluate(() => !!document.querySelector('link[rel=manifest]')), `${w}×${h} 有注入 manifest 連結`);
  const mf = await page.evaluate(() => JSON.parse(decodeURIComponent(document.querySelector('link[rel=manifest]').href.split(',').slice(1).join(','))));
  ok(mf.start_url.endsWith('/game/push-test.html') && mf.display === 'standalone' && mf.scope === base + '/', 'manifest 內容：start_url／scope／display', JSON.stringify(mf));
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}×${h} 沒有橫向捲動`);
  await page.screenshot({ path: path.join(HERE, `shots/page_${w}x${h}.png`), fullPage: true });
  await page.click('#bAllow'); await page.waitForTimeout(3000);
  const log = await page.innerText('#log'); console.log('--- 記錄區（' + w + '×' + h + '）---\n' + log);
  ok(/權限結果：granted/.test(log), '按「允許通知」→ 權限 granted');
  ok(/service worker 已註冊/.test(log), 'service worker 註冊成功（用同一個 ../sw.js）');
  await page.screenshot({ path: path.join(HERE, `shots/page_${w}x${h}_after_allow.png`), fullPage: true });
  // 從通知進來的樣子
  await page.goto(base + '/game/push-test.html?from=push'); await page.waitForTimeout(500);
  ok(/你是從通知進來的/.test(await page.innerText('#from')), `${w}×${h} from=push 顯示「你是從通知進來的」`);
  await page.screenshot({ path: path.join(HERE, `shots/page_${w}x${h}_from_push.png`), fullPage: true });
  await page.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__copied = t; }; });
  await page.click('#bCopy'); await page.waitForTimeout(200);
  ok(/通知測試結果/.test(await page.evaluate(() => window.__copied || '')), '複製按鈕：內容含環境與記錄');
  ok(errs.length === 0, '沒有未捕捉的頁面錯誤', errs.join('|'));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`PASS ${pass}／FAIL ${fail}`); process.exit(fail ? 1 : 0);
