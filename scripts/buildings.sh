#!/usr/bin/env sh
# 명세3 §2-3-1: GPT 건물 시트(5×2 칸) → art/buildings_gpt.px.js (64×64 칸씩 · 장식 6은 10번 칸에서 소품 단위로)
# 팔레트는 art/buildings.px.js 것. 건물 본체 픽셀은 손대지 않는다(빛·연기·anim은 게임/pxl이 얹음).
# 실행: sh scripts/buildings.sh   (Windows: py, 그 밖: python3)
PY=$(command -v py || command -v python3)
SRC=art/raw/mine_buildings_lv1.png
P="$PY scripts/png2pxl.py --pal art/buildings.px.js --samples 3 --clean"
OUT=art/buildings_gpt.px.js
{
  echo "// 명세3 §2-3-1 — GPT 건물 Lv1 (art/raw/mine_buildings_lv1.png → sh scripts/buildings.sh 가 만든 파일, 손으로 고치지 않음)"
  sed -n '/^pal({/,/^})/p' art/buildings.px.js
  i=0
  for name in office warehouse cartshed lodge smelter lanternshop pump turretshop molehome; do
    x=$(( (i % 5) * 397 )); y=$(( (i / 5) * 396 ))
    $P $SRC --cols 64 --rows 64 --crop $x,$y,396,396 --name g_${name}_1
    i=$((i + 1))
  done
  $P $SRC --cols 20 --rows 18 --crop 1638,412,125,112 --name g_deco_fire
  $P $SRC --cols 20 --rows 22 --crop 1808,412,132,142 --name g_deco_flag
  $P $SRC --cols 22 --rows 20 --crop 1636,528,146,132 --name g_deco_well
  $P $SRC --cols 26 --rows 16 --crop 1792,552,166,102 --name g_deco_garden
  $P $SRC --cols 20 --rows 16 --crop 1630,668,136,110 --name g_deco_scale
  $P $SRC --cols 30 --rows 15 --crop 1780,672,192,98 --name g_deco_rail
} > $OUT
echo "→ $OUT"
