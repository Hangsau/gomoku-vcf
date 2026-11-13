// 部署對戰伺服器前查「有沒有人正在對局」（只讀）：連線 → 讀大廳清單 → 斷線。不送 create／sit／view／join 等任何會改變狀態的訊息。
// 用法：node tools/duel_busy.mjs [--url ws://127.0.0.1:8789/ws] [--wait 600]
//   exit 0＝沒人在對局（或 --wait 等到了）、1＝有人在對局（或 --wait 超時）、2＝連不上
const PROD = 'wss://rush-duel.psyhangsau.workers.dev/ws';   // 跟 duel.html 的 WS_PROD 同一個
const POLL_MS = 20000, CONNECT_TIMEOUT_MS = 10000;
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const url = opt('--url') || PROD;
const waitSec = opt('--wait') !== undefined ? Number(opt('--wait')) : null;
if (opt('--wait') !== undefined && !(waitSec >= 0)) { console.error('--wait 要給秒數'); process.exit(2); }
const STATE = { wait: '等人', play: '對局中', study: '研棋', over: '結束' };
const BUSY = new Set(['play', 'study']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 一次查詢：回傳 { online, rooms } 或丟錯（連不上）
function query() {
  return new Promise((resolve, reject) => {
    const id = 'busy' + Math.random().toString(36).slice(2, 14) + 'x';
    let ws, done = false;
    const fin = (fn, v) => { if (done) return; done = true; clearTimeout(t); try { ws.close(); } catch {} setTimeout(() => fn(v), 150); };   // 等連線真的關掉再往下（Windows 上 close 到一半就 process.exit 會觸發 libuv assert）
    const t = setTimeout(() => fin(reject, new Error('逾時')), CONNECT_TIMEOUT_MS);
    try { ws = new WebSocket(`${url}${url.includes('?') ? '&' : '?'}v=2&id=${id}&nick=duel_busy`); } catch (e) { return fin(reject, e); }
    ws.onerror = () => fin(reject, new Error('連不上 ' + url));
    ws.onclose = () => fin(reject, new Error('連線被關閉'));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'lobby') fin(resolve, { online: m.online, rooms: m.rooms || [] });
    };
  });
}
function report({ online, rooms }) {
  const busy = rooms.filter((r) => BUSY.has(r.state));
  console.log(`線上人數：${online}（含這次查詢自己 1 位）；房間 ${rooms.length} 間`);
  for (const r of rooms) {
    const n = (r.seats || []).filter(Boolean).length;
    console.log(`  房 ${r.id}　${r.kind === 'vcf' ? 'VCF' : '五子棋'}　${STATE[r.state] || r.state}　座位 ${n}/2　觀戰 ${r.watchers || 0}${r.priv ? '　私人' : ''}`);
  }
  console.log(busy.length ? `有 ${busy.length} 間正在對局／研棋 → 先不要部署` : '沒有人在對局 → 可以部署');
  return busy.length;
}
async function once() {
  try { return report(await query()) ? 1 : 0; }
  catch (e) { console.error('查詢失敗：' + e.message); return 2; }
}
// 連線關掉後多等一下才 exit（undici 的 WebSocket 有時讓事件迴圈不自己結束；關到一半硬 exit 又會在 Windows 觸發 libuv assert）
const finish = (code) => { process.exitCode = code; setTimeout(() => process.exit(code), 300); };
if (waitSec === null) finish(await once());
else {
  const t0 = Date.now();
  for (;;) {
    const code = await once();
    if (code === 0 || code === 2) { finish(code); break; }
    if (Date.now() - t0 + POLL_MS > waitSec * 1000) { console.log(`等了 ${Math.round((Date.now() - t0) / 1000)} 秒，仍有人在對局`); finish(1); break; }
    console.log(`${POLL_MS / 1000} 秒後再查…`);
    await sleep(POLL_MS);
  }
}
