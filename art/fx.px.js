// 「용사님, 채굴하실게요~」 이펙트 시트 (비주얼 가이드 §10 효과) — 48×48 × 6~8f, 장면 팔레트 안에서. 발광색(l L g z)은 glow().
// 게임에선 캐릭터와 같은 밀도(타일 1px = 2px)로 그린다. 중심 (24, 24) = 터지는 자리.
pal({
  k: "#1a1220", K: "#2b1f35",
  S: "#3d3a4c", s: "#5a5770", i: "#7c7a92", I: "#a3a2b6", J: "#c4c3d4",   // 바위
  D: "#3a2a22", d: "#55402f", E: "#6e5440", e: "#8a6c52",                 // 흙
  A: "#8a5a24", a: "#d39a3a", l: "#f5cf6a", L: "#fff4b8",                 // 금·불꽃
  h: "#e8702e", H: "#b83a2e",
  G: "#2fa09a", g: "#6fe0d8", z: "#c8fff4",                               // 발광
  N: "#22305e", b: "#3d5a9a", B: "#5a7ac0", x: "#f4ecd2",                 // 물
  F: "#46702e", f: "#6a9a3a", v: "#9cc45a", m: "#4a7048",                 // 가스·상승
  q: "#f6d2a8", Q: "#d79a6e", R: "#a8664a",                                // 손 (튜토리얼 손가락)
})
const S = 48, C = 24, TAU = Math.PI * 2
const ease = (t) => 1 - (1 - t) ** 2

// 1 곡괭이 타격 스파크: 빛줄기 8가닥이 튀었다가 점으로 사라짐 (6f)
anim("fx_hit", { w: S, h: S, frames: 6, fps: 20 }, (c) => {
  const t = c.frame / 5, r0 = 2 + 10 * ease(t), r1 = Math.max(r0 - 6 + 4 * t, 1)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2, col = k % 2 ? "l" : "L"
    if (c.frame < 4) c.line(Math.round(C + Math.cos(a) * r1), Math.round(C + Math.sin(a) * r1), Math.round(C + Math.cos(a) * r0), Math.round(C + Math.sin(a) * r0), col)
    else c.px(Math.round(C + Math.cos(a) * r0), Math.round(C + Math.sin(a) * r0), "a")
  }
  if (c.frame < 2) { c.circ(C, C, 3 - c.frame, "L"); c.px(C, C, "x") }
}, glow("lL", { r: 3, strength: 0.5 }))

// 공용: 덩어리들이 포물선으로 튀는 파편 (2·3·8)
const chunks = (n, seed, cols, size, spread, up, grav, frames) => (c) => {
  const r = c.rng(seed), t = c.frame / (frames - 1)
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * spread, v = 8 + r() * 14, sz = 1 + Math.floor(r() * size), col = cols[Math.floor(r() * cols.length)]
    const x = C + Math.cos(a) * v * t * 1.4, y = C + (Math.sin(a) * v * up) * t + grav * t * t
    if (t > 0.85 && k % 2) continue
    c.rect(Math.round(x), Math.round(y), sz, sz, col)
    if (sz > 1) c.px(Math.round(x), Math.round(y), cols[0])
  }
}
// 2 흙 파편 (7f)
anim("fx_dirt", { w: S, h: S, frames: 7, fps: 16 }, chunks(14, 3, ["e", "E", "d", "D"], 3, Math.PI * 1.3, 1.2, 22, 7),
  (c) => { if (c.frame < 3) c.ellipse(C, C + 2, 5 + c.frame * 2, 2 + c.frame, "E") })
// 3 바위 파편: 모난 조각 (7f)
anim("fx_rock", { w: S, h: S, frames: 7, fps: 16 }, (c) => {
  const r = c.rng(5), t = c.frame / 6
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.4, v = 10 + r() * 12, rot = r() < 0.5
    const x = Math.round(C + Math.cos(a) * v * t * 1.5), y = Math.round(C + Math.sin(a) * v * t * 1.2 + 20 * t * t)
    if (t > 0.85 && k % 2) continue
    c.poly(rot ? [x, y, x + 3, y + 1, x + 1, y + 3] : [x, y + 2, x + 2, y, x + 3, y + 3], "s"); c.px(x + 1, y + 1, "I")
  }
  if (c.frame < 2) for (let k = 0; k < 6; k++) c.px(C + Math.round(Math.cos(k) * 4), C + Math.round(Math.sin(k) * 4), "L")
})
// 4 광맥 터짐(금): 고리 + 금 알갱이 + 반짝 (8f). 발광 광석은 swap
anim("fx_vein", { w: S, h: S, frames: 8, fps: 14 }, (c) => {
  const t = c.frame / 7, r = c.rng(9)
  if (c.frame < 5) c.ring(C, C, Math.round(3 + 14 * ease(t * 1.4)), c.frame < 2 ? "L" : "l")
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU + r() * 0.4, v = 6 + r() * 14
    const x = Math.round(C + Math.cos(a) * v * ease(t)), y = Math.round(C + Math.sin(a) * v * ease(t) + 10 * t * t)
    c.rect(x, y, 2, 2, "a"); c.px(x, y, "L")
  }
  if (c.frame % 3 === 1) for (const [x, y] of [[C - 9, C - 8], [C + 10, C - 5], [C + 2, C + 11]]) { c.px(x, y, "L"); c.px(x - 1, y, "l"); c.px(x + 1, y, "l"); c.px(x, y - 1, "l"); c.px(x, y + 1, "l") }
}, glow("lL", { r: 3, strength: 0.45 }))
anim("fx_vein_glow", { w: S, h: S, frames: 8, fps: 14, base: "fx_vein", swap: { a: "G", l: "g", L: "z" } }, glow("gz", { r: 3, strength: 0.45 }))
// 5 대박: 큰 고리 두 겹 + 별 8개 (8f)
const star = (c, x, y, s, col) => { c.px(x, y, "L"); for (let d = 1; d <= s; d++) { c.px(x - d, y, col); c.px(x + d, y, col); c.px(x, y - d, col); c.px(x, y + d, col) } }
anim("fx_daebak", { w: S, h: S, frames: 8, fps: 12 }, (c) => {
  const t = c.frame / 7
  c.ring(C, C, Math.round(4 + 18 * ease(t)), t < 0.6 ? "L" : "l")
  if (c.frame > 1) c.ring(C, C, Math.round(2 + 12 * ease((c.frame - 2) / 5)), "a")
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + t, rr = 6 + 16 * ease(t)
    star(c, Math.round(C + Math.cos(a) * rr), Math.round(C + Math.sin(a) * rr), (c.frame + k) % 3 === 0 ? 2 : 1, "l")
  }
}, glow("lL", { r: 4, strength: 0.5 }))
// 6 가스 분출: 초록 연기 뭉치가 부풀며 솟음 (8f)
anim("fx_gas", { w: S, h: S, frames: 8, fps: 10 }, (c) => {
  const t = c.frame / 7, r = c.rng(12)
  for (let k = 0; k < 6; k++) {
    const x = C + Math.round((r() - 0.5) * 14 + Math.sin(t * 4 + k) * 2), y = Math.round(C + 14 - t * (14 + r() * 14)), rad = Math.round(2 + t * (4 + r() * 4))
    if (t > 0.8 && k % 2) continue
    c.circ(x, y, rad, "m"); c.circ(x - 1, y - 1, Math.max(1, rad - 2), "f"); c.px(x - rad + 2, y - rad + 2, "v")
  }
  c.ellipse(C, C + 15, 4, 1, "F")
})
// 7 지하수 콸콸: 구멍에서 물줄기가 호를 그리며 쏟아짐 + 거품 (8f)
anim("fx_water", { w: S, h: S, frames: 8, fps: 12 }, (c) => {
  const t = c.frame / 7
  for (let k = 0; k < 3; k++) {
    const v = 10 + k * 5
    for (let s = 0; s <= 14; s++) {
      const u = s / 14 * Math.min(1, t * 2 + 0.2), x = Math.round(C - 10 + v * u), y = Math.round(C - 6 + 30 * u * u - 6 * u)
      c.px(x, y, s % 4 === (c.frame % 4) ? "x" : k === 1 ? "B" : "b")
    }
  }
  c.ellipse(C - 10, C - 6, 2, 3, "N")
  if (t > 0.3) c.ellipse(C + 4, C + 20, Math.round(4 + t * 10), 2, "b")
  if (t > 0.3) for (let k = 0; k < 5; k++) c.px(C + 4 - 8 + k * 4, C + 18 - (c.frame + k) % 3, "x")
})
// 8 갱도 붕괴 먼지: 위에서 돌이 떨어지고 바닥에 먼지 구름 (8f)
anim("fx_collapse", { w: S, h: S, frames: 8, fps: 12 }, (c) => {
  const t = c.frame / 7, r = c.rng(21)
  for (let k = 0; k < 8; k++) {
    const x = 8 + Math.floor(r() * 32), d = r() * 0.3, y = Math.round(-4 + (t - d) * 60)
    if (y > -4 && y < 38) { c.rect(x, y, 3, 3, "s"); c.px(x, y, "i") }
  }
  if (t > 0.35) {
    const p = (t - 0.35) / 0.65
    for (let k = 0; k < 7; k++) { const x = 6 + k * 6, rad = Math.round(2 + p * (3 + (k % 3))); c.circ(x, 42 - Math.round(p * 4), rad, k % 2 ? "E" : "e") }
    c.dither(0, 38, S, 10, "e", "E", 0.5 * (1 - p))
  }
})
// 9 광차 불꽃: 바퀴 아래에서 뒤로 튀는 불티 (6f, 반복)
anim("fx_cart", { w: S, h: S, frames: 6, fps: 16 }, (c) => {
  const r = c.rng(31)
  for (let k = 0; k < 6; k++) {
    const p = ((c.frame / 6) + k / 6) % 1, a = Math.PI + 0.3 + r() * 0.6, v = 8 + r() * 12
    const x = Math.round(C + Math.cos(a) * v * p), y = Math.round(C + 6 - Math.sin(a) * v * p * 0.6 + 14 * p * p)
    c.px(x, y, p < 0.3 ? "L" : p < 0.6 ? "l" : "h")
    if (p < 0.4) c.px(x + 1, y, "a")
  }
}, glow("lL", { r: 2, strength: 0.5 }))
// 10 시세 급등 UI 펄스: 초록 화살표가 솟고 고리가 퍼짐 (6f)
anim("fx_pulse", { w: S, h: S, frames: 6, fps: 12 }, (c) => {
  const t = c.frame / 5, y = Math.round(C + 6 - 10 * ease(t))
  c.ring(C, C, Math.round(4 + 16 * ease(t)), t < 0.5 ? "v" : "f")
  c.poly([C, y - 6, C + 6, y, C + 2, y, C + 2, y + 6, C - 2, y + 6, C - 2, y, C - 6, y], "f")
  c.poly([C, y - 4, C + 3, y - 1, C - 3, y - 1], "v")
  if (c.frame % 2 === 0) for (const [x, yy] of [[C - 12, C - 6], [C + 11, C + 2]]) { c.px(x, yy, "v"); c.px(x, yy - 1, "f") }
})

sheet("fx", ["fx_*"], { pad: 0 })
scene("fx_demo", { w: 5 * S, h: 2 * S, bg: "K" },
  ...["fx_hit", "fx_dirt", "fx_rock", "fx_vein", "fx_daebak", "fx_gas", "fx_water", "fx_collapse", "fx_cart", "fx_pulse"].map((n, i) => stamp(n, (i % 5) * S, Math.floor(i / 5) * S, { frame: 2 })))

// 튜토리얼 손가락 (온보딩 §2): 0 가리키기 · 1 누르기 · 2 끌기 — 32×32, 손끝 = (9, 2). 게임이 프레임을 골라 씀
anim("ui_hand", { w: 32, h: 32, frames: 3, fps: 3, outline: "k" }, (c) => {
  const f = c.frame, dy = f ? 2 : 0
  if (f === 1) { c.circ(9, 3, 4, "L"); c.circ(9, 3, 2, "x") }                      // 누르는 곳 링
  if (f === 2) { c.hline(18, 6, 6, "I"); c.hline(20, 9, 5, "I"); c.hline(18, 12, 6, "I") }   // 끌기 줄
  const fy = 2 + dy + (f === 1 ? 1 : 0)
  c.rect(7, fy, 5, 13 - (f === 1 ? 1 : 0), "q"); c.vline(11, fy + 1, 11, "Q"); c.px(8, fy + 1, "x")     // 검지
  c.rect(6, 13 + dy, 15, 11, "q"); c.rect(17, 14 + dy, 4, 9, "Q")                 // 손바닥
  c.rect(12, 12 + dy, 4, 4, "q"); c.rect(16, 13 + dy, 4, 4, "q"); c.rect(20, 15 + dy, 3, 4, "Q")   // 접은 손가락
  c.rect(2, 16 + dy, 5, 4, "q"); c.hline(2, 19 + dy, 5, "Q")                       // 엄지
  c.rect(7, 24 + dy, 14, 5, "b"); c.hline(7, 24 + dy, 14, "B")                     // 소매
})
