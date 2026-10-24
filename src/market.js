// 시세 (명세2 §8 · 명세3 §1-3): 광종별 기준가 × 변동 계수. 10초마다 계수 ×(1 ± 3~12%) 랜덤 워크, 0.5~2.0 클램프, 평균 회귀.
// 결정론적: k번째 틱의 난수 = hash(k, 광종) → 떠나 있던 동안도 같은 길로 빨리감기(최대 24시간 = 8,640틱). 급등 계획도 hash(day).
// 매입자 2: 브로크(구리·은 +15%, 나머지 −10%) / 떠돌이 상인(반대). 급등: 하루 1~2회, 30초 전 모모 편지 → ×1.8 40초.
import { B } from './balance.js';

export const ORES = [
  { key: 'C', name: '구리' },
  { key: 's', name: '은' },
  { key: 'g', name: '금' },
  { key: 'j', name: '보석' },
  { key: 'c', name: '발광석' },
];
export const BUYERS = Object.fromEntries(Object.entries(B.buyers).map(([k, v]) => [k, v.name]));
export const buyerOf = (key) => Object.entries(B.buyers).find(([, b]) => b.like.includes(key))[0];   // 그 광종을 좋아하는 매입자

/** 정수 3개 → [0, 1) (같은 입력이면 누구에게나 같은 값) */
export function hash01(a, b, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b) ^ Math.imul((c | 0) + 0x9e3779b9, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 그 날의 급등 계획 (하루 안 시각 times · 광종 keys) — 날짜만으로 정해짐 */
export function planOf(day) {
  const [lo, hi] = B.surgesPerDay;
  const n = lo + Math.floor(hash01(day, 900) * (hi - lo + 1));
  const times = Array.from({ length: n }, (_, i) => B.dayRealSeconds * (0.15 + hash01(day, 901, i) * 0.75)).sort((a, b) => a - b);
  return { day, times, keys: times.map((_, i) => ORES[Math.floor(hash01(day, 902, i) * ORES.length)].key), done: 0 };
}

/** saved = S.prices (없으면 새로). onWarn(key)·onSurge(key)·onTick() 콜백 */
export function createMarket(saved) {
  const m = saved ?? { coef: {}, hist: {}, last: {}, surge: null, plan: null };
  for (const o of ORES) {
    m.coef[o.key] ??= 1;
    m.hist[o.key] ??= Array(12).fill(1);
    m.last[o.key] ??= 0;
  }
  m.buyerMul = (key, buyer) => {
    const b = B.buyers[buyer];
    return b.like.includes(key) ? 1 + b.bonus : 1 - (m.penalty ?? b.penalty);
  };
  m.surgeMul = (key, now) => (m.surge && m.surge.key === key && now >= m.surge.start && now < m.surge.end ? B.surgeMul : 1);
  m.coefAt = (key, now) => (m.frozen && now < m.frozen.until ? m.frozen.coef[key] : m.coef[key]);   // 시세 고정 중이면 그때 값
  m.price = (key, buyer, now) => Math.max(1, Math.round(B.basePrice[key] * m.coefAt(key, now) * m.surgeMul(key, now) * m.buyerMul(key, buyer)));
  m.freeze = (now, secs) => { m.frozen = { coef: { ...m.coef }, until: now + secs }; };
  /** k번째 틱 한 걸음 */
  const step = (k) => {
    ORES.forEach((o, i) => {
      const prev = m.coef[o.key];
      const st = B.priceStep[0] + hash01(k, i, 1) * (B.priceStep[1] - B.priceStep[0]);
      let c = prev * (1 + (hash01(k, i, 2) < 0.5 ? st : -st));
      c += (1 - c) * B.meanRevert;
      c = Math.max(B.coefRange[0], Math.min(B.coefRange[1], c));
      m.coef[o.key] = c;
      m.last[o.key] = Math.sign(c - prev);
      m.hist[o.key].push(c); m.hist[o.key].shift();
    });
  };
  /** now(절대 초)까지 틱을 따라잡는다. 한 번에 최대 maxTicks (그 이상은 건너뜀) */
  const catchUp = (now, maxTicks = Infinity) => {
    const target = Math.floor(now / B.priceTick);
    if (m.k == null) { m.k = target; return 0; }
    if (target - m.k > maxTicks) m.k = target - maxTicks;
    let n = 0;
    while (m.k < target) step(++m.k), n++;
    return n;
  };
  /** dt: 초, day·tick: 게임 시계(하루 안 현실 초), now: 절대 시각(초) */
  m.update = (dt, day, tick, now) => {
    if (!m.plan || m.plan.day !== day) { m.plan = planOf(day); while (m.plan.done < m.plan.times.length && tick >= m.plan.times[m.plan.done]) m.plan.done++; }
    // 급등 예고 → 시작
    const pl = m.plan;
    const warn = m.warnSec ?? B.surgeWarn;
    if (pl.done < pl.times.length && tick >= pl.times[pl.done] - warn) {
      const key = pl.keys[pl.done]; pl.done++;
      m.surge = { key, warn: now, start: now + warn, end: now + warn + B.surgeSeconds };
      m.onWarn?.(key, warn);
    }
    if (m.surge && now >= m.surge.start && !m.surge.started) { m.surge.started = true; m.onSurge?.(m.surge.key); }
    if (m.surge && now >= m.surge.end) m.surge = null;
    if (catchUp(now)) m.onTick?.();
  };
  /** 떠나 있던 동안 빨리감기: from → to (절대 초). 떠날 때 계수와 놓친 급등 목록을 돌려준다 */
  m.fastForward = (from, to) => {
    const before = { ...m.coef };
    if (m.k == null) m.k = Math.floor(from / B.priceTick);
    catchUp(to, Math.ceil(B.idle.marketMaxHours * 3600 / B.priceTick));
    const D = B.dayRealSeconds, missed = [];
    for (let d = Math.floor(from / D); d <= Math.floor(to / D); d++) {
      const p = planOf(d);
      p.times.forEach((t, i) => { const at = d * D + t; if (at > from && at + B.surgeSeconds <= to) missed.push({ key: p.keys[i], day: d, tick: t }); });
    }
    m.surge = null; m.plan = null;                                 // 다음 update 에서 오늘 계획을 다시 (지난 시각은 건너뜀)
    return { before, missed };
  };
  /** 앞으로 n틱의 계수 (결정론적이라 미리 볼 수 있다 · 장사 특성 1) */
  m.peek = (key, n) => {
    const i = ORES.findIndex((o) => o.key === key), out = [];
    let c = m.coef[key];
    for (let k = m.k + 1; k <= m.k + n; k++) {
      const st = B.priceStep[0] + hash01(k, i, 1) * (B.priceStep[1] - B.priceStep[0]);
      c = c * (1 + (hash01(k, i, 2) < 0.5 ? st : -st));
      c += (1 - c) * B.meanRevert;
      c = Math.max(B.coefRange[0], Math.min(B.coefRange[1], c));
      out.push(c);
    }
    return out;
  };
  m.toJSON = () => ({ coef: m.coef, hist: m.hist, last: m.last, k: m.k, surge: m.surge, plan: m.plan, frozen: m.frozen });
  return m;
}
