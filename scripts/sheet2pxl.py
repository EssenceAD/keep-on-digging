#!/usr/bin/env python3
"""타일·소품 시트(네이티브 해상도, 마젠타 배경) → pxl 파일.
- 팔레트: 시트 색을 최대 60색으로 양자화해 use([...])로 선언 (키 0-9a-zA-Z).
- 타일: 위 N줄을 16×16 격자로 잘라 sprite("t_<row>_<col>") — 격자선(마젠타 섞임)은 안쪽 샘플로 보정.
- 소품: 마젠타 배경 영역에서 연결 요소를 찾아 sprite("p_<i>") (바운딩 박스, 크기순 이름은 --names로 지정 가능).
사용: python3 scripts/sheet2pxl.py art/yard/tiles256.png art/yard/tiles.px.js --tile-rows 4 --names art/yard/prop_names.txt
"""
import sys, argparse
from PIL import Image
import numpy as np

KEYS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
ap = argparse.ArgumentParser()
ap.add_argument("png"); ap.add_argument("out"); ap.add_argument("--tile-rows", type=int, default=4); ap.add_argument("--tile", type=int, default=16)
ap.add_argument("--colors", type=int, default=60); ap.add_argument("--names"); ap.add_argument("--pal-from", help="기존 pxl 파일의 use([...]) 팔레트를 그대로 사용"); ap.add_argument("--no-use", action="store_true", help="use() 줄 생략(include 로 팔레트 공유)"); ap.add_argument("--no-merge", action="store_true"); ap.add_argument("--band", type=int, default=40)
a = ap.parse_args()

im = Image.open(a.png).convert("RGB"); W, H = im.size; arr = np.array(im).astype(int)
mag = ((arr[:, :, 0] > 190) & (arr[:, :, 2] > 190) & (arr[:, :, 1] < 110)) | ((arr[:, :, 0] > 130) & (arr[:, :, 2] > 120) & (arr[:, :, 1] < 100) & ((arr[:, :, 0] - arr[:, :, 1]) > 60))   # 마젠타 + 번짐 분홍
# 격자선(마젠타가 섞인 분홍) 도 배경 취급: 타일 영역에서는 안쪽 픽셀로 대체
T = a.tile; tile_h = a.tile_rows * T + 4 if a.tile_rows else 0
# ---- 팔레트 양자화 (마젠타 제외)
if a.pal_from:
    import re
    m = re.search(r"use\(\[(.*?)\]\)", open(a.pal_from, encoding="utf-8").read(), re.S)
    palrgb = np.array([[int(h[i:i+2], 16) for i in (1, 3, 5)] for h in re.findall(r'"(#[0-9a-fA-F]{6})"', m.group(1))])
else:
    fg = arr[~mag]
    q = Image.fromarray(fg.reshape(1, -1, 3).astype("uint8")).quantize(colors=a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palrgb = np.array(q.getpalette()[: 3 * a.colors]).reshape(-1, 3)
    used = sorted(set(np.array(q).flatten().tolist()))
    palrgb = palrgb[used]
def nearest(rgb):
    d = ((palrgb - rgb) ** 2).sum(1); return int(d.argmin())
cache = {}
def key_at(x, y):
    if mag[y, x]: return "."
    t = tuple(arr[y, x]);
    if t not in cache: cache[t] = KEYS[nearest(np.array(t))]
    return cache[t]

out = []
out.append("// 자동 생성: scripts/sheet2pxl.py ← " + a.png)
if not a.no_use: out.append("use([" + ", ".join('"#%02x%02x%02x"' % tuple(c) for c in palrgb) + "])")
# ---- 타일
cols = W // T
for r in range(a.tile_rows):
    for c in range(cols):
        rows = []
        for y in range(r * T, r * T + T):
            row = ""
            for x in range(c * T, c * T + T):
                k = key_at(x, y)
                rr, gg, bb = arr[y, x]
                if rr > 150 and bb > 150 and gg < 150 and (rr - gg) > 40: k = "."     # 분홍 격자선
                if k == ".":   # 격자선 → 옆 픽셀
                    cx0, cy0 = c * T + T // 2, r * T + T // 2
                    sx, sy = (1 if x < cx0 else -1), (1 if y < cy0 else -1)
                    for step in range(1, 4):
                        for dx, dy in ((sx * step, 0), (0, sy * step), (sx * step, sy * step)):
                            xx, yy = min(max(x + dx, c * T), c * T + T - 1), min(max(y + dy, r * T), r * T + T - 1)
                            r2, g2, b2 = arr[yy, xx]
                            if not (r2 > 150 and b2 > 150 and g2 < 150 and (r2 - g2) > 40) and not mag[yy, xx]: k = key_at(xx, yy); break
                        if k != ".": break
                row += k if k != "." else "0"
            rows.append(row)
        # 타일 가장자리 1px(시트 격자 테두리 흔적) → 안쪽 픽셀 복제, 타일끼리 이음새 없이
        rows[0] = rows[1] = rows[2]; rows[-1] = rows[-2] = rows[-3]
        rows = [rw[2] * 2 + rw[2:-2] + rw[-3] * 2 for rw in rows]
        out.append(f'sprite("t_{r}_{c}", `\n' + "\n".join("  " + s for s in rows) + "\n`)")
# ---- 소품 (연결 요소)
from collections import deque
seen = np.zeros((H, W), bool); props = []
for y in range(tile_h, H):
    for x in range(W):
        if mag[y, x] or seen[y, x]: continue
        qd = deque([(x, y)]); seen[y, x] = True; pts = []
        while qd:
            px, py = qd.popleft(); pts.append((px, py))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = px + dx, py + dy
                    if 0 <= nx < W and tile_h <= ny < H and not seen[ny, nx] and not mag[ny, nx]:
                        seen[ny, nx] = True; qd.append((nx, ny))
        if len(pts) < 12: continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        props.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1))
# 가까운 조각 합치기(같은 소품의 떨어진 부분) — 4px 이내 겹침
merged = not a.no_merge
while merged:
    merged = False
    for i in range(len(props)):
        for j in range(i + 1, len(props)):
            a0, b0, c0, d0 = props[i]; a1, b1, c1, d1 = props[j]
            if a0 - 1 < c1 and a1 - 1 < c0 and b0 - 1 < d1 and b1 - 1 < d0:
                props[i] = (min(a0, a1), min(b0, b1), max(c0, c1), max(d0, d1)); props.pop(j); merged = True; break
        if merged: break
props.sort(key=lambda b: (b[1] // a.band, b[0]))   # 줄 → 왼쪽부터
names = [l.strip() for l in open(a.names, encoding="utf-8")] if a.names else []
for i, (x0, y0, x1, y1) in enumerate(props):
    name = names[i] if i < len(names) and names[i] else f"p_{i}"
    rows = ["".join(key_at(x, y) for x in range(x0, x1)) for y in range(y0, y1)]
    out.append(f'// {name}: {x1-x0}x{y1-y0} @({x0},{y0})\nsprite("{name}", `\n' + "\n".join("  " + s for s in rows) + "\n`)")
open(a.out, "w", encoding="utf-8").write("\n".join(out) + "\n")
print("tiles", a.tile_rows * cols, "props", len(props), "colors", len(palrgb))
for i, b in enumerate(props): print(i, names[i] if i < len(names) else "", b)
