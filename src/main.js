// 「용사님, 채굴하실게요~」 HD-2D 비주얼 프로토타입 v0.4
// 갱도 격자 12×16 + 런타임 랜턴 조명(노멀맵) + 광부 3 · 두더지 · 광차 + 곡괭이 주스 + 패럴랙스 3겹 + 틸트 시프트 + 저사양 토글
// v0.4 (가이드 §10·§10-1): 캐릭터는 2등신 치비 32×40(art/chibi.px.js)을 타일의 2배 밀도로(타일 1px = 화면 2px, 캐릭터 1px = 1px),
//   칸 36px 이상, 랜턴 기준 동적 긴 그림자(스프라이트 복제 + skew + alpha 0.35), 이펙트 시트 10종(art/fx.px.js).
// 세로 기본 반응형(§6-1): 세로 = 위 HUD · 아래 시트 / 패드·PC 가로 = 좌우 패널. 넘치는 만큼 끌어서 본다.
// 타일·소품: art/shaft.px.js · UI: art/ui/ui.px.js (9-slice) · 초상·NPC는 UI 틀 안에서만(§5-1-3)
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
import { B } from './balance.js';
import { loadSave, writeSave } from './save.js';

TextureSource.defaultOptions.scaleMode = 'nearest';
const VERSION = 'v0.5';

// ---------------------------------------------------------------- 저장 (명세2 §12: 로컬 자동 저장 5초마다 + 닫을 때)
const S = loadSave();
const save = () => writeSave(S);
setInterval(save, B.autosaveSeconds * 1000);
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
// 게임 시계: 현실 24분 = 하루
const TICK_PER_DAY = B.dayRealSeconds;
const clockText = () => { const t = S.tick / TICK_PER_DAY * 24; return `${S.day}일차 ${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`; };
const whTotal = () => Object.values(S.warehouse).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- 세계 (단위 = 타일 1px. 화면에는 DENS배 촘촘하게 그린다)
const T = 16, GW = 12, GH = 16;
const DENS = 2;                           // 화면 픽셀 / 월드 px — 캐릭터·이펙트는 이 밀도(32×40 치비 = 1칸 × 1.25칸)
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
let low = qs.has('low') ? qs.get('low') === '1' : !!S.settings.low;
setSound(S.settings.sound !== false);
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
  'tunnel', 'tunnel_beam', 'rail', 'stalactite', 'mushroom', 'side_far', 'side_mid', 'side_fg',
  'sky_far', 'deep_far', 'deep_mid', 'deep_fg', 'bubble_dig', 'bubble_walk', 'bubble_rest',
  'icon_gold', 'icon_glow', 'icon_silver', 'icon_copper', 'icon_gem',
  'cart_gold', 'cart_empty', 'npc_halabeoji', 'npc_momo', 'npc_brok', 'npc_merchant'];
const NORMALS = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver'];
const FX = ['fx_hit', 'fx_dirt', 'fx_rock', 'fx_vein', 'fx_vein_glow', 'fx_daebak', 'fx_gas', 'fx_water', 'fx_collapse', 'fx_cart', 'fx_pulse'];
const ANIMS = ['ore_glow', 'gold_shimmer', 'lantern', 'red_idle', 'red_walk', 'red_swing', 'brown_idle', 'brown_walk',
  'blonde_idle', 'blonde_walk', 'mole_sniff', 'cart_roll', 'cart_roll_empty', ...FX];
const urls = [
  ...SPRITES.map((n) => A(`sprites/${n}.png`)), ...NORMALS.map((n) => A(`sprites/${n}_n.png`)),
  ...ANIMS.flatMap((n) => [A(`anims/${n}.png`), A(`anims/${n}.json`)]), A('scenes/surface.png'),
];
const [loaded] = await Promise.all([Assets.load(urls), loadUI(BASE)]);
const tex = (n) => loaded[A(`sprites/${n}.png`)];
const ntex = (n) => loaded[A(`sprites/${n}_n.png`)];
/** 애니 프레임 텍스처 + 프레임별 길이(ms) */
function frames(n) {
  const base = loaded[A(`anims/${n}.png`)], json = loaded[A(`anims/${n}.json`)];
  const raw = json.data?.frames ?? json.frames;   // Pixi가 JSON을 스프라이트시트로 읽으면 .data에 원본이 있다
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  const out = list.map((f) => new Texture({ source: base.source, frame: new Rectangle(f.frame.x, f.frame.y, f.frame.w, f.frame.h) }));
  out.dur = list.map((f) => f.duration || 100);
  return out;
}
const F = Object.fromEntries(ANIMS.map((n) => [n, frames(n)]));
const ICON = { g: 'icon_gold', c: 'icon_glow', s: 'icon_silver', C: 'icon_copper', j: 'icon_gem' };
const NPC = { brok: 'npc_brok', merchant: 'npc_merchant', momo: 'npc_momo', halabeoji: 'npc_halabeoji' };
document.getElementById('loading')?.remove();

/** 애니 재생기: 프레임 길이대로 넘긴다 */
const player = (name, loop = true) => ({ name, fr: F[name], t: 0, i: 0, loop, done: false });
function step(p, dt) {
  p.t += dt * 1000;
  while (p.t >= p.fr.dur[p.i]) {
    p.t -= p.fr.dur[p.i]; p.i++;
    if (p.i >= p.fr.length) { if (p.loop) p.i = 0; else { p.i = p.fr.length - 1; p.done = true; break; } }
  }
  return p.fr[p.i];
}

// ---------------------------------------------------------------- 세 갈래 장면: 알베도 · 노멀 · 조명 뒤(발광)
const wA = new Container();   // 색 (조명 받음)
const wN = new Container();   // 노멀 (알파 0 = 조명 안 받음)
const wU = new Container();   // 조명 뒤에 그리는 것: 발광체 · 헤일로 · 불꽃 · 앞 겹 · 말풍선
for (const w of [wA, wN, wU]) w.scale.set(DENS);

// 패럴랙스 겹 하나 = 월드에 놓인 TilingSprite. 배율 f: tilePosition = cam × (1 - f)
const layers = [];
function para(name, parent, x, y, w, h, f, { flip = false, tint } = {}) {
  const s = new TilingSprite({ texture: tex(name), width: w, height: h });
  s.position.set(flip ? x + w : x, y);
  if (flip) s.scale.x = -1;
  if (tint) s.tint = tint;
  parent.addChild(s);
  layers.push({ s, f });
  return s;
}
// 위: 지상 위로 이어지는 밤하늘(0.2)
para('sky_far', wA, -320, -240, WW + 640, 240 + GY, 0.2);
wA.addChild(new Sprite(loaded[A('scenes/surface.png')]));   // 지상: pxl이 구운 조명 그대로 (런타임 비용 0)
// 아래: 깊은 어둠 — 먼 자갈 0.2 · 석순 0.5
para('deep_far', wA, -320, WH - 8, WW + 640, 300, 0.2);
para('deep_mid', wA, -320, WH + 4, WW + 640, 64, 0.5);
// 좌우: 격자 양옆 2칸 — 먼 바위 0.2 · 중간 0.5
for (const [n, f] of [['side_far', 0.2], ['side_mid', 0.5]]) {
  para(n, wA, 0, GY, GX, WH - GY, f);
  para(n, wA, WW - GX, GY, GX, WH - GY, f, { flip: true });
}
wN.addChild(new Graphics().rect(0, GY, WW, WH - GY).fill(0x8080ff));   // 조명 받는 곳: 격자·양옆·맨 아래

const tilesA = new Container(), tilesN = new Container();
const shimmerA = new Container(), crackG = new Graphics(), edgeA = new Graphics(), edgeN = new Graphics();
const propsA = new Container(), propsN = new Container();
const shadowsA = new Container(), charsA = new Container(), fxA = new Container(), dustA = new Container();
wA.addChild(tilesA, shimmerA, crackG, edgeA, propsA, shadowsA, charsA, fxA, dustA);
wN.addChild(tilesN, edgeN, propsN);

const lampsU = new Container(), halosU = new Container(), fxU = new Container(), sparksU = new Container(), fgU = new Container();
wU.addChild(lampsU, halosU, fxU, sparksU, fgU);
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

// ---------------------------------------------------------------- 이펙트 (art/fx.px.js · 캐릭터와 같은 밀도)
const FX_LIT = new Set(['fx_dirt', 'fx_rock', 'fx_gas', 'fx_water', 'fx_collapse']);   // 조명을 받는 것(파편·연기·물)
const effects = [];
function fx(name, x, y, { flip = false } = {}) {
  if (low && (name === 'fx_dirt' || name === 'fx_rock')) return null;   // 저사양: 큰 파편 이펙트 생략(입자는 남음)
  const s = new Sprite(F[name][0]);
  s.anchor.set(0.5); s.scale.set(flip ? -1 / DENS : 1 / DENS, 1 / DENS);
  s.position.set(x, y);
  (FX_LIT.has(name) ? fxA : fxU).addChild(s);
  const e = { s, p: player(name, false) };
  effects.push(e);
  return e;
}
function updateEffects(dt) {
  for (let k = effects.length - 1; k >= 0; k--) {
    const e = effects[k];
    e.s.texture = step(e.p, dt);
    if (e.p.done) { e.s.destroy(); effects.splice(k, 1); }
  }
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

// 레일 · 종유석 · 버섯 (정적 소품 — 버섯은 2f로 살랑)
for (const [gx, gy] of [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [7, 8], [8, 8]]) {
  const s = new Sprite(tex('rail')); s.position.set(GX + gx * T, GY + gy * T + 12); propsA.addChild(s);
}
for (const [gx, gy, ox] of [[4, 4, 3], [6, 4, 9], [2, 2, 6], [7, 6, 2]]) {
  const s = new Sprite(tex('stalactite')); s.position.set(GX + gx * T + ox, GY + gy * T); propsA.addChild(s);
}
const mushrooms = [[5, 4, 2], [5, 4, 7], [3, 4, 10]].map(([gx, gy, ox], k) => {
  const s = new Sprite(tex('mushroom')); s.position.set(GX + gx * T + ox, GY + gy * T + 12); propsA.addChild(s);
  halo(0x6fe0d8, 12, 0.35).position.set(s.x + 2, s.y + 1);
  s.baseX = s.x; s.seed = k * 1.7;
  return s;
});

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

// ---------------------------------------------------------------- 캐릭터 · 광차 (치비 32×40 → 월드 16×20) + 긴 그림자
// 발밑 기준. 곡괭이질 그림(46 폭)은 몸 가운데(16)가 기준이 되게 anchor를 옮긴다.
const ANCHOR_X = { red_swing: 16 / 46 };
const actors = [];
function actor(o) {
  const s = new Sprite(); s.anchor.set(0.5, 1);
  const sh = new Sprite(); sh.anchor.set(0.5, 1); sh.tint = 0x000000; sh.alpha = 0.35;
  shadowsA.addChild(sh); charsA.addChild(s);
  const a = { s, sh, face: 1, p: player(o.anim), shadow: true, tint: 0xffffff, ...o };
  actors.push(a);
  return a;
}
function setAnim(a, name) { if (a.p.name !== name) a.p = player(name); }
// 그림자: 랜턴 반대쪽으로 기울여 뒷벽에 길게. 랜턴이 가까울수록 길고 진하다
function drawActor(a, dt, lx, ly) {
  const tx = step(a.p, dt);
  a.s.texture = tx;
  a.s.anchor.set(ANCHOR_X[a.p.name] ?? 0.5, 1);
  a.s.scale.set(a.face / DENS, 1 / DENS);
  a.s.position.set(Math.round(a.x * DENS) / DENS, Math.round(a.y * DENS) / DENS);
  a.s.tint = a.y < GY + 1 ? 0xe0a890 : a.tint;              // 지상(구운 해 질 녘 빛)에선 노을 색
  const sh = a.sh;
  const dx = a.x - lx, dy = a.y - 8 - ly, dist = Math.hypot(dx, dy);
  sh.visible = a.shadow && !low && dist < LANTERN_R && a.y > GY;
  if (!sh.visible) return;
  sh.texture = tx; sh.anchor.copyFrom(a.s.anchor); sh.position.copyFrom(a.s.position);
  const near = Math.max(0, 1 - dist / LANTERN_R);
  sh.scale.set(a.face / DENS, (1 + 0.6 * near) / DENS);
  sh.skew.x = -Math.max(-1.1, Math.min(1.1, Math.atan2(dx, Math.abs(dy) + 10)));
  sh.alpha = 0.35 * Math.min(1, near * 2.5);
}

// 붉은 수염: 금맥 앞에서 곡괭이질, 파내면 한 칸 걸어 들어간다
const miner = actor({ anim: 'red_swing', gx: 8, gy: 8, walking: 0, from: 0, to: 0, state: 'dig', target: 'g' });
const minerX = (gx) => GX + gx * T + 7;
miner.x = minerX(miner.gx); miner.y = GY + (miner.gy + 1) * T + 1;
const bubble = new Sprite(tex('bubble_dig')); lampsU.addChild(bubble);
const headHalo = halo(0xfff0a0, 8, 0.6);
// 뚱보(샌드위치)·금발(랜턴): 위 갱도(4줄)를 오가며 쉬고 걷는다
const ROW4 = GY + 5 * T + 1;
const wanderers = [
  actor({ anim: 'brown_idle', name: 'brown', x: GX + 4 * T, y: ROW4, minX: GX + 2 * T + 6, maxX: GX + 7 * T + 8, speed: 7, wait: 3 }),
  actor({ anim: 'blonde_walk', name: 'blonde', x: GX + 6 * T, y: ROW4, minX: GX + 2 * T + 6, maxX: GX + 7 * T + 8, speed: 12, wait: 0, face: -1 }),
];
// 꼬마 두더지: 지상에서 킁킁 (탐사 펫)
const mole = actor({ anim: 'mole_sniff', x: 118, y: 40.5, homeX: 118, wait: 2, shadow: false });
// 광차: 금맥 앞 → 수직갱 → 지상 창고 왕복
const railY = (gy) => GY + gy * T + 14;
const ROUTE = [
  [GX + 7 * T + 8, railY(8), 'load'], [GX + 7 * T + 8, railY(4), 'lift'], [GX + 2 * T + 8, railY(4)],
  [GX + 2 * T + 8, 39, 'lift'], [190, 39, 'unload'],
];
const cart = actor({ anim: 'cart_roll', seg: 0, dir: 1, t: 0, wait: 1.2, x: ROUTE[0][0], y: ROUTE[0][1], full: true, moving: false, trips: 0, sparkT: 0 });
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
    p.s.position.set(Math.round(p.x * DENS) / DENS, Math.round(p.y * DENS) / DENS);
    if (p.fade) p.s.alpha = 1 - p.age / p.life;
  }
}

// ---------------------------------------------------------------- 창고 · 시세
const stash = S.warehouse;                              // 창고 (저장됨)
const market = createMarket();

// ---------------------------------------------------------------- 주스
let shake = 0, shakeAmp = 0, hitstop = 0, slowmo = 0, flash = 0, boom = null, boomed = false;

function hitTile(cx, cy, by = 'player') {
  const ch = cellAt(cx, cy);
  if (!isSolid(ch)) return false;
  const player = by === 'player';
  const hp = HP[ch];
  const cxp = cx * T + 8, cyp = cy * T + 8;
  // 맞은 면(갱도 쪽)에서 이펙트가 터지게: 플레이어는 칸 가운데, 광부는 왼쪽 면
  const ex = player ? cxp : cx * T + 2;
  if (!hp) {                                             // 바깥 암반: 쨍, 불꽃만
    sfx('clink', !player);
    fx('fx_hit', ex, cyp);
    if (player) { shake = 0.1; shakeAmp = 1; toast('단단해서 지금 곡괭이로는 안 파져요'); }
    return false;
  }
  if (player) { shake = 0.12; shakeAmp = 2; hitstop = 0.05; }   // 흔들림 2px + 히트 스톱 50ms
  sfx('hit', !player);
  fx('fx_hit', ex, cyp);                                // 타격 스파크
  if (player || Math.random() < 0.5) fx(ch === 'd' ? 'fx_dirt' : 'fx_rock', ex, cyp);
  const cols = DEBRIS[ch];
  for (let i = 0; i < 6; i++)                           // 파편 6개
    particle(dustA, { x: ex + (Math.random() - 0.5) * 10, y: cyp + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 110, vy: -50 - Math.random() * 70, life: 0.5 + Math.random() * 0.3, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.3 ? 2 : 1 });
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
  for (let i = 0; i < 10; i++)
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.7 + Math.random() * 0.4, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.4 ? 2 : 1 });
  if (ORE_KEYS.has(ch)) { fx(ch === 'c' ? 'fx_vein_glow' : 'fx_vein', x0 + 8, y0 + 8); orePopup(ch, x0 + 8, y0 + 4, 3); }
  else fx(ch === 'd' ? 'fx_dirt' : 'fx_rock', x0 + 8, y0 + 8);
  drawEdges(); drawSolid(); drawCracks();
  if (ch === 'g' && player && !boomed) { boomed = true; bigVein(x0 + 8, y0 + 8); }
}

// 큰 광맥: 슬로모 0.4초 + 플래시 + 종 + "대박!" + 대박 이펙트(고리·별)
function bigVein(x, y) {
  slowmo = 0.4; flash = 1; shake = 0.35; shakeAmp = 3;
  boom = { x, y, t: 1.6 };
  sfx('bell');
  fx('fx_daebak', x, y);
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
    particle(sparksU, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.8 + Math.random() * 0.6, color: [0xfff4b8, 0xf5cf6a, 0xffffff][i % 3], g: 60, size: Math.random() < 0.3 ? 1 : 0.5 });
  }
  const el = document.createElement('div');
  el.className = 'daebak'; el.textContent = '대박!';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// 갱도 사건 (명세 §2-5의 그림만): 붕괴 먼지 · 가스 · 지하수. 20~35초마다 빈 갱도 한 칸에서
const EVENTS = [
  ['fx_collapse', '갱도 천장에서 돌이 떨어졌어요', 'halabeoji'],
  ['fx_gas', '가스가 새어 나와요! 잠깐 쉬어 가요', 'momo'],
  ['fx_water', '지하수가 솟았어요 — 펌프가 필요해요', 'momo'],
];
let eventT = 14;
function randomEvent(force) {
  const spots = [];
  grid.forEach((row, gy) => row.forEach((ch, gx) => { if (empty(ch) && gy > 0) spots.push([gx, gy]); }));
  const [gx, gy] = spots[Math.floor(Math.random() * spots.length)];
  const [name, msg, who] = force ?? EVENTS[Math.floor(Math.random() * EVENTS.length)];
  fx(name, GX + gx * T + 8, GY + gy * T + 6);
  if (name === 'fx_collapse') { shake = 0.25; shakeAmp = 1; sfx('break', true); }
  toast(msg, who);
}

// ---------------------------------------------------------------- 레이아웃 (§6-1 · 칸 36px 이상)
// L: CSS px 기준. cell = 한 칸의 화면 크기, sc = 월드 1px의 화면 크기, uiS = UI 1px의 화면 크기(정수)
let L = null;
const cam = { x: 0, y: 0, x0: 0, y0: 0, panX: 0, panY: 0, lean: 0, rx: 0, ry: 0 };
let viewW = 192, viewH = 400;
let albedoRT, normalRT, litRT, finalRT, lightPass, postPass;
const display = new Sprite();
const uiRoot = new Container();
app.stage.addChild(display, uiRoot);

function computeLayout() {
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = R.resolution;
  let portraitMode = H >= W * 0.9;
  let cell, uiS, panels, vis;
  if (!portraitMode) {
    // 패드·PC 가로 (명세2 §10): 칸 = 높이/14, 좌우 패널 320px (왼쪽 광부·사건 · 오른쪽 판매)
    uiS = 2;
    const side = 320;
    cell = Math.min(H / 14, (W - 2 * side) / 12);
    if (cell < 20) portraitMode = true;                             // 패널 둘 자리가 없으면 세로 배치
    else {
      const pad = 2 * uiS;
      panels = {
        left: { x: pad, y: pad, w: side - 2 * pad, h: H - 2 * pad },
        right: { x: W - side + pad, y: pad, w: side - 2 * pad, h: H - 2 * pad },
      };
      vis = { x0: side, x1: W - side, y0: 0, y1: H, above: 2 };
    }
  }
  if (portraitMode) {
    // 세로 폰: 칸 = 너비/12. 위 HUD · 지상 띠 · 격자(보이는 만큼, 세로로 끌어 봄) · 아래 시트 32% (접으면 10%)
    uiS = Math.max(2, Math.min(3, Math.floor(W / 195)));
    cell = W / 12;
    const hudH = 36 * uiS;
    const sheetH = Math.round(S.settings.sheetFolded ? Math.max(H * 0.10, 26 * uiS) : Math.max(H * 0.32, 84 * uiS));
    panels = { hud: { x: 0, y: 0, w: W, h: hudH }, sheet: { x: 0, y: H - sheetH, w: W, h: sheetH } };
    vis = { x0: 0, x1: W, y0: hudH, y1: H - sheetH, above: 3 };
  }
  const sc = cell / T;
  const gridW = 12 * cell, gridH = GH * cell, visW = vis.x1 - vis.x0, visH = vis.y1 - vis.y0;
  const gridLeft = vis.x0 + (visW - gridW) / 2;
  const gridTop = vis.y0 + vis.above * cell;                       // 지상 띠는 늘 보이고, 넘치는 격자는 세로로 끌어 본다
  const overX = Math.max(0, gridW - visW) / sc, overY = Math.max(0, gridTop + gridH - vis.y1) / sc;
  return { W, H, dpr, portrait: portraitMode, cell, sc, uiS, gridLeft, gridTop, panels, overX, overY };
}

function layout() {
  L = computeLayout();
  const px = L.sc / DENS;                                           // 화면 픽셀(장면) 하나의 CSS 크기
  viewW = Math.ceil(L.W / px) + 2; viewH = Math.ceil(L.H / px) + 2;
  for (const rt of [albedoRT, normalRT, litRT, finalRT]) rt?.destroy(true);
  lightPass?.destroy(); postPass?.destroy();
  const mk = (scaleMode) => RenderTexture.create({ width: viewW, height: viewH, resolution: 1, scaleMode });
  albedoRT = mk('nearest'); normalRT = mk('nearest'); litRT = mk('linear'); finalRT = mk('nearest');
  lightPass = makeLightPass(albedoRT, normalRT, solidTex);
  postPass = makePostPass(litRT);
  lightPass.scale.set(viewW, viewH); postPass.scale.set(viewW, viewH);
  display.texture = finalRT;
  display.scale.set(px);
  cam.x0 = GX - L.gridLeft / L.sc; cam.y0 = GY - L.gridTop / L.sc;
  clampPan();
  setTextRes(L.uiS * L.dpr);
  buildUI();
}
function clampPan() {
  cam.panX = Math.max(-L.overX / 2 - 8, Math.min(L.overX / 2 + 8, cam.panX));
  cam.panY = Math.max(-24, Math.min(L.overY + 24, cam.panY));
}
window.addEventListener('resize', () => setTimeout(layout, 60));

const toWorld = (sx, sy) => [((sx - display.x) / display.scale.x + cam.rx) / DENS, ((sy - display.y) / display.scale.y + cam.ry) / DENS];
const toScreen = (x, y) => [display.x + (x * DENS - cam.rx) * display.scale.x, display.y + (y * DENS - cam.ry) * display.scale.y];
const inPanels = (sx, sy) => Object.values(L.panels).some((p) => sx >= p.x && sx < p.x + p.w && sy >= p.y && sy < p.y + p.h);

// ---------------------------------------------------------------- UI (art/ui/ui.px.js 틀 · 인물은 틀 안에서만)
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
    const tw = Math.floor((sw - 12 - 22) / 3);
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
    // 접기/펴기 (32% ↔ 10%)
    const fold = button('stone', 18, 14, S.settings.sheetFolded ? '▲' : '▼', () => { S.settings.sheetFolded = !S.settings.sheetFolded; save(); layout(); }, { small: true });
    fold.position.set(sw - 24, 4); s.addChild(fold);
    s.addChild(body);
    uiRoot.addChild(s);
    if (S.settings.sheetFolded) { ui.tabs.forEach((t) => { t.setOn(t.key === sheetTab); t.on('pointertap', () => { S.settings.sheetFolded = false; save(); setTimeout(layout, 0); }); }); }
    else show(sheetTab);
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
  ui.fxLayer = new Container(); uiRoot.addChild(ui.fxLayer);   // UI 위 이펙트(시세 급등 펄스)
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
  // 금화 · 창고 n/60 · 날짜/시각 (명세2 §10)
  const items = [['coin', kit('coin'), 40], ['wh', tex('icon_gold'), 46], ['clock', null, 70]];
  const total = items.reduce((a, [, , sw]) => a + sw, 0);
  let xa = wide ? w - 8 - total : 7;
  items.forEach(([key, tx, sw]) => {
    const i = tx ? icon(tx) : new Container(), n = label('0', { small: key === 'clock' });
    const x0 = xa; xa += sw;
    i.position.set(x0, cy + Math.round((14 - i.height) / 2));
    n.position.set(x0 + (tx ? i.width + 3 : 0), cy + (key === 'clock' ? 1 : 0));
    c.addChild(i, n);
    ui.counters[key] = n;
  });
  return c;
}

function makeSell(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));   // win_paper는 가운데 얼룩 점이 9-slice로 늘어나 선이 돼서 무지 패널을 쓴다
  const compact = h < 110;
  const pf = portraitFrame(tex(NPC[ORES.find((o) => o.key === sellSel).buyer]), 46, 'wood');
  pf.position.set(5, 5); c.addChild(pf);
  ui.buyerFace = pf;
  let rowsX = 56, rowsY = 6, rowW = w - rowsX - 6;
  if (!compact) {
    const head = label('', { color: COLOR.paperInk, shadow: false }); head.position.set(56, 8); c.addChild(head);
    const sub = label('시세는 10초마다 바뀌어요', { small: true, color: 0x8a7a68, shadow: false }); sub.position.set(56, 24); c.addChild(sub);
    ui.buyerName = head;
    rowsX = 6; rowsY = 56; rowW = w - 12;
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
    bg.eventMode = 'static'; bg.cursor = 'pointer';                 // 줄을 누르면 그 광종의 매입자로 (부모에 hitArea를 두면 팔기 버튼이 안 눌린다)
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
  const pf = portraitFrame(F.red_idle[0], 46, style === 'wood' ? 'wood' : 'stone');
  c.addChild(pf);
  ui.minerFace = pf;
  const name = label('붉은 수염', { color: 0xe8823a }); name.position.set(52, 2);
  const role = label('· 광부', { small: true, color: COLOR.dim }); role.position.set(52 + Math.round(name.width) + 3, 4);
  role.visible = 52 + name.width + 3 + role.width <= w;
  const state = label('', { small: true }); state.position.set(52, 17);
  const cargo = bar(Math.max(30, Math.min(80, w - 54))); cargo.position.set(52, 32);
  const trips = label('', { small: true, color: COLOR.dim }); trips.position.set(52, 41);
  c.addChild(name, role, state, cargo, trips);
  ui.minerState = state; ui.cargo = cargo; ui.trips = trips;
  miner.stateText = '';
  return c;
}

const FX_DEMO = ['fx_hit', 'fx_dirt', 'fx_rock', 'fx_vein', 'fx_vein_glow', 'fx_daebak', 'fx_gas', 'fx_water', 'fx_collapse', 'fx_cart', 'fx_pulse'];
function makeSettings(w) {
  const c = new Container();
  const items = [
    ['대박 연출', () => { unlockAudio(); bigVein(GX + 9 * T + 8, GY + 9 * T + 8); }],
    ['이펙트 10종', () => FX_DEMO.forEach((n, i) => setTimeout(() => fx(n, GX + (2 + (i % 4) * 2.4) * T, GY + (5 + Math.floor(i / 4) * 2) * T), i * 450))],
    ['사건 보기', () => randomEvent()],
    ['pxl 기준컷', () => document.getElementById('ref').classList.add('show')],
    [() => `저사양 ${low ? '켬' : '끔'}`, () => setLow(!low)],
    [() => `소리 ${soundOn() ? '켬' : '끔'}`, () => { unlockAudio(); setSound(!soundOn()); S.settings.sound = soundOn(); save(); }],
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
  ui.counters.coin && (ui.counters.coin.text = String(S.gold));
  ui.counters.wh && (ui.counters.wh.text = `${whTotal()}/${B.warehouseCapacity}`);
  ui.counters.clock && (ui.counters.clock.text = clockText());
  const sel = ORES.find((o) => o.key === sellSel);
  ui.buyerFace?.setTexture(tex(NPC[sel.buyer]));
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
  flyNumber('coin', from.x + 15 * L.uiS, from.y, gain, () => { S.gold += gain; refreshUI(); bumpCounter('coin'); });
  refreshUI();
}

const bumps = [];
function bumpCounter(key) {
  const n = ui.counters[key];
  if (!n) return;
  n.scale.set(1.3); n.tint = 0xfff4b8;
  bumps.push({ n, t: 0.16 });                         // 시간은 매 프레임에서 줄인다(창이 가려져도 원래 크기로)
}

// 광석 숫자: 튀어 올랐다가 HUD/판매 창으로 빨려 간다
function orePopup(kind, x, y, n) {
  sfx('ore');
  const [sx, sy] = toScreen(x, y);
  flyNumber(kind, sx, sy, n, () => { stash[kind] += n; refreshUI(); bumpCounter('wh'); sfx('stash', true); });
}
function flyNumber(kind, sx, sy, n, done) {
  const el = document.createElement('div');
  el.className = `pop pop-${kind}`;
  el.innerHTML = `<i></i>+${n}`;
  document.body.appendChild(el);
  const target = ui.counters[kind] ?? (kind === 'coin' ? null : ui.counters.wh) ?? ui.rows[kind]?.qty ?? ui.sellAnchor;
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

// 토스트: 양피지 패널. who(모모·할아범)가 있으면 왼쪽에 그 인물 치비를 틀 안에
let toastT = 0;
function toast(msg, who) {
  const t = ui.toast;
  if (!t) return;
  t.removeChildren().forEach((c) => c.destroy());
  const tx = label(msg, { color: COLOR.paperInk, shadow: false, small: true });
  const face = who ? 34 : 0;
  const w = Math.ceil(tx.width) + 16 + face, h = who ? 44 : 20;
  t.addChild(frame('paper', w, h, 'panel'));
  if (who) { const pf = portraitFrame(tex(NPC[who]), 36, 'wood'); pf.position.set(4, 4); pf.scale.set(1); t.addChild(pf); }
  t.addChild(tx);
  tx.position.set(8 + face + (who ? 4 : 0), Math.round((h - 12) / 2));
  const Wu = Math.round(L.W / L.uiS);
  const bottom = L.portrait ? Math.round(L.panels.sheet.y / L.uiS) - 4 : Math.round(L.H / L.uiS) - 8;
  t.position.set(Math.round((Wu - w) / 2), bottom - h);
  t.visible = true;
  toastT = who ? 2.6 : 1.4;
}

function setLow(v) { low = v; S.settings.low = v; save(); }
document.getElementById('ref').onclick = () => document.getElementById('ref').classList.remove('show');
document.getElementById('ref-shaft').src = A('scenes/shaft_night.png');
document.getElementById('ref-office').src = A('scenes/office_night.png');
const uiFx = [];
market.onTick = () => {
  refreshUI();
  for (const [key, r] of Object.entries(ui.rows)) if (market.last[key] > 0 && ui.fxLayer) {   // 시세 급등: UI 펄스 이펙트
    const p = r.arrow.getGlobalPosition();
    const s = new Sprite(F.fx_pulse[0]); s.anchor.set(0.5); s.scale.set(0.5);
    s.position.set(Math.round(p.x / L.uiS) + 3, Math.round(p.y / L.uiS) + 3);
    ui.fxLayer.addChild(s); uiFx.push({ s, p: player('fx_pulse', false) });
  }
};

layout();
setTimeout(() => toast('오늘도 잘 부탁하네! 금맥이 코앞이야', 'halabeoji'), 800);

// ---------------------------------------------------------------- 입력: 톡 = 곡괭이 · 랜턴 끌기 · 빈 곳 끌기 = 둘러보기
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
  if (drag.mode === 'pan') { cam.panX -= dx; cam.panY -= dy; clampPan(); }
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

function updateMiner(dt) {
  let state = miner.state;
  const floorY = GY + (miner.gy + 1) * T + 1;
  if (miner.walking > 0) {
    miner.walking = Math.max(0, miner.walking - dt / 0.9);
    miner.x = miner.to + (miner.from - miner.to) * miner.walking;
    setAnim(miner, 'red_walk'); state = 'walk';
  } else {
    const tgt = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy);
    const floor = cellAt(GX / T + miner.gx + 1, GY / T + miner.gy + 1);
    if (!isSolid(tgt) && isSolid(floor) && miner.gx + 1 < GW) {
      miner.from = miner.x; miner.gx++; miner.to = minerX(miner.gx); miner.walking = 1; state = 'walk';
    } else if (isSolid(tgt) && HP[tgt]) {
      setAnim(miner, 'red_swing');                    // 타격은 아래 그리는 곳에서 내리치는 프레임(2)에
      state = 'dig'; miner.target = tgt;
    } else { setAnim(miner, 'red_idle'); state = 'rest'; }
  }
  miner.y = floorY;
  miner.state = state;
  const s = state === 'dig' ? `${NAMES[miner.target] ?? '바위'} 캐는 중` : state === 'walk' ? '걸어 들어가는 중' : '쉬는 중';
  if (ui.minerState && ui.minerState.text !== s) ui.minerState.text = s;
}

function updateWanderer(a, dt) {
  if (a.wait > 0) { a.wait -= dt; setAnim(a, `${a.name}_idle`); return; }
  if (a.goal === undefined) a.goal = a.minX + Math.random() * (a.maxX - a.minX);
  const d = a.goal - a.x;
  if (Math.abs(d) < 0.5) { a.goal = undefined; a.wait = 1.5 + Math.random() * 3; return; }
  a.face = Math.sign(d);
  a.x += Math.sign(d) * Math.min(Math.abs(d), a.speed * dt);
  setAnim(a, `${a.name}_walk`);
}

function updateCart(dt) {
  if (cart.wait > 0) { cart.wait -= dt; cart.moving = false; }
  else {
    const a = ROUTE[cart.seg], b = ROUTE[cart.seg + cart.dir];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), vertical = Math.abs(b[0] - a[0]) < 1;
    cart.t += (dt * (vertical ? 26 : 34)) / len;
    cart.moving = !vertical;
    if (!vertical) cart.face = Math.sign(b[0] - a[0]) || cart.face;
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
    if (cart.moving) {                                    // 광차 불꽃 이펙트 + 먼지
      cart.sparkT -= dt;
      if (cart.sparkT <= 0) {
        cart.sparkT = 0.28;
        fx('fx_cart', cart.x - cart.face * 6, cart.y - 4, { flip: cart.face < 0 });
        particle(dustA, { x: cart.x - cart.face * 9, y: cart.y - 2, vx: -cart.face * 8, vy: -6, life: 0.8, color: 0x8a7a6a, g: 0, drag: 1.2, size: 2 });
      }
    }
  }
  setAnim(cart, cart.full ? 'cart_roll' : 'cart_roll_empty');
  if (!cart.moving) { cart.p.t = 0; cart.p.i = 0; }      // 멈추면 바퀴도 멈춤
  cable.clear();
  const inShaft2 = Math.abs(cart.x - (GX + 2 * T + 8)) < 1 && cart.y < railY(4) - 1;
  const inShaft7 = Math.abs(cart.x - (GX + 7 * T + 8)) < 1 && cart.y > railY(4) + 1 && cart.y < railY(8);
  if (inShaft2) cable.moveTo(SHAFT_TOP_X, 9).lineTo(cart.x + 2, cart.y - 12).stroke({ width: 1, color: 0x3d3a4c });
  if (inShaft7) cable.moveTo(cart.x + 2, GY + 4 * T).lineTo(cart.x + 2, cart.y - 12).stroke({ width: 1, color: 0x3d3a4c });
  if (ui.cargo) {
    const route = cart.seg + cart.t * cart.dir;
    ui.cargo.set(cart.full ? route / (ROUTE.length - 1) : 1 - route / (ROUTE.length - 1));
    const s = `광차 ${cart.trips}번 왕복`;
    if (ui.trips.text !== s) ui.trips.text = s;
  }
}

function updateMole(dt) {
  mole.wait -= dt;
  if (mole.wait <= 0) { mole.goal = mole.homeX + (Math.random() - 0.5) * 30; mole.wait = 3 + Math.random() * 3; }
  if (mole.goal !== undefined) {
    const d = mole.goal - mole.x;
    if (Math.abs(d) > 0.5) { mole.face = Math.sign(d); mole.x += Math.sign(d) * Math.min(Math.abs(d), 6 * dt); }
  }
}

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
  S.tick += real;                                          // 게임 시계 (슬로모·히트스톱과 무관)
  if (S.tick >= TICK_PER_DAY) { S.tick -= TICK_PER_DAY; S.day++; }
  if (ui.counters?.clock && (fpsN === 1)) ui.counters.clock.text = clockText();
  eventT -= dt;
  if (eventT <= 0) { eventT = 20 + Math.random() * 15; randomEvent(); }
  if (toastT > 0) { toastT -= real; if (toastT <= 0 && ui.toast) ui.toast.visible = false; }
  for (let k = bumps.length - 1; k >= 0; k--) { bumps[k].t -= real; if (bumps[k].t <= 0) { if (!bumps[k].n.destroyed) { bumps[k].n.scale.set(1); bumps[k].n.tint = 0xffffff; } bumps.splice(k, 1); } }
  for (let k = uiFx.length - 1; k >= 0; k--) { const e = uiFx[k]; if (e.s.destroyed) { uiFx.splice(k, 1); continue; } e.s.texture = step(e.p, real); if (e.p.done) { e.s.destroy(); uiFx.splice(k, 1); } }

  // 랜턴: 진자 흔들림
  if (!drag || drag.mode !== 'lantern') lantern.vel += -Math.sin(lantern.ang) * 18 * dt;
  lantern.vel *= 1 - 1.4 * dt;
  lantern.ang = Math.max(-0.9, Math.min(0.9, lantern.ang + lantern.vel * dt + Math.sin(time * 1.3) * 0.0006));
  lanternS.texture = F.lantern[Math.floor(time * 5) % F.lantern.length];
  lanternS.position.set(Math.round(lantern.x), Math.round(lantern.y));
  lanternS.rotation = lantern.ang;
  const [lfx, lfy] = lanternFlame();

  // 캐릭터 · 광차
  updateMiner(dt);
  for (const w of wanderers) updateWanderer(w, dt);
  updateMole(dt);
  updateCart(dt);
  for (const a of actors) {
    const prev = a.p.i;
    drawActor(a, dt, lfx, lfy);
    if (a === miner && miner.state === 'dig' && a.p.name === 'red_swing' && a.p.i === 2 && prev !== 2)   // 내리치는 프레임에 타격
      hitTile(GX / T + miner.gx + 1, GY / T + miner.gy, 'miner');
  }
  const head = [miner.x + 3, miner.y - 18];
  bubble.texture = tex(`bubble_${miner.state}`);
  bubble.position.set(Math.round(miner.x) - 2, Math.round(miner.y) - 30 - (Math.floor(time * 2) % 2));
  const blonde = wanderers[1];
  const blondeLamp = [blonde.x + 6 * blonde.face, blonde.y - 7];

  // 버섯 살랑 2f
  for (const m of mushrooms) m.x = m.baseX + (Math.sin(time * 2 + m.seed) > 0.6 ? 0.5 : 0);

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
  updateEffects(dt);

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
  addLight(head[0] + 8, head[1] + 4, 6, 40, [1.0, 0.94, 0.68], 1.1);                 // 붉은 수염 헤드램프
  addLight(blondeLamp[0], blondeLamp[1], 6, 44, [1.0, 0.8, 0.5], 0.8 * (1 + 0.05 * flick(time, 4)));   // 금발 광부 손 랜턴
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
      particle(dustA, { x, y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2, life: 3 + Math.random() * 2, color: 0xc8b8a0, g: 0, size: 0.5 });
  }
  updateParticles(dt);

  // 카메라: 기본 위치 + 끌어 보기 + 랜턴 쪽으로 살짝 기울기(→ 패럴랙스가 산다) · 흔들림
  const leanTarget = Math.max(-1, Math.min(1, (lantern.y - (GY + GH * T / 2)) / (GH * T / 2))) * 10;
  cam.lean += (leanTarget - cam.lean) * Math.min(1, dt * 2);
  cam.x = cam.x0 + cam.panX; cam.y = cam.y0 + cam.panY + cam.lean;
  let sx = 0, sy = 0;
  if (shake > 0) { shake -= real; sx = Math.round((Math.random() * 2 - 1) * shakeAmp * DENS); sy = Math.round((Math.random() * 2 - 1) * shakeAmp * DENS); }
  cam.rx = Math.floor(cam.x * DENS); cam.ry = Math.floor(cam.y * DENS);           // 화면 픽셀 단위 카메라
  const px = display.scale.x;
  display.position.set(-(cam.x * DENS - cam.rx) * px, -(cam.y * DENS - cam.ry) * px);
  const crx = cam.rx + sx, cry = cam.ry + sy;
  for (const w of [wA, wN, wU]) w.position.set(-crx, -cry);
  const wx = crx / DENS, wy = cry / DENS;                                         // 월드 단위 카메라
  for (const p of layers) p.s.tilePosition.set(Math.round(wx * (1 - p.f)) * p.s.scale.x, Math.round(wy * (1 - p.f)));
  fgU.visible = !low;

  // 조명 합성 → 발광/헤일로 → 후처리
  const lu = lightPass.shader.resources.u.uniforms;
  lu.uView = [viewW, viewH]; lu.uCam = [wx, wy]; lu.uDens = DENS; lu.uWorld = [WW, WH];
  lu.uAmbient = AMB_COLOR.map((v) => v * AMBIENT);
  const pos = lu.uLightPos, col = lu.uLightCol;
  pos.fill(0); col.fill(0);
  lights.forEach(([x, y, z, r, c, p], i) => { pos.set([x, y, z, r], i * 4); col.set([c[0], c[1], c[2], p], i * 4); });
  lu.uCount = lights.length; lu.uSteps = low ? 6 : 12; lu.uRelief = low ? 0.6 : 1.1;
  const pu = postPass.shader.resources.u.uniforms;
  pu.uView = [viewW, viewH]; pu.uTilt = low ? 0 : (shake > 0 ? 0.5 : 1); pu.uVig = low ? 0 : 0.38;
  pu.uBand = L.portrait ? 0.08 : 0.1;                                       // 세로 8% · 가로 10%
  pu.uGrid = [(GX * DENS - crx) / viewW, (GY * DENS - cry) / viewH, ((GX + GW * T) * DENS - crx) / viewW, ((GY + GH * T) * DENS - cry) / viewH];
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

window.__kod = {
  cam, lantern, tiles, grid, lights, bigVein, toScreen, tap, stash, market, fx, randomEvent, actors,
  get L() { return L; }, get ui() { return ui; }, get S() { return S; },
  // README 스크린샷 (dev 서버에서만 저장됨). 창이 가려져 프레임이 안 돌 때도 찍히게: 시계를 직접 n프레임 돌린 뒤 찍는다
  async shot(name, frames = 240) {
    let t = performance.now();
    const url = await new Promise((r) => { for (let i = 0; i < frames; i++) app.ticker.update((t += 33)); shotWaiter = r; app.ticker.update((t += 33)); });
    return (await fetch(`/__shot/${name}`, { method: 'POST', body: url })).text();
  },
};
