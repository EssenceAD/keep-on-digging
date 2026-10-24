#!/usr/bin/env sh
# PATCH_V10 §2 (형철 ③): 부지 장면용 건물 64×64 — 128을 줄이지 않고 GPT 원본에서 바로 64칸으로 변환 → art/yard/buildings64.px.js
#   g64_<건물>_1 · _3 · _5 (장면 1× = 64px, 터 48px보다 커도 터 중심에 바닥 맞춤) · 장식 g64_deco_* (같은 시트에서 절반 칸 수)
# 실행: sh scripts/buildings64.sh   (Windows: py, 그 밖: python3)
PY=$(command -v py || command -v python3)
P="$PY scripts/png2pxl.py --pal art/buildings.px.js --samples 3 --clean"
OUT=art/yard/buildings64.px.js
{
  echo "// PATCH_V10 §2 — 부지 장면 건물 64×64 · 장식 (art/raw/mine_buildings_lv*.png → sh scripts/buildings64.sh 가 만든 파일, 손으로 고치지 않음)"
  sed -n '/^pal({/,/^})/p' art/buildings.px.js
  for lv in 1 3 5; do
    SRC=art/raw/mine_buildings_lv$lv.png
    [ -f $SRC ] || continue
    i=0
    for name in office warehouse cartshed lodge smelter lanternshop pump turretshop molehome; do
      x=$(( (i % 5) * 397 )); y=$(( (i / 5) * 396 ))
      $P $SRC --cols 64 --rows 64 --crop $x,$y,396,396 --name g64_${name}_$lv
      i=$((i + 1))
    done
  done
  SRC=art/raw/mine_buildings_lv1.png
  $P $SRC --cols 20 --rows 18 --crop 1638,412,125,112 --name g64_deco_fire
  $P $SRC --cols 20 --rows 22 --crop 1808,412,132,142 --name g64_deco_flag
  $P $SRC --cols 22 --rows 20 --crop 1636,528,146,132 --name g64_deco_well
  $P $SRC --cols 26 --rows 16 --crop 1792,552,166,102 --name g64_deco_garden
  $P $SRC --cols 20 --rows 16 --crop 1630,668,136,110 --name g64_deco_scale
  $P $SRC --cols 30 --rows 15 --crop 1780,672,192,98 --name g64_deco_rail
} > $OUT
echo "→ $OUT"
