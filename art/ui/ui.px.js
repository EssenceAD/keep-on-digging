// 「용사님, 채굴하실게요~」 UI 킷 — 나무 / 돌 / 양피지, 장면 팔레트 그대로.
// 창·패널은 9-slice(모서리 6px 고정, 가운데 늘림). 버튼 4상태. 바·슬롯·탭·뱃지.
pal({
  k: "#1a1220", K: "#2b1f35",
  e: "#3b2324", W: "#5c3832", w: "#7d5040", u: "#9d6c50", U: "#b98a68",   // 나무
  S: "#3d3a4c", s: "#5a5770", i: "#7c7a92", I: "#a3a2b6", J: "#c4c3d4",   // 돌
  B: "#8a7a68", C: "#b8a890", c: "#ddd0b0", x: "#f4ecd2",                 // 양피지
  A: "#8a5a24", a: "#d39a3a", l: "#f5cf6a", L: "#fff4b8",                 // 놋쇠·금
  H: "#b83a2e", h: "#e8702e", R: "#7a2e48", r: "#b84a62",                 // 빨강(HP·위험)
  Z: "#1f5a5a", G: "#2fa09a", g: "#6fe0d8",                               // 청록(발광·MP)
  F: "#46702e", f: "#6a9a3a", v: "#9cc45a",                               // 초록(OK·진행)
  N: "#141a3a", n: "#22305e", b: "#3d5a9a", o: "#6f8fd0",                 // 파랑(정보)
  V: "#4a2a6a", y: "#8a4ab0",                                             // 보라(비활성 틴트)
})

// ---------------------------------------------------------------- 공통: 테두리 틀
// 바깥 잉크 1px → 밝은 모서리 1px → 본체 → 안쪽 어두운 1px. 모서리에 못/징.
const frame = (c, w, h, { ink = "k", hi, body, lo, inner, nail }) => {
  c.rect(0, 0, w, h, ink)
  c.rect(1, 1, w - 2, h - 2, body)
  c.hline(1, 1, w - 2, hi); c.vline(1, 1, h - 2, hi)
  c.hline(1, h - 2, w - 2, lo); c.vline(w - 2, 1, h - 2, lo)
  c.rect(3, 3, w - 6, h - 6, inner)
  c.hline(3, 3, w - 6, lo); c.vline(3, 3, h - 6, lo)
  if (nail) for (const [x, y] of [[2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]]) { c.px(x, y, nail[0]); c.px(x + 1, y + 1, nail[1]) }
}
const WOOD  = { hi: "u", body: "w", lo: "W", inner: "e", nail: ["l", "A"] }
const STONE = { hi: "I", body: "i", lo: "S", inner: "K", nail: ["J", "s"] }
const PAPER = { hi: "x", body: "c", lo: "B", inner: "x", nail: ["A", "e"], ink: "e" }

// 창 (9-slice 기준: 모서리 6px)
const win = (name, st, w, h, extra) => sprite(name, { w, h }, (c) => { frame(c, w, h, st); if (extra) extra(c, w, h) })
win("win_wood", WOOD, 96, 64, (c, w) => {                         // 상단 제목 띠 + 결
  c.rect(4, 4, w - 8, 10, "W"); c.hline(4, 13, w - 8, "e"); c.hline(4, 4, w - 8, "u")
  for (let y = 18; y < 58; y += 7) c.hline(6, y, w - 12, "K")
})
win("win_stone", STONE, 96, 64, (c, w, h) => {                    // 벽돌 줄눈
  for (let y = 5, r = 0; y < h - 5; y += 6, r++) { c.hline(4, y, w - 8, "S"); for (let x = 4 + (r % 2) * 5; x < w - 4; x += 10) c.vline(x, y, 6, "S") }
  c.rect(4, 4, w - 8, 10, "s"); c.hline(4, 13, w - 8, "S")
})
win("win_paper", PAPER, 96, 64, (c, w, h) => {                    // 종이 얼룩·접힌 모서리
  c.px(10, 20, "C"); c.px(40, 44, "C"); c.px(70, 30, "C"); c.px(22, 50, "C")
  c.poly([w - 10, 3, w - 3, 3, w - 3, 10], "C"); c.line(w - 10, 3, w - 3, 10, "B")
})
// 작은 패널(툴팁·토스트)
win("panel_wood", WOOD, 48, 20); win("panel_stone", STONE, 48, 20); win("panel_paper", PAPER, 48, 20)

// ---------------------------------------------------------------- 버튼 4상태 × 3스타일
const button = (name, st, state) => sprite(name, { w: 44, h: 16 }, (c) => {
  const w = 44, h = 16
  let { hi, body, lo, inner } = st
  if (state === "hover") { hi = "l"; }
  if (state === "pressed") { [hi, lo] = [lo, hi] }
  if (state === "disabled") { hi = "s"; body = "S"; lo = "K"; inner = "K" }
  const dy = state === "pressed" ? 1 : 0
  c.rect(0, 0, w, h, "k"); c.rect(1, 1 + dy, w - 2, h - 2 - dy, body)
  c.hline(1, 1 + dy, w - 2, hi); c.vline(1, 1 + dy, h - 2 - dy, hi)
  c.hline(1, h - 2, w - 2, lo); c.vline(w - 2, 1 + dy, h - 2 - dy, lo)
  if (state !== "pressed") c.hline(1, h - 1, w - 2, "k")                       // 아래 그림자
  c.rect(3, 3 + dy, w - 6, h - 6 - dy, inner === "e" ? "W" : inner === "K" ? "s" : "c")
  if (state === "disabled") c.rect(3, 3, w - 6, h - 6, "S")
  if (state === "hover") c.hline(4, 4 + dy, w - 8, "L")
})
for (const [n, st] of [["wood", WOOD], ["stone", STONE], ["paper", PAPER]])
  for (const s of ["normal", "hover", "pressed", "disabled"]) button(`btn_${n}_${s}`, st, s)

// 작은 정사각 버튼(아이콘용) 20×20
sprite("btn_sq_wood", { w: 20, h: 20 }, (c) => frame(c, 20, 20, { ...WOOD, nail: null }))
sprite("btn_sq_stone", { w: 20, h: 20 }, (c) => frame(c, 20, 20, { ...STONE, nail: null }))

// ---------------------------------------------------------------- 바 (HP·창고 용량·진행)
const bar = (name, fill, hi, pct) => sprite(name, { w: 48, h: 8 }, (c) => {
  c.rect(0, 0, 48, 8, "k"); c.rect(1, 1, 46, 6, "K"); c.hline(1, 1, 46, "S")
  const n = Math.round(44 * pct)
  if (n > 0) { c.rect(2, 2, n, 4, fill); c.hline(2, 2, n, hi); c.px(2 + n - 1, 5, "k") }
  for (let x = 12; x < 46; x += 11) c.vline(x, 2, 4, "k")                      // 눈금
})
bar("bar_hp", "H", "h", 0.72); bar("bar_cargo", "a", "l", 0.55); bar("bar_glow", "G", "g", 0.9); bar("bar_ok", "f", "v", 0.35); bar("bar_empty", "K", "K", 0)
// 틀만 (9-slice로 늘릴 빈 바)
sprite("bar_frame", { w: 16, h: 8 }, rect(0, 0, 16, 8, "k"), rect(1, 1, 14, 6, "K"), hline(1, 1, 14, "S"))

// ---------------------------------------------------------------- 아이템 슬롯 · 탭 · 뱃지
sprite("slot_wood", { w: 18, h: 18 }, (c) => { frame(c, 18, 18, { ...WOOD, nail: null }); c.rect(3, 3, 12, 12, "K"); c.hline(3, 3, 12, "k"); c.vline(3, 3, 12, "k") })
sprite("slot_stone", { w: 18, h: 18 }, (c) => { frame(c, 18, 18, { ...STONE, nail: null }); c.rect(3, 3, 12, 12, "K"); c.hline(3, 3, 12, "k"); c.vline(3, 3, 12, "k") })
sprite("slot_selected", { w: 18, h: 18 }, (c) => { frame(c, 18, 18, { hi: "L", body: "a", lo: "A", inner: "K", nail: null }); c.box(2, 2, 14, 14, "l") })

sprite("tab_on", { w: 28, h: 12 }, (c) => { c.rect(0, 0, 28, 12, "k"); c.rect(1, 1, 26, 11, "w"); c.hline(1, 1, 26, "u"); c.vline(1, 1, 11, "u"); c.vline(26, 1, 11, "W"); c.rect(3, 3, 22, 9, "u") })
sprite("tab_off", { w: 28, h: 12 }, (c) => { c.rect(0, 2, 28, 10, "k"); c.rect(1, 3, 26, 9, "W"); c.hline(1, 3, 26, "w"); c.vline(26, 3, 9, "e"); c.rect(3, 5, 22, 7, "e") })

sprite("badge_gold", `
  ..kkkk..
  .kalllk.
  kalLLllk
  kalLaalk
  kaaaaalk
  kAaaaaAk
  .kAAAAk.
  ..kkkk..`)
sprite("badge_red", `
  ..kkkk..
  .krhhrk.
  krhHhhrk
  krhhrrrk
  krrrrrrk
  kRrrrrRk
  .kRRRRk.
  ..kkkk..`)
sprite("badge_teal", `
  ..kkkk..
  .kGggGk.
  kGggGgGk
  kGgGGGGk
  kGGGGGGk
  kZGGGGZk
  .kZZZZk.
  ..kkkk..`)
sprite("arrow_up", `
  ...v...
  ..vvv..
  .vvfvv.
  vv.f.vv
  ...f...
  ...F...`)
sprite("arrow_down", `
  ...H...
  ...h...
  rr.h.rr
  .rrhrr.
  ..rrr..
  ...r...`)
sprite("coin", `
  .kkk.
  kalLk
  kaLlk
  kAalk
  .kkk.`)
sprite("check", `
  .....v.
  ....vv.
  f..vv..
  fvvv...
  .fv....`)
sprite("close_x", `
  r...r
  .r.r.
  ..h..
  .r.r.
  r...r`)

// ---------------------------------------------------------------- 데모 장면: 세 스타일 한눈에
scene("ui_demo", { w: 256, h: 160, bg: "K" },
  stamp("win_wood", 4, 4), stamp("win_stone", 104, 4), stamp("win_paper", 204, 4, {}),
  // 나무 창 안: 슬롯 4 + 바
  stamp("slot_wood", 10, 22), stamp("slot_selected", 30, 22), stamp("slot_wood", 50, 22), stamp("slot_wood", 70, 22),
  stamp("bar_cargo", 10, 44), stamp("badge_gold", 60, 44), stamp("coin", 70, 46),
  stamp("tab_on", 10, 56), stamp("tab_off", 40, 56),
  // 돌 창 안: 버튼 상태들
  stamp("btn_stone_normal", 110, 22), stamp("btn_stone_hover", 156, 22), stamp("btn_stone_pressed", 110, 40), stamp("btn_stone_disabled", 156, 40),
  stamp("bar_hp", 110, 58), stamp("bar_glow", 160, 58),
  // 양피지(장부): 글줄 + 화살표
  ...[20, 28, 36, 44].map((y) => hline(212, y, 36, "B")), stamp("arrow_up", 240, 26), stamp("arrow_down", 240, 40), stamp("check", 212, 52), stamp("close_x", 232, 52),
  // 아래 줄: 나무·종이 버튼 상태 + 패널
  stamp("btn_wood_normal", 4, 74), stamp("btn_wood_hover", 50, 74), stamp("btn_wood_pressed", 96, 74), stamp("btn_wood_disabled", 142, 74),
  stamp("btn_paper_normal", 4, 92), stamp("btn_paper_hover", 50, 92), stamp("btn_paper_pressed", 96, 92), stamp("btn_paper_disabled", 142, 92),
  stamp("btn_sq_wood", 190, 74), stamp("btn_sq_stone", 212, 74), stamp("badge_red", 236, 78), stamp("badge_teal", 236, 90),
  stamp("panel_wood", 4, 112), stamp("panel_stone", 56, 112), stamp("panel_paper", 108, 112),
  stamp("bar_ok", 160, 114), stamp("bar_empty", 160, 124), stamp("slot_stone", 212, 112),
  // 9-slice 늘림 예시: 창을 가로로 넓게
  stamp("win_wood", 4, 136, { w: 244, h: 20, slice: 6 }))

sheet("ui_kit", [
  "win_wood", "win_stone", "win_paper", "panel_wood", "panel_stone", "panel_paper",
  ...["wood", "stone", "paper"].flatMap((n) => ["normal", "hover", "pressed", "disabled"].map((s) => `btn_${n}_${s}`)),
  "btn_sq_wood", "btn_sq_stone", "bar_hp", "bar_cargo", "bar_glow", "bar_ok", "bar_empty", "bar_frame",
  "slot_wood", "slot_stone", "slot_selected", "tab_on", "tab_off", "badge_gold", "badge_red", "badge_teal",
  "arrow_up", "arrow_down", "coin", "check", "close_x",
], { pad: 2 })
