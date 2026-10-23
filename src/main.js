// 「용사님, 채굴하실게요~」 HD-2D 비주얼 프로토타입
// 갱도 격자 12×16(화면 높이 = 9칸) + 런타임 랜턴 조명(노멀맵) + 광부 + 광차 + 광맥 + 곡괭이 주스
// + 격자 양옆 2칸 패럴랙스 바위 3겹 + 틸트 시프트(격자 영역 마스크) + 저사양 토글
// 타일·소품: 형철 초안 art/shaft.px.js
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
const SIDE = 2;                           // 격자 양옆 패럴랙스 바위 칸 수
const GX = SIDE * T, GY = 48;             // 구획(격자) 왼쪽 위
const WW = GX * 2 + GW * T;               // 256
const WH = GY + GH * T + T;               // 320
const COLS = WW / T, ROWS = WH / T;
const VIEW_ROWS = 9;                      // 화면 높이 = 9칸
const VIEW_H = VIEW_ROWS * T;             // 144
const SHAFT_TOP_X = 76;                   // 지상 권양기 도르래 케이블

// . 갱도  T 갱도+갱목  d 흙  r 바위  h 단단한 바위  C 구리  s 은  g 금  c 발광 광석  j 보석
const MAP = [
  'ddTddddddddd',
  'dd.ddrddCddd',
  'dr.ddrrdCCdd',
  'rd.rdddddddr',
  'rr.....TdrCr',
  'hrrrdrr.rdrh',
  'hrhrsrd.rrhh',
  'hhrssrr.rrrh',
  'hrrcccr..ggr',
  'hhrrcrrhggrh',
  'hhhrrhrrhggg',
  'hjhhhrrrhggg',
  'hhjhhhhhgggh',
  'hhhhhhhhhghh',
  'hhhhjhhhhhhh',
  'hhhhhhhhhhhh',
];
const grid = MAP.map((r) => r.split(''));
const HP = { d: 2, r: 3, h: 5, C: 3, s: 3, g: 3, c: 3, j: 4 };   // B(바깥 암반)는 못 판다
const ORE = { g: 'g', c: 'c' };                                   // HUD에 세는 광종
const LIP = {                                                     // 드러난 윗면 테두리 (shaft.px.js 팔레트)
  d: [0x8a6c52, 0x6e5440], r: [0xa3a2b6, 0x7c7a92], h: [0x3e3848, 0x2a2634], B: [0x3e3848, 0x2a2634],
  C: [0xe0a060, 0x7c7a92], s: [0xe8ecf8, 0x7c7a92], g: [0xf5cf6a, 0xd39a3a], c: [0x6fe0d8, 0x7c7a92], j: [0xc98af0, 0x7c7a92],
};
const DEBRIS = {
  d: [0x55402f, 0x6e5440, 0x3a2a22, 0x8a6c52], r: [0x5a5770, 0x7c7a92, 0x3d3a4c], h: [0x3e3848, 0x2a2634, 0x5a5770],
  C: [0xb87a4a, 0xe0a060, 0x5a5770], s: [0x9aa0b8, 0xe8ecf8, 0x5a5770], g: [0xd39a3a, 0xf5cf6a, 0x8a5a24, 0x5a5770],
  c: [0x2fa09a, 0x6fe0d8, 0x5a5770], j: [0x8a4ab0, 0xc98af0, 0x5a5770], B: [0x3e3848, 0x2a2634],
};
const empty = (ch) => ch === '.' || ch === 'T';

/** 세계 칸(열, 행) → 'sky' | 격자 문자 | 'B'(바깥 암반: 양옆 패럴랙스 · 맨 아래) */
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
const AMBIENT = Number(qs.get('ambient') || 0.4);
const AMB_COLOR = [0.86, 0.82, 1.0];     // 회보라 앰비언트
const TINT = [1.05, 0.98, 0.9];          // 뒷산 층 색온도 (갈색·노을)
const LANTERN_R = 100 * 1.3, LANTERN_POWER = 0.8;
const TILT_BAND = 0.1;                   // 틸트 시프트: 위아래 10%

// ---------------------------------------------------------------- 시작
const app = new Application();
await app.init({
  preference: 'webgl', background: '#0b0910', antialias: false,
  resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, resizeTo: window,
});
document.getElementById('stage').appendChild(app.canvas);
const R = app.renderer;

const A = (p) => `${import.meta.env.BASE_URL}art/${p}`;
const SPRITES = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'gem',
  'tunnel', 'tunnel_beam', 'rail', 'cart', 'cart_empty', 'stalactite', 'mushroom', 'side_far', 'side_mid', 'side_fg'];
const NORMALS = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver'];
const ANIMS = ['ore_glow', 'gold_shimmer', 'lantern', 'miner_red'];
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

// 격자 양옆 2칸만 패럴랙스 바위: 먼 바위 0.2 · 중간 0.5 (조명 받음) / 앞 1.3 (어두운 실루엣)
function sideLayer(name, parent) {
  const make = (x, flip) => {
    const s = new TilingSprite({ texture: tex(name), width: GX, height: WH - GY });
    s.position.set(flip ? WW : x, GY);
    if (flip) s.scale.x = -1;
    parent.addChild(s);
    return s;
  };
  return [make(0, false), make(WW - GX, true)];
}
const farA = sideLayer('side_far', wA), midA = sideLayer('side_mid', wA);
wN.addChild(new Graphics().rect(0, GY, WW, WH - GY).fill(0x8080ff));

const tilesA = new Container(), tilesN = new Container();
const shimmerA = new Container(), crackG = new Graphics(), edgeA = new Graphics(), edgeN = new Graphics();
const propsA = new Container(), propsN = new Container(), dustA = new Container();
wA.addChild(tilesA, shimmerA, crackG, edgeA, propsA, dustA);
wN.addChild(tilesN, edgeN, propsN);

const lampsU = new Container(), halosU = new Container(), sparksU = new Container(), fgU = new Container();
wU.addChild(lampsU, halosU, sparksU, fgU);
const fgSides = sideLayer('side_fg', fgU);
for (const s of fgSides) s.tint = 0x2a2232;

// ---------------------------------------------------------------- 타일
const tiles = new Map();      // "cx,cy" → { a, n, extra }
const damage = new Map();
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const TILE_NAME = {
  d: (x, y) => `dirt_${1 + (hash(x, y) % 3)}`, r: () => 'rock', h: () => 'hard_rock', B: () => 'hard_rock',
  C: () => 'ore_copper', s: () => 'ore_silver', g: () => 'ore_gold', c: () => 'ore_glow', j: () => 'gem',
  '.': () => 'tunnel', T: () => 'tunnel_beam',
};
const glowTiles = [];

function placeTile(cx, cy) {
  const ch = cellAt(cx, cy);
  if (ch === 'sky') return;
  const gx = cx - GX / T;
  if (ch === 'B' && (gx < 0 || gx >= GW)) return;          // 양옆은 패럴랙스 겹이 맡는다
  const name = TILE_NAME[ch](cx, cy);
  const a = new Sprite(name === 'ore_glow' ? F.ore_glow[0] : tex(name));
  a.position.set(cx * T, cy * T);
  if (ch === 'B') a.tint = 0x8a849c;
  tilesA.addChild(a);
  const t = { a, n: null, extra: [] };
  if (NORMALS.includes(name)) {
    t.n = new Sprite(ntex(name)); t.n.position.set(cx * T, cy * T); tilesN.addChild(t.n);
  }
  if (ch === 'g') {
    const s = new Sprite(F.gold_shimmer[0]);
    s.position.set(cx * T, cy * T); s.visible = false; s.phase = (hash(cx, cy) % 1000) / 1000 * 3;
    shimmerA.addChild(s); t.extra.push(s);
  }
  if (ch === 'c') {
    a.phase = hash(cx, cy) % 12;
    const h = halo(0x6fe0d8, 30, 0.22); h.position.set(cx * T + 8, cy * T + 8); h.phase = a.phase;
    t.extra.push(h); glowTiles.push(t); t.cx = cx; t.cy = cy;
  }
  tiles.set(`${cx},${cy}`, t);
}
function removeTile(cx, cy) {
  const t = tiles.get(`${cx},${cy}`);
  if (!t) return;
  t.a.destroy(); t.n?.destroy(); t.extra.forEach((e) => e.destroy());
  const gi = glowTiles.indexOf(t); if (gi >= 0) glowTiles.splice(gi, 1);
  tiles.delete(`${cx},${cy}`);
}

// ---------------------------------------------------------------- 헤일로
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

for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) placeTile(cx, cy);

// 레일 · 종유석 · 버섯 (정적 소품)
for (const [gx, gy] of [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [7, 8], [8, 8]]) {
  const s = new Sprite(tex('rail')); s.position.set(GX + gx * T, GY + gy * T + 12); propsA.addChild(s);
}
for (const [gx, gy, ox] of [[4, 4, 3], [6, 4, 9], [2, 2, 6], [7, 6, 2]]) {
  const s = new Sprite(tex('stalactite')); s.position.set(GX + gx * T + ox, GY + gy * T); propsA.addChild(s);
}
for (const [gx, gy, ox] of [[5, 4, 2], [5, 4, 7], [3, 4, 10]]) {
  const s = new Sprite(tex('mushroom')); s.position.set(GX + gx * T + ox, GY + gy * T + 12); propsA.addChild(s);
  halo(0x6fe0d8, 12, 0.35).position.set(s.x + 2, s.y + 1);
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
      edgeA.rect(x, y - 1, T, 1).fill(0x1a1220);
      edgeN.rect(x, y - 2, T, 2).fill(0x801acc);
    }
    if (isSolid(left)) {
      edgeA.rect(x - 1, y, 1, T).fill(0x1a1220);
      edgeN.rect(x - 2, y, 2, T).fill(0xe680cc);
    }
    if (isSolid(right)) {
      edgeA.rect(x + T, y, 1, T).fill(0x2b1f35);
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
    const v = isSolid(cellAt(cx, cy)) ? 255 : 0, i = (cy * COLS + cx) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  solidTex.source.update();
}
drawSolid();

function drawCracks() {
  crackG.clear();
  for (const [key, dmg] of damage) {
    const [cx, cy] = key.split(',').map(Number), hp = HP[cellAt(cx, cy)];
    if (!hp) continue;
    const stage = Math.min(3, Math.ceil((dmg / hp) * 3)), x = cx * T, y = cy * T, h = hash(cx, cy);
    const rays = [[8, 8, 3, 2], [8, 8, 13, 4], [8, 8, 5, 13], [8, 8, 14, 12], [8, 8, 9, 1]];
    for (let i = 0; i < stage + 1; i++) {
      const [x0, y0, x1, y1] = rays[(h + i) % rays.length];
      crackG.moveTo(x + x0, y + y0).lineTo(x + x1, y + y1);
    }
    crackG.stroke({ width: 1, color: 0x1a1220, alignment: 0.5 });
    crackG.rect(x + 7, y + 7, 2, 2).fill(0x1a1220);
  }
}

// ---------------------------------------------------------------- 벽 랜턴 2 · 움직이는 랜턴 1 (shaft.px.js "lantern")
const LANTERN_FLAME = [-0.5, 4];          // 고리(위 가운데) 기준 불꽃 위치
const wallLamps = [[GX + 2 * T + 9, GY + 4 * T + 3], [GX + 7 * T + 9, GY + 6 * T + 4]].map(([x, y], i) => {
  const br = new Graphics().moveTo(x - 9, y - 1).lineTo(x, y - 1).lineTo(x, y).stroke({ width: 1, color: 0x5c3832 });
  lampsU.addChild(br);
  const s = new Sprite(F.lantern[0]); s.anchor.set(0.5, 0); s.position.set(x, y); lampsU.addChild(s);
  return { s, x: x + LANTERN_FLAME[0], y: y + LANTERN_FLAME[1], seed: i * 2.3, halo: halo(0xffb060, 24, 0.5) };
});

const lantern = { x: GX + 5 * T + 8, y: GY + 4 * T + 2, ang: 0, vel: 0 };
const lanternS = new Sprite(F.lantern[0]); lanternS.anchor.set(0.5, 0); lampsU.addChild(lanternS);
const lanternHalo = halo(0xffa050, 30, 0.5);
const lanternFlame = () => {
  const [ox, oy] = LANTERN_FLAME, c = Math.cos(lantern.ang), s = Math.sin(lantern.ang);
  return [lantern.x + ox * c - oy * s, lantern.y + ox * s + oy * c];
};

// ---------------------------------------------------------------- 붉은 수염 광부
const miner = { gx: 8, gy: 8, x: 0, t: 0, frame: 0, walking: 0, from: 0, to: 0, strikes: 0 };
const minerX = (gx) => GX + gx * T + 1;
miner.x = minerX(miner.gx);
const minerS = new Sprite(F.miner_red[0]); propsA.addChild(minerS);
const headHalo = halo(0xfff0a0, 8, 0.6);

// ---------------------------------------------------------------- 광차: 금맥 앞 → 수직갱 → 지상 창고 왕복
const railY = (gy) => GY + gy * T + 14;
const ROUTE = [
  [GX + 7 * T + 8, railY(8), 'load'], [GX + 7 * T + 8, railY(4), 'lift'], [GX + 2 * T + 8, railY(4)],
  [GX + 2 * T + 8, 39, 'lift'], [190, 39, 'unload'],
];
const cart = { seg: 0, dir: 1, t: 0, wait: 1.2, x: ROUTE[0][0], y: ROUTE[0][1], full: true, spark: 0, moving: false };
const cartS = new Sprite(tex('cart')); cartS.anchor.set(0.5, 1); propsA.addChild(cartS);
const cable = new Graphics(); propsA.addChild(cable);

// ---------------------------------------------------------------- 입자 (풀링 · 폰 상한 300)
const pool = [];
function particle(layer, o) {
  const cap = low ? 80 : 300;
  if (pool.filter((p) => p.alive).length >= cap) return;
  let p = pool.find((q) => !q.alive);
  if (!p) { p = { s: new Sprite(Texture.WHITE) }; pool.push(p); }
  if (p.s.parent !== layer) layer.addChild(p.s);
  Object.assign(p, { alive: true, g: 220, drag: 0, fade: true, size: 1, solid: false }, o);
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
  if (!hp) {                                             // 바깥 암반: 쨍, 불꽃만
    sfx('clink', !player);
    for (let i = 0; i < 3; i++) particle(sparksU, { x: cxp, y: cyp, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 40, life: 0.25, color: 0xfff4b8 });
    if (player) { shake = 0.1; shakeAmp = 1; toast('단단해서 지금 곡괭이로는 안 파져요'); }
    return false;
  }
  if (player) { shake = 0.12; shakeAmp = 2; hitstop = 0.05; }   // 흔들림 2px + 히트 스톱 50ms
  sfx('hit', !player);
  const cols = DEBRIS[ch];
  for (let i = 0; i < 6; i++)                           // 파편 6개
    particle(dustA, { x: cxp + (Math.random() - 0.5) * 10, y: cyp + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 110, vy: -50 - Math.random() * 70, life: 0.5 + Math.random() * 0.3, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.3 ? 2 : 1 });
  if (ch !== 'd')
    for (let i = 0; i < 2; i++) particle(sparksU, { x: cxp, y: cyp, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 50, life: 0.18, color: 0xffd080 });
  const d = (damage.get(`${cx},${cy}`) || 0) + (player ? 1 : 0.35);
  if (ORE[ch] && (player || Math.random() < 0.45)) orePopup(ORE[ch], cxp, cyp - 4, 1);
  if (d >= hp - 1e-6) breakTile(cx, cy, ch, player);
  else damage.set(`${cx},${cy}`, d);
  drawCracks();
  return true;
}

function breakTile(cx, cy, ch, player) {
  damage.delete(`${cx},${cy}`);
  grid[cy - GY / T][cx - GX / T] = '.';
  removeTile(cx, cy);
  placeTile(cx, cy);                                     // 판 자리는 갱도 타일로
  sfx('break', !player);
  const cols = DEBRIS[ch], x0 = cx * T, y0 = cy * T;
  for (let i = 0; i < 14; i++)
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.7 + Math.random() * 0.4, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.4 ? 2 : 1 });
  for (let i = 0; i < 8; i++)                            // 먼지 구름
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 30, vy: -8 - Math.random() * 10, life: 1.2, color: 0x8a7a6a, g: 0, drag: 1.5, size: 2 });
  if (ORE[ch]) orePopup(ORE[ch], x0 + 8, y0 + 4, 3);
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
    particle(sparksU, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.8 + Math.random() * 0.6, color: [0xfff4b8, 0xf5cf6a, 0xffffff][i % 3], g: 60, size: Math.random() < 0.3 ? 2 : 1 });
  }
  const el = document.createElement('div');
  el.className = 'daebak'; el.textContent = '대박!';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ---------------------------------------------------------------- 카메라 · 화면 크기 (칸 = 화면 높이 / 9)
const cam = { x: 0, y: GY + 6 * T + 8 - VIEW_H / 2 };
let viewW = WW, px = 4, cssScale = 2, offX = 0, offY = 0;
let albedoRT, normalRT, litRT, finalRT, lightPass, postPass;
const display = new Sprite();
app.stage.addChild(display);

function layout() {
  const dpr = R.resolution, dw = window.innerWidth * dpr, dh = window.innerHeight * dpr;
  px = Math.min(dh / VIEW_H, dw / 160);                  // 세로 9칸이 화면을 꽉 채운다
  viewW = Math.max(160, Math.min(WW, Math.floor(dw / px)));
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
  const mode = Math.hypot(wx - lantern.x, wy - (lantern.y + 4)) < 12 ? 'lantern' : 'maybe';
  drag = { id: e.pointerId, mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
  app.canvas.setPointerCapture(e.pointerId);
});
app.canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.lx) / cssScale, dy = (e.clientY - drag.ly) / cssScale;
  drag.lx = e.clientX; drag.ly = e.clientY;
  if (drag.mode === 'maybe' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.mode = 'pan';
  if (drag.mode === 'pan') { cam.x -= dx; cam.y -= dy; clampCam(); }
  if (drag.mode === 'lantern') {
    lantern.x = Math.max(GX + 4, Math.min(WW - GX - 4, lantern.x + dx));
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
function bump(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

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
      stash[kind] += n; counter[kind].textContent = stash[kind]; bump(counter[kind].parentElement); sfx('stash', true);
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
$('ref-shaft').src = A('scenes/shaft_night.png');
$('ref-office').src = A('scenes/office_night.png');
$('miner-face').src = `${import.meta.env.BASE_URL}assets/portraits/miner_red.png`;
$('btn-full').onclick = async () => {
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.('landscape');
  } catch {}
};
const minerCard = $('miner-card'), minerState = $('miner-state');

// ---------------------------------------------------------------- 매 프레임
let time = 0, fpsT = 0, fpsN = 0;
const lights = [];
function addLight(x, y, z, r, color, power) { if (lights.length < MAX_LIGHTS) lights.push([x, y, z, r, color, power]); }
const flick = (t, seed) => 0.55 * Math.sin(t * 9 + seed) + 0.3 * Math.sin(t * 23 + seed * 2) + 0.15 * Math.sin(t * 41 + seed * 3);
const NAMES = { d: '흙', r: '바위', h: '단단한 바위', C: '구리', s: '은', g: '금맥', c: '발광 광석', j: '보석' };

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
  const floorY = GY + miner.gy * T + T - 15;
  if (miner.walking > 0) {
    miner.walking = Math.max(0, miner.walking - dt / 0.9);
    miner.x = miner.to + (miner.from - miner.to) * miner.walking;
    minerS.texture = F.miner_red[0];
    minerS.y = floorY - (Math.floor(time * 8) % 2);
  } else {
    const tgt = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy);
    const floor = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy + 1);
    if (!isSolid(tgt) && isSolid(floor) && miner.gx + 1 < GW) {
      miner.from = miner.x; miner.gx++; miner.to = minerX(miner.gx); miner.walking = 1;
      minerState.textContent = '걸어 들어가는 중';
    } else if (isSolid(tgt) && HP[tgt]) {
      const prev = miner.frame;
      miner.t += dt; miner.frame = Math.floor(miner.t / 0.15) % 4;
      if (miner.frame === 2 && prev !== 2) {
        hitTile(GX / T + miner.gx + 1, GY / T + miner.gy, 'miner');
        bump(minerCard);
        minerState.textContent = `${NAMES[tgt] ?? '바위'} 캐는 중`;
      }
      minerS.texture = F.miner_red[miner.frame];
    } else { minerS.texture = F.miner_red[0]; minerState.textContent = '쉬는 중'; }
    minerS.y = floorY;
  }
  minerS.x = Math.round(miner.x);
  const head = [minerS.x + 6, minerS.y + 1];

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
        orePopup('ore', ROUTE[cart.seg][0], ROUTE[cart.seg][1] - 14, 5);
      } else if (tag === 'load') { cart.wait = 1.4; cart.full = true; cart.dir = 1; }
    }
    const p = ROUTE[cart.seg], q = ROUTE[Math.max(0, Math.min(ROUTE.length - 1, cart.seg + cart.dir))];
    cart.x = p[0] + (q[0] - p[0]) * cart.t; cart.y = p[1] + (q[1] - p[1]) * cart.t;
    if (!vertical) {
      cart.spark -= dt;
      if (cart.spark <= 0) {
        cart.spark = 0.06 + Math.random() * 0.06;
        const back = Math.sign(a[0] - b[0]);
        for (const wx of [-5, 5]) particle(sparksU, { x: cart.x + wx, y: cart.y - 1, vx: back * (20 + Math.random() * 40), vy: -20 - Math.random() * 30, life: 0.2, color: Math.random() < 0.5 ? 0xffd080 : 0xe8702e });
        particle(dustA, { x: cart.x - back * 9, y: cart.y - 2, vx: back * 8, vy: -6, life: 0.8, color: 0x8a7a6a, g: 0, drag: 1.2, size: 2 });
      }
    }
  }
  cartS.texture = tex(cart.full ? 'cart' : 'cart_empty');
  cartS.position.set(Math.round(cart.x), Math.round(cart.y));
  cartS.tint = cart.y < GY ? 0xe0a890 : 0xffffff;
  cable.clear();
  const inShaft2 = Math.abs(cart.x - (GX + 2 * T + 8)) < 1 && cart.y < railY(4) - 1;
  const inShaft7 = Math.abs(cart.x - (GX + 7 * T + 8)) < 1 && cart.y > railY(4) + 1 && cart.y < railY(8);
  if (inShaft2) cable.moveTo(SHAFT_TOP_X, 9).lineTo(cart.x + 4, cart.y - 13).stroke({ width: 1, color: 0x3d3a4c });
  if (inShaft7) cable.moveTo(cart.x + 4, GY + 4 * T).lineTo(cart.x + 4, cart.y - 13).stroke({ width: 1, color: 0x3d3a4c });

  // 랜턴: 진자 흔들림
  if (!drag || drag.mode !== 'lantern') lantern.vel += -Math.sin(lantern.ang) * 18 * dt;
  lantern.vel *= 1 - 1.4 * dt;
  lantern.ang = Math.max(-0.9, Math.min(0.9, lantern.ang + lantern.vel * dt + Math.sin(time * 1.3) * 0.0006));
  const lfr = F.lantern[Math.floor(time * 5) % F.lantern.length];
  lanternS.texture = lfr;
  lanternS.position.set(Math.round(lantern.x), Math.round(lantern.y));
  lanternS.rotation = lantern.ang;
  const [lfx, lfy] = lanternFlame();

  // 광석: 금 쉬머 · 발광 광석 맥동
  for (const s of shimmerA.children) {
    const t = (time + s.phase) % 2.6;
    s.visible = t < 1;
    if (s.visible) s.texture = F.gold_shimmer[Math.min(11, Math.floor(t * 12))];
  }
  let gxs = 0, gys = 0;
  for (const t of glowTiles) {
    const f = (Math.floor(time * 6) + t.a.phase) % 12;
    t.a.texture = F.ore_glow[f];
    t.extra[0].alpha = t.extra[0].baseAlpha * (0.6 + 0.4 * Math.sin((f / 12) * Math.PI * 2));
    gxs += t.cx * T + 8; gys += t.cy * T + 8;
  }

  // 빛 목록
  lights.length = 0;
  const lf = flick(time, 0);
  addLight(lfx, lfy, 10, LANTERN_R * (1 + 0.03 * lf), [1.0, 0.72, 0.46], LANTERN_POWER * (1 + 0.06 * lf));
  for (const w of wallLamps) {
    const f = flick(time, w.seed);
    w.s.texture = F.lantern[Math.floor(time * 5 + w.seed) % F.lantern.length];
    addLight(w.x, w.y, 8, 72 * (1 + 0.03 * f), [1.0, 0.78, 0.52], 1.2 * (1 + 0.06 * f));
    w.halo.position.set(w.x, w.y); w.halo.alpha = w.halo.baseAlpha * (1 + 0.15 * f);
  }
  addLight(head[0] + 8, head[1] + 4, 6, 40, [1.0, 0.94, 0.68], 1.1);
  const gn = glowTiles.length;
  if (gn) addLight(gxs / gn, gys / gn, -8, 40 + gn * 5, [0.42, 0.88, 0.85], 0.95 + 0.25 * Math.sin(time * 2.2));
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
  if (Math.random() < (low ? 0.08 : 0.3)) {
    const x = GX + Math.random() * GW * T, y = cam.y + Math.random() * VIEW_H;
    if (!isSolid(cellAt(Math.floor(x / T), Math.floor(y / T))) && y > GY)
      particle(dustA, { x, y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2, life: 3 + Math.random() * 2, color: 0xc8b8a0, g: 0 });
  }
  updateParticles(dt);

  // 카메라 · 흔들림 · 패럴랙스 (월드에 놓인 겹: tilePosition = cam × (1 - 배율))
  let sx = 0, sy = 0;
  if (shake > 0) { shake -= real; sx = Math.round((Math.random() * 2 - 1) * shakeAmp); sy = Math.round((Math.random() * 2 - 1) * shakeAmp); }
  const cx = Math.round(cam.x) + sx, cy = Math.round(cam.y) + sy;
  for (const w of [wA, wN, wU]) w.position.set(-cx, -cy);
  for (const s of farA) s.tilePosition.y = Math.round(cy * 0.8);
  for (const s of midA) s.tilePosition.y = Math.round(cy * 0.5);
  for (const s of fgSides) s.tilePosition.y = Math.round(-cy * 0.3);
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
  pu.uBand = TILT_BAND;
  pu.uGrid = [(GX - cx) / viewW, (GY - cy) / VIEW_H, (GX + GW * T - cx) / viewW, (GY + GH * T - cy) / VIEW_H];
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
