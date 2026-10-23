// 「용사님, 채굴하실게요~」 비주얼 프로토타입 아트 — 기준 그림: pxl no_magic_night
// 한 팔레트: 흙 갈색 · 바위 회보라 · 금 주황 · 발광 청록 · 랜턴 따뜻한 주황.
// 타일은 16×16, bump()로 노멀맵(<name>_n.png)까지 같이 나온다. 게임(PixiJS)은 이 PNG를 쓴다.
// "mine_night"는 pxl이 구운 기준 컷(랜턴 2 + lighting ambient 0.3 + glow): 런타임 조명이 맞춰 갈 목표.
pal({
  k: "#140f18", K: "#251b28",                                  // ink, deep shadow
  n: "#3a2620", d: "#5c3d2a", D: "#7d5636", t: "#a07a4c",      // dirt (뒷산 흙)
  r: "#36304a", s: "#524c68", S: "#736c8c", R: "#9c95b2",      // rock (회보라)
  F: "#3a3248", G: "#4e4662",                                  // far cave wall
  a: "#34433f", A: "#536a62", e: "#7a948a",                    // ancient dwarf stone
  y: "#7a4416", Y: "#c47a22", l: "#f0b03c", L: "#fff0a8",      // gold (금 주황)
  c: "#14524f", C: "#2db4a2", z: "#7cffe0", Z: "#e4fff8",      // glow ore (발광 청록)
  w: "#ff8a2a", W: "#fff0c0",                                  // lantern flame (따뜻한 주황)
  b: "#2e1c14", B: "#563420", u: "#86552e", U: "#b07a44",      // timber
  i: "#3e3e4e", I: "#6e6e82", j: "#a8a8bc",                    // iron
  p: "#16283e", P: "#244a70", v: "#5a94c8",                    // water
  N: "#0e0f26", m: "#25214a", "6": "#5c2e56", "5": "#b4523c", "4": "#ec9648",   // dusk sky
  "3": "#2c1a2e", "2": "#3e2430",                              // far ridges
  h: "#e2a47c", H: "#a8684a", E: "#4a6a9c", x: "#2e4470",      // miner placeholder (skin, blue clothes)
  "8": "#8e2e2c", "7": "#c4523c",                              // cart / roof paint
  q: "#fff8e8",                                                // stars
})
ramps("kndDt", "krsSR", "kFG", "kaAe", "kyYlL", "kcCzZ", "kbBuU", "kiIj", "kpPv", "kNm6", "k87")

const T = 16
// wrap-around drawing so tiles repeat without seams
const wrap = (fn) => { for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) fn(ox, oy) }

// ================================================================ tiles (each with a normal map)
// dirt: granular, a few clods lit from above and two pebbles
for (const [i, seed] of [[1, 3], [2, 11]])
  sprite("dirt_" + i, { w: T, h: T },
    rect(0, 0, T, T, "d"),
    (c) => {
      const r = c.rng(seed)
      for (let k = 0; k < 6; k++) {
        const x = Math.floor(r() * T), y = Math.floor(r() * T)
        wrap((ox, oy) => { c.hline(x + ox, y + oy, 3, "D"); c.hline(x + ox + 1, y + oy + 1, 3, "n") })
      }
      for (let k = 0; k < 2; k++) {
        const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12)
        c.rect(x, y, 2, 2, "s"); c.px(x, y, "S"); c.hline(x, y + 2, 2, "n")
      }
    },
    noise(0, 0, T, T, "n", 0.06, seed), noise(0, 0, T, T, "t", 0.02, seed + 5),
    bump("luma", { depth: 0.8 }))

// rock: cobbles, each with a dark rim and a lit top edge, domed in the normal map
const cobbles = (seed, n, body, hi, rim) => (c) => {
  const r = c.rng(seed)
  for (let k = 0; k < n; k++) {
    const x = Math.floor(r() * T), y = Math.floor(r() * T), rx = 3 + Math.floor(r() * 3), ry = 2 + Math.floor(r() * 2)
    wrap((ox, oy) => {
      c.ellipse(x + ox, y + oy, rx + 1, ry + 1, rim)
      c.ellipse(x + ox, y + oy, rx, ry, body)
      c.hline(x + ox - rx + 2, y + oy - ry, rx, hi)
    })
  }
}
for (const [i, seed] of [[1, 5], [2, 9]])
  sprite("rock_" + i, { w: T, h: T },
    rect(0, 0, T, T, "r"), cobbles(seed, 7, "s", "S", "r"),
    bump("dome", { on: "sS", depth: 1.2 }))

// hard rock: big angular plates, a crack, bevelled
sprite("hard_rock", { w: T, h: T },
  rect(0, 0, T, T, "r"),
  (c) => wrap((ox, oy) => {
    c.poly([0 + ox, 1 + oy, 9 + ox, 0 + oy, 8 + ox, 7 + oy, 1 + ox, 8 + oy], "s")
    c.poly([10 + ox, 0 + oy, 16 + ox, 2 + oy, 15 + ox, 10 + oy, 9 + ox, 8 + oy], "s")
    c.poly([1 + ox, 9 + oy, 9 + ox, 9 + oy, 12 + ox, 16 + oy, 0 + ox, 16 + oy], "s")
    c.hline(1 + ox, 1 + oy, 7, "S"); c.hline(11 + ox, 1 + oy, 4, "S"); c.hline(2 + ox, 10 + oy, 6, "S")
    c.px(1 + ox, 1 + oy, "R"); c.px(11 + ox, 1 + oy, "R")
  }),
  line(9, 8, 13, 13, "k"), px(14, 13, "k"),
  bump("bevel", { on: "sSR", w: 2, depth: 1.4 }))

// ancient dwarf stone: one carved block, a rune with gold inlay
sprite("ancient", { w: T, h: T },
  rect(0, 0, T, T, "a"), hline(0, 0, T, "A"), vline(0, 0, T, "A"), hline(0, 15, T, "k"), vline(15, 0, T, "k"),
  box(3, 3, 10, 10, "k"), hline(4, 4, 8, "A"), vline(4, 4, 8, "A"),
  vline(8, 5, 6, "k"), line(6, 6, 8, 8, "k"), line(10, 6, 8, 8, "k"), px(8, 11, "Y"), px(8, 4, "y"),
  px(1, 1, "e"),
  bump("bevel", { w: 2, depth: 1.2 }))

// still underground water
sprite("water", { w: T, h: T },
  rect(0, 0, T, T, "p"), hline(0, 0, T, "v"), hline(2, 4, 5, "P"), hline(9, 7, 6, "P"), hline(1, 11, 4, "P"),
  hline(10, 13, 4, "P"), px(4, 4, "v"), px(13, 7, "v"))

// gold ore: rock with fat nuggets
const nuggets = [[4, 4, 3, 2], [11, 6, 2, 2], [6, 11, 3, 2], [12, 12, 2, 1], [2, 8, 1, 1]]
sprite("gold_ore", { w: T, h: T },
  stamp("rock_1", 0, 0),
  ...nuggets.flatMap(([x, y, rx, ry]) => [
    ellipse(x, y + 1, rx + 1, ry + 1, "k"), ellipse(x, y, rx, ry, "Y"), hline(x - rx + 1, y - ry, rx, "l"), px(x - rx + 1, y - ry, "L"),
    hline(x - rx + 1, y + ry, rx * 2 - 1, "y")]),
  bump("dome", { on: "yYlL", depth: 1.4 }))
// shimmer: a warm glint sweeps across the gold every second or so (drawn over the lit tile)
anim("gold_shimmer", { w: T, h: T, frames: 12, fps: 12 }, (c) => {
  c.stamp("gold_ore", 0, 0)
  const band = c.phase * 40 - 8
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const on = c.is(x, y, "YlL") && Math.abs(x + y - band) < 1.5
    c.px(x, y, on ? (Math.abs(x + y - band) < 0.6 ? "W" : "L") : "_")
  }
})

// glow ore: rock with dark crystal sockets; the crystals themselves are an emissive overlay that pulses
const crystals = [[3, 3, 5], [10, 2, 4], [7, 8, 6], [12, 10, 4], [3, 12, 3]]
const crystal = (c, x, y, h, body, hi, tip) => {
  for (let k = 0; k < h; k++) { const wd = k < 2 ? k : (k > h - 2 ? h - 1 - k : 1); c.hline(x - wd, y + k, wd * 2 + 1, body) }
  c.vline(x, y + 1, h - 2, hi); c.px(x, y, tip)
}
sprite("glow_rock", { w: T, h: T },
  stamp("rock_2", 0, 0),
  (c) => { for (const [x, y, h] of crystals) { c.ellipse(x, y + h - 1, 2, 1, "k"); c.ellipse(x, y + h - 1, 1, 0, "c") } },
  bump("dome", { on: "sS", depth: 1.2 }))
anim("glow_crystals", { w: T, h: T, frames: 12, fps: 8 }, (c) => {
  const k = Math.sin(c.phase * Math.PI * 2)
  crystals.forEach(([x, y, h], n) => crystal(c, x, y, h, "C", (k + n * 0.3) % 2 > 0.2 ? "z" : "C", k > -0.3 ? "Z" : "z"))
})
anim("glow_ore", { w: T, h: T, frames: 12, fps: 8 }, stamp("glow_rock", 0, 0), stamp("glow_crystals", 0, 0))

// timber support frame (stands in a dug tile)
sprite("timber", { w: T, h: T },
  rect(1, 2, 3, 14, "B"), vline(1, 2, 14, "u"), rect(12, 2, 3, 14, "B"), vline(12, 2, 14, "u"),
  rect(0, 0, T, 3, "u"), hline(0, 0, T, "U"), hline(0, 3, T, "b"), px(2, 1, "i"), px(13, 1, "i"),
  hline(1, 15, 3, "b"), hline(12, 15, 3, "b"),
  bump("bevel", { w: 1, depth: 1 }))

// rails along a tunnel floor
sprite("rails", { w: T, h: 4 },
  rect(1, 2, 4, 2, "B"), rect(9, 2, 4, 2, "B"), hline(1, 2, 4, "u"), hline(9, 2, 4, "u"),
  hline(0, 1, T, "I"), hline(0, 2, T, "i"))

// ================================================================ parallax layers
// far cave wall (0.2): dim cobbles, seamless 128×128
sprite("far_wall", { w: 128, h: 128 },
  rect(0, 0, 128, 128, "F"),
  (c) => {
    const r = c.rng(21), W = 128
    for (let k = 0; k < 90; k++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * W), rx = 3 + Math.floor(r() * 5), ry = 2 + Math.floor(r() * 3)
      for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) {
        c.ellipse(x + ox, y + oy, rx + 1, ry + 1, "K"); c.ellipse(x + ox, y + oy, rx, ry, "F")
        c.hline(x + ox - rx + 2, y + oy - ry, rx, "G")
      }
    }
  })
// middle pillars (0.5): old timbering and a rock column, silhouettes
sprite("mid_pillars", { w: 256, h: 128 },
  (c) => {
    for (const x of [30, 150]) {
      c.rect(x, 0, 6, 128, "b"); c.vline(x, 0, 128, "B"); c.rect(x + 46, 0, 6, 128, "b"); c.vline(x + 46, 0, 128, "B")
      for (let y = 10; y < 128; y += 40) { c.rect(x, y, 52, 4, "b"); c.hline(x, y, 52, "B"); c.line(x + 6, y + 4, x + 46, y + 36, "b", 2) }
    }
    c.poly([110, 0, 126, 0, 122, 40, 128, 80, 120, 128, 104, 128, 110, 80, 106, 40], "K")
    c.vline(111, 0, 128, "G")
  })
// foreground (1.3): out-of-focus stalactites and a rock lump, near-black
sprite("fg_rocks", { w: 256, h: 256 },
  (c) => {
    const drip = (x, len, w) => { c.poly([x - w, 0, x + w, 0, x, len], "k"); c.line(x - w + 1, 0, x, len - 1, "K") }
    drip(30, 26, 6); drip(42, 14, 4); drip(52, 34, 5); drip(180, 22, 5); drip(192, 38, 7); drip(205, 12, 3)
    c.poly([110, 256, 116, 232, 128, 224, 150, 226, 160, 240, 166, 256], "k"); c.hline(118, 230, 20, "K")
  })

// ================================================================ props
sprite("_lantern_body", `
  ..iii..
  .i...i.
  ..iii..
  .IIjII.
  .I...I.
  .I...I.
  .I...I.
  .iIIIi.
  ..iii..`)
anim("lantern", { outline: "k", fps: 8, w: 7, h: 9 },
  stamp("_lantern_body", 0, 0), grid(2, 4, "lWl\nwWw\nlwl"),
  lamp(3, 5, { r: 70, color: "#ffb070", power: 1.1 }),
  frame(), frame(grid(2, 4, "lwW\nwWw\nlwl")), frame(grid(2, 4, "lWl\nwWW\nlwl")), frame(grid(2, 4, "Wwl\nwWw\nlwl")))
sprite("wall_lamp", { outline: "k" }, `
  .......iii.
  ......i...i
  .......iii.
  ......IIjII
  ......IlWlI
  ......IwWwI
  ......IlwlI
  iiiiiiiIIIi
  i......iii.
  i..........`,
  lamp(8, 5, { r: 54, color: "#ffc080", power: 1 }))

// miner placeholder (얼굴은 나중에 GPT 그림으로): helmet with headlamp, pickaxe swing in 4 frames
const MINER = `
  ......................
  ........YYYY..........
  .......YlllYY.........
  ......YYYYYYYW........
  .......hhhhh..........
  .......hhkhh..........
  .......hhhhH..........
  ......EEEEEE..........
  .....EExEEEE..........
  .....EExEEEE..........
  .....EExEEEE..........
  .....bbbbbbb..........
  ......EEEEE...........
  ......xx..xx..........
  ......xx..xx..........
  ......kkk.kkk.........`
const SWING = [-150, -100, -10, -50]   // windup, top, strike, recover (degrees, 0 = right)
anim("miner", { outline: "k", w: 22, h: 18, frames: 4, fps: 8 },
  MINER,
  (c) => {
    const a = (SWING[c.frame] * Math.PI) / 180, hx = 11, hy = 9
    const ex = Math.round(hx + Math.cos(a) * 8), ey = Math.round(hy + Math.sin(a) * 8)
    c.line(hx, hy, ex, ey, "u")
    const nx = -Math.sin(a), ny = Math.cos(a)
    c.line(Math.round(ex - nx * 3), Math.round(ey - ny * 3), Math.round(ex + nx * 3), Math.round(ey + ny * 3), "I")
    c.px(Math.round(ex + nx * 3), Math.round(ey + ny * 3), "j")
    c.rect(10, 8, 2, 2, "h")
  })

// minecart, empty and loaded
const cartBody = (c) => {
  c.poly([0, 2, 22, 2, 19, 11, 3, 11], "i"); c.hline(0, 2, 22, "j"); c.hline(1, 3, 20, "I")
  c.rect(3, 6, 16, 2, "8"); c.hline(3, 6, 16, "7")
  c.px(4, 4, "j"); c.px(17, 4, "j"); c.px(4, 9, "I"); c.px(17, 9, "I")
  c.circ(6, 12, 2, "k"); c.circ(16, 12, 2, "k"); c.px(6, 12, "I"); c.px(16, 12, "I")
}
sprite("cart", { w: 22, h: 15, outline: "k" }, cartBody)
sprite("cart_full", { w: 22, h: 15, outline: "k" },
  clip([0, 0, 22, 3], ellipse(11, 3, 9, 3, "Y")), hline(4, 1, 6, "l"), px(13, 1, "L"), px(7, 0, "l"), px(15, 2, "y"),
  cartBody)

// ore pickup icons for the HUD
sprite("icon_gold", { outline: "k" }, `
  ..lLl.
  .lYYll
  YYYlYY
  yYYYYy
  .yyyy.`)
sprite("icon_glow", { outline: "k" }, `
  ..Z..
  .zCz.
  .zCC.
  CCzCC
  .CCC.
  ..c..`)

// ================================================================ surface (baked: dusk at the back hill)
const SW = 576, SH = 48, SHAFT_X = 232   // the plot starts at world x 192; shaft = column 2
sprite("_pine", { mx: "c" }, `
  ...3
  ...3
  ..33
  ..33
  .333
  .333
  3333
  ...3`)
scene("surface", { w: SW, h: SH, bg: "N" },
  layer("sky", { unlit: true },
    grad(0, 0, SW, 40, "Nm654", "v", 0.7),
    (c) => { const r = c.rng(4); for (let k = 0; k < 26; k++) c.px(Math.floor(r() * SW), Math.floor(r() * 12), "q") },
    poly([0, 40, 0, 28, 40, 22, 90, 27, 140, 18, 210, 26, 270, 16, 330, 24, 400, 19, 448, 25, 500, 17, 576, 23, 576, 40], "3"),
    scatter("_pine", 0, 22, SW, 14, 30, { on: "3", seed: 6 }),
    poly([0, 40, 0, 34, 60, 31, 120, 35, 200, 30, 280, 34, 360, 29, 448, 33, 520, 30, 576, 34, 576, 40], "2")),
  layer("ground", { solid: true },
    rect(0, 40, SW, 8, "d"), hline(0, 40, SW, "t"), hline(0, 41, SW, "D"), noise(0, 42, SW, 6, "n", 0.12, 2),
    rect(SHAFT_X - 8, 40, 16, 8, "_")),                                         // the shaft mouth
  layer("headframe",
    line(SHAFT_X - 12, 40, SHAFT_X - 1, 10, "B", 2), line(SHAFT_X + 12, 40, SHAFT_X + 1, 10, "B", 2),
    hline(SHAFT_X - 9, 30, 19, "u"), hline(SHAFT_X - 6, 21, 13, "u"),
    line(SHAFT_X - 9, 30, SHAFT_X + 6, 21, "b"),
    ring(SHAFT_X, 9, 4, "I"), px(SHAFT_X, 9, "j"), vline(SHAFT_X + 4, 9, 39, "i"),
    rect(SHAFT_X - 10, 39, 21, 2, "u"), hline(SHAFT_X - 10, 39, 21, "U")),
  layer("rails", (c) => { for (let x = SHAFT_X + 12; x < 436; x += 6) c.rect(x, 39, 3, 1, "B"); c.hline(SHAFT_X + 10, 38, 436 - SHAFT_X - 10, "I") }),
  layer("shed", { x: 64 },
    rect(372, 18, 56, 22, "B"), (c) => { for (let x = 375; x < 428; x += 5) c.vline(x, 18, 22, "b") },
    poly([366, 19, 400, 6, 434, 19], "8"), line(366, 19, 400, 6, "7"), line(400, 6, 434, 19, "7"),
    rect(380, 26, 14, 14, "b"), box(380, 26, 14, 14, "u"),                        // big door
    rect(404, 24, 10, 8, "l"), rect(405, 25, 8, 6, "W"), vline(408, 24, 8, "b"), hline(404, 28, 10, "b"), box(403, 23, 12, 10, "u"),
    rect(384, 12, 32, 6, "u"), hline(384, 12, 32, "U"), text(400, 13, "ORE", "b", { align: "c" }),
    lamp(409, 28, { r: 60, color: "#ffc070", power: 1 })),
  layer("post", vline(300, 26, 14, "B"), hline(298, 26, 5, "u"), stamp("lantern", 299, 27)),
  lighting({ cell: 2, smooth: true, ambient: 0.6, ambientColor: "#c88a7a", emit: "lLWwq" }),
  glow("lWw", { r: 6, strength: 0.45 }),
  glow("q", { r: 2, strength: 0.4 }))

// ================================================================ the baked reference shot (pxl lighting)
// 12×16 plot. . tunnel  T tunnel+timber  o cave  d dirt  r rock  h hard rock  a ancient  w water  g gold  c glow
const MAP = [
  "ddTddddddddd",
  "dd.ddrddddrd",
  "dr.ddrrddddd",
  "rd.rddddwwdr",
  "rr.....Tdwdr",
  "hrrrdrr.rdrh",
  "hrhrrrd.rrhh",
  "hhrrcrr.rrrh",
  "hrrccc..ggrr",
  "ahrrcrrhggrh",
  "aahrrhoohggg",
  "aahhhooohggg",
  "aaahhhhhgggh",
  "aaaahhhhhghh",
  "waaaahhhhhhh",
  "aaaaaahhhhhh",
]
group("dirt", ["dirt_1", "dirt_2"]); group("rock", ["rock_1", "rock_2"])
const SOLID = { d: "dirt", r: "rock", h: "hard_rock", a: "ancient", w: "water", g: "gold_ore", c: "glow_ore" }
const OX = 32, OY = 16   // where the plot sits in the 256×224 shot (2 bedrock columns either side)
const rowsShown = 13
const solidMap = Array.from({ length: rowsShown }, (_, y) =>
  "hh" + MAP[y].split("").map((ch) => (SOLID[ch] ? ch : ".")).join("") + "hh").join("\n")
const dugCells = []
MAP.slice(0, rowsShown).forEach((row, y) => row.split("").forEach((ch, x) => { if (!SOLID[ch]) dugCells.push([x, y, ch]) }))

scene("mine_night", { w: 256, h: 224, bg: "k" },
  stamp("surface", OX - 192, -32),
  layer("far", { wall: true }, clip((x, y) => y >= OY, pattern("far_wall", 0, 0, 256, 224))),
  layer("mid", { wall: true }, clip((x, y) => y >= OY, stamp("mid_pillars", 40, OY + 40))),
  layer("tiles", { solid: true },
    tilemap(solidMap, { size: T, x: 0, y: OY, map: SOLID }),
    rect(0, OY, OX, 224, "_"), tile("hard_rock", 0, OY, 2, 13), tile("hard_rock", 224, OY, 2, 13),
    (c) => {                                                                   // exposed edges: lit lips on top, ink below
      for (const [x, y] of dugCells) {
        const px0 = OX + x * T, py0 = OY + y * T
        const solidAt = (cx, cy) => cx < 0 || cx > 11 || cy < 0 ? cy >= 0 : !!SOLID[MAP[cy]?.[cx] ?? "h"]
        if (solidAt(x, y + 1)) { c.hline(px0, py0 + T, T, "t"); c.hline(px0, py0 + T + 1, T, "D") }
        if (solidAt(x, y - 1) && y > 0) c.hline(px0, py0 - 1, T, "k")
        if (solidAt(x - 1, y)) c.vline(px0 - 1, py0, T, "k")
        if (solidAt(x + 1, y)) c.vline(px0 + T, py0, T, "K")
      }
    }),
  layer("props",
    ...dugCells.filter(([, , ch]) => ch === "T").map(([x, y]) => stamp("timber", OX + x * T, OY + y * T)),
    ...[2, 3, 4, 5, 6].map((x) => stamp("rails", OX + x * T, OY + 4 * T + 12)),
    ...[7, 8].map((x) => stamp("rails", OX + x * T, OY + 8 * T + 12)),
    stamp("cart_full", OX + 4 * T - 2, OY + 4 * T + 1),
    stamp("miner", OX + 8 * T - 4, OY + 8 * T - 2),
    stamp("wall_lamp", OX + 2 * T + 2, OY + 4 * T + 1),
    stamp("wall_lamp", OX + 7 * T, OY + 7 * T + 2),
    stamp("lantern", OX + 6 * T + 4, OY + 4 * T + 2)),
  lamp(OX + 4 * T + 8, OY + 8 * T + 8, { r: 40, color: "#5cf0e0", power: 0.9 }),     // the glow ore lights itself
  lamp(OX + 9 * T, OY + 8 * T + 6, { r: 16, color: "#ffe9a0", power: 0.8 }),        // headlamp on the vein
  lighting({ cell: 2, smooth: true, ambient: 0.3, ambientColor: "#7a6aa0", block: 0.45, emit: "zZCWwq" }),
  glow("zZC", { r: 7, strength: 0.4 }),
  glow("W", { r: 6, strength: 0.6 }),
  glow("lL", { where: [OX + 8 * T, OY + 8 * T, 4 * T, 6 * T], r: 4, strength: 0.25 }))

sheet("mine_tiles", ["dirt_*", "rock_*", "hard_rock", "ancient", "water", "gold_ore", "glow_rock", "timber", "rails"], { pad: 0 })
