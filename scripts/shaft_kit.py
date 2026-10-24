#!/usr/bin/env python3
"""갱도 안 타일 16×16 — Fan-tasy 무료판 질감(흙길·바위 벽·물)을 땅속 색 줄기로 바꾸고 광석·보석·유물을 팩 색으로 찍음. 노멀맵(_n) 같이.
  python3 scripts/shaft_kit.py <팩 폴더> <출력 폴더>
이름은 지금 게임 sprites/ 와 같음: dirt_1~3 · rock · hard_rock · ancient · ore_copper/silver/gold · gem · pocket_water/gas · relic_chest · cave · tunnel · tunnel_beam · ladder · rail
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from tiled_render import load_tsx

PACK, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
hx = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)])
K = "#3c3a2c"
RAMP = {
    "earth": ["#9e7f5c", "#8a6745", "#684f39", "#574435", "#4d4439"],
    "stone": ["#b3b094", "#9a987d", "#817c68", "#6d6954", "#5a5641", "#4d4439"],
    "slate": ["#817c68", "#6d6954", "#5a5641", "#4d4439", "#3c3a2c"],
    "purple": ["#b399ce", "#9b80b8", "#6d5087", "#53346b", "#3c3a2c"],
    "dark": ["#5a5641", "#4d4439", "#4d4439", "#3c3a2c", "#3c3a2c"],
}
def regrade(img, ramp):                                                  # 밝기 순위대로 색 줄기에 다시 칠함
    a = np.array(img.convert("RGBA")).astype(int); op = a[:, :, 3] > 0
    lum = (a[:, :, :3] * [0.3, 0.59, 0.11]).sum(2); cols = sorted({tuple(c) for c in a[op][:, :3]}, key=lambda c: -(c[0] * .3 + c[1] * .59 + c[2] * .11))
    R = [hx(c) for c in RAMP[ramp]]; out = a.copy()
    for i, c in enumerate(cols):
        m = (a[:, :, :3] == c).all(2) & op; out[m, :3] = R[min(len(R) - 1, int(i * len(R) / len(cols)))]
    return Image.fromarray(out.astype(np.uint8))
def spr(rows, pal):
    im = Image.new("RGBA", (len(rows[0]), len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".": im.putpixel((x, y), tuple(hx(pal[ch])) + (255,))
    return im
road = load_tsx(os.path.join(PACK, "Tiled/Tilesets/Tilesets_Road.tsx")); water = load_tsx(os.path.join(PACK, "Tiled/Tilesets/Tileset_Water.tsx"))
wall = Image.open(os.path.join(PACK, "Art/Rock Slopes/Tileset_RockSlope.png")).convert("RGBA").crop((18, 432, 62, 480))
T = {}
for i, tid in enumerate((8, 49, 55)): T[f"dirt_{i + 1}"] = regrade(road.tile(tid), "earth")
rock16 = wall.crop((14, 16, 30, 32)); T["rock"] = regrade(rock16, "stone")
T["hard_rock"] = regrade(wall.crop((4, 26, 20, 42)), "slate"); T["ancient"] = regrade(wall.crop((24, 6, 40, 22)), "purple")
for x, y in ((3, 4), (7, 9), (11, 3), (12, 12)):                          # 단단한 바위 금 · 고대석 문양
    T["hard_rock"].putpixel((x, y), tuple(hx(K)) + (255,))
NUG = ["kk.", "kak", ".kb"]
def ore(base, cols, spots):
    im = base.copy(); a, b = cols
    for x0, y0 in spots:
        for dy, r in enumerate(["kkk.", "kabk", "kbbk", ".kk."]):
            for dx, ch in enumerate(r):
                if ch != "." and 0 <= x0 + dx < 16 and 0 <= y0 + dy < 16: im.putpixel((x0 + dx, y0 + dy), tuple(hx({"k": K, "a": a, "b": b}[ch])) + (255,))
    return im
SP = [(2, 3), (9, 2), (5, 9), (11, 10)]
T["ore_copper"] = ore(T["rock"], ("#ce9946", "#af7d36"), SP)
T["ore_silver"] = ore(T["rock"], ("#f3f3e6", "#a3a7c2"), SP)
T["ore_gold"] = ore(T["rock"], ("#f4e555", "#dda349"), SP)
T["gem"] = T["rock"].copy(); T["gem"].alpha_composite(spr(["....k.......", "...kxk...k..", "..kxxzk.kxk.", "..kxzzk.kxzk", ".kxzzqkkxzqk", ".kzzqqkkzqqk", "..kqqk..kqk.", "...kk....k.."], {"k": K, "x": "#e8e8f8", "z": "#87c7df", "q": "#5676ac"}), (2, 4))
blob = ["....kkkk....", "..kkaaaakk..", ".kaaabbaaak.", "kaabbbbbbaak", "kabbbccbbbak", "kabbccccbbak", ".kabbccbbak.", "..kkaaaakk..", "....kkkk...."]
def pocket(base, a, b, c):
    im = base.copy(); im.alpha_composite(spr(blob, {"k": K, "a": a, "b": b, "c": c}), (2, 3)); return im
T["pocket_water"] = pocket(T["rock"], "#5676ac", "#70b4da", "#87c7df")
T["pocket_gas"] = pocket(T["rock"], "#377b54", "#5fba68", "#8ace70")
T["tunnel"] = regrade(road.tile(50), "dark")
T["cave"] = pocket(T["dirt_2"], "#4d4439", "#3c3a2c", "#3c3a2c")
chest = spr(["..kkkkkkkk..", ".knnnnnnnnk.", "kttttttttttk", "kkkkkyykkkkk", "knnnkookknnk", "knnnnkknnnnk", "knnnnnnnnnnk", "kkkkkkkkkkkk"], {"k": K, "n": "#684f39", "t": "#9e7f5c", "y": "#f4e555", "o": "#dda349"})
T["relic_chest"] = T["dirt_1"].copy(); T["relic_chest"].alpha_composite(chest, (2, 5))
beam = Image.new("RGBA", (16, 16)); beam.alpha_composite(T["tunnel"])
for x0 in (0, 13):
    for y in range(16):
        for dx in range(3): beam.putpixel((x0 + dx, y), tuple(hx(K if dx in (0, 2) and (x0 + dx) in (0, 15) else ("#9e7f5c" if dx == 1 else "#684f39"))) + (255,))
for y in range(0, 3):
    for x in range(16): beam.putpixel((x, y), tuple(hx(K if y in (0, 2) else "#9e7f5c")) + (255,))
T["tunnel_beam"] = beam
lad = Image.new("RGBA", (16, 16))
for y in range(16):
    for x in (3, 4, 11, 12): lad.putpixel((x, y), tuple(hx(K if x in (3, 12) else "#9e7f5c")) + (255,))
    if y % 4 == 1:
        for x in range(4, 12): lad.putpixel((x, y), tuple(hx("#9e7f5c")) + (255,)); lad.putpixel((x, y + 1), tuple(hx("#684f39")) + (255,))
T["ladder"] = lad
rail = Image.new("RGBA", (16, 4))
for x in range(16):
    rail.putpixel((x, 0), tuple(hx("#9a987d")) + (255,)); rail.putpixel((x, 1), tuple(hx("#5a5641")) + (255,))
    if x % 5 in (1, 2):
        for y in (2, 3): rail.putpixel((x, y), tuple(hx("#684f39")) + (255,))
T["rail"] = rail
def normal(img):                                                         # 밝기 → 높이 → 노멀 (게임 조명용, 기존 _n 형식)
    a = np.array(img.convert("RGBA")).astype(float); h = (a[:, :, :3] * [0.3, 0.59, 0.11]).sum(2) / 255
    gx = np.zeros_like(h); gy = np.zeros_like(h); gx[:, 1:-1] = h[:, 2:] - h[:, :-2]; gy[1:-1, :] = h[2:, :] - h[:-2, :]
    n = np.dstack([-gx * 2.2, -gy * 2.2, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    out = np.dstack([(n * 127.5 + 127.5).clip(0, 255), a[:, :, 3]]).astype(np.uint8); return Image.fromarray(out)
for k, im in T.items():
    im.save(os.path.join(OUT, k + ".png"))
    if k in ("dirt_1", "dirt_2", "dirt_3", "rock", "hard_rock", "ore_copper", "ore_gold", "ore_silver", "ancient", "pocket_water", "pocket_gas", "relic_chest"): normal(im).save(os.path.join(OUT, k + "_n.png"))
names = list(T); pv = Image.new("RGBA", (len(names) * 20, 22), (40, 40, 48, 255))
for i, k in enumerate(names): pv.alpha_composite(T[k], (i * 20 + 2, 2))
pv.resize((pv.width * 4, pv.height * 4), Image.NEAREST).save(os.path.join(OUT, "shaft_preview.png"))
# 5×5 시험 갱도
L = [["rock", "dirt_1", "dirt_2", "ore_gold", "rock"], ["dirt_3", "tunnel", "tunnel", "dirt_1", "hard_rock"], ["ore_copper", "tunnel_beam", "ladder", "gem", "dirt_2"], ["pocket_water", "dirt_2", "tunnel", "relic_chest", "ancient"], ["rock", "ore_silver", "pocket_gas", "dirt_1", "rock"]]
g = Image.new("RGBA", (80, 80))
for y, r in enumerate(L):
    for x, k in enumerate(r): g.alpha_composite(T[k], (x * 16, y * 16))
g.resize((320, 320), Image.NEAREST).save(os.path.join(OUT, "shaft_sample.png"))
print("→", OUT, len(T))
