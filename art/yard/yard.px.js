// 돌망치 상회 — 지상 부지 장면 (pxl 조립). 타일·소품은 GPT 시트(art/raw/mine_yard_tiles.png) → scripts/sheet2pxl.py → tiles.px.js
// 384×224 = 24×14 타일. 빈 터 10곳 좌표는 yard_lots.json과 같다.
include("./tiles.px.js")
pal({ Y: "#f5cf6a" })

const SKY = "#6f8fd0", SKY2 = "#8fb0e0", MTN = "#3d5a9a", MTN2 = "#2e4578", INK = "#1a1220"

// 타일 키
const M = {
  g: "t_0_0", f: "t_0_1", s: "t_0_2", G: "t_0_3",                 // 풀
  d: "t_0_13", "^": "t_0_4", v: "t_0_10", "<": "t_0_14", ">": "t_0_8",   // 흙길 가운데·위·아래·왼·오른 가장자리
  q: "t_0_9", w: "t_0_11", e: "t_0_12", r: "t_1_2",                   // 모서리
  C: "t_1_4", c: "t_1_5", k: "t_1_7", K: "t_1_9",                     // 절벽 윗면·면
  W: "t_1_10", x: "t_1_11", y: "t_1_12", S: "t_1_13", T: "t_2_0", U: "t_2_1", V: "t_2_2",   // 물·물가
  l: "t_3_12", L: "t_3_9", m: "t_3_5", n: "t_3_8", o: "t_3_6", p: "t_3_7",                 // 빈 터 바닥
  "=": "t_2_5", "|": "t_2_6", b: "t_2_11", B: "t_2_12", a: "t_2_3",                        // 레일·다리·자갈
}
// 24열 × 14줄. 0~2 하늘(그림으로 덮음), 3 절벽, 4~5 위쪽 터, 7 흙길, 9~10 아래쪽 터, 11~13 풀
const MAP = `
gggggggggggggggggggggggg
gggggggggggggggggggggggg
gggggggggggggggggggggggg
WCCCCCCCCCCCCCCCCCCCCCCC
WWgfllLgglLlgsgllLgglLlg
WxgglLlggLllgggLlLggllLg
WWggsgggfgggggggGggggfgg
bB^^^^^^^^^^^^^^^^^^^^^^
WWvvvvvvvvvvvvvvvvvvvvvv
WyggLllggllLgfglLlggLlLg
WWggllLggLllgggllLggllLg
WxgfgggsggggfggggsgggGgg
WWggggggggGgggggggggggfg
WWfgggGgggggsggggfgggggg`.trim()

sprite("_mtn", { w: 384, h: 56 }, (c) => {
  c.rect(0, 0, 384, 56, SKY); c.rect(0, 0, 384, 20, SKY2)
  c.poly([0, 56, 0, 36, 40, 22, 80, 34, 120, 14, 170, 36, 210, 10, 250, 30, 290, 18, 330, 34, 384, 16, 384, 56], MTN2)
  c.poly([0, 56, 0, 44, 50, 34, 100, 46, 150, 30, 200, 44, 260, 36, 310, 48, 384, 32, 384, 56], MTN)
  c.px(120, 15, "#f4ecd2"); c.px(121, 15, "#f4ecd2"); c.px(210, 11, "#f4ecd2"); c.px(211, 12, "#f4ecd2")   // 눈
  c.ellipse(70, 10, 14, 4, "#f4ecd2"); c.ellipse(300, 8, 18, 4, "#f4ecd2")                                 // 구름
})
anim("_water", { w: 32, h: 16, frames: 4, fps: 3 }, (c) => { c.stamp(["t_1_10", "t_1_11", "t_1_12", "t_1_11"][c.frame], 0, 0); c.stamp(["t_1_12", "t_1_10", "t_1_11", "t_1_10"][c.frame], 16, 0) })
anim("_flag_wave", { w: 22, h: 32, frames: 3, fps: 5 }, (c) => { c.stamp("flag", 0, 0); if (c.frame) c.rect(10, 2 + c.frame, 8, 1, "#3d5a9a") })
anim("_fire", { w: 16, h: 14, frames: 6, fps: 8 }, (c) => {
  const k = c.phase * Math.PI * 2, up = (h, a, o) => 13 - Math.round(h + Math.sin(k + o) * a)
  c.poly([4, 13, 6, up(7, 1, 0), 8, up(10, 2, 1), 10, up(6, 1, 2), 12, 13], "#b83a2e"); c.poly([6, 13, 8, up(7, 1, 1.5), 10, 13], "#e8702e"); c.px(8, 12, "Y")
  c.lamp(8, 8, { r: 26, color: "#ffb27a", power: 0.8 })
})
const flame = (name, r, p, col, seed) => anim(name, { w: 1, h: 1, frames: 12, fps: 10 }, (c) => { const f = 0.55 * Math.sin(c.phase * 6.283 + seed) + 0.3 * Math.sin(c.phase * 18.85 + seed * 2); c.lamp(0, 0, { r: r * (1 + 0.04 * f), power: p * (1 + 0.06 * f), color: col }) })
flame("_lamp_post_l", 40, 0.9, "#ffd58a", 1); flame("_entrance_l", 46, 1.0, "#ffb27a", 2)

// 빈 터 10곳 (x, y, w, h) — 위 5, 아래 5. yard_lots.json과 동일
const LOTS = [[48, 64, 48, 32], [128, 64, 48, 32], [192, 64, 48, 32], [256, 64, 48, 32], [320, 64, 48, 32],
              [48, 144, 48, 32], [128, 144, 48, 32], [192, 144, 48, 32], [256, 144, 48, 32], [320, 144, 48, 32]]
const lotRing = (c, [x, y, w, h]) => { for (const [px, py] of [[x - 2, y - 1], [x + w - 1, y - 2], [x + w + 1, y + h - 3], [x - 3, y + h - 2], [x + w / 2, y - 3], [x + w / 2 - 6, y + h + 1]]) c.stamp("rock_small", px - 4, py - 3) }

scene("yard_day", { w: 384, h: 224, bg: INK, layers: true },
  layer("ground", tilemap(MAP, { map: M, size: 16 })),
  layer("sky", stamp("_mtn", 0, 0), (c) => { for (const x of [4, 60, 140, 230, 300, 356]) c.stamp("pine_a", x, 14) }),   // 절벽 위 소나무 줄
  layer("water", (c) => { for (let y = 48; y < 224; y += 16) c.stamp("_water", 0, y, { rdelay: true }) }, stamp("t_2_11", 0, 112), stamp("t_2_12", 16, 112)),
  layer("rails", (c) => { for (let x = 208; x < 336; x += 16) c.stamp("t_2_5", x, 112) }, stamp("rail_buffer", 196, 106)),
  layer("entrance", (c) => { c.stamp("t_2_13", 336, 80); c.stamp("t_2_14", 352, 80); c.stamp("t_2_15", 368, 80); c.stamp("t_3_13", 336, 96); c.stamp("t_3_14", 352, 96); c.stamp("t_3_15", 368, 96) }),
  layer("lots", (c) => { for (const l of LOTS) lotRing(c, l) }),
  layer("props",
    stamp("fence_h", 20, 54), stamp("fence_h", 56, 54), stamp("fence_h", 92, 54), stamp("post", 20, 54),
    stamp("well", 100, 190), stamp("logs", 150, 196), stamp("stump", 20, 196), stamp("campfire_ring", 236, 192), stamp("_fire", 240, 182),
    stamp("lamp_post", 112, 90), stamp("lamp_post", 240, 90), stamp("lamp_post", 300, 128),
    stamp("signpost", 30, 92), stamp("crate_a", 352, 120), stamp("crate_b", 366, 124), stamp("barrel", 340, 128), stamp("tools", 378, 110),
    stamp("clothesline_a", 180, 192), stamp("clothesline_b", 300, 196),
    stamp("rock_big", 30, 170), stamp("rock_mid", 300, 170), stamp("bush_white", 70, 128), stamp("bush_pink", 230, 128), stamp("bush_orange", 160, 170),
    stamp("flower_white", 40, 110), stamp("flower_yellow", 180, 100), stamp("flower_blue", 110, 174), stamp("flower_pink", 280, 206), stamp("mushroom_red", 60, 186), stamp("mushroom_brown", 220, 170),
    stamp("tree_a", 350, 176), stamp("tree_b", 10, 150), stamp("pine_b", 372, 150),
    stamp("_flag_wave", 2, 100), stamp("scale", 150, 206), stamp("basket", 330, 206)),
)

scene("yard_night", { w: 384, h: 224, bg: INK },
  stamp("yard_day", 0, 0),
  stamp("_lamp_post_l", 118, 96, { rdelay: true }), stamp("_lamp_post_l", 246, 96, { rdelay: true }), stamp("_lamp_post_l", 306, 134, { rdelay: true }),
  stamp("_entrance_l", 352, 104), lamp(60, 20, { r: 60, color: "#a8b8ff", power: 0.6 }),
  lighting({ cell: 2, smooth: true, ambient: 0.38, ambientColor: "#8f8fd0" }),
  glow("Y", { r: 5, strength: 0.6 }))
