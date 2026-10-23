// 로컬 자동 저장 (명세2 §12). 다음 명세에서 이 모양 그대로 Supabase mine_saves 로 올린다.
import { B } from './balance.js';

const KEY = 'kod.save.v1';

export function newSave() {
  return {
    v: 1,
    gold: B.startGold,
    day: 1,
    tick: B.dayStartHour * 3600 / (86400 / B.dayRealSeconds),   // 하루 안 현실 초
    round: null,                                                 // { state, plot, bid, cells, ... }
    auction: null,                                               // 오늘 카드
    warehouse: { C: 0, s: 0, g: 0, j: 0, c: 0 },
    prices: null,                                                // market.js 가 채움
    stats: { rounds: 0, profitTotal: 0, bestVein: 0, relics: [] },
    tutorial: { step: 0 },
    settings: { low: false, sound: true },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const s = JSON.parse(raw);
    if (s?.v !== 1) return newSave();
    return { ...newSave(), ...s };
  } catch { return newSave(); }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
