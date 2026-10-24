// 해금 표 (명세6-3 §1): balance.js unlocks 를 읽는 순수 함수 — 게임과 템포 시뮬(scripts/tempo_sim.mjs)이 같이 씀
import { B } from './balance.js';

/** 이 열쇠(건물·버튼)가 열렸나 */
export function isOpen(S, key) {
  const u = B.unlocks.find((q) => q.opens.includes(key));
  return !u || !!S.unl?.got?.[u.id];
}
/** 그 열쇠를 여는 조건 한 줄 ("곡괭이 Lv3") */
export function needText(key) {
  const u = B.unlocks.find((q) => q.opens.includes(key)); if (!u) return '';
  const [t, v] = u.cond;
  return { start: '처음부터', pickLv: `곡괭이 Lv${v}`, cartLv: `광차 Lv${v}`, whFull: '창고가 처음 가득 차면', sold: `누적 판매 ${v.toLocaleString()}금`, rate: `생산 ${v}/초`, mines: `갱도 ${v}개`, expeditions: `원정 ${v}번`, relics: `유물 ${v}개`, smeltLv: `제련 Lv${v}` }[t] ?? '';
}
/** 조건 충족 확인 → 새로 열린 것들. ctx = { pickLv, cartLv, smeltLv, whFull, sold, rate, mines, expeditions, relics }, now = 플레이 초 */
export function checkUnlocks(S, ctx, now) {
  S.unl ??= { got: {}, seen: 0 };
  const out = [];
  for (const u of B.unlocks) {
    if (S.unl.got[u.id] != null) continue;
    const [t, v] = u.cond, val = t === 'start' ? 0 : ctx[t] ?? 0;
    if (t === 'start' || val >= v) { S.unl.got[u.id] = Math.round(now); out.push(u); }
  }
  return out;
}
