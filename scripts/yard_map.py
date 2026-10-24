#!/usr/bin/env python3
"""돌망치 상회 부지 v5.1 — The Fan-tasy Tileset(무료판·비상업, Ventilatore) 오토타일로 960×540 맵 조립. (유기적 배치: 엇갈린 터 · 구불길 · 들쭉날쭉 숲)
  python3 scripts/yard_map.py <팩 폴더> <출력 폴더> [--mock]
출력: yard_ground_f{0-3}.png(바닥+물 4프레임) · yard_back.png(건물 뒤) · yard_front.png(건물 앞) · yard_v5.json · --mock 이면 yard_mock.png
"""
import json, math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from tiled_render import load_tsx, autotile, render, pick

PACK, OUT = sys.argv[1], sys.argv[2]; MOCK = "--mock" in sys.argv
T = 16; W, H = 960, 540; GW, GH = W // T, (H + T - 1) // T
TS = lambda n: load_tsx(os.path.join(PACK, "Tiled", "Tilesets", n + ".tsx"))
NAMES = {}
def A(p):
    im = Image.open(os.path.join(PACK, "Art", p)).convert("RGBA"); NAMES[id(im)] = os.path.splitext(os.path.basename(p))[0].lower(); return im
rng = random.Random(11); os.makedirs(OUT, exist_ok=True)
def noise(x, s=1.0):                                                       # 부드러운 1D 노이즈
    return sum(math.sin(x * f * s + p) * a for f, p, a in ((0.013, 1.3, 1.0), (0.031, 4.1, 0.5), (0.071, 2.2, 0.25))) / 1.75

# ------------------------------------------------------------ 터 9곳 (건물 바닥 가운데 cx, by) — 엇갈려 앉힘. 위 줄 4 · 아래 줄 3 · 맨 아래 2
LOTS = [(130, 196), (342, 206), (562, 214), (782, 190), (172, 414), (390, 446), (660, 410), (846, 500), (572, 538)]
LOT_W, LOT_H = 180, 128
ENTRANCE = (868, 292)
def lot_box(cx, by, pad=0): return (cx - LOT_W / 2 - pad, by - LOT_H - pad, cx + LOT_W / 2 + pad, by + pad)

def grid(v=0): return [[v] * GW for _ in range(GH)]
def cells():
    for y in range(GH):
        for x in range(GW): yield x, y, x * T + 8, y * T + 8
def blob(g, cx, cy, rx, ry, v, jag=0.3):
    for x, y, px, py in cells():
        d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2
        if d < 1 - jag * rng.random(): g[y][x] = v
def spline(pts, step=3):                                                    # Catmull-Rom
    P = [pts[0]] + pts + [pts[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]; n = max(2, int(math.dist(p1, p2) / step))
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    return out + [pts[-1]]
def stroke(g, pts, r, v):
    for cx, cy in spline(pts):
        for x, y, px, py in cells():
            if (px - cx) ** 2 + (py - cy) ** 2 < r * r: g[y][x] = v

# ------------------------------------------------------------ 물: 왼쪽 아래로 휘어 나가는 개울
water = grid(0)
stroke(water, [(-20, 442), (60, 462), (128, 488), (180, 520), (214, 560)], 30, 1)
for x, y, px, py in cells():
    if py > 500 and px < 120: water[y][x] = 1

# ------------------------------------------------------------ 길: 한 줄기 구불길 + 갈래 둘 + 문 앞 샛길
road = grid(0)
SPINE = [(-10, 258), (96, 262), (206, 256), (300, 264), (420, 270), (520, 262), (626, 268), (722, 260), (806, 278), (868, 304)]
stroke(road, SPINE, 18, 1)
BR1 = [(300, 264), (286, 330), (290, 410), (300, 480), (288, 548)]; stroke(road, BR1, 17, 1)
BR2 = [(520, 262), (520, 330), (522, 400), (526, 470), (520, 548)]; stroke(road, BR2, 17, 1)
for pts in ([(286, 428), (190, 428)], [(292, 460), (408, 460)], [(520, 424), (678, 424)], [(524, 548), (590, 548)], [(806, 300), (752, 420), (760, 514), (864, 514)]): stroke(road, pts, 13, 1)
for i in range(4): cx, by = LOTS[i]; stroke(road, [(cx + 18, by + 2), (cx + 18, by + 60)], 13, 1)
for x, y, *_ in cells():
    if water[y][x]: road[y][x] = 0

# ------------------------------------------------------------ 바닥: 풀(1)/흙(2) — 문 앞·광장·갱도 앞만 흙, 가장자리 들쭉날쭉
ground = grid(1)
for cx, by in LOTS: blob(ground, cx + 10, by + 2, 52, 13, 2, 0.45)
blob(ground, ENTRANCE[0] - 20, ENTRANCE[1] + 4, 70, 30, 2); blob(ground, 806, 346, 40, 18, 2)       # 갱도 앞 · 모닥불 광장

for x, y, *_ in cells():
    if water[y][x]: ground[y][x] = 1

# ------------------------------------------------------------ 둔덕: 윗줄 집들이 앉는 높은 땅 (U) → 입력(2 윗선 · 1 벽면 · 3 계단) → 팩 자동 매핑 규칙
from automap import load_rules, apply as automap
edge_row = []
for x in range(GW):
    px = x * T + 8; ys = [by for cx, by in LOTS[:4] if abs(px - cx) < LOT_W / 2 + 10]
    edge_row.append((max(ys) + 14) // T if ys else (200 + int(10 * noise(px))) // T)
for i in range(1, GW - 1):                                                  # 1칸짜리 튐 없애기
    if edge_row[i - 1] == edge_row[i + 1] != edge_row[i]: edge_row[i] = edge_row[i - 1]
U = [[y < edge_row[x] for x in range(GW)] for y in range(GH)]
LG = grid(0)
outside = lambda x, y: 0 <= x < GW and 0 <= y < GH and not U[y][x]
for x, y, *_ in cells():
    if U[y][x] and any(outside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1))): LG[y][x] = 2
for x, y, *_ in cells():
    if LG[y][x] == 2:
        for dx, dy in ((0, 1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if outside(nx, ny) and LG[ny][nx] == 0 and (dy == 1 or not (ny + 1 < GH and U[ny + 1][nx])): LG[ny][nx] = 1
for cx, by in LOTS[:4]:                                                     # 문 앞 돌계단 (벽면 줄, 3칸)
    sx = (cx + 18) // T - 1; sy = edge_row[(cx + 18) // T]
    for k in range(3):
        if LG[sy][sx + k] == 1: LG[sy][sx + k] = 3
sx = 46 // T; sy = edge_row[sx]                                              # 왼쪽 끝 계단 (게시판 앞)
for k in range(3): LG[sy][sx + k] = 3 if LG[sy][sx + k] == 1 else LG[sy][sx + k]
RULES = load_rules(os.path.join(PACK, "Tiled/Tilemaps/Rules/RockSlopes_Rules.tmx"))[::-1]
lt = automap(RULES, LG, 0, False); lTS = TS("Tileset_RockSlope")
for x, y, *_ in cells():                                                    # 벽면 칸엔 길·물 없음 (계단 칸은 길 유지)
    if LG[y][x] in (1, 2) and y >= edge_row[x] - 1: road[y][x] = 0

# ------------------------------------------------------------ 오토타일
gTS, rTS, wTS = TS("Tileset_Ground"), TS("Tilesets_Road"), TS("Tileset_Water")
GRASS = [14, 20, 96, 97, 98, 99, 100, 101, 108, 109, 110, 111, 112, 113]
gt = grid(None)
for x, y, *_ in cells():
    if ground[y][x] == 2: gt[y][x] = 95; continue
    n = [ground[min(max(y + dy, 0), GH - 1)][min(max(x + dx, 0), GW - 1)] == 1 for dx, dy in ((0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1))]
    n[1] = n[1] and n[0] and n[2]; n[3] = n[3] and n[2] and n[4]; n[5] = n[5] and n[4] and n[6]; n[7] = n[7] and n[6] and n[0]
    gt[y][x] = rng.choice(GRASS) if all(n) else pick(gTS, tuple(1 if v else 2 for v in n), rng)[0]
rt = autotile(road, rTS, 1, rng)
for x, y, *_ in cells():
    if rt[y][x] == 8: rt[y][x] = rng.choice([8, 8, 8, 8, 48, 49, 50, 54, 55, 56])
wt = autotile(water, wTS, 1, rng)

# ------------------------------------------------------------ 오브젝트
trees = [A(f"Trees and Bushes/Tree_Emerald_{i}.png") for i in (1, 2, 3, 4)]
bushes = [A(f"Trees and Bushes/Bush_Emerald_{i}.png") for i in range(1, 8)]
small_bush = bushes[4:]; big_bush = bushes[:4]
rocks = [A(f"Rocks/Rock_Brown_{i}.png") for i in (1, 2, 4, 6, 9)]
_pc = {}
def P(n):
    if n not in _pc: _pc[n] = A(f"Props/{n}.png")
    return _pc[n]
def strip(p, fw):
    im = A(p); n = NAMES[id(im)]; out = [im.crop((i * fw, 0, i * fw + fw, im.height)) for i in range(im.width // fw)]
    for i, f in enumerate(out): NAMES[id(f)] = f"{n}_f{i}"
    return out
flowers = [strip("Props/Animation/Flowers_Red.png", 32)[0], strip("Props/Animation/Flowers_White.png", 32)[0]]
fires = strip("Props/Animation/Animation_Campfire.png", 32)
objs = []                                                                  # (img, x, y_bottom)
taken = []                                                                 # 소품끼리 겹침 방지 (x0,y0,x1,y1)
def blocked(cx, by, w, h, pad=0):
    x0, y0, x1, y1 = cx - w / 2, by - h * 0.35, cx + w / 2, by               # 밑동 기준
    gx, gy = int(min(GW - 1, max(0, cx // T))), int(min(GH - 1, max(0, (by - 4) // T)))
    if water[gy][gx] or road[gy][gx]: return True
    for lx, ly in LOTS:
        a = lot_box(lx, ly, 6)
        if x1 > a[0] + 4 and x0 < a[2] - 4 and y1 > a[1] + 40 and y0 < a[3] + 2: return True
    ex, ey = ENTRANCE
    if abs(cx - ex) < 96 and ey - 80 < by < ey + 34: return True
    for t in taken:
        if x1 + pad > t[0] and x0 - pad < t[2] and y1 + pad > t[1] and y0 - pad < t[3]: return True
    return False
def put(img, cx, by, force=False, pad=0):
    if not force and blocked(cx, by, img.width, img.height, pad): return False
    objs.append((img, cx - img.width // 2, by)); taken.append((cx - img.width / 2, by - img.height * 0.35, cx + img.width / 2, by)); return True

# 갱도 입구 (팩 바위 벽 3조각 + 팩 73색 안에서 찍은 동굴·나무 틀·레일)
def entrance():
    rock = Image.open(os.path.join(PACK, "Art/Rock Slopes/Tileset_RockSlope.png")).convert("RGBA").crop((18, 432, 62, 480))
    im = Image.new("RGBA", (132, 66), (0, 0, 0, 0)); im.alpha_composite(rock, (0, 0)); im.alpha_composite(rock.transpose(Image.FLIP_LEFT_RIGHT), (44, 0)); im.alpha_composite(rock, (88, 0))
    px = im.load(); hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    DARK, RIM, WL, WM, WD, OUT, RAIL, TIE = (hx(c) for c in ("#4d4439", "#5a5641", "#b59870", "#9e7f5c", "#684f39", "#4d4439", "#9a987d", "#664c35"))
    cx, top, bot = 66, 18, 50
    for y in range(top, bot):
        half = 13 if y > top + 4 else 13 - (top + 4 - y) * 2
        for x in range(cx - half, cx + half): px[x, y] = RIM if abs(x - cx) >= half - 1 else DARK
    for x0 in (cx - 17, cx + 13):
        for y in range(top - 2, bot):
            for x in range(x0, x0 + 4): px[x, y] = OUT if x in (x0, x0 + 3) else (WL if x == x0 + 1 else WM)
    for y in range(top - 6, top - 1):
        for x in range(cx - 20, cx + 20): px[x, y] = OUT if y in (top - 6, top - 2) or x in (cx - 20, cx + 19) else (WL if y == top - 5 else WM)
    for x in range(cx - 16, cx + 16, 6): px[x, top - 4] = WD
    for y in range(bot, 66):
        for x in (cx - 6, cx + 5): px[x, y] = RAIL
        if (y - bot) % 4 == 1:
            for x in range(cx - 8, cx + 8):
                if px[x, y] != RAIL: px[x, y] = TIE
    return im
ENT = entrance(); NAMES[id(ENT)] = "mine_entrance"; put(ENT, ENTRANCE[0], ENTRANCE[1] + 16, force=True)
put(P("Banner_Stick_1_Purple"), ENTRANCE[0] - 78, ENTRANCE[1] + 18, force=True); put(P("LampPost_3"), ENTRANCE[0] - 110, ENTRANCE[1] + 30, force=True)
put(P("Crate_Large_Empty"), ENTRANCE[0] + 48, ENTRANCE[1] + 34, force=True); put(P("Crate_Medium_Closed"), ENTRANCE[0] + 62, ENTRANCE[1] + 40, force=True); put(P("Sack_3"), ENTRANCE[0] + 36, ENTRANCE[1] + 42, force=True)
# 모닥불 광장
put(fires[0], 806, 352, force=True); put(P("Bench_1"), 780, 356, force=True); put(P("Bench_3"), 834, 358, force=True)
# 길가 가로등 · 게시판 · 이정표
for cx, by in ((236, 210), (452, 214), (668, 218), (110, 300), (604, 300)): put(P("LampPost_3"), cx, by, force=True)
put(P("BulletinBoard_1"), 46, 214, force=True); put(P("Sign_2"), 20, 292, force=True); put(P("Sign_1"), 300, 486, force=True)
# 집마다 문 옆 소품 뭉치 (2~4개)
KIT = ["Barrel_Small_Empty", "Crate_Medium_Closed", "Sack_3", "Basket_Empty", "Plant_2", "Crate_Water_1", "HayStack_2", "Table_Medium_1", "Bench_3"]
for cx, by in LOTS:
    for side in (-1, 1):
        n = rng.randrange(1, 3)
        for k in range(n): put(P(rng.choice(KIT)), int(cx + side * (LOT_W / 2 - 4 - k * 18)), by + 10 + rng.randrange(0, 8))
# 숲: 위 · 오른쪽 · 아래 오른쪽 · 왼쪽 위 — 경계 깊이에 노이즈
def forest_depth(edge, t):
    base = {"top": 66, "right": 58, "bottom": 46, "left": 40}[edge]; return base + 36 * noise(t + {"top": 0, "right": 300, "bottom": 600, "left": 900}[edge])
cand = []
for cx in range(-30, W + 40, 13):
    for by in range(20, H + 90, 13):
        d_top = by - forest_depth("top", cx) - 30
        d_right = (W - cx) - forest_depth("right", by)
        d_bot = (H + 40 - by) - forest_depth("bottom", cx) if cx > 640 else 999
        d_left = cx - forest_depth("left", by) if by < 180 else 999
        if min(d_top, d_right, d_bot, d_left) < 0: cand.append((cx + rng.randrange(-5, 6), by + rng.randrange(-5, 6)))
rng.shuffle(cand)
for cx, by in sorted(cand, key=lambda c: c[1]): put(rng.choice(trees), cx, by, pad=-18)
for cx, by in cand[:160]: put(rng.choice(big_bush), cx, by)
# 마을 안 작은 숲·덤불·바위·꽃 (뭉쳐서)
for gx, gy in ((250, 150), (466, 150), (90, 360), (700, 520), (470, 520), (230, 500), (880, 400), (360, 320)):
    for _ in range(rng.randrange(2, 5)):
        r = rng.random(); x, y = gx + rng.randrange(-26, 27), gy + rng.randrange(-16, 17)
        put(rng.choice(trees) if r < 0.3 else rng.choice(big_bush) if r < 0.6 else rng.choice(small_bush) if r < 0.8 else rng.choice(rocks), x, y)
for _ in range(40):                                                         # 뭉치: 큰 덤불 + 작은 덤불·꽃 둘레
    gx, gy = rng.randrange(30, W - 40), rng.randrange(120, H - 6)
    if put(rng.choice(big_bush), gx, gy):
        for _ in range(rng.randrange(2, 5)): put(rng.choice(flowers + small_bush + small_bush), gx + rng.randrange(-30, 31), gy + rng.randrange(-12, 16))
for _ in range(260):
    x, y = rng.randrange(30, W - 30), rng.randrange(110, H - 4); put(rng.choice(flowers + small_bush + rocks[3:]), x, y)
# 강가 바위·덤불
for _ in range(18):
    x, y = rng.randrange(0, 260), rng.randrange(400, 540); put(rng.choice(rocks + small_bush), x, y)

# ------------------------------------------------------------ 출력 — 건물이 들어갈 y 기준으로 back/front 나눔 (Code는 건물·사람을 y 정렬로 그 사이에)
for f in range(4):
    render(W, H, [(gTS, gt), (rTS, rt), (wTS, wt), (lTS, lt)], [], frame=f, bg=(160, 147, 138, 255)).save(os.path.join(OUT, f"yard_ground_f{f}.png"))
render(W, H, [], objs).save(os.path.join(OUT, "yard_props_all.png"))
os.makedirs(os.path.join(OUT, "props"), exist_ok=True); saved = set()
for im, x, by in objs:
    n = NAMES[id(im)]
    if n not in saved: im.save(os.path.join(OUT, "props", n + ".png")); saved.add(n)
for i, f in enumerate(fires): f.save(os.path.join(OUT, "props", f"campfire_f{i}.png"))
json.dump({"size": [W, H], "lots": [{"id": i, "cx": cx, "by": by, "w": LOT_W, "h": LOT_H} for i, (cx, by) in enumerate(LOTS)],
           "entrance": ENTRANCE, "spine": SPINE, "branches": [BR1, BR2], "campfire": [806, 344],
           "objects": [{"n": NAMES[id(im)], "x": x, "by": by} for im, x, by in objs],
           "idleSpots": [[790, 362], [826, 366], [760, 346], [404, 300], [96, 300], [620, 300], [300, 500], [700, 440]],
           "lamps": [[236, 170], [452, 174], [668, 178], [110, 260], [604, 260], [758, 270]], "credit_line": "타일·건물·나무: The Fan-tasy Tileset (Free) — Ventilatore",
           "credit": "The Fan-tasy Tileset (Free) by Ventilatore — non-commercial use"}, open(os.path.join(OUT, "yard_v5.json"), "w"), indent=0)
if MOCK:
    KIT = sys.argv[sys.argv.index("--mock") + 1] if len(sys.argv) > sys.argv.index("--mock") + 1 else None
    AN = json.load(open(os.path.join(KIT, "anchors.json")))
    img = Image.open(os.path.join(OUT, "yard_ground_f0.png")).convert("RGBA")
    things = list(objs)
    for (cx, by), n in zip(LOTS, ["lodge_1", "office_5", "smelter_3", "lanternshop_3", "warehouse_1", "pump_1", "cartshed_3", "molehome_1", "turretshop_1"]):
        b = Image.open(os.path.join(KIT, n + ".png")); ax, ay = AN[n]; things.append((b, cx - ax, by - ay + b.height))
    img = Image.alpha_composite(img, render(W, H, [], things))
    img.save(os.path.join(OUT, "yard_mock.png"))
print("→", OUT, len(objs), "objects")
