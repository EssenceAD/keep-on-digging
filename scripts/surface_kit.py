#!/usr/bin/env python3
"""광산 화면 지상띠 256×120 — 팩 그림체(풀 타일·나무·가로등·창고) + 팩 색으로 찍은 갱도 망루(헤드프레임).
  python3 scripts/surface_kit.py <팩 폴더> <출력 폴더>
갱도 구멍 = x 64~80 (옛 surface.png 와 같은 자리). 땅 윗선 y = 112 (옛 그림의 y 40 자리) → 게임은 y −72 에 그리면 옛 땅선과 맞음.
출력: surface.png · sky.png(128×96 반복용 밤하늘 — 옛 sky_far 대체) · surface_preview.png
"""
import os, sys, random
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from tiled_render import load_tsx
PACK, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
A = lambda p: Image.open(os.path.join(PACK, "Art", p)).convert("RGBA")
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
W, H, GY = 256, 120, 112
rng = random.Random(5)
def shade(im, k):
    a = np.array(im).astype(float); a[:, :, :3] *= k; return Image.fromarray(a.clip(0, 255).astype(np.uint8))
# 하늘: 해질녘 (팩 색 줄기: 남색→보라→분홍빛 지평)
SKY = ["#3f4c7a", "#4a5f94", "#5676ac", "#6d5087", "#9b80b8", "#cbb0e6"]
def sky_img(w, h):
    im = Image.new("RGBA", (w, h)); band = h / len(SKY)
    for y in range(h):
        i = min(len(SKY) - 1, int(y / band)); c = hx(SKY[i])
        nxt = hx(SKY[min(len(SKY) - 1, i + 1)])
        for x in range(w):
            dither = (y % band) > band * 0.75 and (x + y) % 2 == 0          # 띠 경계 2px 디더
            im.putpixel((x, y), nxt if dither else c)
    for _ in range(w * h // 260):                                              # 별
        x, y = rng.randrange(w), rng.randrange(int(h * 0.5)); im.putpixel((x, y), hx("#f3f3e6"))
    return im
S = sky_img(W, H)
# 먼 숲 실루엣 (팩 나무를 어둡게) + 가까운 나무
trees = [A(f"Trees and Bushes/Tree_Emerald_{i}.png") for i in (1, 2, 3, 4)]
for x in range(-20, W + 20, 22): t = rng.choice(trees); S.alpha_composite(shade(t, 0.42), (x, GY - t.height + 6 - rng.randrange(0, 10)))
for x in (110, 150, 232): t = rng.choice(trees); S.alpha_composite(shade(t, 0.7), (x - t.width // 2, GY - t.height + 2))
# 땅: 팩 풀 타일 한 줄 + 흙 테두리
g = load_tsx(os.path.join(PACK, "Tiled/Tilesets/Tileset_Ground.tsx"))
for x in range(0, W, 16): S.alpha_composite(shade(g.tile(rng.choice([14, 20, 96, 97, 98])), 0.85), (x, GY))
for x in range(W): S.putpixel((x, H - 1), hx("#574435"))
# 창고 (부지 키트의 창고 Lv1 그림, 오른쪽 끝)
wh = Image.open(os.path.join(os.path.dirname(OUT.rstrip("/")), "bld", "warehouse_1.png")).convert("RGBA")
S.alpha_composite(shade(wh, 0.9), (W - wh.width + 14, GY + 6 - wh.height))
# 가로등
lp = A("Props/LampPost_3.png"); S.alpha_composite(lp, (118 - lp.width // 2, GY + 4 - lp.height))
S.alpha_composite(A("Props/Crate_Medium_Closed.png"), (96, GY + 4 - 21)); S.alpha_composite(A("Props/Barrel_Small_Empty.png"), (20, GY + 4 - 20))
# 갱도 망루: 나무 A자 틀 + 도르래 (팩 나무·쇠 색)
K, WL, WM, WD, IR, IL = hx("#3c3a2c"), hx("#b59870"), hx("#9e7f5c"), hx("#684f39"), hx("#5a5641"), hx("#9a987d")
def line(x0, y0, x1, y1, w=3):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        for d in range(-1, w):
            col = K if d in (-1, w - 1) else (WL if d == 0 else WM)
            if 0 <= x + d < W and 0 <= y < H: S.putpixel((x + d, y), col)
top = GY - 58
line(58, GY, 70, top); line(86, GY, 74, top)                              # 두 다리
for yy, (a, b) in ((GY - 18, (62, 81)), (GY - 36, (66, 78))):            # 가로대
    for x in range(a, b + 1):
        S.putpixel((x, yy), K); S.putpixel((x, yy + 1), WM); S.putpixel((x, yy + 2), K)
for dx in range(-7, 8):                                                   # 도르래
    for dy in range(-7, 8):
        r = dx * dx + dy * dy
        if r <= 49: S.putpixel((72 + dx, top + dy), K if r > 36 else (IL if r < 9 else IR))
for y in range(top, GY):                                                  # 줄
    S.putpixel((72, y), WD)
for y in range(GY, H):                                                    # 갱도 구멍
    for x in range(64, 81): S.putpixel((x, y), K)
S.save(os.path.join(OUT, "surface.png")); sky_img(128, 96).save(os.path.join(OUT, "sky.png"))
S.resize((W * 4, H * 4), Image.NEAREST).save(os.path.join(OUT, "surface_preview.png"))
open(os.path.join(OUT, "README.md"), "w", encoding="utf-8").write(
    "# 광산 화면 지상띠 (PATCH_V15 §8)\n- `surface.png` 256×120: 옛 `scenes/surface.png`(256×48) 대체. **y = −72** 에 그리면 땅 윗선(y 112)이 옛 땅선(y 40)과 같음. 갱도 구멍 x 64~80 그대로.\n"
    "- `sky.png` 128×96: 옛 `sky_far` 대체(같은 반복 방식). 해질녘 하늘 + 별.\n- 낮·밤 색은 지금처럼 위에서 곱하기.\n")
print("→", OUT)
