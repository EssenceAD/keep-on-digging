// 엔진 (명세6-1): "광산은 항상 돌아간다" — 갱도(캐기) → 입구 더미(pile) → 광차(나르기) → 창고. 숫자는 전부 balance.js engine.
// 저장 S.engine = { mines, pileT, carryAcc, lv, lastTick } · 창고 광석은 S.warehouse(옛 stash 그대로) · 괴·제련은 옛 S.smelt 대기열을 엔진 슬롯·시간으로 돌림.
import { B } from './balance.js';

const E = () => B.engine;
export const ORE_KEYS5 = ['C', 's', 'g', 'j', 'c'];
const zero = () => ({ C: 0, s: 0, g: 0, j: 0, c: 0 });
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/** 옛 장비 이름(S.upgrades) ↔ 엔진 업글 — 원정은 이 값을 옛 표 최대까지 그대로 씀 */
export const ENGINE_UP = { pick: 'pick', lodge: 'lodge', cart: 'cart', warehouse: 'warehouse', smelter: 'smelter' };
/** 부지 건물 → 엔진 업글 (곡괭이 = 대장간 그림) */
export const ENGINE_BLD = { smelter: 'pick', lodge: 'lodge', cartShed: 'cart', warehouse: 'warehouse' };

// ---------------------------------------------------------------- 표 (Lv → 숫자)
export const milestones = (lv) => E().milestones.filter((m) => lv >= m).length;
export const nextMilestone = (lv) => E().milestones.find((m) => m > lv) ?? null;
export const pickRate = (lv) => E().pickBase * (1 + E().pickPerLv * (lv - 1)) * 2 ** milestones(lv);
export const minersOf = (lv) => 1 + lv;
export const mineSlotsOf = (lv) => Math.min(E().maxMines, E().minesBase + Math.floor((lv - 1) / E().minesEvery));
export const cartOf = (lv) => {
  const [a, b] = E().cartLoad, [t0, dt, tMin] = E().trip;
  const load = (a + b * lv) * 2 ** milestones(lv), n = 1 + Math.floor(lv / E().cartsEvery), trip = Math.max(tMin, t0 - dt * lv);
  return { load, n, trip, rate: (n * load) / trip };
};
/** 광차 (운반 십장 핀이 있으면 왕복 −15% · 더미 가득일 때 +1대) */
export function cartOfS(S) {
  const c = cartOf(S.engine.lv.cart), f = S.foremen?.fin, F = B.foremen.fin;
  if (!f?.hired || f.on === false) return c;
  const trip = c.trip * F.tripMul, n = c.n + (pileOf(S) >= pileCapOf(S.engine.lv.warehouse) - 0.5 ? F.extraCart : 0);
  return { ...c, trip, n, rate: (n * c.load) / trip };
}
export const whCapOf = (lv) => Math.floor(E().whBase * E().whMul ** (lv - 1));
export const pileCapOf = (lv) => Math.floor(whCapOf(lv) / E().pileDiv);
export const smeltOf = (lv) => { const [a, b, m] = E().smelt.sec; return { slots: lv >= 1 ? 1 + Math.floor(lv / E().smelt.slotsEvery) : 0, sec: Math.max(m, a - b * lv) }; };
export const idleCapHours = (S) => Math.min(E().idleCapMax, E().idleCapHours + S.engine.lv.lodge * E().idleCapPerLodge);
/** 다음 Lv 비용 */
export const engineCost = (S, k) => { const u = E().up[k], lv = S.engine.lv[k]; return Math.round(u.base * u.mul ** (lv - u.start)); };

/** 업글 한 줄: 지금 → 다음 */
export function engineText(S, k, lv = S.engine.lv[k]) {
  const n = lv + 1, f = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString();
  switch (k) {
    case 'pick': return `캐기 ${f(pickRate(lv))} → ${f(pickRate(n))}/초 (1명)`;
    case 'lodge': return `광부 ${minersOf(lv)} → ${minersOf(n)}명 · 갱도 ${mineSlotsOf(lv)}${mineSlotsOf(n) > mineSlotsOf(lv) ? ` → ${mineSlotsOf(n)}` : ''}곳`;
    case 'cart': { const a = cartOf(lv), b = cartOf(n); return `나르기 ${f(a.rate, 1)} → ${f(b.rate, 1)}/초 · ${a.n}대 · 적재 ${a.load}`; }
    case 'warehouse': return `창고 ${whCapOf(lv)} → ${whCapOf(n)}`;
    case 'smelter': { const a = smeltOf(lv), b = smeltOf(n); return lv ? `괴 ${a.slots}칸 · ${f(a.sec, 1)}초 → ${b.slots}칸 · ${f(b.sec, 1)}초` : `광석 → 괴 (×${B.company.smeltMul})`; }
  }
  return '';
}

// ---------------------------------------------------------------- 상태
export function newMine(id, o) {
  return { id, name: o.name, rows: o.rows, reserve: o.reserve, reserveMax: o.reserve, depth: o.depth, oreMix: { ...zero(), ...o.oreMix }, opened: o.opened ?? 0, miners: 0 };
}
/** 처음 · 옛 저장: 건물(장비) Lv → 같은 Lv로 엔진 업글, 갱도 1개 지급 */
export function ensureEngine(S) {
  if (!S.engine) {
    const up = S.upgrades ?? {};
    if (!(S.stats?.rounds > 0) && !(S.counters?.soldGold > 0) && !S.tutorial?.done) S.gold = E().startGold;   // 새 게임: 캐서 번 돈으로
    S.engine = {
      mines: [newMine(1, { ...E().firstMine, opened: S.day ?? 0 })], nextId: 2,
      pileT: zero(), carryAcc: zero(), lastTick: Date.now(),
      lv: { pick: Math.max(1, up.pick ?? 1), lodge: Math.max(1, up.lodge ?? 1), cart: Math.max(1, up.cart ?? 1), warehouse: Math.max(1, up.warehouse ?? 1), smelter: up.smelter ?? 0 },
    };
  }
  const en = S.engine;
  en.pileT ??= zero(); en.carryAcc ??= zero(); en.nextId ??= en.mines.length + 1; en.lastTick ??= Date.now();
  for (const k of Object.keys(E().up)) en.lv[k] ??= E().up[k].start;
  balanceMiners(S);
  return en;
}
export const pileOf = (S) => sum(S.engine.pileT);
/** 원정대 (명세6-2 §4): 숙소 Lv 구간별 인원 — 원정(탐사·시추) 중엔 엔진 광부에서 빠짐 */
export const crewOf = (lv) => { const t = B.expedition.crew; return t[Math.min(t.length - 1, Math.max(0, lv - 1))]; };
export const onExpedition = (S) => ['SURVEY', 'DIG'].includes(S.round?.state);
export const minersTotal = (S) => { const n = minersOf(S.engine.lv.lodge); return onExpedition(S) ? Math.max(1, n - crewOf(S.engine.lv.lodge)) : n; };   // 원정 중에도 1명은 남음
export const liveMines = (S) => S.engine.mines.filter((m) => m.reserve > 0);
/** 광부 배치: 다 캔 갱도는 0, 모자라면 덜어 내고, 남으면 적은 곳부터 고르게 */
export function balanceMiners(S) {
  const ms = S.engine.mines;
  for (const m of ms) { m.miners = Math.max(0, Math.floor(m.miners ?? 0)); if (m.reserve <= 0) m.miners = 0; }
  let left = minersTotal(S) - ms.reduce((a, m) => a + m.miners, 0);
  while (left < 0) { const m = [...ms].sort((p, q) => q.miners - p.miners)[0]; m.miners--; left++; }
  const live = ms.filter((m) => m.reserve > 0);
  while (left > 0 && live.length) { live.sort((p, q) => p.miners - q.miners || q.depth - p.depth)[0].miners++; left--; }   // 적은 곳부터 · 같으면 깊은 곳
}
/** ± 로 광부 옮기기: d = +1 이면 다른 갱도에서 하나 데려옴 */
export function moveMiner(S, id, d) {
  const ms = S.engine.mines, m = ms.find((q) => q.id === id); if (!m || m.reserve <= 0) return false;
  if (d > 0) { const from = ms.filter((q) => q !== m && q.miners > 0).sort((p, q) => q.miners - p.miners)[0]; if (!from) return false; from.miners--; m.miners++; return true; }
  if (m.miners <= 0) return false;
  const to = ms.filter((q) => q !== m && q.reserve > 0).sort((p, q) => p.miners - q.miners)[0]; if (!to) return false;
  m.miners--; to.miners++; return true;
}

// ---------------------------------------------------------------- 사슬 (초 단위)
/** 갱도 한 곳 광종 비율 (깊을수록 귀한 쪽) */
function mixOf(m) {
  const w = {}; let t = 0;
  for (const k of ORE_KEYS5) { w[k] = (m.oreMix[k] ?? 0) * m.depth ** E().oreRank[k]; t += w[k]; }
  for (const k of ORE_KEYS5) w[k] = t ? w[k] / t : 0;
  return w;
}
export const digRateOf = (S, m) => (m.reserve > 0 ? m.miners * pickRate(S.engine.lv.pick) * m.depth : 0);
export const digRate = (S) => S.engine.mines.reduce((a, m) => a + digRateOf(S, m), 0);
/** 지금 막힌 곳: 'dig' 캐기가 느림 · 'carry' 입구 더미 가득(광차가 못 따라감) · 'wh' 창고 가득 · 'empty' 캘 갱도 없음 */
export function bottleneck(S, whTotal, whCap) {
  if (whTotal >= whCap - 0.5) return 'wh';
  if (!liveMines(S).length) return 'empty';
  if (digRate(S) > cartOfS(S).rate && pileOf(S) >= pileCapOf(S.engine.lv.warehouse) * 0.5) return 'carry';
  return 'dig';
}
/**
 * dt초 진행. wh = S.warehouse (정수 광석), cap = 창고 용량. 돌려줌 { dug, carried: {k:n} }
 */
export function engineStep(S, dt, wh, cap) {
  const en = S.engine, out = { dug: 0, carried: null };
  if (en.mines.reduce((a, m) => a + m.miners, 0) !== minersTotal(S)) balanceMiners(S);   // 원정대가 나가고 들어올 때
  // 1) 캐기 → 입구 더미
  const pcap = pileCapOf(en.lv.warehouse);
  let room = pcap - pileOf(S);
  for (const m of en.mines) {
    if (room <= 0) break;
    const r = digRateOf(S, m); if (!r) continue;
    const n = Math.min(r * dt, m.reserve, room); if (n <= 0) continue;
    const w = mixOf(m);
    for (const k of ORE_KEYS5) en.pileT[k] += n * w[k];
    m.reserve = Math.max(0, m.reserve - n); room -= n; out.dug += n;
    if (m.reserve <= 0) { m.reserve = 0; balanceMiners(S); }
  }
  // 2) 나르기 → 창고 (정수만 창고에, 나머지는 carryAcc)
  const pile = pileOf(S), whNow = sum(wh) + sum(en.carryAcc);
  const n = Math.min(cartOfS(S).rate * dt, pile, Math.max(0, cap - whNow));
  if (n > 0) {
    out.carried = {};
    for (const k of ORE_KEYS5) {
      const take = (n * en.pileT[k]) / pile;
      en.pileT[k] = Math.max(0, en.pileT[k] - take); en.carryAcc[k] += take;
      const whole = Math.floor(en.carryAcc[k] + 1e-9);
      if (whole > 0) { wh[k] += whole; en.carryAcc[k] -= whole; out.carried[k] = whole; }
    }
  }
  // 창고가 소수점 몫(carryAcc)만큼만 남았으면 큰 몫부터 채워 '가득'을 만든다
  let room2 = cap - sum(wh);
  if (room2 > 0 && sum(en.carryAcc) >= room2 - 1e-6) {
    for (const k of [...ORE_KEYS5].sort((p, q) => en.carryAcc[q] - en.carryAcc[p])) { if (room2 <= 0) break; if (en.carryAcc[k] > 0) { wh[k]++; room2--; en.carryAcc[k] = 0; out.carried = { ...(out.carried ?? {}), [k]: (out.carried?.[k] ?? 0) + 1 }; } }
  }
  return out;
}
/** 떠나 있던 sec초를 그대로 빨리감기 (상한 idleCapHours) — 창고가 차면 멈춤 */
export function engineFastForward(S, sec, wh, cap, hook = null) {
  const capSec = idleCapHours(S) * 3600, run = Math.min(sec, capSec), before = { ...wh };
  let t = 0, full = false;
  while (t < run) {
    const st = Math.min(5, run - t);
    engineStep(S, st, wh, cap); t += st; hook?.(S, st);                // 십장도 방치 중에 일함
    if (sum(wh) >= cap && pileOf(S) >= pileCapOf(S.engine.lv.warehouse) - 0.01) { full = true; break; }
  }
  const got = Object.fromEntries(ORE_KEYS5.map((k) => [k, wh[k] - before[k]]));
  return { sec, ran: t, capped: sec > capSec, full: full || sum(wh) >= cap, got, total: sum(got) };
}

// ---------------------------------------------------------------- 원정 → 갱도 (§3)
/** 원정 끝 땅을 갱도로: stats.oreCells {k:n} · maxDepth(줄) · rows */
export function mineFromRound(S, name, oreCells, maxDepth, rows) {
  const cells = sum(oreCells);
  const mix = cells ? Object.fromEntries(ORE_KEYS5.map((k) => [k, (oreCells[k] ?? 0) / cells])) : { ...E().firstMine.oreMix };
  return newMine(S.engine.nextId++, { name, rows, reserve: Math.max(30, cells * E().reservePerCell), depth: 1 + (maxDepth / Math.max(1, rows)) * E().depthMul, oreMix: mix, opened: S.day ?? 0 });
}
export const mineSlots = (S) => mineSlotsOf(S.engine.lv.lodge);
/** 갱도 추가 (자리가 없으면 replaceId 갱도와 바꿈) */
export function addMine(S, mine, replaceId = null) {
  const ms = S.engine.mines;
  if (replaceId != null) { const i = ms.findIndex((m) => m.id === replaceId); if (i >= 0) ms.splice(i, 1); }
  ms.push(mine);
  for (const m of ms) m.miners = 0; balanceMiners(S);                 // 새 갱도: 광부를 고르게 다시 (남는 사람은 깊은 갱도로)
}
