#!/usr/bin/env python3
"""GPT 도트 시트 → 원래 픽셀 크기 PNG (Retro Diffusion pixel-art-fixer, MIT) + 마젠타 배경 투명 + 조각 자르기.
설치: pip install "git+https://github.com/Retro-Diffusion/pixel-art-fixer#subdirectory=python"
사용:
  python3 scripts/fix_sheet.py art/raw/mine_signs.png art/fixed/signs.png                       # 시트 통째 (원본 색 그대로)
  python3 scripts/fix_sheet.py art/raw/mine_signs.png art/fixed/signs --cut --names a.txt      # 조각마다 PNG (연결 요소, 위→아래·왼→오)
  --step 2.6  격자 크기 강제 (자동 탐지가 2배·½배로 헷갈릴 때)
  --grid 5x2  고정 칸 시트(건물 시트처럼 칸마다 하나): 칸 단위로 자르고 각 칸을 내용 크기로 다듬음
"""
import argparse, io, os, sys
import numpy as np
from PIL import Image
from pixelfixer.api import process

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--step", type=float); ap.add_argument("--cut", action="store_true"); ap.add_argument("--names")
ap.add_argument("--grid"); ap.add_argument("--min", type=int, default=12, help="이보다 작은 조각은 버림(픽셀 수)")
ap.add_argument("--gap", type=int, default=2, help="이 거리 이내 조각은 한 덩어리로")
a = ap.parse_args()

def magenta(arr):   # 마젠타 + 번짐 분홍
    r, g, b = [arr[:, :, i].astype(int) for i in range(3)]
    return ((r > 190) & (b > 190) & (g < 110)) | ((r > 130) & (b > 120) & (g < 100) & ((r - g) > 60))

src = Image.open(a.src).convert("RGBA"); arr = np.array(src)
arr[magenta(arr)] = (255, 0, 255, 255)                     # 번짐도 순수 마젠타로 → 격자 탐지가 깨끗해짐
res = process(arr, force_step=a.step)
fix = np.array(Image.open(io.BytesIO(res["png"])).convert("RGBA"))
m = magenta(fix); fix[m, 3] = 0
# 한 픽셀 테두리 분홍 잔여(마젠타와 섞인 색) 제거: 투명과 맞닿고 분홍기 도는 픽셀
r, g, b = [fix[:, :, i].astype(int) for i in range(3)]
pinkish = (r - g > 50) & (b - g > 40) & (fix[:, :, 3] > 0)
near = np.zeros_like(m); near[1:] |= m[:-1]; near[:-1] |= m[1:]; near[:, 1:] |= m[:, :-1]; near[:, :-1] |= m[:, 1:]
fix[pinkish & near, 3] = 0
print(f"{os.path.basename(a.src)}: {res['cols']}x{res['rows']} step {res['step_x']:.2f}/{res['step_y']:.2f} ({res['confidence']})", file=sys.stderr)

def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im

names = [l.strip() for l in open(a.names, encoding="utf-8")] if a.names else []
img = Image.fromarray(fix)
if not (a.cut or a.grid):
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True); img.save(a.out); sys.exit()
os.makedirs(a.out, exist_ok=True)
pieces = []
if a.grid:
    cx, cy = map(int, a.grid.lower().split("x")); W, H = img.size
    for j in range(cy):
        for i in range(cx):
            pieces.append(trim(img.crop((round(i * W / cx), round(j * H / cy), round((i + 1) * W / cx), round((j + 1) * H / cy)))))
else:
    from scipy import ndimage
    alpha = fix[:, :, 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=a.gap), structure=np.ones((3, 3)))
    boxes = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        ys, xs = sl; area = (alpha[sl] & (lab[sl] == k)).sum()
        if area >= a.min: boxes.append((ys.start, xs.start, ys.stop, xs.stop))
    rowh = np.median([b[2] - b[0] for b in boxes]) if boxes else 1
    boxes.sort(key=lambda b: (int((b[0] + b[2]) / 2 // rowh), b[1]))
    pieces = [trim(img.crop((x0, y0, x1, y1))) for y0, x0, y1, x1 in boxes]
for i, p in enumerate(pieces):
    nm = names[i] if i < len(names) and names[i] else f"p{i:02d}"
    if nm == "-": continue
    p.save(os.path.join(a.out, nm + ".png")); print(i, nm, p.size)
