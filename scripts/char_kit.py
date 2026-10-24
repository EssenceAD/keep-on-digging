#!/usr/bin/env python3
"""Fan-tasy 무료판 주인공(40×48, 4방향) → 광부·NPC 전원. 머리·옷 색 바꾸기 + 모자(안전모·마법사·어부·두건·고글·챙모자) + 수염.
  python3 scripts/char_kit.py <팩 폴더> <출력 폴더> [--preview]
출력: <id>_idle.png · <id>_walk.png (40×48 프레임, 가로 4 × 세로 4방향: 오른·왼·뒤·앞, 발 = (20, 41)) + cast_preview.png
"""
import os, sys
import numpy as np
from PIL import Image

PACK, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(PACK, "Art/Characters/Main Character")
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
FW, FH = 40, 48
HAIR = ["#b87f4c", "#986641", "#784d36", "#593f2d"]
TUNIC = ["#e9ca4f", "#dda349", "#c4873c", "#b17535"]
SKIN = ["#f4c8a3", "#d9aa8d", "#b58a73"]
R = {  # 색 줄기 4단 (팩 색 위주)
    "red": ["#de5b49", "#c04a3e", "#9c3b35", "#7a2f2e"], "black": ["#6d6954", "#5a5641", "#4d4439", "#3c3a2c"], "blond": ["#f4e555", "#e7c24e", "#dda349", "#bf9c35"],
    "brown": ["#b87f4c", "#986641", "#784d36", "#593f2d"], "white": ["#f3f3e6", "#d1d1bb", "#b3b094", "#9a987d"], "orange": ["#ce9946", "#c4873c", "#af7d36", "#815728"],
    "gray": ["#b3b094", "#9a987d", "#817c68", "#6d6954"], "blue": ["#87c7df", "#70b4da", "#5676ac", "#4a5f94"], "green": ["#8ace70", "#5fba68", "#57a470", "#377b54"],
    "purple": ["#cbb0e6", "#b399ce", "#9b80b8", "#6d5087"], "leather": ["#b59870", "#9e7f5c", "#8a6745", "#684f39"], "teal": ["#87c7df", "#57a470", "#41665a", "#2a594a"],
    "slate": ["#a3a7c2", "#817c68", "#5a5641", "#4d4439"],
}
HATS = {
    "helmet": (["...kkkkkkkk...", "..kywwyyyyyk..", ".kyywyyyyyyok.", ".kyyyyyyyyyok.", "kkkkkkkkkkkkkk", "kooooooooooook", ".kkkkkkkkkkkk."], {"y": "#e9ca4f", "o": "#c4873c", "w": "#f4dc83"}, -1, True),
    "wizard": ([".......kk.......", "......kpk.......", ".....kppk.......", ".....kpppk......", "....kpppppk.....", "....kpppppk.....", "...kppyypppk....", "..kkkkkkkkkkkk..", "kkqqqqqqqqqqqqkk", ".kkkkkkkkkkkkkk."], {"p": "#9b80b8", "q": "#6d5087", "y": "#f4e555"}, -7, False),
    "bucket": (["....kkkkkk....", "...kssssssk...", "..kssssssssk..", "..kddddddddk..", "kkkkkkkkkkkkkk", "kssssssssssssk", ".kkkkkkkkkkkk."], {"s": "#bca769", "d": "#a38c4d"}, -2, False),
    "brim": (["....kkkkkkk.....", "...knnnnnnnk....", "...knnnnnnnk....", "...kddddddk.....", "kkkkkkkkkkkkkkkk", "kttttttttttttttk", ".kkkkkkkkkkkkkk."], {"n": "#784d36", "d": "#593f2d", "t": "#986641"}, -2, False),
    "goggles": (["kkkkkkkkkkkkkk", "kbbkwwkkwwkbbk", "kbbkllkkllkbbk", "kkkkkkkkkkkkkk"], {"b": "#684f39", "w": "#87c7df", "l": "#70b4da"}, 3, False),
    "hood": None,
}
CAST = {  # id: 머리, 옷, 모자, 수염(색 줄기 또는 None)
    "miner_brick": ("red", "blue", "helmet", None), "miner_tumba": ("black", "leather", "helmet", None),
    "miner_elin": ("blond", "green", "helmet", None), "miner_grun": ("brown", "purple", "helmet", None),
    "miner_dor": ("orange", "slate", "helmet", None), "miner_fin": ("blond", "red", "helmet", None),
    "miner_marta": ("red", "teal", "helmet", None), "miner_ugle": ("black", "orange", "helmet", "black"),
    "npc_halabeoji": ("white", "leather", None, "white"),        # 할아범: 흰머리·흰수염·가죽옷
    "npc_momo": ("purple", "purple", "wizard", None),            # 모모: 보라 마법사 모자
    "npc_brok": ("red", "leather", None, "red"),                 # 브로크(대장장이): 붉은 머리·수염·가죽 앞치마
    "npc_merchant": ("brown", "green", "brim", None),            # 떠돌이 상인: 챙모자·초록 옷
    "npc_guild_abyss": ("red", "blue", "bucket", "red"),         # 심연낚시 동호회: 어부 모자·붉은 수염
    "npc_guild_tower": ("brown", "slate", "goggles", None),      # 탑오르는중: 고글·회청 외투
    "npc_guild_shield": ("orange", "gray", "hood", None),        # 방패장인 조합: 회색 두건
}
def recolor(a, src, dst, top_only=False):
    out = a.copy(); rgb = a[:, :, :3]; rowpos = (np.arange(a.shape[0]) % FH)[:, None] < 26
    for s, d in zip(src, dst):
        m = (rgb == np.array(hx(s))).all(2) & (a[:, :, 3] > 0)
        if top_only: m &= rowpos
        out[m, :3] = hx(d)
    return out
def mask_of(a, cols):
    m = np.zeros(a.shape[:2], bool)
    for c in cols: m |= (a[:, :, :3] == np.array(hx(c))).all(2) & (a[:, :, 3] > 0)
    return m
def stamp(im, rows, pal, x0, y0, mirror=False):
    P = dict(pal); P.setdefault("k", "#3c3a2c")
    for dy, r in enumerate(rows):
        r = r[::-1] if mirror else r
        for dx, ch in enumerate(r):
            if ch != "." and 0 <= x0 + dx < FW and 0 <= y0 + dy < FH: im.putpixel((x0 + dx, y0 + dy), hx(P[ch]) + (255,))
def dress(src_fr, out_fr, facing, hat, beard):
    a = np.array(src_fr); hair = mask_of(a, HAIR)
    ys, xs = np.nonzero(hair)
    if not len(ys): return out_fr
    top = ys.min(); band = xs[ys <= top + 5]; cx = int(round((band.min() + band.max()) / 2)); im = out_fr
    if beard and facing != "back":                                        # 얼굴 아래쪽 2줄 + 턱 1줄
        sk = mask_of(a, SKIN); sk[top + 16:] = False; sy, sx = np.nonzero(sk)
        if len(sy):
            by1 = sy.max(); bx0, bx1 = sx.min(), sx.max(); C = R[beard]
            for y in range(by1 - 2, by1 + 2):
                for x in range(bx0, bx1 + 1):
                    if sk[min(y, FH - 1), x] or y > by1: im.putpixel((x, y), hx(C[1] if y < by1 else C[2]) + (255,))
            for x in range(bx0 + 1, bx1): im.putpixel((x, by1 + 2), hx(C[3]) + (255,))
    if hat and HATS.get(hat):
        rows, pal, dy, lamp = HATS[hat]; w = len(rows[0])
        if hat == "goggles" and facing == "back": rows = [rows[0]] * 2
        x0 = cx - w // 2; stamp(im, rows, pal, x0, top + dy, facing == "left")
        if lamp and facing != "back":
            lx = cx if facing == "front" else (x0 + w - 2 if facing == "right" else x0 + 1)
            im.putpixel((lx, top + 1), hx("#f3f3e6") + (255,)); im.putpixel((lx, top + 2), hx("#f4dc83") + (255,))
    return im
FACING = ["right", "left", "back", "front"]
sheets = {}
for kind in ("Idle", "Walk"):
    src = Image.open(os.path.join(SRC, f"Character_{kind}.png")).convert("RGBA"); A = np.array(src)
    for cid, (hair, tunic, hat, beard) in CAST.items():
        hr = R["gray"] if hat == "hood" else R[hair]
        b = recolor(recolor(A, HAIR, hr, True), TUNIC, R[tunic]); im = Image.fromarray(b); out = Image.new("RGBA", im.size)
        for r in range(src.height // FH):
            for k in range(src.width // FW):
                box = (k * FW, r * FH, k * FW + FW, r * FH + FH)
                out.paste(dress(src.crop(box), im.crop(box), FACING[r], hat, beard), box[:2])
        out.save(os.path.join(OUT, f"{cid}_{kind.lower()}.png")); sheets[(cid, kind)] = out
if "--preview" in sys.argv:
    ids = list(CAST); pv = Image.new("RGBA", (len(ids) * 44 + 4, 3 * 52), (128, 186, 104, 255))
    for i, cid in enumerate(ids):
        s = sheets[(cid, "Idle")]
        for j, row in enumerate((3, 0, 2)): pv.alpha_composite(s.crop((0, row * FH, FW, row * FH + FH)), (4 + i * 44, j * 52))
    pv.resize((pv.width * 3, pv.height * 3), Image.NEAREST).save(os.path.join(OUT, "cast_preview.png"))
print("→", OUT, len(CAST))
