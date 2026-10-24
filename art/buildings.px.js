// 돌망치 상회 — 지상 부지 건물 10종 + 장식 6종 (명세3 §2-3). 체크인 건물 톤, 사무소 장면 팔레트.
// 각 건물은 Lv1 / Lv3 / Lv5 외형 3단. 밤 조명용 창문 색 L은 lighting emit 대상.
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

// ---------------------------------------------------------------- 공용 부품
// 벽: 통나무(wood) / 돌(stone) / 회벽(plaster)
const wall = (c, x, y, w, h, kind) => {
  if (kind === "wood") { c.rect(x, y, w, h, "t"); for (let yy = y; yy < y + h; yy += 4) { c.hline(x, yy, w, "y"); c.hline(x, yy + 3, w, "T") } }
  if (kind === "stone") { c.rect(x, y, w, h, "s"); for (let yy = y, r = 0; yy < y + h; yy += 5, r++) { c.hline(x, yy + 4, w, "S"); for (let xx = x + (r % 2) * 4; xx < x + w; xx += 8) c.vline(xx, yy, 4, "S") } }
  if (kind === "plaster") { c.rect(x, y, w, h, "c"); c.hline(x, y, w, "x"); c.vline(x, y, h, "x"); c.hline(x, y + h - 1, w, "B"); c.vline(x + w - 1, y, h, "B") }
  c.box(x, y, w, h, "k")
}
// 지붕: 박공, 색 2단
const roof = (c, x, y, w, h, hi, lo) => {
  c.poly([x - 2, y + h, x + w / 2, y, x + w + 2, y + h], lo)
  c.poly([x, y + h, x + w / 2, y + 2, x + w - 1, y + h], hi)
  for (let yy = y + 3; yy < y + h; yy += 3) c.line(x + (yy - y) * (w / 2) / h - 1, yy, x + w - (yy - y) * (w / 2) / h, yy, lo)
  c.line(x - 2, y + h, x + w / 2, y, "k"); c.line(x + w / 2, y, x + w + 2, y + h, "k")
}
const win = (c, x, y, w = 4, h = 5, lit = "L") => { c.rect(x, y, w, h, lit); c.box(x - 1, y - 1, w + 2, h + 2, "e"); c.px(x + 1, y + 2, "l") }
const door = (c, x, y, w = 5, h = 8) => { c.rect(x, y, w, h, "W"); c.box(x, y, w, h, "e"); c.vline(x + Math.floor(w / 2), y, h, "e"); c.px(x + w - 2, y + 4, "a") }
const sign = (c, x, y, w, col = "a") => { c.rect(x, y, w, 4, "c"); c.box(x, y, w, 4, "e"); c.rect(x + 1, y + 1, w - 2, 2, col) }
const chimney = (c, x, y) => { c.rect(x, y, 3, 6, "s"); c.hline(x, y, 3, "i"); c.box(x, y, 3, 6, "k") }
const ground = (c, w, h) => { c.rect(0, h - 3, w, 3, "P"); c.hline(0, h - 3, w, "p"); for (let x = 1; x < w; x += 5) c.px(x + (x % 3), h - 2, "p") }

// ---------------------------------------------------------------- 사무소 (코어) 48×48 → Lv5 64×56
sprite("office_1", { w: 48, h: 48 }, (c) => {
  ground(c, 48, 48); wall(c, 8, 24, 32, 21, "wood"); roof(c, 8, 8, 32, 16, "h", "H")
  door(c, 21, 37); win(c, 12, 29); win(c, 32, 29); sign(c, 16, 24, 16, "a"); chimney(c, 32, 10)
})
sprite("office_3", { w: 56, h: 56 }, (c) => {
  ground(c, 56, 56); wall(c, 6, 30, 44, 23, "wood"); wall(c, 12, 16, 32, 14, "plaster"); roof(c, 12, 4, 32, 12, "h", "H"); roof(c, 6, 22, 44, 8, "H", "R")
  door(c, 25, 45); win(c, 10, 36); win(c, 42, 36); win(c, 18, 20); win(c, 34, 20); sign(c, 18, 30, 20, "a"); chimney(c, 38, 6)
  c.rect(0, 44, 6, 2, "u"); c.rect(50, 44, 6, 2, "u")                              // 난간
})
sprite("office_5", { w: 64, h: 64 }, (c) => {
  ground(c, 64, 64); wall(c, 4, 36, 56, 25, "stone"); wall(c, 10, 20, 44, 16, "wood"); wall(c, 20, 6, 24, 14, "plaster")
  roof(c, 20, -4, 24, 10, "a", "A"); roof(c, 10, 12, 44, 8, "h", "H"); roof(c, 4, 28, 56, 8, "H", "R")
  door(c, 29, 52, 6, 9); win(c, 9, 42); win(c, 50, 42); win(c, 16, 25); win(c, 44, 25); win(c, 30, 10, 4, 6); sign(c, 20, 36, 24, "l")
  chimney(c, 48, 14); c.px(32, -3, "l"); c.vline(32, -2, 6, "A"); c.rect(33, -3, 5, 3, "r")      // 깃발
  c.rect(0, 50, 4, 2, "u"); c.rect(60, 50, 4, 2, "u")
})

// ---------------------------------------------------------------- 창고
sprite("warehouse_1", { w: 48, h: 40 }, (c) => {
  ground(c, 48, 40); wall(c, 6, 18, 36, 19, "wood"); c.rect(6, 12, 36, 6, "W"); c.hline(6, 12, 36, "u"); c.box(6, 12, 36, 6, "k")
  c.rect(16, 24, 16, 13, "W"); c.box(16, 24, 16, 13, "e"); c.vline(24, 24, 13, "e"); c.line(17, 25, 23, 36, "e"); c.line(31, 25, 25, 36, "e")   // 큰 문 X
  c.rect(8, 20, 6, 4, "a"); c.rect(34, 20, 6, 4, "a")                                             // 광석 상자
})
sprite("warehouse_3", { w: 56, h: 48 }, (c) => {
  ground(c, 56, 48); wall(c, 4, 22, 48, 23, "wood"); c.rect(4, 14, 48, 8, "W"); c.hline(4, 14, 48, "u"); c.box(4, 14, 48, 8, "k")
  c.rect(20, 28, 16, 17, "W"); c.box(20, 28, 16, 17, "e"); c.vline(28, 28, 17, "e"); c.line(21, 29, 27, 44, "e"); c.line(35, 29, 29, 44, "e")
  c.rect(6, 36, 10, 9, "s"); c.box(6, 36, 10, 9, "k"); c.rect(8, 34, 6, 2, "a"); c.px(9, 33, "l")   // 광석 상자 쌓임
  c.rect(40, 36, 10, 9, "s"); c.box(40, 36, 10, 9, "k"); c.rect(42, 34, 6, 2, "g")
  win(c, 10, 26); win(c, 42, 26)
})
sprite("warehouse_5", { w: 64, h: 56 }, (c) => {
  ground(c, 64, 56); wall(c, 2, 26, 60, 27, "stone"); c.rect(2, 16, 60, 10, "W"); c.hline(2, 16, 60, "u"); c.box(2, 16, 60, 10, "k")
  c.rect(24, 32, 16, 21, "W"); c.box(24, 32, 16, 21, "e"); c.vline(32, 32, 21, "e"); c.line(25, 33, 31, 52, "e"); c.line(39, 33, 33, 52, "e")
  for (const [x, col] of [[4, "a"], [12, "g"], [44, "v"], [52, "I"]]) { c.rect(x, 42, 8, 11, "s"); c.box(x, 42, 8, 11, "k"); c.rect(x + 1, 40, 6, 2, col); c.px(x + 2, 39, col) }
  win(c, 8, 30); win(c, 52, 30); win(c, 30, 20, 4, 4); c.rect(28, 10, 8, 6, "s"); c.box(28, 10, 8, 6, "k"); c.rect(30, 8, 4, 2, "a")   // 지붕 위 저울탑
})

// ---------------------------------------------------------------- 광차 차고
sprite("cartshed_1", { w: 48, h: 40 }, (c) => {
  ground(c, 48, 40); wall(c, 6, 20, 36, 17, "stone"); roof(c, 6, 10, 36, 10, "s", "S")
  c.rect(14, 26, 20, 11, "K"); c.box(14, 26, 20, 11, "k")                                       // 열린 차고
  c.hline(0, 36, 48, "i"); for (let x = 2; x < 48; x += 6) c.rect(x, 35, 2, 3, "W")               // 레일
  c.rect(18, 29, 12, 6, "s"); c.rect(19, 28, 10, 2, "a"); c.circ(21, 36, 1, "K"); c.circ(27, 36, 1, "K")   // 안의 광차
})
sprite("cartshed_3", { w: 56, h: 48 }, (c) => {
  ground(c, 56, 48); wall(c, 4, 24, 48, 21, "stone"); roof(c, 4, 12, 48, 12, "s", "S")
  c.rect(8, 30, 18, 15, "K"); c.box(8, 30, 18, 15, "k"); c.rect(30, 30, 18, 15, "K"); c.box(30, 30, 18, 15, "k")
  c.hline(0, 44, 56, "i"); for (let x = 2; x < 56; x += 6) c.rect(x, 43, 2, 3, "W")
  for (const x of [11, 33]) { c.rect(x, 35, 12, 7, "s"); c.rect(x + 1, 34, 10, 2, "a"); c.circ(x + 3, 43, 1, "K"); c.circ(x + 9, 43, 1, "K") }
  c.rect(24, 16, 8, 8, "W"); c.box(24, 16, 8, 8, "k"); c.circ(28, 20, 2, "a"); c.px(28, 20, "k")        // 도르래
})
sprite("cartshed_5", { w: 64, h: 56 }, (c) => {
  ground(c, 64, 56); wall(c, 2, 28, 60, 25, "stone"); roof(c, 2, 14, 60, 14, "i", "s")
  for (const x of [6, 24, 42]) { c.rect(x, 34, 16, 19, "K"); c.box(x, 34, 16, 19, "k"); c.rect(x + 2, 42, 12, 7, "s"); c.rect(x + 3, 41, 10, 2, x === 24 ? "g" : "a"); c.circ(x + 4, 50, 1, "K"); c.circ(x + 11, 50, 1, "K") }
  c.hline(0, 52, 64, "i"); for (let x = 2; x < 64; x += 6) c.rect(x, 51, 2, 3, "W")
  c.rect(28, 16, 8, 12, "W"); c.box(28, 16, 8, 12, "k"); c.circ(32, 21, 3, "a"); c.px(32, 21, "k"); c.vline(36, 10, 6, "I"); c.rect(36, 8, 6, 2, "I")   // 크레인
})

// ---------------------------------------------------------------- 광부 숙소
sprite("lodge_1", { w: 48, h: 44 }, (c) => {
  ground(c, 48, 44); wall(c, 8, 22, 32, 19, "wood"); roof(c, 8, 8, 32, 14, "b", "n")
  door(c, 21, 33); win(c, 12, 27); win(c, 32, 27); chimney(c, 14, 10)
  c.rect(0, 38, 6, 3, "W"); c.rect(1, 36, 4, 2, "c")                                              // 빨래통
})
sprite("lodge_3", { w: 56, h: 52 }, (c) => {
  ground(c, 56, 52); wall(c, 6, 28, 44, 21, "wood"); wall(c, 14, 16, 28, 12, "wood"); roof(c, 14, 4, 28, 12, "b", "n"); roof(c, 6, 22, 44, 6, "n", "N")
  door(c, 25, 41); win(c, 10, 34); win(c, 42, 34); win(c, 19, 19); win(c, 34, 19); chimney(c, 38, 6)
  c.hline(0, 30, 10, "W"); c.rect(1, 31, 3, 4, "r"); c.rect(5, 31, 3, 4, "c")                     // 빨랫줄
})
sprite("lodge_5", { w: 64, h: 60 }, (c) => {
  ground(c, 64, 60); wall(c, 4, 36, 56, 21, "stone"); wall(c, 8, 22, 48, 14, "wood"); wall(c, 16, 8, 32, 14, "wood")
  roof(c, 16, -4, 32, 12, "b", "n"); roof(c, 8, 16, 48, 6, "n", "N"); roof(c, 4, 30, 56, 6, "n", "N")
  door(c, 29, 48, 6, 9); for (const x of [8, 20, 40, 52]) win(c, x, 41); for (const x of [12, 46]) win(c, x, 26); win(c, 22, 12); win(c, 38, 12); chimney(c, 44, -2); chimney(c, 12, 18)
  c.hline(0, 44, 8, "W"); c.rect(1, 45, 3, 4, "r"); c.rect(5, 45, 2, 4, "b")
})

// ---------------------------------------------------------------- 제련소 (굴뚝 연기 anim)
anim("_smoke", { w: 9, h: 14, frames: 6, fps: 5 }, (c) => {
  const f = c.frame; for (let i = 0; i < 3; i++) { const yy = 12 - ((f * 2 + i * 5) % 14), xx = 4 + Math.round(Math.sin((f + i * 2) * 0.9)) ; c.circ(xx, yy, i === 2 ? 1 : 2, i === 0 ? "I" : "i") }
})
sprite("smelter_1", { w: 48, h: 48 }, (c) => {
  ground(c, 48, 48); wall(c, 8, 24, 32, 21, "stone"); roof(c, 8, 14, 32, 10, "S", "K")
  c.rect(18, 32, 12, 13, "K"); c.box(18, 32, 12, 13, "k"); c.rect(20, 38, 8, 6, "H"); c.rect(22, 40, 4, 3, "h"); c.px(24, 41, "l")   // 아궁이
  c.rect(30, 6, 5, 18, "s"); c.box(30, 6, 5, 18, "k"); c.hline(30, 6, 5, "i"); c.stamp("_smoke", 28, -6)
})
sprite("smelter_3", { w: 56, h: 56 }, (c) => {
  ground(c, 56, 56); wall(c, 6, 28, 44, 25, "stone"); roof(c, 6, 18, 44, 10, "S", "K")
  c.rect(20, 38, 16, 15, "K"); c.box(20, 38, 16, 15, "k"); c.rect(22, 44, 12, 8, "H"); c.rect(25, 46, 6, 5, "h"); c.px(28, 48, "l")
  for (const x of [34, 42]) { c.rect(x, 6, 5, 22, "s"); c.box(x, 6, 5, 22, "k"); c.hline(x, 6, 5, "i"); c.stamp("_smoke", x - 2, -6) }
  c.rect(8, 46, 10, 7, "a"); c.box(8, 46, 10, 7, "A"); c.hline(9, 47, 8, "l")                     // 괴 더미
})
sprite("smelter_5", { w: 64, h: 64 }, (c) => {
  ground(c, 64, 64); wall(c, 4, 32, 56, 29, "stone"); roof(c, 4, 22, 56, 10, "i", "S")
  c.rect(22, 42, 20, 19, "K"); c.box(22, 42, 20, 19, "k"); c.rect(24, 48, 16, 12, "H"); c.rect(28, 51, 8, 8, "h"); c.rect(31, 53, 2, 4, "L")
  for (const x of [8, 40, 50]) { c.rect(x, 4, 6, 28, "s"); c.box(x, 4, 6, 28, "k"); c.hline(x, 4, 6, "i"); c.rect(x + 1, 10, 4, 2, "H"); c.stamp("_smoke", x - 1, -8) }
  c.rect(6, 52, 12, 9, "a"); c.box(6, 52, 12, 9, "A"); c.hline(7, 53, 10, "l"); c.rect(8, 49, 8, 3, "a"); c.hline(9, 50, 6, "l")
})

// ---------------------------------------------------------------- 랜턴 공방 (창문 빛 강조)
anim("_lantern_glow", { w: 5, h: 6, frames: 4, fps: 5 }, (c) => { c.rect(0, 0, 5, 6, c.frame % 2 ? "L" : "l"); c.px(2, 2, "Q") })
sprite("lanternshop_1", { w: 48, h: 44 }, (c) => {
  ground(c, 48, 44); wall(c, 10, 20, 28, 21, "plaster"); roof(c, 10, 8, 28, 12, "a", "A")
  door(c, 22, 33); c.stamp("_lantern_glow", 13, 25); c.stamp("_lantern_glow", 30, 25); c.box(12, 24, 7, 8, "e"); c.box(29, 24, 7, 8, "e")
  c.rect(4, 22, 1, 10, "A"); c.rect(2, 20, 5, 4, "a"); c.px(4, 21, "L")                           // 걸린 랜턴 간판
})
sprite("lanternshop_3", { w: 56, h: 52 }, (c) => {
  ground(c, 56, 52); wall(c, 8, 26, 40, 23, "plaster"); roof(c, 8, 12, 40, 14, "a", "A")
  door(c, 26, 41); for (const x of [11, 18, 33, 40]) { c.stamp("_lantern_glow", x, 31); c.box(x - 1, 30, 7, 8, "e") }
  c.rect(4, 28, 1, 10, "A"); c.rect(2, 26, 5, 4, "a"); c.px(4, 27, "L"); c.rect(51, 28, 1, 10, "A"); c.rect(49, 26, 5, 4, "a"); c.px(51, 27, "L")
  win(c, 26, 18, 4, 5)
})
sprite("lanternshop_5", { w: 64, h: 60 }, (c) => {
  ground(c, 64, 60); wall(c, 6, 32, 52, 25, "plaster"); wall(c, 16, 18, 32, 14, "plaster"); roof(c, 16, 6, 32, 12, "l", "a"); roof(c, 6, 26, 52, 6, "a", "A")
  door(c, 29, 48, 6, 9); for (const x of [9, 17, 40, 48]) { c.stamp("_lantern_glow", x, 37); c.box(x - 1, 36, 7, 8, "e") } for (const x of [20, 38]) { c.stamp("_lantern_glow", x, 22); c.box(x - 1, 21, 7, 8, "e") }
  for (const x of [2, 60]) { c.rect(x, 34, 1, 10, "A"); c.rect(x - 2, 32, 5, 4, "a"); c.px(x, 33, "L") }
  c.circ(32, 12, 3, "L"); c.circ(32, 12, 4, "a"); c.circ(32, 12, 3, "L")                           // 큰 등불 간판
})

// ---------------------------------------------------------------- 펌프실 (물탱크)
anim("_drip", { w: 3, h: 8, frames: 4, fps: 4 }, (c) => { c.px(1, c.frame * 2, "O") })
sprite("pump_1", { w: 48, h: 44 }, (c) => {
  ground(c, 48, 44); wall(c, 12, 26, 24, 15, "stone"); c.rect(14, 10, 20, 16, "W"); c.box(14, 10, 20, 16, "k"); c.hline(14, 14, 20, "i"); c.hline(14, 20, 20, "i")   // 물탱크
  c.rect(16, 6, 16, 4, "s"); c.box(16, 6, 16, 4, "k"); door(c, 21, 33); c.vline(36, 30, 11, "i"); c.stamp("_drip", 35, 36)
})
sprite("pump_3", { w: 56, h: 52 }, (c) => {
  ground(c, 56, 52); wall(c, 8, 32, 40, 17, "stone"); c.rect(14, 10, 28, 22, "W"); c.box(14, 10, 28, 22, "k"); for (const y of [14, 20, 26]) c.hline(14, y, 28, "i")
  c.rect(16, 6, 24, 4, "s"); c.box(16, 6, 24, 4, "k"); door(c, 25, 41); c.vline(48, 34, 15, "i"); c.vline(6, 34, 15, "i"); c.stamp("_drip", 47, 40); c.stamp("_drip", 5, 42)
  c.circ(28, 21, 4, "I"); c.circ(28, 21, 3, "O"); c.px(28, 21, "k"); c.line(28, 21, 30, 18, "k")    // 압력계
})
sprite("pump_5", { w: 64, h: 60 }, (c) => {
  ground(c, 64, 60); wall(c, 4, 38, 56, 19, "stone"); c.rect(10, 8, 44, 30, "W"); c.box(10, 8, 44, 30, "k"); for (const y of [13, 20, 27, 34]) c.hline(10, y, 44, "i")
  c.rect(12, 4, 40, 4, "s"); c.box(12, 4, 40, 4, "k"); door(c, 29, 47, 6, 10)
  for (const x of [2, 60]) { c.vline(x, 40, 17, "i"); c.stamp("_drip", x - 1, 46) } c.vline(31, 2, 2, "I"); c.rect(28, 0, 8, 2, "I")
  c.circ(32, 24, 5, "I"); c.circ(32, 24, 4, "O"); c.px(32, 24, "k"); c.line(32, 24, 35, 21, "k"); c.rect(16, 40, 10, 8, "s"); c.box(16, 40, 10, 8, "k"); c.circ(21, 44, 2, "a")   // 모터
})

// ---------------------------------------------------------------- 포탑 공방
sprite("turretshop_1", { w: 48, h: 44 }, (c) => {
  ground(c, 48, 44); wall(c, 8, 22, 32, 19, "stone"); roof(c, 8, 12, 32, 10, "S", "K")
  door(c, 21, 33); c.rect(12, 26, 8, 6, "K"); c.box(12, 26, 8, 6, "k"); c.rect(13, 28, 6, 2, "H")     // 작업대 불
  c.rect(30, 14, 8, 8, "s"); c.box(30, 14, 8, 8, "k"); c.rect(33, 10, 2, 4, "i"); c.px(34, 9, "l")   // 지붕 위 포탑
})
sprite("turretshop_3", { w: 56, h: 52 }, (c) => {
  ground(c, 56, 52); wall(c, 6, 26, 44, 23, "stone"); roof(c, 6, 14, 44, 12, "S", "K")
  door(c, 25, 41); c.rect(10, 32, 10, 8, "K"); c.box(10, 32, 10, 8, "k"); c.rect(11, 35, 8, 2, "H"); c.px(14, 34, "l")
  for (const x of [8, 40]) { c.rect(x, 16, 8, 10, "s"); c.box(x, 16, 8, 10, "k"); c.rect(x + 3, 11, 2, 5, "i"); c.px(x + 4, 10, "l") }
  c.rect(36, 34, 12, 2, "i"); c.rect(38, 36, 8, 10, "s"); c.box(38, 36, 8, 10, "k")                // 포신 선반
})
sprite("turretshop_5", { w: 64, h: 60 }, (c) => {
  ground(c, 64, 60); wall(c, 4, 30, 56, 27, "stone"); roof(c, 4, 18, 56, 12, "i", "S")
  door(c, 29, 47, 6, 10); c.rect(8, 38, 14, 10, "K"); c.box(8, 38, 14, 10, "k"); c.rect(9, 42, 12, 3, "H"); c.rect(12, 41, 6, 1, "l")
  for (const x of [6, 28, 50]) { c.rect(x, 18, 8, 12, "s"); c.box(x, 18, 8, 12, "k"); c.rect(x + 3, 12, 2, 6, "i"); c.px(x + 4, 11, "l"); c.px(x + 2, 22, "g") }
  c.rect(40, 40, 18, 2, "i"); for (const x of [41, 47, 53]) { c.rect(x, 42, 4, 12, "s"); c.box(x, 42, 4, 12, "k") }
})

// ---------------------------------------------------------------- 두더지 집
sprite("molehome_1", { w: 48, h: 36 }, (c) => {
  ground(c, 48, 36); c.ellipse(24, 30, 14, 7, "p"); c.ellipse(24, 29, 12, 6, "P"); c.ellipse(24, 27, 10, 5, "p")   // 흙더미
  c.circ(24, 30, 4, "k"); c.circ(24, 31, 3, "K")                                                   // 굴 입구
  c.rect(8, 22, 1, 9, "W"); c.rect(5, 20, 7, 4, "c"); c.box(5, 20, 7, 4, "e"); c.px(8, 21, "a")        // 작은 간판
  c.px(36, 26, "M"); c.px(38, 27, "m"); c.px(14, 25, "M")
})
sprite("molehome_3", { w: 56, h: 44 }, (c) => {
  ground(c, 56, 44); c.ellipse(28, 36, 18, 9, "p"); c.ellipse(28, 34, 15, 7, "P"); c.ellipse(28, 31, 12, 6, "p")
  c.circ(28, 36, 5, "k"); c.circ(28, 37, 4, "K"); c.rect(20, 20, 16, 10, "W"); c.box(20, 20, 16, 10, "k"); roof(c, 20, 12, 16, 8, "m", "f")   // 작은 오두막 지붕
  win(c, 26, 23, 4, 4); c.rect(8, 28, 1, 11, "W"); c.rect(4, 26, 9, 4, "c"); c.box(4, 26, 9, 4, "e"); c.rect(5, 27, 7, 2, "a")
  for (const [x, y] of [[42, 32], [46, 34], [12, 36], [48, 30]]) c.px(x, y, "M")
})
sprite("molehome_5", { w: 64, h: 52 }, (c) => {
  ground(c, 64, 52); c.ellipse(32, 44, 22, 10, "p"); c.ellipse(32, 41, 18, 8, "P"); c.ellipse(32, 37, 14, 7, "p")
  c.circ(32, 44, 6, "k"); c.circ(32, 45, 5, "K"); c.circ(12, 46, 3, "k"); c.circ(52, 46, 3, "k")   // 굴 3개
  c.rect(22, 22, 20, 14, "W"); c.box(22, 22, 20, 14, "k"); roof(c, 22, 12, 20, 10, "m", "f"); win(c, 26, 26); win(c, 36, 26); c.px(32, 11, "Y")
  for (const [x, y] of [[8, 40], [18, 36], [46, 38], [56, 42], [40, 34]]) { c.px(x, y, "M"); c.px(x, y - 1, "r") }   // 꽃
  c.rect(4, 32, 1, 12, "W"); c.rect(0, 30, 9, 4, "c"); c.box(0, 30, 9, 4, "e"); c.rect(1, 31, 7, 2, "a")
})

// ---------------------------------------------------------------- 장식 6종
anim("deco_fire", { w: 16, h: 16, frames: 6, fps: 8 }, (c) => {
  const k = c.phase * Math.PI * 2, up = (h, a, o) => 14 - Math.round(h + Math.sin(k + o) * a)
  c.line(2, 14, 7, 11, "W", 2); c.line(13, 14, 8, 11, "W", 2); c.line(1, 12, 14, 12, "e", 2)
  c.poly([4, 13, 6, up(7, 1, 0), 8, up(10, 2, 1), 10, up(6, 1, 2), 12, 13], "H"); c.poly([6, 13, 8, up(7, 1, 1.5), 10, 13], "h"); c.px(8, 12, "l")
  c.lamp(8, 8, { r: 22, color: "#ffb27a", power: 0.8 })
})
anim("deco_flag", { w: 10, h: 20, frames: 4, fps: 6 }, (c) => {
  c.vline(1, 0, 20, "A"); c.px(1, 0, "l"); const f = c.frame
  c.poly([2, 1, 8 + (f % 2), 3 + (f > 1 ? 1 : 0), 2, 7], "r"); c.px(4, 4, "q")
})
sprite("deco_well", { w: 16, h: 20 }, (c) => {
  c.rect(2, 12, 12, 7, "s"); for (let x = 2; x < 14; x += 4) c.vline(x, 12, 7, "S"); c.hline(2, 12, 12, "i"); c.box(2, 12, 12, 7, "k")
  c.rect(4, 13, 8, 2, "n"); c.vline(3, 4, 8, "W"); c.vline(12, 4, 8, "W"); roof(c, 2, 0, 12, 4, "u", "w"); c.hline(5, 8, 6, "A"); c.rect(7, 9, 2, 3, "C")
})
sprite("deco_garden", { w: 20, h: 12 }, (c) => {
  c.rect(0, 6, 20, 6, "P"); c.box(0, 6, 20, 6, "W"); for (let x = 2; x < 20; x += 4) { c.vline(x, 3, 4, "f"); c.px(x - 1, 4, "m"); c.px(x + 1, 5, "m"); c.px(x, 2, ["r", "l", "q", "O", "x"][Math.floor(x / 4) % 5]) }
})
sprite("deco_scale", { w: 14, h: 16 }, (c) => {
  c.rect(5, 13, 4, 3, "A"); c.vline(6, 3, 10, "a"); c.vline(7, 3, 10, "a"); c.hline(1, 3, 12, "a"); c.px(6, 2, "l")
  c.line(1, 3, 0, 7, "A"); c.line(12, 3, 13, 7, "A"); c.rect(-1, 7, 4, 1, "a"); c.rect(11, 7, 4, 1, "a"); c.px(0, 6, "I"); c.px(12, 6, "l")
})
sprite("deco_rail", { w: 24, h: 8 }, (c) => {
  c.hline(0, 3, 24, "i"); c.hline(0, 6, 24, "i"); for (let x = 1; x < 24; x += 5) c.rect(x, 2, 2, 6, "W")
  c.rect(8, 0, 8, 3, "s"); c.rect(9, -1, 6, 1, "a"); c.px(9, 5, "K"); c.px(14, 5, "K")   // 장식용 미니 광차
})

// ---------------------------------------------------------------- 부지 데모 (밤)
sprite("_grass", { w: 16, h: 16 }, (c) => { c.rect(0, 0, 16, 16, "F"); const r = c.rng(3); for (let i = 0; i < 10; i++) c.px(Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? "f" : "m") })
const YARD = [
  pattern("_grass", 0, 0, 256, 192),
  rect(0, 0, 256, 30, "N"), rect(0, 30, 256, 2, "n"),
  stamp("office_5", 96, 36), stamp("warehouse_3", 8, 60), stamp("cartshed_3", 180, 56),
  stamp("lodge_3", 10, 120), stamp("smelter_3", 76, 124), stamp("lanternshop_3", 140, 124), stamp("molehome_3", 200, 136),
  stamp("deco_fire", 60, 170), stamp("deco_flag", 170, 110), stamp("deco_well", 86, 100), stamp("deco_garden", 232, 120), stamp("deco_scale", 70, 100), stamp("deco_rail", 150, 112),
]
scene("yard_day", { w: 256, h: 192, bg: "k" }, ...YARD.map((d, i) => i === 1 ? rect(0, 0, 256, 30, "O") : i === 2 ? rect(0, 30, 256, 2, "b") : d))
scene("yard_night", { w: 256, h: 192, bg: "k" },
  ...YARD,
  lamp(128, 70, { r: 70, color: "#ffd58a", power: 0.9 }), lamp(160, 150, { r: 60, color: "#ffe9a0", power: 1.0 }), lamp(100, 150, { r: 40, color: "#ffb27a", power: 0.8 }),
  lamp(40, 80, { r: 44, color: "#ffd58a", power: 0.7 }), lamp(40, 140, { r: 44, color: "#ffd58a", power: 0.7 }), lamp(210, 80, { r: 44, color: "#ffd58a", power: 0.6 }),
  lighting({ cell: 2, smooth: true, ambient: 0.55, ambientColor: "#8f8fd0", emit: "LlYQg" }),
  glow("L", { r: 5, strength: 0.6 }), glow("Y", { r: 3, strength: 0.7 }))

sheet("buildings", [
  "office_1", "office_3", "office_5", "warehouse_1", "warehouse_3", "warehouse_5", "cartshed_1", "cartshed_3", "cartshed_5",
  "lodge_1", "lodge_3", "lodge_5", "smelter_1", "smelter_3", "smelter_5", "lanternshop_1", "lanternshop_3", "lanternshop_5",
  "pump_1", "pump_3", "pump_5", "turretshop_1", "turretshop_3", "turretshop_5", "molehome_1", "molehome_3", "molehome_5",
  "deco_fire", "deco_flag", "deco_well", "deco_garden", "deco_scale", "deco_rail",
], { pad: 2 })
