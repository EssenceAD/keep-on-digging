// 효과음: 파일 없이 WebAudio로 합성 (프로토타입용)
let ctx = null;
let on = true;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') ctx.resume();
}
export const setSound = (v) => { on = v; };
export const soundOn = () => on;

function env(node, t0, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function noise(dur) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = b;
  return s;
}
function tone(type, f0, f1, dur, vol, t0 = ctx.currentTime) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, 0.004, vol, dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
function burst(dur, vol, filterType, freq) {
  const t0 = ctx.currentTime, s = noise(dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = filterType;
  f.frequency.value = freq;
  env(g, t0, 0.003, vol, dur);
  s.connect(f).connect(g).connect(ctx.destination);
  s.start(t0);
}

export function sfx(name, soft = false) {
  if (!ctx || !on) return;
  const v = soft ? 0.35 : 1;
  if (name === 'hit') {               // 곡괭이: 딱
    tone('triangle', 1900 + Math.random() * 300, 1100, 0.09, 0.22 * v);
    burst(0.06, 0.25 * v, 'highpass', 2500);
  } else if (name === 'clink') {      // 안 파지는 돌: 쨍
    tone('square', 2600, 2400, 0.12, 0.08 * v);
    tone('triangle', 3900, 3600, 0.2, 0.08 * v);
  } else if (name === 'break') {      // 와르르
    burst(0.28, 0.4 * v, 'lowpass', 700);
    tone('sine', 140, 60, 0.2, 0.25 * v);
  } else if (name === 'ore') {        // 광석: 띵
    tone('square', 880, 1320, 0.07, 0.06 * v);
  } else if (name === 'stash') {      // 창고에 쏙
    tone('triangle', 660, 990, 0.08, 0.1 * v);
  } else if (name === 'bell') {       // 큰 광맥: 종
    const t0 = ctx.currentTime;
    for (const [ratio, vol] of [[1, 0.3], [2.76, 0.12], [5.4, 0.06], [2, 0.1]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 523 * ratio;
      env(g, t0, 0.005, vol, 2.2 / ratio + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 3);
    }
  }
}
