// 계정 · 클라우드 (명세3 §4) — 체크인 legacy-of-adventure src/net/server.ts · sync.ts 에서 옮김.
// 같은 Supabase 프로젝트 · 같은 로그인(storageKey 공유: 같은 github.io 에서 체크인에 로그인돼 있으면 그대로).
// 테이블: mine_saves(user_id, version, data, updated_at) · mine_rank(user_id, week, profit, best_vein, relics, nickname) — RLS 는 체크인 saves·eval_scores 복사.
// 로그인 안 한 사람은 이 모듈을 안 거치고 로컬 저장으로 계속 논다.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_KEY;
export const sb = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'legacy-of-adventure-auth' } }) : null;

/** 지금 로그인한 사람 (프로필까지 있어야 로그인으로 친다) */
export const me = { profile: null };
export const online = () => !!me.profile;
const listeners = new Set();
export const onAuthChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((f) => f());

export const LOGIN_RE = /^[a-z0-9_]{4,16}$/;
const emailOf = (loginId) => `${loginId}@players.legacy-of-adventure.app`;

async function loadProfile() {
  if (!sb) return null;
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.from('profiles').select('id,login_id,nickname').eq('id', u.user.id).maybeSingle();
  return data ?? null;
}

/** 앱 켤 때: 남아 있는 로그인(체크인에서 한 것 포함)이 있으면 이어서 */
export async function initAuth() {
  if (!sb) return;
  try { me.profile = await loadProfile(); } catch { me.profile = null; }
  emit();
}

const authError = (m) =>
  /invalid login credentials/i.test(m) ? '아이디나 비밀번호가 맞지 않아요'
    : /rate limit|too many/i.test(m) ? '잠시 뒤에 다시 해 주세요'
      : /network|fetch/i.test(m) ? '서버에 연결할 수 없어요' : '문제가 생겼어요: ' + m;

export async function login(loginId, pw) {
  if (!sb) return '서버에 연결할 수 없어요';
  loginId = loginId.trim();
  if (!LOGIN_RE.test(loginId)) return '아이디는 영어 소문자·숫자·_ 4~16자예요';
  const { error } = await sb.auth.signInWithPassword({ email: emailOf(loginId), password: pw });
  if (error) return authError(error.message);
  me.profile = await loadProfile();
  if (!me.profile) return '프로필이 없는 계정이에요 (모험의 유산에서 가입을 끝까지 해 주세요)';
  emit();
  return null;
}

export async function logout() {
  if (!sb) return;
  await sb.auth.signOut({ scope: 'local' });        // 이 기기만
  me.profile = null;
  emit();
}

/** 비밀번호 찾기: 아이디 + 복구 코드 + 새 비밀번호 (체크인 Edge Function recover-account) */
export async function recover(loginId, code, newPw) {
  if (!URL || !KEY) return '서버에 연결할 수 없어요';
  if (newPw.length < 6) return '비밀번호는 6자 이상이에요';
  try {
    const r = await fetch(`${URL}/functions/v1/recover-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ login_id: loginId.trim(), code: code.trim().toUpperCase(), new_password: newPw }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) return null;
    return j.error === 'wrong_code' ? '아이디나 복구 코드가 맞지 않아요' : '바꾸지 못했어요' + (j.error ? ` (${j.error})` : '');
  } catch { return '서버에 연결할 수 없어요'; }
}

// ───────── 클라우드 저장 ─────────
export async function pushSave(data, version) {
  if (!sb || !me.profile) return false;
  const { error } = await sb.from('mine_saves').upsert({ user_id: me.profile.id, version, data, updated_at: new Date().toISOString() });
  return !error;
}
export async function pullSave() {
  if (!sb || !me.profile) return null;
  const { data } = await sb.from('mine_saves').select('data,updated_at').eq('user_id', me.profile.id).maybeSingle();
  return data ?? null;
}

// ───────── 주간 랭킹 (월요일 0시 KST 초기화 · 체크인 rank 와 같은 주 표기) ─────────
/** 이번 주 월요일 (서울) 'YYYY-M-D' */
export function weekKey(ms = Date.now()) {
  const k = new Date(ms + 9 * 3600 * 1000);                     // UTC → KST
  const dow = (k.getUTCDay() + 6) % 7;                          // 월 = 0
  const mon = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - dow));
  return `${mon.getUTCFullYear()}-${mon.getUTCMonth() + 1}-${mon.getUTCDate()}`;
}
export async function submitRank(week, profit, bestVein, relics) {
  if (!sb || !me.profile) return null;
  const { data, error } = await sb.rpc('submit_mine_rank', { p_week: week, p_profit: Math.max(0, Math.round(profit)), p_best_vein: bestVein, p_relics: relics });
  return error ? null : data;
}
export const BOARDS = { profit: '순이익', best_vein: '최대 광맥', relics: '유물' };
/** 위에서 n명 + 내 순위 */
export async function topRank(col, week, n = 20) {
  if (!sb) return { rows: [], mine: null, total: 0 };
  const { data } = await sb.from('mine_rank').select(`user_id,nickname,${col}`).eq('week', week).gt(col, 0).order(col, { ascending: false }).limit(n);
  const rows = (data ?? []).map((r, i) => ({ rank: i + 1, user_id: r.user_id, nickname: r.nickname, score: r[col] }));
  let mine = null, total = 0;
  const { count } = await sb.from('mine_rank').select('user_id', { count: 'exact', head: true }).eq('week', week).gt(col, 0);
  total = count ?? 0;
  if (me.profile) {
    const { data: m } = await sb.from('mine_rank').select(`nickname,${col}`).eq('week', week).eq('user_id', me.profile.id).maybeSingle();
    if (m && m[col] > 0) {
      const { count: higher } = await sb.from('mine_rank').select('user_id', { count: 'exact', head: true }).eq('week', week).gt(col, m[col]);
      mine = { rank: (higher ?? 0) + 1, nickname: m.nickname, score: m[col] };
    }
  }
  return { rows, mine, total };
}
