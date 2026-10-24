// 소리 (v0.9 · SOUND_SUNO_1024 §5 · PATCH_V09 §3): Howler — BGM 8곡 · 효과음 · 앰비언스
//  - 첫 터치 전엔 무음(모바일 정책) · 백그라운드면 전부 정지 · 파일이 없으면 조용히 무시(게임은 안 멈춤)
//  - BGM 전환 크로스페이드 1.5초 · 루프는 끝 3초를 잘라내고 끝 1.5초 ↔ 시작 1.5초 크로스페이드 (Suno 곡은 끝이 페이드아웃)
//  - 라디오(v1.3.3): 경매·결과 말고는 5곡 무작위 연속 재생, 화면 바뀌어도 안 끊김 (상황곡 동안 멈췄다 이어서)
//  - 대박: bgm_jackpot 5초 + 그동안 BGM 덕킹 −6dB · 앰비언스는 BGM 밑에 −18dB
//  - 효과음 이름 = 파일 이름(sfx_*). 번호 붙은 것(sfx_pick_dirt_1~3)은 랜덤. 옛 이름(hit·clink·break·ore·stash·bell)은 가까운 소리로
import { Howl, Howler } from 'howler';

const BASE = import.meta.env.BASE_URL;
const src = (dir, n) => [`${BASE}audio/${dir}/${n}.mp3`, `${BASE}audio/${dir}/${n}.ogg`];
const XFADE = 1500, LOOP_CUT = 3, LOOP_FADE = 1.5, DUCK = 0.5, AMB = 0.125;

const SFX = ['bat', 'bid_1', 'bid_2', 'bid_3', 'boom', 'build', 'cart_dump', 'cart_roll', 'coin_1', 'coin_2', 'coin_big', 'collapse', 'fall', 'gas', 'gavel', 'jackpot', 'land', 'letter',
  'mole_sniff_1', 'mole_sniff_2', 'pass', 'pick_dirt_1', 'pick_dirt_2', 'pick_dirt_3', 'pick_ore_1', 'pick_ore_2', 'pick_rock_1', 'pick_rock_2', 'pick_rock_3', 'pump', 'slime', 'stamp',
  'stun', 'surge', 'talent', 'ui_close', 'ui_error', 'ui_open', 'ui_tap', 'upgrade', 'vein_found', 'water', 'welcome'];
const LEGACY = { hit: 'pick_dirt', clink: 'ui_error', break: 'pick_rock', ore: 'pick_ore', stash: 'ui_tap', bell: 'upgrade' };
const groups = {};                                         // pick_dirt → [pick_dirt_1, _2, _3]
for (const n of SFX) { const g = n.replace(/_\d+$/, ''); (groups[g] ??= []).push(n); }

let unlocked = false, hidden = false;
let vol = { bgm: 0.35, sfx: 0.8 };
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
/** 라디오 (v1.3.3): 상황곡(경매·결과·대박)이 아니면 5곡을 무작위로 끝까지 — 화면이 바뀌어도 안 끊김 */
const RADIO = ['title', 'mine_1', 'mine_2', 'yard_day', 'yard_night'];
const radio = { held: null, last: null };                 // held = 상황곡 동안 멈춰 둔 라디오 곡
const nextRadio = () => { const c = RADIO.filter((n) => n !== radio.last); const n = c[Math.floor(Math.random() * c.length)]; radio.last = n; return n; };
/** 지금 원하는 음악: 'radio' 또는 상황곡 이름 (같으면 그대로) */
export function music(name) {
  if (want.bgm === name) return;
  want.bgm = name;
  if (unlocked && !hidden) playBgm(name);
}
function fadeIn(h, id, ms) { h.volume(0, id); h.fade(0, bgmLevel(), ms, id); }
function playBgm(name, now = false) {
  const old = bgm.cur;
  if (old && (old.radio ? name === 'radio' : old.name === name)) return;
  if (old) {
    const { h, id } = old; h.fade(h.volume(id), 0, XFADE, id);
    if (old.radio && name !== 'radio') { radio.held = old; setTimeout(() => { if (bgm.cur !== old) h.pause(id); }, XFADE + 50); }   // 상황곡 동안 라디오는 멈춰 두었다가 이어서
    else setTimeout(() => h.stop(id), XFADE + 50);
  }
  bgm.cur = null;
  if (!name) return;
  if (name === 'radio' && radio.held) { const c = radio.held; radio.held = null; c.h.play(c.id); fadeIn(c.h, c.id, now ? 400 : XFADE); bgm.cur = c; return; }
  const track = name === 'radio' ? nextRadio() : name, h = bgmHowl(track);
  const start = () => { const id = h.play(); fadeIn(h, id, now ? 400 : XFADE); bgm.cur = { name: track, h, id, radio: name === 'radio' }; };
  if (h.state() === 'loaded') start(); else { h.once('load', () => { if (want.bgm === name && !bgm.cur) start(); }); if (h.state() === 'unloaded') h.load(); }
}
/** 곡 끝 3초 전 1.5초부터: 라디오면 다음 곡(무작위)으로, 상황곡이면 처음부터 겹쳐 반복 */
function loopTick() {
  const c = bgm.cur; if (!c || hidden) return;
  const d = c.h.duration(); if (!d) return;
  const pos = c.h.seek(c.id);
  if (typeof pos === 'number' && pos > d - LOOP_CUT - LOOP_FADE) {
    const { h, id } = c;
    h.fade(h.volume(id), 0, LOOP_FADE * 1000, id); setTimeout(() => h.stop(id), LOOP_FADE * 1000 + 50);
    if (c.radio) {
      const n = nextRadio(), nh = bgmHowl(n); bgm.cur = null;
      const start = () => { if (bgm.cur || want.bgm !== 'radio') return; const nid = nh.play(); fadeIn(nh, nid, LOOP_FADE * 1000); bgm.cur = { name: n, h: nh, id: nid, radio: true }; };
      if (nh.state() === 'loaded') start(); else { nh.once('load', start); if (nh.state() === 'unloaded') nh.load(); }
      return;
    }
    const nid = h.play(); fadeIn(h, nid, LOOP_FADE * 1000);
    bgm.cur = { ...c, id: nid };
  }
  if (bgm.duckT && performance.now() > bgm.duckT) { bgm.duck = 1; bgm.duckT = 0; c.h.fade(c.h.volume(c.id), bgmLevel(), 800, c.id); }
}
setInterval(loopTick, 250);
/** 대박: 짧게 5초(끝 0.8초 페이드) + 그동안 BGM −6dB */
const JACKPOT_MS = 5000;
export function jackpotMusic() {
  if (!unlocked || hidden) return;
  bgm.duck = DUCK; bgm.duckT = performance.now() + JACKPOT_MS;
  if (bgm.cur) bgm.cur.h.fade(bgm.cur.h.volume(bgm.cur.id), bgmLevel(), 300, bgm.cur.id);
  const h = bgmHowl('jackpot'), id = h.play(); h.volume(vol.bgm, id);
  setTimeout(() => h.fade(h.volume(id), 0, 800, id), JACKPOT_MS - 800);
  setTimeout(() => h.stop(id), JACKPOT_MS + 50);
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
