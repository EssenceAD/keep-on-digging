// 회사 (명세3 §2): 지상 부지 슬롯 · 건물 Lv · 장식 · 어울림 → 게임 숫자. 숫자는 balance.js B.company.
// 저장 모양 (S.company): { coreLv, buildings: { office:{x,y}, warehouse:{lv,x,y}, ... }, decos:[{kind,x,y}], harmoniesFound:[] }
// 어울림 판정은 체크인 src/world/harmony.ts 의 gap()(발자국 가장자리 사이 빈칸, 대각선 포함) 그대로 — 슬롯은 1×1 발자국.
import { B } from './balance.js';

const C = B.company;
export const BUILDINGS = Object.keys(C.buildings);
export const DECOS = Object.keys(C.decos);
export const nameOf = (k) => (k === 'office' ? '사무소' : C.buildings[k]?.name ?? C.decos[k]?.name ?? k);

/** 처음 회사: 사무소만 가운데 아래쪽에 */
export function ensureCompany(S) {
  const co = S.company;
  co.coreLv ??= 1; co.buildings ??= {}; co.decos ??= []; co.harmoniesFound ??= [];
  co.buildings.office ??= { x: 0, y: C.rows - 1 };
  ensureUpgrades(S);
  return co;
}
// ---- 장비 (명세5 §3): S.upgrades[k] = Lv. 회사 건물 Lv = 그 장비 Lv − min (Lv0 = 안 지음)
export const UP = B.upgrades;
export const UP_KEYS = Object.keys(UP);
export const BUILD_UP = Object.fromEntries(UP_KEYS.filter((k) => UP[k].building).map((k) => [UP[k].building, k]));
export const upLv = (S, k) => S.upgrades?.[k] ?? UP[k].min;
const upV = (S, k, f) => UP[k][f][upLv(S, k)];
/** 처음 한 번: 예전 회사 건물 Lv → 장비 Lv */
export function ensureUpgrades(S) {
  if (S.upgrades) { for (const k of UP_KEYS) S.upgrades[k] ??= UP[k].min; return; }
  S.upgrades = {};
  for (const k of UP_KEYS) S.upgrades[k] = Math.min(UP[k].max, UP[k].min + (UP[k].building ? S.company.buildings[UP[k].building]?.lv ?? 0 : 0));
}
export const upCostOf = (S, k) => (upLv(S, k) >= UP[k].max ? null : UP[k].cost[upLv(S, k)]);
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
export const lvOf = (S, k) => (k === 'office' ? S.company.coreLv : BUILD_UP[k] && S.upgrades ? upLv(S, BUILD_UP[k]) - UP[BUILD_UP[k]].min : S.company.buildings[k]?.lv ?? 0);
export const cols = (S) => C.baseCols + S.company.coreLv - 1;

/** 다음 Lv 비용 (최대면 null) */
export function upCost(S, k) {
  const lv = lvOf(S, k);
  if (k === 'office') return lv >= 5 ? null : C.officeCost[lv - 1];
  if (C.decos[k]) return S.company.decos.some((d) => d.kind === k) ? null : C.decos[k].cost;
  return lv >= 5 ? null : Math.round(C.buildings[k].cost * C.costMul[lv]);
}
/** 올릴 수 있나: { ok, why } — 다른 건물 Lv ≤ 사무소 Lv */
export function canUp(S, k) {
  const cost = upCost(S, k);
  if (cost == null) return { ok: false, why: '최대' };
  if (k !== 'office' && !C.decos[k] && lvOf(S, k) + 1 > S.company.coreLv) return { ok: false, why: `사무소 Lv${lvOf(S, k) + 1}` };
  if (S.gold < cost) return { ok: false, why: '금화 부족' };
  return { ok: true, cost };
}

/** 부지 위 모든 것: [{kind, x, y, deco}] */
export function placed(S) {
  const out = [];
  for (const [k, b] of Object.entries(S.company.buildings)) if (b && b.x != null && (k === 'office' || b.lv > 0)) out.push({ kind: k, x: b.x, y: b.y, deco: false });
  for (const d of S.company.decos) out.push({ kind: d.kind, x: d.x, y: d.y, deco: true });
  return out;
}
export const at = (S, x, y) => placed(S).find((p) => p.x === x && p.y === y) ?? null;
export function firstEmpty(S) {
  for (let y = C.rows - 1; y >= 0; y--) for (let x = 0; x < cols(S); x++) if (!at(S, x, y)) return { x, y };
  return null;
}

/** 체크인 harmony.ts gap(): 발자국 사이 빈칸 (붙어 있으면 0, 대각선은 큰 쪽) */
export function gap(a, b) {
  const gx = Math.max(0, b.x - (a.x + 1), a.x - (b.x + 1));
  const gy = Math.max(0, b.y - (a.y + 1), a.y - (b.y + 1));
  return Math.max(gx, gy);
}
/** 지금 성립한 어울림 (전역 효과는 조합마다 한 번) */
export function harmonies(S) {
  const p = placed(S);
  return C.harmonies.filter((h) => {
    const as = p.filter((q) => q.kind === h.a), bs = p.filter((q) => q.kind === h.b);
    return as.some((a) => bs.some((b) => gap(a, b) <= C.harmonyRange));
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
    hints: sv >= 1 ? 3 : B.hintsPerCard, oreColor: sv >= 3, veinRange: sv >= 4, freeHint: sv >= 5,
    pick: Math.min(3, upV(S, 'pick', 'tier') + (dg >= 1 ? 1 : 0) + (dg >= 4 ? 1 : 0)), pickSpeed: upV(S, 'pick', 'speed'), pickDouble: !!upV(S, 'pick', 'double'),
    dirt: dg >= 2 ? TL.dirtTime : B.digTime.d, stunMul: dg >= 3 ? TL.stunMul : 1, chainVein: dg >= 5,
    preview: tr >= 1, surgeWarn: tr >= 3 ? TL.surgeWarnLong : B.surgeWarn, penalty: tr >= 4 ? TL.penaltyLow : null, freeze: tr >= 5,
    // 장비 (명세5 §3 — upgrades 표 하나)
    whCap: upV(S, 'warehouse', 'cap'),
    carts: upV(S, 'cart', 'carts'),
    cartLoad: upV(S, 'cart', 'load'),
    cartSpeed: upV(S, 'cart', 'speed') * (1 + add.cartMul),
    miners: upV(S, 'lodge', 'miners'),
    diggers: Math.max(2, Math.ceil(upV(S, 'lodge', 'miners') / 2)),     // 갱도 조: 광부 절반이 캐고 나머지는 운반
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
    sellMul: 1 + add.sellMul + (tr >= 2 ? TL.sellAdd : 0),
    plotSizes: S.company.coreLv >= C.lPlotLv ? ['S', 'M', 'L'] : ['S', 'M'],
  };
}

/** 목록 한 줄 설명: 지금 → 다음 */
export function effectText(S, k) {
  const lv = lvOf(S, k), b = C.buildings[k], n = Math.min(5, lv + 1);
  const arrow = (arr, unit = '') => (lv >= 5 ? `${arr[lv]}${unit}` : `${arr[lv]}${unit} → ${arr[n]}${unit}`);
  switch (k) {
    case 'office': return lv >= 5 ? '부지 10열 · 모든 구획' : `부지 ${cols(S)}열 → ${cols(S) + 1}열${lv + 1 === C.lPlotLv ? ' · L 구획' : lv + 1 === C.mineLv ? ' · 폐광' : ''}`;
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
export const talentPoints = (S) => S.company.coreLv + Math.floor((S.stats.star3 ?? 0) / B.talents.star3PerPoint);
export const talentSpent = (S) => (S.talents.survey ?? 0) + (S.talents.dig ?? 0) + (S.talents.trade ?? 0);
export const talentLeft = (S) => talentPoints(S) - talentSpent(S);
