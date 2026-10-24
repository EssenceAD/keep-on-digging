// 회사 (명세3 §2 · PATCH_V10 §2): 부지 장면(art/yard/yard.px.js)의 빈 터 10곳 · 소품 자리 12곳 · 건물 Lv · 장식 · 어울림 → 게임 숫자.
// 저장 모양 (S.company): { coreLv, buildings: { office:{lot}, warehouse:{lot}, ... }, decos:[{kind,spot}], harmoniesFound:[] }
// 건물 Lv = 장비 Lv − min (명세5 §3, upgrades 한 표). 어울림 = 같은 구역(위/아래)에 둘 다 있으면.
import { B } from './balance.js';
import YARD from '../art/yard/yard_lots.json';
import { ENGINE_BLD, ENGINE_UP, engineCost, engineText, ensureEngine, smeltOf, whCapOf } from './engine.js';
export { YARD };

const C = B.company;
export const BUILDINGS = Object.keys(C.buildings);
export const DECOS = Object.keys(C.decos);
export const nameOf = (k) => (k === 'office' ? '사무소' : C.buildings[k]?.name ?? C.decos[k]?.name ?? k);

/** 처음 회사: 사무소만 가운데 아래쪽에 */
export function ensureCompany(S) {
  const co = S.company;
  co.coreLv ??= 1; co.buildings ??= {}; co.decos ??= []; co.harmoniesFound ??= [];
  ensureUpgrades(S);
  // PATCH_V13 §3-2: 터 10곳 → 9곳 (입구와 겹치던 옛 4번 삭제, id 다시 매김) — 옛 5–9 → 4–8, 옛 4에 지은 건물은 빈 터로
  if ((co.lotsV ?? 0) < 3) { for (const b of Object.values(co.buildings)) if (b && b.lot != null) b.lot = b.lot === 4 ? null : b.lot > 4 ? b.lot - 1 : b.lot; co.lotsV = 3; }
  // 격자 슬롯(x,y) → 빈 터(lot) · 소품 자리(spot)로 옮김 (PATCH_V10 §2)
  for (const b of Object.values(co.buildings)) if (b && b.lot == null) { delete b.x; delete b.y; }
  co.buildings.office ??= {}; co.buildings.office.lot ??= YARD.lots.find((l) => l.default === 'office')?.id ?? 0;
  co.decos = co.decos.filter((d) => d && C.decos[d.kind]);
  for (const d of co.decos) if (d.spot == null) { const used = new Set(co.decos.map((q) => q.spot)); d.spot = YARD.decoSpots.findIndex((_, i) => !used.has(i)); delete d.x; delete d.y; }
  ensureEngine(S);                         // 명세6-1: 엔진 (옛 건물 Lv → 같은 Lv)
  autoPlace(S);
  if (S.talents.v !== 2) {                 // 명세5 §4: 5단 → 8단으로 바뀜 — 찍은 것 돌려주고, 지난 라운드 수만큼 포인트
    Object.assign(S.talents, { survey: 0, dig: 0, trade: 0, v: 2, earned: S.talents.earned ?? (S.stats?.rounds ?? 0) * B.talents.minPerRound });
  }
  return co;
}
// ---- 장비 (명세5 §3): S.upgrades[k] = Lv. 회사 건물 Lv = 그 장비 Lv − min (Lv0 = 안 지음)
export const UP = B.upgrades;
export const UP_KEYS = Object.keys(UP);
export const BUILD_UP = Object.fromEntries(UP_KEYS.filter((k) => UP[k].building).map((k) => [UP[k].building, k]));
/** 장비 Lv — 엔진 업글(곡괭이·숙소·광차·창고·제련)은 엔진 Lv를 옛 표 최대까지 (원정용) */
export const upLv = (S, k) => (S.engine && ENGINE_UP[k] ? Math.max(UP[k].min, Math.min(UP[k].max, S.engine.lv[ENGINE_UP[k]])) : S.upgrades?.[k] ?? UP[k].min);
const upV = (S, k, f) => UP[k][f][upLv(S, k)];
/** 처음 한 번: 예전 회사 건물 Lv → 장비 Lv */
export function ensureUpgrades(S) {
  if (S.upgrades) { for (const k of UP_KEYS) S.upgrades[k] ??= UP[k].min; return; }
  S.upgrades = {};
  for (const k of UP_KEYS) S.upgrades[k] = Math.min(UP[k].max, UP[k].min + (UP[k].building ? S.company.buildings[UP[k].building]?.lv ?? 0 : 0));
}
export const upCostOf = (S, k) => (S.engine && ENGINE_UP[k] ? engineCost(S, ENGINE_UP[k]) : upLv(S, k) >= UP[k].max ? null : UP[k].cost[upLv(S, k)]);
/** 장비 한 줄: 지금 → 다음 */
export function upText(S, k) {
  const lv = upLv(S, k), n = Math.min(UP[k].max, lv + 1), u = UP[k], top = lv >= u.max;
  const ar = (arr, unit = '') => (top || arr[n] === arr[lv] ? `${arr[lv]}${unit}` : `${arr[lv]}→${arr[n]}${unit}`);
  switch (k) {
    case 'pick': return top ? u.steps[lv] : `다음: ${u.steps[n]}`;
    case 'cart': return `적재 ${ar(u.load)} · 속도 ${ar(u.speed)} · ${ar(u.carts, '대')}`;
    case 'lodge': return `광부 ${ar(u.miners, '명')}`;
    case 'warehouse': return `창고 ${ar(u.cap)}`;
    case 'mole': return `깊이 ${u.depth[lv] > 50 ? '전부' : u.depth[lv]}${!top && u.depth[n] !== u.depth[lv] ? '→' + (u.depth[n] > 50 ? '전부' : u.depth[n]) : ''}${!top && u.size[n] && !u.size[lv] ? ' · 크기 점' : ''}`;
    case 'vibro': return `하루 ${ar(u.uses, '회')} · ±${ar(u.range)}${!top && u.color[n] && !u.color[lv] ? ' · 광종 색' : ''}`;
    case 'lantern': return `하루 ${ar(u.xray, '회')}${!top && u.radius[n] > u.radius[lv] ? ' · 5×5' : u.radius[lv] > 1 ? ' · 5×5' : ' · 3×3'}`;
    case 'smelter': return lv ? `괴 동시 ${ar(u.slots)}` : '광석 → 괴 (×1.6)';
    case 'pump': return `펌프 ${ar(u.price, '금')}${!top && u.auto[n] ? ' · 자동' : u.auto[lv] ? ' · 자동' : ''}`;
    case 'turret': return `등급 ${ar(u.grade)}`;
  }
  return '';
}
export const lvOf = (S, k) => (S.engine && ENGINE_BLD[k] ? S.engine.lv[ENGINE_BLD[k]] : k === 'office' ? S.company.coreLv : BUILD_UP[k] && S.upgrades ? upLv(S, BUILD_UP[k]) - UP[BUILD_UP[k]].min : S.company.buildings[k]?.lv ?? 0);
/** 열린 빈 터: 처음 6곳 + 사무소 Lv2·3·4·5마다 덤불 걷힌 곳 1곳씩 */
export function openLots(S) {
  const locked = YARD.lots.filter((l) => l.locked);
  const opened = new Set(locked.slice(0, Math.max(0, S.company.coreLv - 1)).map((l) => l.id));
  return YARD.lots.filter((l) => !l.locked || opened.has(l.id));
}
export const lotOf = (id) => YARD.lots.find((l) => l.id === id);
export const lotUser = (S, id) => Object.entries(S.company.buildings).find(([k, b]) => b?.lot === id && (k === 'office' || lvOf(S, k) > 0))?.[0] ?? null;
export const spotUser = (S, i) => S.company.decos.find((d) => d.spot === i)?.kind ?? null;
export const spotZone = (i) => (YARD.decoSpots[i]?.[1] ?? 0) < 120 ? 'upper' : 'lower';
/** 장비 탭에서 올린 건물이 터가 없으면 빈 터에 */
export function autoPlace(S) {
  for (const k of Object.keys(C.buildings)) {
    if (lvOf(S, k) <= 0) continue;
    const b = (S.company.buildings[k] ??= {});
    if (b.lot != null && lotUser(S, b.lot) === k) continue;
    const free = openLots(S).find((l) => !lotUser(S, l.id));
    b.lot = free ? free.id : null;
  }
}

/** 다음 Lv 비용 (최대면 null) */
export function upCost(S, k) {
  const lv = lvOf(S, k);
  if (k === 'office') return lv >= 5 ? null : C.officeCost[lv - 1];
  if (C.decos[k]) return S.company.decos.some((d) => d.kind === k) ? null : C.decos[k].cost;
  if (S.engine && ENGINE_BLD[k]) return engineCost(S, ENGINE_BLD[k]);   // 엔진 건물: 무한
  return BUILD_UP[k] ? upCostOf(S, BUILD_UP[k]) : null;              // 건물 = 장비 (같은 값)
}
export const bldMax = (k) => (BUILD_UP[k] ? UP[BUILD_UP[k]].max - UP[BUILD_UP[k]].min : 5);
/** 올릴 수 있나: { ok, why } */
export function canUp(S, k) {
  const cost = upCost(S, k);
  if (cost == null) return { ok: false, why: '최대' };
  if (S.gold < cost) return { ok: false, why: '금화 부족' };
  return { ok: true, cost };
}

/** 부지 위 모든 것: [{kind, lot|spot, zone, deco}] */
export function placed(S) {
  const out = [];
  for (const [k, b] of Object.entries(S.company.buildings)) {
    if (!b || b.lot == null || (k !== 'office' && lvOf(S, k) <= 0)) continue;
    const l = lotOf(b.lot); if (l) out.push({ kind: k, lot: b.lot, zone: l.zone, deco: false });
  }
  for (const d of S.company.decos) if (d.spot != null && d.spot >= 0) out.push({ kind: d.kind, spot: d.spot, zone: spotZone(d.spot), deco: true });
  return out;
}
/** 지금 성립한 어울림: 둘이 같은 구역(위 줄 / 아래 줄)에 있으면 */
export function harmonies(S) {
  const p = placed(S);
  return C.harmonies.filter((h) => {
    const as = p.filter((q) => q.kind === h.a), bs = p.filter((q) => q.kind === h.b);
    return as.some((a) => bs.some((b) => a.zone === b.zone));
  });
}

/** 회사(+ 특성)가 바꾸는 게임 숫자 한 묶음 */
export function companyFx(S) {
  const L = (k) => lvOf(S, k), b = C.buildings;
  const add = { idleMul: 0, guildMul: 0, smeltMul: 0, surveyAdd: 0, sellMul: 0, cartMul: 0, turretAdd: 0, xrayAdd: 0 };
  for (const h of harmonies(S)) for (const [k, v] of Object.entries(h.fx)) add[k] += v;
  const t = S.talents ?? {}, TL = B.talents, sv = t.survey ?? 0, dg = t.dig ?? 0, tr = t.trade ?? 0;
  return {
    // 특성 (§3)
    // 특성 (명세5 §4: 3×8)
    hints: sv >= 1 ? 3 : B.hintsPerCard, vibroAdd: sv >= 3 ? 1 : 0, oreColor: sv >= 4, vibroRangeMinus: sv >= 5 ? 1 : 0, clueTruth: sv >= 6 ? TL.clueTruth : B.tools.clue.truth,
    veinRange: sv >= 7, silhouette: sv >= 8, freeHint: false,
    pick: upV(S, 'pick', 'tier'), pickSpeed: upV(S, 'pick', 'speed'), pickDouble: !!upV(S, 'pick', 'double'),
    digMul: dg >= 5 ? TL.digMul[1] : dg >= 1 ? TL.digMul[0] : 1, dirt: dg >= 2 ? TL.dirtTime : B.digTime.d, stunMul: dg >= 4 ? TL.stunMul : 1, chainVein: dg >= 7,
    preview: tr >= 2, surgeWarn: tr >= 3 ? TL.surgeWarnLong : B.surgeWarn, penalty: tr >= 5 ? TL.penaltyLow : null, surgeMul: tr >= 6 ? TL.surgeMul : B.surgeMul,
    bigVein: tr >= 7 ? TL.bigVein : B.bigVein, freeze: tr >= 8,
    // 장비 (명세5 §3 — upgrades 표 하나)
    whCap: upV(S, 'warehouse', 'cap'),
    carts: Math.min(4, upV(S, 'cart', 'carts') + (dg >= 3 ? 1 : 0)),
    cartLoad: upV(S, 'cart', 'load') + (dg >= 6 ? TL.cartLoadAdd : 0),
    cartSpeed: upV(S, 'cart', 'speed') * (1 + add.cartMul),
    miners: upV(S, 'lodge', 'miners') + (dg >= 8 ? TL.crewAdd : 0),
    diggers: Math.max(2, Math.ceil(upV(S, 'lodge', 'miners') / 2)) + (dg >= 8 ? 1 : 0),     // 갱도 조: 광부 절반이 캐고 나머지는 운반
    capHours: upV(S, 'lodge', 'capHours'),
    smeltSec: (upV(S, 'smelter', 'sec') || 20) / (1 + add.smeltMul),
    smeltSlots: upV(S, 'smelter', 'slots'),
    xrayPerDay: upV(S, 'lantern', 'xray') + add.xrayAdd + (sv >= 2 ? 1 : 0),
    xrayRadius: upV(S, 'lantern', 'radius'),
    pumpCost: upV(S, 'pump', 'price'),
    autoPump: !!upV(S, 'pump', 'auto'),
    turret: upV(S, 'turret', 'grade') + (upLv(S, 'turret') ? add.turretAdd : 0),
    surveySec: B.surveySeconds + add.surveyAdd,
    sniffDepth: upV(S, 'mole', 'depth'),
    moleSpeed: upV(S, 'mole', 'speed'),
    sniffSize: !!upV(S, 'mole', 'size'),
    shafts: upLv(S, 'cart') >= 3 ? 3 : 2,                               // 동시 갱도 (광차 Lv3 → 3개)
    idleMul: 1 + add.idleMul,
    guildMul: 1 + add.guildMul,
    sellMul: 1 + add.sellMul + (tr >= 4 ? TL.sellAdd[1] : tr >= 1 ? TL.sellAdd[0] : 0),
    plotSizes: S.company.coreLv >= C.lPlotLv ? ['S', 'M', 'L'] : ['S', 'M'],
    ...(S.engine ? { whCap: whCapOf(S.engine.lv.warehouse), smeltSlots: smeltOf(S.engine.lv.smelter).slots, smeltSec: smeltOf(S.engine.lv.smelter).sec / (1 + add.smeltMul) } : {}),   // 명세6-1 엔진
  };
}

/** 목록 한 줄 설명: 지금 → 다음 */
export function effectText(S, k) {
  if (S.engine && ENGINE_BLD[k]) return engineText(S, ENGINE_BLD[k]);   // 엔진 건물
  if (BUILD_UP[k]) return upText(S, BUILD_UP[k]);                  // 건물 = 장비 (같은 표)
  const lv = lvOf(S, k), b = C.buildings[k], n = Math.min(5, lv + 1);
  const arrow = (arr, unit = '') => (lv >= 5 ? `${arr[lv]}${unit}` : `${arr[lv]}${unit} → ${arr[n]}${unit}`);
  switch (k) {
    case 'office': return lv >= 5 ? '빈 터 10곳 · 모든 구획' : `빈 터 ${openLots(S).length}→${openLots(S).length + 1}곳${lv + 1 === C.lPlotLv ? ' · L 구획' : lv + 1 === C.mineLv ? ' · 폐광' : ''}`;
    case 'warehouse': return `창고 ${arrow(b.cap)}`;
    case 'cartShed': return `적재 ${arrow(b.load)} · 광차 ${b.carts[lv]}대${b.carts[n] > b.carts[lv] ? ` → ${b.carts[n]}대` : ''}`;
    case 'lodge': return `광부 ${arrow(b.miners, '명')} · 방치 ${b.capHours[lv]}h`;
    case 'smelter': return lv ? `괴 ×${C.smeltMul} · ${b.sec[lv]}초 · 동시 ${b.slots[lv]}${lv < 5 ? ' → ' + b.slots[n] : ''}` : `광석 → 괴 (가격 ×${C.smeltMul})`;
    case 'lanternShop': return `투시 랜턴 ${arrow(b.xray, '/일')}${b.radius[n] > b.radius[lv] ? ' · 5×5' : ''}`;
    case 'pumpRoom': return `펌프 ${arrow(b.pump, '금')}${b.auto[n] && !b.auto[lv] ? ' · 자동' : b.auto[lv] ? ' · 자동' : ''}`;
    case 'turretShop': return `포탑 등급 ${arrow(b.grade)}`;
    case 'moleHouse': return `탐사 ${arrow(b.survey, '초')} · 깊이 ${b.depth[lv]}${b.size[n] && !b.size[lv] ? ' · 크기 점' : ''}`;
    default: {
      const hs = C.harmonies.filter((h) => !h.hidden && (h.a === k || h.b === k));
      return hs.map((h) => `${nameOf(h.a === k ? h.b : h.a)} 곁: ${h.text}`).join(' · ') || '꾸미기';
    }
  }
}

// ---------------------------------------------------------------- 특성 포인트 (§3)
export const TALENT_TREES = [['survey', '탐사'], ['dig', '채굴'], ['trade', '장사']];
export const talentPoints = (S) => S.company.coreLv + (S.talents.earned ?? 0);   // 명세5 §4: 라운드 별 수(최소 1) + 사무소 Lv
export const talentSpent = (S) => (S.talents.survey ?? 0) + (S.talents.dig ?? 0) + (S.talents.trade ?? 0);
export const talentLeft = (S) => talentPoints(S) - talentSpent(S);
