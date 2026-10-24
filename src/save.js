// 로컬 자동 저장 (명세2 §12 · 명세3 §8). 같은 모양 그대로 Supabase mine_saves.data 로 올린다.
import { B } from './balance.js';

const KEY = 'kod.save.v1';
export const SAVE_VERSION = 2;

export function newSave() {
  return {
    v: SAVE_VERSION,
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
    // 명세3 §8
    company: { coreLv: 1, buildings: {}, decos: [], harmoniesFound: [] },
    talents: { survey: 0, dig: 0, trade: 0, points: 0, spent: 0 },
    idle: { leftover: { C: 0, s: 0, g: 0, j: 0, c: 0 }, pending: { C: 0, s: 0, g: 0, j: 0, c: 0 }, lastSeen: 0, capHours: B.idle.capHours },
    daybook: { date: '', tasks: [] },
    account: { userId: null, nickname: null },
    floorUnlocked: 1,
    savedAt: 0,                                                  // 클라우드 충돌 비교용 (ms)
  };
}

/** 스키마 버전 올리기 (v 자리). 모르는 키는 그대로 두고, 빠진 키는 기본값으로 */
export function migrate(s) {
  const d = newSave();
  if (!s || typeof s.v !== 'number' || s.v > SAVE_VERSION) return d;
  const out = { ...d, ...s };
  for (const k of ['company', 'talents', 'idle', 'daybook', 'account', 'settings', 'stats', 'tutorial']) out[k] = { ...d[k], ...(s[k] ?? {}) };
  out.idle.leftover = { ...d.idle.leftover, ...(s.idle?.leftover ?? {}) };
  out.idle.pending = { ...d.idle.pending, ...(s.idle?.pending ?? {}) };
  // v1 → v2: 방치·회사·특성·계정 자리 추가 (위 기본값). 방치 시각은 지금부터
  if (s.v < 2) out.idle.lastSeen = Date.now();
  out.v = SAVE_VERSION;
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    return migrate(JSON.parse(raw));
  } catch { return newSave(); }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
