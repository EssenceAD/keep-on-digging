// 「용사님, 채굴하실게요~」 v0.5 — 핵심 루프 (명세2 MINING_SPEC_2_LOOP_1024.md)
// 경매 → 탐사 → 시추(갱도 그리기) → 광차 → 판매 → 결과 → 다음 경매. 숫자는 전부 src/balance.js.
// 그림: 타일·소품 art/shaft.px.js · 캐릭터 art/chibi.px.js(2배 밀도) · 광차 art/chars.px.js · 이펙트 art/fx.px.js · UI art/ui/ui.px.js
// 렌더: 알베도 RT + 노멀 RT → 조명 셰이더(src/gl.js) → 발광·헤일로 → 후처리 → 확대. 세로 기본 반응형.
import 'galmuri/dist/galmuri.css';
import './style.css';
import {
  Application, Assets, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture,
  TextureSource, TilingSprite,
} from 'pixi.js';
import { MAX_LIGHTS, makeLightPass, makePostPass } from './gl.js';
import { sfx, setSound, soundOn, unlockAudio } from './sound.js';
import { COLOR, bar, button, frame, icon, kit, label, loadUI, portraitFrame, setTextRes, tab } from './ui.js';
import { BUYERS, ORES, buyerOf, createMarket } from './market.js';
import { B } from './balance.js';
import { SAVE_VERSION, loadSave, migrate, resetSave, writeSave } from './save.js';
import { BOARDS, initAuth, login, logout, me, online, pullSave, pushSave, recover, submitRank, topRank, weekKey } from './net.js';
import { computeOffline } from './offline.js';
import { AUCTIONEER, GUILD_LINES, fill, pick } from './text.js';
import { checkDaybook, dayDef, progress, rollDaybook } from './daybook.js';
import { BUILDINGS, DECOS, at as coAt, canUp, cols as coCols, companyFx, effectText, ensureCompany, harmonies, lvOf, nameOf, placed, TALENT_TREES, talentLeft, talentPoints, talentSpent } from './company.js';
import { COLS as GW, ORE_TYPES, findVeins, freeCard, generate, makeCards } from './gen.js';
const ORE_COLOR = { C: 0xb87a4a, s: 0x7c7a92, g: 0xb8862a, j: 0x8a4ab0, c: 0x2fa09a };
import { newSeed } from './rng.js';

TextureSource.defaultOptions.scaleMode = 'nearest';
const VERSION = 'v0.6';

// ---------------------------------------------------------------- 저장 (명세2 §12: 로컬 자동 저장 5초마다 + 닫을 때)
const S = loadSave();
let saving = true;
/** seen: 지금 화면을 보고 있다(방치 기준 시각 lastSeen 을 지금으로). 숨겨진 동안의 자동 저장은 lastSeen 을 안 건드린다 */
const save = (seen = document.visibilityState === 'visible') => { if (!saving) return; syncRound?.(); if (seen) S.idle.lastSeen = Date.now(); S.savedAt = Date.now(); writeSave(S); };
setInterval(() => save(), B.autosaveSeconds * 1000);
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); else if (booted) settleOffline(); });
let booted = false;                                          // 부팅이 끝난 뒤에만 화면 복귀 정산
// 게임 시계: 현실 24분 = 하루
const TICK_PER_DAY = B.dayRealSeconds;
const clockText = (short = false) => { const t = S.tick / TICK_PER_DAY * 24; return `${S.day}${short ? '일' : '일차'} ${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`; };
const whTotal = () => Object.values(S.warehouse).reduce((a, b) => a + b, 0);
ensureCompany(S);
let CF = companyFx(S);                                      // 회사가 바꾸는 숫자 (명세3 §2) — 건물·장식이 바뀌면 다시
const whCap = () => CF.whCap;
const now = () => S.day * TICK_PER_DAY + S.tick;            // 라운드 시간 재기용(현실 초)

// ---------------------------------------------------------------- 세계 (단위 = 타일 1px. 화면에는 DENS배 촘촘하게 그린다)
const T = 16;
const DENS = 2;                           // 화면 픽셀 / 월드 px — 캐릭터·이펙트는 이 밀도(32×40 치비 = 1칸 × 1.25칸)
const SIDE = 2;                           // 격자 양옆 패럴랙스 바위 칸 수 (가로 화면에서 보인다)
const GX = SIDE * T, GY = 48;             // 구획(격자) 왼쪽 위 (지상 띠 48px = 3칸)
const WW = GX * 2 + GW * T;               // 256
const COLS = WW / T;
const SURFACE_Y = 40;                     // 지상 땅 윗면
const SHED_X = 190;                       // 창고 문 앞
const SHAFT_TOP_X = 76;                   // 지상 권양기 도르래 케이블
let GH = 10, WH = GY + GH * T + T, ROWS = WH / T;   // 구획마다 바뀜 (S 10 · M 14 · L 16줄)

// 칸 문자 (src/gen.js): d 흙 · r 바위 · h 단단한 바위 · a 고대석 · C s g j c 광석 · w 지하수 · x 가스 · R 유물 · o 동굴 · . 갱도
let W = null;                             // 지금 구획: { rows, g: char[][], ladder, water, veins }
const ORE_KEYS = new Set(ORE_TYPES);
const LIP = {                                                     // 드러난 윗면 테두리 (shaft.px.js 팔레트)
  d: [0x8a6c52, 0x6e5440], r: [0xa3a2b6, 0x7c7a92], h: [0x3e3848, 0x2a2634], B: [0x3e3848, 0x2a2634], a: [0x5a5770, 0x3e3848],
  C: [0xe0a060, 0x7c7a92], s: [0xe8ecf8, 0x7c7a92], g: [0xf5cf6a, 0xd39a3a], c: [0x6fe0d8, 0x7c7a92], j: [0xc98af0, 0x7c7a92],
  w: [0x5a7ac0, 0x3d5a9a], x: [0x9cc45a, 0x6a9a3a], R: [0x8a6c52, 0x6e5440], o: [0x3e3848, 0x2a2634], fog: [0x8a6c52, 0x6e5440],
};
const DEBRIS = {
  d: [0x55402f, 0x6e5440, 0x3a2a22, 0x8a6c52], r: [0x5a5770, 0x7c7a92, 0x3d3a4c], h: [0x3e3848, 0x2a2634, 0x5a5770],
  C: [0xb87a4a, 0xe0a060, 0x5a5770], s: [0x9aa0b8, 0xe8ecf8, 0x5a5770], g: [0xd39a3a, 0xf5cf6a, 0x8a5a24, 0x5a5770],
  c: [0x2fa09a, 0x6fe0d8, 0x5a5770], j: [0x8a4ab0, 0xc98af0, 0x5a5770], B: [0x3e3848, 0x2a2634],
  w: [0x3d5a9a, 0x5a7ac0, 0xf4ecd2], x: [0x46702e, 0x6a9a3a], R: [0x7d5040, 0xd39a3a], o: [0x3e3848, 0x2a2634], a: [0x3e3848, 0x5a5770],
};
const isDug = (gx, gy) => !!W && gy >= 0 && gy < W.rows && gx >= 0 && gx < GW && W.g[gy][gx] === '.';
/** 세계 칸(열, 행) → 'sky' | 칸 문자 | 'B'(바깥 암반: 양옆 · 맨 아래) */
function cellAt(cx, cy) {
  if (cy < GY / T) return 'sky';
  const gx = cx - GX / T, gy = cy - GY / T;
  if (W && gx >= 0 && gx < GW && gy >= 0 && gy < W.rows) return W.g[gy][gx];
  return 'B';
}
const isSolid = (ch) => ch !== 'sky' && ch !== '.';

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
// 회사 부지 (art/buildings.px.js): 건물 × Lv1/3/5 + 장식
const BLD_ART = { office: 'office', warehouse: 'warehouse', cartShed: 'cartshed', lodge: 'lodge', smelter: 'smelter', lanternShop: 'lanternshop', pumpRoom: 'pump', turretShop: 'turretshop', moleHouse: 'molehome' };
const DECO_ART = { campfire: 'deco_fire', flag: 'deco_flag', well: 'deco_well', flowers: 'deco_garden', scales: 'deco_scale', railDeco: 'deco_rail' };
const DECO_ANIM = new Set(['deco_fire', 'deco_flag']);
const SPRITES = [...Object.values(BLD_ART).flatMap((b) => [1, 3, 5].map((l) => `${b}_${l}`)), ...Object.values(DECO_ART).filter((d) => !DECO_ANIM.has(d)), 'dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'gem',
  'ancient', 'pocket_water', 'pocket_gas', 'relic_chest', 'cave', 'ladder', 'mark_x', 'ore_bits', 'star',
  'tunnel', 'tunnel_beam', 'rail', 'side_far', 'side_mid', 'side_fg',
  'sky_far', 'deep_far', 'deep_mid', 'deep_fg', 'bubble_dig', 'bubble_walk', 'bubble_rest',
  'icon_gold', 'icon_glow', 'icon_silver', 'icon_copper', 'icon_gem', 'hint_rock', 'hint_water', 'hint_relic', 'hint_glow',
  'cart_gold', 'cart_empty', 'npc_halabeoji', 'npc_momo', 'npc_brok', 'npc_merchant', 'npc_guild_abyss', 'npc_guild_tower', 'npc_guild_shield'];
const NORMALS = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'ancient', 'pocket_water', 'pocket_gas', 'relic_chest'];
const FX = ['fx_hit', 'fx_dirt', 'fx_rock', 'fx_vein', 'fx_vein_glow', 'fx_daebak', 'fx_gas', 'fx_water', 'fx_collapse', 'fx_cart', 'fx_pulse'];
const ANIMS = ['ore_glow', 'gold_shimmer', 'lantern', 'red_idle', 'red_walk', 'red_swing', 'brown_idle', 'brown_walk',
  'blonde_idle', 'blonde_walk', 'mole_sniff', 'cart_roll', 'cart_roll_empty', 'cart_roll_glow', 'slime', 'deco_fire', 'deco_flag', ...FX];
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
const HINT_ICON = { rock: 'hint_rock', water: 'hint_water', relic: 'hint_relic', glow: 'hint_glow' };
const HINT_TEXT = { rock: '바위층', water: '지하수', relic: '유물 흔적', glow: '발광 이끼' };
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
const skyA = new Container(), deepA = new Container(), normalBase = new Graphics();
wA.addChild(skyA, deepA);
para('sky_far', skyA, -320, -240, WW + 640, 240 + GY, 0.2);                 // 위: 지상 위로 이어지는 밤하늘
skyA.addChild(new Sprite(loaded[A('scenes/surface.png')]));                  // 지상: pxl이 구운 조명 그대로
wN.addChild(normalBase);

const tilesA = new Container(), tilesN = new Container();
const shimmerA = new Container(), crackG = new Graphics(), edgeA = new Graphics(), edgeN = new Graphics();
const propsA = new Container(), propsN = new Container(), overA = new Graphics();
const shadowsA = new Container(), charsA = new Container(), fxA = new Container(), dustA = new Container();
wA.addChild(tilesA, shimmerA, crackG, edgeA, propsA, overA, shadowsA, charsA, fxA, dustA);
wN.addChild(tilesN, edgeN, propsN);

const lampsU = new Container(), halosU = new Container(), fxU = new Container(), sparksU = new Container(), fgU = new Container(), markU = new Container();
wU.addChild(lampsU, halosU, fxU, sparksU, markU, fgU);

// ---------------------------------------------------------------- 헤일로
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = Texture.from(c); t.source.scaleMode = 'linear'; return t;
})();
function halo(color, size, alpha, parent = halosU) {
  const s = new Sprite(haloTex); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = color;
  s.width = s.height = size; s.alpha = alpha; s.baseAlpha = alpha; parent.addChild(s); return s;
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

// ---------------------------------------------------------------- 구획 세계 만들기 (경매에서 낙찰한 카드 → 격자 · 겹 · 조명 격자)
const tiles = new Map();      // "gx,gy" → { a, n, extra }
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const TILE_NAME = {
  d: (x, y) => `dirt_${1 + (hash(x, y) % 3)}`, r: () => 'rock', h: () => 'hard_rock', B: () => 'hard_rock', a: () => 'ancient',
  C: () => 'ore_copper', s: () => 'ore_silver', g: () => 'ore_gold', c: () => 'ore_glow', j: () => 'gem',
  w: () => 'pocket_water', x: () => 'pocket_gas', R: () => 'relic_chest', o: () => 'cave', '.': () => 'tunnel',
};
let glowTiles = [];
const xray = new Map();       // "gx,gy" → 보이는 끝 시각 (투시 랜턴)
let solidCanvas = document.createElement('canvas'), solidTex = Texture.from(solidCanvas);
solidTex.source.scaleMode = 'linear';

/** 드러난 칸인가: 뚫렸거나 뚫린 칸과 맞닿았거나 투시 중 (명세2 §4 "격자는 전부 가려진 흙") */
function revealed(gx, gy) {
  if (isDug(gx, gy)) return true;
  if (S.round?.state === 'RESULT') return true;
  if ((xray.get(`${gx},${gy}`) ?? 0) > time) return true;
  if (seenCells.has(`${gx},${gy}`)) return true;
  return isDug(gx - 1, gy) || isDug(gx + 1, gy) || isDug(gx, gy - 1) || isDug(gx, gy + 1);
}
/** 화면에 보이는 칸 문자 (가려진 칸은 흙으로) */
function shownAt(cx, cy) {
  const ch = cellAt(cx, cy);
  if (ch === 'sky' || ch === 'B' || ch === '.') return ch;
  const gx = cx - GX / T, gy = cy - GY / T;
  return revealed(gx, gy) ? ch : 'fog';
}

function placeTile(cx, cy) {
  const ch = shownAt(cx, cy);
  if (ch === 'sky') return;
  const gx = cx - GX / T;
  if (ch === 'B' && (gx < 0 || gx >= GW)) return;          // 양옆은 패럴랙스 겹이 맡는다
  const name = ch === 'fog' ? TILE_NAME.d(cx, cy) : TILE_NAME[ch](cx, cy);
  const a = new Sprite(name === 'ore_glow' ? F.ore_glow[0] : tex(name));
  a.position.set(cx * T, cy * T);
  if (ch === 'B') a.tint = 0x8a849c;
  if (ch === 'o') a.tint = 0x9a90b0;
  tilesA.addChild(a);
  const t = { a, n: null, extra: [], ch };
  if (NORMALS.includes(name)) { t.n = new Sprite(ntex(name)); t.n.position.set(cx * T, cy * T); tilesN.addChild(t.n); }
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
/** 한 칸과 이웃의 그림을 다시 (뚫리거나 드러나면) */
function refreshAround(gx, gy, r = 1) {
  for (let y = gy - r; y <= gy + r; y++) for (let x = gx - r; x <= gx + r; x++) {
    const cx = x + GX / T, cy = y + GY / T;
    if (cy < GY / T || cy >= ROWS || cx < 0 || cx >= COLS) continue;
    const t = tiles.get(`${cx},${cy}`);
    const want = shownAt(cx, cy);
    if (t && t.ch === want) continue;
    removeTile(cx, cy); placeTile(cx, cy);
  }
}

// 드러난 면: 윗면은 밝은 테두리(노멀 ↑), 옆·아랫면은 잉크 선(노멀 옆·↓) → 랜턴이 지나가면 결이 산다
function drawEdges() {
  edgeA.clear(); edgeN.clear();
  for (let cy = GY / T; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    if (isSolid(cellAt(cx, cy))) continue;
    const x = cx * T, y = cy * T;
    const below = shownAt(cx, cy + 1), above = cellAt(cx, cy - 1), left = cellAt(cx - 1, cy), right = cellAt(cx + 1, cy);
    if (isSolid(below) && below !== 'sky') {
      const [l1, l2] = LIP[below] ?? LIP.d;
      edgeA.rect(x, y + T, T, 1).fill(l1).rect(x, y + T + 1, T, 1).fill(l2);
      edgeN.rect(x, y + T, T, 2).fill(0x80e6cc);
    }
    if (isSolid(above) && above !== 'sky') { edgeA.rect(x, y - 1, T, 1).fill(0x1a1220); edgeN.rect(x, y - 2, T, 2).fill(0x801acc); }
    if (isSolid(left)) { edgeA.rect(x - 1, y, 1, T).fill(0x1a1220); edgeN.rect(x - 2, y, 2, T).fill(0xe680cc); }
    if (isSolid(right)) { edgeA.rect(x + T, y, 1, T).fill(0x2b1f35); edgeN.rect(x + T, y, 2, T).fill(0x1a80cc); }
  }
}
// 고체 격자 → 빛이 바위에 막히는 정도 (칸당 1텍셀, 선형 보간으로 가장자리가 몇 px 스민다)
function drawSolid() {
  const g = solidCanvas.getContext('2d'), img = g.createImageData(COLS, ROWS);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const v = isSolid(cellAt(cx, cy)) ? 255 : 0, i = (cy * COLS + cx) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  solidTex.source.update();
}
// 사다리 · 레일 · 물 (뚫린 칸 위에 얹는 것)
function drawProps() {
  propsA.removeChildren().forEach((c) => c.destroy());
  overA.clear();
  if (!W) return;
  for (let gy = 0; gy < W.rows; gy++) for (let gx = 0; gx < GW; gx++) {
    if (!isDug(gx, gy)) continue;
    const x = GX + gx * T, y = GY + gy * T;
    if (W.ladder[gy][gx]) { const s = new Sprite(tex('ladder')); s.position.set(x, y); propsA.addChild(s); }
    if (W.rail[gy][gx] && !isDug(gx, gy + 1)) { const s = new Sprite(tex('rail')); s.position.set(x, y + 12); propsA.addChild(s); }
  }
}

/** 구획 세계를 (다시) 짓는다: 줄 수가 바뀌면 겹·조명 격자도 */
function buildWorld() {
  const rd = S.round;
  const rows = rd ? rd.grid.length : B.plotSizes.S.rows;
  W = {
    rows,
    g: rd ? rd.grid.map((r) => r.split('')) : Array.from({ length: rows }, () => Array(GW).fill('d')),
    ladder: rd?.ladder ? rd.ladder.map((r) => r.split('').map((c) => c === '1')) : Array.from({ length: rows }, () => Array(GW).fill(false)),
    climb: rd?.climb ? rd.climb.map((r) => r.split('').map((c) => c === '1')) : Array.from({ length: rows }, () => Array(GW).fill(false)),   // 광맥을 캐낸 빈 공간: 사다리 없이 기어오름
    rail: rd?.rail ? rd.rail.map((r) => r.split('').map((c) => c === '1')) : Array.from({ length: rows }, () => Array(GW).fill(false)),
    water: rd?.water ? rd.water.map((r) => r.split('').map((c) => c === '1')) : Array.from({ length: rows }, () => Array(GW).fill(false)),
  };
  W.veins = findVeins(rd?.orig ?? W.g.map((r) => r.join('')));   // 덩어리 번호는 처음 격자 기준 (중간에 다시 열어도 같게)
  GH = rows; WH = GY + GH * T + T; ROWS = WH / T;
  // 겹(깊은 어둠 · 양옆 바위 · 앞 실루엣) 다시
  for (let k = layers.length - 1; k >= 0; k--) if (layers[k].s.parent !== skyA) { layers[k].s.destroy(); layers.splice(k, 1); }
  para('deep_far', deepA, -320, WH - 8, WW + 640, 300, 0.2);
  para('deep_mid', deepA, -320, WH + 4, WW + 640, 64, 0.5);
  for (const [n, f] of [['side_far', 0.2], ['side_mid', 0.5]]) { para(n, deepA, 0, GY, GX, WH - GY, f); para(n, deepA, WW - GX, GY, GX, WH - GY, f, { flip: true }); }
  for (const [x, flip] of [[0, false], [WW - GX, true]]) para('side_fg', fgU, x, GY, GX, WH - GY, 1.3, { flip, tint: 0x2a2232 });
  para('deep_fg', fgU, -320, WH + 30, WW + 640, 32, 1.3, { tint: 0x2a2232 });
  normalBase.clear().rect(0, GY, WW, WH - GY).fill(0x8080ff);
  // 타일
  for (const key of [...tiles.keys()]) { const [cx, cy] = key.split(',').map(Number); removeTile(cx, cy); }
  glowTiles = [];
  for (let cy = GY / T; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) placeTile(cx, cy);
  solidCanvas = document.createElement('canvas'); solidCanvas.width = COLS; solidCanvas.height = ROWS;
  solidTex.destroy(true); solidTex = Texture.from(solidCanvas); solidTex.source.scaleMode = 'linear';
  drawEdges(); drawSolid(); drawProps();
  if (L) layout();
}

// ---------------------------------------------------------------- 랜턴 (끌고 다니는 조명 · 가스 폭발 꼼수)
const LANTERN_FLAME = [-0.5, 4];          // 고리(위 가운데) 기준 불꽃 위치
const lantern = { x: GX + 3 * T + 8, y: SURFACE_Y - 14, ang: 0, vel: 0 };
const lanternS = new Sprite(F.lantern[0]); lanternS.anchor.set(0.5, 0); lampsU.addChild(lanternS);
const lanternHalo = halo(0xffa050, 30, 0.5);
const lanternFlame = () => {
  const [ox, oy] = LANTERN_FLAME, c = Math.cos(lantern.ang), s = Math.sin(lantern.ang);
  return [lantern.x + ox * c - oy * s, lantern.y + ox * s + oy * c];
};

// ---------------------------------------------------------------- 캐릭터 · 광차 (치비 32×40 → 월드 16×20) + 긴 그림자
const ANCHOR_X = { red_swing: 16 / 46 };
const actors = [];
function actor(o) {
  const s = new Sprite(); s.anchor.set(0.5, 1);
  const sh = new Sprite(); sh.anchor.set(0.5, 1); sh.tint = 0x000000; sh.alpha = 0.35;
  shadowsA.addChild(sh); charsA.addChild(s);
  const a = { s, sh, face: 1, p: player(o.anim), shadow: true, tint: 0xffffff, scale: 1 / DENS, ...o };
  actors.push(a);
  return a;
}
function setAnim(a, name) { if (a.p.name !== name) a.p = player(name); }
// 그림자: 랜턴 반대쪽으로 기울여 뒷벽에 길게. 랜턴이 가까울수록 길고 진하다
function drawActor(a, dt, lx, ly) {
  const tx = step(a.p, dt);
  a.s.visible = a.visible !== false;
  a.s.texture = tx;
  a.s.anchor.set(ANCHOR_X[a.p.name] ?? 0.5, 1);
  a.s.scale.set(a.face * a.scale, a.scale * (a.squash ?? 1));
  a.s.position.set(Math.round(a.x * DENS) / DENS, Math.round(a.y * DENS) / DENS);
  a.s.tint = a.y < GY + 1 ? 0xe0a890 : a.tint;              // 지상(구운 해 질 녘 빛)에선 노을 색
  const sh = a.sh;
  const dx = a.x - lx, dy = a.y - 8 - ly, dist = Math.hypot(dx, dy);
  sh.visible = a.s.visible && a.shadow && !low && dist < LANTERN_R && a.y > GY;
  if (!sh.visible) return;
  sh.texture = tx; sh.anchor.copyFrom(a.s.anchor); sh.position.copyFrom(a.s.position);
  const near = Math.max(0, 1 - dist / LANTERN_R);
  sh.scale.set(a.face * a.scale, (1 + 0.6 * near) * a.scale);
  sh.skew.x = -Math.max(-1.1, Math.min(1.1, Math.atan2(dx, Math.abs(dy) + 10)));
  sh.alpha = 0.35 * Math.min(1, near * 2.5);
}
// 광부 3 (붉은 수염 · 뚱보 · 금발) · 두더지 · 광차 — 지상에서 시작
const MINERS = [
  { id: 'red', name: '붉은 수염', role: '선두 채굴', color: 0xe8823a },
  { id: 'brown', name: '뚱보', role: '운반', color: 0xb98a68 },
  { id: 'blonde', name: '금발', role: '운반 · 손 랜턴', color: 0xf5cf6a },
];
const crew = MINERS.map((m, k) => actor({ ...m, anim: `${m.id}_idle`, x: 100 + k * 16, y: SURFACE_Y + 0.5, hp: B.minerHp, state: 'idle', face: 1 }));
/** 숙소 Lv에 맞춰 광부를 늘린다 (새 광부는 운반 · 그림은 뚱보/금발 + 다른 빛깔) */
function ensureCrew() {
  while (crew.length < CF.miners) {
    const k = crew.length, base = MINERS[1 + (k % 2)];
    crew.push(actor({ ...base, name: `새내기 ${k - 2}`, role: '운반', anim: `${base.id}_idle`, x: 100 + k * 12, y: SURFACE_Y + 0.5, hp: B.minerHp, state: 'idle', face: 1, tint: k % 2 ? 0xc8d4ff : 0xffd0b8 }));
  }
}
ensureCrew();
const mole = actor({ anim: 'mole_sniff', x: 118, y: SURFACE_Y + 0.5, shadow: false, goal: undefined, wait: 0 });
const newCart = (parkX) => actor({ anim: 'cart_roll_empty', x: parkX, y: SURFACE_Y - 1, node: 'S', cargo: { C: 0, s: 0, g: 0, j: 0, c: 0 }, mode: 'park', moving: false, face: -1, path: [], idleT: 0, parkX });
const cartA = newCart(SHED_X - 30), cartB = newCart(SHED_X - 48);
const carts = [cartA, cartB];
const liveCarts = () => carts.slice(0, CF.carts);           // 광차 차고 Lv3부터 2대
let cart = cartA;                                           // 지금 다루는 광차 (광차 함수들은 이 이름을 본다)
const cable = new Graphics(); charsA.addChild(cable);
const bubble = new Sprite(tex('bubble_dig')); lampsU.addChild(bubble); bubble.visible = false;
const headHalo = halo(0xfff0a0, 8, 0.6);

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
const stash = S.warehouse;
const market = createMarket(S.prices ?? undefined);
S.prices = market;
const applyMarketFx = () => { market.warnSec = CF.surgeWarn; market.penalty = CF.penalty ?? undefined; };
applyMarketFx();                                        // 저장 시 market.toJSON()
const buyer = () => S.settings.buyer ?? 'merchant';
S.ingots ??= { C: 0, s: 0, g: 0, j: 0, c: 0 };
S.smelt ??= { queue: [], jobs: [] };
const ingotPrice = (key) => {
  const coef = 1 + (market.coef[key] - 1) * B.company.ingotVolatility;
  return Math.max(1, Math.round(B.basePrice[key] * coef * B.company.smeltMul * market.buyerMul(key, buyer()) * CF.sellMul));
};
function updateSmelt() {
  const sm = S.smelt, nowMs = Date.now(), dur = CF.smeltSec * 1000;
  if (!CF.smeltSlots) return;
  let changed = false;
  sm.jobs.sort((p, q) => p.doneAt - q.doneAt);
  while (sm.jobs.length && sm.jobs[0].doneAt <= nowMs) {        // 끝난 칸 → 괴, 그 자리에서 다음 광석 (끝난 시각부터)
    const j = sm.jobs.shift(); S.ingots[j.key]++; changed = true; count('ingots');
    if (sm.queue.length) { sm.jobs.push({ key: sm.queue.shift(), doneAt: j.doneAt + dur }); sm.jobs.sort((p, q) => p.doneAt - q.doneAt); }
  }
  while (sm.jobs.length < CF.smeltSlots && sm.queue.length) { sm.jobs.push({ key: sm.queue.shift(), doneAt: nowMs + dur }); changed = true; }
  if (changed) refreshUI();
}
function smeltOne(key, all = false) {
  const n = all ? stash[key] : Math.min(1, stash[key]);
  if (!n) return;
  stash[key] -= n; for (let i = 0; i < n; i++) S.smelt.queue.push(key);
  sfx('stash', true); updateSmelt(); refreshUI();
}
function sellIngots(key) {
  const n = S.ingots[key]; if (!n) return;
  const gain = n * ingotPrice(key); S.ingots[key] = 0; S.gold += gain; count('soldGold', gain);
  const r = ui.irows?.[key], from = r ? r.sellB.getGlobalPosition() : { x: L.W / 2, y: L.H / 2 };
  sfx('stash'); flyNumber('coin', from.x, from.y, gain, () => { refreshUI(); bumpCounter('coin'); });
  refreshUI();
}
let sellMode = 'ore';
const priceOf = (key) => Math.round(market.price(key, buyer(), now()) * CF.sellMul);

// ---------------------------------------------------------------- 주스
let shake = 0, shakeAmp = 0, hitstop = 0, slowmo = 0, flash = 0, boom = null;
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

// ================================================================ 라운드 상태 기계 (명세2 §2)
// AUCTION → SURVEY → DIG ⇄ (판매 탭) → RESULT → AUCTION
let time = 0;
const state = () => S.round?.state ?? 'AUCTION';
const AU = { phase: 'pick', card: null, high: 0, holder: null, log: [], timer: 0, queue: [], say: [null, null, null], me: null };   // 경매 진행(저장 안 함)

function todayCards() {
  if (!S.auction || S.auction.day !== S.day) S.auction = { day: S.day, cards: makeCards(newSeed(), CF.plotSizes, CF.hints, S.floorUnlocked >= 2) };
  return S.auction.cards;
}
function startAuction() {
  S.round = null;
  AU.phase = 'pick'; AU.card = null; AU.log = []; AU.queue = [];
  W = null; buildWorld();
  for (const a of crew) resetCrewMember(a);
  piles = [];
  todayCards(); save(); buildUI();
  setTimeout(() => { if (state() === 'AUCTION' && !AU.card && !welcome) toast(AUCTIONEER.start, 'halabeoji', 2.5); }, 400);
}
/** 낙찰(또는 공짜 구획) → 격자 생성 → 탐사 */
function startRound(card, bid) {
  const grid = generate(card);
  const blank = () => grid.map(() => '0'.repeat(GW));
  S.gold -= bid;
  S.round = {
    state: 'SURVEY', card, bid, grid, orig: grid.slice(), ladder: blank(), climb: blank(), rail: blank(), water: blank(),
    startedAt: now(), surveyLeft: CF.surveySec, xrayLeft: CF.xrayPerDay,
    stats: { revenue: 0, maxVein: 0, relics: 0, relicGold: 0, events: [], jackpots: 0 },
    jobs: [], claimed: [], piles: [], gasUntil: 0,
  };
  piles = []; seenCells = new Set();
  for (const a of crew) resetCrewMember(a);
  for (const c of carts) Object.assign(c, { node: 'S', x: c.parkX, y: SURFACE_Y - 1, mode: 'park', path: [], cargo: { C: 0, s: 0, g: 0, j: 0, c: 0 }, trips: 0 });
  ensureCrew();
  S.auction = null;
  buildWorld();
  mole.x = GX + 8; mole.goal = undefined; mole.wait = 0.5;
  save(); buildUI();
  tutorialDone(1);
  toast(card.free ? '공짜 구획이에요. 힌트는 없어요' : `${card.name} 낙찰! 두더지가 냄새를 맡아요`, 'momo');
}
function resetCrewMember(a) {
  a.node = 'S'; a.x = 100 + crew.indexOf(a) * 16; a.y = SURFACE_Y + 0.5; a.path = []; a.job = null; a.carrying = null; a.fall = null; a.busy = null; a.hp = a.hp || B.minerHp; a.state = 'idle';
  setAnim(a, `${a.id}_idle`);
}
function startDig() {
  if (!S.round) return;
  S.round.state = 'DIG';
  tutorialDone(2);
  S.round.surveyLeft = 0;
  xray.clear();
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) refreshAround(gx, gy, 0);
  save(); buildUI();
}
let confirmRetreat = false;
function askRetreat() { confirmRetreat = true; buildUI(); }
const oreLeft = () => (W ? W.g.flat().filter((c) => ORE_KEYS.has(c)).length : 0);
/** 라운드 끝: [철수] 또는 광맥 전부 고갈 → 결과 카드 */
function endRound(reason = 'retreat') {
  const rd = S.round;
  if (!rd || rd.state === 'RESULT') return;
  confirmRetreat = false;
  rd.state = 'RESULT'; rd.reason = reason;
  rd.endedAt = now();
  const profit = rd.stats.revenue + rd.stats.relicGold - rd.bid;
  const base = rd.bid || B.plotSizes[rd.card.size].price;          // 공짜 구획은 그 크기 시작가 기준으로 별
  rd.stats.profit = profit;
  rd.stats.stars = B.stars.filter((t) => profit / base >= t).length;
  if (rd.stats.stars >= 3) {                                     // ★3 10회마다 특성 포인트 +1
    const before = talentPoints(S); S.stats.star3 = (S.stats.star3 ?? 0) + 1;
    if (talentPoints(S) > before) setTimeout(() => toast('★3 열 번! 특성 포인트 +1', 'halabeoji', 3), 800);
  }
  // 방치 대상 (명세3 §1-1): 남은 광맥 칸. 다 캤으면 0 → 새 라운드를 돌아야 방치 수입이 이어진다
  const lo = { C: 0, s: 0, g: 0, j: 0, c: 0 };
  if (W) for (const row of W.g) for (const ch of row) if (ORE_KEYS.has(ch)) lo[ch]++;
  S.idle.leftover = lo;
  tutorialDone(6);
  recordWeek(rd);
  count('rounds'); if (rd.stats.stars >= 2) count('star2');
  save(); buildUI(); cloudSoon();
}
function nextAuction() {
  const rd = S.round;
  S.stats.rounds++; S.stats.profitTotal += rd.stats.profit; S.stats.bestVein = Math.max(S.stats.bestVein, rd.stats.maxVein);
  S.auction = null;                                                // 라운드가 끝나면 바로 새 경매
  startAuction();
}

// ---------------------------------------------------------------- 방치 정산 + 「돌아오셨군요」 카드 (명세3 §1)
let welcome = null;                                     // 정산 요약 (카드가 떠 있는 동안)
const idleHi = new Set(); let idleHiUntil = 0;          // [광종별로 고르기] → 판매 행 하이라이트
const advanceClock = (sec) => { S.tick += sec; while (S.tick >= TICK_PER_DAY) { S.tick -= TICK_PER_DAY; S.day++; } };
function settleOffline(boot = false) {
  const r = computeOffline(S, {
    market, gameNow: now, advanceClock,
    miners: CF.miners, pickGrade: CF.pick, capHours: CF.capHours, whRoom: whCap() - whTotal(), rateMul: CF.idleMul,
  });
  if (!r) return null;
  if (r.midRound) { if (!boot) toast(`라운드 이어 하기 — ${S.round.card.name}`, 'momo', 3); return r; }
  if (r.pendingTotal > 0 || r.missed.length) welcome = r;
  save(); cloudSoon();
  if (!boot) buildUI();
  return r;
}
const pendingOf = () => ORES.filter((o) => S.idle.pending[o.key] > 0);
const idleValue = () => pendingOf().reduce((a, o) => a + S.idle.pending[o.key] * priceOf(o.key), 0);
function closeWelcome() { welcome = null; save(); buildUI(); cloudSoon(); }
function idleSellAll(from) {
  const gain = idleValue();
  for (const o of ORES) S.idle.pending[o.key] = 0;
  count('idleClaims'); if (gain) count('soldGold', gain);
  if (gain) { S.gold += gain; S.stats.idleSold = (S.stats.idleSold ?? 0) + gain; sfx('stash'); flyNumber('coin', from.x, from.y, gain, () => { refreshUI(); bumpCounter('coin'); }); }
  closeWelcome();
}
/** 창고로. 넘치는 건 자동 판매 */
function idleStore(highlight) {
  let gain = 0;
  count('idleClaims');
  idleHi.clear();
  for (const o of ORES) {
    const p = S.idle.pending[o.key]; if (!p) continue;
    const put = Math.min(p, Math.max(0, whCap() - whTotal()));
    stash[o.key] += put; gain += (p - put) * priceOf(o.key);
    S.idle.pending[o.key] = 0;
    idleHi.add(o.key);
  }
  if (gain) { S.gold += gain; toast(`창고가 꽉 차서 넘친 건 팔았어요 +${gain}`, 'brok'); }
  sfx('stash');
  if (highlight) { idleHiUntil = time + 6; if (L.portrait) { sheetTab = 'sell'; S.settings.sheetFolded = false; } }
  closeWelcome();
  if (highlight && L.portrait) layout();
}
const dur = (sec) => { const m = Math.round(sec / 60), h = Math.floor(m / 60); return h ? `${h}시간 ${m % 60}분` : `${m}분`; };
function whenText(day, tick) {
  const hr = (tick / TICK_PER_DAY) * 24;
  const part = hr < 6 ? '새벽' : hr < 11 ? '아침' : hr < 14 ? '낮' : hr < 18 ? '오후' : hr < 21 ? '저녁' : '밤';
  return `${day === S.day ? '오늘' : day === S.day - 1 ? '어제' : `${day}일차`} ${part}`;
}
function makeWelcome() {
  const r = welcome, uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS);
  const box = new Container();
  const dim = new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.6 }); dim.eventMode = 'static'; box.addChild(dim);
  const w = Math.min(uW - 12, 250), ink = { color: COLOR.paperInk, shadow: false };
  const c = new Container(); box.addChild(c);
  const pf = portraitFrame(tex(NPC.halabeoji), 32, 'wood'); pf.position.set(6, 6); c.addChild(pf);
  const t = label('돌아오셨군요!', ink); t.position.set(44, 8); c.addChild(t);
  const a = label(`떠난 지 ${dur(r.away)}`, { ...ink, small: true, color: 0x8a7a68 }); a.position.set(44, 23); c.addChild(a);
  let y = 44;
  const rows = pendingOf();
  if (rows.length) {
    const head = label('캐 둔 것 · 지금 시세 · 떠난 뒤', { ...ink, small: true, color: 0x8a7a68 }); head.position.set(8, y); c.addChild(head); y += 13;
    for (const o of rows) {
      const n = S.idle.pending[o.key], pr = priceOf(o.key);
      const pct = Math.round((market.coef[o.key] / (r.before[o.key] || 1) - 1) * 100);
      const ic = icon(tex(ICON[o.key])); ic.position.set(10, y + 2); c.addChild(ic);
      const nm = label(`${o.name} ×${n}`, { ...ink, small: true }); nm.position.set(22, y); c.addChild(nm);
      const pv = label(String(pr), { ...ink, small: true }); pv.position.set(Math.round(w * 0.5), y); c.addChild(pv);
      if (pct) { const ar = icon(kit(pct < 0 ? 'arrow_down' : 'arrow_up')); ar.position.set(Math.round(w * 0.5) + 22, y + 2); c.addChild(ar); }
      const pc = label(`${pct > 0 ? '+' : ''}${pct}%`, { ...ink, small: true, color: pct > 0 ? 0x46702e : pct < 0 ? 0xb84a62 : 0x8a7a68 }); pc.position.set(w - 10 - Math.ceil(pc.width), y); c.addChild(pc);
      y += 13;
    }
    let sum = label(`예상 매출 ${rows.map((o) => S.idle.pending[o.key] * priceOf(o.key)).join(' + ')} = ${idleValue().toLocaleString()}`, { ...ink, small: true });
    if (sum.width > w - 16) { sum.destroy(); sum = label(`예상 매출 ${idleValue().toLocaleString()}`, { ...ink, small: true }); }
    sum.position.set(8, y + 2); c.addChild(sum); y += Math.ceil(sum.height) + 6;
  } else { const n0 = label('광부들이 캐 둔 건 없어요', { ...ink, small: true }); n0.position.set(8, y); c.addChild(n0); y += 15; }
  const notes = [];
  if (r.capped) notes.push(`광부들이 ${CF.capHours}시간 넘게 기다렸어요`);
  if (r.whFull) notes.push('창고가 꽉 차서 멈췄어요. 창고를 늘려 보세요');
  if (r.exhausted) notes.push('남은 광맥을 다 캤어요. 새 구획을 사야 계속 캐요');
  else if (!Object.values(S.idle.leftover).some(Boolean)) notes.push('캘 광맥이 없어요. 철수할 때 남긴 광맥을 광부들이 캐요');
  if (r.missed.length) { const m = r.missed[r.missed.length - 1], o = ORES.find((q) => q.key === m.key); notes.push(`${whenText(m.day, m.tick)} ${o.name} 시세가 ×${B.surgeMul} 갔어요 (놓침)${r.missed.length > 1 ? ` 외 ${r.missed.length - 1}번` : ''}`); }
  for (const s of notes) { const l = label(s, { ...ink, small: true, color: 0x8a5a24, wrap: w - 16 }); l.position.set(8, y); c.addChild(l); y += Math.ceil(l.height) + 2; }
  y += 4;
  const bw = w - 16;
  if (rows.length) {
    const sellB = button('wood', bw, 20, `지금 팔기 ${idleValue().toLocaleString()}`, () => { unlockAudio(); idleSellAll(sellB.getGlobalPosition()); });
    sellB.position.set(8, y); c.addChild(sellB); y += 24;
    const hw = Math.floor((bw - 4) / 2);
    const st = button('paper', hw, 18, '창고에 두기', () => idleStore(false), { small: true }); st.position.set(8, y); c.addChild(st);
    const pk = button('paper', hw, 18, '골라 팔기 ▸', () => idleStore(true), { small: true }); pk.position.set(12 + hw, y); c.addChild(pk); y += 22;
    const ad = button('stone', bw, 16, '광고 보고 방치 2배 받기 · 준비 중', () => toast('곧 열려요'), { small: true }); ad.alpha = 0.6; ad.position.set(8, y); c.addChild(ad); y += 20;
  } else { const ok = button('wood', bw, 20, '확인', closeWelcome); ok.position.set(8, y); c.addChild(ok); y += 24; }
  const foot = label(state() === 'RESULT' ? '라운드 결과를 보고 다음 경매로' : '오늘 경매 준비됐어요', { ...ink, small: true, color: 0x8a7a68 });
  foot.position.set(Math.round((w - foot.width) / 2), y); c.addChild(foot); y += 14;
  c.addChildAt(frame('paper', w, y + 4, 'panel'), 0);
  c.position.set(Math.round((uW - w) / 2), Math.max(4, Math.round((uH - y) / 2)));
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
}

// ================================================================ 일일 과제 (명세3 §6 — 체크인 daybook.ts)
function count(k, n = 1) {
  S.counters ??= {};
  S.counters[k] = (S.counters[k] ?? 0) + n;
  for (const t of checkDaybook(S)) {
    setTimeout(() => { toast(`과제 완료! ${dayDef(t.id).text(t.n)} · 금화 +${t.reward}`, 'momo', 3); sfx('bell'); bumpCounter('coin'); refreshUI(); if (sheetTab === 'day') buildUI(); }, 300);
  }
}
/** 날이 바뀌면 새 과제 — 모모 편지 */
function checkNewDay() {
  if (rollDaybook(S)) { setTimeout(() => toast('모모 편지: 오늘의 과제 3개가 왔어요! [과제]에서 봐요', 'momo', 4), 1500); save(); if (sheetTab === 'day') buildUI(); }
}
setTimeout(checkNewDay, 0);                              // 모듈이 다 읽힌 뒤
setInterval(checkNewDay, 60 * 1000);
function makeDaybook(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const t = label('오늘의 과제', { ...ink, color: 0x8a5a24 }); t.position.set(6, 4); c.addChild(t);
  const rowH = Math.max(18, Math.min(30, Math.floor((h - 22) / 3)));
  (S.daybook?.tasks ?? []).forEach((tk, i) => {
    const d = dayDef(tk.id); if (!d) return;
    const y = 20 + i * rowH, p = progress(S, tk);
    const box = new Graphics().rect(6, y + 2, 9, 9).stroke({ width: 1, color: 0x8a6c52 });
    if (tk.done) box.moveTo(7, y + 6).lineTo(10, y + 9).lineTo(15, y + 1).stroke({ width: 2, color: 0x46702e });
    c.addChild(box);
    const l = label(d.text(tk.n), { ...ink, small: true, color: tk.done ? 0x8a7a68 : COLOR.paperInk }); l.position.set(19, y + 1); c.addChild(l);
    const r = label(tk.done ? `+${tk.reward} 받음` : `${Math.max(0, p)}/${tk.n} · +${tk.reward}`, { ...ink, small: true, color: tk.done ? 0x46702e : 0x8a7a68 });
    if (rowH >= 24) r.position.set(19, y + 11); else r.position.set(w - 6 - Math.ceil(r.width), y + 1);
    c.addChild(r);
    if (rowH < 24 && l.x + l.width > r.x - 4) l.scale.set(Math.max(0.6, (r.x - 4 - l.x) / l.width));
  });
  return c;
}

// ================================================================ 계정 · 클라우드 저장 · 주간 랭킹 (명세3 §4 — 체크인 net/server.ts · sync.ts)
let cloudReady = false, pushing = false, cloudT = 0, cloudChoice = null, rankView = null;
async function pushNow() {
  if (!online() || !cloudReady || pushing || !saving) return;
  pushing = true;
  try { syncRound(); S.savedAt = Date.now(); writeSave(S); await pushSave(S, SAVE_VERSION); } catch { /* 다음에 다시 */ } finally { pushing = false; }
}
const cloudSoon = () => { clearTimeout(cloudT); cloudT = setTimeout(pushNow, 1500); };
setInterval(pushNow, 5 * 60 * 1000);
window.addEventListener('pagehide', () => void pushNow());
const progressOf = (d) => (d.company?.coreLv ?? 1) * 1000 + (d.stats?.rounds ?? 0);
/** 로그인 직후: 클라우드가 더 진행됐으면 묻고, 아니면 이 기기 것을 올린다 (체크인 compareSaves) */
async function afterLogin() {
  S.account.userId = me.profile.id; S.account.nickname = me.profile.nickname;
  try {
    const sv = await pullSave();
    const d = sv?.data;
    if (d && typeof d.v === 'number' && d.v <= SAVE_VERSION) {
      const same = d.gold === S.gold && d.day === S.day && d.stats?.rounds === S.stats.rounds;
      if (!same && progressOf(d) > progressOf(S)) {
        cloudChoice = { data: d, at: d.savedAt || Date.parse(sv.updated_at) };
        buildUI(); return;
      }
    }
  } catch { /* 서버가 안 되면 로컬로 계속 */ }
  cloudReady = true; pushNow(); buildUI();
  toast(`${me.profile.nickname} 님, 클라우드에 저장해요`, 'momo');
}
function useCloud() {
  const d = migrate(cloudChoice.data);
  d.idle.lastSeen = Date.now();
  saving = false; writeSave(d); location.reload();
}
function keepLocal() { cloudChoice = null; cloudReady = true; pushNow(); buildUI(); toast('이 기기 것을 클라우드에 올렸어요', 'momo'); }
async function doLogout() { await pushNow(); await logout(); cloudReady = false; S.account.userId = null; S.account.nickname = null; save(); buildUI(); toast('로그아웃했어요 (이 기기엔 그대로 남아요)'); }
function makeCloudChoice() {
  const d = cloudChoice.data, uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS), w = Math.min(uW - 12, 250);
  const box = new Container();
  const dim = new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.7 }); dim.eventMode = 'static'; box.addChild(dim);
  const c = new Container(); box.addChild(c);
  const ink = { color: COLOR.paperInk, shadow: false };
  const h = 150;
  c.addChild(frame('paper', w, h, 'panel'));
  const t = label('클라우드에 더 진행된 저장이 있어요', { ...ink, wrap: w - 16 }); t.position.set(8, 8); c.addChild(t);
  const row = (y, name, x) => { const l = label(`${name}: 사무소 Lv${x.company?.coreLv ?? 1} · ${x.stats?.rounds ?? 0}라운드 · 금화 ${x.gold} · ${x.day}일차`, { ...ink, small: true, wrap: w - 16 }); l.position.set(8, y); c.addChild(l); };
  row(40, '클라우드', d); row(66, '이 기기', S);
  const a = button('wood', w - 16, 20, '클라우드 것 불러오기', useCloud); a.position.set(8, h - 52); c.addChild(a);
  const b = button('paper', w - 16, 18, '이 기기 것 올리기 (클라우드 덮어씀)', keepLocal, { small: true }); b.position.set(8, h - 28); c.addChild(b);
  c.position.set(Math.round((uW - w) / 2), Math.round((uH - h) / 2));
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
}
/** 로그인 창 (글자 입력이라 DOM) — 아이디 + 비밀번호 · 비밀번호 찾기(복구 코드) */
function openLoginForm() {
  document.getElementById('login')?.remove();
  const el = document.createElement('div'); el.id = 'login';
  el.innerHTML = `<form>
    <b>체크인 계정으로 로그인</b>
    <small>「모험의 유산」 아이디·비밀번호 그대로예요. 가입은 모험의 유산에서.</small>
    <input name="id" placeholder="아이디" autocomplete="username" autocapitalize="none" spellcheck="false">
    <input name="pw" type="password" placeholder="비밀번호" autocomplete="current-password">
    <div class="rec" hidden><input name="code" placeholder="복구 코드 (XXXX-XXXX-XXXX-XXXX)"><input name="npw" type="password" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password"></div>
    <p class="msg"></p>
    <div class="row"><button type="submit">로그인</button><button type="button" class="x">닫기</button></div>
    <a href="#" class="find">비밀번호를 잊었어요</a>
  </form>`;
  document.body.appendChild(el);
  const f = el.querySelector('form'), msg = el.querySelector('.msg'), rec = el.querySelector('.rec');
  let mode = 'login';
  el.querySelector('.x').onclick = () => el.remove();
  el.querySelector('.find').onclick = (e) => { e.preventDefault(); mode = mode === 'login' ? 'recover' : 'login'; rec.hidden = mode === 'login'; f.pw.hidden = mode !== 'login'; f.querySelector('[type=submit]').textContent = mode === 'login' ? '로그인' : '비밀번호 바꾸기'; msg.textContent = ''; };
  f.onsubmit = async (e) => {
    e.preventDefault(); msg.textContent = '…';
    if (mode === 'recover') { const err = await recover(f.id.value, f.code.value, f.npw.value); msg.textContent = err ?? '바꿨어요! 새 비밀번호로 로그인하세요'; if (!err) el.querySelector('.find').click(); return; }
    const err = await login(f.id.value, f.pw.value);
    if (err) { msg.textContent = err; return; }
    el.remove(); afterLogin();
  };
  setTimeout(() => f.id.focus(), 50);
}
// 주간 기록: 이번 주 순이익 합 · 최대 광맥 · 유물 → 서버(submit_mine_rank: 더 큰 값만 남김)
function recordWeek(rd) {
  const wk = weekKey();
  if (S.rankWeek?.week !== wk) S.rankWeek = { week: wk, profit: 0, bestVein: 0, relics: 0 };
  const w = S.rankWeek;
  w.profit += rd.stats.profit; w.bestVein = Math.max(w.bestVein, rd.stats.maxVein); w.relics += rd.stats.relics;
  if (online()) submitRank(wk, w.profit, w.bestVein, w.relics).catch(() => {});
}
async function openRank(board = 'profit') {
  rankView = { board, loading: true, data: null };
  buildUI();
  try { rankView.data = await topRank(board, weekKey()); } catch { rankView.data = { rows: [], mine: null, total: 0, err: true }; }
  if (rankView) { rankView.loading = false; buildUI(); }
}
function makeRank() {
  const uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS), w = Math.min(uW - 12, 260), h = Math.min(uH - 40, 330);
  const box = new Container();
  const dim = new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.6 }); dim.eventMode = 'static'; dim.on('pointertap', () => { rankView = null; buildUI(); }); box.addChild(dim);
  const c = new Container(); box.addChild(c);
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const t = label(`주간 랭킹 ${weekKey().slice(5)}~`, ink); t.position.set(8, 6); c.addChild(t);
  const x = button('paper', 36, 14, '닫기', () => { rankView = null; buildUI(); }, { small: true }); x.position.set(w - 42, 5); c.addChild(x);
  const tw = Math.floor((w - 12) / 3);
  Object.entries(BOARDS).forEach(([k, name], i) => { const tb = tab(tw, name, () => openRank(k)); tb.setOn(rankView.board === k); tb.position.set(6 + i * tw, 22); c.addChild(tb); });
  let y = 42;
  const d = rankView.data;
  const line = (txt, col = COLOR.paperInk) => { const l = label(txt, { ...ink, small: true, color: col, wrap: w - 20 }); l.position.set(10, y); c.addChild(l); y += Math.max(12, Math.ceil(l.height) + 1); };
  if (rankView.loading) line('불러오는 중…', 0x8a7a68);
  else if (d.err) line('서버에 연결할 수 없어요', 0xb84a62);
  else {
    const unit = rankView.board === 'best_vein' ? '칸' : rankView.board === 'relics' ? '개' : '';
    if (!d.rows.length) line('아직 이번 주 기록이 없어요', 0x8a7a68);
    for (const r of d.rows.slice(0, Math.floor((h - 90) / 12))) line(`${String(r.rank).padStart(2, ' ')}. ${r.nickname}  ${r.score.toLocaleString()}${unit}`, r.user_id === me.profile?.id ? 0x46702e : COLOR.paperInk);
    y = h - 52;
    line(online() ? (d.mine ? `내 순위 ${d.mine.rank} / ${d.total} · ${d.mine.score.toLocaleString()}${unit}` : '내 기록은 라운드를 끝내면 올라가요') : '로그인하면 내 기록이 올라가요 ([설정] → 체크인 계정 로그인)', 0x8a5a24);
    line('월요일 0시(한국)에 새로 시작 · 보상은 다음 단계', 0x8a7a68);
  }
  c.position.set(Math.round((uW - w) / 2), Math.round((uH - h) / 2));
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
}

// ================================================================ 회사 화면 (명세3 §2): 부지 슬롯 + 건물 목록 시트
let view = 'mine';                                       // 'mine' | 'company'
let coPage = 'site', coTab = 'build', placing = null, coSel = null, coScroll = 0, coDragged = false;
const roundBusy = () => ['SURVEY', 'DIG'].includes(state());
const SHORT = { office: '사무', warehouse: '창고', cartShed: '차고', lodge: '숙소', smelter: '제련', lanternShop: '랜턴', pumpRoom: '펌프', turretShop: '포탑', moleHouse: '두더', campfire: '불', flag: '깃발', well: '우물', flowers: '꽃', scales: '저울', railDeco: '레일' };
const BCOL = { office: 0x8a5a24, warehouse: 0x6e5440, cartShed: 0x5a5770, lodge: 0x7d5040, smelter: 0x3e3848, lanternShop: 0x46702e, pumpRoom: 0x3d5a9a, turretShop: 0x5a3a4a, moleHouse: 0x8a6c52 };
function openCompany() { view = 'company'; placing = null; coSel = null; sfx('stash', true); buildUI(); }
function closeCompany() { view = 'mine'; placing = null; coSel = null; buildUI(); }
/** 건물·장식이 바뀌면: 숫자 다시 · 광부 늘리기 · 새 어울림 */
function refreshCompany() {
  CF = companyFx(S);
  S.idle.capHours = CF.capHours;
  if (S.company.coreLv >= B.company.mineLv && S.floorUnlocked < 2) { S.floorUnlocked = 2; S.auction = null; setTimeout(() => toast('폐광(2층)이 열렸어요! 다음 경매에 나와요', 'halabeoji', 3), 600); }
  S.talents.points = talentPoints(S); S.talents.spent = talentSpent(S);
  applyMarketFx();
  ensureCrew();
  for (const h of harmonies(S)) if (!S.company.harmoniesFound.includes(h.id)) {
    S.company.harmoniesFound.push(h.id);
    toast(`어울림 발견! ${h.name} — ${h.text}`, 'halabeoji', 3); sfx('bell');
  }
}
function coAction(kind) {
  if (coDragged) return;
  if (roundBusy()) { toast('광부들이 바빠요. 라운드가 끝나면 지어요', 'momo'); return; }
  const chk = canUp(S, kind);
  if (!chk.ok) { toast(chk.why === '금화 부족' ? '금화가 모자라요' : chk.why); return; }
  const isDeco = !!B.company.decos[kind];
  if (kind === 'office' || (!isDeco && lvOf(S, kind) > 0)) {   // 올리기 (즉시)
    S.gold -= chk.cost;
    if (kind === 'office') S.company.coreLv++; else S.company.buildings[kind].lv++;
    count('builds'); afterBuild(`${nameOf(kind)} Lv${lvOf(S, kind)}!`);
  } else { placing = { kind, cost: chk.cost, move: false }; coSel = null; toast('놓을 빈 자리를 톡!'); buildUI(); }
}
function onSlot(x, y) {
  const here = coAt(S, x, y);
  if (placing) {
    if (here) { toast('빈 자리를 골라요'); return; }
    const { kind, move } = placing;
    if (move) {
      if (B.company.decos[kind]) Object.assign(S.company.decos.find((d) => d.kind === kind), { x, y });
      else Object.assign(S.company.buildings[kind], { x, y });
    } else {
      if (S.gold < placing.cost) { toast('금화가 모자라요'); placing = null; buildUI(); return; }
      S.gold -= placing.cost;
      if (B.company.decos[kind]) S.company.decos.push({ kind, x, y });
      else S.company.buildings[kind] = { lv: 1, x, y };
    }
    placing = null;
    if (!move) count('builds');
    afterBuild(move ? `${nameOf(kind)} 옮겼어요` : `${nameOf(kind)} 지었어요!`);
    return;
  }
  coSel = here && !(coSel?.x === x && coSel?.y === y) ? { x, y, kind: here.kind } : null;
  sfx('stash', true); buildUI();
}
function afterBuild(msg) { refreshCompany(); sfx('bell'); toast(msg); bumpCounter('coin'); save(); buildUI(); cloudSoon(); }
const isNight = () => { const hr = (S.tick / TICK_PER_DAY) * 24; return hr < 6 || hr >= 19; };

function makeCompany(x, y, w, h) {
  const c = new Container(); c.position.set(x, y);
  c.addChild(frame('stone', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const t = label(w > 240 ? `회사 · 사무소 Lv${S.company.coreLv}` : `회사 Lv${S.company.coreLv}`, { color: COLOR.gold }); t.position.set(6, 4); c.addChild(t);
  if (roundBusy() && w > 230) { const b = label('라운드 중 · 보기만', { small: true, color: COLOR.dim }); b.position.set(Math.round(t.width) + 12, 6); c.addChild(b); }
  const back = button('paper', 44, 14, '광산 ▸', closeCompany, { small: true }); back.position.set(w - 48, 3); c.addChild(back);
  const left = talentLeft(S);
  const tb = button(coPage === 'talent' ? 'wood' : left > 0 ? 'wood' : 'paper', 44, 14, coPage === 'talent' ? '◂ 부지' : `특성${left > 0 ? ' ' + left : ''}`, () => { coPage = coPage === 'talent' ? 'site' : 'talent'; placing = null; coSel = null; sfx('stash', true); buildUI(); }, { small: true });
  tb.position.set(w - 96, 3); c.addChild(tb);
  if (coPage === 'talent') { const tp = makeTalents(w - 8, h - 24); tp.position.set(4, 20); c.addChild(tp); ui.coTick = null; return c; }
  const gridH = Math.floor((w - 16) / coCols(S)) * B.company.rows + 64;      // 격자가 작으면 하늘을 줄이고 목록에 자리를
  const siteH = Math.min(gridH, Math.round((h - 22) * (L.portrait ? 0.55 : 0.5)));
  const site = makeSite(w - 8, siteH); site.position.set(4, 20); c.addChild(site);
  const list = makeCoList(w - 8, h - 20 - siteH - 6); list.position.set(4, 22 + siteH); c.addChild(list);
  return c;
}
/** 부지: 하늘 · 땅 · 슬롯 격자 · 건물(임시 상자) · 광부들이 길을 걷고 두더지는 낮잠 */
function makeSite(sw, sh) {
  const c = new Container(), night = isNight();
  const nc = coCols(S), nr = B.company.rows;
  const ss = Math.max(12, Math.floor(Math.min((sw - 8) / nc, (sh - 40) / nr)));
  const gx0 = Math.round((sw - ss * nc) / 2), gy0 = sh - ss * nr - 24, roadY = sh - 6;
  const g = new Graphics();
  g.rect(0, 0, sw, sh).fill(night ? 0x14122a : 0x6a5a7c);                                   // 하늘
  if (!night) g.rect(0, gy0 - 10, sw, 4).fill({ color: 0xe0a890, alpha: 0.35 });
  else for (let i = 0; i < 14; i++) g.rect((i * 53) % sw, (i * 29) % Math.max(4, gy0 - 8), 1, 1).fill(0xf4ecd2);
  g.circle(sw * 0.8, Math.max(8, (gy0 - 10) * 0.35), 5).fill(night ? 0xf4ecd2 : 0xf5cf6a);                     // 달·해
  g.poly([0, gy0 - 4, sw * 0.18, gy0 - 22, sw * 0.4, gy0 - 8, sw * 0.62, gy0 - 28, sw * 0.85, gy0 - 10, sw, gy0 - 18, sw, gy0 - 4]).fill(night ? 0x221e38 : 0x54486a);   // 뒷산
  g.rect(0, gy0 - 4, sw, sh - gy0 + 4).fill(0x4a3a2c);                                     // 땅
  g.rect(0, gy0 - 4, sw, 2).fill(0x6a9a3a);
  g.rect(0, roadY - 2, sw, 8).fill(0x6e5440);                                              // 길
  for (let xx = 4; xx < sw; xx += 10) g.rect(xx, roadY + 1, 5, 1).fill(0x8a6c52);
  g.rect(sw - 16, roadY - 13, 14, 11).fill(0x1a1622).rect(sw - 18, roadY - 15, 18, 3).fill(0x5a5770);   // 광산 입구
  c.addChild(g);
  const sign = label('광산', { small: true, color: COLOR.dim }); sign.position.set(sw - 4 - Math.ceil(sign.width), roadY - 26); c.addChild(sign);
  const pos = (x, y) => [gx0 + x * ss, gy0 + y * ss];
  // 어울림 잇는 선
  const links = new Graphics();
  const pl = placed(S);
  for (const hm of harmonies(S)) {
    const a = pl.find((p) => p.kind === hm.a), b = pl.find((p) => p.kind === hm.b);
    if (a && b) { const [ax, ay] = pos(a.x, a.y), [bx, by] = pos(b.x, b.y); links.moveTo(ax + ss / 2, ay + ss / 2).lineTo(bx + ss / 2, by + ss / 2).stroke({ width: 1, color: 0xf5cf6a, alpha: 0.6 }); }
  }
  const smoke = [], animated = [];
  for (let yy = 0; yy < nr; yy++) for (let xx = 0; xx < nc; xx++) {
    const [px, py] = pos(xx, yy), here = coAt(S, xx, yy);
    const slot = new Graphics(); slot.position.set(px, py);
    if (!here) {
      slot.rect(1, 1, ss - 2, ss - 2).stroke({ width: 1, color: 0x8a6c52, alpha: placing ? 0.9 : 0.35 });
      if (placing) slot.rect(2, 2, ss - 4, ss - 4).fill({ color: 0x9cc45a, alpha: 0.25 });
    } else {
      const art = coArt(here.kind, here.deco ? 0 : lvOf(S, here.kind), ss);
      art.position.set(ss / 2, ss - 1); slot.addChild(art);
      if (art.anim) animated.push(art);
      if (night && !here.deco) slot.addChild(new Graphics().circle(ss / 2, ss * 0.55, ss * 0.5).fill({ color: 0xf5cf6a, alpha: 0.07 }));
      if (here.kind === 'smelter') smoke.push([px + ss * 0.62, py + ss - art.height + 2]);
      if (ss >= 30 || (coSel?.x === xx && coSel?.y === yy)) { const nm = label(SHORT[here.kind], { small: true }); nm.position.set(Math.round((ss - nm.width) / 2), ss - 10); if (nm.width > ss - 2) nm.scale.set((ss - 2) / nm.width); slot.addChild(nm); }   // 칸이 작으면 이름은 고를 때만
    }
    if (coSel && coSel.x === xx && coSel.y === yy) slot.rect(0, 0, ss, ss).stroke({ width: 1, color: 0xf5cf6a });
    slot.eventMode = 'static'; slot.cursor = 'pointer'; slot.hitArea = new Rectangle(0, 0, ss, ss);
    slot.on('pointertap', () => onSlot(xx, yy));
    c.addChild(slot);
  }
  c.addChild(links);
  // 걷는 광부 · 낮잠 두더지 · 굴뚝 연기
  const walkers = crew.slice(0, 6).map((m, i) => {
    const sp = new Sprite(F[`${m.id}_walk`][0]); sp.anchor.set(0.5, 1); sp.scale.set(0.45); sp.tint = m.tint ?? 0xffffff;
    sp.position.set(20 + i * 30, roadY + 2); c.addChild(sp);
    return { sp, id: m.id, x: 20 + i * 30, goal: 20 + Math.random() * (sw - 40), t: Math.random() * 2, f: 0 };
  });
  const mh = pl.find((p) => p.kind === 'moleHouse');
  const [mx, my] = mh ? pos(mh.x, mh.y) : [sw - 40, roadY - 10];
  const moleS = new Sprite(F.mole_sniff[0]); moleS.anchor.set(0.5, 1); moleS.scale.set(0.45); moleS.position.set(mx + (mh ? ss + 4 : 0), mh ? my + ss : roadY + 2); c.addChild(moleS);
  const zz = label('z', { small: true, color: COLOR.paper }); c.addChild(zz);
  const puffs = new Graphics(); c.addChild(puffs);
  let tt = 0;
  ui.coTick = (dt) => {
    tt += dt;
    for (const wk of walkers) {
      if (wk.sp.destroyed) return;
      if (wk.t > 0) { wk.t -= dt; wk.sp.texture = F[`${wk.id}_idle`]?.[0] ?? wk.sp.texture; continue; }
      const d = wk.goal - wk.x;
      if (Math.abs(d) < 1) { wk.t = 1 + Math.random() * 3; wk.goal = 14 + Math.random() * (sw - 40); continue; }
      wk.x += Math.sign(d) * Math.min(Math.abs(d), 14 * dt);
      wk.f += dt * 8; const fr = F[`${wk.id}_walk`]; wk.sp.texture = fr[Math.floor(wk.f) % fr.length];
      wk.sp.scale.x = 0.45 * Math.sign(d); wk.sp.x = Math.round(wk.x);
    }
    for (const sp of animated) if (!sp.destroyed) sp.texture = sp.anim[Math.floor(tt * sp.fps) % sp.anim.length];
    zz.position.set(moleS.x + 4, moleS.y - 16 - Math.round((tt * 4) % 6)); zz.alpha = 1 - ((tt * 4) % 6) / 6;
    puffs.clear();
    for (const [px, py] of smoke) for (let i = 0; i < 3; i++) { const k = (tt * 0.6 + i / 3) % 1; puffs.circle(px + Math.sin(k * 6 + i) * 2, py - k * 12, 1 + k * 2).fill({ color: 0xc8c0d0, alpha: 0.5 * (1 - k) }); }
  };
  return c;
}
/** 부지 그림 (art/buildings.px.js): Lv1·2 → _1, Lv3·4 → _3, Lv5 → _5 · Lv2·4는 간판 색만 다르게(살짝 따뜻한 빛) */
function coArt(kind, lv, ss) {
  const deco = DECO_ART[kind];
  let sp;
  if (deco) {
    if (DECO_ANIM.has(deco)) { sp = new Sprite(F[deco][0]); sp.anim = F[deco]; sp.fps = deco === 'deco_fire' ? 8 : 6; }
    else sp = new Sprite(tex(deco));
    sp.anchor.set(0.5, 1); sp.scale.set(Math.max(0.5, Math.min(1, (ss - 2) / Math.max(sp.texture.width, sp.texture.height))) * 1.1);
    return sp;
  }
  const step = lv >= 5 ? 5 : lv >= 3 ? 3 : 1;
  sp = new Sprite(tex(`${BLD_ART[kind]}_${step}`));
  sp.anchor.set(0.5, 1);
  sp.scale.set((ss * (1 + step * 0.04)) / 48);                // 칸보다 살짝 크게 (Lv 높을수록 큼)
  if (lv === 2 || lv === 4) sp.tint = 0xfff0d8;
  return sp;
}
/** 아래 시트: [건물] [장식] [어울림] · 고른 건물 정보 · 짓기/올리기/옮기기 */
function makeCoList(lw, lh) {
  const c = new Container();
  c.addChild(frame('paper', lw, lh, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  if (placing) {
    const t = label(`${nameOf(placing.kind)}: ${placing.move ? '옮길' : '지을'} 빈 자리를 톡!`, ink); t.position.set(8, 8); c.addChild(t);
    const x = button('paper', 50, 16, '취소', () => { placing = null; buildUI(); }, { small: true }); x.position.set(lw - 56, 6); c.addChild(x);
    return c;
  }
  let top = 4;
  if (coSel) {                                                   // 부지에서 고른 것
    const k = coSel.kind, deco = !!B.company.decos[k], lv = lvOf(S, k);
    const nm = label(`${nameOf(k)}${deco ? '' : ` Lv${lv}`}`, ink); nm.position.set(8, top + 2); c.addChild(nm);
    const ef = label(effectText(S, k), { ...ink, small: true, color: 0x8a7a68, wrap: lw - 16 }); ef.position.set(8, top + 16); c.addChild(ef);
    const mv = button('paper', 40, 15, '옮기기', () => { if (roundBusy()) { toast('광부들이 바빠요'); return; } placing = { kind: k, move: true }; coSel = null; toast('옮길 빈 자리를 톡!'); buildUI(); }, { small: true });
    mv.position.set(lw - 46, top + 2); c.addChild(mv);
    if (!deco) { const chk = canUp(S, k), up = button('wood', 56, 15, chk.cost != null ? `올리기 ${chk.cost}` : chk.why, () => coAction(k), { small: true }); up.setDisabled(!chk.ok); up.position.set(lw - 104, top + 2); c.addChild(up); }
    top += Math.max(30, 18 + Math.ceil(ef.height)) + 2;
    c.addChild(new Graphics().rect(6, top - 2, lw - 12, 1).fill({ color: 0x8a7a68, alpha: 0.4 }));
  }
  const tabs = [['build', '건물'], ['deco', '장식'], ['harmony', `어울림 ${S.company.harmoniesFound.length}/${B.company.harmonies.length}`]];
  const tw = Math.floor((lw - 12) / 3);
  tabs.forEach(([key, name], i) => { const tb = tab(tw, name, () => { coTab = key; coScroll = 0; sfx('stash', true); buildUI(); }); tb.setOn(coTab === key); tb.position.set(6 + i * tw, top); c.addChild(tb); });
  top += 16;
  const bodyH = lh - top - 4;
  const body = new Container(); body.position.set(4, top); c.addChild(body);
  const mask = new Graphics().rect(4, top, lw - 8, bodyH).fill(0xffffff); c.addChild(mask); body.mask = mask;
  const rows = new Container(); body.addChild(rows);
  const rowH = 24, rw = lw - 8;
  const items = coTab === 'build' ? ['office', ...BUILDINGS] : coTab === 'deco' ? DECOS : B.company.harmonies.map((hm) => hm.id);
  items.forEach((k, i) => {
    const r = new Container(); r.y = i * rowH; rows.addChild(r);
    if (i) r.addChild(new Graphics().rect(2, 0, rw - 4, 1).fill({ color: 0x8a7a68, alpha: 0.25 }));
    if (coTab === 'harmony') {
      const hm = B.company.harmonies.find((q) => q.id === k), found = S.company.harmoniesFound.includes(k), on = harmonies(S).some((q) => q.id === k);
      const a = label(found || !hm.hidden ? `${found ? hm.name : '???'} · ${hm.text}` : '숨은 어울림 · ???', { ...ink, small: true, color: on ? 0x46702e : COLOR.paperInk }); a.position.set(4, 3); r.addChild(a);
      const b = label(found || !hm.hidden ? `${nameOf(hm.a)} + ${nameOf(hm.b)}${on ? ' · 지금 켜짐' : found ? ' · 떨어져 있음' : ''}` : `힌트: ${hm.hint}`, { ...ink, small: true, color: 0x8a7a68 }); b.position.set(4, 13); r.addChild(b);
      return;
    }
    const deco = coTab === 'deco', lv = lvOf(S, k), have = deco ? S.company.decos.some((d) => d.kind === k) : k === 'office' || lv > 0;
    const nm = label(`${nameOf(k)}${deco ? (have ? ' · 놓음' : '') : have ? ` Lv${lv}` : ' · 안 지음'}`, { ...ink, small: true, color: have ? COLOR.paperInk : 0x8a7a68 }); nm.position.set(4, 2); r.addChild(nm);
    const ef = label(effectText(S, k), { ...ink, small: true, color: 0x8a7a68 }); ef.position.set(4, 12); r.addChild(ef);
    const bw = 58;
    if (ef.width > rw - bw - 10) ef.scale.set((rw - bw - 10) / ef.width);
    const chk = canUp(S, k);
    const txt = deco && have ? '놓음' : chk.cost != null ? `${have ? '올리기' : deco ? '놓기' : '짓기'} ${chk.cost}` : chk.why === '금화 부족' ? `${have ? '올리기' : '짓기'} ${upCostOf(k)}` : chk.why;
    const btn = button(have ? 'paper' : 'wood', bw, 16, txt, () => coAction(k), { small: true });
    btn.setDisabled(!chk.ok || roundBusy()); btn.position.set(rw - bw - 2, 4); r.addChild(btn);
  });
  // 끌어서 스크롤
  const maxScroll = Math.max(0, items.length * rowH - bodyH);
  coScroll = Math.min(coScroll, maxScroll); rows.y = -coScroll;
  body.eventMode = 'static'; body.hitArea = new Rectangle(0, 0, rw, bodyH);
  let dragY = null, startScroll = 0;
  body.on('pointerdown', (e) => { dragY = e.global.y; startScroll = coScroll; coDragged = false; });
  body.on('globalpointermove', (e) => { if (dragY == null) return; const d = (e.global.y - dragY) / L.uiS; if (Math.abs(d) > 4) coDragged = true; coScroll = Math.max(0, Math.min(maxScroll, startScroll - d)); rows.y = -coScroll; });
  const end = () => { dragY = null; setTimeout(() => { coDragged = false; }, 0); };
  body.on('pointerup', end); body.on('pointerupoutside', end);
  body.on('wheel', (e) => { coScroll = Math.max(0, Math.min(maxScroll, coScroll + e.deltaY * 0.3)); rows.y = -coScroll; });
  return c;
}
/** 특성 트리: 3갈래 × 5단 (위에서부터 1점씩) */
function makeTalents(tw, th) {
  const c = new Container();
  c.addChild(frame('paper', tw, th, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const pts = talentPoints(S), left = talentLeft(S);
  const t = label(`남은 포인트 ${left} / ${pts}`, ink); t.position.set(8, 6); c.addChild(t);
  const sub = label(`사무소 Lv당 1 · ★3 ${B.talents.star3PerPoint}회마다 1 (지금 ★3 ${S.stats.star3 ?? 0}회)`, { ...ink, small: true, color: 0x8a7a68, wrap: tw - 16 }); sub.position.set(8, 20); c.addChild(sub);
  const top = 22 + Math.ceil(sub.height) + 6, colW = Math.floor((tw - 16) / 3);
  const cellH = Math.max(22, Math.min(40, Math.floor((th - top - 40) / 5) - 3));
  TALENT_TREES.forEach(([tree, name], ci) => {
    const x0 = 8 + ci * colW;
    const hd = label(name, { ...ink, color: 0x8a5a24 }); hd.position.set(x0 + Math.round((colW - 2 - hd.width) / 2), top); c.addChild(hd);
    const lv = S.talents[tree] ?? 0;
    B.talents[tree].forEach((txt, i) => {
      const y = top + 16 + i * (cellH + 3), learned = i < lv, next = i === lv;
      const cell = new Container(); cell.position.set(x0, y); c.addChild(cell);
      cell.addChild(frame(learned ? 'wood' : next ? 'paper' : 'stone', colW - 3, cellH, 'panel'));
      if (next && left > 0) cell.addChild(new Graphics().rect(0, 0, colW - 3, cellH).stroke({ width: 1, color: 0x6a9a3a }));
      const l = label(txt, { small: true, color: learned ? COLOR.gold : next ? COLOR.paperInk : COLOR.dim, shadow: learned, wrap: colW - 9 });
      l.position.set(3, Math.max(1, Math.round((cellH - l.height) / 2))); cell.addChild(l);
      if (l.height > cellH - 2) l.scale.set((cellH - 2) / l.height);
      if (i < 4) cell.addChild(new Graphics().rect(Math.round(colW / 2) - 1, cellH, 1, 3).fill(learned ? 0xd39a3a : 0x8a7a68));
      if (next) { cell.eventMode = 'static'; cell.cursor = 'pointer'; cell.on('pointertap', () => learnTalent(tree)); }
    });
  });
  const free = S.company.coreLv === 1 && !S.talents.freeResetUsed;
  const rs = button('paper', 70, 16, free ? '초기화 무료' : `초기화 ${B.talents.resetCost}`, resetTalents, { small: true });
  rs.setDisabled(!talentSpent(S) || (!free && S.gold < B.talents.resetCost)); rs.position.set(tw - 76, th - 22); c.addChild(rs);
  return c;
}
function learnTalent(tree) {
  if (talentLeft(S) <= 0) { toast('포인트가 없어요. 사무소를 올리거나 ★3을 모아요'); return; }
  if ((S.talents[tree] ?? 0) >= 5) return;
  S.talents[tree] = (S.talents[tree] ?? 0) + 1;
  refreshCompany(); sfx('bell');
  toast(`특성: ${B.talents[tree][S.talents[tree] - 1]}`, 'halabeoji');
  save(); buildUI(); cloudSoon();
}
function resetTalents() {
  const free = S.company.coreLv === 1 && !S.talents.freeResetUsed;
  if (!free) { if (S.gold < B.talents.resetCost) { toast('금화가 모자라요'); return; } S.gold -= B.talents.resetCost; } else S.talents.freeResetUsed = true;
  S.talents.survey = 0; S.talents.dig = 0; S.talents.trade = 0;
  refreshCompany(); toast('특성을 다 되돌렸어요'); save(); buildUI();
}
const upCostOf = (k) => { const lv = lvOf(S, k); return k === 'office' ? B.company.officeCost[lv - 1] : B.company.decos[k] ? B.company.decos[k].cost : Math.round(B.company.buildings[k].cost * B.company.costMul[lv]); };

// ---------------------------------------------------------------- 경매 진행: 플레이어 호가 → 길드 호가(연출) → 2라운드 → 낙찰
function guildValue(card, g) {
  const v = card.price * (1 + card.hints.length * B.hintValue) * CF.guildMul;
  const spread = 1 + (Math.random() * 2 - 1) * B.guildSpread;
  if (g.style === 'random') return v * spread * (g.capMin + Math.random() * (g.capMax - g.capMin));
  return v * spread * g.cap;
}
function pickCard(card) {
  AU.card = card; AU.phase = 'r1'; AU.high = card.price; AU.holder = null; AU.log = [`시작가 ${card.price}`]; AU.me = null; AU.endAt = null;
  AU.say = GUILD_LINES.map((l, i) => ({ text: l.enter, line: true, t: time + 0.15 + i * 0.45, intro: true }));   // 등장 한마디 (차례로)
  if (L.portrait && S.settings.sheetFolded) { S.settings.sheetFolded = false; setTimeout(layout, 0); }
  AU.caps = B.guilds.map((g) => guildValue(card, g));
  buildUI();
}
function playerRaise(pct) {
  const price = Math.round(AU.high * (1 + pct));
  if (price > S.gold) { toast('금화가 모자라요'); return; }
  AU.high = price; AU.holder = 'me'; AU.log.push(`나 +${Math.round(pct * 100)}% → ${price}`); AU.me = `↑${price}`;
  AU.say = AU.say.map((t) => (t ? { ...t, old: true, intro: false } : t));
  sfx('stash', true);
  if (AU.phase === 'r2') { auctionWon(); return; }
  // 1라운드: 길드가 차례로 (aiBidDelay 간격으로 하나씩 뜬다)
  AU.phase = 'ai'; AU.queue = B.guilds.map((g, i) => i); AU.timer = B.aiBidDelay;
  buildUI();
}
function guildTurn(i) {
  const g = B.guilds[i], cap = AU.caps[i];
  let pct;
  if (g.style === 'aggressive') pct = Math.random() < g.bigRaiseChance ? 0.25 : 0.10;
  else if (g.style === 'careful') pct = 0.10;
  else pct = B.raises[Math.floor(Math.random() * B.raises.length)];
  const price = Math.round(AU.high * (1 + pct));
  if (price <= cap) { AU.high = price; AU.holder = i; AU.log.push(`${g.name} +${Math.round(pct * 100)}% → ${price}`); AU.say[i] = { text: fill(pick(GUILD_LINES[i].raise), { g: price }), price, pass: false, t: time }; sfx('ore'); }
  else { AU.log.push(`${g.name} 패스`); AU.say[i] = { text: pick(GUILD_LINES[i].pass), pass: true, t: time }; sfx('clink', true); }
}
function playerFold() {
  AU.log.push('나 포기'); AU.me = '포기';
  auctionLost();
}
/** 낙찰 (플레이어): 망치 쾅 + 도장 · 길드 하나가 한마디 */
function auctionWon() {
  count('wins');
  AU.phase = 'won'; AU.timer = 2.0; AU.endAt = time;
  const i = Math.floor(Math.random() * 3);
  AU.say = AU.say.map((q) => (q ? { ...q, old: true } : q)); AU.say[i] = { text: pick(GUILD_LINES[i].lose), line: true, t: time + 0.5 };
  toast(fill(AUCTIONEER.won, { p: AU.high }), 'halabeoji', 2.5);
  sfx('break'); shake = 0.25; shakeAmp = 2;
  buildUI();
}
/** 유찰 (길드가 가져감 또는 포기) */
function auctionLost() {
  AU.phase = 'lost'; AU.timer = 2.2; AU.endAt = time;
  const w = typeof AU.holder === 'number' ? AU.holder : null;
  AU.say = AU.say.map((q) => (q ? { ...q, old: true } : q));
  if (w != null) AU.say[w] = { text: pick(GUILD_LINES[w].win), line: true, t: time + 0.4 };
  toast(AUCTIONEER.lost, 'halabeoji', 3);
  if (w != null) { sfx('break'); shake = 0.2; shakeAmp = 1.5; }
  buildUI();
}
function updateAuction(dt) {
  if (AU.phase === 'ai') {
    AU.timer -= dt;
    if (AU.timer <= 0) {
      guildTurn(AU.queue.shift()); AU.timer = B.aiBidDelay;
      if (!AU.queue.length) {
        if (AU.holder === 'me') { auctionWon(); return; }
        AU.phase = 'r2';                                   // 최고가에 한 번 더 올릴 기회
        toast(AUCTIONEER.round2, 'halabeoji', 2.5);
      }
      buildUI();
    }
  } else if (AU.phase === 'won' || AU.phase === 'lost') {
    AU.timer -= dt;
    if (AU.timer <= 0) {
      if (AU.phase === 'won') startRound(AU.card, AU.high);
      else startRound(freeCard(newSeed(), CF.freeHint ? 1 : 0), 0);
    }
  }
}

// ---------------------------------------------------------------- 탐사: 두더지가 걷다 아래 3칸 안 광맥 위에서 킁킁 · 투시 랜턴
let xrayArmed = false;
function veinBelow(gx) {                                  // 이 열 아래 moleSniffDepth칸 안 광맥 크기
  if (!W) return 0;
  for (let gy = 0; gy < Math.min(W.rows, CF.sniffDepth); gy++) {
    const id = W.veins.id[gy][gx];
    if (id >= 0) return W.veins.list[id].size;
  }
  return 0;
}
function veinTypeBelow(gx) {
  for (let gy = 0; gy < Math.min(W.rows, CF.sniffDepth); gy++) { const id = W.veins.id[gy][gx]; if (id >= 0) return W.veins.list[id].type; }
  return null;
}
function updateSurvey(dt) {
  const rd = S.round;
  rd.surveyLeft -= dt;
  if (rd.surveyLeft <= 0) { startDig(); return; }
  if (ui.survey) ui.survey.text = `탐사 ${Math.ceil(rd.surveyLeft)}초`;
}
function updateMole(dt) {
  if (state() === 'SURVEY') {
    if (mole.wait > 0) { mole.wait -= dt; mole.sniffing = mole.wait > 0; return; }
    if (mole.goal === undefined) mole.goal = mole.x < GX + GW * T / 2 ? GX + GW * T - 8 : GX + 8;
    const d = mole.goal - mole.x;
    mole.face = Math.sign(d) || 1;
    const before = Math.floor((mole.x - GX) / T);
    mole.x += Math.sign(d) * Math.min(Math.abs(d), B.moleSpeed * dt);
    const after = Math.floor((mole.x - GX) / T);
    if (after !== before && after >= 0 && after < GW) {
      const size = veinBelow(after);
      const vt = CF.oreColor ? veinTypeBelow(after) : null;
      if (size) { mole.wait = 0.6 + size * 0.12; mole.x = GX + after * T + 8; sfx('ore', true); emote(mole, (vt ? ORES.find((o) => o.key === vt).name + ' ' : '') + (CF.sniffSize ? `킁킁 ${'•'.repeat(size >= B.bigVein ? 3 : size >= 6 ? 2 : 1)}` : '킁킁'), 0.6 + size * 0.12, vt ? ORE_COLOR[vt] : undefined); }
    }
    if (Math.abs(d) < 0.5) mole.goal = undefined;
  } else {
    mole.wait -= dt;
    if (mole.wait <= 0) { mole.goal = 118 + (Math.random() - 0.5) * 30; mole.wait = 3 + Math.random() * 3; }
    if (mole.goal !== undefined) { const d = mole.goal - mole.x; if (Math.abs(d) > 0.5) { mole.face = Math.sign(d); mole.x += Math.sign(d) * Math.min(Math.abs(d), 6 * dt); } }
  }
}
function xrayAt(wx, wy) {
  const gx = Math.floor((wx - GX) / T), gy = Math.floor((wy - GY) / T);
  if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return false;
  const rr = CF.xrayRadius;
  for (let y = gy - rr; y <= gy + rr; y++) for (let x = gx - rr; x <= gx + rr; x++) {
    if (x < 0 || x >= GW || y < 0 || y >= GH) continue;
    xray.set(`${x},${y}`, time + B.xraySeconds); refreshAround(x, y, 0);
  }
  S.round.xrayLeft--; xrayArmed = false; sfx('bell');
  setTimeout(() => { for (let y = gy - rr; y <= gy + rr; y++) for (let x = gx - rr; x <= gx + rr; x++) if (x >= 0 && x < GW && y >= 0 && y < GH) refreshAround(x, y, 0); }, B.xraySeconds * 1000 + 50);
  buildUI();
  return true;
}

// ---------------------------------------------------------------- 머리 위 말풍선 (글자) — UI 층에 그리되 캐릭터를 따라감
const emotes = [];
function emote(a, text, seconds = 1.2, color = COLOR.paperInk) {
  for (const e of emotes) if (e.a === a) e.t = 0;
  emotes.push({ a, text, t: seconds, view: null, color });
}

// ---------------------------------------------------------------- 레이아웃 (명세2 §10)
let L = null;
const cam = { x: 0, y: 0, x0: 0, y0: 0, panX: 0, panY: 0, lean: 0, rx: 0, ry: 0 };
let viewW = 192, viewH = 400;
let albedoRT, normalRT, litRT, finalRT, lightPass, postPass;
const display = new Sprite();
const uiRoot = new Container(), worldUI = new Container();
app.stage.addChild(display, worldUI, uiRoot);

function computeLayout() {
  const Wd = window.innerWidth, H = window.innerHeight;
  const dpr = R.resolution;
  let portraitMode = H >= Wd * 0.9;
  let cell, uiS, panels, vis;
  if (!portraitMode) {
    // 패드·PC 가로: 칸 = 높이/14, 좌우 패널 320px (왼쪽 광부·사건 · 오른쪽 판매)
    uiS = 2;
    const side = 320;
    cell = Math.min(H / 14, (Wd - 2 * side) / 12);
    if (cell < 20) portraitMode = true;
    else {
      const pad = 2 * uiS;
      panels = {
        left: { x: pad, y: pad, w: side - 2 * pad, h: H - 2 * pad },
        right: { x: Wd - side + pad, y: pad, w: side - 2 * pad, h: H - 2 * pad },
      };
      vis = { x0: side, x1: Wd - side, y0: 0, y1: H, above: 2 };
    }
  }
  if (portraitMode) {
    // 세로 폰: 칸 = 너비/12. 위 HUD · 지상 띠 · 격자(세로로 끌어 봄) · 아래 시트 32% (접으면 10%)
    uiS = Math.max(2, Math.min(3, Math.floor(Wd / 195)));
    cell = Wd / 12;
    const hudH = 36 * uiS;
    const sheetH = Math.round(S.settings.sheetFolded ? Math.max(H * 0.10, 26 * uiS) : Math.max(H * 0.32, 84 * uiS));
    panels = { hud: { x: 0, y: 0, w: Wd, h: hudH }, sheet: { x: 0, y: H - sheetH, w: Wd, h: sheetH } };
    vis = { x0: 0, x1: Wd, y0: hudH, y1: H - sheetH, above: 3 };
  }
  const sc = cell / T;
  const gridW = 12 * cell, gridH = GH * cell, visW = vis.x1 - vis.x0;
  const gridLeft = vis.x0 + (visW - gridW) / 2;
  const gridTop = vis.y0 + vis.above * cell;                       // 지상 띠는 늘 보이고, 넘치는 격자는 세로로 끌어 본다
  const overX = Math.max(0, gridW - visW) / sc, overY = Math.max(0, gridTop + gridH + cell * 0.5 - vis.y1) / sc;
  return { W: Wd, H, dpr, portrait: portraitMode, cell, sc, uiS, gridLeft, gridTop, panels, overX, overY, vis };
}

function layout() {
  L = computeLayout();
  const px = L.sc / DENS;
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
const inPanels = (sx, sy) => Object.values(L.panels).some((p) => sx >= p.x && sx < p.x + p.w && sy >= p.y && sy < p.y + p.h)
  || (ui.overlayRect && sx >= ui.overlayRect.x && sx < ui.overlayRect.x + ui.overlayRect.w && sy >= ui.overlayRect.y && sy < ui.overlayRect.y + ui.overlayRect.h);

// ================================================================ UI (art/ui/ui.px.js 틀 · 인물은 틀 안에서만)
let ui = {};
let sheetTab = 'sell';

function buildUI() {
  if (!L) return;
  uiRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
  uiRoot.scale.set(L.uiS);
  ui = { counters: {}, rows: {} };
  const u = (v) => Math.round(v / L.uiS);             // CSS px → UI px
  if (L.portrait) {
    const hud = L.panels.hud, sheet = L.panels.sheet;
    uiRoot.addChild(makeHud(u(hud.w), u(hud.h)));
    const s = new Container(); s.y = u(sheet.y);
    const sw = u(sheet.w), sh = u(L.H) - u(sheet.y);
    s.addChild(frame('stone', sw, sh + 6, 'panel'));
    const tabs = [['sell', '판매'], ['miner', '광부'], ['day', '과제'], ['set', '설정']];
    const tw = Math.floor((sw - 12 - 22) / 4);
    const body = new Container(); body.position.set(5, 19);
    const bw = sw - 10, bh = sh - 23;
    const show = (key) => {
      sheetTab = key;
      ui.tabs.forEach((t) => t.setOn(t.key === key));
      body.removeChildren().forEach((c) => c.destroy({ children: true }));
      ui.rows = {};
      for (const k of ['crew', 'fps', 'buyerFace', 'buyerName', 'irows', 'smeltLine']) ui[k] = null;
      body.addChild(state() === 'AUCTION' && AU.card && view !== 'company' ? makeBidPanel(bw, bh) : key === 'sell' ? makeSell(bw, bh) : key === 'miner' ? makeCrew(bw, bh) : key === 'day' ? makeDaybook(bw, bh) : makeSettings(bw, bh));
      refreshUI();
    };
    ui.tabs = tabs.map(([key, name], i) => {
      const t = tab(tw, name, () => { sfx('stash', true); if (S.settings.sheetFolded) { S.settings.sheetFolded = false; sheetTab = key; save(); setTimeout(layout, 0); } else show(key); });
      t.key = key; t.position.set(6 + i * tw, 4); s.addChild(t);
      if (key === 'sell') ui.sellAnchor = t;
      return t;
    });
    const fold = button('stone', 18, 14, S.settings.sheetFolded ? '▲' : '▼', () => { S.settings.sheetFolded = !S.settings.sheetFolded; save(); layout(); }, { small: true });
    fold.position.set(sw - 24, 4); s.addChild(fold);
    s.addChild(body);
    uiRoot.addChild(s);
    if (S.settings.sheetFolded) ui.tabs.forEach((t) => t.setOn(t.key === sheetTab));
    else show(sheetTab);
  } else {
    const { left, right } = L.panels;
    const lc = new Container(); lc.position.set(u(left.x), u(left.y));
    const lw = u(left.w), lh = u(left.h);
    lc.addChild(makeHud(lw, 36));
    const ch = 114;
    const cf = frame('wood', lw, ch); cf.y = 38; lc.addChild(cf);
    const cr = makeCrew(lw - 10, ch - 10); cr.position.set(5, 43); lc.addChild(cr);
    const dh = 78;
    const db = makeDaybook(lw, dh); db.y = 38 + ch + 2; lc.addChild(db);
    const logH = Math.max(40, lh - 38 - ch - 2 - 70 - dh - 2);
    const lf = frame('stone', lw, logH, 'panel'); lf.y = 38 + ch + 2 + dh + 2; lc.addChild(lf);
    const lt = label('사건 기록', { small: true, color: COLOR.gold }); lt.position.set(6, lf.y + 4); lc.addChild(lt);
    (eventLog.length ? eventLog : ['아직 없어요']).slice(0, Math.floor((logH - 20) / 12)).forEach((t, i) => { const l = label(t, { small: true, color: COLOR.stone }); l.position.set(8, lf.y + 18 + i * 12); lc.addChild(l); });
    const sf = frame('stone', lw, lh - 38 - ch - 2 - logH - 2, 'panel'); sf.y = lf.y + logH + 2; lc.addChild(sf);
    const st = makeSettings(lw - 10, lh - 38 - ch - logH - 14); st.position.set(5, sf.y + 5); lc.addChild(st);
    uiRoot.addChild(lc);
    const rc = new Container(); rc.position.set(u(right.x), u(right.y));
    rc.addChild(makeSell(u(right.w), u(right.h)));
    uiRoot.addChild(rc);
  }
  ui.overlayRect = null;
  if (view === 'company') {
    const r = L.portrait ? { x: 0, y: u(L.panels.hud.h), w: u(L.W), h: u(L.H) - u(L.panels.hud.h) } : { x: u(L.vis.x0) + 4, y: u(L.vis.y0) + 4, w: u(L.vis.x1 - L.vis.x0) - 8, h: u(L.vis.y1 - L.vis.y0) - 8 };
    uiRoot.addChild(makeCompany(r.x, r.y, r.w, r.h));
  } else {
    ui.coTick = null;
    const tut = makeTutorial();                                  // 먼저 만들어 높이를 안다 (경매 카드가 비켜 줌)
    const ov = makeOverlay();
    if (ov) uiRoot.addChild(ov);
    if (tut) uiRoot.addChild(tut);
  }
  if (welcome) uiRoot.addChild(makeWelcome());
  if (rankView) uiRoot.addChild(makeRank());
  if (cloudChoice) uiRoot.addChild(makeCloudChoice());
  ui.fxLayer = new Container(); uiRoot.addChild(ui.fxLayer);
  ui.toast = new Container(); ui.toast.visible = false; uiRoot.addChild(ui.toast);
  refreshUI();
}

function makeHud(w, h) {
  const c = new Container();
  c.addChild(frame('wood', w, h));
  const wide = w >= 320;
  const t1 = label(online() ? `${me.profile.nickname}의 상회` : '돌망치 상회', { color: COLOR.gold }); t1.position.set(7, 4);
  c.addChild(t1);
  const sub = S.round?.card ? `${S.round.card.floor === 2 ? '2층 ' : ''}${S.round.card.name}` : '오늘의 경매';
  if (!wide) { const t2 = label(sub, { small: true, color: COLOR.dim }); t2.position.set(Math.round(t1.width) + 12, 6); if (t2.x + t2.width < w - 38) c.addChild(t2); else t2.destroy(); }
  const cy = wide ? 19 : 18;                                  // 넓은 HUD(PC 왼쪽 패널)도 두 줄: 제목 / 금화·창고·시계
  const cb = button(view === 'company' ? 'paper' : 'stone', 30, 13, view === 'company' ? '광산' : '회사', () => (view === 'company' ? closeCompany() : openCompany()), { small: true });
  cb.position.set(w - 34, 3); c.addChild(cb);
  // 금화 · 창고 n/60 · 날짜/시각 (명세2 §10)
  const items = [['coin', kit('coin'), w < 170 ? 40 : 48], ['wh', tex('icon_gold'), (w < 170 ? 46 : 56) + (whCap() >= 100 ? 10 : 0)], ['clock', null, 72]];
  let xa = 7;
  items.forEach(([key, tx, sw]) => {
    const i = tx ? icon(tx) : new Container(), n = label('0', { small: key === 'clock' || w < 170 });
    const x0 = xa; xa += sw;
    i.position.set(x0, cy + Math.round((14 - (tx ? i.height : 0)) / 2));
    n.position.set(x0 + (tx ? i.width + 3 : 0), cy + (key === 'clock' ? 1 : 0));
    c.addChild(i, n);
    ui.counters[key] = n; if (key === 'clock') n.short = w < 170;
  });
  return c;
}

/** 격자 위를 덮는 전체 카드(경매 · 결과) 또는 탐사 띠 */
function makeOverlay() {
  const st = state();
  const u = (v) => Math.round(v / L.uiS);
  const v = L.vis, x = u(v.x0) + 4, y = u(v.y0) + 4, w = u(v.x1 - v.x0) - 8, h = u(v.y1 - v.y0) - 8 - (st === 'AUCTION' ? tutorialH : 0);
  if (st === 'AUCTION') return makeAuction(x, y, w, h);
  if (st === 'SURVEY') return makeSurveyBar(x, y, w);
  if (st === 'RESULT') return makeResult(x, y, w, h);
  if (st === 'DIG' && confirmRetreat) { const box = new Container(); box.addChild(makeDigBar(x, y, w), makeRetreatSheet(x, y, w, h)); return box; }
  if (st === 'DIG') return makeDigBar(x, y, w);
  return null;
}
function setOverlayRect(x, y, w, h) { ui.overlayRect = { x: x * L.uiS, y: y * L.uiS, w: w * L.uiS, h: h * L.uiS }; }

function makeAuction(x, y, w, h) {
  const c = new Container(); c.position.set(x, y);
  c.addChild(frame('paper', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const title = label(AU.card ? '입찰' : `${S.day}일차 경매 — 구획을 골라요`, { color: COLOR.paperInk, shadow: false }); title.position.set(8, 6); c.addChild(title);
  const gold = label(`가진 금화 ${S.gold}`, { small: true, color: 0x8a7a68, shadow: false }); gold.position.set(8, 20); c.addChild(gold);
  const cards = todayCards();
  if (!AU.card) {
    const horiz = w > h * 1.2;
    const gap = 4, n = cards.length;
    const cw = horiz ? Math.floor((w - 16 - gap * (n - 1)) / n) : w - 16;
    const chh = horiz ? h - 40 : Math.floor((h - 40 - gap * (n - 1)) / n);
    cards.forEach((card, i) => {
      const k = makePlotCard(card, cw, Math.min(chh, horiz ? 160 : 70));
      k.position.set(8 + (horiz ? i * (cw + gap) : 0), 34 + (horiz ? 0 : i * (Math.min(chh, 70) + gap)));
      c.addChild(k);
    });
    return c;
  }
  // 입찰 화면: 고른 카드 + 길드 대표 3명(카드 위에 서 있음) + 대사 말풍선 · 호가 버튼은 세로 폰이면 아래 시트 (명세3 §5)
  const k = makePlotCard(AU.card, w - 16, 36, true); k.position.set(8, 32); c.addChild(k);
  const hi = label(`최고가 ${AU.high} · ${AU.holder === 'me' ? '나' : AU.holder == null ? '아직 없음' : B.guilds[AU.holder].name}`, { color: COLOR.paperInk, shadow: false });
  hi.position.set(8, 72); c.addChild(hi);
  const gw = Math.floor((w - 16 - 8) / 3);
  const fs = Math.max(1, Math.min(2, Math.floor(((gw - 4) / 32) * 2) / 2));   // 길드 대표 크기 (32×40 × 1~2)
  const bubY = 88, figH = Math.round(40 * fs), gy = Math.max(bubY + 30 + figH - 12, 150);
  const cx = (i) => 8 + i * (gw + 4) + gw / 2;
  B.guilds.forEach((g, i) => {
    const gc = guildCard(i, gw, AU.holder === i); gc.position.set(8 + i * (gw + 4), gy); c.addChild(gc);
    // 대표: 호가 = 몸 흔들 · 패스 = 고개 젓기(좌우 뒤집기 2번) 뒤 회색
    const say = AU.say[i], age = say ? time - say.t : 99;
    const fig = new Sprite(tex(GUILD_SPR[i])); fig.anchor.set(0.5, 1); fig.scale.set(fs);
    let fx0 = 0, fy0 = 0;
    if (say && !say.pass && !say.line && age >= 0 && age < 0.5) { fx0 = Math.round(Math.sin(age * 70) * 1.5); fy0 = -Math.round(Math.abs(Math.sin(age * 12)) * 3); }
    if (say?.pass && age >= 0 && age < 0.5 && Math.floor(age / 0.12) % 2 === 1) fig.scale.x = -fs;
    if (say?.pass && age >= 0.5 && !say.old) fig.tint = 0x8a8a8a;
    const winBounce = AU.phase === 'lost' && AU.holder === i ? -Math.round(Math.abs(Math.sin((time - AU.endAt) * 8)) * 3) : 0;
    fig.position.set(Math.round(cx(i) + fx0), gy + 12 + fy0 + winBounce);
    c.addChild(fig);
  });
  // 말풍선: 가장 최근 것만 대사 전체, 나머지는 작은 값 칩
  const shown = AU.say.map((q, i) => ({ q, i })).filter(({ q }) => q && time >= q.t);
  const latest = shown.reduce((m, e) => (!m || e.q.t > m.q.t ? e : m), null);
  for (const { q, i } of shown.sort((p, r) => p.q.t - r.q.t)) {
    const full = latest && latest.i === i && !q.old;
    if (!full && !q.pass && !q.price) continue;                // 지난 한마디(등장·낙찰 대사)는 접는다
    const txt = full ? q.text + (q.price && !q.text.includes(String(q.price)) ? `  ↑${q.price}` : '') : q.pass ? '패스' : q.price ? `↑${q.price}` : '…';
    const bt = label(txt, { small: true, color: q.pass ? 0x8a7a68 : 0x5c3832, shadow: false, wrap: full ? Math.min(w - 24, gw * 2) : 0 });
    const bw = Math.ceil(bt.width) + 8, bh = Math.ceil(bt.height) + 4;
    const bub = new Container(); bub.addChild(frame('paper', bw, bh, 'panel'), bt); bt.position.set(4, 1);
    const tx = Math.max(8, Math.min(w - 8 - bw, Math.round(cx(i) - bw / 2)));
    const tail = new Graphics().poly([cx(i) - tx - 3, bh - 1, cx(i) - tx + 3, bh - 1, cx(i) - tx, bh + 4]).fill(0xf4ecd2); bub.addChild(tail);
    bub.position.set(tx, full ? bubY : bubY + 12);
    bub.alpha = full ? 1 : 0.55;
    const age = time - q.t; if (full && age < 0.25) { bub.scale.set(0.85 + age * 0.6); }
    c.addChild(bub);
  }
  // 낙찰: 망치 쾅 + 종이 도장
  if ((AU.phase === 'won' || AU.phase === 'lost') && AU.endAt != null) {
    const age = time - AU.endAt, won = AU.phase === 'won', who = won ? '나' : typeof AU.holder === 'number' ? B.guilds[AU.holder].name.split(' ')[0] : null;
    if (who) {
      const st = new Container(); st.position.set(w - 44, 50);
      const g = new Graphics().circle(0, 0, 18).stroke({ width: 2, color: 0xb84a62 }).circle(0, 0, 14).stroke({ width: 1, color: 0xb84a62 });
      const tl = label('낙찰', { color: 0xb84a62, shadow: false }); tl.position.set(-Math.round(tl.width / 2), -10);
      const wl = label(who, { small: true, color: 0xb84a62, shadow: false }); wl.position.set(-Math.round(wl.width / 2), 3); if (wl.width > 30) wl.scale.set(30 / wl.width), wl.x = -15;
      st.addChild(g, tl, wl); st.rotation = -0.25;
      const p = Math.min(1, age / 0.18); st.scale.set(2.2 - 1.2 * p); st.alpha = p;
      c.addChild(st);
      const hm = new Container(); hm.position.set(w - 18, 30);
      hm.addChild(new Graphics().rect(-1, 0, 3, 22).fill(0x8a5a24).rect(-8, -6, 17, 8).fill(0x5a3a2a).rect(-8, -6, 17, 2).fill(0x8a6c52));
      hm.rotation = age < 0.12 ? -1.1 + age * 9 : age < 0.5 ? 0 : -0.5; c.addChild(hm);
    }
  }
  const by = h - 26;
  if (AU.me) { const m = label(`나 ${AU.me}`, { small: true, color: 0x46702e, shadow: false }); m.position.set(w - 8 - Math.ceil(m.width), Math.max(gy + 36, by - 14)); c.addChild(m); }
  const bidding = AU.phase === 'r1' || AU.phase === 'r2';
  if (bidding && !L.portrait) {                                // 세로 폰은 아래 시트에 (makeBidPanel)
    const note = label(AU.phase === 'r2' ? '마지막 기회! 올리면 낙찰' : '얼마나 올릴까요?', { small: true, color: 0x8a5a24, shadow: false });
    note.position.set(8, by - 14); c.addChild(note);
    const bw = Math.floor((w - 16 - 12) / 4);
    B.raises.forEach((pct, i) => {
      const price = Math.round(AU.high * (1 + pct));
      const b = button('paper', bw, 18, `+${Math.round(pct * 100)}%`, () => playerRaise(pct), { small: true });
      b.setDisabled(price > S.gold);
      b.position.set(8 + i * (bw + 4), by); c.addChild(b);
    });
    const f = button('stone', bw, 18, '포기', playerFold, { small: true }); f.position.set(8 + 3 * (bw + 4), by); c.addChild(f);
  } else if (!bidding) {
    const msg = AU.phase === 'won' ? `낙찰! ${AU.high} 금화` : AU.phase === 'lost' ? '놓쳤어요… 공짜 자투리 구획으로 가요' : '길드들이 호가 중…';
    const m = label(msg, { color: AU.phase === 'won' ? 0x46702e : 0x8a5a24, shadow: false }); m.position.set(8, by); c.addChild(m);
  } else { const m = label(AU.phase === 'r2' ? '마지막 기회! 아래에서 올리면 낙찰' : '아래에서 얼마나 올릴지 골라요', { small: true, color: 0x8a5a24, shadow: false }); m.position.set(8, by + 4); c.addChild(m); }
  return c;
}
const GUILD_SPR = ['npc_guild_abyss', 'npc_guild_tower', 'npc_guild_shield'];
const GUILD_COLOR = [0x3d5a9a, 0x8a5a24, 0x7a2e48];
/** 세로 폰: 아래 시트 = 호가 버튼 (명세3 §5 "플레이어 호가 버튼은 하단 시트") */
function makeBidPanel(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const bidding = AU.phase === 'r1' || AU.phase === 'r2';
  const t = label(bidding ? (AU.phase === 'r2' ? '마지막 기회! 올리면 낙찰' : '얼마나 올릴까요?') : AU.phase === 'ai' ? '길드들이 호가 중…' : '경매 끝', { ...ink, color: 0x8a5a24 }); t.position.set(8, 6); c.addChild(t);
  const g = label(`최고가 ${AU.high} · 가진 금화 ${S.gold}`, { ...ink, small: true, color: 0x8a7a68 }); g.position.set(8, 20); c.addChild(g);
  const bw = Math.floor((w - 20) / 2), bh = Math.max(20, Math.min(30, Math.floor((h - 44) / 2) - 4));
  B.raises.concat(['fold']).forEach((pct, i) => {
    const fold = pct === 'fold', price = fold ? 0 : Math.round(AU.high * (1 + pct));
    const b = button(fold ? 'stone' : 'wood', bw, bh, fold ? '포기' : `+${Math.round(pct * 100)}% → ${price}`, () => (fold ? playerFold() : playerRaise(pct)), { small: bw < 110 });
    b.setDisabled(!bidding || (!fold && price > S.gold));
    b.position.set(8 + (i % 2) * (bw + 4), 34 + Math.floor(i / 2) * (bh + 4)); c.addChild(b);
  });
  return c;
}
/** 길드 카드: 대표가 위에 서 있는 받침 (이름 · 성향) */
function guildCard(i, w, leading) {
  const g = B.guilds[i], c = new Container();
  c.addChild(frame(leading ? 'wood' : 'stone', w, 38, 'panel'));
  c.addChild(new Graphics().rect(3, 3, w - 6, 2).fill({ color: GUILD_COLOR[i], alpha: 0.9 }));
  const short = w >= 90 ? g.name : g.name.split(' ')[0];
  const nm = label(short, { small: true, color: leading ? COLOR.gold : COLOR.paper }); nm.position.set(4, 12); c.addChild(nm);
  if (nm.width > w - 6) nm.scale.set((w - 6) / nm.width);
  const style = { aggressive: '공격적', careful: '신중', random: '변덕' }[g.style];
  const st = label(style, { small: true, color: COLOR.dim }); st.position.set(4, 22); c.addChild(st);
  if (leading) { const crown = icon(kit('badge_gold')); crown.position.set(w - 11, 22); c.addChild(crown); }
  return c;
}
function makePlotCard(card, w, h, flat = false) {
  const c = new Container();
  c.addChild(frame('wood', w, h, 'panel'));
  const nm = label(card.name, { color: card.floor === 2 ? 0x6fe0d8 : COLOR.gold }); nm.position.set(6, 5); c.addChild(nm);
  if (card.floor === 2) { const fl = label('2층', { small: true, color: 0x1a1220, shadow: false }); const bg = new Graphics().rect(0, 0, Math.ceil(fl.width) + 6, 11).fill(0x6fe0d8); const tg = new Container(); tg.addChild(bg, fl); fl.position.set(3, 0); tg.position.set(w - Math.ceil(fl.width) - 12, 5); c.addChild(tg); }
  const sz = B.plotSizes[card.size];
  const info = label(`크기 ${card.size} · 12×${sz.rows}`, { small: true, color: COLOR.dim }); info.position.set(6, 20); c.addChild(info);
  let hx = Math.ceil(info.width) + 14;                        // 힌트는 크기 줄 옆에 (카드가 짧아도 시작가와 안 겹침)
  const narrow = w < 240;
  card.hints.forEach((hnt) => {
    const ic = icon(tex(HINT_ICON[hnt])); ic.position.set(hx, 21); c.addChild(ic);
    if (narrow) { hx += 12; return; }                         // 좁은 카드는 아이콘만
    const t = label(HINT_TEXT[hnt], { small: true }); t.position.set(hx + 11, 20); c.addChild(t);
    hx += 11 + Math.ceil(t.width) + 8;
  });
  let range = '';
  if (CF.veinRange) {                                           // 탐사 특성 4: 광맥 총량 범위
    card.veinTotal ??= generate(card).join('').split('').filter((ch) => ORE_KEYS.has(ch)).length;
    const v = card.veinTotal, d = B.talents.veinRange;
    range = `광맥 ${Math.round(v * (1 - d))}~${Math.round(v * (1 + d))}칸`;
  }
  if (range && h >= 50) { const rg = label(range, { small: true, color: 0x9cc45a }); rg.position.set(6, 32); c.addChild(rg); }
  const price = label(`시작가 ${card.price}`, { small: true, color: COLOR.gold });
  price.position.set(6, h - 14); if (h >= 50) c.addChild(price);
  if (!flat) {
    const b = button('wood', 52, 18, '입찰', () => { unlockAudio(); pickCard(card); }, { small: true });
    b.setDisabled(card.price > S.gold);
    b.position.set(w - 58, h - 22); c.addChild(b);
  }
  return c;
}
function makeSurveyBar(x, y, w) {
  const c = new Container(); c.position.set(x, y);
  const h = 22;
  c.addChild(frame('paper', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const t = label('', { small: true, color: COLOR.paperInk, shadow: false }); t.position.set(6, 5); c.addChild(t); ui.survey = t;
  const xb = button('paper', 70, 16, `투시 랜턴 ${S.round.xrayLeft}`, () => { if (S.round.xrayLeft > 0) { xrayArmed = !xrayArmed; toast(xrayArmed ? '보고 싶은 곳을 톡!' : '투시 취소'); } }, { small: true });
  xb.setDisabled(S.round.xrayLeft <= 0); xb.position.set(w - 128, 3); c.addChild(xb);
  const sk = button('stone', 50, 16, '건너뛰기', startDig, { small: true }); sk.position.set(w - 54, 3); c.addChild(sk);
  return c;
}
function makeDigBar(x, y, w) {
  const c = new Container(); c.position.set(x, y);
  const b = button('stone', 44, 16, '철수', () => askRetreat(), { small: true }); b.position.set(w - 48, 0); c.addChild(b);
  let bw = 48;
  if (W?.water.some((r) => r.some(Boolean)) && !(S.round.pumpLeft > 0)) {
    const pmp = button('paper', 56, 16, CF.pumpCost ? `펌프 ${CF.pumpCost}` : '펌프', pump, { small: true }); pmp.position.set(w - 108, 0); c.addChild(pmp); bw = 108;
  }
  setOverlayRect(x + w - bw, y, bw - 4, 16);
  return c;
}
function makeResult(x, y, w, h) {
  const rd = S.round, st = rd.stats;
  const c = new Container(); c.position.set(x, y);
  c.addChild(frame('paper', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const ink = { color: COLOR.paperInk, shadow: false };
  const title = label(`${rd.card.name} — 결과`, ink); title.position.set(8, 6); c.addChild(title);
  const why = label(rd.reason === 'done' ? '광맥을 전부 캤어요' : '철수했어요', { ...ink, small: true, color: 0x8a7a68 }); why.position.set(8, 20); c.addChild(why);
  let yy = 36;
  const line = (k, v, col = COLOR.paperInk) => {
    const a = label(k, { ...ink, small: true }); a.position.set(10, yy); c.addChild(a);
    const b = label(v, { ...ink, small: true, color: col }); b.position.set(w - 12 - Math.ceil(b.width), yy); c.addChild(b);
    yy += 13;
  };
  line('낙찰가', `−${rd.bid}`, 0xb84a62);
  line('매출(판매)', `+${st.revenue}`, 0x46702e);
  if (st.relicGold) line(`유물 ${st.relics}개`, `+${st.relicGold}`, 0x46702e);
  yy += 2;
  const pl = label('순이익', ink); pl.position.set(10, yy + 4); c.addChild(pl);
  const pv = label(`${st.profit >= 0 ? '+' : ''}${st.profit}`, { ...ink, color: st.profit >= 0 ? 0x46702e : 0xb84a62 }); pv.scale.set(2); pv.position.set(w - 12 - Math.ceil(pv.width), yy); c.addChild(pv);
  yy += 30;
  const stars = label('★'.repeat(st.stars) + '☆'.repeat(3 - st.stars), { color: 0xd39a3a, shadow: false }); stars.scale.set(1.5); stars.position.set(10, yy); c.addChild(stars);
  yy += 24;
  const mins = Math.max(1, Math.round((rd.endedAt - rd.startedAt) / 60));
  line('최대 광맥', `${st.maxVein}칸${st.jackpots ? ' · 대박!' : ''}`);
  line('걸린 시간', `${mins}분`);
  const evs = st.events.length ? [...new Set(st.events)].map((e) => `${EVENT_NAME[e]}${st.events.filter((q) => q === e).length > 1 ? '×' + st.events.filter((q) => q === e).length : ''}`).join(' · ') : '없음';
  line('사건', evs);
  const left = whTotal();
  if (left) line('창고에 남은 광석', `${left}개 · 팔면 이익`, 0x8a7a68);
  if (S.daybook?.tasks?.length) line('오늘 과제', `${S.daybook.tasks.filter((t) => t.done).length}/${S.daybook.tasks.length} ✓`, 0x46702e);
  // 할아범 한마디 (틀 안)
  const say = st.stars >= 3 ? '허허, 이 늙은이보다 낫구먼! 대박이야!' : st.stars >= 1 ? '나쁘지 않아. 다음엔 시세를 좀 더 노려 보게.' : '흠… 땅값이 비쌌나? 힌트를 잘 보게나.';
  const by = yy + 6, ps = Math.max(20, Math.min(40, h - 46 - by));   // 남은 자리만큼 (좁은 폰에서 줄과 안 겹침)
  const pf = portraitFrame(tex(NPC.halabeoji), ps, 'wood'); pf.position.set(8, by); c.addChild(pf);
  const tx = label(say, { ...ink, small: true, wrap: w - ps - 24 }); tx.position.set(ps + 14, by + 2); c.addChild(tx);
  const b = button('wood', 80, 20, '다음 경매', nextAuction);
  b.position.set(w - 88, h - 26); c.addChild(b);
  const co = button('paper', 56, 20, '회사로', openCompany); co.position.set(w - 148, h - 26); c.addChild(co);
  const tot = label(`누적 ${S.stats.rounds + 1}라운드 · 순이익 ${S.stats.profitTotal + st.profit}`, { ...ink, small: true, color: 0x8a7a68 }); tot.position.set(8, h - 40); if (by + Math.max(ps, Math.ceil(tx.height)) + 2 <= h - 40) c.addChild(tot); else tot.destroy();
  return c;
}

/** 철수 확인 시트 */
function makeRetreatSheet(x, y, w, h) {
  const c = new Container();
  const ww = Math.min(w, 220), hh = 70;
  c.position.set(x + Math.round((w - ww) / 2), y + Math.round((h - hh) / 2));
  c.addChild(frame('paper', ww, hh, 'panel'));
  setOverlayRect(c.x, c.y, ww, hh);
  const ink = { color: COLOR.paperInk, shadow: false };
  const t = label('철수할까요?', ink); t.position.set(8, 6); c.addChild(t);
  const n = oreLeft();
  const m = label(n ? `남은 광맥 ${n}칸은 광부들이 계속 캐요` : '남은 광맥은 없어요', { ...ink, small: true, wrap: ww - 16 }); m.position.set(8, 22); c.addChild(m);
  const yes = button('wood', 60, 18, '철수', () => endRound('retreat'), { small: true }); yes.position.set(ww - 68, hh - 24); c.addChild(yes);
  const no = button('paper', 60, 18, '계속 캐기', () => { confirmRetreat = false; buildUI(); }, { small: true }); no.position.set(ww - 134, hh - 24); c.addChild(no);
  return c;
}

function makeSell(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  // 머리: 매입자 초상(틀 안) + 이름·좋아하는 광종 + [바꾸기]
  const by = buyer(), b = B.buyers[by];
  const face = Math.min(36, h - 4 - 5 * 13 - 20);
  const pf = portraitFrame(tex(NPC[by]), Math.max(24, face), 'wood'); pf.position.set(4, 4); c.addChild(pf);
  const fx0 = Math.max(24, face) + 8;
  const nm = label(b.name, { color: COLOR.paperInk, shadow: false, small: face < 30 }); nm.position.set(fx0, face < 30 ? 2 : 4); c.addChild(nm);
  const likes = b.like.map((k) => ORES.find((o) => o.key === k).name).join('·');
  const sub = label(`${likes} +${Math.round(b.bonus * 100)}%`, { small: true, color: 0x8a7a68, shadow: false }); sub.position.set(fx0, face < 30 ? 13 : 18); c.addChild(sub);
  const sw = button('paper', 40, 16, '바꾸기', () => { S.settings.buyer = by === 'brok' ? 'merchant' : 'brok'; sfx('stash', true); save(); buildUI(); }, { small: true });
  sw.position.set(w - 44, 4); c.addChild(sw);
  if (!CF.preview) {                                               // 광고 자리 (명세3 §7 — SDK 없음)
    const wideAd = face >= 30;
    const ad = button('stone', wideAd ? Math.min(110, w - fx0 - 6) : 38, wideAd ? 11 : 10, wideAd ? '광고 보고 시세 1분 미리보기' : '광고 1분', () => toast('곧 열려요'), { small: true });
    ad.alpha = 0.65; ad.position.set(wideAd ? fx0 : w - 86, wideAd ? 28 : 2); c.addChild(ad);
  }
  if (CF.smeltSlots) {
    const tg = button(sellMode === 'ingot' ? 'wood' : 'paper', 28, 16, sellMode === 'ingot' ? '광석' : '괴', () => { sellMode = sellMode === 'ingot' ? 'ore' : 'ingot'; sfx('stash', true); buildUI(); }, { small: true });
    tg.position.set(4, w - 112 < 64 ? h - 36 : h - 18); c.addChild(tg);
  } else sellMode = 'ore';
  if (CF.freeze && sellMode === 'ore') {                         // 장사 특성 5: 하루 1회 시세 고정 60초
    const used = S.talents.freezeDay === S.day, live = market.frozen && now() < market.frozen.until;
    const fz = button(live ? 'wood' : 'paper', 28, 15, live ? '고정중' : '고정', () => { if (used) return; market.freeze(now(), B.talents.freezeSeconds); S.talents.freezeDay = S.day; toast(`시세를 ${B.talents.freezeSeconds}초 고정했어요`, 'brok'); sfx('bell'); buildUI(); }, { small: true });
    fz.setDisabled(used && !live); fz.position.set(CF.smeltSlots ? 34 : 4, w - 112 < 64 ? h - 36 : h - 18); c.addChild(fz);
  }
  if (sellMode === 'ingot') { makeIngotRows(c, w, h, Math.max(24, face) + 6); return c; }
  // 행
  const top = Math.max(24, face) + 6, rowH = 13;
  const rowsN = Math.max(1, Math.min(ORES.length, Math.floor((h - top - 19) / rowH)));
  const order = ORES.slice().sort((p, q) => (stash[q.key] > 0) - (stash[p.key] > 0));   // 가진 것 먼저
  const rowW = w - 8;
  order.slice(0, rowsN).forEach((o, i) => {
    const r = new Container(); r.position.set(4, top + i * rowH);
    const bg = new Graphics(); r.addChild(bg);
    const ic = icon(tex(ICON[o.key])); ic.position.set(2, Math.round((13 - ic.height) / 2) + 1); r.addChild(ic);
    let x = 13;
    const nmw = rowW > 140 ? 36 : 0;
    if (nmw) { const t = label(o.name, { color: COLOR.paperInk, shadow: false, small: true }); t.position.set(x, 2); r.addChild(t); x += nmw; }
    const qty = label('×0', { color: COLOR.paperInk, shadow: false, small: true }); qty.position.set(x, 2); r.addChild(qty); x += 26;
    const price = label('0', { color: COLOR.paperInk, shadow: false, small: true }); price.position.set(x, 2); r.addChild(price); x += 22;
    const arrow = icon(kit('arrow_up')); arrow.position.set(x, 3); r.addChild(arrow); x += 10;
    const spark = new Graphics(); spark.position.set(x, 1); r.addChild(spark);
    const btn = button('paper', 30, 12, '팔기', () => sell(o.key, 1), { small: true });
    btn.position.set(rowW - 31, 0); r.addChild(btn);
    ui.rows[o.key] = { r, bg, qty, price, arrow, spark, btn, w: rowW, sparkW: Math.max(0, rowW - 33 - x - 2) };
    c.addChild(r);
  });
  const all = button('paper', 60, 15, '전부 팔기', () => ORES.forEach((o) => sell(o.key, 1)), { small: true });
  all.position.set(w - 64, h - 18); c.addChild(all);
  const half = button('paper', 44, 15, '절반', () => ORES.forEach((o) => sell(o.key, 0.5)), { small: true });
  half.position.set(w - 112, h - 18); c.addChild(half);
  const hint = label('창고에 두어도 돼요', { small: true, color: 0x8a7a68, shadow: false }); hint.position.set(6, h - 17);
  hint.visible = !CF.smeltSlots && !CF.freeze && w - 112 - 6 > hint.width + 4; c.addChild(hint);
  ui.sellAnchor ??= c;
  return c;
}

/** 제련 모드: 광석 → 괴 */
function makeIngotRows(c, w, h, top) {
  ui.irows = {};
  const rowH = 13, rowW = w - 8;
  const rowsN = Math.max(1, Math.min(ORES.length, Math.floor((h - top - 32) / rowH)));
  const order = ORES.slice().sort((p, q) => (stash[q.key] + S.ingots[q.key] > 0) - (stash[p.key] + S.ingots[p.key] > 0));
  order.slice(0, rowsN).forEach((o, i) => {
    const r = new Container(); r.position.set(4, top + i * rowH);
    const ic = icon(tex(ICON[o.key])); ic.position.set(2, Math.round((13 - ic.height) / 2) + 1); r.addChild(ic);
    const ore = label('', { color: COLOR.paperInk, shadow: false, small: true }); ore.position.set(13, 2); r.addChild(ore);
    const ing = label('', { color: 0x8a5a24, shadow: false, small: true }); ing.position.set(44, 2); r.addChild(ing);
    const price = label('', { color: COLOR.paperInk, shadow: false, small: true }); price.position.set(76, 2); r.addChild(price);
    const meltB = button('paper', 30, 12, '녹이기', () => smeltOne(o.key), { small: true }); meltB.position.set(rowW - 63, 0); r.addChild(meltB);
    const sellB = button('paper', 30, 12, '팔기', () => sellIngots(o.key), { small: true }); sellB.position.set(rowW - 31, 0); r.addChild(sellB);
    ui.irows[o.key] = { ore, ing, price, meltB, sellB };
    c.addChild(r);
  });
  ui.smeltLine = label('', { small: true, color: 0x8a7a68, shadow: false }); ui.smeltLine.position.set(6, h - 31); c.addChild(ui.smeltLine);
  const all = button('paper', 60, 15, '괴 전부 팔기', () => ORES.forEach((o) => sellIngots(o.key)), { small: true });
  all.position.set(w - 64, h - 18); c.addChild(all);
  const melt = button('paper', 60, 15, '전부 녹이기', () => ORES.forEach((o) => smeltOne(o.key, true)), { small: true });
  melt.position.set(w - 128, h - 18); c.addChild(melt);
}
/** 광부 탭: 3명 카드 (이름 · 상태 · 체력 ♥♥♥) */
function makeCrew(w, h) {
  const c = new Container();
  ui.crew = [];
  const rowH = Math.max(18, Math.min(44, Math.floor(h / crew.length)));
  crew.forEach((m, i) => {
    const r = new Container(); r.y = i * rowH;
    const pf = portraitFrame(F[`${m.id}_idle`][0], rowH - 2, 'wood'); r.addChild(pf);
    const compact = rowH < 28;                                // 광부가 많으면 한 줄 (이름 · 상태)
    const nm = label(m.name, { color: m.color, small: compact }); nm.position.set(rowH + 4, compact ? Math.round((rowH - 10) / 2) : 1); r.addChild(nm);
    if (!compact) { const role = label(m.role, { small: true, color: COLOR.dim }); role.position.set(rowH + 8 + Math.round(nm.width), 3); r.addChild(role); }
    const st = label('', { small: true }); st.position.set(compact ? Math.max(rowH + 50, Math.round(w * 0.42)) : rowH + 4, compact ? nm.y : 15); r.addChild(st);
    c.addChild(r);
    ui.crew.push({ m, st });
  });
  return c;
}

function makeSettings(w) {
  const c = new Container();
  const items = [
    [() => `저사양 ${low ? '켬' : '끔'}`, () => setLow(!low)],
    [() => `소리 ${soundOn() ? '켬' : '끔'}`, () => { unlockAudio(); setSound(!soundOn()); S.settings.sound = soundOn(); save(); }],
    [() => (online() ? '로그아웃' : '로그인'), () => (online() ? doLogout() : openLoginForm())],
    ['랭킹', () => openRank()],
    ['전체 화면', () => document.documentElement.requestFullscreen?.().catch(() => {})],
    ['처음부터', () => { if (confirm('저장을 지우고 처음부터 시작할까요?')) { saving = false; resetSave(); location.reload(); } }],
  ];
  const cols = Math.max(2, Math.min(3, Math.floor((w + 4) / 70))), bw = Math.floor((w - (cols - 1) * 4) / cols), bh = 16;
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
  ui.counters.wh && (ui.counters.wh.text = `${whTotal()}/${whCap()}`);
  ui.counters.clock && (ui.counters.clock.text = clockText(ui.counters.clock.short));
  for (const [key, r] of Object.entries(ui.irows ?? {})) {
    if (r.ore.destroyed) continue;
    r.ore.text = `×${stash[key]}`; r.ing.text = `괴×${S.ingots[key]}`; r.price.text = String(ingotPrice(key));
    r.meltB.setDisabled(!stash[key] || !CF.smeltSlots); r.sellB.setDisabled(!S.ingots[key]);
  }
  if (ui.smeltLine && !ui.smeltLine.destroyed) {
    const sm = S.smelt, next = sm.jobs.length ? Math.max(0, Math.ceil((Math.min(...sm.jobs.map((j) => j.doneAt)) - Date.now()) / 1000)) : 0;
    ui.smeltLine.text = sm.jobs.length ? `제련 중 ${sm.jobs.length}/${CF.smeltSlots}${sm.queue.length ? ` · 대기 ${sm.queue.length}` : ''} · 다음 ${next}초` : `제련소 ${CF.smeltSlots}칸 · ${Math.round(CF.smeltSec)}초에 1개`;
  }
  for (const [key, r] of Object.entries(ui.rows)) {
    r.qty.text = `×${stash[key]}`;
    r.price.text = String(priceOf(key));
    const surge = market.surge?.key === key;
    const up = surge && now() >= market.surge.start ? 1 : market.last[key];
    r.arrow.texture = kit(up < 0 ? 'arrow_down' : 'arrow_up'); r.arrow.visible = up !== 0;
    r.btn.setDisabled(stash[key] === 0);
    r.bg.clear(); if (surge) r.bg.rect(0, 0, r.w - 33, 12).fill({ color: 0x9cc45a, alpha: 0.18 + 0.18 * Math.sin(time * 8) });
    else if (idleHi.has(key) && time < idleHiUntil) r.bg.rect(0, 0, r.w - 33, 12).fill({ color: 0xf5cf6a, alpha: 0.35 });
    r.price.tint = surge && now() >= market.surge.start ? 0x46702e : 0xffffff;
    const hist = market.hist[key].slice(-8), max = Math.max(...hist), min = Math.min(...hist);
    r.spark.clear();
    if (r.sparkW >= 16) hist.forEach((v, i) => {
      const hh = 2 + Math.round(((v - min) / Math.max(1, max - min)) * 8);
      r.spark.rect(i * 2, 11 - hh, 1, hh).fill(i === 7 ? (up < 0 ? 0xb84a62 : 0x6a9a3a) : 0x8a7a68);
    });
    if (CF.preview && r.sparkW >= 16 + B.talents.previewTicks * 2) market.peek(key, B.talents.previewTicks).forEach((v, i) => {   // 장사 특성 1: 앞으로 1분 (점선)
      const hh = 2 + Math.round(((Math.min(max, Math.max(min, v)) - min) / Math.max(1, max - min)) * 8);
      for (let yy = 11 - hh; yy < 11; yy += 2) r.spark.rect(16 + i * 2, yy, 1, 1).fill(0xb8a888);
    });
  }
}
function crewStateText(m) {
  const hearts = '♥'.repeat(Math.max(0, m.hp)) + '♡'.repeat(Math.max(0, B.minerHp - m.hp));
  const st = { idle: '대기', walk: '이동 중', dig: '채굴 중', carry: '운반 중', fall: '떨어지는 중!', land: '엉덩방아', stun: '기절', rest: '지상에서 쉬는 중', cough: '콜록콜록' }[m.state] ?? m.state;
  return `${hearts}  ${st}`;
}

function sell(key, frac) {
  const n = Math.ceil(stash[key] * frac);
  if (!n) return;
  stash[key] -= n;
  tutorialDone(5);
  const gain = n * priceOf(key);
  sfx('stash');
  const r = ui.rows[key];
  const from = r ? r.btn.getGlobalPosition() : { x: L.W / 2, y: L.H / 2 };
  S.gold += gain; if (S.round) S.round.stats.revenue += gain;
  flyNumber('coin', from.x + 15 * L.uiS, from.y, gain, () => { refreshUI(); bumpCounter('coin'); });
  if (market.surge?.key === key && now() >= market.surge.start && now() < market.surge.end) count('surgeSells');
  count('soldGold', gain);
  refreshUI();
}

const bumps = [];
function bumpCounter(key) {
  const n = ui.counters[key];
  if (!n) return;
  n.scale.set(1.3); n.tint = 0xfff4b8;
  bumps.push({ n, t: 0.16 });
}
let inFlight = 0;                                         // 창고로 날아가는 중인 광석 (용량 계산에 포함)
function orePopup(kind, x, y, n) {
  sfx('ore');
  const [sx, sy] = toScreen(x, y);
  stash[kind] += n;                                       // 숫자는 바로 반영(저장), 날아가는 건 그림만
  count('ores', n);
  flyNumber(kind, sx, sy, n, () => { refreshUI(); bumpCounter('wh'); sfx('stash', true); });
}
function flyNumber(kind, sx, sy, n, done) {
  const el = document.createElement('div');
  el.className = `pop pop-${kind}`;
  el.innerHTML = `<i></i>+${n}`;
  document.body.appendChild(el);
  const target = ui.counters[kind] ?? (kind === 'coin' ? null : ui.counters.wh) ?? ui.sellAnchor;
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

// 알림: 양피지 틀. who(모모·할아범)가 있으면 왼쪽에 그 인물 치비를 틀 안에
let toastT = 0;
function toast(msg, who, secs) {
  const t = ui.toast;
  if (!t) return;
  t.removeChildren().forEach((c) => c.destroy());
  const face = who ? 34 : 0;
  const maxW = Math.round(L.W / L.uiS) - 12 - face - 16;
  const tx = label(msg, { color: COLOR.paperInk, shadow: false, small: true, wrap: maxW });
  const w = Math.ceil(tx.width) + 16 + face, h = Math.max(who ? 44 : 20, Math.ceil(tx.height) + 10);
  t.addChild(frame('paper', w, h, 'panel'));
  if (who) { const pf = portraitFrame(tex(NPC[who]), 36, 'wood'); pf.position.set(4, 4); t.addChild(pf); }
  t.addChild(tx);
  tx.position.set(8 + face + (who ? 4 : 0), Math.round((h - tx.height) / 2));
  const Wu = Math.round(L.W / L.uiS);
  const bottom = L.portrait ? Math.round(L.panels.sheet.y / L.uiS) - 4 : Math.round(L.H / L.uiS) - 8;
  t.position.set(Math.round((Wu - w) / 2), bottom - h);
  t.visible = true;
  toastT = secs ?? (who ? 2.6 : 1.4);
}

function setLow(v) { low = v; S.settings.low = v; save(); }
document.getElementById('ref').onclick = () => document.getElementById('ref').classList.remove('show');
document.getElementById('ref-shaft').src = A('scenes/shaft_night.png');
document.getElementById('ref-office').src = A('scenes/office_night.png');
const uiFx = [];
market.onTick = () => { refreshUI(); };
// 급등: 30초 전 모모 편지 → 그 광종 행이 UI 펄스 → 40초 동안 ×1.8
market.onWarn = (key, warn = B.surgeWarn) => {
  const o = ORES.find((q) => q.key === key), who = B.buyers[buyerOf(key)].name;
  toast(`오늘 저녁 ${who}이(가) ${o.name}을(를) 비싸게 산대요! (${warn}초 뒤)`, 'momo', 5);
  sfx('bell');
};
market.onSurge = (key) => { const o = ORES.find((q) => q.key === key); toast(`지금 ${o.name} 시세 ×${B.surgeMul}! 40초 동안`, 'momo', 3); sfx('stash'); };

// 말풍선 그리기 (UI 층, 캐릭터 머리 위를 따라감)
function drawEmotes(dt) {
  for (let k = emotes.length - 1; k >= 0; k--) {
    const e = emotes[k];
    e.t -= dt;
    if (e.t <= 0) { e.view?.destroy({ children: true }); emotes.splice(k, 1); continue; }
    if (!e.view) {
      e.view = new Container();
      const t = label(e.text, { small: true, color: e.color ?? COLOR.paperInk, shadow: false });
      const w = Math.ceil(t.width) + 8;
      e.view.addChild(frame('paper', w, 16, 'panel'), t); t.position.set(4, 2);
      e.view.w = w; worldUI.addChild(e.view);
    }
    const [sx, sy] = toScreen(e.a.x, e.a.y - (e.a === mole ? 12 : 22));
    e.view.scale.set(L.uiS);
    e.view.position.set(Math.round(sx - e.view.w * L.uiS / 2), Math.round(sy - 18 * L.uiS));
  }
}

// ================================================================ 시추 (명세2 §5): 갱도 그리기 → 광부가 차례로 판다 · 광맥은 통째로 · 중력(§1)
// 이동 그래프: 'S'(지상) + 뚫린 칸. 옆으로는 발밑이 받쳐 주는 칸만, 위아래는 사다리로 (세로로 판 칸엔 사다리가 생긴다)
const idx = (gx, gy) => gy * GW + gx;
const cxy = (n) => [n % GW, Math.floor(n / GW)];
const cellX = (gx) => GX + gx * T + 8;
const floorY = (gy) => GY + (gy + 1) * T + 1;
const ladderAt = (gx, gy) => !!W && gy >= 0 && gy < W.rows && gx >= 0 && gx < GW && W.ladder[gy][gx];
const climbAt = (gx, gy) => !!W && gy >= 0 && gy < W.rows && gx >= 0 && gx < GW && W.climb[gy][gx];
/** 오르내릴 수 있는 칸: 그린 사다리 또는 광맥 공간(벽을 짚고 기어오름) */
const holdAt = (gx, gy) => ladderAt(gx, gy) || climbAt(gx, gy);
const waterAt = (gx, gy) => !!W && gy >= 0 && gy < W.rows && gx >= 0 && gx < GW && W.water[gy][gx];
/** 발밑이 받쳐 주나 (사다리거나 아래가 막혔거나 맨 아래) */
const supported = (gx, gy) => holdAt(gx, gy) || gy + 1 >= W.rows || !isDug(gx, gy + 1);
function graphNeighbors(n, out) {
  out.length = 0;
  if (n === 'S') { for (let gx = 0; gx < GW; gx++) if (isDug(gx, 0)) out.push(idx(gx, 0)); return out; }
  const [x, y] = cxy(n);
  if (y === 0) out.push('S');
  for (const dx of [-1, 1]) if (isDug(x + dx, y) && supported(x + dx, y) && supported(x, y)) out.push(idx(x + dx, y));
  if (isDug(x, y - 1) && (holdAt(x, y) || holdAt(x, y - 1))) out.push(idx(x, y - 1));
  if (isDug(x, y + 1) && (holdAt(x, y) || holdAt(x, y + 1))) out.push(idx(x, y + 1));
  return out;
}
/** 너비 우선: start에서 goal(n) 참인 곳까지 노드 목록 (start 제외). 못 가면 null */
function findPath(start, goal) {
  if (goal(start)) return [];
  const prev = new Map([[start, null]]), q = [start], nb = [];
  while (q.length) {
    const n = q.shift();
    for (const m of graphNeighbors(n, nb)) {
      if (prev.has(m)) continue;
      prev.set(m, n);
      if (goal(m)) { const path = [m]; let k = n; while (k !== start) { path.unshift(k); k = prev.get(k); } return path; }
      q.push(m);
    }
  }
  return null;
}
const nodeOf = (a) => a.node ?? 'S';

// ---- 칸 파기 · 광맥 · 유물 (사건은 6단계)
const canDig = (t) => (B.hardness[t] ?? 9) <= CF.pick;
const digSeconds = (t) => ORE_KEYS.has(t) ? B.digTime.ore : t === 'd' ? CF.dirt : (B.digTime[t] ?? 1);
let piles = [];                                           // 캔 광석 더미: { gx, gy, type, n } — 운반 광부가 나른다
const marks = [];                                          // 빨간 X
function markX(gx, gy) {
  const s = new Sprite(tex('mark_x')); s.anchor.set(0.5); s.scale.set(1 / DENS * 1.4); s.position.set(cellX(gx), GY + gy * T + 8);
  markU.addChild(s); marks.push({ s, t: B.badCellFlash });
}
function syncRound() {                                     // 세계 → 저장
  if (!W || !S.round) return;
  S.round.grid = W.g.map((r) => r.join(''));
  S.round.ladder = W.ladder.map((r) => r.map((v) => (v ? '1' : '0')).join(''));
  S.round.climb = W.climb.map((r) => r.map((v) => (v ? '1' : '0')).join(''));
  S.round.rail = W.rail.map((r) => r.map((v) => (v ? '1' : '0')).join(''));
  S.round.water = W.water.map((r) => r.map((v) => (v ? '1' : '0')).join(''));
  S.round.piles = piles;
  S.round.cartCargo = { ...cartA.cargo }; S.round.cartCargo2 = { ...cartB.cargo };
}
/** 광맥에 닿으면 덩어리 전체가 채굴 대상 (가까운 칸부터) */
function claimVeinsNear(gx, gy) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = gx + dx, y = gy + dy;
    if (x < 0 || x >= GW || y < 0 || y >= W.rows) continue;
    const id = W.veins.id[y][x];
    if (id < 0 || !ORE_KEYS.has(W.g[y][x])) continue;
    const v = W.veins.list[id];
    if (S.round.claimed.includes(id)) continue;
    S.round.claimed.push(id); count('veins');
    const cells = v.cells.filter(([cx, cy]) => ORE_KEYS.has(W.g[cy][cx]))
      .sort((p, q) => Math.abs(p[0] - x) + Math.abs(p[1] - y) - Math.abs(q[0] - x) - Math.abs(q[1] - y));
    S.round.jobs.unshift(...cells.map(([cx, cy]) => ({ x: cx, y: cy, vein: id })));
    S.round.stats.maxVein = Math.max(S.round.stats.maxVein, v.size);
    if (v.size >= B.bigVein && !S.round.jackpotVeins?.includes(id)) {
      (S.round.jackpotVeins ??= []).push(id); S.round.stats.jackpots++; count('jackpots');
      bigVein(cellX(x), GY + y * T + 8);
    } else toast(`광맥 발견! ${ORES.find((o) => o.key === v.type)?.name ?? ''} ${v.size}칸 — 광부들이 다 캘게요`);
    tutorialDone(4);
    if (CF.chainVein) revealNearVeins(v, id);
  }
}
let seenCells = new Set();                                 // 특성으로 드러난 칸 ("x,y")
function revealNearVeins(v, id) {
  const R2 = B.talents.chainRange; let n = 0;
  W.veins.list.forEach((u, j) => {
    if (j === id || S.round.claimed.includes(j) || u.cells.every(([x, y]) => seenCells.has(`${x},${y}`))) return;
    if (!u.cells.some(([ux, uy]) => v.cells.some(([vx, vy]) => Math.max(Math.abs(ux - vx), Math.abs(uy - vy)) <= R2))) return;
    for (const [x, y] of u.cells) { seenCells.add(`${x},${y}`); refreshAround(x, y, 0); }
    n++;
  });
  if (n) { S.round.seen = [...seenCells]; toast(`근처 광맥 ${n}개가 보여요!`, 'momo'); }
}
function breakCell(gx, gy, from, job) {
  const t = W.g[gy][gx];
  W.g[gy][gx] = '.';
  W.rail[gy][gx] = true;                                   // 뚫린 길엔 레일이 깔림
  if (job?.ladder) {                                       // 플레이어가 세로로 그린 경로 → 사다리 (이 칸 + 경로 앞 칸)
    W.ladder[gy][gx] = true;
    if (job.prev && job.prev !== 'S') { const [px, py] = job.prev; if (isDug(px, py)) W.ladder[py][px] = true; }
  } else if (job?.vein != null || !job) {                  // 광맥·폭발로 생긴 빈 공간은 사다리 없이 기어오름
    W.climb[gy][gx] = true;
    if (from != null && from !== 'S' && cxy(from)[0] === gx) { const [fx, fy] = cxy(from); W.climb[fy][fx] = W.climb[fy][fx] || !W.ladder[fy][fx]; }
  }
  const x0 = GX + gx * T, y0 = GY + gy * T;
  sfx('break', true);
  const cols = DEBRIS[t] ?? DEBRIS.d;
  for (let i = 0; i < 8; i++)
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.6 + Math.random() * 0.4, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.4 ? 1 : 0.5 });
  if (ORE_KEYS.has(t)) {
    fx(t === 'c' ? 'fx_vein_glow' : 'fx_vein', x0 + 8, y0 + 8);
    const p = piles.find((q) => q.gx === gx && q.gy === gy && q.type === t);
    if (p) p.n++; else piles.push({ gx, gy, type: t, n: 1 });
  } else fx(t === 'd' ? 'fx_dirt' : 'fx_rock', x0 + 8, y0 + 8);
  if (t === 'R') {                                          // 유물 상자: 금화 + 도감
    const gold = Math.round(B.relicGold[0] + Math.random() * (B.relicGold[1] - B.relicGold[0]));
    S.round.stats.relics++; count('relics'); S.round.stats.relicGold += gold; S.stats.relics.push({ day: S.day, gold });
    const [sx, sy] = toScreen(x0 + 8, y0 + 4);
    S.gold += gold;
    flyNumber('coin', sx, sy, gold, () => { refreshUI(); bumpCounter('coin'); });
    toast(`유물 상자! 금화 ${gold}`, 'halabeoji'); sfx('bell');
  }
  onCellBroken?.(gx, gy, t);
  refreshAround(gx, gy, 1); drawEdges(); drawSolid(); drawProps();
  claimVeinsNear(gx, gy);
  syncRound();
}
// ---------------------------------------------------------------- 사건 (명세2 §7): 붕괴 · 지하수 · 가스 · 갱도 몬스터
const EVENT_NAME = { collapse: '갱도 붕괴', water: '지하수', gas: '가스', monster: '갱도 몬스터', boom: '가스 폭발', bats: '박쥐떼' };
function logEvent(kind) { S.round.stats.events.push(kind); eventLog.unshift(`${clockText().split(' ')[1]} ${EVENT_NAME[kind]}`); eventLog.length = Math.min(eventLog.length, 8); if (!L.portrait) buildUI(); }
const eventLog = [];
let onCellBroken = (gx, gy, t) => {
  const rd = S.round;
  // 물 칸 바로 위·옆이 뚫리면 물이 흘러듦
  if (t !== 'w' && (W.water[gy - 1]?.[gx] || W.water[gy][gx - 1] || W.water[gy][gx + 1]) && !(rd.pumpLeft > 0)) t = 'flow';
  if (t === 'w' || t === 'flow') {                                           // 지하수: 그 칸에서 아래(·옆)로 이어진 뚫린 칸이 물로 참
    const q = [[gx, gy]], seen = new Set([`${gx},${gy}`]);
    while (q.length) {
      const [x, y] = q.shift(); W.water[y][x] = true;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (isDug(nx, ny) && !seen.has(key) && (dy === 1 || !isDug(x, y + 1) || W.water[y + 1]?.[x])) { seen.add(key); q.push([nx, ny]); }
      }
    }
    fx('fx_water', cellX(gx), GY + gy * T + 8);
    if (t === 'flow') return;
    sfx('break'); logEvent('water');
    toast(`지하수가 터졌어요! 물 칸은 걸음이 느려지고 광차가 못 지나가요 — ${CF.autoPump ? '펌프실이 곧 퍼내요' : `[펌프 ${CF.pumpCost}]`}`, 'momo', 4);
    if (CF.autoPump && !(rd.pumpLeft > 0)) setTimeout(() => { if (S.round === rd && !(rd.pumpLeft > 0)) pump(true); }, 1500);
    buildUI();
  }
  if (t === 'x') {                                           // 가스: 30초 채굴 정지 · 랜턴 불꽃이 닿으면 폭발
    rd.gasLeft = B.gasSeconds; rd.gasCell = [gx, gy];
    fx('fx_gas', cellX(gx), GY + gy * T + 8); logEvent('gas');
    for (const a of crew) emote(a, '콜록콜록', 2);
    toast(`가스가 새어 나와요! ${B.gasSeconds}초 쉬어 가요 (랜턴 불꽃은 멀리…)`, 'momo', 4);
  }
  if (t === 'o' && rd.card.floor === 2 && Math.random() < B.abandoned.batChance) {   // 폐광: 박쥐떼 — 가까운 광부 기절 (포탑 2등급↑이면 쏨)
    const A = B.abandoned;
    logEvent('bats');
    for (let i = 0; i < 14; i++) particle(sparksU, { x: cellX(gx), y: GY + gy * T + 8, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 60, life: 0.9 + Math.random() * 0.5, color: 0x2a2634, g: -10, size: 1 });
    sfx('clink');
    if (CF.turret >= A.batGrade) toast('박쥐떼! 광차 포탑이 쫓아냈어요', 'momo', 2);
    else {
      let n = 0;
      for (const a of crew) {
        if (typeof a.node !== 'number' || a.fall) continue;
        const [ax, ay] = cxy(a.node);
        if (Math.max(Math.abs(ax - gx), Math.abs(ay - gy)) <= A.batRadius) { a.busy = { t: A.batStun * CF.stunMul, kind: 'stun' }; a.path = []; emote(a, '박쥐다!', 1); n++; }
      }
      toast(n ? `박쥐떼! 광부 ${n}명이 잠깐 기절했어요` : '박쥐떼가 날아갔어요', 'momo', 2.5);
    }
  } else if (t === 'o' && Math.random() < B.monsterChance) {        // 동굴: 10%로 갱도 몬스터 (이번 단계: 광차 길막)
    const mo = { gx, gy, until: time + B.monsterSeconds, grade: 1, kind: 'slime' };
    (rd.monsters ??= []).push(mo);
    logEvent('monster');
    if (CF.turret >= mo.grade) {                              // 포탑 공방: 광차 포탑이 쏜다
      mo.until = time + 1.2; mo.shot = true;
      setTimeout(() => { fx('fx_hit', cellX(gx), GY + gy * T + 8); fx('fx_pulse', cellX(gx), GY + gy * T + 8); sfx('break'); }, 600);
      toast('슬라임이 나왔지만 광차 포탑이 쐈어요!', 'momo', 2);
    } else toast('동굴에서 슬라임이 나왔어요! 광차가 지나가지 못해요', 'momo', 3);
  }
};
function pump(auto = false) {
  const cost = auto ? 0 : CF.pumpCost;
  if (S.gold < cost) { toast('금화가 모자라요'); return; }
  S.gold -= cost; refreshUI(); sfx('stash');
  S.round.pumpLeft = B.pumpSeconds; toast(`${auto ? '펌프실 자동 펌프' : '펌프'} 가동! ${B.pumpSeconds}초 뒤 물이 빠져요`);
  buildUI();
}
function explode(gx, gy) {                                   // 랜턴 불꽃 + 가스 = 폭발: 3×3 흙·바위가 뚫림 + 근처 광부 체력 −1
  const rd = S.round;
  rd.gasLeft = 0; rd.gasCell = null; logEvent('boom');
  flash = 0.8; shake = 0.5; shakeAmp = 4; sfx('bell'); sfx('break');
  fx('fx_daebak', cellX(gx), GY + gy * T + 8); fx('fx_collapse', cellX(gx), GY + gy * T + 8);
  const r = B.explosionRadius;
  for (let y = gy - r; y <= gy + r; y++) for (let x = gx - r; x <= gx + r; x++) {
    if (!inGrid(x, y) || isDug(x, y)) continue;
    if (W.g[y][x] === 'd' || W.g[y][x] === 'r') breakCell(x, y, null);
  }
  for (const a of crew) if (typeof a.node === 'number') { const [x, y] = cxy(a.node); if (Math.abs(x - gx) <= r + 1 && Math.abs(y - gy) <= r + 1) hurt(a); }
  toast('쾅! 가스가 폭발했어요 — 위험한 꼼수!', 'halabeoji', 3);
}
/** 붕괴: 뚫린 칸 ≥ 15일 때, 가로로 이어진 2~3칸이 흙으로 메워짐 */
function collapse() {
  const len = B.collapseLen[0] + Math.floor(Math.random() * (B.collapseLen[1] - B.collapseLen[0] + 1));
  const busy = new Set(crew.concat(carts).filter((a) => typeof a.node === 'number').map((a) => a.node));
  const runs = [];
  for (let y = 1; y < W.rows; y++) for (let x = 0; x + len <= GW; x++) {
    let ok = true;
    for (let k = 0; k < len; k++) if (!isDug(x + k, y) || ladderAt(x + k, y) || busy.has(idx(x + k, y))) { ok = false; break; }
    if (ok) runs.push([x, y]);
  }
  if (!runs.length) return false;
  const [x0, y0] = runs[Math.floor(Math.random() * runs.length)];
  for (let k = 0; k < len; k++) { W.g[y0][x0 + k] = 'd'; W.rail[y0][x0 + k] = false; W.water[y0][x0 + k] = false; W.climb[y0][x0 + k] = false; }
  for (let k = 0; k < len; k++) refreshAround(x0 + k, y0, 1);
  drawEdges(); drawSolid(); drawProps(); syncRound();
  fx('fx_collapse', cellX(x0) + (len - 1) * T / 2, GY + y0 * T + 6);
  shake = 0.3; shakeAmp = 2; sfx('break');
  logEvent('collapse');
  toast('갱도 천장이 무너졌어요! 다시 그리면 돼요 (흙 0.6초)', 'halabeoji', 3);
  return true;
}
function updateEvents(dt) {
  const rd = S.round;
  if (!rd || rd.state !== 'DIG') return;
  if (!oreLeft() && rd.claimed.length && !piles.length && !carts.some((c) => loadOf(c)) && !crew.some((a) => a.carrying) && carts.every((c) => c.mode === 'park')) {
    rd.doneT = (rd.doneT ?? 0) + dt;
    if (rd.doneT > 1.5) { toast('광맥을 전부 캤어요!', 'momo'); endRound('done'); return; }
  } else rd.doneT = 0;
  rd.eventT ??= B.eventGap[0] + Math.random() * (B.eventGap[1] - B.eventGap[0]);
  rd.eventMax ??= B.eventsPerRound[0] + Math.floor(Math.random() * (B.eventsPerRound[1] - B.eventsPerRound[0] + 1));
  rd.eventT -= dt;
  const dug = W.g.flat().filter((c) => c === '.').length;
  if (rd.eventT <= 0) {
    rd.eventT = B.eventGap[0] + Math.random() * (B.eventGap[1] - B.eventGap[0]);
    const done = rd.stats.events.filter((e) => e === 'collapse').length;
    if (done < rd.eventMax && dug >= B.collapseMinDug) collapse();
  }
  if (rd.gasLeft > 0) {
    rd.gasLeft -= dt;
    const [lx, ly] = lanternFlame();
    if (rd.gasCell && Math.hypot(lx - cellX(rd.gasCell[0]), ly - (GY + rd.gasCell[1] * T + 8)) <= B.gasLanternCells * T) explode(...rd.gasCell);
    else if (rd.gasLeft <= 0) { rd.gasCell = null; toast('가스가 다 빠졌어요. 다시 캐요!'); }
    if (Math.random() < dt * 0.5) for (const a of crew) if (a.y > GY && Math.random() < 0.4) emote(a, '콜록', 1);
  }
  if (rd.pumpLeft > 0) {
    rd.pumpLeft -= dt;
    if (rd.pumpLeft <= 0) { for (const row of W.water) row.fill(false); syncRound(); toast('물이 다 빠졌어요'); buildUI(); }
  }
  if (rd.monsters?.length) {
    for (const m of rd.monsters) if (m.until <= time && !m.gone) { m.gone = true; if (!m.shot) toast('슬라임이 사라졌어요'); }
    rd.monsters = rd.monsters.filter((m) => m.until > time);
  }
}

// ---- 갱도 그리기 (손가락 연속 드래그, 상하좌우만)
const drawing = { on: false, path: [], from: null, g: new Graphics(), label: null };
markU.addChild(drawing.g);
const cellAtWorld = (wx, wy) => [Math.floor((wx - GX) / T), Math.floor((wy - GY) / T)];
const inGrid = (gx, gy) => !!W && gx >= 0 && gx < GW && gy >= 0 && gy < W.rows;
const adjDug = (gx, gy) => isDug(gx - 1, gy) || isDug(gx + 1, gy) || isDug(gx, gy - 1) || isDug(gx, gy + 1);
/** 그리기 시작점: 지상에 닿은 0줄 · 뚫린 칸 · 뚫린 칸과 맞닿은 칸 */
const validStart = (gx, gy) => inGrid(gx, gy) && (gy === 0 || isDug(gx, gy) || adjDug(gx, gy));
function drawPush(gx, gy) {
  const p = drawing.path, last = p[p.length - 1];
  if (!inGrid(gx, gy)) return;
  if (last && last[0] === gx && last[1] === gy) return;
  const prev = p[p.length - 2];
  if (prev && prev[0] === gx && prev[1] === gy) { p.pop(); return; }   // 되돌아가면 지움
  if (last && Math.abs(last[0] - gx) + Math.abs(last[1] - gy) > 1) {   // 빨리 그어 건너뛴 칸은 ㄱ자로 채움
    let [x, y] = last;
    while (x !== gx) { x += Math.sign(gx - x); drawPush(x, y); }
    while (y !== gy) { y += Math.sign(gy - y); drawPush(x, y); }
    return;
  }
  if (p.some(([x, y]) => x === gx && y === gy)) return;
  p.push([gx, gy]);
}
function drawPreview() {
  const g = drawing.g; g.clear();
  if (!drawing.on || !drawing.path.length) { if (drawing.label) drawing.label.visible = false; return; }
  const p = drawing.path;
  let total = 0, cut = false;
  const under = new Set(crew.filter((a) => typeof a.node === 'number').map((a) => { const [x, y] = cxy(a.node); return `${x},${y + 1}`; }));
  const blink = Math.floor(time * 6) % 2 === 0;
  p.forEach(([gx, gy], i) => {
    const x = cellX(gx), y = GY + gy * T + 8;
    const t = W.g[gy][gx];
    const shown = revealed(gx, gy) ? t : 'd';
    if (i > 0) { const [px, py] = p[i - 1]; g.moveTo(cellX(px), GY + py * T + 8).lineTo(x, y); }
    if (t !== '.' && !cut) { if (revealed(gx, gy) && !canDig(t)) cut = true; else total += digSeconds(shown); }
  });
  g.stroke({ width: 3, color: 0xe8702e, alpha: 0.55, cap: 'round', join: 'round' });
  p.forEach(([gx, gy]) => {
    const x = GX + gx * T, y = GY + gy * T;
    const warn = under.has(`${gx},${gy}`);
    if (warn && blink) g.rect(x + 1, y + 1, T - 2, T - 2).stroke({ width: 1, color: 0xff3a3a });
    else if (!isDug(gx, gy)) g.rect(x + 5, y + 5, 6, 6).fill({ color: 0xf5cf6a, alpha: 0.5 });
  });
  if (!drawing.label) { drawing.label = label('', { small: true, color: COLOR.paper }); worldUI.addChild(drawing.label); }
  const [lx, ly] = p[p.length - 1];
  const [sx, sy] = toScreen(cellX(lx), GY + ly * T);
  drawing.label.text = `${total.toFixed(1)}초`; drawing.label.visible = true;
  drawing.label.scale.set(L.uiS); drawing.label.position.set(Math.round(sx + 8 * L.uiS), Math.round(sy - 14 * L.uiS));
}
function commitPath() {
  const p = drawing.path;
  drawing.on = false; drawPreview();
  if (!p.length) return;
  const queued = new Set(S.round.jobs.map((j) => `${j.x},${j.y}`));
  let from = isDug(p[0][0], p[0][1]) ? idx(p[0][0], p[0][1]) : null, added = 0;
  for (let i = 0; i < p.length; i++) {
    const [gx, gy] = p[i];
    if (isDug(gx, gy)) { from = idx(gx, gy); continue; }
    const t = W.g[gy][gx];
    if (!canDig(t)) { markX(gx, gy); sfx('clink', true); toast(t === 'a' ? '고대석은 곡괭이 3등급부터예요' : '단단한 바위는 곡괭이 2등급부터예요'); break; }   // 못 뚫는 칸에서 끊고 나머지 취소
    const prev = i > 0 ? p[i - 1] : (gy === 0 ? 'S' : null);
    const vertical = prev === 'S' || (prev && prev[0] === gx);
    if (!queued.has(`${gx},${gy}`)) { S.round.jobs.push({ x: gx, y: gy, from: from ?? (gy === 0 ? 'S' : null), ladder: vertical, prev }); added++; }
    from = idx(gx, gy);
  }
  if (added) { sfx('stash', true); tutorialDone(3); }
  syncRound();
}

// ---- 광부 행동: 붉은 수염 = 선두 채굴 / 뚱보·금발 = 운반
function moveAlong(a, dt) {
  if (!a.path?.length) return true;
  const n = a.path[0];
  let tx, ty, final;
  if (n === 'S') {                                         // 0줄 칸 → 지상: 위로 올라감
    tx = typeof a.node === 'number' ? cellX(cxy(a.node)[0]) : a.x; ty = SURFACE_Y + 0.5; final = true;
  } else {
    const [gx, gy] = cxy(n);
    tx = cellX(gx);
    if (nodeOf(a) === 'S' && Math.abs(a.x - tx) > 0.5) { ty = SURFACE_Y + 0.5; final = false; }   // 지상에서 그 열까지 먼저 걷고
    else { ty = floorY(gy); final = true; }
  }
  const vertical = Math.abs(tx - a.x) < 0.5;
  let sp = (vertical ? B.climbSpeed : (a.carrying ? B.carrySpeed : B.walkSpeed)) * T;
  if (typeof a.node === 'number' && waterAt(...cxy(a.node))) sp *= B.waterSlow;
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), stepLen = sp * dt;
  if (Math.abs(dx) > 0.5) a.face = Math.sign(dx);
  if (d <= stepLen) { a.x = tx; a.y = ty; if (final) { a.node = n; a.path.shift(); } }
  else { a.x += dx / d * stepLen; a.y += dy / d * stepLen; }
  setAnim(a, `${a.id}_walk`);
  return !a.path.length;
}
/** 서 있을 자리: target 칸에 맞닿은 뚫린 칸(0줄이면 지상도) */
function standGoal(gx, gy) {
  return (n) => {
    if (n === 'S') return gy === 0;
    const [x, y] = cxy(n);
    return Math.abs(x - gx) + Math.abs(y - gy) === 1 && supported(x, y);
  };
}
function updateDigger(a, dt) {
  const rd = S.round;
  if (a.busy) return;
  if (a.job) {
    const { x, y } = a.job;
    if (W.g[y][x] === '.') { a.job = null; return; }
    if (a.path?.length) { moveAlong(a, dt); return; }
    // 도착: 곡괭이질 (0줄은 지상에서 그 열까지 걸어가서)
    if (!standGoal(x, y)(nodeOf(a))) { a.job = null; return; }
    if (nodeOf(a) === 'S' && Math.abs(a.x - cellX(x)) > 0.5) { const d = cellX(x) - a.x; a.face = Math.sign(d); a.x += Math.sign(d) * Math.min(Math.abs(d), B.walkSpeed * T * dt); setAnim(a, 'red_walk'); a.state = 'walk'; return; }
    if (S.round.gasLeft > 0) { setAnim(a, 'red_idle'); a.state = 'cough'; return; }
    a.state = 'dig';
    const sx = typeof a.node === 'number' ? cxy(a.node)[0] : x;
    a.face = x > sx ? 1 : x < sx ? -1 : a.face;
    setAnim(a, 'red_swing');
    a.digT = (a.digT ?? 0) + dt;
    if (a.p.i === 2 && a.lastFrame !== 2) {                // 내리치는 프레임: 스파크 · 파편
      const t = W.g[y][x];
      fx('fx_hit', cellX(x) - a.face * 6, GY + y * T + 8);
      for (let i = 0; i < 3; i++) particle(dustA, { x: cellX(x) - a.face * 6, y: GY + y * T + 8, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 40, life: 0.5, color: (DEBRIS[t] ?? DEBRIS.d)[i % 2], solid: true, fade: false, size: 0.5 });
      sfx('hit', true);
    }
    a.lastFrame = a.p.i;
    const need = digSeconds(W.g[y][x]);
    if (a.digT >= need) {
      a.digT = 0;
      rd.jobs = rd.jobs.filter((j) => !(j.x === x && j.y === y));
      breakCell(x, y, nodeOf(a), a.job);
      a.job = null;
    }
    return;
  }
  // 다음 일: 순서대로, 갈 수 있는 첫 칸
  for (const j of rd.jobs) {
    if (W.g[j.y][j.x] === '.') continue;
    if (!canDig(W.g[j.y][j.x])) continue;
    const path = findPath(nodeOf(a), standGoal(j.x, j.y));
    if (path) { a.job = j; a.path = path; a.digT = 0; a.state = 'walk'; return; }
  }
  rd.jobs = rd.jobs.filter((j) => W.g[j.y][j.x] !== '.');
  a.state = 'idle'; setAnim(a, 'red_idle');
}
/** 운반 광부: 광석 더미 → 광차 (광차가 서 있고 자리가 있을 때) */
const loadOf = (c) => Object.values(c.cargo).reduce((x, y) => x + y, 0);
const cartLoad = () => loadOf(cart);
const cartOpen = () => cart.mode === 'park' && cartLoad() < CF.cartLoad;
/** 운반 광부가 쓸 광차: 같은 칸에 서 있는 빈자리 광차 → 아무 빈자리 광차 → 첫 광차 */
function pickCart(a) {
  const live = liveCarts(), open = live.filter((c) => c.mode === 'park' && loadOf(c) < CF.cartLoad);
  return open.find((c) => c.node === nodeOf(a)) ?? open[0] ?? live[0];
}
function updateCarrier(a, dt) {
  if (a.busy) return;
  cart = pickCart(a);
  if (a.path?.length) { a.state = a.carrying ? 'carry' : 'walk'; moveAlong(a, dt); return; }
  if (a.carrying) {                                         // 광차에 붓기
    if (cartOpen() && nodeOf(a) === cart.node && (cart.node !== 'S' || Math.abs(a.x - cart.x) < 6)) {
      const n = Math.min(a.carrying.n, CF.cartLoad - cartLoad());
      cart.cargo[a.carrying.type] += n; a.carrying.n -= n;
      sfx('ore', true); cart.idleT = 0;
      if (!a.carrying.n) a.carrying = null;
      return;
    }
    if (cartOpen()) {
      if (cart.node === 'S' && nodeOf(a) === 'S') { const d = cart.x - a.x; a.face = Math.sign(d) || 1; a.x += Math.sign(d) * Math.min(Math.abs(d), B.carrySpeed * T * dt); setAnim(a, a.id + '_walk'); a.state = 'carry'; return; }
      const path = findPath(nodeOf(a), (n) => n === cart.node);
      if (path) { a.path = path; return; }
    }
    a.state = 'carry'; setAnim(a, a.id + '_idle');          // 광차 기다림 (들고 서 있음)
    return;
  }
  // 줍기: 가장 가까운 더미
  if (a.pickT > 0) { a.pickT -= dt; setAnim(a, `${a.id}_idle`); a.state = 'carry'; return; }
  const here = typeof a.node === 'number' ? cxy(a.node) : null;
  const pile = here && piles.find((p) => p.gx === here[0] && p.gy === here[1] && p.n > 0);
  if (pile) {
    const n = Math.min(B.carryPerTrip, pile.n);
    pile.n -= n; a.carrying = { type: pile.type, n }; a.pickT = B.pickupSeconds * n;
    piles = piles.filter((p) => p.n > 0);
    return;
  }
  const want = piles.filter((p) => p.n > 0);
  if (want.length) {
    const path = findPath(nodeOf(a), (n) => typeof n === 'number' && want.some((p) => idx(p.gx, p.gy) === n));
    if (path) { a.path = path; a.state = 'walk'; return; }
  }
  // 할 일 없으면 붉은 수염 근처(한두 칸 뒤)에서 대기
  const red = crew[0];
  if (typeof red.node === 'number' && nodeOf(a) !== red.node && (a.followT = (a.followT ?? 0) - dt) <= 0) {
    a.followT = 2 + Math.random();
    const path = findPath(nodeOf(a), (n) => n === red.node);
    if (path && path.length > 1) { a.path = path.slice(0, -1); return; }
  }
  a.state = 'idle'; setAnim(a, `${a.id}_idle`);
}
// ---- 광차 (명세2 §5-3): 뚫린 길에 레일 자동 부설 · 세로 갱은 도르래로 오르내림 · 적재 8 · 2칸/초 · 창고 60
const cartY = (gy) => GY + gy * T + 14;
const gyOf = (n) => (n === 'S' ? -1 : cxy(n)[1]);
const blockedForCart = (gx, gy) => waterAt(gx, gy) || (S.round?.monsters ?? []).some((m) => m.gx === gx && m.gy === gy && m.until > time);
const cartSupported = (gx, gy) => gy + 1 >= W.rows || !isDug(gx, gy + 1) || holdAt(gx, gy);
function cartNeighbors(n, out) {
  out.length = 0;
  if (n === 'S') { for (let gx = 0; gx < GW; gx++) if (isDug(gx, 0) && !blockedForCart(gx, 0)) out.push(idx(gx, 0)); return out; }
  const [x, y] = cxy(n);
  if (y === 0) out.push('S');
  for (const dx of [-1, 1]) if (isDug(x + dx, y) && !blockedForCart(x + dx, y) && cartSupported(x + dx, y)) out.push(idx(x + dx, y));
  for (const dy of [-1, 1]) if (isDug(x, y + dy) && !blockedForCart(x, y + dy)) out.push(idx(x, y + dy));
  return out;
}
function cartPath(start, goal) {
  if (goal(start)) return [];
  const prev = new Map([[start, null]]), q = [start], nb = [];
  while (q.length) {
    const n = q.shift();
    for (const m of cartNeighbors(n, nb)) {
      if (prev.has(m)) continue;
      prev.set(m, n);
      if (goal(m)) { const path = [m]; let k = n; while (k !== start) { path.unshift(k); k = prev.get(k); } return path; }
      q.push(m);
    }
  }
  return null;
}
/** 광차가 설 자리: 붉은 수염에게서 가장 가까운, 바닥이 있는 칸 */
function cartStop() {
  const red = crew[0];
  if (typeof red.node !== 'number') return 'S';
  const seen = new Set([red.node]), q = [red.node], nb = [];
  while (q.length) {
    const n = q.shift();
    if (n !== 'S') { const [x, y] = cxy(n); if (!blockedForCart(x, y) && (y + 1 >= W.rows || !isDug(x, y + 1))) return n; }
    for (const m of cartNeighbors(n, nb)) if (!seen.has(m)) { seen.add(m); q.push(m); }
  }
  return 'S';
}
function cartMove(dt) {                                     // 경로 따라 (가로 = 레일 · 세로 = 도르래)
  const n = cart.path[0];
  let tx, ty, final = true;
  if (n === 'S') { tx = typeof cart.node === 'number' ? cellX(cxy(cart.node)[0]) : cart.x; ty = SURFACE_Y - 1; }
  else {
    const [gx, gy] = cxy(n); tx = cellX(gx);
    if (cart.node === 'S' && Math.abs(cart.x - tx) > 0.5) { ty = SURFACE_Y - 1; final = false; } else ty = cartY(gy);
  }
  const dx = tx - cart.x, dy = ty - cart.y, d = Math.hypot(dx, dy), st = CF.cartSpeed * T * dt;
  cart.vertical = Math.abs(dx) < 0.5 && Math.abs(dy) > 0.5;
  if (Math.abs(dx) > 0.5) cart.face = Math.sign(dx);
  if (d <= st) { cart.x = tx; cart.y = ty; if (final) { cart.node = n; cart.path.shift(); } }
  else { cart.x += dx / d * st; cart.y += dy / d * st; }
  cart.moving = true;
}
function cartSurfaceTo(x, dt) {                             // 지상에서 옆으로
  const d = x - cart.x;
  if (Math.abs(d) < 0.5) { cart.x = x; return true; }
  cart.face = Math.sign(d); cart.vertical = false; cart.moving = true;
  cart.x += Math.sign(d) * Math.min(Math.abs(d), CF.cartSpeed * T * dt);
  return false;
}
let fullNagT = 0;
function updateCart(dt) {
  cart.moving = false;
  if (state() !== 'DIG') { cart.mode = 'park'; return; }
  const load = cartLoad();
  // 떨어짐: 서 있던 칸 밑이 뚫리면 → 적재 절반이 그 칸에 흩어짐
  if (cart.mode === 'park' && typeof cart.node === 'number' && !cartSupported(...cxy(cart.node))) {
    const [gx, gy] = cxy(cart.node);
    let land = gy; while (land + 1 < W.rows && isDug(gx, land + 1)) land++;
    cart.fallTo = land; cart.mode = 'fall'; cart.fallV = 0;
  }
  if (cart.mode === 'fall') {
    cart.fallV = Math.min(B.fallMax * T, cart.fallV + B.fallAccel * T * dt);
    cart.y += cart.fallV * dt;
    if (cart.y >= cartY(cart.fallTo)) {
      cart.y = cartY(cart.fallTo); cart.node = idx(cxy(cart.node)[0], cart.fallTo); cart.mode = 'park';
      fx('fx_collapse', cart.x, cart.y - 6); sfx('break'); shake = 0.2; shakeAmp = 2;
      for (const k of Object.keys(cart.cargo)) {
        const spill = Math.floor(cart.cargo[k] * B.cartSpill);
        if (spill) { cart.cargo[k] -= spill; piles.push({ gx: cxy(cart.node)[0], gy: cart.fallTo, type: k, n: spill }); }
      }
      toast('광차가 떨어졌어요! 광석이 흩어졌어요 — 광부들이 주워 담아요');
    }
    return;
  }
  if (cart.mode === 'park') {
    const working = piles.length || crew.some((a) => a.carrying) || S.round?.jobs?.some((j) => j.vein != null);
    cart.idleT = load && !working ? cart.idleT + dt : 0;
    if (load >= CF.cartLoad || cart.idleT > 2) {         // 가득 찼거나 캘 게 없으면 지상으로
      const path = cartPath(cart.node, (n) => n === 'S');
      if (path) { cart.path = path; cart.mode = 'toShed'; cart.idleT = 0; return; }
    }
    const stop = cartStop();
    if (stop !== cart.node && !load) {                       // 빈 광차는 붉은 수염 근처로 따라감
      const path = cartPath(cart.node, (n) => n === stop);
      if (path?.length) { cart.path = path; cart.mode = 'back'; }
    } else if (cart.node === 'S' && stop === 'S' && Math.abs(cart.x - cart.parkX) > 1) cartSurfaceTo(cart.parkX, dt);
    return;
  }
  if (cart.mode === 'toShed') {
    if (cart.path.length) { cartMove(dt); return; }
    if (!cartSurfaceTo(SHED_X - 6, dt)) return;
    cart.mode = 'unload'; cart.unloadT = B.cartUnloadSeconds;
    return;
  }
  if (cart.mode === 'unload') {
    cart.unloadT -= dt;
    if (cart.unloadT > 0) return;
    let room = whCap() - whTotal() - inFlight;
    for (const k of Object.keys(cart.cargo)) {
      const put = Math.min(cart.cargo[k], room);
      if (put > 0) { cart.cargo[k] -= put; room -= put; orePopup(k, cart.x, cart.y - 14, put); }
    }
    if (cartLoad() > 0) {                                     // 창고가 꽉 참 → 지상에서 멈춤 · 광부 팔짱
      cart.unloadT = 1;
      fullNagT -= 1;
      if (fullNagT <= 0) { fullNagT = 8; for (const a of crew) emote(a, '창고가 꽉 찼어요!', 2); toast('창고가 꽉 찼어요! [판매] 탭에서 팔아요', 'momo'); }
      return;
    }
    cart.trips = (cart.trips ?? 0) + 1;
    const stop = cartStop();
    cart.path = cartPath('S', (n) => n === stop) ?? [];
    if (stop !== 'S' && !cart.path.length) emote(cart, '길이 막혔어요!', 2);
    cart.mode = cart.path.length ? 'back' : 'park';
    return;
  }
  if (cart.mode === 'back') {
    if (cart.path.length) { cartMove(dt); return; }
    cart.mode = 'park';
  }
}
function drawCart(dt) {
  const load = cartLoad();
  setAnim(cart, load ? (cart.cargo.c > load / 2 ? 'cart_roll_glow' : 'cart_roll') : 'cart_roll_empty');
  if (!cart.moving || cart.vertical) { cart.p.t = 0; cart.p.i = 0; }   // 멈추거나 도르래로 오르내릴 땐 바퀴 멈춤
  if (cart.moving && !cart.vertical) {
    cart.sparkT = (cart.sparkT ?? 0) - dt;
    if (cart.sparkT <= 0) { cart.sparkT = 0.28; fx('fx_cart', cart.x - cart.face * 6, cart.y - 3, { flip: cart.face < 0 }); particle(dustA, { x: cart.x - cart.face * 7, y: cart.y - 2, vx: -cart.face * 8, vy: -6, life: 0.8, color: 0x8a7a6a, g: 0, drag: 1.2, size: 1 }); }
  }
  if (cart.moving && cart.vertical) {                        // 도르래 줄: 위쪽 지상(권양기) 또는 세로 갱 꼭대기에서
    const gx = Math.round((cart.x - GX - 8) / T);
    let gy = Math.max(0, Math.floor((cart.y - GY) / T));
    while (gy > 0 && isDug(gx, gy - 1)) gy--;
    const top = gy === 0 ? SURFACE_Y - 2 : GY + gy * T;
    cable.moveTo(cart.x + 2, top).lineTo(cart.x + 2, cart.y - 10).stroke({ width: 0.5, color: 0x3d3a4c });
  }
}

// ---- 중력 (§1): 발밑이 비면 멈칫 → 가속 낙하 → 착지(먼지·엉덩방아·"으악!") · 2칸↑ 기절 · 4칸↑ 기절 + 체력 −1
function checkFall(a) {
  if (a.fall || typeof a.node !== 'number' || a.path?.length) return;
  const [gx, gy] = cxy(a.node);
  if (!isDug(gx, gy)) {                                     // 서 있던 칸이 메워짐 → 가장 가까운 뚫린 칸 위로
    for (let y = gy - 1; y >= -1; y--) { if (y < 0) { a.node = 'S'; a.y = SURFACE_Y + 0.5; break; } if (isDug(gx, y)) { a.node = idx(gx, y); a.y = floorY(y); break; } }
    return;
  }
  if (supported(gx, gy)) return;
  let land = gy;
  while (land + 1 < W.rows && isDug(gx, land + 1) && !holdAt(gx, land + 1)) land++;
  if (land + 1 < W.rows && isDug(gx, land + 1) && holdAt(gx, land + 1)) land++;
  a.fall = { from: gy, to: land, pause: B.fallPause, v: 0 };
  a.path = []; if (a.job) a.job = null;
  a.state = 'fall';
}
function updateFall(a, dt) {
  const f = a.fall;
  if (f.pause > 0) { f.pause -= dt; return; }
  f.v = Math.min(B.fallMax * T, f.v + B.fallAccel * T * dt);
  a.y += f.v * dt;
  const target = floorY(f.to);
  if (a.y >= target) {
    a.y = target; a.node = idx(cxy(a.node)[0], f.to);
    const h = f.to - f.from;
    a.fall = null;
    fx('fx_dirt', a.x, a.y - 4); sfx('break', true);
    emote(a, '으악!', 1.2);
    shake = Math.max(shake, 0.12); shakeAmp = Math.max(shakeAmp, 1);
    if (a.carrying) { const p = piles.find((q) => q.gx === cxy(a.node)[0] && q.gy === f.to && q.type === a.carrying.type); if (p) p.n += a.carrying.n; else piles.push({ gx: cxy(a.node)[0], gy: f.to, type: a.carrying.type, n: a.carrying.n }); a.carrying = null; }
    let stun = B.landSeconds;
    if (h >= B.hurtAt) { stun = B.hurtStunSeconds * CF.stunMul; hurt(a); }
    else if (h >= B.stunAt) stun = B.stunSeconds * CF.stunMul;
    a.busy = { t: stun, kind: h >= B.stunAt ? 'stun' : 'land', climbFrom: f.from, climbTo: f.to };
    a.state = a.busy.kind;
  }
}
function hurt(a, n = 1) {
  if (!a.hp) return;
  a.hp = Math.max(0, a.hp - n);
  emote(a, a.hp ? `아야! ♥${a.hp}` : '쓰러졌어요…', 1.4);
  if (!a.hp) a.restAt = time + 1.5;
}
const stars = [];
function updateBusy(a, dt) {
  a.busy.t -= dt;
  setAnim(a, `${a.id}_idle`);
  a.squash = a.busy.kind === 'land' || a.busy.kind === 'stun' ? 0.86 : 1;
  if (a.busy.kind === 'stun' && Math.random() < dt * 6) {    // 머리 위 ★ 뱅글
    const s = new Sprite(tex('star')); s.anchor.set(0.5); s.scale.set(0.5); markU.addChild(s);
    stars.push({ s, a, t: 0.6, ang: Math.random() * 6.28 });
  }
  if (a.busy.t <= 0) {
    // 막다른 구덩이면 떨어진 길에 사다리를 놓고 올라온다 (영영 갇히지 않게)
    const { climbFrom, climbTo } = a.busy;
    if (climbTo != null && typeof a.node === 'number' && !findPath(a.node, (n) => n === 'S')) {
      const gx = cxy(a.node)[0];
      for (let y = climbFrom; y <= climbTo; y++) if (isDug(gx, y)) W.climb[y][gx] = true;   // 사다리 대신 벽을 짚고 기어오름 (그림 없음)
      if (climbFrom > 0 && isDug(gx, climbFrom - 1)) W.climb[climbFrom - 1][gx] = true;
      emote(a, '영차!', 1); syncRound();
    }
    a.busy = null; a.squash = 1; a.state = 'idle';
  }
}
function updateStars(dt) {
  for (let k = stars.length - 1; k >= 0; k--) {
    const st = stars[k]; st.t -= dt; st.ang += dt * 8;
    st.s.position.set(st.a.x + Math.cos(st.ang) * 6, st.a.y - 21 + Math.sin(st.ang) * 2);
    if (st.t <= 0) { st.s.destroy(); stars.splice(k, 1); }
  }
}
function updateCrew(dt) {
  for (const a of crew) {
    if (a.restAt && time >= a.restAt) {                    // 체력 0 → 지상에서 10초 쉼
      a.restAt = null; a.node = 'S'; a.x = 100 + crew.indexOf(a) * 12; a.y = SURFACE_Y + 0.5; a.path = []; a.job = null; a.carrying = null; a.fall = null;
      a.busy = { t: B.restSeconds, kind: 'rest' }; a.state = 'rest';
    }
    if (a.busy?.kind === 'rest') { a.busy.t -= dt; setAnim(a, `${a.id}_idle`); if (a.busy.t <= 0) { a.busy = null; a.hp = B.minerHp; a.state = 'idle'; } continue; }
    if (a.fall) { updateFall(a, dt); continue; }
    if (a.busy) { updateBusy(a, dt); continue; }
    if (state() !== 'DIG') { setAnim(a, `${a.id}_idle`); a.state = 'idle'; continue; }
    checkFall(a);
    if (a.fall) continue;
    if (a.id === 'red') updateDigger(a, dt); else updateCarrier(a, dt);
  }
  cart = cartA;
  // 운반 중 광석 아이콘 (머리 위)
  for (const a of crew) {
    a.oreIcon ??= (() => { const s = new Sprite(); s.anchor.set(0.5, 1); s.scale.set(0.5); lampsU.addChild(s); return s; })();
    a.oreIcon.visible = !!a.carrying;
    if (a.carrying) { a.oreIcon.texture = tex(ICON[a.carrying.type]); a.oreIcon.position.set(a.x, a.y - 20); }
  }
  // 광맥 테두리 금색 깜빡 (캐는 중인 덩어리)
  overA.clear();
  if (W && S.round?.claimed?.length && Math.floor(time * 3) % 2 === 0) {
    for (const id of S.round.claimed) for (const [x, y] of W.veins.list[id]?.cells ?? []) {
      if (!ORE_KEYS.has(W.g[y][x])) continue;
      overA.rect(GX + x * T, GY + y * T, T, T).stroke({ width: 1, color: 0xf5cf6a, alpha: 0.9 });
    }
  }
  // 흩어진 광석 조각
  pileSprites.forEach((s) => (s.visible = false));
  piles.forEach((p, i) => {
    const s = pileSprites[i] ?? (pileSprites[i] = (() => { const q = new Sprite(tex('ore_bits')); q.anchor.set(0.5, 1); charsA.addChildAt(q, 0); return q; })());
    s.visible = true; s.position.set(cellX(p.gx) + ((i * 5) % 7) - 3, floorY(p.gy));
  });
  for (let k = marks.length - 1; k >= 0; k--) { marks[k].t -= dt; marks[k].s.alpha = Math.floor(marks[k].t * 10) % 2 ? 1 : 0.4; if (marks[k].t <= 0) { marks[k].s.destroy(); marks.splice(k, 1); } }
  updateStars(dt);
  if (W) updateEvents(dt);
  // 물 · 몬스터
  if (W) {
    for (let y = 0; y < W.rows; y++) for (let x = 0; x < GW; x++) if (W.water[y][x] && isDug(x, y)) {
      const px = GX + x * T, py = GY + y * T, wave = Math.round(Math.sin(time * 3 + x) * 0.6);
      overA.rect(px, py + 3 + wave, T, T - 3 - wave).fill({ color: 0x3d5a9a, alpha: 0.55 }).rect(px, py + 3 + wave, T, 1).fill({ color: 0x9ac0f0, alpha: 0.8 });
    }
    const ms = S.round?.monsters ?? [];
    slimes.forEach((sp, i) => { sp.visible = i < ms.length; });
    ms.forEach((m, i) => {
      const sp = slimes[i] ?? (slimes[i] = (() => { const q = new Sprite(F.slime[0]); q.anchor.set(0.5, 1); q.scale.set(1); charsA.addChild(q); return q; })());
      sp.texture = F.slime[Math.floor(time * 4) % F.slime.length]; sp.position.set(cellX(m.gx), floorY(m.gy)); sp.visible = true;
    });
  }
  cable.clear();
  cartB.visible = CF.carts >= 2;
  for (const c of liveCarts()) { cart = c; if (W) updateCart(dt); drawCart(dt); }
  cart = cartA;
}
const pileSprites = [], slimes = [];

// ---------------------------------------------------------------- 튜토리얼 훅 (7단계에서 채움)
const TUTORIAL = [
  '경매에서 구획을 골라요. 힌트 아이콘을 보세요',
  '두더지가 킁킁대는 곳 아래에 광맥이 있어요',
  '손가락으로 갱도를 그려 보세요 (0줄이나 뚫린 칸에서 시작)',
  '광맥에 닿으면 광부들이 알아서 캐요',
  '창고가 차기 전에 [판매] 탭에서 팔아요. 시세는 계속 변해요',
  '다 캤으면 [철수]. 순이익이 점수예요',
];
function tutorialDone(stepN) {
  const t = S.tutorial;
  if (t.step >= TUTORIAL.length || S.stats.rounds > 0) return;
  if (t.step === stepN - 1) { t.step = stepN; save(); buildUI(); }
}
let tutorialH = 0;
function makeTutorial() {
  tutorialH = 0;
  const t = S.tutorial;
  if (t.step >= TUTORIAL.length || S.stats.rounds > 0) return null;
  const st = state();
  if (st === 'RESULT') return null;
  if (st === 'SURVEY' && t.step < 1) t.step = 1;                  // 다시 열었을 때 단계 맞추기
  if (st === 'DIG' && t.step < 2) t.step = 2;
  const u = (v) => Math.round(v / L.uiS);
  const v = L.vis, w = Math.min(u(v.x1 - v.x0) - 8, 260);
  const c = new Container();
  const msg = label(`${t.step + 1}/${TUTORIAL.length}  ${TUTORIAL[t.step]}`, { small: true, color: COLOR.paperInk, shadow: false, wrap: w - 50 });
  const h = Math.max(40, Math.ceil(msg.height) + 12);
  c.addChild(frame('paper', w, h, 'panel'));
  const pf = portraitFrame(tex(NPC.momo), 34, 'wood'); pf.position.set(3, 3); c.addChild(pf);
  msg.position.set(42, Math.round((h - msg.height) / 2)); c.addChild(msg);
  // 하단 시트(가로 화면은 화면 아래) 바로 위. 경매 카드는 이 높이만큼 짧아진다 (tutorialH)
  const top = u(v.y1) - h - 4;
  tutorialH = h + 4;
  c.position.set(u(v.x0) + Math.round((u(v.x1 - v.x0) - w) / 2), top);
  return c;
}

// ================================================================ 입력
// 경매·결과 카드와 패널은 UI가 받는다. 탐사 중 투시 랜턴 → 톡한 곳 3×3. 랜턴 끌기.
// 시추 중: 0줄·뚫린 칸·뚫린 칸 옆에서 시작한 드래그 = 갱도 그리기, 그 밖 드래그 = 둘러보기
let drag = null;
app.canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (inPanels(e.clientX, e.clientY)) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  if (state() === 'SURVEY' && xrayArmed) { xrayAt(wx, wy); return; }
  let mode = Math.hypot(wx - lantern.x, wy - (lantern.y + 4)) < 12 ? 'lantern' : 'maybe';
  const [gx, gy] = cellAtWorld(wx, wy);
  if (mode === 'maybe' && state() === 'DIG' && validStart(gx, gy)) { mode = 'draw'; drawing.on = true; drawing.path = []; drawPush(gx, gy); }
  drag = { id: e.pointerId, mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
});
app.canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.lx) / L.sc, dy = (e.clientY - drag.ly) / L.sc;
  drag.lx = e.clientX; drag.ly = e.clientY;
  if (drag.mode === 'maybe' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.mode = 'pan';
  if (drag.mode === 'pan') { cam.panX -= dx; cam.panY -= dy; clampPan(); }
  if (drag.mode === 'draw') { const [wx, wy] = toWorld(e.clientX, e.clientY); drawPush(...cellAtWorld(wx, wy)); }
  if (drag.mode === 'lantern') {
    lantern.x = Math.max(GX + 4, Math.min(WW - GX - 4, lantern.x + dx));
    lantern.y = Math.max(SURFACE_Y - 30, Math.min(WH - 16, lantern.y + dy));
    lantern.vel -= dx * 0.05;
  }
});
window.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'draw') commitPath();
  drag = null;
});
window.addEventListener('pointercancel', () => { drag = null; drawing.on = false; drawPreview(); });

// ================================================================ 매 프레임
let fpsT = 0, fpsN = 0, shotWaiter = null, slowT = 0;
const lights = [];
function addLight(x, y, z, r, color, power) { if (lights.length < MAX_LIGHTS) lights.push([x, y, z, r, color, power]); }
const flick = (t, seed) => 0.55 * Math.sin(t * 9 + seed) + 0.3 * Math.sin(t * 23 + seed * 2) + 0.15 * Math.sin(t * 41 + seed * 3);


app.ticker.add((tk) => {
  const real = Math.min(tk.deltaMS / 1000, 0.05);
  fpsT += real; fpsN++;
  if (fpsT >= 0.5) {
    const fps = fpsN / fpsT;
    if (!low && !S.settings.autoLowDone && document.visibilityState === 'visible' && fps < 45) {
      slowT += fpsT;
      if (slowT >= 5) { setLow(true); S.settings.autoLowDone = true; save(); toast('화면이 버거워 보여서 저사양으로 바꿨어요 ([설정]에서 끌 수 있어요)'); if (sheetTab === 'set') buildUI(); }
    } else slowT = 0; if (ui.fps) ui.fps.text = `${VERSION} · ${Math.round(fpsN / fpsT)} fps · 칸 ${Math.round(L.cell)}px`; fpsT = 0; fpsN = 0; }

  let dt = real;
  if (hitstop > 0) { hitstop -= real; dt = 0; }
  if (slowmo > 0) { slowmo -= real; dt *= 0.25; }
  time += dt;
  market.update(dt, S.day, S.tick, now());
  ui.coTick?.(real);
  if (fpsN % 15 === 0) { updateSmelt(); if (ui.smeltLine && S.smelt.jobs.length) refreshUI(); }
  S.tick += real;
  if (S.tick >= TICK_PER_DAY) { S.tick -= TICK_PER_DAY; S.day++; }
  if (ui.counters?.clock && fpsN === 1) ui.counters.clock.text = clockText(ui.counters.clock.short);
  if (toastT > 0) { toastT -= real; if (toastT <= 0 && ui.toast) ui.toast.visible = false; }
  for (let k = bumps.length - 1; k >= 0; k--) { bumps[k].t -= real; if (bumps[k].t <= 0) { if (!bumps[k].n.destroyed) { bumps[k].n.scale.set(1); bumps[k].n.tint = 0xffffff; } bumps.splice(k, 1); } }

  // 상태별
  const st = state();
  if (st === 'AUCTION') { updateAuction(real); if ((AU.say.some((q) => q && time - q.t < 0.6) || (AU.endAt != null && time - AU.endAt < 0.7 && AU.card)) && fpsN % 2 === 0) buildUI(); }
  if (st === 'SURVEY') updateSurvey(dt);
  updateMole(dt);
  updateCrew(dt);
  drawPreview();
  if (market.surge && fpsN % 3 === 0) refreshUI();
  if (ui.crew) for (const c of ui.crew) { const s = crewStateText(c.m); if (c.st.text !== s) c.st.text = s; }

  // 랜턴: 진자 흔들림
  if (!drag || drag.mode !== 'lantern') lantern.vel += -Math.sin(lantern.ang) * 18 * dt;
  lantern.vel *= 1 - 1.4 * dt;
  lantern.ang = Math.max(-0.9, Math.min(0.9, lantern.ang + lantern.vel * dt + Math.sin(time * 1.3) * 0.0006));
  lanternS.texture = F.lantern[Math.floor(time * 5) % F.lantern.length];
  lanternS.position.set(Math.round(lantern.x), Math.round(lantern.y));
  lanternS.rotation = lantern.ang;
  const [lfx, lfy] = lanternFlame();

  if (mole.sniffing) mole.p.t += 0; else { mole.p.i = 0; mole.p.t = 0; }
  for (const a of actors) drawActor(a, dt, lfx, lfy);
  drawEmotes(real);
  const red = crew[0], blonde = crew[2];
  const head = [red.x + 3, red.y - 18];
  const blondeLamp = [blonde.x + 6 * blonde.face, blonde.y - 7];

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

  // 빛
  lights.length = 0;
  const lf = flick(time, 0);
  addLight(lfx, lfy, 10, LANTERN_R * (1 + 0.03 * lf), [1.0, 0.72, 0.46], LANTERN_POWER * (1 + 0.06 * lf));
  if (red.y > GY) addLight(head[0] + 8, head[1] + 4, 6, 40, [1.0, 0.94, 0.68], 1.1);
  if (blonde.y > GY) addLight(blondeLamp[0], blondeLamp[1], 6, 44, [1.0, 0.8, 0.5], 0.8 * (1 + 0.05 * flick(time, 4)));
  const gn = glowTiles.length;
  if (gn) addLight(gxs / gn, gys / gn, -8, 40 + gn * 5, [0.42, 0.88, 0.85], 0.95 + 0.25 * Math.sin(time * 2.2));
  if (boom) {
    boom.t -= real;
    const k = Math.max(0, boom.t / 1.6);
    addLight(boom.x, boom.y, 12, 150 * k + 30, [1.0, 0.86, 0.5], 1.6 * k);
    if (boom.t <= 0) boom = null;
  }
  lanternHalo.position.set(lfx, lfy); lanternHalo.alpha = lanternHalo.baseAlpha * (1 + 0.12 * lf);
  headHalo.position.set(head[0], head[1]); headHalo.visible = red.y > GY;
  halosU.visible = !low;

  if (Math.random() < (low ? 0.08 : 0.3) && W) {
    const x = GX + Math.random() * GW * T, y = GY + Math.random() * GH * T;
    if (!isSolid(cellAt(Math.floor(x / T), Math.floor(y / T))))
      particle(dustA, { x, y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2, life: 3 + Math.random() * 2, color: 0xc8b8a0, g: 0, size: 0.5 });
  }
  updateParticles(dt);

  // 카메라
  const leanTarget = Math.max(-1, Math.min(1, (lantern.y - (GY + GH * T / 2)) / (GH * T / 2))) * 10;
  cam.lean += (leanTarget - cam.lean) * Math.min(1, dt * 2);
  cam.x = cam.x0 + cam.panX; cam.y = cam.y0 + cam.panY + cam.lean;
  let sx = 0, sy = 0;
  if (shake > 0) { shake -= real; sx = Math.round((Math.random() * 2 - 1) * shakeAmp * DENS); sy = Math.round((Math.random() * 2 - 1) * shakeAmp * DENS); }
  cam.rx = Math.floor(cam.x * DENS); cam.ry = Math.floor(cam.y * DENS);
  const px = display.scale.x;
  display.position.set(-(cam.x * DENS - cam.rx) * px, -(cam.y * DENS - cam.ry) * px);
  const crx = cam.rx + sx, cry = cam.ry + sy;
  for (const w of [wA, wN, wU]) w.position.set(-crx, -cry);
  const wx = crx / DENS, wy = cry / DENS;
  for (const p of layers) p.s.tilePosition.set(Math.round(wx * (1 - p.f)) * p.s.scale.x, Math.round(wy * (1 - p.f)));
  fgU.visible = !low;

  const lu = lightPass.shader.resources.u.uniforms;
  lu.uView = [viewW, viewH]; lu.uCam = [wx, wy]; lu.uDens = DENS; lu.uWorld = [WW, WH];
  lu.uAmbient = AMB_COLOR.map((v) => v * AMBIENT);
  const pos = lu.uLightPos, col = lu.uLightCol;
  pos.fill(0); col.fill(0);
  lights.forEach(([x, y, z, r, c, p], i) => { pos.set([x, y, z, r], i * 4); col.set([c[0], c[1], c[2], p], i * 4); });
  lu.uCount = lights.length; lu.uSteps = low ? 6 : 12; lu.uRelief = low ? 0.6 : 1.1;
  const pu = postPass.shader.resources.u.uniforms;
  pu.uView = [viewW, viewH]; pu.uTilt = low ? 0 : (shake > 0 ? 0.5 : 1); pu.uVig = low ? 0 : 0.38;
  pu.uBand = L.portrait ? 0.08 : 0.1;
  pu.uGrid = [(GX * DENS - crx) / viewW, (GY * DENS - cry) / viewH, ((GX + GW * T) * DENS - crx) / viewW, ((GY + GH * T) * DENS - cry) / viewH];
  pu.uTint = low ? [1, 1, 1] : S.round?.card?.floor === 2 ? B.abandoned.tint : TINT;
  flash = Math.max(0, flash - real * 3);
  const gas = S.round?.gasLeft > 0 ? 0.12 + 0.05 * Math.sin(time * 3) : 0;
  pu.uFlash = [flash * 0.9, flash * 0.85 + gas * 0.6, flash * 0.7];
  pu.uGas = gas;

  R.render({ container: wA, target: albedoRT, clear: true, clearColor: [0.04, 0.035, 0.06, 1] });
  R.render({ container: wN, target: normalRT, clear: true, clearColor: [0, 0, 0, 0] });
  R.render({ container: lightPass, target: litRT, clear: true });
  R.render({ container: wU, target: litRT, clear: false });
  R.render({ container: postPass, target: finalRT, clear: true });
  if (shotWaiter) { R.render({ container: app.stage }); shotWaiter(app.canvas.toDataURL('image/png')); shotWaiter = null; }
});

// ================================================================ 시작: 저장된 라운드가 있으면 이어서, 없으면 경매
const bootIdle = settleOffline(true);
buildWorld();
layout();
if (!S.round) startAuction();
else {
  piles = S.round.piles ?? []; seenCells = new Set(S.round.seen ?? []); S.round.jobs ??= []; S.round.claimed ??= [];
  Object.assign(cartA.cargo, S.round.cartCargo ?? {}); Object.assign(cartB.cargo, S.round.cartCargo2 ?? {});
  buildUI(); if (S.round.state === 'SURVEY') S.round.surveyLeft = Math.max(3, S.round.surveyLeft);
}
booted = true;
initAuth().then(() => { if (online()) afterLogin(); });
if (bootIdle?.midRound) toast(`라운드 이어 하기 — ${S.round.card.name}`, 'momo', 3);

window.__kod = {
  get S() { return S; }, get W() { return W; }, get L() { return L; }, get ui() { return ui; }, AU, cam, lantern, actors, crew, fx, bigVein, tilesA, wA, lights,
  startRound, todayCards, settleOffline, get welcome() { return welcome; }, openCompany, closeCompany, closeWelcome, refreshCompany, coAction, onSlot, openRank, openLoginForm, pushNow, learnTalent, get market() { return market; }, smeltOne, get sellMode() { return sellMode; }, set sellMode(v) { sellMode = v; }, get CF() { return CF; }, away(sec) { S.idle.lastSeen = Date.now() - sec * 1000; return settleOffline(); }, startDig, drawPush, commitPath, drawing, get piles() { return piles; }, B, refreshAround, get cart() { return cart; }, carts, endRound, askRetreat, nextAuction, pickCard, playerRaise, reset() { saving = false; resetSave(); location.reload(); },
  async shot(name, frames = 240) {
    let t = performance.now();
    const url = await new Promise((r) => { for (let i = 0; i < frames; i++) app.ticker.update((t += 33)); shotWaiter = r; app.ticker.update((t += 33)); });
    return (await fetch(`/__shot/${name}`, { method: 'POST', body: url })).text();
  },
};
