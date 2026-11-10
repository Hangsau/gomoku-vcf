// 載入 WebAssembly 版 solver（engine/bot_api.cpp 編出來的），包成 bot.js 要的介面。
import createModule from './solver/vcfSolver.mjs';
import { BLACK, WHITE } from './rules.js';

export async function loadSolver() {
  const module = await createModule();
  const firstMoveRaw = module.cwrap('vcf_first_move', 'number', ['string', 'number', 'number', 'number', 'number']);
  return {
    firstMove(cells, attacker, isForbidOn, cap, nodes) {
      const color = attacker === BLACK ? BLACK : WHITE;
      return firstMoveRaw(Array.prototype.join.call(cells, ''), color, isForbidOn ? 1 : 0, cap, nodes);
    },
  };
}
