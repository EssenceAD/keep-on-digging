// 돌망치 상회 — 지상 부지 장면 (pxl 조립 v3 · PATCH_V13: 빈 터 타원 삭제, 바닥 3톤, 겹치는 수풀, 낮·해질녘 조명, 공사터·간판·숲 채우기 조각)
// 타일·소품: tiles.px.js(GPT 시트) · lot_props.px.js(공사터 소품) · signs.px.js(심볼 간판)
include("./tiles.px.js")
include("./lot_props.px.js")
include("./signs.px.js")
pal({ Y: "#f5cf6a" })

const INK = "#1a1220"
const SKY = "#6f8fd0", SKY2 = "#9cc0e8", MTN = "#3d5a9a", MTN2 = "#2e4578", CLOUD = "#f4ecd2"
const DIRT = "#c98a4c", DIRT_D = "#a86f3a", DIRT_L = "#e0a862", DIRT_K = "#7a4f2a"      // 흙길
const LOT = "#b9834a", LOT_D = "#9a6a3c", LOT_L = "#d19a5c"                            // 다진 흙(공사터)
const WATER = "#2f7fd6", WATER_D = "#1f5ea8", WATER_L = "#79c3ff", FOAM = "#e8f6ff", SAND = "#e6cc8a"
const GRASS_D = "#3f7a2a", GRASS_K = "#2c5a22", GRASS_W = "#8fbf52", GRASS_W2 = "#7fae48"   // 짙은 패치 · 마모(밝은) 톤
const WOOD = "#7d5040", WOOD_D = "#5c3832", WOOD_L = "#9d6c50"

group("grass", ["t_0_0", "t_0_0", "t_0_0", "t_0_1", "t_0_2", "t_0_3", "t_0_0"])
group("pine", ["pine_a", "pine_b"])
group("flowers", ["flower_white", "flower_yellow", "flower_blue", "flower_pink"])
group("tufts", ["flower_tuft_white", "flower_tuft_yellow", "flower_tuft_pink"])
group("bushes", ["bush_white", "bush_pink", "bush_orange"])
group("rocks", ["rock_small", "rock_small", "rock_mid"])

// ---------------------------------------------------------------- 길 (구불구불한 중심선 → 두께 있는 흙띠)
const ROAD = [[0, 120], [30, 122], [70, 126], [110, 124], [150, 118], [190, 116], [230, 120], [270, 124], [305, 120], [335, 114], [352, 110]]
const SIDE1 = [[112, 124], [120, 108], [140, 96]]
const SIDE2 = [[250, 122], [240, 140], [232, 152]]
const road = (c, pts, w, col) => { for (let i = 0; i < pts.length - 1; i++) { c.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w); c.circ(pts[i][0], pts[i][1], Math.floor(w / 2), col) } c.circ(pts[pts.length - 1][0], pts[pts.length - 1][1], Math.floor(w / 2), col) }
const LOTS = [[48, 62, 48, 30], [128, 60, 48, 30], [196, 62, 48, 30], [262, 60, 48, 30],
              [50, 150, 48, 30], [126, 154, 48, 30], [194, 158, 48, 30], [262, 152, 48, 30], [324, 152, 46, 30]]   // 9터 (입구 옆 터 삭제)

// 바닥 톤: 길 양옆 마모(밝음) · 터 뒤·나무 밑 짙은 패치 · 풀 점
sprite("_ground_tone", { w: 384, h: 224 }, (c) => {
  const r = c.rng(21)
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 30 : 16, GRASS_W2)
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 26 : 13, GRASS_W)
  for (let i = 0; i < 900; i++) { const t = r() * (ROAD.length - 1), seg = Math.floor(t), f = t - seg, off = (r() - 0.5) * 40      // 마모 띠 가장자리 디더
    const x = Math.round(ROAD[seg][0] + (ROAD[seg + 1][0] - ROAD[seg][0]) * f), y = Math.round(ROAD[seg][1] + (ROAD[seg + 1][1] - ROAD[seg][1]) * f + off)
    if (Math.abs(off) > 11 && Math.abs(off) < 19 && r() < 0.6) c.px(x + Math.floor(r() * 3), y, Math.abs(off) > 15 ? GRASS_W2 : GRASS_D) }
  const patch = (cx, cy, rx, ry, col, k = 0.85) => { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1 && r() < k * (1 - d) + 0.1 * (1 - d)) c.px(x, y, col) } }   // 가장자리 디더
  for (const [x, y, w, h] of LOTS) { patch(x + w / 2, y + 7, w / 2 + 8, 10, GRASS_D); patch(x + w / 2 + 2, y + 5, w / 2 - 2, 6, GRASS_K, 0.7) }   // 건물 뒤 그늘
  for (const [x, y, rx, ry] of [[30, 200, 40, 10], [200, 206, 60, 9], [110, 140, 26, 7], [330, 140, 30, 8], [250, 96, 22, 6], [90, 100, 18, 5], [370, 200, 30, 12]]) patch(x, y, rx, ry, GRASS_D, 0.7)
  for (let i = 0; i < 260; i++) { const x = Math.floor(r() * 384), y = 52 + Math.floor(r() * 172); c.px(x, y, r() < 0.5 ? GRASS_D : "#9cc45a") }
})
sprite("_road", { w: 384, h: 224 }, (c) => {
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 22 : 12, GRASS_K)
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 20 : 10, DIRT_D)
  for (const p of [ROAD, SIDE1, SIDE2]) road(c, p, p === ROAD ? 16 : 7, DIRT)
  const r = c.rng(3); for (let i = 0; i < 90; i++) { const t = r(), seg = Math.floor(t * (ROAD.length - 1)), f = t * (ROAD.length - 1) - seg
    const x = Math.round(ROAD[seg][0] + (ROAD[seg + 1][0] - ROAD[seg][0]) * f + (r() - 0.5) * 12), y = Math.round(ROAD[seg][1] + (ROAD[seg + 1][1] - ROAD[seg][1]) * f + (r() - 0.5) * 12)
    c.px(x, y, r() < 0.5 ? DIRT_K : DIRT_L) }
  for (let i = 0; i < 6; i++) { const [x, y] = ROAD[2 + i]; c.hline(x - 3, y + 6, 6, DIRT_K); c.hline(x + 8, y + 7, 5, DIRT_K) }   // 수레 자국
})

// ---------------------------------------------------------------- 개울 + 다리
const STREAM = [[14, 48], [10, 70], [18, 95], [12, 120], [8, 150], [16, 180], [10, 224]]
sprite("_stream", { w: 384, h: 224 }, (c) => {
  road(c, STREAM, 30, SAND); road(c, STREAM, 26, WATER_D); road(c, STREAM, 20, WATER)
  const r = c.rng(5); for (let i = 0; i < 40; i++) { const y = 48 + Math.floor(r() * 176), x = 6 + Math.floor(r() * 16); c.hline(x, y, 2 + Math.floor(r() * 3), WATER_L) }
  for (let i = 0; i < 10; i++) { const y = 48 + Math.floor(r() * 176); c.px(4 + Math.floor(r() * 18), y, FOAM) }
})
anim("_ripple", { w: 40, h: 224, frames: 4, fps: 3 }, (c) => { const r = c.rng(11 + c.frame); for (let i = 0; i < 18; i++) { const y = 50 + Math.floor(r() * 170), x = 4 + Math.floor(r() * 20); c.hline(x, y, 3, WATER_L) } })
sprite("_bridge", { w: 40, h: 22 }, (c) => {
  c.rect(0, 4, 40, 12, WOOD); for (let x = 0; x < 40; x += 5) c.vline(x, 4, 12, WOOD_D); c.hline(0, 4, 40, WOOD_L)
  c.rect(0, 0, 40, 3, WOOD_L); c.rect(0, 17, 40, 3, WOOD_L); for (let x = 2; x < 40; x += 9) { c.rect(x, -1, 3, 5, WOOD_D); c.rect(x, 16, 3, 6, WOOD_D) }
})

// ---------------------------------------------------------------- 하늘·산·절벽
const sky = (name, [s1, s2, s3, m1, m2, cl]) => sprite(name, { w: 384, h: 52 }, (c) => {
  c.rect(0, 0, 384, 52, s1); c.rect(0, 0, 384, 14, s2); c.rect(0, 14, 384, 6, s3)
  c.poly([0, 52, 0, 34, 40, 20, 80, 32, 120, 12, 170, 34, 210, 8, 250, 28, 290, 16, 330, 32, 384, 14, 384, 52], m2)
  c.poly([0, 52, 0, 42, 50, 32, 100, 44, 150, 28, 200, 42, 260, 34, 310, 46, 384, 30, 384, 52], m1)
  c.px(120, 13, cl); c.px(121, 13, cl); c.px(119, 14, cl); c.px(210, 9, cl); c.px(211, 10, cl); c.px(209, 10, cl)
  c.ellipse(70, 10, 14, 3, cl); c.ellipse(76, 8, 8, 3, cl); c.ellipse(300, 7, 18, 3, cl); c.ellipse(292, 5, 8, 3, cl)
})
sky("_sky", [SKY, SKY2, "#86b0e0", MTN, MTN2, CLOUD])
sky("_sky_dusk", ["#e8905a", "#f6c27a", "#f0a868", "#5a3a5a", "#7a4a60", "#ffd9a0"])
sky("_sky_night", ["#1c2048", "#0e1230", "#161a3c", "#1a2a52", "#121c3c", "#2a3060"])
sprite("_cliff", { w: 384, h: 20 }, (c) => { for (let x = 0; x < 384; x += 16) { c.stamp("t_1_5", x, 0); } c.rect(0, 16, 384, 4, GRASS_K); for (let x = 0; x < 384; x += 16) c.stamp("t_1_4", x, -12) })

// ---------------------------------------------------------------- 애니·조명 부품
anim("_fire", { w: 16, h: 16, frames: 6, fps: 8 }, (c) => {
  const k = c.phase * Math.PI * 2, up = (h, a, o) => 15 - Math.round(h + Math.sin(k + o) * a)
  c.poly([4, 15, 6, up(7, 1, 0), 8, up(11, 2, 1), 10, up(6, 1, 2), 12, 15], "#b83a2e"); c.poly([6, 15, 8, up(7, 1, 1.5), 10, 15], "#e8702e"); c.px(8, 14, "Y"); c.px(8, up(9, 2, 1) + 2, "Y")
  c.lamp(8, 10, { r: 28, color: "#ffb27a", power: 0.8 })
})
anim("_flag_wave", { w: 21, h: 31, frames: 3, fps: 5 }, (c) => { c.stamp("flag", 0, 0); if (c.frame) c.rect(8, 3 + c.frame, 9, 1, "#3d5a9a") })
const flame = (name, r, p, col, seed) => anim(name, { w: 1, h: 1, frames: 12, fps: 10 }, (c) => { const f = 0.55 * Math.sin(c.phase * 6.283 + seed) + 0.3 * Math.sin(c.phase * 18.85 + seed * 2); c.lamp(0, 0, { r: r * (1 + 0.04 * f), power: p * (1 + 0.06 * f), color: col }) })
flame("_lamp_post_l", 40, 0.9, "#ffd58a", 1); flame("_entrance_l", 46, 1.0, "#ffb27a", 2)
const LAMPS = [[166, 100], [292, 134], [110, 138]]

// ---------------------------------------------------------------- 바닥 장면 (건물 밑에 깔리는 것만 — 터 자국 없음)
const base = (name, skyName) => sprite(name, { w: 384, h: 224 }, (c) => {
  c.tile("grass", 0, 48, 24, 11, { reseed: true }); c.stamp("_ground_tone", 0, 0); c.stamp(skyName, 0, 0); c.stamp("_cliff", 0, 44)
  c.stamp("_stream", 0, 0); c.stamp("_road", 0, 0); c.stamp("_bridge", -2, 110)
  for (let x = 216; x < 336; x += 16) c.stamp("t_2_5", x, 106); c.stamp("rail_buffer", 198, 100)
  c.stamp("t_2_13", 336, 76); c.stamp("t_2_14", 352, 76); c.stamp("t_2_15", 368, 76); c.stamp("t_3_13", 336, 92); c.stamp("t_3_14", 352, 92); c.stamp("t_3_15", 368, 92)
  // 절벽 밑 수풀 (건물 뒤)
  for (const x of [-6, 34, 96, 150, 212, 270, 318, 362]) c.stamp("pine", x, 18, { reseed: true }); for (const x of [60, 184, 250, 340]) c.stamp("tree_a", x, 36)
  c.stamp("fence_h", 112, 50); c.stamp("fence_h", 145, 50); c.stamp("fence_h", 228, 50); c.stamp("fence_h", 261, 50); c.stamp("post", 112, 50); c.stamp("post", 293, 50)
  // 소품 (건물과 안 겹치는 자리만)
  c.stamp("signpost", 36, 96); c.stamp("lamp_post", 160, 94); c.stamp("lamp_post", 286, 128); c.stamp("lamp_post", 104, 132)
  c.stamp("well", 86, 184); c.stamp("logs", 150, 192); c.stamp("stump", 40, 190)
  c.stamp("campfire_ring", 222, 190); c.stamp("_fire", 230, 184)
  c.stamp("clothesline_a", 170, 196); c.stamp("clothesline_b", 300, 192)
  c.stamp("crate_a", 350, 118); c.stamp("crate_b", 364, 122); c.stamp("barrel", 340, 126); c.stamp("tools", 374, 104); c.stamp("basket", 332, 204)
  c.stamp("rock_big", 20, 160); c.stamp("rock_mid", 300, 170); c.stamp("rock_mid", 118, 100); c.stamp("rock_small", 200, 140); c.stamp("rock_small", 60, 134)
  c.stamp("wheelbarrow", 236, 128); c.stamp("logs_a", 290, 198)
  for (const [x, y] of [[70, 128], [230, 130], [160, 172], [350, 150], [110, 206]]) c.stamp("bushes", x, y, { reseed: true })
  for (const [x, y] of [[40, 108], [188, 100], [110, 176], [280, 206], [310, 100], [26, 142]]) { c.stamp("flowers", x, y, { reseed: true }); c.stamp("flowers", x + 7, y + 3, { reseed: true }); c.stamp("flowers", x - 4, y + 5, { reseed: true }) }   // 뭉치로
  for (const [x, y] of [[132, 128], [318, 196], [66, 210], [206, 92]]) c.stamp("tufts", x, y, { reseed: true })
  c.stamp("mushroom_red", 62, 196); c.stamp("mushroom_brown", 214, 170); c.stamp("mushroom_red", 250, 56)
  c.stamp("tree_b", 352, 176); c.stamp("tree_a", 12, 196); c.stamp("tree_b", 240, 198)
  c.stamp("_flag_wave", 4, 86); c.stamp("scale", 150, 198)
})
base("_base", "_sky"); base("_base_dusk", "_sky_dusk"); base("_base_night", "_sky_night")
// 건물 위에 겹치는 앞 수풀 (Code: 건물 다음에 그림) — 양끝 숲 띠 + 터 사이 소나무 + 아랫줄 터 앞 덤불
sprite("yard_front", { w: 384, h: 224 }, (c) => {
  c.stamp("pine_big_b", -30, 36); c.stamp("pine_big_a", -24, 136); c.stamp("pine_small_a", -8, 188)        // 왼쪽 숲
  c.stamp("tree_small", 364, 118); c.stamp("pine_small_a", 362, 184); c.stamp("bush_big_b", 356, 86)        // 오른쪽 숲
  for (const x of [96, 180, 246]) c.stamp("pine_small_a", x, 56); c.stamp("tree_small", 308, 58)            // 윗줄 터 사이
  c.stamp("bush_big_a", 44, 156); c.stamp("bush_big_b", 118, 160); c.stamp("bush_big_a", 196, 162); c.stamp("bush_big_b", 266, 156)   // 아랫줄 터 앞
  for (const [x, y] of [[90, 176], [160, 178], [240, 180], [312, 178]]) c.stamp("tufts", x, y, { reseed: true })
})

// ---------------------------------------------------------------- 장면 (낮·해질녘·밤)
scene("yard_day", { w: 384, h: 224, bg: INK },
  stamp("_base", 0, 0), stamp("_ripple", 0, 0),
  lamp(192, -30, { r: 320, color: "#fff4d6", power: 0.35 }),
  lighting({ cell: 2, smooth: true, ambient: 0.88, ambientColor: "#f6ecd8" }))
scene("yard_dusk", { w: 384, h: 224, bg: INK },
  stamp("_base_dusk", 0, 0), stamp("_ripple", 0, 0),
  (c) => { for (const [x, y] of LAMPS) c.stamp("_lamp_post_l", x, y, { rdelay: true }) }, stamp("_entrance_l", 352, 100),
  lamp(60, 10, { r: 220, color: "#ffb070", power: 0.55 }),
  lighting({ cell: 2, smooth: true, ambient: 0.6, ambientColor: "#ffb888" }),
  glow("Y", { r: 4, strength: 0.4 }))
scene("yard_night", { w: 384, h: 224, bg: INK },
  stamp("_base_night", 0, 0), stamp("_ripple", 0, 0),
  (c) => { for (const [x, y] of LAMPS) c.stamp("_lamp_post_l", x, y, { rdelay: true }) }, stamp("_entrance_l", 352, 100), lamp(60, 20, { r: 60, color: "#a8b8ff", power: 0.6 }),
  lighting({ cell: 2, smooth: true, ambient: 0.38, ambientColor: "#8f8fd0" }),
  glow("Y", { r: 5, strength: 0.6 }))

// ---------------------------------------------------------------- 게임이 얹는 조각
// 공사 예정지 56×56 — 터(48×30)를 (4,20) 에 두고 그림. Code: stamp at (lot.x-4, lot.y-20). a/b 두 변형, locked = 잡초 터
const site = (name, body) => sprite(name, { w: 56, h: 56 }, (c) => {
  c.ellipse(28, 38, 21, 10, GRASS_K); c.ellipse(28, 37, 19, 9, LOT_D); c.ellipse(28, 36, 16, 7, LOT)
  const r = c.rng(7); for (let i = 0; i < 22; i++) c.px(14 + Math.floor(r() * 28), 31 + Math.floor(r() * 11), r() < 0.5 ? LOT_L : LOT_D)
  c.stamp("fence_rope_h2", 3, 2); body(c)
})
site("lot_site_a", (c) => { c.stamp("stake_rope", 1, 26); c.stamp("stake_rope", 48, 26); c.stamp("tools_dug", 14, 22); c.stamp("rock_small", 6, 44) })
site("lot_site_b", (c) => { c.stamp("stake_rope", 1, 26); c.stamp("stake_rope", 48, 26); c.stamp("logs_a", 7, 24); c.stamp("rock_mid", 40, 40) })
sprite("lot_site_locked", { w: 56, h: 56 }, (c) => { c.stamp("fence_rope_h2", 3, 2); c.stamp("stake_rope", 1, 26); c.stamp("stake_rope", 48, 26); c.stamp("bush_big_a", 8, 24); c.stamp("rock_mid", 36, 40); c.stamp("tufts", 2, 44, { reseed: true }) })
sprite("lot_site_locked_b", { w: 56, h: 56 }, (c) => { c.stamp("stake_rope", 4, 10); c.stamp("stake_rope", 46, 12); c.stamp("rock_big", 6, 22); c.stamp("bush_big_b", 22, 26); c.stamp("flower_tuft_yellow", 0, 40); c.stamp("mushroom_brown", 44, 44) })   // 잠긴 터 변형 (홀수 id)
// 간판 기둥: 30×42, 아래 가운데가 바닥. Code: 터 앞 왼쪽 (lot.x-10, lot.y+lot.h-40)
for (const k of ["pick", "anvil", "gear", "bed", "crate", "gem", "mug", "cart", "bag", "flask"]) sprite(`sign_${k}_post`, { w: 30, h: 42 }, (c) => {
  c.rect(13, 2, 4, 40, WOOD); c.vline(13, 2, 40, WOOD_L); c.vline(16, 2, 40, WOOD_D); c.rect(2, 0, 26, 3, WOOD_D); c.hline(2, 0, 26, WOOD_L)
  c.stamp(`sign_${k}`, 0, 2); c.ellipse(15, 41, 7, 2, GRASS_K)
})
// 장면 밖 채우기 타일 64×64 (이음새 없이 반복) — 어두운 소나무 숲
sprite("forest_fill", { w: 64, h: 64 }, (c) => {
  c.rect(0, 0, 64, 64, GRASS_K)
  for (const [x, y, n] of [[0, 0, "pine_a"], [32, 14, "pine_b"], [10, 34, "pine_b"], [44, 44, "pine_a"]]) for (const [dx, dy] of [[0, 0], [-64, 0], [0, -64], [-64, -64], [64, 0], [0, 64]]) c.stamp(n, x + dx, y + dy)
  lighting({ cell: 2, smooth: true, ambient: 0.42, ambientColor: "#6a78b0" })
})
