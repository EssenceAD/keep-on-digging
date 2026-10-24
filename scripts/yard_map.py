#!/usr/bin/env python3
"""돌망치 상회 부지 v5 — The Fan-tasy Tileset(무료판·비상업, Ventilatore) 오토타일로 960×540 맵 조립.
  python3 scripts/yard_map.py <팩 폴더> <출력 폴더> [--mock]
출력: yard_ground_f{0-3}.png(바닥+물 4프레임) · yard_back.png(건물 뒤 나무·소품) · yard_front.png(건물 앞) · yard_v5.json(터·길·자리 좌표)
--mock: 건물을 몇 채 세운 확인용 합성 yard_mock.png
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from tiled_render import load_tsx, autotile, render

PACK, OUT = sys.argv[1], sys.argv[2]; MOCK = "--mock" in sys.argv
T = 16; W, H = 960, 540; GW, GH = W // T, (H + T - 1) // T          # 60 × 34
TS = lambda n: load_tsx(os.path.join(PACK, "Tiled", "Tilesets", n + ".tsx"))
A = lambda p: Image.open(os.path.join(PACK, "Art", p)).convert("RGBA")
rng = random.Random(7)
os.makedirs(OUT, exist_ok=True)

# ------------------------------------------------------------ 터 9곳 (건물 바닥 가운데 cx, by) — 3×3, 위→아래·왼→오
LOTS = [(232, 196), (464, 196), (696, 196), (232, 336), (464, 336), (696, 336), (232, 476), (464, 476), (696, 476)]
LOT_W, LOT_H = 184, 132                                                   # 최대 건물(Lv5 180×128) 자리
ENTRANCE = (868, 150)                                                     # 갱도 입구 바닥 가운데

def grid(v=0): return [[v] * GW for _ in range(GH)]
def fill(g, x0, y0, x1, y1, v):                                           # 픽셀 좌표 사각형 → 칸
    for y in range(max(0, y0 // T), min(GH, (y1 + T - 1) // T)):
        for x in range(max(0, x0 // T), min(GW, (x1 + T - 1) // T)): g[y][x] = v
def blob(g, cx, cy, rx, ry, v, jag=0.25):                                 # 들쭉날쭉 타원
    for y in range(GH):
        for x in range(GW):
            px, py = x * T + 8, y * T + 8; d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2
            if d < 1 - jag * rng.random(): g[y][x] = v

# ------------------------------------------------------------ 바닥: 풀(1) / 흙(2)
ground = grid(1)
for cx, by in LOTS: blob(ground, cx, by - 2, 64, 16, 2)                              # 집 앞 다진 흙 (집 밑동만)
blob(ground, ENTRANCE[0], ENTRANCE[1] + 10, 84, 30, 2)
for _ in range(4): blob(ground, rng.randrange(60, 900), rng.randrange(260, 520), rng.randrange(16, 28), rng.randrange(12, 18), 2, 0.4)

# ------------------------------------------------------------ 길 (모래빛 흙길) — 1 = 길
road = grid(0)
def path(pts, w=2):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) // 4 + 1
        for i in range(n + 1):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            fill(road, int(x - w * 8), int(y - w * 8), int(x + w * 8), int(y + w * 8), 1)
MAIN = [(0, 252), (120, 256), (330, 250), (580, 254), (790, 248), (840, 214), (868, 168)]
LOWER = [(110, 400), (340, 396), (580, 400), (800, 394)]
path(MAIN); path(LOWER); path([(120, 256), (110, 400), (118, 520)]); path([(800, 394), (790, 248)])
for cx, by in LOTS: path([(cx + 20, by + 4), (cx + 20, by + 24 if by < 250 else by + 28)], 1)   # 문 앞 샛길
# ------------------------------------------------------------ 물: 왼쪽 아래 개울 (1 = 물)
water = grid(0)
for y in range(GH):
    for x in range(GW):
        px, py = x * T + 8, y * T + 8
        if (py > 290 and px < 46 + 18 * ((py // 40) % 2)) or (py > 470 and px < 300 - (py - 470) * 0) and py > 500 - (px // 60) * 6: water[y][x] = 1
for y in range(GH):
    for x in range(GW):
        if water[y][x]: road[y][x] = 0; ground[y][x] = 1

# ------------------------------------------------------------ 오토타일
gTS, rTS, wTS = TS("Tileset_Ground"), TS("Tilesets_Road"), TS("Tileset_Water")
gt = autotile([[1 if v == 1 else 0 for v in r] for r in ground], gTS, 1, rng)
# 풀이 아닌 칸(흙) = 흙 꽉 찬 타일, 풀 가장자리 칸은 0 대신 2(흙) 로 다시 고름
from tiled_render import pick
for y in range(GH):
    for x in range(GW):
        if ground[y][x] == 2: gt[y][x] = 95
        else:
            n = [ground[min(max(y + dy, 0), GH - 1)][min(max(x + dx, 0), GW - 1)] == 1 for dx, dy in ((0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1))]
            n[1] = n[1] and n[0] and n[2]; n[3] = n[3] and n[2] and n[4]; n[5] = n[5] and n[4] and n[6]; n[7] = n[7] and n[6] and n[0]
            if all(n): gt[y][x] = rng.choice([14, 20, 96, 97, 98, 99, 100, 101, 108, 109, 110, 111, 112, 113])
            else: gt[y][x] = pick(gTS, tuple(1 if v else 2 for v in n), rng)[0]
rt = autotile(road, rTS, 1, rng)
for y in range(GH):
    for x in range(GW):
        if rt[y][x] == 8: rt[y][x] = rng.choice([8, 8, 8, 48, 49, 50, 54, 55, 56])
wt = autotile(water, wTS, 1, rng)

# ------------------------------------------------------------ 오브젝트
trees = [A(f"Trees and Bushes/Tree_Emerald_{i}.png") for i in (1, 2, 3, 4)]
bushes = [A(f"Trees and Bushes/Bush_Emerald_{i}.png") for i in range(1, 8)]
rocks = [A(f"Rocks/Rock_Brown_{i}.png") for i in (1, 2, 4, 6, 9)]
P = lambda n: A(f"Props/{n}.png")
shadow = lambda w: A("Shadows/Shadow_Round_48x24_Medium_Black.png" if w > 40 else "Shadows/Shadow_Round_32x16_Medium_Black.png")
back, front = [], []                          # (img, x, y_bottom)  back = 건물보다 뒤(위쪽), front = 건물 앞
def put(img, cx, by, layer=None, sh=False):
    o = (img, cx - img.width // 2, by)
    (layer if layer is not None else (front if any(abs(cx - lx) < LOT_W / 2 and by > ly for lx, ly in LOTS) else back)).append(o)
    if sh: s = shadow(img.width); s = s.copy(); s.putalpha(s.getchannel("A").point(lambda a: a * 0.35)); back.insert(0, (s, cx - s.width // 2, by + 4))
def free(cx, by, r=20):
    if water[min(GH - 1, by // T)][min(GW - 1, max(0, cx // T))] or road[min(GH - 1, by // T)][min(GW - 1, max(0, cx // T))]: return False
    for lx, ly in LOTS:
        if abs(cx - lx) < LOT_W / 2 + r * 0.3 and ly - LOT_H - 6 < by < ly + 14: return False
    if abs(cx - ENTRANCE[0]) < 100 and by < ENTRANCE[1] + 50: return False
    return True
# 숲 테두리: 위 가장자리 촘촘히, 오른쪽, 아래 오른쪽
for y in range(-10, 90, 22):
    for x in range(-20, W + 30, 30):
        cx, by = x + rng.randrange(-8, 9), y + rng.randrange(-6, 7) + 60
        if abs(cx - ENTRANCE[0]) < 90 and by > 60: continue
        put(rng.choice(trees), cx, by, back, sh=False)
for by in range(110, H + 80, 26):
    for cx in (W - 8 + rng.randrange(-6, 6), W + 18):
        if free(cx, by): put(rng.choice(trees), cx, by, front if by > 420 else back)
for cx in range(330, W + 30, 34):
    put(rng.choice(trees), cx + rng.randrange(-6, 7), H + 46 + rng.randrange(0, 10), front)
# 터 사이 나무·덤불·바위 흩기
for _ in range(220):
    cx, by = rng.randrange(40, W - 30), rng.randrange(110, H)
    if not free(cx, by): continue
    r = rng.random()
    if r < 0.12: put(rng.choice(trees), cx, by)
    elif r < 0.55: put(rng.choice(bushes), cx, by)
    elif r < 0.75: put(rng.choice(rocks), cx, by)
# 소품
for (n, cx, by) in [("LampPost_3", 340, 236), ("LampPost_3", 600, 238), ("LampPost_3", 360, 384), ("Banner_Stick_1_Purple", 790, 172), ("Banner_Stick_1_Purple", 946, 172),
                    ("BulletinBoard_1", 150, 236), ("Sign_1", 30, 236), ("HayStack_2", 590, 520), ("Crate_Large_Empty", 806, 196), ("Crate_Medium_Closed", 822, 200), ("Barrel_Small_Empty", 920, 196),
                    ("Bench_1", 568, 410), ("Chopped_Tree_1", 140, 470), ("Table_Medium_1", 80, 330), ("Crate_Water_1", 300, 470), ("Sack_3", 934, 198), ("Basket_Empty", 590, 290)]:
    put(P(n), cx, by)
fire = Image.open(os.path.join(PACK, "Art/Props/Animation/Animation_Campfire.png")).convert("RGBA")
fires = [fire.crop((i * 32, 0, i * 32 + 32, 32)) for i in range(fire.width // 32)]
put(fires[0], 580, 380, back)

# ------------------------------------------------------------ 갱도 입구 (팩 바위 벽 2조각 + 팩 73색 안에서 찍은 동굴·나무 틀·레일)
def entrance():
    rock = Image.open(os.path.join(PACK, "Art/Rock Slopes/Tileset_RockSlope.png")).convert("RGBA").crop((18, 432, 62, 480))   # 44×48 바위 벽
    im = Image.new("RGBA", (132, 66), (0, 0, 0, 0)); im.alpha_composite(rock, (0, 0)); im.alpha_composite(rock.transpose(Image.FLIP_LEFT_RIGHT), (44, 0)); im.alpha_composite(rock, (88, 0))
    px = im.load(); hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    DARK, DEEP_, WL, WM, WD, OUT, RAIL, TIE = hx("#4d4439"), hx("#53346b"), hx("#b59870"), hx("#9e7f5c"), hx("#684f39"), hx("#4d4439"), hx("#9a987d"), hx("#664c35")
    cx, top, bot = 66, 18, 50
    for y in range(top, bot):                                   # 동굴 (위 둥근 아치)
        half = 13 if y > top + 4 else 13 - (top + 4 - y) * 2
        for x in range(cx - half, cx + half): px[x, y] = hx("#5a5641") if abs(x - cx) >= half - 1 else DARK
    for x0 in (cx - 17, cx + 13):                               # 기둥
        for y in range(top - 2, bot):
            for x in range(x0, x0 + 4): px[x, y] = OUT if x in (x0, x0 + 3) else (WL if x == x0 + 1 else WM)
    for y in range(top - 6, top - 1):                           # 들보
        for x in range(cx - 20, cx + 20): px[x, y] = OUT if y in (top - 6, top - 2) or x in (cx - 20, cx + 19) else (WL if y == top - 5 else WM)
    for x in range(cx - 16, cx + 16, 6): px[x, top - 4] = WD
    for y in range(bot, 66):                                    # 레일 두 줄 + 침목
        for x in (cx - 6, cx + 5): px[x, y] = RAIL
        if (y - bot) % 4 == 1:
            for x in range(cx - 8, cx + 8): px[x, y] = TIE if px[x, y][3] == 0 or px[x, y] != RAIL else RAIL
    return im
ent = entrance(); back.append((ent, ENTRANCE[0] - 66, ENTRANCE[1] + 16))

# ------------------------------------------------------------ 출력
for f in range(4):
    render(W, H, [(gTS, gt), (rTS, rt), (wTS, wt)], [], frame=f, bg=(160, 147, 138, 255)).save(os.path.join(OUT, f"yard_ground_f{f}.png"))
render(W, H, [], back).save(os.path.join(OUT, "yard_back.png"))
render(W, H, [], front).save(os.path.join(OUT, "yard_front.png"))
json.dump({"size": [W, H], "lots": [{"id": i, "cx": cx, "by": by, "w": LOT_W, "h": LOT_H} for i, (cx, by) in enumerate(LOTS)],
           "entrance": ENTRANCE, "road": MAIN, "lower": LOWER, "campfire": [580, 372], "credit": "The Fan-tasy Tileset (Free) by Ventilatore — non-commercial"},
          open(os.path.join(OUT, "yard_v5.json"), "w"), indent=1)
if MOCK:
    B = lambda n: A(f"Buildings/{n}.png")
    img = Image.open(os.path.join(OUT, "yard_ground_f0.png")); img.alpha_composite(Image.open(os.path.join(OUT, "yard_back.png")))
    for (cx, by), n in zip(LOTS, ["House_Hay_3", "House_Hay_2", "House_Hay_4_Purple", "House_Hay_1", None, "House_Hay_1", "Well_Hay_1", None, "House_Hay_2"]):
        if n: b = B(n); img.alpha_composite(b, (cx - b.width // 2, by - b.height))
    img.alpha_composite(Image.open(os.path.join(OUT, "yard_front.png")))
    img.save(os.path.join(OUT, "yard_mock.png"))
print("→", OUT)
