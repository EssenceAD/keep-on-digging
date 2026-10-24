#!/usr/bin/env python3
"""꼬물(두더지) · 광차 — 팩 73색 안에서 손으로 찍은 스프라이트. 외곽선 #3c3a2c, 명암 3단.
  python3 scripts/critter_kit.py <출력 폴더>
출력: mole_idle.png(24×18 ×4, 코 킁킁) · mole_walk.png(×4, 오른쪽 보기 — 왼쪽은 좌우 뒤집기) · cart_empty/ore/gold/glow.png(28×22) · cart_roll.png(바퀴 4프레임)
"""
import os, sys
from PIL import Image
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
PAL = {"k": "#3c3a2c", "b": "#593f2d", "m": "#784d36", "l": "#986641", "h": "#b87f4c", "p": "#de5b49", "q": "#f4c8a3", "w": "#f3f3e6", "e": "#3c3a2c",
       "g": "#817c68", "s": "#9a987d", "d": "#5a5641", "t": "#9e7f5c", "n": "#684f39", "y": "#f4e555", "o": "#dda349", "c": "#a3a7c2", "u": "#d1d1bb", "z": "#70b4da", "x": "#87c7df"}
def spr(rows):
    im = Image.new("RGBA", (len(rows[0]), len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".": im.putpixel((x, y), hx(PAL[ch]))
    return im
def strip(frames):
    w, h = frames[0].size; s = Image.new("RGBA", (w * len(frames), h))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * w, 0))
    return s
# 꼬물: 오른쪽 보는 두더지 (몸 갈색 3단, 분홍 코, 크림 앞발)
BODY = [
    "........................",
    ".........kkkkkk.........",
    ".......kkhhhhhhkk.......",
    "......khhllllllhhk......",
    ".....khllllllllllkk.....",
    "....khlllllllllllmlk....",
    "...khllllllllllemmlkk...",
    "...klllllllllllllmmlpk..",
    "..kllllllllllllllmmllppk",
    "..kmlllllllllllllmmmlpk.",
    "..kmmllllllllllmmmmkkk..",
    "..kbmmmllllllmmmmmbk....",
    "...kbbmmmmmmmmmbbbk.....",
    "....kkbbbbbbbbbbkkk.....",
    ".....kqqk...kqqk........",
    ".....kkkk...kkkk........",
    "........................",
    "........................",
]
def mole(frame, walk=False):
    rows = [r for r in BODY]
    if not walk:                                                           # 코 킁킁: 코 위아래
        if frame in (1, 3): rows[7], rows[8] = rows[7][:-3] + "lpk", rows[8][:-4] + "lppk"
    else:                                                                  # 걷기: 앞발 교차 + 몸 들썩
        feet = [".....kqqk...kqqk........", "......kqqk.kqqk.........", ".....kqqk...kqqk........", "....kqqk.....kqqk......."][frame]
        rows[14] = feet; rows[15] = feet.replace("q", "k")
        if frame in (1, 3): rows = ["." * 24] + rows[:-1]
    return spr(rows)
strip([mole(i) for i in range(4)]).save(os.path.join(OUT, "mole_idle.png"))
strip([mole(i, True) for i in range(4)]).save(os.path.join(OUT, "mole_walk.png"))
# 광차 28×22: 짐칸(나무판+쇠테) + 바퀴 2, 짐 종류별
def _row(*parts):
    r = "".join(parts); return r.ljust(28, ".")[:28]
def _wheels(a, b):
    r = ["."] * 28
    for x0 in (2, 17):
        for i, ch in enumerate(a if isinstance(a, str) else a): pass
    return r
W7 = [".kkkkk.", "kgsdgsk", "ksdkdsk", "kgsdgsk", ".kkkkk."]
CART = [_row()] * 6 + [
    _row("..", "k" * 24), _row("..k", "s" * 22, "k"), _row("..k", "g" * 22, "k"), _row("...k", "t" * 20, "k"),
    _row("...k", "nnnn", "k", "t" * 10, "k", "nnnn", "k"), _row("...k", "t" * 20, "k"), _row("...k", "n" * 20, "k"), _row("...k", "g" * 20, "k"),
    _row("....", "k" * 20), _row(".....kdk", "." * 11, "kdk")] + [_row("..", w, "." * 8, w) for w in W7] + [_row()]
CART = [r.ljust(28, ".")[:28] for r in CART]
def _load(a, b):
    return ["......kkk...kkk...kkk.....", ".....k" + a + "k.k" + b + "k.k" + a + "k....", "...kk" + b + a + "kk" + a + b + "kk" + b + "kk..."]
LOAD = {"ore": _load("gsd", "dgs"), "gold": _load("yoy", "oyo"), "glow": _load("zxz", "xzx")}
def cart(load=None, wheel=0):
    rows = list(CART)
    if load:
        for i, r in enumerate(LOAD[load]): rows[3 + i] = r.ljust(28, ".")[:28]
    spoke = [("kgsdgsk", "ksdkdsk", "kgsdgsk"), ("kgdsgdk", "kdskdsk", "kgdsgdk"), ("ksgdsgk", "kdskdsk", "ksgdsgk"), ("kdgsdgk", "ksdkdsk", "kdgsdgk")][wheel]
    for j, line in enumerate(spoke):
        r = list(rows[17 + j]); r[2:9] = list(line); r[17:24] = list(line); rows[17 + j] = "".join(r)
    return spr(rows)
cart().save(os.path.join(OUT, "cart_empty.png"))
for k in LOAD: cart(k).save(os.path.join(OUT, f"cart_{k}.png"))
for k in (None, "ore", "gold", "glow"): strip([cart(k, w) for w in range(4)]).save(os.path.join(OUT, f"cart_roll{'_' + k if k else ''}.png"))
pv = Image.new("RGBA", (24 * 4 + 28 * 4 + 20, 26), (128, 186, 104, 255))
pv.alpha_composite(Image.open(os.path.join(OUT, "mole_idle.png")), (2, 4))
for i, k in enumerate(("empty", "ore", "gold", "glow")): pv.alpha_composite(Image.open(os.path.join(OUT, f"cart_{k}.png")), (100 + i * 30, 2))
pv.resize((pv.width * 4, pv.height * 4), Image.NEAREST).save(os.path.join(OUT, "critter_preview.png"))
print("→", OUT)
