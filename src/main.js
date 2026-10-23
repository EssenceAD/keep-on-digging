// 「용사님, 채굴하실게요~」 HD-2D 비주얼 프로토타입 v0.3
// 갱도 격자 12×16 + 런타임 랜턴 조명(노멀맵) + 광부 + 광차 + 광맥 + 곡괭이 주스 + 패럴랙스 3겹 + 틸트 시프트 + 저사양 토글
// 세로 기본 반응형(§6-1): 세로 = 칸 너비/12, 격자 16줄이 한 화면 + 위 HUD · 아래 시트 / 패드·PC 가로 = 칸 min(너비/12, 높이/18) + 좌우 패널
// 타일·소품: 형철 초안 art/shaft.px.js · UI: art/ui/ui.px.js (9-slice) · 초상은 UI 틀 안에서만(§5-1-3)
import 'galmuri/dist/galmuri.css';
import './style.css';
import {
  Application, Assets, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture,
  TextureSource, TilingSprite,
} from 'pixi.js';
import { MAX_LIGHTS, makeLightPass, makePostPass } from './gl.js';
import { sfx, setSound, soundOn, unlockAudio } from './sound.js';
import { COLOR, bar, button, frame, icon, kit, label, loadUI, portraitFrame, setTextRes, tab } from './ui.js';
import { BUYERS, ORES, createMarket } from './market.js';

TextureSource.defaultOptions.scaleMode = 'nearest';
const VERSION = 'v0.3';

// ---------------------------------------------------------------- 세계
const T = 16, GW = 12, GH = 16;
const SIDE = 2;                           // 격자 양옆 패럴랙스 바위 칸 수 (가로 화면에서 보인다)
const GX = SIDE * T, GY = 48;             // 구획(격자) 왼쪽 위 (지상 띠 48px = 3칸)
const WW = GX * 2 + GW * T;               // 256
const WH = GY + GH * T + T;               // 320 (격자 아래 암반 1줄)
const COLS = WW / T, ROWS = WH / T;
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
const ORE_KEYS = new Set(ORES.map((o) => o.key));
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

// ---------------------------------------------------------------- 시작
const app = new Application();
await app.init({
  preference: 'webgl', background: '#0b0910', antialias: false,
  resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, resizeTo: window,
});
document.getElementById('stage').appendChild(app.canvas);
const R = app.renderer;
const BASE = import.meta.env.BASE_URL;

const A = (p) => `${BASE}art/${p}`;
const SPRITES = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'gem',
  'tunnel', 'tunnel_beam', 'rail', 'cart', 'cart_empty', 'stalactite', 'mushroom', 'side_far', 'side_mid', 'side_fg',
  'sky_far', 'deep_far', 'deep_mid', 'deep_fg', 'bubble_dig', 'bubble_walk', 'bubble_rest',
  'icon_gold', 'icon_glow', 'icon_silver', 'icon_copper', 'icon_gem'];
const NORMALS = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver'];
const ANIMS = ['ore_glow', 'gold_shimmer', 'lantern', 'miner_red'];
const PORTRAITS = ['miner_red', 'brok', 'merchant'];
const urls = [
  ...SPRITES.map((n) => A(`sprites/${n}.png`)), ...NORMALS.map((n) => A(`sprites/${n}_n.png`)),
  ...ANIMS.flatMap((n) => [A(`anims/${n}.png`), A(`anims/${n}.json`)]), A('scenes/surface.png'),
  ...PORTRAITS.map((n) => `${BASE}assets/portraits/${n}.png`),
];
const [loaded] = await Promise.all([Assets.load(urls), loadUI(BASE)]);
const tex = (n) => loaded[A(`sprites/${n}.png`)];
const ntex = (n) => loaded[A(`sprites/${n}_n.png`)];
const portrait = (n) => loaded[`${BASE}assets/portraits/${n}.png`];
function frames(n) {
  const base = loaded[A(`anims/${n}.png`)], json = loaded[A(`anims/${n}.json`)];
  const raw = json.data?.frames ?? json.frames;   // Pixi가 JSON을 스프라이트시트로 읽으면 .data에 원본이 있다
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list.map((f) => new Texture({ source: base.source, frame: new Rectangle(f.frame.x, f.frame.y, f.frame.w, f.frame.h) }));
}
const F = Object.fromEntries(ANIMS.map((n) => [n, frames(n)]));
const ICON = { g: 'icon_gold', c: 'icon_glow', s: 'icon_silver', C: 'icon_copper', j: 'icon_gem' };
document.getElementById('loading')?.remove();

// ---------------------------------------------------------------- 세 갈래 장면: 알베도 · 노멀 · 조명 뒤(발광)
const wA = new Container();   // 색 (조명 받음)
const wN = new Container();   // 노멀 (알파 0 = 조명 안 받음)
const wU = new Container();   // 조명 뒤에 그리는 것: 발광체 · 헤일로 · 불꽃 · 앞 겹 · 말풍선

// 패럴랙스 겹 하나 = 월드에 놓인 TilingSprite. 배율 f: tilePosition = cam × (1 - f)
const layers = [];
function para(name, parent, x, y, w, h, f, { flip = false, tint } = {}) {
  const s = new TilingSprite({ texture: tex(name), width: w, height: h });
  s.position.set(flip ? x + w : x, y);
  if (flip) s.scale.x = -1;
  if (tint) s.tint = tint;
  parent.addChild(s);
  layers.push({ s, f, ox: 0, oy: 0 });
  return s;
}
// 위: 지상 위로 이어지는 밤하늘(0.2) — 세로 화면 위 HUD 뒤를 채운다
para('sky_far', wA, -320, -240, WW + 640, 240 + GY, 0.2);
wA.addChild(new Sprite(loaded[A('scenes/surface.png')]));   // 지상: pxl이 구운 조명 그대로 (런타임 비용 0)
// 아래: 깊은 어둠 — 먼 자갈 0.2 · 석순 0.5 (조명 받지 않는 어두운 그림)
para('deep_far', wA, -320, WH - 8, WW + 640, 300, 0.2);
para('deep_mid', wA, -320, WH + 4, WW + 640, 64, 0.5);
// 좌우: 격자 양옆 2칸 (가로 화면) — 먼 바위 0.2 · 중간 0.5
for (const [n, f] of [['side_far', 0.2], ['side_mid', 0.5]]) {
  para(n, wA, 0, GY, GX, WH - GY, f);
  para(n, wA, WW - GX, GY, GX, WH - GY, f, { flip: true });
}
wN.addChild(new Graphics().rect(GX, GY, GW * T, WH - GY).fill(0x8080ff));   // 조명 받는 곳: 격자(+맨 아래 암반)
wN.addChild(new Graphics().rect(0, GY, GX, WH - GY).fill(0x8080ff).rect(WW - GX, GY, GX, WH - GY).fill(0x8080ff));

const tilesA = new Container(), tilesN = new Container();
const shimmerA = new Container(), crackG = new Graphics(), edgeA = new Graphics(), edgeN = new Graphics();
const propsA = new Container(), propsN = new Container(), dustA = new Container();
wA.addChild(tilesA, shimmerA, crackG, edgeA, propsA, dustA);
wN.addChild(tilesN, edgeN, propsN);

const lampsU = new Container(), halosU = new Container(), sparksU = new Container(), fgU = new Container();
wU.addChild(lampsU, halosU, sparksU, fgU);
// 앞 겹 1.3: 초점 밖 실루엣 (좌우 종유석 · 맨 아래 바위)
for (const [x, flip] of [[0, false], [WW - GX, true]]) para('side_fg', fgU, x, GY, GX, WH - GY, 1.3, { flip, tint: 0x2a2232 });
para('deep_fg', fgU, -320, WH + 30, WW + 640, 32, 1.3, { tint: 0x2a2232 });

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
    const h = halo(0x6fe0d8, 30, 0.22); h.position.set(cx * T + 8, cy * T + 8);
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

// ---------------------------------------------------------------- 붉은 수염 광부 (갱도 안은 pxl 스프라이트 + 머리 위 말풍선)
const miner = { gx: 8, gy: 8, x: 0, t: 0, frame: 0, walking: 0, from: 0, to: 0, state: 'dig', target: 'g' };
const minerX = (gx) => GX + gx * T + 1;
miner.x = minerX(miner.gx);
const minerS = new Sprite(F.miner_red[0]); propsA.addChild(minerS);
const bubble = new Sprite(tex('bubble_dig')); lampsU.addChild(bubble);
const headHalo = halo(0xfff0a0, 8, 0.6);

// ---------------------------------------------------------------- 광차: 금맥 앞 → 수직갱 → 지상 창고 왕복
const railY = (gy) => GY + gy * T + 14;
const ROUTE = [
  [GX + 7 * T + 8, railY(8), 'load'], [GX + 7 * T + 8, railY(4), 'lift'], [GX + 2 * T + 8, railY(4)],
  [GX + 2 * T + 8, 39, 'lift'], [190, 39, 'unload'],
];
const cart = { seg: 0, dir: 1, t: 0, wait: 1.2, x: ROUTE[0][0], y: ROUTE[0][1], full: true, spark: 0, moving: false, trips: 0 };
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

// ---------------------------------------------------------------- 창고 · 시세
const stash = Object.fromEntries(ORES.map((o) => [o.key, 0]));
let coins = 0;
const market = createMarket();

// ---------------------------------------------------------------- 주스
let shake = 0, shakeAmp = 0, hitstop = 0, slowmo = 0, flash = 0, boom = null, boomed = false;

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
  if (ORE_KEYS.has(ch) && (player || Math.random() < 0.45)) orePopup(ch, cxp, cyp - 4, 1);
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
  if (ORE_KEYS.has(ch)) orePopup(ch, x0 + 8, y0 + 4, 3);
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

// ---------------------------------------------------------------- 레이아웃 (§6-1)
// L: CSS px 기준. cell = 한 칸의 화면 크기, sc = 장면 1px의 화면 크기, uiS = UI 1px의 화면 크기(정수)
let L = null;
const cam = { x: 0, y: 0, pan: 0, lean: 0 };
let viewW = 192, viewH = 400;
let albedoRT, normalRT, litRT, finalRT, lightPass, postPass;
const display = new Sprite();
const uiRoot = new Container();
app.stage.addChild(display, uiRoot);

function computeLayout() {
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = R.resolution;
  let portraitMode = H >= W * 0.9;
  let cell, uiS, gridLeft, gridTop, panels;
  if (!portraitMode) {
    uiS = Math.max(2, Math.min(4, Math.floor(H / 260)));
    const panelMin = 128 * uiS;                                     // 좌우 패널 최소 폭
    cell = Math.min(W / 12, H / 18, (W - 2 * panelMin) / 12);
    if (cell < 14) portraitMode = true;                             // 패널 둘 자리가 없으면 세로 배치
    else {
      gridLeft = (W - 12 * cell) / 2;
      gridTop = (H - 18 * cell) / 2 + 2 * cell;
      const pad = 2 * uiS;
      panels = {
        left: { x: pad, y: pad, w: gridLeft - 2 * pad, h: H - 2 * pad },
        right: { x: W - gridLeft + pad, y: pad, w: gridLeft - 2 * pad, h: H - 2 * pad },
      };
    }
  }
  if (portraitMode) {
    // 세로: 칸 = 너비/12 (폰). 패드처럼 세로가 모자라면 칸 = (높이 - HUD - 시트)/17 → 격자 16줄 + 지상 1줄 이상, 남는 양옆엔 패럴랙스 바위
    uiS = Math.max(2, Math.min(3, Math.floor(W / 195)));
    const hudH = 36 * uiS, sheetMin = 84 * uiS;
    cell = Math.min(W / 12, (H - hudH - sheetMin) / 17);
    gridLeft = (W - 12 * cell) / 2;
    const above = Math.max(0, Math.min(3 * cell, H - hudH - sheetMin - 16 * cell));
    gridTop = hudH + above;
    const sheetH = H - gridTop - 16 * cell;
    panels = { hud: { x: 0, y: 0, w: W, h: hudH }, sheet: { x: 0, y: H - sheetH, w: W, h: sheetH } };
  }
  const sc = cell / T;
  // 격자 아래가 시트에 가리면 그만큼 위아래로 끌어 볼 수 있다
  const visBottom = portraitMode ? panels.sheet.y : H;
  const overflow = Math.max(0, gridTop + 16 * cell - visBottom) / sc;
  return { W, H, dpr, portrait: portraitMode, cell, sc, uiS, gridLeft, gridTop, panels, overflow };
}

function layout() {
  L = computeLayout();
  viewW = Math.ceil(L.W / L.sc) + 1; viewH = Math.ceil(L.H / L.sc) + 1;
  for (const rt of [albedoRT, normalRT, litRT, finalRT]) rt?.destroy(true);
  lightPass?.destroy(); postPass?.destroy();
  const mk = (scaleMode) => RenderTexture.create({ width: viewW, height: viewH, resolution: 1, scaleMode });
  albedoRT = mk('nearest'); normalRT = mk('nearest'); litRT = mk('linear'); finalRT = mk('nearest');
  lightPass = makeLightPass(albedoRT, normalRT, solidTex);
  postPass = makePostPass(litRT);
  lightPass.scale.set(viewW, viewH); postPass.scale.set(viewW, viewH);
  display.texture = finalRT;
  display.scale.set(L.sc);
  // 장면 1px 경계에 맞추고, 남는 소수는 화면 위치로 흡수
  cam.x0 = GX - L.gridLeft / L.sc; cam.y0 = GY - L.gridTop / L.sc;
  display.position.set(-(cam.x0 - Math.floor(cam.x0)) * L.sc, -(cam.y0 - Math.floor(cam.y0)) * L.sc);
  cam.pan = Math.max(-24, Math.min(L.overflow + 24, cam.pan));
  setTextRes(L.uiS * L.dpr);
  buildUI();
}
window.addEventListener('resize', () => setTimeout(layout, 60));

const toWorld = (sx, sy) => [(sx - display.x) / L.sc + Math.floor(cam.x), (sy - display.y) / L.sc + Math.floor(cam.y)];
const toScreen = (x, y) => [display.x + (x - Math.floor(cam.x)) * L.sc, display.y + (y - Math.floor(cam.y)) * L.sc];
const inPanels = (sx, sy) => Object.values(L.panels).some((p) => sx >= p.x && sx < p.x + p.w && sy >= p.y && sy < p.y + p.h);

// ---------------------------------------------------------------- UI (art/ui/ui.px.js 틀)
let ui = {};                  // 현재 화면의 UI 참조 (레이아웃이 바뀌면 다시 만든다)
let sheetTab = 'sell', sellSel = 'g';

function buildUI() {
  uiRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
  uiRoot.scale.set(L.uiS);
  ui = { counters: {}, rows: {} };
  const u = (v) => Math.round(v / L.uiS);             // CSS px → UI px
  if (L.portrait) {
    const hud = L.panels.hud, sheet = L.panels.sheet;
    uiRoot.addChild(makeHud(u(hud.w), u(hud.h)));
    const s = new Container(); s.y = u(sheet.y);
    const sw = u(sheet.w), sh = u(L.H) - u(sheet.y);
    s.addChild(frame('stone', sw, sh + 6, 'panel'));             // 아래 모서리는 화면 밖으로
    const tabs = [['sell', '판매'], ['miner', '광부'], ['set', '설정']];
    const tw = Math.floor((sw - 12) / 3);
    const body = new Container(); body.position.set(5, 19);
    const bw = sw - 10, bh = sh - 23;
    const show = (key) => {
      sheetTab = key;
      ui.tabs.forEach((t) => t.setOn(t.key === key));
      body.removeChildren().forEach((c) => c.destroy({ children: true }));
      ui.rows = {};
      for (const k of ['cargo', 'minerState', 'trips', 'fps', 'buyerFace', 'buyerName', 'minerFace']) ui[k] = null;   // 탭이 바뀌면 이전 화면 참조 버림
      body.addChild(key === 'sell' ? makeSell(bw, bh) : key === 'miner' ? makeMiner(bw, bh, 'stone') : makeSettings(bw, bh));
      refreshUI();
    };
    ui.tabs = tabs.map(([key, name], i) => {
      const t = tab(tw, name, () => { sfx('stash', true); show(key); });
      t.key = key; t.position.set(6 + i * tw, 4); s.addChild(t);
      if (key === 'sell') ui.sellAnchor = t;
      return t;
    });
    s.addChild(body);
    uiRoot.addChild(s);
    show(sheetTab);
  } else {
    const { left, right } = L.panels;
    const lc = new Container(); lc.position.set(u(left.x), u(left.y));
    const lw = u(left.w), lh = u(left.h);
    const hud = makeHud(lw, 36); lc.addChild(hud);   // 패널 폭이 좁으면 두 줄
    const mh = 74;
    const mf = frame('wood', lw, mh); mf.y = 38; lc.addChild(mf);
    const m = makeMiner(lw - 10, mh - 10, 'wood'); m.position.set(5, 43); lc.addChild(m);
    const sf = frame('stone', lw, lh - 38 - mh - 2, 'panel'); sf.y = 38 + mh + 2; lc.addChild(sf);
    const st = makeSettings(lw - 10, lh - 38 - mh - 12); st.position.set(5, sf.y + 5); lc.addChild(st);
    uiRoot.addChild(lc);
    const rc = new Container(); rc.position.set(u(right.x), u(right.y));
    rc.addChild(makeSell(u(right.w), u(right.h)));
    uiRoot.addChild(rc);
  }
  // 토스트 (양피지 패널)
  ui.toast = new Container(); ui.toast.visible = false; uiRoot.addChild(ui.toast);
  refreshUI();
}

function makeHud(w, h) {
  const c = new Container();
  c.addChild(frame('wood', w, h));
  // 넓으면 한 줄(제목 왼쪽 · 숫자 오른쪽), 좁으면 두 줄(제목 위 · 숫자 아래)
  const wide = w >= 240;
  const t1 = label('돌망치 상회', { color: COLOR.gold }); t1.position.set(7, 4);
  c.addChild(t1);
  if (!wide && w - t1.width > 70) { const t2 = label('뒷산 1구획', { small: true, color: COLOR.dim }); t2.position.set(Math.round(t1.width) + 12, 6); c.addChild(t2); }
  if (wide) { const t2 = label(`뒷산 1구획 · ${VERSION}`, { small: true, color: COLOR.dim }); t2.position.set(7, 17); c.addChild(t2); }
  const cy = wide ? Math.round((h - 14) / 2) : 18;
  const items = [['coin', kit('coin')], ['g', tex('icon_gold')], ['c', tex('icon_glow')]];
  const slot = wide ? 34 : Math.floor((w - 14) / 3);
  items.forEach(([key, tx], k) => {
    const i = icon(tx), n = label('0');
    const x0 = wide ? w - 8 - (items.length - k) * slot : 7 + k * slot;
    i.position.set(x0, cy + Math.round((14 - i.height) / 2));
    n.position.set(x0 + i.width + 3, cy);
    c.addChild(i, n);
    ui.counters[key] = n;
  });
  return c;
}

function makeSell(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));   // win_paper는 가운데 얼룩 점이 9-slice로 늘어나 선이 돼서 무지 패널을 쓴다
  const compact = h < 110;
  const pf = portraitFrame(portrait(ORES.find((o) => o.key === sellSel).buyer), 52, 'wood');
  pf.position.set(5, 5); c.addChild(pf);
  ui.buyerFace = pf;
  let rowsX = 62, rowsY = 6, rowW = w - rowsX - 6;
  if (!compact) {
    const head = label('', { color: COLOR.paperInk, shadow: false }); head.position.set(62, 8); c.addChild(head);
    const sub = label('시세는 10초마다 바뀌어요', { small: true, color: 0x8a7a68, shadow: false }); sub.position.set(62, 24); c.addChild(sub);
    ui.buyerName = head;
    rowsX = 6; rowsY = 62; rowW = w - 12;
  }
  const rowH = 17;
  const maxRows = Math.max(1, Math.floor((h - rowsY - (compact ? 4 : 26)) / rowH));
  const list = ORES.slice(0, maxRows);
  list.forEach((o, i) => {
    const r = new Container(); r.position.set(rowsX, rowsY + i * rowH);
    const bg = new Graphics(); r.addChild(bg);
    const ic = icon(tex(ICON[o.key])); ic.position.set(2, Math.round((14 - ic.height) / 2) + 1); r.addChild(ic);
    let x = 14;
    if (!compact) { const nm = label(o.name, { color: COLOR.paperInk, shadow: false, small: true }); nm.position.set(x, 3); r.addChild(nm); x += 38; }
    const qty = label('×0', { color: COLOR.paperInk, shadow: false, small: true }); qty.position.set(x, 3); r.addChild(qty); x += 24;
    const price = label('0', { color: COLOR.paperInk, shadow: false, small: true }); price.position.set(x, 3); r.addChild(price); x += 18;
    const arrow = icon(kit('arrow_up')); arrow.position.set(x, 4); r.addChild(arrow); x += 10;
    const spark = new Graphics(); spark.position.set(x, 2); r.addChild(spark);
    const btn = button('paper', 30, 14, '팔기', () => sell(o.key, 1), { small: true });
    btn.position.set(rowW - 31, 0); r.addChild(btn);
    bg.eventMode = 'static'; bg.cursor = 'pointer';                 // 줄을 누르면 그 광종의 매입자 초상으로 (부모에 hitArea를 두면 팔기 버튼이 안 눌린다)
    bg.hitArea = new Rectangle(0, 0, rowW - 33, 15);
    bg.on('pointertap', () => { sellSel = o.key; refreshUI(); });
    ui.rows[o.key] = { r, bg, qty, price, arrow, spark, btn, w: rowW, sparkW: Math.max(0, rowW - 33 - x - 2) };
    c.addChild(r);
  });
  if (!compact) {
    const all = button('paper', 64, 16, '전부 팔기', () => ORES.forEach((o) => sell(o.key, 1)));
    all.position.set(w - 70, h - 22); c.addChild(all);
    const half = button('paper', 50, 16, '절반', () => ORES.forEach((o) => sell(o.key, 0.5)));
    half.position.set(w - 124, h - 22); c.addChild(half);
  }
  ui.sellAnchor ??= c;
  return c;
}

function makeMiner(w, h, style) {
  const c = new Container();
  const pf = portraitFrame(portrait('miner_red'), 52, style === 'wood' ? 'wood' : 'stone');
  c.addChild(pf);
  ui.minerFace = pf;
  const name = label('붉은 수염', { color: 0xe8823a }); name.position.set(58, 2);
  const role = label('· 광부', { small: true, color: COLOR.dim }); role.position.set(58 + Math.round(name.width) + 3, 4);
  role.visible = 58 + name.width + 3 + role.width <= w;
  const state = label('', { small: true }); state.position.set(58, 17);
  const cargo = bar(Math.max(30, Math.min(80, w - 60))); cargo.position.set(58, 32);
  const trips = label('', { small: true, color: COLOR.dim }); trips.position.set(58, 41);
  c.addChild(name, role, state, cargo, trips);
  ui.minerState = state; ui.cargo = cargo; ui.trips = trips;
  return c;
}

function makeSettings(w) {
  const c = new Container();
  const items = [
    ['대박 연출', () => { unlockAudio(); bigVein(GX + 9 * T + 8, GY + 9 * T + 8); }],
    ['pxl 기준컷', () => document.getElementById('ref').classList.add('show')],
    [() => `저사양 ${low ? '켬' : '끔'}`, () => setLow(!low)],
    [() => `소리 ${soundOn() ? '켬' : '끔'}`, () => { unlockAudio(); setSound(!soundOn()); }],
    ['전체 화면', () => document.documentElement.requestFullscreen?.().catch(() => {})],
  ];
  const cols = Math.max(2, Math.min(3, Math.floor((w + 4) / 62))), bw = Math.floor((w - (cols - 1) * 4) / cols), bh = 16;
  items.forEach(([text, fn], i) => {
    const b = button('stone', bw, bh, typeof text === 'function' ? text() : text, () => { fn(); if (typeof text === 'function') b.setText(text()); }, { small: true });
    b.position.set((i % cols) * (bw + 4), Math.floor(i / cols) * (bh + 4));
    c.addChild(b);
  });
  const fps = label('', { small: true, color: 0x9cc45a }); fps.position.set(0, Math.ceil(items.length / cols) * (bh + 4) + 2);
  c.addChild(fps); ui.fps = fps;
  return c;
}

function refreshUI() {
  if (!ui.counters) return;
  ui.counters.coin && (ui.counters.coin.text = String(coins));
  ui.counters.g && (ui.counters.g.text = String(stash.g));
  ui.counters.c && (ui.counters.c.text = String(stash.c));
  const sel = ORES.find((o) => o.key === sellSel);
  ui.buyerFace?.setTexture(portrait(sel.buyer));
  if (ui.buyerName) ui.buyerName.text = `${BUYERS[sel.buyer]} · ${sel.name}`;
  for (const [key, r] of Object.entries(ui.rows)) {
    r.qty.text = `×${stash[key]}`;
    r.price.text = String(market.price[key]);
    const up = market.last[key];
    r.arrow.texture = kit(up < 0 ? 'arrow_down' : 'arrow_up'); r.arrow.visible = up !== 0;
    r.btn.setDisabled(stash[key] === 0);
    r.bg.clear(); if (key === sellSel) r.bg.rect(0, 0, r.w - 33, 15).fill({ color: 0xd39a3a, alpha: 0.25 });
    // 최근 2분: 막대 8개
    const hist = market.hist[key].slice(-8), max = Math.max(...hist), min = Math.min(...hist);
    r.spark.clear();
    if (r.sparkW >= 16) hist.forEach((v, i) => {
      const hh = 2 + Math.round(((v - min) / Math.max(1, max - min)) * 8);
      r.spark.rect(i * 2, 11 - hh, 1, hh).fill(i === 7 ? (up < 0 ? 0xb84a62 : 0x6a9a3a) : 0x8a7a68);
    });
  }
}

function sell(key, frac) {
  const n = Math.ceil(stash[key] * frac);
  if (!n) return;
  stash[key] -= n;
  const gain = n * market.price[key];
  sfx('stash');
  const r = ui.rows[key];
  const from = r ? r.btn.getGlobalPosition() : { x: L.W / 2, y: L.H / 2 };
  flyNumber('coin', from.x + 15 * L.uiS, from.y, gain, () => { coins += gain; refreshUI(); bumpCounter('coin'); });
  refreshUI();
}

function bumpCounter(key) {
  const n = ui.counters[key];
  if (!n) return;
  n.scale.set(1.3); n.tint = 0xfff4b8;
  setTimeout(() => { n.scale.set(1); n.tint = 0xffffff; }, 160);
}

// 광석 숫자: 튀어 올랐다가 HUD/판매 창으로 빨려 간다
function orePopup(kind, x, y, n) {
  sfx('ore');
  const [sx, sy] = toScreen(x, y);
  flyNumber(kind, sx, sy, n, () => { stash[kind] += n; refreshUI(); bumpCounter(kind); sfx('stash', true); });
}
function flyNumber(kind, sx, sy, n, done) {
  const el = document.createElement('div');
  el.className = `pop pop-${kind}`;
  el.innerHTML = `<i></i>+${n}`;
  document.body.appendChild(el);
  const target = ui.counters[kind] ?? ui.rows[kind]?.qty ?? ui.sellAnchor;
  const p = target ? target.getGlobalPosition() : { x: L.W / 2, y: 0 };
  const tx = p.x + (target?.width ?? 0) * L.uiS / 2, ty = p.y + 6 * L.uiS;
  const up = el.animate([
    { transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(0.6)`, opacity: 0.3 },
    { transform: `translate(${sx}px, ${sy - 22}px) translate(-50%, -50%) scale(1.25)`, opacity: 1, offset: 0.35 },
    { transform: `translate(${sx}px, ${sy - 18}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
  ], { duration: 380, easing: 'ease-out', fill: 'forwards' });
  up.onfinish = () => {
    const fly = el.animate([
      { transform: `translate(${sx}px, ${sy - 18}px) translate(-50%, -50%) scale(1)` },
      { transform: `translate(${(sx + tx) / 2 + 30}px, ${Math.min(sy, ty) - 30}px) translate(-50%, -50%) scale(0.9)`, offset: 0.45 },
      { transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(0.4)`, opacity: 0.6 },
    ], { duration: 460, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    fly.onfinish = () => { el.remove(); done(); };
  };
}

let toastTimer = 0;
function toast(msg) {
  const t = ui.toast;
  if (!t) return;
  t.removeChildren().forEach((c) => c.destroy());
  const tx = label(msg, { color: COLOR.paperInk, shadow: false, small: true });
  const w = Math.ceil(tx.width) + 16, h = 20;
  t.addChild(frame('paper', w, h, 'panel'), tx);
  tx.position.set(8, 5);
  const Wu = Math.round(L.W / L.uiS);
  const bottom = L.portrait ? Math.round(L.panels.sheet.y / L.uiS) - 4 : Math.round(L.H / L.uiS) - 8;
  t.position.set(Math.round((Wu - w) / 2), bottom - h);
  t.visible = true;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.visible = false; }, 1400);
}

function setLow(v) {
  low = v;
  try { localStorage.setItem('kod.low', v ? '1' : '0'); } catch {}
}
document.getElementById('ref').onclick = () => document.getElementById('ref').classList.remove('show');
document.getElementById('ref-shaft').src = A('scenes/shaft_night.png');
document.getElementById('ref-office').src = A('scenes/office_night.png');
market.onTick = () => {
  refreshUI();
  for (const [key, r] of Object.entries(ui.rows)) if (market.last[key] > 0) {      // 시세 상승: UI 펄스
    r.price.tint = 0x6a9a3a; r.arrow.scale.set(1.4); setTimeout(() => { r.price.tint = 0xffffff; r.arrow.scale.set(1); }, 400);
  }
};

layout();

// ---------------------------------------------------------------- 입력: 톡 = 곡괭이 · 랜턴 끌기 · 빈 곳 끌기 = 위아래 보기
let drag = null;
app.canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (inPanels(e.clientX, e.clientY)) return;              // UI 틀 위는 UI가 받는다
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  const mode = Math.hypot(wx - lantern.x, wy - (lantern.y + 4)) < 12 ? 'lantern' : 'maybe';
  drag = { id: e.pointerId, mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
});
app.canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.lx) / L.sc, dy = (e.clientY - drag.ly) / L.sc;
  drag.lx = e.clientX; drag.ly = e.clientY;
  if (drag.mode === 'maybe' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.mode = 'pan';
  if (drag.mode === 'pan') cam.pan = Math.max(-24, Math.min(L.overflow + 24, cam.pan - dy));
  if (drag.mode === 'lantern') {
    lantern.x = Math.max(GX + 4, Math.min(WW - GX - 4, lantern.x + dx));
    lantern.y = Math.max(GY + 2, Math.min(WH - 16, lantern.y + dy));
    lantern.vel -= dx * 0.05;
  }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'maybe') tap(...toWorld(e.clientX, e.clientY));
  drag = null;
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', () => { drag = null; });

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

// ---------------------------------------------------------------- 매 프레임
let time = 0, fpsT = 0, fpsN = 0, shotWaiter = null;
const lights = [];
function addLight(x, y, z, r, color, power) { if (lights.length < MAX_LIGHTS) lights.push([x, y, z, r, color, power]); }
const flick = (t, seed) => 0.55 * Math.sin(t * 9 + seed) + 0.3 * Math.sin(t * 23 + seed * 2) + 0.15 * Math.sin(t * 41 + seed * 3);
const NAMES = { d: '흙', r: '바위', h: '단단한 바위', C: '구리', s: '은', g: '금맥', c: '발광 광석', j: '보석' };

app.ticker.add((tk) => {
  const real = Math.min(tk.deltaMS / 1000, 0.05);
  fpsT += real; fpsN++;
  if (fpsT >= 0.5) { if (ui.fps) ui.fps.text = `${VERSION} · ${Math.round(fpsN / fpsT)} fps · ${L.portrait ? '세로' : '가로'} · 칸 ${Math.round(L.cell)}px`; fpsT = 0; fpsN = 0; }

  // 히트 스톱 · 슬로모
  let dt = real;
  if (hitstop > 0) { hitstop -= real; dt = 0; }
  if (slowmo > 0) { slowmo -= real; dt *= 0.25; }
  time += dt;
  market.update(dt);

  // 광부: 오른쪽 칸을 계속 캔다. 파내면 한 칸 걸어 들어간다
  const floorY = GY + miner.gy * T + T - 15;
  let state = miner.state;
  if (miner.walking > 0) {
    miner.walking = Math.max(0, miner.walking - dt / 0.9);
    miner.x = miner.to + (miner.from - miner.to) * miner.walking;
    minerS.texture = F.miner_red[0];
    minerS.y = floorY - (Math.floor(time * 8) % 2);
    state = 'walk';
  } else {
    const tgt = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy);
    const floor = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy + 1);
    if (!isSolid(tgt) && isSolid(floor) && miner.gx + 1 < GW) {
      miner.from = miner.x; miner.gx++; miner.to = minerX(miner.gx); miner.walking = 1; state = 'walk';
    } else if (isSolid(tgt) && HP[tgt]) {
      const prev = miner.frame;
      miner.t += dt; miner.frame = Math.floor(miner.t / 0.15) % 4;
      if (miner.frame === 2 && prev !== 2) hitTile(GX / T + miner.gx + 1, GY / T + miner.gy, 'miner');
      minerS.texture = F.miner_red[miner.frame];
      state = 'dig'; miner.target = tgt;
    } else { minerS.texture = F.miner_red[0]; state = 'rest'; }
    minerS.y = floorY;
  }
  if (state !== miner.state || (ui.minerState && !ui.minerState.text)) {
    miner.state = state;
    if (ui.minerState) ui.minerState.text = state === 'dig' ? `${NAMES[miner.target] ?? '바위'} 캐는 중` : state === 'walk' ? '걸어 들어가는 중' : '쉬는 중';
  }
  minerS.x = Math.round(miner.x);
  bubble.texture = tex(`bubble_${state}`);
  bubble.position.set(minerS.x + 3, minerS.y - 11 - (Math.floor(time * 2) % 2));
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
        cart.wait = 1.0; cart.full = false; cart.dir = -1; cart.trips++;
        orePopup('g', ROUTE[cart.seg][0], ROUTE[cart.seg][1] - 14, 2);
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
  if (ui.cargo) {
    const route = cart.seg + cart.t * cart.dir;
    ui.cargo.set(cart.full ? route / (ROUTE.length - 1) : 1 - route / (ROUTE.length - 1));
    const s = `광차 ${cart.trips}번 왕복`;
    if (ui.trips.text !== s) ui.trips.text = s;
  }

  // 랜턴: 진자 흔들림
  if (!drag || drag.mode !== 'lantern') lantern.vel += -Math.sin(lantern.ang) * 18 * dt;
  lantern.vel *= 1 - 1.4 * dt;
  lantern.ang = Math.max(-0.9, Math.min(0.9, lantern.ang + lantern.vel * dt + Math.sin(time * 1.3) * 0.0006));
  lanternS.texture = F.lantern[Math.floor(time * 5) % F.lantern.length];
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
    const x = GX + Math.random() * GW * T, y = GY + Math.random() * GH * T;
    if (!isSolid(cellAt(Math.floor(x / T), Math.floor(y / T))))
      particle(dustA, { x, y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2, life: 3 + Math.random() * 2, color: 0xc8b8a0, g: 0 });
  }
  updateParticles(dt);

  // 카메라: 기본 위치 + 끌어 보기 + 랜턴 쪽으로 살짝 기울기(→ 패럴랙스가 산다) · 흔들림
  const leanTarget = Math.max(-1, Math.min(1, (lantern.y - (GY + GH * T / 2)) / (GH * T / 2))) * 10;
  cam.lean += (leanTarget - cam.lean) * Math.min(1, dt * 2);
  cam.x = cam.x0; cam.y = cam.y0 + cam.pan + cam.lean;
  let sx = 0, sy = 0;
  if (shake > 0) { shake -= real; sx = Math.round((Math.random() * 2 - 1) * shakeAmp); sy = Math.round((Math.random() * 2 - 1) * shakeAmp); }
  const cx = Math.floor(cam.x) + sx, cy = Math.floor(cam.y) + sy;
  display.position.set(-(cam.x - Math.floor(cam.x)) * L.sc, -(cam.y - Math.floor(cam.y)) * L.sc);
  for (const w of [wA, wN, wU]) w.position.set(-cx, -cy);
  for (const p of layers) p.s.tilePosition.set(Math.round(cx * (1 - p.f)) * p.s.scale.x, Math.round(cy * (1 - p.f)));
  fgU.visible = !low;

  // 조명 합성 → 발광/헤일로 → 후처리
  const lu = lightPass.shader.resources.u.uniforms;
  lu.uView = [viewW, viewH]; lu.uCam = [cx, cy]; lu.uWorld = [WW, WH];
  lu.uAmbient = AMB_COLOR.map((v) => v * AMBIENT);
  const pos = lu.uLightPos, col = lu.uLightCol;
  pos.fill(0); col.fill(0);
  lights.forEach(([x, y, z, r, c, p], i) => { pos.set([x, y, z, r], i * 4); col.set([c[0], c[1], c[2], p], i * 4); });
  lu.uCount = lights.length; lu.uSteps = low ? 6 : 12; lu.uRelief = low ? 0.6 : 1.1;
  const pu = postPass.shader.resources.u.uniforms;
  pu.uView = [viewW, viewH]; pu.uTilt = low ? 0 : (shake > 0 ? 0.5 : 1); pu.uVig = low ? 0 : 0.38;
  pu.uBand = L.portrait ? 0.08 : 0.1;                                       // 세로 8% · 가로 10%
  pu.uGrid = [(GX - cx) / viewW, (GY - cy) / viewH, (GX + GW * T - cx) / viewW, (GY + GH * T - cy) / viewH];
  pu.uTint = low ? [1, 1, 1] : TINT;
  flash = Math.max(0, flash - real * 3);
  pu.uFlash = [flash * 0.9, flash * 0.85, flash * 0.7];

  R.render({ container: wA, target: albedoRT, clear: true, clearColor: [0.04, 0.035, 0.06, 1] });
  R.render({ container: wN, target: normalRT, clear: true, clearColor: [0, 0, 0, 0] });
  R.render({ container: lightPass, target: litRT, clear: true });
  R.render({ container: wU, target: litRT, clear: false });
  R.render({ container: postPass, target: finalRT, clear: true });
  if (shotWaiter) {                                     // 스크린샷: 화면에 그린 직후 같은 프레임에서 읽는다
    R.render({ container: app.stage });
    shotWaiter(app.canvas.toDataURL('image/png')); shotWaiter = null;
  }
});

window.__kod = { cam, lantern, tiles, grid, lights, bigVein, toScreen, tap, stash, market, get L() { return L; }, get ui() { return ui; }, get coins() { return coins; },
  // README 스크린샷 (dev 서버에서만 저장됨): 캔버스 전체(장면 + UI)를 그대로
  // 창이 가려져 프레임이 안 돌 때도 찍히게: 시계를 직접 n프레임 돌린 뒤 찍는다
  async shot(name, frames = 240) {
    let t = performance.now();
    const url = await new Promise((r) => { for (let i = 0; i < frames; i++) app.ticker.update((t += 33)); shotWaiter = r; app.ticker.update((t += 33)); }); return (await fetch(`/__shot/${name}`, { method: 'POST', body: url })).text(); } };
