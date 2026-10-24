#!/usr/bin/env sh
# v0.9 §2: GPT 사무소 내부(art/raw/mine_office_interior.png, 256×224 × 약 5.2배) → art/office/office_gpt.px.js
#   본체 = png2pxl 256×224 --clean (팔레트는 art/office/office.px.js 것) · pxl은 빛만 얹는다(벽난로 불꽃 anim·램프·발광석·달빛·lighting·glow)
#   좌표는 256×224 기준으로 원본에서 잰 것 (벽난로 불 177~199×66~90 · 책상 램프 145,88 · 선반 광석 97,25 · 창 달 42,22)
# 실행: sh scripts/office.sh   (Windows: py, 그 밖: python3)
PY=$(command -v py || command -v python3)
OUT=art/office/office_gpt.px.js
{
  echo "// 「돌망치 상회 사무소」 내부 — v0.9 §2 GPT 원본 → png2pxl (sh scripts/office.sh 가 만든 파일, 손으로 고치지 않음)"
  echo "// 256×224, 정수 확대 전제. office_day = 원본 + 벽난로 빛만 (인수인계 장면) · office_night = 램프·달빛 + lighting ambient 0.42"
  sed -n '/^pal({/,/^})/p' art/office/office.px.js
  sed -n '/^ramps(/p' art/office/office.px.js
  $PY scripts/png2pxl.py art/raw/mine_office_interior.png --pal art/office/office.px.js --cols 256 --rows 224 --samples 3 --clean --name office_base
  cat <<'EOF'

// ================================================================ 빛 (pxl이 얹는 것)
const wobble = (c, seed) => { const k = c.phase * Math.PI * 2; return 0.55 * Math.sin(k + seed) + 0.3 * Math.sin(3 * k + seed * 2) + 0.15 * Math.sin(5 * k + seed * 3) }
const flame_lamp = (name, r, power, color, seed) =>
  anim(name, { w: 1, h: 1, frames: 12, fps: 10 }, (c) => { const f = wobble(c, seed); c.lamp(0, 0, { r: r * (1 + 0.04 * f), power: power * (1 + 0.06 * f), color }) })
flame_lamp("_fire_lamp", 86, 1.1, "#ffb27a", 0)
flame_lamp("_desk_lamp", 52, 1, "#ffd58a", 2)
flame_lamp("_wall_lamp", 34, 0.7, "#ffd58a", 4)
anim("_ore_lamp", { w: 1, h: 1, frames: 24, fps: 8 }, (c) => { const f = 0.5 + 0.5 * Math.sin(c.phase * Math.PI * 2); c.lamp(0, 0, { r: 24 + 6 * f, power: 0.6 + 0.3 * f, color: "#8af0e0" }) })
// 벽난로 불꽃 (원본 불 위에 겹쳐 흔들림) — 게임은 이 anim 을 (177, 68)에 얹는다
anim("office_fire", { w: 22, h: 23, frames: 6, fps: 10 }, (c) => {
  const k = c.phase * Math.PI * 2, y = 21
  const up = (h, amp, off) => y - Math.round(h + Math.sin(k + off) * amp)
  c.poly([2, y, 4, up(9, 2, 0), 7, up(6, 1, 2), 10, up(17, 2, 1), 13, up(9, 2, 3), 16, up(13, 2, 4.5), 19, y], "H")
  c.poly([4, y, 7, up(7, 1, 1), 10, up(12, 2, 2.5), 12, up(7, 1, 0.5), 15, up(9, 2, 4), 17, y], "h")
  c.poly([6, y, 9, up(6, 1, 3), 11, up(9, 1, 1.2), 13, up(5, 1, 2), 15, y], "a")
  c.poly([8, y + 1, 10, up(4, 1, 0.7), 12, up(2, 1, 2.2), 13, y + 1], "l")
})
scene("office_day", { w: 256, h: 224, bg: "k" },
  stamp("office_base", 0, 0), stamp("office_fire", 177, 68),
  glow("lLah", { where: [172, 62, 32, 32], r: 12, strength: 0.45 }))
scene("office_night", { w: 256, h: 224, bg: "k" },
  stamp("office_base", 0, 0), stamp("office_fire", 177, 68),
  stamp("_fire_lamp", 188, 80), stamp("_desk_lamp", 145, 88, { rdelay: true }), stamp("_wall_lamp", 133, 11, { rdelay: true }),
  stamp("_ore_lamp", 97, 25), stamp("_ore_lamp", 112, 40, { rdelay: true }), stamp("_ore_lamp", 247, 63, { rdelay: true }),
  lamp(42, 22, { r: 34, color: "#b9c3ff", power: 0.7 }),
  lighting({ cell: 2, smooth: true, ambient: 0.42, ambientColor: "#8f8fd0", emit: "zYQgU" }),
  glow("zgG", { r: 7, strength: 0.4 }), glow("U", { r: 5, strength: 0.3 }), glow("Q", { r: 9, strength: 0.55 }),
  glow("lLah", { where: [172, 62, 32, 32], r: 14, strength: 0.55 }), glow("L", { r: 5, strength: 0.7 }))
EOF
} > $OUT
echo "→ $OUT"
