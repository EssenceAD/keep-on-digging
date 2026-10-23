// 시세 (명세2 §8): 광종별 기준가 × 변동 계수. 10초마다 계수 ×(1 ± 3~12%) 랜덤 워크, 0.5~2.0 클램프, 평균 회귀.
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

/** saved = S.prices (없으면 새로). onWarn(key)·onSurge(key)·onTick() 콜백 */
export function createMarket(saved) {
  const m = saved ?? { coef: {}, hist: {}, last: {}, t: 0, surge: null, plan: null };
  for (const o of ORES) {
    m.coef[o.key] ??= 1;
    m.hist[o.key] ??= Array(12).fill(1);
    m.last[o.key] ??= 0;
  }
  m.buyerMul = (key, buyer) => {
    const b = B.buyers[buyer];
    return b.like.includes(key) ? 1 + b.bonus : 1 - b.penalty;
  };
  m.surgeMul = (key, now) => (m.surge && m.surge.key === key && now >= m.surge.start && now < m.surge.end ? B.surgeMul : 1);
  m.price = (key, buyer, now) => Math.max(1, Math.round(B.basePrice[key] * m.coef[key] * m.surgeMul(key, now) * m.buyerMul(key, buyer)));
  /** 하루의 급등 계획: 하루 시간(초) 안에 1~2번 */
  m.planDay = (day) => {
    const n = B.surgesPerDay[0] + Math.floor(Math.random() * (B.surgesPerDay[1] - B.surgesPerDay[0] + 1));
    const times = Array.from({ length: n }, () => B.dayRealSeconds * (0.15 + Math.random() * 0.75)).sort((a, b) => a - b);
    m.plan = { day, times, keys: times.map(() => ORES[Math.floor(Math.random() * ORES.length)].key), done: 0 };
  };
  /** dt: 초, day·tick: 게임 시계(하루 안 현실 초), now: 절대 시각(초) */
  m.update = (dt, day, tick, now) => {
    if (!m.plan || m.plan.day !== day) m.planDay(day);
    // 급등 예고 → 시작
    const pl = m.plan;
    if (pl.done < pl.times.length && tick >= pl.times[pl.done] - B.surgeWarn) {
      const key = pl.keys[pl.done]; pl.done++;
      m.surge = { key, warn: now, start: now + B.surgeWarn, end: now + B.surgeWarn + B.surgeSeconds };
      m.onWarn?.(key);
    }
    if (m.surge && now >= m.surge.start && !m.surge.started) { m.surge.started = true; m.onSurge?.(m.surge.key); }
    if (m.surge && now >= m.surge.end) m.surge = null;
    // 10초마다 랜덤 워크
    m.t += dt;
    if (m.t < B.priceTick) return;
    m.t = 0;
    for (const o of ORES) {
      const prev = m.coef[o.key];
      const step = B.priceStep[0] + Math.random() * (B.priceStep[1] - B.priceStep[0]);
      let c = prev * (1 + (Math.random() < 0.5 ? step : -step));
      c += (1 - c) * B.meanRevert;
      c = Math.max(B.coefRange[0], Math.min(B.coefRange[1], c));
      m.coef[o.key] = c;
      m.last[o.key] = Math.sign(c - prev);
      m.hist[o.key].push(c); m.hist[o.key].shift();
    }
    m.onTick?.();
  };
  m.toJSON = () => ({ coef: m.coef, hist: m.hist, last: m.last, t: m.t, surge: m.surge, plan: m.plan });
  return m;
}
