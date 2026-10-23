// art/raw/mine_*.png (GPT 그림, 마젠타 배경) → 인물별 48×48 초상 → public/assets/portraits/
// 비주얼 가이드 §5-1-2: 최근접 축소 → pxl 팔레트(shaft.px.js + office.px.js의 pal 합집합)로 양자화
//                        → 외곽선을 장면 잉크색 #1a1220 1px로 재추적 → 마젠타 제거. 디더링 없음.
// 실행: npm run portraits
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SIZE = 48;
const INK = [0x1a, 0x12, 0x20];
const SHEETS = {
  'mine_halabeoji.png': ['halabeoji'],
  'mine_miners3.png': ['miner_red', 'miner_brown', 'miner_blonde'],
  'mine_mole_momo.png': ['mole', 'momo'],
  'mine_brok_merchant.png': ['brok', 'merchant'],
};

// ---- 팔레트: 두 .px.js 파일의 pal({...}) 안 #rrggbb 전부 (중복 제거)
const palette = [];
for (const file of ['art/shaft.px.js', 'art/office/office.px.js']) {
  const src = readFileSync(file, 'utf8');
  for (const block of src.match(/pal\(\{[\s\S]*?\}\)/g) ?? [])
    for (const hex of block.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      if (!palette.some((p) => p.rgb.every((v, k) => v === rgb[k]))) palette.push({ rgb, lab: lab(rgb) });
    }
}
function lab([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const nearest = (rgb) => {
  const l = lab(rgb);
  let best = palette[0], bd = Infinity;
  for (const p of palette) { const d = (p.lab[0] - l[0]) ** 2 + (p.lab[1] - l[1]) ** 2 + (p.lab[2] - l[2]) ** 2; if (d < bd) { bd = d; best = p; } }
  return best.rgb;
};
// 마젠타(그리고 마젠타가 섞인 가장자리)인가
// (보라 모자 같은 진짜 보라는 남긴다: 빨강·파랑이 거의 같고 초록이 훨씬 낮아야 마젠타)
const isKey = (r, g, b) => r > 170 && b > 170 && Math.abs(r - b) < 70 && g < Math.min(r, b) - 110;

mkdirSync('public/assets/portraits', { recursive: true });
for (const [file, names] of Object.entries(SHEETS)) {
  const src = PNG.sync.read(readFileSync(`art/raw/${file}`));
  const at = (x, y) => { const i = (y * src.width + x) * 4; return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]; };
  const segW = Math.floor(src.width / names.length);
  names.forEach((name, n) => {
    // 칸 안에서 그림이 있는 범위 → 정사각형(가로 가운데, 아래 = 흉상이 잘린 쪽 기준)
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < src.height; y += 2) for (let x = n * segW; x < (n + 1) * segW; x += 2) {
      const [r, g, b, a] = at(x, y);
      if (a > 0 && !isKey(r, g, b)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    const side = Math.max(x1 - x0, y1 - y0) + 2;
    const sx = Math.round((x0 + x1) / 2 - side / 2), sy = y1 + 1 - side;

    // 1) 최근접 축소 + 2) 마젠타 → 투명 + 3) 팔레트 양자화
    const px = Array.from({ length: SIZE * SIZE }, () => null);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const qx = Math.floor(sx + (x + 0.5) * side / SIZE), qy = Math.floor(sy + (y + 0.5) * side / SIZE);
      if (qx < 0 || qy < 0 || qx >= src.width || qy >= src.height) continue;
      const [r, g, b, a] = at(qx, qy);
      if (a < 128 || isKey(r, g, b)) continue;
      px[y * SIZE + x] = nearest([r, g, b]);
    }
    const opaque = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && px[y * SIZE + x] !== null;
    // 외톨이 점 지우기 (축소하면서 생긴 부스러기)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
      if (opaque(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => opaque(x + dx, y + dy)).length <= 1) px[y * SIZE + x] = null;
    // 4) 외곽선 재추적: 투명과 맞닿은 가장자리 1px = 잉크 (아래 가장자리 = 흉상 잘린 면은 제외)
    const edge = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
      if (opaque(x, y) && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => y + dy < SIZE && !opaque(x + dx, y + dy))) edge.push(y * SIZE + x);
    for (const i of edge) px[i] = INK;

    const out = new PNG({ width: SIZE, height: SIZE });
    px.forEach((c, i) => { if (c) { out.data.set(c, i * 4); out.data[i * 4 + 3] = 255; } });
    writeFileSync(`public/assets/portraits/${name}.png`, PNG.sync.write(out));
    const used = new Set(px.filter(Boolean).map((c) => c.join(','))).size;
    console.log(`${name}: ${SIZE}×${SIZE}, ${used}색 (팔레트 ${palette.length}색 중)`);
  });
}
