// 돌망치 상회 — 지상 부지 장면 (pxl 조립 v2: 유기적 길·개울·터, 겹친 수풀). 타일·소품은 tiles.px.js(GPT 시트 변환)
include("./tiles.px.js")
pal({ Y: "#f5cf6a" })

const INK = "#1a1220"
const SKY = "#6f8fd0", SKY2 = "#9cc0e8", MTN = "#3d5a9a", MTN2 = "#2e4578", CLOUD = "#f4ecd2"
const DIRT = "#c98a4c", DIRT_D = "#a86f3a", DIRT_L = "#e0a862", DIRT_K = "#7a4f2a"      // 흙길
const LOT = "#b9834a", LOT_D = "#9a6a3c", LOT_L = "#d19a5c"                            // 빈 터
const WATER = "#2f7fd6", WATER_D = "#1f5ea8", WATER_L = "#79c3ff", FOAM = "#e8f6ff", SAND = "#e6cc8a"
const GRASS_D = "#3f7a2a", GRASS_K = "#2c5a22"

group("grass", ["t_0_0", "t_0_0", "t_0_0", "t_0_1", "t_0_2", "t_0_3", "t_0_0"])
group("pine", ["pine_a", "pine_b"])
group("flowers", ["flower_white", "flower_yellow", "flower_blue", "flower_pink"])
group("bushes", ["bush_white", "bush_pink", "bush_orange"])
group("rocks", ["rock_small", "rock_small", "rock_mid"])

// ---------------------------------------------------------------- 길 (구불구불한 중심선 → 두께 있는 흙띠)
// 다리(0,118) → 완만한 S자 → 갱도 입구(352,112). 위/아래 터로 가는 샛길 2개.
const ROAD = [[0, 120], [30, 122], [70, 126], [110, 124], [150, 118], [190, 116], [230, 120], [270, 124], [305, 120], [335, 114], [352, 110]]
const SIDE1 = [[112, 124], [120, 108], [140, 96]]        // 위 터 쪽 샛길
const SIDE2 = [[250, 122], [240, 140], [232, 152]]       // 아래 터 쪽 샛길
const road = (c, pts, w, col) => { for (let i = 0; i < pts.length - 1; i++) { c.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w); c.circ(pts[i][0], pts[i][1], Math.floor(w / 2), col) } c.circ(pts[pts.length - 1][0], pts[pts.length - 1][1], Math.floor(w / 2), col) }

sprite("_road", { w: 384, h: 224 }, (c) => {
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 22 : 12, GRASS_K)     // 풀 그림자 테두리
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 20 : 10, DIRT_D)
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 16 : 7, DIRT)
  const r = c.rng(3); for (let i = 0; i < 70; i++) { const t = r(), seg = Math.floor(t * (ROAD.length - 1)), f = t * (ROAD.length - 1) - seg
    const x = Math.round(ROAD[seg][0] + (ROAD[seg + 1][0] - ROAD[seg][0]) * f + (r() - 0.5) * 12), y = Math.round(ROAD[seg][1] + (ROAD[seg + 1][1] - ROAD[seg][1]) * f + (r() - 0.5) * 12)
    c.px(x, y, r() < 0.5 ? DIRT_K : DIRT_L) }                                              // 자갈 점
})
// 길 바깥의 noise 가 풀을 더럽히지 않게: 길 마스크로 clip
sprite("_road_masked", { w: 384, h: 224 }, (c) => { c.stamp("_road", 0, 0) })

// ---------------------------------------------------------------- 개울 (왼쪽, 구불구불) + 다리
const STREAM = [[14, 48], [10, 70], [18, 95], [12, 120], [8, 150], [16, 180], [10, 224]]
sprite("_stream", { w: 384, h: 224 }, (c) => {
  road(c, STREAM, 30, SAND); road(c, STREAM, 26, WATER_D); road(c, STREAM, 20, WATER)
  const r = c.rng(5); for (let i = 0; i < 40; i++) { const y = 48 + Math.floor(r() * 176), x = 6 + Math.floor(r() * 16); c.hline(x, y, 2 + Math.floor(r() * 3), WATER_L) }
  for (let i = 0; i < 10; i++) { const y = 48 + Math.floor(r() * 176); c.px(4 + Math.floor(r() * 18), y, FOAM) }
})
anim("_ripple", { w: 40, h: 224, frames: 4, fps: 3 }, (c) => { const r = c.rng(11 + c.frame); for (let i = 0; i < 18; i++) { const y = 50 + Math.floor(r() * 170), x = 4 + Math.floor(r() * 20); c.hline(x, y, 3, WATER_L) } })
sprite("_bridge", { w: 40, h: 22 }, (c) => {
  c.rect(0, 4, 40, 12, "#7d5040"); for (let x = 0; x < 40; x += 5) c.vline(x, 4, 12, "#5c3832"); c.hline(0, 4, 40, "#9d6c50")
  c.rect(0, 0, 40, 3, "#9d6c50"); c.rect(0, 17, 40, 3, "#9d6c50"); for (let x = 2; x < 40; x += 9) { c.rect(x, -1, 3, 5, "#5c3832"); c.rect(x, 16, 3, 6, "#5c3832") }
})

// ---------------------------------------------------------------- 빈 터 (둥근 다진 흙 + 돌 테두리)
const LOTS = [[48, 62, 48, 30], [128, 60, 48, 30], [196, 62, 48, 30], [262, 60, 48, 30], [322, 64, 46, 28],
              [50, 150, 48, 30], [126, 154, 48, 30], [194, 158, 48, 30], [262, 152, 48, 30], [324, 152, 46, 30]]
sprite("_lots", { w: 384, h: 224 }, (c) => {
  for (const [x, y, w, h] of LOTS) {
    c.ellipse(x + w / 2, y + h / 2 + 1, w / 2 + 2, h / 2 + 2, GRASS_K); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, LOT_D); c.ellipse(x + w / 2, y + h / 2 - 1, w / 2 - 3, h / 2 - 3, LOT)
    const r = c.rng(x + y); for (let i = 0; i < 18; i++) c.px(x + 4 + Math.floor(r() * (w - 8)), y + 4 + Math.floor(r() * (h - 8)), r() < 0.5 ? LOT_L : LOT_D)
  }
})
const lotRocks = (c) => { for (const [x, y, w, h] of LOTS) { c.stamp("rock_small", x - 4, y + 6); c.stamp("rock_small", x + w - 6, y - 2); c.stamp("rock_small", x + w / 2 - 5, y + h - 4); c.stamp("rock_small", x + w - 2, y + h - 10) } }

// ---------------------------------------------------------------- 하늘·산·절벽
sprite("_sky", { w: 384, h: 52 }, (c) => {
  c.rect(0, 0, 384, 52, SKY); c.rect(0, 0, 384, 14, SKY2); c.rect(0, 14, 384, 6, "#86b0e0")
  c.poly([0, 52, 0, 34, 40, 20, 80, 32, 120, 12, 170, 34, 210, 8, 250, 28, 290, 16, 330, 32, 384, 14, 384, 52], MTN2)
  c.poly([0, 52, 0, 42, 50, 32, 100, 44, 150, 28, 200, 42, 260, 34, 310, 46, 384, 30, 384, 52], MTN)
  c.px(120, 13, CLOUD); c.px(121, 13, CLOUD); c.px(119, 14, CLOUD); c.px(210, 9, CLOUD); c.px(211, 10, CLOUD); c.px(209, 10, CLOUD)
  c.ellipse(70, 10, 14, 3, CLOUD); c.ellipse(76, 8, 8, 3, CLOUD); c.ellipse(300, 7, 18, 3, CLOUD); c.ellipse(292, 5, 8, 3, CLOUD)
})
sprite("_cliff", { w: 384, h: 20 }, (c) => { for (let x = 0; x < 384; x += 16) { c.stamp("t_1_5", x, 0); } c.rect(0, 16, 384, 4, GRASS_K); for (let x = 0; x < 384; x += 16) c.stamp("t_1_4", x, -12) })

// ---------------------------------------------------------------- 애니·조명 부품
anim("_fire", { w: 16, h: 16, frames: 6, fps: 8 }, (c) => {
  const k = c.phase * Math.PI * 2, up = (h, a, o) => 15 - Math.round(h + Math.sin(k + o) * a)
  c.poly([4, 15, 6, up(7, 1, 0), 8, up(11, 2, 1), 10, up(6, 1, 2), 12, 15], "#b83a2e"); c.poly([6, 15, 8, up(7, 1, 1.5), 10, 15], "#e8702e"); c.px(8, 14, "Y"); c.px(8, up(9, 2, 1) + 2, "Y")
  c.lamp(8, 10, { r: 28, color: "#ffb27a", power: 0.8 })
})
anim("_flag_wave", { w: 21, h: 31, frames: 3, fps: 5 }, (c) => { c.stamp("flag", 0, 0); if (c.frame) c.rect(8, 3 + c.frame, 9, 1, "#3d5a9a") })
anim("_smoke", { w: 9, h: 14, frames: 6, fps: 5 }, (c) => { const f = c.frame; for (let i = 0; i < 3; i++) { const yy = 12 - ((f * 2 + i * 5) % 14), xx = 4 + Math.round(Math.sin((f + i * 2) * 0.9)); c.circ(xx, yy, i === 2 ? 1 : 2, i === 0 ? "#a3a2b6" : "#7c7a92") } })
const flame = (name, r, p, col, seed) => anim(name, { w: 1, h: 1, frames: 12, fps: 10 }, (c) => { const f = 0.55 * Math.sin(c.phase * 6.283 + seed) + 0.3 * Math.sin(c.phase * 18.85 + seed * 2); c.lamp(0, 0, { r: r * (1 + 0.04 * f), power: p * (1 + 0.06 * f), color: col }) })
flame("_lamp_post_l", 40, 0.9, "#ffd58a", 1); flame("_entrance_l", 46, 1.0, "#ffb27a", 2)

// ---------------------------------------------------------------- 장면
scene("yard_day", { w: 384, h: 224, bg: INK, layers: true },
  layer("ground", tile("grass", 0, 48, 24, 11, { reseed: true }), stamp("_sky", 0, 0), stamp("_cliff", 0, 44)),
  layer("stream", stamp("_stream", 0, 0), stamp("_ripple", 0, 0)),
  layer("road", stamp("_road", 0, 0)),
  layer("lots", stamp("_lots", 0, 0)),
  layer("bridge", stamp("_bridge", -2, 110)),
  layer("rails", (c) => { for (let x = 216; x < 336; x += 16) c.stamp("t_2_5", x, 106) }, stamp("rail_buffer", 198, 100)),
  layer("entrance", (c) => { c.stamp("t_2_13", 336, 76); c.stamp("t_2_14", 352, 76); c.stamp("t_2_15", 368, 76); c.stamp("t_3_13", 336, 92); c.stamp("t_3_14", 352, 92); c.stamp("t_3_15", 368, 92) }),
  // 절벽 밑 수풀: 소나무가 절벽 아래쪽과 겹치게, 뒤→앞 순서
  layer("back_trees", (c) => { for (const x of [-6, 34, 96, 150, 212, 270, 318, 362]) c.stamp("pine", x, 18, { reseed: true }); for (const x of [60, 184, 250, 340]) c.stamp("tree_a", x, 36) }),
  layer("props_back",
    stamp("fence_h", 112, 50), stamp("fence_h", 145, 50), stamp("fence_h", 228, 50), stamp("fence_h", 261, 50), stamp("post", 112, 50), stamp("post", 293, 50),
    (c) => lotRocks(c),
    stamp("signpost", 36, 96), stamp("lamp_post", 160, 94), stamp("lamp_post", 286, 128), stamp("lamp_post", 104, 132),
    stamp("well", 86, 184), stamp("logs", 150, 192), stamp("stump", 40, 190),
    stamp("campfire_ring", 222, 190), stamp("_fire", 230, 184),
    stamp("clothesline_a", 170, 196), stamp("clothesline_b", 300, 192),
    stamp("crate_a", 350, 118), stamp("crate_b", 364, 122), stamp("barrel", 340, 126), stamp("tools", 374, 104), stamp("basket", 332, 204),
    stamp("rock_big", 20, 160), stamp("rock_mid", 300, 170), stamp("rock_mid", 118, 100), stamp("rock_small", 200, 140), stamp("rock_small", 60, 134),
    stamp("bushes", 70, 128, { reseed: true }), stamp("bushes", 230, 130, { reseed: true }), stamp("bushes", 160, 172, { reseed: true }), stamp("bushes", 350, 150, { reseed: true }), stamp("bushes", 110, 206, { reseed: true }),
    stamp("flowers", 40, 108, { reseed: true }), stamp("flowers", 188, 100, { reseed: true }), stamp("flowers", 110, 176, { reseed: true }), stamp("flowers", 280, 206, { reseed: true }), stamp("flowers", 310, 100, { reseed: true }), stamp("flowers", 26, 142, { reseed: true }),
    stamp("mushroom_red", 62, 196), stamp("mushroom_brown", 214, 170), stamp("mushroom_red", 250, 56),
    stamp("tree_b", 352, 176), stamp("tree_a", 12, 196), stamp("tree_b", 240, 198),
    stamp("_flag_wave", 4, 86), stamp("scale", 150, 198)),
  layer("front_grass", (c) => { const r = c.rng(9); for (let i = 0; i < 60; i++) { const x = Math.floor(r() * 384), y = 60 + Math.floor(r() * 160); c.px(x, y, "#9cc45a"); c.px(x + 1, y - 1, "#9cc45a") } }),
)

scene("yard_night", { w: 384, h: 224, bg: INK },
  stamp("yard_day", 0, 0),
  stamp("_lamp_post_l", 166, 100, { rdelay: true }), stamp("_lamp_post_l", 292, 134, { rdelay: true }), stamp("_lamp_post_l", 110, 138, { rdelay: true }),
  stamp("_entrance_l", 352, 100), lamp(60, 20, { r: 60, color: "#a8b8ff", power: 0.6 }),
  lighting({ cell: 2, smooth: true, ambient: 0.38, ambientColor: "#8f8fd0" }),
  glow("Y", { r: 5, strength: 0.6 }))
