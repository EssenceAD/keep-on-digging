#!/usr/bin/env sh
# §10-1 표대로 GPT 치비 4장 → art/conv/*.txt (pxl sprite 블록). art/chibi.px.js 에 붙여 넣는다.
# 실행: sh scripts/chibi.sh   (Windows: py, 그 밖: python3)
PY=$(command -v py || command -v python3)
P="$PY scripts/png2pxl.py --pal art/chibi.px.js --samples 3 --clean"
mkdir -p art/conv
$P art/raw/mine_miner_red_chibi.png      --cols 32 --rows 40                               --name _red_base      > art/conv/red.txt
$P art/raw/mine_chibi_miners2_mole.png   --cols 32 --rows 40 --crop 0,0,647,809         --name _brown_base    > art/conv/brown.txt
$P art/raw/mine_chibi_miners2_mole.png   --cols 32 --rows 40 --crop 647,0,647,809       --name _blonde_base   > art/conv/blonde.txt
$P art/raw/mine_chibi_miners2_mole.png   --cols 32 --rows 20 --crop 1360,400,560,350    --name _mole_base     > art/conv/mole.txt
$P art/raw/mine_chibi_npc3.png           --cols 32 --rows 40 --crop 0,0,647,809         --name npc_halabeoji  > art/conv/halabeoji.txt
$P art/raw/mine_chibi_npc3.png           --cols 32 --rows 40 --crop 647,0,647,809       --name npc_momo       > art/conv/momo.txt
$P art/raw/mine_chibi_npc3.png           --cols 32 --rows 40 --crop 1294,0,648,809      --name npc_brok       > art/conv/brok.txt
$P art/raw/mine_chibi_merchant_cart.png  --cols 32 --rows 40 --crop 0,0,793,992         --name npc_merchant   > art/conv/merchant.txt
$P art/raw/mine_chibi_merchant_cart.png  --cols 32 --rows 24 --crop 796,360,784,588      --name _cart_base     > art/conv/cart.txt
