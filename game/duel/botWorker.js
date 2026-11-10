// 電腦在背景想棋，不卡畫面。收 { id, saved, seat, level, seed }，回 { id, action } 或 { id, error }。
// 從棋神之雞 src/gomoku/botWorker.js 搬來（2026-11-11），只改 import 路徑。
import { createRng } from './rng.js';
import { chooseAction } from './bot.js';
import { restoreMatch } from './match.js';
import { loadSolver } from './solver.js';

const solverReady = loadSolver().catch(() => null);   // solver 載不起來就只會最低級，不讓整個電腦掛掉

self.onmessage = async ({ data }) => {
  const { id, saved, seat, level, seed } = data;
  try {
    const solver = await solverReady;
    const match = restoreMatch(saved);
    if (!match) throw new Error('棋局讀不回來');
    self.postMessage({ id, action: chooseAction(match, seat, { level, solver, rng: createRng(seed) }) });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
