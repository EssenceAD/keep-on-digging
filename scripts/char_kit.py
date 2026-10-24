#!/usr/bin/env python3
"""Fan-tasy 무료판 주인공(40×48, 4방향) → 광부들. 머리·옷 색 바꾸기 + 프레임마다 안전모(헤드랜턴) 씌우기.
  python3 scripts/char_kit.py <팩 폴더> <출력 폴더> [--preview]
출력: miner_<이름>_idle.png · _walk.png (가로 4프레임 × 세로 4방향: 오른·왼·뒤·앞) + 미리보기
"""
import os, sys
import numpy as np
from PIL import Image

PACK, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(PACK, "Art/Characters/Main Character")
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
FW, FH = 40, 48
HAIR = ["#b87f4c", "#986641", "#784d36", "#593f2d"]                       # 밝음→어두움 (원본 갈색 머리)
TUNIC = ["#e9ca4f", "#dda349", "#c4873c", "#b17535"]                       # 노란 웃옷
MINERS = {  # 이름: 머리 4단, 웃옷 4단 (팩 색 위주)
    "brick": {"hair": ["#de5b49", "#c04a3e", "#9c3b35", "#7a2f2e"], "tunic": ["#87c7df", "#70b4da", "#5676ac", "#4a5f94"]},     # 브릭: 빨강머리·파란 작업복
    "tumba": {"hair": ["#6d6954", "#5a5641", "#4d4439", "#3c3a2c"], "tunic": ["#b59870", "#9e7f5c", "#8a6745", "#684f39"]},     # 툼바: 검은머리·갈색 앞치마
    "elin":  {"hair": ["#f4e555", "#e7c24e", "#dda349", "#bf9c35"], "tunic": ["#8ace70", "#5fba68", "#57a470", "#377b54"]},     # 엘린: 금발·초록
    "grun":  {"hair": ["#b87f4c", "#986641", "#784d36", "#593f2d"], "tunic": ["#cbb0e6", "#b399ce", "#9b80b8", "#6d5087"]},     # 그룬: 갈색·보라
}
HELMET = ["...kkkkkkkk...", "..kywwyyyyyk..", ".kyywyyyyyyok.", ".kyyyyyyyyyok.", "kkkkkkkkkkkkkk", "kooooooooooook", ".kkkkkkkkkkkk."]
HPAL = {"k": "#3c3a2c", "y": "#e9ca4f", "o": "#c4873c", "w": "#f4dc83", "l": "#f3f3e6"}

def recolor(a, src, dst, top_only=False):
    out = a.copy(); rgb = a[:, :, :3]
    rowpos = (np.arange(a.shape[0]) % FH)[:, None] < 26                     # 프레임 안 위쪽(머리)만
    for s, d in zip(src, dst):
        m = (rgb == np.array(hx(s))).all(2) & (a[:, :, 3] > 0)
        if top_only: m &= rowpos
        out[m, :3] = hx(d)
    return out
def helmet(fr, facing):
    a = np.array(fr); hair = np.zeros(a.shape[:2], bool)
    for h in HAIR: hair |= (a[:, :, :3] == np.array(hx(h))).all(2) & (a[:, :, 3] > 0)
    ys, xs = np.nonzero(hair)
    if not len(ys): return fr
    top = ys.min(); band = xs[ys <= top + 5]; cx = int(round((band.min() + band.max()) / 2))
    im = fr.copy(); rows = HELMET if facing != "back" else [r.replace("w", "y") for r in HELMET]
    if facing == "left": rows = [r[::-1] for r in rows]
    x0, y0 = cx - 7, top - 1
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != "." and 0 <= x0 + dx < FW and 0 <= y0 + dy < FH: im.putpixel((x0 + dx, y0 + dy), hx(HPAL[ch]) + (255,))
    if facing in ("front", "right", "left"):                                # 헤드랜턴
        lx = cx if facing == "front" else (x0 + 12 if facing == "right" else x0 + 1)
        im.putpixel((lx, y0 + 2), hx(HPAL["l"]) + (255,)); im.putpixel((lx, y0 + 3), hx(HPAL["w"]) + (255,))
    return im
FACING = ["right", "left", "back", "front"]
sheets = {}
for kind in ("Idle", "Walk"):
    src = Image.open(os.path.join(SRC, f"Character_{kind}.png")).convert("RGBA"); A = np.array(src)
    for name, c in MINERS.items():
        b = recolor(recolor(A, HAIR, c["hair"], True), TUNIC, c["tunic"]); im = Image.fromarray(b)
        # 안전모는 원본 머리 위치로 찾음 (색 바꾸기 전 프레임 기준)
        out = Image.new("RGBA", im.size)
        for r in range(src.height // FH):
            for k in range(src.width // FW):
                box = (k * FW, r * FH, k * FW + FW, r * FH + FH)
                fr = helmet_src = src.crop(box); hel = helmet(helmet_src, FACING[r])
                mask = np.array(hel)[:, :, 3] > 0; base = np.array(im.crop(box))
                diff = (np.array(hel) != np.array(helmet_src)).any(2)
                base[diff] = np.array(hel)[diff]
                out.paste(Image.fromarray(base), box[:2])
        out.save(os.path.join(OUT, f"miner_{name}_{kind.lower()}.png")); sheets[(name, kind)] = out
if "--preview" in sys.argv:
    pv = Image.new("RGBA", (FW * 4 * 2 + 8, FH * 4 * len(MINERS)), (128, 186, 104, 255))
    for i, name in enumerate(MINERS):
        pv.alpha_composite(sheets[(name, "Walk")], (0, i * FH * 4)); pv.alpha_composite(sheets[(name, "Idle")], (FW * 4 + 8, i * FH * 4))
    pv.resize((pv.width * 2, pv.height * 2), Image.NEAREST).save(os.path.join(OUT, "miners_preview.png"))
print("→", OUT)
