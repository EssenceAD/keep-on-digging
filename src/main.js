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
import { COLOR, bar, button, fitText, frame, icon, kit, label, loadUI, portraitFrame, setTextRes, tab } from './ui.js';
import { BUYERS, ORES, buyerOf, createMarket } from './market.js';
import { B } from './balance.js';
import { SAVE_VERSION, loadSave, migrate, resetSave, writeSave } from './save.js';
import { BOARDS, adminMineLetters, adminReply, initAuth, isAdmin, listNotices, login, logout, me, markRepliesRead, myMineReplies, online, pullSave, pushSave, recover, sendLetter, submitRank, topRank, weekKey } from './net.js';
import { PATCH_NOTES } from './patchnotes.js';
import { computeOffline } from './offline.js';
import { cartOfS, ENGINE_BLD, ENGINE_UP, addMine, bottleneck, cartOf, digRate, engineCost, engineFastForward, engineStep, engineText, liveMines, mineFromRound, mineSlots, minersTotal, moveMiner, nextMilestone, pileCapOf, pileOf, whCapOf } from './engine.js';
import { AUCTIONEER, GUILD_LINES, fill, pick } from './text.js';
import { checkDaybook, dayDef, progress, rollDaybook } from './daybook.js';
import { TUT_CARTS, AUCTION_INTRO, AUCTION_LINE, DIG_LINE, DIG_LINE_ROUNDS, INTRO, MANUAL, TILE_TIP, TIPS, TUT_AGAIN, TUT_CARD, TUT_NUDGE_SECONDS, TUT_GOLD_X, TUT_IDLE, TUT_SHAFT_X, TUT_STOP_Y, TUT_TEXT } from './onboard.js';
import { BUILD_UP, UP, UP_KEYS, upCostOf as gearCost, upLv, upText, BUILDINGS, DECOS, YARD, autoPlace, bldMax, lotOf, upCost, lotUser, openLots, spotUser, canUp, companyFx, effectText, ensureCompany, harmonies, lvOf, nameOf, placed, TALENT_TREES, talentLeft, talentPoints, talentSpent, talentRows, hasTalent, talentNextRow } from './company.js';
import { checkUnlocks, isOpen, needText } from './unlocks.js';
import { COLS as GW, ORE_TYPES, findVeins, freeCard, generate, makeCards } from './gen.js';
const ORE_COLOR = { C: 0xb87a4a, s: 0x7c7a92, g: 0xb8862a, j: 0x8a4ab0, c: 0x2fa09a };
import { newSeed } from './rng.js';

TextureSource.defaultOptions.scaleMode = 'nearest';
const VERSION = 'v1.7';

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
const SPRITES = [...GPT_SPRITES, 'pickaxe', ...Object.values(BLD_ART).flatMap((b) => [1, 3, 5].map((l) => `${b}_${l}`)), ...Object.values(DECO_ART).filter((d) => !DECO_ANIM.has(d)), 'dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'gem',
  'ancient', 'pocket_water', 'pocket_gas', 'relic_chest', 'cave', 'ladder', 'mark_x', 'ore_bits', 'star',
  'tunnel', 'tunnel_beam', 'rail', 'side_far', 'side_mid', 'side_fg',
  'sky_far', 'deep_far', 'deep_mid', 'deep_fg', 'bubble_dig', 'bubble_walk', 'bubble_rest',
  'icon_gold', 'icon_glow', 'icon_silver', 'icon_copper', 'icon_gem', 'hint_rock', 'hint_water', 'hint_relic', 'hint_glow',
  'cart_gold', 'cart_empty', 'npc_halabeoji', 'npc_momo', 'npc_brok', 'npc_merchant', 'npc_guild_abyss', 'npc_guild_tower', 'npc_guild_shield'];
const NORMALS = ['dirt_1', 'dirt_2', 'dirt_3', 'rock', 'hard_rock', 'ore_copper', 'ore_gold', 'ore_silver', 'ancient', 'pocket_water', 'pocket_gas', 'relic_chest'];
const FX = ['fx_hit', 'fx_dirt', 'fx_rock', 'fx_vein', 'fx_vein_glow', 'fx_daebak', 'fx_gas', 'fx_water', 'fx_collapse', 'fx_cart', 'fx_pulse'];
const ANIMS = ['ore_glow', 'gold_shimmer', 'lantern', 'red_idle', 'red_walk', 'red_swing', 'brown_swing', 'brown_idle', 'brown_walk',
  'blonde_idle', 'blonde_walk', 'mole_sniff', 'cart_roll', 'cart_roll_empty', 'cart_roll_glow', 'slime', 'deco_fire', 'deco_flag', 'ui_hand', ...FX];
const urls = [
  ...SPRITES.map((n) => A(`sprites/${n}.png`)), ...NORMALS.map((n) => A(`sprites/${n}_n.png`)),
  ...ANIMS.flatMap((n) => [A(`anims/${n}.png`), A(`anims/${n}.json`)]), A('scenes/surface.png'),
];
// 부지 v5 (PATCH_V14): public/art/yard5 — The Fan-tasy Tileset (Free) 기반
const [Y5, Y5A] = await Promise.all([fetch(A('yard5/yard_v5.json')).then((r) => r.json()), fetch(A('yard5/bld/anchors.json')).then((r) => r.json())]);
const Y5_PEOPLE = ['brick', 'tumba', 'elin', 'grun', 'dor', 'fin', 'marta', 'ugle'].map((n) => `miner_${n}`).concat(['halabeoji', 'momo', 'brok', 'merchant', 'guild_abyss', 'guild_tower', 'guild_shield'].map((n) => `npc_${n}`));
const Y5_FILES = [...[0, 1, 2, 3].map((i) => `yard_ground_f${i}.png`), ...[...new Set(Y5.objects.map((o) => o.n))].map((n) => `props/${n}.png`), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `props/campfire_f${i}.png`),
  ...Object.keys(Y5A).filter((n) => !/smoke|lot_site/.test(n)).map((n) => `bld/${n}.png`), 'bld/lot_site_a.png', 'bld/lot_site_b.png', 'bld/lot_site_locked.png', ...[0, 1, 2, 3, 4, 5].map((i) => `bld/smoke_f${i}.png`),
  ...Y5_PEOPLE.flatMap((w) => [`chars/${w}_walk.png`, `chars/${w}_idle.png`]),
  ...['mole_idle', 'mole_walk', 'cart_empty', 'cart_ore', 'cart_gold', 'cart_glow', 'cart_roll', 'cart_roll_ore', 'cart_roll_gold', 'cart_roll_glow'].map((n) => `critters/${n}.png`)];
urls.push(...Y5_FILES.map((f) => A(`yard5/${f}`)));
const [loaded] = await Promise.all([Assets.load(urls), loadUI(BASE)]);
const y5tex = (p) => { const t = loaded[A(`yard5/${p}`)]; if (t) t.source.scaleMode = 'nearest'; return t; };
/** 시간대 곱하기 색 (V14 §4): 바닥·소품·건물·사람 모두 같은 값 */
const Y5_SHADE = { day: 0xffffff, dusk: 0xffc8a0, night: 0x8890c8 };
/** V14 건물 그림: Lv1~2 → _1, Lv3~4 → _3, Lv5 → _5 */
const Y5_BLD = { office: 'office', smelter: 'smelter', warehouse: 'warehouse', cartShed: 'cartshed', lodge: 'lodge', lanternShop: 'lanternshop', pumpRoom: 'pump', turretShop: 'turretshop', moleHouse: 'molehome' };
const y5Step = (lv) => (lv >= 5 ? 5 : lv >= 3 ? 3 : 1);
/** V14 광부 (가로 4프레임 × [오른, 왼, 뒤, 앞], 40×48, 발 (20,41)) — 게임 광부 id → 그림 */
const Y5_MINER = { red: 'brick', brown: 'tumba', blonde: 'elin', grun: 'grun', dor: 'dor', fin: 'fin', marta: 'marta', ugle: 'ugle' };
/** 초상 (V14 §3): 그 인물 _idle 앞모습 0프레임의 위 32px (상반신) */
const faceTex = (who) => { const b = y5tex(`chars/${who}_idle.png`); if (!b) return null; const t = new Texture({ source: b.source, frame: new Rectangle(4, 3 * 48 + 2, 32, 30) }); t.fit = true; return t; };
const TEX_V14 = { ...Object.fromEntries(Y5_PEOPLE.map((n) => [n, faceTex(n)])), cart_empty: y5tex('critters/cart_empty.png'), cart_gold: y5tex('critters/cart_gold.png') };
const tex = (n) => TEX_V14[n] ?? loaded[A(`sprites/${n}.png`)];
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
/** V14: 시트 한 줄 → 프레임 (ay = 발 높이 비율) */
function y5Row(file, row, ms, fw = 40, fh = 48, ay = 41 / 48) {
  const b = y5tex(file), n = Math.round(b.width / fw);
  const out = [...Array(n)].map((_, i) => new Texture({ source: b.source, frame: new Rectangle(i * fw, row * fh, fw, fh) }));
  out.dur = out.map(() => ms); out.ay = ay; return out;
}
/** 게임 광부 id → V14 그림 (옛 red·brown·blonde + 숙소 신입 4) */
const Y5_ACTOR = { red: 'miner_brick', brown: 'miner_tumba', blonde: 'miner_elin', dor: 'miner_dor', fin: 'miner_fin', marta: 'miner_marta', ugle: 'miner_ugle', grun: 'miner_grun' };
for (const [id, nm] of Object.entries(Y5_ACTOR)) { F[`${id}_idle`] = y5Row(`chars/${nm}_idle.png`, 0, 250); F[`${id}_walk`] = y5Row(`chars/${nm}_walk.png`, 0, 125); F[`${id}_swing`] = y5Row(`chars/${nm}_walk.png`, 0, 90); }
F.mole_sniff = y5Row('critters/mole_idle.png', 0, 250, 24, 18, 1); F.mole_walk = y5Row('critters/mole_walk.png', 0, 125, 24, 18, 1);
F.cart_roll_empty = y5Row('critters/cart_roll.png', 0, 100, 28, 22, 1); F.cart_roll = y5Row('critters/cart_roll_ore.png', 0, 100, 28, 22, 1);
F.cart_roll_glow = y5Row('critters/cart_roll_glow.png', 0, 100, 28, 22, 1); F.cart_roll_gold = y5Row('critters/cart_roll_gold.png', 0, 100, 28, 22, 1);
const ICON = { g: 'icon_gold', c: 'icon_glow', s: 'icon_silver', C: 'icon_copper', j: 'icon_gem' };
const NPC = { brok: 'npc_brok', merchant: 'npc_merchant', momo: 'npc_momo', halabeoji: 'npc_halabeoji', guild0: 'npc_guild_abyss', guild1: 'npc_guild_tower', guild2: 'npc_guild_shield', marta: 'miner_marta', dor: 'miner_dor', fin: 'miner_fin' };
const HINT_ICON = { rock: 'hint_rock', water: 'hint_water', relic: 'hint_relic', glow: 'hint_glow' };
const HINT_TEXT = { rock: '바위층', water: '지하수', relic: '유물 흔적', glow: '발광 이끼' };
document.getElementById('loading')?.remove();

/** 애니 재생기: 프레임 길이대로 넘긴다 */
/** 없는 애니(예: blonde_swing)는 같은 광부의 idle → 빨강 광부의 같은 동작으로 대신 (매 프레임 오류 방지) */
const animOf = (name) => F[name] ?? F[name.replace(/_[a-z]+$/, '_idle')] ?? F[name.replace(/^[a-z]+_/, 'red_')] ?? F.red_idle;
const player = (name, loop = true) => ({ name, fr: animOf(name), t: 0, i: 0, loop, done: false });
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
const ANCHOR_X = {};                                       // V14: 새 그림은 가운데 기준
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
  a.s.anchor.set(ANCHOR_X[a.p.name] ?? 0.5, a.p.fr.ay ?? 1);
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
// 광부 3 (브릭 · 툼바 · 엘린 — 명세5 §5) · 두더지 꼬물 · 광차 — 지상에서 시작
const MINERS = [
  { id: 'red', name: '브릭', role: '선두 채굴', color: 0xe8823a, trait: 'hasty', who: '브로크의 동생. 망치 대신 곡괭이' },
  { id: 'brown', name: '툼바', role: '선두 채굴', color: 0xb98a68, trait: 'calm', who: '여관 단골 드워프 먹보' },
  { id: 'blonde', name: '엘린', role: '운반 · 손 랜턴', color: 0xf5cf6a, trait: 'careful', who: '그룬 할아범의 손녀' },
];
const crew = MINERS.map((m, k) => actor({ ...m, anim: `${m.id}_idle`, x: 100 + k * 16, y: SURFACE_Y + 0.5, hp: B.minerHp, state: 'idle', face: 1 }));
/** 숙소 Lv에 맞춰 광부를 늘린다 — 도르 · 핀 · 마르타 · 우글 (명세5 §5). walk = 다리(왼쪽 끝)에서 걸어 들어오며 이름 카드 */
function ensureCrew(walk = false) {
  while (crew.length < CF.miners) {
    const k = crew.length, rc = B.recruits[k - MINERS.length] ?? { name: `광부 ${k + 1}`, trait: ['hasty', 'calm', 'careful', 'diligent'][k % 4], body: k % 2 ? 'brown' : 'blonde', tint: 0xe0e0ff };
    const base = MINERS.find((m) => m.id === rc.body);
    const rid = ['dor', 'fin', 'marta', 'ugle'][k - MINERS.length] ?? base.id;   // V14: 신입마다 자기 그림
    const a = actor({ ...base, id: rid, name: rc.name, role: '운반', trait: rc.trait, who: '숙소에 새로 온 광부', anim: `${rid}_idle`, x: walk ? 2 : 100 + k * 12, y: SURFACE_Y + 0.5, hp: B.minerHp, state: 'idle', face: 1 });
    applyTrait(a); crew.push(a);
    if (walk) { a.walkIn = 100 + k * 12; recruitCard(a); }
  }
}
function applyTrait(a) { const t = B.traits[a.trait] ?? {}; a.digMul = t.dig ?? 1; a.carryMul = t.carry ?? 1; a.stunMul = t.stun ?? 1; a.relicMul = t.relic ?? 1; a.gasImmune = !!t.gasImmune; }
function recruitCard(a) {
  const t = B.traits[a.trait];
  setTimeout(() => { toast(`새 광부 ${a.name}! ${t.name} — ${t.text}`, 'halabeoji', 3.5); sfx('welcome'); emote(a, '안녕하세요!', 2); }, 400);
}
for (const a of crew) applyTrait(a);
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
setVolumes(S.settings.sound === false ? { bgm: 0, sfx: 0 } : { bgm: S.settings.bgmVol ?? 0.35, sfx: S.settings.sfxVol ?? 0.8 });
// 시세 시계 (v0.6 패치 ④): 게임 날짜는 접속 중에만 흐르고, 시세는 현실 시간으로 — 떠나 있던 동안도 빨리감기
S.marketT ??= now();
const mNow = () => S.marketT;
const mDay = () => Math.floor(S.marketT / B.dayRealSeconds), mTick = () => S.marketT % B.dayRealSeconds;
const applyMarketFx = () => { market.warnSec = CF.surgeWarn; market.penalty = CF.penalty ?? undefined; market.surgeX = CF.surgeMul; };
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

// ================================================================ 원정 (명세6-2): 지도 후보 3곳 · 원정 표 · 길드 성장
const XP = () => B.expedition;
const GKEY = ['abyss', 'tower', 'shield'];
const r10 = (v) => Math.round(v / 10) * 10;
const rndIn = ([a, b]) => a + Math.random() * (b - a);
function ensureExp() {
  S.exp ??= { day: -1, cands: [], tickets: XP().tickets, guilds: GKEY.map(() => ({ ...XP().guildStart })), replaceId: null, n: 0 };
  if (S.exp.day !== S.day) newExpDay();
  return S.exp;
}
function newExpDay() {
  const e = S.exp;
  for (const c of e.cands) if (c.status === 'guild') {                     // 어제 길드가 가져간 땅 → 오늘 소식
    const g = B.guilds[c.owner], ore = ['구리', '은', '금'][Math.floor(Math.random() * 3)], n = Math.round(rndIn(XP().newsOre));
    mail(`${g.name}이(가) ${c.name}에서 ${ore} ${n}개를 캤대요!`, '광산 소식');
  }
  e.day = S.day; e.tickets = XP().tickets;
  const pool = (z) => makeCards(newSeed(), [z, z, z], 2, false).sort((p, q) => cardValue(p).mid - cardValue(q).mid);   // 크기마다 3장 → 싼 땅 = 가장 싼 S · 보통 = 가운데 M · 노른자 = 가장 비싼 L
  const P = { S: pool('S')[0], M: pool('M')[1], L: pool('L')[2] }, bySize = (z) => P[z];
  const pickG = (n) => [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, n);
  const cheap = { ...bySize('S'), kind: 'cheap', hints: bySize('S').hints.slice(0, XP().cheap.hints), guilds: [] };
  const normal = { ...bySize('M'), kind: 'normal', hints: bySize('M').hints.slice(0, XP().normal.hints), guilds: e.n === 0 ? [1] : pickG(XP().normal.guilds) };   // 첫날 보통 땅은 신중한 탑오르는중
  const pr = XP().prime, aband = S.floorUnlocked >= 2 && Math.random() < pr.abandonedChance;
  const prime = { ...bySize('L'), kind: 'prime', glow: true, hints: [...bySize('L').hints.slice(0, pr.hints), 'glow'].filter((h, i, a) => a.indexOf(h) === i), guilds: pickG(Math.round(rndIn([pr.guilds[0], pr.guilds[1] + 0.99]) - 0.49)) };
  if (aband) Object.assign(prime, { name: prime.name.replace('뒷산', '폐광'), floor: 2 });
  e.cands = [cheap, normal, prime];
  for (const c of e.cands) {
    const mid = cardValue(c).mid;
    c.price = c.kind === 'cheap' ? Math.max(10, r10(mid * XP().cheap.priceMul)) : Math.max(10, r10(mid * XP().auction.startShare));
    if (c.kind === 'cheap' && e.n === 0) c.price = Math.min(c.price, Math.max(10, Math.floor(S.gold / 10) * 10));   // 첫 원정: 싼 땅은 무조건 살 수 있게
    c.status = 'open';
  }
  save();
}
const guildRate = (i) => (S.exp?.guilds[i]?.mines ?? 1) * XP().guildRatePerMine;
/** 원정 시작: 처음이면 튜토리얼 원정 · 원정 표 · 갱도 자리가 꽉 찼으면 넘길 갱도 먼저 고르기 → 지도 */
function openMap() {
  const e = ensureExp(), en = S.engine;
  if (en.mines.length >= mineSlots(S) && !en.mines.some((m) => m.id === e.replaceId)) {
    const worst = [...en.mines].sort((p, q) => p.reserve / p.reserveMax - q.reserve / q.reserveMax)[0];
    openPanel('⛏ 갱도 자리가 꽉 찼어요', `<p>새 땅을 갱도로 삼으면 하나를 넘겨야 해요. 어느 갱도를 넘길까요?</p>${en.mines.map((m) => `<div class="krow"><button class="kpick" data-id="${m.id}">${m.id === worst.id ? '★ ' : ''}${m.name} · 남은 ${Math.ceil(m.reserve)}/${m.reserveMax}</button></div>`).join('')}<p class="kmuted">★ = 가장 많이 캔 곳 · 숙소 Lv를 올리면 자리가 늘어요</p>`, (b, close) => {
      b.querySelectorAll('.kpick').forEach((x) => (x.onclick = () => { e.replaceId = +x.dataset.id; save(); close(); openMap(); }));
    });
    return;
  }
  AU.card = null; S.round = null;
  closeCompany();
}
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
    stats: { revenue: 0, maxVein: 0, relics: 0, relicGold: 0, events: [], jackpots: 0, oreCells: { C: 0, s: 0, g: 0, j: 0, c: 0 }, maxDepth: 0 },
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
  if (!card.tutorial) toast(card.free ? '공짜 구획이에요. 힌트는 없어요' : `${card.name} 낙찰! 꼬물이가 냄새를 맡아요`, 'momo');
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
  if (rd.stats.stars >= 3) S.stats.star3 = (S.stats.star3 ?? 0) + 1;
  rd.stats.points = Math.max(B.talents.minPerRound, rd.stats.stars);   // 명세5 §4: 별 수만큼 특성 포인트 (최소 1)
  // 명세6-1 §7: 특성 포인트 지급은 멈춤 (다음 단계에서 평판으로)
  // 방치 대상 (명세3 §1-1): 남은 광맥 칸. 다 캤으면 0 → 새 라운드를 돌아야 방치 수입이 이어진다
  const lo = { C: 0, s: 0, g: 0, j: 0, c: 0 };
  if (W) for (const row of W.g) for (const ch of row) if (ORE_KEYS.has(ch)) lo[ch]++;
  S.idle.leftover = lo;
  recordWeek(rd);
  count('expeditions');                                             // 6-3 해금 #8
  if (rd.stats.stars >= 3 && !rd.card.tutorial) { S.talents.star3 = (S.talents.star3 ?? 0) + 1; setTimeout(() => toast('★3 땅! 특성 포인트 +1', 'halabeoji', 3), 900); }   // 6-3 §3
  count('rounds'); if (rd.stats.stars >= 2) count('star2');
  save(); buildUI(); cloudSoon();
}
/** 되팔기 = 낙찰가 × 0.5 + 남은 광맥 가치 × 0.3 */
function resaleValue() {
  let left = 0; if (W) for (const row of W.g) for (const ch of row) if (ORE_KEYS.has(ch)) left += B.basePrice[ch];
  return Math.round((S.round?.bid ?? 0) * XP().resaleMul + left * XP().resaleVeinMul);
}
/** 원정 땅 → 갱도 (§3): 자리가 없으면 가장 고갈된 갱도와 바꿀지 묻기 */
function makeMineFromRound(replaceOk = false) {
  const rd = S.round, st = rd.stats, en = S.engine;
  const mine = mineFromRound(S, rd.card.name.replace(/ ?구획.*/, '') || `갱도 ${en.nextId}`, st.oreCells ?? {}, st.maxDepth ?? 0, GH);
  let rep = null;
  if (en.mines.length >= mineSlots(S) && en.mines.some((m) => m.id === S.exp?.replaceId)) { replaceOk = true; }
  if (en.mines.length >= mineSlots(S)) {
    const worst = en.mines.find((m) => m.id === S.exp?.replaceId) ?? [...en.mines].sort((p, q) => p.reserve / p.reserveMax - q.reserve / q.reserveMax)[0];
    if (!replaceOk) { openPanel('⛏ 갱도 자리가 꽉 찼어요', `<p>갱도 ${en.mines.length}/${mineSlots(S)}곳 (숙소 Lv를 올리면 늘어요)</p><p>가장 많이 캔 <b>${worst.name}</b>(남은 ${Math.ceil(worst.reserve)})와 바꿀까요?</p><div class="krow"><button class="kyes">바꾸기</button><button class="kno">그만두기</button></div>`, (b, close) => { b.querySelector('.kyes').onclick = () => { close(); makeMineFromRound(true); }; b.querySelector('.kno').onclick = close; }); return; }
    rep = worst.id;
  }
  en.nextId = Math.max(en.nextId, mine.id + 1);
  addMine(S, mine, rep); rd.mineMade = mine.name; if (S.exp) S.exp.replaceId = null;
  toast(`새 갱도 「${mine.name}」! 남은 양 ${mine.reserveMax} · 깊이 ×${mine.depth.toFixed(2)}`, 'halabeoji', 3); sfx('build');
  save(); buildUI();
}
function nextAuction() {
  resultMore = false;
  const rd = S.round;
  if (rd?.card?.tutorial) finishTutorial();
  S.stats.rounds++; S.stats.profitTotal += rd.stats.profit; S.stats.bestVein = Math.max(S.stats.bestVein, rd.stats.maxVein);
  S.auction = null; S.round = null; AU.card = null; AU.phase = 'pick';   // 명세6-2: 원정 끝 → 부지 (지도는 [새 원정]으로)
  W = null; buildWorld(); for (const a of crew) resetCrewMember(a); piles = [];
  save(); openCompany();
}

// ---------------------------------------------------------------- 방치 정산 + 「돌아오셨군요」 카드 (명세3 §1)
let welcome = null;                                     // 정산 요약 (카드가 떠 있는 동안)
const idleHi = new Set(); let idleHiUntil = 0;          // [광종별로 고르기] → 판매 행 하이라이트
const advanceMarket = (sec) => { S.marketT += sec; };
// ---- v1.1.2: 인수인계·튜토리얼 동안 알림 보류 (「돌아오셨군요」·편지·과제) → 끝난 뒤 들어온 순서대로, 하나씩 3초 간격
const held = []; let heldNext = 0;
const tutBusy = () => (!S.tutorial.done && !S.tutorial.deferred) || !!S.tutorial.active || !!introView;
function notify(fn, stale) { if (tutBusy() || held.length) held.push({ fn, stale }); else fn(); }
setInterval(() => {
  if (!held.length || tutBusy() || dialog || welcome || Date.now() < heldNext) return;
  const it = held.shift();
  if (it.stale?.()) return;                                  // 급등처럼 이미 지나간 건 버림
  it.fn(); heldNext = Date.now() + 3200;
}, 300);
const surgeGone = (key) => () => !(market.surge && market.surge.key === key && mNow() < market.surge.end);
function settleOffline(boot = false) {
  const r = computeOffline(S, {
    market, marketNow: mNow, advanceMarket,
    miners: 0, pickGrade: CF.pick, capHours: CF.capHours, whRoom: whCap() - whTotal(), rateMul: CF.idleMul,   // 명세6-1: 방치 캐기는 엔진이
  });
  if (!r) return null;
  if (r.midRound) { if (!boot) toast(`라운드 이어 하기 — ${S.round.card.name}`, 'momo', 3); return r; }
  if (r.pendingTotal > 0) notify(() => { welcome = r; buildUI(); setTimeout(() => { tip('welcome'); sfx('welcome'); }, 400); });   // (엔진 전 저장의 남은 몫만)
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
  if (highlight) { idleHiUntil = time + 6; sheetTab = 'sell'; if (!L.pc) S.settings.sheetFolded = false; }
  closeWelcome();
  if (highlight) layout();
}
const dur = (sec) => { const m = Math.round(sec / 60), h = Math.floor(m / 60); return h ? `${h}시간 ${m % 60}분` : `${m}분`; };
const agoText = (sec) => (sec < 3600 ? `${Math.max(1, Math.round(sec / 60))}분 전` : `${Math.round(sec / 3600)}시간 전`);
function makeWelcome() {
  if (welcome.engine) return makeEngineWelcome();
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
  if (r.missed.length) { const m = r.missed[r.missed.length - 1], o = ORES.find((q) => q.key === m.key); notes.push(`${agoText(r.to - (m.day * B.dayRealSeconds + m.tick))} ${o.name} 시세가 ×${CF.surgeMul} 갔어요 (놓침)${r.missed.length > 1 ? ` 외 ${r.missed.length - 1}번` : ''}`); }
  for (const s of notes) { const l = label(s, { ...ink, small: true, color: 0x8a5a24, wrap: w - 16 }); l.position.set(8, y); c.addChild(l); y += Math.ceil(l.height) + 2; }
  y += 4;
  const bw = w - 16;
  if (rows.length) {
    const sellB = button('wood', bw, 20, `지금 팔기 ${idleValue().toLocaleString()}`, () => { unlockAudio(); idleSellAll(sellB.getGlobalPosition()); });
    sellB.position.set(8, y); c.addChild(sellB); y += 24;
    const hw = Math.floor((bw - 4) / 2);
    const st = button('paper', hw, 18, '창고에 두기', () => idleStore(false), { small: true }); st.position.set(8, y); c.addChild(st);
    const pk = button('paper', hw, 18, '골라 팔기 ▸', () => idleStore(true), { small: true }); pk.position.set(12 + hw, y); c.addChild(pk); y += 22;
  } else { const ok = button('wood', bw, 20, '확인', closeWelcome); ok.position.set(8, y); c.addChild(ok); y += 24; }
  const foot = label('오늘 경매 준비됐어요', { ...ink, small: true, color: 0x8a7a68 });
  foot.position.set(Math.round((w - foot.width) / 2), y); c.addChild(foot); y += 14;
  c.addChildAt(frame('paper', w, y + 4, 'panel'), 0);
  c.position.set(Math.round((uW - w) / 2), Math.max(4, Math.round((uH - y) / 2)));
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
}

function makeEngineWelcome() {
  const r = welcome, uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS);
  const box = new Container();
  const dim = new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.6 }); dim.eventMode = 'static'; box.addChild(dim);
  const w = Math.min(uW - 12, 240), ink = { color: COLOR.paperInk, shadow: false };
  const c = new Container(); box.addChild(c);
  const pf = portraitFrame(tex(NPC.halabeoji), 32, 'wood'); pf.position.set(6, 6); c.addChild(pf);
  const t = label('돌아오셨군요!', ink); t.position.set(44, 8); c.addChild(t);
  const a = label(`떠난 지 ${dur(r.away)}${r.capped ? ' (방치 상한)' : ''}`, { ...ink, small: true, color: 0x8a7a68 }); a.position.set(44, 23); c.addChild(a);
  let y = 44;
  const l1 = label(`자리 비운 동안 광석 ${r.total}개 · 창고 ${whTotal()}/${whCap()}${r.full ? ' 가득' : ''}`, { ...ink, small: true, wrap: w - 16 }); l1.position.set(8, y); c.addChild(l1); y += Math.ceil(l1.height) + 4;
  if (r.foremen?.marta) { const fm = r.foremen.marta, top = Object.entries(fm.ore).sort((a, b) => b[1] - a[1])[0]; const lf = label(`마르타가 ${top[0]} 등 ${fm.n}개를 팔았어요 +${fm.gold.toLocaleString()}`, { ...ink, small: true, color: 0x46702e, wrap: w - 16 }); lf.position.set(8, y); c.addChild(lf); y += Math.ceil(lf.height) + 4; }
  const best = ORES.filter((o) => stash[o.key] > 0).sort((p, q) => market.coef[q.key] - market.coef[p.key])[0] ?? ORES[0];
  const pct = Math.round((market.coef[best.key] - 1) * 100);
  const l2 = label(`지금 ${best.name} ${priceOf(best.key)}금 (${pct >= 0 ? '+' : ''}${pct}%)`, { ...ink, small: true, color: pct > 0 ? 0x46702e : pct < 0 ? 0xb84a62 : 0x8a7a68 }); l2.position.set(8, y); c.addChild(l2); y += 18;
  const val = ORES.reduce((s0, o) => s0 + stash[o.key] * priceOf(o.key), 0), bw = Math.floor((w - 20) / 2);
  const canAll = isOpen(S, 'sellAll');
  const sellB = button('wood', bw, 20, canAll ? `바로 팔기 💰${val.toLocaleString()}` : '판매 탭 열기', () => { unlockAudio(); if (canAll) ORES.forEach((o) => sell(o.key, 1)); else setSheet(true, 'sell'); welcome = null; save(); buildUI(); }, { small: true });
  sellB.position.set(8, y); c.addChild(sellB);
  const later = button('paper', bw, 20, '나중에', () => { welcome = null; save(); buildUI(); }, { small: true }); later.position.set(12 + bw, y); c.addChild(later); y += 26;
  c.addChildAt(frame('paper', w, y + 2, 'panel'), 0);
  c.position.set(Math.round((uW - w) / 2), Math.max(4, Math.round((uH - y) / 2)));
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
}

// ================================================================ 일일 과제 (명세3 §6 — 체크인 daybook.ts)
function count(k, n = 1) {
  S.counters ??= {};
  S.counters[k] = (S.counters[k] ?? 0) + n;
  for (const t of checkDaybook(S)) {
    setTimeout(() => notify(() => { toast(`과제 완료! ${dayDef(t.id).text(t.n)} · 금화 +${t.reward}`, 'momo', 3); sfx('bell'); bumpCounter('coin'); refreshUI(); if (sheetTab === 'day') buildUI(); }), 300);
  }
}
/** 날이 바뀌면 새 과제 — 모모 편지 */
function checkNewDay() {
  if (!S.tutorial.done) return;                               // 과제 편지는 튜토리얼 뒤부터
  if (rollDaybook(S)) { mail('오늘의 과제 3개가 왔어요! [과제]에서 봐요'); setTimeout(() => notify(() => toast('모모 편지: 오늘의 과제 3개가 왔어요! [과제]에서 봐요', 'momo', 4)), 1500); save(); if (sheetTab === 'day') buildUI(); }
}
setTimeout(checkNewDay, 0);                              // 모듈이 다 읽힌 뒤
setInterval(checkNewDay, 60 * 1000);
// ================================================================ 장비 (명세5 §3): 라운드 중에도 [장비] 탭에서 바로
function upgradeEquip(k) {
  if ((k === 'vibro' || k === 'lantern') && !isOpen(S, k)) { toast(`${needText(k)}이면 열려요`); return; }
  const cost = gearCost(S, k);
  if (cost == null) { toast('최대예요'); return; }
  if (S.gold < cost) { toast('금화가 모자라요'); sfx('pass', true); return; }
  S.gold -= cost; if (ENGINE_UP[k]) S.engine.lv[ENGINE_UP[k]]++; else S.upgrades[k]++;   // 곡괭이 = 엔진
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
const GEAR_EMOJI = { pick: '⛏', cart: '🚃', lodge: '🏠', warehouse: '📦', mole: '🐾', vibro: '📡', lantern: '🔦', smelter: '🔥', pump: '💧', turret: '🔫' };
let upCard = null;                                           // 열린 카드: { kind: 'gear', key } (회사 건물도 같은 카드 — V12 §5)
/** 장비 (PATCH_V12 §5): 아이콘 타일 2줄 × 5 — 아이콘 · Lv 점 · 가격. 살 수 있으면 노란 테두리, 금화 부족이면 회색. 톡 → 카드, 길게 누르면 바로 구매 */
function makeGear(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const cols = 5, tw = Math.floor((w - 8) / cols), th = Math.min(Math.floor((h - 8) / 2), tw + 22);
  UP_KEYS.filter((k) => !ENGINE_UP[k] || k === 'pick').forEach((k, i) => {
    const gLock = (k === 'vibro' || k === 'lantern') && !isOpen(S, k);
    const x0 = 4 + (i % cols) * tw, y0 = 4 + Math.floor(i / cols) * th, lv = upLv(S, k), cost = gLock ? null : gearCost(S, k), can = !gLock && cost != null && S.gold >= cost, max = UP[k].max;
    const t = new Container(); t.position.set(x0, y0); c.addChild(t);
    t.addChild(frame(can ? 'wood' : 'stone', tw - 2, th - 2, 'panel'));
    if (can) t.addChild(new Graphics().rect(0, 0, tw - 2, th - 2).stroke({ width: 1, color: 0xf5cf6a }));
    const ic = label(GEAR_EMOJI[k], { shadow: false }); ic.position.set(Math.round((tw - 2 - ic.width) / 2), 2); if (cost != null && !can) ic.alpha = 0.5; t.addChild(ic);
    const dots = new Graphics(), dn = max - UP[k].min, dw = Math.min(5, Math.floor((tw - 6) / dn));
    for (let d = 0; d < dn; d++) dots.circle(Math.round((tw - 2 - dn * dw) / 2) + d * dw + dw / 2, ic.y + ic.height + 3, Math.max(1, dw / 2 - 0.5)).fill(d < lv - UP[k].min ? 0xf5cf6a : 0x5a4a40);
    t.addChild(dots);
    const pr = label(gLock ? '🔒' : cost == null ? '최대' : `${cost}`, { small: true, color: cost == null ? COLOR.dim : can ? COLOR.gold : 0x8a7a68 }); fitText(pr, tw - 4); pr.position.set(Math.round((tw - 2 - pr.width) / 2), th - 2 - pr.height - 2); t.addChild(pr);
    t.eventMode = 'static'; t.cursor = 'pointer'; ui.refs[`gear_${k}`] = t;
    let hold = null, held = false;
    t.on('pointerdown', () => { held = false; hold = setTimeout(() => { held = true; hold = null; if (gearCost(S, k) != null) upgradeEquip(k); }, 500); });   // 길게 = 바로 구매
    const up = () => { if (hold) { clearTimeout(hold); hold = null; } };
    t.on('pointerup', up); t.on('pointerupoutside', up);
    t.on('pointertap', () => { if (held) return; upCard = { kind: 'gear', key: k }; sfx('ui_tap'); buildUI(); });
  });
  return c;
}
/** 카드 1장 (장비·회사 건물 공용): 큰 아이콘 · 이름 Lv · 효과 한 줄 · [올리기 💰N] · 닫기 */
function makeUpCard() {
  if (upCard.kind !== 'gear') return makeCoCard();
  const u = (v) => Math.round(v / L.uiS);
  const f = L.full, x = u(f.x0), y = u(f.y0), W0 = u(f.x1 - f.x0), H0 = u(f.y1 - f.y0);
  const box = new Container();
  const dim = new Graphics().rect(x, y, W0, H0).fill({ color: 0x0a0812, alpha: 0.4 }); dim.eventMode = 'static'; dim.on('pointertap', () => { upCard = null; buildUI(); }); box.addChild(dim);
  const k = upCard.key, lv = upLv(S, k), cost = gearCost(S, k), w = Math.min(W0 - 16, 200), h = 92;
  const c = new Container(); c.position.set(x + Math.round((W0 - w) / 2), y + Math.round((H0 - h) / 2)); box.addChild(c);
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const ic = label(GEAR_EMOJI[k], { shadow: false }); ic.scale.set(2); ic.position.set(8, 8); c.addChild(ic);   // 그림(아이콘) — 글자 크기 규칙 밖
  const nm = label(`${UP[k].name} Lv${lv}`, ink); nm.position.set(46, 10); fitText(nm, w - 46 - 22); c.addChild(nm);
  const ef = label(k === 'pick' ? (lv >= UP.pick.max ? UP.pick.steps[lv] : `다음: ${UP.pick.steps[lv + 1]}`) : upText(S, k), { ...ink, small: true, color: 0x6a5a48 }); ef.position.set(46, 28); fitText(ef, w - 52); c.addChild(ef);
  const can = cost != null && S.gold >= cost;
  const bt = button(can ? 'wood' : 'stone', w - 16, 22, cost == null ? '최대' : `올리기 💰${cost}`, () => { upgradeEquip(k); }, { small: true });
  bt.setDisabled(!can); bt.position.set(8, h - 30); c.addChild(bt); ui.refs.upCardBtn = bt;
  const x0 = button('stone', 16, 14, '✕', () => { upCard = null; buildUI(); }, { small: true }); x0.position.set(w - 20, 4); c.addChild(x0);
  if (cost != null && !can) { const lack = label(`💰 ${cost - S.gold} 모자라요`, { ...ink, small: true, color: 0xb84a62 }); lack.position.set(46, 44); c.addChild(lack); }
  ui.overlayRect = { x: f.x0, y: f.y0, w: f.x1 - f.x0, h: f.y1 - f.y0 };
  return box;
}
/** 회사 카드 (장비 카드와 같은 틀): 건물 · 빈 터(지을 것 고르기) · 장식 · 소품 자리 */
function makeCoCard() {
  const u = (v) => Math.round(v / L.uiS);
  const f = L.full, x = u(f.x0), y = u(f.y0), W0 = u(f.x1 - f.x0), H0 = u(f.y1 - f.y0);
  const box = new Container();
  const dim = new Graphics().rect(x, y, W0, H0).fill({ color: 0x0a0812, alpha: 0.4 }); dim.eventMode = 'static'; dim.on('pointertap', () => { upCard = null; buildUI(); }); box.addChild(dim);
  const ink = { color: COLOR.paperInk, shadow: false }, iconH = Math.round(64 / L.uiS);
  const pick = upCard.kind === 'lot' || upCard.kind === 'spot';
  const w = Math.min(W0 - 8, 220), h = pick ? (iconH + 14) * 2 + 30 : iconH + 52;
  const c = new Container(); c.position.set(x + Math.round((W0 - w) / 2), y + Math.round((H0 - h) / 2)); box.addChild(c);
  c.addChild(frame('paper', w, h, 'panel'));
  const close = button('stone', 16, 14, '✕', () => { upCard = null; buildUI(); }, { small: true }); close.position.set(w - 20, 4); c.addChild(close);
  ui.overlayRect = { x: f.x0, y: f.y0, w: f.x1 - f.x0, h: f.y1 - f.y0 };
  if (pick) {                                                  // 빈 터 → 지을 건물 / 소품 자리 → 놓을 장식
    const isLot = upCard.kind === 'lot';
    const t = label(isLot ? '무엇을 지을까요?' : '여기에 둘 장식', ink); t.position.set(8, 6); fitText(t, w - 30); c.addChild(t);
    const items = isLot ? BUILDINGS.filter((k) => lvOf(S, k) <= 0) : DECOS.filter((k) => !S.company.decos.some((d) => d.kind === k));
    if (!items.length) { const n = label(isLot ? '다 지었어요' : '다 놓았어요', { ...ink, small: true }); n.position.set(8, 30); c.addChild(n); return box; }
    const cols = 4, cw = Math.floor((w - 8) / cols);
    items.slice(0, 8).forEach((k, i) => {
      const cost = isLot ? canUp(S, k).cost : B.company.decos[k].cost, can = cost != null && S.gold >= cost;
      const cell = new Container(); cell.position.set(4 + (i % cols) * cw, 24 + Math.floor(i / cols) * (iconH + 14)); c.addChild(cell);
      const art = yardArt(k, 1, iconH - 2); art.position.set(Math.round((cw - 2) / 2), iconH); if (!can) art.alpha = 0.45; cell.addChild(art);
      const p = label(`💰${cost}`, { ...ink, small: true, color: can ? 0x46702e : 0x8a7a68 }); fitText(p, cw - 2); p.position.set(Math.round((cw - 2 - p.width) / 2), iconH); cell.addChild(p);
      cell.eventMode = 'static'; cell.cursor = 'pointer'; cell.hitArea = new Rectangle(0, 0, cw - 2, iconH + 14);
      cell.on('pointertap', () => (isLot ? buildAt(k, upCard.lot) : placeDecoAt(k, upCard.spot)));
    });
    return box;
  }
  if (upCard.kind === 'bld' && ENGINE_BLD[upCard.key]) return makeEngineCard(box, c, w, iconH, ink);
  const k = upCard.key, deco = upCard.kind === 'deco', lv = deco ? 0 : lvOf(S, k), have = deco ? S.company.decos.some((d) => d.kind === k) : k === 'office' || lv > 0;
  const art = yardArt(k, Math.max(1, lv), iconH); art.anchor.set(0, 0); art.position.set(6, 6); c.addChild(art);   // V14 그림
  const nm = label(`${nameOf(k)}${deco ? '' : have ? ` Lv${lv}` : ''}`, ink); nm.position.set(iconH + 12, 8); fitText(nm, w - iconH - 34); c.addChild(nm);
  const hs = B.company.harmonies.filter((q) => !q.hidden && (q.a === k || q.b === k));
  const line = deco ? (hs.map((q) => `${nameOf(q.a === k ? q.b : q.a)} 곁: ${q.text}`)[0] ?? '꾸미기') : effectText(S, k);
  const ef = label(line, { ...ink, small: true, color: 0x6a5a48 }); ef.position.set(iconH + 12, 26); fitText(ef, w - iconH - 18); c.addChild(ef);
  const chk = canUp(S, k), cost = chk.cost ?? (deco ? null : upCost(S, k));
  const mainTxt = deco ? (have ? '놓음' : `놓기 💰${cost}`) : cost == null ? '최대' : `${have ? '올리기' : '짓기'} 💰${cost}`;
  const bw = have && k !== 'office' ? w - 16 - 50 : w - 16;
  const bt = button(chk.ok ? 'wood' : 'stone', bw, 22, mainTxt, () => coAction(k), { small: true }); bt.setDisabled(!chk.ok); bt.position.set(8, h - 30); c.addChild(bt); ui.refs.upCardBtn = bt;
  if (have && k !== 'office') { const mv = button('paper', 46, 22, '옮기기', () => { placing = { kind: k, move: true, deco }; upCard = null; toast('옮길 자리를 톡!'); buildUI(); }, { small: true }); mv.position.set(w - 54, h - 30); c.addChild(mv); }
  return box;
}
/** 엔진 건물 카드 (명세6-1 §6): 업글 줄마다 Lv · 효과 한 줄 · 마일스톤까지 점 5개 · [올리기 💰] (길게 = 연속) */
function makeEngineCard(box, c, w, iconH, ink) {
  const k = upCard.key, keys = k === 'smelter' ? ['pick', 'smelter'] : [ENGINE_BLD[k]];
  const art = yardArt(k, Math.max(1, lvOf(S, k)), iconH); art.anchor.set(0, 0); art.position.set(6, 6); c.addChild(art);
  const nm = label(k === 'smelter' ? '대장간' : nameOf(k), ink); nm.position.set(iconH + 12, 8); fitText(nm, w - iconH - 34); c.addChild(nm);
  if (k === 'warehouse') { const sb = button('paper', 60, 16, '팔기 ▸', () => { upCard = null; openStorage(); }, { small: true }); sb.position.set(iconH + 12, 24); c.addChild(sb); }
  let y = iconH + 12;
  for (const ek of keys) {
    const lockK = { cart: 'cart', warehouse: 'warehouse', lodge: 'lodge', smelter: 'smelter' }[ek], locked = lockK && !isOpen(S, lockK);
    const lv = S.engine.lv[ek], cost = engineCost(S, ek), can = S.gold >= cost && !locked, nx = nextMilestone(lv), pv = [0, ...B.engine.milestones].filter((m) => m <= lv).pop();
    const t = label(`${B.engine.up[ek].name} Lv${lv}`, { ...ink, color: 0x8a5a24 }); t.position.set(8, y); c.addChild(t);
    if (nx) { const dots = new Graphics(), fill = Math.floor((5 * (lv - pv)) / (nx - pv)); for (let d = 0; d < 5; d++) dots.circle(t.x + t.width + 8 + d * 7, y + 7, 2.5).fill(d < fill ? 0xf5cf6a : 0x8a7a68); c.addChild(dots); const nt = label(`Lv${nx} ×2`, { ...ink, small: true, color: 0x8a7a68 }); nt.position.set(t.x + t.width + 46, y + 1); c.addChild(nt); }
    y += 15;
    const ef = label(engineText(S, ek), { ...ink, small: true, color: 0x6a5a48 }); fitText(ef, w - 16); ef.position.set(8, y); c.addChild(ef); y += 14;
    const bt = button(can ? 'wood' : 'stone', w - 16, 20, locked ? `🔒 ${needText(lockK)}이면 열려요` : `올리기 💰${cost.toLocaleString()}`, () => {}, { small: true });
    bt.setDisabled(!can); bt.position.set(8, y); c.addChild(bt); if (ek === keys[0]) ui.refs.upCardBtn = bt;
    let rep = null, fired = false;
    const stop = () => { if (rep) { clearInterval(rep.i); clearTimeout(rep.t); rep = null; } };
    bt.eventMode = 'static';
    if (locked) { y += 26; continue; }
    bt.on('pointerdown', () => { fired = false; stop(); rep = { t: setTimeout(() => { rep.i = setInterval(() => { fired = true; if (!engineBuy(ek, true)) stop(); }, 140); }, 450) }; });
    bt.on('pointerup', () => { const was = fired; stop(); if (!was) engineBuy(ek); }); bt.on('pointerupoutside', stop);
    y += 26;
  }
  const bg = c.children[0]; if (bg) { c.removeChild(bg); bg.destroy(); }
  c.addChildAt(frame('paper', w, y + 4, 'panel'), 0);
  return box;
}
/** 막힌 갱도의 이유 줄 → 장비 탭 + 그 항목 카드 */
function openGear(key) {
  setSheet(true, 'gear');
  if (key) { upCard = { kind: 'gear', key }; buildUI(); }
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
    if (rowH < 24) fitText(l, r.x - 4 - l.x);
  });
  return c;
}

// ================================================================ 온보딩 (docs/ONBOARDING_1024.md) — 체크인 온보딩 틀: 단계 = 조건 → 다음 · 손가락 · 대사 카드
// [0] 인수인계 장면 → [1] 튜토리얼 라운드(고정 구획 · 12단계 강제) → [2] 첫 경매 안내 3 → [3] 처음 만나는 순간 1회 안내 · 설명서
const tutOn = () => !!S.tutorial.active && !!S.round?.card?.tutorial;
let introView = null, dialog = null, manualView = null, talentView = false;
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
const TUT_STEPS = [                                        // PATCH_V12 §6: 12단계 · 기다리는 단계(wait)는 8초면 모모 한 줄, auto 는 15초면 넘어감
  { wait: true, auto: () => { S.tutorial.sniffed = true; }, focus: () => actorRect(mole), hand: () => ({ kind: 'point', at: centerOf(actorRect(mole)) }), done: () => S.tutorial.sniffed },
  { focus: () => boundsOf(ui.refs.surveyEnd), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(ui.refs.surveyEnd)) }), done: () => state() === 'DIG' },
  { shaftX: X, stopY: TUT_STOP_Y, focus: () => cellScreen(X, -1, 1, 2), hand: () => ({ kind: 'tap', at: cellCenter(X, -0.4) }), done: () => S.round.shafts?.some((q) => q.x === X) },
  { wait: true, waitTurn: true, enter: () => revealCells(W.veins.list[veinOf('C')].cells),
    focus: () => (S.round.shafts?.[0]?.dir === 'wait' ? unionRect(boundsOf(shaftBtns.left), veinRect(veinOf('C'))) : unionRect(actorRect(crew[0]), cellScreen(X, 0, 1, TUT_STOP_Y + 1))),
    hand: () => (S.round.shafts?.[0]?.dir === 'wait' ? { kind: 'tap', at: centerOf(boundsOf(shaftBtns.left)) } : { kind: 'point', at: centerOf(actorRect(crew[0])) }),
    done: () => S.round.claimed.includes(veinOf('C')) },
  { wait: true, auto: () => {}, enter: () => { S.tutorial.mark = S.counters?.ores ?? 0; }, focus: () => unionRect(veinRect(veinOf('C')), actorRect(cartA)), hand: () => ({ kind: 'point', at: centerOf(actorRect(cartA)) }),
    done: () => (S.counters?.ores ?? 0) - (S.tutorial.mark ?? 0) >= 1 },                       // 광석 1개 창고 도착이면 다음
  { enter: () => { S.tutorial.mark = S.counters?.soldGold ?? 0; },
    focus: () => (sheetTab !== 'sell' || !sheetOpen() ? boundsOf(ui.sellAnchor) : boundsOf(ui.rows.C?.r)), hand: () => ({ kind: 'tap', at: centerOf(sheetTab !== 'sell' || !sheetOpen() ? boundsOf(ui.sellAnchor) : boundsOf(ui.rows.C?.btn)) }),
    done: () => (S.counters?.soldGold ?? 0) > (S.tutorial.mark ?? 0) },
  { vibroX: TUT_GOLD_X, enter: () => { S.round.vibroLeft = Math.max(1, S.round.vibroLeft ?? 0); if (!L.pc) { S.settings.sheetFolded = true; setTimeout(layout, 0); } },
    focus: () => (toolArmed === 'vibro' ? cellScreen(TUT_GOLD_X, -1, 1, 2) : boundsOf(ui.refs.vibro)), hand: () => ({ kind: 'tap', at: toolArmed === 'vibro' ? cellCenter(TUT_GOLD_X, -0.4) : centerOf(boundsOf(ui.refs.vibro)) }),
    done: () => S.round.stakes?.some((q) => q.x === TUT_GOLD_X && q.text !== '…' && q.text !== '?') },
  { shaftX: TUT_GOLD_X, wait: true, enter: () => { S.tutorial.mark = left('g'); }, focus: () => cellScreen(TUT_GOLD_X, -1, 1, 2), hand: () => ({ kind: 'tap', at: cellCenter(TUT_GOLD_X, -0.4) }),
    done: () => left('g') < (S.tutorial.mark ?? 99) && (stash.g > 0 || carts.some((c) => c.cargo.g) || piles.some((p) => p.type === 'g')) },   // 금 1개만 캐면 판매로
  { focus: () => (sheetTab !== 'sell' || !sheetOpen() ? boundsOf(ui.sellAnchor) : buyer() !== 'merchant' ? boundsOf(ui.refs.buyerSwap) : boundsOf(ui.rows.g?.r)),
    hand: () => ({ kind: 'tap', at: centerOf(sheetTab !== 'sell' || !sheetOpen() ? boundsOf(ui.sellAnchor) : buyer() !== 'merchant' ? boundsOf(ui.refs.buyerSwap) : boundsOf(ui.rows.g?.btn)) }),
    done: () => S.tutorial.merchantGold || S.tutorial.goldSold },
  { enter: () => { const c = gearCost(S, 'pick'); if (c != null && S.gold < c) { S.gold = c; refreshUI(); toast('그룬 할아범이 곡괭이 값을 보탰어요', 'halabeoji', 2.5); } },
    focus: () => (upCard ? boundsOf(ui.refs.upCardBtn) : sheetTab !== 'gear' || !sheetOpen() ? boundsOf(ui.tabs?.find((t) => t.key === 'gear')) : boundsOf(ui.refs.gear_pick)),
    hand: () => ({ kind: 'tap', at: centerOf(upCard ? boundsOf(ui.refs.upCardBtn) : sheetTab !== 'gear' || !sheetOpen() ? boundsOf(ui.tabs?.find((t) => t.key === 'gear')) : boundsOf(ui.refs.gear_pick)) }),
    done: () => upLv(S, 'pick') >= 2 },
  { enter: () => { upCard = null; }, focus: () => boundsOf(confirmRetreat ? ui.refs.retreatYes : ui.refs.retreat), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(confirmRetreat ? ui.refs.retreatYes : ui.refs.retreat)) }), done: () => state() === 'RESULT' },
  { focus: () => boundsOf(tutResultTarget()), hand: () => ({ kind: 'tap', at: centerOf(boundsOf(tutResultTarget())) }), done: () => !S.tutorial.active },   // 결과 → 특성 1점 → 닫기 → 다음 경매
];
const tutStep = () => (tutOn() ? TUT_STEPS[S.tutorial.step] : null);
/** 마지막 단계: [특성 찍기] → 칸 → [닫기] → [다음 경매] 순서로 손가락 */
const tutResultTarget = () => (talentView ? (talentSpent(S) > 0 ? ui.refs.talentClose : ui.refs.talent_dig) : talentLeft(S) > 0 && talentSpent(S) === 0 ? ui.refs.resultTalent : S.round?.mineMade || S.round?.resold != null ? ui.refs.next : ui.refs.makeMine);
let tutT = 0, tutShakeT = 0, tutNudged = false, tutIdleSaid = false;
function startTutorialRound() {
  Object.assign(S.tutorial, { active: true, step: 0, sniffed: false, merchantGold: false, goldSold: false, mark: 0 });
  S.settings.buyer = 'brok'; S.settings.sheetFolded = true;
  view = 'mine';
  startRound({ ...TUT_CARD }, 0);
  tutEnter();
}
function finishTutorial() { Object.assign(S.tutorial, { active: false, done: true, step: 0 }); save(); }
function tutEnter() { tutT = 0; tutNudged = false; tutIdleSaid = false; TUT_STEPS[S.tutorial.step]?.enter?.(); save(); buildUI(); }
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
    if (st.wait && tutT > 8 && !tutIdleSaid) { tutIdleSaid = true; toast(TUT_IDLE, 'momo', 3); }   // 멍 → 설명
    if (st.auto && tutT > 15) { st.auto(); if (!st.done()) { S.tutorial.step++; if (S.tutorial.step >= TUT_STEPS.length) finishTutorial(); else tutEnter(); return; } }
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
      const w = Math.round((L.vis.x1 - L.vis.x0) * k) - 8, ps = Math.max(20, Math.round(48 * k));          // §2: 폭 = 게임 폭 · 초상 48px
      const tx = label(text, { small: true, color: COLOR.paperInk, shadow: false, wrap: w - ps - 44 });
      if (tx.height > 26) { tx.style.wordWrap = false; fitText(tx, (w - ps - 44) * 2 - 10); tx.style.wordWrap = true; }   // 최대 2줄
      const h = Math.min(Math.max(ps + 8, Math.ceil(tx.height) + 10), Math.round((L.vis.y1 - L.vis.y0) * k * 0.15) + 8);
      tutBubble.addChild(frame('paper', w, h, 'panel'));
      const pf = portraitFrame(tex(NPC[who]), ps, 'wood'); pf.position.set(4, Math.round((h - ps) / 2)); tutBubble.addChild(pf);
      tx.position.set(ps + 12, Math.round((h - tx.height) / 2)); tutBubble.addChild(tx);
      const n = label(`${S.tutorial.step + 1}/${TUT_STEPS.length}`, { small: true, color: 0x8a7a68, shadow: false }); n.position.set(w - 6 - Math.ceil(n.width), 2); tutBubble.addChild(n);
      tutBubble.bw = w; tutBubble.bh = h;
    }
  }
  if (key) {
    const fc = focus ? (focus.y + focus.h / 2) * k : uH;
    const top = Math.round(L.vis.y0 * k) + 4, bottom = Math.round(L.vis.y1 * k) - tutBubble.bh - 6;
    const last = state() === 'RESULT';          // 결과 단계는 카드 아래 (v0.8 §4): 폰 = 아래 시트 위 · PC = 화면 아래 왼쪽
    let y = last ? bottom : fc > (L.vis.y0 + L.vis.y1) / 2 * k ? top : Math.max(top, bottom);
    if (focus) { const fy0 = (focus.y - 6) * k, fy1 = (focus.y + focus.h + 6) * k; if (y < fy1 && y + tutBubble.bh > fy0) y = fy0 - tutBubble.bh - 4 >= top ? Math.round(fy0 - tutBubble.bh - 4) : Math.round(fy1 + 4); }   // 강조한 버튼을 가리지 않게
    const shake = tutShakeT > 0 ? Math.sin(tutShakeT * 50) * 3 : 0;
    tutBubble.position.set(Math.round(((L.vis.x0 + L.vis.x1) / 2) * k - tutBubble.bw / 2 + shake), y);
    if (tutShakeT > 0) { tutShakeT -= dt; tutBubble.scale.set(1 + Math.max(0, tutShakeT) * 0.06); } else tutBubble.scale.set(1);
  }
}
// ---- [0] 인수인계 장면 (V14 §3-2): 부지 상회 문 앞(밤) · 할아범·모모가 문 앞 · 브릭은 처음 한 번만 걸어 들어옴 · [건너뛰기]
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
  v.i = skip ? INTRO_S.length : v.i + 1;
  if (v.i >= INTRO_S.length) {
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
  // V14 §3-2: 사무실 통그림 대신 부지 — 상회(lot 1) 문 앞, 밤. 할아범·모모가 문 앞에 서 있고 브릭이 길 따라 걸어 들어옴
  const lot = Y5.lots[1], VW = 400, VH = 240, X0 = lot.cx - VW / 2, Y0 = lot.by - 150;
  const sDev = Math.max(1, Math.floor(Math.min((Wc * dpr) / VW, (Hc * dpr) / VH))), sc = sDev / dpr;   // 정수 배율
  const ox = Math.round(((Wc - VW * sc) / 2) * dpr) / dpr, oy = Math.round(((Hc - VH * sc) / 2 - (Hc > VH * sc + 120 ? 40 : 0)) * dpr) / dpr;
  const hit = new Graphics().rect(0, 0, Wc, Hc).fill(0x0b0910); hit.eventMode = 'static'; hit.on('pointertap', () => introNext()); introLayer.addChild(hit);
  const frameC = new Container(); frameC.position.set(ox, oy); frameC.scale.set(sc); introLayer.addChild(frameC);
  const mk = new Graphics().rect(0, 0, VW, VH).fill(0xffffff); frameC.addChild(mk);
  const room = new Container(); room.mask = mk; room.position.set(-X0, -Y0); frameC.addChild(room);
  const NIGHT = Y5_SHADE.night;
  const g0 = new Sprite(y5tex('yard_ground_f0.png')); g0.tint = NIGHT; room.addChild(g0);
  const wd = new Container(); wd.sortableChildren = true; room.addChild(wd);
  const put = (t, x, by) => { if (!t) return null; const sp = new Sprite(t); sp.position.set(Math.round(x), Math.round(by - t.height)); sp.tint = NIGHT; sp.zIndex = by; wd.addChild(sp); return sp; };
  for (const o of Y5.objects) if (o.x > X0 - 120 && o.x < X0 + VW + 20 && o.by > Y0 - 10 && o.by < Y0 + VH + 140) put(y5tex(`props/${o.n === 'animation_campfire_f0' ? 'campfire_f0' : o.n}.png`), o.x, o.by);
  for (const l of Y5.lots) if (Math.abs(l.cx - lot.cx) < 400 && l.by < Y0 + VH + 140) {
    if (l.id === 1) { const nm = `office_${y5Step(S.company.coreLv ?? 1)}`, t = y5tex(`bld/${nm}.png`), [ax, ay] = Y5A[nm]; const b = put(t, l.cx - ax, l.by - ay + t.height); if (b) b.zIndex = l.by; }
    else { const [sx, sy] = Y5A.lot_site; const b = put(y5tex(`bld/${l.id % 2 ? 'lot_site_b' : 'lot_site_a'}.png`), l.cx - sx, l.by - sy + 64); if (b) b.zIndex = l.by - 20; }
  }
  const glowS = (x, y, r, col, a) => { const g = new Sprite(glowTex()); g.anchor.set(0.5); g.width = g.height = r * 2; g.position.set(x, y); g.tint = col; g.alpha = a; g.blendMode = 'add'; room.addChild(g); };
  const person = (who, x, y, row) => { const sp = new Sprite(y5Frames(who, 'idle')[row][0]); sp.anchor.set(0.5, 41 / 48); sp.position.set(x, y); sp.tint = NIGHT; sp.zIndex = y; wd.addChild(sp); return sp; };
  const old = person('npc_halabeoji', lot.cx - 16, lot.by + 14, 3), momo = person('npc_momo', lot.cx + 18, lot.by + 16, 3);
  const MEY = Y5.spine.find((p) => p[0] >= lot.cx)?.[1] ?? lot.by + 58, ME_STOP = lot.cx + 40;
  const me = person('brick', v.walked ? ME_STOP : X0 + VW + 24, MEY, 1);
  for (const [lx, ly] of Y5.lamps) glowS(lx, ly, 18, 0xffd58a, 0.55);
  glowS(lot.cx, lot.by - 40, 50, 0xffc070, 0.25);                                 // 상회 창문 불빛
  const items = { x: 0 };                                                           // (옛 장부·열쇠 연출 자리)
  // 대사 틀 (UI 배율)
  const uW = Math.round(Wc / L.uiS), uH = Math.round(Hc / L.uiS);
  const ui0 = new Container(); ui0.scale.set(L.uiS); introLayer.addChild(ui0);
  const w = Math.min(uW - 8, 340), ps = Math.max(20, Math.round(48 / L.uiS));   // ONBOARDING §2 말풍선: 초상 48px · 한 문장 · 최대 2줄
  const box = new Container(); ui0.addChild(box);
  const sk = button('stone', 50, 14, '건너뛰기', () => introNext(true), { small: true }); sk.position.set(uW - 56, 6); ui0.addChild(sk);
  let nx = null;
  introLayer.setLine = (i) => {
    box.removeChildren().forEach((c) => c.destroy({ children: true }));
    const tx = label(INTRO_S[i], { small: true, color: COLOR.paperInk, shadow: false, wrap: w - ps - 44 });
    if (tx.height > 26) { tx.style.wordWrap = false; fitText(tx, (w - ps - 44) * 2 - 10); tx.style.wordWrap = true; }
    const h = Math.max(ps + 8, Math.ceil(tx.height) + 10);
    box.position.set(Math.round((uW - w) / 2), uH - h - 12);
    box.addChild(frame('paper', w, h, 'panel'));
    const pf = portraitFrame(tex(NPC.halabeoji), ps, 'wood'); pf.position.set(4, Math.round((h - ps) / 2)); box.addChild(pf);
    tx.position.set(ps + 12, Math.round((h - tx.height) / 2)); box.addChild(tx);
    nx = label(i < INTRO_S.length - 1 ? '▶' : '시작 ▶', { small: true, color: 0x8a7a68, shadow: false }); nx.position.set(w - 6 - Math.ceil(nx.width), h - 13); box.addChild(nx);
    if (INTRO_S[i].includes('넘기겠네')) v.slideT = 0;                  // 열쇠·장부가 플레이어 쪽으로
  };
  introLayer.setLine(v.i);
  let tt = 0;
  introTick = (dt) => {
    if (me.destroyed) return;
    tt += dt;
    if (!v.walked) {
      me.x = Math.max(ME_STOP, me.x - dt * 40); me.texture = y5Frames('brick', 'walk')[1][Math.floor(tt * 8) % 4];
      if (me.x <= ME_STOP) v.walked = true;
    } else me.texture = y5Frames('brick', 'idle')[1][Math.floor(tt * 4) % 4];
    old.texture = y5Frames('npc_halabeoji', 'idle')[3][Math.floor(tt * 4) % 4]; momo.texture = y5Frames('npc_momo', 'idle')[3][Math.floor(tt * 4 + 2) % 4];
    if (v.slideT != null && !v.slid) { v.slideT += dt; items.x = v.slideT; if (v.slideT >= 0.4) v.slid = true; }
    if (nx && !nx.destroyed) nx.alpha = 0.5 + 0.5 * Math.sin(tt * 4);
  };
}
// ---- 대사 카드 (첫 경매 안내 · 상황별 1회 안내) — 탭으로 넘김, 강제 없음
/** 대사는 한 장에 한 문장 (V12 §2) — 여러 문장이면 장을 나눔 */
const oneSentence = (lines) => lines.flatMap((l) => l.split(/(?<=[.!?])\s+/).filter(Boolean));   // 「…」 은 말 끊김이라 안 나눔
const INTRO_S = oneSentence(INTRO);                                                               // 인수인계도 한 장에 한 문장
function showDialog(d) { d = { ...d, lines: oneSentence(d.lines) }; if (dialog) dialogQueue.push(d); else { dialog = { i: 0, ...d }; buildUI(); } }
function dialogNext() {
  if (!dialog) return;
  dialog.i++;
  if (dialog.i >= dialog.lines.length) { const f = dialog.onDone; dialog = null; f?.(); if (dialogQueue.length) dialog = { i: 0, ...dialogQueue.shift() }; }
  sfx('stash', true); buildUI();
}
/** 대사 카드 (안내·첫 경매 등) — 튜토리얼 말풍선과 같은 규칙 (V12 §2): 폭 = 게임 폭 · 초상 48px · 한 문장 최대 2줄 · 높이 ≤ 게임 15% · 게임 아래쪽. 톡하면 다음 */
function makeDialog() {
  const k = 1 / L.uiS, uW = Math.round(L.W * k), uH = Math.round(L.H * k);
  const c = new Container(); c.eventMode = 'static'; c.hitArea = new Rectangle(0, 0, uW, uH); c.on('pointertap', dialogNext);
  c.addChild(new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.3 }));
  const who = dialog.who, w = Math.round((L.vis.x1 - L.vis.x0) * k) - 8, ps = Math.max(20, Math.round(48 * k));
  const tx = label(dialog.lines[dialog.i], { color: COLOR.paperInk, shadow: false, small: true, wrap: w - ps - 44 });
  if (tx.height > 26) { tx.style.wordWrap = false; fitText(tx, (w - ps - 44) * 2 - 10); tx.style.wordWrap = true; }   // 최대 2줄
  const h = Math.min(Math.max(ps + 8, Math.ceil(tx.height) + 10), Math.round((L.vis.y1 - L.vis.y0) * k * 0.15) + 8);
  const box = new Container(); box.position.set(Math.round(((L.vis.x0 + L.vis.x1) / 2) * k - w / 2), Math.round(L.vis.y1 * k) - h - 6); c.addChild(box);
  box.addChild(frame('paper', w, h, 'panel'));
  const pf = portraitFrame(tex(NPC[who]), ps, 'wood'); pf.position.set(4, Math.round((h - ps) / 2)); box.addChild(pf);
  tx.position.set(ps + 12, Math.round((h - tx.height) / 2)); box.addChild(tx);
  const nx = label(dialog.i < dialog.lines.length - 1 ? `${dialog.i + 1}/${dialog.lines.length} ▶` : '▶', { small: true, color: 0x8a7a68, shadow: false }); nx.position.set(w - 6 - Math.ceil(nx.width), h - 13); box.addChild(nx);
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
  if (S.tutorial.guideCompany && S.engine) S.tutorial.guideCompany = false;   // 엔진: 창고는 처음부터 있음
  if (S.tutorial.guideCompany) {
    if (view !== 'company') guideTarget = () => boundsOf(ui.refs.company);
    else if ((S.company.buildings.warehouse?.lv ?? 0) > 0) { S.tutorial.guideCompany = false; save(); }
    else if (S.gold < B.company.buildings.warehouse.cost) { S.tutorial.guideCompany = false; tip('companyLater'); }
    else guideTarget = () => boundsOf(placing ? null : upCard ? ui.refs.upCardBtn : ui.refs.whBuild);
  }
}
setInterval(onboardWatch, 400);
/** 장면 ↔ 곡: 인수인계·설명서·튜토리얼 title · 회사 낮/밤 · 돌아오셨군요 밤 · 갱도 뒷산/폐광 · 경매 · 결과 (+ 앰비언스) */
function musicTick() {
  const st = state();
  let m = 'radio', a = null;                                               // v1.3.3: 경매·결과 말고는 라디오(무작위 연속)
  if (introView || manualView || tutOn()) {}
  else if (welcome) a = 'yard_night';
  else if (view === 'company') a = isNight() ? 'yard_night' : 'yard_day';
  else if (st === 'AUCTION') m = 'auction';
  else if (st === 'RESULT') m = 'result';
  else a = 'mine';
  if (st === 'SURVEY' || st === 'DIG') a = 'mine';
  music(m); ambience(a);
}
setInterval(musicTick, 300);
/** 부팅: 처음이면 [0] → [1], 예전 세이브(v0.6 이전)면 [0]만 보고 넘어감, 다 했으면 첫 화면은 부지 */
function bootOnboarding() {
  const T0 = S.tutorial;
  const legacy = !T0.introSeen && !T0.done && (S.stats.rounds > 0 || (!!S.round && !S.round.card?.tutorial));
  if (!T0.introSeen) showIntro(() => { if (legacy || T0.done) { T0.done = true; save(); firstScreen(); } else { T0.deferred = true; save(); firstScreen(); } });   // 명세6-1: 갱도 1개로 바로 시작
  else if (!T0.done && T0.active && S.round?.card?.tutorial) {}                 // 튜토리얼 원정 이어 하기
  else if (!T0.done && T0.deferred) firstScreen();
  else if (!T0.done && (!T0.active || !S.round?.card?.tutorial)) startTutorialRound();
  else if (T0.done) firstScreen();
}
const SHOW_COMPANY = true;                                   // 명세5 §12-8: 부지 장면(art/yard/yard.px.js) 도착 → 회사 화면 다시
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
  { const cr = label(Y5.credit_line, { ...ink, small: true, color: 0x8a7a68, wrap: w - 16 }); cr.position.set(8, h - Math.ceil(cr.height) - 4); c.addChild(cr); }   // V14 §5 크레딧 한 줄
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
  refreshAdmin(); setTimeout(checkReplies, 1500);
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
async function doLogout() { await pushNow(); await logout(); adminOn = false; cloudReady = false; S.account.userId = null; S.account.nickname = null; save(); buildUI(); toast('로그아웃했어요 (이 기기엔 그대로 남아요)'); }
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
let coTab = 'build', placing = null, coDragged = false;
const roundBusy = () => ['SURVEY', 'DIG'].includes(state());
const SHORT = { office: '사무', warehouse: '창고', cartShed: '차고', lodge: '숙소', smelter: '제련', lanternShop: '랜턴', pumpRoom: '펌프', turretShop: '포탑', moleHouse: '두더', campfire: '불', flag: '깃발', well: '우물', flowers: '꽃', scales: '저울', railDeco: '레일' };
const BCOL = { office: 0x8a5a24, warehouse: 0x6e5440, cartShed: 0x5a5770, lodge: 0x7d5040, smelter: 0x3e3848, lanternShop: 0x46702e, pumpRoom: 0x3d5a9a, turretShop: 0x5a3a4a, moleHouse: 0x8a6c52 };
function openCompany() { view = 'company'; placing = null; upCard = null; sfx('ui_open'); buildUI(); }
function closeCompany() { view = 'mine'; placing = null; upCard = null; buildUI(); }
/** 건물·장식이 바뀌면: 숫자 다시 · 광부 늘리기 · 새 어울림 */
function refreshCompany() {
  autoPlace(S);
  CF = companyFx(S);
  S.idle.capHours = CF.capHours;
  if (S.company.coreLv >= B.company.mineLv && S.floorUnlocked < 2) { S.floorUnlocked = 2; S.auction = null; setTimeout(() => toast('폐광(2층)이 열렸어요! 다음 경매에 나와요', 'halabeoji', 3), 600); }
  S.talents.points = talentPoints(S); S.talents.spent = talentSpent(S);
  if (talentLeft(S) > 0 && S.tutorial.done && SHOW_COMPANY) setTimeout(() => tip('talent'), 900);
  applyMarketFx();
  ensureCrew(true);
  for (const h of harmonies(S)) if (!S.company.harmoniesFound.includes(h.id)) {
    S.company.harmoniesFound.push(h.id);
    toast(`어울림 발견! ${h.name} — ${h.text}`, 'halabeoji', 3); sfx('bell');
  }
}
/** 올리기 · 짓기 (건물 Lv = 장비 Lv). 안 지은 건물은 빈 터를 고르게 (카드가 빈 터에서 열렸으면 거기 바로) */
function coAction(kind, lotId = null) {
  if (coDragged) return;
  const chk = canUp(S, kind);
  if (!chk.ok) { toast(chk.why === '금화 부족' ? '금화가 모자라요' : chk.why); return; }
  const isDeco = !!B.company.decos[kind];
  if (ENGINE_BLD[kind]) { engineBuy(ENGINE_BLD[kind]); return; }   // 명세6-1 엔진 건물
  if (kind === 'office' || (!isDeco && lvOf(S, kind) > 0)) {   // 올리기 (즉시)
    const before = openLots(S).length;
    S.gold -= chk.cost;
    if (kind === 'office') S.company.coreLv++; else S.upgrades[BUILD_UP[kind]]++;
    count('builds'); afterBuild(`${nameOf(kind)} Lv${lvOf(S, kind)}!`);
    if (openLots(S).length > before) setTimeout(() => toast('덤불을 걷었어요! 빈 터가 하나 늘었어요', 'halabeoji', 2.5), 700);
    return;
  }
  if (!isDeco && lotId != null) { buildAt(kind, lotId); return; }
  placing = { kind, cost: chk.cost, move: false, deco: isDeco }; upCard = null; toast(isDeco ? '놓을 자리(반짝이는 곳)를 톡!' : '지을 빈 터(반짝이는 곳)를 톡!'); buildUI();
}
function buildAt(kind, lotId) {
  const cost = canUp(S, kind).cost;
  if (cost == null || S.gold < cost) { toast('금화가 모자라요'); return; }
  S.gold -= cost; S.upgrades[BUILD_UP[kind]]++; count('builds');
  S.company.buildings[kind] = { ...(S.company.buildings[kind] ?? {}), lot: lotId };
  upCard = null; placing = null; afterBuild(`${nameOf(kind)} 지었어요!`);
}
function placeDecoAt(kind, spot) {
  const cost = B.company.decos[kind].cost;
  if (S.gold < cost) { toast('금화가 모자라요'); return; }
  S.gold -= cost; S.company.decos.push({ kind, spot }); count('builds');
  upCard = null; placing = null; afterBuild(`${nameOf(kind)} 놓았어요!`);
}
/** 빈 터 톡: 짓기·옮기기 중이면 거기에 · 건물이면 그 카드 · 빈 터면 짓기 카드 (V12 §4) */
function onLot(id) {
  if (siteDragged) return;
  const user = lotUser(S, id), open = openLots(S).some((l) => l.id === id);
  if (!open) { const k = YARD.lots.filter((l) => l.locked).findIndex((l) => l.id === id); toast(`덤불로 덮인 터예요 · 사무소 Lv${k + 2}에 열려요`); return; }
  if (placing && !placing.deco) {
    if (user) { toast('빈 터를 골라요'); return; }
    const { kind, move } = placing;
    if (!move) { buildAt(kind, id); return; }
    S.company.buildings[kind] = { ...(S.company.buildings[kind] ?? {}), lot: id };
    placing = null; afterBuild(`${nameOf(kind)} 옮겼어요`);
    return;
  }
  upCard = user ? { kind: 'bld', key: user } : { kind: 'lot', lot: id };
  sfx('ui_tap'); buildUI();
}
/** 소품 자리 톡 (장식) */
function onSpot(i) {
  if (siteDragged) return;
  const user = spotUser(S, i);
  if (placing?.deco) {
    if (user) { toast('빈 자리를 골라요'); return; }
    const { kind, move } = placing;
    if (!move) { placeDecoAt(kind, i); return; }
    S.company.decos.find((d) => d.kind === kind).spot = i;
    placing = null; afterBuild(`${nameOf(kind)} 옮겼어요`);
    return;
  }
  upCard = user ? { kind: 'deco', key: user } : { kind: 'spot', spot: i };
  sfx('ui_tap'); buildUI();
}
function afterBuild(msg) { refreshCompany(); sfx(/Lv/.test(msg) ? 'upgrade' : 'build'); toast(msg); bumpCounter('coin'); save(); buildUI(); cloudSoon(); }
const isNight = () => { const hr = (S.tick / TICK_PER_DAY) * 24; return hr < 6 || hr >= 19; };
/** 부지 장면 시간대 (PATCH_V13 §3-1): 06–16 낮 · 16–20 해질녘 · 20–06 밤 */
const yardPhase = () => { const hr = (S.tick / TICK_PER_DAY) * 24; return hr >= 6 && hr < 16 ? 'day' : hr >= 16 && hr < 20 ? 'dusk' : 'night'; };
const YARD_SHADE = { day: 0xffffff, dusk: 0xffe0c8, night: 0xd8d8f0 };   // 목표 합성(docs/ref/yard_v3_*)처럼 건물 색은 거의 그대로
/** 간판 판자 (§3-5): 건물 → 심볼 */
const SIGN_OF = { office: 'bag', lodge: 'bed', smelter: 'anvil', warehouse: 'crate', lanternShop: 'pick', cartShed: 'cart', moleHouse: 'gem', pumpRoom: 'flask', turretShop: 'gear' };

/** 회사 화면 (V12 §4): 부지 장면(세로 3× · 가로·PC 2~3×, 끌어서 봄) + 아래 아이콘 격자. 건물·빈 터를 톡하면 카드 1장 */
function makeCompany(x, y, w, h) {
  const c = new Container();
  const iconH = Math.round(48 / L.uiS), listH = placing ? 30 : 2 * (iconH + 13) + 24;
  const areaH = h - listH;
  c.addChild(new Graphics().rect(x, y, w, areaH).fill(0x2f6a34).rect(x, y, w, areaH).fill({ color: Y5_SHADE[yardPhase()] === 0xffffff ? 0x2f6a34 : 0x1a2440, alpha: yardPhase() === 'day' ? 0 : 0.5 }));   // V14: 장면 밖 = 숲 짙은 초록 (옛 forest_fill 대신)
  const site = makeSite(w, areaH); site.position.set(x, y); c.addChild(site);
  ui.overlayRect = { x: x * L.uiS, y: y * L.uiS, w: w * L.uiS, h: h * L.uiS };
  const tag = label(`🏗 ${openLots(S).length}/${YARD.lots.length}`, { small: true, color: COLOR.gold }); const tg = new Graphics().rect(x + 2, y + 2, Math.ceil(tag.width) + 8, 13).fill({ color: 0x0b0910, alpha: 0.55 }); tag.position.set(x + 6, y + 3); c.addChild(tg, tag);   // 빈 터 n/10 (작게)
  if (state() === 'AUCTION' && !AU.card && isOpen(S, 'expedition')) {   // 첫 화면은 부지 — 원정은 해금(#5) 뒤
    const rb = button('wood', Math.min(w - 8, 180), 18, S.tutorial.done ? '새 원정 — 오늘 경매 ▶' : '첫 원정 떠나기 ▶', startExpedition, { small: true }); rb.position.set(x + Math.round((w - rb.width) / 2), y + areaH - 24); c.addChild(rb); ui.readyBtn = rb;
  }
  const list = placing ? makeCoBar(w, listH) : makeCoGrid(w, listH); list.position.set(x, y + areaH); c.addChild(list);
  return c;
}
/** 짓기·옮기기 중 안내 한 줄 */
function makeCoBar(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const t = label(`${nameOf(placing.kind)}: ${placing.move ? '옮길' : placing.deco ? '놓을' : '지을'} 자리를 톡!`, { color: COLOR.paperInk, shadow: false, small: true }); t.position.set(8, Math.round((h - t.height) / 2)); fitText(t, w - 64); c.addChild(t);
  const x = button('paper', 44, 18, '취소', () => { placing = null; buildUI(); }, { small: true }); x.position.set(w - 50, Math.round((h - 18) / 2)); c.addChild(x);
  return c;
}
/** 아이콘 격자 (V12 §4): 건물 10개(그림 그대로 64px) 2줄 · 밑에 Lv·💰 · 작은 탭 [건물][장식][어울림] */
function makeCoGrid(w, h) {
  const c = new Container();
  c.addChild(frame('paper', w, h, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  coTab = 'build';                                                       // V14: 장식·어울림은 이번엔 숨김 (명세6 재설계 때 다시)
  const tabs = [['build', '건물']];
  const tw = Math.floor((w - 12) / 3);
  tabs.forEach(([key, name], i) => { const tb = tab(tw, name, () => { coTab = key; sfx('stash', true); buildUI(); }); tb.setOn(coTab === key); tb.position.set(6 + i * tw, 3); c.addChild(tb); });
  const top = 20, iconH = Math.round(48 / L.uiS);   // V13 §3-9: 48px 아이콘
  if (coTab === 'harmony') {
    B.company.harmonies.slice(0, 8).forEach((hm, i) => {
      const found = S.company.harmoniesFound.includes(hm.id), on = harmonies(S).some((q) => q.id === hm.id);
      const l = label(`${on ? '✓' : found ? '·' : '?'} ${found || !hm.hidden ? hm.name : '숨은 어울림'}`, { ...ink, small: true, color: on ? 0x46702e : COLOR.paperInk });
      l.position.set(8 + (i % 2) * Math.floor((w - 12) / 2), top + 2 + Math.floor(i / 2) * 14); fitText(l, Math.floor((w - 12) / 2) - 6); c.addChild(l);
    });
    return c;
  }
  const items = coTab === 'build' ? ['office', ...BUILDINGS] : DECOS;
  const cols = 5, cw = Math.min(Math.floor((w - 8) / cols), iconH + 40), rh = iconH + 13, gx0 = Math.round((w - cols * cw) / 2);   // 한 줄 5개 균등 (넓은 화면에서 벌어지지 않게 가운데로)
  items.forEach((k, i) => {
    const x0 = gx0 + (i % cols) * cw, y0 = top + Math.floor(i / cols) * rh;
    const deco = coTab === 'deco', lv = deco ? 0 : lvOf(S, k), have = deco ? S.company.decos.some((d) => d.kind === k) : k === 'office' || lv > 0;
    const chk = canUp(S, k), cost = chk.cost ?? (deco ? null : upCost(S, k));
    const cell = new Container(); cell.position.set(x0, y0); c.addChild(cell);
    if (chk.ok) cell.addChild(new Graphics().roundRect(0, 0, cw - 2, rh - 1, 3).stroke({ width: 1, color: 0xf5cf6a }));
    const art = yardArt(k, lv, iconH - 2); art.scale.set(Math.min(art.scale.x, (cw - 6) / art.texture.width)); art.position.set(Math.round((cw - 2) / 2), iconH + 1); if (!have) art.alpha = 0.45; cell.addChild(art);   // V14 그림을 칸(48px)에 맞춤
    const tx = label(deco ? (have ? '놓음' : `💰${cost}`) : `${have ? `Lv${lv}` : ''}${have && cost != null ? '·' : ''}${cost != null ? `💰${cost}` : have ? '' : '최대'}`, { ...ink, small: true, color: chk.ok ? 0x46702e : 0x8a7a68 });   // Lv·💰 만
    if (!deco && have && cost != null && tx.width > cw - 2) {           // 폰처럼 칸이 좁으면 Lv 는 아이콘 왼쪽 위 뱃지로, 줄에는 💰만
      tx.text = `💰${cost}`; const lb = label(`Lv${lv}`, { small: true, color: COLOR.gold }); const bg = new Graphics().rect(0, 0, Math.ceil(lb.width) + 4, 11).fill({ color: 0x1a1220, alpha: 0.7 }); lb.position.set(2, -1); cell.addChild(bg, lb);
    }
    if (cost != null && tx.width > cw - 2) tx.text = String(cost);           // 그래도 넘치면 💰 빼고 숫자만
    if (!deco && bldLocked(k)) { tx.text = '🔒'; art.alpha = 0.35; }   // 6-3: 해금 전
    fitText(tx, cw - 2); tx.position.set(Math.round((cw - 2 - tx.width) / 2), iconH + 1); cell.addChild(tx);
    cell.eventMode = 'static'; cell.cursor = 'pointer'; cell.hitArea = new Rectangle(0, 0, cw - 2, rh);
    cell.on('pointertap', () => { if (!deco && bldLocked(k)) { toast(`🔒 ${nameOf(k)}: ${needText(BLD_LOCK[k])}이면 열려요`); return; } upCard = { kind: deco ? 'deco' : 'bld', key: k }; sfx('ui_tap'); buildUI(); });
    if (k === 'warehouse') ui.refs.whBuild = cell;
  });
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
const yardWalkers = new Map();                               // 부지 광부 자리 (화면을 다시 그려도 이어서)
let siteDragged = false, yardPan = null, yardPanY = null;   // 끌기 (CSS px, 처음 = 사무소 터 가운데)
/** 장면 배율 (V14 §1, 정수만): 960×540 — PC 2×(1920×1080) · 세로 폰 1× · 가로 폰 1~2× (넘치면 끌어 봄) */
const yardScale = () => (L.portrait ? 1 : Math.max(1, Math.min(2, Math.round((L.full.x1 - L.full.x0) / Y5.size[0]))));
const _y5Sheet = {};
function y5Frames(who, act) {
  const key = `${who}_${act}`; if (_y5Sheet[key]) return _y5Sheet[key];
  const base = y5tex(`chars/${who.startsWith('npc_') ? who : `miner_${who}`}_${act}.png`);
  return (_y5Sheet[key] = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((f) => new Texture({ source: base.source, frame: new Rectangle(f * 40, r * 48, 40, 48) }))));
}
/** 길 그래프 (spine + branches): 걷기는 길 중심선을 따라 */
let _y5Graph = null;
function y5Graph() {
  if (_y5Graph) return _y5Graph;
  const nodes = [], edges = [];
  const add = (line) => { const ids = line.map((p) => nodes.push(p) - 1); for (let i = 1; i < ids.length; i++) edges.push([ids[i - 1], ids[i]]); return ids; };
  const sp = add(Y5.spine);
  for (const br of Y5.branches) { const ids = add(br); let best = sp[0], bd = 1e9; for (const s of sp) { const d = Math.hypot(nodes[s][0] - br[0][0], nodes[s][1] - br[0][1]); if (d < bd) { bd = d; best = s; } } edges.push([best, ids[0]]); }
  const nb = nodes.map(() => []);
  for (const [a, b] of edges) { const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); nb[a].push([b, d]); nb[b].push([a, d]); }
  return (_y5Graph = { nodes, nb });
}
/** a → b 길 따라 가는 점들 (가까운 길 점에 올라타서 내려옴) */
function y5Route(a, b) {
  const { nodes, nb } = y5Graph();
  const near = (p) => nodes.reduce((bi, q, i) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(nodes[bi][0] - p[0], nodes[bi][1] - p[1]) ? i : bi), 0);
  const s = near(a), t = near(b);
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < Math.hypot(nodes[s][0] - a[0], nodes[s][1] - a[1]) + Math.hypot(nodes[t][0] - b[0], nodes[t][1] - b[1])) return [b];   // 길보다 바로 가는 게 가까우면
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = new Set(); dist[s] = 0;
  while (done.size < nodes.length) {
    let u = -1; for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity || u === t) break; done.add(u);
    for (const [v, d] of nb[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const out = []; for (let v = t; v >= 0; v = prev[v]) { out.unshift(nodes[v]); if (v === s) break; }
  return [...out, b];
}
/** 부지 장면 (PATCH_V14): yard5 바닥 4프레임 위에 소품·건물(빈 터)·광부를 바닥 y로 정렬. 장식·어울림은 이번엔 숨김 */
function makeSite(sw, sh) {
  const c = new Container(), phase = yardPhase(), night = phase === 'night', dusk = phase === 'dusk', [SW, SH] = Y5.size;
  const k = yardScale(), shade = Y5_SHADE[phase];
  const view = new Container(); c.addChild(view);
  const mask = new Graphics().rect(0, 0, sw, sh).fill(0xffffff); c.addChild(mask); view.mask = mask;
  const sc = new Container(); view.addChild(sc);
  sc.scale.set(k / L.uiS);
  const PW = sw * L.uiS, PH = sh * L.uiS;                    // 장면 자리 (CSS px)
  const minX = Math.min(0, PW - SW * k), centerX = Math.round((PW - SW * k) / 2), minY = Math.min(0, PH - SH * k), centerY = Math.round((PH - SH * k) / 2);
  const ol = Y5.lots[S.company.buildings.office?.lot ?? 1] ?? Y5.lots[1];
  if (yardPan == null) yardPan = Math.round(PW / 2 - ol.cx * k);
  if (yardPanY == null) yardPanY = Math.round(PH / 2 - (ol.by - 50) * k);
  const clampPanX = (v) => (minX < 0 ? Math.max(minX, Math.min(0, v)) : centerX);
  const clampPanY = (v) => (minY < 0 ? Math.max(minY, Math.min(0, v)) : centerY);
  yardPan = clampPanX(yardPan); yardPanY = clampPanY(yardPanY);
  const placeSc = () => { sc.position.set(Math.round(yardPan) / L.uiS, Math.round(yardPanY) / L.uiS); };
  placeSc();
  if (minX < 0 || minY < 0) {                                  // 끌기 (탭과 구분: 4px 넘게 움직이면 끌기)
    c.eventMode = 'static'; c.hitArea = new Rectangle(0, 0, sw, sh);
    let d0 = null;
    c.on('pointerdown', (e) => { d0 = { x: e.global.x, y: e.global.y, p: yardPan, q: yardPanY }; siteDragged = false; });
    c.on('globalpointermove', (e) => { if (!d0) return; const f = L.W / app.screen.width, dx = (e.global.x - d0.x) * f, dy = (e.global.y - d0.y) * f; if (Math.abs(dx) + Math.abs(dy) > 4) siteDragged = true; yardPan = clampPanX(d0.p + dx); yardPanY = clampPanY(d0.q + dy); placeSc(); });
    const end = () => { d0 = null; setTimeout(() => { siteDragged = false; }, 0); };
    c.on('pointerup', end); c.on('pointerupoutside', end);
  }
  // 1) 바닥 (개울 물결 4프레임 4fps)
  const ground = [0, 1, 2, 3].map((i) => y5tex(`yard_ground_f${i}.png`));
  const bg = new Sprite(ground[0]); bg.tint = shade; sc.addChild(bg);
  bg.eventMode = 'static'; bg.on('pointertap', () => { if (siteDragged) return; if (upCard && !placing) { upCard = null; buildUI(); } });
  // 2) y정렬 한 무리: 소품 + 건물(빈 터) + 사람 — 키 = 바닥 y
  const world = new Container(); world.sortableChildren = true; sc.addChild(world);
  const put = (t, x, by) => { const sp = new Sprite(t); sp.position.set(Math.round(x), Math.round(by - t.height)); sp.tint = shade; sp.zIndex = by; world.addChild(sp); return sp; };
  const fireFr = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => y5tex(`props/campfire_f${i}.png`));
  let fireSp = null;
  for (const o of Y5.objects) {
    if (o.n === 'animation_campfire_f0') { fireSp = put(fireFr[0], o.x, o.by); continue; }
    const t = y5tex(`props/${o.n}.png`); if (t) put(t, o.x, o.by);
  }
  const open = new Set(openLots(S).map((l) => l.id));
  const glows = new Container(), smokes = [];
  const glow = (x, y, r, color, a) => { const g = new Sprite(glowTex()); g.anchor.set(0.5); g.width = g.height = r * 2; g.position.set(x, y); g.tint = color; g.alpha = a; g.blendMode = 'add'; glows.addChild(g); return g; };
  const [sax, say] = Y5A.lot_site, bldSp = {}, flashSp = [];
  const smokeFr = [0, 1, 2, 3, 4, 5].map((i) => y5tex(`bld/smoke_f${i}.png`));
  for (const l of Y5.lots) {
    const user = lotUser(S, l.id);
    if (!user) {                                                 // 빈 터 a(짝수)/b(홀수) · 잠긴 터 — 짓는 순간 사라짐
      put(y5tex(`bld/${open.has(l.id) ? (l.id % 2 ? 'lot_site_b' : 'lot_site_a') : 'lot_site_locked'}.png`), l.cx - sax, l.by - say + 64).zIndex = l.by - 20;
      continue;
    }
    if (bldLocked(user)) { const ls = put(y5tex('bld/lot_site_locked.png'), l.cx - sax, l.by - say + 64); ls.zIndex = l.by - 20; const lk = new Graphics().roundRect(l.cx - 7, l.by - 34, 14, 12, 2).fill(0x3a2e28).rect(l.cx - 4, l.by - 40, 8, 7).stroke({ width: 2, color: 0x8a7a68 }); lk.zIndex = 9000; world.addChild(lk); continue; }   // 6-3: 해금 전 = 예정지 + 자물쇠
    const nm = `${Y5_BLD[user]}_${y5Step(lvOf(S, user))}`, t = y5tex(`bld/${nm}.png`), [ax, ay] = Y5A[nm];
    const sp = put(t, l.cx - ax, l.by - ay + t.height); sp.zIndex = l.by; bldSp[user] = sp;
    if (flashOn(BLD_LOCK[user] ?? ENGINE_BLD[user] ?? user)) flashSp.push(sp);   // 갓 열린 건물 반짝
    if (user === 'smelter') { const [ox, oy] = Y5A[`${nm}_smoke`]; const sm = new Sprite(smokeFr[0]); sm.position.set(sp.x + ox, sp.y + oy); sm.tint = shade; sm.zIndex = l.by + 0.5; world.addChild(sm); smokes.push(sm); }
    if (night || dusk) for (const fx of [0.3, 0.7]) glow(sp.x + t.width * fx, sp.y + t.height * 0.68, 9, 0xffd58a, 0.6);   // 창문 빛
    if ((upCard?.kind === 'bld') && upCard.key === user) { const sel = new Graphics().roundRect(sp.x - 2, sp.y - 2, t.width + 4, t.height + 4, 4).stroke({ width: 1, color: 0xf5cf6a }); sel.zIndex = 9999; world.addChild(sel); }
  }
  // 짓기·옮기기 중: 빈 터 반짝
  const marks = new Graphics(); marks.zIndex = 9998; world.addChild(marks);
  const drawMarks = (t) => {
    marks.clear(); if (!placing || placing.deco) return;
    const a = 0.45 + 0.4 * Math.sin(t * 6);
    for (const l of Y5.lots) if (open.has(l.id) && !lotUser(S, l.id)) marks.roundRect(l.cx - 84, l.by - 50, 168, 56, 8).fill({ color: 0x9cc45a, alpha: a * 0.35 }).stroke({ width: 1, color: 0xf4ecd2, alpha: a });
  };
  // 3) 사람: 광부(브릭·툼바·엘린 + 그룬 할아범)는 V14 그림, 나머지는 옛 그림
  const inRound = ['SURVEY', 'DIG'].includes(state());
  const whL = Y5.lots[S.company.buildings.warehouse?.lot ?? -1];
  const runA = [Y5.entrance[0] - 10, Y5.entrance[1] + 10], runB = whL && lotUser(S, whL.id) === 'warehouse' ? [whL.cx, whL.by + 8] : [Y5.campfire[0], Y5.campfire[1]];
  const spots = Y5.idleSpots;
  const people = [...crew.slice(0, 6).map((m) => ({ id: m.id, tint: m.tint })), { id: 'grun' }];
  const walkers = people.map((m, i) => {
    const who = Y5_MINER[m.id];
    const sp = new Sprite(who ? y5Frames(who, 'idle')[3][0] : animOf(`${m.id}_idle`)[0]);
    if (who) sp.anchor.set(20 / 40, 41 / 48); else { sp.anchor.set(0.5, 1); sp.scale.set(0.5); }
    sp.tint = (m.tint ?? 0xffffff) === 0xffffff ? shade : m.tint; world.addChild(sp);
    let w = yardWalkers.get(m.id);
    if (!w || w.round !== inRound || !w.v5) {                              // 처음 · 라운드 들어가고 나올 때만 자리 다시
      const home = inRound && m.id !== 'grun' ? (i % 2 ? runA : runB) : spots[i % spots.length];
      w = { x: home[0], y: home[1], route: [], wait: inRound ? i * 1.5 : 3 + Math.random() * 15, spot: i % spots.length, round: inRound && m.id !== 'grun', leg: i % 2, dir: 3, v5: true };
      yardWalkers.set(m.id, w);
    }
    return { sp, id: m.id, who, w, f: Math.random() * 4 };
  });
  const freeSpot = (me) => { const used = new Set(walkers.filter((o) => o.w !== me).map((o) => o.w.spot)); const c0 = spots.map((_, j) => j).filter((j) => !used.has(j) && j !== me.spot); return c0[Math.floor(Math.random() * c0.length)] ?? me.spot; };
  const stepWalker = (wk, dt) => {
    const w = wk.w, tg = w.route[0];
    if (w.inside > 0) { w.inside -= dt; wk.sp.visible = false; if (w.inside <= 0) { w.inside = 0; wk.sp.visible = true; w.spot = freeSpot(w); w.route = y5Route([w.x, w.y], spots[w.spot]); w.wait = 20 + Math.random() * 20; } return; }
    if (!tg && w.goIn) { w.goIn = false; w.inside = 8 + Math.random() * 10; return; }
    if (tg) {                                                            // 걷기 (길 따라)
      const dx = tg[0] - w.x, dy = tg[1] - w.y, d = Math.hypot(dx, dy);
      if (d < 0.6) w.route.shift();
      else { const v = Math.min(d, 26 * dt); w.x += (dx / d) * v; w.y += (dy / d) * v; w.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 1) : dy < 0 ? 2 : 3; }
      wk.f += dt * 8;
      if (wk.who) wk.sp.texture = y5Frames(wk.who, 'walk')[w.dir][Math.floor(wk.f) % 4];
      else { const fr = animOf(`${wk.id}_walk`); wk.sp.texture = fr[Math.floor(wk.f) % fr.length]; if (w.dir < 2) wk.sp.scale.x = w.dir === 0 ? 0.5 : -0.5; }
    } else {                                                             // 멈춤 = idle
      wk.f += dt * 4;
      if (wk.who) wk.sp.texture = y5Frames(wk.who, 'idle')[w.dir][Math.floor(wk.f) % 4];
      else { const fr = animOf(`${wk.id}_idle`); wk.sp.texture = fr[Math.floor(wk.f / 2) % fr.length]; }
      if ((w.wait -= dt) <= 0) {
        let to;
        if (w.round) { w.leg = 1 - w.leg; const p = w.leg ? runA : runB; to = [p[0] + (Math.random() - 0.5) * 10, p[1] + (Math.random() - 0.5) * 4]; w.wait = 1 + Math.random() * 2; }   // 라운드 중: 입구 ↔ 창고
        else if (!w.inside && Math.random() < 0.45 && liveMines(S).length) { to = [Y5.entrance[0] + (Math.random() - 0.5) * 10, Y5.entrance[1] + 4]; w.goIn = true; w.wait = 0.2; }   // 갱도로 들어감
        else { w.spot = freeSpot(w); to = spots[w.spot]; w.wait = 20 + Math.random() * 20; }                                                 // 20~40초마다 다른 자리
        w.route = y5Route([w.x, w.y], to);
      }
    }
    wk.sp.position.set(Math.round(w.x), Math.round(w.y)); wk.sp.zIndex = w.y;
  };
  // 두더지 (두더지 집 앞)
  const mh = S.company.buildings.moleHouse, ml = mh && lotUser(S, mh.lot) === 'moleHouse' ? Y5.lots[mh.lot] : null;
  const moleS = new Sprite(F.mole_sniff[0]); moleS.anchor.set(0.5, 1); moleS.tint = shade;
  // 명세6-1 §6: 보이는 엔진 — 입구 더미 · 광차 왕복 · 창고 게이지
  const ent = [Y5.entrance[0] - 18, Y5.entrance[1] + 14];
  const whDoor = whL && lotUser(S, whL.id) === 'warehouse' ? [whL.cx, whL.by + 10] : null;
  const pileG = new Graphics(); pileG.position.set(ent[0] - 34, ent[1] + 4); pileG.zIndex = ent[1] + 4; world.addChild(pileG);
  const fullT = label('가득', { small: true, color: 0xff6a5a }); fullT.scale.set(L.uiS / k); fullT.anchor?.set?.(0.5, 1); fullT.position.set(pileG.x, pileG.y - 12); fullT.zIndex = 9990; world.addChild(fullT);
  const route = whDoor ? y5Route(ent, whDoor) : null, rPts = route ? [ent, ...route] : null;
  const rLen = rPts ? rPts.slice(1).reduce((q, p, i) => q + Math.hypot(p[0] - rPts[i][0], p[1] - rPts[i][1]), 0) : 0;
  const rAt = (d) => { for (let i = 0; i < rPts.length - 1; i++) { const l = Math.hypot(rPts[i + 1][0] - rPts[i][0], rPts[i + 1][1] - rPts[i][1]); if (d <= l) { const f = l ? d / l : 0; return [rPts[i][0] + (rPts[i + 1][0] - rPts[i][0]) * f, rPts[i][1] + (rPts[i + 1][1] - rPts[i][1]) * f]; } d -= l; } return rPts[rPts.length - 1]; };
  const cartSp = rPts ? [...Array(cartOfS(S).n)].map(() => { const c0 = new Sprite(F.cart_roll[0]); c0.anchor.set(0.5, 1); c0.tint = shade; world.addChild(c0); return c0; }) : [];
  const gauge = new Graphics(); gauge.zIndex = 9991; world.addChild(gauge);
  // 십장 (6-3 §2): 일하는 자리에 서 있고 머리 위 작은 깃발 · 톡 → 십장 카드
  for (const [k, at] of [['marta', whDoor ? [whDoor[0] + 26, whDoor[1] + 4] : null], ['dor', bldSp.smelter ? [bldSp.smelter.x + bldSp.smelter.width - 14, bldSp.smelter.y + bldSp.smelter.height + 4] : null], ['fin', [Y5.entrance[0] - 50, Y5.entrance[1] + 22]]]) {
    if (!S.foremen?.[k]?.hired || !at) continue;
    const fsp = new Sprite(y5Frames(k, 'idle')[3][0]); fsp.anchor.set(0.5, 41 / 48); fsp.position.set(at[0], at[1]); fsp.zIndex = at[1]; fsp.tint = S.foremen[k].on ? shade : 0x8a8a8a; world.addChild(fsp);
    const fl = new Graphics().rect(at[0] + 6, at[1] - 44, 1, 10).fill(0x4a3020).poly([at[0] + 7, at[1] - 44, at[0] + 14, at[1] - 41, at[0] + 7, at[1] - 38]).fill(S.foremen[k].on ? 0xf5cf6a : 0x8a7a68); fl.zIndex = at[1] + 0.1; world.addChild(fl);
    fsp.eventMode = 'static'; fsp.cursor = 'pointer'; fsp.on('pointertap', () => { if (!siteDragged) openForemen(); });
  }
  moleS.position.set(ml ? ml.cx + 60 : Y5.campfire[0] - 30, ml ? ml.by + 10 : Y5.campfire[1] + 14); moleS.zIndex = moleS.y; world.addChild(moleS);
  // 탭 자리 (그림 위 투명 판)
  for (const l of Y5.lots) { const hit = new Container(); hit.eventMode = 'static'; hit.cursor = 'pointer'; hit.hitArea = new Rectangle(l.cx - 90, l.by - 140, 180, 150); hit.on('pointertap', () => { if (siteDragged) return; const u0 = lotUser(S, l.id); if (u0 && bldLocked(u0)) { toast(`🔒 ${nameOf(u0)}: ${needText(BLD_LOCK[u0])}이면 열려요`); return; } if (!placing && u0 === 'warehouse') { openStorage(); return; } onLot(l.id); }); sc.addChild(hit); }
  { const eh = new Container(); eh.eventMode = 'static'; eh.cursor = 'pointer'; eh.hitArea = new Rectangle(Y5.entrance[0] - 70, Y5.entrance[1] - 60, 110, 80); eh.on('pointertap', () => { if (!siteDragged) { sfx('ui_tap'); openMines(); } }); sc.addChild(eh); ui.refs.mineEntrance = eh; }   // 명세6-1 §6 갱도 목록
  // 4) 밤·해질녘 글로우: 가로등 · 모닥불 · 갱도 입구 (UI 아래, 장면 맨 위)
  const lampGlows = night || dusk ? Y5.lamps.map(([lx, ly], i) => { const g = glow(lx, ly, 18, 0xffd58a, 0.55); g.seed = i * 1.7; return g; }) : [];
  if (night || dusk) { glow(Y5.campfire[0], Y5.campfire[1] - 8, 30, 0xffb27a, 0.6); glow(Y5.entrance[0], Y5.entrance[1] - 14, 24, 0xffb27a, 0.5); }
  if (!night) glows.alpha = 0.6;
  sc.addChild(glows);
  let tt = 0;
  ui.coTick = (dt) => {
    tt += dt; drawMarks(tt);
    if (yardPhase() !== phase) { ui.coTick = null; setTimeout(buildUI, 0); return; }      // 낮 → 해질녘 → 밤 바뀌면 장면 다시
    if (bg.destroyed) return;
    bg.texture = ground[Math.floor(tt * 4) % 4];
    if (fireSp) fireSp.texture = fireFr[Math.floor(tt * 8) % 8];
    for (const sp of flashSp) if (!sp.destroyed) sp.tint = S.playSec < (S.unl?.flash?.until ?? 0) && Math.floor(tt * 4) % 2 ? 0xfff2b0 : shade;
    const smelting = (S.smelt?.jobs?.length ?? 0) > 0;
    for (const sm of smokes) { sm.visible = smelting; sm.texture = smokeFr[Math.floor(tt * 6) % 6]; }
    { // 입구 더미 (가득이면 빨간 글자)
      const pc = pileCapOf(S.engine.lv.warehouse), f = Math.min(1, pileOf(S) / Math.max(1, pc)), r0 = 4 + 12 * f;
      pileG.clear(); if (f > 0.01) { pileG.ellipse(0, 0, r0, r0 * 0.55).fill(0x6a5240).ellipse(0, -r0 * 0.15, r0 * 0.75, r0 * 0.4).fill(0x8a6c52); for (let i = 0; i < Math.round(f * 7); i++) pileG.rect(Math.round(Math.sin(i * 2.3) * r0 * 0.6), Math.round(-r0 * 0.25 + Math.cos(i * 1.7) * r0 * 0.2), 2, 2).fill([0xd38a4a, 0xc8c8d8, 0xf5cf6a][i % 3]); }
      pileG.tint = shade; fullT.visible = f >= 0.99 && Math.floor(tt * 2) % 2 === 0;
      // 광차: 입구 → 창고 (실음) → 입구 (빈 차), 왕복 = trip초
      const co = cartOfS(S), moving = whTotal() < whCap() && pileOf(S) > 0.5;
      cartSp.forEach((c0, i) => {
        if (i >= co.n) { c0.visible = false; return; }
        const ph = moving ? ((tt + (i * co.trip) / co.n) % co.trip) / co.trip : (i / co.n) * 0.05;
        const out = ph < 0.5, d = (out ? ph * 2 : 2 - ph * 2) * rLen, [px, py] = rAt(d), [qx] = rAt(Math.min(rLen, d + 2));
        const fr = out ? F.cart_roll : F.cart_roll_empty; c0.texture = moving ? fr[Math.floor(tt * 10) % fr.length] : F.cart_roll_empty[0];
        c0.scale.x = (out ? qx >= px : qx < px) ? 1 : -1; c0.position.set(Math.round(px), Math.round(py)); c0.zIndex = py; c0.visible = true;
      });
      // 창고 게이지
      gauge.clear(); const ws = bldSp.warehouse;
      if (ws) { const gw = 60, gx = ws.x + ws.width / 2 - gw / 2, gy = ws.y - 8, wf = Math.min(1, whTotal() / Math.max(1, whCap())), pul = yardPulseT.wh && time - yardPulseT.wh < 0.3;
        gauge.rect(gx - 1, gy - 1, gw + 2, 7).fill({ color: 0x1a1220, alpha: 0.8 }).rect(gx, gy, Math.round(gw * wf), 5).fill(wf >= 1 ? 0xd84a3a : pul ? 0xfff0a0 : 0xd39a3a); }
    }
    for (const g of lampGlows) { const f = 0.55 * Math.sin(tt * 6.3 + g.seed) + 0.3 * Math.sin(tt * 18.8 + g.seed * 2); g.alpha = 0.5 + 0.1 * f; g.width = g.height = 36 * (1 + 0.05 * f); }
    for (const wk of walkers) stepWalker(wk, dt);
    moleS.texture = F.mole_sniff[Math.floor(tt * 4) % F.mole_sniff.length];
  };
  drawMarks(0);
  return c;
}
/** 부지 장면 그림 (PATCH_V10 · 형철 ③): 64×64 원본 1× — 축소 없음. Lv1·2 → _1, 중간 → _3, 최대 → _5 */
function yardArt(kind, lv, box = 48 / L.uiS) {
  const sp = new Sprite(y5tex(`bld/${Y5_BLD[kind] ?? 'office'}_${y5Step(Math.max(1, lv))}.png`)); sp.anchor.set(0.5, 1);
  sp.scale.set(Math.min(box / sp.texture.height, (box * 1.4) / sp.texture.width)); return sp;
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
  const r = lv / bldMax(kind), step = kind === 'office' ? (lv >= 5 ? 5 : lv >= 3 ? 3 : 1) : r >= 1 ? 5 : r >= 0.5 ? 3 : 1;
  const gStep = [...GPT_STEPS].reverse().find((l) => l <= step);
  const gpt = gStep && tex(`g_${BLD_ART[kind]}_${gStep}`);
  sp = new Sprite(gpt || tex(`${BLD_ART[kind]}_${step}`));
  sp.anchor.set(0.5, 1);
  sp.scale.set((ss * 1.04) / (gpt ? 128 : 48));                // 한 칸 가득 (GPT 128px = PC에서 1:1)
  return sp;
}
/** 특성 트리: 3갈래 × 5단 (위에서부터 1점씩) */
function makeTalents(tw, th) {
  const c = new Container();
  c.addChild(frame('paper', tw, th, 'panel'));
  const ink = { color: COLOR.paperInk, shadow: false };
  const pts = talentPoints(S), left = talentLeft(S);
  const t = label(`남은 포인트 ${left} / ${pts}`, ink); t.position.set(8, 6); c.addChild(t);
  const sub = label('포인트 = 평판(이사) + 원정 ★3 땅마다 1 · 위에서부터 · 두 칸 줄은 하나만', { ...ink, small: true, color: 0x8a7a68, wrap: tw - 16 }); sub.position.set(8, 20); c.addChild(sub);
  const top = 22 + Math.ceil(sub.height) + 6, colW = Math.floor((tw - 16) / 3);
  const rowsN = talentRows('survey').length, cellH = Math.max(20, Math.min(40, Math.floor((th - top - 40) / rowsN) - 3));
  TALENT_TREES.forEach(([tree, name], ci) => {
    const x0 = 8 + ci * colW, rows = talentRows(tree), nextR = talentNextRow(S, tree);
    const hd = label(name, { ...ink, color: 0x8a5a24 }); hd.position.set(x0 + Math.round((colW - 2 - hd.width) / 2), top); c.addChild(hd);
    rows.forEach((row, ri) => {
      const y = top + 16 + ri * (cellH + 3), cw = Math.floor((colW - 3 - (row.length - 1) * 2) / row.length);
      row.forEach((cl, j) => {
        const learned = hasTalent(S, tree, cl), skipped = !learned && row.some((q) => hasTalent(S, tree, q)), next = ri === nextR;
        const cell = new Container(); cell.position.set(x0 + j * (cw + 2), y); c.addChild(cell);
        cell.addChild(frame(learned ? 'wood' : next ? 'paper' : 'stone', cw, cellH, 'panel'));
        if (next && left > 0) cell.addChild(new Graphics().rect(0, 0, cw, cellH).stroke({ width: 1, color: 0x6a9a3a }));
        const l = label(B.talents[tree][cl], { small: true, color: learned ? COLOR.gold : skipped ? 0x8a7a68 : next ? COLOR.paperInk : COLOR.dim, shadow: learned, wrap: cw - 6 });
        l.position.set(3, Math.max(1, Math.round((cellH - l.height) / 2))); cell.addChild(l);
        if (l.height > cellH - 2) l.scale.set((cellH - 2) / l.height);
        if (skipped) cell.alpha = 0.5;
        if (next) { cell.eventMode = 'static'; cell.cursor = 'pointer'; cell.on('pointertap', () => learnTalent(tree, cl)); if (j === 0) ui.refs[`talent_${tree}`] = cell; }
      });
      if (row.length === 2) { const vs = label('or', { small: true, color: 0x8a7a68, shadow: false }); vs.position.set(x0 + Math.round(colW / 2 - vs.width / 2) - 1, y + cellH - 10); c.addChild(vs); }
    });
  });
  const free = !S.talents.freeResetUsed;
  const rs = button('paper', 70, 16, free ? '초기화 무료' : `초기화 ${B.talents.resetCost}`, resetTalents, { small: true });
  rs.setDisabled(!talentSpent(S) || (!free && S.gold < B.talents.resetCost)); rs.position.set(tw - 76, th - 22); c.addChild(rs);
  return c;
}
function openTalents() { talentView = true; sfx('ui_open'); buildUI(); }
function makeTalentView() {
  const uW = Math.round(L.W / L.uiS), uH = Math.round(L.H / L.uiS), w = Math.min(uW - 12, 340), h = Math.min(uH - 24, 440);
  const box = new Container();
  const dim = new Graphics().rect(0, 0, uW, uH).fill({ color: 0x0a0812, alpha: 0.55 }); dim.eventMode = 'static'; box.addChild(dim);
  const c = makeTalents(w, h); c.position.set(Math.round((uW - w) / 2), Math.round((uH - h) / 2)); box.addChild(c);
  const x = button('wood', 50, 16, '닫기', () => { talentView = false; buildUI(); }, { small: true }); x.position.set(w - 56, 5); c.addChild(x); ui.refs.talentClose = x;
  ui.overlayRect = { x: 0, y: 0, w: L.W, h: L.H };
  return box;
}
function learnTalent(tree, cell) {
  if (talentLeft(S) <= 0) { toast('포인트가 없어요 · 원정 ★3 땅이나 평판(이사)으로 생겨요'); return; }
  const r = talentNextRow(S, tree); if (r < 0) return;
  const row = talentRows(tree)[r]; if (cell == null) cell = row[0]; if (!row.includes(cell)) return;
  S.talents.cells[tree].push(cell);
  refreshCompany(); sfx('talent');
  popTalent(B.talents.pop[tree][cell], tree);
  for (const a of crew) if (a.state !== 'rest') emote(a, '오!', 1.4);
  save(); buildUI(); cloudSoon();
}
// ---- 찍는 순간 연출 (명세5 §4): 화면 가운데에서 숫자가 튀어 오르고 금빛 가루
const popLayer = new Container(); const pops = [];
const TREE_COLOR = { survey: 0x8ad0ff, dig: 0xf5cf6a, trade: 0x9cdc6a };
function popTalent(text, tree) {
  if (!popLayer.parent) app.stage.addChild(popLayer);
  const t = label(text, { color: TREE_COLOR[tree] ?? COLOR.gold }); t.anchor?.set?.(0.5);
  popLayer.addChild(t);
  pops.push({ t, age: 0, sparks: Array.from({ length: 14 }, (_, i) => ({ g: new Graphics().rect(-1, -1, 2, 2).fill(TREE_COLOR[tree] ?? 0xf5cf6a), a: (i / 14) * Math.PI * 2, v: 40 + Math.random() * 50 })) });
  for (const sp of pops[pops.length - 1].sparks) popLayer.addChild(sp.g);
}
function updatePops(dt) {
  if (!popLayer.parent) return;
  app.stage.setChildIndex(popLayer, app.stage.children.length - 1);
  const cx = L.W / 2, cy = L.H * 0.38, sc = L.uiS * 1.4;
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.age += dt;
    const k = Math.min(1, p.age / 0.25), up = p.age * 30 * L.uiS, a = p.age < 1.1 ? 1 : Math.max(0, 1 - (p.age - 1.1) / 0.5);
    p.t.scale.set(sc * (0.6 + 0.5 * k - 0.1 * Math.min(1, Math.max(0, p.age - 0.25) / 0.2)));
    p.t.position.set(Math.round(cx - p.t.width / 2), Math.round(cy - up - p.t.height / 2)); p.t.alpha = a;
    for (const sp of p.sparks) { const r = sp.v * p.age * L.uiS; sp.g.position.set(cx + Math.cos(sp.a) * r, cy + Math.sin(sp.a) * r + p.age * p.age * 60); sp.g.scale.set(L.uiS); sp.g.alpha = Math.max(0, 1 - p.age / 0.9); }
    if (p.age > 1.6) { p.t.destroy(); for (const sp of p.sparks) sp.g.destroy(); pops.splice(i, 1); }
  }
}
function resetTalents() {
  const free = !S.talents.freeResetUsed;
  if (!free) { if (S.gold < B.talents.resetCost) { toast('금화가 모자라요'); return; } S.gold -= B.talents.resetCost; } else S.talents.freeResetUsed = true;
  S.talents.cells = { survey: [], dig: [], trade: [] };
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
  const i = B.guilds.indexOf(g), v = cardValue(card).mid * CF.guildMul * (1 + (Math.random() * 2 - 1) * XP().guildEye);   // 명세6-2 §3-1: 성격 범위 × 눈대중 ±10%
  return Math.round(v * rndIn(XP().guildCap[GKEY[i]]));
}
const nextBid = () => (AU.holder == null ? AU.card.price : Math.round(AU.high * (1 + XP().auction.raiseStep)));
const reactSec = () => rndIn(XP().auction.react);
/** 경매 건너뛰고 공짜 자투리 구획 (힌트 없음) */
function goFreePlot() { auctionSettings = false; AU.card = null; startRound(freeCard(newSeed(), CF.freeHint ? 1 : 0), 0); }
let auctionSettings = false;                                // 경매 고르기 화면에서 [설정]을 눌렀을 때만 아래 시트를 보임
function pickCard(card) {
  auctionSettings = false;
  if (ensureExp().tickets <= 0) { toast('오늘 원정 표를 다 썼어요 · 내일 06:00에 새로'); return; }
  const part = card.guilds ?? [0, 1, 2];
  Object.assign(AU, { card, phase: 'bid', high: card.price, holder: null, me: null, endAt: null, react: 0, count: 0, out: [0, 1, 2].map((i) => !part.includes(i)), part, bids: [null, null, null] });
  AU.say = GUILD_LINES.map((l, i) => (part.includes(i) ? { text: l.enter, line: true, t: time + 0.15 + part.indexOf(i) * 0.45, intro: true } : null));   // 참가 길드만 등장 한마디
  AU.caps = B.guilds.map((g) => guildCap(card, g));
  buildUI();
}
/** [올리기 +10%] — 처음 누르면 시작가로 입찰 */
function playerRaise() {
  if (AU.phase !== 'bid' || AU.holder === 'me') return;
  const price = nextBid();
  if (price > S.gold) { toast('금화가 모자라요'); return; }
  AU.high = price; AU.holder = 'me'; AU.me = price; AU.react = reactSec(); AU.count = 0;
  AU.say = AU.say.map((t) => (t ? { ...t, old: true, intro: false } : t));
  sfx('bid');
  buildUI();
}
/** 길드가 따라온다: 한도 안이면 한 곳이 +10% (공격적인 순서로), 한도를 넘은 곳은 포기 */
function guildRespond() {
  const next = Math.round(AU.high * (1 + XP().auction.raiseStep));
  let raised = false;
  for (const i of [0, 2, 1].filter((q) => AU.part?.includes(q) ?? true)) {
    if (AU.out[i]) continue;
    if (next > AU.caps[i]) { AU.out[i] = true; AU.say[i] = { text: pick(GUILD_LINES[i].pass), pass: true, t: time }; sfx('pass', true); continue; }
    if (raised) continue;
    raised = true;
    AU.high = next; AU.holder = i; AU.bids[i] = next;
    AU.say[i] = { text: fill(pick(GUILD_LINES[i].raise), { g: next }), price: next, pass: false, t: time }; sfx('bid');
  }
  if (!raised) { AU.phase = 'count'; AU.count = XP().auction.hammer; }   // 아무도 안 따라옴 → 3·2·1
  buildUI();
}
function playerFold() {
  if (AU.phase !== 'bid') return;
  AU.me = '포기';
  if (AU.holder == null) {                                        // 아직 아무도 안 불렀으면: 한도가 가장 높은 길드가 시작가에
    const live = (AU.part ?? [0, 1, 2]); const i = live.reduce((m, q) => (AU.caps[q] > AU.caps[m] ? q : m), live[0]); AU.holder = i; AU.bids[i] = AU.high;
  }
  auctionLost();
}
/** 낙찰 (플레이어): 망치 쾅 + 도장 · 길드 하나가 한마디 */
function auctionWon() {
  count('wins');
  AU.phase = 'won'; AU.timer = 1.3; AU.endAt = time;
  const pp = AU.part?.length ? AU.part : [0, 1, 2], i = pp[Math.floor(Math.random() * pp.length)];
  AU.say = AU.say.map((q) => (q ? { ...q, old: true } : q)); AU.say[i] = { text: pick(GUILD_LINES[i].lose), line: true, t: time + 0.5 };
  AU.card.status = 'mine'; ensureExp().tickets--; S.exp.n++; save();
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
  if (w != null) { AU.card.status = 'guild'; AU.card.owner = w; const g = ensureExp().guilds[w]; g.asset += cardValue(AU.card).mid; g.mines++; save(); }   // §3-2: 길드 깃발 · 내일 소식
  toast('길드가 가져갔어요 · 남은 땅으로 원정할 수 있어요', 'halabeoji', 3);
  if (w != null) { sfx('gavel'); setTimeout(() => sfx('stamp'), 220); shake = 0.2; shakeAmp = 1.5; }
  buildUI();
}
/** 낙찰 뒤: 노른자 땅이면 25%로 길드가 되사겠다고 — [팔기]면 차익 · 원정 표 돌려받음 */
function afterWin(card, paid) {
  if (card.kind === 'prime' && Math.random() < XP().rebuyChance) {
    const gi = (card.guilds ?? [0])[Math.floor(Math.random() * (card.guilds?.length || 1))], offer = r10(paid * rndIn(XP().rebuyMul)), g = B.guilds[gi];
    openPanel('🤝 되사겠다는 제안', `<p><b>${g.name}</b>: "그 땅, ${offer}금에 넘기지 않겠나?"</p><p>낙찰가 ${paid} → 차익 <b>+${offer - paid}</b> · 원정 표는 돌려받아요</p><div class="krow"><button class="ksell">팔기 +${offer - paid}</button><button class="kgo">원정 떠나기</button></div>`, (b, close) => {
      b.querySelector('.ksell').onclick = () => { close(); S.gold += offer - paid; S.exp.tickets++; card.status = 'guild'; card.owner = gi; const gg = S.exp.guilds[gi]; gg.asset += cardValue(card).mid; gg.mines++; AU.card = null; AU.phase = 'pick'; sfx('coin_big'); toast(`되팔았어요 +${offer - paid}`, 'halabeoji', 2.5); bumpCounter('coin'); save(); buildUI(); };
      b.querySelector('.kgo').onclick = () => { close(); startRound(card, paid); };
    });
    S.gold -= 0; return;
  }
  startRound(card, paid);
}
function buyCheap(card) {
  if (ensureExp().tickets <= 0) { toast('오늘 원정 표를 다 썼어요 · 내일 06:00에 새로'); return; }
  if (S.gold < card.price) { toast('금화가 모자라요'); return; }
  card.status = 'mine'; S.exp.tickets--; S.exp.n++; sfx('stamp'); startRound(card, card.price);
}
let countShown = -1;
function updateAuction(dt) {
  if (AU.phase === 'bid' && AU.holder === 'me' && AU.react > 0) { AU.react -= dt; if (AU.react <= 0) guildRespond(); }
  else if (AU.phase === 'bid' && AU.holder === 'me' && !AU.react) AU.react = reactSec();
  else if (AU.phase === 'count') {
    AU.count -= dt;
    const n = Math.ceil(AU.count);   // 3·2·1
    if (n !== countShown) { countShown = n; if (n > 0) sfx('ui_tap'); buildUI(); }
    if (AU.count <= 0) auctionWon();
  } else if (AU.phase === 'won' || AU.phase === 'lost') {
    AU.timer -= dt;
    if (AU.timer <= 0) {
      if (AU.phase === 'won') afterWin(AU.card, AU.high);
      else { AU.card = null; AU.phase = 'pick'; buildUI(); }                 // 졌으면 지도로 (헛걸음 없음)
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
  if (tutOn()) { if (ui.survey) ui.survey.text = S.tutorial.sniffed ? '탐사 끝을 눌러요' : '꼬물이를 지켜봐요'; return; }
  rd.surveyLeft = Math.max(0, rd.surveyLeft - dt);
  if (rd.surveyLeft <= 0 && !(rd.vibroLeft > 0) && !(rd.xrayLeft > 0) && !rd.stakes?.some((q) => q.at > time)) { startDig(); return; }
  if (ui.survey) ui.survey.text = rd.surveyLeft > 0 ? `🐾${Math.ceil(rd.surveyLeft)}` : '🐾✓';   // V12 §8: 아이콘 + 숫자
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
      if (size) { mole.wait = 0.6 + size * 0.12; mole.x = GX + after * T + 8; sfx('mole_sniff', true); if (!S.round.paws?.includes(after)) { (S.round.paws ??= []).push(after); drawSurvey(); } emote(mole, (vt ? ORES.find((o) => o.key === vt).name + ' ' : '') + (CF.sniffSize ? `킁킁 ${'•'.repeat(size >= CF.bigVein ? 3 : size >= 6 ? 2 : 1)}` : '킁킁'), 0.6 + size * 0.12, vt ? ORE_COLOR[vt] : undefined); }
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
const vibroUses = () => vibroV('uses') + CF.vibroAdd;
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
  const nTrue = out.length, nFalse = Math.round(nTrue * (1 - CF.clueTruth) / CF.clueTruth);
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
  const tst = tutStep(); if (tst && tst.vibroX != null && gx !== tst.vibroX) { tutShake(); return false; }
  rd.vibroLeft--; toolArmed = null;
  const st = { x: gx, text: '…', color: null, at: time + TV.vibro.seconds };
  rd.stakes.push(st); sfx('ui_tap'); shake = 0.15; shakeAmp = 0.8;
  setTimeout(() => resolveStake(st), TV.vibro.seconds * 1000);
  drawSurvey(); buildUI(); syncRound();
  return true;
}
/** 말뚝 결과 채우기 (3초 뒤 · 새로고침으로 타이머가 끊긴 말뚝도 다시) */
function resolveStake(st, quiet = false) {
  if (!W || !st || (st.text !== '…' && st.text !== '?')) return;
  const gx = st.x;
  let id = -1, d = 0;
  for (let y = 0; y < W.rows && id < 0; y++) { const v = W.veins.id[y][gx]; if (v >= 0 && ORE_KEYS.has(W.g[y][gx])) { id = v; d = y + 1; } }
  if (id < 0) { st.text = '없음'; }
  else {
    const v = W.veins.list[id], r = tutOn() ? 1 : Math.max(1, vibroV('range') - CF.vibroRangeMinus), lo = tutOn() ? d : Math.max(1, d - Math.floor(Math.random() * (r + 1)));
    const word = TV.sizeWords.find(([n]) => v.size <= n)[1];
    st.text = `깊이 ${lo}~${lo + r} · ${word}`;
    if (vibroV('color')) { st.color = ORE_COLOR[v.type]; st.text += ` ${ORES.find((o) => o.key === v.type)?.name ?? ''}`; }
  }
  st.at = 0; if (!quiet) sfx(id < 0 ? 'pass' : 'vein_found', true); drawSurvey(); syncRound();
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
  if (CF.silhouette) for (const v of W.veins.list) for (const [x, y] of v.cells) {   // 탐사 8단: 광맥 전체 실루엣
    if (!ORE_KEYS.has(W.g[y][x]) || revealed(x, y)) continue;
    g.rect(GX + x * T + 2, GY + y * T + 2, T - 4, T - 4).stroke({ width: 1, color: 0xf4ecd2, alpha: 0.35 });
  }
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

/** PATCH_V12 §1: 화면 = HUD 띠 / 게임 / 시트 세 띠. 세로 폰 · 가로 폰·패드 · PC 한 규칙.
 *  시트는 게임 위를 덮는다(펼쳐도 게임 크기는 그대로). 갱도 칸은 정수 배율(기기 px / 텍스처 px), 여백이 8% 넘으면 한 단계 키워 게임 쪽으로 양보(넘치면 끌어 봄). */
function computeLayout() {
  const Wd = window.innerWidth, H = window.innerHeight, dpr = R.resolution;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const mode = H >= Wd * 0.9 ? 'portrait' : Wd < 1100 || coarse ? 'landscape' : 'pc';
  const folded = mode !== 'pc' && !!S.settings.sheetFolded;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let uiS, hud, sheet, tabs, vis, full;
  if (mode === 'portrait') {
    uiS = clamp(Math.floor(Wd / 195), 2, 3);
    const hudH = Math.max(Math.round(H * 0.07), 22 * uiS), tabH = Math.max(Math.round(H * 0.06), 20 * uiS), openY = Math.round(H * 0.6);
    hud = { x: 0, y: 0, w: Wd, h: hudH };
    tabs = { x: 0, y: H - tabH, w: Wd, h: tabH };
    sheet = folded ? tabs : { x: 0, y: openY, w: Wd, h: H - openY };
    vis = { x0: 0, x1: Wd, y0: hudH, y1: H - tabH, above: 3 };
    full = { x0: 0, x1: Wd, y0: hudH, y1: H };
  } else if (mode === 'landscape') {
    uiS = clamp(Math.floor(H / 180), 2, 3);
    const side = Math.max(Math.round(Wd * 0.12), 46 * uiS), openW = Math.min(Math.round(Wd * 0.5), Math.max(Math.round(Wd * 0.32), 180 * uiS));
    hud = { x: 0, y: 0, w: side, h: H };
    tabs = { x: Wd - side, y: 0, w: side, h: H };
    sheet = folded ? tabs : { x: Wd - openW, y: 0, w: openW, h: H };
    vis = { x0: side, x1: Wd - side, y0: 0, y1: H, above: 3 };
    full = { x0: side, x1: Wd, y0: 0, y1: H };
  } else {
    uiS = clamp(Math.floor(H / 330), 2, 3);
    const hudH = Math.max(Math.round(H * 0.06), 22 * uiS), sw = Math.max(Math.round(Wd * 0.24), 160 * uiS);
    const gw = Math.min(Wd - sw, Math.round(H * 1.4)), gx = Math.round((Wd - sw - gw) / 2);
    hud = { x: 0, y: 0, w: Wd, h: hudH };
    sheet = tabs = { x: Wd - sw, y: hudH, w: sw, h: H - hudH };
    vis = { x0: gx, x1: gx + gw, y0: hudH, y1: H, above: 3 };
    full = { x0: 0, x1: Wd, y0: hudH, y1: H };                     // 경매·회사(시트 없음)는 폭 전체
  }
  // 정수 배율: 텍스처 1px(= 칸 32분의 1) = 기기 k px
  const visW = vis.x1 - vis.x0, visH = vis.y1 - vis.y0;
  const fit = Math.min((visW * dpr) / (12 * T * DENS), mode === 'portrait' ? Infinity : (visH * dpr) / ((16 + vis.above) * T * DENS));
  let kk = Math.max(1, Math.floor(fit));
  if (kk / fit < 0.92) kk += 1;                                     // 여백 > 8% → 한 단계 키움
  const cell = (T * DENS * kk) / dpr;
  const panels = { hud, sheet };
  const sc = cell / T;
  const gridW = 12 * cell, gridH = GH * cell;
  const gridLeft = vis.x0 + (visW - gridW) / 2;
  const gridTop = vis.y0 + vis.above * cell;                       // 지상 띠는 늘 보이고, 넘치는 격자는 세로로 끌어 본다
  const overX = Math.max(0, gridW - visW) / sc, overY = Math.max(0, gridTop + gridH + cell * 0.5 - vis.y1) / sc;
  return { W: Wd, H, dpr, mode, portrait: mode === 'portrait', landscape: mode === 'landscape', pc: mode === 'pc', cell, sc, uiS, gridLeft, gridTop, panels, tabs, full, overX, overY, vis, colX: vis.x0, colW: visW };
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
window.addEventListener('orientationchange', () => setTimeout(layout, 120));   // §1: 회전하면 바로 다시 배치
const sheetOpen = () => L.pc || !S.settings.sheetFolded;
function setSheet(open, tabKey) { if (tabKey) sheetTab = tabKey; if (L.pc) { buildUI(); return; } S.settings.sheetFolded = !open; save(); layout(); }

const toWorld = (sx, sy) => [((sx - display.x) / display.scale.x + cam.rx) / DENS, ((sy - display.y) / display.scale.y + cam.ry) / DENS];
const toScreen = (x, y) => [display.x + (x * DENS - cam.rx) * display.scale.x, display.y + (y * DENS - cam.ry) * display.scale.y];
const inRect = (r, sx, sy) => r && sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h;
const inPanels = (sx, sy) => !!introView || tutBlocks(sx, sy) || inRect(ui.overlayRect2, sx, sy) || inRect(ui.toolRect, sx, sy) || Object.values(L.panels).some((p) => sx >= p.x && sx < p.x + p.w && sy >= p.y && sy < p.y + p.h)
  || (ui.overlayRect && sx >= ui.overlayRect.x && sx < ui.overlayRect.x + ui.overlayRect.w && sy >= ui.overlayRect.y && sy < ui.overlayRect.y + ui.overlayRect.h);

// ================================================================ UI (art/ui/ui.px.js 틀 · 인물은 틀 안에서만)
let ui = {};
let sheetTab = 'sell';
const SHEET_TABS = [['sell', '판매'], ['gear', '장비'], ['miner', '광부'], ['day', '과제'], ['set', '설정']];
/** 시트 (§1): 세로 폰 = 아래 탭 줄(접힘) / 아래 40% 덮개 · 가로 폰 = 오른쪽 탭 띠 / 오른쪽 32% 덮개 · PC = 오른쪽 24% 늘 열림. 반투명, 손잡이 끌기·게임 탭하면 접힘 */
function makeSheet() {
  const u = (v) => Math.round(v / L.uiS);
  const r = L.panels.sheet, s = new Container(); s.position.set(u(r.x), u(r.y));
  const sw = u(r.w), sh = u(r.h), open = sheetOpen();
  if (!open && L.landscape) {                                       // 가로 접힘: 세로 탭 띠
    s.addChild(frame('stone', sw, sh, 'panel'));
    const bh = Math.min(26, Math.floor((sh - 8) / SHEET_TABS.length));
    ui.tabs = SHEET_TABS.map(([key, name], i) => {
      const b = button(key === sheetTab ? 'wood' : 'stone', sw - 8, bh - 3, name, () => { sfx('stash', true); setSheet(true, key); }, { small: true });
      b.key = key; b.setOn = () => {}; b.position.set(4, 4 + i * bh); s.addChild(b); if (key === 'sell') ui.sellAnchor = b; return b;
    });
    return s;
  }
  const bg = new Graphics().rect(0, 0, sw, sh + 6).fill({ color: 0x1a1622, alpha: L.pc ? 0.96 : 0.9 }); s.addChild(bg, frame('stone', sw, sh + 6, 'panel')); s.children[1].alpha = 0.85;
  const foldW = L.pc ? 0 : 22, tw = Math.floor((sw - 12 - foldW) / SHEET_TABS.length);
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
  ui.tabs = SHEET_TABS.map(([key, name], i) => {
    const t = tab(tw, name, () => { sfx('stash', true); if (!open) setSheet(true, key); else show(key); });
    t.key = key; t.position.set(6 + i * tw, 4); s.addChild(t);
    if (key === 'sell') ui.sellAnchor = t;
    return t;
  });
  if (!L.pc) {
    const fold = button('stone', 18, 14, open ? (L.landscape ? '▶' : '▼') : '▲', () => setSheet(!open), { small: true });
    fold.position.set(sw - 24, 4); s.addChild(fold);
    // 손잡이: 탭 줄을 끌어 접기/펼치기
    const grip = new Graphics().rect(0, 0, sw - 30, 18).fill({ color: 0, alpha: 0.001 }); grip.eventMode = 'static'; s.addChildAt(grip, 2);
    let g0 = null;
    grip.on('pointerdown', (e) => { g0 = { x: e.global.x, y: e.global.y }; });
    grip.on('pointerup', (e) => { if (!g0) return; const d = L.landscape ? e.global.x - g0.x : e.global.y - g0.y; g0 = null; if (d > 20 && open) setSheet(false); else if (d < -20 && !open) setSheet(true); });
    grip.on('pointerupoutside', () => { g0 = null; });
  }
  s.addChild(body);
  if (open) show(sheetTab); else ui.tabs.forEach((t) => t.setOn(t.key === sheetTab));
  return s;
}

function buildUI() {
  if (!L) return;
  uiRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
  uiRoot.scale.set(L.uiS);
  ui = { counters: {}, rows: {}, refs: {}, overlayRect2: null, scrollKnob: null };
  const u = (v) => Math.round(v / L.uiS);             // CSS px → UI px
  { const hud = L.panels.hud; const hc = makeHud(u(hud.w), u(hud.h), L.landscape); hc.position.set(u(hud.x), u(hud.y)); uiRoot.addChild(hc); }
  ui.overlayRect = null;
  if (view === 'company') {
    const f = L.full, r = { x: u(f.x0), y: u(f.y0), w: u(f.x1 - f.x0), h: u(f.y1 - f.y0) };
    uiRoot.addChild(makeCompany(r.x, r.y, r.w, r.h));
  } else {
    ui.coTick = null;
    const ov = makeOverlay();
    if (ov) uiRoot.addChild(ov);
  }
  const sheetHidden = view === 'company' || (state() === 'AUCTION' && !(auctionSettings && !AU.card));   // 명세5 §8: 경매·회사 화면엔 시트 없음
  if (L.overY > 0 && view === 'mine' && ['SURVEY', 'DIG'].includes(state())) uiRoot.addChild(makeScrollBar());
  if (!sheetHidden) uiRoot.addChild(makeSheet());
  if (upCard && (view === 'company') === (upCard.kind !== 'gear')) uiRoot.addChild(makeUpCard());
  if (welcome) uiRoot.addChild(makeWelcome());
  if (rankView) uiRoot.addChild(makeRank());
  if (cloudChoice) uiRoot.addChild(makeCloudChoice());
  if (manualView) uiRoot.addChild(makeManual());
  if (talentView) uiRoot.addChild(makeTalentView());
  ui.tutLayer = new Container(); uiRoot.addChild(ui.tutLayer);
  if (dialog) uiRoot.addChild(makeDialog());
  ui.fxLayer = new Container(); uiRoot.addChild(ui.fxLayer);
  ui.toast = new Container(); ui.toast.visible = false; uiRoot.addChild(ui.toast);
  refreshUI();
}

/** HUD 창고 숫자 자리를 누르면 창고 현황 */
function tapToStorage(c, x, y, w, h) {
  const hit = new Graphics().rect(x, y, w, h).fill({ color: 0, alpha: 0.001 }); hit.eventMode = 'static'; hit.cursor = 'pointer';
  hit.on('pointertap', () => { unlockAudio(); sfx('ui_tap'); openStorage(); }); c.addChild(hit); ui.refs.storage = hit;
}
/** 📦 창고: 지금 가진 광석 · 괴 · 개당 시세 · 팔면 얼마 (HUD 창고 숫자를 누르면) */
function openStorage() {
  const rows = ORES.map((o) => ({ o, n: stash[o.key], ing: S.ingots[o.key] ?? 0, p: priceOf(o.key), ip: ingotPrice(o.key) }));
  const total = rows.reduce((a, r) => a + r.n * r.p + r.ing * r.ip, 0);
  const has = rows.filter((r) => r.n || r.ing);
  const line = (r) => `<div class="kitem"><b>${r.o.name} ${r.n}개${r.ing ? ` · 괴 ${r.ing}개` : ''}</b><small>개당 ${r.p}금${r.ing ? ` · 괴 ${r.ip}금` : ''} → 지금 팔면 ${(r.n * r.p + r.ing * r.ip).toLocaleString()}금</small></div>`;
  openPanel('📦 창고', `<p><b>${whTotal()} / ${whCap()}</b> 칸 · 지금 다 팔면 <b>💰 ${total.toLocaleString()}</b></p>${has.length ? has.map(line).join('') : '<p class="kmuted">아직 캔 광석이 없어요</p>'}<p class="kmuted">시세는 10초마다 바뀌어요 · 매입자: ${B.buyers[buyer()].name}</p><div class="krow"><button class="kall">다 팔기 💰${total.toLocaleString()}</button><button class="kgo">판매 탭</button><button class="kup">창고 Lv${S.engine.lv.warehouse} ▸</button></div>`, (b, close) => {
    b.querySelector('.kgo').onclick = () => { close(); setSheet(true, 'sell'); };
    if (!isOpen(S, 'sellAll')) b.querySelector('.kall').style.display = 'none';
    b.querySelector('.kall').onclick = () => { ORES.forEach((o) => sell(o.key, 1)); ORES.forEach((o) => sellIngots(o.key)); close(); };
    b.querySelector('.kup').onclick = () => { close(); upCard = { kind: 'bld', key: 'warehouse' }; buildUI(); };
  });
}
/** HUD 한 줄 (§1): 💰 금화 · 📦 창고 · 🕒 날짜 · [특성] [회사]. 가로 폰은 같은 것을 세로로 */
function makeHud(w, h, vertical = false) {
  const c = new Container();
  c.addChild(frame('wood', w, h));
  const btns = [];
  if (S.unl && Object.keys(S.unl.got).length > (S.unl.seen ?? 0)) btns.push(['unl', button('wood', 20, 15, '!', openUnlocks, { small: true })]);   // 6-3 §4: 새로 열린 것
  if (S.tutorial.done || S.tutorial.deferred) {
    const tl = talentLeft(S);
    btns.push(['talents', button(tl > 0 ? 'wood' : 'stone', 46, 15, tl > 0 ? `특성${tl}` : '특성', openTalents, { small: true })]);
    if (SHOW_COMPANY) btns.push(['company', button(view === 'company' ? 'paper' : 'stone', 46, 15, view === 'company' ? '광산' : '회사', () => (view === 'company' ? closeCompany() : openCompany()), { small: true })]);
  }
  const items = [['coin', kit('coin')], ['rate', tex('pickaxe')], ['wh', tex('icon_gold')], ['clock', null]];   // 명세6-1: 💰 ⛏/초 📦 🕒
  if (!vertical) {
    const cy = Math.round((h - 14) / 2);
    let xa = 6;
    const room = w - 6 - btns.length * 48;
    items.forEach(([key, tx]) => {
      const i = tx ? icon(tx) : new Container(), n = label('0', { small: key === 'clock' || room < 120 });   // 좁으면 숫자도 본문 크기
      i.position.set(xa, cy + Math.round((14 - (tx ? i.height : 0)) / 2)); n.position.set(xa + (tx ? i.width + 3 : 0), cy + (key === 'clock' ? 1 : 0));
      c.addChild(i, n); ui.counters[key] = n; if (key === 'clock') n.short = true;
      if (key === 'wh') tapToStorage(c, i.x - 2, 0, (room < 120 ? 7 * 5 : 7 * 6) + i.width + 8, h);
      n.reserve = key === 'coin' ? 7 : key === 'wh' ? 7 : key === 'rate' ? 7 : 0;               // 자리: 숫자가 바뀌어도 안 밀리게 (글자 수)
      xa = n.x + Math.max(n.width, n.reserve * (room < 120 ? 5 : 6)) + (room < 120 ? 5 : 8);
      if (key === 'clock' && n.x + 44 > room) { n.visible = false; }
    });
    { let bx = w - 2; for (let i = btns.length - 1; i >= 0; i--) { const [k, b] = btns[i]; bx -= b.width + 2; b.position.set(bx, Math.round((h - 15) / 2)); c.addChild(b); ui.refs[k] = b; } }
  } else {
    let ya = 6;
    items.forEach(([key, tx]) => {
      const i = tx ? icon(tx) : new Container(), n = label('0', { small: true });
      i.position.set(5, ya + 1); n.position.set(5 + (tx ? i.width + 2 : 0), ya); c.addChild(i, n); ui.counters[key] = n; if (key === 'clock') n.short = true;
      if (key === 'wh') tapToStorage(c, 2, ya - 2, w - 4, 16);
      ya += 16;
    });
    btns.forEach(([k, b], i) => { b.position.set(Math.round((w - 46) / 2), h - 6 - (btns.length - i) * 19); c.addChild(b); ui.refs[k] = b; });
  }
  return c;
}

/** 격자 위를 덮는 전체 카드(경매 · 결과) 또는 탐사 띠 */
function makeOverlay() {
  const st = state();
  const u = (v) => Math.round(v / L.uiS);
  const v = L.vis, x = u(v.x0) + 4, y = u(v.y0) + 4, w = u(v.x1 - v.x0) - 8, h = u(v.y1 - v.y0) - 8;
  if (st === 'AUCTION') { const f = L.full; return auctionSettings && !AU.card ? makeAuction(x, y, w, h) : makeAuction(u(f.x0) + 4, u(f.y0) + 4, u(f.x1 - f.x0) - 8, u(f.y1 - f.y0) - 8); }   // 경매: 시트 자리까지 다 씀
  if (st === 'SURVEY') return makeSurveyBar(x, y, w);
  if (st === 'RESULT') return makeResult(x, y, w, h);
  if (st === 'DIG' && confirmRetreat) { const box = new Container(); box.addChild(makeDigBar(x, y, w), makeRetreatSheet(x, y, w, h)); return box; }
  if (st === 'DIG') return makeDigBar(x, y, w);
  return null;
}
function setToolRect(x, y, w, h) { ui.toolRect = { x: x * L.uiS, y: y * L.uiS, w: w * L.uiS, h: h * L.uiS }; }
function setOverlayRect(x, y, w, h) { ui.overlayRect = { x: x * L.uiS, y: y * L.uiS, w: w * L.uiS, h: h * L.uiS }; }

function makeAuction(x, y, w, h) {
  const c = new Container(); c.position.set(x, y);
  c.addChild(frame('paper', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const ink = { color: COLOR.paperInk, shadow: false };
  const cards = [];
  if (!AU.card) return makeMap(c, w, h, ink);
  if (false) {
    const title = label(`${S.day}일차 경매`, ink); title.position.set(8, 6); c.addChild(title);
    const gold = label(`금화 ${S.gold}`, { ...ink, small: true, color: 0x8a5a24 }); gold.position.set(w - 8 - Math.ceil(gold.width), 8); c.addChild(gold);
    const top0 = 24, gap = 5, n = cards.length, foot = 26;
    const chh = Math.min(84, Math.floor((h - top0 - 6 - foot - gap * (n - 1)) / n));
    const broke = cards.every((cd) => cd.price > S.gold);
    const fw = Math.floor((w - 20) * 0.62);
    const fr = button(broke ? 'wood' : 'paper', fw, 20, broke ? '공짜 구획으로 ▶' : '공짜 구획으로', goFreePlot, { small: true }); fr.position.set(8, h - foot); c.addChild(fr); ui.refs.freePlot = fr;
    const sb = button('stone', w - 20 - fw, 20, '설정', () => { auctionSettings = !auctionSettings; sheetTab = 'set'; S.settings.sheetFolded = false; save(); layout(); }, { small: true }); sb.position.set(12 + fw, h - foot); c.addChild(sb);
    cards.forEach((card, i) => { const k = makePlotCard(card, w - 16, chh); k.position.set(8, top0 + i * (chh + gap)); c.addChild(k); });
    return c;
  }
  // 입찰 (V12 §8): 그림 55% · 나/상대 25% · 버튼 20%. 가로로 넓으면 왼쪽 그림 / 오른쪽 사람·버튼 두 칸
  const wide = w > h * 1.6;
  let pc;
  if (wide) {
    const lw = Math.floor(w * 0.5), A = new Container(), Bc = new Container(); Bc.x = lw - 4; c.addChild(A, Bc);
    pc = bidPic(A, lw, h - 4); bidPeople(Bc, w - lw + 4, h, 6, h - 64);
  } else {
    const zPic = Math.floor(h * 0.55);
    pc = bidPic(c, w, zPic);
    c.addChild(new Graphics().rect(8, zPic, w - 16, 1).fill({ color: 0x8a6c52, alpha: 0.6 }));
    bidPeople(c, w, h, zPic + 4, Math.floor(h * 0.25) - 6);
  }
  // 망치 카운트 · 낙찰 도장 "낙찰! 303금" (그림 가운데)
  if (AU.phase === 'count') {
    const n = Math.max(1, Math.ceil(AU.count));
    const cl = label(`${n}`, { color: 0xb84a62, shadow: false }); cl.scale.set(3); cl.position.set(Math.round(pc[0] - cl.width / 2), Math.round(pc[1] - cl.height / 2)); c.addChild(cl);
  }
  if ((AU.phase === 'won' || AU.phase === 'lost') && AU.endAt != null) {
    const age = time - AU.endAt, won = AU.phase === 'won', who = won ? `${AU.high}금` : typeof AU.holder === 'number' ? B.guilds[AU.holder].name.split(' ')[0] : null;
    if (who) {
      const st = new Container(); st.position.set(pc[0], pc[1]);
      const g = new Graphics().circle(0, 0, 26).stroke({ width: 2, color: 0xb84a62 }).circle(0, 0, 21).stroke({ width: 1, color: 0xb84a62 });
      const tl = label('낙찰!', { color: 0xb84a62, shadow: false }); tl.position.set(-Math.round(tl.width / 2), -13);
      const wl = label(who, { small: true, color: 0xb84a62, shadow: false }); fitText(wl, 44); wl.position.set(-Math.round(wl.width / 2), 3);
      st.addChild(g, tl, wl); st.rotation = -0.2;
      const p = Math.min(1, age / 0.18); st.scale.set(2.2 - 1.2 * p); st.alpha = p;
      c.addChild(st);
    }
  }
  return c;
}
/** 지도 (명세6-2 §2): 부지 바닥 그림 위 깃발 3 · 깃발 톡 → 아래 카드 1장 (글자 덩어리 3개 이하) */
let mapSel = 0;
function makeMap(c, w, h, ink) {
  const e = ensureExp();
  const hd = label(`${S.day}일차 원정 지도 · 원정 표 ${e.tickets}/${XP().tickets}`, ink); hd.position.set(8, 6); fitText(hd, w - 70); c.addChild(hd);
  const back = button('stone', 54, 16, '부지로', () => { AU.card = null; openCompany(); }, { small: true }); back.position.set(w - 60, 5); c.addChild(back); ui.refs.mapBack = back;
  const cardH = Math.min(96, Math.max(78, Math.floor(h * 0.34))), mapY = 26, mapH = h - mapY - cardH - 10;
  // 지도 그림: 부지 바닥을 가운데 기준으로 잘라 (정수 배율 · 흐림 없이)
  const gT = y5tex('yard_ground_f0.png'), ks = Math.max(1, Math.floor(Math.min((w - 16) * L.uiS / 960 * 2, mapH * L.uiS / 540 * 2))) / 2;
  const mv = new Container(); mv.position.set(8, mapY); c.addChild(mv);
  const mk = new Graphics().rect(0, 0, w - 16, mapH).fill(0xffffff); mv.addChild(mk);
  const gs = new Sprite(gT); gs.scale.set(ks / L.uiS); gs.position.set(Math.round((w - 16 - 960 * ks / L.uiS) / 2), Math.round((mapH - 540 * ks / L.uiS) / 2)); gs.tint = 0xd8e0c8; gs.mask = mk; mv.addChild(gs);
  mv.addChild(new Graphics().rect(0, 0, w - 16, mapH).stroke({ width: 1, color: 0x5c3832 }));
  const spots = [[0.2, 0.62], [0.5, 0.34], [0.8, 0.6]], KC = { cheap: 0x6a9a3a, normal: 0xd39a3a, prime: 0x9a5ac8 }, KN = { cheap: '싼 땅', normal: '보통 땅', prime: '노른자 땅' };
  e.cands.forEach((cd, i) => {
    const fx = Math.round((w - 16) * spots[i][0]), fy = Math.round(mapH * spots[i][1]), col = cd.status === 'guild' ? GUILD_COLOR[cd.owner] : cd.status === 'mine' ? 0x8a8a8a : KC[cd.kind];
    const f = new Container(); f.position.set(fx, fy); mv.addChild(f);
    const g = new Graphics().rect(-1, -22, 2, 24).fill(0x4a3020).poly([1, -22, 15, -17, 1, -12]).fill(col);
    if (i === mapSel) g.circle(0, 2, 8).stroke({ width: 1, color: 0xf5cf6a });
    f.addChild(g);
    const nl = label(cd.status === 'guild' ? B.guilds[cd.owner].name.split(' ')[0] : cd.status === 'mine' ? '샀음' : (cd.kind !== 'cheap' && !isOpen(S, 'auction') ? '🔒 ' : '') + KN[cd.kind] + (cd.glow ? ' ✨' : ''), { small: true, color: 0xf4ecd2 }); nl.position.set(-Math.round(nl.width / 2), 4); f.addChild(nl);
    f.eventMode = 'static'; f.cursor = 'pointer'; f.hitArea = new Rectangle(-24, -26, 48, 44); f.on('pointertap', () => { mapSel = i; sfx('ui_tap'); buildUI(); });
    ui.refs[`flag_${cd.kind}`] = f;
  });
  // 아래 카드 1장: 그림 · 예상 가치 막대 · 힌트 · 가격/상태 + 버튼
  const cd = e.cands[mapSel] ?? e.cands[0]; if (!cd) return c;
  const k = new Container(); k.position.set(8, h - cardH - 4); c.addChild(k);
  k.addChild(frame('wood', w - 16, cardH, 'panel'));
  const ts = Math.max(0.5, Math.min(1.5, (cardH - 10) / 64)), th = new Sprite(plotThumb(cd)); th.scale.set(ts); th.position.set(5, 5); k.addChild(th);
  const tx = Math.round(10 + 96 * ts), tw = w - 16 - tx - 8;
  const nm = label(`${KN[cd.kind]} · ${cd.name} · ${cd.size}${cd.floor === 2 ? ' · 폐광' : ''}`, { small: true, color: KC[cd.kind] === 0x9a5ac8 ? 0xd8b0ff : COLOR.gold }); fitText(nm, tw); nm.position.set(tx, 5); k.addChild(nm);
  const val = cardValue(cd), bx = tx, by = 24, bw = tw;
  const bar = new Graphics().rect(bx, by, bw, 6).fill(0x3a2a22).rect(bx, by, bw, 6).fill({ color: 0x6a9a3a, alpha: 0.6 }).rect(bx + Math.round(bw / 2) - 1, by - 2, 2, 10).fill(0xf4ecd2);
  k.addChild(bar);
  const vl = label(`예상 가치 ${val.lo}~${val.hi}`, { small: true, color: 0xc8e8a8 }); vl.position.set(bx, by + 8); k.addChild(vl);
  let hx = bx + Math.ceil(vl.width) + 8; for (const hnt of cd.hints) { const ic = icon(tex(HINT_ICON[hnt])); ic.position.set(hx, by + 9); k.addChild(ic); hx += 12; }
  const st = cd.status === 'guild' ? `${B.guilds[cd.owner].name}이(가) 가져갔어요` : cd.status === 'mine' ? '오늘 산 땅이에요' : cd.kind === 'cheap' ? `고정가 ${cd.price}금 · 길드 관심 없음` : `시작가 ${cd.price}금 · 길드 ${cd.guilds.length}팀`;
  const sl = label(st, { small: true, color: COLOR.dim }); fitText(sl, tw); sl.position.set(bx, by + 22); k.addChild(sl);
  const auLock = cd.kind !== 'cheap' && !isOpen(S, 'auction');
  if (auLock) { const ll = label(`🔒 ${needText('auction')} 뒤에 경매가 열려요`, { small: true, color: 0xd8b0ff }); ll.position.set(bx, cardH - 22); k.addChild(ll); }
  if (cd.status === 'open' && !auLock) {
    const can = e.tickets > 0 && (cd.kind !== 'cheap' || S.gold >= cd.price);
    const b = button(can ? 'wood' : 'stone', Math.min(tw, 140), 20, cd.kind === 'cheap' ? `사기 💰${cd.price}` : '경매 ▶', () => { unlockAudio(); cd.kind === 'cheap' ? buyCheap(cd) : pickCard(cd); }, { small: true });
    b.setDisabled(!can); b.position.set(bx, cardH - 26); k.addChild(b); ui.refs.mapGo = b;
  }
  if (/debug=auction/.test(location.search) && cd.kind !== 'cheap') { const dl = label(`[debug] 중간 ${val.mid}`, { small: true, color: 0xff8a7a }); dl.position.set(bx + 150, cardH - 22); k.addChild(dl); }
  return c;
}
/** 입찰: 구획 그림(정수 배율) + 이름·힌트 + 예상 가치·이익 막대. 그림 가운데 [x,y] 돌려줌 */
function bidPic(c, w, zPic) {
  const ink = { color: COLOR.paperInk, shadow: false };
  const card = AU.card, val = cardValue(card), margin = (val.mid - AU.high) / val.mid;
  const picW = w - 16, th = plotThumb(card), ps = Math.max(1, Math.floor(Math.min(picW / 96, (zPic - 34) / 64))), picH = 64 * ps;
  const pic = new Sprite(th); pic.scale.set(ps); pic.position.set(Math.round(8 + (picW - 96 * ps) / 2), 6 + Math.max(0, Math.round((zPic - 34 - picH) / 2))); c.addChild(pic);
  c.addChild(new Graphics().rect(pic.x - 1, pic.y - 1, 96 * ps + 2, 64 * ps + 2).stroke({ width: 1, color: 0x5c3832 }));
  const nl = label(`${card.floor === 2 ? '2층 ' : ''}${card.name} · ${card.size}`, { small: true, color: card.floor === 2 ? 0x2a8a84 : 0x8a5a24, shadow: false }); fitText(nl, w - 26 - (pic.x - 8));   // 이름표는 그림 밖으로 나가도 됨 (안 잘리게)
  const nb = frame('paper', Math.ceil(nl.width) + 8, 13, 'panel'); nb.position.set(pic.x + 3, pic.y + 3); nl.position.set(pic.x + 7, pic.y + 4); c.addChild(nb, nl);
  let hx = pic.x + 3;
  for (const hnt of card.hints) { const ic = icon(tex(HINT_ICON[hnt])); ic.position.set(hx, pic.y + picH - 13); c.addChild(ic); hx += 12; }
  const yy = pic.y + picH + 6;
  const vl = label(`예상 가치 ${val.lo}~${val.hi}`, { ...ink, small: true, color: 0x46702e }); vl.position.set(8, yy); c.addChild(vl);
  const ml = label(margin >= 0 ? `여유 +${Math.round(val.mid - AU.high)}` : `손해 ${Math.round(val.mid - AU.high)}`, { ...ink, small: true, color: margin >= B.auction.profitOk ? 0x46702e : margin >= 0 ? 0x8a5a24 : 0xb84a62 });
  ml.position.set(w - 8 - Math.ceil(ml.width), yy); if (ml.x < vl.x + vl.width + 4) ml.y = yy + 12; c.addChild(ml);
  const by = ml.y + 12, barW = w - 16, bar = new Graphics();
  bar.rect(8, by, barW, 5).fill(0x3a2a22).rect(8, by, Math.max(0, Math.min(1, margin)) * barW, 5).fill(margin >= B.auction.profitOk ? 0x6a9a3a : margin >= 0 ? 0xd39a3a : 0xb84a62);
  if (margin < 0) bar.rect(8, by, barW, 5).fill({ color: 0xb84a62, alpha: 0.45 });
  c.addChild(bar);
  return [Math.round(pic.x + 48 * ps), Math.round(pic.y + picH / 2)];
}
/** 입찰: 왼쪽 "나" 크게 ↔ 오른쪽 상대 3 작게 · 말풍선 1줄 · 현재가 · [올리기] [포기] */
function bidPeople(c, w, h, yy, ppl) {
  const ink = { color: COLOR.paperInk, shadow: false };
  const btnH = 22, btnY = h - btnH - 6, priceY = btnY - 18;
  ppl = Math.max(40, ppl);
  const meS = Math.min(Math.floor(w * 0.3), ppl - 14, 64);
  const mf = portraitFrame(faceTex('miner_brick'), meS, 'wood'); mf.position.set(8, yy + 2); c.addChild(mf);
  const badge = new Container(); const bl = label('나', { small: true, color: 0x5c3832, shadow: false }); const bbg = new Graphics().rect(0, 0, Math.ceil(bl.width) + 8, 11).fill(0xf5cf6a).stroke({ width: 1, color: 0x8a5a24 }); badge.addChild(bbg, bl); bl.position.set(4, 0);
  badge.position.set(8 + Math.round((meS - bbg.width) / 2), yy + 2 + meS - 6); c.addChild(badge);
  const mine = AU.holder === 'me';
  const mb = label(AU.me ? `${AU.me}` : '—', { color: mine ? COLOR.gold : COLOR.paperInk, shadow: mine }); mb.position.set(8 + meS + 6, yy + 4); c.addChild(mb);
  const rx0 = Math.max(8 + meS + 6 + Math.ceil(mb.width) + 6, Math.round(w * 0.42)), rw = Math.floor((w - 8 - rx0) / 3);
  const fh = Math.max(20, Math.min(40, ppl - 26, Math.floor((rw - 2) / 0.8)));
  const latest = AU.say.map((q, i) => ({ q, i })).filter(({ q }) => q && time >= q.t && time - q.t < 2.2 && !q.old).reduce((m, e) => (!m || e.q.t > m.q.t ? e : m), null);
  B.guilds.forEach((g, i) => {
    if (AU.part && !AU.part.includes(i)) return;                         // 명세6-2: 참가 길드만
    const gx = rx0 + i * rw + rw / 2, say = AU.say[i], age = say ? time - say.t : 99, lead = AU.holder === i;
    const fig = new Sprite(tex(GUILD_SPR[i])); fig.anchor.set(0.5, 1); fig.scale.set(fh / fig.texture.height);
    let jx = 0; if (say && !say.pass && !say.line && age >= 0 && age < 0.5) jx = Math.round(Math.sin(age * 70) * 1.5);
    if (AU.out[i]) fig.tint = 0x8a8a8a;
    const winBounce = AU.phase === 'lost' && lead ? -Math.round(Math.abs(Math.sin((time - AU.endAt) * 8)) * 3) : 0;
    fig.position.set(Math.round(gx + jx), yy + 14 + fh + winBounce); c.addChild(fig);
    const bid = AU.bids[i];
    const nl = label(AU.out[i] ? '포기' : bid ? String(bid) : '—', { small: true, color: lead ? COLOR.gold : AU.out[i] ? 0x8a7a68 : COLOR.paperInk, shadow: lead });
    nl.position.set(Math.round(gx - nl.width / 2), yy + 16 + fh); c.addChild(nl);
    if (!AU.out[i] && AU.phase === 'bid') { const r0 = AU.high / AU.caps[i], ex = XP().auction; if (r0 >= ex.hesitate) { const mood = label(r0 >= ex.sweat ? '💦' : '음…', { small: true, color: 0x5c3832, shadow: false }); mood.position.set(Math.round(gx + fh * 0.25), yy + 12); c.addChild(mood); } }   // 한도는 숨기고 표정으로
    if (/debug=auction/.test(location.search)) { const dl = label(`한도 ${AU.caps[i]}`, { small: true, color: 0xb84a62, shadow: false }); dl.position.set(Math.round(gx - dl.width / 2), yy + 28 + fh); c.addChild(dl); }
    c.addChild(new Graphics().rect(Math.round(gx - rw / 2 + 2), yy + 2, rw - 4, 2).fill({ color: GUILD_COLOR[i], alpha: 0.9 }));
  });
  if (latest) {                                       // 말풍선 1줄 · 한 번에 하나
    const { q, i } = latest, gx = rx0 + i * rw + rw / 2;
    const bt = label(q.text, { small: true, color: q.pass ? 0x8a7a68 : 0x5c3832, shadow: false }); fitText(bt, w - 24);
    const bw = Math.ceil(bt.width) + 8, bh = 13;
    const bub = new Container(); bub.addChild(frame('paper', bw, bh, 'panel'), bt); bt.position.set(4, 1);
    const tx = Math.max(Math.min(rx0 - 10, w - 8 - bw), Math.min(w - 8 - bw, Math.round(gx - bw / 2)));
    bub.addChild(new Graphics().poly([gx - tx - 3, bh - 1, gx - tx + 3, bh - 1, gx - tx, bh + 4]).fill(0xf4ecd2));
    bub.position.set(tx, yy + 12 - bh - 2); c.addChild(bub);
  }
  const hl = label(`현재가 ${AU.high}`, ink); hl.position.set(Math.round(w / 2 - hl.width / 2), priceY); c.addChild(hl);
  bidButtons(c, 8, btnY, w - 16, btnH);
}
/** 구획 단면 썸네일 96×64 (§8-1) — 격자로 코드가 그림: 지상 띠(풀·나무) + 안개 낀 흙. 힌트 있는 것만 희미하게 */
const thumbCache = new Map();
function plotThumb(card) {
  const key = `${card.seed}|${card.size}|${card.floor ?? 1}|${card.hints.join('')}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const g = generate(card), rows = g.length, cv = document.createElement('canvas'); cv.width = 96; cv.height = 64;
  const x = cv.getContext('2d'), hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const wPx = { S: 72, M: 84, L: 96 }[card.size] ?? 84, cw = wPx / 12, ch = Math.min(4, 50 / rows), x0 = Math.round((96 - wPx) / 2), y0 = 13;
  let r = (card.seed ?? 1) >>> 0; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const night = card.floor === 2;
  x.fillStyle = night ? '#1c2a3a' : '#5a7aa8'; x.fillRect(0, 0, 96, 64);                 // 하늘
  x.fillStyle = night ? '#24364a' : '#7a9ac0'; x.fillRect(0, 6, 96, 6);
  for (let i = 0; i < 3; i++) { const tx = Math.floor(rnd() * 90); x.fillStyle = '#2e4a2a'; x.fillRect(tx + 1, y0 - 7, 3, 5); x.fillStyle = '#4a3020'; x.fillRect(tx + 2, y0 - 2, 1, 2); }   // 나무
  x.fillStyle = '#2a201c'; x.fillRect(0, y0, 96, 64);                                      // 구획 둘레 땅 (어둡게 — 구획 폭이 보이게)
  x.fillStyle = '#5a7a3a'; x.fillRect(0, y0 - 1, 96, 2);                                    // 풀 띠
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < 12; gx++) {
    const t = g[gy][gx], k = gy / rows, n = rnd() * 10;
    const base = [0x6e5440, 0x5c4636, 0x4a382c, 0x3a2c24][Math.min(3, Math.floor(k * 4))];
    let col = base;
    if (t === 'r' || t === 'h') col = card.hints.includes('rock') ? 0x6a6470 : base;
    if (t === 'w' && card.hints.includes('water')) col = 0x3a5a8a;
    x.fillStyle = hex(col); x.fillRect(x0 + gx * cw, y0 + gy * ch, Math.ceil(cw), Math.ceil(ch));
    if (n < 1.2) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(x0 + gx * cw + 1, y0 + gy * ch + 1, 1, 1); }
    if (t === 'c' && card.hints.includes('glow')) { x.fillStyle = '#4ad8c8'; x.fillRect(x0 + gx * cw + cw / 2, y0 + gy * ch + ch / 2 - 0.5, 1, 1); }
    if (t === 'R' && card.hints.includes('relic')) { x.fillStyle = '#8a5a24'; x.fillRect(x0 + gx * cw + 1, y0 + gy * ch, Math.max(2, cw - 2), Math.max(2, ch)); }
  }
  const grd = x.createLinearGradient(0, y0, 0, 64); grd.addColorStop(0, 'rgba(30,22,34,0.05)'); grd.addColorStop(1, 'rgba(30,22,34,0.55)');   // 안개
  x.fillStyle = grd; x.fillRect(x0, y0, wPx, 64 - y0);
  const tex0 = Texture.from(cv); tex0.source.scaleMode = 'nearest';
  thumbCache.set(key, tex0);
  return tex0;
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
  fitText(nm, w - 6);
  const style = { aggressive: '공격적', careful: '신중', random: '변덕' }[g.style];
  const st = label(style, { small: true, color: COLOR.dim }); st.position.set(4, 22); c.addChild(st);
  if (leading) { const crown = icon(kit('badge_gold')); crown.position.set(w - 11, 22); c.addChild(crown); }
  return c;
}
function makePlotCard(card, w, h) {
  const c = new Container();
  c.addChild(frame('wood', w, h, 'panel'));
  const ts = Math.max(0.4, Math.min(1, (h - 8) / 64, (w * 0.4) / 96)), th = new Sprite(plotThumb(card)); th.scale.set(ts); th.position.set(4, Math.round((h - 64 * ts) / 2)); c.addChild(th);
  const tx = Math.round(4 + 96 * ts + 6), tw = w - tx - 6;
  let nm = label(card.name, { color: card.floor === 2 ? 0x6fe0d8 : COLOR.gold });
  if (nm.width > tw) { nm.destroy(); nm = label(card.name, { small: true, color: card.floor === 2 ? 0x6fe0d8 : COLOR.gold, wrap: tw }); }   // 넘치면 본문 크기 · 그래도 넘치면 두 줄
  nm.position.set(tx, 5); c.addChild(nm);
  const dy = Math.max(0, Math.ceil(nm.height) - 14);                // 이름이 두 줄이면 아래 줄들을 내림
  const sz = B.plotSizes[card.size];
  const info = label(`${card.floor === 2 ? '2층 · ' : ''}크기 ${card.size} · 깊이 ${sz.rows}`, { small: true, color: COLOR.dim }); info.position.set(tx, 20 + dy); c.addChild(info);
  let hx = tx;
  card.hints.forEach((hnt) => { const ic = icon(tex(HINT_ICON[hnt])); ic.position.set(hx, 33 + dy); c.addChild(ic); hx += 12; });
  if (!card.hints.length) { const nh = label(card.free ? '힌트 없음' : '힌트 없음', { small: true, color: COLOR.dim }); nh.position.set(tx, 32 + dy); c.addChild(nh); }
  const price = label(`시작가 ${card.price}`, { small: true, color: COLOR.gold }); price.position.set(tx, Math.min(46 + dy, h - 14)); c.addChild(price);
  if (h < 64) info.visible = false;                             // 낮은 카드: 크기 줄 대신 시작가
  const b = button('wood', 48, 18, '입찰', () => { unlockAudio(); pickCard(card); }, { small: true });
  b.setDisabled(card.price > S.gold); b.position.set(w - 54, h - 22); c.addChild(b);
  return c;
}
function makeSurveyBar(x, y, w) {
  const c = new Container(); c.position.set(x, y);
  const h = 22;
  c.addChild(frame('paper', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const t = label('', { small: true, color: COLOR.paperInk, shadow: false }); t.position.set(6, 5); c.addChild(t); ui.survey = t;
  const skText = tutOn() ? '탐사 끝' : '시추 시작', probe = label(skText, { small: true }), skW = Math.max(50, Math.ceil(probe.width) + 14); probe.destroy();   // 글자 폭에 맞춘 버튼 (안 잘리게)
  const sk = button('wood', skW, 16, skText, () => { if (tutOn() && !S.tutorial.sniffed) return; toolArmed = null; startDig(); }, { small: true }); sk.position.set(w - skW - 4, 3); c.addChild(sk); ui.refs.surveyEnd = sk;
  if (!tutOn()) toolButtons(c, w - skW - 8, 3);
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
function toolButtons(c, xr, y, onlyVibro = false) {
  const rd = S.round;
  for (const [k, name, n] of [['xray', '투시', rd.xrayLeft], ['vibro', '진동', rd.vibroLeft]]) {
    if (!(n > 0) || (onlyVibro && k !== 'vibro')) continue;
    const bt = button(toolArmed === k ? 'wood' : 'paper', 30, 16, `${k === 'vibro' ? '📡' : '🔦'}${n}`, () => armTool(k), { small: true });
    xr -= 32; bt.position.set(xr, y); c.addChild(bt); ui.refs[k] = bt;
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
  if (!tutOn() || S.tutorial.step >= 6) { const tc = new Container(); const xl = toolButtons(tc, 0, 0, tutOn()); tc.x = -xl; c.addChild(tc); setToolRect(x, y, -xl, 16); }   // 시추 중에도 남은 도구 — 왼쪽 위 아이콘만 (V12 §3)
  setOverlayRect(x + w - bw, y, bw - 4, 16);
  return c;
}
let resultMore = false;                                      // [자세히 ▸] 펼침
/** 결과 카드 (V12 §7): 순이익(크게) · 별 · 최대 광맥 · 시간 · [특성 찍기] [다음 경매]. 낙찰가·매출·사건·과제는 「자세히 ▸」 */
function makeResult(x, y, w, h) {
  const rd = S.round, st = rd.stats;
  const c = new Container(); c.position.set(x, y);
  c.addChild(frame('paper', w, h, 'panel'));
  setOverlayRect(x, y, w, h);
  const ink = { color: COLOR.paperInk, shadow: false };
  const title = label(rd.card.name, ink); title.position.set(8, 6); fitText(title, w - 16); c.addChild(title);
  let yy = 26;
  const pl = label('순이익', ink); pl.position.set(10, yy + 6); c.addChild(pl);
  const pv = label(`${st.profit >= 0 ? '+' : ''}${st.profit}`, { ...ink, color: st.profit >= 0 ? 0x46702e : 0xb84a62 }); pv.scale.set(2); pv.position.set(w - 12 - Math.ceil(pv.width), yy); c.addChild(pv);
  yy += 32;
  const stars = label('★'.repeat(st.stars) + '☆'.repeat(3 - st.stars), { color: 0xd39a3a, shadow: false }); stars.scale.set(1.5); stars.position.set(Math.round((w - stars.width) / 2), yy); c.addChild(stars);
  yy += 26;
  const line = (k, v, col = COLOR.paperInk) => {
    const a = label(k, { ...ink, small: true }); a.position.set(10, yy); c.addChild(a);
    const b = label(v, { ...ink, small: true, color: col }); fitText(b, w - 24 - a.width); b.position.set(w - 12 - Math.ceil(b.width), yy); c.addChild(b);
    yy += 14;
  };
  const mins = Math.max(1, Math.round((rd.endedAt - rd.startedAt) / 60));
  line('최대 광맥', `${st.maxVein}칸${st.jackpots ? ' · 대박!' : ''}`);
  line('걸린 시간', `${mins}분`);
  const more = button('stone', 70, 14, resultMore ? '자세히 ▾' : '자세히 ▸', () => { resultMore = !resultMore; buildUI(); }, { small: true }); more.position.set(8, yy + 2); c.addChild(more);
  yy += 20;
  if (resultMore) {
    if (rd.card.gift) line('구획', '그룬 할아범 선물', 0x46702e); else line('낙찰가', `−${rd.bid}`, 0xb84a62);
    line('매출', `+${st.revenue}`, 0x46702e);
    if (st.relicGold) line(`유물 ${st.relics}개`, `+${st.relicGold}`, 0x46702e);
    const evs = st.events.length ? [...new Set(st.events)].map((e) => `${EVENT_NAME[e]}${st.events.filter((q) => q === e).length > 1 ? '×' + st.events.filter((q) => q === e).length : ''}`).join(' · ') : '없음';
    line('사건', evs);
    if (S.daybook?.tasks?.length) line('오늘 과제', `${S.daybook.tasks.filter((t) => t.done).length}/${S.daybook.tasks.length}`, 0x46702e);
  }
  const done = rd.mineMade || rd.resold != null;
  const b = button(done ? 'wood' : 'stone', 80, 22, '부지로 ▶', () => { if (!done) { toast('갱도로 삼거나 되팔아요'); return; } nextAuction(); }); ui.refs.next = b;
  b.position.set(w - 88, h - 28); c.addChild(b);
  if (!done) {
    const hw = Math.floor((w - 20) / 2), rv = resaleValue();
    const mb = button('wood', hw, 22, '⛏ 갱도로 삼기', () => makeMineFromRound(), { small: true }); mb.position.set(8, h - 56); c.addChild(mb); ui.refs.makeMine = mb;
    const sb = button('paper', hw, 22, `되팔기 💰${rv}`, () => { rd.resold = rv; S.gold += rv; count('soldGold', rv); sfx('coin_big'); toast(`땅을 되팔았어요 +${rv}`, 'halabeoji', 2.5); save(); buildUI(); }, { small: true }); sb.position.set(12 + hw, h - 56); c.addChild(sb);
  } else { const ml = label(rd.mineMade ? `⛏ 갱도 「${rd.mineMade}」 — 광부들이 캐요` : `땅을 되팔았어요 +${rd.resold}`, { ...ink, small: true, color: 0x46702e }); fitText(ml, w - 16); ml.position.set(8, h - 50); c.addChild(ml); }
  if (talentLeft(S) > 0) { const tb = button('paper', 80, 22, `특성 찍기 ${talentLeft(S)}`, openTalents, { small: true }); tb.position.set(w - 172, h - 28); c.addChild(tb); ui.refs.resultTalent = tb; }
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
  sw.position.set(w - 44, 4); c.addChild(sw); ui.refs.buyerSwap = sw; if (!isOpen(S, 'buyers')) sw.visible = false;   // 6-3 #4: 두 상회
  // V14: 광고 자리 없앰 (상업 이용 안 함)
  if (CF.smeltSlots) {
    const tg = button(sellMode === 'ingot' ? 'wood' : 'paper', 28, 16, sellMode === 'ingot' ? '광석' : '괴', () => { sellMode = sellMode === 'ingot' ? 'ore' : 'ingot'; sfx('stash', true); buildUI(); }, { small: true });
    tg.position.set(4, w - 112 < 64 ? h - 36 : h - 18); c.addChild(tg);
  } else sellMode = 'ore';
  if (CF.freeze && sellMode === 'ore') {                         // 장사 특성 5: 하루 1회 시세 고정 60초
    const used = S.talents.freezeDay === S.day && (S.talents.freezeN ?? 1) >= B.talents.freezePerDay, live = market.frozen && mNow() < market.frozen.until;
    const fz = button(live ? 'wood' : 'paper', 28, 15, live ? '고정중' : '고정', () => { if (used) return; market.freeze(mNow(), B.talents.freezeSeconds); S.talents.freezeN = S.talents.freezeDay === S.day ? (S.talents.freezeN ?? 1) + 1 : 1; S.talents.freezeDay = S.day; toast(`시세를 ${B.talents.freezeSeconds}초 고정했어요`, 'brok'); sfx('bell'); buildUI(); }, { small: true });
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
    const qty = label('0개', { color: COLOR.paperInk, shadow: false, small: true }); qty.position.set(x, 2); r.addChild(qty); x += 28;
    const price = label('0', { color: COLOR.paperInk, shadow: false, small: true }); price.position.set(x, 2); r.addChild(price); x += 22;
    const arrow = icon(kit('arrow_up')); arrow.position.set(x, 3); r.addChild(arrow); x += 10;
    const spark = new Graphics(); spark.position.set(x, 1); r.addChild(spark);
    const btn = button('paper', 30, 12, '팔기', () => sell(o.key, 1), { small: true });
    btn.position.set(rowW - 31, 0); r.addChild(btn);
    ui.rows[o.key] = { r, bg, qty, price, arrow, spark, btn, w: rowW, sparkW: Math.max(0, rowW - 33 - x - 2) };
    c.addChild(r);
  });
  const all = button('paper', 60, 15, '전부 팔기', () => ORES.forEach((o) => sell(o.key, 1)), { small: true }); if (!isOpen(S, 'sellAll')) all.visible = false;
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
    const pf = portraitFrame(faceTex(Y5_ACTOR[m.id] ?? 'miner_brick'), rowH - 2, 'wood'); r.addChild(pf);
    const compact = rowH < 28;                                // 광부가 많으면 한 줄 (이름 · 상태)
    const nm = label(m.name, { color: m.color, small: compact }); nm.position.set(rowH + 4, compact ? Math.round((rowH - 10) / 2) : 1); r.addChild(nm);
    if (!compact) { const tr = B.traits[m.trait]; const role = label(tr ? `${tr.name} · ${tr.text.split(" · ")[0]}` : m.role, { small: true, color: COLOR.dim }); role.position.set(rowH + 8 + Math.round(nm.width), 3); fitText(role, w - role.x); r.addChild(role); }
    const st = label('', { small: true }); st.position.set(compact ? Math.max(rowH + 50, Math.round(w * 0.42)) : rowH + 4, compact ? nm.y : 15); r.addChild(st);
    c.addChild(r);
    ui.crew.push({ m, st });
  });
  return c;
}

// ================================================================ 설정 = 아이콘 격자 (체크인 「⋯」 메뉴처럼) · 제보 · 새 소식 · 편지함 · 운영자 제보함
let adminOn = false;
async function refreshAdmin() { adminOn = await isAdmin(); if (sheetTab === 'set') buildUI(); }
function makeSettings(w, h = 120) {
  const c = new Container();
  const tiles = [
    ['💌', '제보', openReport], ['📣', '새 소식', openNews], ['📬', '편지함', openMailbox], ['🏆', '랭킹', () => openRank()], ['📖', '설명서', () => { manualView = { key: MANUAL[0].key }; buildUI(); }],
    ['👤', online() ? '로그아웃' : '로그인', () => (online() ? doLogout() : openLoginForm())], ['🔊', '소리', openSound], ['🔄', '배우기', replayTutorial], ['⚠', '초기화', () => { if (confirm('저장을 지우고 처음부터 시작할까요?')) { saving = false; resetSave(); location.reload(); } }],
  ];
  if (adminOn) tiles.push(['📥', '제보함', openInbox]);
  const unread = (S.mail ?? []).filter((m) => !m.read).length;
  const cols = w / 5 >= 46 ? 5 : 4, tw = Math.floor((w - 4) / cols), th = Math.min(46, Math.max(32, Math.floor((h - 14) / Math.ceil(tiles.length / cols))));   // 이름이 안 잘리게 좁으면 4칸
  tiles.forEach(([ic, name, fn], i) => {
    const t = new Container(); t.position.set((i % cols) * tw, Math.floor(i / cols) * th); c.addChild(t);
    t.addChild(frame(name === '초기화' ? 'stone' : 'wood', tw - 3, th - 3, 'panel'));
    const e = label(ic, { shadow: false }); e.position.set(Math.round((tw - 3 - e.width) / 2), 3); t.addChild(e);
    const l = label(name, { small: true, color: name === '초기화' ? 0xe8a0a0 : COLOR.paper }); fitText(l, tw - 5); l.position.set(Math.round((tw - 3 - l.width) / 2), th - 3 - l.height - 2); t.addChild(l);
    if (name === '편지함' && unread) { const d = new Graphics().circle(tw - 8, 5, 3).fill(0xe8483a); t.addChild(d); }
    t.eventMode = 'static'; t.cursor = 'pointer'; t.on('pointertap', () => { unlockAudio(); sfx('ui_tap'); fn(); });
    ui.refs[`set_${name}`] = t;
  });
  const fps = label('', { small: true, color: 0x9cc45a }); fps.position.set(0, Math.ceil(tiles.length / cols) * th + 1);
  c.addChild(fps); ui.fps = fps;
  return c;
}
/** DOM 창 (글을 쓰고 읽는 곳은 HTML이 편함) — 체크인 창처럼 위에 뜨고 [닫기] */
function openPanel(title, html, mount) {
  document.getElementById('kpanel')?.remove();
  const el = document.createElement('div'); el.id = 'kpanel';
  el.innerHTML = `<div class="kp"><div class="kh"><b>${title}</b><button class="kx" aria-label="닫기">✕</button></div><div class="kb">${html}</div></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector('.kx').onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  mount?.(el.querySelector('.kb'), close);
  return el;
}
const escH = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const linkify = (h) => h.replace(/https?:\/\/[^\s<]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:io|com|net|kr|app|dev|me)(?:\/[^\s<]*)?/gi, (m) => { const tail = m.match(/[.,!?)\]…]+$/)?.[0] ?? ''; const u = tail ? m.slice(0, -tail.length) : m; const href = /^https?:/i.test(u) ? u : `https://${u}`; return `<a href="${href}" target="_blank" rel="noopener noreferrer">${u}</a>${tail}`; });   // 주소(https:// 없어도)는 새 탭 링크
const whenText = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** 💌 제보: 제목 없이 본문만 → 모모가 "전해 드릴게요" */
function openReport() {
  if (!online()) { openPanel('💌 제보', '<p class="kmuted">제보는 로그인하면 보낼 수 있어요 — 답장도 모모 편지로 받아요.</p><div class="krow"><button class="kgo">로그인</button></div>', (b, close) => { b.querySelector('.kgo').onclick = () => { close(); openLoginForm(); }; }); return; }
  openPanel('💌 제보', `<textarea maxlength="1000" placeholder="버그 · 건의 · 아무 말이나 (모모가 전해 드려요)"></textarea>${errLog.length ? `<p class="kmuted">최근 오류 ${errLog.length}건이 함께 가요 (고치는 데 써요)</p>` : ''}<p class="kmsg"></p><div class="krow"><button class="kgo">보내기</button></div>`, (b, close) => {
    const ta = b.querySelector('textarea'), msg = b.querySelector('.kmsg'), go = b.querySelector('.kgo');
    setTimeout(() => ta.focus(), 50);
    go.onclick = async () => {
      const body = ta.value.trim(); if (!body) { msg.textContent = '내용을 써 주세요'; return; }
      go.disabled = true; msg.textContent = '…';
      const errs = errLog.slice(0, 3).map((x) => `[오류 ${x.ver} ${x.st}] ${x.msg} @ ${x.stack}`).join('\n');
      const r = await sendLetter(errs ? `${body}\n\n${errs}`.slice(0, 1000) : body, `mine-${VERSION}`);
      if (r.ok && errs) { errLog.length = 0; try { localStorage.removeItem('kod.errors'); } catch {} }
      if (!r.ok) { go.disabled = false; msg.textContent = r.why === 'login' ? '로그인이 풀렸어요' : '보내지 못했어요. 잠시 뒤에 다시 해 주세요'; return; }
      S.letters ??= { sent: [], seen: [] }; if (r.id != null) S.letters.sent.push(r.id); save();
      close(); showDialog({ who: 'momo', lines: ['편지 잘 받았어요. 전해 드릴게요!'] });
    };
  });
}
/** 📣 새 소식: 체크인 공지(notices) + 채굴 패치노트 */
function openNews() {
  openPanel('📣 새 소식', '<div class="ktabs"><button data-t="n" class="on">공지</button><button data-t="p">패치노트</button></div><div class="klist">불러오는 중…</div>', (b) => {
    const list = b.querySelector('.klist');
    const notes = () => PATCH_NOTES.map((p) => `<div class="kitem"><b>${p.v}</b><small>${p.d}</small><ul>${p.items.map((t) => `<li>${escH(t)}</li>`).join('')}</ul></div>`).join('');
    const notices = async () => { const rows = await listNotices(); list.innerHTML = rows.length ? rows.map((r) => `<div class="kitem"><b>${escH(r.title)}</b><small>${new Date(r.created_at).toLocaleDateString('ko-KR')}</small><p>${linkify(escH(r.body)).replace(/\n/g, '<br>')}</p></div>`).join('') : '<p class="kmuted">아직 공지가 없어요</p>'; };
    b.querySelectorAll('.ktabs button').forEach((t) => (t.onclick = () => { b.querySelectorAll('.ktabs button').forEach((x) => x.classList.toggle('on', x === t)); if (t.dataset.t === 'p') list.innerHTML = notes(); else { list.textContent = '불러오는 중…'; notices(); } }));
    notices();
  });
}
/** 📬 편지함: 모모 편지 다시 보기 (급등 예고 · 오늘의 과제 · 제보 답장) */
function mail(text, title = '모모 편지') {
  S.mail ??= []; S.mail.unshift({ at: Date.now(), title, text, read: false }); S.mail.length = Math.min(S.mail.length, 50); save();
  if (sheetTab === 'set') buildUI();
}
function openMailbox() {
  const ms = S.mail ?? [];
  openPanel('📬 편지함', ms.length ? ms.map((m) => `<div class="kitem ${m.read ? '' : 'new'}"><b>${escH(m.title)}</b><small>${whenText(m.at)}</small><p>${escH(m.text)}</p></div>`).join('') : '<p class="kmuted">아직 받은 편지가 없어요</p>');
  ms.forEach((m) => (m.read = true)); save(); buildUI();
}
/** 🔊 소리 · 화면 */
function openSound() {
  const v = volumes();
  openPanel('🔊 소리 · 화면', `<label>음악 <input type="range" min="0" max="100" step="5" data-k="bgm" value="${Math.round(v.bgm * 100)}"></label><label>효과음 <input type="range" min="0" max="100" step="5" data-k="sfx" value="${Math.round(v.sfx * 100)}"></label><div class="krow"><button class="klow">저사양 ${low ? '켬' : '끔'}</button><button class="kfs">전체 화면</button></div>`, (b) => {
    b.querySelectorAll('input[type=range]').forEach((r) => (r.oninput = () => { unlockAudio(); const k = r.dataset.k; setVolumes({ [k]: +r.value / 100 }); S.settings[k === 'bgm' ? 'bgmVol' : 'sfxVol'] = +r.value / 100; S.settings.sound = true; save(); }));
    b.querySelector('.klow').onclick = (e) => { setLow(!low); e.target.textContent = `저사양 ${low ? '켬' : '끔'}`; };
    b.querySelector('.kfs').onclick = () => document.documentElement.requestFullscreen?.().catch(() => {});
  });
}
/** 📥 운영자 제보함: 채굴 제보 목록 (닉 · 시각 · 본문 · [답장]) — 답장은 그 유저의 다음 접속 때 모모 편지로 */
function openInbox() {
  openPanel('📥 제보함 (채굴)', '<div class="klist">불러오는 중…</div>', async (b) => {
    const list = b.querySelector('.klist');
    const rows = await adminMineLetters();
    if (!rows.length) { list.innerHTML = '<p class="kmuted">채굴 제보가 아직 없어요</p>'; return; }
    list.innerHTML = rows.map((r) => `<div class="kitem" data-id="${r.id}"><b>${escH(r.nickname ?? '(손님)')}</b><small>${whenText(r.created_at)} · ${escH(r.app_version ?? '')} · ${escH(r.status)}</small><p>${escH(r.body)}</p>${r.reply ? `<p class="kreply">↳ ${escH(r.reply)}${r.reply_read ? ' · 읽음' : ''}</p>` : ''}<div class="krow"><button class="krep">${r.reply ? '답장 고치기' : '답장'}</button></div></div>`).join('');
    list.querySelectorAll('.krep').forEach((btn) => (btn.onclick = () => {
      const item = btn.closest('.kitem'), id = +item.dataset.id;
      if (item.querySelector('textarea')) return;
      const box = document.createElement('div'); box.innerHTML = '<textarea maxlength="500" placeholder="답장 (그 유저가 다음에 들어오면 모모 편지로)"></textarea><div class="krow"><button class="ksend">보내기</button></div><p class="kmsg"></p>';
      item.appendChild(box);
      box.querySelector('.ksend').onclick = async () => {
        const t = box.querySelector('textarea').value.trim(); if (!t) return;
        const ok = await adminReply(id, t);
        box.querySelector('.kmsg').textContent = ok ? '보냈어요' : '보내지 못했어요';
        if (ok) { const p = document.createElement('p'); p.className = 'kreply'; p.textContent = '↳ ' + t; item.insertBefore(p, box); box.remove(); btn.textContent = '답장 고치기'; }
      };
    }));
  });
}
/** 접속할 때: 내 채굴 제보에 온 답장 → 모모 편지 → 읽음 (서버 my_letter_replies('mine') — 체크인은 채굴 답장을 안 가져감) */
async function checkReplies() {
  if (!online()) return;
  const rows = await myMineReplies();
  if (!rows.length) return;
  for (const r of rows) {
    mail(`「${String(r.body).slice(0, 40)}${String(r.body).length > 40 ? '…' : ''}」에 답장이 왔어요 — ${r.reply}`, '💌 제보 답장');
    notify(() => showDialog({ who: 'momo', lines: ['제보에 답장이 왔어요!', r.reply] }));
  }
  await markRepliesRead(rows.map((r) => r.id));
}
setInterval(() => { if (online()) checkReplies(); }, 10 * 60 * 1000);

function refreshUI() {
  if (!ui.counters) return;
  ui.counters.coin && (ui.counters.coin.text = String(S.gold));
  ui.counters.wh && (ui.counters.wh.text = `${whTotal()}/${whCap()}`);
  if (ui.counters.rate) { const full = whTotal() >= whCap(); ui.counters.rate.text = full ? '가득' : `${engineRate().toFixed(1)}/초`; ui.counters.rate.style.fill = full ? 0xff8a7a : 0xf4ecd2; }
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
    r.qty.text = `${stash[key]}개`;
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
let toastLast = { msg: '', n: 0 };
function toast(msg, who, secs) {
  const t = ui.toast;
  if (!t) return;
  if (toastT > 0 && toastLast.msg === msg) { toastLast.n++; msg = `${msg} ×${toastLast.n}`; } else toastLast = { msg, n: 1 };   // 명세5 §9
  t.removeChildren().forEach((c) => c.destroy());
  const face = who ? 34 : 0;
  const maxW = Math.round(L.colW / L.uiS) - 12 - face - 16;
  const tx = label(msg, { color: COLOR.paperInk, shadow: false, small: true, wrap: maxW });
  const w = Math.ceil(tx.width) + 16 + face, h = Math.max(who ? 44 : 20, Math.ceil(tx.height) + 10);
  t.addChild(frame('paper', w, h, 'panel'));
  if (who) { const pf = portraitFrame(tex(NPC[who]), 36, 'wood'); pf.position.set(4, 4); t.addChild(pf); }
  t.addChild(tx);
  tx.position.set(8 + face + (who ? 4 : 0), Math.round((h - tx.height) / 2));
  const Wu = Math.round(L.W / L.uiS);
  const bottom = Math.round(L.vis.y1 / L.uiS) - 4;
  t.position.set(Math.round(((L.vis.x0 + L.vis.x1) / 2) / L.uiS - w / 2), bottom - h);
  t.visible = true;
  toastT = secs ?? 3;
}

function setLow(v) { low = v; S.settings.low = v; save(); }
document.getElementById('ref').onclick = () => document.getElementById('ref').classList.remove('show');
document.getElementById('ref-shaft').src = A('scenes/shaft_night.png');
const uiFx = [];
market.onTick = () => { refreshUI(); };
// 급등: 30초 전 모모 편지 → 그 광종 행이 UI 펄스 → 40초 동안 ×1.8
market.onWarn = (key, warn = B.surgeWarn) => notify(() => {
  tip('surge'); sfx('letter');
  const o = ORES.find((q) => q.key === key), who = B.buyers[buyerOf(key)].name;
  toast(`오늘 저녁 ${who}이(가) ${o.name}을(를) 비싸게 산대요! (${warn}초 뒤)`, 'momo', 5); mail(`오늘 저녁 ${who}이(가) ${o.name}을(를) 비싸게 산대요! 창고에 두고 기다려 보세요.`);
  sfx('bell');
}, () => !market.surge || mNow() >= market.surge.start);
market.onSurge = (key) => notify(() => { const o = ORES.find((q) => q.key === key); toast(`지금 ${o.name} 시세 ×${CF.surgeMul}! 40초 동안`, 'momo', 3); sfx('surge'); }, surgeGone(key));

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
const digSeconds = (t) => (ORE_KEYS.has(t) ? B.digTime.ore : t === 'd' ? CF.dirt : (B.digTime[t] ?? 1)) / CF.pickSpeed / CF.digMul / (tutOn() ? 2 : 1);
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
    if (v.size >= CF.bigVein && !S.round.jackpotVeins?.includes(id)) {
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
let breaker = null;                                        // 지금 칸을 깬 광부 (성격 숫자용)
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
  if (S.round?.stats) { const st0 = S.round.stats; st0.maxDepth = Math.max(st0.maxDepth ?? 0, gy + 1); if (ORE_KEYS.has(t)) { st0.oreCells ??= {}; st0.oreCells[t] = (st0.oreCells[t] ?? 0) + 1; } }   // 명세6-1 §3: 갱도로 삼을 때
  if (ORE_KEYS.has(t)) {
    fx(t === 'c' ? 'fx_vein_glow' : 'fx_vein', x0 + 8, y0 + 8);
    const near = liveCarts().find((c) => c.mode === 'park' && loadOf(c) < CF.cartLoad && typeof c.node === 'number' && (c.node === from || c.node === idx(gx, gy) || (Math.abs(cxy(c.node)[0] - gx) + Math.abs(cxy(c.node)[1] - gy)) <= 1));
    if (near) { near.cargo[t]++; near.idleT = 0; }                  // v0.8: 갱도 끝까지 들어온 광차가 바로 받음
    else { const p = piles.find((q) => q.gx === gx && q.gy === gy && q.type === t); if (p) p.n++; else piles.push({ gx, gy, type: t, n: 1 }); }
  } else fx(t === 'd' ? 'fx_dirt' : 'fx_rock', x0 + 8, y0 + 8);
  if (t === 'R') {                                          // 유물 상자: 금화 + 도감
    const gold = Math.round((B.relicGold[0] + Math.random() * (B.relicGold[1] - B.relicGold[0])) * (breaker?.relicMul ?? 1));
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
    if (Math.random() < dt * 0.5) for (const a of crew) if (a.y > GY && !a.gasImmune && Math.random() < 0.4) emote(a, '콜록', 1);
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
const shaftNext = (s) => (s.dir === 'left' ? [s.hx - 1, s.hy] : s.dir === 'right' ? [s.hx + 1, s.hy] : s.dir === 'up' ? [s.hx, s.hy - 1] : [s.hx, s.hy + 1]);
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
  { const st = tutStep(), q = S.round?.shafts?.find((x) => x.id === id); if (st?.waitTurn && q && q.dir !== 'wait') { tutShake(); return; } }
  const rd = S.round, s = rd?.shafts?.find((q) => q.id === id); if (!s) return;
  if (d === 'down') { s.dir = 'down'; s.side = 0; }
  else { if (s.hy < 0 || (d === 'up' && s.hy <= 0)) return; s.side = s.dir === d ? s.side + 1 : 1; s.dir = d; }
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
      if (s.dir === 'up') { if (--s.side <= 0) { s.side = 0; s.dir = 'wait'; } }   // ▲: 누른 만큼 위로 뒤 멈춤
      else if (s.dir !== 'down' && --s.side <= 0) { s.side = 0; s.dir = 'down'; }
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
    rd.jobs.push({ x: nx, y: ny, from: s.hy < 0 ? 'S' : idx(s.hx, s.hy), ladder: s.dir === 'down' || s.dir === 'up', prev: s.hy < 0 ? 'S' : [s.hx, s.hy], shaft: s.id });
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
// ---- 방향키 (PATCH_V12 §3): 게임 오른쪽 아래 한 벌 — ◀ ▲ ▶ / ▼ (각 40px). 고른 갱도(selShaft)에 적용. 멈춰 기다리면 살짝 커지고 노란 테두리, 파는 중엔 60%
let selShaft = null, pendingEnt = null;
const curShaft = () => { const sh = S.round?.shafts ?? []; let c = sh.find((q) => q.id === selShaft); if (!c || (c.dir !== 'wait' && sh.some((q) => q.dir === 'wait' && !q.blocked))) c = sh.find((q) => q.dir === 'wait' && !q.blocked) ?? c ?? sh[sh.length - 1]; if (c) selShaft = c.id; return c; };
function tapEntrance(gx) {
  const ex = S.round.shafts?.find((q) => q.x === gx);
  if (ex) { selShaft = ex.id; sfx('ui_tap'); return; }
  if (pendingEnt) return;
  const st = tutStep();
  if (st && (st.shaftX == null || gx !== st.shaftX)) { tutShake(); return; }
  if ((S.round.shafts?.length ?? 0) >= shaftMax()) { openShaft(gx); return; }        // 안내 토스트
  pendingEnt = { gx, until: time + 0.3 };                                             // 반투명 입구 0.3초 → 확정
}
function drawShaftUI() {
  const rd = S.round, show = rd?.state === 'DIG' && view === 'mine' && !introView;
  shaftHeadG.clear(); shaftHits = [];
  if (pendingEnt && show) {
    const cx = cellX(pendingEnt.gx), y0 = GY, a = 0.35 + 0.3 * Math.sin(time * 20);
    shaftHeadG.moveTo(cx - 7, y0).lineTo(cx - 1, y0 - 15).moveTo(cx + 7, y0).lineTo(cx + 1, y0 - 15).stroke({ width: 1.5, color: 0xd8c8a0, alpha: a });
    if (time >= pendingEnt.until) { const gx = pendingEnt.gx; pendingEnt = null; if (openShaft(gx)) selShaft = rd.shafts[rd.shafts.length - 1].id; }
  } else if (!show) pendingEnt = null;
  const s = show ? curShaft() : null;
  shaftUI.visible = !!s;
  const waiting = !!s && s.dir === 'wait' && !s.blocked, up0 = !!s && s.hy <= 0;
  const key = s ? `${L.uiS}|${L.mode}|${s.id}|${s.dir}|${s.hy < 0 ? 0 : 1}|${up0}|${s.blocked ?? ''}|${waiting}|${rd.shafts.length}` : '';
  if (key !== shaftKey) {
    shaftKey = key; shaftBtns = {};
    shaftUI.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (s) {
      const bs = Math.round(40 / L.uiS);
      for (const d of ['left', 'up', 'right', 'down']) {
        const off = s.hy < 0 || (d === 'up' && up0);
        const b = button(waiting ? 'wood' : 'stone', bs, bs, d === 'left' ? '◀' : d === 'right' ? '▶' : d === 'up' ? '▲' : '▼', () => turnShaft(s.id, d));
        if (off) b.setDisabled(true);
        b.dir = d; shaftUI.addChild(b); shaftBtns[d] = b;
      }
      const ring = new Graphics(); ring.isRing = true; shaftUI.addChild(ring);
      if (s.blocked) { const l = button('wood', bs * 3 + 4, 16, s.blocked === 'a' ? '고대석 — ⛏ Lv3' : '단단한 바위 — ⛏ Lv2', () => openGear('pick'), { small: true }); l.isNote = true; shaftUI.addChild(l); shaftBtns.note = l; }
      if (rd.shafts.length > 1 || shaftMax() > 1) { const n = label(`입구 ${rd.shafts.length}/${shaftMax()}${rd.shafts.length > 1 ? ` · ${rd.shafts.indexOf(s) + 1}번` : ''}`, { small: true, color: COLOR.paper }); n.isTag = true; shaftUI.addChild(n); }
    }
  }
  if (!s) return;
  // 자리: 게임 영역 오른쪽 아래 구석
  const bs = 40, gap = 4, m = 8, grow = waiting ? 1 + 0.06 * (1 + Math.sin(time * 5)) : 1;
  const x0 = L.vis.x1 - m - 3 * bs - 2 * gap - (L.overY > 0 ? 18 : 0), y0 = L.vis.y1 - m - 2 * bs - gap;
  const at = { left: [x0, y0], up: [x0 + bs + gap, y0], right: [x0 + 2 * (bs + gap), y0], down: [x0 + bs + gap, y0 + bs + gap] };
  shaftUI.scale.set(L.uiS); shaftUI.position.set(0, 0);
  for (const b of shaftUI.children) {
    if (b.isNote) { b.position.set(Math.round(x0 / L.uiS), Math.round((y0 - 22) / L.uiS)); shaftHits.push({ x: x0, y: y0 - 22, w: b.width * L.uiS, h: b.height * L.uiS }); continue; }
    if (b.isTag) { b.position.set(Math.round(x0 / L.uiS), Math.round((y0 - (s.blocked ? 40 : 18)) / L.uiS)); continue; }
    if (b.isRing) { b.clear(); if (waiting) for (const d of ['left', 'up', 'right', 'down']) { const [bx, by] = at[d]; b.rect(bx / L.uiS - 1, by / L.uiS - 1, bs / L.uiS + 2, bs / L.uiS + 2).stroke({ width: 1, color: 0xf5cf6a, alpha: 0.6 + 0.4 * Math.sin(time * 6) }); } continue; }
    const [bx, by] = at[b.dir];
    b.scale.set(grow); b.position.set(Math.round((bx - (grow - 1) * bs / 2) / L.uiS), Math.round((by - (grow - 1) * bs / 2) / L.uiS));
    b.alpha = waiting ? 1 : 0.6;
    shaftHits.push({ x: bx, y: by, w: bs, h: bs });
  }
  // 갱도 머리: 고른 갱도는 노란 테두리, 다음에 팔 칸은 반짝 (막혔으면 빨강)
  for (const q of rd.shafts) {
    if (q.hy >= 0) shaftHeadG.rect(GX + q.hx * T + 0.5, GY + q.hy * T + 0.5, T - 1, T - 1).stroke({ width: 1, color: q === s ? 0xf5cf6a : 0xf4ecd2, alpha: q === s ? 0.9 : 0.3 });
    const [nx, ny] = q.blocked ? shaftNext({ ...q, dir: 'down' }) : shaftNext(q);
    if (q.dir !== 'wait' || q.blocked) shaftHeadG.rect(GX + nx * T + 0.5, GY + ny * T + 0.5, T - 1, T - 1).stroke({ width: 1, color: q.blocked ? 0xe05050 : 0xfff4b8, alpha: 0.45 + 0.35 * Math.sin(time * 6) });
  }
}
/** 붕괴로 메워진 칸 → 광부가 다시 뚫음 */
function redig(cells) {
  const rd = S.round;
  for (const [x, y] of cells) if (!rd.jobs.some((j) => j.x === x && j.y === y)) rd.jobs.unshift({ x, y, from: null, ladder: false, prev: null, redig: true });
}

// ---- 광부 행동: 브릭·툼바 = 선두 채굴 / 엘린·새 광부 = 운반
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
  let sp = (vertical ? B.climbSpeed : (a.carrying ? B.carrySpeed * (a.carryMul ?? 1) : B.walkSpeed)) * T;
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
    if (S.round.gasLeft > 0 && !a.gasImmune) { setAnim(a, `${a.id}_idle`); a.state = 'cough'; return; }
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
    const need = digSeconds(W.g[y][x]) / (a.digMul ?? 1);
    if (a.digT >= need) {
      a.digT = 0;
      rd.jobs = rd.jobs.filter((j) => !(j.x === x && j.y === y));
      const done = a.job;
      breaker = a; breakCell(x, y, nodeOf(a), done);
      if (CF.pickDouble && done.vein != null) {             // 곡괭이 Lv5: 맞닿은 광맥 칸 하나 더
        const j2 = rd.jobs.find((j) => j.vein === done.vein && Math.abs(j.x - x) + Math.abs(j.y - y) === 1 && W.g[j.y][j.x] !== '.' && !crew.some((o) => o.job === j));
        if (j2) { rd.jobs = rd.jobs.filter((j) => j !== j2); breakCell(j2.x, j2.y, nodeOf(a), j2); }
      }
      breaker = null; a.job = null;
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
/** 광차가 설 자리: 선두 광부에게서 가장 가까운, 바닥이 있는 칸 */
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
    if (h >= B.hurtAt) { stun = B.hurtStunSeconds * CF.stunMul * (a.stunMul ?? 1); hurt(a); }
    else if (h >= B.stunAt) stun = B.stunSeconds * CF.stunMul * (a.stunMul ?? 1);
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
    if (a.walkIn != null) {                                  // 새 광부: 다리에서 걸어 들어옴
      const d = a.walkIn - a.x; a.face = Math.sign(d) || 1; a.x += Math.sign(d) * Math.min(Math.abs(d), B.walkSpeed * T * dt); a.y = SURFACE_Y + 0.5; a.node = 'S';
      setAnim(a, `${a.id}_walk`); a.state = 'walk'; if (Math.abs(d) < 0.5) a.walkIn = null; continue;
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
  if (!L.pc && !S.settings.sheetFolded && view === 'mine') { setSheet(false); return; }   // §1: 게임 탭하면 시트 접힘
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
    if (wy < GY + T && wy > GY - 48 && gx >= 0 && gx < GW) tapEntrance(gx);
    else { const [, gy] = cellAtWorld(wx, wy); const hit = S.round.shafts?.find((q) => Math.abs(q.hx - gx) <= 0 && Math.abs(q.hy - gy) <= 1); if (hit) { selShaft = hit.id; sfx('ui_tap'); } }
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


// v1.2.7: 프레임 하나가 오류로 끊겨도 게임은 계속 (PixiJS 는 리스너가 던지면 다음 프레임을 안 잡는다 → 화면이 멈춤). 오류는 남겨서 제보에 자동 첨부
const errLog = [];
let errToastAt = -99;
/** 엔진 (명세6-1): 매 프레임 현실 시간으로 캐기 → 나르기. 오래 비었으면 빨리감기 + 카드 */
const engineTotal = () => ({ wh: whTotal(), cap: whCap() });
let engSeen = { dug: 0, t: 0 }, engRateShown = 0;
function engineTick() {
  if (!S.engine) return;
  const en = S.engine, nowMs = Date.now(), gap = (nowMs - en.lastTick) / 1000;
  en.lastTick = nowMs;
  if (gap <= 0) return;
  if (gap > 5) {
    const away = {}, before = whTotal(), r = engineFastForward(S, gap, stash, whCap(), (S0, st) => foremenTick(st, away)); r.foremen = away;
    if (S.unl && whTotal() >= whCap()) S.unl.whFull = 1;
    if (gap >= B.engine.awayCardSeconds && (r.total > 0 || r.full)) notify(() => { welcome = { engine: true, away: gap, ...r }; buildUI(); setTimeout(() => sfx('welcome'), 300); });
    if (whTotal() !== before) refreshUI();
    save(); return;
  }
  const o = engineStep(S, gap, stash, whCap());
  if (S.unl && !S.unl.whFull && whTotal() >= whCap()) S.unl.whFull = 1;
  engSeen.dug += o.dug; engSeen.t += gap;
  if (engSeen.t >= 1) { engRateShown = engSeen.dug / engSeen.t; engSeen = { dug: 0, t: 0 }; }
  if (o.carried) { refreshUI(); if (view === 'company') yardPulse('wh'); }
}
let yardPulseT = {};
const yardPulse = (k) => { yardPulseT[k] = time; };
if (/debug=engine/.test(location.search)) {
  const dbg = document.createElement('pre'); dbg.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99;margin:0;padding:4px 6px;font:11px/1.35 monospace;color:#bfffbf;background:rgba(0,0,0,.72);pointer-events:none;white-space:pre';
  document.body.appendChild(dbg);
  const BN = { dig: '캐기', carry: '나르기', wh: '창고', empty: '갱도 없음' };
  setInterval(() => { const en = S.engine, co = cartOf(en.lv.cart); dbg.textContent = `캐기 ${digRate(S).toFixed(2)}/초 (실제 ${engRateShown.toFixed(2)}) · 광부 ${minersTotal(S)}\n나르기 ${co.rate.toFixed(2)}/초 (${co.n}대×${co.load}/${co.trip.toFixed(1)}초)\n더미 ${pileOf(S).toFixed(1)}/${pileCapOf(en.lv.warehouse)} · 창고 ${whTotal()}/${whCap()}\n병목: ${BN[bottleneck(S, whTotal(), whCap())]}\nLv 곡${en.lv.pick} 숙${en.lv.lodge} 차${en.lv.cart} 창${en.lv.warehouse} 제${en.lv.smelter} · 💰${S.gold} · 업글 ${S.counters?.builds ?? 0}`; }, 250);
}
// ================================================================ 해금 템포 (명세6-3): 조건이 차는 순간 한 줄 + 반짝 · HUD "!" 다시 보기
S.playSec ??= 0;
function unlockCtx() {
  return { pickLv: S.engine.lv.pick, cartLv: S.engine.lv.cart, smeltLv: S.engine.lv.smelter, whFull: S.unl?.whFull ?? 0, sold: S.counters?.soldGold ?? 0, rate: engineRate(), mines: S.engine.mines.length, expeditions: S.counters?.expeditions ?? 0, relics: S.stats.relics?.length ?? 0 };
}
if (!S.unl) {                                                            // 처음: 예전 저장(원정을 해 본 사람)은 다 열어 둠
  S.unl = { got: {}, seen: 0, whFull: 0 };
  if ((S.stats.rounds ?? 0) > 0 || S.tutorial.done) { for (const u of B.unlocks) S.unl.got[u.id] = 0; S.unl.seen = B.unlocks.length; }
}
function unlockTick() {
  if (!S.engine || introView) return;
  const got = checkUnlocks(S, unlockCtx(), S.playSec);
  for (const u of got) {
    S.unl.flash = { keys: u.opens, until: S.playSec + 5 };
    if (u.opens.includes('abandoned')) S.floorUnlocked = Math.max(S.floorUnlocked ?? 1, 2);
    notify(() => {
      if (u.who === 'guilds') GUILD_LINES.forEach((l, i) => setTimeout(() => toast(`${B.guilds[i].name}: ${l.enter}`, `guild${i}`, 2.5), i * 2600));
      else toast(u.line, u.who ?? 'momo', 3.5);
      sfx('bell');
    });
  }
  if (got.length) { save(); buildUI(); }
}
setInterval(() => { if (document.visibilityState === 'visible') S.playSec += 1; unlockTick(); foremenTick(1); }, 1000);
/** HUD "!": 열린 것 다시 보기 */
function openUnlocks() {
  S.unl.seen = Object.keys(S.unl.got).length; save(); buildUI();
  const t = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  openPanel('✨ 새로 열린 것', B.unlocks.filter((u) => S.unl.got[u.id] != null).reverse().map((u) => `<div class="kitem"><b>${u.line}</b><small>${t(S.unl.got[u.id])} · ${needText(u.opens[0])}</small></div>`).join('') + (B.unlocks.find((u) => S.unl.got[u.id] == null) ? `<p class="kmuted">다음: ${needText(B.unlocks.find((u) => S.unl.got[u.id] == null).opens[0])}</p>` : ''));
}
const flashOn = (key) => S.unl?.flash && S.playSec < S.unl.flash.until && S.unl.flash.keys.includes(key);
/** 잠긴 건물 (해금 전엔 공사 예정지 + 자물쇠) */
const BLD_LOCK = { cartShed: 'cart', lodge: 'lodge', lanternShop: 'lantern' };
const bldLocked = (k) => BLD_LOCK[k] && !isOpen(S, BLD_LOCK[k]);
if (/debug=tempo/.test(location.search)) {
  const dbg = document.createElement('pre'); dbg.style.cssText = 'position:fixed;right:4px;bottom:4px;z-index:99;margin:0;padding:4px 6px;font:11px/1.35 monospace;color:#ffe9a8;background:rgba(0,0,0,.75);pointer-events:none;white-space:pre';
  document.body.appendChild(dbg);
  const mm = (sec) => `${String(Math.floor(sec / 60)).padStart(2)}:${String(sec % 60).padStart(2, '0')}`;
  setInterval(() => { dbg.textContent = `플레이 ${mm(S.playSec)}\n` + B.unlocks.map((u) => `#${String(u.id).padStart(2)} ${S.unl.got[u.id] != null ? mm(S.unl.got[u.id]) : '  —  '} ${needText(u.opens[0])} → ${u.opens.join('·')}`).join('\n'); }, 500);
}
// ---- 십장 (명세6-3 §2): 판매 마르타 · 제련 도르 · 운반 핀 — 방치 중에도 일함
S.foremen ??= { marta: { hired: false, on: true, pct: B.foremen.marta.pct }, dor: { hired: false, on: true }, fin: { hired: false, on: true } };
const foremanCan = (k) => { const f = B.foremen[k]; return f.open ? isOpen(S, f.open) : (S.engine.lv[f.need[0]] ?? 0) >= f.need[1]; };
const foremanNeed = (k) => { const f = B.foremen[k]; return f.open ? needText(f.open) : `${B.engine.up[f.need[0]].name} Lv${f.need[1]}`; };
/** 마르타·도르 한 번 (dt초) — away 면 빨리감기 중 (돌아왔을 때 보고) */
function foremenTick(dt, away = null) {
  const F = S.foremen; if (!F || !S.engine) return;
  const m = F.marta;
  if (m.hired && m.on && whTotal() >= whCap() * B.foremen.marta.fill) {
    for (const o of ORES) {
      const n = stash[o.key]; if (!n || market.coef[o.key] < m.pct) continue;
      const gain = n * priceOf(o.key); stash[o.key] = 0; S.gold += gain; count('soldGold', gain);
      if (away) { away.marta ??= { n: 0, gold: 0, ore: {} }; away.marta.n += n; away.marta.gold += gain; away.marta.ore[o.name] = (away.marta.ore[o.name] ?? 0) + n; }
      else { toast(`마르타가 ${o.name} ${n}개를 팔았어요 +${gain}`, 'marta', 2); bumpCounter('coin'); }
    }
    if (!away) refreshUI();
  }
  const d = F.dor;
  if (d.hired && d.on && CF.smeltSlots) {
    while (S.smelt.jobs.length + S.smelt.queue.length < CF.smeltSlots) {
      const best = ORES.filter((o) => stash[o.key] > 0).sort((p, q) => B.basePrice[q.key] - B.basePrice[p.key])[0]; if (!best) break;
      stash[best.key]--; S.smelt.queue.push(best.key);
      if (away) { away.dor = (away.dor ?? 0) + 1; }
    }
    updateSmelt();
  }
}
function openForemen() {
  const row = (k) => { const f = B.foremen[k], st = S.foremen[k], can = foremanCan(k);
    return `<div class="kitem"><b>${f.name}</b><small>${{ marta: `창고 ${Math.round(B.foremen.marta.fill * 100)}% 넘고 시세가 평균×${st.pct.toFixed(2)} 이상이면 자동 판매`, dor: '제련 칸이 비면 가장 비싼 광석부터 자동 투입', fin: '광차 왕복 −15% · 입구 더미 가득이면 광차 +1' }[k]}</small>`
      + (st.hired ? `<div class="krow"><button class="ktog" data-k="${k}">${st.on ? 'ON' : 'OFF'}</button>${k === 'marta' ? `<label style="flex:1">기준 <input type="range" min="0.8" max="1.4" step="0.05" value="${st.pct}" data-k="pct"> <b class="kpv">×${st.pct.toFixed(2)}</b></label>` : ''}</div>`
        : can ? `<div class="krow"><button class="khire" data-k="${k}">고용 💰${f.cost.toLocaleString()}</button></div>` : `<small class="kmuted">🔒 ${foremanNeed(k)}이면 고용할 수 있어요</small>`) + '</div>'; };
  openPanel('👷 십장', ['marta', 'dor', 'fin'].map(row).join('') + '<p class="kmuted">방치 중에도 일해요 · 꺼 두면 쉬어요</p>', (b, close) => {
    b.querySelectorAll('.khire').forEach((x) => (x.onclick = () => { const k = x.dataset.k, f = B.foremen[k]; if (S.gold < f.cost) { toast('금화가 모자라요'); return; } S.gold -= f.cost; S.foremen[k].hired = true; sfx('welcome'); toast(`${f.name} 고용!`, k, 2.5); save(); buildUI(); close(); openForemen(); }));
    b.querySelectorAll('.ktog').forEach((x) => (x.onclick = () => { const st = S.foremen[x.dataset.k]; st.on = !st.on; save(); close(); openForemen(); buildUI(); }));
    const r = b.querySelector('input[data-k=pct]'); if (r) r.oninput = () => { S.foremen.marta.pct = +r.value; b.querySelector('.kpv').textContent = `×${(+r.value).toFixed(2)}`; save(); };
  });
}
/** HUD 초당: 창고 가득이면 0, 아니면 캐기·나르기 중 느린 쪽 */
const engineRate = () => (whTotal() >= whCap() || !S.engine ? 0 : Math.min(digRate(S), cartOfS(S).rate));
/** 엔진 업글 한 번 (건물 카드·장비 탭) */
function engineBuy(k, quiet = false) {
  const lockK = { cart: 'cart', warehouse: 'warehouse', lodge: 'lodge', smelter: 'smelter' }[k];
  if (lockK && !isOpen(S, lockK)) { if (!quiet) toast(`${needText(lockK)}이면 열려요`); return false; }
  const cost = engineCost(S, k);
  if (S.gold < cost) { if (!quiet) { toast('금화가 모자라요'); sfx('pass', true); } return false; }
  S.gold -= cost; S.engine.lv[k]++; count('builds');
  const lv = S.engine.lv[k], ms = B.engine.milestones.includes(lv);
  refreshCompany(); autoPlace(S);
  if (k === 'lodge') { balanceMinersNow(); ensureCrew(true); }
  if (ms) { toast(`${B.engine.up[k].name} Lv${lv}! 효과 ×2`, 'momo', 3); sfx('jackpot'); flash = 0.6; shake = 0.25; shakeAmp = 2; }
  else if (!quiet) sfx('upgrade');
  save(); buildUI(); bumpCounter('coin');
  return true;
}
const balanceMinersNow = () => { const ms = S.engine.mines; let left = minersTotal(S) - ms.reduce((a, m) => a + m.miners, 0); const live = ms.filter((m) => m.reserve > 0); while (left > 0 && live.length) { live.sort((p, q) => p.miners - q.miners)[0].miners++; left--; } };
/** 갱도 목록 (갱도 입구 톡): 이름 · 남은 양 · 광부 ± · 광종 · [새 원정] */
function openMines() {
  const en = S.engine, oreName = Object.fromEntries(ORES.map((o) => [o.key, o.name]));
  const row = (m) => { const pct = Math.round((m.reserve / m.reserveMax) * 100), mix = Object.entries(m.oreMix).filter(([, v]) => v >= 0.02).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${oreName[k]} ${Math.round(v * 100)}%`).join(' · ');
    return `<div class="kitem"${m.reserve <= 0 ? ' style="opacity:.5"' : ''}><b>${m.name}${m.reserve <= 0 ? ' — 다 캤어요' : ''}</b><div style="height:6px;background:#3a2e28;border-radius:3px;margin:4px 0"><div style="height:6px;width:${pct}%;background:#d39a3a;border-radius:3px"></div></div><small>남은 양 ${Math.ceil(m.reserve)}/${m.reserveMax} · 깊이 ×${m.depth.toFixed(2)} · ${mix}</small><div class="krow" style="margin-top:4px"><button class="kmn" data-id="${m.id}" data-d="-1">−</button><b style="padding:0 8px">광부 ${m.miners}</b><button class="kmn" data-id="${m.id}" data-d="1">+</button></div></div>`; };
  openPanel('⛏ 갱도', `<p>광부 <b>${minersTotal(S)}명</b> · 갱도 ${en.mines.length}/${mineSlots(S)}곳 · 캐기 <b>${digRate(S).toFixed(2)}/초</b></p>${en.mines.map(row).join('')}<div class="krow"><button class="kgo">${isOpen(S, 'expedition') ? '새 원정 ▶' : `🔒 ${needText('expedition')}이면 원정`}</button><button class="kfm">👷 십장</button>${isOpen(S, 'showcase') ? '<button class="krel">🏺 유물</button>' : ''}</div><p class="kmuted">원정에서 판 땅을 [갱도로 삼기]하면 여기에 늘어요</p>${rankHtml()}`, (b, close) => {
    b.querySelectorAll('.kmn').forEach((x) => (x.onclick = () => { if (moveMiner(S, +x.dataset.id, +x.dataset.d)) { sfx('ui_tap'); save(); close(); openMines(); } else sfx('pass', true); }));
    b.querySelector('.kgo').onclick = () => { close(); startExpedition(); };
    b.querySelector('.kfm').onclick = () => { close(); openForemen(); };
    const rl = b.querySelector('.krel'); if (rl) rl.onclick = () => { close(); openRelics(); };
  });
}
/** 유물 진열장 (6-3 #11) */
function openRelics() {
  const rs = S.stats.relics ?? [];
  openPanel('🏺 유물 진열장', `<p>모은 유물 <b>${rs.length}개</b> · 금화 합계 ${rs.reduce((a, r) => a + (r.gold ?? 0), 0).toLocaleString()}</p>${rs.slice(-12).reverse().map((r) => `<div class="kitem"><small>${r.day ?? '?'}일차 · 💰${r.gold}</small></div>`).join('')}<p class="kmuted">이사(다음 지역)해도 진열장은 남아요</p>`);
}
/** 주간 순위 (명세6-2 §5): 나 vs 길드 3팀 생산/초 */
function rankHtml() {
  const rows = [['나 (돌망치 상회)', engineRate()], ...B.guilds.map((g, i) => [g.name, guildRate(i)])].sort((a, b) => b[1] - a[1]);
  return `<p><b>생산 순위</b></p>${rows.map(([n, v], i) => `<div class="kitem"><small>${i + 1}. ${n} — ${v.toFixed(1)}/초</small></div>`).join('')}`;
}
/** 새 원정: 처음이면 튜토리얼 원정, 아니면 경매 */
function startExpedition() {
  if (!isOpen(S, 'expedition')) { toast(`${needText('expedition')}이 되면 원정이 열려요`, 'momo', 2.5); return; }
  if (!S.tutorial.done) { closeCompany(); startTutorialRound(); return; }
  openMap();
}
function onTickError(e, where) {
  const msg = `${where}: ${e?.message ?? e}`.slice(0, 160), stack = String(e?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim().replace(/https?:\/\/[^\s)]+\//g, '')).join(' | ');
  if (!errLog.some((x) => x.msg === msg)) { errLog.unshift({ msg, stack: stack.slice(0, 300), at: Date.now(), ver: VERSION, st: S.round?.state ?? 'AUCTION' }); errLog.length = Math.min(errLog.length, 5); try { localStorage.setItem('kod.errors', JSON.stringify(errLog)); } catch {} console.error('[kod]', where, e); }   // 같은 오류는 한 번만 콘솔에
  if (time - errToastAt > 30) { errToastAt = time; toast('앗, 문제가 생겼어요 — 게임은 계속돼요. [설정]→[제보]로 알려 주면 고칠게요', 'momo', 4); }
}
try { errLog.push(...JSON.parse(localStorage.getItem('kod.errors') || '[]')); } catch {}
window.addEventListener('error', (e) => onTickError(e.error ?? e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => onTickError(e.reason, 'promise'));
app.ticker.add((tk) => { try { tickMain(tk); } catch (e) { onTickError(e, 'tick'); } });
/** 한 부분이 오류를 내도 나머지(그리기 포함)는 계속 */
const safe = (where, fn) => { try { fn(); } catch (e) { onTickError(e, where); } };
function tickMain(tk) {
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
  safe('engine', () => engineTick());
  safe('coTick', () => ui.coTick?.(real));
  safe('intro', () => introTick?.(real));
  safe('tut', () => tutTick(real));
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
  if (st === 'SURVEY') safe('survey', () => updateSurvey(dt));
  safe('mole', () => updateMole(dt));
  safe('crew', () => updateCrew(dt));
  safe('stake', () => { for (const q of S.round?.stakes ?? []) if (q.text === '…' && q.at > 0 && time > q.at + 1) resolveStake(q); });
  safe('shaft', () => shaftTick()); safe('shaftUI', () => drawShaftUI()); safe('stakeUI', () => drawStakeUI()); safe('pops', () => updatePops(real)); if (fpsN % 20 === 0) safe('survey2', () => drawSurvey());
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
  for (const a of actors) safe('actor', () => drawActor(a, dt, lfx, lfy));
  safe('emotes', () => drawEmotes(real));
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
  safe('fx', () => updateEffects(dt));

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
}

{ const r0 = app.render.bind(app); app.render = () => { try { r0(); } catch (e) { onTickError(e, 'render'); } }; }

// ================================================================ 시작: 저장된 라운드가 있으면 이어서, 없으면 경매
const bootIdle = settleOffline(true);
buildWorld();
layout();
if (!S.round) { W = null; buildWorld(); }   // 명세6-2: 경매 화면은 지도에서만
else {
  piles = S.round.piles ?? []; seenCells = new Set(S.round.seen ?? []); S.round.jobs ??= []; S.round.claimed ??= []; S.round.shafts ??= []; S.round.stakes ??= []; setTimeout(() => { for (const q of S.round.stakes ?? []) if (q.text === '…' || q.text === '?') resolveStake(q, true); }, 0);
  (S.round.cartCargos ?? [S.round.cartCargo, S.round.cartCargo2]).forEach((cg, i) => cg && carts[i] && Object.assign(carts[i].cargo, cg));
  buildUI(); if (S.round.state === 'SURVEY') S.round.surveyLeft = Math.max(3, S.round.surveyLeft);
}
booted = true;
bootOnboarding();
initAuth().then(() => { if (online()) afterLogin(); });
if (bootIdle?.midRound) toast(`라운드 이어 하기 — ${S.round.card.name}`, 'momo', 3);

window.__kod = {
  get S() { return S; }, openReport, openNews, openMailbox, openInbox, openSound, checkReplies, get adminOn() { return adminOn; }, set adminOn(v) { adminOn = v; }, app, step(n = 60) { for (let i = 0; i < n; i++) app.ticker.update(app.ticker.lastTime + 1000 / 60); }, get W() { return W; }, get L() { return L; }, get ui() { return ui; }, AU, cam, lantern, actors, crew, fx, bigVein, tilesA, wA, lights,
  startRound, todayCards, settleOffline, openMines, openMap, buyCheap, playerFold, get AU() { return AU; }, engineBuy, startExpedition, makeMineFromRound, get engRate() { return engineRate(); }, get welcome() { return welcome; }, introNext, showIntro, get introView() { return introView; }, dialogNext, openManual(key = MANUAL[0].key) { manualView = { key }; buildUI(); }, get tut() { return S.tutorial; }, startTutorialRound, openCompany, closeCompany, closeWelcome, movePlacing(kind) { placing = { kind, move: true, deco: !!B.company.decos[kind] }; buildUI(); }, refreshCompany, coAction, onLot, onSpot, get yardPan() { return yardPan; }, get held() { return held.length; }, notify, openRank, openLoginForm, pushNow, learnTalent, openTalents, get market() { return market; }, smeltOne, get sellMode() { return sellMode; }, set sellMode(v) { sellMode = v; }, get CF() { return CF; }, away(sec) { S.idle.lastSeen = Date.now() - sec * 1000; return settleOffline(); }, startDig, set yardHour(h) { S.tick = (h / 24) * TICK_PER_DAY; }, get errLog() { return errLog; }, openStorage, upgradeEquip, openGear, get upCard() { return upCard; }, set upCard(v) { upCard = v; }, vibroAt, xrayAt, armTool, get toolArmed() { return toolArmed; }, openShaft, turnShaft, collapse, get shafts() { return S.round?.shafts; }, get shaftBtns() { return shaftBtns; }, get piles() { return piles; }, B, refreshAround, get cart() { return cart; }, carts, endRound, askRetreat, nextAuction, pickCard, playerRaise, reset() { saving = false; resetSave(); location.reload(); },
  async shot(name, frames = 240) {
    let t = performance.now();
    const url = await new Promise((r) => { for (let i = 0; i < frames; i++) app.ticker.update((t += 33)); shotWaiter = r; app.ticker.update((t += 33)); });
    return (await fetch(`/__shot/${name}`, { method: 'POST', body: url })).text();
  },
};
