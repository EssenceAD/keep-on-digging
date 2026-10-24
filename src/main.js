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
import { ambience, jackpotMusic, music, setVolumes, sfx, unlockAudio, volumes } from './sound.js';
import { COLOR, bar, button, frame, icon, kit, label, loadUI, portraitFrame, setTextRes, tab } from './ui.js';
import { BUYERS, ORES, buyerOf, createMarket } from './market.js';
import { B } from './balance.js';
import { SAVE_VERSION, loadSave, migrate, resetSave, writeSave } from './save.js';
import { BOARDS, initAuth, login, logout, me, online, pullSave, pushSave, recover, submitRank, topRank, weekKey } from './net.js';
import { computeOffline } from './offline.js';
import { AUCTIONEER, GUILD_LINES, fill, pick } from './text.js';
import { checkDaybook, dayDef, progress, rollDaybook } from './daybook.js';
import { TUT_CARTS, AUCTION_INTRO, AUCTION_LINE, DIG_LINE, DIG_LINE_ROUNDS, INTRO, MANUAL, TILE_TIP, TIPS, TUT_AGAIN, TUT_CARD, TUT_NUDGE_SECONDS, TUT_GOLD_X, TUT_SHAFT_X, TUT_STOP_Y, TUT_TEXT } from './onboard.js';
import { BUILD_UP, UP, UP_KEYS, upCostOf as gearCost, upLv, upText, BUILDINGS, DECOS, at as coAt, canUp, cols as coCols, companyFx, effectText, ensureCompany, harmonies, lvOf, nameOf, placed, TALENT_TREES, talentLeft, talentPoints, talentSpent } from './company.js';
import { COLS as GW, ORE_TYPES, findVeins, freeCard, generate, makeCards } from './gen.js';
const ORE_COLOR = { C: 0xb87a4a, s: 0x7c7a92, g: 0xb8862a, j: 0x8a4ab0, c: 0x2fa09a };
import { newSeed } from './rng.js';

TextureSource.defaultOptions.scaleMode = 'nearest';
const VERSION = 'v1.0-3';

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
// GPT 건물 시트(art/buildings_gpt.px.js · 128×128)가 먼저 — Lv1·3·5 (Lv2·4는 1·3 그림). 없으면 buildings.px.js 폴백
const GPT_STEPS = [1, 3, 5];
const GPT_SPRITES = [...Object.values(BLD_ART).flatMap((b) => GPT_STEPS.map((l) => `g_${b}_${l}`)), ...Object.values(DECO_ART).map((d) => `g_${d}`)];
const SPRITES = [...GPT_SPRITES, 'yard_grass', 'yard_path', 'yard_fence', 'yard_sky_day', 'yard_sky_night', ...Object.values(BLD_ART).flatMap((b) => [1, 3, 5].map((l) => `${b}_${l}`)), ...Object.values(DECO_ART).filter((d) => !DECO_ANIM.has(d)), 'dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'gem',
  'ancient', 'pocket_water', 'pocket_gas', 'relic_chest', 'cave', 'ladder', 'mark_x', 'ore_bits', 'star',
  'tunnel', 'tunnel_beam', 'rail', 'side_far', 'side_mid', 'side_fg',
  'sky_far', 'deep_far', 'deep_mid', 'deep_fg', 'bubble_dig', 'bubble_walk', 'bubble_rest',
  'icon_gold', 'icon_glow', 'icon_silver', 'icon_copper', 'icon_gem', 'hint_rock', 'hint_water', 'hint_relic', 'hint_glow',
  'cart_gold', 'cart_empty', 'npc_halabeoji', 'npc_momo', 'npc_brok', 'npc_merchant', 'npc_guild_abyss', 'npc_guild_tower', 'npc_guild_shield'];
const NORMALS = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'ancient', 'pocket_water', 'pocket_gas', 'relic_chest'];
const FX = ['fx_hit', 'fx_dirt', 'fx_rock', 'fx_vein', 'fx_vein_glow', 'fx_daebak', 'fx_gas', 'fx_water', 'fx_collapse', 'fx_cart', 'fx_pulse'];
const ANIMS = ['ore_glow', 'gold_shimmer', 'lantern', 'red_idle', 'red_walk', 'red_swing', 'brown_swing', 'brown_idle', 'brown_walk',
  'blonde_idle', 'blonde_walk', 'mole_sniff', 'cart_roll', 'cart_roll_empty', 'cart_roll_glow', 'slime', 'deco_fire', 'deco_flag', 'ui_hand', 'office_fire', ...FX];
const urls = [
  ...SPRITES.map((n) => A(`sprites/${n}.png`)), ...NORMALS.map((n) => A(`sprites/${n}_n.png`)),
  ...ANIMS.flatMap((n) => [A(`anims/${n}.png`), A(`anims/${n}.json`)]), A('scenes/surface.png'), A('scenes/office_night.png'), A('scenes/office_day.png'),
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
// 벽 랜턴 (v0.8 §5 — v0.4 기준선의 빛 웅덩이): 뚫린 가로 갱도 천장에 5칸마다 하나씩 저절로 걸림 (최대 8)
let wallLamps = [];
function syncWallLamps() {
  const want = [];
  if (W && S.round) for (let y = 1; y < W.rows && want.length < 8; y++) for (let x = 0; x < GW && want.length < 8; x++) {
    if (x % 5 !== 2 || !isDug(x, y) || isDug(x, y - 1)) continue;          // 천장이 있어야 걸 수 있다
    if (!(isDug(x - 1, y) || isDug(x + 1, y))) continue;                    // 가로 갱도에만
    want.push([x, y]);
  }
  const key = (l) => `${l.gx},${l.gy}`, keep = new Set(want.map(([x, y]) => `${x},${y}`));
  for (const l of wallLamps) if (!keep.has(key(l))) { l.s.destroy(); l.br.destroy(); l.halo.destroy(); }
  wallLamps = wallLamps.filter((l) => keep.has(key(l)));
  for (const [x, y] of want) {
    if (wallLamps.some((l) => l.gx === x && l.gy === y)) continue;
    const px = GX + x * T + 8, py = GY + y * T + 1;
    const br = new Graphics().moveTo(px - 6, py - 1).lineTo(px, py - 1).lineTo(px, py).stroke({ width: 1, color: 0x5c3832 }); lampsU.addChild(br);
    const sp = new Sprite(F.lantern[0]); sp.anchor.set(0.5, 0); sp.position.set(px, py); lampsU.addChild(sp);
    wallLamps.push({ gx: x, gy: y, s: sp, br, x: px + LANTERN_FLAME[0], y: py + LANTERN_FLAME[1], seed: x * 1.7 + y, halo: halo(0xffb060, 24, 0.5) });
  }
}
function buildWorld() {
  setTimeout(() => { syncWallLamps(); drawShafts(); drawSurvey(); }, 0);                              // 구획이 바뀌면 벽 랜턴도 다시
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
const ANCHOR_X = { red_swing: 16 / 46, brown_swing: 16 / 46 };
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
  { id: 'brown', name: '뚱보', role: '선두 채굴', color: 0xb98a68 },
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
const carts = [cartA, cartB, newCart(SHED_X - 66), newCart(SHED_X - 84)];
const liveCarts = () => carts.slice(0, CF.carts);           // v0.8: 기본 2대 · 차고 Lv3 3대 · Lv5 4대
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
setVolumes(S.settings.sound === false ? { bgm: 0, sfx: 0 } : { bgm: S.settings.bgmVol ?? 0.6, sfx: S.settings.sfxVol ?? 0.8 });
// 시세 시계 (v0.6 패치 ④): 게임 날짜는 접속 중에만 흐르고, 시세는 현실 시간으로 — 떠나 있던 동안도 빨리감기
S.marketT ??= now();
const mNow = () => S.marketT;
const mDay = () => Math.floor(S.marketT / B.dayRealSeconds), mTick = () => S.marketT % B.dayRealSeconds;
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
  sfx('coin'); flyNumber('coin', from.x, from.y, gain, () => { refreshUI(); bumpCounter('coin'); });
  refreshUI();
}
let sellMode = 'ore';
const priceOf = (key) => Math.round(market.price(key, buyer(), mNow()) * CF.sellMul);

// ---------------------------------------------------------------- 주스
let shake = 0, shakeAmp = 0, hitstop = 0, slowmo = 0, flash = 0, boom = null;
function bigVein(x, y) {
  sfx('jackpot'); jackpotMusic();
  setTimeout(() => tip('bigVein'), 1700);
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
  if (!S.auction || S.auction.day !== S.day) {
    S.auction = { day: S.day, cards: makeCards(newSeed(), CF.plotSizes, CF.hints, S.floorUnlocked >= 2) };
    for (const c of S.auction.cards) c.price = Math.max(c.price, Math.round((cardValue(c).mid * B.auction.startShare) / 10) * 10);   // v0.8-b 시작가
    if (S.tutorial.done && !S.tutorial.firstAuction) {             // 온보딩 §3: 첫 경매의 구획 하나는 힌트 2 · 시작가 120 (사기 쉽게)
      S.tutorial.firstAuction = true;
      const c0 = S.auction.cards[0];
      Object.assign(c0, { size: 'S', price: 120, floor: 1, name: c0.name.replace('폐광', '뒷산'), hints: c0.hints.slice(0, 2) });
    }
  }
  return S.auction.cards;
}
function startAuction() {
  S.round = null;
  AU.phase = 'pick'; AU.card = null;
  W = null; buildWorld();
  for (const a of crew) resetCrewMember(a);
  piles = [];
  todayCards(); save(); buildUI();
  setTimeout(() => { if (state() === 'AUCTION' && !AU.card && !welcome && S.tutorial.done && !introView && !dialog) toast(AUCTIONEER.start, 'halabeoji', 2.5); }, 400);
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
    jobs: [], claimed: [], piles: [], gasUntil: 0, shafts: [],
  };
  piles = []; seenCells = new Set();
  for (const a of crew) resetCrewMember(a);
  for (const c of carts) Object.assign(c, { node: 'S', x: c.parkX, y: SURFACE_Y - 1, mode: 'park', path: [], cargo: { C: 0, s: 0, g: 0, j: 0, c: 0 }, trips: 0 });
  ensureCrew();
  S.auction = null;
  buildWorld();
  mole.x = GX + 8; mole.goal = undefined; mole.wait = 0.5;
  toolArmed = null; placeClues();
  save(); buildUI();
  if (!card.tutorial) toast(card.free ? '공짜 구획이에요. 힌트는 없어요' : `${card.name} 낙찰! 두더지가 냄새를 맡아요`, 'momo');
}
function resetCrewMember(a) {
  a.node = 'S'; a.x = 100 + crew.indexOf(a) * 16; a.y = SURFACE_Y + 0.5; a.path = []; a.job = null; a.carrying = null; a.fall = null; a.busy = null; a.hp = a.hp || B.minerHp; a.state = 'idle';
  setAnim(a, `${a.id}_idle`);
}
function startDig() {
  if (!S.round) return;
  S.round.state = 'DIG';
  S.round.surveyLeft = 0;
  xray.clear(); drawSurvey();
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
  recordWeek(rd);
  count('rounds'); if (rd.stats.stars >= 2) count('star2');
  save(); buildUI(); cloudSoon();
}
function nextAuction() {
  const rd = S.round;
  if (rd?.card?.tutorial) finishTutorial();
  S.stats.rounds++; S.stats.profitTotal += rd.stats.profit; S.stats.bestVein = Math.max(S.stats.bestVein, rd.stats.maxVein);
  S.auction = null;                                                // 라운드가 끝나면 바로 새 경매
  startAuction();
}

// ---------------------------------------------------------------- 방치 정산 + 「돌아오셨군요」 카드 (명세3 §1)
let welcome = null;                                     // 정산 요약 (카드가 떠 있는 동안)
const idleHi = new Set(); let idleHiUntil = 0;          // [광종별로 고르기] → 판매 행 하이라이트
const advanceMarket = (sec) => { S.marketT += sec; };
function settleOffline(boot = false) {
  const r = computeOffline(S, {
    market, marketNow: mNow, advanceMarket,
    miners: CF.miners, pickGrade: CF.pick, capHours: CF.capHours, whRoom: whCap() - whTotal(), rateMul: CF.idleMul,
  });
  if (!r) return null;
  if (r.midRound) { if (!boot) toast(`라운드 이어 하기 — ${S.round.card.name}`, 'momo', 3); return r; }
  if (r.pendingTotal > 0 || r.missed.length) { welcome = r; setTimeout(() => { tip('welcome'); sfx('welcome'); }, 400); }
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
  if (gain) { S.gold += gain; S.stats.idleSold = (S.stats.idleSold ?? 0) + gain; sfx('coin_big'); flyNumber('coin', from.x, from.y, gain, () => { refreshUI(); bumpCounter('coin'); }); }
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
const agoText = (sec) => (sec < 3600 ? `${Math.max(1, Math.round(sec / 60))}분 전` : `${Math.round(sec / 3600)}시간 전`);
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
  if (r.missed.length) { const m = r.missed[r.missed.length - 1], o = ORES.find((q) => q.key === m.key); notes.push(`${agoText(r.to - (m.day * B.dayRealSeconds + m.tick))} ${o.name} 시세가 ×${B.surgeMul} 갔어요 (놓침)${r.missed.length > 1 ? ` 외 ${r.missed.length - 1}번` : ''}`); }
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
  const foot = label('오늘 경매 준비됐어요', { ...ink, small: true, color: 0x8a7a68 });
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
  if (!S.tutorial.done) return;                               // 과제 편지는 튜토리얼 뒤부터
  if (rollDaybook(S)) { setTimeout(() => toast('모모 편지: 오늘의 과제 3개가 왔어요! [과제]에서 봐요', 'momo', 4), 1500); save(); if (sheetTab === 'day') buildUI(); }
}
setTimeout(checkNewDay, 0);                              // 모듈이 다 읽힌 뒤
setInterval(checkNewDay, 60 * 1000);
// ================================================================ 장비 (명세5 §3): 라운드 중에도 [장비] 탭에서 바로
function upgradeEquip(k) {
  const cost = gearCost(S, k);
  if (cost == null) { toast('최대예요'); return; }
  if (S.gold < cost) { toast('금화가 모자라요'); sfx('pass', true); return; }
  S.gold -= cost; S.upgrades[k]++;
  const lv = upLv(S, k);
  refreshCompany();
  count('builds');
  if (k === 'pick' && S.round?.shafts) for (const q of S.round.shafts) if (q.blocked && canDig(q.blocked)) { q.blocked = null; q.dir = 'down'; }   // 막힌 갱도 다시
  if (k === 'lantern' && S.round && ['SURVEY', 'DIG'].includes(S.round.state)) S.round.xrayLeft = (S.round.xrayLeft ?? 0) + Math.max(0, UP.lantern.xray[lv] - UP.lantern.xray[lv - 1]);
  if (k === 'vibro' && S.round && ['SURVEY', 'DIG'].includes(S.round.state)) S.round.vibroLeft = (S.round.vibroLeft ?? 0) + Math.max(0, UP.vibro.uses[lv] - UP.vibro.uses[lv - 1]);
  sfx('upgrade'); toast(`${UP[k].name} Lv${lv}! ${k === 'pick' ? UP.pick.steps[lv] : upText(S, k).replace(/\d+(\.\d+)?→/g, '')}`, 'momo', 2.5);
  for (const a of crew.slice(0, CF.diggers)) emote(a, '오!', 1.2);
  save(); buildUI();
}
function makeGear(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const t = label('장비 · 라운드 중에도 바로', { ...ink, small: true, color: 0x8a5a24 }); t.position.set(6, 3); c.addChild(t);
  const n = UP_KEYS.length, cols = h - 16 >= n * 14 ? 1 : 2, per = Math.ceil(n / cols);     // 폰 시트가 낮으면 두 줄로
  const rowH = Math.min(18, Math.floor((h - 16) / per)), cw = Math.floor((w - 4) / cols), two = cols === 2;
  UP_KEYS.forEach((k, i) => {
    const x0 = 4 + Math.floor(i / per) * cw, y = 15 + (i % per) * rowH, lv = upLv(S, k), cost = gearCost(S, k);
    const bw = two ? 34 : 42, bh = Math.min(16, rowH - 2);
    const nm = label(`${UP[k].name} ${lv ? 'Lv' + lv : '-'}`, { ...ink, small: true }); nm.position.set(x0 + 2, y + (two ? -1 : 1)); c.addChild(nm);
    if (two && nm.width > cw - bw - 8) nm.scale.set((cw - bw - 8) / nm.width);
    const tx = label(upText(S, k), { ...ink, small: true, color: 0x6a5a48 });
    const tx0 = two ? x0 + 2 : x0 + 66, room = (two ? cw - bw - 8 : w - 66 - bw - 12);
    if (two) { tx.scale.set(Math.min(0.7, room / tx.width)); tx.position.set(tx0, y + 9); } else { if (tx.width > room) tx.scale.set(Math.max(0.55, room / tx.width)); tx.position.set(tx0, y + 1); }
    c.addChild(tx);
    const bt = button(cost == null ? 'stone' : S.gold >= cost ? 'wood' : 'paper', bw, bh, cost == null ? '최대' : `${cost}`, () => upgradeEquip(k), { small: true });
    bt.position.set(x0 + cw - bw - 4, y); c.addChild(bt); ui.refs[`gear_${k}`] = bt;
    if (cost == null) bt.setDisabled(true);
  });
  return c;
}
/** 막힌 갱도의 [장비] → 장비 탭 열기 */
function openGear() {
  if (L.portrait) { sheetTab = 'gear'; S.settings.sheetFolded = false; save(); layout(); }
  else toast('왼쪽 [장비]에서 곡괭이를 올려요');
  sfx('ui_open');
}
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

// ================================================================ 온보딩 (docs/ONBOARDING_1024.md) — 체크인 온보딩 틀: 단계 = 조건 → 다음 · 손가락 · 대사 카드
// [0] 인수인계 장면 → [1] 튜토리얼 라운드(고정 구획 · 12단계 강제) → [2] 첫 경매 안내 3 → [3] 처음 만나는 순간 1회 안내 · 설명서
const tutOn = () => !!S.tutorial.active && !!S.round?.card?.tutorial;
let introView = null, dialog = null, manualView = null;
const dialogQueue = [];
// ---- 화면 좌표 도우미 (CSS px)
const cellScreen = (gx, gy, w = 1, h = 1) => {
  const [x0, y0] = toScreen(GX + gx * T, GY + gy * T), [x1, y1] = toScreen(GX + (gx + w) * T, GY + (gy + h) * T);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
const cellCenter = (gx, gy) => toScreen(GX + gx * T + 8, GY + gy * T + 8);
const boundsOf = (o) => { if (!o || o.destroyed || !o.parent) return null; const b = o.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
const actorRect = (a) => { const [x, y] = toScreen(a.x, a.y), s = L.cell; return { x: x - s * 0.6, y: y - s * 1.4, w: s * 1.2, h: s * 1.5 }; };
const centerOf = (r) => (r ? [r.x + r.w / 2, r.y + r.h / 2] : null);
const unionRect = (...rs) => {
  rs = rs.filter(Boolean); if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y)), x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
const veinOf = (type) => W?.veins.list.findIndex((v) => v.type === type) ?? -1;
const veinRect = (id) => { const c = W?.veins.list[id]?.cells; if (!c?.length) return null; const xs = c.map((q) => q[0]), ys = c.map((q) => q[1]); return cellScreen(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1); };
const left = (type) => (W ? W.g.flat().filter((ch) => ch === type).length : 0);
const revealCells = (cells) => { for (const [x, y] of cells) { seenCells.add(`${x},${y}`); refreshAround(x, y, 0); } S.round.seen = [...seenCells]; };
const X = TUT_SHAFT_X;
// ---- [1] 튜토리얼 12단계: 강조(focus) · 손가락(hand) · 완료(done) · 시작할 때(enter) · 경로 검사(path)
const TUT_STEPS = [
  { focus: () => actorRect(mole), hand: () => ({ kind: 'point', at: centerOf(actorRect(mole)) }), done: () => S.tutorial.sniffed },
  { focus: () => boundsOf(ui.refs.surveyEnd), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(ui.refs.surveyEnd)) }), done: () => state() === 'DIG' },
  { shaftX: X, stopY: TUT_STOP_Y, focus: () => cellScreen(X, -1, 1, 2), hand: () => ({ kind: 'tap', at: cellCenter(X, -0.4) }), done: () => S.round.shafts?.some((q) => q.x === X) },
  { focus: () => unionRect(actorRect(crew[0]), cellScreen(X, 0, 1, TUT_STOP_Y + 1)), hand: () => ({ kind: 'point', at: centerOf(actorRect(crew[0])) }), done: () => isDug(X, TUT_STOP_Y) },
  { enter: () => revealCells(W.veins.list[veinOf('C')].cells), focus: () => unionRect(boundsOf(shaftBtns[`${S.round.shafts[0]?.id}:left`]), veinRect(veinOf('C'))), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(shaftBtns[`${S.round.shafts[0]?.id}:left`])) }),
    done: () => S.round.claimed.includes(veinOf('C')) },
  { enter: () => { S.tutorial.mark = S.counters?.ores ?? 0; }, focus: () => unionRect(veinRect(veinOf('C')), actorRect(cartA)), hand: () => ({ kind: 'point', at: centerOf(actorRect(cartA)) }),
    done: () => left('C') === 0 && (S.counters?.ores ?? 0) - (S.tutorial.mark ?? 0) >= 5 },
  { focus: () => (L.portrait ? boundsOf(ui.sellAnchor) : null), hand: () => (L.portrait ? { kind: 'tap', at: centerOf(boundsOf(ui.sellAnchor)) } : null),
    done: () => !L.portrait || (sheetTab === 'sell' && !S.settings.sheetFolded) },
  { enter: () => { S.tutorial.mark = S.counters?.soldGold ?? 0; }, focus: () => boundsOf(ui.rows.C?.r), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(ui.rows.C?.btn)) }),
    done: () => (S.counters?.soldGold ?? 0) > (S.tutorial.mark ?? 0) },
  { shaftX: TUT_GOLD_X, enter: () => { revealCells(W.veins.list[veinOf('g')].cells); toast(TUT_CARTS, 'momo', 3); }, focus: () => unionRect(cellScreen(TUT_GOLD_X, -1, 1, 2), veinRect(veinOf('g'))), hand: () => ({ kind: 'tap', at: cellCenter(TUT_GOLD_X, -0.4) }),
    done: () => S.round.claimed.includes(veinOf('g')) },
  { focus: () => (buyer() !== 'merchant' ? boundsOf(ui.refs.buyerSwap) : boundsOf(ui.rows.g?.r)), hand: () => ({ kind: 'tap', at: centerOf(buyer() !== 'merchant' ? boundsOf(ui.refs.buyerSwap) : boundsOf(ui.rows.g?.btn)) }),
    done: () => S.tutorial.merchantGold || (S.tutorial.goldSold && !stash.g && left('g') === 0 && !carts.some((c) => c.cargo.g) && !piles.some((p) => p.type === 'g')) },
  { focus: () => boundsOf(confirmRetreat ? ui.refs.retreatYes : ui.refs.retreat), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(confirmRetreat ? ui.refs.retreatYes : ui.refs.retreat)) }), done: () => state() === 'RESULT' },
  { focus: () => boundsOf(ui.refs.next), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(ui.refs.next)) }), done: () => !S.tutorial.active },
];
const tutStep = () => (tutOn() ? TUT_STEPS[S.tutorial.step] : null);
let tutT = 0, tutShakeT = 0, tutNudged = false;
function startTutorialRound() {
  Object.assign(S.tutorial, { active: true, step: 0, sniffed: false, merchantGold: false, goldSold: false, mark: 0 });
  S.settings.buyer = 'brok'; S.settings.sheetFolded = false;
  view = 'mine';
  startRound({ ...TUT_CARD }, 0);
  tutEnter();
}
function finishTutorial() { Object.assign(S.tutorial, { active: false, done: true, step: 0 }); save(); }
function tutEnter() { tutT = 0; tutNudged = false; TUT_STEPS[S.tutorial.step]?.enter?.(); save(); buildUI(); }
function tutShake() { tutShakeT = 0.5; toast(TUT_AGAIN, 'momo', 1); sfx('clink', true); }
/** 튜토리얼 손가락·어둡게 밖에서 세계 입력 막기 */
function tutBlocks(sx, sy) {
  const st = tutStep(); if (!st) return false;
  const r = st.focus?.(); if (!r) return true;
  const pad = 8;
  return !(sx >= r.x - pad && sx < r.x + r.w + pad && sy >= r.y - pad && sy < r.y + r.h + pad);
}
/** 튜토리얼 동안 시세: 급등 없음 · 구리는 10초마다 오름 (8단계 "지금은 올라가는 중!") */
let tutMkT = 0;
function tutMarket(dt) {
  tutMkT += dt; if (tutMkT < B.priceTick) return; tutMkT = 0;
  market.surge = null;
  const c = Math.min(1.8, market.coef.C * 1.06); market.last.C = 1; market.coef.C = c; market.hist.C.push(c); market.hist.C.shift();
  refreshUI();
}
// ---- 매 프레임: 단계 진행 · 어둡게(구멍) · 손가락 · 말풍선
let handS = null, dimG = null, blockers = [], tutBubble = null, guideTarget = null;
function tutTick(dt) {
  const layer = ui.tutLayer; if (!layer || layer.destroyed) return;
  const st = tutStep();
  if (st && !introView && !dialog) {
    tutT += dt;
    if (st.done()) { S.tutorial.step++; if (S.tutorial.step >= TUT_STEPS.length) finishTutorial(); else tutEnter(); return; }
    if (tutT > TUT_NUDGE_SECONDS && !tutNudged) { tutNudged = true; tutShakeT = 0.6; }
  }
  // 그릴 것: 튜토리얼 단계 또는 상황 안내 손가락(guideTarget)
  const focus = st && !introView && !dialog ? st.focus?.() : null;
  const hand = st && !introView && !dialog ? st.hand?.() : guideTarget && !introView && !dialog ? (() => { const r = guideTarget(); return r ? { kind: 'tap', at: centerOf(r) } : null; })() : null;
  if (!dimG || dimG.destroyed) {
    layer.removeChildren();
    dimG = new Graphics(); layer.addChild(dimG);
    blockers = [0, 1, 2, 3].map(() => { const b = new Container(); b.eventMode = 'static'; b.hitArea = new Rectangle(0, 0, 0, 0); layer.addChild(b); return b; });
    handS = new Sprite(F.ui_hand[0]); handS.anchor.set(9 / 32, 2 / 32); handS.scale.set(0.75); layer.addChild(handS);
    tutBubble = new Container(); layer.addChild(tutBubble); tutBubble.key = '';
  }
  const uW = L.W / L.uiS, uH = L.H / L.uiS, k = 1 / L.uiS;
  dimG.clear();
  const showDim = !!st && !introView && !dialog;
  if (showDim) {
    dimG.rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.5 });
    if (focus) { const p = 4; dimG.rect((focus.x - p) * k, (focus.y - p) * k, (focus.w + 2 * p) * k, (focus.h + 2 * p) * k).cut(); dimG.rect((focus.x - p) * k, (focus.y - p) * k, (focus.w + 2 * p) * k, (focus.h + 2 * p) * k).stroke({ width: 1, color: 0xf5cf6a, alpha: 0.6 + 0.4 * Math.sin(time * 6) }); }
  }
  // UI 탭 막기: 구멍 둘레 네 칸
  const f = showDim && focus ? { x: (focus.x - 4) * k, y: (focus.y - 4) * k, w: (focus.w + 8) * k, h: (focus.h + 8) * k } : showDim ? { x: 0, y: 0, w: 0, h: 0 } : null;
  const rects = !f ? [] : [[0, 0, uW, f.y], [0, f.y + f.h, uW, uH - f.y - f.h], [0, f.y, f.x, f.h], [f.x + f.w, f.y, uW - f.x - f.w, f.h]];
  blockers.forEach((b, i) => { const r = rects[i]; if (r) { b.hitArea.x = r[0]; b.hitArea.y = r[1]; b.hitArea.width = Math.max(0, r[2]); b.hitArea.height = Math.max(0, r[3]); b.eventMode = 'static'; } else b.eventMode = 'none'; });
  // 손가락
  handS.visible = !!hand?.at || !!hand?.pts;
  if (handS.visible) {
    const ph = time % 2;
    if (hand.kind === 'drag') {
      const pts = hand.pts.filter(Boolean); const segs = pts.length - 1, t = Math.min(1, ph / 1.5) * segs, i = Math.min(segs - 1, Math.floor(t)), u = t - i;
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      handS.position.set((ax + (bx - ax) * u) * k, (ay + (by - ay) * u) * k); handS.texture = F.ui_hand[ph < 1.5 ? 2 : 0]; handS.alpha = ph < 1.5 ? 1 : 0.4;
    } else {
      const [x, y] = hand.at;
      const press = hand.kind === 'tap' && Math.floor(time * 2.5) % 2 === 1;
      handS.position.set(x * k, y * k + (hand.kind === 'point' ? Math.sin(time * 5) * 3 : 0)); handS.texture = F.ui_hand[press ? 1 : 0]; handS.alpha = 1;
    }
  }
  // 말풍선 (한 문장) — 강조와 안 겹치게 위·아래
  const key = st && !introView && !dialog ? `${S.tutorial.step}` : '';
  if (tutBubble.key !== key) {
    tutBubble.removeChildren().forEach((c) => c.destroy({ children: true })); tutBubble.key = key;
    if (key) {
      const [who, text0] = TUT_TEXT[S.tutorial.step];
      const text = text0.replace('{p}', String(S.round?.stats?.profit ?? 0));
      const w = Math.min(Math.round(uW) - 12, 280);
      const tx = label(text, { small: true, color: COLOR.paperInk, shadow: false, wrap: w - 66 });
      const h = Math.max(42, Math.ceil(tx.height) + 12);
      tutBubble.addChild(frame('paper', w, h, 'panel'));
      const pf = portraitFrame(tex(NPC[who]), 34, 'wood'); pf.position.set(4, 4); tutBubble.addChild(pf);
      tx.position.set(46, Math.round((h - tx.height) / 2)); tutBubble.addChild(tx);
      const n = label(`${S.tutorial.step + 1}/${TUT_STEPS.length}`, { small: true, color: 0x8a7a68, shadow: false }); n.position.set(w - 6 - Math.ceil(n.width), 2); tutBubble.addChild(n);
      tutBubble.bw = w; tutBubble.bh = h;
    }
  }
  if (key) {
    const fc = focus ? (focus.y + focus.h / 2) * k : uH;
    const top = Math.round((L.portrait ? L.panels.hud.h : 0) * k) + 4, bottom = Math.round((L.portrait ? L.panels.sheet.y : L.H) * k) - tutBubble.bh - 6;
    const last = S.tutorial.step === TUT_STEPS.length - 1;          // 결과 단계는 카드 아래 (v0.8 §4): 폰 = 아래 시트 위 · PC = 화면 아래 왼쪽
    const y = last ? (L.portrait ? Math.round(L.panels.sheet.y * k) + 22 : Math.round(L.H * k) - tutBubble.bh - 6) : fc > uH * 0.45 ? top : Math.max(top, bottom);
    const shake = tutShakeT > 0 ? Math.sin(tutShakeT * 50) * 3 : 0;
    tutBubble.position.set(Math.round((last && !L.portrait ? L.vis.x0 * k + 4 : (uW - tutBubble.bw) / 2) + shake), y);
    if (tutShakeT > 0) { tutShakeT -= dt; tutBubble.scale.set(1 + Math.max(0, tutShakeT) * 0.06); } else tutBubble.scale.set(1);
  }
}
// ---- [0] 인수인계 장면 (§1 · v0.9): 사무소 GPT 원본(office_day) · 할아범은 책상 뒤에 앉음 · 붉은 수염은 처음 한 번만 걸어 들어옴 · 대사 4 · [건너뛰기]
// 장면은 uiRoot 밖 한 층에 한 번만 만든다 — 대사를 넘길 때는 대사 틀만 바꿈 (v0.9 §1: 넘길 때마다 처음부터 다시 걸어오던 버그). 화면 배율은 정수(기기 픽셀 기준), 남는 곳은 어두운 테두리
const introLayer = new Container(); app.stage.addChild(introLayer);
let introTick = null;
function showIntro(onDone) { introView = { i: 0, onDone, walked: false, slid: false, tapAt: 0 }; buildUI(); buildIntroLayer(); }
function introNext(skip = false) {
  const v = introView; if (!v) return;
  const nowMs = performance.now();
  if (!skip && nowMs - v.tapAt < 150) return;                     // 탭 디바운스: 줄당 1회
  v.tapAt = nowMs;
  sfx('stash', true);
  v.i = skip ? INTRO.length : v.i + 1;
  if (v.i >= INTRO.length) {
    introView = null; introTick = null; introLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    S.tutorial.introSeen = true; save();
    v.onDone?.(); buildUI();
  } else introLayer.setLine?.(v.i);
}
function buildIntroLayer() {
  introLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
  app.stage.addChild(introLayer);                                  // 늘 맨 위
  const v = introView; if (!v) return;
  const Wc = L.W, Hc = L.H, dpr = L.dpr;
  const sDev = Math.max(1, Math.floor(Math.min((Wc * dpr) / 256, (Hc * dpr) / 224))), sc = sDev / dpr;   // 정수 배율 (4×·5× …)
  const ox = Math.round(((Wc - 256 * sc) / 2) * dpr) / dpr, oy = Math.round(((Hc - 224 * sc) / 2 - (Hc > 224 * sc + 120 ? 40 : 0)) * dpr) / dpr;
  const hit = new Graphics().rect(0, 0, Wc, Hc).fill(0x0b0910); hit.eventMode = 'static'; hit.on('pointertap', () => introNext()); introLayer.addChild(hit);
  const room = new Container(); room.position.set(ox, oy); room.scale.set(sc); introLayer.addChild(room);
  const bgT = loaded[A('scenes/office_day.png')];
  room.addChild(new Sprite(bgT));
  const fire = new Sprite(F.office_fire[0]); fire.position.set(177, 68); room.addChild(fire);
  // 할아범: 책상 뒤 의자 — 다리는 책상 앞판이 가림 (원본에서 잘라 위에 덮는다)
  const old = new Sprite(tex(NPC.halabeoji)); old.anchor.set(0.5, 1); old.position.set(124, 112); room.addChild(old);
  const deskFront = new Sprite(new Texture({ source: bgT.source, frame: new Rectangle(82, 100, 88, 42) })); deskFront.position.set(82, 100); room.addChild(deskFront);
  // 장부·열쇠 (2번째 줄에서 한 번 밀려옴, 2프레임)
  const items = new Graphics().rect(0, 0, 7, 5).fill(0x7a2e48).rect(1, 1, 5, 1).fill(0xf4ecd2).rect(9, 1, 4, 2).fill(0xf5cf6a).rect(12, 0, 2, 4).fill(0xf5cf6a);
  items.position.set(v.slid ? 150 : 128, 95); room.addChild(items);
  // 붉은 수염: 장면에 처음 들어올 때만 걸어 들어오고, 그 뒤엔 제자리 숨쉬기
  const me = new Sprite(F.red_walk[0]); me.anchor.set(0.5, 1); me.scale.set(-1, 1); me.position.set(v.walked ? 186 : 272, 150); room.addChild(me);
  // 대사 틀 (UI 배율)
  const uW = Math.round(Wc / L.uiS), uH = Math.round(Hc / L.uiS);
  const ui0 = new Container(); ui0.scale.set(L.uiS); introLayer.addChild(ui0);
  const w = Math.min(uW - 16, 300);
  const box = new Container(); ui0.addChild(box);
  const sk = button('stone', 50, 14, '건너뛰기', () => introNext(true), { small: true }); sk.position.set(uW - 56, 6); ui0.addChild(sk);
  let nx = null;
  introLayer.setLine = (i) => {
    box.removeChildren().forEach((c) => c.destroy({ children: true }));
    const tx = label(INTRO[i], { color: COLOR.paperInk, shadow: false, wrap: w - 62 });
    const h = Math.max(54, Math.ceil(tx.height) + 22);
    box.position.set(Math.round((uW - w) / 2), uH - h - 12);
    box.addChild(frame('paper', w, h, 'panel'));
    const pf = portraitFrame(tex(NPC.halabeoji), 42, 'wood'); pf.position.set(6, 6); box.addChild(pf);
    tx.position.set(56, 8); box.addChild(tx);
    nx = label(i < INTRO.length - 1 ? '탭 ▶' : '시작 ▶', { small: true, color: 0x8a7a68, shadow: false }); nx.position.set(w - 8 - Math.ceil(nx.width), h - 13); box.addChild(nx);
    if (i === 1) v.slideT = 0;
  };
  introLayer.setLine(v.i);
  let tt = 0;
  introTick = (dt) => {
    if (me.destroyed) return;
    tt += dt;
    if (!v.walked) {
      me.x = Math.max(186, me.x - dt * 40); me.texture = F.red_walk[Math.floor(tt * 8) % F.red_walk.length];
      if (me.x <= 186) v.walked = true;
    } else me.texture = F.red_idle[Math.floor(tt * 2) % F.red_idle.length];   // 숨쉬기 2f
    if (v.slideT != null && !v.slid) { v.slideT += dt; items.x = v.slideT < 0.4 ? 139 : 150; if (v.slideT >= 0.4) v.slid = true; }
    fire.texture = F.office_fire[Math.floor(tt * 10) % F.office_fire.length];
    if (nx && !nx.destroyed) nx.alpha = 0.5 + 0.5 * Math.sin(tt * 4);
  };
}
// ---- 대사 카드 (첫 경매 안내 · 상황별 1회 안내) — 탭으로 넘김, 강제 없음
function showDialog(d) { if (dialog) dialogQueue.push(d); else { dialog = { i: 0, ...d }; buildUI(); } }
function dialogNext() {
  if (!dialog) return;
  dialog.i++;
  if (dialog.i >= dialog.lines.length) { const f = dialog.onDone; dialog = null; f?.(); if (dialogQueue.length) dialog = { i: 0, ...dialogQueue.shift() }; }
  sfx('stash', true); buildUI();
}
function makeDialog() {
  const uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS);
  const c = new Container(); c.eventMode = 'static'; c.hitArea = new Rectangle(0, 0, uW, uH); c.on('pointertap', dialogNext);
  c.addChild(new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.45 }));
  const w = Math.min(uW - 16, 300), who = dialog.who;
  const tx = label(dialog.lines[dialog.i], { color: COLOR.paperInk, shadow: false, small: true, wrap: w - 58 });
  const h = Math.max(50, Math.ceil(tx.height) + 22);
  const box = new Container(); box.position.set(Math.round((uW - w) / 2), Math.round(uH * 0.55 - h / 2)); c.addChild(box);
  box.addChild(frame('paper', w, h, 'panel'));
  const pf = portraitFrame(tex(NPC[who]), 40, 'wood'); pf.position.set(5, 5); box.addChild(pf);
  tx.position.set(52, 8); box.addChild(tx);
  const nx = label(dialog.i < dialog.lines.length - 1 ? `${dialog.i + 1}/${dialog.lines.length} ▶` : '알겠어요 ▶', { small: true, color: 0x8a7a68, shadow: false }); nx.position.set(w - 8 - Math.ceil(nx.width), h - 13); box.addChild(nx);
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return c;
}
/** [3] 처음 만나는 순간 1회 안내 (튜토리얼 동안엔 안 뜸) */
function tip(id) {
  if (!S.tutorial.done || tutOn() || S.tutorial.tips[id] || !TIPS[id]) return;
  S.tutorial.tips[id] = true; save();
  const [who, text] = TIPS[id];
  showDialog({ who, lines: [text] });
}
/** 칸 종류 첫 등장: 칸 위 작은 종이 라벨 2초 */
function tileTips(gx, gy) {
  if (!W) return;
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const x = gx + dx, y = gy + dy;
    if (x < 0 || x >= GW || y < 0 || y >= W.rows) continue;
    const ch = W.g[y][x]; if (ch === '.') continue;
    const cat = ORE_KEYS.has(ch) ? 'ore' : ch;
    if (!TILE_TIP[cat] || S.tutorial.tiles[cat]) continue;
    S.tutorial.tiles[cat] = true;
    emote({ x: cellX(x), y: GY + y * T + 30 }, TILE_TIP[cat], 2);
  }
}
// ---- [2] 첫 진짜 경매 안내 · 첫 결과 뒤 회사 안내 (손가락)
function onboardWatch() {
  if (!S.tutorial.done || introView || dialog) return;
  const st = state();
  if (st === 'AUCTION' && view === 'mine' && !S.tutorial.auctionIntro) {
    S.tutorial.auctionIntro = true; save();
    showDialog({ who: 'halabeoji', lines: AUCTION_INTRO });
  }
  if (SHOW_COMPANY && st === 'RESULT' && !S.round?.card?.tutorial && !S.tutorial.tips.company) {
    tip('company'); S.tutorial.guideCompany = true; save();
  }
  // 회사 안내 손가락: [회사] → 창고 [짓기] (금화 모자라면 "다음에")
  guideTarget = null;
  if (S.tutorial.guideCompany) {
    if (view !== 'company') guideTarget = () => boundsOf(ui.refs.company);
    else if ((S.company.buildings.warehouse?.lv ?? 0) > 0) { S.tutorial.guideCompany = false; save(); }
    else if (S.gold < B.company.buildings.warehouse.cost) { S.tutorial.guideCompany = false; tip('companyLater'); }
    else guideTarget = () => boundsOf(ui.refs.whBuild);
  }
}
setInterval(onboardWatch, 400);
/** 장면 ↔ 곡: 인수인계·설명서·튜토리얼 title · 회사 낮/밤 · 돌아오셨군요 밤 · 갱도 뒷산/폐광 · 경매 · 결과 (+ 앰비언스) */
function musicTick() {
  const st = state();
  let m, a = null;
  if (introView || manualView || tutOn()) m = 'title';
  else if (welcome) { m = 'yard_night'; a = 'yard_night'; }
  else if (view === 'company') { m = isNight() ? 'yard_night' : 'yard_day'; a = isNight() ? 'yard_night' : 'yard_day'; }
  else if (st === 'AUCTION') m = 'auction';
  else if (st === 'RESULT') m = 'result';
  else { m = S.round?.card?.floor === 2 ? 'mine_2' : 'mine_1'; a = 'mine'; }
  if (st === 'SURVEY' || st === 'DIG') a = 'mine';
  music(m); ambience(a);
}
setInterval(musicTick, 300);
/** 부팅: 처음이면 [0] → [1], 예전 세이브(v0.6 이전)면 [0]만 보고 넘어감, 다 했으면 첫 화면은 부지 */
function bootOnboarding() {
  const T0 = S.tutorial;
  const legacy = !T0.introSeen && !T0.done && (S.stats.rounds > 0 || (!!S.round && !S.round.card?.tutorial));
  if (!T0.introSeen) showIntro(() => { if (legacy || T0.done) { T0.done = true; save(); firstScreen(); } else startTutorialRound(); });
  else if (!T0.done && (!T0.active || !S.round?.card?.tutorial)) startTutorialRound();
  else if (T0.done) firstScreen();
}
const SHOW_COMPANY = false;                                  // 명세5 §12-8: 부지 장면(pxl 조립본) 오기 전까지 회사 화면 숨김
function firstScreen() { if (SHOW_COMPANY && !['SURVEY', 'DIG'].includes(state())) openCompany(); }
function replayTutorial() {
  if (['SURVEY', 'DIG'].includes(state())) { toast('라운드를 끝내고 다시 봐요'); return; }
  S.tutorial.introSeen = false;
  showIntro(() => startTutorialRound());
}
// ---- 설명서 (§5 · 체크인 manual 틀)
function makeManual() {
  const uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS), w = Math.min(uW - 12, 300), h = Math.min(uH - 24, 420);
  const box = new Container();
  const dim = new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.6 }); dim.eventMode = 'static'; box.addChild(dim);
  const c = new Container(); c.position.set(Math.round((uW - w) / 2), Math.round((uH - h) / 2)); box.addChild(c);
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const t = label('설명서', ink); t.position.set(8, 6); c.addChild(t);
  const x = button('paper', 36, 14, '닫기', () => { manualView = null; buildUI(); }, { small: true }); x.position.set(w - 42, 5); c.addChild(x);
  const cols = w < 260 ? 2 : 3, bw = Math.floor((w - 16 - (cols - 1) * 3) / cols);
  MANUAL.forEach((m, i) => {
    const b = button(manualView.key === m.key ? 'wood' : 'paper', bw, 15, m.title, () => { manualView.key = m.key; buildUI(); }, { small: true });
    b.position.set(8 + (i % cols) * (bw + 3), 24 + Math.floor(i / cols) * 18); c.addChild(b);
  });
  const m = MANUAL.find((q) => q.key === manualView.key) ?? MANUAL[0];
  let y = 24 + Math.ceil(MANUAL.length / cols) * 18 + 8;
  const ic = new Sprite(tex(m.icon) ?? F[m.icon]?.[0]); ic.anchor.set(0, 0); const isz = 28; if (ic.texture?.width) ic.scale.set(isz / Math.max(ic.texture.width, ic.texture.height)); ic.position.set(8, y); c.addChild(ic);
  const hd = label(m.title, { ...ink, color: 0x8a5a24 }); hd.position.set(8 + isz + 6, y + 8); c.addChild(hd);
  y += isz + 6;
  for (const ln of m.lines) { const l = label(`· ${ln}`, { ...ink, small: true, wrap: w - 20 }); l.position.set(10, y); c.addChild(l); y += Math.ceil(l.height) + 4; }
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
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
function openCompany() { coPan = { x: 0, y: -1e9 }; view = 'company'; placing = null; coSel = null; sfx('ui_open'); buildUI(); }
function closeCompany() { view = 'mine'; placing = null; coSel = null; buildUI(); }
/** 건물·장식이 바뀌면: 숫자 다시 · 광부 늘리기 · 새 어울림 */
function refreshCompany() {
  CF = companyFx(S);
  S.idle.capHours = CF.capHours;
  if (S.company.coreLv >= B.company.mineLv && S.floorUnlocked < 2) { S.floorUnlocked = 2; S.auction = null; setTimeout(() => toast('폐광(2층)이 열렸어요! 다음 경매에 나와요', 'halabeoji', 3), 600); }
  S.talents.points = talentPoints(S); S.talents.spent = talentSpent(S);
  if (talentLeft(S) > 0 && S.tutorial.done && SHOW_COMPANY) setTimeout(() => tip('talent'), 900);
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
    if (kind === 'office') S.company.coreLv++; else { S.company.buildings[kind].lv++; if (BUILD_UP[kind]) S.upgrades[BUILD_UP[kind]]++; }
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
      else { S.company.buildings[kind] = { lv: 1, x, y }; if (BUILD_UP[kind]) S.upgrades[BUILD_UP[kind]] = Math.max(S.upgrades[BUILD_UP[kind]], UP[BUILD_UP[kind]].min + 1); }
    }
    placing = null;
    if (!move) count('builds');
    afterBuild(move ? `${nameOf(kind)} 옮겼어요` : `${nameOf(kind)} 지었어요!`);
    return;
  }
  coSel = here && !(coSel?.x === x && coSel?.y === y) ? { x, y, kind: here.kind } : null;
  sfx('stash', true); buildUI();
}
function afterBuild(msg) { refreshCompany(); sfx(/Lv/.test(msg) ? 'upgrade' : 'build'); toast(msg); bumpCounter('coin'); save(); buildUI(); cloudSoon(); }
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
  let top = 20;
  if (state() === 'AUCTION' && !AU.card) {                       // §6: 첫 화면은 부지 — 깜빡이는 [오늘 경매 준비됐어요 ▶]
    const rb = button('wood', w - 8, 18, '오늘 경매 준비됐어요 ▶', closeCompany, { small: true }); rb.position.set(4, top); c.addChild(rb); ui.readyBtn = rb; top += 21;
  }
  const ss = siteSlot(), siteH = Math.min(siteContentH(ss), Math.round((h - top - 2) * 0.6));   // 넘치면 끌어서 봄
  const site = makeSite(w - 8, siteH); site.position.set(4, top); c.addChild(site);
  const list = makeCoList(w - 8, h - top - siteH - 6); list.position.set(4, top + 2 + siteH); c.addChild(list);
  return c;
}
/** 부드러운 빛 (가운데 1 → 가장자리 0) */
let _glowTex = null;
function glowTex() {
  if (_glowTex) return _glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glowTex = Texture.from(cv); _glowTex.source.scaleMode = 'linear';
  return _glowTex;
}
/** 부지 한 칸 = 갱도 칸 ×2 (v0.6 패치 ②: PC 128px · 폰 64px) — UI px */
const siteSlot = () => Math.round((2 * L.cell) / L.uiS);
const siteRows = (ss) => ({ sky: Math.round(ss * 0.45), fence: Math.round(ss * 0.28), path: Math.round(ss * 0.5) });
const siteContentH = (ss) => { const r = siteRows(ss); return r.sky + r.fence + ss * B.company.rows + r.path + 4; };
let coPan = { x: 0, y: -1e9 }, siteDragged = false;            // 처음엔 아래쪽(길·첫 건물 줄)부터
/** 부지 (v0.6 패치 ①): 잔디·흙길·울타리·하늘(art/yard.px.js = buildings.px.js yard 땅·하늘) · 슬롯 선은 짓기/옮기기 중에만 · 밤엔 창문 빛 */
function makeSite(sw, sh) {
  const c = new Container(), night = isNight();
  const nc = coCols(S), nr = B.company.rows, ss = siteSlot(), rr = siteRows(ss);
  const cw = Math.max(sw, nc * ss + ss), ch = Math.max(sh, siteContentH(ss));
  coPan.x = Math.max(sw - cw, Math.min(0, coPan.x)); coPan.y = Math.max(sh - ch, Math.min(0, coPan.y));
  const view = new Container(); c.addChild(view);
  const mask = new Graphics().rect(0, 0, sw, sh).fill(0xffffff); c.addChild(mask); view.mask = mask;
  const world = new Container(); world.position.set(coPan.x, coPan.y); view.addChild(world);
  const gx0 = Math.round((cw - nc * ss) / 2), gy0 = ch - rr.path - 4 - nr * ss, roadY = ch - rr.path - 2;
  // 땅·하늘
  const sky = new TilingSprite({ texture: tex(night ? 'yard_sky_night' : 'yard_sky_day'), width: cw, height: rr.sky + 2 }); sky.tileScale.set(1, (rr.sky + 2) / 32); world.addChild(sky);
  const grassTop = gy0 - rr.fence;
  const grass = new TilingSprite({ texture: tex('yard_grass'), width: cw, height: ch - grassTop }); grass.position.set(0, grassTop); world.addChild(grass);
  if (night) for (let i = 0; i < 18; i++) world.addChild(new Graphics().rect((i * 53) % cw, (i * 29) % Math.max(4, rr.sky - 2), 1, 1).fill(0xf4ecd2));
  const hill = new Graphics().poly([0, grassTop, cw * 0.18, grassTop - rr.sky * 0.5, cw * 0.4, grassTop - 4, cw * 0.62, grassTop - rr.sky * 0.7, cw * 0.85, grassTop - 6, cw, grassTop - rr.sky * 0.4, cw, grassTop]).fill(night ? 0x221e38 : 0x54486a);
  world.addChildAt(hill, 1);
  const fence = new TilingSprite({ texture: tex('yard_fence'), width: cw, height: 12 }); fence.scale.set(rr.fence / 12); fence.width = cw / fence.scale.x; fence.position.set(0, grassTop - Math.round(rr.fence * 0.35)); world.addChild(fence);
  const road = new TilingSprite({ texture: tex('yard_path'), width: cw, height: 16 }); road.scale.set(rr.path / 16); road.width = cw / road.scale.x; road.position.set(0, roadY - 2); world.addChild(road);
  // 광산 입구 (길 오른쪽 끝)
  const mine = new Graphics().rect(cw - ss * 0.5, roadY - ss * 0.42, ss * 0.42, ss * 0.42).fill(0x1a1622).rect(cw - ss * 0.56, roadY - ss * 0.48, ss * 0.54, ss * 0.08).fill(0x5c3832);
  world.addChild(mine);
  if (night) { const dark = new Graphics().rect(0, 0, cw, ch).fill({ color: 0x14122a, alpha: 0.42 }); world.addChild(dark); }
  const pos = (x, y) => [gx0 + x * ss, gy0 + y * ss];
  const pl = placed(S);
  // 어울림 잇는 선
  const links = new Graphics();
  for (const hm of harmonies(S)) {
    const a = pl.find((p) => p.kind === hm.a), b = pl.find((p) => p.kind === hm.b);
    if (a && b) { const [ax, ay] = pos(a.x, a.y), [bx, by] = pos(b.x, b.y); links.moveTo(ax + ss / 2, ay + ss * 0.85).lineTo(bx + ss / 2, by + ss * 0.85).stroke({ width: Math.max(1, ss / 40), color: 0xf5cf6a, alpha: 0.55 }); }
  }
  world.addChild(links);
  const smoke = [], animated = [], glows = new Container();
  const glow = (x, y, r, color, a) => { const g = new Sprite(glowTex()); g.anchor.set(0.5); g.width = g.height = r * 2; g.position.set(x, y); g.tint = color; g.alpha = a; g.blendMode = 'add'; glows.addChild(g); };
  // 뒤 줄부터 (위 → 아래) 그려야 겹침이 자연스럽다
  for (let yy = 0; yy < nr; yy++) for (let xx = 0; xx < nc; xx++) {
    const [px, py] = pos(xx, yy), here = coAt(S, xx, yy);
    const slot = new Container(); slot.position.set(px, py);
    const g = new Graphics(); slot.addChild(g);
    if (placing) {                                                // 짓기·옮기기 중에만 칸 선
      g.rect(1, 1, ss - 2, ss - 2).stroke({ width: 1, color: 0xf4ecd2, alpha: here ? 0.25 : 0.75 });
      if (!here) g.rect(2, 2, ss - 4, ss - 4).fill({ color: 0x9cc45a, alpha: 0.28 });
    }
    if (here) {
      const art = coArt(here.kind, here.deco ? 0 : lvOf(S, here.kind), ss);
      art.position.set(ss / 2, ss); slot.addChild(art);
      if (art.anim) animated.push(art);
      if (night) {
        art.tint = 0xb8b8e0;
        if (!here.deco) for (const [fx, fy] of [[0.3, 0.55], [0.7, 0.55], [0.5, 0.75]]) glow(px + ss * fx, py + ss * fy, ss * 0.22, 0xffd58a, 0.55);   // 창문 lamp
        if (here.kind === 'campfire') glow(px + ss / 2, py + ss * 0.78, ss * 0.6, 0xffb27a, 0.6);
      }
      if (here.kind === 'smelter') smoke.push([px + ss * 0.55, py + ss * 0.08]);
    }
    if (coSel && coSel.x === xx && coSel.y === yy) g.rect(0, 0, ss, ss).stroke({ width: 1, color: 0xf5cf6a });
    slot.eventMode = 'static'; slot.cursor = 'pointer'; slot.hitArea = new Rectangle(0, 0, ss, ss);
    slot.on('pointertap', () => { if (!siteDragged) onSlot(xx, yy); });
    world.addChild(slot);
  }
  world.addChild(glows);
  // 걷는 광부 · 낮잠 두더지 · 굴뚝 연기
  const ws = Math.max(0.45, ss / 80);
  const walkers = crew.slice(0, 6).map((m, i) => {
    const sp = new Sprite(F[`${m.id}_walk`][0]); sp.anchor.set(0.5, 1); sp.scale.set(ws); sp.tint = night ? 0xb8b8e0 : m.tint ?? 0xffffff;
    sp.position.set(20 + i * 30, roadY + rr.path * 0.7); world.addChild(sp);
    return { sp, id: m.id, x: 20 + i * 30, goal: 20 + Math.random() * (cw - 40), t: Math.random() * 2, f: 0 };
  });
  const mh = pl.find((p) => p.kind === 'moleHouse');
  const [mx, my] = mh ? pos(mh.x, mh.y) : [cw - ss, roadY];
  const moleS = new Sprite(F.mole_sniff[0]); moleS.anchor.set(0.5, 1); moleS.scale.set(ws); moleS.position.set(mh ? mx + ss * 0.85 : mx, mh ? my + ss : roadY + rr.path * 0.6); world.addChild(moleS);
  const zz = label('z', { small: true, color: COLOR.paper }); world.addChild(zz);
  const puffs = new Graphics(); world.addChild(puffs);
  let tt = 0;
  ui.coTick = (dt) => {
    tt += dt;
    for (const wk of walkers) {
      if (wk.sp.destroyed) return;
      if (wk.t > 0) { wk.t -= dt; wk.sp.texture = F[`${wk.id}_idle`]?.[0] ?? wk.sp.texture; continue; }
      const d = wk.goal - wk.x;
      if (Math.abs(d) < 1) { wk.t = 1 + Math.random() * 3; wk.goal = 14 + Math.random() * (cw - 40); continue; }
      wk.x += Math.sign(d) * Math.min(Math.abs(d), ss * 0.4 * dt);
      wk.f += dt * 8; const fr = F[`${wk.id}_walk`]; wk.sp.texture = fr[Math.floor(wk.f) % fr.length];
      wk.sp.scale.x = ws * Math.sign(d); wk.sp.x = Math.round(wk.x);
    }
    for (const sp of animated) if (!sp.destroyed) sp.texture = sp.anim[Math.floor(tt * sp.fps) % sp.anim.length];
    zz.position.set(moleS.x + 4, moleS.y - moleS.height - Math.round((tt * 4) % 6)); zz.alpha = 1 - ((tt * 4) % 6) / 6;
    puffs.clear();
    for (const [px, py] of smoke) for (let i = 0; i < 3; i++) { const k = (tt * 0.6 + i / 3) % 1; puffs.circle(px + Math.sin(k * 6 + i) * ss * 0.04, py - k * ss * 0.3, ss * (0.03 + k * 0.05)).fill({ color: 0xc8c0d0, alpha: 0.5 * (1 - k) }); }
  };
  // 끌어서 보기 (부지가 화면보다 크면)
  if (cw > sw || ch > sh) {
    const bg = new Graphics().rect(0, 0, sw, sh).fill({ color: 0, alpha: 0.001 }); c.addChildAt(bg, 0);
    c.eventMode = 'static'; c.hitArea = new Rectangle(0, 0, sw, sh);
    let d0 = null;
    c.on('pointerdown', (e) => { d0 = { x: e.global.x, y: e.global.y, px: coPan.x, py: coPan.y }; siteDragged = false; });
    c.on('globalpointermove', (e) => {
      if (!d0) return;
      const dx = (e.global.x - d0.x) / L.uiS, dy = (e.global.y - d0.y) / L.uiS;
      if (Math.abs(dx) + Math.abs(dy) > 4) siteDragged = true;
      coPan.x = Math.max(sw - cw, Math.min(0, d0.px + dx)); coPan.y = Math.max(sh - ch, Math.min(0, d0.py + dy));
      world.position.set(Math.round(coPan.x), Math.round(coPan.y));
    });
    const end = () => { d0 = null; setTimeout(() => { siteDragged = false; }, 0); };
    c.on('pointerup', end); c.on('pointerupoutside', end);
    if (cw > sw) { const hint = label('◂ 끌어서 보기 ▸', { small: true, color: COLOR.paper }); hint.alpha = 0.7; hint.position.set(Math.round((sw - hint.width) / 2), 2); c.addChild(hint); }
  }
  return c;
}
/** 부지 그림: GPT 시트 먼저(Lv1·2 → _1, Lv3·4 → _3, Lv5 → _5), 없으면 buildings.px.js */
function coArt(kind, lv, ss) {
  const deco = DECO_ART[kind];
  let sp;
  if (deco && tex(`g_${deco}`)) {
    sp = new Sprite(tex(`g_${deco}`)); sp.anchor.set(0.5, 1);
    sp.scale.set((ss * 0.8) / Math.max(sp.texture.width, sp.texture.height));
    return sp;
  }
  if (deco) {
    if (DECO_ANIM.has(deco)) { sp = new Sprite(F[deco][0]); sp.anim = F[deco]; sp.fps = deco === 'deco_fire' ? 8 : 6; }
    else sp = new Sprite(tex(deco));
    sp.anchor.set(0.5, 1); sp.scale.set(Math.max(0.5, Math.min(1, (ss - 2) / Math.max(sp.texture.width, sp.texture.height))) * 1.1);
    return sp;
  }
  const step = lv >= 5 ? 5 : lv >= 3 ? 3 : 1;
  const gStep = [...GPT_STEPS].reverse().find((l) => l <= step);
  const gpt = gStep && tex(`g_${BLD_ART[kind]}_${gStep}`);
  sp = new Sprite(gpt || tex(`${BLD_ART[kind]}_${step}`));
  sp.anchor.set(0.5, 1);
  sp.scale.set((ss * 1.04) / (gpt ? 128 : 48));                // 한 칸 가득 (GPT 128px = PC에서 1:1)
  return sp;
}
/** 아래 시트: [건물] [장식] [어울림] · 고른 건물 정보 · 짓기/올리기/옮기기 */
function makeCoList(lw, lh) {
  const c = new Container();
  c.addChild(frame('paper', lw, lh, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  if (placing) {
    const t = label(`${nameOf(placing.kind)}: ${placing.move ? '옮길' : '지을'} 빈 자리를 톡! (초록 칸)`, { ...ink, wrap: lw - 72 }); t.position.set(8, 8); c.addChild(t);
    const x = button('paper', 50, 16, '취소', () => { placing = null; buildUI(); }, { small: true }); x.position.set(lw - 56, 6); c.addChild(x);
    return c;
  }
  let top = 4;
  if (coSel) {                                                   // 부지에서 고른 것
    const k = coSel.kind, deco = !!B.company.decos[k], lv = lvOf(S, k);
    const nm = label(`${nameOf(k)}${deco ? '' : ` Lv${lv}`}`, { ...ink, small: lw < 240 }); nm.position.set(8, top + (lw < 240 ? 4 : 2)); c.addChild(nm);
    if (nm.x + nm.width > lw - 108) nm.scale.set(Math.max(0.6, (lw - 116) / nm.width));
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
    const btn = button(have ? 'paper' : 'wood', bw, 16, txt, () => coAction(k), { small: true }); if (k === 'warehouse') ui.refs.whBuild = btn;
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
  refreshCompany(); sfx('talent');
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
/** 카드의 예상 가치 (v0.8 §3-1): 구획을 미리 만들어 광석 기준가 합 + 유물 기대치 → 시드로 ±valueNoise 어긋난 중간값 · ±25% 범위 */
function cardValue(card) {
  if (!card.value) {
    const g = generate(card).join('');
    let gross = 0;
    for (const ch of g) if (ORE_KEYS.has(ch)) gross += B.basePrice[ch]; else if (ch === 'R') gross += (B.relicGold[0] + B.relicGold[1]) / 2;
    const mid = gross * (1 - B.auction.valueNoise + 2 * B.auction.valueNoise * ((card.seed % 997) / 997));
    card.value = { mid: Math.round(mid / 10) * 10 };
  }
  const sp = CF.veinRange ? B.auction.valueSpreadTalent : B.auction.valueSpread, m = card.value.mid;
  return { mid: m, lo: Math.round((m * (1 - sp)) / 10) * 10, hi: Math.round((m * (1 + sp)) / 10) * 10 };
}
/** 길드 한도 = 예상 가치 × 눈대중 × 성향 계수 (사무소+깃발 어울림이면 −5%) */
function guildCap(card, g) {
  const v = cardValue(card).mid * CF.guildMul * (1 + (Math.random() * 2 - 1) * B.guildSpread);
  return Math.round(v * (g.style === 'random' ? g.capMin + Math.random() * (g.capMax - g.capMin) : g.cap));
}
const nextBid = () => (AU.holder == null ? AU.card.price : Math.round(AU.high * (1 + B.auction.raiseStep)));
function pickCard(card) {
  Object.assign(AU, { card, phase: 'bid', high: card.price, holder: null, me: null, endAt: null, react: 0, count: 0, out: [false, false, false], bids: [null, null, null] });
  AU.say = GUILD_LINES.map((l, i) => ({ text: l.enter, line: true, t: time + 0.15 + i * 0.45, intro: true }));   // 등장 한마디 (차례로)
  AU.caps = B.guilds.map((g) => guildCap(card, g));
  if (L.portrait && S.settings.sheetFolded) { S.settings.sheetFolded = false; setTimeout(layout, 0); }
  setTimeout(() => { if (AU.card === card) toast('다른 두 구획은 길드들이 가져갔어요', null, 1); }, 1500);
  buildUI();
}
/** [올리기 +10%] — 처음 누르면 시작가로 입찰 */
function playerRaise() {
  if (AU.phase !== 'bid' || AU.holder === 'me') return;
  const price = nextBid();
  if (price > S.gold) { toast('금화가 모자라요'); return; }
  AU.high = price; AU.holder = 'me'; AU.me = price; AU.react = B.auction.guildReact; AU.count = 0;
  AU.say = AU.say.map((t) => (t ? { ...t, old: true, intro: false } : t));
  sfx('bid');
  buildUI();
}
/** 길드가 따라온다: 한도 안이면 한 곳이 +10% (공격적인 순서로), 한도를 넘은 곳은 포기 */
function guildRespond() {
  const next = Math.round(AU.high * (1 + B.auction.raiseStep));
  let raised = false;
  for (const i of [0, 2, 1]) {
    if (AU.out[i]) continue;
    if (next > AU.caps[i]) { AU.out[i] = true; AU.say[i] = { text: pick(GUILD_LINES[i].pass), pass: true, t: time }; sfx('pass', true); continue; }
    if (raised) continue;
    raised = true;
    AU.high = next; AU.holder = i; AU.bids[i] = next;
    AU.say[i] = { text: fill(pick(GUILD_LINES[i].raise), { g: next }), price: next, pass: false, t: time }; sfx('bid');
  }
  if (!raised) { AU.phase = 'count'; AU.count = B.auction.hammerSeconds; }   // 아무도 안 따라옴 → 3·2·1
  buildUI();
}
function playerFold() {
  if (AU.phase !== 'bid') return;
  AU.me = '포기';
  if (AU.holder == null) {                                        // 아직 아무도 안 불렀으면: 한도가 가장 높은 길드가 시작가에
    const i = AU.caps.indexOf(Math.max(...AU.caps)); AU.holder = i; AU.bids[i] = AU.high;
  }
  auctionLost();
}
/** 낙찰 (플레이어): 망치 쾅 + 도장 · 길드 하나가 한마디 */
function auctionWon() {
  count('wins');
  AU.phase = 'won'; AU.timer = 2.0; AU.endAt = time;
  const i = Math.floor(Math.random() * 3);
  AU.say = AU.say.map((q) => (q ? { ...q, old: true } : q)); AU.say[i] = { text: pick(GUILD_LINES[i].lose), line: true, t: time + 0.5 };
  toast(fill(AUCTIONEER.won, { p: AU.high }), 'halabeoji', 2.5);
  sfx('gavel'); setTimeout(() => sfx('stamp'), 220); shake = 0.25; shakeAmp = 2;
  buildUI();
}
/** 유찰 (길드가 가져감) → 공짜 자투리 구획 */
function auctionLost() {
  AU.phase = 'lost'; AU.timer = 2.2; AU.endAt = time;
  const w = typeof AU.holder === 'number' ? AU.holder : null;
  AU.say = AU.say.map((q) => (q ? { ...q, old: true } : q));
  if (w != null) AU.say[w] = { text: pick(GUILD_LINES[w].win), line: true, t: time + 0.4 };
  toast(AUCTIONEER.lost, 'halabeoji', 3);
  if (w != null) { sfx('gavel'); setTimeout(() => sfx('stamp'), 220); shake = 0.2; shakeAmp = 1.5; }
  buildUI();
}
let countShown = -1;
function updateAuction(dt) {
  if (AU.phase === 'bid' && AU.holder === 'me' && AU.react > 0) { AU.react -= dt; if (AU.react <= 0) guildRespond(); }
  else if (AU.phase === 'count') {
    AU.count -= dt;
    const n = Math.ceil((AU.count / B.auction.hammerSeconds) * 3);   // 3·2·1
    if (n !== countShown) { countShown = n; if (n > 0) sfx('ui_tap'); buildUI(); }
    if (AU.count <= 0) auctionWon();
  } else if (AU.phase === 'won' || AU.phase === 'lost') {
    AU.timer -= dt;
    if (AU.timer <= 0) {
      if (AU.phase === 'won') startRound(AU.card, AU.high);
      else startRound(freeCard(newSeed(), CF.freeHint ? 1 : 0), 0);
    }
  }
}

// ---------------------------------------------------------------- 탐사: 두더지가 걷다 아래 3칸 안 광맥 위에서 킁킁 · 투시 랜턴
let toolArmed = null;                                       // 'vibro' | 'xray' — 다음 톡에 쓰임
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
  if (tutOn()) { if (ui.survey) ui.survey.text = S.tutorial.sniffed ? '탐사 끝을 눌러요' : '두더지를 지켜봐요'; return; }
  rd.surveyLeft = Math.max(0, rd.surveyLeft - dt);
  if (rd.surveyLeft <= 0 && !(rd.vibroLeft > 0) && !(rd.xrayLeft > 0) && !rd.stakes?.some((q) => q.at > time)) { startDig(); return; }
  if (ui.survey) ui.survey.text = rd.surveyLeft > 0 ? `두더지 ${Math.ceil(rd.surveyLeft)}초` : '어디를 뚫을까요?';
}
function updateMole(dt) {
  if (tutOn() && state() === 'SURVEY') {                       // 튜토리얼: 두더지가 구리 위(x=TUT_SHAFT_X)로 가서 3초 킁킁
    const tx = GX + TUT_SHAFT_X * T + 8;
    if (S.tutorial.sniffed) { mole.sniffing = false; return; }
    if (mole.tw == null) {
      const d = tx - mole.x; mole.face = Math.sign(d) || 1; mole.x += Math.sign(d) * Math.min(Math.abs(d), CF.moleSpeed * dt);
      if (Math.abs(d) < 0.5) { mole.tw = 3; mole.face = -1; emote(mole, '킁킁', 3); sfx('mole_sniff'); (S.round.paws ??= []).push(TUT_SHAFT_X); drawSurvey(); }
    } else { mole.tw -= dt; mole.sniffing = true; if (mole.tw <= 0) { S.tutorial.sniffed = true; mole.tw = null; mole.sniffing = false; save(); } }
    return;
  }
  if (state() === 'SURVEY' && S.round.surveyLeft > 0) {
    if (mole.wait > 0) { mole.wait -= dt; mole.sniffing = mole.wait > 0; return; }
    if (mole.goal === undefined) mole.goal = mole.x < GX + GW * T / 2 ? GX + GW * T - 8 : GX + 8;
    const d = mole.goal - mole.x;
    mole.face = Math.sign(d) || 1;
    const before = Math.floor((mole.x - GX) / T);
    mole.x += Math.sign(d) * Math.min(Math.abs(d), CF.moleSpeed * dt);
    const after = Math.floor((mole.x - GX) / T);
    if (after !== before && after >= 0 && after < GW) {
      const size = veinBelow(after);
      const vt = CF.oreColor ? veinTypeBelow(after) : null;
      if (size) { mole.wait = 0.6 + size * 0.12; mole.x = GX + after * T + 8; sfx('mole_sniff', true); if (!S.round.paws?.includes(after)) { (S.round.paws ??= []).push(after); drawSurvey(); } emote(mole, (vt ? ORES.find((o) => o.key === vt).name + ' ' : '') + (CF.sniffSize ? `킁킁 ${'•'.repeat(size >= B.bigVein ? 3 : size >= 6 ? 2 : 1)}` : '킁킁'), 0.6 + size * 0.12, vt ? ORE_COLOR[vt] : undefined); }
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
  S.round.xrayLeft--; toolArmed = null; sfx('ui_open');
  const mem = S.round.xmem ??= [];                              // 본 광석 칸은 반투명으로 기억 (명세5 §1)
  for (let y = gy - rr; y <= gy + rr; y++) for (let x = gx - rr; x <= gx + rr; x++) if (x >= 0 && x < GW && y >= 0 && y < W.rows && ORE_KEYS.has(W.g[y][x]) && !mem.includes(`${x},${y}`)) mem.push(`${x},${y}`);
  setTimeout(() => { for (let y = gy - rr; y <= gy + rr; y++) for (let x = gx - rr; x <= gx + rr; x++) if (x >= 0 && x < GW && y >= 0 && y < GH) refreshAround(x, y, 0); drawSurvey(); }, B.xraySeconds * 1000 + 50);
  buildUI();
  return true;
}

// ---------------------------------------------------------------- 탐사 도구 (명세5 §1): 진동계 · 지표 단서 · 지상 표시(🐾 · 말뚝 · 투시 기억)
const TV = B.tools;
const vibroV = (f) => UP.vibro[f][upLv(S, 'vibro')];
const vibroUses = () => vibroV('uses');
const CLUE = { C: ['grass', '변색된 풀', '구리'], s: ['gravel', '반짝이는 자갈', '은·금'], g: ['gravel', '반짝이는 자갈', '은·금'], j: ['crystal', '수정 조각', '보석'], c: ['moss', '푸른 이끼', '발광석'], o: ['crack', '갈라진 땅', '빈 공간'], w: ['damp', '축축한 땅', '지하수'] };
/** 라운드 시작: 지표 단서 배치 — 참 단서(광맥·빈 공간·지하수 위) + 같은 비율의 헛단서 */
function placeClues() {
  const rd = S.round, C = TV.clue, used = new Set(), out = [];
  const colsOf = (cells) => [...new Set(cells.map((q) => q[0]))];
  const put = (x, kind, truth) => { if (used.has(x)) return; used.add(x); out.push({ x, kind, truth }); };
  if (!rd.card.tutorial) for (const v of W.veins.list) if (Math.random() < C.perVein) { const xs = colsOf(v.cells); put(xs[Math.floor(Math.random() * xs.length)], v.type, true); }
  for (const [ch, p] of [['o', C.cave], ['w', C.water]]) {
    if (rd.card.tutorial) break;
    const xs = []; W.g.forEach((row) => row.forEach((c, x) => { if (c === ch) xs.push(x); }));
    if (xs.length && Math.random() < p) put(xs[Math.floor(Math.random() * xs.length)], ch, true);
  }
  const nTrue = out.length, nFalse = Math.round(nTrue * (1 - C.truth) / C.truth);
  const kinds = Object.keys(CLUE);
  for (let i = 0, tries = 0; i < nFalse && tries < 60; tries++) {
    const x = Math.floor(Math.random() * GW), k = kinds[Math.floor(Math.random() * kinds.length)];
    const below = W.g.some((row) => row[x] === k) || (k !== 'o' && k !== 'w' && W.g.some((row) => ORE_KEYS.has(row[x]) && row[x] === k));
    if (used.has(x) || below) continue;
    put(x, k, false); i++;
  }
  rd.clues = out; rd.paws = []; rd.stakes = []; rd.xmem = []; rd.vibroLeft = vibroUses();
  drawSurvey();
}
/** 진동계: 그 열 맨 위 광맥 → "깊이 4~6 · 중간" (3초 뒤) */
function vibroAt(wx) {
  const rd = S.round, gx = Math.floor((wx - GX) / T);
  if (gx < 0 || gx >= GW || !(rd.vibroLeft > 0)) return false;
  if (rd.stakes.some((q) => q.x === gx)) { toast('여긴 이미 말뚝을 박았어요'); return false; }
  rd.vibroLeft--; toolArmed = null;
  const st = { x: gx, text: '…', color: null, at: time + TV.vibro.seconds };
  rd.stakes.push(st); sfx('ui_tap'); shake = 0.15; shakeAmp = 0.8;
  setTimeout(() => {
    let id = -1, d = 0;
    for (let y = 0; y < W.rows && id < 0; y++) { const v = W.veins.id[y][gx]; if (v >= 0 && ORE_KEYS.has(W.g[y][gx])) { id = v; d = y + 1; } }
    if (id < 0) { st.text = '없음'; }
    else {
      const v = W.veins.list[id], r = vibroV('range'), lo = Math.max(1, d - Math.floor(Math.random() * (r + 1)));
      const word = TV.sizeWords.find(([n]) => v.size <= n)[1];
      st.text = `깊이 ${lo}~${lo + r} · ${word}`;
      if (vibroV('color')) { st.color = ORE_COLOR[v.type]; st.text += ` ${ORES.find((o) => o.key === v.type)?.name ?? ''}`; }
    }
    st.at = 0; sfx(id < 0 ? 'pass' : 'vein_found', true); drawSurvey(); syncRound();
  }, TV.vibro.seconds * 1000);
  drawSurvey(); buildUI(); syncRound();
  return true;
}
function armTool(k) {
  const left = k === 'vibro' ? S.round.vibroLeft : S.round.xrayLeft;
  if (!(left > 0)) return;
  toolArmed = toolArmed === k ? null : k; sfx('ui_tap');
  toast(toolArmed ? (k === 'vibro' ? '말뚝 박을 땅을 톡!' : '보고 싶은 곳을 톡!') : '취소');
  buildUI();
}
function useToolAt(wx, wy) {
  if (toolArmed === 'vibro') return vibroAt(wx);
  if (toolArmed === 'xray') return xrayAt(wx, wy);
  return false;
}
/** 지상 표시: 🐾 발자국 · 단서 소품 · 진동계 말뚝 · 투시로 본 광석(반투명) */
const surveyG = new Graphics(); markU.addChild(surveyG);
const stakeUI = new Container();                             // worldUI는 아래에서 만들어짐 → 처음 그릴 때 붙임
let stakeKey = '';
function drawSurvey() {
  const g = surveyG; g.clear();
  const rd = S.round; if (!rd || !W || !['SURVEY', 'DIG'].includes(rd.state)) return;
  const y0 = SURFACE_Y;
  for (const c of rd.clues ?? []) {
    const cx = cellX(c.x), [kind] = CLUE[c.kind];
    if (kind === 'grass') for (const dx of [-4, 0, 4]) g.moveTo(cx + dx, y0 + 1).lineTo(cx + dx - 1, y0 - 3).moveTo(cx + dx, y0 + 1).lineTo(cx + dx + 1, y0 - 2).stroke({ width: 1, color: 0xb87a3a });
    if (kind === 'gravel') { for (const [dx, dy] of [[-4, 0], [0, 1], [3, 0], [-1, -1]]) g.rect(cx + dx, y0 + dy - 1, 2, 1.5).fill(0xd8d0b8); g.rect(cx + 1, y0 - 3, 1, 1).fill(0xffffff); }
    if (kind === 'crystal') g.poly([cx - 2, y0 + 1, cx, y0 - 5, cx + 2, y0 + 1]).fill(0xb070e0).poly([cx + 2, y0 + 1, cx + 4, y0 - 2, cx + 5, y0 + 1]).fill(0x8a4ab0);
    if (kind === 'moss') for (const dx of [-4, -1, 3]) g.circle(cx + dx, y0, 1.6).fill(0x48b8a8);
    if (kind === 'crack') g.moveTo(cx - 5, y0 + 1).lineTo(cx - 2, y0 + 3).lineTo(cx + 1, y0 + 1).lineTo(cx + 5, y0 + 4).stroke({ width: 1, color: 0x1a120e });
    if (kind === 'damp') g.ellipse(cx, y0 + 2, 6, 1.8).fill({ color: 0x2a3a52, alpha: 0.8 });
  }
  for (const x of rd.paws ?? []) { const cx = cellX(x); for (const [dx, dy] of [[-3, 5], [2, 6]]) { g.circle(cx + dx, y0 + dy, 1.1).fill({ color: 0x3a2418, alpha: 0.9 }); g.circle(cx + dx - 1, y0 + dy - 1.6, 0.5).fill({ color: 0x3a2418, alpha: 0.9 }); g.circle(cx + dx + 1, y0 + dy - 1.6, 0.5).fill({ color: 0x3a2418, alpha: 0.9 }); } }
  for (const st of rd.stakes ?? []) { const cx = cellX(st.x) + 4; g.rect(cx - 0.5, y0 - 10, 1.5, 12).fill(0x8a5a34).rect(cx - 2, y0 - 11, 4.5, 2).fill(0xc8a070); }
  for (const k of rd.xmem ?? []) {
    const [x, y] = k.split(',').map(Number); const t = W.g[y]?.[x];
    if (!ORE_KEYS.has(t) || revealed(x, y)) continue;
    g.rect(GX + x * T + 3, GY + y * T + 3, T - 6, T - 6).fill({ color: ORE_COLOR[t], alpha: 0.35 }).stroke({ width: 1, color: ORE_COLOR[t], alpha: 0.6 });
  }
}
/** 말뚝 글자 (화면 층, 칸을 따라감) */
function drawStakeUI() {
  const rd = S.round, show = !!rd?.stakes?.length && ['SURVEY', 'DIG'].includes(rd.state) && view === 'mine';
  if (!stakeUI.parent) worldUI.addChild(stakeUI);
  stakeUI.visible = show; if (!show) return;
  const key = rd.stakes.map((q) => q.x + q.text).join('|') + L.uiS;
  if (key !== stakeKey) {
    stakeKey = key; stakeUI.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const st of rd.stakes) {
      const t = label(st.text, { small: true, color: st.color ?? COLOR.paper }); t.sx = st.x; stakeUI.addChild(t);
    }
  }
  for (const t of stakeUI.children) {
    t.scale.set(L.uiS);
    const [sx, sy] = toScreen(cellX(t.sx) + 4, SURFACE_Y - 12);
    const st = rd.stakes.find((q) => q.x === t.sx);
    const jig = st?.at > time ? Math.sin(time * 40) * 1.5 : 0;
    t.position.set(Math.round(sx - t.width / 2 + jig), Math.round(sy - t.height));
  }
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
    // 패드·PC 가로 (v0.8): 칸 = min(높이/18, 너비/12) — 지상 1.6칸(창고 문까지) + 격자 16줄이 한 화면 (스크롤 없음). 좌우 패널은 남는 폭
    uiS = Wd >= 1900 ? 2 : 1.5;                                   // v0.8 §5: 패널이 좁아진 만큼 UI 배율을 낮춰 같은 배치가 들어가게
    cell = Math.min(H / 18, (Wd - 2 * Math.max(220, Math.min(300, Math.floor(Wd * 0.175)))) / 12);
    const side = Math.max(220, Math.min(300, Math.floor(Wd * 0.175)));   // v0.8 §5: 좌우 패널 합 ≤ 화면 폭 35% — 갱도가 주인공
    if (cell < 20) portraitMode = true;
    else {
      const pad = 2 * uiS;
      panels = {
        left: { x: pad, y: pad, w: side - 2 * pad, h: H - 2 * pad },
        right: { x: Wd - side + pad, y: pad, w: side - 2 * pad, h: H - 2 * pad },
      };
      vis = { x0: side, x1: Wd - side, y0: 0, y1: H, above: 1.6 };
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
  if (introView) buildIntroLayer();
}
function clampPan() {
  cam.panX = Math.max(-L.overX / 2 - 8, Math.min(L.overX / 2 + 8, cam.panX));
  cam.panY = Math.max(-24, Math.min(L.overY + 24, cam.panY));
}
window.addEventListener('resize', () => setTimeout(layout, 60));

const toWorld = (sx, sy) => [((sx - display.x) / display.scale.x + cam.rx) / DENS, ((sy - display.y) / display.scale.y + cam.ry) / DENS];
const toScreen = (x, y) => [display.x + (x * DENS - cam.rx) * display.scale.x, display.y + (y * DENS - cam.ry) * display.scale.y];
const inRect = (r, sx, sy) => r && sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h;
const inPanels = (sx, sy) => !!introView || tutBlocks(sx, sy) || inRect(ui.overlayRect2, sx, sy) || Object.values(L.panels).some((p) => sx >= p.x && sx < p.x + p.w && sy >= p.y && sy < p.y + p.h)
  || (ui.overlayRect && sx >= ui.overlayRect.x && sx < ui.overlayRect.x + ui.overlayRect.w && sy >= ui.overlayRect.y && sy < ui.overlayRect.y + ui.overlayRect.h);

// ================================================================ UI (art/ui/ui.px.js 틀 · 인물은 틀 안에서만)
let ui = {};
let sheetTab = 'sell';

function buildUI() {
  if (!L) return;
  uiRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
  uiRoot.scale.set(L.uiS);
  ui = { counters: {}, rows: {}, refs: {}, overlayRect2: null, scrollKnob: null };
  const u = (v) => Math.round(v / L.uiS);             // CSS px → UI px
  if (L.portrait) {
    const hud = L.panels.hud, sheet = L.panels.sheet;
    uiRoot.addChild(makeHud(u(hud.w), u(hud.h)));
    const s = new Container(); s.y = u(sheet.y);
    const sw = u(sheet.w), sh = u(L.H) - u(sheet.y);
    s.addChild(frame('stone', sw, sh + 6, 'panel'));
    const tabs = [['sell', '판매'], ['gear', '장비'], ['miner', '광부'], ['day', '과제'], ['set', '설정']];
    const tw = Math.floor((sw - 12 - 22) / tabs.length);
    const body = new Container(); body.position.set(5, 19);
    const bw = sw - 10, bh = sh - 23;
    const show = (key) => {
      sheetTab = key;
      ui.tabs.forEach((t) => t.setOn(t.key === key));
      body.removeChildren().forEach((c) => c.destroy({ children: true }));
      ui.rows = {};
      for (const k of ['crew', 'fps', 'buyerFace', 'buyerName', 'irows', 'smeltLine']) ui[k] = null;
      body.addChild(state() === 'AUCTION' && AU.card && view !== 'company' ? makeBidPanel(bw, bh) : key === 'sell' ? makeSell(bw, bh) : key === 'gear' ? makeGear(bw, bh) : key === 'miner' ? makeCrew(bw, bh) : key === 'day' ? makeDaybook(bw, bh) : makeSettings(bw, bh));
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
    const logH = Math.max(150, lh - 38 - ch - 2 - 100 - dh - 2);
    const lf = { y: 38 + ch + 2 + dh + 2 };                       // 명세5 §3: 사건 기록 자리 → 장비 (PC 패널은 §12-7에서 정리)
    const gr = makeGear(lw, logH); gr.y = lf.y; lc.addChild(gr);
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
    const ov = makeOverlay();
    if (ov) uiRoot.addChild(ov);
  }
  if (welcome) uiRoot.addChild(makeWelcome());
  if (rankView) uiRoot.addChild(makeRank());
  if (cloudChoice) uiRoot.addChild(makeCloudChoice());
  if (manualView) uiRoot.addChild(makeManual());
  ui.tutLayer = new Container(); uiRoot.addChild(ui.tutLayer);
  if (dialog) uiRoot.addChild(makeDialog());
  if (L.portrait && L.overY > 0 && view === 'mine' && ['SURVEY', 'DIG'].includes(state())) uiRoot.addChild(makeScrollBar());
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
  cb.position.set(w - 34, 3); ui.refs.company = cb; if (S.tutorial.done && SHOW_COMPANY) c.addChild(cb); else cb.destroy();   // 튜토리얼 동안 · 부지 장면 오기 전까지 숨김
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
  const v = L.vis, x = u(v.x0) + 4, y = u(v.y0) + 4, w = u(v.x1 - v.x0) - 8, h = u(v.y1 - v.y0) - 8;
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
  const title = label(AU.card ? '입찰' : `${S.day}일차 경매`, { color: COLOR.paperInk, shadow: false }); title.position.set(8, 6); c.addChild(title);
  const gold = label(`가진 금화 ${S.gold}`, { small: true, color: 0x8a7a68, shadow: false }); gold.position.set(AU.card ? 8 : w - 8 - 0, AU.card ? 20 : 8); if (!AU.card) gold.x = w - 8 - Math.ceil(gold.width); c.addChild(gold);
  let top0 = 34;
  if (!AU.card) { const hl = label(AUCTION_LINE, { small: true, color: 0x8a5a24, shadow: false, wrap: w - 16 }); hl.position.set(8, 20); c.addChild(hl); top0 = 24 + Math.ceil(hl.height); }
  const cards = todayCards();
  if (!AU.card) {
    const horiz = w > h * 1.2;
    const gap = 4, n = cards.length;
    const cw = horiz ? Math.floor((w - 16 - gap * (n - 1)) / n) : w - 16;
    const chh = horiz ? h - top0 - 6 : Math.floor((h - top0 - 6 - gap * (n - 1)) / n);
    cards.forEach((card, i) => {
      const k = makePlotCard(card, cw, Math.min(chh, horiz ? 160 : 70));
      k.position.set(8 + (horiz ? i * (cw + gap) : 0), top0 + (horiz ? 0 : i * (Math.min(chh, 70) + gap)));
      c.addChild(k);
    });
    return c;
  }
  // 입찰 화면 (v0.8 §3): 위 길드 3명(머리 위에 각자 호가) · 가운데 구획 카드 크게 + 예상 가치 · 이익 막대 · [올리기 +10%] [포기]
  const gw = Math.floor((w - 16 - 8) / 3);
  const room = h - (32 + 20 + 42 + 56 + 42) - (L.portrait ? 0 : 42);           // 길드 그림에 남는 높이 (나머지가 안 겹치게)
  const fs = Math.max(1, Math.min(2, Math.floor(((gw - 4) / 32) * 2) / 2, Math.floor((room / 40) * 2) / 2));
  const figH = Math.round(40 * fs), bubY = 32, gy = bubY + 20 + figH;
  const cx = (i) => 8 + i * (gw + 4) + gw / 2;
  B.guilds.forEach((g, i) => {
    const gc = guildCard(i, gw, AU.holder === i); gc.position.set(8 + i * (gw + 4), gy); c.addChild(gc);
    const say = AU.say[i], age = say ? time - say.t : 99;
    const fig = new Sprite(tex(GUILD_SPR[i])); fig.anchor.set(0.5, 1); const gs = (fs * 40) / fig.texture.height; fig.scale.set(gs);   // 64×80 원본을 40칸 높이로
    let fx0 = 0, fy0 = 0;
    if (say && !say.pass && !say.line && age >= 0 && age < 0.5) { fx0 = Math.round(Math.sin(age * 70) * 1.5); fy0 = -Math.round(Math.abs(Math.sin(age * 12)) * 3); }
    if (say?.pass && age >= 0 && age < 0.5 && Math.floor(age / 0.12) % 2 === 1) fig.scale.x = -gs;
    if (AU.out[i] && !(say?.pass && age < 0.5)) fig.tint = 0x8a8a8a;
    const winBounce = AU.phase === 'lost' && AU.holder === i ? -Math.round(Math.abs(Math.sin((time - AU.endAt) * 8)) * 3) : 0;
    fig.position.set(Math.round(cx(i) + fx0), gy + 12 + fy0 + winBounce);
    c.addChild(fig);
    // 머리 위 호가 숫자
    const bid = AU.bids[i];
    const nl = label(AU.out[i] ? '포기' : bid ? String(bid) : '—', { small: true, color: AU.holder === i ? COLOR.gold : AU.out[i] ? 0x8a7a68 : COLOR.paperInk, shadow: AU.holder === i });
    nl.position.set(Math.round(cx(i) - nl.width / 2), gy + 12 - figH - 11); c.addChild(nl);
  });
  // 말풍선: 가장 최근 대사만 (잠깐)
  const shown = AU.say.map((q, i) => ({ q, i })).filter(({ q }) => q && time >= q.t && time - q.t < 2.2 && !q.old);
  const latest = shown.reduce((m, e) => (!m || e.q.t > m.q.t ? e : m), null);
  if (latest) {
    const { q, i } = latest;
    const bt = label(q.text, { small: true, color: q.pass ? 0x8a7a68 : 0x5c3832, shadow: false, wrap: Math.min(w - 24, gw * 2) });
    const bw = Math.ceil(bt.width) + 8, bh = Math.ceil(bt.height) + 4;
    const bub = new Container(); bub.addChild(frame('paper', bw, bh, 'panel'), bt); bt.position.set(4, 1);
    const tx = Math.max(8, Math.min(w - 8 - bw, Math.round(cx(i) - bw / 2)));
    bub.addChild(new Graphics().poly([cx(i) - tx - 3, bh - 1, cx(i) - tx + 3, bh - 1, cx(i) - tx, bh + 4]).fill(0xf4ecd2));
    bub.position.set(tx, bubY); c.addChild(bub);
  }
  // 구획 카드 크게 + 이익 막대
  const ky = gy + 42;
  const k = makePlotCard(AU.card, w - 16, 52, true); k.position.set(8, ky); c.addChild(k);
  const val = cardValue(AU.card), margin = (val.mid - AU.high) / val.mid;
  const by0 = ky + 56;
  const hl = label(`현재가 ${AU.high}${AU.holder === 'me' ? ' (나)' : typeof AU.holder === 'number' ? ` (${B.guilds[AU.holder].name.split(' ')[0]})` : ''}`, { color: COLOR.paperInk, shadow: false, small: w < 260 }); hl.position.set(8, by0 + (w < 260 ? 2 : 0)); c.addChild(hl);
  const ml = label(margin >= 0 ? `여유 +${Math.round(val.mid - AU.high)}` : `손해 ${Math.round(val.mid - AU.high)}`, { small: true, color: margin >= B.auction.profitOk ? 0x46702e : margin >= 0 ? 0x8a5a24 : 0xb84a62, shadow: false });
  ml.position.set(w - 8 - Math.ceil(ml.width), by0 + 2); c.addChild(ml);
  const barW = w - 16, bar = new Graphics();
  bar.rect(8, by0 + 15, barW, 6).fill(0x3a2a22);
  const fillW = Math.max(0, Math.min(1, margin)) * barW;
  bar.rect(8, by0 + 15, fillW, 6).fill(margin >= B.auction.profitOk ? 0x6a9a3a : margin >= 0 ? 0xd39a3a : 0xb84a62);
  if (margin < 0) bar.rect(8, by0 + 15, barW, 6).fill({ color: 0xb84a62, alpha: 0.45 });
  c.addChild(bar);
  const cap = label(`예상 가치 ${val.lo}~${val.hi} · 내 금화 ${S.gold}`, { small: true, color: 0x8a7a68, shadow: false }); cap.position.set(8, by0 + 23); c.addChild(cap);
  // 망치 카운트 · 낙찰 도장
  if (AU.phase === 'count') {
    const n = Math.max(1, Math.ceil((AU.count / B.auction.hammerSeconds) * 3));
    const cl = label(`${n}`, { color: 0xb84a62, shadow: false }); cl.scale.set(3); cl.position.set(Math.round(w / 2 - cl.width / 2), ky + 2); c.addChild(cl);
  }
  if ((AU.phase === 'won' || AU.phase === 'lost') && AU.endAt != null) {
    const age = time - AU.endAt, won = AU.phase === 'won', who = won ? '나' : typeof AU.holder === 'number' ? B.guilds[AU.holder].name.split(' ')[0] : null;
    if (who) {
      const st = new Container(); st.position.set(w - 44, ky + 26);
      const g = new Graphics().circle(0, 0, 18).stroke({ width: 2, color: 0xb84a62 }).circle(0, 0, 14).stroke({ width: 1, color: 0xb84a62 });
      const tl = label('낙찰', { color: 0xb84a62, shadow: false }); tl.position.set(-Math.round(tl.width / 2), -10);
      const wl = label(who, { small: true, color: 0xb84a62, shadow: false }); wl.position.set(-Math.round(wl.width / 2), 3); if (wl.width > 30) wl.scale.set(30 / wl.width), wl.x = -15;
      st.addChild(g, tl, wl); st.rotation = -0.25;
      const p = Math.min(1, age / 0.18); st.scale.set(2.2 - 1.2 * p); st.alpha = p;
      c.addChild(st);
      const hm = new Container(); hm.position.set(w - 18, ky + 6);
      hm.addChild(new Graphics().rect(-1, 0, 3, 22).fill(0x8a5a24).rect(-8, -6, 17, 8).fill(0x5a3a2a).rect(-8, -6, 17, 2).fill(0x8a6c52));
      hm.rotation = age < 0.12 ? -1.1 + age * 9 : age < 0.5 ? 0 : -0.5; c.addChild(hm);
    }
  }
  const status = auctionStatus();
  const sy = h - 26;
  if (!L.portrait) {                                              // 가로 화면: 버튼도 카드 안 (세로 폰은 아래 시트)
    const sl = label(status, { small: true, color: 0x8a5a24, shadow: false }); sl.position.set(8, sy - 14); c.addChild(sl);
    bidButtons(c, 8, sy, w - 16, 20);
  }                                                               // 세로 폰: 상태 문구·버튼은 아래 시트
  return c;
}
const GUILD_SPR = ['npc_guild_abyss', 'npc_guild_tower', 'npc_guild_shield'];
const GUILD_COLOR = [0x3d5a9a, 0x8a5a24, 0x7a2e48];
function auctionStatus() {
  if (AU.phase === 'count') return '아무도 안 따라와요… 망치가 내려가요!';
  if (AU.phase === 'won') return `낙찰! ${AU.high} 금화`;
  if (AU.phase === 'lost') return '놓쳤어요… 공짜 자투리 구획으로 가요';
  if (AU.holder === 'me') return '길드들이 생각 중…';
  if (typeof AU.holder === 'number') return `${B.guilds[AU.holder].name.split(' ')[0]}이(가) 따라왔어요. 더 올릴까요?`;
  return '[올리기]를 누르면 길드가 따라와요. 아무도 안 따라오면 낙찰';
}
/** [올리기 +10% → N] [포기] */
function bidButtons(c, x, y, w, h) {
  const can = AU.phase === 'bid' && AU.holder !== 'me', next = AU.card ? nextBid() : 0, broke = next > S.gold;
  const bw = Math.floor((w - 4) * 0.66);
  const up = button('wood', bw, h, broke && can ? '금화 부족' : AU.holder == null ? `입찰 ${next}` : `올리기 +10% → ${next}`, playerRaise, { small: h < 22 || bw < 150 });
  up.setDisabled(!can || broke); up.position.set(x, y); c.addChild(up);
  const fd = button('stone', w - bw - 4, h, '포기', playerFold, { small: h < 22 });
  fd.setDisabled(!can); fd.position.set(x + bw + 4, y); c.addChild(fd);
}
/** 세로 폰: 아래 시트 = 호가 버튼 (명세3 §5) */
function makeBidPanel(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const t = label(auctionStatus(), { ...ink, small: true, color: 0x8a5a24, wrap: w - 16 }); t.position.set(8, 6); c.addChild(t);
  const g = label(`현재가 ${AU.high} · 가진 금화 ${S.gold}`, { ...ink, small: true, color: 0x8a7a68 }); g.position.set(8, 8 + Math.ceil(t.height)); c.addChild(g);
  const bh = Math.max(22, Math.min(40, h - 40 - Math.ceil(t.height)));
  bidButtons(c, 8, h - bh - 8, w - 16, bh);
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
  if (!card.free && !card.tutorial && h >= 50) {                  // v0.8 §3-1: 예상 가치 (특성 「탐사 4」면 범위 좁게)
    const v = cardValue(card);
    const rg = label(`예상 가치 ${v.lo}~${v.hi}금`, { small: true, color: 0x9cc45a }); rg.position.set(6, 32); c.addChild(rg);
    if (!flat) { const m = (v.mid - card.price) / v.mid; const pb = new Graphics().rect(6, 44, 60, 3).fill(0x3a2a22).rect(6, 44, Math.max(0, Math.min(1, m)) * 60, 3).fill(m >= B.auction.profitOk ? 0x6a9a3a : m >= 0 ? 0xd39a3a : 0xb84a62); c.addChild(pb); }
  }
  const price = label(`시작가 ${card.price}`, { small: true, color: COLOR.gold });
  price.position.set(6, h - 14); if (h >= 50 && !flat) c.addChild(price); else price.destroy();   // 입찰 화면은 현재가를 따로 보여 줌
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
  const sk = button('wood', 50, 16, tutOn() ? '탐사 끝' : '시추 시작', () => { if (tutOn() && !S.tutorial.sniffed) return; toolArmed = null; startDig(); }, { small: true }); sk.position.set(w - 54, 3); c.addChild(sk); ui.refs.surveyEnd = sk;
  if (!tutOn()) toolButtons(c, w - 58, 3);
  return c;
}
const u0 = (v) => Math.round(v / L.uiS);
/** 세로 폰: 격자 오른쪽 얇은 스크롤 막대 + 위/아래 화살표 (탭하면 6줄씩) */
function makeScrollBar() {
  const c = new Container();
  const x = u0(L.vis.x1) - 14, y0 = u0(L.vis.y0) + 46, y1 = u0(L.vis.y1) - 30;
  const up = button('stone', 12, 14, '▲', () => scrollRows(-6), { small: true }); up.position.set(x, y0 - 16); c.addChild(up);
  const dn = button('stone', 12, 14, '▼', () => scrollRows(6), { small: true }); dn.position.set(x, y1 + 2); c.addChild(dn);
  const track = new Graphics().rect(x + 5, y0, 2, y1 - y0).fill({ color: 0xf4ecd2, alpha: 0.25 }); c.addChild(track);
  const knob = new Graphics(); c.addChild(knob);
  ui.scrollKnob = { g: knob, x: x + 4, y0, h: y1 - y0 };
  ui.overlayRect2 = { x: x * L.uiS, y: (y0 - 16) * L.uiS, w: 14 * L.uiS, h: (y1 - y0 + 34) * L.uiS };
  return c;
}
/** [진동 n] [투시 n] — 오른쪽 끝 xr에서 왼쪽으로. 남은 게 없으면 안 그림. 왼쪽 끝 x를 돌려줌 */
function toolButtons(c, xr, y) {
  const rd = S.round;
  for (const [k, name, n] of [['xray', '투시', rd.xrayLeft], ['vibro', '진동', rd.vibroLeft]]) {
    if (!(n > 0)) continue;
    const bt = button(toolArmed === k ? 'wood' : 'paper', 40, 16, `${name} ${n}`, () => armTool(k), { small: true });
    xr -= 42; bt.position.set(xr, y); c.addChild(bt); ui.refs[k] = bt;
  }
  return xr;
}
function makeDigBar(x, y, w) {
  const c = new Container(); c.position.set(x, y);
  const b = button('stone', 44, 16, '철수', () => askRetreat(), { small: true }); b.position.set(w - 48, 0); c.addChild(b); ui.refs.retreat = b;
  let bw = 48;
  if (W?.water.some((r) => r.some(Boolean)) && !(S.round.pumpLeft > 0)) {
    const pmp = button('paper', 56, 16, CF.pumpCost ? `펌프 ${CF.pumpCost}` : '펌프', pump, { small: true }); pmp.position.set(w - 108, 0); c.addChild(pmp); bw = 108;
  }
  if (!tutOn()) bw = w - toolButtons(c, w - bw - 4, 0) + 4;                 // 시추 중에도 남은 도구 (명세5 §1)
  if (S.stats.rounds < DIG_LINE_ROUNDS || tutOn()) { const hl = label(DIG_LINE, { small: true, wrap: Math.max(60, w - bw - 6) }); hl.position.set(2, 2); c.addChild(hl); }   // §6 고정 안내줄 (3라운드까지)
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
  if (rd.card.gift) line('구획', '할아범 선물', 0x46702e); else line('낙찰가', `−${rd.bid}`, 0xb84a62);
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
  const b = button('wood', 80, 20, '다음 경매', nextAuction); ui.refs.next = b;
  b.position.set(w - 88, h - 26); c.addChild(b);
  if (!rd.card.tutorial && SHOW_COMPANY) { const co = button('paper', 56, 20, '회사로', openCompany); co.position.set(w - 148, h - 26); c.addChild(co); }
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
  const yes = button('wood', 60, 18, '철수', () => endRound('retreat'), { small: true }); yes.position.set(ww - 68, hh - 24); c.addChild(yes); ui.refs.retreatYes = yes;
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
  sw.position.set(w - 44, 4); c.addChild(sw); ui.refs.buyerSwap = sw;
  if (!CF.preview) {                                               // 광고 자리 (명세3 §7 — SDK 없음)
    const wideAd = !L.portrait;                                    // PC: 판매 창 아래쪽 넓은 자리
    const ad = button('stone', wideAd ? w - 8 : 38, wideAd ? 14 : 10, wideAd ? '광고 보고 시세 1분 미리보기' : '광고 1분', () => toast('곧 열려요'), { small: true });
    ad.alpha = 0.65; ad.position.set(wideAd ? 4 : w - 86, wideAd ? h - 54 : 2);
    if (wideAd || fx0 + nm.width < w - 90) c.addChild(ad); else ad.destroy();   // 좁으면 이름과 안 겹칠 때만
  }
  if (CF.smeltSlots) {
    const tg = button(sellMode === 'ingot' ? 'wood' : 'paper', 28, 16, sellMode === 'ingot' ? '광석' : '괴', () => { sellMode = sellMode === 'ingot' ? 'ore' : 'ingot'; sfx('stash', true); buildUI(); }, { small: true });
    tg.position.set(4, w - 112 < 64 ? h - 36 : h - 18); c.addChild(tg);
  } else sellMode = 'ore';
  if (CF.freeze && sellMode === 'ore') {                         // 장사 특성 5: 하루 1회 시세 고정 60초
    const used = S.talents.freezeDay === S.day, live = market.frozen && mNow() < market.frozen.until;
    const fz = button(live ? 'wood' : 'paper', 28, 15, live ? '고정중' : '고정', () => { if (used) return; market.freeze(mNow(), B.talents.freezeSeconds); S.talents.freezeDay = S.day; toast(`시세를 ${B.talents.freezeSeconds}초 고정했어요`, 'brok'); sfx('bell'); buildUI(); }, { small: true });
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
    [() => (online() ? '로그아웃' : '로그인'), () => (online() ? doLogout() : openLoginForm())],
    ['랭킹', () => openRank()],
    ['전체 화면', () => document.documentElement.requestFullscreen?.().catch(() => {})],
    ['설명서', () => { manualView = { key: MANUAL[0].key }; buildUI(); }],
    ['튜토리얼 다시', replayTutorial],
    ['처음부터', () => { if (confirm('저장을 지우고 처음부터 시작할까요?')) { saving = false; resetSave(); location.reload(); } }],
  ].filter((it, i) => S.tutorial.done || i === 0);
  // 음악 · 효과음 슬라이더 (끌거나 톡)
  let sy0 = 0;
  for (const [key, name] of [['bgm', '음악'], ['sfx', '효과음']]) {
    const row = new Container(); row.y = sy0; c.addChild(row);
    const l = label(name, { small: true, color: COLOR.paper }); l.position.set(0, 2); row.addChild(l);
    const x0 = 40, bwid = Math.max(40, w - x0 - 30);
    const bar = new Graphics(); row.addChild(bar);
    const pct = label('', { small: true, color: COLOR.dim }); pct.position.set(x0 + bwid + 4, 2); row.addChild(pct);
    const draw = () => { const v = volumes()[key]; bar.clear().rect(x0, 5, bwid, 4).fill(0x3a2a22).rect(x0, 5, bwid * v, 4).fill(0xd39a3a).rect(x0 + bwid * v - 2, 2, 4, 10).fill(0xf5cf6a); pct.text = `${Math.round(v * 100)}`; };
    draw();
    const hitA = new Graphics().rect(x0 - 4, 0, bwid + 8, 14).fill({ color: 0, alpha: 0.001 }); row.addChild(hitA);
    hitA.eventMode = 'static'; hitA.cursor = 'pointer';
    let dragging = false;
    const setAt = (e) => { const p = row.toLocal(e.global); const v = Math.max(0, Math.min(1, (p.x - x0) / bwid)); setVolumes({ [key]: Math.round(v * 20) / 20 }); S.settings[key === 'bgm' ? 'bgmVol' : 'sfxVol'] = volumes()[key]; S.settings.sound = true; draw(); };
    hitA.on('pointerdown', (e) => { unlockAudio(); dragging = true; setAt(e); });
    hitA.on('globalpointermove', (e) => { if (dragging) setAt(e); });
    hitA.on('pointerup', () => { dragging = false; save(); if (key === 'sfx') sfx('ui_tap'); }); hitA.on('pointerupoutside', () => { dragging = false; save(); });
    sy0 += 16;
  }
  const cols = Math.max(2, Math.min(3, Math.floor((w + 4) / 70))), bw = Math.floor((w - (cols - 1) * 4) / cols), bh = 16;
  items.forEach(([text, fn], i) => {
    const b = button('stone', bw, bh, typeof text === 'function' ? text() : text, () => { fn(); if (typeof text === 'function') b.setText(text()); }, { small: true });
    b.position.set((i % cols) * (bw + 4), sy0 + Math.floor(i / cols) * (bh + 4));
    c.addChild(b);
  });
  const fps = label('', { small: true, color: 0x9cc45a }); fps.position.set(0, sy0 + Math.ceil(items.length / cols) * (bh + 4) + 2);
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
    const up = surge && mNow() >= market.surge.start ? 1 : market.last[key];
    r.arrow.texture = kit(up < 0 ? 'arrow_down' : 'arrow_up'); r.arrow.visible = up !== 0;
    r.btn.setDisabled(stash[key] === 0);
    r.bg.clear(); if (surge) r.bg.rect(0, 0, r.w - 33, 12).fill({ color: 0x9cc45a, alpha: 0.18 + 0.18 * Math.sin(time * 8) });
    else if (idleHi.has(key) && time < idleHiUntil) r.bg.rect(0, 0, r.w - 33, 12).fill({ color: 0xf5cf6a, alpha: 0.35 });
    r.price.tint = surge && mNow() >= market.surge.start ? 0x46702e : 0xffffff;
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
  const gain = n * priceOf(key);
  sfx('coin');
  const r = ui.rows[key];
  const from = r ? r.btn.getGlobalPosition() : { x: L.W / 2, y: L.H / 2 };
  S.gold += gain; if (S.round) S.round.stats.revenue += gain;
  flyNumber('coin', from.x + 15 * L.uiS, from.y, gain, () => { refreshUI(); bumpCounter('coin'); });
  if (market.surge?.key === key && mNow() >= market.surge.start && mNow() < market.surge.end) count('surgeSells');
  if (key === 'g' && tutOn()) { S.tutorial.goldSold = true; if (buyer() === 'merchant') S.tutorial.merchantGold = true; }
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
  sfx('cart_dump', true);
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
  tip('surge'); sfx('letter');
  const o = ORES.find((q) => q.key === key), who = B.buyers[buyerOf(key)].name;
  toast(`오늘 저녁 ${who}이(가) ${o.name}을(를) 비싸게 산대요! (${warn}초 뒤)`, 'momo', 5);
  sfx('bell');
};
market.onSurge = (key) => { const o = ORES.find((q) => q.key === key); toast(`지금 ${o.name} 시세 ×${B.surgeMul}! 40초 동안`, 'momo', 3); sfx('surge'); };

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
const digSeconds = (t) => (ORE_KEYS.has(t) ? B.digTime.ore : t === 'd' ? CF.dirt : (B.digTime[t] ?? 1)) / CF.pickSpeed;
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
  S.round.cartCargos = carts.map((c) => ({ ...c.cargo }));
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
    } else sfx('vein_found'), toast(`광맥 발견! ${ORES.find((o) => o.key === v.type)?.name ?? ''} ${v.size}칸 — 광부들이 다 캘게요`);
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
  setTimeout(() => { tileTips(gx, gy); syncWallLamps(); }, 0);
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
  sfx(t === 'd' ? 'pick_dirt' : ORE_KEYS.has(t) ? 'pick_ore' : 'pick_rock', true);
  const cols = DEBRIS[t] ?? DEBRIS.d;
  for (let i = 0; i < 8; i++)
    particle(dustA, { x: x0 + Math.random() * T, y: y0 + Math.random() * T, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.6 + Math.random() * 0.4, color: cols[i % cols.length], solid: true, fade: false, size: Math.random() < 0.4 ? 1 : 0.5 });
  if (ORE_KEYS.has(t)) {
    fx(t === 'c' ? 'fx_vein_glow' : 'fx_vein', x0 + 8, y0 + 8);
    const near = liveCarts().find((c) => c.mode === 'park' && loadOf(c) < CF.cartLoad && typeof c.node === 'number' && (c.node === from || c.node === idx(gx, gy) || (Math.abs(cxy(c.node)[0] - gx) + Math.abs(cxy(c.node)[1] - gy)) <= 1));
    if (near) { near.cargo[t]++; near.idleT = 0; }                  // v0.8: 갱도 끝까지 들어온 광차가 바로 받음
    else { const p = piles.find((q) => q.gx === gx && q.gy === gy && q.type === t); if (p) p.n++; else piles.push({ gx, gy, type: t, n: 1 }); }
  } else fx(t === 'd' ? 'fx_dirt' : 'fx_rock', x0 + 8, y0 + 8);
  if (t === 'R') {                                          // 유물 상자: 금화 + 도감
    const gold = Math.round(B.relicGold[0] + Math.random() * (B.relicGold[1] - B.relicGold[0]));
    S.round.stats.relics++; count('relics'); S.round.stats.relicGold += gold; S.stats.relics.push({ day: S.day, gold });
    const [sx, sy] = toScreen(x0 + 8, y0 + 4);
    S.gold += gold;
    flyNumber('coin', sx, sy, gold, () => { refreshUI(); bumpCounter('coin'); });
    toast(`유물 상자! 금화 ${gold}`, 'halabeoji'); sfx('coin_big');
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
    sfx('water'); logEvent('water');
    toast(`지하수가 터졌어요! 물 칸은 걸음이 느려지고 광차가 못 지나가요 — ${CF.autoPump ? '펌프실이 곧 퍼내요' : `[펌프 ${CF.pumpCost}]`}`, 'momo', 4); tip('water');
    if (CF.autoPump && !(rd.pumpLeft > 0)) setTimeout(() => { if (S.round === rd && !(rd.pumpLeft > 0)) pump(true); }, 1500);
    buildUI();
  }
  if (t === 'x') {                                           // 가스: 30초 채굴 정지 · 랜턴 불꽃이 닿으면 폭발
    rd.gasLeft = B.gasSeconds; rd.gasCell = [gx, gy];
    fx('fx_gas', cellX(gx), GY + gy * T + 8); logEvent('gas');
    for (const a of crew) emote(a, '콜록콜록', 2);
    sfx('gas'); toast(`가스가 새어 나와요! ${B.gasSeconds}초 쉬어 가요 (랜턴 불꽃은 멀리…)`, 'momo', 4); tip('gas');
  }
  if (t === 'o' && rd.card.floor === 2 && Math.random() < B.abandoned.batChance) {   // 폐광: 박쥐떼 — 가까운 광부 기절 (포탑 2등급↑이면 쏨)
    const A = B.abandoned;
    logEvent('bats');
    for (let i = 0; i < 14; i++) particle(sparksU, { x: cellX(gx), y: GY + gy * T + 8, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 60, life: 0.9 + Math.random() * 0.5, color: 0x2a2634, g: -10, size: 1 });
    sfx('bat');
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
    } else { sfx('slime'); toast('동굴에서 슬라임이 나왔어요! 광차가 지나가지 못해요', 'momo', 3); }
  }
};
function pump(auto = false) {
  const cost = auto ? 0 : CF.pumpCost;
  if (S.gold < cost) { toast('금화가 모자라요'); return; }
  S.gold -= cost; refreshUI(); sfx('pump');
  S.round.pumpLeft = B.pumpSeconds; toast(`${auto ? '펌프실 자동 펌프' : '펌프'} 가동! ${B.pumpSeconds}초 뒤 물이 빠져요`);
  buildUI();
}
function explode(gx, gy) {                                   // 랜턴 불꽃 + 가스 = 폭발: 3×3 흙·바위가 뚫림 + 근처 광부 체력 −1
  const rd = S.round;
  rd.gasLeft = 0; rd.gasCell = null; logEvent('boom');
  flash = 0.8; shake = 0.5; shakeAmp = 4; sfx('boom');
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
  redig(Array.from({ length: len }, (_, k) => [x0 + k, y0]));
  drawEdges(); drawSolid(); drawProps(); syncRound();
  fx('fx_collapse', cellX(x0) + (len - 1) * T / 2, GY + y0 * T + 6);
  shake = 0.3; shakeAmp = 2; sfx('collapse');
  logEvent('collapse');
  toast('갱도 천장이 무너졌어요! 광부들이 다시 뚫어요', 'halabeoji', 3);
  return true;
}
function updateEvents(dt) {
  const rd = S.round;
  if (!rd || rd.state !== 'DIG' || tutOn()) return;            // 튜토리얼: 사건·자동 끝 없음 ([철수]로 끝냄)
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

// ---- 시추 (명세5 §2): 지상 탭 → 갱도 입구 · 광부가 알아서 아래로 · [◀][▶] 한 칸 꺾기(그다음 다시 아래) · [▼] 아래로
// 광맥에 닿으면 덩어리 통째로 캐고 그 갱도는 기다림("다음 어디?") · 못 뚫는 칸이면 멈춤 · 붕괴는 광부가 다시 뚫음
const cellAtWorld = (wx, wy) => [Math.floor((wx - GX) / T), Math.floor((wy - GY) / T)];
const inGrid = (gx, gy) => !!W && gx >= 0 && gx < GW && gy >= 0 && gy < W.rows;
const shaftMax = () => CF.shafts;
const shaftNext = (s) => (s.dir === 'left' ? [s.hx - 1, s.hy] : s.dir === 'right' ? [s.hx + 1, s.hy] : [s.hx, s.hy + 1]);
const nearOre = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ORE_KEYS.has(W.g[y + dy]?.[x + dx]));
const shaftsG = new Graphics(), shaftHeadG = new Graphics();
markU.addChild(shaftsG, shaftHeadG);
const shaftUI = new Container(); worldUI.addChild(shaftUI);
let shaftBtns = {}, shaftHits = [], shaftKey = '';
function openShaft(gx) {
  const rd = S.round;
  if (!rd || rd.state !== 'DIG' || !inGrid(gx, 0)) return false;
  rd.shafts ??= [];
  const st = tutStep();
  if (st && (st.shaftX == null || gx !== st.shaftX)) { tutShake(); return false; }   // 튜토리얼: 안내한 열만
  if (rd.shafts.some((q) => q.x === gx)) { toast('여긴 이미 입구가 있어요'); return false; }
  if (rd.shafts.length >= shaftMax()) { toast(`갱도 입구는 ${shaftMax()}개까지예요${shaftMax() < 3 ? ' · 광차 차고 Lv3이면 3개' : ''}`); sfx('pass', true); return false; }
  rd.shaftN = (rd.shaftN ?? 0) + 1;
  rd.shafts.push({ id: rd.shaftN, x: gx, hx: gx, hy: -1, dir: 'down', side: 0, blocked: null, stopY: st?.stopY ?? null });
  sfx('build'); fx('fx_dirt', cellX(gx), GY - 2);
  drawShafts(); shaftTick(); syncRound();
  return true;
}
/** 방향 버튼: ◀▶ = 그쪽으로 한 칸 (누를 때마다 한 칸 더) 뒤 다시 아래 · ▼ = 아래로 */
function turnShaft(id, d) {
  const rd = S.round, s = rd?.shafts?.find((q) => q.id === id); if (!s) return;
  if (d === 'down') { s.dir = 'down'; s.side = 0; }
  else { if (s.hy < 0) return; s.side = s.dir === d ? s.side + 1 : 1; s.dir = d; }
  s.blocked = null; s.askT = null;
  for (const a of crew) if (a.job?.shaft === id && (a.job.x !== shaftNext(s)[0] || a.job.y !== shaftNext(s)[1])) { a.job = null; a.path = []; }
  rd.jobs = rd.jobs.filter((j) => j.shaft !== id || crew.some((a) => a.job === j));
  sfx('ui_tap');
  shaftTick(); syncRound();
}
function shaftTick() {
  const rd = S.round; if (!rd?.shafts?.length || rd.state !== 'DIG' || !W) return;
  let changed = false;
  for (const s of rd.shafts) {
    for (let guard = 0; guard < 6 && s.dir !== 'wait'; guard++) {   // 다음 칸이 뚫렸으면 머리를 옮김
      const [nx, ny] = shaftNext(s);
      if (!inGrid(nx, ny)) { s.dir = 'wait'; s.side = 0; changed = true; break; }
      if (!isDug(nx, ny)) break;
      s.hx = nx; s.hy = ny; changed = true;
      if (s.dir !== 'down' && --s.side <= 0) { s.side = 0; s.dir = 'down'; }
      if (nearOre(nx, ny) || (s.stopY != null && ny >= s.stopY)) { s.dir = 'wait'; s.side = 0; s.stopY = null; }
    }
    if (s.dir === 'wait' || rd.jobs.some((j) => j.shaft === s.id)) continue;
    const [nx, ny] = shaftNext(s), t = W.g[ny][nx];
    if (ORE_KEYS.has(t)) { claimVeinsNear(s.hx, s.hy); s.dir = 'wait'; s.side = 0; changed = true; continue; }
    if (!canDig(t)) {
      s.blocked = t; s.dir = 'wait'; s.side = 0; changed = true;
      sfx('clink', true); toast(t === 'a' ? '고대석이에요. 곡괭이 3등급이 필요해요' : '단단한 바위예요. 곡괭이 2등급이 필요해요 — [◀][▶]로 돌아가도 돼요', 'momo', 3);
      continue;
    }
    rd.jobs.push({ x: nx, y: ny, from: s.hy < 0 ? 'S' : idx(s.hx, s.hy), ladder: s.dir === 'down', prev: s.hy < 0 ? 'S' : [s.hx, s.hy], shaft: s.id });
  }
  // 기다리는 갱도: 광맥을 다 캤으면 "다음 어디?"
  if (!rd.jobs.some((j) => j.vein != null)) rd.shafts.forEach((s, i) => {
    if (s.dir !== 'wait' || s.blocked || (s.askT != null && time - s.askT < 9)) return;
    s.askT = time; const a = crew[i % CF.diggers]; if (a && !tutOn()) emote(a, '다음 어디?', 2.5);
  });
  if (changed) { drawShafts(); syncRound(); }
}
/** 입구(나무 드릴탑) — 칸이 바뀔 때만 */
function drawShafts() {
  const g = shaftsG; g.clear();
  for (const s of S.round?.shafts ?? []) {
    const cx = cellX(s.x), y0 = GY;
    g.moveTo(cx - 7, y0).lineTo(cx - 1, y0 - 15).moveTo(cx + 7, y0).lineTo(cx + 1, y0 - 15).stroke({ width: 1.5, color: 0x6a4428 });
    g.moveTo(cx - 5, y0 - 5).lineTo(cx + 5, y0 - 5).moveTo(cx - 3, y0 - 10).lineTo(cx + 3, y0 - 10).stroke({ width: 1, color: 0x8a5a34 });
    g.circle(cx, y0 - 15, 2.5).stroke({ width: 1, color: 0xc8a070 }).circle(cx, y0 - 15, 0.8).fill(0xc8a070);
    g.moveTo(cx, y0 - 13).lineTo(cx, y0 - 1).stroke({ width: 0.5, color: 0xd8c8a0, alpha: 0.7 });
  }
}
/** 매 프레임: 머리 칸 테두리 · ◀▶▼ 버튼 자리 */
function drawShaftUI() {
  const rd = S.round, show = !!rd?.shafts?.length && rd.state === 'DIG' && view === 'mine' && !introView;
  shaftHeadG.clear(); shaftHits = [];
  shaftUI.visible = show;
  const key = show ? `${L.uiS}|${L.portrait}|${rd.shafts.map((s) => `${s.id}${s.dir}${s.hy < 0 ? 0 : 1}${s.blocked ?? ''}`).join(',')}` : '';
  if (key !== shaftKey) {
    shaftKey = key; shaftBtns = {};
    shaftUI.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (show) for (const s of rd.shafts) {
      const bs = Math.round((L.portrait ? 56 : 40) / L.uiS);
      const box = new Container(); box.sid = s.id; shaftUI.addChild(box);
      for (const d of s.hy < 0 ? [] : ['left', 'right', 'down']) {
        const on = s.dir === d;
        const b = button(on ? 'wood' : 'stone', bs, bs, d === 'left' ? '◀' : d === 'right' ? '▶' : '▼', () => turnShaft(s.id, d));
        b.alpha = on ? 0.5 : 0.85;
        b.dir = d; box.addChild(b); shaftBtns[`${s.id}:${d}`] = b;
      }
      if (s.blocked) { const l = button('wood', 96, 16, s.blocked === 'a' ? '곡괭이 Lv3 [장비]' : '곡괭이 Lv2 [장비]', openGear, { small: true }); l.isNote = true; box.addChild(l); }
    }
  }
  if (!show) return;
  const half = (toScreen(GX + T, GY)[0] - toScreen(GX, GY)[0]) / 2;
  for (const box of shaftUI.children) {
    const s = rd.shafts.find((q) => q.id === box.sid); if (!s) continue;
    box.scale.set(L.uiS);
    const [cx, cy] = toScreen(cellX(s.hx), GY + s.hy * T + 8);
    for (const b of box.children) {
      if (b.isNote) { const nx = Math.max(2, Math.min(L.W - b.width * L.uiS - 2, cx - b.width * L.uiS / 2)), ny = cy - half - 22 * L.uiS; b.position.set(Math.round(nx / L.uiS), Math.round(ny / L.uiS)); shaftHits.push({ x: nx, y: ny, w: b.width * L.uiS, h: b.height * L.uiS }); continue; }
      const bs = b.width * L.uiS;
      let [x, y] = b.dir === 'left' ? [cx - half - bs - 2, cy - bs / 2] : b.dir === 'right' ? [cx + half + 2, cy - bs / 2] : [cx - bs / 2, cy + half + 2];
      x = Math.max(2, Math.min(L.W - bs - 2, x));                // 가장자리 열이면 화면 안쪽으로
      b.position.set(Math.round(x / L.uiS), Math.round(y / L.uiS));
      shaftHits.push({ x, y, w: bs, h: bs });
    }
    // 다음에 팔 칸: 반짝 테두리 (막혔으면 빨강)
    const [nx, ny] = s.blocked ? shaftNext({ ...s, dir: 'down' }) : shaftNext(s);
    if (s.dir !== 'wait' || s.blocked) {
      const a = 0.45 + 0.35 * Math.sin(time * 6);
      shaftHeadG.rect(GX + nx * T + 0.5, GY + ny * T + 0.5, T - 1, T - 1).stroke({ width: 1, color: s.blocked ? 0xe05050 : 0xfff4b8, alpha: a });
    }
  }
}
/** 붕괴로 메워진 칸 → 광부가 다시 뚫음 */
function redig(cells) {
  const rd = S.round;
  for (const [x, y] of cells) if (!rd.jobs.some((j) => j.x === x && j.y === y)) rd.jobs.unshift({ x, y, from: null, ladder: false, prev: null, redig: true });
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
    if (nodeOf(a) === 'S' && Math.abs(a.x - cellX(x)) > 0.5) { const d = cellX(x) - a.x; a.face = Math.sign(d); a.x += Math.sign(d) * Math.min(Math.abs(d), B.walkSpeed * T * dt); setAnim(a, `${a.id}_walk`); a.state = 'walk'; return; }
    if (S.round.gasLeft > 0) { setAnim(a, `${a.id}_idle`); a.state = 'cough'; return; }
    a.state = 'dig';
    const sx = typeof a.node === 'number' ? cxy(a.node)[0] : x;
    a.face = x > sx ? 1 : x < sx ? -1 : a.face;
    setAnim(a, `${a.id}_swing`);
    a.digT = (a.digT ?? 0) + dt;
    if (a.p.i === 2 && a.lastFrame !== 2) {                // 내리치는 프레임: 스파크 · 파편
      const t = W.g[y][x];
      fx('fx_hit', cellX(x) - a.face * 6, GY + y * T + 8);
      for (let i = 0; i < 3; i++) particle(dustA, { x: cellX(x) - a.face * 6, y: GY + y * T + 8, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 40, life: 0.5, color: (DEBRIS[t] ?? DEBRIS.d)[i % 2], solid: true, fade: false, size: 0.5 });
      sfx(t === 'd' ? 'pick_dirt' : ORE_KEYS.has(t) ? 'pick_ore' : 'pick_rock', true);
    }
    a.lastFrame = a.p.i;
    const need = digSeconds(W.g[y][x]);
    if (a.digT >= need) {
      a.digT = 0;
      rd.jobs = rd.jobs.filter((j) => !(j.x === x && j.y === y));
      const done = a.job;
      breakCell(x, y, nodeOf(a), done);
      if (CF.pickDouble && done.vein != null) {             // 곡괭이 Lv5: 맞닿은 광맥 칸 하나 더
        const j2 = rd.jobs.find((j) => j.vein === done.vein && Math.abs(j.x - x) + Math.abs(j.y - y) === 1 && W.g[j.y][j.x] !== '.' && !crew.some((o) => o.job === j));
        if (j2) { rd.jobs = rd.jobs.filter((j) => j !== j2); breakCell(j2.x, j2.y, nodeOf(a), j2); }
      }
      a.job = null;
    }
    return;
  }
  // 다음 일: 순서대로, 갈 수 있는 첫 칸 — 둘째 선두는 광맥을 반대쪽(목록 끝)부터 · 남이 잡은 칸은 건너뜀
  const mine = crew.indexOf(a) === 0 ? rd.jobs : [...rd.jobs.filter((j) => j.vein == null), ...rd.jobs.filter((j) => j.vein != null).reverse()];
  for (const j of mine) {
    if (W.g[j.y][j.x] === '.') continue;
    if (crew.some((o) => o !== a && o.job === j)) continue;
    if (!canDig(W.g[j.y][j.x])) continue;
    const path = findPath(nodeOf(a), standGoal(j.x, j.y));
    if (path) { a.job = j; a.path = path; a.digT = 0; a.state = 'walk'; return; }
  }
  rd.jobs = rd.jobs.filter((j) => W.g[j.y][j.x] !== '.');
  const sh = rd.shafts?.length ? rd.shafts[crew.indexOf(a) % rd.shafts.length] : null;
  if (sh && sh.hy >= 0 && nodeOf(a) !== idx(sh.hx, sh.hy)) {
    if (!a.homePath?.length && time - (a.homeT ?? -9) > 1) { a.homeT = time; a.homePath = findPath(nodeOf(a), (n) => n === idx(sh.hx, sh.hy)) ?? []; }
    if (a.homePath?.length) { const keep = a.path; a.path = a.homePath; moveAlong(a, dt); a.homePath = a.path; a.path = keep; a.state = 'walk'; return; }
  } else a.homePath = null;
  a.state = 'idle'; setAnim(a, `${a.id}_idle`);
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
    if (cartOpen()) a.waitCart = 0;
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
    a.waitCart = (a.waitCart ?? 0) + dt;                       // 광차 기다림 → 오래 없으면 직접 지상 창고까지 (v0.8)
    if (a.waitCart > B.carrierWalkUp) {
      if (nodeOf(a) === 'S') {
        const d = SHED_X - 6 - a.x; a.face = Math.sign(d) || 1;
        if (Math.abs(d) > 1) { a.x += Math.sign(d) * Math.min(Math.abs(d), B.carrySpeed * T * dt); setAnim(a, a.id + '_walk'); a.state = 'carry'; return; }
        const room = Math.max(0, whCap() - whTotal() - inFlight), put = Math.min(room, a.carrying.n);
        if (put > 0) { orePopup(a.carrying.type, a.x, a.y - 14, put); a.carrying.n -= put; }
        if (!a.carrying.n) { a.carrying = null; a.waitCart = 0; }
        setAnim(a, a.id + '_idle'); return;
      }
      const up = findPath(nodeOf(a), (n) => n === 'S');
      if (up) { a.path = up; return; }
    }
    a.state = 'carry'; setAnim(a, a.id + '_idle');
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
  // v0.8: 캘 게 없고 흩어진 광석이 있으면 광차가 직접 주우러 감 (광차마다 다른 더미)
  if (!S.round?.jobs?.length && piles.length && loadOf(cart) < CF.cartLoad) {
    const mine = piles.filter((p, i) => i % CF.carts === carts.indexOf(cart) % CF.carts);
    const want = new Set((mine.length ? mine : piles).map((p) => idx(p.gx, p.gy)));
    const path = cartPath(cart.node, (n) => want.has(n));
    if (path) return path.length ? path[path.length - 1] : cart.node;
  }
  const red = crew[carts.indexOf(cart) % CF.diggers] ?? crew[0];   // v0.8: 광차마다 선두 한 명씩 따라감
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
      fx('fx_collapse', cart.x, cart.y - 6); sfx('land'); shake = 0.2; shakeAmp = 2;
      for (const k of Object.keys(cart.cargo)) {
        const spill = Math.floor(cart.cargo[k] * B.cartSpill);
        if (spill) { cart.cargo[k] -= spill; piles.push({ gx: cxy(cart.node)[0], gy: cart.fallTo, type: k, n: spill }); }
      }
      toast('광차가 떨어졌어요! 광석이 흩어졌어요 — 광부들이 주워 담아요');
    }
    return;
  }
  if (cart.mode === 'park') {
    if (typeof cart.node === 'number' && loadOf(cart) < CF.cartLoad) {   // 서 있는 칸의 광석 더미를 실음
      const [gx, gy] = cxy(cart.node), p = piles.find((q) => q.gx === gx && q.gy === gy && q.n > 0);
      if (p) { cart.pickT = (cart.pickT ?? 0) + dt; if (cart.pickT > 0.25) { cart.pickT = 0; p.n--; cart.cargo[p.type]++; cart.idleT = 0; sfx('ore', true); piles = piles.filter((q) => q.n > 0); } }
    }
    cart.idleT = load ? cart.idleT + dt : 0;                   // v0.8: 마지막으로 받은 뒤 2초면 지상으로 (idleT 는 받을 때 0)
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
      if (fullNagT <= 0) { fullNagT = 8; for (const a of crew) emote(a, '창고가 꽉 찼어요!', 2); toast('창고가 꽉 찼어요! [판매] 탭에서 팔아요', 'momo'); tip('full'); }
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
  if (tutOn()) return;                                       // 튜토리얼: 낙하 없음
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
  a.fall = { from: gy, to: land, pause: B.fallPause, v: 0 }; if (land - gy >= 1) { tip('fall'); sfx('fall', true); }
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
    fx('fx_dirt', a.x, a.y - 4); sfx(h >= B.stunAt ? 'stun' : 'land', true);
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
  if (!a.hp || tutOn()) return;
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
    if (crew.indexOf(a) < CF.diggers) updateDigger(a, dt); else updateCarrier(a, dt);
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
  carts.forEach((c, i) => { c.visible = i < CF.carts; });
  for (const c of liveCarts()) { cart = c; if (W) updateCart(dt); drawCart(dt); }
  cart = cartA;
}
const pileSprites = [], slimes = [];

// ================================================================ 입력
// 경매·결과 카드와 패널은 UI가 받는다. 탐사 중 투시 랜턴 → 톡한 곳 3×3. 랜턴 끌기.
// 시추 중: 지상(맨 윗줄 위) 톡 = 갱도 입구 · 드래그는 늘 화면 끌기 (명세5 §2·§11)
let drag = null;
const touches = new Map();                                  // 두 손가락이면 늘 화면 끌기
app.canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size >= 2 && drag) {                          // 둘째 손가락: 그리던 것 취소 → 끌기
    drag.mode = 'pan2'; drag.id = e.pointerId; drag.lx = e.clientX; drag.ly = e.clientY;
    return;
  }
  if (inPanels(e.clientX, e.clientY) || shaftHits.some((r) => inRect(r, e.clientX, e.clientY))) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  if (toolArmed && ['SURVEY', 'DIG'].includes(state())) { useToolAt(wx, wy); return; }
  const mode = Math.hypot(wx - lantern.x, wy - (lantern.y + 4)) < 12 ? 'lantern' : 'maybe';
  drag = { id: e.pointerId, mode, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
});
app.canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.lx) / L.sc, dy = (e.clientY - drag.ly) / L.sc;
  drag.lx = e.clientX; drag.ly = e.clientY;
  if (drag.mode === 'maybe' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.mode = 'pan';
  if (drag.mode === 'pan' || drag.mode === 'pan2') { cam.panX -= dx; cam.panY -= dy; clampPan(); }
  if (drag.mode === 'lantern') {
    lantern.x = Math.max(GX + 4, Math.min(WW - GX - 4, lantern.x + dx));
    lantern.y = Math.max(SURFACE_Y - 30, Math.min(WH - 16, lantern.y + dy));
    lantern.vel -= dx * 0.05;
  }
});
window.addEventListener('pointerup', (e) => {
  touches.delete(e.pointerId);
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'maybe' && state() === 'SURVEY') {              // 단서 소품 톡 → 이름 (반은 헛것)
    const [wx, wy] = toWorld(e.clientX, e.clientY), [gx] = cellAtWorld(wx, wy), cl = S.round.clues?.find((q) => q.x === gx);
    if (cl && wy < GY + 4 && wy > SURFACE_Y - 16) { const [, nm, what] = CLUE[cl.kind]; toast(`${nm} — 아래에 ${what}? (단서는 반쯤 헛것)`, 'momo', 2.5); }
  }
  if (drag.mode === 'maybe' && state() === 'DIG') {                 // 톡: 지상 띠(맨 윗줄 포함) → 그 열에 입구
    const [wx, wy] = toWorld(e.clientX, e.clientY), [gx] = cellAtWorld(wx, wy);
    if (wy < GY + T && wy > GY - 48 && gx >= 0 && gx < GW) openShaft(gx);
  }
  drag = null;
});
window.addEventListener('pointercancel', (e) => { touches.delete(e.pointerId); drag = null; });
// 마우스 휠: 격자가 넘칠 때만 위아래
app.canvas.addEventListener('wheel', (e) => { if (!L.overY) return; cam.panY += (e.deltaY / L.sc) * 0.6; clampPan(); e.preventDefault(); }, { passive: false });
/** 스크롤 막대 화살표: 6줄씩 */
const scrollRows = (n) => { cam.panY += n * T; clampPan(); sfx('stash', true); };

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
  if (tutOn()) tutMarket(real);                              // 튜토리얼: 급등 없음 · 구리는 오르는 중
  else { S.marketT += real; market.update(dt, mDay(), mTick(), mNow()); }
  if (ui.scrollKnob && !ui.scrollKnob.g.destroyed) {               // 스크롤 막대 손잡이 위치
    const k = ui.scrollKnob, span = L.overY + 48, frac = Math.max(0, Math.min(1, (cam.panY + 24) / span)), kh = Math.max(12, k.h * 0.3);
    k.g.clear().rect(k.x, k.y0 + frac * (k.h - kh), 4, kh).fill({ color: 0xf5cf6a, alpha: 0.8 });
  }
  ui.coTick?.(real);
  introTick?.(real);
  tutTick(real);
  if (ui.readyBtn && !ui.readyBtn.destroyed) ui.readyBtn.alpha = 0.75 + 0.25 * Math.sin(time * 5);
  if (fpsN % 15 === 0) { updateSmelt(); if (ui.smeltLine && S.smelt.jobs.length) refreshUI(); }
  S.tick += real;
  if (S.tick >= TICK_PER_DAY) { S.tick -= TICK_PER_DAY; S.day++; }
  if (ui.counters?.clock && fpsN === 1) ui.counters.clock.text = clockText(ui.counters.clock.short);
  if (toastT > 0) { toastT -= real; if (toastT <= 0 && ui.toast) ui.toast.visible = false; }
  for (let k = bumps.length - 1; k >= 0; k--) { bumps[k].t -= real; if (bumps[k].t <= 0) { if (!bumps[k].n.destroyed) { bumps[k].n.scale.set(1); bumps[k].n.tint = 0xffffff; } bumps.splice(k, 1); } }

  // 상태별
  const st = state();
  if (st === 'AUCTION') { updateAuction(real); if ((AU.say.some((q) => q && time - q.t < 0.6) || (AU.endAt != null && time - AU.endAt < 0.7 && AU.card) || AU.say.some((q) => q && !q.old && time - q.t > 2.2 && time - q.t < 2.3)) && fpsN % 2 === 0) buildUI(); }
  if (st === 'SURVEY') updateSurvey(dt);
  updateMole(dt);
  updateCrew(dt);
  shaftTick(); drawShaftUI(); drawStakeUI(); if (fpsN % 20 === 0) drawSurvey();
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
  for (const w of wallLamps) { w.s.texture = F.lantern[Math.floor(time * 5 + w.seed) % F.lantern.length]; const f = flick(time, w.seed); w.halo.position.set(w.x, w.y); w.halo.alpha = w.halo.baseAlpha * (1 + 0.15 * f); }
  for (const w of [...wallLamps].sort((p, q) => Math.hypot(p.x - lfx, p.y - lfy) - Math.hypot(q.x - lfx, q.y - lfy)).slice(0, Math.max(0, MAX_LIGHTS - lights.length - 2))) { const f = flick(time, w.seed); addLight(w.x, w.y, 8, 80 * (1 + 0.03 * f), [1.0, 0.78, 0.52], 1.25 * (1 + 0.06 * f)); }   // 가까운 벽 랜턴 (발광·폭발 자리 2개는 남김)
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
  piles = S.round.piles ?? []; seenCells = new Set(S.round.seen ?? []); S.round.jobs ??= []; S.round.claimed ??= []; S.round.shafts ??= []; S.round.stakes ??= []; for (const q of S.round.stakes) if (q.text === '…') q.text = '?';
  (S.round.cartCargos ?? [S.round.cartCargo, S.round.cartCargo2]).forEach((cg, i) => cg && carts[i] && Object.assign(carts[i].cargo, cg));
  buildUI(); if (S.round.state === 'SURVEY') S.round.surveyLeft = Math.max(3, S.round.surveyLeft);
}
booted = true;
bootOnboarding();
initAuth().then(() => { if (online()) afterLogin(); });
if (bootIdle?.midRound) toast(`라운드 이어 하기 — ${S.round.card.name}`, 'momo', 3);

window.__kod = {
  get S() { return S; }, app, step(n = 60) { for (let i = 0; i < n; i++) app.ticker.update(app.ticker.lastTime + 1000 / 60); }, get W() { return W; }, get L() { return L; }, get ui() { return ui; }, AU, cam, lantern, actors, crew, fx, bigVein, tilesA, wA, lights,
  startRound, todayCards, settleOffline, get welcome() { return welcome; }, introNext, showIntro, get introView() { return introView; }, dialogNext, openManual(key = MANUAL[0].key) { manualView = { key }; buildUI(); }, get tut() { return S.tutorial; }, startTutorialRound, openCompany, closeCompany, closeWelcome, movePlacing(kind) { placing = { kind, move: true }; buildUI(); }, refreshCompany, coAction, onSlot, openRank, openLoginForm, pushNow, learnTalent, get market() { return market; }, smeltOne, get sellMode() { return sellMode; }, set sellMode(v) { sellMode = v; }, get CF() { return CF; }, away(sec) { S.idle.lastSeen = Date.now() - sec * 1000; return settleOffline(); }, startDig, upgradeEquip, openGear, vibroAt, xrayAt, armTool, get toolArmed() { return toolArmed; }, openShaft, turnShaft, collapse, get shafts() { return S.round?.shafts; }, get shaftBtns() { return shaftBtns; }, get piles() { return piles; }, B, refreshAround, get cart() { return cart; }, carts, endRound, askRetreat, nextAuction, pickCard, playerRaise, reset() { saving = false; resetSave(); location.reload(); },
  async shot(name, frames = 240) {
    let t = performance.now();
    const url = await new Promise((r) => { for (let i = 0; i < frames; i++) app.ticker.update((t += 33)); shotWaiter = r; app.ticker.update((t += 33)); });
    return (await fetch(`/__shot/${name}`, { method: 'POST', body: url })).text();
  },
};
