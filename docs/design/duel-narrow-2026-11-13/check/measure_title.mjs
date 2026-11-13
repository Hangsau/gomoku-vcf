import { chromium } from 'file:///C:/claudehome/tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 320, height: 568 } });
await p.goto('http://127.0.0.1:8841/duel.html'); await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  await document.fonts.ready;
  const out = {};
  const names = { zh: ['房間 8888', '一線天 8888', '八仙渡 8888'], en: ['Room 8888', 'Sky Gap 8888', 'Eight Immortals 8888'], ja: ['部屋 8888', '一線天 8888', '八仙渡 8888'], ko: ['방 8888', '일선천 8888', '팔선도 8888'] };
  for (const [l, arr] of Object.entries(names)) for (const sz of [18, 16, 15, 14]) {
    document.documentElement.lang = l === 'zh' ? 'zh-Hant' : l;
    for (const t of arr) { const s = document.createElement('b'); s.style.cssText = `font-family:var(--num);font-size:${sz}px;white-space:nowrap;position:absolute;visibility:hidden`; s.textContent = t; document.body.appendChild(s); out[l + '|' + sz + '|' + t] = Math.ceil(s.getBoundingClientRect().width); s.remove(); }
  }
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k, v);
await b.close();
