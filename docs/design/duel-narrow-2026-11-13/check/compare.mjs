// 比對舊版（base.json）與新版（after.json）：不捲動／不重疊／按鈕在畫面內，以及 375×667 以上棋盤外框是否與改動前相同
import { readFileSync } from 'node:fs';
const A = JSON.parse(readFileSync(new URL('./base.json', import.meta.url))), B = JSON.parse(readFileSync(new URL('./after.json', import.meta.url)));
let pass = 0, fail = 0;
const keys = Object.keys(B).filter((k) => k.startsWith('duel|') && !k.startsWith('fail') && B[k] && typeof B[k] === 'object' && !Array.isArray(B[k]));
const issues = (m) => (m.overY ? `縱向超出 ${m.overY}px ` : '') + (m.overX ? `橫向超出 ${m.overX}px ` : '') + (m.out && m.out.length ? `出界 [${m.out}] ` : '') + (m.over && m.over.length ? `與棋盤重疊 [${m.over}] ` : '');
console.log('---- A. 新版：不捲動／不重疊／按鈕在畫面內');
let nOk = 0;
for (const k of keys) { const s = issues(B[k]); if (s) { fail++; console.log('  FAIL', k, s); } else { pass++; nOk++; } }
console.log(`  ${nOk}／${keys.length} 項乾淨`);
console.log('---- B. 舊版同一矩陣（對照，不計入結果）');
let oldBad = 0;
for (const k of Object.keys(A).filter((k) => k.startsWith('duel|') && A[k] && typeof A[k] === 'object' && !Array.isArray(A[k]))) { const s = issues(A[k]); if (s) { oldBad++; console.log('  舊版有問題', k, s); } }
console.log(`  舊版 ${oldBad} 項有問題`);
console.log('---- C. 375×667 以上與改動前相同（棋盤外框、格距）');
let same = 0, diff = [];
for (const k of keys.filter((k) => /\|(375x667|390x844)\|/.test(k))) {
  if (!A[k] || A[k].cv === undefined) continue;
  const eq = JSON.stringify(A[k].cv) === JSON.stringify(B[k].cv) && A[k].cell === B[k].cell && A[k].pad === B[k].pad;
  if (eq) same++; else diff.push(k + ' 舊 ' + JSON.stringify(A[k].cv) + ' 新 ' + JSON.stringify(B[k].cv));
}
console.log(`  相同 ${same} 項；不同 ${diff.length} 項`); diff.forEach((d) => console.log('   差異', d));
console.log('---- D. 320／360 寬新舊棋盤外框變化（資訊）');
for (const k of keys.filter((k) => /\|(320x568|360x640)\|/.test(k) && A[k] && A[k].cv && JSON.stringify(A[k].cv) !== JSON.stringify(B[k].cv))) console.log('  ', k, '舊', JSON.stringify(A[k].cv), '新', JSON.stringify(B[k].cv));
console.log('---- E. 失敗／錯誤欄');
for (const k of Object.keys(B)) if (/^(fail|errs)\|/.test(k) && (typeof B[k] === 'string' || (Array.isArray(B[k]) && B[k].length))) { fail++; console.log('  FAIL(新)', k, JSON.stringify(B[k]).slice(0, 200)); }
console.log(`PASS ${pass}／FAIL ${fail}；C 段差異 ${diff.length} 項（需逐項解釋）`);
