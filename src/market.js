// 시세 (명세 §2-4): 광종마다 10초마다 ±3~12% 랜덤 워크, 기준가 쪽으로 살짝 끌린다. 최근 2분(12칸) 기록.
export const ORES = [
  { key: 'g', name: '금', buyer: 'merchant', base: 40 },
  { key: 'c', name: '발광석', buyer: 'merchant', base: 55 },
  { key: 'j', name: '보석', buyer: 'merchant', base: 90 },
  { key: 's', name: '은', buyer: 'brok', base: 18 },
  { key: 'C', name: '구리', buyer: 'brok', base: 8 },
];
export const BUYERS = { brok: '브로크 대장간', merchant: '떠돌이 상인' };

export function createMarket() {
  const m = { price: {}, hist: {}, last: {}, t: 0, onTick: null };
  for (const o of ORES) { m.price[o.key] = o.base; m.hist[o.key] = Array(12).fill(o.base); m.last[o.key] = 0; }
  m.update = (dt) => {
    m.t += dt;
    if (m.t < 10) return;
    m.t = 0;
    for (const o of ORES) {
      const pull = (o.base - m.price[o.key]) / o.base * 0.5;              // 기준가로 되돌아가는 힘
      const step = (0.03 + Math.random() * 0.09) * (Math.random() < 0.5 + pull ? 1 : -1);
      const prev = m.price[o.key];
      m.price[o.key] = Math.max(1, Math.round(prev * (1 + step)));
      m.last[o.key] = Math.sign(m.price[o.key] - prev);
      m.hist[o.key].push(m.price[o.key]); m.hist[o.key].shift();
    }
    m.onTick?.();
  };
  return m;
}
