// 「돌망치 상회 사무소」 내부 — 용사님, 채굴하실게요~ (no_magic_night 문법으로 초안)
// 드워프 광산 회사 사무실 밤 장면: 벽난로 + 책상 위 램프 + 선반의 발광 광석 + 창밖 달.
// 256×224, 정수 확대 전제. 조명은 lamp()로 굽고, 빛나는 것들에 glow()를 얹는다.
pal({
  k: "#1a1220", K: "#2b1f35",                                  // 잉크, 깊은 그림자
  j: "#2a2420", T: "#3d3328", t: "#4f4232", y: "#6a5a44",      // 통나무 벽
  P: "#3a2a26", p: "#55403a", m: "#6e5248", M: "#8a6a5c",      // 마루
  e: "#3b2324", W: "#5c3832", w: "#7d5040", u: "#9d6c50",      // 호두나무 가구
  S: "#3d3a4c", s: "#5a5770", i: "#7c7a92", I: "#a3a2b6",      // 돌, 쇠
  B: "#8a7a68", C: "#b8a890", c: "#ddd0b0", x: "#f4ecd2",      // 종이, 장부
  A: "#8a5a24", a: "#d39a3a", l: "#f5cf6a", L: "#fff4b8",      // 놋쇠, 금, 램프 빛
  H: "#b83a2e", h: "#e8702e",                                  // 불
  Z: "#1f5a5a", G: "#2fa09a", g: "#6fe0d8", z: "#c8fff4",      // 발광 광석 (청록)
  V: "#4a2a6a", v: "#8a4ab0", U: "#c98af0",                    // 보라 광석
  R: "#7a2e48", r: "#b84a62", q: "#e07a88",                    // 붉은 천
  N: "#141a3a", n: "#22305e", b: "#3d5a9a", o: "#6f8fd0",      // 밤하늘
  Q: "#f6f1d5", Y: "#f8e45c",                                  // 달, 작은 불빛
  F: "#46702e", f: "#6a9a3a",                                  // 이끼
})
ramps("kKPpmM", "kjTty", "keWwu", "kSsiI", "SBCcx", "eAalL", "kRrq", "RHh", "kZGgz", "kVvU", "kNnbo", "kFf")

const FLOOR = 84

// ================================================================ 방 껍데기
sprite("_log", { w: 256, h: 12 },
  rect(0, 0, 256, 12, "t"), hline(0, 0, 256, "y"), hline(0, 10, 256, "T"), hline(0, 11, 256, "j"),
  (c) => { const r = c.rng(5); for (let x = 0; x < 256; x += 3 + Math.floor(r() * 9)) { const l = 2 + Math.floor(r() * 5); c.hline(x, 3 + Math.floor(r() * 5), l, r() < 0.5 ? "T" : "y") } })

sprite("floor", { w: 256, h: 140 }, (c) => {
  const r = c.rng(11)
  for (let y = 0; y < 140; y += 8) {
    let x = -Math.floor(r() * 40)
    while (x < 256) {
      const len = 28 + Math.floor(r() * 36), lit = r() < 0.2
      c.rect(x, y, len, 7, lit ? "m" : "p"); c.hline(x, y, len, lit ? "M" : "m")
      c.hline(x, y + 7, len, "P"); c.vline(x + len - 1, y, 7, "P")
      c.px(x + 1, y + 2, "P"); c.px(x + 1, y + 5, "P")
      x += len
    }
  }
})

// ================================================================ 창문 (달이 뜬 뒷산)
sprite("window", { w: 44, h: 46, outline: "k" },
  grad(6, 5, 32, 30, "NNnn", "v", 0.6),
  circ(28, 12, 5, "c"), circ(28, 12, 4, "Q"), px(26, 11, "c"), px(30, 14, "c"),
  px(11, 8, "x"), px(16, 15, "c"), px(34, 22, "c"), px(9, 24, "c"),
  poly([6, 35, 6, 28, 14, 22, 22, 26, 30, 20, 38, 25, 38, 35], "K"),       // 뒷산 능선
  rect(16, 27, 3, 4, "K"), px(17, 26, "K"), px(18, 29, "Y"),               // 산 위 갱도 입구 등불
  box(3, 2, 38, 40, "w"), box(4, 3, 36, 38, "w"), hline(5, 4, 34, "W"), vline(5, 4, 36, "W"),
  vline(21, 4, 36, "w"), vline(22, 4, 36, "W"), hline(5, 20, 34, "w"), hline(5, 21, 34, "W"),
  rect(0, 42, 44, 4, "u"), hline(0, 45, 44, "W"))                          // 창틀 선반

// ================================================================ 광석 선반
sprite("_ore_iron", `
  .ssi.
  sssis
  Ssssi
  .SSs.`)
sprite("_ore_gold", `
  .aal.
  AaalL
  AAaal
  .AAa.`)
sprite("_ore_glow", `
  .ggz.
  GggzZ
  ZGggz
  .ZGg.`)
sprite("_ore_purple", `
  .vU..
  VvvU.
  VVvv.
  .VV..`)
sprite("_gem", `
  .L.
  lal
  .A.`)
sprite("ore_shelf", { w: 54, h: 34, outline: "k" },
  rect(0, 0, 54, 2, "u"), rect(0, 2, 54, 1, "W"), rect(0, 15, 54, 2, "u"), rect(0, 17, 54, 1, "W"),
  rect(0, 30, 54, 2, "u"), rect(0, 32, 54, 1, "W"),
  vline(0, 0, 33, "W"), vline(53, 0, 33, "W"),
  stamp("_ore_iron", 4, -2), stamp("_ore_gold", 14, -2), stamp("_ore_glow", 25, -2), stamp("_ore_purple", 36, -2), stamp("_gem", 46, -1),
  stamp("_ore_gold", 6, 13), stamp("_ore_glow", 18, 13), stamp("_ore_iron", 30, 13), stamp("_gem", 42, 14), stamp("_ore_purple", 46, 13))

// ================================================================ 벽난로
const stonework = (x0, y0, w, h, seed) => clip([x0, y0, w, h], (c) => {
  const r = c.rng(seed)
  for (let y = y0, row = 0; y < y0 + h; y += 6, row++) {
    for (let x = x0 - (row % 2) * 5; x < x0 + w; x += 10) {
      const sh = r() < 0.3 ? "i" : "s"
      c.rect(x, y, 9, 5, sh); c.hline(x, y, 9, sh === "i" ? "I" : "i"); c.hline(x, y + 4, 9, "S"); c.vline(x + 8, y, 5, "S")
    }
  }
})
anim("_fire", { w: 22, h: 23, frames: 6, fps: 10 }, (c) => {
  const k = c.phase * Math.PI * 2, y = 21
  const up = (h, amp, off) => y - Math.round(h + Math.sin(k + off) * amp)
  c.poly([2, y, 4, up(9, 2, 0), 7, up(6, 1, 2), 10, up(17, 2, 1), 13, up(9, 2, 3), 16, up(13, 2, 4.5), 19, y], "H")
  c.poly([4, y, 7, up(7, 1, 1), 10, up(12, 2, 2.5), 12, up(7, 1, 0.5), 15, up(9, 2, 4), 17, y], "h")
  c.poly([6, y, 9, up(6, 1, 3), 11, up(9, 1, 1.2), 13, up(5, 1, 2), 15, y], "a")
  c.poly([8, y + 1, 10, up(4, 1, 0.7), 12, up(2, 1, 2.2), 13, y + 1], "l")
})
sprite("hearth", { w: 54, h: 80, outline: "k" },
  stonework(7, 0, 40, 30, 3), vline(7, 0, 30, "S"), vline(46, 0, 30, "S"),
  stonework(3, 34, 48, 46, 8),
  shade([12, 35, 30, 10], 1, 0.5),
  rect(14, 44, 26, 36, "e"), rect(14, 44, 26, 5, "K"),
  (c) => { for (let y = 50, row = 0; y < 78; y += 4, row++) { c.hline(14, y, 26, "K"); for (let x = 14 + (row % 2) * 3; x < 40; x += 6) c.vline(x, y + 1, 3, "K") } },
  line(16, 77, 37, 73, "W", 3), line(17, 73, 36, 77, "e", 3),
  stamp("_fire", 16, 54),
  hline(14, 78, 26, "S"), hline(14, 79, 26, "s"),
  rect(0, 30, 54, 2, "u"), rect(0, 32, 54, 3, "w"), hline(0, 35, 54, "W"))

// ================================================================ 책상 · 장부 · 램프
sprite("desk", { w: 84, h: 40, outline: "k" },
  rect(0, 0, 84, 5, "u"), hline(0, 0, 84, "M"), rect(0, 5, 84, 3, "w"), hline(0, 8, 84, "W"),
  rect(2, 8, 24, 30, "w"), box(4, 10, 20, 8, "W"), box(4, 20, 20, 8, "W"), box(4, 30, 20, 7, "W"),
  px(14, 14, "a"), px(14, 24, "a"), px(14, 33, "a"),                          // 서랍 손잡이
  rect(58, 8, 24, 30, "w"), box(60, 10, 20, 26, "W"), rect(62, 12, 16, 22, "e"),
  vline(28, 8, 30, "W"), vline(55, 8, 30, "W"))
sprite("ledger", { outline: "k" }, `
  ....CCCCCCCCCC..
  ..CCxxxxxxxxxxCC
  .CxxxCxxxCxxxxxC
  CxxCxxxxxCxxCxxC
  CxxxxCxxxCxxxxxC
  CCCCCCCCCCCCCCCC`)
sprite("inkpot", { outline: "k" }, `
  .C.
  sNs
  NNN`)
anim("desk_lamp", { outline: "k", fps: 6 }, `
  ...aaa...
  ..aLLLa..
  .aLLLLLa.
  .alLLLla.
  ..aaAaa..
  ....A....
  ....A....
  ...AAA...`,
  frame(), frame(grid(2, 1, "_l__\n____\n_lL_")), frame(grid(3, 1, "_l_\n___\nL__")))
sprite("coin_stack", { outline: "k" }, `
  .lal.
  aAAAa
  .lal.
  aAAAa
  .lal.
  aAAAa`)
sprite("stamp_seal", { outline: "k" }, `
  .ww.
  .ww.
  wwww
  rRRr`)

// ================================================================ 의자 · 광차 모형 · 통 · 지도
sprite("chair", { w: 16, h: 28, outline: "k" },
  rect(1, 0, 14, 3, "u"), rect(1, 3, 14, 10, "w"), vline(1, 3, 10, "W"), vline(14, 3, 10, "u"),
  rect(0, 13, 16, 4, "R"), hline(0, 13, 16, "r"), rect(0, 17, 16, 2, "W"),
  vline(1, 19, 9, "W"), vline(14, 19, 9, "W"), vline(2, 19, 9, "w"), vline(13, 19, 9, "w"))
sprite("cart_model", { outline: "k", w: 18, h: 12 },
  rect(2, 3, 14, 6, "s"), rect(3, 4, 12, 4, "S"), hline(2, 3, 14, "i"),
  circ(5, 10, 2, "K"), circ(12, 10, 2, "K"), px(5, 10, "I"), px(12, 10, "I"),
  rect(4, 1, 10, 3, "a"), px(6, 0, "L"), px(10, 0, "l"), px(8, 1, "L"))
sprite("barrel", { w: 20, h: 26, outline: "k" },
  rect(1, 0, 18, 26, "w"), vline(1, 0, 26, "W"), vline(18, 0, 26, "u"), vline(6, 0, 26, "W"), vline(12, 0, 26, "u"),
  hline(0, 3, 20, "s"), hline(0, 4, 20, "S"), hline(0, 20, 20, "s"), hline(0, 21, 20, "S"))
sprite("map_board", { w: 50, h: 36, outline: "k" },
  rect(0, 0, 50, 36, "w"), rect(2, 2, 46, 32, "c"),
  poly([6, 28, 12, 14, 20, 20, 28, 8, 36, 16, 44, 12, 44, 30], "C"),       // 산 단면
  line(10, 30, 10, 20, "B"), line(10, 20, 22, 20, "B"), line(22, 20, 22, 26, "B"), line(22, 26, 36, 26, "B"),   // 갱도
  px(30, 24, "a"), px(31, 24, "l"), px(38, 22, "g"), px(26, 18, "r"), px(14, 16, "r"),
  rect(5, 5, 12, 2, "B"), rect(5, 8, 8, 1, "B"))
sprite("pick", { outline: "k" }, `
  ..ss..
  .siis.
  siWWis
  s.WW.s
  ..WW..
  ..WW..
  ..WW..
  ..WW..`)
sprite("helmet_rack", { outline: "k" }, `
  ..aLa.......
  .yyyyy..yyyy
  yyyyyyy.yyyyy
  yyAyyyy.yyAyy
  ...W........W
  ...W........W`)
sprite("rug", { w: 110, h: 30 }, (c) => {
  c.rect(0, 0, 110, 30, "R"); c.box(1, 1, 108, 28, "q"); c.box(4, 4, 102, 22, "r")
  for (let x = 8; x < 102; x += 12) { c.px(x, 7, "a"); c.px(x + 6, 22, "a") }
  c.rect(30, 10, 50, 10, "r"); c.box(31, 11, 48, 8, "a")
})
sprite("notice", { outline: "k" }, `
  xxxxxxxxxx
  xCxCCxCCCx
  xxxxxxxxxx
  xCCxCxCCxx
  xxxxxxxxxx
  xCxCCCxCxx
  xxxxxxxxxx`)
sprite("portrait_old", { w: 20, h: 24, outline: "k" },
  rect(0, 0, 20, 24, "a"), box(1, 1, 18, 22, "A"), rect(2, 2, 16, 20, "B"),
  circ(10, 9, 4, "C"), rect(6, 13, 8, 8, "x"), rect(7, 10, 6, 3, "x"), px(9, 8, "k"), px(11, 8, "k"))
sprite("crate", { w: 24, h: 20, outline: "k" },
  rect(0, 0, 24, 20, "w"), box(0, 0, 24, 20, "W"), line(1, 1, 22, 18, "W"), line(22, 1, 1, 18, "W"),
  hline(0, 0, 24, "u"), rect(8, 8, 8, 4, "u"), hline(9, 9, 6, "a"))
sprite("gem_bowl", { outline: "k" }, `
  .gzgUg.
  sgUgzgs
  .sssss.`)
sprite("dust", `
  ..i.
  .ii.
  ii..`)
anim("lantern", { outline: "k", fps: 5 }, `
  ..A..
  .AAA.
  A.L.A
  AlLlA
  A.l.A
  .AAA.`,
  frame(), frame(grid(1, 2, "_L_\nlLL")), frame(grid(1, 2, "_l_\nLLl")))
sprite("sack", { outline: "k" }, `
  ..BB..
  .BCCB.
  BCCCCB
  BCBCCB
  BCCCCB
  .BBBB.`)
sprite("stool", { outline: "k" }, `
  wwwwwww
  uuuuuuu
  W.....W
  W.....W
  W.....W`)
sprite("mole", { outline: "k" }, `
  ..sss..
  .sSSSs.
  sSSkSSs
  sSSSSqs
  .sSSSs.
  ..S.S..`)

// ================================================================ 깜빡이는 빛
const wobble = (c, seed) => {
  const k = c.phase * Math.PI * 2
  return 0.55 * Math.sin(k + seed) + 0.3 * Math.sin(3 * k + seed * 2) + 0.15 * Math.sin(5 * k + seed * 3)
}
const flame_lamp = (name, r, power, color, seed) =>
  anim(name, { w: 1, h: 1, frames: 12, fps: 10 }, (c) => {
    const f = wobble(c, seed)
    c.lamp(0, 0, { r: r * (1 + 0.04 * f), power: power * (1 + 0.06 * f), color })
  })
flame_lamp("_fire_lamp", 86, 1.1, "#ffb27a", 0)
flame_lamp("_desk_lamp", 52, 1, "#ffd58a", 2)
flame_lamp("_floor_lamp", 44, 0.9, "#ffc878", 4)
anim("_ore_lamp", { w: 1, h: 1, frames: 24, fps: 8 }, (c) => {
  const f = 0.5 + 0.5 * Math.sin(c.phase * Math.PI * 2)          // 발광 광석 맥동
  c.lamp(0, 0, { r: 24 + 6 * f, power: 0.6 + 0.3 * f, color: "#8af0e0" })
})

// ================================================================ 장면
scene("office", { w: 256, h: 224, bg: "k", layers: true },
  layer("room",
    pattern("_log", 0, 0, 256, 60),
    rect(0, 60, 256, 24, "w"), hline(0, 60, 256, "u"), hline(0, 62, 256, "W"), hline(0, 80, 256, "u"), hline(0, 83, 256, "e"),
    stamp("floor", 0, FLOOR),
    shade([0, FLOOR, 256, 2]),
    rect(0, 0, 256, 6, "w"), hline(0, 0, 256, "u"), hline(0, 5, 256, "W"), hline(0, 6, 256, "e"),
    shade([0, 7, 256, 2], 1, 0.5)),

  layer("wall",
    stamp("window", 10, 8),
    stamp("ore_shelf", 66, 12),
    stamp("helmet_rack", 128, 10), stamp("notice", 130, 24), stamp("pick", 146, 24),
    stamp("hearth", 160, 8),
    stamp("portrait_old", 222, 12), stamp("map_board", 206, 40)),

  layer("rugs",
    stamp("rug", 70, 150)),

  layer("contact", { shade: true },
    rect(8, 94, 60, 3, "k"), rect(80, 130, 86, 4, "k"), ellipse(200, 108, 28, 3, "k"),
    rect(222, 196, 24, 3, "k"), ellipse(20, 204, 12, 3, "k"), rect(236, 160, 20, 3, "k"), ellipse(180, 198, 10, 2, "k")),

  layer("furniture",
    stamp("barrel", 4, 72), stamp("crate", 26, 78), stamp("gem_bowl", 34, 74),
    stamp("desk", 82, 100),
    stamp("chair", 116, 76),
    stamp("cart_model", 190, 96), stamp("dust", 212, 94),
    stamp("crate", 224, 180), stamp("barrel", 236, 138),
    stamp("mole", 170, 192),
    stamp("sack", 40, 196), stamp("sack", 48, 192), stamp("stool", 60, 180),
    stamp("lantern", 196, 150, { rdelay: true }),
    stamp("barrel", 8, 184)),

  layer("props",
    stamp("ledger", 92, 94), stamp("inkpot", 112, 96), stamp("stamp_seal", 120, 95),
    stamp("desk_lamp", 140, 85), stamp("coin_stack", 152, 94),
    stamp("_ore_glow", 42, 70), stamp("_ore_gold", 60, 74)),
)

// 조명 버전 — 벽난로 + 책상 램프 + 선반 발광 광석 + 창밖 달빛
scene("office_night", { w: 256, h: 224, bg: "k" },
  stamp("office", 0, 0),
  stamp("_fire_lamp", 187, 76),
  stamp("_desk_lamp", 144, 90, { rdelay: true }),
  stamp("_floor_lamp", 198, 153, { rdelay: true }),
  stamp("_ore_lamp", 92, 12), stamp("_ore_lamp", 86, 27, { rdelay: true }), stamp("_ore_lamp", 44, 72, { rdelay: true }),
  lamp(32, 30, { r: 34, color: "#b9c3ff", power: 0.7 }),                     // 창밖 달빛
  lamp(28, 20, { r: 8, color: "#ffe9a0", power: 0.5 }),                      // 산 위 등불
  lighting({ cell: 2, smooth: true, ambient: 0.36, ambientColor: "#8f8fd0", emit: "zYQgU" }),
  glow("zgG", { r: 7, strength: 0.4 }),
  glow("U", { r: 5, strength: 0.3 }),
  glow("Q", { r: 9, strength: 0.55 }),
  glow("lLah", { where: [176, 60, 26, 24], r: 14, strength: 0.55 }),        // 벽난로
  glow("L", { r: 5, strength: 0.7 }),
  glow("Y", { r: 3, strength: 0.8 }))

sheet("office_props", [
  "window", "ore_shelf", "hearth", "desk", "ledger", "inkpot", "desk_lamp", "coin_stack", "stamp_seal",
  "chair", "cart_model", "barrel", "map_board", "pick", "helmet_rack", "rug", "notice", "portrait_old", "crate", "gem_bowl", "dust", "mole", "lantern", "sack", "stool",
], { pad: 2 })
