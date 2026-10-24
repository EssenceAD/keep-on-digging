// 부지 장면 v4 바닥 (960×540, PATCH_V14) — 풀·바닥 톤·길·개울·다리·레일·하늘·절벽만. 소품·건물·나무는 scripts/yard_compose.py 가 원본 색 PNG로 얹음.
include("./tiles.px.js")

const W = 960, H = 540
const SKY = "#6f8fd0", SKY2 = "#9cc0e8", MTN = "#3d5a9a", MTN2 = "#2e4578", CLOUD = "#f4ecd2"
const DIRT = "#c98a4c", DIRT_D = "#a86f3a", DIRT_L = "#e0a862", DIRT_K = "#7a4f2a"
const WATER = "#2f7fd6", WATER_D = "#1f5ea8", WATER_L = "#79c3ff", FOAM = "#e8f6ff", SAND = "#e6cc8a"
const GRASS_D = "#3f7a2a", GRASS_K = "#2c5a22", GRASS_W = "#8fbf52", GRASS_W2 = "#7fae48"
const WOOD = "#7d5040", WOOD_D = "#5c3832", WOOD_L = "#9d6c50"

group("grass", ["t_0_0", "t_0_0", "t_0_0", "t_0_1", "t_0_2", "t_0_3", "t_0_0"])

// 좌표는 yard_lots.json 과 같은 값 (바꾸면 둘 다)
const ROAD = [[60, 300], [110, 302], [180, 306], [270, 302], [360, 294], [450, 290], [540, 294], [630, 300], [720, 298], [800, 288], [860, 276], [880, 262]]
const SIDE = [[[300, 298], [292, 270], [300, 246]], [[620, 298], [630, 270], [620, 246]], [[440, 292], [446, 330], [460, 366]]]
const STREAM = [[34, 110], [26, 170], [42, 230], [30, 300], [22, 370], [40, 450], [28, 540]]
const LOTS_BY = [[230, 236], [410, 236], [590, 236], [770, 236], [175, 462], [335, 462], [495, 462], [655, 462], [815, 462]]   // 건물 바닥 가운데 (cx, by)
const road = (c, pts, w, col) => { for (let i = 0; i < pts.length - 1; i++) { c.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w); c.circ(pts[i][0], pts[i][1], Math.floor(w / 2), col) } c.circ(pts[pts.length - 1][0], pts[pts.length - 1][1], Math.floor(w / 2), col) }

sprite("_tone", { w: W, h: H }, (c) => {
  const r = c.rng(21)
  const patch = (cx, cy, rx, ry, col, k = 0.85) => { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1 && r() < k * (1 - d) + 0.1 * (1 - d)) c.px(x, y, col) } }
  for (const p of [ROAD, ...SIDE]) road(c, p, p === ROAD ? 64 : 34, GRASS_W2)
  for (const p of [ROAD, ...SIDE]) road(c, p, p === ROAD ? 56 : 28, GRASS_W)
  for (let i = 0; i < 2600; i++) { const t = r() * (ROAD.length - 1), s = Math.floor(t), f = t - s, off = (r() - 0.5) * 84
    const x = Math.round(ROAD[s][0] + (ROAD[s + 1][0] - ROAD[s][0]) * f), y = Math.round(ROAD[s][1] + (ROAD[s + 1][1] - ROAD[s][1]) * f + off)
    if (Math.abs(off) > 24 && Math.abs(off) < 40 && r() < 0.6) c.px(x + Math.floor(r() * 3), y, Math.abs(off) > 32 ? GRASS_W2 : GRASS_D) }
  for (const [cx, by] of LOTS_BY) { patch(cx, by - 4, 84, 18, GRASS_D); patch(cx + 4, by - 6, 70, 11, GRASS_K, 0.7) }       // 건물 밑·뒤 그늘
  for (const [x, y, rx, ry] of [[120, 500, 90, 24], [480, 520, 130, 20], [900, 440, 70, 30], [700, 380, 60, 14], [260, 370, 50, 12], [80, 200, 50, 14]]) patch(x, y, rx, ry, GRASS_D, 0.7)
  for (let i = 0; i < 1600; i++) { const x = Math.floor(r() * W), y = 112 + Math.floor(r() * (H - 112)); c.px(x, y, r() < 0.5 ? GRASS_D : "#9cc45a") }
})
sprite("_road", { w: W, h: H }, (c) => {
  for (const p of [ROAD, ...SIDE]) road(c, p, p === ROAD ? 44 : 24, GRASS_K)
  for (const p of [ROAD, ...SIDE]) road(c, p, p === ROAD ? 40 : 20, DIRT_D)
  for (const p of [ROAD, ...SIDE]) road(c, p, p === ROAD ? 32 : 14, DIRT)
  const r = c.rng(3); for (let i = 0; i < 420; i++) { const t = r() * (ROAD.length - 1), s = Math.floor(t), f = t - s
    const x = Math.round(ROAD[s][0] + (ROAD[s + 1][0] - ROAD[s][0]) * f + (r() - 0.5) * 24), y = Math.round(ROAD[s][1] + (ROAD[s + 1][1] - ROAD[s][1]) * f + (r() - 0.5) * 24)
    c.px(x, y, r() < 0.5 ? DIRT_K : DIRT_L) }
  for (let i = 1; i < ROAD.length - 2; i++) { const [x0, y0] = ROAD[i], [x1, y1] = ROAD[i + 1]; c.line(x0, y0 + 7, x1, y1 + 7, DIRT_K, 1); c.line(x0, y0 - 6, x1, y1 - 6, DIRT_K, 1) }   // 수레 자국 두 줄
})
sprite("_stream", { w: W, h: H }, (c) => {
  road(c, STREAM, 66, SAND); road(c, STREAM, 58, WATER_D); road(c, STREAM, 46, WATER)
  const r = c.rng(5); for (let i = 0; i < 160; i++) { const y = 110 + Math.floor(r() * 430), x = 6 + Math.floor(r() * 50); c.hline(x, y, 3 + Math.floor(r() * 5), WATER_L) }
  for (let i = 0; i < 40; i++) c.px(4 + Math.floor(r() * 56), 110 + Math.floor(r() * 430), FOAM)
})
sprite("_bridge", { w: 84, h: 44 }, (c) => {
  c.rect(0, 8, 84, 26, WOOD); for (let x = 0; x < 84; x += 7) c.vline(x, 8, 26, WOOD_D); c.hline(0, 8, 84, WOOD_L)
  c.rect(0, 0, 84, 5, WOOD_L); c.hline(0, 5, 84, WOOD_D); c.rect(0, 36, 84, 5, WOOD_L); c.hline(0, 41, 84, WOOD_D)
  for (let x = 3; x < 84; x += 16) { c.rect(x, -1, 5, 9, WOOD_D); c.rect(x, 34, 5, 10, WOOD_D) }
})
const sky = (name, [s1, s2, s3, m1, m2, cl]) => sprite(name, { w: W, h: 112 }, (c) => {
  c.rect(0, 0, W, 112, s1); c.rect(0, 0, W, 26, s2); c.rect(0, 26, W, 10, s3)
  c.poly([0, 112, 0, 70, 90, 44, 190, 66, 300, 26, 420, 70, 520, 18, 620, 58, 720, 34, 830, 66, 960, 30, 960, 112], m2)
  c.poly([0, 112, 0, 88, 120, 66, 250, 90, 380, 60, 500, 86, 650, 70, 780, 94, 960, 62, 960, 112], m1)
  for (const [x, y, w] of [[170, 18, 34], [190, 13, 18], [740, 14, 44], [720, 10, 20], [470, 26, 24]]) c.ellipse(x, y, w, 6, cl)
})
sky("_sky_day", [SKY, SKY2, "#86b0e0", MTN, MTN2, CLOUD])
sky("_sky_dusk", ["#e8905a", "#f6c27a", "#f0a868", "#5a3a5a", "#7a4a60", "#ffd9a0"])
sky("_sky_night", ["#1c2048", "#0e1230", "#161a3c", "#1a2a52", "#121c3c", "#2a3060"])
const ground = (name, skyName) => scene(name, { w: W, h: H, bg: "#1a1220" }, (c) => {
  c.tile("grass", 0, 96, 60, 28, { reseed: true }); c.stamp("_tone", 0, 0); c.stamp(skyName, 0, 0)
  for (let x = 0; x < W; x += 16) { c.stamp("t_1_4", x, 92); c.stamp("t_1_5", x, 104) } c.rect(0, 120, W, 3, GRASS_K)   // 절벽 띠
  c.stamp("_stream", 0, 0); c.stamp("_road", 0, 0); c.stamp("_bridge", -4, 278)
  for (let x = 700; x < 870; x += 16) c.stamp("t_2_5", x, 252)                                                    // 레일 → 갱도
})
ground("ground_day", "_sky_day"); ground("ground_dusk", "_sky_dusk"); ground("ground_night", "_sky_night")
anim("yard_ripple", { w: 64, h: 540, frames: 4, fps: 3 }, (c) => { const r = c.rng(11 + c.frame); for (let i = 0; i < 50; i++) { const y = 112 + Math.floor(r() * 420), x = 8 + Math.floor(r() * 46); c.hline(x, y, 4, WATER_L) } })
