// 시드 난수 (구획 시드 저장 → 다시 열어도 같은 격자)
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));      // [lo, hi]
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.range = ([lo, hi]) => r.int(lo, hi);
  r.chance = (p) => r() < p;
  r.weighted = (obj) => {                                          // { key: weight }
    const total = Object.values(obj).reduce((a, b) => a + b, 0);
    let x = r() * total;
    for (const [k, w] of Object.entries(obj)) { x -= w; if (x <= 0) return k; }
    return Object.keys(obj)[0];
  };
  return r;
}
export const newSeed = () => (Math.random() * 2 ** 31) >>> 0;
