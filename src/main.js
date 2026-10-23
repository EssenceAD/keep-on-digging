// 「용사님, 채굴하실게요~」 HD-2D 비주얼 프로토타입
// 갱도 격자 12×16 + 런타임 랜턴 조명(노멀맵) + 광부 + 광차 + 광맥 + 곡괭이 주스 + 패럴랙스 3겹 + 틸트 시프트 + 저사양 토글
import 'galmuri/dist/galmuri.css';
import './style.css';
import {
  Application, Assets, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture,
  TextureSource, TilingSprite,
} from 'pixi.js';
import { MAX_LIGHTS, makeLightPass, makePostPass } from './gl.js';
import { sfx, setSound, soundOn, unlockAudio } from './sound.js';

TextureSource.defaultOptions.scaleMode = 'nearest';

// ---------------------------------------------------------------- 세계
const T = 16, GW = 12, GH = 16;
const GX = 192, GY = 48;                  // 구획(격자) 왼쪽 위
const WW = 576, WH = GY + GH * T + 32;    // 336
const COLS = WW / T, ROWS = WH / T;
const VIEW_H = 224;
const SHAFT_TOP_X = 236;                  // 지상 권양기 도르래 케이블

// . 갱도  T 갱도+버팀목  o 동굴  d 흙  r 바위  h 단단한 바위  a 고대석  w 지하수  g 금  c 발광 광석
const MAP = [
  'ddTddddddddd',
  'dd.ddrddddrd',
  'dr.ddrrddddd',
  'rd.rddddwwdr',
  'rr.....Tdwdr',
  'hrrrdrr.rdrh',
  'hrhrrrd.rrhh',
  'hhrrcrr.rrrh',
  'hrrccc..ggrr',
  'ahrrcrrhggrh',
  'aahrrhoohggg',
  'aahhhooohggg',
  'aaahhhhhgggh',
  'aaaahhhhhghh',
  'waaaahhhhhhh',
  'aaaaaahhhhhh',
];
const grid = MAP.map((r) => r.split(''));
const HP = { d: 2, r: 3, h: 5, w: 1, g: 3, c: 3 };          // a(고대석)·바깥 암반은 1단계 곡괭이로 못 판다
const LIP = {                                                // 드러난 윗면 테두리 (팔레트 그대로)
  d: [0xa07a4c, 0x7d5636], r: [0x9c95b2, 0x736c8c], h: [0x736c8c, 0x524c68], B: [0x736c8c, 0x524c68],
  a: [0x7a948a, 0x536a62], g: [0xf0b03c, 0xc47a22], c: [0x9c95b2, 0x736c8c], w: [0x5a94c8, 0x244a70],
};
const DEBRIS = {
  d: [0x5c3d2a, 0x7d5636, 0x3a2620, 0xa07a4c], r: [0x524c68, 0x736c8c, 0x36304a], h: [0x524c68, 0x9c95b2, 0x36304a],
  g: [0xc47a22, 0xf0b03c, 0x7a4416, 0x524c68], c: [0x2db4a2, 0x7cffe0, 0x524c68], w: [0x5a94c8, 0x244a70, 0x16283e],
  a: [0x536a62, 0x7a948a], B: [0x524c68, 0x736c8c],
};
const empty = (ch) => ch === '.' || ch === 'T' || ch === 'o';

/** 세계 칸(열, 행) → 'sky' | 격자 문자 | 'B'(바깥 암반) */
function cellAt(cx, cy) {
  if (cy < GY / T) return 'sky';
  const gx = cx - GX / T, gy = cy - GY / T;
  if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) return grid[gy][gx];
  return 'B';
}
const isSolid = (ch) => ch !== 'sky' && !empty(ch);

// ---------------------------------------------------------------- 설정 · 저사양
const qs = new URLSearchParams(location.search);
let low = qs.get('low') === '1';
try { if (!qs.has('low') && localStorage.getItem('kod.low') === '1') low = true; } catch {}
const AMBIENT = Number(qs.get('ambient') || 0.3);
const AMB_COLOR = [0.86, 0.8, 1.0];      // 회보라 앰비언트
const TINT = [1.05, 0.98, 0.9];          // 뒷산 층 색온도 (갈색·노을)

// ---------------------------------------------------------------- 시작
const app = new Application();
await app.init({
  preference: 'webgl', background: '#0b0910', antialias: false,
  resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, resizeTo: window,
});
document.getElementById('stage').appendChild(app.canvas);
const R = app.renderer;

const A = (p) => `${import.meta.env.BASE_URL}art/${p}`;
const SPRITES = ['dirt_1', 'dirt_2', 'rock_1', 'rock_2', 'hard_rock', 'ancient', 'water', 'gold_ore', 'glow_rock',
  'timber', 'rails', 'far_wall', 'mid_pillars', 'fg_rocks', 'wall_lamp', 'cart', 'cart_full'];
const NORMALS = ['dirt_1', 'dirt_2', 'rock_1', 'rock_2', 'hard_rock', 'ancient', 'gold_ore', 'glow_rock', 'timber'];
const ANIMS = ['glow_crystals', 'gold_shimmer', 'lantern', 'miner'];
const urls = [
  ...SPRITES.map((n) => A(`sprites/${n}.png`)), ...NORMALS.map((n) => A(`sprites/${n}_n.png`)),
  ...ANIMS.flatMap((n) => [A(`anims/${n}.png`), A(`anims/${n}.json`)]), A('scenes/surface.png'),
];
const loaded = await Assets.load(urls);
const tex = (n) => loaded[A(`sprites/${n}.png`)];
const ntex = (n) => loaded[A(`sprites/${n}_n.png`)];
function frames(n) {
  const base = loaded[A(`anims/${n}.png`)], json = loaded[A(`anims/${n}.json`)];
  const raw = json.data?.frames ?? json.frames;   // Pixi가 JSON을 스프라이트시트로 읽으면 .data에 원본이 있다
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list.map((f) => new Texture({ source: base.source, frame: new Rectangle(f.frame.x, f.frame.y, f.frame.w, f.frame.h) }));
}
const F = Object.fromEntries(ANIMS.map((n) => [n, frames(n)]));
document.getElementById('loading')?.remove();

// ---------------------------------------------------------------- 세 갈래 장면: 알베도 · 노멀 · 조명 뒤(발광)
const wA = new Container();   // 색 (조명 받음)
const wN = new Container();   // 노멀 (알파 0 = 조명 안 받음)
const wU = new Container();   // 조명 뒤에 그리는 것: 발광체 · 헤일로 · 불꽃 · 앞 겹

// 지상: pxl이 구운 조명 그대로 (런타임 비용 0)
wA.addChild(new Sprite(loaded[A('scenes/surface.png')]));

// 패럴랙스: 먼 벽 0.2 · 중간 기둥 0.5 (갱도 틈으로 보인다)
const farA = new TilingSprite({ texture: tex('far_wall'), width: WW, height: WH - GY });
const midA = new TilingSprite({ texture: tex('mid_pillars'), width: WW, height: WH - GY });
farA.y = midA.y = GY;
farA.tint = 0x6c6480; midA.tint = 0x9a90a8;   // 먼 벽은 한 톤 어둡게: 갱도(빈칸)와 바위(타일)가 한눈에 갈리게
wA.addChild(farA, midA);
wN.addChild(new Graphics().rect(0, GY, WW, WH - GY).fill(0x8080ff));

const tilesA = new Container(), tilesN = new Container();
const shimmerA = new Container(), crackG = new Graphics(), edgeA = new Graphics(), edgeN = new Graphics();
const propsA = new Container(), propsN = new Container(), dustA = new Container();
wA.addChild(tilesA, shimmerA, crackG, edgeA, propsA, dustA);
wN.addChild(tilesN, edgeN, propsN);

const crystalsU = new Container(), lampsU = new Container(), halosU = new Container(), sparksU = new Container();
const fgU = new TilingSprite({ texture: tex('fg_rocks'), width: 10, height: 10 });
fgU.tint = 0x0b0910;
wU.addChild(crystalsU, lampsU, halosU, sparksU, fgU);

// ---------------------------------------------------------------- 타일
const tiles = new Map();      // "cx,cy" → { a, n, extra }
const damage = new Map();
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const TILE_NAME = { d: (x, y) => `dirt_${1 + (hash(x, y) % 2)}`, r: (x, y) => `rock_${1 + (hash(x, y) % 2)}`,
  h: () => 'hard_rock', B: () => 'hard_rock', a: () => 'ancient', w: () => 'water', g: () => 'gold_ore', c: () => 'glow_rock' };

function placeTile(cx, cy) {
  const ch = cellAt(cx, cy);
  if (!isSolid(ch)) return;
  const name = TILE_NAME[ch](cx, cy);
  const a = new Sprite(tex(name));
  a.position.set(cx * T, cy * T);
  if (ch === 'B') a.tint = 0x8a849c;
  tilesA.addChild(a);
  const n = NORMALS.includes(name) ? new Sprite(ntex(name)) : new Sprite(Texture.WHITE);
  if (!NORMALS.includes(name)) { n.width = n.height = T; n.tint = 0x8080ff; }
  n.position.set(cx * T, cy * T);
  tilesN.addChild(n);
  const t = { a, n, extra: [] };
  if (ch === 'g') {
    const s = new Sprite(F.gold_shimmer[0]);
    s.position.set(cx * T, cy * T);
    s.visible = false;
    s.phase = (hash(cx, cy) % 1000) / 1000 * 3;
    shimmerA.addChild(s);
    t.extra.push(s);
  }
  if (ch === 'c') {
    const s = new Sprite(F.glow_crystals[0]);
    s.position.set(cx * T, cy * T);
    s.phase = (hash(cx, cy) % 12);
    crystalsU.addChild(s);
    t.extra.push(s);
  }
  tiles.set(`${cx},${cy}`, t);
}
for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) placeTile(cx, cy);

// 버팀목 · 레일 (정적 소품)
grid.forEach((row, gy) => row.forEach((ch, gx) => {
  if (ch !== 'T') return;
  const s = new Sprite(tex('timber')); s.position.set(GX + gx * T, GY + gy * T); propsA.addChild(s);
  const n = new Sprite(ntex('timber')); n.position.copyFrom(s.position); propsN.addChild(n);
}));
for (const [gx, gy] of [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [7, 8], [8, 8]]) {
  const s = new Sprite(tex('rails')); s.position.set(GX + gx * T, GY + gy * T + 12); propsA.addChild(s);
}

// 드러난 면: 윗면은 밝은 테두리(노멀 ↑), 옆·아랫면은 잉크 선(노멀 옆·↓) → 랜턴이 지나가면 결이 산다
function drawEdges() {
  edgeA.clear(); edgeN.clear();
  for (let cy = GY / T; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    if (isSolid(cellAt(cx, cy))) continue;
    const x = cx * T, y = cy * T;
    const below = cellAt(cx, cy + 1), above = cellAt(cx, cy - 1), left = cellAt(cx - 1, cy), right = cellAt(cx + 1, cy);
    if (isSolid(below)) {
      const [l1, l2] = LIP[below];
      edgeA.rect(x, y + T, T, 1).fill(l1).rect(x, y + T + 1, T, 1).fill(l2);
      edgeN.rect(x, y + T, T, 2).fill(0x80e6cc);
    }
    if (isSolid(above) && cy - 1 >= GY / T) {
      edgeA.rect(x, y - 1, T, 1).fill(0x140f18);
      edgeN.rect(x, y - 2, T, 2).fill(0x801acc);
    }
    if (isSolid(left)) {
      edgeA.rect(x - 1, y, 1, T).fill(0x140f18);
      edgeN.rect(x - 2, y, 2, T).fill(0xe680cc);
    }
    if (isSolid(right)) {
      edgeA.rect(x + T, y, 1, T).fill(0x251b28);
      edgeN.rect(x + T, y, 2, T).fill(0x1a80cc);
    }
  }
}
drawEdges();

// 고체 격자 → 빛이 바위에 막히는 정도 (칸당 1텍셀, 선형 보간으로 가장자리가 몇 px 스민다)
const solidCanvas = document.createElement('canvas');
solidCanvas.width = COLS; solidCanvas.height = ROWS;
const solidTex = Texture.from(solidCanvas);
solidTex.source.scaleMode = 'linear';
function drawSolid() {
  const g = solidCanvas.getContext('2d'), img = g.createImageData(COLS, ROWS);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const ch = cellAt(cx, cy), v = ch === 'w' ? 120 : isSolid(ch) ? 255 : 0;
    const i = (cy * COLS + cx) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  solidTex.source.update();
}
drawSolid();

function drawCracks() {
  crackG.clear();
  for (const [key, dmg] of damage) {
    const [cx, cy] = key.split(',').map(Number), ch = cellAt(cx, cy), hp = HP[ch];
    if (!hp) continue;
    const stage = Math.min(3, Math.ceil((dmg / hp) * 3)), x = cx * T, y = cy * T, h = hash(cx, cy);
    const rays = [[8, 8, 3, 2], [8, 8, 13, 4], [8, 8, 5, 13], [8, 8, 14, 12], [8, 8, 9, 1]];
    for (let i = 0; i < stage + 1; i++) {
      const [x0, y0, x1, y1] = rays[(h + i) % rays.length];
      crackG.moveTo(x + x0, y + y0).lineTo(x + x1, y + y1);
    }
    crackG.stroke({ width: 1, color: 0x140f18, alignment: 0.5 });
    crackG.rect(x + 7, y + 7, 2, 2).fill(0x140f18);
  }
}

// ---------------------------------------------------------------- 등불 · 랜턴 · 헤일로
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = Texture.from(c); t.source.scaleMode = 'linear'; return t;
})();
function halo(color, size, alpha) {
  const s = new Sprite(haloTex); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = color;
  s.width = s.height = size; s.alpha = alpha; s.baseAlpha = alpha; halosU.addChild(s); return s;
}

const wallLamps = [[GX + 2 * T, GY + 4 * T + 1], [GX + 7 * T, GY + 6 * T + 2]].map(([x, y], i) => {
  const s = new Sprite(tex('wall_lamp')); s.position.set(x, y); lampsU.addChild(s);
  return { x: x + 9, y: y + 6, seed: i * 2.3, halo: halo(0xffb060, 26, 0.5) };
});

const lantern = { x: GX + 5 * T + 8, y: GY + 4 * T + 1, ang: 0, vel: 0, frame: 0 };
const lanternS = new Sprite(F.lantern[0]); lanternS.anchor.set(0.5, 0); lampsU.addChild(lanternS);
const lanternHalo = halo(0xffa050, 34, 0.55);
const lanternFlame = () => {
  const ox = -0.5, oy = 6, c = Math.cos(lantern.ang), s = Math.sin(lantern.ang);
  return [lantern.x + ox * c - oy * s, lantern.y + ox * s + oy * c];
};

// ---------------------------------------------------------------- 광부 (임시 그림)
const miner = { gx: 8, gy: 8, x: 0, t: 0, frame: 0, walking: 0, from: 0, to: 0 };
const minerX = (gx) => GX + gx * T + 8 - 12;
miner.x = minerX(miner.gx);
const minerS = new Sprite(F.miner[0]); propsA.addChild(minerS);
const headHalo = halo(0xfff0a0, 10, 0.6);

// ---------------------------------------------------------------- 광차: 금맥 앞 → 수직갱 → 지상 창고 왕복
const railY = (gy) => GY + gy * T + 15;
const ROUTE = [
  [GX + 7 * T + 8, railY(8), 'load'], [GX + 7 * T + 8, railY(4), 'lift'], [GX + 2 * T + 8, railY(4)],
  [GX + 2 * T + 8, 39, 'lift'], [436 - 14, 39, 'unload'],
];
const cart = { seg: 0, dir: 1, t: 0, wait: 1.2, x: ROUTE[0][0], y: ROUTE[0][1], full: true, spark: 0, moving: false };
const cartS = new Sprite(tex('cart_full')); cartS.anchor.set(0.5, 1); propsA.addChild(cartS);
const cable = new Graphics(); propsA.addChild(cable);

// ---------------------------------------------------------------- 입자 (풀링 · 폰 상한 300)
const pool = [];
function particle(layer, o) {
  const cap = low ? 80 : 300;
  if (pool.filter((p) => p.alive).length >= cap) return;
  let p = pool.find((q) => !q.alive);
  if (!p) { p = { s: new Sprite(Texture.WHITE) }; p.s.width = p.s.height = 1; pool.push(p); }
  if (p.s.parent !== layer) layer.addChild(p.s);
  Object.assign(p, { alive: true, g: 220, drag: 0, fade: true, size: 1 }, o);
  p.s.visible = true; p.s.tint = p.color; p.s.alpha = 1; p.s.width = p.s.height = p.size; p.age = 0;
}
function updateParticles(dt) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age >= p.life) { p.alive = false; p.s.visible = false; continue; }
    p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.solid && isSolid(cellAt(Math.floor(p.x / T), Math.floor(p.y / T)))) { p.y -= p.vy * dt; p.vy *= -0.3; p.vx *= 0.6; }
    p.s.position.set(Math.round(p.x), Math.round(p.y));
    if (p.fade) p.s.alpha = 1 - p.age / p.life;
  }
}

// ---------------------------------------------------------------- 주스
let shake = 0, shakeAmp = 0, hitstop = 0, slowmo = 0, flash = 0, boom = null, boomed = false;
const stash = { g: 0, c: 0, ore: 0 };

function hitTile(cx, cy, by = 'player') {
  const ch = cellAt(cx, cy);
  if (!isSolid(ch)) return false;
  const player = by === 'player';
  const hp = HP[ch];
  const cxp = cx * T + 8, cyp = cy * T + 8;
  if (!hp) {                                             // 고대석·암반: 쨍, 불꽃만
    sfx('clink', !player);
    for (let i = 0; i < 3; i++) particle(sparksU, { x: cxp, y: cyp, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 40, life: 0.25, color: 0xfff0a8 });
    if (player) { shake = 0.1; shakeAmp = 1; toast('단단해서 지금 곡괭이로는 안 파져요'); }
    return false;
  }
  if (player) { shake = 0.12; shakeAmp = 2; hitstop = 0.05; }   // 흔들림 2px + 히트 스톱 50ms
  sfx('hit', !player);
  const cols = DEBRIS[ch];
  for (let i = 0; i < 6; i++)                           // 파편 6개
    particle(dustA, { x: cxp + (Math.random() - 0.5) * 10, y: cyp + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 110, vy: -50 - Math.random() * 70, life: 0.5 + Math.random() * 0.3, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.3 ? 2 : 1 });
  if (ch === 'r' || ch === 'h' || ch === 'g')
    for (let i = 0; i < 2; i++) particle(sparksU, { x: cxp, y: cyp, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 50, life: 0.18, color: 0xffd080 });
  const d = (damage.get(`${cx},${cy}`) || 0) + (player ? 1 : 0.35);
  if ((ch === 'g' || ch === 'c') && (player || Math.random() < 0.45)) orePopup(ch, cxp, cyp - 4, 1);
  if (d >= hp - 1e-6) breakTile(cx, cy, ch, player);
  else damage.set(`${cx},${cy}`, d);
  drawCracks();
  return true;
}

function breakTile(cx, cy, ch, player) {
  damage.delete(`${cx},${cy}`);
  const gx = cx - GX / T, gy = cy - GY / T;
  grid[gy][gx] = '.';
  const t = tiles.get(`${cx},${cy}`);
  if (t) { t.a.destroy(); t.n.destroy(); t.extra.forEach((e) => e.destroy()); tiles.delete(`${cx},${cy}`); }
  sfx('break', !player);
  const cols = DEBRIS[ch], x0 = cx * T, y0 = cy * T;
  for (let i = 0; i < 14; i++)
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.7 + Math.random() * 0.4, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.4 ? 2 : 1 });
  for (let i = 0; i < 8; i++)                            // 먼지 구름
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 30, vy: -8 - Math.random() * 10, life: 1.2, color: 0x8a7a6a, g: 0, drag: 1.5, size: 2 });
  if (ch === 'g' || ch === 'c') orePopup(ch, x0 + 8, y0 + 4, 3);
  if (ch === 'w') for (let i = 0; i < 10; i++) particle(dustA, { x: x0 + 8, y: y0 + 8, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 40, life: 0.6, color: 0x5a94c8, solid: true });
  drawEdges(); drawSolid(); drawCracks();
  if (ch === 'g' && player && !boomed) { boomed = true; bigVein(x0 + 8, y0 + 8); }
}

// 큰 광맥: 슬로모 0.4초 + 플래시 + 종 + "대박!"
function bigVein(x, y) {
  slowmo = 0.4; flash = 1; shake = 0.35; shakeAmp = 3;
  boom = { x, y, t: 1.6 };
  sfx('bell');
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
    particle(sparksU, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.8 + Math.random() * 0.6, color: [0xfff0a8, 0xf0b03c, 0xffffff][i % 3], g: 60, size: Math.random() < 0.3 ? 2 : 1 });
  }
  const el = document.createElement('div');
  el.className = 'daebak'; el.textContent = '대박!';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ---------------------------------------------------------------- 카메라 · 화면 크기
const cam = { x: GX + 7 * T - 200, y: 28 };
let viewW = 400, px = 4, cssScale = 2, offX = 0, offY = 0;
let albedoRT, normalRT, litRT, finalRT, lightPass, postPass;
const display = new Sprite();
app.stage.addChild(display);

function layout() {
  const dpr = R.resolution, dw = window.innerWidth * dpr, dh = window.innerHeight * dpr;
  const ratio = Math.min(dh / VIEW_H, dw / 256);
  px = ratio >= 3 ? Math.floor(ratio) : ratio;   // 폰(고밀도)은 정수 배율, 저밀도 화면만 소수 배율로 꽉 채움
  viewW = Math.max(256, Math.min(WW - 16, Math.floor(dw / px)));
  cssScale = px / dpr;
  offX = Math.round((window.innerWidth - viewW * cssScale) / 2);
  offY = Math.round((window.innerHeight - VIEW_H * cssScale) / 2);
  for (const rt of [albedoRT, normalRT, litRT, finalRT]) rt?.destroy(true);
  lightPass?.destroy(); postPass?.destroy();
  const mk = (scaleMode) => RenderTexture.create({ width: viewW, height: VIEW_H, resolution: 1, scaleMode });
  albedoRT = mk('nearest'); normalRT = mk('nearest'); litRT = mk('linear'); finalRT = mk('nearest');
  lightPass = makeLightPass(albedoRT, normalRT, solidTex);
  postPass = makePostPass(litRT);
  lightPass.scale.set(viewW, VIEW_H); postPass.scale.set(viewW, VIEW_H);
  display.texture = finalRT;
  display.scale.set(cssScale);
  display.position.set(offX, offY);
  fgU.width = viewW; fgU.height = VIEW_H;
  clampCam();
}
function clampCam() {
  cam.x = Math.max(0, Math.min(WW - viewW, cam.x));
  cam.y = Math.max(0, Math.min(WH - VIEW_H, cam.y));
}
window.addEventListener('resize', () => setTimeout(layout, 50));
layout();

const toWorld = (e) => [(e.clientX - offX) / cssScale + cam.x, (e.clientY - offY) / cssScale + cam.y];
const toScreen = (x, y) => [offX + (x - cam.x) * cssScale, offY + (y - cam.y) * cssScale];

// ---------------------------------------------------------------- 입력: 톡 = 곡괭이 · 랜턴 끌기 · 빈 곳 끌기 = 화면 이동
let drag = null;
app.canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const [wx, wy] = toWorld(e);
  const [fx, fy] = [lantern.x, lantern.y + 6];
  const mode = Math.hypot(wx - fx, wy - fy) < 14 ? 'lantern' : 'maybe';
  drag = { id: e.pointerId, mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now() };
  app.canvas.setPointerCapture(e.pointerId);
});
app.canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.lx) / cssScale, dy = (e.clientY - drag.ly) / cssScale;
  drag.lx = e.clientX; drag.ly = e.clientY;
  if (drag.mode === 'maybe' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.mode = 'pan';
  if (drag.mode === 'pan') { cam.x -= dx; cam.y -= dy; clampCam(); }
  if (drag.mode === 'lantern') {
    lantern.x = Math.max(8, Math.min(WW - 8, lantern.x + dx));
    lantern.y = Math.max(GY + 2, Math.min(WH - 16, lantern.y + dy));
    lantern.vel -= dx * 0.05;
  }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'maybe') tap(...toWorld(e));
  drag = null;
};
app.canvas.addEventListener('pointerup', endDrag);
app.canvas.addEventListener('pointercancel', () => { drag = null; });

function tap(wx, wy) {
  const cx = Math.floor(wx / T), cy = Math.floor(wy / T), ch = cellAt(cx, cy);
  if (!isSolid(ch)) return;
  const reach = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const n = cellAt(cx + dx, cy + dy);
    return n !== 'sky' && !isSolid(n);
  });
  if (!reach) {
    sfx('clink', true); shake = 0.08; shakeAmp = 1;
    toast('갱도와 맞닿은 칸만 팔 수 있어요');
    return;
  }
  hitTile(cx, cy, 'player');
}

// ---------------------------------------------------------------- HUD (DOM: 반투명 유리 + 번짐 없는 테두리)
const $ = (id) => document.getElementById(id);
const counter = { g: $('cnt-g'), c: $('cnt-c'), ore: $('cnt-ore') };
function bump(el) { el.parentElement.classList.remove('pulse'); void el.offsetWidth; el.parentElement.classList.add('pulse'); }

function orePopup(kind, x, y, n) {
  sfx('ore');
  const [sx, sy] = toScreen(x, y);
  const el = document.createElement('div');
  el.className = `pop pop-${kind}`;
  el.innerHTML = `<i></i>+${n}`;
  document.body.appendChild(el);
  const target = counter[kind].getBoundingClientRect();
  const tx = target.left + target.width / 2, ty = target.top + target.height / 2;
  const up = el.animate([
    { transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(0.6)`, opacity: 0.3 },
    { transform: `translate(${sx}px, ${sy - 22}px) translate(-50%, -50%) scale(1.25)`, opacity: 1, offset: 0.35 },
    { transform: `translate(${sx}px, ${sy - 18}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
  ], { duration: 380, easing: 'ease-out', fill: 'forwards' });
  up.onfinish = () => {
    const fly = el.animate([
      { transform: `translate(${sx}px, ${sy - 18}px) translate(-50%, -50%) scale(1)` },
      { transform: `translate(${(sx + tx) / 2 + 40}px, ${Math.min(sy, ty) - 40}px) translate(-50%, -50%) scale(0.9)`, offset: 0.45 },
      { transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(0.4)`, opacity: 0.6 },
    ], { duration: 460, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    fly.onfinish = () => {
      el.remove();
      stash[kind] += n; counter[kind].textContent = stash[kind]; bump(counter[kind]); sfx('stash', true);
    };
  };
}

let toastTimer = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

function setLow(v) {
  low = v;
  try { localStorage.setItem('kod.low', v ? '1' : '0'); } catch {}
  $('btn-low').textContent = `저사양 ${v ? '켬' : '끔'}`;
  $('btn-low').classList.toggle('on', v);
  document.body.classList.toggle('low', v);
}
$('btn-low').onclick = () => setLow(!low);
setLow(low);
$('btn-sound').onclick = () => { unlockAudio(); setSound(!soundOn()); $('btn-sound').textContent = `소리 ${soundOn() ? '켬' : '끔'}`; };
$('btn-boom').onclick = () => { unlockAudio(); bigVein(GX + 9 * T + 8, GY + 9 * T + 8); };
$('btn-ref').onclick = () => $('ref').classList.add('show');
$('ref').onclick = () => $('ref').classList.remove('show');
$('ref-img').src = A('scenes/mine_night.gif');
$('btn-full').onclick = async () => {
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.('landscape');
  } catch {}
};

// ---------------------------------------------------------------- 매 프레임
let time = 0, fpsT = 0, fpsN = 0;
const lights = [];
function addLight(x, y, z, r, color, power) { if (lights.length < MAX_LIGHTS) lights.push([x, y, z, r, color, power]); }
const flick = (t, seed) => 0.55 * Math.sin(t * 9 + seed) + 0.3 * Math.sin(t * 23 + seed * 2) + 0.15 * Math.sin(t * 41 + seed * 3);

app.ticker.add((tk) => {
  const real = Math.min(tk.deltaMS / 1000, 0.05);
  fpsT += real; fpsN++;
  if (fpsT >= 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }

  // 히트 스톱 · 슬로모
  let dt = real;
  if (hitstop > 0) { hitstop -= real; dt = 0; }
  if (slowmo > 0) { slowmo -= real; dt *= 0.25; }
  time += dt;

  // 광부: 오른쪽 칸을 계속 캔다. 파내면 한 칸 걸어 들어간다
  if (miner.walking > 0) {
    miner.walking = Math.max(0, miner.walking - dt / 0.9);
    miner.x = miner.to + (miner.from - miner.to) * miner.walking;
    minerS.texture = F.miner[0];
    minerS.y = GY + miner.gy * T + T - 18 - (Math.floor(time * 8) % 2);
  } else {
    const tgt = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy);
    const floor = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy + 1);
    if (!isSolid(tgt) && isSolid(floor) && miner.gx + 1 < GW) {
      miner.from = miner.x; miner.gx++; miner.to = minerX(miner.gx); miner.walking = 1;
    } else if (isSolid(tgt) && HP[tgt]) {
      const prev = miner.frame;
      miner.t += dt; miner.frame = Math.floor(miner.t / 0.15) % 4;
      if (miner.frame === 2 && prev !== 2) hitTile(GX / T + miner.gx + 1, GY / T + miner.gy, 'miner');
      minerS.texture = F.miner[miner.frame];
    } else minerS.texture = F.miner[0];
    minerS.y = GY + miner.gy * T + T - 18;
  }
  minerS.x = Math.round(miner.x);
  const head = [minerS.x + 15, minerS.y + 4];

  // 광차: 바퀴 불꽃 · 먼지
  if (cart.wait > 0) {
    cart.wait -= dt; cart.moving = false;
  } else {
    const a = ROUTE[cart.seg], b = ROUTE[cart.seg + cart.dir];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), vertical = Math.abs(b[0] - a[0]) < 1;
    cart.t += (dt * (vertical ? 26 : 34)) / len;
    cart.moving = true;
    if (cart.t >= 1) {
      cart.t = 0; cart.seg += cart.dir;
      const tag = ROUTE[cart.seg][2];
      if (tag === 'unload') {
        cart.wait = 1.0; cart.full = false; cart.dir = -1;
        const [sx, sy] = [ROUTE[cart.seg][0], ROUTE[cart.seg][1] - 14];
        orePopup('ore', sx, sy, 5);
      } else if (tag === 'load') { cart.wait = 1.4; cart.full = true; cart.dir = 1; }
    }
    const p = ROUTE[cart.seg], q = ROUTE[Math.max(0, Math.min(ROUTE.length - 1, cart.seg + cart.dir))];
    cart.x = p[0] + (q[0] - p[0]) * cart.t; cart.y = p[1] + (q[1] - p[1]) * cart.t;
    if (!vertical && cart.moving) {
      cart.spark -= dt;
      if (cart.spark <= 0) {
        cart.spark = 0.06 + Math.random() * 0.06;
        const back = Math.sign(a[0] - b[0]);
        for (const wx of [-6, 6]) particle(sparksU, { x: cart.x + wx, y: cart.y - 1, vx: back * (20 + Math.random() * 40), vy: -20 - Math.random() * 30, life: 0.2, color: Math.random() < 0.5 ? 0xffd080 : 0xff8a2a });
        particle(dustA, { x: cart.x - back * 10, y: cart.y - 2, vx: back * 8, vy: -6, life: 0.8, color: 0x8a7a6a, g: 0, drag: 1.2, size: 2 });
      }
    }
  }
  cartS.texture = tex(cart.full ? 'cart_full' : 'cart');
  cartS.position.set(Math.round(cart.x), Math.round(cart.y + (cart.moving && time * 20 % 2 < 1 ? 0 : 0)));
  cartS.tint = cart.y < GY ? 0xe0a890 : 0xffffff;
  cable.clear();
  const inShaft2 = Math.abs(cart.x - (GX + 2 * T + 8)) < 1 && cart.y < railY(4) - 1;
  const inShaft7 = Math.abs(cart.x - (GX + 7 * T + 8)) < 1 && cart.y > railY(4) + 1 && cart.y < railY(8);
  if (inShaft2) cable.moveTo(SHAFT_TOP_X, 9).lineTo(cart.x + 4, cart.y - 14).stroke({ width: 1, color: 0x3e3e4e });
  if (inShaft7) cable.moveTo(cart.x + 4, GY + 4 * T).lineTo(cart.x + 4, cart.y - 14).stroke({ width: 1, color: 0x3e3e4e });

  // 랜턴: 진자 흔들림
  if (!drag || drag.mode !== 'lantern') lantern.vel += -Math.sin(lantern.ang) * 18 * dt;
  lantern.vel *= 1 - 1.4 * dt;
  lantern.ang += lantern.vel * dt;
  lantern.ang = Math.max(-0.9, Math.min(0.9, lantern.ang + Math.sin(time * 1.3) * 0.0006));
  lantern.frame = Math.floor(time * 8) % F.lantern.length;
  lanternS.texture = F.lantern[lantern.frame];
  lanternS.position.set(Math.round(lantern.x), Math.round(lantern.y));
  lanternS.rotation = lantern.ang;
  const [lfx, lfy] = lanternFlame();

  // 광석: 금 쉬머 · 발광 광석 맥동
  for (const s of shimmerA.children) {
    const t = (time + s.phase) % 2.6;
    s.visible = t < 1;
    if (s.visible) s.texture = F.gold_shimmer[Math.min(11, Math.floor(t * 12))];
  }
  for (const s of crystalsU.children) s.texture = F.glow_crystals[(Math.floor(time * 8) + s.phase) % 12];

  // 빛 목록
  lights.length = 0;
  const lf = flick(time, 0);
  addLight(lfx, lfy, 10, 100 * (1 + 0.03 * lf), [1.0, 0.72, 0.46], 1.75 * (1 + 0.06 * lf));
  for (const w of wallLamps) {
    const f = flick(time, w.seed);
    addLight(w.x, w.y, 8, 72 * (1 + 0.03 * f), [1.0, 0.78, 0.52], 1.45 * (1 + 0.06 * f));
    w.halo.position.set(w.x, w.y); w.halo.alpha = w.halo.baseAlpha * (1 + 0.15 * f);
  }
  addLight(head[0] + 8, head[1] + 4, 6, 40, [1.0, 0.94, 0.68], 1.25);
  let gxs = 0, gys = 0, gn = 0;
  for (const [key, t] of tiles) if (t.extra[0] && crystalsU.children.includes(t.extra[0])) {
    const [cx, cy] = key.split(',').map(Number); gxs += cx * T + 8; gys += cy * T + 8; gn++;
  }
  if (gn) addLight(gxs / gn, gys / gn, -8, 40 + gn * 5, [0.36, 0.95, 0.86], 1.05 + 0.25 * Math.sin(time * 2.2));
  if (boom) {
    boom.t -= real;
    const k = Math.max(0, boom.t / 1.6);
    addLight(boom.x, boom.y, 12, 150 * k + 30, [1.0, 0.86, 0.5], 1.6 * k);
    if (boom.t <= 0) boom = null;
  }

  lanternHalo.position.set(lfx, lfy); lanternHalo.alpha = lanternHalo.baseAlpha * (1 + 0.12 * lf);
  headHalo.position.set(head[0], head[1]);
  halosU.visible = !low;

  // 먼지: 빛 속에서만 보이는 부유물
  if (Math.random() < (low ? 0.08 : 0.35)) {
    const x = cam.x + Math.random() * viewW, y = cam.y + Math.random() * VIEW_H;
    if (!isSolid(cellAt(Math.floor(x / T), Math.floor(y / T))) && y > GY)
      particle(dustA, { x, y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2, life: 3 + Math.random() * 2, color: 0xc8b8a0, g: 0 });
  }
  updateParticles(dt);

  // 카메라 · 흔들림
  let sx = 0, sy = 0;
  if (shake > 0) { shake -= real; sx = Math.round((Math.random() * 2 - 1) * shakeAmp); sy = Math.round((Math.random() * 2 - 1) * shakeAmp); }
  const cx = Math.round(cam.x) + sx, cy = Math.round(cam.y) + sy;
  for (const w of [wA, wN, wU]) w.position.set(-cx, -cy);
  farA.tilePosition.set(Math.round(cx * 0.8), Math.round((cy - GY) * 0.8));
  midA.tilePosition.set(Math.round(cx * 0.5), Math.round((cy - GY) * 0.5 + 20));
  const fgTop = Math.max(cy, GY + 24);
  fgU.position.set(cx, fgTop); fgU.height = Math.max(0, cy + VIEW_H - fgTop);
  fgU.tilePosition.set(Math.round(-cx * 1.3), Math.round(-cy * 1.3 - (fgTop - cy)));
  fgU.visible = !low;

  // 조명 합성 → 발광/헤일로 → 후처리
  const lu = lightPass.shader.resources.u.uniforms;
  lu.uView = [viewW, VIEW_H]; lu.uCam = [cx, cy]; lu.uWorld = [WW, WH];
  lu.uAmbient = AMB_COLOR.map((v) => v * AMBIENT);
  const pos = lu.uLightPos, col = lu.uLightCol;
  pos.fill(0); col.fill(0);
  lights.forEach(([x, y, z, r, c, p], i) => { pos.set([x, y, z, r], i * 4); col.set([c[0], c[1], c[2], p], i * 4); });
  lu.uCount = lights.length; lu.uSteps = low ? 6 : 12; lu.uRelief = low ? 0.6 : 1.1;
  const pu = postPass.shader.resources.u.uniforms;
  pu.uView = [viewW, VIEW_H]; pu.uTilt = low ? 0 : (shake > 0 ? 0.5 : 1); pu.uVig = low ? 0 : 0.38;
  pu.uTint = low ? [1, 1, 1] : TINT;
  flash = Math.max(0, flash - real * 3);
  pu.uFlash = [flash * 0.9, flash * 0.85, flash * 0.7];

  R.render({ container: wA, target: albedoRT, clear: true, clearColor: [0.04, 0.035, 0.06, 1] });
  R.render({ container: wN, target: normalRT, clear: true, clearColor: [0, 0, 0, 0] });
  R.render({ container: lightPass, target: litRT, clear: true });
  R.render({ container: wU, target: litRT, clear: false });
  R.render({ container: postPass, target: finalRT, clear: true });
});

window.__kod = { cam, lantern, tiles, grid, lights, bigVein, toScreen, tap };
