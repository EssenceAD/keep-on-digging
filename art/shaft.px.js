// 「용사님, 채굴하실게요~」 갱도 장면 초안 — 비주얼 프로토타입 §4 기준(12×16 격자 일부 + 랜턴 + 광부 + 광차 + 광맥)
pal({
  k: "#1a1220", K: "#2b1f35",
  D: "#3a2a22", d: "#55402f", E: "#6e5440", e: "#8a6c52",      // 흙
  S: "#3d3a4c", s: "#5a5770", i: "#7c7a92", I: "#a3a2b6",      // 바위
  O: "#2a2634", o: "#3e3848",                                  // 단단한 바위
  W: "#5c3832", w: "#7d5040", u: "#9d6c50",                    // 갱목
  A: "#8a5a24", a: "#d39a3a", l: "#f5cf6a", L: "#fff4b8",      // 금, 랜턴
  c: "#b87a4a", C: "#e0a060",                                  // 구리
  n: "#9aa0b8", N: "#e8ecf8",                                  // 은
  Z: "#1f5a5a", G: "#2fa09a", g: "#6fe0d8", z: "#c8fff4",      // 발광 광석
  V: "#4a2a6a", v: "#8a4ab0", U: "#c98af0",                    // 보석
  R: "#7a2e48", r: "#b84a62", q: "#e07a88",
  F: "#46702e", f: "#6a9a3a", y: "#f2d16b", b: "#3d5a9a", x: "#f4ecd2",
})
ramps("kDdEe", "kSsiI", "kOo", "kWwu", "kAalL", "kZGgz", "kVvU")

const T = 16   // 칸 크기

// ================================================================ 타일 (노멀맵 포함)
const dirt = (seed) => sprite(`dirt_${seed}`, { w: T, h: T }, (c) => {
  const r = c.rng(seed)
  c.rect(0, 0, T, T, "d")
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * T), y = Math.floor(r() * T); c.px(x, y, r() < 0.5 ? "D" : "E") }
  for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 13), y = Math.floor(r() * 13); c.rect(x, y, 3, 2, "D"); c.hline(x, y, 3, "E") }   // 작은 돌
  c.bump("luma")
})
dirt(1); dirt(2); dirt(3)

sprite("rock", { w: T, h: T }, (c) => {
  const r = c.rng(9)
  c.rect(0, 0, T, T, "s")
  c.poly([0, 4, 6, 0, 16, 2, 16, 9, 10, 16, 0, 14], "i"); c.poly([2, 6, 7, 3, 13, 5, 12, 11, 5, 12], "I")
  c.hline(0, 15, 16, "S"); c.vline(15, 0, 16, "S"); c.px(3, 13, "S"); c.px(11, 14, "S"); c.px(14, 6, "S")
  c.bump("luma")
})
sprite("hard_rock", { w: T, h: T }, (c) => {
  c.rect(0, 0, T, T, "O"); c.poly([0, 5, 8, 0, 16, 4, 16, 12, 7, 16, 0, 12], "o"); c.px(4, 6, "s"); c.px(10, 3, "s"); c.px(12, 10, "s")
  c.box(0, 0, 16, 16, "k"); c.bump("luma")
})
const ore = (name, body, hi, hi2) => sprite(name, { w: T, h: T }, (c) => {
  c.rect(0, 0, T, T, "s"); c.poly([0, 4, 6, 0, 16, 2, 16, 9, 10, 16, 0, 14], "i")
  c.hline(0, 15, 16, "S"); c.vline(15, 0, 16, "S")
  for (const [x, y] of [[3, 4], [9, 3], [12, 9], [5, 11], [10, 13]]) { c.rect(x, y, 3, 2, body); c.px(x + 1, y, hi); c.px(x, y + 1, body) }
  c.px(4, 4, hi2); c.px(13, 9, hi2)
  c.bump("luma")
})
ore("ore_copper", "c", "C", "x"); ore("ore_gold", "a", "l", "L"); ore("ore_silver", "n", "N", "x")
anim("ore_glow", { w: T, h: T, frames: 12, fps: 6 }, (c) => {
  const f = 0.5 + 0.5 * Math.sin(c.phase * Math.PI * 2)
  c.rect(0, 0, T, T, "s"); c.poly([0, 4, 6, 0, 16, 2, 16, 9, 10, 16, 0, 14], "i"); c.hline(0, 15, 16, "S"); c.vline(15, 0, 16, "S")
  for (const [x, y] of [[3, 4], [10, 3], [12, 10], [5, 11]]) { c.rect(x, y, 3, 2, "G"); c.px(x + 1, y, f > 0.5 ? "z" : "g") }
  c.lamp(8, 8, { r: 16 + 10 * f, power: 0.5 + 0.4 * f, color: "#8af0e0" })
})
sprite("gem", { w: T, h: T }, (c) => {
  c.rect(0, 0, T, T, "s"); c.poly([0, 4, 6, 0, 16, 2, 16, 9, 10, 16, 0, 14], "i"); c.hline(0, 15, 16, "S"); c.vline(15, 0, 16, "S")
  c.poly([5, 8, 8, 4, 11, 8, 8, 12], "v"); c.px(8, 6, "U"); c.px(7, 8, "U"); c.poly([11, 10, 13, 8, 15, 10, 13, 13], "v"); c.px(13, 9, "U")
})
sprite("tunnel", { w: T, h: T }, (c) => {
  c.rect(0, 0, T, T, "k"); c.rect(0, 0, T, T, "D"); c.noise(0, 0, T, T, "K", 0.5, 1)
  c.hline(0, 15, 16, "k")
})
sprite("tunnel_beam", { w: T, h: T }, (c) => {
  c.rect(0, 0, T, T, "D"); c.noise(0, 0, T, T, "K", 0.5, 1)
  c.rect(0, 0, 3, 16, "w"); c.vline(0, 0, 16, "W"); c.rect(13, 0, 3, 16, "w"); c.vline(15, 0, 16, "u")
  c.rect(0, 0, 16, 3, "u"); c.hline(0, 2, 16, "W")
})
sprite("rail", { w: T, h: 4 }, (c) => { c.hline(0, 1, 16, "s"); c.hline(0, 3, 16, "s"); for (let x = 1; x < 16; x += 5) c.rect(x, 0, 2, 4, "W") })

// ================================================================ 소품
sprite("miner", { outline: "k" }, `
  ....aLa.
  ...aaaaa.
  ..dEEEEd.
  ..dxkxkd.
  ..dEEEEd.
  ..dwwwwd.
  ..wwwwwww
  .wrbrrrrw
  .wrbrrrrw
  ..rrrrrr.
  ..dd..dd.
  ..KK..KK.`)
sprite("pickaxe", { outline: "k" }, `
  ..ss..
  .siis.
  siWWis
  s.WW.s
  ..WW..
  ..WW..
  ..WW..`)
sprite("cart", { outline: "k", w: 20, h: 14 },
  rect(2, 3, 16, 8, "s"), rect(3, 4, 14, 6, "S"), hline(2, 3, 16, "i"), vline(2, 3, 8, "i"),
  circ(6, 12, 2, "K"), circ(14, 12, 2, "K"), px(6, 12, "I"), px(14, 12, "I"),
  rect(4, 1, 12, 3, "a"), px(6, 0, "L"), px(11, 0, "l"), px(9, 1, "L"), px(14, 1, "l"))
anim("lantern", { outline: "k", fps: 5 }, `
  ..A..
  .AAA.
  A.L.A
  AlLlA
  A.l.A
  .AAA.`,
  frame(), frame(grid(1, 2, "_L_\nlLL")), frame(grid(1, 2, "_l_\nLLl")))
sprite("support", { w: 6, h: 32 }, rect(0, 0, 6, 32, "w"), vline(0, 0, 32, "W"), vline(5, 0, 32, "u"), px(2, 4, "W"), px(3, 20, "W"))
sprite("stalactite", `
  iii
  .i.
  .s.
  .s.
  .S`)
sprite("mushroom", `
  .gz.
  Ggzg
  .ss.
  .ss.`)

// ================================================================ 깜빡이는 랜턴
const wobble = (c, seed) => { const k = c.phase * Math.PI * 2; return 0.55 * Math.sin(k + seed) + 0.3 * Math.sin(3 * k + seed * 2) + 0.15 * Math.sin(5 * k + seed * 3) }
const flame_lamp = (name, r, power, color, seed) =>
  anim(name, { w: 1, h: 1, frames: 12, fps: 10 }, (c) => { const f = wobble(c, seed); c.lamp(0, 0, { r: r * (1 + 0.04 * f), power: power * (1 + 0.06 * f), color }) })
flame_lamp("_lantern_lamp", 58, 1.1, "#ffc878", 1)
flame_lamp("_head_lamp", 26, 0.8, "#fff0b0", 3)

// ================================================================ 장면 (격자 12×12 = 192×192 + 지상 32)
const MAP = `
............
............
dddrddrdddrd
ddRdddRddddR
dCddrdddddrd
rdddCddrdddd
ddrdddGddddd
dddddrGGddrd
rddHdddGdddd
ddHHddrddddd
dddrdddAAdrd
ddddrdddAAdd`
const KEY = { d: "dirt_1", r: "rock", R: "hard_rock", C: "ore_copper", G: "ore_glow", H: "hard_rock", A: "ore_gold" }
const TUN = [[0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [4, 6], [5, 6], [5, 7]]   // 플레이어가 그린 갱도

scene("shaft", { w: 192, h: 192, bg: "k", layers: true },
  layer("sky", rect(0, 0, 192, 32, "b"), (c) => { for (let x = 0; x < 192; x += 7) c.px(x + (x % 3), 3 + (x % 11), "x") },
    rect(0, 24, 192, 8, "F"), hline(0, 24, 192, "f"), (c) => { for (let x = 2; x < 192; x += 9) c.vline(x, 21, 3, "f") }),
  layer("rock", tilemap(MAP, { map: KEY, seed: 4, variants: { d: ["dirt_1", "dirt_2", "dirt_3"] } })),
  layer("tunnel",
    ...TUN.map(([x, y]) => stamp(y % 3 === 0 ? "tunnel_beam" : "tunnel", x * T, y * T)),
    stamp("rail", 0, 44), stamp("rail", 16, 44), stamp("rail", 32, 44)),
  layer("contact", { shade: true }, ellipse(76, 110, 6, 2, "k"), ellipse(20, 46, 8, 2, "k")),
  layer("props",
    stamp("support", 36, 0), stamp("support", 150, 0),
    stamp("cart", 10, 34), stamp("miner", 70, 98), stamp("pickaxe", 79, 94),
    stamp("lantern", 50, 60, { rdelay: true }),
    stamp("stalactite", 100, 32), stamp("stalactite", 170, 32), stamp("mushroom", 96, 108), stamp("mushroom", 100, 109)),
)

scene("shaft_night", { w: 192, h: 192, bg: "k" },
  stamp("shaft", 0, 0),
  stamp("_lantern_lamp", 52, 63, { rdelay: true }),
  stamp("_head_lamp", 76, 98, { rdelay: true }),
  lamp(96, 10, { r: 60, color: "#a8b8ff", power: 0.9 }),                     // 하늘
  lighting({ cell: 2, smooth: true, ambient: 0.15, ambientColor: "#6a6aa0", emit: "zgLl" }),
  glow("zg", { r: 6, strength: 0.45 }),
  glow("L", { r: 5, strength: 0.7 }),
  glow("lL", { where: [48, 58, 10, 10], r: 8, strength: 0.5 }))

sheet("shaft_tiles", ["dirt_1", "dirt_2", "dirt_3", "rock", "hard_rock", "ore_copper", "ore_gold", "ore_silver", "ore_glow", "gem", "tunnel", "tunnel_beam", "rail"], { pad: 1 })
sheet("shaft_props", ["miner", "pickaxe", "cart", "lantern", "support", "stalactite", "mushroom"], { pad: 2 })

// ================================================================ keep-on-digging 추가 (Code) — 같은 팔레트·문법
pal({ "1": "#c4522a", "2": "#8a3420", "3": "#e07a3a" })   // 붉은 수염 (mine_miners3 첫째 광부)

// (빈 광차는 v0.5부터 art/chars.px.js 광차를 쓴다)

// 붉은 수염 광부: 위 "miner" 그림에 수염·구레나룻을 붉게, 멜빵 갈색 + 곡괭이 휘두르기 4프레임
const MINER_RED = `
  ....aLa.
  ...aaaaa.
  ..2EEEE2.
  ..2xkxk2.
  ..2EEEE2.
  ..2111132
  ..1111111
  .xW1WWWWx
  .xWWWWWWx
  ..WWWWWW.
  ..dd..dd.
  ..KK..KK.`
const SWING = [-150, -100, -10, -50]   // 들기 · 정점 · 내려찍기 · 회수 (도, 0 = 오른쪽)
anim("miner_red", { outline: "k", w: 18, h: 13, frames: 4, fps: 8 }, (c) => {   // 곡괭이를 먼저 그려 몸 뒤로
  const a = (SWING[c.frame] * Math.PI) / 180, hx = 8, hy = 8
  const ex = Math.round(hx + Math.cos(a) * 7), ey = Math.round(hy + Math.sin(a) * 7)
  c.line(hx, hy, ex, ey, "W")
  const nx = -Math.sin(a), ny = Math.cos(a)
  c.line(Math.round(ex - nx * 3), Math.round(ey - ny * 3), Math.round(ex + nx * 3), Math.round(ey + ny * 3), "i")
  c.px(Math.round(ex + nx * 3), Math.round(ey + ny * 3), "I")
}, MINER_RED, rect(8, 7, 2, 2, "E"))

// 금 쉬머: 따뜻한 반짝임이 금 알갱이 위를 쓸고 지나간다 (조명 받는 겹에 얹음)
anim("gold_shimmer", { w: T, h: T, frames: 12, fps: 12 }, (c) => {
  c.stamp("ore_gold", 0, 0)
  const band = c.phase * 40 - 8
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = Math.abs(x + y - band)
    c.px(x, y, c.is(x, y, "alL") && d < 1.5 ? (d < 0.6 ? "x" : "L") : "_")
  }
})

// 광부 머리 위 말풍선 (§5-1-3: 갱도 안에는 초상 대신 pxl 스프라이트만) — 캐는 중 · 걷는 중 · 쉬는 중
const BUBBLE = `
  .kkkkkkkk.
  kxxxxxxxxk
  kxxxxxxxxk
  kxxxxxxxxk
  kxxxxxxxxk
  kxxxxxxxxk
  .kkkxkkkk.
  ...kk.....`
sprite("bubble_dig", BUBBLE, grid(3, 1, `
  .iii.
  i.W.i
  ..W..
  ..W..`))
sprite("bubble_walk", BUBBLE, grid(2, 2, `
  .a..a
  aaaaa
  .a..a`))
sprite("bubble_rest", BUBBLE, grid(3, 1, `
  bbb.
  ..b.
  .b..
  bbb.`))

// ================================================================ 명세2 (핵심 루프) 추가 — Code
// 칸: 고대석 · 지하수 주머니 · 가스 주머니 · 유물 상자 · 동굴(빈 공간)
sprite("ancient", { w: T, h: T },
  rect(0, 0, T, T, "O"), box(0, 0, T, T, "k"), hline(1, 1, 14, "o"), vline(1, 1, 14, "o"),
  box(3, 3, 10, 10, "k"), hline(4, 4, 8, "s"), vline(4, 4, 8, "s"),
  vline(8, 5, 6, "k"), line(6, 6, 8, 8, "k"), line(10, 6, 8, 8, "k"), px(8, 11, "a"), px(8, 4, "A"),
  bump("bevel", { w: 2, depth: 1.2 }))
sprite("pocket_water", { w: T, h: T },
  stamp("rock", 0, 0), ellipse(8, 9, 5, 4, "k"), ellipse(8, 9, 4, 3, "b"), hline(5, 7, 5, "x"), px(10, 10, "x"), px(6, 11, "x"))
sprite("pocket_gas", { w: T, h: T },
  stamp("rock", 0, 0), ellipse(8, 9, 5, 4, "k"), ellipse(8, 9, 4, 3, "F"), circ(6, 8, 1, "f"), circ(10, 10, 1, "f"), px(9, 7, "y"))
sprite("relic_chest", { w: T, h: T },
  stamp("dirt_2", 0, 0), rect(3, 6, 10, 7, "k"), rect(4, 7, 8, 5, "w"), hline(4, 7, 8, "u"), hline(4, 9, 8, "A"),
  rect(7, 8, 2, 3, "a"), px(7, 8, "l"), hline(3, 13, 10, "D"))
sprite("cave", { w: T, h: T },
  rect(0, 0, T, T, "O"), ellipse(8, 9, 7, 6, "k"), poly([3, 3, 5, 3, 4, 7], "o"), poly([10, 3, 13, 3, 12, 6], "o"), hline(2, 15, 12, "o"))
// 갱도 소품: 사다리(세로로 판 칸) · 못 뚫는 칸 빨간 X · 흩어진 광석 조각 · 기절 별
sprite("ladder", { w: T, h: T },
  vline(3, 0, T, "W"), vline(12, 0, T, "W"), vline(4, 0, T, "u"), vline(13, 0, T, "u"),
  ...[2, 7, 12].flatMap((y) => [hline(3, y, 11, "w"), hline(3, y + 1, 11, "W")]))
sprite("mark_x", { outline: "k" }, `
  rr.....rr
  .rr...rr.
  ..rr.rr..
  ...rrr...
  ..rr.rr..
  .rr...rr.
  rr.....rr`)
sprite("ore_bits", `
  ...a.
  .aal.
  aAaaA`)
sprite("star", ".l.\nlLl\n.l.")
// 갱도 몬스터(이번 단계: 길만 막음) — 동굴 슬라임 2f
anim("slime", { outline: "k", fps: 4 }, `
  ...ffff...
  ..fvvvvf..
  .fvvkvkvf.
  .fvvvvvvf.
  ffffffffff`,
  frame(), frame(grid(0, 0, "..........\n...ffff...\n..fvvvvf..\n.fvvkvkvf.\nffffffffff")))
