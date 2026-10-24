// 일일 과제 (명세3 §6) — 체크인 src/world/daybook.ts 구조: 한국 시간 0시에 풀 12개 중 3개 · 진행 = 뽑았을 때 기록 값 → 지금 값.
// 하나 끝낼 때마다 금화 50~150 (자동으로 받음). 아침 모모 편지로 도착.
import { B } from './balance.js';

/** 한국 날짜 'YYYY-M-D' */
export function kstDay(ms = Date.now()) {
  const k = new Date(ms + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}-${k.getUTCMonth() + 1}-${k.getUTCDate()}`;
}
// cnt: S.counters 의 키 · min~max: 목표 범위 · can: 열려 있을 때만
export const DAY_DEFS = [
  { id: 'win', text: () => '경매 1번 낙찰', cnt: 'wins', min: 1, max: 1 },
  { id: 'sell', text: (n) => `광석 ${n}금화어치 팔기`, cnt: 'soldGold', min: 200, max: 400, step: 50 },
  { id: 'star2', text: () => '라운드 ★2 이상', cnt: 'star2', min: 1, max: 1 },
  { id: 'veins', text: (n) => `광맥 ${n}개 캐기`, cnt: 'veins', min: 3, max: 5 },
  { id: 'ores', text: (n) => `광석 ${n}개 창고에 넣기`, cnt: 'ores', min: 30, max: 60, step: 10 },
  { id: 'jackpot', text: () => '대박 광맥 1번', cnt: 'jackpots', min: 1, max: 1 },
  { id: 'smelt', text: (n) => `괴 ${n}개 만들기`, cnt: 'ingots', min: 3, max: 5, can: (S) => (S.company.buildings.smelter?.lv ?? 0) > 0 },
  { id: 'build', text: () => '회사 건물 짓기·올리기 1번', cnt: 'builds', min: 1, max: 1 },
  { id: 'relic', text: () => '유물 1개 찾기', cnt: 'relics', min: 1, max: 1 },
  { id: 'surge', text: () => '급등 때 1번 팔기', cnt: 'surgeSells', min: 1, max: 1 },
  { id: 'rounds', text: (n) => `라운드 ${n}판 끝내기`, cnt: 'rounds', min: 2, max: 2 },
  { id: 'idle', text: () => '광부들이 캐 둔 것 받기', cnt: 'idleClaims', min: 1, max: 1 },
];
export const dayDef = (id) => DAY_DEFS.find((d) => d.id === id);
export const counter = (S, k) => S.counters?.[k] ?? 0;

/** 날이 바뀌었으면 새 과제 3개 (돌려줌: 새로 뽑았나) */
export function rollDaybook(S, now = Date.now(), rnd = Math.random) {
  S.counters ??= {};
  const day = kstDay(now);
  if (S.daybook?.date === day && S.daybook.tasks?.length) return false;
  const pool = DAY_DEFS.filter((d) => !d.can || d.can(S));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const [lo, hi] = B.daybook.reward;
  S.daybook = {
    date: day,
    tasks: pool.slice(0, B.daybook.perDay).map((d) => {
      const st = d.step ?? 1, n = d.min + Math.floor(rnd() * ((d.max - d.min) / st + 1)) * st;
      return { id: d.id, n, base: counter(S, d.cnt), reward: lo + Math.round((rnd() * (hi - lo)) / 10) * 10, done: false };
    }),
  };
  return true;
}
export const progress = (S, t) => Math.min(t.n, counter(S, dayDef(t.id).cnt) - t.base);
/** 끝난 과제 보상 (새로 끝난 것 목록) */
export function checkDaybook(S) {
  const out = [];
  for (const t of S.daybook?.tasks ?? []) if (!t.done && progress(S, t) >= t.n) { t.done = true; S.gold += t.reward; out.push(t); }
  return out;
}
