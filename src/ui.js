// UI 킷 런타임 — art/ui/ui.px.js (나무·돌·양피지) 조각을 PixiJS NineSliceSprite로 늘려 쓴다 (비주얼 가이드 §8)
// 단위: UI 픽셀. ui 컨테이너가 정수배(uiS)로 확대되므로 모든 위치·크기는 정수로 둔다.
import { Assets, Container, Graphics, NineSliceSprite, Sprite, Text } from 'pixi.js';

const NAMES = [
  'win_wood', 'win_stone', 'win_paper', 'panel_wood', 'panel_stone', 'panel_paper',
  ...['wood', 'stone', 'paper'].flatMap((n) => ['normal', 'hover', 'pressed', 'disabled'].map((s) => `btn_${n}_${s}`)),
  'btn_sq_wood', 'btn_sq_stone', 'bar_frame', 'slot_wood', 'slot_stone', 'slot_selected', 'tab_on', 'tab_off',
  'badge_gold', 'badge_red', 'badge_teal', 'arrow_up', 'arrow_down', 'coin', 'check', 'close_x',
];
const K = {};
let textRes = 2;

export const INK = 0x1a1220;
export const COLOR = { ink: 0x1a1220, paper: 0xf4ecd2, paperInk: 0x3b2324, dim: 0xb8a890, gold: 0xf5cf6a, teal: 0x6fe0d8, red: 0xe8702e, green: 0x9cc45a, stone: 0xc4c3d4 };

export async function loadUI(base) {
  const urls = NAMES.map((n) => `${base}art/ui/${n}.png`);
  const got = await Assets.load(urls);
  NAMES.forEach((n, i) => { K[n] = got[urls[i]]; });
  await document.fonts.load('12px "Galmuri11"', '가A1');
  await document.fonts.load('10px "Galmuri9"', '가A1');
}
export const kit = (n) => K[n];
/** 글자 텍스처 해상도 = UI 배율 × 기기 밀도 → 픽셀 폰트가 뭉개지지 않는다 */
export function setTextRes(r) { textRes = r; }

/** 9-slice 창/패널. style: wood | stone | paper, kind: win | panel */
export function frame(style, w, h, kind = 'win') {
  return new NineSliceSprite({ texture: K[`${kind}_${style}`], leftWidth: 6, topWidth: 6, rightWidth: 6, bottomWidth: 6, width: w, height: h });
}

/** 픽셀 글자. small = Galmuri9(10px), 기본 Galmuri11(12px) */
export function label(str, { color = COLOR.paper, small = false, align = 'left', shadow = true, wrap = 0 } = {}) {
  const t = new Text({
    text: str,
    resolution: textRes,
    style: {
      fontFamily: small ? 'Galmuri9' : 'Galmuri11', fontSize: small ? 10 : 12, fill: color, align,
      wordWrap: wrap > 0, wordWrapWidth: wrap || 100, breakWords: true, lineHeight: small ? 12 : 14,
      dropShadow: shadow ? { color: INK, distance: 1, angle: Math.PI / 2, blur: 0, alpha: 1 } : undefined,
    },
  });
  t.roundPixels = true;
  return t;
}

/** PATCH_V12 §2: 글자는 두 크기만 — 넘치면 줄이지 말고 끝을 "…"로 자른다 */
export function fitText(t, maxW) {
  if (!t || maxW <= 0 || t.width <= maxW) return t;
  let s = t.text;
  while (s.length > 1 && t.width > maxW) { s = s.slice(0, -1); t.text = s.trimEnd() + '…'; }
  return t;
}

/** 버튼: 4상태(normal/hover/pressed/disabled) 텍스처를 9-slice(4px)로 늘린다 */
export function button(style, w, h, str, onTap, { small = false } = {}) {
  const c = new Container();
  const bg = new NineSliceSprite({ texture: K[`btn_${style}_normal`], leftWidth: 4, topWidth: 4, rightWidth: 4, bottomWidth: 4, width: w, height: h });
  const textColor = style === 'paper' ? COLOR.paperInk : COLOR.paper;
  const t = label(str, { color: textColor, small, shadow: style !== 'paper' });
  fitText(t, w - 6);
  c.addChild(bg, t);
  const place = (dy) => { t.x = Math.round((w - t.width) / 2); t.y = Math.round((h - t.height) / 2) + dy - 1; };
  place(0);
  let disabled = false, over = false;
  const set = (s) => { bg.texture = K[`btn_${style}_${disabled ? 'disabled' : s}`]; place(s === 'pressed' && !disabled ? 1 : 0); };
  c.eventMode = 'static'; c.cursor = 'pointer';
  c.on('pointerover', () => { over = true; set('hover'); });
  c.on('pointerout', () => { over = false; set('normal'); });
  c.on('pointerdown', () => set('pressed'));
  c.on('pointerup', () => set(over ? 'hover' : 'normal'));
  c.on('pointerupoutside', () => set('normal'));
  c.on('pointertap', (e) => { if (!disabled) onTap?.(e); });
  c.setText = (s) => { t.text = s; place(0); };
  c.setDisabled = (v) => { disabled = v; t.alpha = v ? 0.5 : 1; set('normal'); };
  return c;
}

/** 바: 빈 틀(9-slice) + 채움 */
export function bar(w, fill = 0xd39a3a, hi = 0xf5cf6a) {
  const c = new Container();
  const bg = new NineSliceSprite({ texture: K.bar_frame, leftWidth: 3, topWidth: 3, rightWidth: 3, bottomWidth: 3, width: w, height: 8 });
  const g = new Graphics();
  c.addChild(bg, g);
  c.set = (p) => {
    const n = Math.round((w - 4) * Math.max(0, Math.min(1, p)));
    g.clear();
    if (n > 0) g.rect(2, 2, n, 4).fill(fill).rect(2, 2, n, 1).fill(hi);
  };
  c.set(0);
  return c;
}

/** 탭 (on/off 텍스처를 9-slice로 가로 늘림) */
export function tab(w, str, onTap) {
  const c = new Container();
  const bg = new NineSliceSprite({ texture: K.tab_off, leftWidth: 4, topWidth: 4, rightWidth: 4, bottomWidth: 2, width: w, height: 14 });
  const t = label(str, { small: true });
  c.addChild(bg, t);
  c.eventMode = 'static'; c.cursor = 'pointer';
  c.on('pointertap', () => onTap?.());
  c.setOn = (on) => {
    bg.texture = on ? K.tab_on : K.tab_off;
    t.x = Math.round((w - t.width) / 2); t.y = on ? 2 : 3;
    t.alpha = on ? 1 : 0.7;
  };
  c.setOn(false);
  return c;
}

/** 초상 액자: 슬롯 틀 안에만 초상을 둔다 (§5-1-3) */
export function portraitFrame(texture, size = 52, style = 'wood') {
  const c = new Container();
  const f = new NineSliceSprite({ texture: K[`slot_${style}`], leftWidth: 4, topWidth: 4, rightWidth: 4, bottomWidth: 4, width: size, height: size });
  const s = new Sprite(texture);
  const place = () => {                                   // 작은 틀이면 머리 쪽(위)을, 넉넉하면 발밑을 맞춘다
    const tw = s.texture.frame.width, th = s.texture.frame.height;
    s.position.set(Math.round((size - tw) / 2), th > size - 4 ? 2 : size - th - 2);
  };
  place();
  const mask = new Graphics().rect(2, 2, size - 4, size - 4).fill(0xffffff);
  s.mask = mask;
  c.addChild(f, s, mask);
  c.setTexture = (t) => { s.texture = t; place(); };
  return c;
}

export const icon = (texture) => { const s = new Sprite(texture); s.roundPixels = true; return s; };
