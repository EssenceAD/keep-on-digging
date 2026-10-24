#!/usr/bin/env python3
"""Fan-tasy 무료판 집(짚지붕) → 건물 9종 × Lv1·3·5. 지붕만 골라 색 줄기 바꾸고 기와줄 새김 + 건물별 소품(굴뚝·연기·화덕·모루 등).
  python3 scripts/bld_kit.py <팩 폴더> <출력 폴더> [--preview]
출력: <건물>_<Lv>.png (바닥 가운데 = 그림 아래 가운데) · smoke_f0..5.png · 미리보기 kit_preview.png
"""
import os, sys, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage

PACK, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
A = lambda p: Image.open(os.path.join(PACK, "Art", p)).convert("RGBA")
hx = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)])

# 짚지붕 5단계 (밝음→어두움) — 팩 원색
HAY = ["#f4e555", "#e7c24e", "#e6bf4a", "#dda349", "#bf9c35", "#af7d36", "#c4873c", "#ce9946"]
HAY_LV = {"#f4e555": 0, "#e7c24e": 1, "#e6bf4a": 1, "#dda349": 2, "#ce9946": 2, "#c4873c": 3, "#bf9c35": 3, "#af7d36": 4}
# 지붕 색 줄기 (밝음→어두움, 5단계) — 빨강 외엔 팩 팔레트 색
RAMPS = {
    "slate": ["#9a987d", "#817c68", "#6d6954", "#5a5641", "#4d4439"],   # 돌 회색 — 대장간·포탑
    "wood": ["#b59870", "#9e7f5c", "#8a6745", "#684f39", "#574435"],    # 나무판 — 창고·차고
    "red": ["#ec7a5f", "#de5b49", "#c04a3e", "#9c3b35", "#7a2f2e"],     # 붉은 기와 — 상회·숙소
    "blue": ["#87c7df", "#70b4da", "#5676ac", "#4a5f94", "#3f4c7a"],    # 파란 기와 — 펌프실
    "purple": ["#cbb0e6", "#b399ce", "#9b80b8", "#6d5087", "#53346b"],  # 보라 — 랜턴 공방
    "green": ["#8ace70", "#5fba68", "#57a470", "#377b54", "#2a594a"],   # 이끼 — 두더지 집
}
def roof_mask(a):
    rgb = a[:, :, :3].astype(int); m = np.zeros(a.shape[:2], bool)
    for h in HAY: m |= (np.abs(rgb - hx(h)).sum(2) == 0) & (a[:, :, 3] == 255)
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    keep = np.zeros_like(m)
    for k in range(1, n + 1):
        comp = lab == k; ys = np.nonzero(comp)[0]
        if comp.sum() > 220 and ys.min() < a.shape[0] * 0.55: keep |= comp        # 큰 덩어리 + 위쪽 = 지붕 (문·덧문 제외)
    return keep
def reroof(img, ramp, shingle=True):
    a = np.array(img); m = roof_mask(a); R = [hx(c) for c in RAMPS[ramp]]
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        lv = HAY_LV["#%02x%02x%02x" % tuple(a[y, x, :3])]
        if shingle and lv < 3:
            row = (y - ys.min()) // 4; brick = ((x + row * 3) % 8 == 0)
            if (y - ys.min()) % 4 == 3 or brick: lv = min(4, lv + 1)                 # 기와줄 · 이음매
            elif (y - ys.min()) % 4 == 0 and lv > 0: lv -= 1                          # 줄 윗면 밝게
        a[y, x, :3] = R[lv]
    return Image.fromarray(a)

# ------------------------------------------------------------ 팩 색으로 찍은 작은 소품
def sprite(rows, pal):
    h, w = len(rows), len(rows[0]); im = Image.new("RGBA", (w, h))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".": im.putpixel((x, y), tuple(hx(pal[ch])) + (255,))
    return im
PAL = {"k": "#4d4439", "d": "#5a5641", "m": "#6d6954", "g": "#817c68", "l": "#9a987d", "w": "#d1d1bb", "o": "#dda349", "r": "#de5b49", "y": "#f4e555",
       "b": "#574435", "n": "#684f39", "t": "#9e7f5c", "s": "#b3b094", "c": "#e3e3d5"}
def bricks(w, h, cap=True):                                                  # 돌 굴뚝 (팩 회색 줄기)
    im = Image.new("RGBA", (w, h)); c = lambda k: tuple(hx(PAL[k])) + (255,)
    for y in range(h):
        for x in range(w):
            if x in (0, w - 1) or y == h - 1: im.putpixel((x, y), c("k")); continue
            if cap and y < 3: im.putpixel((x, y), c("k") if y == 0 or y == 2 else c("l")); continue
            row = (y - 3) // 3; mortar = (y - 3) % 3 == 2 or (x + row * 3) % 6 == 0
            im.putpixel((x, y), c("d") if mortar else (c("l") if (y - 3) % 3 == 0 else c("g")))
    return im
def forge():                                                                  # 돌 화덕 + 불 아치
    w, h = 30, 24; im = bricks(w, h, cap=True); c = lambda k: tuple(hx(PAL[k])) + (255,)
    for y in range(9, h - 2):
        for x in range(8, 22):
            r = ((x - 15) / 7.2) ** 2 + ((y - 22) / 13) ** 2
            if r < 1: im.putpixel((x, y), c("k") if r > 0.82 else (c("y") if y > 18 and abs(x - 15) < 3 else c("o") if y > 15 else c("r") if y > 12 else c("k")))
    for x in range(1, w - 1): im.putpixel((x, h - 1), c("k"))
    return im
FORGE = forge(); CHIMNEY_BIG = bricks(14, 26)
CHIMNEY = sprite(["kkkkkkkkkk", "kllllllllk", "kggggggggk", "kkkkkkkkkk", ".kgllkglk.", ".kmggkmgk.", ".kkkkkkkk.", ".kglkgllk.", ".kmgkmggk.", ".kkkkkkkk.", ".kgllkglk.", ".kmggkmgk.", ".kkkkkkkk."], PAL)
ANVIL = sprite(["kkkkkkkkkkkkkkk...", "klllllllllllllkkk.", "kgggggggggggggglk", ".kkkgggggggkkkkkk.", "....kmmmmmk.......", "....kmmmmmk.......", "..kkkkkkkkkkk.....", "..kttttttttttk....", "..knnnnnnnnnnk....", "..kbnnbnnbnnbk....", "..kkkkkkkkkkkk...."], PAL)
COAL = sprite(["...kk.....", "..kdmk.kk.", ".kdmmdkdmk", "kdmkdmmdmk", "kkkkkkkkkk"], PAL)
CART = sprite(["..kk.kkk.kk...", ".kgglkllkglk..", "kkkkkkkkkkkkkk", "kttttttttttttk", "knnnnnnnnnnnnk", "kkkkkkkkkkkkkk", ".kmk......kmk.", "..k........k.."], PAL)
INGOTS = sprite([".kkkk.kkkk.", "koyyokoyyok", "kkkkkkkkkkk", "..kkkk.....", ".koyyok....", ".kkkkkk...."], PAL)
def smoke_frames():
    fr = []
    for f in range(6):
        im = Image.new("RGBA", (16, 28))
        for i in range(3):
            t = (f + i * 2) % 6; y = 24 - t * 4; x = 6 + int(round(2 * np.sin((t + i) * 1.1))); r = 1 + t // 2
            col = tuple(hx(["#e3e3d5", "#d1d1bb", "#b3b094"][min(2, t // 2)])) + (255 if t < 4 else 200,)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r + 1 and 0 <= x + dx < 16 and 0 <= y + dy < 28: im.putpixel((x + dx, y + dy), col)
        fr.append(im)
    return fr
SMOKE = smoke_frames()
for i, f in enumerate(SMOKE): f.save(os.path.join(OUT, f"smoke_f{i}.png"))

# ------------------------------------------------------------ 건물 9종: 집 모형(Lv1·3·5) · 지붕 · 소품 (x는 집 가운데 기준, y는 바닥 기준)
P = lambda n: A(f"Props/{n}.png")
MODEL = {1: "House_Hay_1", 3: "House_Hay_4_Purple", 5: "House_Hay_2"}
SPEC = {
    "office":      {"roof": "red",    "models": {1: "House_Hay_1", 3: "House_Hay_2", 5: "House_Hay_3"}, "props": [("BulletinBoard_1", -56, 4), ("Banner_Stick_1_Purple", 48, 2)]},
    "smelter":     {"roof": "slate",  "chimney": (0.70, -0.06), "props": [(FORGE, -52, 4), (ANVIL, 48, 8), (COAL, 70, 10), ("Barrel_Small_Empty", -76, 8)]},
    "warehouse":   {"roof": "wood",   "props": [("Crate_Large_Empty", -50, 6), ("Crate_Medium_Closed", -34, 10), ("Sack_3", 44, 8), ("Barrel_Small_Empty", 58, 6), ("Barrel_Small_Empty", 66, 10)]},
    "cartshed":    {"roof": "wood",   "props": [(CART, 50, 10), (CART, -54, 8)]},
    "lodge":       {"roof": "red",    "models": {1: "House_Hay_1", 3: "House_Hay_4_Purple", 5: "House_Hay_3"}, "props": [("Bench_1", -52, 6), ("Plant_2", 46, 6), ("Basket_Empty", 58, 8)]},
    "lanternshop": {"roof": "purple", "props": [("LampPost_3", -56, 4), ("LampPost_3", 56, 4)]},
    "pump":        {"roof": "blue",   "props": [("Crate_Water_1", -50, 8), ("Barrel_Small_Empty", 48, 6), ("Barrel_Small_Empty", 58, 10)]},
    "turretshop":  {"roof": "slate",  "props": [(INGOTS, -48, 8), ("Crate_Medium_Closed", 50, 8), ("Crate_Medium_Closed", 60, 4)]},
    "molehome":    {"roof": "green",  "props": [("Plant_2", -44, 6), ("Chopped_Tree_1", 54, 6)]},
}
lineup = []; ANCHOR = {}
for name, sp in SPEC.items():
    for lv in (1, 3, 5):
        base = A(f"Buildings/{sp.get('models', MODEL)[lv]}.png"); house = reroof(base, sp["roof"])
        W = house.width + 170; H = house.height + 60
        im = Image.new("RGBA", (W, H)); cx, by = W // 2, H - 12
        im.alpha_composite(house, (cx - house.width // 2, by - house.height))
        if sp.get("chimney"):
            fx, fy = sp["chimney"]; x = cx - house.width // 2 + int(house.width * fx); y = by - house.height + int(house.height * fy)
            im.alpha_composite(CHIMNEY_BIG, (x, y)); im.alpha_composite(SMOKE[0], (x - 1, max(0, y - 27)))
        props = sp["props"] if lv >= 3 else sp["props"][:2]
        for p, dx, dy in sorted(props, key=lambda p: p[2]):
            pi = P(p) if isinstance(p, str) else p
            ox = cx + (house.width // 2 + 6 if dx > 0 else -house.width // 2 - 6) + (dx - (40 if dx > 0 else -40)) // 2
            im.alpha_composite(pi, (int(ox - pi.width // 2), by + dy - pi.height))
        bb = im.getbbox(); im = im.crop(bb); im.save(os.path.join(OUT, f"{name}_{lv}.png")); lineup.append((name, lv, im))
        ANCHOR[f"{name}_{lv}"] = [cx - bb[0], by - bb[1]]                       # 그림 안에서 건물 바닥 가운데
import json; json.dump(ANCHOR, open(os.path.join(OUT, "anchors.json"), "w"), indent=0)
if "--preview" in sys.argv:
    cols = 3; cw = max(i.width for *_, i in lineup) + 12; ch = max(i.height for *_, i in lineup) + 12
    pv = Image.new("RGBA", (cw * cols, ch * (len(lineup) // cols)), (128, 186, 104, 255))
    for k, (n, lv, i) in enumerate(lineup): pv.alpha_composite(i, ((k % cols) * cw + (cw - i.width) // 2, (k // cols) * ch + ch - i.height - 6))
    pv.save(os.path.join(OUT, "kit_preview.png"))
print("→", OUT, len(lineup))
