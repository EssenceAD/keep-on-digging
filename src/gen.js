// 구획 생성 (명세2 §3 힌트 → §5-1 칸). 같은 시드면 같은 격자.
// 칸 문자: d 흙 · r 바위 · h 단단한 바위 · a 고대석 · C 구리 · s 은 · g 금 · j 보석 · c 발광
//          w 지하수 주머니 · x 가스 주머니 · R 유물 상자 · o 동굴(빈 공간) · . 뚫린 갱도
import { B } from './balance.js';
import { rng } from './rng.js';

export const COLS = 12;
export const ORE_TYPES = ['C', 's', 'g', 'j', 'c'];
export const HINTS = ['rock', 'water', 'relic', 'glow'];

const NAME_A = ['북쪽', '남쪽', '동쪽', '서쪽', '깊은', '바람 부는', '이끼 낀', '안개 낀', '무너진', '조용한', '붉은'];
const NAME_B = ['비탈', '골짜기', '능선', '샘터', '바위굴', '언덕', '벼랑', '오솔길', '옛 갱도'];

/** 오늘의 경매 카드 3장 */
export function makeCards(seed, allowed = ['S', 'M', 'L']) {
  const r = rng(seed);
  const sizes = (allowed.length >= 3 ? allowed.slice(0, 3) : [...allowed, r.pick(allowed)]).sort(() => r() - 0.5);
  return sizes.map((size, k) => {
    const hints = [];
    while (hints.length < B.hintsPerCard) { const h = r.pick(HINTS); if (!hints.includes(h)) hints.push(h); }
    return {
      name: `뒷산 ${r.pick(NAME_A)} ${r.pick(NAME_B)}`,
      size, hints, price: B.plotSizes[size].price, seed: (seed * 31 + k * 977 + 7) >>> 0,
    };
  });
}
export function freeCard(seed) {
  return { name: '뒷산 버려진 자투리', size: B.freePlot.size, hints: [], price: 0, seed, free: true };
}

/** 카드 → 격자 (문자열 배열, 위에서 아래로) */
export function generate(card) {
  const r = rng(card.seed);
  const rows = B.plotSizes[card.size].rows;
  const has = (h) => card.hints.includes(h);
  const g = Array.from({ length: rows }, () => Array(COLS).fill('d'));
  const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < rows;
  const depth = (y) => y / Math.max(1, rows - 1);

  // 1) 바탕: 돌 덩어리를 옆으로 길게 키워 층처럼. 깊을수록 바위 → 단단한 바위, 맨 아래 띠엔 고대석
  const blob = (type, n, size, minDepth) => {
    for (let k = 0; k < n; k++) {
      let x = r.int(0, COLS - 1), y = r.int(Math.max(1, Math.floor(minDepth * rows)), rows - 1);
      const len = r.int(size[0], size[1]);
      for (let i = 0; i < len; i++) {
        if (inside(x, y)) g[y][x] = type;
        const [dx, dy] = r.pick([[1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]);   // 옆으로 잘 번짐
        x = Math.max(0, Math.min(COLS - 1, x + dx)); y = Math.max(1, Math.min(rows - 1, y + dy));
      }
    }
  };
  const rockP = has('rock') ? B.rockHint : B.rockShare;
  blob('r', Math.round(rows * COLS * rockP / 7), [5, 9], 0.1);
  blob('h', Math.round(rows * COLS * B.hardShare / 6), [3, 8], 0.35);
  blob('a', Math.round(rows * COLS * B.ancientShare * (1 - B.ancientDepth) / 3), [3, 7], B.ancientDepth);
  for (let x = 0; x < COLS; x++) { g[0][x] = 'd'; if (g[1][x] === 'h' || g[1][x] === 'a') g[1][x] = 'r'; }   // 처음 두 줄은 늘 파진다

  // 2) 광맥: 깊을수록 귀한 광종. 셀룰러 성장
  const scale = card.free ? B.freePlot.veinScale : 1;
  const veins = Math.max(1, Math.round(rows * B.veinsPerRow * scale));
  const bigIdx = !card.free && r.chance(B.bigVeinChance) ? r.int(0, veins - 1) : -1;
  for (let v = 0; v < veins; v++) {
    const y0 = r.int(2, rows - 1), x0 = r.int(0, COLS - 1), d = depth(y0);
    const w = { ...B.oreMix };
    for (const k of ['g', 'j', 'c']) w[k] *= 1 + (B.depthWeight - 1) * d;
    if (has('glow')) w.c *= B.glowHintMul;
    const type = r.weighted(w);
    const [lo, hi] = B.veinSize;
    const size = v === bigIdx ? r.int(B.bigVein, hi) : Math.min(hi, lo + Math.floor(r() ** 1.5 * (hi - lo) * 0.7));
    const cells = [[x0, y0]], seen = new Set([`${x0},${y0}`]);
    while (cells.length < size) {
      const [cx, cy] = r.pick(cells), [dx, dy] = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = cx + dx, ny = cy + dy;
      if (!inside(nx, ny) || ny < 2 || seen.has(`${nx},${ny}`)) { if (r() < 0.02) break; continue; }
      seen.add(`${nx},${ny}`); cells.push([nx, ny]);
    }
    for (const [x, y] of cells) g[y][x] = type;
  }

  // 3) 동굴 · 유물 · 지하수 · 가스
  const free = (pred) => {
    for (let k = 0; k < 200; k++) { const x = r.int(0, COLS - 1), y = r.int(2, rows - 1); if (pred(g[y][x], x, y)) return [x, y]; }
    return null;
  };
  const caves = r.range(B.caves);
  for (let k = 0; k < caves; k++) {
    const p = free((t) => t === 'd' || t === 'r'); if (!p) continue;
    const n = r.range(B.caveSize); let [x, y] = p;
    for (let i = 0; i < n; i++) { if (inside(x, y) && y >= 2 && !ORE_TYPES.includes(g[y][x])) g[y][x] = 'o'; const [dx, dy] = r.pick([[1, 0], [-1, 0], [0, 1]]); x += dx; y += dy; }
  }
  const relics = has('relic') ? 1 : r.range(B.relics);
  for (let k = 0; k < relics; k++) { const p = free((t, x, y) => (t === 'd' || t === 'r') && depth(y) > 0.3); if (p) g[p[1]][p[0]] = 'R'; }
  const waters = has('water') ? r.range(B.waterHint) : r.range(B.waterNoHint);
  for (let k = 0; k < waters; k++) { const p = free((t, x, y) => (t === 'r' || t === 'd') && depth(y) > 0.25); if (p) g[p[1]][p[0]] = 'w'; }
  const gases = r.range(B.gas);
  for (let k = 0; k < gases; k++) { const p = free((t, x, y) => (t === 'r' || t === 'd') && depth(y) > 0.2); if (p) g[p[1]][p[0]] = 'x'; }

  return g.map((row) => row.join(''));
}

/** 광맥 덩어리: 같은 광종이 이어진 칸들 (칸 → 덩어리 번호, 덩어리 → 칸 목록) */
export function findVeins(grid) {
  const rows = grid.length, id = grid.map((row) => Array(COLS).fill(-1)), list = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < COLS; x++) {
    const t = grid[y][x];
    if (!ORE_TYPES.includes(t) || id[y][x] >= 0) continue;
    const cells = [], stack = [[x, y]]; id[y][x] = list.length;
    while (stack.length) {
      const [cx, cy] = stack.pop(); cells.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < rows && id[ny][nx] < 0 && grid[ny][nx] === t) { id[ny][nx] = list.length; stack.push([nx, ny]); }
      }
    }
    list.push({ type: t, cells, size: cells.length });
  }
  return { id, list };
}
