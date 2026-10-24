// 소리 (v0.9 · SOUND_SUNO_1024 §5 · PATCH_V09 §3): Howler — BGM 8곡 · 효과음 · 앰비언스
//  - 첫 터치 전엔 무음(모바일 정책) · 백그라운드면 전부 정지 · 파일이 없으면 조용히 무시(게임은 안 멈춤)
//  - BGM 전환 크로스페이드 1.5초 · 루프는 끝 3초를 잘라내고 끝 1.5초 ↔ 시작 1.5초 크로스페이드 (Suno 곡은 끝이 페이드아웃)
//  - 대박: bgm_jackpot 한 번 + 지금 BGM 덕킹 −6dB, 21초 뒤 복귀 · 앰비언스는 BGM 밑에 −18dB
//  - 효과음 이름 = 파일 이름(sfx_*). 번호 붙은 것(sfx_pick_dirt_1~3)은 랜덤. 옛 이름(hit·clink·break·ore·stash·bell)은 가까운 소리로
import { Howl, Howler } from 'howler';

const BASE = import.meta.env.BASE_URL;
const src = (dir, n) => [`${BASE}audio/${dir}/${n}.mp3`, `${BASE}audio/${dir}/${n}.ogg`];
const XFADE = 1500, LOOP_CUT = 3, LOOP_FADE = 1.5, DUCK = 0.5, DUCK_MS = 21000, AMB = 0.125;

const SFX = ['bat', 'bid_1', 'bid_2', 'bid_3', 'boom', 'build', 'cart_dump', 'cart_roll', 'coin_1', 'coin_2', 'coin_big', 'collapse', 'fall', 'gas', 'gavel', 'jackpot', 'land', 'letter',
  'mole_sniff_1', 'mole_sniff_2', 'pass', 'pick_dirt_1', 'pick_dirt_2', 'pick_dirt_3', 'pick_ore_1', 'pick_ore_2', 'pick_rock_1', 'pick_rock_2', 'pick_rock_3', 'pump', 'slime', 'stamp',
  'stun', 'surge', 'talent', 'ui_close', 'ui_error', 'ui_open', 'ui_tap', 'upgrade', 'vein_found', 'water', 'welcome'];
const LEGACY = { hit: 'pick_dirt', clink: 'ui_error', break: 'pick_rock', ore: 'pick_ore', stash: 'ui_tap', bell: 'upgrade' };
const groups = {};                                         // pick_dirt → [pick_dirt_1, _2, _3]
for (const n of SFX) { const g = n.replace(/_\d+$/, ''); (groups[g] ??= []).push(n); }

let unlocked = false, hidden = false;
let vol = { bgm: 0.6, sfx: 0.8 };
const howls = {};
const sfxHowl = (n) => (howls[n] ??= new Howl({ src: src('sfx', `sfx_${n}`), preload: true, onloaderror: () => {} }));

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  Howler.ctx?.resume?.();
  for (const n of SFX) sfxHowl(n);
  if (want.bgm) playBgm(want.bgm, true);
  if (want.amb) playAmb(want.amb);
}
/** 볼륨 0~1 (설정 슬라이더) */
export function setVolumes(v) {
  vol = { ...vol, ...v };
  if (bgm.cur) bgm.cur.h.volume(bgmLevel(), bgm.cur.id);
  if (amb.cur) amb.cur.h.volume(vol.bgm * AMB);
}
export const volumes = () => ({ ...vol });
// 옛 API (소리 켬/끔)
export const setSound = (on) => setVolumes(on ? { bgm: vol.bgm || 0.6, sfx: vol.sfx || 0.8 } : { bgm: 0, sfx: 0 });
export const soundOn = () => vol.sfx > 0 || vol.bgm > 0;

export function sfx(name, soft = false) {
  if (!unlocked || hidden || !vol.sfx) return;
  const g = groups[LEGACY[name] ?? name] ?? groups[name.replace(/^sfx_/, '')];
  if (!g) return;
  const h = sfxHowl(g[Math.floor(Math.random() * g.length)]);
  try { h.volume(vol.sfx * (soft ? 0.45 : 1)); h.play(); } catch { /* 파일 없음 */ }
}

// ---------------------------------------------------------------- BGM
const want = { bgm: null, amb: null };
const bgm = { cur: null, duck: 1, duckT: 0 };
const bgmLevel = () => vol.bgm * bgm.duck;
const bgmHowl = (n) => (howls[`bgm_${n}`] ??= new Howl({ src: src('bgm', `bgm_${n}`), html5: true, preload: true, onloaderror: () => {} }));
/** 장면이 원하는 곡 (같은 곡이면 그대로) */
export function music(name) {
  if (want.bgm === name) return;
  want.bgm = name;
  if (unlocked && !hidden) playBgm(name);
}
function playBgm(name, now = false) {
  const old = bgm.cur;
  if (old?.name === name) return;
  if (old) { const { h, id } = old; h.fade(h.volume(id), 0, XFADE, id); setTimeout(() => h.stop(id), XFADE + 50); }
  bgm.cur = null;
  if (!name) return;
  const h = bgmHowl(name);
  const start = () => {
    const id = h.play();
    h.volume(0, id); h.fade(0, bgmLevel(), now ? 400 : XFADE, id);
    bgm.cur = { name, h, id, looped: false };
  };
  if (h.state() === 'loaded') start(); else { h.once('load', () => { if (want.bgm === name && !bgm.cur) start(); }); if (h.state() === 'unloaded') h.load(); }
}
/** 루프: 끝 3초 전 1.5초부터 처음을 겹쳐 틀고 지금 것은 줄인다 */
function loopTick() {
  const c = bgm.cur; if (!c || hidden) return;
  const d = c.h.duration(); if (!d) return;
  const pos = c.h.seek(c.id);
  if (typeof pos === 'number' && pos > d - LOOP_CUT - LOOP_FADE) {
    const { h, id } = c;
    h.fade(h.volume(id), 0, LOOP_FADE * 1000, id); setTimeout(() => h.stop(id), LOOP_FADE * 1000 + 50);
    const nid = h.play(); h.volume(0, nid); h.fade(0, bgmLevel(), LOOP_FADE * 1000, nid);
    bgm.cur = { ...c, id: nid };
  }
  if (bgm.duckT && performance.now() > bgm.duckT) { bgm.duck = 1; bgm.duckT = 0; c.h.fade(c.h.volume(c.id), bgmLevel(), 800, c.id); }
}
setInterval(loopTick, 250);
/** 대박: 짧은 곡 한 번 + BGM −6dB 21초 */
export function jackpotMusic() {
  if (!unlocked || hidden) return;
  bgm.duck = DUCK; bgm.duckT = performance.now() + DUCK_MS;
  if (bgm.cur) bgm.cur.h.fade(bgm.cur.h.volume(bgm.cur.id), bgmLevel(), 300, bgm.cur.id);
  const h = bgmHowl('jackpot'); h.volume(vol.bgm); h.play();
}

// ---------------------------------------------------------------- 앰비언스 (갱도 · 부지 낮/밤)
const amb = { cur: null };
export function ambience(name) {
  if (want.amb === name) return;
  want.amb = name;
  if (unlocked && !hidden) playAmb(name);
}
function playAmb(name) {
  if (amb.cur?.name === name) return;
  if (amb.cur) { const { h } = amb.cur; h.fade(h.volume(), 0, XFADE); setTimeout(() => h.stop(), XFADE + 50); }
  amb.cur = null;
  if (!name) return;
  const h = (howls[`amb_${name}`] ??= new Howl({ src: src('sfx', `amb_${name}`), loop: true, preload: true, onloaderror: () => {} }));
  h.volume(0); h.play(); h.fade(0, vol.bgm * AMB, XFADE);
  amb.cur = { name, h };
}

// 백그라운드면 전부 정지, 돌아오면 다시
document.addEventListener('visibilitychange', () => {
  hidden = document.visibilityState === 'hidden';
  if (!unlocked) return;
  if (hidden) { bgm.cur?.h.pause(bgm.cur.id); amb.cur?.h.pause(); Howler.mute(true); }
  else { Howler.mute(false); if (bgm.cur) bgm.cur.h.play(bgm.cur.id); else if (want.bgm) playBgm(want.bgm, true); if (amb.cur) amb.cur.h.play(); else if (want.amb) playAmb(want.amb); }
});
