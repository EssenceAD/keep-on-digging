#!/usr/bin/env sh
# 부지 v5 (Fan-tasy 무료판) 그림 → public/art/yard5/   사용: sh scripts/build_yard5.sh "<팩 폴더: The Fan-tasy Tileset (Free)>"
# 팩 원본은 저장소에 없음(재배포 금지) — 다시 만들 땐 itch.io 무료판을 받아 폴더를 넘겨줌. 결과물만 커밋.
set -e
PACK="$1"; OUT=public/art/yard5
PY=$(command -v py || command -v python3)
mkdir -p $OUT/bld $OUT/chars
$PY scripts/bld_kit.py "$PACK" $OUT/bld
$PY scripts/char_kit.py "$PACK" $OUT/chars
$PY scripts/critter_kit.py $OUT/critters
$PY scripts/shaft_kit.py "$PACK" $OUT/shaft
$PY scripts/yard_map.py "$PACK" $OUT --mock $OUT/bld
echo "→ $OUT"
