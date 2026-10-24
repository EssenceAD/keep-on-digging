#!/usr/bin/env python3
"""GPT 확대 픽셀아트 시트 → 네이티브 해상도 PNG. 픽셀 피치(배율)·위상을 자동 탐색(칸 안 분산 최소) 후 칸 가운데 중앙값 샘플.
사용: python3 scripts/sheet_down.py art/raw/mine_signs.png art/yard/signs_native.png --pitch 7.3
"""
import argparse
from PIL import Image
import numpy as np
ap = argparse.ArgumentParser(); ap.add_argument("png"); ap.add_argument("out"); ap.add_argument("--pitch", type=float, required=True); ap.add_argument("--search", type=float, default=0.6)
a = ap.parse_args()
im = np.array(Image.open(a.png).convert("RGB")).astype(float); H, W = im.shape[:2]

D = np.abs(np.diff(im, axis=1)).sum(2).sum(0); DY = np.abs(np.diff(im, axis=0)).sum(2).sum(1)
def score(p, ox, oy):   # 칸 경계가 색 변화와 얼마나 맞는지: 경계 위치의 edge 합 (클수록 좋음)
    d, dy = D, DY
    xs = (np.arange(ox, W - 1, p)).astype(int); ys = (np.arange(oy, H - 1, p)).astype(int)
    return d[xs].sum() / len(xs) + dy[ys].sum() / len(ys)

best = None
for p in np.arange(a.pitch - a.search, a.pitch + a.search, 0.02):
    for ox in np.arange(0, p, max(p / 8, 0.5)):
        for oy in np.arange(0, p, max(p / 8, 0.5)):
            s = score(p, ox, oy)
            if best is None or s > best[0]: best = (s, p, ox, oy)
s, p, ox, oy = best; print("pitch", round(p, 3), "offset", round(ox, 2), round(oy, 2))
cols = int((W - ox) // p); rows = int((H - oy) // p)
out = np.zeros((rows, cols, 3), np.uint8)
for r in range(rows):
    for c in range(cols):
        cx, cy = ox + (c + 0.5) * p, oy + (r + 0.5) * p
        x0, y0 = int(round(cx - p * 0.25)), int(round(cy - p * 0.25)); x1, y1 = max(x0 + 1, int(round(cx + p * 0.25))), max(y0 + 1, int(round(cy + p * 0.25)))
        blk = im[y0:y1, x0:x1].reshape(-1, 3); out[r, c] = np.median(blk, axis=0)
Image.fromarray(out).save(a.out); print("saved", cols, "x", rows)
