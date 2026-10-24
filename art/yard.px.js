// 회사 부지 배경 (v0.6 패치 ①) — art/buildings.px.js yard_day/yard_night 의 땅·하늘(잔디 _grass · 하늘 O/b · 밤 N/n) + 흙길 · 울타리. 팔레트도 그 파일 것.
pal({
  k: "#1a1220", K: "#2b1f35",
  j: "#2a2420", T: "#3d3328", t: "#4f4232", y: "#6a5a44",      // 통나무
  e: "#3b2324", W: "#5c3832", w: "#7d5040", u: "#9d6c50", U: "#b98a68",   // 나무
  S: "#3d3a4c", s: "#5a5770", i: "#7c7a92", I: "#a3a2b6", J: "#c4c3d4",   // 돌·쇠
  B: "#8a7a68", C: "#b8a890", c: "#ddd0b0", x: "#f4ecd2",      // 회벽·종이
  A: "#8a5a24", a: "#d39a3a", l: "#f5cf6a", L: "#fff4b8",      // 놋쇠·창문 빛
  H: "#b83a2e", h: "#e8702e", o: "#ff9a4a",                    // 불·붉은 지붕
  R: "#7a2e48", r: "#b84a62", q: "#e07a88",                    // 천
  Z: "#1f5a5a", G: "#2fa09a", g: "#6fe0d8", z: "#c8fff4",      // 발광
  V: "#4a2a6a", v: "#8a4ab0",
  N: "#141a3a", n: "#22305e", b: "#3d5a9a", O: "#6f8fd0",      // 파랑 지붕·물
  F: "#2f4f22", f: "#46702e", m: "#6a9a3a", M: "#9cc45a",      // 풀·이끼
  P: "#5a4036", p: "#7a5a48",                                  // 흙바닥
  Q: "#f6f1d5", Y: "#f8e45c",
})

// 잔디 (yard 의 _grass 그대로)
sprite("yard_grass", { w: 16, h: 16 }, (c) => { c.rect(0, 0, 16, 16, "F"); const r = c.rng(3); for (let i = 0; i < 10; i++) c.px(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? "f" : "m") })
// 흙길 (가로로 이어 붙임): 가장자리 풀 · 바퀴 자국
sprite("yard_path", { w: 16, h: 16 }, (c) => {
  c.rect(0, 0, 16, 16, "P"); c.hline(0, 0, 16, "f"); c.hline(0, 15, 16, "f"); c.hline(0, 1, 16, "p")
  const r = c.rng(7); for (let i = 0; i < 6; i++) c.px(Math.floor(r() * 16), 3 + Math.floor(r() * 10), r() < 0.5 ? "p" : "y")
  c.hline(0, 5, 16, "p"); c.hline(0, 10, 16, "p")
})
// 울타리 (가로로 이어 붙임): 말뚝 + 가로대 2
sprite("yard_fence", { w: 16, h: 12 }, (c) => {
  for (const x of [2, 10]) { c.rect(x, 1, 3, 11, "w"); c.vline(x, 1, 11, "u"); c.box(x, 1, 3, 11, "e"); c.px(x + 1, 0, "e") }
  c.rect(0, 3, 16, 2, "u"); c.hline(0, 3, 16, "U"); c.hline(0, 5, 16, "e")
  c.rect(0, 8, 16, 2, "u"); c.hline(0, 8, 16, "U"); c.hline(0, 10, 16, "e")
})
// 하늘 띠 (세로로 늘림): 낮 O→b, 밤 N→n
sprite("yard_sky_day", { w: 4, h: 32 }, (c) => { c.rect(0, 0, 4, 28, "O"); c.rect(0, 28, 4, 4, "b") })
sprite("yard_sky_night", { w: 4, h: 32 }, (c) => { c.rect(0, 0, 4, 28, "N"); c.rect(0, 28, 4, 4, "n") })
