// 教學動畫圖集：依序請 codex 畫（ChatGPT 訂閱額度，不吃 Claude）。一次一張、畫完立刻寫檔，已畫過的跳過。
// 用法：node C:/claudehome/projects/VCF/tools/codex_art_queue.mjs [只畫這些編號，例如 01 02]
// 提示檔：docs/design/tutorial-2026-11-10/art-prompts/NN_*.txt（第一行 OUTPUT_NAME: 檔名），共用規則在 00_style.txt
// 輸出：game/learn/art/<檔名>.png；舊圖要重畫就先把它改名或刪掉
import { readFile, readdir, copyFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'C:/claudehome/projects/VCF';
const PROMPTS = `${ROOT}/docs/design/tutorial-2026-11-10/art-prompts`;
const OUT = `${ROOT}/game/learn/art`;
const HELPER = 'C:/claudehome/projects/swim-coach/tools/companion/codex-image.mjs';   // swim-coach 的 codex 生圖工具，沿用不改
const { generatePhoto } = await import(pathToFileURL(HELPER).href);

const only = process.argv.slice(2);
const style = await readFile(`${PROMPTS}/00_style.txt`, 'utf8');
const files = (await readdir(PROMPTS)).filter(f => /^\d\d_.+\.txt$/.test(f) && !f.startsWith('00_')).sort();
await mkdir(OUT, { recursive: true });
for (const f of files) {
  if (only.length && !only.includes(f.slice(0, 2))) continue;
  const body = await readFile(`${PROMPTS}/${f}`, 'utf8');
  const name = (body.match(/^OUTPUT_NAME:\s*(\S+)/m) || [])[1];
  if (!name) { console.log('跳過（沒有 OUTPUT_NAME）', f); continue; }
  const dest = `${OUT}/${name}.png`;
  try { await access(dest); console.log('已有，跳過', name); continue; } catch {}
  const work = path.join(OUT, '.codex-work', name);
  await mkdir(work, { recursive: true });
  console.log('開始', name, new Date().toISOString());
  try {
    const { output } = await generatePhoto({ directory: work, prompt: style + '\n' + body.replace(/^OUTPUT_NAME:.*$/m, '').trim(), purpose: 'art', checkQuota: true, onEvent: () => {} });
    await copyFile(output, dest);
    console.log('完成', name, new Date().toISOString());
  } catch (e) {
    if (e.message === 'quota_wait') { console.log('codex 額度用完，可重試時間', new Date(e.retryAt).toISOString()); process.exit(3); }
    console.log('失敗', name, e.message);
  }
}
console.log('全部跑完');
