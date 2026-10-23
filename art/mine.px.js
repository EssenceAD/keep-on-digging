// 「용사님, 채굴하실게요~」 런타임용 보조 아트 — 지상 띠(조명까지 구움) · 격자 양옆 패럴랙스 바위 · HUD 아이콘
// 타일·소품은 형철 초안 art/shaft.px.js (+ 끝의 Code 추가분). 사무소는 art/office/office.px.js.
// 같은 톤: shaft.px.js 팔레트 값을 그대로 쓴다(흙·바위·금·발광), 하늘만 추가.
pal({
  k: "#1a1220", K: "#2b1f35",
  D: "#3a2a22", d: "#55402f", E: "#6e5440", e: "#8a6c52",      // 흙
  S: "#3d3a4c", s: "#5a5770", i: "#7c7a92", I: "#a3a2b6",      // 바위, 쇠
  O: "#2a2634", o: "#3e3848",                                  // 단단한 바위
  W: "#5c3832", w: "#7d5040", u: "#9d6c50",                    // 갱목
  A: "#8a5a24", a: "#d39a3a", l: "#f5cf6a", L: "#fff4b8",      // 금, 랜턴
  G: "#2fa09a", g: "#6fe0d8", z: "#c8fff4",                    // 발광
  F: "#46702e", f: "#6a9a3a", x: "#f4ecd2",
  R: "#7a2e48", r: "#b84a62",
  N: "#0e0f26", m: "#25214a", "6": "#5c2e56", "5": "#b4523c", "4": "#ec9648",   // 해 질 녘 뒷산 하늘
  "3": "#2c1a2e", "2": "#3e2430", q: "#fff8e8",
})
ramps("kDdEe", "kSsiI", "kOo", "kWwu", "kAalL", "kGgz", "kNm6", "kRr")

// ================================================================ 지상 (256×48, 구운 조명 · 뒷산 해 질 녘)
// 세계 좌표: 격자는 x 32부터(양옆 2칸 = 패럴랙스 바위), 수직갱 = 격자 2열 → x 72
const SW = 256, SH = 48, SHAFT_X = 72, SHED = -182   // 창고(원래 x 372 기준 그림)를 x 190 쪽으로
sprite("_pine", { mx: "c" }, `
  ...3
  ...3
  ..33
  ..33
  .333
  .333
  3333
  ...3`)
sprite("_post_lantern", { outline: "k" }, `
  ..A..
  .AAA.
  A.L.A
  AlLlA
  A.l.A
  .AAA.`, lamp(2, 3, { r: 40, color: "#ffc878", power: 1 }))
scene("surface", { w: SW, h: SH, bg: "N" },
  layer("sky", { unlit: true },
    grad(0, 0, SW, 40, "Nm654", "v", 0.7),
    (c) => { const r = c.rng(4); for (let k = 0; k < 14; k++) c.px(Math.floor(r() * SW), Math.floor(r() * 12), "q") },
    poly([0, 40, 0, 27, 30, 22, 70, 27, 110, 18, 150, 25, 200, 16, 256, 23, 256, 40], "3"),
    scatter("_pine", 0, 22, SW, 14, 16, { on: "3", seed: 6 }),
    poly([0, 40, 0, 34, 50, 31, 100, 35, 160, 30, 210, 34, 256, 31, 256, 40], "2")),
  layer("ground", { solid: true },
    rect(0, 40, SW, 8, "d"), hline(0, 40, SW, "F"), hline(0, 41, SW, "f"), hline(0, 42, SW, "E"),
    rect(SHAFT_X - 8, 40, 16, 8, "_")),                                         // 수직갱 입구
  layer("headframe",
    line(SHAFT_X - 12, 40, SHAFT_X - 1, 10, "W", 2), line(SHAFT_X + 12, 40, SHAFT_X + 1, 10, "W", 2),
    hline(SHAFT_X - 9, 30, 19, "w"), hline(SHAFT_X - 6, 21, 13, "w"),
    line(SHAFT_X - 9, 30, SHAFT_X + 6, 21, "W"),
    ring(SHAFT_X, 9, 4, "i"), px(SHAFT_X, 9, "I"), vline(SHAFT_X + 4, 9, 39, "S"),
    rect(SHAFT_X - 10, 39, 21, 2, "w"), hline(SHAFT_X - 10, 39, 21, "u")),
  layer("rails", (c) => { for (let x = SHAFT_X + 12; x < 196; x += 5) c.rect(x, 39, 2, 1, "W"); c.hline(SHAFT_X + 10, 38, 196 - SHAFT_X - 10, "s") }),
  layer("shed", { x: SHED },
    rect(372, 18, 56, 22, "W"), (c) => { for (let x = 375; x < 428; x += 5) c.vline(x, 18, 22, "D") },
    poly([366, 19, 400, 6, 434, 19], "R"), line(366, 19, 400, 6, "r"), line(400, 6, 434, 19, "r"),
    rect(380, 26, 14, 14, "D"), box(380, 26, 14, 14, "w"),
    rect(404, 24, 10, 8, "l"), rect(405, 25, 8, 6, "L"), vline(408, 24, 8, "W"), hline(404, 28, 10, "W"), box(403, 23, 12, 10, "w"),
    rect(384, 12, 32, 6, "w"), hline(384, 12, 32, "u"), text(400, 13, "ORE", "D", { align: "c" }),
    lamp(409, 28, { r: 50, color: "#ffc070", power: 1 })),
  layer("post", vline(130, 26, 14, "W"), hline(128, 26, 5, "w"), stamp("_post_lantern", 128, 27)),
  lighting({ cell: 2, smooth: true, ambient: 0.6, ambientColor: "#c88a7a", emit: "lLq" }),
  glow("lL", { r: 6, strength: 0.45 }),
  glow("q", { r: 2, strength: 0.4 }))

// ================================================================ 격자 양옆 2칸 패럴랙스 바위 (32px 폭, 세로로 이어짐)
const SIDE = 32
const cob = (seed, n, body, hi, rim, H) => (c) => {
  const r = c.rng(seed)
  for (let k = 0; k < n; k++) {
    const x = Math.floor(r() * SIDE), y = Math.floor(r() * H), rx = 3 + Math.floor(r() * 4), ry = 2 + Math.floor(r() * 3)
    for (const ox of [-SIDE, 0, SIDE]) for (const oy of [-H, 0, H]) {
      c.ellipse(x + ox, y + oy, rx + 1, ry + 1, rim); c.ellipse(x + ox, y + oy, rx, ry, body); c.hline(x + ox - rx + 2, y + oy - ry, rx, hi)
    }
  }
}
// 먼 바위 (0.2): 어두운 자갈 벽
sprite("side_far", { w: SIDE, h: 128 }, rect(0, 0, SIDE, 128, "O"), cob(21, 26, "O", "o", "k", 128))
// 중간 (0.5): 바위 기둥과 낡은 갱목
sprite("side_mid", { w: SIDE, h: 160 },
  poly([4, 0, 20, 0, 16, 40, 22, 80, 14, 120, 18, 160, 2, 160, 6, 120, 0, 80, 6, 40], "S"),
  (c) => { for (let y = 0; y < 160; y++) for (let x = 1; x < SIDE; x++) if (c.is(x, y, "S") && c.is(x - 1, y, ".")) c.px(x, y, "s") },
  rect(26, 0, 4, 160, "W"), vline(26, 0, 160, "w"), rect(22, 70, 10, 3, "W"), hline(22, 70, 10, "w"))
// 앞 (1.3): 초점 밖 종유석·바위 덩이 실루엣
sprite("side_fg", { w: SIDE, h: 192 },
  (c) => {
    const drip = (x, y, len, w) => { c.poly([x - w, y, x + w, y, x, y + len], "k"); c.line(x - w + 1, y, x, y + len - 1, "K") }
    drip(8, 0, 22, 6); drip(20, 0, 12, 4); drip(14, 96, 30, 7)
    c.poly([0, 192, 2, 170, 14, 160, 28, 166, 32, 180, 32, 192], "k"); c.hline(4, 165, 14, "K")
  })

// ================================================================ HUD 아이콘
sprite("icon_gold", { outline: "k" }, `
  ..lLl.
  .laall
  aaalaa
  AaaaaA
  .AAAA.`)
sprite("icon_glow", { outline: "k" }, `
  ..z..
  .gGg.
  .gGG.
  GGgGG
  .GGG.
  ..G..`)

// ================================================================ 세로 화면 패럴랙스: 위(밤하늘) · 아래(깊은 어둠)
// 가로로 이어지는 띠 (128 폭). 세로 화면에선 격자가 화면 너비를 채우므로 겹은 위·아래로 간다 (§6-1).
const SKY = 128
sprite("sky_far", { w: SKY, h: 96 },                                      // 0.2: 지상 위로 이어지는 밤하늘
  grad(0, 0, SKY, 96, "NNm", "v", 0.6),
  (c) => { const r = c.rng(8); for (let k = 0; k < 18; k++) c.px(Math.floor(r() * SKY), Math.floor(r() * 90), r() < 0.3 ? "q" : "I") })
sprite("deep_far", { w: SKY, h: 96 },                                     // 0.2: 깊은 곳 자갈벽, 아래로 갈수록 어둠
  rect(0, 0, SKY, 96, "O"),
  (c) => {
    const r = c.rng(31)
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(r() * SKY), y = Math.floor(r() * 96), rx = 3 + Math.floor(r() * 5), ry = 2 + Math.floor(r() * 3)
      for (const ox of [-SKY, 0, SKY]) { c.ellipse(x + ox, y, rx + 1, ry + 1, "k"); c.ellipse(x + ox, y, rx, ry, "O"); c.hline(x + ox - rx + 2, y - ry, rx, "o") }
    }
  },
  dither(0, 40, SKY, 28, "O", "k", 0.5), rect(0, 68, SKY, 28, "k"))
sprite("deep_mid", { w: SKY, h: 64 },                                     // 0.5: 석순·낡은 갱목 실루엣
  poly([10, 64, 16, 20, 22, 64], "K"), poly([40, 64, 44, 34, 49, 64], "K"), poly([86, 64, 93, 10, 100, 64], "K"),
  rect(60, 8, 4, 56, "K"), rect(58, 8, 22, 3, "K"), line(64, 11, 78, 30, "K", 2), rect(76, 8, 4, 56, "K"))
sprite("deep_fg", { w: SKY, h: 32 },                                      // 1.3: 화면 맨 아래 초점 밖 바위
  poly([0, 32, 4, 14, 20, 6, 38, 12, 46, 32], "k"), poly([70, 32, 80, 18, 98, 14, 112, 22, 120, 32], "k"),
  hline(8, 9, 14, "K"), hline(82, 17, 16, "K"))

// HUD·판매 창 아이콘 (구리 · 은 · 보석)
sprite("icon_copper", { outline: "k" }, `
  ..eE..
  .ddeE.
  dEddde
  .dddd.`)
sprite("icon_silver", { outline: "k" }, `
  ..II..
  .iIIi.
  siiIis
  .ssss.`)
sprite("icon_gem", { outline: "k" }, `
  .RrrR.
  RrxrrR
  .RrrR.
  ..RR..`)
