// 방치 정산 (명세3 §1) — 체크인 src/world/offline.ts 의 구조(마지막 시각 · 상한 · 요약 카드)를 채굴에 맞게 옮김.
// 철수한 구획의 남은 광맥(idle.leftover)을 광부들이 현실 시간으로 캔다: 분당 = 광부 수 × 곡괭이 등급 × 0.5칸.
// 상한 = capHours 분량 · 창고 남은 칸 · 남은 광맥. 라운드 진행 중(탐사·시추)에 닫았으면 그 라운드는 그대로 멈춰 있다.
import { B } from './balance.js';
import { ORES } from './market.js';

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/** 분당 캐는 칸 수 */
export const idleRate = (miners, pickGrade, mul = 1) => miners * pickGrade * B.idle.cellsPerMinerMinute * mul;

/** n칸을 남은 광맥 비율대로 광종에 나눈다 (큰 나머지 순 — 같은 입력이면 같은 결과) */
export function splitCells(leftover, n) {
  const total = sum(leftover);
  const out = Object.fromEntries(ORES.map((o) => [o.key, 0]));
  if (!total || n <= 0) return out;
  n = Math.min(n, total);
  const rem = [];
  for (const o of ORES) {
    const exact = (leftover[o.key] / total) * n;
    out[o.key] = Math.min(leftover[o.key], Math.floor(exact));
    rem.push([exact - out[o.key], o.key]);
  }
  let left = n - sum(out);
  rem.sort((a, b) => b[0] - a[0]);
  for (let i = 0; left > 0 && i < rem.length * 2; i++) {
    const k = rem[i % rem.length][1];
    if (out[k] < leftover[k]) { out[k]++; left--; }
  }
  return out;
}

/**
 * 불러온 직후(또는 화면으로 돌아왔을 때) 한 번. S 를 고친다.
 * ctx: { market, gameNow(): 절대 게임 초, advanceClock(sec), miners, pickGrade, capHours, whRoom, rateMul }
 * 돌려줌: null(짧게 떠났음) | { midRound, away } | 요약
 */
export function computeOffline(S, ctx, nowMs = Date.now()) {
  const I = S.idle;
  if (!I.lastSeen) { I.lastSeen = nowMs; return null; }
  const away = Math.max(0, (nowMs - I.lastSeen) / 1000);
  I.lastSeen = nowMs;
  if (away < B.idle.minAwaySeconds) return null;
  const st = S.round?.state;
  if (st === 'SURVEY' || st === 'DIG') return { midRound: true, away };   // 라운드는 멈춰 있음 (시계도 안 감)

  // 시세·시계 빨리감기 (최대 24시간)
  const ff = Math.min(away, B.idle.marketMaxHours * 3600);
  const from = ctx.gameNow();
  ctx.advanceClock(ff);
  const { before, missed } = ctx.market.fastForward(from, ctx.gameNow());

  // 방치 채굴
  const rate = idleRate(ctx.miners, ctx.pickGrade, ctx.rateMul ?? 1);   // 칸/분
  const capCells = Math.floor(rate * 60 * ctx.capHours);
  const pendingBefore = sum(I.pending);
  const leftTotal = sum(I.leftover);
  const want = Math.floor((rate * away) / 60);
  const limits = { time: capCells - pendingBefore, wh: ctx.whRoom - pendingBefore, vein: leftTotal };
  const n = Math.max(0, Math.min(want, limits.time, limits.wh, limits.vein));
  const mined = splitCells(I.leftover, n);
  for (const o of ORES) { I.leftover[o.key] -= mined[o.key]; I.pending[o.key] += mined[o.key]; }
  const why = want <= n ? null : n === limits.vein ? 'vein' : n === limits.wh ? 'wh' : 'time';
  return {
    midRound: false, away, mined, pending: { ...I.pending }, pendingTotal: sum(I.pending),
    capped: why === 'time', whFull: why === 'wh', exhausted: sum(I.leftover) === 0 && leftTotal > 0,
    leftover: sum(I.leftover), before, missed,
  };
}
