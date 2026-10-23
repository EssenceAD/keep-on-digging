// art/raw/mine_*.png (GPT 그림, 마젠타 배경) → 인물별로 잘라 64×64 최근접 축소 + 마젠타 제거 → public/assets/portraits/
// 실행: npm run portraits
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SIZE = 64;
const SHEETS = {
  'mine_halabeoji.png': ['halabeoji'],
  'mine_miners3.png': ['miner_red', 'miner_brown', 'miner_blonde'],
  'mine_mole_momo.png': ['mole', 'momo'],
  'mine_brok_merchant.png': ['brok', 'merchant'],
};
// 마젠타(그리고 마젠타가 섞인 가장자리)인가
const isKey = (r, g, b) => r > 150 && b > 150 && g < 110 && r - g > 90 && b - g > 90;

mkdirSync('public/assets/portraits', { recursive: true });
for (const [file, names] of Object.entries(SHEETS)) {
  const src = PNG.sync.read(readFileSync(`art/raw/${file}`));
  const at = (x, y) => { const i = (y * src.width + x) * 4; return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]; };
  const segW = Math.floor(src.width / names.length);
  names.forEach((name, n) => {
    // 칸 안에서 그림이 있는 범위
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < src.height; y += 2) for (let x = n * segW; x < (n + 1) * segW; x += 2) {
      const [r, g, b, a] = at(x, y);
      if (a > 0 && !isKey(r, g, b)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    // 정사각형: 가로 가운데, 아래(흉상 잘린 쪽) 기준
    const side = Math.max(x1 - x0, y1 - y0) + 2;
    const cx = (x0 + x1) / 2, sx = Math.round(cx - side / 2), sy = y1 + 1 - side;
    const out = new PNG({ width: SIZE, height: SIZE });
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const px = Math.floor(sx + (x + 0.5) * side / SIZE), py = Math.floor(sy + (y + 0.5) * side / SIZE);
      const o = (y * SIZE + x) * 4;
      if (px < 0 || py < 0 || px >= src.width || py >= src.height) continue;
      const [r, g, b, a] = at(px, py);
      if (isKey(r, g, b)) continue;
      out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = a;
    }
    writeFileSync(`public/assets/portraits/${name}.png`, PNG.sync.write(out));
    console.log(name, `crop ${side}px @ ${sx},${sy}`);
  });
}
